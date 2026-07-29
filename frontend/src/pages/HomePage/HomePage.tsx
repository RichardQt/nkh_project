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
  policy_recommend: [
    '有哪些支持高新技术企业的税收优惠政策？',
    '如何申请省级科技专项资金？',
    '中小企业数字化转型有哪些补贴政策？',
    '知识产权质押融资相关政策有哪些？',
  ],
  achievement_eval: [
    '一种同质外延生长单晶金刚石的籽晶衬底真空钎焊方法',
    '如何评估该项成果的产业化成熟度与可行性？',
    '单晶金刚石籽晶固定工艺的市场前景如何？',
    '该真空钎焊方案相对现有工艺的创新点在哪里？',
  ],
  research_direction: [
    '固态电池领域目前有哪些前沿研究方向？',
    '如何结合产业需求选择合适的科研方向？',
    '碳中和背景下材料科学有哪些重点方向？',
    '人工智能与材料研发交叉有哪些机会点？',
  ],
  achievement_discover: [
    '近三年国内有哪些高价值新材料成果？',
    '如何发现与新能源相关的可转化成果？',
    '有哪些适合中小企业落地的科技成果？',
    '高校院所在先进制造领域有哪些代表性成果？',
  ],
  expert_discover: [
    '如何找到新能源材料领域的权威专家？',
    '有哪些专家擅长科技成果转化与产业化？',
    '如何匹配适合我企业技术难题的专家？',
    '人工智能交叉领域有哪些活跃科研团队？',
  ],
  demand_discover: [
    '当前产业端在哪些技术领域需求最迫切？',
    '如何发现与我司能力匹配的技术需求？',
    '中小企业常见的技术痛点有哪些？',
    '如何跟踪某细分赛道的最新需求动态？',
  ],
  enterprise_discover: [
    '如何找到有合作意向的高新技术企业？',
    '哪些企业在新材料领域布局较活跃？',
    '如何筛选适合成果对接的潜在企业？',
    '区域内有哪些重点培育的科技型企业？',
  ],
  platform_discover: [
    '有哪些可支撑中试放大的公共技术平台？',
    '如何找到适合检测认证的平台资源？',
    '区域内有哪些开放共享的科研仪器平台？',
    '如何对接产业创新中心或中试基地？',
  ],
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

    // 有选中入口则带上 scene key，供后端 A 识别场景；对话本身统一走接口
    const path = selectedKey ? `/chat/${selectedKey}` : '/chat';
    navigate(`${path}?q=${encodeURIComponent(question)}`, {
      state: { initialQuestion: question },
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
