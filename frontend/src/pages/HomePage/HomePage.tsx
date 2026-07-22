import { useRef, useState } from 'react';
import type { ComponentRef, FocusEvent, KeyboardEvent } from 'react';
import { ArrowUpOutlined, SearchOutlined } from '@ant-design/icons';
import { Prompts, Sender, Welcome } from '@ant-design/x';
import type { PromptsProps } from '@ant-design/x';
import { Button, Flex, Typography } from 'antd';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import AgentGlyph from '../../components/AgentGlyph/AgentGlyph';
import { agents } from '../../data/agents';
import { easeOut } from '../../motion/tokens';
import type { AgentKey } from '../../types/agent';
import styles from './HomePage.module.css';

const switchTransition = { duration: 0.16, ease: easeOut } as const;

const BRAND = {
  title: 'AI 创新赋能助手',
  description:
    '连接成果、专家、政策与产业需求，为创新决策提供清晰路径与可执行建议。',
  placeholder: '描述你的创新问题或目标，Enter 发送，Shift + Enter 换行',
  prompts: [
    '如何把一项实验室成果推向产业应用？',
    '初创团队怎样找到合适的技术合作伙伴？',
    '近期有哪些适合科技企业的支持政策方向？',
    '怎样判断一个技术方向是否值得继续投入？',
  ],
} as const;

export default function HomePage() {
  // null = no agent selected → brand hero (AI 创新赋能助手)
  const [selectedKey, setSelectedKey] = useState<AgentKey | null>(null);
  const [value, setValue] = useState('');
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const senderRef = useRef<ComponentRef<typeof Sender>>(null);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();

  const selectedAgent = selectedKey
    ? (agents.find((agent) => agent.key === selectedKey) ?? null)
    : null;
  const isBrandMode = !selectedAgent;

  const activePrompts = selectedAgent
    ? selectedAgent.prompts
    : [...BRAND.prompts];
  const activePlaceholder = selectedAgent
    ? selectedAgent.placeholder
    : BRAND.placeholder;
  const promptLabel = selectedAgent ? selectedAgent.shortName : '综合推荐';

  const choosePrompt = (prompt: string) => {
    setValue(prompt);
    setRecommendationsOpen(true);
    senderRef.current?.focus({ cursor: 'end' });
  };

  const promptItems: PromptsProps['items'] = activePrompts.map((prompt) => ({
    key: prompt,
    icon: <SearchOutlined />,
    label: (
      <Button
        type="text"
        block
        className={styles.promptAction}
        onClick={(event) => {
          event.stopPropagation();
          choosePrompt(prompt);
        }}
      >
        {prompt}
      </Button>
    ),
  }));

  const openRecommendations = () => {
    setRecommendationsOpen(true);
  };

  const handleComposerBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setRecommendationsOpen(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setRecommendationsOpen(false);
      (event.target as HTMLElement).blur();
    }
  };

  const selectAgent = (key: AgentKey) => {
    // Second click on the active agent clears selection.
    setSelectedKey((current) => (current === key ? null : key));
    setValue('');
    setRecommendationsOpen(false);
  };

  const submit = (message: string) => {
    const question = message.trim();
    if (!question) {
      senderRef.current?.focus();
      return;
    }

    // No agent selected → general chat (no specialist agent).
    const path = selectedAgent
      ? `/chat/${selectedAgent.key}`
      : '/chat';

    navigate(`${path}?q=${encodeURIComponent(question)}`, {
      state: { initialQuestion: question },
    });
  };

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
            icon={
              selectedAgent ? (
                <div className={styles.heroMarkShell}>
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={selectedAgent.key}
                      className={styles.heroMark}
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduceMotion ? undefined : { opacity: 0 }}
                      transition={
                        reduceMotion ? { duration: 0 } : switchTransition
                      }
                    >
                      <AgentGlyph
                        agentKey={selectedAgent.key}
                        size="large"
                        active
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : undefined
            }
            title={
              isBrandMode ? (
                <span className={styles.brandTitle}>
                  <span className={styles.brandTitleAccent}>AI</span>
                  <span className={styles.brandTitleMain}> 创新赋能助手</span>
                </span>
              ) : (
                selectedAgent.name
              )
            }
            description={
              isBrandMode ? BRAND.description : selectedAgent.description
            }
            classNames={{
              root: `${styles.welcome} ${isBrandMode ? styles.welcomeBrand : ''}`,
              icon: styles.welcomeIcon,
              title: isBrandMode ? styles.welcomeTitleBrand : styles.welcomeTitle,
              description: styles.welcomeDescription,
            }}
          />

          <Flex
            wrap
            justify="center"
            gap={8}
            className={styles.agentSelector}
            role="tablist"
            aria-label="选择智能体"
          >
            {agents.map((agent, index) => {
              const selected = agent.key === selectedKey;
              return (
                <motion.div
                  key={agent.key}
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
                      <AgentGlyph
                        agentKey={agent.key}
                        size="small"
                        active={selected}
                      />
                    }
                    onClick={() => selectAgent(agent.key)}
                    role="tab"
                    aria-selected={selected}
                  >
                    {agent.shortName}
                  </Button>
                </motion.div>
              );
            })}
          </Flex>

          <motion.div
            className={styles.composerRegion}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.36,
              delay: reduceMotion ? 0 : 0.12,
              ease: easeOut,
            }}
            onFocusCapture={openRecommendations}
            onBlurCapture={handleComposerBlur}
            onKeyDownCapture={handleComposerKeyDown}
          >
            <Sender
              ref={senderRef}
              value={value}
              // minRows / maxRows：控制默认行数与最高可长到几行
              autoSize={{ minRows: 3, maxRows: 8 }}
              submitType="enter"
              placeholder={activePlaceholder}
              onChange={setValue}
              onFocus={openRecommendations}
              onSubmit={submit}
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

            <AnimatePresence initial={false}>
              {recommendationsOpen && (
                <motion.section
                  className={styles.recommendationPanel}
                  aria-label={`${promptLabel}推荐问题`}
                  initial={
                    reduceMotion ? false : { height: 0, opacity: 0, y: -6 }
                  }
                  animate={{ height: 'auto', opacity: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? { display: 'none' }
                      : { height: 0, opacity: 0, y: -4 }
                  }
                  transition={{ duration: 0.28, ease: easeOut }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <div className={styles.recommendationHeader}>
                    <Typography.Text strong>推荐问题</Typography.Text>
                    <Typography.Text type="secondary">
                      {promptLabel}
                    </Typography.Text>
                  </div>
                  <Prompts
                    items={promptItems}
                    vertical
                    fadeIn={!reduceMotion}
                    classNames={{
                      root: styles.prompts,
                      list: styles.promptList,
                      item: styles.promptItem,
                    }}
                    onItemClick={({ data }) => {
                      choosePrompt(data.key);
                    }}
                  />
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
