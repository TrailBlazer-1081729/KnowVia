
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

_client = None
MODEL_NAME = "gemini-3.1-flash-lite"


def get_gemini_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is missing from the .env file")
        _client = genai.Client(api_key=api_key)
    return _client


def get_model_name():
    return MODEL_NAME
