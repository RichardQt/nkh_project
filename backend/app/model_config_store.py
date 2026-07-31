"""Admin-editable LLM / embedding model configuration (SQLite)."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

import httpx

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "conversations.db"
_LOCK = threading.Lock()
_INITIALIZED = False
_CONFIG_ID = "default"
_MASK = "********"

_DEFAULT_LLM: dict[str, Any] = {
    "baseUrl": "http://njmaas.njdashuju.cn:9080/v1",
    "authorization": "zk283VDdxF.4q94mt3KEH",
    "aiApiCode": "UXdlbjMuNi0zNUItY2VzaGlfMV9sbG0",
    "model": "Qwen3.6-35B-A3B",
    "temperature": 0.7,
    "maxTokens": 4096,
    "enableThinking": False,
}

_DEFAULT_EMBEDDING: dict[str, Any] = {
    "baseUrl": "http://njmaas.njdashuju.cn:9080/v1",
    "authorization": "zk283VDdxF.4q94mt3KEH",
    "aiApiCode": "YmdlLW0zXzFfbGxt",
    "model": "bge-m3",
}

_DEFAULT_EMBEDDING_INPUT = [
    "This is the first sfafasdffffffffff to embed.safafa",
    "This is the second sentence.",
]


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_model_config() -> None:
    """Create table and seed defaults. Safe to call multiple times."""

    global _INITIALIZED
    with _LOCK:
        if _INITIALIZED:
            return
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS model_config (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            row = conn.execute(
                "SELECT id FROM model_config WHERE id = ?",
                (_CONFIG_ID,),
            ).fetchone()
            if row is None:
                payload = {
                    "llm": dict(_DEFAULT_LLM),
                    "embedding": dict(_DEFAULT_EMBEDDING),
                }
                conn.execute(
                    """
                    INSERT INTO model_config (id, payload, updated_at)
                    VALUES (?, ?, datetime('now'))
                    """,
                    (_CONFIG_ID, json.dumps(payload, ensure_ascii=False)),
                )
            conn.commit()
        finally:
            conn.close()
        _INITIALIZED = True


def _load_raw() -> dict[str, Any]:
    init_model_config()
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT payload FROM model_config WHERE id = ?",
                (_CONFIG_ID,),
            ).fetchone()
            if row is None:
                return {
                    "llm": dict(_DEFAULT_LLM),
                    "embedding": dict(_DEFAULT_EMBEDDING),
                }
            data = json.loads(row["payload"])
            if not isinstance(data, dict):
                raise ValueError("invalid payload")
            llm = data.get("llm") if isinstance(data.get("llm"), dict) else {}
            emb = data.get("embedding") if isinstance(data.get("embedding"), dict) else {}
            return {
                "llm": {**_DEFAULT_LLM, **llm},
                "embedding": {**_DEFAULT_EMBEDDING, **emb},
            }
        finally:
            conn.close()


def _mask_section(section: dict[str, Any]) -> dict[str, Any]:
    auth = str(section.get("authorization") or "").strip()
    code = str(section.get("aiApiCode") or "").strip()
    out = dict(section)
    out["authorization"] = _MASK if auth else ""
    out["authorizationConfigured"] = bool(auth)
    out["aiApiCode"] = _MASK if code else ""
    out["aiApiCodeConfigured"] = bool(code)
    return out


def get_model_config_public() -> dict[str, Any]:
    """Return config with secrets masked for admin UI."""

    raw = _load_raw()
    return {
        "llm": _mask_section(raw["llm"]),
        "embedding": _mask_section(raw["embedding"]),
    }


def _is_secret_placeholder(value: Any) -> bool:
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    text = value.strip()
    return text == "" or text == _MASK or set(text) <= {"*"}


def _merge_section(
    existing: dict[str, Any],
    incoming: dict[str, Any],
    *,
    defaults: dict[str, Any],
    kind: str,
) -> dict[str, Any]:
    merged = {**defaults, **existing}

    if "baseUrl" in incoming and isinstance(incoming["baseUrl"], str):
        base = incoming["baseUrl"].strip().rstrip("/")
        if base:
            merged["baseUrl"] = base

    if "model" in incoming and isinstance(incoming["model"], str):
        model = incoming["model"].strip()
        if model:
            merged["model"] = model

    if "authorization" in incoming and not _is_secret_placeholder(incoming["authorization"]):
        merged["authorization"] = str(incoming["authorization"]).strip()

    if "aiApiCode" in incoming and not _is_secret_placeholder(incoming["aiApiCode"]):
        merged["aiApiCode"] = str(incoming["aiApiCode"]).strip()

    if kind == "llm":
        if "temperature" in incoming:
            try:
                temp = float(incoming["temperature"])
                merged["temperature"] = max(0.0, min(2.0, temp))
            except (TypeError, ValueError):
                pass
        if "maxTokens" in incoming:
            try:
                tokens = int(incoming["maxTokens"])
                merged["maxTokens"] = max(1, min(128000, tokens))
            except (TypeError, ValueError):
                pass
        if "enableThinking" in incoming:
            merged["enableThinking"] = bool(incoming["enableThinking"])

    return merged


def save_model_config(body: dict[str, Any]) -> dict[str, Any]:
    """Merge and persist config. Empty/masked secrets keep previous values."""

    if not isinstance(body, dict):
        raise ValueError("请求体必须是 JSON 对象")

    current = _load_raw()
    llm_in = body.get("llm") if isinstance(body.get("llm"), dict) else {}
    emb_in = body.get("embedding") if isinstance(body.get("embedding"), dict) else {}

    next_payload = {
        "llm": _merge_section(current["llm"], llm_in, defaults=_DEFAULT_LLM, kind="llm"),
        "embedding": _merge_section(
            current["embedding"],
            emb_in,
            defaults=_DEFAULT_EMBEDDING,
            kind="embedding",
        ),
    }

    with _LOCK:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO model_config (id, payload, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                """,
                (_CONFIG_ID, json.dumps(next_payload, ensure_ascii=False)),
            )
            conn.commit()
        finally:
            conn.close()

    return get_model_config_public()


