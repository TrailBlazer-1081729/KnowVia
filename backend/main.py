import asyncio

from backend.orchestrator.executer import Executer
from backend.audio import AudioIO


async def send_microphone(executer: Executer, audio: AudioIO):
    """Send microphone chunks to Gemini Live."""

    async for chunk in audio.microphone_chunks():
        await executer.send_audio(chunk)


async def receive_responses(executer: Executer, audio: AudioIO):
    """Receive and play Gemini Live audio responses."""

    async for audio_data in executer.receive_responses():
        audio.play(audio_data)


async def run_text_mode(executer: Executer):
    """Text input, Gemini response, and ElevenLabs speech output."""

    await executer.connect_text_mode()

    print("\nText mode ready.")
    print("Type /clear to clear conversation history.")
    print("Type /exit to return to the terminal and quit.")

    while True:
        try:
            user_input = await asyncio.to_thread(
                input, "\nYou: "
            )
        except EOFError:
            break

        user_input = user_input.strip()

        if not user_input:
            continue

        if user_input.lower() in {"/exit", "/quit"}:
            break

        if user_input.lower() == "/clear":
            executer.text_history.clear()
            print("Conversation history cleared.")
            continue

        try:
            await executer.send_text_and_speak(user_input)
        except Exception as exc:
            print(f"\n[Assistant error] {exc}")


async def run_voice_mode(
    executer: Executer,
    audio: AudioIO,
):
    """Gemini Live audio-to-audio mode."""

    await executer.connect()

    audio_started = False
    tasks = []

    try:
        audio.start()
        audio_started = True

        print("\nGemini Live voice mode started.")
        print("Speak normally into your microphone.")
        print("Press Ctrl+C to stop.")

        tasks = [
            asyncio.create_task(
                send_microphone(executer, audio)
            ),
            asyncio.create_task(
                receive_responses(executer, audio)
            ),
        ]

        await asyncio.gather(*tasks)

    finally:
        for task in tasks:
            if not task.done():
                task.cancel()

        if tasks:
            await asyncio.gather(
                *tasks,
                return_exceptions=True,
            )

        if audio_started:
            audio.stop()


async def main():
    executer = Executer()
    audio = None

    try:
        print("=" * 48)
        print("       AI RESEARCH ASSISTANT")
        print("=" * 48)
        print("1. Text mode (Gemini + ElevenLabs TTS)")
        print("2. Voice mode (Gemini Live)")
        print("Q. Quit")

        mode = (
            await asyncio.to_thread(
                input, "\nSelect mode: "
            )
        ).strip().lower()

        if mode == "1":
            await run_text_mode(executer)

        elif mode == "2":
            audio = AudioIO()
            await run_voice_mode(executer, audio)

        elif mode in {"q", "quit", "exit"}:
            print("Goodbye.")

        else:
            print("Invalid selection. Choose 1, 2, or Q.")

    except KeyboardInterrupt:
        print("\nStopping assistant...")

    finally:
        try:
            await executer.close()
        except Exception as exc:
            print(f"[Shutdown warning] {exc}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass    