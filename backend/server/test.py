
import asyncio
from backend.gemini import get_gemini_client, get_model_name

async def main():
    client = get_gemini_client()
    model = get_model_name()

    print("Model:", model)

    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents="Explain what a compiler is in two sentences."
        )

        print("Response:", response.text)
        print("SUCCESS")

    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
