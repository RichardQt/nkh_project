import { useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  MenuOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Button, Divider, Drawer, Layout, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import ConversationHistory from '../ConversationHistory/ConversationHistory';
import { conversationPath } from '../../services/conversationApi';
import type { ConversationSummary } from '../../types/conversation';
import styles from './AppShell.module.css';

const { Content, Sider } = Layout;

interface SidebarPanelProps {
  activePath: string;
  /** Only on chat detail routes: show history list. */
  showHistory: boolean;
  activeConversationId: string | null;
  onNavigate: (path: string) => void;
  onSelectConversation: (item: ConversationSummary) => void;
  onDeletedConversation: (id: string) => void;
}

function SidebarPanel({
  activePath,
  showHistory,
  activeConversationId,
  onNavigate,
  onSelectConversation,
  onDeletedConversation,
}: SidebarPanelProps) {
  const inConversationDetail = Boolean(activeConversationId);
  const assistantActive =
    (activePath === '/' ||
      activePath === '/chat' ||
      activePath.startsWith('/chat/')) &&
    !inConversationDetail;
  const agentsActive = activePath === '/agents';

  return (
    <div className={styles.sidebarPanel}>
      <Button
        type="text"
        className={styles.brand}
        onClick={() => onNavigate('/')}
        aria-label="返回 AI 创新助手入口"
      >
        <span className={styles.brandMark} aria-hidden="true">
          <RobotOutlined />
        </span>
        <span className={styles.brandText}>
          <Typography.Text strong>AI 创新助手</Typography.Text>
          <Typography.Text type="secondary">专注创新与研发</Typography.Text>
        </span>
      </Button>

      <nav className={styles.navigation} aria-label="主导航">
        {inConversationDetail ? (
          <Button
            type="primary"
            icon={<ArrowLeftOutlined />}
            size="large"
            block
            className={styles.newChatButton}
            onClick={() => onNavigate('/')}
            aria-label="返回智能助手"
          >
            返回
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<RobotOutlined />}
            size="large"
            block
            ghost={!assistantActive}
            className={styles.newChatButton}
            onClick={() => onNavigate('/')}
            aria-current={assistantActive ? 'page' : undefined}
          >
            智能助手
          </Button>
        )}

        <Button
          type="default"
          icon={<AppstoreOutlined />}
          size="large"
          block
          className={`${styles.navEntryButton} ${agentsActive ? styles.navEntryButtonActive : ''}`}
          onClick={() => onNavigate('/agents')}
          aria-current={agentsActive ? 'page' : undefined}
        >
          智能体中心
        </Button>
      </nav>

      {showHistory ? (
        <>
          <Divider className={styles.sidebarDivider} />
          <ConversationHistory
            activeConversationId={activeConversationId}
            onSelect={onSelectConversation}
            onDeleted={onDeletedConversation}
          />
        </>
      ) : (
        <div className={styles.sidebarBlank} aria-hidden="true" />
      )}
    </div>
  );
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const activeConversationId = useMemo(() => {
    const cid = new URLSearchParams(location.search).get('cid')?.trim();
    return cid || null;
  }, [location.search]);

  // History only on chat detail pages (/chat, /chat/:agentKey), not home or agents.
  const showHistory = location.pathname.startsWith('/chat');

  const handleNavigate = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  const handleSelectConversation = (item: ConversationSummary) => {
    setDrawerOpen(false);
    navigate(conversationPath(item));
  };

  const handleDeletedConversation = (id: string) => {
    if (activeConversationId === id) {
      setDrawerOpen(false);
      // Stay on the current chat route; clear cid so ChatPage opens a blank session.
      const params = new URLSearchParams(location.search);
      params.delete('cid');
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : '',
          hash: location.hash,
        },
        { replace: true },
      );
    }
  };

  // 首页、智能体中心与对话页均不展示顶部导航条
  const hideTopbar =
    location.pathname === '/' ||
    location.pathname === '/agents' ||
    location.pathname.startsWith('/chat');

  return (
    <Layout className={styles.appLayout}>
      <Sider width={260} className={styles.desktopSider} theme="light">
        <SidebarPanel
          activePath={location.pathname}
          showHistory={showHistory}
          activeConversationId={activeConversationId}
          onNavigate={handleNavigate}
          onSelectConversation={handleSelectConversation}
          onDeletedConversation={handleDeletedConversation}
        />
      </Sider>

      <Drawer
        open={drawerOpen}
        placement="left"
        size={260}
        closable={false}
        onClose={() => setDrawerOpen(false)}
        className={styles.mobileDrawer}
        styles={{ body: { padding: 0 } }}
      >
        <SidebarPanel
          activePath={location.pathname}
          showHistory={showHistory}
          activeConversationId={activeConversationId}
          onNavigate={handleNavigate}
          onSelectConversation={handleSelectConversation}
          onDeletedConversation={handleDeletedConversation}
        />
      </Drawer>

      <Layout className={styles.mainLayout}>
        {hideTopbar && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            className={styles.homeMobileMenuButton}
            onClick={() => setDrawerOpen(true)}
            aria-label="打开主导航"
          />
        )}

        <Content
          className={`${styles.content} ${hideTopbar ? styles.contentFullHeight : ''}`}
        >
          <div className={styles.routeFrame}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
