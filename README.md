# KnowVia — Multimodal AI Research Assistant

KnowVia is an enterprise-grade AI research assistant featuring real-time multimodal interaction, dense semantic document intelligence (RAG), and Model Context Protocol (MCP) tool integration. It combines **Google Gemini Live (bidirectional audio streaming)**, **PyMuPDF extraction with Markdown-aware chunking**, **Jina v4 embeddings**, **Qdrant vector storage**, and an editorial-grade **React + Vite** frontend.

---

## Architecture Overview

```
KnowVia Architecture
├── Frontend (React 19 + TypeScript + Vite + Tailwind CSS)
│   ├── Document Workspace & Ingestion Dropzone
│   ├── Spoken Audio-to-Audio (Gemini Live with barge-in & interruption)
│   ├── Text Chat with grounded page-level source citations
│   └── Document Intelligence Context Panel (Vector stats & cited snippets)
│
├── Backend (FastAPI + Asynchronous Python)
│   ├── API Routes: /api/documents, /api/chat, /api/sessions, /api/health
│   ├── Live Audio WebSocket: /api/voice/live
│   └── MCP Client Manager (AsyncExitStack tool orchestration)
│
├── Internal RAG Subsystem (backend/rag/)
│   ├── Converter: PyMuPDF font-heuristic heading detection (#, ##, ###)
│   ├── Chunker: Page-isolated hierarchical Markdown text splitting
│   ├── Embedder: Async Jina v4 embeddings client (normalized dense vectors)
│   ├── Vector Store: Async Qdrant client with tenant/document isolation
│   ├── Retriever: Cosine-similarity semantic query retrieval
│   └── Service: Thread-offloaded RAG lifecycle management
│
└── Connected MCP Servers (mcps/)
    ├── web_search.py (Tavily advanced web research)
    ├── saved_answer_mcp.py (Persistent SQLite knowledge library)
    ├── google_calender_mcp.py (Google Calendar scheduling)
    └── email_mcp.py (Gmail integration)
```

---

## Technology Stack

- **Backend**: Python 3.12, FastAPI, Uvicorn, Google GenAI SDK (`google-genai`), Qdrant Client (`qdrant-client`), Jina Embeddings API, PyMuPDF (`fitz`), LangChain Text Splitters, Model Context Protocol (`mcp[cli]`).
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Web Audio API (PCM16 16kHz streaming & 24kHz playback).
- **Package Management**: `uv` (Python), `npm` (Node.js).

---

## Prerequisites

