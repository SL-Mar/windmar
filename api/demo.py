"""
Demo mode guards for WINDMAR API.

Provides FastAPI dependencies and helpers that block or stub endpoints
when DEMO_MODE=true.
"""

from fastapi import HTTPException
from api.config import settings


def require_not_demo(feature_name: str = "This feature"):
    """FastAPI Depends() guard that raises 403 in demo mode."""

    def _guard():
        if settings.demo_mode:
            raise HTTPException(
                status_code=403, detail=f"{feature_name} is disabled in demo mode."
            )

    return _guard


def demo_mode_response(feature_name: str = "This feature"):
    """Return a 200 JSON stub for non-critical endpoints in demo mode."""
    return {
        "status": "demo",
        "message": f"{feature_name} is disabled in demo mode. "
        "Pre-loaded weather data is served from the database snapshot.",
    }


def is_demo() -> bool:
    """Check if demo mode is active."""
    return settings.demo_mode
