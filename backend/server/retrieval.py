"""Local document-chunk retrieval helpers."""

from typing import Any, Dict, List

from .state import DOCUMENT_CHUNKS


def find_relevant_chunks(doc_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """Simple term-frequency relevance scorer for local grounded context retrieval."""
    chunks = DOCUMENT_CHUNKS.get(doc_id, [])
    if not chunks:
        return []

    q_tokens = set(query.lower().split())
    scored = []

    for c in chunks:
        c_text_lower = c["text"].lower()
        score = sum(1 for token in q_tokens if token in c_text_lower)
        # Normalize score
        norm_score = min(0.98, max(0.45, (score / max(1, len(q_tokens))) * 0.95)) if score > 0 else 0.40
        scored.append((norm_score, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] | {"relevance_score": item[0]} for item in scored[:top_k]]
