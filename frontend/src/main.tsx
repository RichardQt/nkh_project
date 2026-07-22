import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { XProvider } from '@ant-design/x';
import zhCNX from '@ant-design/x/locale/zh_CN';
import zhCN from 'antd/locale/zh_CN';
import '@ant-design/x-markdown/themes/light.css';
import '@fontsource-variable/outfit/wght.css';
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
        colorPrimary: '#2b5cff',
        colorInfo: '#2b5cff',
        colorBgBase: '#ffffff',
        colorBgLayout: '#f4f5f7',
        colorBgContainer: '#ffffff',
        colorText: '#111827',
        colorTextSecondary: '#5b6472',
        colorBorder: 'rgba(17, 24, 39, 0.1)',
        colorBorderSecondary: 'rgba(17, 24, 39, 0.06)',
        borderRadius: 10,
        borderRadiusLG: 14,
        controlHeight: 40,
        fontSize: 14,
        fontFamily:
          '"Outfit Variable", Outfit, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        boxShadowTertiary: '0 10px 28px rgba(17, 24, 39, 0.05)',
      },
      components: {
        Button: {
          borderRadius: 10,
          fontWeight: 500,
          primaryShadow: 'none',
        },
        Card: {
          borderRadiusLG: 14,
          boxShadowTertiary: '0 10px 28px rgba(17, 24, 39, 0.05)',
        },
        Layout: {
          bodyBg: '#f4f5f7',
          headerBg: 'rgba(255, 255, 255, 0.82)',
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
