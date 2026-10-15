
import os

from dotenv import load_dotenv
from google import genai

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing from the .env file")

client = genai.Client(api_key=API_KEY)

MODEL_NAME = "gemini-2.5-flash"


def get_gemini_client():
    return client


def get_model_name():
    return MODEL_NAME
