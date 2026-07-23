import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import AppShell from './components/AppShell/AppShell';
import { isAgentKey } from './data/agents';

const HomePage = lazy(() => import('./pages/HomePage/HomePage'));
const ChatPage = lazy(() => import('./pages/ChatPage/ChatPage'));

function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="route-loading" aria-label="页面加载中">
          <Spin size="small" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** 带场景 key 的对话：/chat/:agentKey */
function SceneChatRoute() {
  const { agentKey } = useParams();

  if (!agentKey || !isAgentKey(agentKey)) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageBoundary>
      <ChatPage key={agentKey} agentKey={agentKey} />
    </PageBoundary>
  );
}

/** 未选场景的通用对话：/chat */
function GeneralChatRoute() {
  return (
    <PageBoundary>
      <ChatPage key="general" agentKey={null} />
    </PageBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <PageBoundary>
              <HomePage />
            </PageBoundary>
          }
        />
        {/* 旧智能体中心入口重定向首页 */}
        <Route path="agents" element={<Navigate to="/" replace />} />
        <Route path="chat" element={<GeneralChatRoute />} />
        <Route path="chat/:agentKey" element={<SceneChatRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
