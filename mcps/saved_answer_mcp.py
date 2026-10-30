
import sqlite3
from datetime import datetime
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("SavedAnswers")

DB_PATH = Path(__file__).resolve().parent / "saved_answers.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS saved_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                source TEXT,
                created_at TEXT NOT NULL
            )
        """)


@mcp.tool()
def save_answer(
    name: str,
    question: str,
    answer: str,
    source: str = "",
) -> dict:
    """Save an answer with a name, question, answer, and optional source."""

    initialize_database()

    created_at = datetime.now().astimezone().isoformat()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO saved_answers
                (name, question, answer, source, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, question, answer, source, created_at),
        )

        entry_id = cursor.lastrowid

    return {
        "success": True,
        "id": entry_id,
        "name": name,
        "created_at": created_at,
    }


@mcp.tool()
def get_saved_answer(
    entry_id: int = 0,
    name: str = "",
    query: str = "",
) -> dict:
    """Retrieve saved answers by ID, exact name, or keyword search.
    Provide entry_id, name, or query. ID takes priority.
    """

    initialize_database()

    with get_connection() as connection:
        if entry_id > 0:
            rows = connection.execute(
                "SELECT * FROM saved_answers WHERE id = ?",
                (entry_id,),
            ).fetchall()

        elif name:
            rows = connection.execute(
                """
                SELECT * FROM saved_answers
                WHERE name = ?
                ORDER BY id DESC
                """,
                (name,),
            ).fetchall()

        elif query:
            pattern = f"%{query}%"
            rows = connection.execute(
                """
                SELECT * FROM saved_answers
                WHERE name LIKE ?
                   OR question LIKE ?
                   OR answer LIKE ?
                   OR source LIKE ?
                ORDER BY id DESC
                LIMIT 20
                """,
                (pattern, pattern, pattern, pattern),
            ).fetchall()

        else:
            return {
                "success": False,
                "message": "Provide entry_id, name, or query.",
            }

    return {
        "count": len(rows),
        "answers": [dict(row) for row in rows],
    }


@mcp.tool()
def list_saved_answers(date: str = "") -> dict:
    """List saved answers. Optionally filter by date in YYYY-MM-DD format."""

    initialize_database()

    with get_connection() as connection:
        if date:
            rows = connection.execute(
                """
                SELECT * FROM saved_answers
                WHERE substr(created_at, 1, 10) = ?
                ORDER BY id DESC
                """,
                (date,),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT * FROM saved_answers
                ORDER BY id DESC
                LIMIT 100
                """
            ).fetchall()

    return {
        "count": len(rows),
        "answers": [dict(row) for row in rows],
    }


@mcp.tool()
def delete_saved_answer(entry_id: int) -> dict:
    """Delete a saved answer using its exact database ID."""

    initialize_database()

    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM saved_answers WHERE id = ?",
            (entry_id,),
        )
        deleted = cursor.rowcount > 0

    return {
        "success": deleted,
        "message": (
            "Answer deleted."
            if deleted
            else "No answer found with that ID."
        ),
    }


initialize_database()

if __name__ == "__main__":
    mcp.run(transport="stdio")
