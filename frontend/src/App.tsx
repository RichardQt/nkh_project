import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import RequireAdmin from './auth/RequireAdmin';
import RequireAuth from './auth/RequireAuth';
import AppShell from './components/AppShell/AppShell';
import { ChatStreamProvider } from './context/ChatStreamContext';
import { isAgentKey } from './data/agents';

const HomePage = lazy(() => import('./pages/HomePage/HomePage'));
const AgentCenterPage = lazy(
  () => import('./pages/AgentCenterPage/AgentCenterPage'),
);
const ChatPage = lazy(() => import('./pages/ChatPage/ChatPage'));
const KnowledgeGraphPage = lazy(
  () => import('./pages/KnowledgeGraphPage/KnowledgeGraphPage'),
);
const KnowledgeBasePage = lazy(
  () => import('./pages/KnowledgeBasePage/KnowledgeBasePage'),
);
const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage'));

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
      <Route
        path="/login"
        element={
          <PageBoundary>
            <LoginPage />
          </PageBoundary>
        }
      />

      <Route element={<RequireAuth />}>
        <Route
          element={
            <ChatStreamProvider>
              <AppShell />
            </ChatStreamProvider>
          }
        >
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
          <Route
            path="knowledge-graph"
            element={
              <PageBoundary>
                <KnowledgeGraphPage />
              </PageBoundary>
            }
          />
          <Route
            path="knowledge-base"
            element={
              <PageBoundary>
                <RequireAdmin>
                  <KnowledgeBasePage />
                </RequireAdmin>
              </PageBoundary>
            }
          />
          <Route path="chat" element={<GeneralChatRoute />} />
          <Route path="chat/:agentKey" element={<SceneChatRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
