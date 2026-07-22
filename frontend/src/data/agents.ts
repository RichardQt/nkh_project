import type { AgentDefinition, AgentKey } from '../types/agent';

export const agents: readonly AgentDefinition[] = [
  {
    key: 'achievement_match',
    shortName: '成果匹配',
    name: '成果匹配助手',
    description: '把技术成果与应用场景、产业需求快速对齐。',
    detail:
      '围绕成果能力、适用边界与目标场景，匹配更合适的落地方向、合作入口与验证路径。',
    placeholder: '请描述技术成果、能力优势或目标场景，Enter 发送，Shift + Enter 换行',
    greeting:
      '告诉我你的技术成果或能力画像，我会帮你匹配更合适的应用场景与落地方向。',
    prompts: [
      '这项新材料成果适合进入哪些应用场景？',
      '如何把实验室成果转化为可对接的产业需求？',
      '评估某项检测技术与制造场景的匹配度。',
      '怎样判断一个成果是否具备首轮试点价值？',
    ],
  },
  {
    key: 'expert_recommend',
    shortName: '专家推荐',
    name: '专家推荐助手',
    description: '按任务目标推荐合适的专家与能力组合。',
    detail:
      '根据技术方向、问题阶段与合作目标，梳理专家画像、筛选维度与对接建议。',
    placeholder: '请输入技术方向、任务目标或专家需求，Enter 发送，Shift + Enter 换行',
    greeting:
      '描述你的技术方向与任务目标，我会帮你梳理需要什么样的专家以及如何筛选。',
    prompts: [
      '推荐先进复合材料方向的产学研专家画像。',
      '如何筛选适合联合攻关的技术专家？',
      '解决高温合金失效问题需要哪些专家能力？',
      '怎样设计一份高质量的专家对接需求？',
    ],
  },
  {
    key: 'tech_partner',
    shortName: '技术合作',
    name: '技术合作助手',
    description: '匹配合作能力，设计可执行的协同路径。',
    detail:
      '解析技术需求与资源约束，形成合作方画像、筛选标准、验证任务与合作推进方案。',
    placeholder: '请描述技术需求与合作目标，Enter 发送，Shift + Enter 换行',
    greeting:
      '描述你的技术需求与合作目标，我会帮你梳理伙伴画像、筛选标准和推进路径。',
    prompts: [
      '寻找新能源材料方向的高校合作团队。',
      '如何设计一份高质量的产学研合作需求？',
      '评估联合实验室合作模式的关键风险。',
      '怎样把技术需求转化为可对接的合作任务？',
    ],
  },
  {
    key: 'precision_growth',
    shortName: '精准拓客',
    name: '精准拓客助手',
    description: '识别高匹配客户，规划验证与触达策略。',
    detail:
      '从成果能力和应用场景出发识别目标行业、企业画像、业务痛点及首轮验证切入点。',
    placeholder: '请输入成果能力或目标市场，Enter 发送，Shift + Enter 换行',
    greeting:
      '提供你的技术成果或产品能力，我会帮你定位更匹配的客户场景和验证入口。',
    prompts: [
      '为工业视觉检测方案寻找潜在客户。',
      '分析这项储能技术最适合进入哪些行业。',
      '如何制定技术型产品的首轮客户验证计划？',
      '怎样识别真正有采购意向的企业信号？',
    ],
  },
  {
    key: 'demand_forecast',
    shortName: '需求预测',
    name: '需求预测助手',
    description: '研判产业信号与未来需求出现的窗口。',
    detail:
      '结合政策、投资、产能、招聘和采购等领先指标，判断产业需求变化及行动时机。',
    placeholder: '请输入行业或企业方向，Enter 发送，Shift + Enter 换行',
    greeting:
      '输入行业、企业或产品方向，我会帮你梳理需求信号、验证指标和可能的时间窗口。',
    prompts: [
      '预测人形机器人核心零部件的需求变化。',
      '哪些信号说明企业即将启动数字化改造？',
      '分析未来两年高端传感器的潜在需求。',
      '如何区分真实采购需求与短期市场噪声？',
    ],
  },
  {
    key: 'policy_service',
    shortName: '政策服务',
    name: '政策服务助手',
    description: '梳理科创政策、申报路径与合规要点。',
    detail:
      '围绕产业政策、项目申报、资助条件与合规边界，帮助形成可执行的政策利用方案。',
    placeholder: '请输入政策主题、申报目标或企业条件，Enter 发送，Shift + Enter 换行',
    greeting:
      '告诉我你的政策关注点或申报目标，我会帮你梳理适用政策、条件与推进步骤。',
    prompts: [
      '梳理人工智能与制造业融合相关支持政策。',
      '中小科技企业有哪些常见的项目申报路径？',
      '如何判断一个项目是否符合专项资助条件？',
      '准备政策申报材料时应注意哪些关键信息？',
    ],
  },
  {
    key: 'innovation_resources',
    shortName: '科创资源',
    name: '科创资源助手',
    description: '汇聚成果、项目、企业与平台等资源线索。',
    detail:
      '围绕明确目标组织多类科技创新资源，给出筛选依据、价值判断与后续使用建议。',
    placeholder: '请输入资源目标与筛选条件，Enter 发送，Shift + Enter 换行',
    greeting:
      '告诉我你的目标与筛选条件，我会帮你组织需要寻找的科创资源与使用建议。',
    prompts: [
      '如何建立一个项目申报资源清单？',
      '按技术方向整理可利用的科创资源类型。',
      '寻找先进制造方向的平台与载体线索。',
      '怎样评估一条科创资源线索的可信度？',
    ],
  },
] as const;

export const defaultAgent = agents[0];

export function getAgent(key?: string): AgentDefinition {
  return agents.find((agent) => agent.key === key) ?? defaultAgent;
}

export function isAgentKey(value: string): value is AgentKey {
  return agents.some((agent) => agent.key === value);
}
