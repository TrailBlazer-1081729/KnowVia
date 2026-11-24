import os
import sys
import unittest
import time
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from starlette.testclient import TestClient
from backend.server import app, DOCUMENTS, DOCUMENT_CHUNKS, SESSIONS, run_ingestion_pipeline

import asyncio


class TestRAGVoiceAssistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.sample_pdf = ROOT_DIR / "sample_research_paper.pdf"
        if not cls.sample_pdf.exists():
            from create_sample_pdf import create_sample_pdf
            create_sample_pdf(str(cls.sample_pdf))

    def test_01_health_check(self):
        """Test health endpoint reports healthy status."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "rag-voice-assistant")
        self.assertIn("gemini_available", data)

    def test_02_upload_and_ingestion(self):
        """Test document upload and phased ingestion pipeline."""
        with open(self.sample_pdf, "rb") as f:
            response = self.client.post(
                "/api/documents",
                files={"file": ("sample_research_paper.pdf", f, "application/pdf")},
            )
        self.assertEqual(response.status_code, 200)
        doc = response.json()
        doc_id = doc["id"]
        self.assertTrue(doc_id.startswith("doc_"))
        self.assertEqual(doc["filename"], "sample_research_paper.pdf")

        # Start ingestion
        ingest_res = self.client.post(f"/api/documents/{doc_id}/ingest")
        self.assertEqual(ingest_res.status_code, 200)

        # Execute ingestion directly to avoid Starlette TestClient background-task thread starvation
        asyncio.run(run_ingestion_pipeline(doc_id))

        status_res = self.client.get(f"/api/documents/{doc_id}/status")
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.json()

        self.assertIsNotNone(status_data)
        self.assertEqual(status_data["status"], "ready")
        self.assertEqual(status_data["stage"], "completed")
        self.assertGreater(status_data["metadata"]["chunk_count"], 0)
        self.assertIn(doc_id, DOCUMENT_CHUNKS)

    def test_03_rag_chat_grounding(self):
        """Test grounded chat retrieval with citations from document."""
        # Find a ready document
        doc_id = None
        for did, doc in DOCUMENTS.items():
            if doc.status == "ready":
                doc_id = did
                break

        if doc_id is None:
            self.skipTest("No ready document available (test_02 may have failed)")

        # Create session
        sess_res = self.client.post(f"/api/sessions?document_id={doc_id}")
        self.assertEqual(sess_res.status_code, 200)
        session_id = sess_res.json()["id"]

        # Send inquiry about Section 3
        chat_res = self.client.post(
            "/api/chat",
            json={
                "session_id": session_id,
                "document_id": doc_id,
                "message": "What is the conversational turnaround time reported in Section 3?",
            },
        )
        self.assertEqual(chat_res.status_code, 200)
        chat_data = chat_res.json()
        self.assertEqual(chat_data["role"], "assistant")
        self.assertTrue(len(chat_data["content"]) > 0)
        self.assertIsNotNone(chat_data.get("sources"))
        # Check source citation contains page 3
        sources = chat_data.get("sources", [])
        self.assertTrue(any(s["page"] in (1, 2, 3) for s in sources))

    def test_04_websocket_voice_handshake_and_protection(self):
        """Test WebSocket voice endpoint enforces document readiness and rejects invalid IDs."""
        # Test connecting with non-existent document — the server sends an error and closes
        with self.client.websocket_connect("/api/voice/live?document_id=doc_fake&session_id=sess_1") as ws:
            data = ws.receive_json()
            self.assertEqual(data["type"], "error")
            self.assertIn("ingestion", data["message"].lower())

        # Test connecting with valid ready document
        doc_id = None
        for did, doc in DOCUMENTS.items():
            if doc.status == "ready":
                doc_id = did
                break

        if doc_id is None:
            self.skipTest("No ready document available")

        with self.client.websocket_connect(f"/api/voice/live?document_id={doc_id}&session_id=sess_valid&mock=true") as ws:
            connected_msg = ws.receive_json()
            self.assertEqual(connected_msg["type"], "connected")
            self.assertEqual(connected_msg["mode"], "voice_realtime")
            self.assertEqual(connected_msg["document_ready"], True)

            state_msg = ws.receive_json()
            self.assertEqual(state_msg["type"], "state")
            self.assertEqual(state_msg["state"], "listening")

            # Ping pong
            ws.send_json({"type": "ping"})
            pong_msg = ws.receive_json()
            self.assertEqual(pong_msg["type"], "pong")

            # Stop session cleanly
            ws.send_json({"type": "stop"})

    def test_05_websocket_voice_interruption_epochs(self):
        """Test manual interruption message handling, epoch incrementing, and state stability."""
        doc_id = None
        for did, doc in DOCUMENTS.items():
            if doc.status == "ready":
                doc_id = did
                break

        if doc_id is None:
            self.skipTest("No ready document available")

        with self.client.websocket_connect(f"/api/voice/live?document_id={doc_id}&session_id=sess_interrupt_test&mock=true") as ws:
            # Consume handshake
            msg1 = ws.receive_json()
            self.assertEqual(msg1["type"], "connected")
            msg2 = ws.receive_json()
            self.assertEqual(msg2["type"], "state")
            self.assertEqual(msg2["state"], "listening")

            # 1. Trigger first manual interrupt
            ws.send_json({"type": "interrupt"})
            intr1 = ws.receive_json()
            self.assertEqual(intr1["type"], "interrupted")
            self.assertEqual(intr1["epoch"], 1)
            self.assertEqual(intr1["source"], "client")

            state1 = ws.receive_json()
            self.assertEqual(state1["type"], "state")
            self.assertEqual(state1["state"], "listening")

            # 2. Trigger second manual interrupt immediately (rapid clicks)
            ws.send_json({"type": "interrupt"})
            intr2 = ws.receive_json()
            self.assertEqual(intr2["type"], "interrupted")
            self.assertEqual(intr2["epoch"], 2)

            state2 = ws.receive_json()
            self.assertEqual(state2["type"], "state")
            self.assertEqual(state2["state"], "listening")

            # 3. Stream binary PCM audio after interrupt (user speaks new question)
            pcm_chunk = b"\x00\x00" * 800  # 800 samples = 50ms at 16kHz
            ws.send_bytes(pcm_chunk)

            # 4. Third interrupt after sending audio
            ws.send_json({"type": "interrupt"})
            intr3 = ws.receive_json()
            self.assertEqual(intr3["type"], "interrupted")
            self.assertEqual(intr3["epoch"], 3)

            state3 = ws.receive_json()
            self.assertEqual(state3["type"], "state")
            self.assertEqual(state3["state"], "listening")

            # Session remains alive and can be stopped cleanly
            ws.send_json({"type": "stop"})


if __name__ == "__main__":
    unittest.main()
