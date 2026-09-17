"""Kinetix MCP (Model Context Protocol) integration package.
Provides native MCP server capabilities for AI tools including Claude Desktop,
Cursor, Windsurf, and custom LLM agents.
"""

from app.mcp.server import mcp

__all__ = ["mcp"]
