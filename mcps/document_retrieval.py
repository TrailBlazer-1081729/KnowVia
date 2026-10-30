
import re
from pathlib import Path

from pypdf import PdfReader
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("document-retrieval")

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "backend_1" / "uploads"
CHUNK_SIZE = 900
OVERLAP = 150
TOP_K = 4


def get_chunks(pdf_path: Path) -> list[dict]:
    chunks = []

    reader = PdfReader(str(pdf_path))

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        start = 0
        while start < len(text):
            chunk = text[start:start + CHUNK_SIZE].strip()

            if chunk:
                chunks.append({
                    "page": page_number,
                    "text": chunk,
                })

            start += CHUNK_SIZE - OVERLAP

    return chunks


def score_chunk(query: str, text: str) -> int:
    query_words = set(re.findall(r"\b[a-zA-Z0-9]+\b", query.lower()))
    text_words = re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())

    return sum(1 for word in text_words if word in query_words)


@mcp.tool()
def search_document(document_id: str, query: str) -> str:
    """Search an uploaded PDF and return relevant passages with page numbers.

    Args:
        document_id: ID of the uploaded PDF.
        query: Question or topic to search for in the document.
    """
    if not re.fullmatch(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
        r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        document_id,
    ):
        return "Invalid document ID."

    pdf_path = UPLOAD_DIR / f"{document_id}.pdf"

    if not pdf_path.is_file():
        return "Document not found."

    try:
        chunks = get_chunks(pdf_path)
    except Exception:
        return "Could not read the PDF."

    ranked = sorted(
        chunks,
        key=lambda chunk: score_chunk(query, chunk["text"]),
        reverse=True,
    )

    results = [
        chunk for chunk in ranked
        if score_chunk(query, chunk["text"]) > 0
    ][:TOP_K]

    if not results:
        return "No relevant passages found in the document."

    return "\n\n".join(
        f"[Page {chunk['page']}]\n{chunk['text']}"
        for chunk in results
    )


if __name__ == "__main__":
    mcp.run()
