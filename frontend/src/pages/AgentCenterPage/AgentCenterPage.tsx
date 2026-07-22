import { ArrowRightOutlined } from '@ant-design/icons';
import { Card, Col, Flex, Row, Typography } from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import AgentGlyph from '../../components/AgentGlyph/AgentGlyph';
import { agents } from '../../data/agents';
import styles from './AgentCenterPage.module.css';

export default function AgentCenterPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.intro}>
          <Typography.Title level={2}>选择你的创新智能体</Typography.Title>
          <Typography.Paragraph>
            六个智能体覆盖研发研判、产业连接与资源发现。选择一个方向，直接开始新的对话。
          </Typography.Paragraph>
        </header>

        <Row gutter={[20, 20]}>
          {agents.map((agent, index) => (
            <Col xs={24} md={12} xl={8} key={agent.key}>
              <motion.div
                className={styles.cardMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.045,
                  ease: [0.22, 1, 0.36, 1],
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
                    <Flex align="flex-start" gap={14}>
                      <AgentGlyph agentKey={agent.key} size="medium" />
                      <div className={styles.cardCopy}>
                        <Typography.Title level={4}>{agent.name}</Typography.Title>
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
                      <ArrowRightOutlined aria-hidden="true" />
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
