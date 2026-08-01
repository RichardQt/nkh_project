import { useMemo, useState } from 'react';
import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MenuOutlined,
  RobotOutlined,
  ShareAltOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Divider, Drawer, Layout, Modal, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import ConversationHistory from '../ConversationHistory/ConversationHistory';
import { conversationPath } from '../../services/conversationApi';
import { useChatStream } from '../../context/ChatStreamContext';
import type { ConversationSummary } from '../../types/conversation';
import styles from './AppShell.module.css';

const { Content, Sider } = Layout;

interface SidebarPanelProps {
  activePath: string;
  activeConversationId: string | null;
  showKnowledgeBase: boolean;
  showModelConfig: boolean;
  showSensitiveWords: boolean;
  username: string;
  roleLabel: string;
  onNavigate: (path: string) => void;
  onSelectConversation: (item: ConversationSummary) => void;
  onDeletedConversation: (id: string) => void;
  onLogout: () => void;
}

function SidebarPanel({
  activePath,
  activeConversationId,
  showKnowledgeBase,
  showModelConfig,
  showSensitiveWords,
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
  const personaActive =
    activePath === '/user-persona' ||
    activePath.startsWith('/user-persona/');
  const kbActive =
    activePath === '/knowledge-base' ||
    activePath.startsWith('/knowledge-base/');
  const modelConfigActive =
    activePath === '/model-config' ||
    activePath.startsWith('/model-config/');
  const sensitiveWordsActive =
    activePath === '/sensitive-words' ||
    activePath.startsWith('/sensitive-words/');

  return (
    <div className={styles.sidebarPanel}>
      <Button
        type="text"
        className={styles.brand}
        onClick={() => onNavigate('/')}
        aria-label="返回宁科荟智能助手入口"
      >
        <span className={styles.brandMark} aria-hidden="true">
          <RobotOutlined />
        </span>
        <span className={styles.brandText}>
          <Typography.Text strong>宁科荟智能助手</Typography.Text>
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

        <Button
          type="default"
          icon={<IdcardOutlined />}
          size="large"
          block
          className={`${styles.navEntryButton} ${personaActive ? styles.navEntryButtonActive : ''}`}
          onClick={() => onNavigate('/user-persona')}
          aria-current={personaActive ? 'page' : undefined}
        >
          用户画像
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

        {showModelConfig ? (
          <Button
            type="default"
            icon={<ApiOutlined />}
            size="large"
            block
            className={`${styles.navEntryButton} ${modelConfigActive ? styles.navEntryButtonActive : ''}`}
            onClick={() => onNavigate('/model-config')}
            aria-current={modelConfigActive ? 'page' : undefined}
          >
            模型配置
          </Button>
        ) : null}

        {showSensitiveWords ? (
          <Button
            type="default"
            icon={<StopOutlined />}
            size="large"
            block
            className={`${styles.navEntryButton} ${sensitiveWordsActive ? styles.navEntryButtonActive : ''}`}
            onClick={() => onNavigate('/sensitive-words')}
            aria-current={sensitiveWordsActive ? 'page' : undefined}
          >
            敏感词
          </Button>
        ) : null}
      </nav>

      <Divider className={styles.sidebarDivider} />
      <ConversationHistory
        activeConversationId={activeConversationId}
        onSelect={onSelectConversation}
        onDeleted={onDeletedConversation}
      />

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
  const showKnowledgeBase = user?.role === 'admin';
  const showModelConfig = user?.role === 'admin';
  const showSensitiveWords = user?.role === 'admin';
  const username = user?.username ?? '';
  const roleLabel = user?.role === 'admin' ? '管理员' : '普通用户';

  const { isRequesting } = useChatStream();

  const confirmLeaveStream = (onConfirm: () => void) => {
    if (!isRequesting) {
      onConfirm();
      return;
    }
    Modal.confirm({
      title: '离开会中断对话',
      content: '当前 AI 正在回答中，离开后本次回答将停止。确定离开吗？',
      okText: '确定离开',
      cancelText: '继续等待',
      okButtonProps: { danger: true },
      onOk: onConfirm,
    });
  };

  const handleNavigate = (path: string) => {
    confirmLeaveStream(() => {
      setDrawerOpen(false);
      navigate(path);
    });
  };

  const handleSelectConversation = (item: ConversationSummary) => {
    confirmLeaveStream(() => {
      setDrawerOpen(false);
      navigate(conversationPath(item));
    });
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
    activeConversationId,
    showKnowledgeBase,
    showModelConfig,
    showSensitiveWords,
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
