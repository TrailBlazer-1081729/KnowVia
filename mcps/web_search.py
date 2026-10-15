
import os

from dotenv import load_dotenv
from tavily import TavilyClient
from mcp.server.fastmcp import FastMCP

load_dotenv()

mcp = FastMCP("TavilyWebSearch")


api_key = os.getenv("tavily_api")
if not api_key:
    raise RuntimeError("TAVILY_API_KEY is missing from .env")
tavily = TavilyClient(api_key=api_key)


@mcp.tool()
def search_web(query: str, max_results: int = 5) -> dict:
    """Search the web and return relevant pages with titles, URLs, and content."""

    if not query.strip():
        raise ValueError("Search query cannot be empty")
    max_results = max(1, min(max_results, 10))


    response = tavily.search(
        query=query,
        max_results=max_results,
        search_depth="basic",
        include_answer=False,
    )

    return {
        "query": query,
        "results": [
            {
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "content": result.get("content", ""),
                "score": result.get("score", 0),
            }
            for result in response.get("results", [])
        ],
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
