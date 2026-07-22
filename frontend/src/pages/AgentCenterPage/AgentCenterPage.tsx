import { ArrowRightOutlined } from '@ant-design/icons';
import { Card, Col, Flex, Row, Typography } from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import AgentGlyph from '../../components/AgentGlyph/AgentGlyph';
import { agents } from '../../data/agents';
import { easeOut, springSoft } from '../../motion/tokens';
import styles from './AgentCenterPage.module.css';

export default function AgentCenterPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <motion.header
          className={styles.intro}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.36, ease: easeOut }
          }
        >
          <Typography.Title level={2}>选择你的创新智能体</Typography.Title>
          <Typography.Paragraph>
            七个智能体覆盖成果匹配、专家推荐、合作拓客与政策资源。选择一个方向，直接开始对话。
          </Typography.Paragraph>
        </motion.header>

        <Row gutter={[16, 16]}>
          {agents.map((agent, index) => (
            <Col xs={24} md={12} xl={8} key={agent.key}>
              <motion.div
                className={styles.cardMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={
                  reduceMotion ? undefined : { y: -3, transition: springSoft }
                }
                transition={{
                  duration: 0.32,
                  delay: reduceMotion ? 0 : index * 0.04,
                  ease: easeOut,
                }}
              >
                <Card
                  hoverable
                  className={styles.agentCard}
                  onClick={() => navigate(`/chat/${agent.key}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/chat/${agent.key}`);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                  aria-label={`进入${agent.name}`}
                >
                  <Flex vertical className={styles.cardBody}>
                    <Flex align="flex-start" gap={12}>
                      <AgentGlyph agentKey={agent.key} size="medium" />
                      <div className={styles.cardCopy}>
                        <Typography.Title level={4}>
                          {agent.name}
                        </Typography.Title>
                        <Typography.Paragraph>
                          {agent.description}
                        </Typography.Paragraph>
                      </div>
                    </Flex>

                    <Typography.Paragraph className={styles.cardDetail}>
                      {agent.detail}
                    </Typography.Paragraph>

                    <Typography.Text className={styles.enterButton}>
                      进入助手
                      <span className={styles.enterIcon}>
                        <ArrowRightOutlined aria-hidden="true" />
                      </span>
                    </Typography.Text>
                  </Flex>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      </div>
    </main>
  );
}
