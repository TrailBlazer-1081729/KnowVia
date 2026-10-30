"""Pydantic request and response models used by the server package."""

from typing import List, Optional
from pydantic import BaseModel, Field


class SourceCitation(BaseModel):
    id: str
    page: int
    section: Optional[str] = None
    snippet: str
    relevance_score: float = Field(ge=0.0, le=1.0)

class DocumentMetadata(BaseModel):
    id: str
    filename: str
    size_bytes: int
    page_count: int
    chunk_count: int = 0
    uploaded_at: str
    status: str = "idle"  # idle | uploading | ingesting | ready | error
    stage: str = "uploaded"  # uploaded | extracting_text | chunking | generating_embeddings | building_index | completed | failed
    progress: float = 0.0  # 0.0 to 1.0
    error_message: Optional[str] = None
    mcp_provider: str = "internal_pipeline"  # will reflect future "mcp:rag_ingestion" when attached
    file_path: Optional[str] = None

class IngestStatusResponse(BaseModel):
    document_id: str
    status: str
    stage: str
    progress: float
    metadata: Optional[DocumentMetadata] = None
    message: str

class ChatRequest(BaseModel):
    session_id: str
    document_id: str
    message: str
    stream: bool = False

class ChatMessage(BaseModel):
    id: str
    role: str  # user | assistant | system
    content: str
    sources: Optional[List[SourceCitation]] = None
    timestamp: str
    model: Optional[str] = None

class SessionInfo(BaseModel):
    id: str
    document_id: str
    title: str
    created_at: str
    messages: List[ChatMessage] = []
