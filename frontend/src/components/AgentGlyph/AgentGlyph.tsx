import {
  AimOutlined,
  BankOutlined,
  ClusterOutlined,
  CompassOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  ShopOutlined,
  SolutionOutlined,
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
  policy_recommend: BankOutlined,
  achievement_eval: ExperimentOutlined,
  research_direction: CompassOutlined,
  achievement_discover: ClusterOutlined,
  expert_discover: UserSwitchOutlined,
  demand_discover: LineChartOutlined,
  enterprise_discover: ShopOutlined,
  platform_discover: DatabaseOutlined,
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
  const Glyph = glyphs[agentKey] ?? AimOutlined;

  return (
    <Avatar
      shape="square"
      size={sizes[size]}
      icon={<Glyph />}
      className={`${styles.glyph} ${styles[size]} ${active ? styles.active : ''}`}
    />
  );
}
