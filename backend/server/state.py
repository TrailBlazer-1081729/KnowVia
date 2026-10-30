"""Shared process-local state used by the server modules."""

import asyncio
from pathlib import Path
from typing import Any, Dict, List

from backend.client_manager import MCPClientManager
from .schemas import DocumentMetadata, SessionInfo

# Match the original server.py paths: repository root and backend/uploads.
BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "backend" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# One MCP manager shared across the app lifecycle and all request handlers.
mcp_manager = MCPClientManager()

# In-memory stores retained exactly as in the original implementation.
DOCUMENTS: Dict[str, DocumentMetadata] = {}
DOCUMENT_CHUNKS: Dict[str, List[Dict[str, Any]]] = {}
SESSIONS: Dict[str, SessionInfo] = {}
INGESTION_TASKS: Dict[str, asyncio.Task] = {}
