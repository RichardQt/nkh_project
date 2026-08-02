import { useEffect, useRef, useState } from "react";
import type { ComponentRef } from "react";
import { ArrowUpOutlined, DownOutlined } from "@ant-design/icons";
import { Sender, Welcome } from "@ant-design/x";
import { Button, Flex, Select, Tooltip, message } from "antd";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import AgentGlyph from "../../components/AgentGlyph/AgentGlyph";
import { useSensitiveWords } from "../../context/SensitiveWordsContext";
import { agents, homeNavBottomKeys, homeNavTopKeys } from "../../data/agents";
import { easeOut } from "../../motion/tokens";
import type { AgentDefinition, AgentKey } from "../../types/agent";
import styles from "./HomePage.module.css";

const BRAND = {
	description:
		"连接成果、专家、政策与产业需求，为创新决策提供清晰路径与可执行建议。",
	placeholder: "描述你的问题或目标，Enter 发送，Shift + Enter 换行",
} as const;

/** 首页可选对话模型，发起时作为 model 参数透传。 */
const CHAT_MODELS = [
	{ value: "DeepSeek-V4", label: "DeepSeek-V4" },
	{ value: "Qwen3.6-35B", label: "Qwen3.6-35B" },
] as const;

type ChatModel = (typeof CHAT_MODELS)[number]["value"];

const DEFAULT_CHAT_MODEL: ChatModel = CHAT_MODELS[0].value;

/** 未选模块时的默认推荐问题。 */
const DEFAULT_SUGGESTED_QUESTIONS = [
	"我们是南京数钥科技有限公司，专精于人工智能与大数据安全，是一家专精特新企业，请问有哪些优惠政策能推荐？",
	"我们有一些生物医药方面的科研成果，需要仪器和平台验证，有哪些可以推荐给我？",
	`我有一个成果，计算机辅助骨科手术，计算机导航系统辅助采用的技术主要是将患者术前或术中影像数据和手术床上患者解剖结构准确对应，手术中跟踪手术器械的位置，对手术进行实时的导航。该技术虽取得了较为满意的结果，但由于患者必须行术前CT或术中X线多方位透视，然后在术中进行影像数据和患者解剖结构对应匹配，其过程复杂，使手术时间延长，增加了患者和医师在X线下暴露的时间。该项目将人体解剖学、现代影像学、计算机三维重建、逆向工程技术及快速成形技术相结合，针对骨科常实施的内固定置入物的定位、定向等问题进行研究。
帮我匹配相关需求`,
	"新材料领域有哪些专家？",
	"灌浆材料存在泌水问题，有哪些好的成果能推荐？",
] as const;

/** 各首页模块对应的推荐问题 */
const MODULE_SUGGESTED_QUESTIONS: Record<AgentKey, readonly string[]> = {
	policy_recommend: [
		"我们是边缘智能研究院南京有限公司，请问有哪些优惠政策能推荐？",
		"我们是南京数钥科技有限公司，专精于人工智能与大数据安全，是一家专精特新企业，请问有哪些优惠政策能推荐？",
	],
	achievement_eval: [
		`一种同质外延生长单晶金刚石的籽晶衬底真空钎焊方法，大尺寸单晶金刚石同质外延制备、超硬精密加工刀具基材、高频光学窗口金刚石、航天抗辐照金刚石元件、半导体散热金刚石衬底、微波等离子体沉积装备配套籽晶工装。技术价值：1.钎焊后籽晶与钼衬底剪切结合强度达 10MPa，彻底解决气流移位问题，金刚石生长温场稳定；2.界面热导率由 30W/m・K 提升至 100W/m・K，有效抑制金刚石表面高温石墨化；3.用 Ni 基多元焊料相容性优异，不会产生过厚有害反应层，保证单晶生长低缺陷、高纯度；4.整套清洗、真空钎焊流程可直接配套现有 MWCVD 沉积设备，无需大规模改造产线。
应用现状：完成多批次籽晶衬底钎焊试验与金刚石外延生长对比验证，拉曼光谱证明单晶质量显著提升，仅停留在实验室试样制备，暂未对接金刚石量产企业实现工程化落地。
帮我对该成果进行评估。`,
	],
	research_direction: [
		"边缘智能研究院南京有限公司，未来有哪些研究方向？",
		"我们是南京数钥科技有限公司，专精于人工智能与大数据安全，是一家专精特新企业，有哪些潜在的技术需求？",
	],
	achievement_discover: ["灌浆材料存在泌水问题，有哪些好的成果能推荐？"],
	expert_discover: [
		"我们想做AI赋能CT识别的需求，有哪些专家能推荐？",
		"新材料领域有哪些专家？",
	],
	demand_discover: [
		`我有一个成果，计算机辅助骨科手术，计算机导航系统辅助采用的技术主要是将患者术前或术中影像数据和手术床上患者解剖结构准确对应，手术中跟踪手术器械的位置，对手术进行实时的导航。该技术虽取得了较为满意的结果，但由于患者必须行术前CT或术中X线多方位透视，然后在术中进行影像数据和患者解剖结构对应匹配，其过程复杂，使手术时间延长，增加了患者和医师在X线下暴露的时间。该项目将人体解剖学、现代影像学、计算机三维重建、逆向工程技术及快速成形技术相结合，针对骨科常实施的内固定置入物的定位、定向等问题进行研究。
帮我匹配相关需求`,
	],
	enterprise_discover: [
		`我有一个成果，能针对传统城市设计周期长、不可解释及非矢量化等痛点，研发了国内首个基于可解释人工智能（XAI）的城市设计智能化平台 。团队攻克了“矢量数据生成”、“刚柔规则谱系参数化转译”以及“几何深度学习与反馈强化”等核心技术 ，实现城市规划“刚性规范”与“柔性美学”的协同控制 。平台集成了路网、空间形态生成等五大模块，支持十平方公里级方案6分钟全流程自动化生成，效率提升10倍以上 ，已在多项国内外重大工程中成功应用 。
有哪些企业可能会对我的成果感兴趣？`,
	],
	platform_discover: [
		"我们有一些生物医药方面的科研成果，需要仪器和平台验证，有哪些可以推荐给我？",
	],
};

