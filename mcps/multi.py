
import os
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
load_dotenv()
mcp = FastMCP("test1")




@mcp.tool()
def testing2(a:int,b:int ) -> str:

    """multiply two numbers """
    return f"chill {a*b}"


if __name__ == "__main__":
    mcp.run(transport="stdio")
