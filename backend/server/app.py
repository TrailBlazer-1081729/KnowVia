"""FastAPI application creation and shared lifecycle wiring."""

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from backend.rag import close_rag_service
from .state import mcp_manager
from . import chat, documents, health, ingestion, sessions, voice


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
    try:
        await close_rag_service()
        print("[Lifespan] RAG service closed.", flush=True)
    except Exception as exc:
        print(f"[Lifespan Warning] RAG close error: {exc}", flush=True)


app = FastAPI(
    title="RAG Voice Assistant API",
    description="Backend API and MCP orchestration boundary for PDF RAG Research and Voice Assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for local frontend development (unchanged).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Keep the existing public API paths unchanged.
app.include_router(health.router)
app.include_router(documents.router)
app.include_router(ingestion.router)
app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(voice.router)
