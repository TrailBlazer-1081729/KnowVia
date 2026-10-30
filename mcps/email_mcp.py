"""Gmail MCP server for the Gemini research agent.

Expected layout:
project/
    credentials.json
    gmail_token.json       # created automatically after OAuth
    mcps/
        email_mcp.py

Install:
    pip install google-api-python-client google-auth google-auth-oauthlib mcp

Enable Gmail API in the same Google Cloud project as credentials.json.
"""

import base64
import logging
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from mcp.server.fastmcp import FastMCP

# Keep Gmail authorization separate from Calendar authorization. The existing
# calendar_token.json does not contain the Gmail permission.
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

PROJECT_ROOT = Path(__file__).resolve().parent
CREDENTIALS_FILE = PROJECT_ROOT / "credential.json"
TOKEN_FILE = PROJECT_ROOT / "gmail_token.json"

mcp = FastMCP("Gmail")


def _get_credentials() -> Credentials:
    """Load or create Gmail OAuth credentials, refreshing them when possible."""
    credentials: Credentials | None = None

    if TOKEN_FILE.exists():
        credentials = Credentials.from_authorized_user_file(
            str(TOKEN_FILE), SCOPES
        )

    # Reauthorize if the stored token lacks the Gmail send scope.
    if credentials and credentials.has_scopes(SCOPES):
        if credentials.valid:
            return credentials

        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                TOKEN_FILE.write_text(credentials.to_json(), encoding="utf-8")
                if credentials.valid and credentials.has_scopes(SCOPES):
                    return credentials
            except Exception:
                logging.exception("Could not refresh Gmail OAuth token; reauthorizing.")

    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"OAuth client file not found: {CREDENTIALS_FILE}. "
            "Place your Google OAuth Desktop app credentials.json in the project root."
        )

    flow = InstalledAppFlow.from_client_secrets_file(
        str(CREDENTIALS_FILE), SCOPES
    )

    # MCP stdio uses stdout for JSON-RPC. Redirect the OAuth helper's
    # authorization URL/instructions to stderr so they cannot corrupt MCP.
    import contextlib
    import sys

    with contextlib.redirect_stdout(sys.stderr):
        credentials = flow.run_local_server(
            port=0,
            open_browser=True,
            authorization_prompt_message=(
                "Authorize Gmail access in your browser: {url}"
            ),
            success_message="Gmail authorization completed. You may close this tab.",
        )

    TOKEN_FILE.write_text(credentials.to_json(), encoding="utf-8")
    return credentials


def _get_gmail_service():
    """Build an authenticated Gmail API service."""
    credentials = _get_credentials()
    return build(
        "gmail",
        "v1",
        credentials=credentials,
        cache_discovery=False,
    )


def _normalize_recipients(value: str, field_name: str) -> list[str]:
    """Accept one or more comma-separated addresses and validate them."""
    if not value or not value.strip():
        if field_name == "to":
            raise ValueError("At least one recipient email address is required.")
        return []

    addresses = [item.strip() for item in value.split(",") if item.strip()]
    for address in addresses:
        if "\r" in address or "\n" in address or "@" not in address:
            raise ValueError(f"Invalid email address in {field_name}: {address!r}")
    return addresses


@mcp.tool()
def send_email(
    to: str,
    subject: str,
    body: str,
    cc: str = "",
    bcc: str = "",
    html_body: str = "",
) -> dict[str, Any]:
    """Send an email using the user's authenticated Gmail account.

    Args:
        to: Required recipient address or comma-separated recipient addresses.
        subject: Email subject.
        body: Plain-text email body.
        cc: Optional comma-separated CC addresses.
        bcc: Optional comma-separated BCC addresses.
        html_body: Optional HTML alternative. Plain text remains the fallback.

    Only call this tool when the user explicitly asks to send an email.
    Never invent recipient addresses or claim success unless the API confirms it.
    """
    if not subject or not subject.strip():
        raise ValueError("Email subject cannot be empty.")
    if "\r" in subject or "\n" in subject:
        raise ValueError("Email subject must not contain newline characters.")
    if not body or not body.strip():
        raise ValueError("Email body cannot be empty.")

    to_addresses = _normalize_recipients(to, "to")
    cc_addresses = _normalize_recipients(cc, "cc")
    bcc_addresses = _normalize_recipients(bcc, "bcc")

    message = EmailMessage()
    message["To"] = ", ".join(to_addresses)
    message["Subject"] = subject.strip()

    if cc_addresses:
        message["Cc"] = ", ".join(cc_addresses)

    # BCC is passed to Gmail in the MIME message but is not exposed in the
    # returned result. Gmail removes the Bcc header from delivered messages.
    if bcc_addresses:
        message["Bcc"] = ", ".join(bcc_addresses)

    message.set_content(body.strip())

    if html_body and html_body.strip():
        message.add_alternative(html_body.strip(), subtype="html")

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")

    try:
        service = _get_gmail_service()
        result = (
            service.users()
            .messages()
            .send(userId="me", body={"raw": raw_message})
            .execute()
        )
    except HttpError as exc:
        logging.exception("Gmail API rejected the send request.")
        raise RuntimeError(f"Gmail API error: {exc}") from exc

    return {
        "success": True,
        "message": "Email sent successfully.",
        "message_id": result.get("id"),
        "thread_id": result.get("threadId"),
        "to": to_addresses,
        "cc": cc_addresses,
        "subject": subject.strip(),
    }


if __name__ == "__main__":
    # Do not print application logs to stdout in stdio transport.
    logging.basicConfig(level=logging.INFO)
    mcp.run(transport="stdio")
