
import os

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs


load_dotenv()

MODEL_ID = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")


class ElevenLabsTTS:
    def __init__(self):
        api_key = os.getenv("ELEVENLABS_API_KEY")

        if not api_key:
            raise RuntimeError("ELEVENLABS_API_KEY is not configured")

        self.client = ElevenLabs(api_key=api_key)

    def generate_audio(self, text: str) -> bytes:
        if not text.strip():
            raise ValueError("Text cannot be empty")

        audio_chunks = self.client.text_to_speech.convert(
            text=text,
            voice_id=VOICE_ID,
            model_id=MODEL_ID,
            output_format="mp3_44100_128",
        )

        return b"".join(audio_chunks)
