"""Service health endpoint."""

import os
from datetime import datetime, timezone

from fastapi import APIRouter

from backend.rag.config import load_rag_config
from .state import mcp_manager

router = APIRouter()


@router.get("/api/health")
async def health_check():
    rag_configured = False
    rag_status = "unconfigured"
    embedding_model = "jina-embeddings-v4"
    qdrant_collection = "knowvia_documents_v1"

    try:
        cfg = load_rag_config()
        rag_configured = True
        rag_status = "configured"
        embedding_model = cfg.embedding_model
        qdrant_collection = cfg.collection_name
    except Exception:
        rag_configured = False
        rag_status = "unconfigured"

    return {
        "status": "healthy",
        "service": "rag-voice-assistant",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gemini_available": bool(os.getenv("GEMINI_API_KEY")),
        "mcp_active": bool(mcp_manager.sessions),
        "rag_configured": rag_configured,
        "rag_status": rag_status,
        "embedding_model": embedding_model,
        "qdrant_collection": qdrant_collection,
    }
