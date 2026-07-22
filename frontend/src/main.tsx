import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { XProvider } from '@ant-design/x';
import zhCNX from '@ant-design/x/locale/zh_CN';
import zhCN from 'antd/locale/zh_CN';
import '@ant-design/x-markdown/themes/light.css';
import 'antd/dist/reset.css';
import App from './App';
import './styles/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('应用挂载节点不存在');
}

createRoot(root).render(
  <XProvider
    locale={{ ...zhCN, ...zhCNX }}
    theme={{
      cssVar: { prefix: 'rd' },
      hashed: false,
      token: {
        colorPrimary: '#356df3',
        colorInfo: '#356df3',
        colorBgBase: '#ffffff',
        colorBgLayout: '#f4f7fb',
        colorBgContainer: '#ffffff',
        colorText: '#181c1f',
        colorTextSecondary: '#667085',
        colorBorder: '#dde5f0',
        colorBorderSecondary: '#e8eef6',
        borderRadius: 10,
        borderRadiusLG: 14,
        controlHeight: 40,
        fontSize: 14,
        fontFamily:
          'Inter, MiSans, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      },
      components: {
        Button: {
          borderRadius: 8,
          fontWeight: 500,
          primaryShadow: 'none',
        },
        Card: {
          borderRadiusLG: 14,
          boxShadowTertiary: '0 8px 28px rgba(24, 28, 31, 0.05)',
        },
        Layout: {
          bodyBg: '#f4f7fb',
          headerBg: '#ffffff',
          siderBg: '#ffffff',
        },
      },
    }}
  >
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </XProvider>,
);
