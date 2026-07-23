import type { AgentDefinition, AgentKey } from '../types/agent';

/**
 * 首页能力入口（非智能体）：
 * 上：政策推荐｜成果评估｜研究方向
 * 下：成果发现｜专家发现｜需求发现｜企业发现｜平台发现
 */
export const agents: readonly AgentDefinition[] = [
  { key: 'policy_recommend', label: '政策推荐' },
  { key: 'achievement_eval', label: '成果评估' },
  { key: 'research_direction', label: '研究方向' },
  { key: 'achievement_discover', label: '成果发现' },
  { key: 'expert_discover', label: '专家发现' },
  { key: 'demand_discover', label: '需求发现' },
  { key: 'enterprise_discover', label: '企业发现' },
  { key: 'platform_discover', label: '平台发现' },
] as const;

export const homeNavTopKeys: readonly AgentKey[] = [
  'policy_recommend',
  'achievement_eval',
  'research_direction',
] as const;

export const homeNavBottomKeys: readonly AgentKey[] = [
  'achievement_discover',
  'expert_discover',
  'demand_discover',
  'enterprise_discover',
  'platform_discover',
] as const;

export const defaultAgent = agents[0];

export function getAgent(key?: string): AgentDefinition {
  return agents.find((item) => item.key === key) ?? defaultAgent;
}

export function isAgentKey(value: string): value is AgentKey {
  return agents.some((item) => item.key === value);
}
