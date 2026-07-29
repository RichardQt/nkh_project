"""Lightweight auth: users + opaque sessions in SQLite (no JWT)."""

from __future__ import annotations

import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import bcrypt

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "conversations.db"
_LOCK = threading.Lock()
_INITIALIZED = False

_SESSION_DAYS = 7
_SEED_PASSWORD = "nkh@2026"
_SEED_USERS: tuple[tuple[str, str], ...] = (
    ("admin", "admin"),
    ("test0", "user"),
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("ascii"),
        )
    except (ValueError, TypeError):
        return False


def _row_to_user(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
    }


def init_auth() -> None:
    """Create auth tables and seed demo users. Safe to call multiple times."""

    global _INITIALIZED
    with _LOCK:
        if _INITIALIZED:
            return
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sessions_user
                ON sessions (user_id)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sessions_expires
                ON sessions (expires_at)
                """
            )

            now = _utc_now_iso()
            password_hash = _hash_password(_SEED_PASSWORD)
            for username, role in _SEED_USERS:
                existing = conn.execute(
                    "SELECT id FROM users WHERE username = ?",
                    (username,),
                ).fetchone()
                if existing is None:
                    conn.execute(
                        """
                        INSERT INTO users (id, username, password_hash, role, created_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (str(uuid.uuid4()), username, password_hash, role, now),
                    )

            conn.commit()
            _INITIALIZED = True
        finally:
            conn.close()


def get_user_by_username(username: str) -> dict[str, Any] | None:
    init_auth()
    cleaned = username.strip()
    if not cleaned:
        return None
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT id, username, role FROM users WHERE username = ?",
                (cleaned,),
            ).fetchone()
            return _row_to_user(row) if row else None
        finally:
            conn.close()


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    init_auth()
    if not user_id:
        return None
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT id, username, role FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            return _row_to_user(row) if row else None
        finally:
            conn.close()


def authenticate(username: str, password: str) -> dict[str, Any] | None:
    """Verify credentials. Returns public user dict or None."""

    init_auth()
    cleaned = (username or "").strip()
    if not cleaned or not isinstance(password, str) or not password:
        return None

    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                """
                SELECT id, username, role, password_hash
                FROM users WHERE username = ?
                """,
                (cleaned,),
            ).fetchone()
            if row is None:
                return None
            if not _verify_password(password, row["password_hash"]):
                return None
            return _row_to_user(row)
        finally:
            conn.close()


def create_session(user_id: str) -> str:
    init_auth()
    token = secrets.token_urlsafe(32)
    now = _utc_now()
    expires = now + timedelta(days=_SESSION_DAYS)
    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO sessions (token, user_id, expires_at, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (token, user_id, expires.isoformat(), now.isoformat()),
            )
            conn.commit()
            return token
        finally:
            conn.close()


def get_user_by_token(token: str) -> dict[str, Any] | None:
    init_auth()
    if not token or not token.strip():
        return None
    token = token.strip()
    now = _utc_now()

    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                """
                SELECT s.token, s.user_id, s.expires_at,
                       u.id AS uid, u.username, u.role
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = ?
                """,
                (token,),
            ).fetchone()
            if row is None:
                return None

            try:
                expires = datetime.fromisoformat(row["expires_at"])
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
                return None

            if expires <= now:
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
                return None

            return {
                "id": row["uid"],
                "username": row["username"],
                "role": row["role"],
            }
        finally:
            conn.close()


def delete_session(token: str) -> None:
    init_auth()
    if not token:
        return
    with _LOCK:
        conn = _connect()
        try:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token.strip(),))
            conn.commit()
        finally:
            conn.close()
