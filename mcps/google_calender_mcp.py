
import json
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("GoogleCalendar")

BASE_DIR = Path(__file__).resolve().parent
CREDENTIALS_FILE = BASE_DIR / "credential.json"
TOKEN_FILE = BASE_DIR / "calendar_token.json"
SCOPES = ["https://www.googleapis.com/auth/calendar"]

TIMEZONE = datetime.now().astimezone().tzinfo


def get_calendar():
    creds = None

    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(
            str(TOKEN_FILE), SCOPES
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(CREDENTIALS_FILE), SCOPES
            )
            creds = flow.run_local_server(port=0)

        TOKEN_FILE.write_text(creds.to_json())

    return build("calendar", "v3", credentials=creds)


@mcp.tool()
def create_event(
    title: str,
    event_date: str,
    description: str = "",
) -> dict:
    """Create an all-day calendar event for a date in YYYY-MM-DD format."""

    parsed_date = date.fromisoformat(event_date)

    event = {
        "summary": title,
        "description": description,
        "start": {"date": parsed_date.isoformat()},
        "end": {"date": (parsed_date + timedelta(days=1)).isoformat()},
    }

    created = get_calendar().events().insert(
        calendarId="primary",
        body=event,
    ).execute()

    return {
        "success": True,
        "event_id": created["id"],
        "title": created.get("summary"),
        "date": created["start"].get("date"),
        "link": created.get("htmlLink"),
    }


@mcp.tool()
def list_events(
    event_date: str = "",
    start_date: str = "",
    end_date: str = "",
) -> dict:
    """List events on one date, or in an inclusive date range.
    Use YYYY-MM-DD dates. Leave all arguments empty to list upcoming events.
    """

    service = get_calendar()
    params = {
        "calendarId": "primary",
        "singleEvents": True,
        "orderBy": "startTime",
        "maxResults": 100,
    }

    if event_date:
        day = date.fromisoformat(event_date)
        start = datetime.combine(day, time.min, tzinfo=TIMEZONE)
        end = datetime.combine(
            day + timedelta(days=1), time.min, tzinfo=TIMEZONE
        )
        params["timeMin"] = start.isoformat()
        params["timeMax"] = end.isoformat()

    elif start_date or end_date:
        if not start_date or not end_date:
            raise ValueError("Provide both start_date and end_date.")

        first = date.fromisoformat(start_date)
        last = date.fromisoformat(end_date)

        if last < first:
            raise ValueError("end_date must not be before start_date.")

        params["timeMin"] = datetime.combine(
            first, time.min, tzinfo=TIMEZONE
        ).isoformat()
        params["timeMax"] = datetime.combine(
            last + timedelta(days=1), time.min, tzinfo=TIMEZONE
        ).isoformat()

    else:
        params["timeMin"] = datetime.now(TIMEZONE).isoformat()

    result = service.events().list(**params).execute()
    events = [
        {
            "id": event["id"],
            "title": event.get("summary", "(No title)"),
            "start": event.get("start", {}).get(
                "dateTime", event.get("start", {}).get("date")
            ),
            "link": event.get("htmlLink"),
        }
        for event in result.get("items", [])
    ]

    return {"count": len(events), "events": events}


@mcp.tool()
def delete_event(event_id: str) -> dict:
    """Delete a Google Calendar event by its exact event ID."""

    service = get_calendar()
    service.events().delete(
        calendarId="primary",
        eventId=event_id,
    ).execute()

    return {"success": True, "deleted_event_id": event_id}


if __name__ == "__main__":
    mcp.run(transport="stdio")
