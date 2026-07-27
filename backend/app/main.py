"""FastAPI Backend A — SSE proxy in front of Backend B.

Flow:
  Frontend → POST /api/chat/stream
           → Backend A projects config fields and proxies SSE
           → POST Backend B /api/chat/stream  JSON body: query/session_id/function

SSE protocol:
  Backend B: intent_classify → followup_check → token* → final_answer
             → optional related_entries → EOF
  Frontend:  meta → node_start / node_end → token*
             → optional related_entries → done
  Clarify:   node_start / node_end → clarify → done

``intent_classify`` maps ``achievements`` / ``requirements`` /
``expert_team`` / ``enterprises`` to the four supported user intents.
``followup_check.is_followup == false`` advances directly to token streaming.
A later explicit ``clarify`` node/event can override that decision.

Start from ``backend/``::

    python app/main.py
    python -m app.main
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

# Allow ``python app/main.py`` (script mode has no parent package).
if __package__ in (None, ""):
    _backend_root = Path(__file__).resolve().parent.parent
    _root = str(_backend_root)
    if _root not in sys.path:
        sys.path.insert(0, _root)

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import BACKEND_B_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from app.field_schema import (
    ACHIEVEMENT_FIELD_CATALOG,
    AGENT_FUNCTION_MAP,
    resolve_function,
    selected_detail_fields,
    selected_fields,
)
from app.proxy_stream import stream_from_backend_b

app = FastAPI(
    title="AI Innovation Assistant API (Backend A)",
    version="0.3.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

_SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@app.get("/api/health")
async def health() -> dict[str, Any]:
    """Readiness plus upstream / model configuration flags."""

    return {
        "status": "ok",
        "backendB": BACKEND_B_BASE_URL,
        "modelConfigured": bool(LLM_API_KEY and LLM_BASE_URL),
        "model": LLM_MODEL,
    }


@app.get("/api/functions")
async def list_functions() -> dict[str, Any]:
    """Expose agent→function map and current field projection (for admin/debug)."""

    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for _agent_key, fn in AGENT_FUNCTION_MAP.items():
        if fn in seen:
            continue
        seen.add(fn)
        result.append(
            {
                "function": fn,
                "agentKeys": [k for k, v in AGENT_FUNCTION_MAP.items() if v == fn],
                "fields": selected_fields(fn),
                "detailFields": selected_detail_fields(fn),
            }
        )

    return {
        "backendB": BACKEND_B_BASE_URL,
        "functions": result,
        "achievementFieldCatalog": [
            {"key": f.key, "label": f.label} for f in ACHIEVEMENT_FIELD_CATALOG
        ],
    }


@app.post("/api/chat/stream")
async def stream_chat(request: Request) -> StreamingResponse:
    """Stream thinking tokens + projected related entries via SSE.

    Accepts either frontend body or the same body as Backend B::

        # 前端
        {"message": "...", "agentKey": "achievement_discover", "sessionId": "1"}

        # 与上游一致（直接透传字段）
        {
          "query": "自凝胶止血粉的完成人是谁",
          "session_id": "1",
          "function": "achievements"
        }

    Downstream events: ``meta``, ``node_start``, ``node_end``, optional
    ``clarify``, repeated ``token``, ``related_entries``, ``done``
    (and optional ``error`` before ``done``). Upstream ``final_answer`` is
    consumed by Backend A and is not forwarded to the frontend.

    Workflow nodes:

    - ``intent_classify`` identifies ``achievements`` (找成果),
      ``requirements`` (找需求), ``expert_team`` (找专家), or
      ``enterprises`` (找企业).
    - ``followup_check`` decides whether the question is clear.
      ``is_followup: false`` advances directly to deep-thinking ``token`` events.
    - ``final_answer`` is a successful completion marker. Backend A keeps reading
      any following list event and synthesizes ``done(stop)`` at upstream EOF.
    - A later explicit ``clarify`` node/event can request more information and
      override the earlier no-follow-up result.
    """

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    # query 优先（与上游字段一致），否则用 message
    raw_query = body.get("query")
    if raw_query is None:
        raw_query = body.get("message")

    if not isinstance(raw_query, str) or not raw_query.strip():
        raise HTTPException(status_code=422, detail="请输入问题（query / message）")
    if len(raw_query) > 4_000:
        raise HTTPException(status_code=422, detail="问题长度不能超过 4000 个字符")

    session_id = body.get("session_id")
    if session_id is None or session_id == "":
        session_id = body.get("sessionId")
    if session_id is None or session_id == "":
        session_id = "1"
    session_id = str(session_id)
    if len(session_id) > 128:
        raise HTTPException(status_code=422, detail="session_id 过长")

    # function 优先；否则由 agentKey 映射
    function: str | None = None
    raw_function = body.get("function")
    if isinstance(raw_function, str) and raw_function.strip():
        function = raw_function.strip()
    else:
        agent_key = body.get("agentKey")
        function = resolve_function(agent_key if isinstance(agent_key, str) else None)
        if not function:
            if agent_key in (None, "", "general"):
                function = "achievements"
            else:
                raise HTTPException(
                    status_code=422,
                    detail=f"未知场景 agentKey={agent_key!r}，无法映射 function",
                )

    return StreamingResponse(
        stream_from_backend_b(
            query=raw_query.strip(),
            session_id=session_id,
            function=function,
            request=request,
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8010, log_level="info")
