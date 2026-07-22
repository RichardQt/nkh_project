import { useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  MenuOutlined,
  PlusOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Button, Divider, Drawer, Layout, Space, Typography } from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getAgent } from '../../data/agents';
import styles from './AppShell.module.css';

const { Content, Header, Sider } = Layout;

interface SidebarPanelProps {
  activePath: string;
  onNavigate: (path: string) => void;
}

function SidebarPanel({ activePath, onNavigate }: SidebarPanelProps) {
  const centerActive = activePath.startsWith('/agents');
  const newChatActive = activePath === '/' || activePath.startsWith('/chat/');

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
          <Typography.Text strong>AI 助手</Typography.Text>
          <Typography.Text type="secondary">专注创新与研发</Typography.Text>
        </span>
      </Button>

      <nav className={styles.navigation} aria-label="主导航">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          block
          ghost={!newChatActive}
          className={styles.newChatButton}
          onClick={() => onNavigate('/')}
        >
          新建对话
        </Button>

        <Button
          type="text"
          icon={<AppstoreOutlined />}
          block
          className={`${styles.navButton} ${centerActive ? styles.navButtonActive : ''}`}
          onClick={() => onNavigate('/agents')}
        >
          智能体中心
        </Button>
      </nav>

      <Divider className={styles.sidebarDivider} />
      <div className={styles.sidebarBlank} aria-hidden="true" />
    </div>
  );
}

function resolvePageTitle(pathname: string) {
  if (pathname === '/agents') {
    return '智能体中心';
  }

  if (pathname.startsWith('/chat/')) {
    const key = pathname.split('/')[2];
    return getAgent(key).name;
  }

  return 'AI 助手';
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const title = useMemo(
    () => resolvePageTitle(location.pathname),
    [location.pathname],
  );

  const handleNavigate = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  return (
    <Layout className={styles.appLayout}>
      <Sider width={260} className={styles.desktopSider} theme="light">
        <SidebarPanel
          activePath={location.pathname}
          onNavigate={handleNavigate}
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
          onNavigate={handleNavigate}
        />
      </Drawer>

      <Layout className={styles.mainLayout}>
        <Header className={styles.topbar}>
          <Space size={12}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              className={styles.mobileMenuButton}
              onClick={() => setDrawerOpen(true)}
              aria-label="打开主导航"
            />
            <Typography.Title level={1} className={styles.pageTitle}>
              {title}
            </Typography.Title>
          </Space>
        </Header>

        <Content className={styles.content}>
          <motion.div
            className={styles.routeFrame}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  );
}
