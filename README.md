# AI 创新助手

基于 Google Stitch 模板「AI 创新助手 R&D Innovation Platform」实现的三页 AI 产品原型。界面只使用 Ant Design 6 与 Ant Design X 2，保留固定侧栏、冷白画布、钴蓝主色和克制的企业级动效。

## 技术方案

### 前端

- Vite 8 + React 19 + TypeScript 7
- React Router 7
- Ant Design 6
- Ant Design X 2：`Sender`、`Prompts`、`Welcome`、`Bubble.List`、`ThoughtChain`、`Actions`、`XProvider`
- `@ant-design/x-markdown`：流式 Markdown 渲染
- 原生 `fetch` + `ReadableStream` + `AbortController`：SSE 解析、流式请求与中止控制
- `motion/react`：页面入场、智能体切换和推荐问题下推动画
- CSS Modules + Ant Design 主题令牌

没有引入 Kumo UI、shadcn、Tailwind、额外状态库或请求库。

### 后端（Backend A）

- FastAPI + Uvicorn + httpx
- 前端只调 Backend A：`POST /api/chat/stream`
- Backend A 再调 Backend B 的 SSE：`POST {BACKEND_B}/api/chat/stream`，JSON body：`query` / `session_id` / `function`
- 上游事件：`node_start` / `node_end`（任务阶段）+ 可选 `clarify`（澄清问题）+ `token`（深度思考）+ `final_answer`（回答完成）+ `related_entries`（列表）
- 列表字段由 Backend A 配置投影（`ACHIEVEMENT_DISPLAY_FIELDS` 等），前端只渲染返回的字段

## 页面

- `/`：AI 总入口。七个智能体可切换，输入框保持居中；聚焦输入框后，推荐问题面板从下方向下展开。
- `/agents`：智能体中心。展示七个智能体的能力与适用范围，点击整张卡片进入独立对话。
- `/chat/:agentKey`：对话页面。包含欢迎引导、三条推荐问题、流式回答、公开任务进度、复制、重新生成与停止生成。

七个固定智能体：

1. 成果匹配
2. 专家推荐
3. 技术合作
4. 精准拓客
5. 需求预测
6. 政策服务
7. 科创资源

## 登录与权限

- 访问业务页前需登录（`/login`）
- 密码使用 bcrypt 哈希存储于 SQLite；会话为不透明 token（`Authorization: Bearer`），有效期 7 天
- 演示账号（启动时自动 seed）：
  - 管理员：`admin` / `nkh@2026`（可见「知识库设置」）
  - 普通用户：`test0` / `nkh@2026`（不可见知识库设置）
- 对话历史按用户隔离

## 本地启动

先配置上游 Backend B 与字段投影（可复制示例后填写）：

```powershell
cd D:\mynj\nkh_project\backend
copy .env.example .env
# 编辑 .env：
#   BACKEND_B_HOST / BACKEND_B_PORT  （或 BACKEND_B_BASE_URL）
#   ACHIEVEMENT_DISPLAY_FIELDS=serial_no,achievement_name   # 仅渲染配置字段
```

再启动后端：

```powershell
cd D:\mynj\nkh_project\backend
python -m pip install -r requirements.txt
python .\app\main.py
```

开发时如果需要代码修改后自动重载，也可以使用：

```powershell
cd D:\mynj\nkh_project\backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

再启动前端：

```powershell
cd D:\mynj\nkh_project\frontend
npm install
npm run dev
```

访问 `http://127.0.0.1:5173/`。

## 接口（Backend A）

- `GET /api/health`（公开）
- `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`
- `GET /api/functions`：查看 function 映射与当前字段投影（需登录）
- `POST /api/chat/stream`：SSE 代理（需登录）
- `GET /api/conversations*`：对话历史（需登录，按用户隔离）

流式请求示例：

```json
{
  "agentKey": "achievement_discover",
  "message": "自凝胶止血粉你了解么",
  "sessionId": "1"
}
```

SSE 协议处理顺序：

1. `meta`：sessionId / function / fields（字段元数据）
2. `intent_classify` 的 `node_start` / `node_end`：驱动“判断用户意图”。`intent` 映射为 `achievements` 找成果、`requirements` 找需求、`expert_team` 找专家、`enterprises` 找企业
3. `followup_check` 的 `node_start` / `node_end`：驱动“判断问题是否明确”。`is_followup: false` 表示无需追问，立即进入深度思考
4. 无需追问时，多个 `token` 按顺序流式写入 `ThoughtChain` 的“深度思考”节点；Backend A 观察到上游 `final_answer` 后认定回答完成，但不向前端透传该事件
5. 如果后续 `clarify` 节点或同名事件明确要求补充信息，则覆盖之前的无需追问判断，展示澄清问题及可选建议问题；该分支可直接进入 `done`，不要求返回列表
6. 非澄清结果可返回 `related_entries`：投影后的列表（前端 Ant Design `List`）
7. `done`：`finishReason: stop` 表示正常结束，错误终态由 `error` 与 `finishReason: error` 表示。出现 `final_answer` 后，即使上游以 EOF 结束、没有显式 `done`，Backend A 也会补发 `done(stop)`

