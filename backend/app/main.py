"""FastAPI Backend A — SSE proxy in front of Backend B.

Flow:
  Frontend → POST /api/chat/stream
           → Backend A projects config fields and proxies SSE
           → POST Backend B /api/chat/stream  JSON body: query/session_id/function

  Frontend → POST /api/kg/query
           → Backend A proxies to Backend B /api/kg/query
           → body: entity_type / vid / hop / uuid

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
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

# Allow ``python app/main.py`` (script mode has no parent package).
if __package__ in (None, ""):
    _backend_root = Path(__file__).resolve().parent.parent
    _root = str(_backend_root)
    if _root not in sys.path:
        sys.path.insert(0, _root)

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app.auth_store import (
    authenticate,
    create_session,
    delete_session,
    get_user_by_token,
    get_user_by_username,
    init_auth,
)
from app.config import BACKEND_B_API_KEY, BACKEND_B_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from app.conversation_store import (
    delete_conversation,
    get_conversation,
    init_db,
    list_conversations,
    migrate_orphan_conversations,
    rename_conversation,
    upsert_conversation,
)
from app.field_schema import (
    ACHIEVEMENT_FIELD_CATALOG,
    AGENT_FUNCTION_MAP,
    resolve_function,
    selected_detail_fields,
    selected_fields,
)
from app.hotspot_store import get_hotspots
from app.model_config_store import (
    get_model_config_public,
    init_model_config,
    save_model_config,
    test_model_config,
)
from app.proxy_stream import stream_from_backend_b
from app.sensitive_word_store import (
    create_sensitive_word,
    delete_sensitive_word,
    init_sensitive_words,
    list_active_words,
    list_categories,
    list_sensitive_words,
    update_sensitive_word,
)


def _extract_bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header or not isinstance(header, str):
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def get_current_user(request: Request) -> dict[str, Any]:
    """Require a valid opaque session token."""

    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="未登录或会话已失效")
    user = get_user_by_token(token)
    if user is None:
        raise HTTPException(status_code=401, detail="未登录或会话已失效")
    return user


def get_current_admin(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Require an authenticated admin user."""

    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """App startup / shutdown hooks (replaces deprecated on_event)."""

    init_db()
    init_auth()
    init_model_config()
    init_sensitive_words()
    admin = get_user_by_username("admin")
    if admin is not None:
        migrate_orphan_conversations(admin["id"])
    yield


app = FastAPI(
    title="AI Innovation Assistant API (Backend A)",
    version="0.5.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)

_SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}

_KG_QUERY_PATH = "/api/kg/query"


@app.get("/api/health")
async def health() -> dict[str, Any]:
    """Readiness plus upstream / model configuration flags."""

    return {
        "status": "ok",
        "backendB": BACKEND_B_BASE_URL,
        "modelConfigured": bool(LLM_API_KEY and LLM_BASE_URL),
        "model": LLM_MODEL,
    }


# ---------------------------------------------------------------------------
# Auth (opaque session tokens + bcrypt passwords)
# ---------------------------------------------------------------------------


@app.post("/api/auth/login")
async def api_login(request: Request) -> dict[str, Any]:
    """Validate username/password and issue a session token."""

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    username = body.get("username")
    password = body.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        raise HTTPException(status_code=422, detail="用户名和密码不能为空")

    user = authenticate(username, password)
    if user is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_session(user["id"])
    return {"token": token, "user": user}


@app.get("/api/auth/me")
def api_me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Return the current authenticated user."""

    return {"user": user}


@app.post("/api/auth/logout")
def api_logout(request: Request) -> dict[str, Any]:
    """Invalidate the current session token (idempotent)."""

    token = _extract_bearer_token(request)
    if token:
        delete_session(token)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Conversation history (SQLite)
# ---------------------------------------------------------------------------


@app.get("/api/conversations")
def api_list_conversations(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """List conversation summaries for sidebar history."""

    items = list_conversations(user["id"])
    return {"items": items}


@app.get("/api/conversations/{conversation_id}")
def api_get_conversation(
    conversation_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Load one conversation including full message payloads."""

    item = get_conversation(conversation_id, user["id"])
    if item is None:
        raise HTTPException(status_code=404, detail="对话不存在")
    return item


