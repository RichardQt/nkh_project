"""SSE proxy: Backend A ←→ Backend B.

Upstream (B) events of interest:
  - event: node_start       data: {"node": "..."}          -> workflow start
  - event: node_end         data: {"node": "...", ...}     -> workflow result
  - event: clarify          data: {"question": "..."}      -> clarification
  - event: token            data: {"content": "..."}       -> thinking chain
  - event: final_answer     data: {"content": "..."}       -> answer complete
  - event: related_entries  data: {"achievements": [...]}  -> projected list

Downstream (A -> frontend) events:
  - meta, node_start, node_end, clarify, token, related_entries, done, error
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
import httpx
from fastapi import Request

from app.config import BACKEND_B_API_KEY, BACKEND_B_BASE_URL, BACKEND_B_STREAM_PATH
from app.field_schema import (
    platform_section_keys,
    project_related_entries,
    selected_detail_fields,
    selected_fields,
)


def sse(event: str, payload: dict[str, Any]) -> str:
    """Serialize one Server-Sent Event with UTF-8 Chinese intact."""

    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"


def _build_upstream_url() -> str:
    """Base path for Backend B stream (params go in POST JSON body)."""

    return f"{BACKEND_B_BASE_URL}{BACKEND_B_STREAM_PATH}"


_FAILURE_FINISH_REASONS = {
    "error",
    "fail",
    "failed",
    "abort",
    "aborted",
    "cancel",
    "cancelled",
}


def _parse_json_object(raw_data: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(raw_data) if raw_data else {}
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _finish_reason(raw_data: str) -> str:
    parsed = _parse_json_object(raw_data)
    finish = parsed.get("finishReason") if parsed else None
    return str(finish).strip() if finish else "stop"


def _is_failure_finish_reason(reason: str) -> bool:
    return reason.strip().lower() in _FAILURE_FINISH_REASONS


def _clarification_question(payload: dict[str, Any]) -> str:
    for key in ("question", "clarify_question"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _node_requests_clarification(payload: dict[str, Any]) -> bool:
    node = str(payload.get("node") or "").strip()
    if node == "followup_check":
        is_followup = payload.get("is_followup")
        if isinstance(is_followup, bool):
            return is_followup
        return payload.get("need_clarify") is True
    if node == "clarify":
        return payload.get("need_clarify") is True
    return False


def _has_related_items(function: str, payload: dict[str, Any]) -> bool:
    keys = (
        function,
        "achievements",
        "experts",
        "expert_team",
        "demands",
        "requirements",
        "enterprises",
        "platforms",
        "policies",
        "items",
        "entries",
        "list",
        # platform discovery sub-types (信息匹配.md §1.5)
        *platform_section_keys(),
    )
    return any(key and isinstance(payload.get(key), list) for key in keys)


async def _iter_upstream_events(
    response: httpx.Response,
    request: Request,
) -> AsyncIterator[tuple[str, str]]:
    """Parse SSE frames, including a final frame without a trailing blank line."""

    event_name = "message"
    data_lines: list[str] = []

    async for line in response.aiter_lines():
        if await request.is_disconnected():
            return
        if line is None or line.startswith(":"):
            continue
        if not line:
            if data_lines:
                yield event_name, "\n".join(data_lines)
            event_name = "message"
            data_lines = []
            continue
        if line.startswith("event:"):
            event_name = line[6:].strip() or "message"
            continue
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())

    if data_lines:
        yield event_name, "\n".join(data_lines)


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
    detail_fields = selected_detail_fields(function)
    yield sse(
        "meta",
        {
            "sessionId": session_id,
            "function": function,
            "fields": fields,
            "detailFields": detail_fields,
            "upstream": BACKEND_B_BASE_URL,
        },
    )

    url = _build_upstream_url()
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
    finish_reason = "stop"
    emitted_token = False
    emitted_entries = False
    emitted_error = False
    completed_intent = False
    completed_followup = False
    invalid_workflow = False
    emitted_clarification = False
    saw_final_answer = False
    stop_reading = False

    try:
        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
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

                async for event_name, raw_data in _iter_upstream_events(
                    response,
                    request,
                ):
                    normalized_event = (event_name or "message").strip().lower()
                    if normalized_event in ("final_answer", "final"):
                        saw_final_answer = True
                        if not emitted_token:
                            final_content = _extract_content(raw_data)
                            if final_content:
                                emitted_token = True
                                yield sse("token", {"content": final_content})
                        continue

                    async for frame in _handle_upstream_event(
                        event_name,
                        raw_data,
                        function=function,
                    ):
                        if frame.startswith("event: token"):
                            emitted_token = True
                        elif frame.startswith("event: node_end"):
                            payload = _parse_json_object(raw_data) or {}
                            node = str(payload.get("node") or "").strip()
                            if node == "intent_classify":
                                completed_intent = True
                            elif node == "followup_check":
                                if not completed_intent:
                                    invalid_workflow = True
                                else:
                                    completed_followup = True
                                    if (
                                        _node_requests_clarification(payload)
                                        and _clarification_question(payload)
                                    ):
                                        emitted_clarification = True
                            elif (
                                node == "clarify"
                                and completed_intent
                                and completed_followup
                                and _node_requests_clarification(payload)
                                and _clarification_question(payload)
                            ):
                                emitted_clarification = True
                        elif frame.startswith("event: clarify"):
                            if completed_intent and completed_followup:
                                emitted_clarification = True
                        elif frame.startswith("event: related_entries"):
                            emitted_entries = True
                        elif frame.startswith("event: error"):
                            emitted_error = True
                        elif frame.startswith("event: done"):
                            candidate_reason = _finish_reason(raw_data)
                            if not saw_done or _is_failure_finish_reason(candidate_reason):
                                finish_reason = candidate_reason
                            saw_done = True
                            stop_reading = True
                            continue

                        yield frame

                    if stop_reading:
                        break

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

    if await request.is_disconnected():
        return

    if invalid_workflow:
        if not emitted_error:
            yield sse(
                "error",
                {"message": "上游工作流阶段顺序不完整，请稍后重试。"},
            )
        yield sse("done", {"finishReason": "error"})
        return

    if emitted_error or _is_failure_finish_reason(finish_reason):
        if not emitted_error:
            yield sse("error", {"message": "上游服务未能完成请求，请稍后重试。"})
        yield sse("done", {"finishReason": "error"})
        return

    if not saw_done:
        if saw_final_answer or emitted_clarification or (
            emitted_entries and completed_intent and completed_followup
        ):
            yield sse("done", {"finishReason": "stop"})
        else:
            yield sse("error", {"message": "上游响应流提前结束，请稍后重试。"})
            yield sse("done", {"finishReason": "error"})
        return

    if not (
        emitted_token
        or emitted_entries
        or emitted_clarification
        or saw_final_answer
    ):
        yield sse(
            "error",
            {"message": "上游服务没有返回可用内容，请换一种表述后再试。"},
        )
        yield sse("done", {"finishReason": "error"})
        return

    yield sse("done", {"finishReason": finish_reason})


async def _handle_upstream_event(
    event_name: str,
    raw_data: str,
    *,
    function: str,
) -> AsyncIterator[str]:
    """Map one upstream SSE event to zero or more downstream frames."""

    name = (event_name or "message").strip().lower()

    if name in ("done", "end", "complete"):
        yield sse("done", {"finishReason": _finish_reason(raw_data)})
        return

    if name in ("error", "fail"):
        parsed = _parse_json_object(raw_data)
        message = raw_data or "上游服务返回错误"
        if parsed:
            message = str(
                parsed.get("message")
                or parsed.get("detail")
                or parsed.get("error")
                or message
            )
        yield sse("error", {"message": message})
        return

    if name in ("node_start", "node_end"):
        parsed = _parse_json_object(raw_data)
        if not parsed:
            return
        node = parsed.get("node")
        if not isinstance(node, str) or not node.strip():
            return
        parsed["node"] = node.strip()
        yield sse(name, parsed)
        return

    if name in ("clarify", "clarification"):
        parsed = _parse_json_object(raw_data)
        if not parsed:
            return
        question = _clarification_question(parsed)
        if not question:
            return
        raw_suggestions = parsed.get("suggested_questions")
        if not isinstance(raw_suggestions, list):
            raw_suggestions = parsed.get("suggestedQuestions")
        suggestions = (
            [item.strip() for item in raw_suggestions if isinstance(item, str) and item.strip()]
            if isinstance(raw_suggestions, list)
            else []
        )
        parsed["question"] = question
        parsed["suggested_questions"] = suggestions
        yield sse("clarify", parsed)
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
        parsed = _parse_json_object(raw_data)
        if not parsed:
            yield sse("error", {"message": "上游 related_entries 格式不正确。"})
            return
        if not _has_related_items(function, parsed):
            yield sse("error", {"message": "上游 related_entries 缺少列表字段。"})
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
