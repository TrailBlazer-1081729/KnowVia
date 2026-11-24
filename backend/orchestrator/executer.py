
from google.genai import types

from backend.gemini import get_gemini_client
from backend.client_manager import MCPClientManager


MODEL = "gemini-3.8-live"
TEXT_MODEL = "gemini-2.5-flash"
MAX_TOOL_CALLS_PER_TURN = 10


class Executer:
    def __init__(self):
        self.client = get_gemini_client()
        self.mcp = MCPClientManager()
        self.session = None
        self.live_context = None
        self.text_history = []
        self.text_tools = []

    async def connect_text_mode(self):
        """Connect MCP servers and prepare a text conversation."""
        await self.mcp.connect()
        self.text_tools = await self.get_function_declarations()

    async def connect(self):
        await self.mcp.connect()

        declarations = await self.get_function_declarations()

        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            tools=[types.Tool(function_declarations=declarations)],
            system_instruction=(
                "You are a helpful real-time voice assistant. "
                "You can answer questions and use the available tools. "
                "Use tools when necessary, and explain results naturally. "
                "Keep your responses concise."
            ),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )

        self.live_context = self.client.aio.live.connect(
            model=MODEL,
            config=config,
        )

        self.session = await self.live_context.__aenter__()

        print("Connected to Gemini Live with MCP tools.")

    async def send_text(self, text):
        await self.session.send_realtime_input(text=text)

    async def send_audio(self, audio):
        await self.session.send_realtime_input(
            audio=types.Blob(
                data=audio,
                mime_type="audio/pcm;rate=16000",
            )
        )

    async def end_audio_turn(self):
        await self.session.send_realtime_input(audio_stream_end=True)

    async def send_text_message(self, text):
        """Send one text message and return Gemini's final text response."""
        self.text_history.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=text)],
            )
        )

        for _ in range(MAX_TOOL_CALLS_PER_TURN):
            response = await self.generate_text_response()
            function_calls = response.function_calls or []

            if not function_calls:
                self.text_history.append(response.candidates[0].content)
                return response.text or "I did not receive a text response."

            self.text_history.append(response.candidates[0].content)
            tool_responses = []

            for function_call in function_calls:
                result = await self.call_mcp_tool(
                    function_call.name,
                    function_call.args or {},
                )

                tool_responses.append(
                    types.Part.from_function_response(
                        name=function_call.name,
                        response=result,
                    )
                )

            self.text_history.append(
                types.Content(role="user", parts=tool_responses)
            )

        return "I stopped because the request needed too many tool calls."

    async def get_function_declarations(self):
        tools = await self.mcp.get_tools()
        declarations = []

        for name, tool in tools.items():
            declarations.append(
                types.FunctionDeclaration(
                    name=name,
                    description=tool.get("description") or name,
                    parameters_json_schema=tool["input_schema"],
                )
            )

        return declarations

    async def generate_text_response(self):
        config = types.GenerateContentConfig(
            tools=[types.Tool(function_declarations=self.text_tools)],
            system_instruction=(
                "You are a helpful assistant. Use the available tools when "
                "they are useful, then explain the result clearly."
            ),
        )

        return await self.client.aio.models.generate_content(
            model=TEXT_MODEL,
            contents=self.text_history,
            config=config,
        )

    async def call_mcp_tool(self, name, arguments):
        print(f"Calling MCP tool: {name}")

        try:
            result = await self.mcp.call_tool(name, arguments)
            content = [
                item.text
                for item in result.content
                if hasattr(item, "text")
            ]

            return {
                "result": content,
                "is_error": result.isError,
            }

        except Exception as exc:
            return {"error": str(exc)}

    async def handle_tool_calls(self, tool_call):
        responses = []

        for function_call in tool_call.function_calls:
            name = function_call.name
            arguments = function_call.args or {}

            response_data = await self.call_mcp_tool(name, arguments)

            responses.append(
                types.FunctionResponse(
                    id=function_call.id,
                    name=name,
                    response=response_data,
                )
            )

        await self.session.send_tool_response(
            function_responses=responses
        )

    async def receive_responses(
        self,
        on_turn_complete=None,
        on_interrupted=None,
    ):
        while self.session:
            async for response in self.session.receive():
                if response.tool_call:
                    await self.handle_tool_calls(response.tool_call)

                content = response.server_content

                if content is None:
                    continue

                if content.interrupted:
                    print("\nGemini was interrupted.")
                    if on_interrupted:
                        on_interrupted()

                if content.input_transcription:
                    text = content.input_transcription.text
                    if text:
                        print(f"\nYou: {text}")

                if content.output_transcription:
                    text = content.output_transcription.text
                    if text:
                        print(f"\nGemini: {text}")

                if content.model_turn:
                    for part in content.model_turn.parts:
                        if part.inline_data and part.inline_data.data:
                            yield part.inline_data.data

                if content.turn_complete:
                    print("\nTurn complete.")
                    if on_turn_complete:
                        on_turn_complete()

    async def close(self):
        await self.close_live_session()
        await self.mcp.close()
        await self.client.aio.aclose()

    async def close_live_session(self):
        if self.live_context:
            await self.live_context.__aexit__(None, None, None)
            self.live_context = None
            self.session = None
