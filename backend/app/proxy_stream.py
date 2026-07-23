"""SSE proxy: Backend A ←→ Backend B.

Upstream (B) events of interest:
  - event: token            data: {"content": "..."}     → thinking chain
  - event: related_entries  data: {"achievements": [...]} → list (field-projected)

Downstream (A → frontend) events:
  - meta, token, related_entries, done, error
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
import httpx
from fastapi import Request

from app.config import BACKEND_B_API_KEY, BACKEND_B_BASE_URL, BACKEND_B_STREAM_PATH
from app.field_schema import project_related_entries, selected_fields


def sse(event: str, payload: dict[str, Any]) -> str:
    """Serialize one Server-Sent Event with UTF-8 Chinese intact."""

    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"


def _build_upstream_url() -> str:
    """Base path for Backend B stream (params go in POST JSON body)."""

    return f"{BACKEND_B_BASE_URL}{BACKEND_B_STREAM_PATH}"


async def stream_from_backend_b(
    *,
    query: str,
    session_id: str,
    function: str,
    request: Request,
) -> AsyncIterator[str]:
    """Proxy Backend B SSE (POST JSON body), projecting related_entries fields.

    Upstream call shape::

        POST {base}/api/chat/stream
        Content-Type: application/json
        Accept: text/event-stream
        {"query": "...", "session_id": "1", "function": "achievements"}
    """

    fields = selected_fields(function)
    yield sse(
        "meta",
        {
            "sessionId": session_id,
            "function": function,
            "fields": fields,
            "upstream": BACKEND_B_BASE_URL,
        },
    )

    url = _build_upstream_url()
    # Backend B (FastAPI) expects required fields in the JSON body, not query string.
    body = {
        "query": query,
        "session_id": session_id,
        "function": function,
    }
    headers: dict[str, str] = {
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }
    if BACKEND_B_API_KEY:
        headers["Authorization"] = f"Bearer {BACKEND_B_API_KEY}"

    timeout = httpx.Timeout(connect=20.0, read=300.0, write=30.0, pool=20.0)
    saw_done = False
    emitted_token = False
    emitted_entries = False

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json=body,
            ) as response:
                if response.status_code >= 400:
                    err_text = (await response.aread()).decode("utf-8", errors="replace")
                    detail = err_text[:500] if err_text else f"HTTP {response.status_code}"
                    yield sse(
                        "error",
                        {
                            "message": (
                                f"上游服务暂时不可用（{response.status_code}）。"
                                f"详情：{detail}"
                            ),
                        },
                    )
                    yield sse("done", {"finishReason": "error"})
                    return

                event_name = "message"
                data_lines: list[str] = []

                async for line in response.aiter_lines():
                    if await request.is_disconnected():
                        return

                    if line is None:
                        continue

                    # SSE comment / keepalive
                    if line.startswith(":"):
                        continue

                    if not line:
                        # blank line → dispatch one event
                        if data_lines:
                            raw_data = "\n".join(data_lines)
                            async for frame in _handle_upstream_event(
                                event_name,
                                raw_data,
                                function=function,
                            ):
                                if frame.startswith("event: token"):
                                    emitted_token = True
                                if frame.startswith("event: related_entries"):
                                    emitted_entries = True
                                if frame.startswith("event: done"):
                                    saw_done = True
                                yield frame
                        event_name = "message"
                        data_lines = []
                        continue

                    if line.startswith("event:"):
                        event_name = line[6:].strip() or "message"
                        continue

                    if line.startswith("data:"):
                        data_lines.append(line[5:].lstrip())
                        continue

                # flush trailing event without trailing blank line
                if data_lines:
                    raw_data = "\n".join(data_lines)
                    async for frame in _handle_upstream_event(
                        event_name,
                        raw_data,
                        function=function,
                    ):
                        if frame.startswith("event: token"):
                            emitted_token = True
                        if frame.startswith("event: related_entries"):
                            emitted_entries = True
                        if frame.startswith("event: done"):
                            saw_done = True
                        yield frame

    except httpx.TimeoutException:
        yield sse("error", {"message": "上游服务响应超时，请稍后重试。"})
        yield sse("done", {"finishReason": "error"})
        return
    except httpx.HTTPError as exc:
        yield sse(
            "error",
            {
                "message": (
                    f"无法连接上游服务（{exc.__class__.__name__}）。"
                    f"请确认 {BACKEND_B_BASE_URL} 可达。"
                ),
            },
        )
        yield sse("done", {"finishReason": "error"})
        return

    if not saw_done:
        if not emitted_token and not emitted_entries:
            yield sse(
                "error",
                {"message": "上游服务没有返回可用内容，请换一种表述后再试。"},
            )
            yield sse("done", {"finishReason": "error"})
        else:
            yield sse("done", {"finishReason": "stop"})


async def _handle_upstream_event(
    event_name: str,
    raw_data: str,
    *,
    function: str,
) -> AsyncIterator[str]:
    """Map one upstream SSE event to zero or more downstream frames."""

    name = (event_name or "message").strip().lower()

    if name in ("done", "end", "complete"):
        finish = "stop"
        try:
            parsed = json.loads(raw_data) if raw_data else {}
            if isinstance(parsed, dict) and parsed.get("finishReason"):
                finish = str(parsed["finishReason"])
        except json.JSONDecodeError:
            pass
        yield sse("done", {"finishReason": finish})
        return

    if name in ("error", "fail"):
        message = raw_data or "上游服务返回错误"
        try:
            parsed = json.loads(raw_data) if raw_data else {}
            if isinstance(parsed, dict):
                message = str(
                    parsed.get("message")
                    or parsed.get("detail")
                    or parsed.get("error")
                    or message
                )
        except json.JSONDecodeError:
            pass
        yield sse("error", {"message": message})
        return

    # Thinking chain tokens from Backend B
    if name in ("token", "tokens", "thinking", "think"):
        content = _extract_content(raw_data)
        if content:
            yield sse("token", {"content": content})
        return

    # Legacy delta text (sample B / other gateways) → treat as thinking
    if name in ("delta", "message", "answer"):
        content = _extract_content(raw_data)
        if content:
            yield sse("token", {"content": content})
        return

    if name in ("related_entries", "related", "business", "entries"):
        try:
            parsed = json.loads(raw_data) if raw_data else {}
        except json.JSONDecodeError:
            yield sse(
                "error",
                {"message": "上游 related_entries 数据无法解析。"},
            )
            return

        if not isinstance(parsed, dict):
            yield sse(
                "error",
                {"message": "上游 related_entries 格式不正确。"},
            )
            return

        projected = project_related_entries(function, parsed)
        yield sse("related_entries", projected)
        return

    # Ignore meta/ping/other upstream noise
    return


def _extract_content(raw_data: str) -> str:
    if not raw_data:
        return ""
    if raw_data == "[DONE]":
        return ""
    try:
        parsed = json.loads(raw_data)
    except json.JSONDecodeError:
        return raw_data

    if isinstance(parsed, str):
        return parsed
    if not isinstance(parsed, dict):
        return ""

    content = parsed.get("content")
    if isinstance(content, str):
        return content

    # nested delta shapes
    delta = parsed.get("delta")
    if isinstance(delta, dict):
        nested = delta.get("content")
        if isinstance(nested, str):
            return nested

    text = parsed.get("text")
    if isinstance(text, str):
        return text

    return ""
