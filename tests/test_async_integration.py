import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from httpx import AsyncClient, ASGITransport
from backend.server import app, DOCUMENTS, DOCUMENT_CHUNKS, mcp_manager


async def run_tests():
    print("--- 1. Testing Health Endpoint ---")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
        print(f"Health response: {res.status_code}, {res.json()}")
        assert res.status_code == 200

        print("\n--- 2. Testing Document Upload ---")
        pdf_path = ROOT_DIR / "sample_research_paper.pdf"
        assert pdf_path.exists(), "sample_research_paper.pdf must exist"

        with open(pdf_path, "rb") as f:
            upload_res = await client.post(
                "/api/documents",
                files={"file": ("sample_research_paper.pdf", f, "application/pdf")},
            )
        print(f"Upload response: {upload_res.status_code}")
        assert upload_res.status_code == 200
        doc = upload_res.json()
        doc_id = doc["id"]
        print(f"Uploaded document ID: {doc_id}")

        print("\n--- 3. Testing Ingestion Pipeline ---")
        ingest_res = await client.post(f"/api/documents/{doc_id}/ingest")
        print(f"Ingest start response: {ingest_res.status_code}")
        assert ingest_res.status_code == 200

        for _ in range(30):
            await asyncio.sleep(0.4)
            st_res = await client.get(f"/api/documents/{doc_id}/status")
            st_data = st_res.json()
            print(f"  Stage: {st_data['stage']}, progress: {st_data['progress']:.2f}")
            if st_data["status"] == "ready":
                break

        assert st_data["status"] == "ready", "Document must reach ready status"
        assert doc_id in DOCUMENT_CHUNKS, "Chunks must be stored"
        print(f"Document ingestion complete! Chunks stored: {len(DOCUMENT_CHUNKS[doc_id])}")

        print("\n--- 4. Testing Session Creation ---")
        sess_res = await client.post(f"/api/sessions?document_id={doc_id}")
        assert sess_res.status_code == 200
        session_id = sess_res.json()["id"]
        print(f"Created session ID: {session_id}")

        print("\n--- 5. Testing Grounded RAG Chat ---")
        chat_res = await client.post(
            "/api/chat",
            json={
                "session_id": session_id,
                "document_id": doc_id,
                "message": "What is the conversational turnaround time reported in Section 3?",
            },
        )
        assert chat_res.status_code == 200
        chat_data = chat_res.json()
        print(f"Assistant answer:\n{chat_data['content']}")
        print(f"Citations returned: {chat_data.get('sources')}")
        assert chat_data.get("sources"), "Grounded citations must be returned"

    print("\n--- ALL ASYNC INTEGRATION CHECKS PASSED ---")


if __name__ == "__main__":
    asyncio.run(run_tests())
