"""Admin-editable LLM / embedding / rerank model configuration (SQLite)."""

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

_DEFAULT_LLM: dict[str, Any] = {
    "channelName": "大语言模型配置1",
    "baseUrl": "http://njmaas.njdashuju.cn:9080/v1",
    "authorization": "zk283VDdxF.4q94mt3KEH",
    "aiApiCode": "UXdlbjMuNi0zNUItY2VzaGlfMV9sbG0",
    "model": "Qwen3.6-35B-A3B",
    "temperature": 0.7,
    "maxTokens": 4096,
    "enableThinking": False,
}

_DEFAULT_LLM2: dict[str, Any] = {
    "channelName": "大语言模型配置2",
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

_DEFAULT_RERANK: dict[str, Any] = {
    "baseUrl": "http://njmaas.njdashuju.cn:9080/rerank",
    "authorization": "zk283VDdxF.4q94mt3KEH",
    "aiApiCode": "YmdlLXJlcmFua2VyLXYyLW0zXzFfbGxt",
    "model": "bge-reranker-v2-m3",
}

_DEFAULT_EMBEDDING_INPUT = [
    "This is the first sfafasdffffffffff to embed.safafa",
    "This is the second sentence.",
]

_SECTION_DEFAULTS: dict[str, dict[str, Any]] = {
    "llm": _DEFAULT_LLM,
    "llm2": _DEFAULT_LLM2,
    "embedding": _DEFAULT_EMBEDDING,
    "rerank": _DEFAULT_RERANK,
}

_VALID_KINDS = frozenset(_SECTION_DEFAULTS.keys())


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _default_payload() -> dict[str, Any]:
    return {key: dict(value) for key, value in _SECTION_DEFAULTS.items()}


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
                conn.execute(
                    """
                    INSERT INTO model_config (id, payload, updated_at)
                    VALUES (?, ?, datetime('now'))
                    """,
                    (_CONFIG_ID, json.dumps(_default_payload(), ensure_ascii=False)),
                )
            conn.commit()
        finally:
            conn.close()
        _INITIALIZED = True


def _normalize_payload(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, defaults in _SECTION_DEFAULTS.items():
        section = data.get(key) if isinstance(data.get(key), dict) else {}
        out[key] = {**defaults, **section}
    return out


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
                return _default_payload()
            data = json.loads(row["payload"])
            if not isinstance(data, dict):
                raise ValueError("invalid payload")
            return _normalize_payload(data)
        finally:
            conn.close()


def get_model_config_public() -> dict[str, Any]:
    """Return full config (plaintext secrets) for the admin UI."""

    return _load_raw()


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

    if "authorization" in incoming and isinstance(incoming["authorization"], str):
        merged["authorization"] = incoming["authorization"].strip()

    if "aiApiCode" in incoming and isinstance(incoming["aiApiCode"], str):
        merged["aiApiCode"] = incoming["aiApiCode"].strip()

    if kind in ("llm", "llm2"):
        if "channelName" in incoming and isinstance(incoming["channelName"], str):
            name = incoming["channelName"].strip()
            merged["channelName"] = name or str(defaults.get("channelName", ""))
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
    """Merge and persist config. All fields saved as submitted."""

    if not isinstance(body, dict):
        raise ValueError("请求体必须是 JSON 对象")

    current = _load_raw()
    next_payload: dict[str, Any] = {}
    for key, defaults in _SECTION_DEFAULTS.items():
        incoming = body.get(key) if isinstance(body.get(key), dict) else {}
        next_payload[key] = _merge_section(
            current[key],
            incoming,
            defaults=defaults,
            kind=key,
        )

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
    """Probe LLM / embedding / rerank endpoint with saved config."""

    if kind not in _VALID_KINDS:
        raise ValueError("kind 必须是 llm、llm2、embedding 或 rerank")

    raw = _load_raw()
    section = raw[kind]
    base = str(section.get("baseUrl") or "").strip().rstrip("/")
    model = str(section.get("model") or "").strip()
    if not base:
        return {"ok": False, "message": "未配置服务地址"}
    if not model:
        return {"ok": False, "message": "未配置模型名称"}

    headers = _build_headers(section)
    started = time.perf_counter()

    if kind in ("llm", "llm2"):
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
    elif kind == "embedding":
        url = f"{base}/embeddings"
        payload = {
            "model": model,
            "input": list(_DEFAULT_EMBEDDING_INPUT),
        }
    else:
        url = base
        payload = {
            "model": model,
            "query": "capital of France",
            "documents": [
                "The capital of Brazil is Brasilia.",
                "The capital of France is Paris.",
            ],
        }

    labels = {
        "llm": str(section.get("channelName") or "").strip() or "大语言模型配置1",
        "llm2": str(section.get("channelName") or "").strip() or "大语言模型配置2",
        "embedding": "Embedding 模型",
        "rerank": "Rerank 模型",
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

        if kind in ("llm", "llm2"):
            choices = data.get("choices") if isinstance(data, dict) else None
            if not isinstance(choices, list) or not choices:
                return {
                    "ok": False,
                    "message": "连通成功但响应缺少 choices",
                    "latencyMs": latency_ms,
                }
        elif kind == "embedding":
            items = data.get("data") if isinstance(data, dict) else None
            if not isinstance(items, list) or not items:
                return {
                    "ok": False,
                    "message": "连通成功但响应缺少 embedding data",
                    "latencyMs": latency_ms,
                }
        else:
            # Rerank APIs vary: results / data / scores
            if not isinstance(data, dict):
                return {
                    "ok": False,
                    "message": "连通成功但响应格式异常",
                    "latencyMs": latency_ms,
                }

        return {
            "ok": True,
            "message": f"{labels[kind]}连通成功",
            "latencyMs": latency_ms,
        }
    except httpx.TimeoutException:
        return {"ok": False, "message": "请求超时（30s）"}
    except httpx.ConnectError as exc:
        return {"ok": False, "message": f"无法连接上游: {exc}"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": f"测试失败: {exc}"}
