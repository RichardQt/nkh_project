import { useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  MenuOutlined,
  RobotOutlined,
  ShareAltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Divider, Drawer, Layout, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
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
  showKnowledgeBase: boolean;
  username: string;
  roleLabel: string;
  onNavigate: (path: string) => void;
  onSelectConversation: (item: ConversationSummary) => void;
  onDeletedConversation: (id: string) => void;
  onLogout: () => void;
}

function SidebarPanel({
  activePath,
  showHistory,
  activeConversationId,
  showKnowledgeBase,
  username,
  roleLabel,
  onNavigate,
  onSelectConversation,
  onDeletedConversation,
  onLogout,
}: SidebarPanelProps) {
  const inConversationDetail = Boolean(activeConversationId);
  const assistantActive =
    (activePath === '/' ||
      activePath === '/chat' ||
      activePath.startsWith('/chat/')) &&
    !inConversationDetail;
  const agentsActive = activePath === '/agents';
  const kgActive =
    activePath === '/knowledge-graph' ||
    activePath.startsWith('/knowledge-graph/');
  const kbActive =
    activePath === '/knowledge-base' ||
    activePath.startsWith('/knowledge-base/');

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

        <Button
          type="default"
          icon={<ShareAltOutlined />}
          size="large"
          block
          className={`${styles.navEntryButton} ${kgActive ? styles.navEntryButtonActive : ''}`}
          onClick={() => onNavigate('/knowledge-graph')}
          aria-current={kgActive ? 'page' : undefined}
        >
          知识图谱
        </Button>

        {showKnowledgeBase ? (
          <Button
            type="default"
            icon={<DatabaseOutlined />}
            size="large"
            block
            className={`${styles.navEntryButton} ${kbActive ? styles.navEntryButtonActive : ''}`}
            onClick={() => onNavigate('/knowledge-base')}
            aria-current={kbActive ? 'page' : undefined}
          >
            知识库设置
          </Button>
        ) : null}
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

      <div className={styles.userFooter}>
        <div className={styles.userMeta}>
          <span className={styles.userAvatar} aria-hidden="true">
            <UserOutlined />
          </span>
          <span className={styles.userText}>
            <Typography.Text className={styles.userName} ellipsis>
              {username}
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.userRole}>
              {roleLabel}
            </Typography.Text>
          </span>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          className={styles.logoutButton}
          onClick={onLogout}
          aria-label="退出登录"
        >
          退出
        </Button>
      </div>
    </div>
  );
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const activeConversationId = useMemo(() => {
    const cid = new URLSearchParams(location.search).get('cid')?.trim();
    return cid || null;
  }, [location.search]);

  // History only on chat detail pages (/chat, /chat/:agentKey), not home or agents.
  const showHistory = location.pathname.startsWith('/chat');
  const showKnowledgeBase = user?.role === 'admin';
  const username = user?.username ?? '';
  const roleLabel = user?.role === 'admin' ? '管理员' : '普通用户';

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

  const handleLogout = async () => {
    setDrawerOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  // 首页、智能体中心与对话页均不展示顶部导航条
  const hideTopbar =
    location.pathname === '/' ||
    location.pathname === '/agents' ||
    location.pathname.startsWith('/chat');

  const sidebarProps = {
    activePath: location.pathname,
    showHistory,
    activeConversationId,
    showKnowledgeBase,
    username,
    roleLabel,
    onNavigate: handleNavigate,
    onSelectConversation: handleSelectConversation,
    onDeletedConversation: handleDeletedConversation,
    onLogout: () => {
      void handleLogout();
    },
  };

  return (
    <Layout className={styles.appLayout}>
      <Sider width={260} className={styles.desktopSider} theme="light">
        <SidebarPanel {...sidebarProps} />
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
        <SidebarPanel {...sidebarProps} />
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
