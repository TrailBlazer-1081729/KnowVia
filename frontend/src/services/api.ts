import type {
  DocumentMetadata,
  IngestStatusResponse,
  ChatMessage,
  SessionInfo,
  SourceCitation,
} from '../types';

const API_BASE = '/api';

// Local storage key for mock mode toggle
const MOCK_MODE_STORAGE_KEY = 'aethelgard_mock_mode';

export function isMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MOCK_MODE_STORAGE_KEY) === 'true';
}

export function setMockMode(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  }
}

// -------------------------------------------------------------
// Mock In-Memory Store for Client-Side Simulation / Dev Mode
// -------------------------------------------------------------
const mockDocuments: Map<string, DocumentMetadata> = new Map();
const mockSessions: Map<string, SessionInfo> = new Map();

function createMockDocument(file: File): DocumentMetadata {
  const docId = `doc_mock_${Math.random().toString(36).substring(2, 9)}`;
  const metadata: DocumentMetadata = {
    id: docId,
    filename: file.name,
    size_bytes: file.size,
    page_count: Math.max(1, Math.round(file.size / (1024 * 64))),
    chunk_count: 0,
    uploaded_at: new Date().toISOString(),
    status: 'file_selected',
    stage: 'uploaded',
    progress: 0.0,
    mcp_provider: 'simulated_dev_mcp',
  };
  mockDocuments.set(docId, metadata);
  return metadata;
}

// -------------------------------------------------------------
// Real API Client with Mock Fallback
// -------------------------------------------------------------

export async function checkBackendHealth(): Promise<{ healthy: boolean; details?: unknown }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return { healthy: true, details: data };
    }
  } catch {
    // Backend offline or error
  }
  return { healthy: false };
}

export async function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void
): Promise<DocumentMetadata> {
  // Validate file
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Unsupported format: Please upload a PDF document (.pdf).');
  }

  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File exceeds the 50MB size limit.');
  }
  if (file.size === 0) {
    throw new Error('The selected PDF file is empty (0 bytes).');
  }

  if (isMockMode()) {
    onProgress?.(30);
    await new Promise((r) => setTimeout(r, 300));
    onProgress?.(100);
    return createMockDocument(file);
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Upload failed');
    }

    onProgress?.(100);
    return await res.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    throw new Error(message);
  }
}

export async function startIngestion(documentId: string): Promise<IngestStatusResponse> {
  if (isMockMode()) {
    const doc = mockDocuments.get(documentId);
    if (!doc) throw new Error('Document not found in mock store');
    doc.status = 'ingesting';
    doc.stage = 'extracting_text';
    doc.progress = 0.15;
    return {
      document_id: documentId,
      status: 'ingesting',
      stage: 'extracting_text',
      progress: 0.15,
      metadata: doc,
      message: 'Ingestion pipeline initiated (Mock Mode).',
    };
  }

  const res = await fetch(`${API_BASE}/documents/${documentId}/ingest`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to start ingestion');
  }

  return await res.json();
}

export async function getIngestionStatus(documentId: string): Promise<IngestStatusResponse> {
  if (isMockMode()) {
    const doc = mockDocuments.get(documentId);
    if (!doc) throw new Error('Document not found');

    // Advance simulated stages
    if (doc.status === 'ingesting') {
      if (doc.stage === 'extracting_text') {
        doc.stage = 'chunking';
        doc.progress = 0.45;
      } else if (doc.stage === 'chunking') {
        doc.stage = 'generating_embeddings';
        doc.progress = 0.75;
      } else if (doc.stage === 'generating_embeddings') {
        doc.stage = 'building_index';
        doc.progress = 0.90;
      } else if (doc.stage === 'building_index') {
        doc.stage = 'completed';
        doc.status = 'ready';
        doc.progress = 1.0;
        doc.chunk_count = doc.page_count * 4;
      }
    }

    return {
      document_id: documentId,
      status: doc.status,
      stage: doc.stage,
      progress: doc.progress,
      metadata: doc,
      message: `Document status: ${doc.status} (${doc.stage})`,
    };
  }

  const res = await fetch(`${API_BASE}/documents/${documentId}/status`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch status');
  }
  return await res.json();
}

export async function listDocuments(): Promise<DocumentMetadata[]> {
  if (isMockMode()) {
    return Array.from(mockDocuments.values());
  }

  try {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  if (isMockMode()) {
    mockDocuments.delete(documentId);
    return;
  }
  await fetch(`${API_BASE}/documents/${documentId}`, { method: 'DELETE' });
}

export async function createSession(documentId: string): Promise<SessionInfo> {
  if (isMockMode()) {
    const sessionId = `sess_${Math.random().toString(36).substring(2, 9)}`;
    const session: SessionInfo = {
      id: sessionId,
      document_id: documentId,
      title: `Research Session`,
      created_at: new Date().toISOString(),
      messages: [],
    };
    mockSessions.set(sessionId, session);
    return session;
  }

  const res = await fetch(`${API_BASE}/sessions?document_id=${encodeURIComponent(documentId)}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create session');
  }
  return await res.json();
}

export async function sendChatMessage(
  sessionId: string,
  documentId: string,
  message: string
): Promise<ChatMessage> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 600));
    const mockCitation: SourceCitation = {
      id: 'cite_1',
      page: 2,
      section: 'Section 2.1 — Framework Overview',
      snippet:
        'The architecture decouples the ingestion pipeline from the query orchestrator via standard MCP protocol tool definitions.',
      relevance_score: 0.94,
    };

    const reply: ChatMessage = {
      id: `msg_${Math.random().toString(36).substring(2, 9)}`,
      role: 'assistant',
      content: `### Synthesized Response (Mock Mode)\n\nBased on **Page 2** of the document:\n\n> "${mockCitation.snippet}"\n\nYour inquiry regarding *"${message}"* was analyzed across the indexed text chunks. Once the real backend with Gemini Live and MCP is active, live grounded reasoning with citations will reflect the uploaded document's contents.`,
      sources: [mockCitation],
      timestamp: new Date().toISOString(),
      model: 'aethelgard-mock-synthesizer',
    };
    return reply;
  }

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      document_id: documentId,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Chat query failed');
  }

  return await res.json();
}
