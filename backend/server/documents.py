"""Document upload, listing, and deletion endpoints."""

import os
import uuid
from datetime import datetime, timezone
from typing import List

import pymupdf
from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.rag import get_rag_service
from .schemas import DocumentMetadata
from .state import DOCUMENTS, DOCUMENT_CHUNKS, INGESTION_TASKS, SESSIONS, UPLOAD_DIR

router = APIRouter()


@router.get("/api/documents", response_model=List[DocumentMetadata])
async def list_documents():
    return list(DOCUMENTS.values())

@router.post("/api/documents", response_model=DocumentMetadata)
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
        with pymupdf.open(str(file_path)) as pdf_doc:
            page_count = pdf_doc.page_count
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

@router.delete("/api/documents/{document_id}")
async def delete_document(document_id: str):
    doc = DOCUMENTS.get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # 1. Cancel active ingestion if currently running
    active_task = INGESTION_TASKS.pop(document_id, None)
    if active_task and not active_task.done():
        active_task.cancel()

    # 2. Delete vectors from Qdrant
    try:
        rag = await get_rag_service()
        await rag.delete_document(document_id)
    except Exception as exc:
        print(f"[Document Deletion Notice] Qdrant vectors deletion for {document_id}: {exc}", flush=True)

    # 3. Remove uploaded physical PDF file
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    # 4. Remove in-memory state entries
    DOCUMENTS.pop(document_id, None)
    DOCUMENT_CHUNKS.pop(document_id, None)

    # 5. Clean up associated session references
    sessions_to_clear = [sid for sid, sess in SESSIONS.items() if sess.document_id == document_id]
    for sid in sessions_to_clear:
        SESSIONS.pop(sid, None)

    return {"deleted": True, "document_id": document_id}
