import { useRef, useState } from 'react';
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

export default function HomePage() {
  const [selectedKey, setSelectedKey] = useState<AgentKey | null>(null);
  const [value, setValue] = useState('');
  const senderRef = useRef<ComponentRef<typeof Sender>>(null);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();

  const agentsByKey = new Map(agents.map((item) => [item.key, item]));
  const topItems = homeNavTopKeys
    .map((key) => agentsByKey.get(key))
    .filter((item): item is AgentDefinition => Boolean(item));
  const bottomItems = homeNavBottomKeys
    .map((key) => agentsByKey.get(key))
    .filter((item): item is AgentDefinition => Boolean(item));

  const selectItem = (key: AgentKey) => {
    setSelectedKey((current) => (current === key ? null : key));
  };

  const submit = (message: string) => {
    const question = message.trim();
    if (!question) {
      senderRef.current?.focus();
      return;
    }

    // 有选中入口则带上 scene key，供后端 A 识别场景；对话本身统一走接口
    const path = selectedKey ? `/chat/${selectedKey}` : '/chat';
    navigate(`${path}?q=${encodeURIComponent(question)}`, {
      state: { initialQuestion: question },
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
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
