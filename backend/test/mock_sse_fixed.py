"""固定内容 SSE 样例（对照 req.docx 两种格式）。

单个接口回放固定事件流，不接大模型、不读 Excel：

    POST /api/chat/stream

- session_id="1" -> 正常流程
- session_id="2" -> 非正常（澄清）

请求体::

    {
      "query": "任意问题",
      "session_id": "1",
      "function": "achievements"
    }

query / function 忽略，仅 session_id 决定回放哪一种固定流。

启动::

    cd backend
    python test/mock_sse_fixed.py

默认监听 0.0.0.0:8002
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator, Sequence
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(
    title="Mock Backend B — Fixed SSE",
    version="0.1.0",
    description="按 req.docx 回放固定 SSE：正常 / 非正常（澄清）两种格式。",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


class ChatStreamRequest(BaseModel):
    """与 Backend A 代理上游约定一致；本样例忽略内容，只回放固定流。"""

    query: str = Field(default="", description="用户问题（可忽略）")
    session_id: str = Field(default="1", description="会话 ID（可忽略）")
    function: str = Field(default="achievements", description="业务功能（可忽略）")


# ---------------------------------------------------------------------------
# 固定 payload（来自 req.docx）
# ---------------------------------------------------------------------------

_NODE_META_BASE: dict[str, Any] = {
    "intent": "achievements",
    "categories": ["achievements"],
    "need_clarify": False,
    "clarify_question": "",
    "clarify_stage": 0,
    "suggested_questions": [],
    "is_followup": False,
    "is_new_topic": True,
    "rag_count": 0,
    "kg_count": 0,
    "optimized_query": "",
}


def _node_end(node: str, **overrides: Any) -> dict[str, Any]:
    payload = {"node": node, **_NODE_META_BASE, **overrides}
    return payload


_NORMAL_ACHIEVEMENT: dict[str, Any] = {
    "serial_no": "1",
    "achievement_name": "自凝胶止血粉",
    "achievement_contributors": "拜永孝",
    "research_team_leader_type": "其他",
    "primary_technology_field": "新材料",
    "secondary_technology_field": "生物医用材料",
    "nanjing_key_industry_field": "新材料",
    "commercialization_method": "技术转让,作价入股,合作开发,技术许可,其他",
    "maturity_level": "小试",
    "achievement_ownership": "独占",
    "rights_ownership_type": "机构",
    "individual_name": "",
    "individual_id_number": "",
    "rights_holding_organization_name": "兰州大学",
    "intended_amount_10k_cny": "",
    "achievement_brief": (
        "本技术采用冷冻干燥工艺制备壳聚糖 / 聚丙烯酸 / 单宁酸快速止血粉末，"
        "材料接触创面可自主凝胶并形成封闭层，同时具备抗菌效果。"
        "技术攻克粉末颗粒间、粉末与皮肤组织间作用力不足的短板，满足创面血液凝聚要求，"
        "解决传统止血粉难以应对大出血、不可压迫性出血的行业痛点，"
        "同时克服传统材料难以同步兼顾生物活性、理化活性的难题。"
        "经试验验证，该自凝胶止血粉末拥有高粘附力，止血、抗菌性能表现优异，当前处于小试阶段。"
    ),
    "achievement_overview": (
        "本成果研发一款壳聚糖 / 聚丙烯酸 / 单宁酸复合自凝胶抗菌止血粉体，"
        "依托冷冻干燥工艺成型，针对性解决传统止血材料粘附力弱、无法处置大量出血创面、"
        "生物与理化活性难以平衡多重技术短板。"
        "粉体遇创面可快速自凝胶形成封闭防护层，兼具高粘附、高效止血、广谱抗菌多重特性，"
        "适配各类出血伤口使用，整体技术完成小试试验验证，"
        "为创伤急救、外科创面止血提供新型医用新材料方案，具备良好的医用转化潜力。"
    ),
    "publishing_organization_name": "兰州大学小分队",
    "contact_name": "拜永孝",
    "contact_phone": "13008793687",
    "related_expert_team": "",
    "is_carbon_peaking_neutrality_related": "是",
    "review_time": "2026-07-10 16:35:11 ——成果",
}

_NORMAL_TOKENS: list[str] = [
    "当前",
    "数据库中",
    "相关知识",
    "亟待",
    "补充",
    "，",
    "暂时",
    "无法",
    "回答",
    "您",
    "的问题",
    "。",
    "如有",
    "需要",
    "，",
    "请联系",
    "管理员",
    "补充",
    "相关",
    "数据",
    "。",
]

_NORMAL_FINAL = (
    "当前数据库中相关知识亟待补充，暂时无法回答您的问题。"
    "如有需要，请联系管理员补充相关数据。"
)

_CLARIFY_QUESTION = (
    "您好！请问您是来自企业还是科研机构呢？"
    "您想查询哪方面的技术成果？"
    "比如可以输入成果名称、技术领域等信息来检索。"
)

_CLARIFY_SUGGESTED = [
    "最近有哪些新材料领域的成果？",
    "生物医药方向有哪些技术成果？",
]


def _sse(event: str, payload: dict[str, Any]) -> str:
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"


def _sse_comment(text: str) -> str:
    """SSE 注释行（如 : ping），客户端应忽略。"""

    return f": {text}\n\n"


def _build_normal_frames() -> list[str]:
    """正常：workflow 节点 → ping → token* → final_answer → related_entries → suggested_questions。"""

    frames: list[str] = []

    workflow: Sequence[tuple[str, dict[str, Any]]] = (
        ("intent_classify", {}),
        ("followup_check", {}),
        (
            "clarify",
            {
                "need_clarify": False,
                "clarify_stage": 3,
            },
        ),
        (
            "retrieval",
            {
                "need_clarify": False,
                "clarify_stage": 3,
                "rag_count": 8,
                "optimized_query": "生物医药 技术领域",
            },
        ),
        (
            "generate",
            {
                "need_clarify": False,
                "clarify_stage": 3,
                "rag_count": 8,
                "optimized_query": "生物医药 技术领域",
            },
        ),
    )

    for node, overrides in workflow:
        frames.append(_sse("node_start", {"node": node}))
        frames.append(_sse("node_end", _node_end(node, **overrides)))

    frames.append(_sse_comment("ping - 2026-07-26 10:13:11.017317+00:00"))

    for token in _NORMAL_TOKENS:
        frames.append(_sse("token", {"content": token}))

    frames.append(_sse("final_answer", {"content": _NORMAL_FINAL}))
    frames.append(_sse("related_entries", {"achievements": [_NORMAL_ACHIEVEMENT]}))
    frames.append(
        _sse(
            "suggested_questions",
            {
                "questions": [
                    "新材料领域有哪些生物医用材料成果？",
                    "自凝胶止血粉的成果简介是什么？",
                ],
            },
        )
    )
    return frames


def _build_clarify_frames() -> list[str]:
    """非正常：需要澄清，在 clarify 节点后下发 clarify + suggested_questions。"""

    frames: list[str] = []

    frames.append(_sse("node_start", {"node": "intent_classify"}))
    frames.append(_sse("node_end", _node_end("intent_classify")))

    frames.append(_sse("node_start", {"node": "followup_check"}))
    frames.append(_sse("node_end", _node_end("followup_check")))

    frames.append(_sse("node_start", {"node": "clarify"}))
    frames.append(
        _sse(
            "node_end",
            _node_end(
                "clarify",
                need_clarify=True,
                clarify_question=_CLARIFY_QUESTION,
                clarify_stage=1,
                suggested_questions=list(_CLARIFY_SUGGESTED),
            ),
        )
    )

    frames.append(_sse("clarify", {"question": _CLARIFY_QUESTION}))
    frames.append(_sse("suggested_questions", {"questions": list(_CLARIFY_SUGGESTED)}))
    return frames


_NORMAL_FRAMES = _build_normal_frames()
_CLARIFY_FRAMES = _build_clarify_frames()


async def _replay(
    frames: Sequence[str],
    request: Request,
    *,
    delay_s: float = 0.05,
) -> AsyncIterator[str]:
    """按帧回放固定 SSE；客户端断开则停止。"""

    for frame in frames:
        if await request.is_disconnected():
            return
        yield frame
        if delay_s > 0:
            await asyncio.sleep(delay_s)


def _stream_response(generator: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/b/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "mock-sse-fixed",
        "endpoint": "POST /api/chat/stream",
        "session_id": {
            "1": "正常固定流",
            "2": "非正常（澄清）固定流",
        },
    }


@app.post("/api/chat/stream")
async def stream_chat(
    body: ChatStreamRequest,
    request: Request,
) -> StreamingResponse:
    """固定 SSE：session_id=1 正常，session_id=2 非正常；忽略 query。"""

    session_id = (body.session_id or "").strip()
    if session_id == "2":
        frames = _CLARIFY_FRAMES
    else:
        # session_id=1 及其它值：正常流
        frames = _NORMAL_FRAMES
    return _stream_response(_replay(frames, request))


def _lan_ipv4_hints() -> list[str]:
    import socket

    ips: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.insert(0, ip)
    except OSError:
        pass

    return ips


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("MOCK_SSE_HOST", "0.0.0.0")
    port = int(os.getenv("MOCK_SSE_PORT", "8002"))

    print(f"[mock-sse] listen on http://{host}:{port}")
    print(f"[mock-sse] local  : http://127.0.0.1:{port}")
    for ip in _lan_ipv4_hints():
        print(f"[mock-sse] lan    : http://{ip}:{port}")
    print(f"[mock-sse] docs   : http://127.0.0.1:{port}/docs")
    print(f"[mock-sse] stream : POST http://127.0.0.1:{port}/api/chat/stream")
    print("[mock-sse] session_id=1 正常；session_id=2 非正常（澄清）")

    uvicorn.run(app, host=host, port=port, log_level="info")
