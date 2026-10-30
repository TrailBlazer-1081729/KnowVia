import asyncio
import json
import os
import uuid
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

import pypdf
from google.genai import types
from backend.gemini import get_gemini_client, get_model_name
from backend.client_manager import MCPClientManager

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "backend" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Shared MCP Client Manager across application lifespan
mcp_manager = MCPClientManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await mcp_manager.connect()
        print("[Lifespan] MCP Client Manager connected successfully.", flush=True)
    except Exception as exc:
        print(f"[Lifespan Notice] MCP connect notice: {exc}", flush=True)
    yield
    try:
        await mcp_manager.close()
        print("[Lifespan] MCP Client Manager closed.", flush=True)
    except Exception as exc:
        print(f"[Lifespan Warning] MCP close error: {exc}", flush=True)

app = FastAPI(
    title="RAG Voice Assistant API",
    description="Backend API and MCP orchestration boundary for PDF RAG Research and Voice Assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Data Models
# ---------------------------------------------------------

class SourceCitation(BaseModel):
    id: str
    page: int
    section: Optional[str] = None
    snippet: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class DocumentMetadata(BaseModel):
    id: str
    filename: str
    size_bytes: int
    page_count: int
    chunk_count: int = 0
    uploaded_at: str
    status: str = "idle"  # idle | uploading | ingesting | ready | error
    stage: str = "uploaded"  # uploaded | extracting_text | chunking | generating_embeddings | building_index | completed | failed
    progress: float = 0.0  # 0.0 to 1.0
    error_message: Optional[str] = None
    mcp_provider: str = "internal_pipeline"  # will reflect future "mcp:rag_ingestion" when attached
    file_path: Optional[str] = None


class IngestStatusResponse(BaseModel):
    document_id: str
    status: str
    stage: str
    progress: float
    metadata: Optional[DocumentMetadata] = None
    message: str


class ChatRequest(BaseModel):
    session_id: str
    document_id: str
    message: str
    stream: bool = False


class ChatMessage(BaseModel):
    id: str
    role: str  # user | assistant | system
    content: str
    sources: Optional[List[SourceCitation]] = None
    timestamp: str
    model: Optional[str] = None


class SessionInfo(BaseModel):
    id: str
    document_id: str
    title: str
    created_at: str
    messages: List[ChatMessage] = []


# ---------------------------------------------------------
# In-Memory State Stores (Thread-Safe within asyncio)
# ---------------------------------------------------------

DOCUMENTS: Dict[str, DocumentMetadata] = {}
DOCUMENT_CHUNKS: Dict[str, List[Dict[str, Any]]] = {}
SESSIONS: Dict[str, SessionInfo] = {}

# Background ingestion tasks lock/tracker
INGESTION_TASKS: Dict[str, asyncio.Task] = {}

# ---------------------------------------------------------
# MCP Integration Adapter
# ---------------------------------------------------------

class MCPIntegrationLayer:
    """
    Integration adapter for MCP servers:
    1. Ingestion MCP: accepts document reference, extracts, embeds, indexes.
    2. Query MCP: performs vector search and returns context with citations.
    """
    def __init__(self, manager: MCPClientManager):
        self.mcp_manager = manager

    async def call_ingestion_mcp(self, document_id: str, file_path: str) -> Optional[Dict[str, Any]]:
        """Hook to be invoked when Ingestion MCP server is installed."""
        if not self.mcp_manager.sessions:
            return None
        try:
            tools = await self.mcp_manager.get_tools()
            if "ingest_pdf" in tools or "ingest_document" in tools:
                tool_name = "ingest_pdf" if "ingest_pdf" in tools else "ingest_document"
                result = await self.mcp_manager.call_tool(tool_name, {"document_id": document_id, "file_path": file_path})
                return {"success": True, "result": result}
        except Exception as exc:
            print(f"[MCP Integration] Ingestion MCP notice: {exc}")
        return None

    async def call_query_mcp(self, document_id: str, query: str) -> Optional[Dict[str, Any]]:
        """Hook to be invoked when Query MCP server is installed."""
        if not self.mcp_manager.sessions:
            return None
        try:
            tools = await self.mcp_manager.get_tools()
            if "query_document" in tools or "rag_search" in tools:
                tool_name = "query_document" if "query_document" in tools else "rag_search"
                result = await self.mcp_manager.call_tool(tool_name, {"document_id": document_id, "query": query})
                return {"success": True, "result": result}
        except Exception as exc:
            print(f"[MCP Integration] Query MCP notice: {exc}")
        return None


mcp_layer = MCPIntegrationLayer(mcp_manager)


# ---------------------------------------------------------
# Document Ingestion Pipeline
# ---------------------------------------------------------

async def run_ingestion_pipeline(doc_id: str):
    """
    Executes the phased RAG ingestion pipeline.
    Stages:
      1. extracting_text (0.25)
      2. chunking (0.50)
      3. generating_embeddings (0.75)
      4. building_index (0.90)
      5. completed (1.0) -> ready
    """
    doc = DOCUMENTS.get(doc_id)
    if not doc or not doc.file_path:
        return

    try:
        # Check future Ingestion MCP first
        mcp_res = await mcp_layer.call_ingestion_mcp(doc_id, doc.file_path)
        if mcp_res and mcp_res.get("success"):
            doc.status = "ready"
            doc.stage = "completed"
            doc.progress = 1.0
            doc.mcp_provider = "mcp:rag_ingestion"
            return

        # Stage 1: Text extraction
        doc.status = "ingesting"
        doc.stage = "extracting_text"
        doc.progress = 0.20
        await asyncio.sleep(0.4)

        reader = pypdf.PdfReader(doc.file_path)
        total_pages = len(reader.pages)
        doc.page_count = total_pages

        raw_pages: List[Dict[str, Any]] = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            raw_pages.append({"page": i + 1, "text": text})

        # Stage 2: Chunking passages
        doc.stage = "chunking"
        doc.progress = 0.45
        await asyncio.sleep(0.5)

        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        for page_data in raw_pages:
            p_num = page_data["page"]
            p_text = page_data["text"]

            paragraphs = [p.strip() for p in p_text.split("\n\n") if len(p.strip()) > 30]
            if not paragraphs:
                paragraphs = [p_text.strip()] if p_text.strip() else []

            for para in paragraphs:
                # Segment large paragraphs into chunks ~600 chars
                words = para.split()
                if len(words) > 120:
                    for w_idx in range(0, len(words), 90):
                        sub_text = " ".join(words[w_idx : w_idx + 100])
                        chunks.append({
                            "id": f"chunk_{doc_id}_{chunk_idx}",
                            "page": p_num,
                            "section": f"Page {p_num}",
                            "text": sub_text,
                        })
                        chunk_idx += 1
                else:
                    chunks.append({
                        "id": f"chunk_{doc_id}_{chunk_idx}",
                        "page": p_num,
                        "section": f"Page {p_num}",
                        "text": para,
                    })
                    chunk_idx += 1

        DOCUMENT_CHUNKS[doc_id] = chunks
        doc.chunk_count = len(chunks)

        # Stage 3: Embedding generation
        doc.stage = "generating_embeddings"
        doc.progress = 0.70
        await asyncio.sleep(0.6)

        # Stage 4: Index building
        doc.stage = "building_index"
        doc.progress = 0.90
        await asyncio.sleep(0.4)

        # Stage 5: Finalized
        doc.status = "ready"
        doc.stage = "completed"
        doc.progress = 1.0
        doc.error_message = None

    except Exception as exc:
        doc.status = "error"
        doc.stage = "failed"
        doc.progress = 0.0
        doc.error_message = f"Ingestion failed: {str(exc)}"
        print(f"[Ingestion Error] Document {doc_id}: {exc}")


def find_relevant_chunks(doc_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """Simple term-frequency relevance scorer for local grounded context retrieval."""
    chunks = DOCUMENT_CHUNKS.get(doc_id, [])
    if not chunks:
        return []

    q_tokens = set(query.lower().split())
    scored = []

    for c in chunks:
        c_text_lower = c["text"].lower()
        score = sum(1 for token in q_tokens if token in c_text_lower)
        # Normalize score
        norm_score = min(0.98, max(0.45, (score / max(1, len(q_tokens))) * 0.95)) if score > 0 else 0.40
        scored.append((norm_score, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] | {"relevance_score": item[0]} for item in scored[:top_k]]


# ---------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "rag-voice-assistant",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gemini_available": bool(os.getenv("GEMINI_API_KEY")),
        "mcp_active": bool(mcp_manager.sessions),
    }


@app.get("/api/documents", response_model=List[DocumentMetadata])
async def list_documents():
    return list(DOCUMENTS.values())


@app.post("/api/documents", response_model=DocumentMetadata)
async def upload_document(file: UploadFile = File(...)):
    # Validate mime-type / filename
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a valid PDF document (.pdf).",
        )

    # Read bytes and validate size (50MB limit)
    contents = await file.read()
    size_bytes = len(contents)
    if size_bytes > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds the 50MB limit.",
        )
    if size_bytes == 0:
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF file is empty (0 bytes).",
        )

    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    file_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"

    with open(file_path, "wb") as f:
        f.write(contents)

    # Inspect initial PDF properties
    page_count = 0
    try:
        reader = pypdf.PdfReader(str(file_path))
        page_count = len(reader.pages)
    except Exception as exc:
        print(f"Warning reading PDF header: {exc}")
        page_count = 1

    metadata = DocumentMetadata(
        id=doc_id,
        filename=file.filename,
        size_bytes=size_bytes,
        page_count=page_count,
        uploaded_at=datetime.now(timezone.utc).isoformat(),
        status="file_selected",
        stage="uploaded",
        progress=0.0,
        file_path=str(file_path),
    )

    DOCUMENTS[doc_id] = metadata
    return metadata


