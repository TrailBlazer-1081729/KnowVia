
import asyncio

from backend.orchestrator.executer import Executer
from backend.audio import AudioIO


async def send_microphone(executer, audio):
    async for chunk in audio.microphone_chunks():
        await executer.send_audio(chunk)


async def receive_responses(executer, audio):
    async for audio_data in executer.receive_responses():
        audio.play(audio_data)


async def main():
    executer = Executer()
    audio = AudioIO()
    tasks = []

    try:
        await executer.connect()
        audio.start()

        print("Microphone started. Speak normally.")
        print("Press Ctrl+C to quit.")

        tasks = [
            asyncio.create_task(send_microphone(executer, audio)),
            asyncio.create_task(receive_responses(executer, audio)),
        ]

        done, pending = await asyncio.wait(
            tasks,
            return_when=asyncio.FIRST_EXCEPTION,
        )

        for task in done:
            task.result()

    except KeyboardInterrupt:
        print("\nStopping assistant...")

    finally:
        for task in tasks:
            task.cancel()

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        audio.stop()
        await executer.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
