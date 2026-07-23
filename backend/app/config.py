"""Runtime configuration for Backend A (proxy + field projection).

All values can be overridden via ``backend/.env``.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env whether started from repo root or backend/
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _env_int(name: str, default: int) -> int:
    raw = _env(name, str(default))
    try:
        return int(raw)
    except ValueError:
        return default


# ---------------------------------------------------------------------------
# Backend B (upstream SSE service)
# ---------------------------------------------------------------------------
# Prefer full base URL; otherwise compose from host + port.
_BACKEND_B_BASE = _env("BACKEND_B_BASE_URL")
if _BACKEND_B_BASE:
    BACKEND_B_BASE_URL = _BACKEND_B_BASE.rstrip("/")
else:
    BACKEND_B_HOST = _env("BACKEND_B_HOST", "192.168.1.111")
    BACKEND_B_PORT = _env_int("BACKEND_B_PORT", 8001)
    BACKEND_B_BASE_URL = f"http://{BACKEND_B_HOST}:{BACKEND_B_PORT}"

# Path on Backend B for chat SSE (POST JSON: query / session_id / function).
BACKEND_B_STREAM_PATH = _env("BACKEND_B_STREAM_PATH", "/api/chat/stream")

# Optional shared headers (e.g. Authorization) for Backend B.
BACKEND_B_API_KEY = _env("BACKEND_B_API_KEY")

# ---------------------------------------------------------------------------
# Optional legacy LLM (general fallback only)
# ---------------------------------------------------------------------------
LLM_BASE_URL = _env("LLM_BASE_URL", "http://101.226.11.38:25000/v1").rstrip("/")
LLM_API_KEY = _env("LLM_API_KEY")
LLM_MODEL = _env("LLM_MODEL", "Qwen/Qwen3.6-35B-A3B")

# ---------------------------------------------------------------------------
# Display field projection (comma-separated keys)
# Empty / unset → use defaults from field_schema module.
# Example: ACHIEVEMENT_DISPLAY_FIELDS=serial_no,achievement_name
# ---------------------------------------------------------------------------
ACHIEVEMENT_DISPLAY_FIELDS_RAW = _env("ACHIEVEMENT_DISPLAY_FIELDS")
EXPERT_DISPLAY_FIELDS_RAW = _env("EXPERT_DISPLAY_FIELDS")
DEMAND_DISPLAY_FIELDS_RAW = _env("DEMAND_DISPLAY_FIELDS")
ENTERPRISE_DISPLAY_FIELDS_RAW = _env("ENTERPRISE_DISPLAY_FIELDS")
PLATFORM_DISPLAY_FIELDS_RAW = _env("PLATFORM_DISPLAY_FIELDS")
POLICY_DISPLAY_FIELDS_RAW = _env("POLICY_DISPLAY_FIELDS")


def parse_field_list(raw: str) -> list[str] | None:
    """Parse comma-separated field keys; return None if empty (use defaults)."""

    if not raw:
        return None
    keys = [part.strip() for part in raw.split(",") if part.strip()]
    return keys or None
