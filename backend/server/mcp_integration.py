"""Adapter for the optional MCP ingestion and query tools."""

from typing import Any, Dict, Optional

from backend.client_manager import MCPClientManager
from .state import mcp_manager


class MCPIntegrationLayer:
    """
    Integration adapter for MCP servers:
    1. Ingestion MCP: accepts document reference, extracts, embeds, indexes.
    2. Query MCP: performs vector search and returns context with citations.
    """
    def __init__(self, manager: MCPClientManager):
        self.mcp_manager = manager

    async def call_ingestion_mcp(self, document_id: str, file_path: str) -> Optional[Dict[str, Any]]:
        """Hook to be invoked when Ingestion MCP server is installed."""
        if not self.mcp_manager.sessions:
            return None
        try:
            tools = await self.mcp_manager.get_tools()
            if "ingest_pdf" in tools or "ingest_document" in tools:
                tool_name = "ingest_pdf" if "ingest_pdf" in tools else "ingest_document"
                result = await self.mcp_manager.call_tool(tool_name, {"document_id": document_id, "file_path": file_path})
                return {"success": True, "result": result}
        except Exception as exc:
            print(f"[MCP Integration] Ingestion MCP notice: {exc}")
        return None

    async def call_query_mcp(self, document_id: str, query: str) -> Optional[Dict[str, Any]]:
        """Hook to be invoked when Query MCP server is installed."""
        if not self.mcp_manager.sessions:
            return None
        try:
            tools = await self.mcp_manager.get_tools()
            if "query_document" in tools or "rag_search" in tools:
                tool_name = "query_document" if "query_document" in tools else "rag_search"
                result = await self.mcp_manager.call_tool(tool_name, {"document_id": document_id, "query": query})
                return {"success": True, "result": result}
        except Exception as exc:
            print(f"[MCP Integration] Query MCP notice: {exc}")
        return None


mcp_layer = MCPIntegrationLayer(mcp_manager)
