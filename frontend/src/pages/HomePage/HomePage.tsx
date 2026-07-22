import { useRef, useState } from 'react';
import type { ComponentRef, FocusEvent, KeyboardEvent } from 'react';
import { ArrowUpOutlined, SearchOutlined } from '@ant-design/icons';
import { Prompts, Sender, Welcome } from '@ant-design/x';
import type { PromptsProps } from '@ant-design/x';
import { Button, Flex, Typography } from 'antd';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import AgentGlyph from '../../components/AgentGlyph/AgentGlyph';
import { agents, defaultAgent } from '../../data/agents';
import { easeOut } from '../../motion/tokens';
import type { AgentKey } from '../../types/agent';
import styles from './HomePage.module.css';

/** Keep hero icon / title / description in lockstep when switching agents. */
const switchTransition = { duration: 0.16, ease: easeOut } as const;

export default function HomePage() {
  const [selectedKey, setSelectedKey] = useState<AgentKey>(defaultAgent.key);
  const [value, setValue] = useState('');
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const senderRef = useRef<ComponentRef<typeof Sender>>(null);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();

  const selectedAgent =
    agents.find((agent) => agent.key === selectedKey) ?? defaultAgent;

  const choosePrompt = (prompt: string) => {
    setValue(prompt);
    setRecommendationsOpen(true);
    senderRef.current?.focus({ cursor: 'end' });
  };

  const promptItems: PromptsProps['items'] = selectedAgent.prompts.map(
    (prompt) => ({
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
    }),
  );

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
    setSelectedKey(key);
    setValue('');
    setRecommendationsOpen(false);
  };

  const submit = (message: string) => {
    const question = message.trim();
    if (!question) {
      senderRef.current?.focus();
      return;
    }

    navigate(
      `/chat/${selectedAgent.key}?q=${encodeURIComponent(question)}`,
      { state: { initialQuestion: question } },
    );
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
              <div className={styles.heroMarkShell}>
                <AnimatePresence initial={false}>
                  <motion.div
                    key={selectedAgent.key}
                    className={styles.heroMark}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                    transition={reduceMotion ? { duration: 0 } : switchTransition}
                  >
                    <AgentGlyph
                      agentKey={selectedAgent.key}
                      size="large"
                      active
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            }
            title={selectedAgent.name}
            description={selectedAgent.description}
            classNames={{
              root: styles.welcome,
              icon: styles.welcomeIcon,
              title: styles.welcomeTitle,
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
              const selected = agent.key === selectedAgent.key;
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
              autoSize={{ minRows: 2, maxRows: 6 }}
              submitType="enter"
              placeholder={selectedAgent.placeholder}
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
                  paddingTop: 12,
                  paddingBottom: 12,
                },
                input: {
                  alignSelf: 'flex-start',
                  paddingTop: 0,
                  paddingBottom: 0,
                  lineHeight: '24px',
                  minHeight: 48,
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
                  aria-label={`${selectedAgent.shortName}推荐问题`}
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
                      {selectedAgent.shortName}
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
