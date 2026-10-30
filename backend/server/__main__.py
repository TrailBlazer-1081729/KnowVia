"""Run the FastAPI application with the original development settings."""

import uvicorn

uvicorn.run("backend.server:app", host="127.0.0.1", port=8000, reload=True)
