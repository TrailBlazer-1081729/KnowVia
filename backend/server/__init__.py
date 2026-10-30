"""Modular replacement for the original backend/server.py module.

The FastAPI app remains importable as ``backend.server:app``.
"""

from .app import app
from .schemas import (
    ChatMessage,
    ChatRequest,
    DocumentMetadata,
    IngestStatusResponse,
    SessionInfo,
    SourceCitation,
)
from .state import (
    BASE_DIR,
    DOCUMENTS,
    DOCUMENT_CHUNKS,
    INGESTION_TASKS,
    SESSIONS,
    UPLOAD_DIR,
    mcp_manager,
)
from .mcp_integration import MCPIntegrationLayer, mcp_layer
from .ingestion import get_ingestion_status, run_ingestion_pipeline, start_ingestion
from .retrieval import find_relevant_chunks
from .health import health_check
from .documents import delete_document, list_documents, upload_document
from .sessions import create_session, get_session
from .chat import chat_query
from .voice import voice_live_socket
from backend.gemini import get_gemini_client, get_model_name
from backend.client_manager import MCPClientManager

__all__ = [
    "app", "BASE_DIR", "UPLOAD_DIR", "mcp_manager", "mcp_layer",
    "MCPClientManager", "MCPIntegrationLayer", "get_gemini_client", "get_model_name",
    "SourceCitation", "DocumentMetadata", "IngestStatusResponse", "ChatRequest",
    "ChatMessage", "SessionInfo", "DOCUMENTS", "DOCUMENT_CHUNKS", "SESSIONS",
    "INGESTION_TASKS", "run_ingestion_pipeline", "find_relevant_chunks",
    "health_check", "list_documents", "upload_document", "delete_document",
    "start_ingestion", "get_ingestion_status", "create_session", "get_session",
    "chat_query", "voice_live_socket",
]
