"""FastAPI service for the AI innovation assistant prototype.

The streaming endpoint intentionally uses deterministic, locally generated
content. It provides the same SSE contract that a configured AI service can
later implement without exposing model or provider settings to the frontend.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse


@dataclass(frozen=True, slots=True)
class Agent:
    """Public metadata and response framing for one fixed assistant."""

    key: str
    name: str
    short_name: str
    description: str
    greeting: str
    prompts: tuple[str, str, str]
    response_intro: str
    response_steps: tuple[str, str, str]

    def public_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "shortName": self.short_name,
            "description": self.description,
            "greeting": self.greeting,
            "prompts": list(self.prompts),
        }


AGENTS: tuple[Agent, ...] = (
    Agent(
        key="rd_qa",
        name="研发问答助手",
        short_name="研发问答",
        description="面向技术研发难题，梳理关键机理、验证路径与可参考的成果方向。",
        greeting="研发难题卡住了？我会帮你拆解技术问题，并给出清晰的验证路径。",
        prompts=(
            "怎样提高高分子材料的耐老化性能？",
            "如何提升光伏发电系统的能量转化效率？",
            "如何有效增强高温合金的抗蠕变性能？",
        ),
        response_intro="我会先把研发问题拆成可验证的技术假设，再安排优先级。",
        response_steps=(
            "界定目标指标、使用工况与当前基线，避免把多个问题混在一起。",
            "围绕材料、结构、工艺和测试条件建立对照实验，优先验证高影响变量。",
            "记录评价方法与失效边界，再据此收敛方案并补充成果检索方向。",
        ),
    ),
    Agent(
        key="tech_scout",
        name="技术预研助手",
        short_name="技术预研",
        description="快速洞察技术现状、演进脉络与潜在突破口，辅助研发方向探索。",
        greeting="告诉我你关注的技术方向，我会从现状、趋势和机会三个层面展开预研。",
        prompts=(
            "固态电池近三年的关键技术路线有哪些？",
            "具身智能传感器的发展趋势是什么？",
            "评估低空经济中的高价值技术机会。",
        ),
        response_intro="技术预研需要同时看成熟度、竞争强度和可落地窗口。",
        response_steps=(
            "明确研究边界、目标行业与时间范围，形成可比较的技术路线集合。",
            "从性能上限、工程成本、供应链和知识产权四个维度建立评价矩阵。",
            "识别仍未解决的关键约束，给出短期验证课题与中期布局建议。",
        ),
    ),
    Agent(
        key="tech_partner",
        name="技术合作助手",
        short_name="技术合作",
        description="解析合作需求，匹配潜在技术能力，并形成可执行的合作切入方案。",
        greeting="描述你的技术需求与合作目标，我会帮你梳理伙伴画像和推进路径。",
        prompts=(
            "寻找新能源材料方向的高校合作团队。",
            "如何设计一份高质量的产学研合作需求？",
            "评估联合实验室合作模式的关键风险。",
        ),
        response_intro="高质量技术合作应先把需求转化为双方都能验证的合作任务。",
        response_steps=(
            "写清技术目标、已有基础、期望交付物与不可妥协的约束。",
            "按研究积累、工程能力、资源互补度和合作记录建立伙伴筛选标准。",
            "用小规模联合验证启动合作，并提前约定里程碑、成果归属和退出机制。",
        ),
    ),
    Agent(
        key="precision_growth",
        name="精准拓客助手",
        short_name="精准拓客",
        description="从成果能力与应用场景出发，识别高匹配客户并规划触达策略。",
        greeting="提供你的技术成果或产品能力，我会帮你定位更匹配的客户场景。",
        prompts=(
            "为工业视觉检测方案寻找潜在客户。",
            "分析这项储能技术最适合进入哪些行业。",
            "如何制定技术型产品的首轮客户验证计划？",
        ),
        response_intro="精准拓客的重点不是扩大名单，而是找到问题足够迫切的应用方。",
        response_steps=(
            "把技术优势翻译为可量化的业务价值与适用边界。",
            "按场景痛点、采购能力、部署周期和决策链完整度筛选目标客户。",
            "设计低门槛验证方案，用明确的成功指标推动从试点走向采购。",
        ),
    ),
    Agent(
        key="demand_forecast",
        name="需求预测助手",
        short_name="需求预测",
        description="结合产业信号与企业轨迹，研判潜在需求及其可能出现的时间窗口。",
        greeting="输入行业、企业或产品方向，我会帮你梳理需求信号和验证指标。",
        prompts=(
            "预测人形机器人核心零部件的需求变化。",
            "哪些信号说明企业即将启动数字化改造？",
            "分析未来两年高端传感器的潜在需求。",
        ),
        response_intro="需求预测应区分真实采购信号、行业叙事与短期噪声。",
        response_steps=(
            "定义预测对象、区域、客户类型和时间尺度，建立可观测指标。",
            "结合政策、投资、产能、招聘、招投标和产品迭代等领先信号。",
            "设置基准、积极和保守情景，定期用新数据修正概率与行动窗口。",
        ),
    ),
    Agent(
        key="innovation_resources",
        name="科创资源助手",
        short_name="科创资源",
        description="汇聚专家、企业、成果、项目与政策线索，辅助科创资源快速发现。",
        greeting="告诉我你的目标与筛选条件，我会帮你组织需要寻找的科创资源。",
        prompts=(
            "梳理人工智能与制造业融合相关政策。",
            "寻找先进复合材料领域的专家与成果线索。",
            "如何建立一个项目申报资源清单？",
        ),
        response_intro="科创资源检索需要先定义用途，才能判断相关性与可信度。",
        response_steps=(
            "明确资源类型、技术方向、地域范围、时效要求和使用场景。",
            "按权威性、匹配度、可联系性与更新时间整理候选资源。",
            "对关键线索进行交叉验证，并形成包含来源、价值和下一步动作的清单。",
        ),
    ),
)

AGENTS_BY_KEY: dict[str, Agent] = {agent.key: agent for agent in AGENTS}


app = FastAPI(
    title="AI Innovation Assistant API",
    version="0.1.0",
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


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Return a lightweight readiness response."""

    return {"status": "ok"}


