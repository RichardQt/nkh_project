"""SQLite persistence for per-user persona / memory profiles."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "conversations.db"
_LOCK = threading.Lock()
_INITIALIZED = False

_VALID_ROLE_TYPES = frozenset({"university", "enterprise", "tech_manager", ""})
_MAX_NEEDS = 4000
_MAX_MEMORY = 4000
_MAX_FOCUS_ITEMS = 30
_MAX_FOCUS_LEN = 40
_MAX_SCENE_ITEMS = 20
_MAX_SCENE_LEN = 64


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_user_profiles() -> None:
    """Create user_profiles table. Safe to call multiple times."""

    global _INITIALIZED
    with _LOCK:
        if _INITIALIZED:
            return
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    role_type TEXT NOT NULL DEFAULT '',
                    needs TEXT NOT NULL DEFAULT '',
                    focus_areas TEXT NOT NULL DEFAULT '[]',
                    preferred_scenes TEXT NOT NULL DEFAULT '[]',
                    memory_notes TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()
            _INITIALIZED = True
        finally:
            conn.close()


def _parse_string_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(data, list):
        return []
    result: list[str] = []
    for item in data:
        if isinstance(item, str):
            text = item.strip()
            if text:
                result.append(text)
    return result


def _empty_profile(user_id: str) -> dict[str, Any]:
    return {
        "userId": user_id,
        "roleType": "",
        "needs": "",
        "focusAreas": [],
        "preferredScenes": [],
        "memoryNotes": "",
        "updatedAt": "",
    }


def _row_to_profile(row: sqlite3.Row) -> dict[str, Any]:
    role_type = str(row["role_type"] or "")
    if role_type not in _VALID_ROLE_TYPES:
        role_type = ""
    return {
        "userId": str(row["user_id"]),
        "roleType": role_type,
        "needs": str(row["needs"] or ""),
        "focusAreas": _parse_string_list(row["focus_areas"]),
        "preferredScenes": _parse_string_list(row["preferred_scenes"]),
        "memoryNotes": str(row["memory_notes"] or ""),
        "updatedAt": str(row["updated_at"] or ""),
    }


def get_user_profile(user_id: str) -> dict[str, Any]:
    """Return profile for user_id, or an empty default if missing."""

    if not user_id:
        raise ValueError("user_id 不能为空")
    init_user_profiles()
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                """
                SELECT user_id, role_type, needs, focus_areas,
                       preferred_scenes, memory_notes, updated_at
                FROM user_profiles
                WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
            if row is None:
                return _empty_profile(user_id)
            return _row_to_profile(row)
        finally:
            conn.close()


def _normalize_string_list(
    value: Any,
    *,
    max_items: int,
    max_len: int,
    field_name: str,
) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(f"{field_name} 必须是字符串数组")
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise ValueError(f"{field_name} 必须是字符串数组")
        text = item.strip()
        if not text:
            continue
        if len(text) > max_len:
            raise ValueError(f"{field_name} 单项不能超过 {max_len} 个字符")
        if text in seen:
            continue
        seen.add(text)
        result.append(text)
        if len(result) > max_items:
            raise ValueError(f"{field_name} 最多 {max_items} 项")
    return result


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    role_type = payload.get("roleType", payload.get("role_type", ""))
    if role_type is None:
        role_type = ""
    if not isinstance(role_type, str):
        raise ValueError("roleType 必须是字符串")
    role_type = role_type.strip()
    if role_type not in _VALID_ROLE_TYPES:
        raise ValueError("roleType 无效，可选：university / enterprise / tech_manager")

    needs = payload.get("needs", "")
    if needs is None:
        needs = ""
    if not isinstance(needs, str):
        raise ValueError("needs 必须是字符串")
    needs = needs.strip()
    if len(needs) > _MAX_NEEDS:
        raise ValueError(f"needs 不能超过 {_MAX_NEEDS} 个字符")

    memory_notes = payload.get("memoryNotes", payload.get("memory_notes", ""))
    if memory_notes is None:
        memory_notes = ""
    if not isinstance(memory_notes, str):
        raise ValueError("memoryNotes 必须是字符串")
    memory_notes = memory_notes.strip()
    if len(memory_notes) > _MAX_MEMORY:
        raise ValueError(f"memoryNotes 不能超过 {_MAX_MEMORY} 个字符")

    focus_raw = payload.get("focusAreas", payload.get("focus_areas", []))
    focus_areas = _normalize_string_list(
        focus_raw,
        max_items=_MAX_FOCUS_ITEMS,
        max_len=_MAX_FOCUS_LEN,
        field_name="focusAreas",
    )

    scenes_raw = payload.get("preferredScenes", payload.get("preferred_scenes", []))
    preferred_scenes = _normalize_string_list(
        scenes_raw,
        max_items=_MAX_SCENE_ITEMS,
        max_len=_MAX_SCENE_LEN,
        field_name="preferredScenes",
    )

    return {
        "role_type": role_type,
        "needs": needs,
        "focus_areas": focus_areas,
        "preferred_scenes": preferred_scenes,
        "memory_notes": memory_notes,
    }


def upsert_user_profile(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create or replace the profile for user_id."""

    if not user_id:
        raise ValueError("user_id 不能为空")
    if not isinstance(payload, dict):
        raise ValueError("请求体必须是 JSON 对象")

    normalized = _normalize_payload(payload)
    now = _utc_now()
    init_user_profiles()

    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO user_profiles (
                    user_id, role_type, needs, focus_areas,
                    preferred_scenes, memory_notes, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    role_type = excluded.role_type,
                    needs = excluded.needs,
                    focus_areas = excluded.focus_areas,
                    preferred_scenes = excluded.preferred_scenes,
                    memory_notes = excluded.memory_notes,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id,
                    normalized["role_type"],
                    normalized["needs"],
                    json.dumps(normalized["focus_areas"], ensure_ascii=False),
                    json.dumps(normalized["preferred_scenes"], ensure_ascii=False),
                    normalized["memory_notes"],
                    now,
                ),
            )
            conn.commit()
            row = conn.execute(
                """
                SELECT user_id, role_type, needs, focus_areas,
                       preferred_scenes, memory_notes, updated_at
                FROM user_profiles
                WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
            if row is None:
                return _empty_profile(user_id)
            return _row_to_profile(row)
        finally:
            conn.close()
