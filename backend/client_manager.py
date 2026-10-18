import sys
from pathlib import Path
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


BASE_DIR = Path(__file__).resolve().parent.parent
MCP_DIR = BASE_DIR / "mcps"

SERVERS = {
    "add": MCP_DIR / "add.py",
    "multiply": MCP_DIR / "multi.py",
    "web_search": MCP_DIR / "web_search.py",
}


class MCPClientManager:
    def __init__(self):
        self.sessions = {}
        self.exit_stack = AsyncExitStack()

    async def connect(self):
        if self.sessions:
            return

        try:
            for name, path in SERVERS.items():
                if not path.exists():
                    raise FileNotFoundError(
                        f"MCP server file not found: {path}"
                    )

                print(
                    f"Connecting to MCP server: {name}",
                    flush=True,
                )

                params = StdioServerParameters(
                    command=sys.executable,
                    args=["-u", str(path)],
                )

                read_stream, write_stream = (
                    await self.exit_stack.enter_async_context(
                        stdio_client(params)
                    )
                )

                session = await self.exit_stack.enter_async_context(
                    ClientSession(read_stream, write_stream)
                )

                await session.initialize()

                self.sessions[name] = session

                print(
                    f"Connected to {name}",
                    flush=True,
                )

        except Exception:
            await self.close()
            raise

    async def get_tools(self):
        tools = {}

        for server_name, session in self.sessions.items():
            result = await session.list_tools()

            for tool in result.tools:
                if tool.name in tools:
                    raise ValueError(
                        f"Duplicate MCP tool name: {tool.name}"
                    )

                tools[tool.name] = {
                    "server": server_name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema,
                }

        return tools

    async def call_tool(self, tool_name: str, arguments: dict):
        for session in self.sessions.values():
            result = await session.list_tools()

            if any(
                tool.name == tool_name
                for tool in result.tools
            ):
                return await session.call_tool(
                    tool_name,
                    arguments,
                )

        raise ValueError(
            f"Tool not found: {tool_name}"
        )

    async def close(self):
        await self.exit_stack.aclose()
        self.sessions.clear()
        self.exit_stack = AsyncExitStack()