@app.get("/api/agents")
async def list_agents() -> dict[str, list[dict[str, Any]]]:
    """Return the six fixed assistant definitions used by the frontend."""

    return {"agents": [agent.public_dict() for agent in AGENTS]}


def _sse(event: str, payload: dict[str, Any]) -> str:
    """Serialize one Server-Sent Event with UTF-8 Chinese content intact."""

    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"


def _chunk_text(text: str, target_size: int = 12) -> tuple[str, ...]:
    """Split text into small display-friendly chunks without extra libraries."""

    if not text:
        return ()

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + target_size, len(text))
        while end < len(text) and text[end] not in "，。；：！？\n ":
            end += 1
        if end < len(text):
            end += 1
        chunks.append(text[start:end])
        start = end
    return tuple(chunks)


def _build_response(agent: Agent, message: str) -> str:
    safe_question = " ".join(message.split())
    if len(safe_question) > 120:
        safe_question = f"{safe_question[:117]}..."

    steps = "\n".join(
        f"{index}. {step}" for index, step in enumerate(agent.response_steps, start=1)
    )
    return (
        f"针对你的问题“{safe_question}”，{agent.response_intro}\n\n"
        f"建议先这样推进：\n\n{steps}\n\n"
        "如果你补充当前阶段、目标指标和已有条件，我可以继续把方案细化为可执行的任务清单。"
    )


@app.post("/api/chat/stream")
async def stream_chat(request: Request) -> StreamingResponse:
    """Stream a contextual assistant response using Server-Sent Events.

    Expected JSON body::

        {"agentKey": "rd_qa", "message": "你的问题"}

    Events are ``meta``, repeated ``delta`` records, and finally ``done``.
    Error responses before streaming use normal HTTP JSON status codes.
    """

    try:
        body = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体必须是有效的 JSON") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    agent_key = body.get("agentKey")
    message = body.get("message")

    if not isinstance(agent_key, str) or agent_key not in AGENTS_BY_KEY:
        raise HTTPException(status_code=422, detail="请选择有效的智能体")
    if not isinstance(message, str) or not message.strip():
        raise HTTPException(status_code=422, detail="请输入问题")
    if len(message) > 4_000:
        raise HTTPException(status_code=422, detail="问题长度不能超过 4000 个字符")

    agent = AGENTS_BY_KEY[agent_key]
    response_text = _build_response(agent, message)

    async def events() -> AsyncIterator[str]:
        yield _sse(
            "meta",
            {
                "agentKey": agent.key,
                "agentName": agent.name,
            },
        )

        for chunk in _chunk_text(response_text):
            if await request.is_disconnected():
                return
            yield _sse("delta", {"content": chunk})
            await asyncio.sleep(0.035)

        yield _sse("done", {"finishReason": "stop"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
