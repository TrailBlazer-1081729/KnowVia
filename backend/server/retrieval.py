"""Compatibility adapter connecting the application to the internal RAG semantic retrieval subsystem."""

from typing import Any, Dict, List

from backend.rag import get_rag_service
from .schemas import SourceCitation


async def find_relevant_chunks(
    doc_id: str,
    query: str,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Retrieve semantically relevant chunks for a document from Qdrant using Jina embeddings.
    Replaces legacy keyword matching entirely.
    """
    if not doc_id or not query.strip():
        return []

    rag = await get_rag_service()
    results = await rag.retrieve(
        document_id=doc_id,
        query=query,
        top_k=top_k,
    )

    chunks: List[Dict[str, Any]] = []
    for result in results:
        chunk = result.chunk
        section_label = (
            chunk.section
            or chunk.chapter
            or f"Page {chunk.page}"
        )

        chunks.append({
            "id": chunk.id,
            "document_id": chunk.document_id,
            "filename": chunk.filename,
            "page": chunk.page,
            "section": section_label,
            "chapter": chunk.chapter,
            "subsection": chunk.subsection,
            "text": chunk.text,
            "raw_score": result.score,
            # Clamp to [0.0, 1.0] solely to satisfy the public API / UI schema
            "relevance_score": max(0.0, min(1.0, result.score)),
            "metadata": chunk.metadata,
        })

    return chunks


def build_source_citations(
    relevant_chunks: List[Dict[str, Any]],
    max_snippet_chars: int = 240,
) -> List[SourceCitation]:
    """
    Shared helper ensuring unified citation generation across both text chat and voice streams.
    """
    citations: List[SourceCitation] = []
    for c in relevant_chunks:
        raw_text = c.get("text", "")
        snippet = (
            raw_text[:max_snippet_chars] + "..."
            if len(raw_text) > max_snippet_chars
            else raw_text
        )

        citations.append(
            SourceCitation(
                id=str(c.get("id", "")),
                page=int(c.get("page", 1)),
                section=c.get("section") or f"Page {c.get('page', 1)}",
                snippet=snippet,
                relevance_score=float(c.get("relevance_score", 0.0)),
            )
        )
    return citations
