import type { RelatedEntriesPayload } from "../types/chat";
import type {
	AchievementEvalResult,
	PolicyRecommendResult,
	ResearchDirectionResult,
	SearchResultItem,
	SceneMockAgentKey,
	SceneResult,
} from "../types/scene";

/** Shared content placeholder for later manual replacement. */
export const PLACEHOLDER = "【这是一个占位符号】";

/**
 * Excel「专家团队」sheet 第 6 行（序号 5）：
 * 宁科荟智能助手部分数据模板.xlsx
 */
export const RESEARCH_EXPERT_ROW = {
	expert_team_name: "南京理工大学-张轶哲团队",
	team_leader: "张轶哲",
	expertise_areas: "医学图像分析、人工智能",
	primary_technology_field: "",
	secondary_technology_field: "",
	affiliated_university: "",
	publisher: "南京理工大学小分队",
	team_size: "16",
	team_introduction: "教师团队：5\n在读学生：10",
	representative_achievements:
		"医学图像分析，医学多模态信息分析，报告生成，质量控制，疾病诊断， 治疗方案规划，手术导航，智慧中医",
	recommend_reason:
		"该团队的研究方向与研究院“智慧医疗”的战略布局高度契合。团队专注于生物医学图像处理与分析、机器学习、大模型应用及多模态信号处理等，这与研究院将“边缘智能和大模型为核心技术底座”应用于医疗检测的方向一致。其技术能直接赋能研究院的“人工智能服务平台”，为智慧医疗方案提供核心算法支持；",
} as const;

export const RESEARCH_DIRECTION_THINKING = `基于公开信息，边缘智能研究院南京有限公司（以下简称“研究院”）的未来研发方向可概括为：以“边缘智能+大模型”为核心技术底座，在持续深耕智慧医疗、工业物联网等既有优势领域的同时，积极拓展具身智能、智能网联汽车、自主可控通信等前沿新兴赛道。`;

export interface ResearchSummaryPillar {
	title: string;
	body: string;
}

export const RESEARCH_DIRECTION_SUMMARY_LEAD =
	"研究院将立足于现有的“边缘智能终端、人工智能服务平台和埃启智能操作系统”三大核心技术支柱，向更前沿、更深入的技术领域进军。";

export const RESEARCH_DIRECTION_SUMMARY_PILLARS: ResearchSummaryPillar[] = [
	{
		title: "突破前沿技术",
		body: "研究院计划重点突破多模态信息的智能处理、智能标识网络理论与构建方法，以及云边端一体化等前沿技术。这意味着未来的设备将能更智能地融合处理文本、图像、视频等多种信息，并实现云端、边缘端和设备端的无缝协同。",
	},
	{
		title: "打造AI新基座",
		body: "研究院发布了EdgeOS系统官网和埃启·云脑两款新品。其中，“埃启·云脑”旨在打造一个算法生态中枢，通过内置覆盖车辆检测、校园安全、智慧工业、医疗检测等场景的算法卡片库，实现算法的统一管理和便捷部署。这相当于构建了一个“算法商城”，目标是打通AI落地的“最后一公里”。",
	},
	{
		title: "攻关自主可控通信",
		body: "作为“新一代自主可控智能通信网络创新联合体”的重要成员，研究院将参与攻关多维标识驱动的自主可控通信协议栈、智能化通信机制与关键设备研制等核心技术。这响应了国家在关键领域解决“卡脖子”技术的需求，未来将应用于国防通信、智能制造等领域。",
	},
	{
		title: "融合大模型技术",
		body: "研究院明确将以“边缘智能和大模型为核心技术底座”，加速研发基于大模型的新一代人工智能服务平台。这表明其未来产品将具备更强大的泛化能力和智能水平。",
	},
];

export const RESEARCH_DIRECTION_SUMMARY_OUTLOOK =
	"综合来看，边缘智能研究院南京有限公司的未来布局呈现出 “技术平台化、应用场景化” 的双轮驱动特征。在技术上，它正从提供单一解决方案向构建开放的算法生态平台（如“埃启·云脑”）演进，并积极拥抱大模型等前沿技术。在应用上，它将在巩固智慧医疗等优势领域的同时，向工业互联网、低空经济、自主可控通信等国家战略方向和新兴市场拓展。";

/** Flatten structured summary for copy / streaming. */
export function flattenResearchSummary(): string {
	const nl = "\n\n";
	const pillars = RESEARCH_DIRECTION_SUMMARY_PILLARS.map(
		(item) => `${item.title}：${item.body}`,
	).join(nl);
	return [
		RESEARCH_DIRECTION_SUMMARY_LEAD,
		pillars,
		RESEARCH_DIRECTION_SUMMARY_OUTLOOK,
	].join(nl);
}

