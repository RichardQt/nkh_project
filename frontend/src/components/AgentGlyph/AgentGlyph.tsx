import {
  AimOutlined,
  BankOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { Avatar } from 'antd';
import type { AgentKey } from '../../types/agent';
import styles from './AgentGlyph.module.css';

interface AgentGlyphProps {
  agentKey: AgentKey;
  size?: 'small' | 'medium' | 'large';
  active?: boolean;
}

const glyphs = {
  achievement_match: ClusterOutlined,
  expert_recommend: UserSwitchOutlined,
  tech_partner: TeamOutlined,
  precision_growth: AimOutlined,
  demand_forecast: LineChartOutlined,
  policy_service: BankOutlined,
  innovation_resources: DatabaseOutlined,
} satisfies Record<AgentKey, typeof SolutionOutlined>;

const sizes = {
  small: 22,
  medium: 42,
  large: 48,
} as const;

export default function AgentGlyph({
  agentKey,
  size = 'medium',
  active = false,
}: AgentGlyphProps) {
  const Glyph = glyphs[agentKey];

  return (
    <Avatar
      shape="square"
      size={sizes[size]}
      icon={<Glyph />}
      className={`${styles.glyph} ${styles[size]} ${active ? styles.active : ''}`}
    />
  );
}
