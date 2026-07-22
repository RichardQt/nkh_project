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

### 后端

- FastAPI
- Uvicorn
- Python 标准库生成标准 SSE 数据流

后端目前提供确定性的流式演示回答，接口结构已经与前端解耦。接入固定的真实 AI 服务时，只需替换 `backend/app/main.py` 内部回答生成逻辑，不需要增加账户、设置或模型配置页面。

## 页面

- `/`：AI 总入口。六个智能体可切换，输入框保持居中；聚焦输入框后，推荐问题面板从下方向下展开。
- `/agents`：智能体中心。展示六个智能体的能力与适用范围，点击整张卡片进入独立对话。
- `/chat/:agentKey`：对话页面。包含欢迎引导、三条推荐问题、流式回答、公开任务进度、复制、重新生成与停止生成。

六个固定智能体：

1. 研发问答
2. 技术预研
3. 技术合作
4. 精准拓客
5. 需求预测
6. 科创资源

系统不包含登录、账户、用户资料、历史记录、设置、模型选择、供应商选择或 API Key 管理界面。

## 本地启动

先启动后端：

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

## 接口

- `GET /api/health`
- `GET /api/agents`
- `POST /api/chat/stream`

智能体展示文案目前由前端静态定义，以保证模板原型无需等待接口即可渲染；`GET /api/agents` 作为后续改为后端单一数据源时的预留接口。

流式请求示例：

```json
{
  "agentKey": "rd_qa",
  "message": "如何提升材料耐久性？"
}
```

SSE 依次返回 `meta`、多个 `delta` 和 `done` 事件。

## 构建验证

```powershell
cd D:\mynj\nkh_project\frontend
npm run build

cd D:\mynj\nkh_project\backend
python -m compileall app
```