export const RESEARCH_DIRECTION_SUMMARY = flattenResearchSummary();

const EXPERT_LIST_FIELDS = [
	{ key: "expert_team_name", label: "专家团队名称" },
	{ key: "team_leader", label: "团队负责人" },
	{ key: "expertise_areas", label: "擅长方向" },
	{ key: "primary_technology_field", label: "技术领域一级" },
	{ key: "secondary_technology_field", label: "技术领域二级" },
	{ key: "affiliated_university", label: "所属高校" },
	{ key: "publisher", label: "发布人" },
] as const;

const EXPERT_DETAIL_FIELDS = [
	{ key: "team_size", label: "团队人数" },
	{ key: "team_introduction", label: "团队介绍" },
	{ key: "representative_achievements", label: "代表性成果" },
] as const;

function buildExpertPayload(): RelatedEntriesPayload {
	return {
		listKey: "expert_team",
		fields: EXPERT_LIST_FIELDS.map((field) => ({ ...field })),
		detailFields: EXPERT_DETAIL_FIELDS.map((field) => ({ ...field })),
		items: [
			{
				expert_team_name: RESEARCH_EXPERT_ROW.expert_team_name,
				team_leader: RESEARCH_EXPERT_ROW.team_leader,
				expertise_areas: RESEARCH_EXPERT_ROW.expertise_areas,
				primary_technology_field: RESEARCH_EXPERT_ROW.primary_technology_field,
				secondary_technology_field:
					RESEARCH_EXPERT_ROW.secondary_technology_field,
				affiliated_university: RESEARCH_EXPERT_ROW.affiliated_university,
				publisher: RESEARCH_EXPERT_ROW.publisher,
				team_size: RESEARCH_EXPERT_ROW.team_size,
				team_introduction: RESEARCH_EXPERT_ROW.team_introduction,
				representative_achievements:
					RESEARCH_EXPERT_ROW.representative_achievements,
				recommend_reason: RESEARCH_EXPERT_ROW.recommend_reason,
			},
		],
	};
}

/** 政策推荐 · 深度思考 */
export const POLICY_RECOMMEND_THINKING = `根据企业信息对照省级与市级政策库：先筛「完全满足」条件的省基础研究计划等专项，再补充「部分满足」的省市联合资助与市级补贴/成果转化类政策；按省级政策、市级政策分层输出列表字段，并保留详情页可展开信息。`;

