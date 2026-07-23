# AI 创新助手

基于 Google Stitch 模板「AI 创新助手 R&D Innovation Platform」实现的三页 AI 产品原型。界面只使用 Ant Design 6 与 Ant Design X 2，保留固定侧栏、冷白画布、钴蓝主色和克制的企业级动效。

## 技术方案

### 前端

- Vite 8 + React 19 + TypeScript 7
- React Router 7
- Ant Design 6
- Ant Design X 2：`Sender`、`Prompts`、`Welcome`、`Bubble.List`、`ThoughtChain`、`Actions`、`XProvider`
- `@ant-design/x-markdown`：流式 Markdown 渲染
- `@ant-design/x-sdk`：标准 SSE 请求与中止控制
- `motion/react`：页面入场、智能体切换和推荐问题下推动画
- CSS Modules + Ant Design 主题令牌

没有引入 Kumo UI、shadcn、Tailwind、额外状态库或请求库。

### 后端（Backend A）

- FastAPI + Uvicorn + httpx
- 前端只调 Backend A：`POST /api/chat/stream`
- Backend A 再调 Backend B 的 SSE：`POST {BACKEND_B}/api/chat/stream`，JSON body：`query` / `session_id` / `function`
- 上游事件：`token`（思维链）+ `related_entries`（列表）
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

系统不包含登录、账户、用户资料、历史记录、设置、模型选择、供应商选择或 API Key 管理界面。

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

- `GET /api/health`
- `GET /api/functions`：查看 function 映射与当前字段投影
- `POST /api/chat/stream`：SSE 代理

流式请求示例：

```json
{
  "agentKey": "achievement_discover",
  "message": "自凝胶止血粉你了解么",
  "sessionId": "1"
}
```

SSE 依次返回：

1. `meta`：sessionId / function / fields（字段元数据）
2. 多个 `token`：思维链文本（前端 `Think` 组件）
3. `related_entries`：投影后的列表（前端 Ant Design `List`）
4. `done`

场景 `agentKey` → Backend B `function` 映射示例：

| agentKey | function |
|----------|----------|
| achievement_discover | achievements |
| expert_discover | experts |
| demand_discover | demands |
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