`intent_classify.intent` 是模型识别的用户意图；下面的 `agentKey` → `function` 是请求路由，两者用途不同。

场景 `agentKey` → Backend B `function` 映射示例：

| agentKey | function |
|----------|----------|
| achievement_discover | achievements |
| expert_discover | expert_team |
| demand_discover | requirements |
| enterprise_discover | enterprises |
| platform_discover | platforms |
| policy_recommend | policies |

## 构建验证

```powershell
cd D:\mynj\nkh_project\frontend
npm run build

cd D:\mynj\nkh_project\backend
python -m compileall app
```

## Docker 离线部署（推荐）

架构：浏览器 → 前端 nginx（静态页 + 反代 `/api`）→ Backend A（本仓库）→ Backend B（第三方，仅改 `.env`）。

### 1. 准备配置（改 B 端不用重新打包）

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，至少配置上游：
#   BACKEND_B_BASE_URL=http://<B端IP或主机名>:8001
#   或 BACKEND_B_HOST / BACKEND_B_PORT
#   可选 BACKEND_B_API_KEY
#   可选 ACHIEVEMENT_DISPLAY_FIELDS 等字段投影
```

容器通过 `env_file` + 挂载 `backend/.env` 注入环境变量。**改端口 / B 端地址只改 `.env`，然后重建 backend 容器即可，不必重新 build 镜像。**

```bash
# 改完 .env 后：
docker compose up -d --force-recreate backend
```

### 2. 有网机器：构建镜像

需已安装 Docker / Docker Compose，且能拉 `python:3.12-slim`、`node:22-alpine`、`nginx:1.27-alpine`。

```bash
# 仓库根目录
docker compose build
# 或分别：
# docker build -t nkh-backend:latest ./backend
# docker build -t nkh-frontend:latest ./frontend
```

### 3. 离线搬到服务器

在有网机器导出：

```bash
docker save nkh-backend:latest nkh-frontend:latest -o nkh-images.tar
# 一并拷贝：docker-compose.yml、backend/.env、英文字段.xlsx（热点数据，可选）
```

服务器导入并启动：

```bash
docker load -i nkh-images.tar
# 放好 backend/.env 与 docker-compose.yml 后：
docker compose up -d
```

访问：`http://<服务器IP>/`（默认 `WEB_PORT=80`）。后端直连端口默认 `8010`（`BACKEND_PORT`）。

### 4. 常用命令

| 操作 | 命令 |
|------|------|
| 启动 | `docker compose up -d` |
| 看日志 | `docker compose logs -f backend` |
| 只改 `.env` 生效 | `docker compose up -d --force-recreate backend` |
| 停 | `docker compose down` |
| 清数据卷（登录/会话库） | `docker compose down -v` |

### 5. 环境变量说明（`backend/.env`）

| 变量 | 说明 |
|------|------|
| `BACKEND_B_BASE_URL` | 上游 B 完整地址，优先 |
| `BACKEND_B_HOST` / `BACKEND_B_PORT` | 无 BASE_URL 时拼地址 |
| `BACKEND_B_STREAM_PATH` | 默认 `/api/chat/stream` |
| `BACKEND_B_API_KEY` | 可选，Bearer 调 B |
| `ACHIEVEMENT_DISPLAY_FIELDS` 等 | 列表字段投影 |
| `LLM_*` | 遗留 LLM，主链路可不配 |

宿主机端口映射可在启动前设置：`WEB_PORT=8080 BACKEND_PORT=8010 docker compose up -d`。

### 6. 说明

- 前端无 `VITE_*` 构建变量，生产同源走 nginx 反代 `/api` → `backend:8010`，SSE 已关缓冲。
- SQLite 在 volume `backend-data`，重启不丢账号与会话。
- 演示账号：`admin` / `nkh@2026`，`test0` / `nkh@2026`。
- 服务器需能访问 B 端地址（容器内网络，勿写 `127.0.0.1` 指宿主机上的 B，应写宿主机局域网 IP 或 `host.docker.internal`）。
- 热点数据：取消注释 `docker-compose.yml` 里 `英文字段.xlsx` 挂载，路径对应容器内 `/workspace/英文字段.xlsx`。
- 纯离线 pip：有网机 `pip download -r backend/requirements.txt -d wheels`，Dockerfile 改为 `pip install --no-index --find-links=wheels -r requirements.txt`；前端优先直接 `docker save` 已构建镜像。
