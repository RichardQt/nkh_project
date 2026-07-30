import { useCallback, useMemo, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { AutoComplete, Button, Form, Input, Typography } from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { KnowledgeGraphView } from '../../components/KnowledgeGraph/KnowledgeGraphView';
import { KG_FIELD_MAP } from '../../data/kgFieldMap';
import { easeOut } from '../../motion/tokens';
import type { KgQueryTarget } from '../../types/kg';
import styles from './KnowledgeGraphPage.module.css';

const ENTITY_TYPE_OPTIONS = Array.from(
  new Set(
    Object.values(KG_FIELD_MAP).flatMap((fields) =>
      Object.values(fields).map((b) => b.entityType),
    ),
  ),
).sort((a, b) => a.localeCompare(b, 'zh-CN'));

const DEFAULT_ENTITY_TYPE = '技术领域(一级)';
const DEFAULT_VID = '新材料';

const DEFAULT_TARGET: KgQueryTarget = {
  entityType: DEFAULT_ENTITY_TYPE,
  vid: DEFAULT_VID,
  label: DEFAULT_VID,
};

interface QueryFormValues {
  entity_type: string;
  vid: string;
}

export default function KnowledgeGraphPage() {
  const [form] = Form.useForm<QueryFormValues>();
  const [target, setTarget] = useState<KgQueryTarget | null>(DEFAULT_TARGET);
  const [queryKey, setQueryKey] = useState(0);
  const reduceMotion = useReducedMotion();

  const entityOptions = useMemo(
    () => ENTITY_TYPE_OPTIONS.map((value) => ({ value })),
    [],
  );

  const runQuery = useCallback((values: QueryFormValues) => {
    const entityType = values.entity_type?.trim() ?? '';
    const vid = values.vid?.trim() ?? '';
    if (!entityType || !vid) {
      return;
    }
    setTarget({
      entityType,
      vid,
      label: vid,
    });
    setQueryKey((k) => k + 1);
  }, []);

  const onFinish = (values: QueryFormValues) => {
    runQuery(values);
  };

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <motion.header
          className={styles.header}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.36, ease: easeOut }
          }
        >
          <div className={styles.headerCopy}>
            <Typography.Title level={2} className={styles.title}>
              知识图谱
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              按实体类别与 VID 查询一跳子图，点击节点可继续下钻。
            </Typography.Paragraph>
          </div>
        </motion.header>

        <motion.section
          className={styles.queryCard}
          aria-label="查询参数"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.32,
            delay: reduceMotion ? 0 : 0.04,
            ease: easeOut,
          }}
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            className={styles.form}
            initialValues={{
              entity_type: DEFAULT_ENTITY_TYPE,
              vid: DEFAULT_VID,
            }}
          >
            <div className={styles.formGrid}>
              <Form.Item
                name="entity_type"
                label="实体类别"
                className={styles.formItem}
                rules={[{ required: true, message: '请输入实体类别' }]}
              >
                <AutoComplete
                  options={entityOptions}
                  filterOption={(input, option) =>
                    (option?.value ?? '')
                      .toLowerCase()
                      .includes(input.trim().toLowerCase())
                  }
                  placeholder="如：成果、人、机构、技术领域(一级)"
                  allowClear
                />
              </Form.Item>

              <Form.Item
                name="vid"
                label="实体 VID"
                className={styles.formItem}
                rules={[{ required: true, message: '请输入实体 VID' }]}
              >
                <Input
                  placeholder="如：自凝胶止血粉、拜永孝"
                  allowClear
                  onPressEnter={() => form.submit()}
                />
              </Form.Item>

              <div className={styles.formActions}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  className={styles.submitBtn}
                >
                  查询
                </Button>
              </div>
            </div>

          </Form>
        </motion.section>

        <motion.section
          className={styles.graphCard}
          aria-label="图谱结果"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.32,
            delay: reduceMotion ? 0 : 0.08,
            ease: easeOut,
          }}
        >
          {target ? (
            <div className={styles.activeMeta}>
              <span className={styles.activeBadge}>{target.entityType}</span>
              <span className={styles.activeVid}>{target.vid}</span>
            </div>
          ) : null}
          <div className={styles.graphBody}>
            <KnowledgeGraphView
              key={queryKey}
              target={target}
              fillHeight
              idleDescription="填写实体类别与 VID，点击查询后展示知识图谱"
            />
          </div>
        </motion.section>
      </div>
    </main>
  );
}