/** 政策推荐 · 推荐理由（结果区底部、推荐问题上方；支持换行展示） */
export const POLICY_RECOMMEND_REASON = `
# 边缘智能研究院南京有限公司政策申报建议总结

结合企业自身情况，梳理适配政策并形成申报策略建议如下：
## 一、省级基础研究重点项目（两条申报通道）
政策主管部门：江苏省科技厅、江苏省教育厅，统一依托**江苏数字科技平台**申报，申报网址：[https://jsszkj.kxjst.jiangsu.gov.cn/js-home/home](https://link.wtturl.cn/?target=https%3A%2F%2Fjsszkj.kxjst.jiangsu.gov.cn%2Fjs-home%2Fhome&scene=im&aid=497858&lang=zh)，政策依据：《江苏省基础研究专项资金（基础研究计划）项目管理办法》。
### 1. 省资助项目（完全匹配通道，优先重点推进）
1. 资金支持：单项省级资助最高 500 万元；
2. 项目定位：围绕重大科技前沿、产业前瞻方向开展目标导向型应用基础研究，解决底层基础科学问题；
3. 申报核心条件：依托高水平科研团队，针对产业实践凝练科学问题，组织团队协同攻关；
4. 申报建议：作为首要备选渠道。聚焦边缘智能领域前沿基础科学问题梳理研究方向，整合优质科研团队，提前打磨项目研究方案，抢抓申报窗口期。
### 2. 省市联合资助项目（部分匹配通道，备选申报）
1. 资金支持：省市联合出资，单项资助额度一般不超过 250 万元；
2. 申报核心条件：项目落地南京市辖区，鼓励跨领域、跨单位联合研究；多家单位共同申报需签订正式合作协议，清晰划分研究任务、经费分配；
3. 申报建议：可联动本地高校、科研机构组建联合体申报。可作为备选方案，若省级独立资助项目申报竞争压力较大，可启动该渠道准备工作。
> 双通道对比提示：省独立资助项目资金上限更高，但对科研团队、原创基础研究成果要求更高；省市联合资助支持力度相对较低，但鼓励产学研联合攻关，更便于整合南京本地创新资源。两个通道为同一系列项目，需关注申报通知要求，判断是否允许同时申报。
## 二、南京市专精特新企业校企联合攻关相关支持政策（储备培育方向）
1. 政策层级：市级政策，面向全市企业，属于项目类、成果转化类扶持政策；
2. 核心扶持条款：
   （1）专精特新中小企业联合高校开展关键技术攻关，申报市级重大科技专项享有优先权，单项最高支持 2000 万元；
   （2）专精特新企业联合高校承担国家级关键技术攻关任务，按企业研发总投入 15% 给予补助，补助上限 1000 万元；
   （3）校企联合研发产品优先纳入《南京市创新产品应用示范推荐目录》，配套相关扶持；开放业务场景开展校企应用试点。
3. 申报建议：
   该政策优先支持专精特新主体。建议企业优先启动专精特新企业资质培育认定工作；持续深化和高校的技术攻关合作，梳理边缘智能相关联合研发项目，积累产学研合作成果、研发投入凭证。待取得专精特新资质后，重点布局市级重大科技专项以及研发投入补助申报，同步推进联合研发产品纳入市级创新产品示范目录。
## 三、整体申报综合行动建议
1. **短期重点**：集中资源筹备**省级基础研究重点项目（省资助通道）**，梳理边缘智能方向应用基础研究课题，搭建稳定科研团队；同步调研当年申报通知，明确申报时间节点。同步摸底省市联合资助项目申报要求，制定备选方案。
2. 中长期布局
   ① 持续深化产学研合作，与在宁高校建立稳定合作机制，为省市联合基础研究项目、南京市专精特新配套政策申报储备合作资源；
   ② 启动专精特新企业资质培育，补齐资质条件，解锁南京市校企攻关系列扶持政策；
   ③ 规范归集研发投入台账、项目成果、合作协议等材料，建立项目申报素材库，满足各类政策材料审核要求。
3. 风险注意事项
   申报前仔细研读当期正式申报通知，确认省级基础研究两类通道是否可同时申报；联合申报项目务必提前拟定规范合作协议，明确任务分工、知识产权归属、经费分配，规避申报及项目实施风险。
`;

const PROVINCIAL_PROJECT_DESC =
	"面向我省经济社会发展紧迫需求，围绕重大科技前沿或产业前瞻问题超前部署，从行业和产业发展实践中凝练科学问题，开展目标导向的应用基础研究，从源头和底层解决基础科学问题，努力实现前瞻性基础研究、引领性原创成果的重大突破。";

const PROVINCIAL_DOC_NAME =
	"关于印发江苏省基础研究专项资金（基础研究计划）项目管理办法的通知20250108 (1).pdf";

const PROVINCIAL_APPLY_URL = "https://jsszkj.kxjst.jiangsu.gov.cn/js-home/home";

/** 成果评估 · 深度思考（流式 token 用） */
export const ACHIEVEMENT_EVAL_THINKING = `用户提交的是一项「同质外延生长单晶金刚石籽晶衬底真空钎焊」技术成果。先锁定评估关键词：单晶金刚石籽晶固定工艺、可行性评估。接着从行业痛点切入——MWCVD 生长过程中籽晶易被气流移位、衬底界面热阻偏高易石墨化，判断该成果是否针对痛点给出可验证方案；再核对材料体系（Fe-Ti-Cr-Ni 多元合金焊料）、关键指标（剪切结合强度约 10MPa、界面热导率提升 3 倍以上）与成熟度自述（实验室关键功能验证 / TRL 4-5）；最后综合创新性、成熟度、市场前景与可行性四维打分，并给出转化路径建议。`;

/** 成果评估 · 默认输入摘要（用户未输入时展示） */
export const ACHIEVEMENT_EVAL_DEFAULT_INPUT = `一种同质外延生长单晶金刚石的籽晶衬底真空钎焊方法
成果类型：技术成果
产业技术领域：新材料
成熟度：实验室关键功能验证
交易金额：面议
发布单位（人）：哈尔滨工业大学小分队`;

export const ACHIEVEMENT_EVAL_TITLE =
	"一种同质外延生长单晶金刚石的籽晶衬底真空钎焊方法";

