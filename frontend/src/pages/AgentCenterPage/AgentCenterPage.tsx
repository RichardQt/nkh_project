import { Card, Col, Row, Typography } from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import AgentGlyph from '../../components/AgentGlyph/AgentGlyph';
import { agents } from '../../data/agents';
import { easeOut } from '../../motion/tokens';
import type { AgentDefinition } from '../../types/agent';
import styles from './AgentCenterPage.module.css';

export default function AgentCenterPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const openAgent = (item: AgentDefinition) => {
    navigate(`/chat/${item.key}`);
  };

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <header className={styles.header}>
          <Typography.Title level={2} className={styles.title}>
            智能体中心
          </Typography.Title>
        </header>

        <motion.div
          className={styles.gridWrap}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.36, ease: easeOut }
          }
        >
          <Row gutter={[16, 16]}>
            {agents.map((item, index) => (
              <Col key={item.key} xs={24} sm={12} lg={8}>
                <motion.div
                  className={styles.cardMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.28,
                    delay: reduceMotion ? 0 : 0.04 + index * 0.03,
                    ease: easeOut,
                  }}
                  whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                >
                  <Card
                    hoverable
                    className={styles.agentCard}
                    tabIndex={0}
                    role="button"
                    aria-label={`进入${item.label}`}
                    onClick={() => openAgent(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openAgent(item);
                      }
                    }}
                  >
                    <div className={styles.cardBody}>
                      <AgentGlyph agentKey={item.key} size="medium" />
                      <div className={styles.cardCopy}>
                        <Typography.Title level={4}>
                          {item.label}
                        </Typography.Title>
                        <Typography.Paragraph>
                          {item.description}
                        </Typography.Paragraph>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </motion.div>
      </div>
    </main>
  );
}
