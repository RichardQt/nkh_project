import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { ArrowUpOutlined } from '@ant-design/icons';
import { Sender, Welcome } from '@ant-design/x';
import { Button, Flex } from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import AgentGlyph from '../../components/AgentGlyph/AgentGlyph';
import {
  agents,
  homeNavBottomKeys,
  homeNavTopKeys,
} from '../../data/agents';
import { easeOut } from '../../motion/tokens';
import type { AgentDefinition, AgentKey } from '../../types/agent';
import styles from './HomePage.module.css';

const BRAND = {
  description:
    '连接成果、专家、政策与产业需求，为创新决策提供清晰路径与可执行建议。',
  placeholder: '描述你的问题或目标，Enter 发送，Shift + Enter 换行',
} as const;

/** 未选模块时的默认推荐问题。 */
const DEFAULT_SUGGESTED_QUESTIONS = [
  '怎样提高高分子材料的耐老化性能？',
  '如何提升光伏发电系统的能量转化效率？',
  '如何有效增强高温合金的抗蠕变性能？',
  '怎样有效提升锂离子电池的能量密度而不牺牲其循环寿命？',
] as const;

/** 各首页模块对应的推荐问题 */
const MODULE_SUGGESTED_QUESTIONS: Record<AgentKey, readonly string[]> = {
	policy_recommend: ["边缘智能研究院南京有限公司"],
	achievement_eval: ["一种同质外延生长单晶金刚石的籽晶衬底真空钎焊方法"],
	research_direction: ["边缘智能研究院南京有限公司"],
	achievement_discover: [
		"自凝药止血粉发明人是谁？",
		"纤维织物抗菌纳米处理技术是什么？",
	],
	expert_discover: ["人工智能专家有谁？"],
	demand_discover: ["骨科手术影像系统需求有哪些？"],
	enterprise_discover: ["边缘智能研究院南京有限公司"],
	platform_discover: ["信号分析仪是什么？"],
};

export default function HomePage() {
  const [selectedKey, setSelectedKey] = useState<AgentKey | null>(null);
  const [value, setValue] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const senderRef = useRef<ComponentRef<typeof Sender>>(null);
  const composerRegionRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();

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

  const submit = (message: string) => {
    const question = message.trim();
    if (!question) {
      senderRef.current?.focus();
      return;
    }

    setComposerFocused(false);

    // 每次从首页发起对话都生成唯一 sessionId（问题重复也不复用）
    const sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // 有选中入口则带上 scene key，供后端 A 识别场景；对话本身统一走接口
    const path = selectedKey ? `/chat/${selectedKey}` : '/chat';
    const params = new URLSearchParams({
      q: question,
      sessionId,
    });
    navigate(`${path}?${params.toString()}`, {
      state: { initialQuestion: question, sessionId },
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
          type={selected ? 'primary' : 'default'}
          className={`${styles.agentButton} ${selected ? styles.agentButtonSelected : ''}`}
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
              }}
              styles={{
                content: {
                  alignItems: 'flex-start',
                  paddingTop: 14,
                  paddingBottom: 14,
                },
                input: {
                  alignSelf: 'flex-start',
                  paddingTop: 0,
                  paddingBottom: 0,
                  lineHeight: '26px',
                  minHeight: 78,
                },
              }}
              suffix={(_, { components }) => {
                const { SendButton } = components;
                return (
                  <SendButton
                    type="primary"
                    shape="circle"
                    icon={<ArrowUpOutlined />}
                    disabled={!value.trim()}
                    aria-label="发送问题"
                  />
                );
              }}
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
                  {suggestedQuestions.map((question) => (
                    <li key={question}>
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
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
