"""Conversation-session creation and lookup endpoints."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from .schemas import SessionInfo
from .state import DOCUMENTS, SESSIONS

router = APIRouter()


@router.post("/api/sessions", response_model=SessionInfo)
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

@router.get("/api/sessions/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session
