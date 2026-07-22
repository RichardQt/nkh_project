import type { AgentDefinition, AgentKey } from '../types/agent';

export const agents: readonly AgentDefinition[] = [
  {
    key: 'rd_qa',
    shortName: '研发问答',
    name: '研发问答助手',
    description: '拆解技术难题，形成可验证的研发路径。',
    detail:
      '围绕材料、工艺、结构与测试等研发问题，梳理关键机理、验证变量和下一步行动。',
    placeholder: '请输入研发技术问题，Enter 发送，Shift + Enter 换行',
    greeting:
      '研发难题卡住了？我会帮你拆解技术问题，梳理关键机理，并给出清晰的验证路径。',
    prompts: [
      '怎样提高高分子材料的耐老化性能？',
      '如何提升光伏发电系统的能量转化效率？',
      '如何有效增强高温合金的抗蠕变性能？',
      '如何设计一套新材料技术路线的验证方案？',
    ],
  },
  {
    key: 'tech_scout',
    shortName: '技术预研',
    name: '技术预研助手',
    description: '洞察技术现状、演进路线与突破窗口。',
    detail:
      '聚合技术路线、产业动向和竞争格局，辅助判断方向价值、技术成熟度与布局时机。',
    placeholder: '请输入预研方向或技术主题，Enter 发送，Shift + Enter 换行',
    greeting:
      '告诉我你关注的技术方向，我会从现状、趋势、成熟度和潜在机会展开预研。',
    prompts: [
      '固态电池近三年的关键技术路线有哪些？',
      '具身智能传感器的发展趋势是什么？',
      '评估低空经济中的高价值技术机会。',
      '如何判断一项新兴技术是否进入布局窗口？',
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
    key: 'innovation_resources',
    shortName: '科创资源',
    name: '科创资源助手',
    description: '汇聚专家、成果、项目、企业与政策线索。',
    detail:
      '围绕明确目标组织多类科技创新资源，给出筛选依据、价值判断与后续使用建议。',
    placeholder: '请输入资源目标与筛选条件，Enter 发送，Shift + Enter 换行',
    greeting:
      '告诉我你的目标与筛选条件，我会帮你组织需要寻找的专家、成果、项目和政策资源。',
    prompts: [
      '梳理人工智能与制造业融合相关政策。',
      '寻找先进复合材料领域的专家与成果线索。',
      '如何建立一个项目申报资源清单？',
      '按技术方向整理可利用的科创资源类型。',
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