export const ACHIEVEMENT_EVAL_REASON =
	'该技术成果属于"高价值、低成熟度"型项目。其创新点在于精准锁定MWCVD制备单晶金刚石的两大行业痛点——籽晶气流移位与界面石墨化，通过Fe-Ti-Cr-Ni多元合金真空钎焊工艺将剪切结合强度提升至10MPa、界面热导率提高3倍以上，技术路线务实且与现有产线兼容性好，团队背景可靠，下游半导体散热、航天光学等战略应用领域前景广阔；但核心短板在于成熟度仅停留在实验室样件阶段，尚未经工程化量产验证，且作为制备配套工艺其直接市场规模受限于单晶金刚石产业整体发展节奏，建议以合作开发或技术许可模式联合下游企业推进中试验证，重点突破大尺寸一致性、长期热循环可靠性及量产成本等关键工程化瓶颈，若能在短期内完成中试验证，其产业化价值将显著提升。';

export function buildSearchResults(
	agentKey: SceneMockAgentKey | "achievement_eval",
	question: string,
): { query: string; results: SearchResultItem[] } {
	if (agentKey === "achievement_eval") {
		const query =
			question.trim() || "单晶金刚石籽晶固定工艺 真空钎焊 可行性评估";
		return {
			query,
			results: [
				{
					title: "MWCVD 法制备单晶金刚石：籽晶固定与界面热管理研究进展",
					source: "中国发明专利 CN104878447B / 国家知识产权局",
					snippet:
						"微波等离子体 CVD 生长过程中，籽晶在气流冲击下易发生微位移，导致孪晶与多晶缺陷；籽晶—衬底界面热阻过高还会诱发局部石墨化，影响同质外延质量与成品率。",
					url: "https://www.soopat.com/Patent/CN104878447B",
				},
				{
					title: "金刚石与金属衬底真空钎焊：活性焊料体系与结合强度综述",
					source:
						"稀有金属材料与工程 / 哈尔滨工业大学先进焊接与连接国家重点实验室",
					snippet:
						"Fe、Ti、Cr、Ni 等活性元素可改善金刚石润湿性；文献报道真空钎焊接头剪切强度多在数 MPa 至十余 MPa 量级，界面热导率对散热器件性能影响显著。",
					url: "https://rmme.ijournals.cn/rmme/article/abstract/20240207",
				},
				{
					title: "大尺寸单晶金刚石在半导体散热与光学窗口中的应用前景",
					source:
						"硅酸盐学报 / 哈尔滨工业大学特种环境复合材料技术国家级重点实验室",
					snippet:
						"单晶金刚石被视为「终极半导体材料」候选，在 GaN/SiC 功率器件散热、高频光学窗口、超硬刀具及航天抗辐照元件等领域需求增长，但产业化仍处早期，设备保有量与成本仍是瓶颈。",
					url: "https://www.casmita.com/news/202208/30/9657.html",
				},
				{
					title: "哈尔滨工业大学金刚石材料与钎焊连接相关研究线索",
					source:
						"自然杂志 / 哈尔滨工业大学特种环境复合材料技术国家级重点实验室",
					snippet:
						"哈工大在超硬材料、真空钎焊与界面工程方向具备长期积累，相关团队在籽晶工装、活性焊料配方与工艺参数优化方面有公开专利与论文线索。",
					url: "https://www.nature.shu.edu.cn/CN/Y2019/V41/I2/100",
				},
			],
		};
	}

	const query =
		question.trim() ||
		(agentKey === "research_direction"
			? "边缘智能研究院南京有限公司 研发方向 专家团队"
			: `${PLACEHOLDER} · 检索`);

	if (agentKey === "research_direction") {
		return {
			query,
			results: [
				{
					title: "边缘智能研究院南京有限公司 研发布局与产品动态",
					source: "边缘智能研究院官网",
					snippet:
						"围绕边缘智能终端、人工智能服务平台与埃启智能操作系统，布局智慧医疗与工业物联网等场景。",
					url: "http://www.ei.link/",
				},
				{
					title: "埃启·云脑与 EdgeOS 相关公开介绍",
					source: "EdgerOS 官方开发者中心 / 物联网开放生态系统",
					snippet:
						"算法生态中枢与边缘操作系统方向，覆盖医疗检测、智慧工业等算法卡片。",
					url: "https://www.edgeros.com/developer",
				},
				{
					title: "新一代自主可控智能通信网络创新联合体相关线索",
					source: "边缘智能研究院官网 / 南京鼓楼高新区",
					snippet:
						"自主可控通信协议栈与智能化通信机制等方向的公开报道与资料摘要。",
					url: "http://www.ei.link/nd.jsp?id=344",
				},
			],
		};
	}

	return {
		query,
		results: [1, 2, 3, 4].map((index) => ({
			title: `${PLACEHOLDER} · 检索结果标题 ${index}`,
			source: `${PLACEHOLDER} · 来源 ${index}`,
			snippet: PLACEHOLDER,
			url: `https://example.com/search/${agentKey}/${index}`,
		})),
	};
}

