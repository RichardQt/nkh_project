"""SQLite persistence for chat conversations.

Stores full bubble payloads (user questions + assistant answers including
thought chain, related entries, turns, scene results, etc.) as JSON.
Title is the first user question in the conversation.
Rows are scoped by ``user_id`` after auth migration.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "conversations.db"
_LOCK = threading.Lock()
_INITIALIZED = False


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {str(row["name"]) for row in rows}


def init_db() -> None:
    """Create tables if missing and ensure user_id column. Safe to call multiple times."""

    global _INITIALIZED
    with _LOCK:
        if _INITIALIZED:
            return
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    agent_key TEXT,
                    session_id TEXT NOT NULL DEFAULT '',
                    messages_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    user_id TEXT
                )
                """
            )
            columns = _table_columns(conn, "conversations")
            if "user_id" not in columns:
                conn.execute(
                    "ALTER TABLE conversations ADD COLUMN user_id TEXT"
                )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversations_updated
                ON conversations (updated_at DESC)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversations_created
                ON conversations (created_at DESC)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversations_user_created
                ON conversations (user_id, created_at DESC)
                """
            )
            conn.commit()
            _INITIALIZED = True
        finally:
            conn.close()


def migrate_orphan_conversations(admin_user_id: str) -> None:
    """Assign legacy rows without user_id to the admin account."""

    if not admin_user_id:
        return
    init_db()
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """
                UPDATE conversations
                SET user_id = ?
                WHERE user_id IS NULL OR user_id = ''
                """,
                (admin_user_id,),
            )
            conn.commit()
        finally:
            conn.close()


def _row_to_summary(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "agentKey": row["agent_key"],
        "sessionId": row["session_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_detail(row: sqlite3.Row) -> dict[str, Any]:
    raw = row["messages_json"] or "[]"
    try:
        messages = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        messages = []
    if not isinstance(messages, list):
        messages = []

    return {
        **_row_to_summary(row),
        "messages": messages,
    }


def list_conversations(user_id: str, limit: int = 200) -> list[dict[str, Any]]:
    init_db()
    limit = max(1, min(int(limit), 500))
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                """
                SELECT id, title, agent_key, session_id, created_at, updated_at
                FROM conversations
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
            return [_row_to_summary(row) for row in rows]
        finally:
            conn.close()


def get_conversation(
    conversation_id: str, user_id: str
) -> dict[str, Any] | None:
    init_db()
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                """
                SELECT id, title, agent_key, session_id, messages_json,
                       created_at, updated_at
                FROM conversations
                WHERE id = ? AND user_id = ?
                """,
                (conversation_id, user_id),
            ).fetchone()
            if row is None:
                return None
            return _row_to_detail(row)
        finally:
            conn.close()


def _extract_title_from_messages(messages: list[Any], fallback: str) -> str:
    """Title = first user question content."""

    for item in messages:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        kind = item.get("kind")
        content = item.get("content")
        if role == "user" or kind == "question":
            if isinstance(content, str) and content.strip():
                return content.strip()[:200]
        source = item.get("sourceQuestion")
        if isinstance(source, str) and source.strip():
            return source.strip()[:200]
    if fallback.strip():
        return fallback.strip()[:200]
    return "未命名对话"


