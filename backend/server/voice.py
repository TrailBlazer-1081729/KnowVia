"""Gemini Live audio-to-audio WebSocket endpoint."""

import asyncio
import json
import os
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from google.genai import types

from backend.gemini import get_gemini_client
from .retrieval import find_relevant_chunks
from .state import DOCUMENTS, DOCUMENT_CHUNKS, mcp_manager

router = APIRouter()


@router.websocket("/api/voice/live")
async def voice_live_socket(
    websocket: WebSocket,
    document_id: str = Query(...),
    session_id: str = Query(...),
    mock: bool = Query(False),
):
    await websocket.accept()
    doc = DOCUMENTS.get(document_id)

    # 1. Validate document existence and readiness
    if not doc or doc.status != "ready":
        await websocket.send_json({
            "type": "error",
            "message": "Document must complete ingestion before voice conversation can begin.",
        })
        await websocket.close(code=1008)
        return

    # 2. Handle mock mode for dev simulation / test suite
    if mock:
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "document_id": document_id,
            "document_name": doc.filename,
            "mode": "voice_realtime",
            "mock_mode": True,
            "document_ready": True,
        })
        await websocket.send_json({
            "type": "state",
            "state": "listening",
        })

        mock_epoch = 0
        try:
            while True:
                msg = await websocket.receive()
                if msg["type"] == "websocket.disconnect":
                    break

                if "bytes" in msg and msg["bytes"]:
                    pass
                elif "text" in msg and msg["text"]:
                    try:
                        data = json.loads(msg["text"])
                    except Exception:
                        continue

                    mtype = data.get("type")
                    if mtype == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif mtype == "stop":
                        break
                    elif mtype == "interrupt":
                        mock_epoch += 1
                        await websocket.send_json({
                            "type": "interrupted",
                            "epoch": mock_epoch,
                            "source": "client",
                        })
                        await websocket.send_json({
                            "type": "state",
                            "state": "listening",
                            "epoch": mock_epoch,
                        })
                    elif mtype == "end_turn":
                        mock_epoch += 1
                        await websocket.send_json({
                            "type": "state",
                            "state": "speaking",
                            "epoch": mock_epoch,
                        })
                        await websocket.send_json({
                            "type": "output_transcription",
                            "text": f"Grounded response for {doc.filename}.",
                            "epoch": mock_epoch,
                        })
                        # 100ms 24kHz silent PCM chunk
                        await websocket.send_bytes(b"\x00\x00" * 2400)
                        await websocket.send_json({
                            "type": "turn_complete",
                            "epoch": mock_epoch,
                        })
                        await websocket.send_json({
                            "type": "state",
                            "state": "listening",
                            "epoch": mock_epoch,
                        })
        except WebSocketDisconnect:
            pass
        except Exception as exc:
            print(f"[WebSocket Mock notice] {exc}", flush=True)
        finally:
            try:
                await websocket.close()
            except Exception:
                pass
            print(f"[WebSocket] Voice session {session_id} (mock) cleanly closed.", flush=True)
        return

    # 3. Validate API key
    if not os.getenv("GEMINI_API_KEY"):
        await websocket.send_json({
            "type": "error",
            "message": "GEMINI_API_KEY is missing from backend environment (.env).",
        })
        await websocket.close(code=1008)
        return

    # 3. Prepare grounded document context for Gemini Live system instruction
    chunks = DOCUMENT_CHUNKS.get(document_id, [])
    doc_context_lines = []
    for c in chunks:
        p_num = c.get("page", 1)
        doc_context_lines.append(f"[Page {p_num}]: {c.get('text', '')}")
    doc_context_str = "\n\n".join(doc_context_lines)
    if len(doc_context_str) > 50000:
        doc_context_str = doc_context_str[:50000] + "\n...[truncated for length]..."

    system_instruction = f"""
    You are a helpful, natural, human-like AI research assistant working with
    the document "{doc.filename}". Understand the user's intent and focus on
    completing their task, not merely explaining how to do it.

    - Use available MCP tools whenever they help fulfil the request. For multi-step
      tasks, perform the necessary steps in order and use actual tool results.
    - Ground document-related answers in the provided excerpts and cite page numbers
      when available. Use search tools when external research is needed.
    - Follow the user's requested content, format, and length exactly as closely
      as possible. Never impose your own word count or shorten content that must
      be saved or processed.
    - If generated or retrieved content exceeds 200 words, give a concise spoken
      summary instead of reading the entire content aloud, unless the user
      explicitly asks you to read it in full. Always pass the complete content
      to the appropriate tool when required.
    - Speak naturally, warmly, and concisely. Avoid robotic narration and
      unnecessary questions. Clarify only when essential.
    - Never invent information or claim an action succeeded without confirmation
      from the relevant tool. If something fails, explain it briefly.

    Prioritize understanding the user's goal, completing it accurately using
    available tools, and keeping spoken responses concise and conversational.

    DOCUMENT EXCERPTS:
    {doc_context_str}
    """

    # 4. Discover connected MCP tools (testing1, testing2, search_web, etc.)
    try:
        await mcp_manager.connect()
        tools_dict = await mcp_manager.get_tools()
    except Exception as exc:
        print(f"[WebSocket] MCP discovery warning: {exc}")
        tools_dict = {}

    declarations = []
    for name, tool_info in tools_dict.items():
        declarations.append(
            types.FunctionDeclaration(
                name=name,
                description=tool_info.get("description") or name,
                parameters_json_schema=tool_info["input_schema"],
            )
        )

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        tools=[types.Tool(function_declarations=declarations)] if declarations else None,
        system_instruction=system_instruction,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
            ),
            activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        ),
    )

    # 5. Connect to Gemini Live session
    client = get_gemini_client()
    live_context = client.aio.live.connect(
        model="gemini-3.8-live",
        config=config,
    )

    try:
        live_session = await live_context.__aenter__()
    except Exception as exc:
        print(f"[WebSocket Error] Could not connect to Gemini Live: {exc}", flush=True)
        await websocket.send_json({
            "type": "error",
            "message": f"Could not connect to Gemini Live: {str(exc)}",
        })
        await websocket.close(code=1011)
        return

    # 6. Handshake confirmation
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "document_id": document_id,
        "document_name": doc.filename,
        "mode": "voice_realtime",
        "mock_mode": False,
        "document_ready": True,
    })
    await websocket.send_json({
        "type": "state",
        "state": "listening",
    })

    stop_event = asyncio.Event()

    # Interruption state and generation epoch tracking
    current_generation_epoch = 0
    is_interrupted = False
    interruption_lock = asyncio.Lock()

    async def trigger_interruption(source: str):
        nonlocal current_generation_epoch, is_interrupted
        async with interruption_lock:
            current_generation_epoch += 1
            is_interrupted = True
            epoch = current_generation_epoch

        print(f"[WebSocket Interruption] Triggered by {source}, epoch={epoch}", flush=True)

        try:
            await websocket.send_json({
                "type": "interrupted",
                "epoch": epoch,
                "source": source,
            })
            await websocket.send_json({
                "type": "state",
                "state": "listening",
                "epoch": epoch,
            })
        except Exception:
            pass

        # If manual client interrupt, signal activity boundary to Gemini Live to cut off generation
        if source == "client":
            try:
                await live_session.send_realtime_input(activity_start=types.ActivityStart())
                await live_session.send_realtime_input(activity_end=types.ActivityEnd())
            except Exception as exc:
                print(f"[WebSocket] Notice sending activity interrupt to Gemini: {exc}", flush=True)

    async def client_to_gemini():
        """Receive microphone audio chunks and control frames from the client and stream to Gemini Live."""
        nonlocal is_interrupted
        try:
            while not stop_event.is_set():
                msg = await websocket.receive()
                if msg["type"] == "websocket.disconnect":
                    break

                # Binary frame: raw 16kHz 16-bit PCM microphone audio
                if "bytes" in msg and msg["bytes"]:
                    if is_interrupted:
                        is_interrupted = False
                    await live_session.send_realtime_input(
                        audio=types.Blob(
                            data=msg["bytes"],
                            mime_type="audio/pcm;rate=16000",
                        )
                    )
                elif "text" in msg and msg["text"]:
                    try:
                        data = json.loads(msg["text"])
                    except Exception:
                        continue

                    mtype = data.get("type")
                    if mtype == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif mtype == "stop":
                        stop_event.set()
                        break
                    elif mtype == "end_turn":
                        await live_session.send_realtime_input(audio_stream_end=True)
                    elif mtype == "text" and "text" in data:
                        if is_interrupted:
                            is_interrupted = False
                        await live_session.send(input=data["text"], end_of_turn=True)
                    elif mtype == "interrupt":
                        # Client signal barge-in
                        await trigger_interruption("client")
        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            print(f"[WebSocket client_to_gemini error] {exc}", flush=True)
        finally:
            stop_event.set()

    async def gemini_to_client():
        """Receive audio streams, tool requests, and transcriptions from Gemini Live and forward to client."""
        nonlocal is_interrupted
        has_sent_speaking_state = False
        try:
            while not stop_event.is_set():
                async for response in live_session.receive():
                    if stop_event.is_set():
                        break

                    # A. Tool Call Execution
                    if response.tool_call:
                        has_sent_speaking_state = False
                        await websocket.send_json({
                            "type": "state",
                            "state": "executing_tool",
                        })
                        responses = []
                        for fc in response.tool_call.function_calls:
                            call_id = fc.id or f"call_{uuid.uuid4().hex[:8]}"
                            server_name = tools_dict.get(fc.name, {}).get("server", "mcp")
                            await websocket.send_json({
                                "type": "tool_call",
                                "id": call_id,
                                "name": fc.name,
                                "server": server_name,
                                "arguments": fc.args or {},
                                "status": "running",
                            })
                            try:
                                tool_res = await mcp_manager.call_tool(fc.name, fc.args or {})
                                content = [
                                    item.text
                                    for item in tool_res.content
                                    if hasattr(item, "text")
                                ]
                                res_data = {"result": content, "is_error": tool_res.isError}
                                status = "failed" if tool_res.isError else "completed"
                            except Exception as texc:
                                res_data = {"error": str(texc), "is_error": True}
                                status = "failed"

                            await websocket.send_json({
                                "type": "tool_result",
                                "id": call_id,
                                "name": fc.name,
                                "server": server_name,
                                "status": status,
                                "result": res_data.get("result"),
                                "error": res_data.get("error"),
                            })
                            responses.append(
                                types.FunctionResponse(
                                    id=fc.id,
                                    name=fc.name,
                                    response=res_data,
                                )
                            )

                        await live_session.send_tool_response(function_responses=responses)

                    # B. Server Content
                    sc = response.server_content
                    if sc is None:
                        continue

                    # Interruption (barge-in detected by Gemini VAD)
                    if sc.interrupted:
                        has_sent_speaking_state = False
                        await trigger_interruption("gemini_vad")

                    # Input speech transcription
                    if sc.input_transcription and sc.input_transcription.text:
                        is_interrupted = False
                        text = sc.input_transcription.text
                        await websocket.send_json({
                            "type": "input_transcription",
                            "text": text,
                            "epoch": current_generation_epoch,
                        })
                        relevant = find_relevant_chunks(document_id, text, top_k=2)
                        if relevant:
                            sources = [
                                {
                                    "id": f"src_{i+1}",
                                    "page": c["page"],
                                    "section": c.get("section", f"Page {c['page']}"),
                                    "snippet": c["text"][:180] + ("..." if len(c["text"]) > 180 else ""),
                                    "relevance_score": c.get("relevance_score", 0.9),
                                }
                                for i, c in enumerate(relevant)
                            ]
                            await websocket.send_json({
                                "type": "sources",
                                "items": sources,
                                "document_name": doc.filename,
                                "query": text,
                            })

                    # Output speech transcription (suppressed if interrupted)
                    if sc.output_transcription and sc.output_transcription.text:
                        if is_interrupted:
                            continue
                        text = sc.output_transcription.text
                        await websocket.send_json({
                            "type": "output_transcription",
                            "text": text,
                            "epoch": current_generation_epoch,
                        })
                        relevant = find_relevant_chunks(document_id, text, top_k=2)
                        if relevant:
                            sources = [
                                {
                                    "id": f"src_{i+1}",
                                    "page": c["page"],
                                    "section": c.get("section", f"Page {c['page']}"),
                                    "snippet": c["text"][:180] + ("..." if len(c["text"]) > 180 else ""),
                                    "relevance_score": c.get("relevance_score", 0.9),
                                }
                                for i, c in enumerate(relevant)
                            ]
                            await websocket.send_json({
                                "type": "sources",
                                "items": sources,
                                "document_name": doc.filename,
                            })

                    # Streaming PCM audio output chunks (24kHz 16-bit mono) & text
                    if sc.model_turn:
                        if is_interrupted:
                            # Drop queued/stale audio chunks and text deltas from the interrupted response
                            continue
                        if not has_sent_speaking_state:
                            has_sent_speaking_state = True
                            await websocket.send_json({
                                "type": "state",
                                "state": "speaking",
                                "epoch": current_generation_epoch,
                            })
                        for part in sc.model_turn.parts:
                            if is_interrupted:
                                break
                            if hasattr(part, "text") and part.text:
                                await websocket.send_json({
                                    "type": "text",
                                    "delta": part.text,
                                    "epoch": current_generation_epoch,
                                })
                            if part.inline_data and part.inline_data.data:
                                await websocket.send_bytes(part.inline_data.data)

                    # Turn complete
                    if sc.turn_complete:
                        has_sent_speaking_state = False
                        if is_interrupted:
                            is_interrupted = False
                            continue
                        await websocket.send_json({
                            "type": "turn_complete",
                            "epoch": current_generation_epoch,
                        })
                        await websocket.send_json({
                            "type": "state",
                            "state": "listening",
                            "epoch": current_generation_epoch,
                        })

        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            print(f"[WebSocket gemini_to_client error] {exc}", flush=True)
            try:
                await websocket.send_json({"type": "error", "message": str(exc)})
            except Exception:
                pass
        finally:
            stop_event.set()

    sender_task = asyncio.create_task(client_to_gemini())
    receiver_task = asyncio.create_task(gemini_to_client())

    try:
        await asyncio.wait(
            [sender_task, receiver_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    finally:
        stop_event.set()
        sender_task.cancel()
        receiver_task.cancel()
        await asyncio.gather(sender_task, receiver_task, return_exceptions=True)

        try:
            await live_context.__aexit__(None, None, None)
        except Exception as exc:
            print(f"[WebSocket live cleanup notice] {exc}", flush=True)

        try:
            await websocket.close()
        except Exception:
            pass
        print(f"[WebSocket] Voice session {session_id} cleanly closed.", flush=True)