def _build_headers(section: dict[str, Any]) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    auth = str(section.get("authorization") or "").strip()
    code = str(section.get("aiApiCode") or "").strip()
    if auth:
        headers["Authorization"] = auth
    if code:
        headers["AI-API-CODE"] = code
    return headers


async def test_model_config(kind: str) -> dict[str, Any]:
    """Probe LLM chat/completions or embedding endpoint with saved config."""

    if kind not in ("llm", "embedding"):
        raise ValueError("kind 必须是 llm 或 embedding")

    raw = _load_raw()
    section = raw["llm"] if kind == "llm" else raw["embedding"]
    base = str(section.get("baseUrl") or "").strip().rstrip("/")
    model = str(section.get("model") or "").strip()
    if not base:
        return {"ok": False, "message": "未配置服务地址"}
    if not model:
        return {"ok": False, "message": "未配置模型名称"}

    headers = _build_headers(section)
    started = time.perf_counter()

    if kind == "llm":
        url = f"{base}/chat/completions"
        temperature = float(section.get("temperature") or 0.7)
        max_tokens = int(section.get("maxTokens") or 4096)
        enable_thinking = bool(section.get("enableThinking"))
        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": "你是什么模型"}],
            "max_tokens": max_tokens,
            "stream": False,
            "temperature": temperature,
            "chat_template_kwargs": {
                "enable_thinking": enable_thinking,
                "preserve_thinking": False,
            },
        }
    else:
        url = f"{base}/embeddings"
        payload = {
            "model": model,
            "input": list(_DEFAULT_EMBEDDING_INPUT),
        }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
        latency_ms = int((time.perf_counter() - started) * 1000)
        if response.status_code >= 400:
            detail = response.text[:240].strip() or f"HTTP {response.status_code}"
            return {
                "ok": False,
                "message": f"上游返回 {response.status_code}: {detail}",
                "latencyMs": latency_ms,
            }
        try:
            data = response.json()
        except Exception:
            return {
                "ok": False,
                "message": "上游响应不是有效 JSON",
                "latencyMs": latency_ms,
            }

        if kind == "llm":
            choices = data.get("choices") if isinstance(data, dict) else None
            if not isinstance(choices, list) or not choices:
                return {
                    "ok": False,
                    "message": "连通成功但响应缺少 choices",
                    "latencyMs": latency_ms,
                }
        else:
            items = data.get("data") if isinstance(data, dict) else None
            if not isinstance(items, list) or not items:
                return {
                    "ok": False,
                    "message": "连通成功但响应缺少 embedding data",
                    "latencyMs": latency_ms,
                }

        label = "大语言模型" if kind == "llm" else "Embedding 模型"
        return {
            "ok": True,
            "message": f"{label}连通成功",
            "latencyMs": latency_ms,
        }
    except httpx.TimeoutException:
        return {"ok": False, "message": "请求超时（30s）"}
    except httpx.ConnectError as exc:
        return {"ok": False, "message": f"无法连接上游: {exc}"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": f"测试失败: {exc}"}
