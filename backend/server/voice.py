"""Gemini Live audio-to-audio WebSocket endpoint."""

import asyncio
import json
import os
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from google.genai import types

from backend.gemini import get_gemini_client
from .retrieval import build_source_citations, find_relevant_chunks
from .state import DOCUMENTS, mcp_manager

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

    # 3. Build system instruction with tool-based retrieval
    system_instruction = f"""
    You are KnowVia, a natural, highly capable AI research voice assistant working with
    the document "{doc.filename}".

    You have access to tools:
    1. `search_document`: Use this tool to search and retrieve relevant excerpts from "{doc.filename}"
       whenever the user asks questions about the document, its contents, data, analysis, or citations.
       Always search before answering document questions rather than guessing.
    2. Connected MCP tools: Use external tools when needed for external tasks, calculations, or integrations.

    Guidelines:
    - When asked about the document, call `search_document` with a targeted query.
    - Ground document-related answers strictly in the retrieved excerpts and cite page numbers accurately.
    - If retrieved content is extensive, give a concise, articulate spoken summary highlighting the key facts.
    - Speak naturally, warmly, and concisely. Keep answers conversational for voice.
    - Never invent information or claim an action succeeded without confirmation from tools.
    """

    # 4. Discover connected MCP tools (testing1, testing2, search_web, etc.)
    try:
        await mcp_manager.connect()
        tools_dict = await mcp_manager.get_tools()
    except Exception as exc:
        print(f"[WebSocket] MCP discovery warning: {exc}")
        tools_dict = {}

    rag_declaration = types.FunctionDeclaration(
        name="search_document",
        description=f"Search the contents of the active document '{doc.filename}' using semantic retrieval. Returns relevant excerpts with page numbers and sections.",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query or concept to locate in the document.",
                },
            },
            "required": ["query"],
        },
    )

    declarations = [rag_declaration]
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
                            fc_name = fc.name
                            fc_args = fc.args or {}

                            if fc_name == "search_document":
                                server_name = "internal_rag"
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "id": call_id,
                                    "name": fc_name,
                                    "server": server_name,
                                    "arguments": fc_args,
                                    "status": "running",
                                })
                                query = str(fc_args.get("query", ""))
                                try:
                                    relevant = await find_relevant_chunks(document_id, query, top_k=5)
                                    evidence = [
                                        {
                                            "chunk_id": c.get("id"),
                                            "page": c.get("page"),
                                            "section": c.get("section", f"Page {c.get('page')}"),
                                            "content": c.get("text", ""),
                                        }
                                        for c in relevant
                                    ]
                                    citations = build_source_citations(relevant)
                                    res_data = {
                                        "document_id": document_id,
                                        "document_name": doc.filename,
                                        "query": query,
                                        "results": evidence,
                                        "is_error": False,
                                    }
                                    status = "completed"

                                    # Emit source citations to frontend if turn has not been interrupted
                                    if not is_interrupted and citations:
                                        await websocket.send_json({
                                            "type": "sources",
                                            "items": [c.model_dump() for c in citations],
                                            "document_name": doc.filename,
                                            "query": query,
                                            "epoch": current_generation_epoch,
                                        })
                                except Exception as rexc:
                                    print(f"[WebSocket] RAG search error: {rexc}", flush=True)
                                    res_data = {"error": str(rexc), "is_error": True, "results": []}
                                    status = "failed"

                                await websocket.send_json({
                                    "type": "tool_result",
                                    "id": call_id,
                                    "name": fc_name,
                                    "server": server_name,
                                    "status": status,
                                    "result": res_data,
                                    "error": res_data.get("error"),
                                })
                                responses.append(
                                    types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response=res_data,
                                    )
                                )
                            else:
                                server_name = tools_dict.get(fc_name, {}).get("server", "mcp")
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "id": call_id,
                                    "name": fc_name,
                                    "server": server_name,
                                    "arguments": fc_args,
                                    "status": "running",
                                })
                                try:
                                    tool_res = await mcp_manager.call_tool(fc_name, fc_args)
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
                                    "name": fc_name,
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
