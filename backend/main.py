
import asyncio

from backend.orchestrator.executer import Executer
from backend.audio import AudioIO


async def main():
    executer = Executer()
    audio = AudioIO()
    response_task = None

    try:
        await executer.connect()

        audio.start()

        response_task = asyncio.create_task(
            receive_responses(executer, audio)
        )

        print("Audio assistant ready. Speak into your microphone.")
        print("Press Ctrl+C to quit.")

        async for chunk in audio.microphone_chunks():
            if AudioIO.is_speech(chunk):
                await executer.send_audio(chunk)

            await asyncio.sleep(0)

    except KeyboardInterrupt:
        print("\nShutting down...")

    finally:
        audio.stop()

        if response_task:
            response_task.cancel()
            await asyncio.gather(response_task, return_exceptions=True)

        await executer.close()


async def receive_responses(executer, audio):
    async for audio_data in executer.receive_responses():
        audio.play(audio_data)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
