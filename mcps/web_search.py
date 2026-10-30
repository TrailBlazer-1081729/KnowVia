import os

from dotenv import load_dotenv
from tavily import TavilyClient
from mcp.server.fastmcp import FastMCP

load_dotenv()

mcp = FastMCP("TavilyWebSearch")

api_key = os.getenv("TAVILY_API_KEY") or os.getenv("tavily_api")
if not api_key:
    raise RuntimeError("TAVILY_API_KEY is missing from .env")

tavily = TavilyClient(api_key=api_key)


@mcp.tool()
def search_web(query: str) -> dict:

    """Search the web thoroughly and return relevant results."""

    if not query.strip():
        raise ValueError("Search query cannot be empty")

    response = tavily.search(
        query=query,
        search_depth="advanced",
        max_results=10,
        topic="general",
    )

    return {
        "query": query,
        "results": [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
                "score": r.get("score", 0),
            }
            for r in response.get("results", [])
        ],
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")