@app.put("/api/conversations/{conversation_id}")
async def api_put_conversation(
    conversation_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Create or update a conversation snapshot.

    Body::

        {
          "title": "optional; defaults to first user question",
          "agentKey": "achievement_discover" | null,
          "sessionId": "...",
          "messages": [ /* ChatMessage[] */ ]
        }

    Title is always derived from the first user question when possible.
    """

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    body = {**body, "id": conversation_id}
    try:
        return upsert_conversation(body, user["id"])
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/conversations")
async def api_create_conversation(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a conversation (id optional; generated when omitted)."""

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    try:
        return upsert_conversation(body, user["id"])
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.patch("/api/conversations/{conversation_id}")
async def api_patch_conversation(
    conversation_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Rename a conversation.

    Body::

        {"title": "新标题"}
    """

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    raw_title = body.get("title")
    if not isinstance(raw_title, str):
        raise HTTPException(status_code=422, detail="title 必须是字符串")

    try:
        item = rename_conversation(conversation_id, raw_title, user["id"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if item is None:
        raise HTTPException(status_code=404, detail="对话不存在")
    return item


@app.delete("/api/conversations/{conversation_id}")
def api_delete_conversation(
    conversation_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a conversation by id."""

    deleted = delete_conversation(conversation_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="对话不存在")
    return {"ok": True, "id": conversation_id}


@app.get("/api/hotspots")
async def api_hotspots(
    request: Request,
    _user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Hotspot recommendations: top 5 rows per sheet from ``英文字段.xlsx``.

    Fields follow list-card projection in ``信息匹配.md`` / ``field_schema``.
    Query: ``?reload=1`` clears the in-process cache (dev only).
    """

    reload = request.query_params.get("reload") in ("1", "true", "yes")
    try:
        return get_hotspots(reload=reload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface data load failures cleanly
        raise HTTPException(
            status_code=500, detail=f"热点数据加载失败：{exc}"
        ) from exc


@app.get("/api/functions")
async def list_functions(
    _user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
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


@app.post("/api/kg/query")
async def kg_query(
    request: Request,
    _user: dict[str, Any] = Depends(get_current_user),
) -> Response:
    """Proxy knowledge-graph query to Backend B.

    Request body (frontend may send only entity_type + vid)::

        {
          "entity_type": "成果",
          "vid": "自凝胶止血粉",
          "hop": "1",
          "uuid": ""
        }

    ``hop`` is always forced to ``"1"`` and ``uuid`` to ``""``.
    """

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    entity_type = body.get("entity_type")
    vid = body.get("vid")

    if not isinstance(entity_type, str) or not entity_type.strip():
        raise HTTPException(status_code=422, detail="entity_type 不能为空")
    if not isinstance(vid, str) or not vid.strip():
        raise HTTPException(status_code=422, detail="vid 不能为空")
    if len(entity_type) > 128:
        raise HTTPException(status_code=422, detail="entity_type 过长")
    if len(vid) > 512:
        raise HTTPException(status_code=422, detail="vid 过长")

    payload = {
        "entity_type": entity_type.strip(),
        "vid": vid.strip(),
        "hop": "1",
        "uuid": "",
    }

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if BACKEND_B_API_KEY:
        headers["Authorization"] = f"Bearer {BACKEND_B_API_KEY}"

    url = f"{BACKEND_B_BASE_URL.rstrip('/')}{_KG_QUERY_PATH}"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            upstream = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="知识图谱服务超时") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="知识图谱服务不可用") from exc

    content_type = upstream.headers.get("content-type", "application/json")
    # Prefer JSON passthrough so Chinese stays intact
    try:
        data = upstream.json()
        return JSONResponse(content=data, status_code=upstream.status_code)
    except (json.JSONDecodeError, ValueError):
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            media_type=content_type,
        )


@app.post("/api/chat/stream")
async def stream_chat(
    request: Request,
    _user: dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
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
        # 未选中场景：function 为空，不默认 achievements
        if not function and agent_key not in (None, "", "general"):
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


# ---------------------------------------------------------------------------
# Admin: model configuration (LLM + embedding)
# ---------------------------------------------------------------------------


@app.get("/api/admin/model-config")
def api_get_model_config(
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Return masked LLM / embedding settings for the admin UI."""

    return get_model_config_public()


@app.put("/api/admin/model-config")
async def api_put_model_config(
    request: Request,
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Save LLM / embedding settings. Empty masked secrets keep previous values."""

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    try:
        return save_model_config(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/admin/model-config/test")
async def api_test_model_config(
    request: Request,
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Connectivity probe for saved LLM or embedding config."""

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    kind = body.get("kind")
    if kind not in ("llm", "embedding"):
        raise HTTPException(status_code=422, detail="kind 必须是 llm 或 embedding")

    try:
        return await test_model_config(kind)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Sensitive words (admin CRUD + login user word list for client matching)
# ---------------------------------------------------------------------------


@app.get("/api/sensitive-words")
def api_list_active_sensitive_words(
    _user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Full word list for client-side send interception."""

    return {"words": list_active_words()}


@app.get("/api/admin/sensitive-words")
def api_admin_list_sensitive_words(
    q: str = "",
    category: str = "",
    page: int = 1,
    pageSize: int = 20,
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Paginated admin list with keyword / category filters."""

    return list_sensitive_words(
        q=q,
        category=category,
        page=page,
        page_size=pageSize,
    )


@app.get("/api/admin/sensitive-words/categories")
def api_admin_sensitive_word_categories(
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Distinct categories for the admin filter dropdown."""

    return {"categories": list_categories()}


@app.post("/api/admin/sensitive-words")
async def api_admin_create_sensitive_word(
    request: Request,
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Create a sensitive word."""

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    try:
        return create_sensitive_word(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.put("/api/admin/sensitive-words/{word_id}")
async def api_admin_update_sensitive_word(
    word_id: str,
    request: Request,
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Update a sensitive word."""

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    try:
        return update_sensitive_word(word_id, body)
    except ValueError as exc:
        detail = str(exc)
        status = 404 if detail == "敏感词不存在" else 422
        raise HTTPException(status_code=status, detail=detail) from exc


@app.delete("/api/admin/sensitive-words/{word_id}")
def api_admin_delete_sensitive_word(
    word_id: str,
    _admin: dict[str, Any] = Depends(get_current_admin),
) -> dict[str, Any]:
    """Delete a sensitive word."""

    try:
        return delete_sensitive_word(word_id)
    except ValueError as exc:
        detail = str(exc)
        status = 404 if detail == "敏感词不存在" else 422
        raise HTTPException(status_code=status, detail=detail) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8010, log_level="info")
