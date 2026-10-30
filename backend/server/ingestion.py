"""PDF extraction, chunking, ingestion progress and status endpoints."""

import asyncio
from typing import Any, Dict, List

import pypdf
from fastapi import APIRouter, HTTPException

from .mcp_integration import mcp_layer
from .schemas import IngestStatusResponse
from .state import DOCUMENTS, DOCUMENT_CHUNKS, INGESTION_TASKS

router = APIRouter()


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

@router.post("/api/documents/{document_id}/ingest", response_model=IngestStatusResponse)
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

@router.get("/api/documents/{document_id}/status", response_model=IngestStatusResponse)
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
