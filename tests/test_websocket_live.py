import asyncio
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

import websockets
from httpx import AsyncClient


async def test_ws_live():
    print("Testing WebSocket Live Endpoint against running server...")
    base_url = "http://127.0.0.1:8000"
    ws_url = "ws://127.0.0.1:8000/api/voice/live"

    async with AsyncClient(base_url=base_url) as client:
        # 1. Check health
        res = await client.get("/api/health")
        print("Health status:", res.status_code, res.json())
        assert res.status_code == 200

        # 2. Upload document
        pdf_path = ROOT_DIR / "sample_research_paper.pdf"
        with open(pdf_path, "rb") as f:
            up_res = await client.post(
                "/api/documents",
                files={"file": ("sample_research_paper.pdf", f, "application/pdf")},
            )
        assert up_res.status_code == 200
        doc = up_res.json()
        doc_id = doc["id"]
        print(f"Uploaded doc: {doc_id}")

        # 3. Ingest
        await client.post(f"/api/documents/{doc_id}/ingest")
        for _ in range(30):
            await asyncio.sleep(0.3)
            st_res = await client.get(f"/api/documents/{doc_id}/status")
            if st_res.json()["status"] == "ready":
                break
        assert st_res.json()["status"] == "ready"
        print(f"Document {doc_id} is ready for voice!")

        # 4. Connect WebSocket
        url = f"{ws_url}?document_id={doc_id}&session_id=sess_test_live"
        print(f"Connecting to {url}...")
        async with websockets.connect(url) as ws:
            # First message: connected
            msg1 = await ws.recv()
            data1 = json.loads(msg1)
            print("Received WS msg 1:", data1)
            assert data1["type"] == "connected"
            assert data1["document_ready"] is True

            # Second message: listening state
            msg2 = await ws.recv()
            data2 = json.loads(msg2)
            print("Received WS msg 2:", data2)
            assert data2["type"] == "state"
            assert data2["state"] == "listening"

            # Test Ping
            await ws.send(json.dumps({"type": "ping"}))
            msg_pong = await ws.recv()
            data_pong = json.loads(msg_pong)
            print("Received Pong:", data_pong)
            assert data_pong["type"] == "pong"

            # Send 16kHz PCM audio chunk (silent int16 samples)
            pcm_chunk = b"\x00\x00" * 1600  # 1600 samples = 100ms
            await ws.send(pcm_chunk)
            print("Sent 100ms 16kHz PCM audio chunk successfully.")

            # Stop session cleanly
            await ws.send(json.dumps({"type": "stop"}))
            print("Sent stop message.")

            # Wait for disconnect/closure
            try:
                await asyncio.wait_for(ws.wait_closed(), timeout=3.0)
            except asyncio.TimeoutError:
                pass

        print("WebSocket live conversation test completed successfully!")


if __name__ == "__main__":
    asyncio.run(test_ws_live())