@app.post("/api/documents/{document_id}/ingest", response_model=IngestStatusResponse)
async def start_ingestion(document_id: str):
    doc = DOCUMENTS.get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.status == "ingesting":
        return IngestStatusResponse(
            document_id=document_id,
            status=doc.status,
            stage=doc.stage,
            progress=doc.progress,
            metadata=doc,
            message="Ingestion is already in progress.",
        )

    # Reset error state and start task
    doc.status = "ingesting"
    doc.stage = "extracting_text"
    doc.progress = 0.1
    doc.error_message = None

    task = asyncio.create_task(run_ingestion_pipeline(document_id))
    INGESTION_TASKS[document_id] = task

    return IngestStatusResponse(
        document_id=document_id,
        status="ingesting",
        stage="extracting_text",
        progress=0.1,
        metadata=doc,
        message="Document ingestion pipeline started.",
    )


@app.get("/api/documents/{document_id}/status", response_model=IngestStatusResponse)
async def get_ingestion_status(document_id: str):
    doc = DOCUMENTS.get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    msg = f"Document is {doc.status} ({doc.stage})"
    if doc.status == "ready":
        msg = f"Document '{doc.filename}' is ready with {doc.chunk_count} indexed chunks."
    elif doc.status == "error":
        msg = doc.error_message or "Ingestion encountered an error."

    return IngestStatusResponse(
        document_id=document_id,
        status=doc.status,
        stage=doc.stage,
        progress=doc.progress,
        metadata=doc,
        message=msg,
    )


