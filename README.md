# Gemini Live Voice-to-Voice RAG Research Assistant

An intelligent real-time conversational research assistant powered by **Google Gemini Live (Audio-to-Audio)**, **Retrieval-Augmented Generation (RAG)** with page citations, and **Model Context Protocol (MCP)** tool execution.

---

## Prerequisites

- **Python 3.12+** (recommended with [`uv`](https://github.com/astral-sh/uv))
- **Node.js 18+** & **npm**
- **Google Gemini API Key** configured in `.env` in the root directory:
  ```env
  GEMINI_API_KEY=your_gemini_api_key_here
  tavily_api=your_optional_tavily_api_key_here
  ```

---

## How to Run the Application

The application requires running the **Backend** (FastAPI & MCP servers) and the **Frontend** (Vite + React) concurrently.

### 1. Start the Backend Server

Open a terminal in the project root directory (`d:\DOWNLOADS\new_pro_mcp`) and run:

```bash
uv run uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

> **What this does:**
> - Launches the FastAPI application on `http://127.0.0.1:8000`.
> - Automatically connects to local MCP servers (`add`, `multiply`, `web_search`).
> - Exposes the live bidirectional audio WebSocket endpoint at `/api/voice/live`.

---

### 2. Start the Frontend Web App

Open a second terminal, navigate into the `frontend` directory, and run:

```bash
cd frontend
npm install
npm run dev
```

> **What this does:**
> - Installs frontend dependencies (if not already installed).
> - Starts the Vite development server on `http://localhost:5173`.

---

### 3. Open in Your Browser

Open your browser and navigate to:

👉 **[http://localhost:5173/](http://localhost:5173/)**

---

## Application URLs

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend UI** | `http://localhost:5173/` | Main Research Assistant Web App |
| **Backend API** | `http://127.0.0.1:8000/` | FastAPI REST & WebSocket Server |
| **API Documentation** | `http://127.0.0.1:8000/docs` | Interactive Swagger API Docs |
| **Health Check** | `http://127.0.0.1:8000/api/health` | Service and MCP Status |

---

## Quick Start & Verification

1. **Upload or Select a Document**: Upload a PDF or select an existing document from the left sidebar.
2. **Text or Voice Mode**:
   - Use **Text Conversation** for text queries with cited document passages.
   - Switch to **Voice Conversation** to start real-time audio interaction with Gemini Live.
3. **Trigger MCP Tools**:
   - In voice mode, ask a calculation (e.g. *"What is 250 plus 175?"*) or external query to watch the **MCP Tool Invocations** panel track tool execution in real time.
4. **Inspect Citations**:
   - Click any cited `Page X: Section` badge to inspect the grounded excerpt in the **Document Intelligence** panel.

---

## Helper Scripts

- **Generate Sample Research Paper**:
  ```bash
  uv run python create_sample_pdf.py
  ```
- **Run Frontend Linter**:
  ```bash
  cd frontend
  npm run lint
  ```
- **Production Build Check**:
  ```bash
  cd frontend
  npm run build
  ```