export function buildPolicyRecommendResult(
	question: string,
): PolicyRecommendResult {
	return {
		kind: "policy_recommend",
		inputSummary: question.trim() || "企业信息政策匹配",
		fullyMatched: {
			provincial: [
				{
					id: "full-provincial-1",
					item_name: "基础研究重点项目",
					level: "省级",
					funding_amount: "每项省资助经费不超过500万元",
					item_category_description:
						"省基础研究计划项目（主管部门：省科技厅、省教育厅）",
					project_description: PROVINCIAL_PROJECT_DESC,
					application_requirements:
						"遴选有能力有潜力的科学家和优秀科研团队，开展面向重大科学问题的协同攻关",
					application_channel: "省资助项目 · 江苏数字科技平台",
					application_url: PROVINCIAL_APPLY_URL,
					related_policy_document_name: PROVINCIAL_DOC_NAME,
				},
			],
			municipal: [],
		},
		partiallyMatched: {
			provincial: [
				{
					id: "partial-provincial-1",
					item_name: "基础研究重点项目",
					level: "省级",
					funding_amount:
						"省市联合资助，单项目资助额度见申报通知（约不超过250万元）",
					item_category_description:
						"省基础研究计划项目（主管部门：省科技厅、省教育厅）",
					project_description: PROVINCIAL_PROJECT_DESC,
					application_requirements:
						"建立健全与地方共同组织基础研究的新机制，调动跨区域、跨领域、跨行业优势科研力量开展创新研究。须在设区市辖区内。共同申报的，须提供合作协议，明确各单位的目标任务、资金分配等。",
					application_channel: "省市联合资助项目 · 江苏数字科技平台",
					application_url: PROVINCIAL_APPLY_URL,
					related_policy_document_name: PROVINCIAL_DOC_NAME,
				},
			],
			municipal: [
				{
					id: "partial-municipal-1",
					policy_category: "补贴类",
					supported_region: "全市",
					supported_entities: "企业",
					support_content:
						"对初创企业发生的房租费用，各区（园区）根据企业成长情况给予最高100%补贴、最长不超过三年。",
					source_document: "",
				},
				{
					id: "partial-municipal-2",
					policy_category: "成果转化类、项目类",
					supported_region: "全市",
					supported_entities: "企业",
					support_content:
						"支持与高校联合开展关键技术攻关的专精特新中小企业优先申报专精特新“小巨人”企业，同时在申报市级重大科技专项时予以优先支持，每项支持最高不超过2000万元。对与高校联合承担国家关键技术攻关任务的专精特新企业，按照企业研发总投入的15%、最高1000万元给予支持。组织专精特新企业开放业务场景，支持校企合作的应用场景先行先试，专精特新企业与高校联合开发的产品，优先纳入《南京市创新产品应用示范推荐目录》，按政策给予支持。",
					source_document: "",
				},
			],
		},
		recommendReason: POLICY_RECOMMEND_REASON,
	};
}

