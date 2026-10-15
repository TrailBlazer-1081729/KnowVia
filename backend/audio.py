import asyncio
import threading

import sounddevice as sd


INPUT_SAMPLE_RATE = 16000
OUTPUT_SAMPLE_RATE = 24000
CHUNK_SIZE = 320
SPEECH_THRESHOLD = 500
MAX_INPUT_CHUNKS = 50


class AudioIO:
    """Small wrapper around the default microphone and speakers."""

    def __init__(self):
        self.loop = asyncio.get_running_loop()
        self.microphone = None
        self.speakers = None
        self.chunks = asyncio.Queue(maxsize=MAX_INPUT_CHUNKS)
        self.playback_buffer = bytearray()
        self.playback_lock = threading.Lock()

    def start(self):
        self.microphone = sd.RawInputStream(
            samplerate=INPUT_SAMPLE_RATE,
            channels=1,
            dtype="int16",
            blocksize=CHUNK_SIZE,
            callback=self.capture_audio,
        )
        self.speakers = sd.RawOutputStream(
            samplerate=OUTPUT_SAMPLE_RATE,
            channels=1,
            dtype="int16",
            blocksize=2400,
            callback=self.play_audio,
        )
        self.microphone.start()
        self.speakers.start()

    def capture_audio(self, data, frames, time, status):
        if status:
            print(f"Audio input warning: {status}")
        self.loop.call_soon_threadsafe(self.queue_microphone_chunk, bytes(data))

    def queue_microphone_chunk(self, data):
        if not self.chunks.full():
            self.chunks.put_nowait(data)

    async def microphone_chunks(self):
        while True:
            yield await self.chunks.get()

    def play(self, audio):
        """Queue Gemini audio without blocking the Live API receive loop."""
        with self.playback_lock:
            self.playback_buffer.extend(audio)

    def play_audio(self, outdata, frames, time, status):
        if status:
            print(f"Audio output warning: {status}")

        with self.playback_lock:
            size = min(len(outdata), len(self.playback_buffer))
            outdata[:size] = self.playback_buffer[:size]
            del self.playback_buffer[:size]

        if size < len(outdata):
            outdata[size:] = b"\x00" * (len(outdata) - size)

    async def wait_until_played(self):
        """Wait until queued Gemini audio has reached the speaker callback."""
        while True:
            with self.playback_lock:
                if not self.playback_buffer:
                    break
            await asyncio.sleep(0.05)
        await asyncio.sleep(0.2)

    def clear_playback(self):
        """Stop queued speech when the user interrupts Gemini."""
        with self.playback_lock:
            self.playback_buffer.clear()

    @staticmethod
    def is_speech(audio):
        """Return True when an input chunk is louder than normal room noise."""
        samples = memoryview(audio).cast("h")
        return max(abs(sample) for sample in samples) > SPEECH_THRESHOLD

    def stop(self):
        for stream in (self.microphone, self.speakers):
            if stream:
                stream.stop()
                stream.close()