- **Python 3.12+** with [`uv`](https://github.com/astral-sh/uv)
- **Node.js 18+** with `npm`
- **Google Gemini API Key** (Gemini 2.5 Flash / Gemini 3.8 Live access)
- **Jina AI API Key** (dense vector embeddings)
- **Qdrant Vector Database** (Cloud or self-hosted)

---

## Quickstart Guide

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables in `.env`:

```env
GEMINI_API_KEY="your_gemini_api_key"
JINA_API_KEY="your_jina_api_key"
QDRANT_URL="https://your-cluster.cloud.qdrant.io"
QDRANT_API_KEY="your_qdrant_api_key"
TAVILY_API_KEY="your_tavily_api_key"
```

*(Note: Custom variable aliases such as `Jina_api`, `quadrant_api`, and `cluster_endpoint` are also supported for backward compatibility).*

### 2. Install Dependencies

**Backend:**
```bash
uv sync
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### 3. Run the Backend Server

Start the FastAPI backend with Uvicorn:

```bash
uv run uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload
```

- **API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 4. Run the Frontend Development Server

In a separate terminal:

```bash
cd frontend
npm run dev
```

Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

---

## Features & Subsystems

### Real-time Multimodal Voice (Gemini Live)
- Connects through `/api/voice/live` over WebSockets.
- Streams microphone PCM16 16kHz audio directly to Gemini Live (`gemini-3.8-live`).
- Full barge-in and acoustic interruption handling: automatically cancels model turns and increments generation epochs.
- Dynamically invokes the native `search_document` tool during speech turns when document queries are made.

### Internal Document RAG Pipeline
- **Page-Aware Structure Extraction**: Extracts body and section hierarchies with statistical font size analysis.
- **Hierarchical Markdown Chunking**: Enforces strict page boundary isolation while preserving cross-page chapter and section headings.
- **Dense Vector Search**: Queries Qdrant using Jina embeddings, filtering exclusively by `document_id`.
- **Grounded Citations**: Synchronizes retrieved page excerpts and similarity scores into the `Document Intelligence` panel in both text and voice modes.

### Model Context Protocol (MCP) Tools
The assistant automatically discovers and connects to MCP tools on startup:
1. `search_web`: Live internet search via Tavily API.
2. `save_answer` / `list_answers` / `search_saved_answers`: Local SQLite persistent notebook.
3. `create_event` / `list_events`: Google Calendar scheduling.
4. `send_email` / `list_messages`: Gmail integration.

---

## Verification & Testing

Run all unit, integration, and regression test suites:

```bash
# Run backend pytest suite
uv run pytest tests/ -v

# Run Python compilation check
uv run python -m compileall backend

# Run frontend linting and production build
cd frontend
npm run lint
npm run build
```

---

## Clean Repository Structure

```text
KnowVia-main/
├── backend/
│   ├── rag/                       # Internal RAG subsystem
│   │   ├── converter.py           # PyMuPDF extractor with heading heuristics
│   │   ├── chunker.py             # Markdown hierarchical chunker
│   │   ├── embedder.py            # Async Jina embeddings client
│   │   ├── vector_store.py        # Async Qdrant vector client
│   │   ├── retriever.py           # Semantic search engine
│   │   ├── service.py             # RAGService singleton & locking
│   │   ├── schemas.py             # Pydantic data models
│   │   ├── config.py              # Environment configuration loader
│   │   └── __init__.py            # Public package exports
│   ├── server/                    # Modular FastAPI application
│   │   ├── app.py                 # FastAPI app, lifespan & routes
│   │   ├── chat.py                # Grounded text conversation route
│   │   ├── documents.py           # Document upload, listing & deletion
│   │   ├── health.py              # Health check & status endpoint
│   │   ├── ingestion.py           # Phased background ingestion pipeline
│   │   ├── retrieval.py           # Citation builder & search adapter
│   │   ├── schemas.py             # API schemas
│   │   ├── sessions.py            # Conversation session management
│   │   ├── state.py               # Process-local state & stores
│   │   ├── voice.py               # Gemini Live WebSocket handler
│   │   ├── __init__.py            # Module exports
│   │   └── __main__.py            # CLI entry point
│   ├── uploads/                   # Local storage for uploaded PDFs
│   ├── gemini.py                  # Gemini GenAI client initialization
│   └── client_manager.py          # MCP tool client manager
│
├── frontend/                      # React 19 + TypeScript web application
│   ├── public/
│   │   └── favicon.svg            # KnowVia brand icon
│   ├── src/
│   │   ├── components/            # UI components (DropZone, ContextPanel, etc.)
│   │   ├── services/              # API and WebSocket voice services
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── App.tsx                # Main application component
│   │   └── main.tsx               # React mount entry point
│   ├── package.json               # Frontend dependencies & scripts
│   └── vite.config.ts             # Vite configuration
│
├── mcps/                          # Registered MCP servers
│   ├── web_search.py              # Tavily web search MCP
│   ├── saved_answer_mcp.py        # SQLite persistent knowledge MCP
│   ├── google_calender_mcp.py     # Google Calendar MCP
│   ├── email_mcp.py               # Gmail MCP
│   └── saved_answers.db           # SQLite knowledge database
│
├── tests/                         # Pytest test suites (unit, integration, RAG)
│   ├── test_backend.py            # API lifecycle tests
│   ├── test_interruption.py       # Voice barge-in tests
│   ├── test_rag_converter.py      # PDF conversion tests
│   ├── test_rag_chunker.py        # Markdown chunking tests
│   ├── test_rag_embedder.py       # Embedding generation tests
│   ├── test_rag_vector_store.py   # Vector storage & isolation tests
│   ├── test_rag_retriever.py      # Semantic retrieval tests
│   ├── test_rag_ingestion.py      # Pipeline integration tests
│   ├── test_rag_chat.py           # Chat grounding tests
│   └── test_rag_voice.py          # Voice tool calling tests
│
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git exclusion rules
├── pyproject.toml                 # Backend project configuration & dependencies
├── uv.lock                        # Deterministic dependency lockfile
└── README.md                      # Project documentation
```

---

## License

Proprietary — Developed for KnowVia Multimodal Document Intelligence.