export default function HomePage() {
	const [selectedKey, setSelectedKey] = useState<AgentKey | null>(null);
	const [selectedModel, setSelectedModel] =
		useState<ChatModel>(DEFAULT_CHAT_MODEL);
	const [value, setValue] = useState("");
	const [composerFocused, setComposerFocused] = useState(false);
	const senderRef = useRef<ComponentRef<typeof Sender>>(null);
	const composerRegionRef = useRef<HTMLDivElement>(null);
	const blurTimerRef = useRef<number | null>(null);
	const reduceMotion = useReducedMotion();
	const navigate = useNavigate();
	const { match: matchSensitive, blockMessage } = useSensitiveWords();

	const agentsByKey = new Map(agents.map((item) => [item.key, item]));
	const topItems = homeNavTopKeys
		.map((key) => agentsByKey.get(key))
		.filter((item): item is AgentDefinition => Boolean(item));
	const bottomItems = homeNavBottomKeys
		.map((key) => agentsByKey.get(key))
		.filter((item): item is AgentDefinition => Boolean(item));

	useEffect(
		() => () => {
			if (blurTimerRef.current != null) {
				window.clearTimeout(blurTimerRef.current);
			}
		},
		[],
	);

	const selectItem = (key: AgentKey) => {
		setSelectedKey((current) => (current === key ? null : key));
	};

	const submit = (rawMessage: string) => {
		const question = rawMessage.trim();
		if (!question) {
			senderRef.current?.focus();
			return;
		}

		if (matchSensitive(question)) {
			message.warning(blockMessage);
			return;
		}

		setComposerFocused(false);

		// 每次从首页发起对话都生成唯一 sessionId（问题重复也不复用）
		const sessionId =
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

		// 有选中入口则带上 scene key，供后端 A 识别场景；对话本身统一走接口
		const path = selectedKey ? `/chat/${selectedKey}` : "/chat";
		const params = new URLSearchParams({
			q: question,
			sessionId,
			model: selectedModel,
		});
		navigate(`${path}?${params.toString()}`, {
			state: {
				initialQuestion: question,
				sessionId,
				model: selectedModel,
			},
		});
	};

	const handleComposerFocus = () => {
		if (blurTimerRef.current != null) {
			window.clearTimeout(blurTimerRef.current);
			blurTimerRef.current = null;
		}
		setComposerFocused(true);
	};

	const handleComposerBlur = () => {
		// 延迟关闭，便于点击推荐项（mousedown 已 preventDefault 时通常不需要，但保留兜底）
		blurTimerRef.current = window.setTimeout(() => {
			const root = composerRegionRef.current;
			if (root?.contains(document.activeElement)) {
				return;
			}
			setComposerFocused(false);
			blurTimerRef.current = null;
		}, 120);
	};

	const pickSuggestion = (question: string) => {
		setValue(question);
		// 填入后内容非空，推荐弹层自动收起；不自动发送
		window.requestAnimationFrame(() => {
			senderRef.current?.focus?.();
		});
	};

	const renderNavButton = (item: AgentDefinition, index: number) => {
		const selected = item.key === selectedKey;
		return (
			<motion.div
				key={item.key}
				initial={reduceMotion ? false : { opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{
					duration: 0.28,
					delay: reduceMotion ? 0 : 0.06 + index * 0.03,
					ease: easeOut,
				}}
				whileTap={reduceMotion ? undefined : { scale: 0.98 }}
			>
				<Button
					type={selected ? "primary" : "default"}
					className={`${styles.agentButton} ${selected ? styles.agentButtonSelected : ""}`}
					icon={
						<AgentGlyph agentKey={item.key} size="small" active={selected} />
					}
					onClick={() => selectItem(item.key)}
					role="tab"
					aria-selected={selected}
				>
					{item.label}
				</Button>
			</motion.div>
		);
	};

	// 仅在聚焦且输入为空时展示，支持清空后再次弹出
	const showSuggestions = composerFocused && !value.trim();
	const suggestedQuestions = selectedKey
		? MODULE_SUGGESTED_QUESTIONS[selectedKey]
		: DEFAULT_SUGGESTED_QUESTIONS;

	return (
		<main className={styles.page}>
			<div className={styles.stage}>
				<motion.div
					className={styles.hero}
					initial={reduceMotion ? false : { opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={
						reduceMotion ? { duration: 0 } : { duration: 0.4, ease: easeOut }
					}
				>
					<Welcome
						variant="borderless"
						title={
							<span className={styles.brandTitle}>
								<span className={styles.brandTitleAccent}>AI</span>
								<span className={styles.brandTitleMain}> 创新赋能助手</span>
							</span>
						}
						description={BRAND.description}
						classNames={{
							root: `${styles.welcome} ${styles.welcomeBrand}`,
							icon: styles.welcomeIcon,
							title: styles.welcomeTitleBrand,
							description: styles.welcomeDescription,
						}}
					/>

					<div
						className={styles.agentSelector}
						role="tablist"
						aria-label="选择能力入口"
					>
						<Flex
							wrap
							justify="flex-start"
							gap={8}
							className={styles.agentRow}
							aria-label="政策推荐、成果评估、研究方向"
						>
							{topItems.map((item, index) => renderNavButton(item, index))}
						</Flex>
						<Flex
							wrap
							justify="flex-start"
							gap={8}
							className={styles.agentRow}
							aria-label="成果发现、专家发现、需求发现、企业发现、平台发现"
						>
							{bottomItems.map((item, index) =>
								renderNavButton(item, index + topItems.length),
							)}
						</Flex>
					</div>

					<motion.div
						ref={composerRegionRef}
						className={styles.composerRegion}
						initial={reduceMotion ? false : { opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							duration: 0.36,
							delay: reduceMotion ? 0 : 0.12,
							ease: easeOut,
						}}
					>
						<Sender
							ref={senderRef}
							value={value}
							autoSize={{ minRows: 3, maxRows: 8 }}
							submitType="enter"
							placeholder={BRAND.placeholder}
							onChange={setValue}
							onSubmit={submit}
							onFocus={handleComposerFocus}
							onBlur={handleComposerBlur}
							rootClassName={styles.sender}
							classNames={{
								input: styles.senderInput,
								content: styles.senderContent,
								footer: styles.senderFooter,
							}}
							styles={{
								content: {
									alignItems: "flex-start",
									paddingTop: 14,
									paddingBottom: 4,
								},
								input: {
									alignSelf: "flex-start",
									paddingTop: 0,
									paddingBottom: 0,
									lineHeight: "26px",
									minHeight: 78,
								},
							}}
							footer={(_, { components }) => {
								const { SendButton } = components;
								return (
									<div className={styles.composerToolbar}>
										<Select
											value={selectedModel}
											onChange={(next) => setSelectedModel(next as ChatModel)}
											options={[...CHAT_MODELS]}
											className={styles.modelSelect}
											classNames={{
												popup: { root: styles.modelSelectPopup },
											}}
											variant="borderless"
											size="small"
											suffixIcon={
												<DownOutlined className={styles.modelSelectIcon} />
											}
										aria-label="选择模型"
										popupMatchSelectWidth={false}
										getPopupContainer={() => document.body}
									/>
										<SendButton
											type="primary"
											shape="circle"
											icon={<ArrowUpOutlined />}
											disabled={!value.trim()}
											aria-label="发送问题"
										/>
									</div>
								);
							}}
							suffix={false}
						/>

						{showSuggestions ? (
							<div
								className={styles.suggestionPopup}
								role="listbox"
								aria-label="猜你想问"
							>
								<span className={styles.suggestionCaret} aria-hidden />
								<p className={styles.suggestionHint}>猜你想问：</p>
								<ul className={styles.suggestionList}>
									{suggestedQuestions.map((question) => {
										const truncated = question.length > 30;
										const label = truncated
											? `${question.slice(0, 30)}...`
											: question;
										const item = (
											<button
												type="button"
												className={styles.suggestionItem}
												role="option"
												onMouseDown={(event) => {
													// 阻止按钮抢焦点导致输入框 blur 后弹层先关
													event.preventDefault();
												}}
												onClick={() => pickSuggestion(question)}
											>
												{label}
											</button>
										);
										return (
											<li key={question}>
												{truncated ? (
													<Tooltip
														title={question}
														placement="right"
														mouseEnterDelay={0.25}
														overlayClassName={styles.suggestionTooltip}
													>
														{item}
													</Tooltip>
												) : (
													item
												)}
											</li>
										);
									})}
								</ul>
							</div>
						) : null}
					</motion.div>
				</motion.div>
			</div>
		</main>
	);
}