export function buildAchievementEvalResult(
	question: string,
): AchievementEvalResult {
	const dimensions = [
		{
			label: "创新性",
			score: 18,
			max: 25,
			highlight:
				"精准识别了MWCVD制备单晶金刚石行业的两大核心痛点（籽晶气流移位、界面热阻高导致石墨化），并提出针对性的真空钎焊成套解决方案；采用Fe-Ti-Cr-Ni多元合金焊料，在材料配方设计上具有一定创新性；将剪切结合强度提升至10MPa、界面热导率提升3倍以上，技术指标改善显著。",
			weakness:
				'真空钎焊本身是较为成熟的工业技术，该成果的核心创新点更多体现在材料配方优化和工艺参数适配层面，技术路线的原创性和颠覆性相对有限，属于"应用创新"而非"原理创新"。',
		},
		{
			label: "成熟度",
			score: 13,
			max: 25,
			highlight:
				"已完成多批次实验室样件制备，通过拉曼光谱验证了单晶质量提升，关键性能指标（结合强度、热导率）有明确数据支撑，处于TRL 4-5级（实验室/关键功能验证阶段）。",
			weakness:
				'成果自述"仅停留在实验室试样制备，暂未对接量产企业实现工程化落地"。距离产业化仍需完成：工艺稳定性验证、不同批次一致性验证、与现有产线的集成测试、成本核算、长时间运行可靠性验证等。成熟度偏低是该项成果最明显的短板。',
		},
		{
			label: "市场前景",
			score: 17,
			max: 25,
			highlight:
				'下游应用领域高度契合国家战略需求——大尺寸单晶金刚石在半导体散热（GaN、SiC器件）、高频光学窗口、超硬刀具、航天抗辐照元件等领域均有广阔空间，单晶金刚石被誉为"终极半导体材料"，长期市场趋势向好。',
			weakness:
				"该技术定位为制备过程中的配套工艺（籽晶衬底钎焊工装），而非终端产品或核心材料本身。其直接市场规模受限于单晶金刚石整体产业的发展速度和MWCVD设备的保有量。当前单晶金刚石产业化仍处于早期，短期内难以形成大规模市场。",
		},
		{
			label: "可行性",
			score: 19,
			max: 25,
			highlight:
				'工艺路线清晰，设备需求明确（真空钎焊炉为常规设备）；成果明确指出"可直接配套现有MWCVD沉积设备，无需大规模改造产线"，降低了产业化门槛；哈尔滨工业大学在金刚石材料领域研究基础深厚，团队可信度高。',
			weakness:
				"工程化可行性尚未验证——实验室小批量成功不代表量产稳定，焊料成本、钎焊效率、不同尺寸籽晶适配性、长期热循环可靠性等工程问题仍需验证。",
		},
	];

	const total = dimensions.reduce((sum, item) => sum + item.score, 0);
	const maxTotal = dimensions.reduce((sum, item) => sum + item.max, 0);

	return {
		kind: "achievement_eval",
		inputSummary: question.trim() || ACHIEVEMENT_EVAL_DEFAULT_INPUT,
		evaluations: [
			{
				title: ACHIEVEMENT_EVAL_TITLE,
				dimensions,
				total,
				maxTotal,
				reason: ACHIEVEMENT_EVAL_REASON,
			},
		],
	};
}

export function buildResearchDirectionResult(
	question: string,
): ResearchDirectionResult {
	return {
		kind: "research_direction",
		inputSummary: question.trim() || "边缘智能研究院南京有限公司",
		experts: buildExpertPayload(),
		recommendReason: RESEARCH_EXPERT_ROW.recommend_reason,
		summary: RESEARCH_DIRECTION_SUMMARY,
	};
}

export function buildSceneResult(
	agentKey: SceneMockAgentKey,
	question: string,
): SceneResult {
	if (agentKey === "policy_recommend") {
		return buildPolicyRecommendResult(question);
	}
	return buildResearchDirectionResult(question);
}

/** Split thinking text into SSE-like token chunks. */
export function splitThinkingTokens(text: string): string[] {
	const trimmed = text.trim();
	if (!trimmed) {
		return [];
	}
	const parts = trimmed.split(/(?<=[，。；：、\n])/);
	const tokens: string[] = [];
	for (const part of parts) {
		if (!part) {
			continue;
		}
		if (part.length <= 18) {
			tokens.push(part);
			continue;
		}
		for (let i = 0; i < part.length; i += 14) {
			tokens.push(part.slice(i, i + 14));
		}
	}
	return tokens.length ? tokens : [trimmed];
}

export function sceneIntroCopy(
	agentKey: SceneMockAgentKey | "achievement_eval",
): string {
	if (agentKey === "policy_recommend") {
		return "当前场景：政策推荐。请输入企业名称或企业信息，系统将按完全满足 / 部分满足分层返回省级与市级政策，支持列表与详情查看。";
	}
	if (agentKey === "achievement_eval") {
		return "当前场景：成果评估。请输入成果详细信息，系统将先分析问题并检索公开资料，再从创新性、成熟度、市场前景、可行性四维评分并给出评分原因。";
	}
	return "当前场景：研究方向。请输入企业名称或企业信息，系统将先展示检索过程，再给出匹配专家团队与研发方向总结。";
}

export function scenePlaceholder(
	agentKey: SceneMockAgentKey | "achievement_eval",
): string {
	if (agentKey === "policy_recommend") {
		return "输入企业名称或企业信息…";
	}
	if (agentKey === "achievement_eval") {
		return "输入成果详细信息…";
	}
	return "输入企业名称或企业信息…";
}
