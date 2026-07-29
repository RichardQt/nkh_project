import type { AgentDefinition, AgentKey } from '../types/agent';

/**
 * 首页能力入口 + 智能体中心卡片：
 * 上：政策推荐｜成果评估｜研究方向
 * 下：成果发现｜专家发现｜需求发现｜企业发现｜平台发现
 */
export const agents: readonly AgentDefinition[] = [
  {
    key: 'policy_recommend',
    label: '政策推荐',
    description: '匹配适用政策与申报路径，为创新决策提供清晰依据。',
  },
  {
    key: 'achievement_eval',
    label: '成果评估',
    description: '评估成果成熟度与转化价值，给出可执行改进建议。',
  },
  {
    key: 'research_direction',
    label: '研究方向',
    description: '梳理前沿方向与研究空白，辅助选题与布局。',
  },
  {
    key: 'achievement_discover',
    label: '成果发现',
    description: '检索相关成果与技术线索，快速定位可转化资源。',
  },
  {
    key: 'expert_discover',
    label: '专家发现',
    description: '按领域与能力匹配专家，便于合作对接。',
  },
  {
    key: 'demand_discover',
    label: '需求发现',
    description: '发现产业与企业真实需求，对接创新供给。',
  },
  {
    key: 'enterprise_discover',
    label: '企业发现',
    description: '定位目标企业与合作伙伴，支持精准触达。',
  },
  {
    key: 'platform_discover',
    label: '平台发现',
    description: '发现科研与产业服务平台，整合创新要素。',
  },
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