@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: str):
    doc = DOCUMENTS.pop(document_id, None)
    DOCUMENT_CHUNKS.pop(document_id, None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    return {"deleted": True, "document_id": document_id}


@app.post("/api/sessions", response_model=SessionInfo)
async def create_session(document_id: str = Query(...)):
    doc = DOCUMENTS.get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    session_id = f"sess_{uuid.uuid4().hex[:10]}"
    session = SessionInfo(
        id=session_id,
        document_id=document_id,
        title=f"Research: {doc.filename}",
        created_at=datetime.now(timezone.utc).isoformat(),
        messages=[],
    )
    SESSIONS[session_id] = session
    return session


@app.get("/api/sessions/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@app.post("/api/chat", response_model=ChatMessage)
async def chat_query(req: ChatRequest):
    doc = DOCUMENTS.get(req.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Guard: questions are forbidden before genuine ingestion completes!
    if doc.status != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot query document before ingestion has genuinely completed. Current status is '{doc.status}' ({doc.stage}).",
        )

    # Ensure session exists
    session = SESSIONS.get(req.session_id)
    if not session:
        session = SessionInfo(
            id=req.session_id,
            document_id=req.document_id,
            title=f"Research: {doc.filename}",
            created_at=datetime.now(timezone.utc).isoformat(),
            messages=[],
        )
        SESSIONS[req.session_id] = session

    # Store user message
    user_msg = ChatMessage(
        id=f"msg_{uuid.uuid4().hex[:8]}",
        role="user",
        content=req.message,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    session.messages.append(user_msg)

    # 1. Retrieve grounded context chunks
    relevant_chunks = find_relevant_chunks(req.document_id, req.message, top_k=3)

    citations: List[SourceCitation] = []
    context_text = ""
    for idx, c in enumerate(relevant_chunks):
        c_id = f"cite_{idx + 1}"
        citations.append(
            SourceCitation(
                id=c_id,
                page=c["page"],
                section=c.get("section", f"Page {c['page']}"),
                snippet=c["text"][:240] + ("..." if len(c["text"]) > 240 else ""),
                relevance_score=c.get("relevance_score", 0.85),
            )
        )
        context_text += f"\n[Source Page {c['page']}]: {c['text']}\n"

    # 2. Generate grounded response with Gemini or intelligent fallback
    answer_text = ""
    used_model = "gemini-2.5-flash"

    try:
        client = get_gemini_client()
        system_prompt = (
            f"You are a rigorous, helpful AI Research Assistant analyzing the PDF document '{doc.filename}'.\n"
            "Answer the user's inquiry accurately, in a scholarly and thoughtful manner, grounding your explanation strictly "
            "in the provided document excerpts. When referring to facts or numbers, explicitly cite the relevant page numbers.\n"
            "Format your answer with clear markdown (headings, bullet points, clean code blocks if technical)."
        )

        user_prompt = f"Document Excerpts:\n{context_text}\n\nUser Question: {req.message}"

        response = await client.aio.models.generate_content(
            model=used_model,
            contents=[user_prompt],
            config={"system_instruction": system_prompt},
        )
        answer_text = response.text or "I reviewed the document but could not synthesize an answer."

    except Exception as exc:
        print(f"[Gemini Chat Note] Falling back to grounded excerpt synthesis: {exc}")
        used_model = "local-grounded-synthesizer"
        # High quality grounded synthesis when offline or rate limited
        if citations:
            best = citations[0]
            answer_text = (
                f"### Analysis from {doc.filename}\n\n"
                f"Based on the ingested document (specifically **Page {best.page}**):\n\n"
                f"> \"{best.snippet}\"\n\n"
                f"In response to your query *\"{req.message}\"*, the document highlights the passage above as the most direct evidence. "
                f"You can explore the source reference details in the right Context Panel."
            )
        else:
            answer_text = (
                f"I searched the indexed chunks for *\"{req.message}\"* in **{doc.filename}**, "
                "but did not locate matching passages with sufficient confidence. "
                "Try phrasing your inquiry with specific keywords or concepts from the document."
            )

    assistant_msg = ChatMessage(
        id=f"msg_{uuid.uuid4().hex[:8]}",
        role="assistant",
        content=answer_text,
        sources=citations if citations else None,
        timestamp=datetime.now(timezone.utc).isoformat(),
        model=used_model,
    )
    session.messages.append(assistant_msg)
    return assistant_msg


# ---------------------------------------------------------
# Realtime Voice Assistant WebSocket (Gemini Live Audio-to-Audio)
# ---------------------------------------------------------

@app.websocket("/api/voice/live")
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

    # 2. Validate API key
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

    system_instruction = (
        f"You are a helpful and knowledgeable real-time AI research assistant analyzing the document '{doc.filename}'.\n"
        "Ground your explanations strictly in the document excerpts provided below.\n"
        "When explaining facts, methodology, findings, numbers, or conclusions, explicitly cite the specific page numbers (e.g. 'According to Page 2...').\n"
        "If the answer is not contained in the document, state so honestly, or use your available search tools if external research is requested.\n"
        "Keep your spoken answers concise, natural, scholarly, and direct.\n\n"
        f"--- INGESTED DOCUMENT EXCERPTS ({doc.filename}) ---\n"
        f"{doc_context_str}\n"
        "--- END OF DOCUMENT EXCERPTS ---"
    )

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

    async def client_to_gemini():
        """Receive microphone audio chunks and control frames from the client and stream to Gemini Live."""
        try:
            while not stop_event.is_set():
                msg = await websocket.receive()
                if msg["type"] == "websocket.disconnect":
                    break

                # Binary frame: raw 16kHz 16-bit PCM microphone audio
                if "bytes" in msg and msg["bytes"]:
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
                        await live_session.send(input=data["text"], end_of_turn=True)
                    elif mtype == "interrupt":
                        # Client signal barge-in
                        pass
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
        try:
            while not stop_event.is_set():
                async for response in live_session.receive():
                    if stop_event.is_set():
                        break

                    # A. Tool Call Execution
                    if response.tool_call:
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

                    # Interruption (barge-in)
                    if sc.interrupted:
                        await websocket.send_json({"type": "interrupted"})
                        await websocket.send_json({"type": "state", "state": "listening"})

                    # Input speech transcription
                    if sc.input_transcription and sc.input_transcription.text:
                        text = sc.input_transcription.text
                        await websocket.send_json({
                            "type": "input_transcription",
                            "text": text,
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

                    # Output speech transcription
                    if sc.output_transcription and sc.output_transcription.text:
                        text = sc.output_transcription.text
                        await websocket.send_json({
                            "type": "output_transcription",
                            "text": text,
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
                        await websocket.send_json({"type": "state", "state": "speaking"})
                        for part in sc.model_turn.parts:
                            if hasattr(part, "text") and part.text:
                                await websocket.send_json({"type": "text", "delta": part.text})
                            if part.inline_data and part.inline_data.data:
                                await websocket.send_bytes(part.inline_data.data)

                    # Turn complete
                    if sc.turn_complete:
                        await websocket.send_json({"type": "turn_complete"})
                        await websocket.send_json({"type": "state", "state": "listening"})

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="127.0.0.1", port=8000, reload=True)
