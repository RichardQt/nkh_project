/** 首页能力入口 / 智能体中心 key（场景标识）。 */
export type AgentKey =
  | 'policy_recommend'
  | 'achievement_eval'
  | 'research_direction'
  | 'achievement_discover'
  | 'expert_discover'
  | 'demand_discover'
  | 'enterprise_discover'
  | 'platform_discover';

/** 导航与智能体中心展示字段。 */
export interface AgentDefinition {
  key: AgentKey;
  /** 按钮文案，如「政策推荐」 */
  label: string;
  /** 智能体中心卡片副文案 */
  description: string;
}
