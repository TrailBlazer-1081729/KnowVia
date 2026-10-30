"""Service health endpoint."""

import os
from datetime import datetime, timezone

from fastapi import APIRouter

from .state import mcp_manager

router = APIRouter()


@router.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "rag-voice-assistant",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gemini_available": bool(os.getenv("GEMINI_API_KEY")),
        "mcp_active": bool(mcp_manager.sessions),
    }