def upsert_conversation(
    payload: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Create or fully replace a conversation snapshot for ``user_id``.

    Expected keys:
      id (optional on create), title (optional), agentKey, sessionId, messages
    Title defaults to the first user question in ``messages``.
    """

    init_db()
    if not user_id:
        raise ValueError("user_id 不能为空")

    messages = payload.get("messages")
    if not isinstance(messages, list):
        raise ValueError("messages 必须是数组")

    conversation_id = payload.get("id")
    if not isinstance(conversation_id, str) or not conversation_id.strip():
        conversation_id = str(uuid.uuid4())
    else:
        conversation_id = conversation_id.strip()
    if len(conversation_id) > 128:
        raise ValueError("id 过长")

    raw_title = payload.get("title")
    title_hint = raw_title if isinstance(raw_title, str) else ""
    title = _extract_title_from_messages(messages, title_hint)

    agent_key = payload.get("agentKey")
    if agent_key is not None and not isinstance(agent_key, str):
        agent_key = str(agent_key)
    if isinstance(agent_key, str) and not agent_key.strip():
        agent_key = None
    if isinstance(agent_key, str) and len(agent_key) > 64:
        raise ValueError("agentKey 过长")

    session_id = payload.get("sessionId")
    if session_id is None:
        session_id = payload.get("session_id")
    if session_id is None:
        session_id = ""
    session_id = str(session_id)
    if len(session_id) > 128:
        raise ValueError("sessionId 过长")

    try:
        messages_json = json.dumps(messages, ensure_ascii=False)
    except (TypeError, ValueError) as exc:
        raise ValueError("messages 无法序列化为 JSON") from exc

    now = _utc_now()

    with _LOCK:
        conn = _connect()
        try:
            existing = conn.execute(
                """
                SELECT id, title, created_at, user_id
                FROM conversations WHERE id = ?
                """,
                (conversation_id,),
            ).fetchone()

            if existing is None:
                conn.execute(
                    """
                    INSERT INTO conversations (
                        id, title, agent_key, session_id, messages_json,
                        created_at, updated_at, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        conversation_id,
                        title,
                        agent_key,
                        session_id,
                        messages_json,
                        now,
                        now,
                        user_id,
                    ),
                )
            else:
                owner = existing["user_id"]
                if owner and owner != user_id:
                    raise PermissionError("无权修改该对话")
                # Keep original title once set from first question;
                # only replace if previous was empty/placeholder.
                prev_title = (existing["title"] or "").strip()
                if prev_title and prev_title != "未命名对话":
                    title = prev_title
                conn.execute(
                    """
                    UPDATE conversations
                    SET title = ?,
                        agent_key = ?,
                        session_id = ?,
                        messages_json = ?,
                        updated_at = ?,
                        user_id = ?
                    WHERE id = ?
                    """,
                    (
                        title,
                        agent_key,
                        session_id,
                        messages_json,
                        now,
                        user_id,
                        conversation_id,
                    ),
                )

            conn.commit()
            row = conn.execute(
                """
                SELECT id, title, agent_key, session_id, messages_json,
                       created_at, updated_at
                FROM conversations
                WHERE id = ? AND user_id = ?
                """,
                (conversation_id, user_id),
            ).fetchone()
            assert row is not None
            return _row_to_detail(row)
        finally:
            conn.close()


def rename_conversation(
    conversation_id: str, title: str, user_id: str
) -> dict[str, Any] | None:
    """Update conversation title only. Returns summary or None if missing."""

    init_db()
    cleaned = title.strip()
    if not cleaned:
        raise ValueError("标题不能为空")
    if len(cleaned) > 200:
        raise ValueError("标题长度不能超过 200 个字符")

    now = _utc_now()
    with _LOCK:
        conn = _connect()
        try:
            existing = conn.execute(
                """
                SELECT id FROM conversations
                WHERE id = ? AND user_id = ?
                """,
                (conversation_id, user_id),
            ).fetchone()
            if existing is None:
                return None

            conn.execute(
                """
                UPDATE conversations
                SET title = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (cleaned, now, conversation_id, user_id),
            )
            conn.commit()
            row = conn.execute(
                """
                SELECT id, title, agent_key, session_id, created_at, updated_at
                FROM conversations
                WHERE id = ? AND user_id = ?
                """,
                (conversation_id, user_id),
            ).fetchone()
            assert row is not None
            return _row_to_summary(row)
        finally:
            conn.close()


def delete_conversation(conversation_id: str, user_id: str) -> bool:
    init_db()
    with _LOCK:
        conn = _connect()
        try:
            cur = conn.execute(
                "DELETE FROM conversations WHERE id = ? AND user_id = ?",
                (conversation_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()
