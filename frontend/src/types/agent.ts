/** 首页能力入口 key（仅作场景标识，不再是智能体人设）。 */
export type AgentKey =
  | 'policy_recommend'
  | 'achievement_eval'
  | 'research_direction'
  | 'achievement_discover'
  | 'expert_discover'
  | 'demand_discover'
  | 'enterprise_discover'
  | 'platform_discover';

/** 导航项：只保留界面展示所需字段。 */
export interface AgentDefinition {
  key: AgentKey;
  /** 按钮文案，如「政策推荐」 */
  label: string;
}
