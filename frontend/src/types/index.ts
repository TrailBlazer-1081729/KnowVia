export type IngestionStatus =
  | 'idle'
  | 'file_selected'
  | 'uploading'
  | 'ingesting'
  | 'ready'
  | 'error';

export type IngestionStage =
  | 'uploaded'
  | 'extracting_text'
  | 'chunking'
  | 'generating_embeddings'
  | 'building_index'
  | 'completed'
  | 'failed';

export interface SourceCitation {
  id: string;
  page: number;
  section?: string;
  snippet: string;
  relevance_score: number;
}

export interface DocumentMetadata {
  id: string;
  filename: string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  uploaded_at: string;
  status: IngestionStatus;
  stage: IngestionStage;
  progress: number; // 0.0 to 1.0
  error_message?: string | null;
  mcp_provider?: string;
  file_path?: string | null;
}

export interface IngestStatusResponse {
  document_id: string;
  status: IngestionStatus;
  stage: IngestionStage;
  progress: number;
  metadata?: DocumentMetadata;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceCitation[] | null;
  timestamp: string;
  model?: string;
}

export interface SessionInfo {
  id: string;
  document_id: string;
  title: string;
  created_at: string;
  messages: ChatMessage[];
}

export type ConversationMode = 'text' | 'voice';

export type VoiceState =
  | 'idle'
  | 'requesting_permission'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';
