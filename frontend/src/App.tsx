import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import AppShell from './components/AppShell/AppShell';
import { isAgentKey } from './data/agents';

const HomePage = lazy(() => import('./pages/HomePage/HomePage'));
const AgentCenterPage = lazy(
  () => import('./pages/AgentCenterPage/AgentCenterPage'),
);
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

/** Specialist agent conversation: /chat/:agentKey */
function AgentChatRoute() {
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

/** General conversation without a specialist agent: /chat */
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
        <Route
          path="agents"
          element={
            <PageBoundary>
              <AgentCenterPage />
            </PageBoundary>
          }
        />
        <Route path="chat" element={<GeneralChatRoute />} />
        <Route path="chat/:agentKey" element={<AgentChatRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
