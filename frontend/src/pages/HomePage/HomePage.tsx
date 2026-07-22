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
import type { AgentKey } from '../../types/agent';
import styles from './HomePage.module.css';

export default function HomePage() {
  const [selectedKey, setSelectedKey] = useState<AgentKey>(defaultAgent.key);
  const [value, setValue] = useState('');
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const senderRef = useRef<ComponentRef<typeof Sender>>(null);
  const composerRegionRef = useRef<HTMLDivElement>(null);
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
    // 切换智能体时不自动展开推荐问题，等用户再次点击输入框聚焦后再显示
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
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <Welcome
            variant="borderless"
            icon={
              <motion.div
                className={styles.heroMark}
                animate={
                  reduceMotion
                    ? undefined
                    : { y: [0, -3, 0], rotate: [0, 1.5, 0] }
                }
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <AgentGlyph agentKey={selectedAgent.key} size="large" active />
              </motion.div>
            }
            title="AI 创新助手"
            description="连接研发问题、技术趋势、合作伙伴与科创资源，为每一次创新决策提供清晰路径。"
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
            gap={10}
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
                  transition={{ duration: 0.28, delay: index * 0.035 }}
                >
                  <Button
                    type={selected ? 'primary' : 'default'}
                    className={styles.agentButton}
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

          <div
            ref={composerRegionRef}
            className={styles.composerRegion}
            onFocusCapture={openRecommendations}
            onBlurCapture={handleComposerBlur}
            onKeyDownCapture={handleComposerKeyDown}
          >
            <Sender
              ref={senderRef}
              value={value}
              autoSize={{ minRows: 4, maxRows: 8 }}
              submitType="enter"
              placeholder={selectedAgent.placeholder}
              onChange={setValue}
              onFocus={openRecommendations}
              onSubmit={submit}
              rootClassName={styles.sender}
              classNames={{ input: styles.senderInput }}
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
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <div className={styles.recommendationHeader}>
                    <div>
                      <Typography.Text strong>推荐问题</Typography.Text>
                      <Typography.Text type="secondary">
                        为{selectedAgent.shortName}准备的常用提问
                      </Typography.Text>
                    </div>
                  </div>
                  <Prompts
                    items={promptItems}
                    vertical
                    fadeIn
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
          </div>
        </motion.div>
      </div>
    </main>
  );
}
