"""FastAPI service for the AI innovation assistant.

Streams answers from an OpenAI-compatible chat completions API.
Provider credentials stay on the server; the frontend only talks to /api/*.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Load backend/.env whether started from repo root or backend/
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()


@dataclass(frozen=True, slots=True)
class Agent:
    """Public metadata and system framing for one fixed assistant."""

    key: str
    name: str
    short_name: str
    description: str
    greeting: str
    prompts: tuple[str, str, str]
    system_prompt: str

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
        key="achievement_match",
        name="成果匹配助手",
        short_name="成果匹配",
        description="把技术成果与应用场景、产业需求快速对齐。",
        greeting="告诉我你的技术成果或能力画像，我会帮你匹配更合适的应用场景与落地方向。",
        prompts=(
            "这项新材料成果适合进入哪些应用场景？",
            "如何把实验室成果转化为可对接的产业需求？",
            "评估某项检测技术与制造场景的匹配度。",
        ),
        system_prompt=(
            "你是「成果匹配助手」。"
            "帮助用户把技术成果、能力优势与应用场景、产业需求进行匹配。"
            "请给出适用边界、目标场景、匹配理由、验证切入点与下一步行动。"
            "使用专业、清晰、可执行的中文，不确定时说明假设。"
        ),
    ),
    Agent(
        key="expert_recommend",
        name="专家推荐助手",
        short_name="专家推荐",
        description="按任务目标推荐合适的专家与能力组合。",
        greeting="描述你的技术方向与任务目标，我会帮你梳理需要什么样的专家以及如何筛选。",
        prompts=(
            "推荐先进复合材料方向的产学研专家画像。",
            "如何筛选适合联合攻关的技术专家？",
            "解决高温合金失效问题需要哪些专家能力？",
        ),
        system_prompt=(
            "你是「专家推荐助手」。"
            "根据技术方向、问题阶段和合作目标，给出专家画像、能力组合、筛选标准与对接建议。"
            "不要编造具体真实人名与不可核验的联系方式；可描述角色、能力维度和寻找路径。"
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
        system_prompt=(
            "你是「技术合作助手」。"
            "帮助用户把技术需求转成可对接的合作任务，给出伙伴画像、筛选标准、验证路径、"
            "风险点与推进节奏。语言务实，面向产学研与产业协同。"
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
        system_prompt=(
            "你是「精准拓客助手」。"
            "从技术成果、应用场景、客户画像、业务痛点、验证切入和触达策略给出建议。"
            "强调匹配度与可验证的首轮试点，而不是空泛的市场口号。"
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
        system_prompt=(
            "你是「需求预测助手」。"
            "结合政策、投资、产能、招聘、采购等领先指标，判断需求信号、时间窗口与行动建议。"
            "区分真实采购信号与短期噪声，必要时给出多情景判断。"
        ),
    ),
    Agent(
        key="policy_service",
        name="政策服务助手",
        short_name="政策服务",
        description="梳理科创政策、申报路径与合规要点。",
        greeting="告诉我你的政策关注点或申报目标，我会帮你梳理适用政策、条件与推进步骤。",
        prompts=(
            "梳理人工智能与制造业融合相关支持政策。",
            "中小科技企业有哪些常见的项目申报路径？",
            "如何判断一个项目是否符合专项资助条件？",
        ),
        system_prompt=(
            "你是「政策服务助手」。"
            "帮助用户理解科创政策方向、申报路径、适用条件、材料准备与合规注意点。"
            "政策具有时效性与地区差异，请明确假设边界，并提醒用户以正式文件与主管部门口径为准。"
        ),
    ),
    Agent(
        key="innovation_resources",
        name="科创资源助手",
        short_name="科创资源",
        description="汇聚成果、项目、企业与平台等资源线索，辅助科创资源快速发现。",
        greeting="告诉我你的目标与筛选条件，我会帮你组织需要寻找的科创资源与使用建议。",
        prompts=(
            "如何建立一个项目申报资源清单？",
            "按技术方向整理可利用的科创资源类型。",
            "寻找先进制造方向的平台与载体线索。",
        ),
        system_prompt=(
            "你是「科创资源助手」。"
            "帮助用户围绕目标组织成果、项目、企业、平台与载体等资源线索，"
            "给出筛选依据、价值判断与后续使用建议。回答条理清晰，可操作。"
        ),
    ),
)

AGENTS_BY_KEY: dict[str, Agent] = {agent.key: agent for agent in AGENTS}

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://101.226.11.38:25000/v1").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen/Qwen3.6-35B-A3B")


app = FastAPI(
    title="AI Innovation Assistant API",
    version="0.2.0",
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
async def health() -> dict[str, Any]:
    """Return readiness and whether the model endpoint is configured."""

    return {
        "status": "ok",
        "modelConfigured": bool(LLM_API_KEY and LLM_BASE_URL),
        "model": LLM_MODEL,
    }


@app.get("/api/agents")
async def list_agents() -> dict[str, list[dict[str, Any]]]:
    """Return the six fixed assistant definitions used by the frontend."""

    return {"agents": [agent.public_dict() for agent in AGENTS]}


def _sse(event: str, payload: dict[str, Any]) -> str:
    """Serialize one Server-Sent Event with UTF-8 Chinese content intact."""

    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"


def _extract_delta_text(payload: dict[str, Any]) -> str:
    """Pull assistant text from an OpenAI-compatible stream chunk."""

    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""

    first = choices[0]
    if not isinstance(first, dict):
        return ""

    delta = first.get("delta")
    if isinstance(delta, dict):
        content = delta.get("content")
        if isinstance(content, str) and content:
            return content
        # Some gateways put partial text under message.content
        message = delta.get("message")
        if isinstance(message, dict):
            nested = message.get("content")
            if isinstance(nested, str) and nested:
                return nested

    message = first.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, str) and content:
            return content

    text = first.get("text")
    if isinstance(text, str):
        return text

    return ""


async def _stream_model_reply(
    agent: Agent,
    message: str,
    request: Request,
) -> AsyncIterator[str]:
    """Proxy the upstream chat completion stream into app-level SSE events."""

    if not LLM_API_KEY:
        yield _sse(
            "delta",
            {
                "content": "模型服务未配置 API Key，请在 backend/.env 中设置 LLM_API_KEY。",
            },
        )
        yield _sse("done", {"finishReason": "error"})
        return

    yield _sse(
        "meta",
        {
            "agentKey": agent.key,
            "agentName": agent.name,
            "model": LLM_MODEL,
        },
    )

    url = f"{LLM_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    body = {
        "model": LLM_MODEL,
        "stream": True,
        "messages": [
            {"role": "system", "content": agent.system_prompt},
            {"role": "user", "content": message.strip()},
        ],
    }

    timeout = httpx.Timeout(connect=20.0, read=180.0, write=30.0, pool=20.0)
    emitted_any = False

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json=body,
            ) as response:
                if response.status_code >= 400:
                    error_body = (await response.aread()).decode("utf-8", errors="replace")
                    detail = error_body[:500] if error_body else f"HTTP {response.status_code}"
                    yield _sse(
                        "delta",
                        {
                            "content": (
                                f"模型服务暂时不可用（{response.status_code}）。"
                                f"详情：{detail}"
                            ),
                        },
                    )
                    yield _sse("done", {"finishReason": "error"})
                    return

                async for line in response.aiter_lines():
                    if await request.is_disconnected():
                        return

                    if not line:
                        continue

                    if line.startswith(":"):
                        # SSE comment / keepalive
                        continue

                    if not line.startswith("data:"):
                        continue

                    data = line[5:].strip()
                    if not data:
                        continue

                    if data == "[DONE]":
                        break

                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    if not isinstance(payload, dict):
                        continue

                    if payload.get("error"):
                        err = payload["error"]
                        err_text = (
                            err.get("message")
                            if isinstance(err, dict)
                            else str(err)
                        )
                        yield _sse(
                            "delta",
                            {
                                "content": f"模型返回错误：{err_text}",
                            },
                        )
                        yield _sse("done", {"finishReason": "error"})
                        return

                    text = _extract_delta_text(payload)
                    if text:
                        emitted_any = True
                        yield _sse("delta", {"content": text})

    except httpx.TimeoutException:
        yield _sse(
            "delta",
            {"content": "模型响应超时，请稍后重试或缩短问题后再次提问。"},
        )
        yield _sse("done", {"finishReason": "error"})
        return
    except httpx.HTTPError as exc:
        yield _sse(
            "delta",
            {"content": f"无法连接模型服务：{exc.__class__.__name__}。请确认服务地址可达。"},
        )
        yield _sse("done", {"finishReason": "error"})
        return

    if not emitted_any:
        yield _sse(
            "delta",
            {"content": "模型没有返回可用内容，请换一种表述后再试。"},
        )

    yield _sse("done", {"finishReason": "stop"})


@app.post("/api/chat/stream")
async def stream_chat(request: Request) -> StreamingResponse:
    """Stream a model-backed assistant response using Server-Sent Events.

    Expected JSON body::

        {"agentKey": "achievement_match", "message": "你的问题"}

    Events are ``meta``, repeated ``delta`` records, and finally ``done``.
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

    return StreamingResponse(
        _stream_model_reply(agent, message, request),
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
