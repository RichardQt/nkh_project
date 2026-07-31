import { useCallback, useEffect, useState } from 'react';
import {
  ApiOutlined,
  ExperimentOutlined,
  NodeIndexOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Space,
  Spin,
  Switch,
  Typography,
  message,
} from 'antd';
import { motion, useReducedMotion } from 'motion/react';
import { easeOut } from '../../motion/tokens';
import {
  fetchModelConfig,
  saveModelConfig,
  testModelConfig,
  type EmbeddingConfig,
  type LlmConfig,
  type ModelConfig,
  type ModelConfigKind,
  type RerankConfig,
} from '../../services/modelConfigApi';
import styles from './ModelConfigPage.module.css';

type LlmFormValues = {
  baseUrl: string;
  authorization: string;
  aiApiCode: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enableThinking: boolean;
};

type SimpleFormValues = {
  baseUrl: string;
  authorization: string;
  aiApiCode: string;
  model: string;
};

type NavItem = {
  key: ModelConfigKind;
  label: string;
  meta: string;
  icon: typeof ApiOutlined;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: 'llm',
    label: '大语言模型配置1',
    meta: 'OpenAI 兼容 /chat/completions',
    icon: ApiOutlined,
  },
  {
    key: 'llm2',
    label: '大语言模型配置2',
    meta: 'OpenAI 兼容 /chat/completions',
    icon: ApiOutlined,
  },
  {
    key: 'embedding',
    label: 'Embedding 模型',
    meta: 'OpenAI 兼容 /embeddings',
    icon: NodeIndexOutlined,
  },
  {
    key: 'rerank',
    label: 'Rerank 模型',
    meta: 'bge-reranker-v2-m3',
    icon: NodeIndexOutlined,
  },
];

function toLlmForm(llm: LlmConfig): LlmFormValues {
  return {
    baseUrl: llm.baseUrl,
    authorization: llm.authorization || '',
    aiApiCode: llm.aiApiCode || '',
    model: llm.model,
    temperature: llm.temperature,
    maxTokens: llm.maxTokens,
    enableThinking: llm.enableThinking,
  };
}

function toSimpleForm(cfg: EmbeddingConfig | RerankConfig): SimpleFormValues {
  return {
    baseUrl: cfg.baseUrl,
    authorization: cfg.authorization || '',
    aiApiCode: cfg.aiApiCode || '',
    model: cfg.model,
  };
}

function buildSavePayload(
  llmValues: LlmFormValues,
  llm2Values: LlmFormValues,
  embValues: SimpleFormValues,
  rerankValues: SimpleFormValues,
  snapshot: ModelConfig,
): ModelConfig {
  return {
    llm: {
      ...snapshot.llm,
      baseUrl: llmValues.baseUrl?.trim() ?? '',
      authorization: llmValues.authorization ?? '',
      aiApiCode: llmValues.aiApiCode ?? '',
      model: llmValues.model?.trim() ?? '',
      temperature: llmValues.temperature,
      maxTokens: llmValues.maxTokens,
      enableThinking: Boolean(llmValues.enableThinking),
    },
    llm2: {
      ...snapshot.llm2,
      baseUrl: llm2Values.baseUrl?.trim() ?? '',
      authorization: llm2Values.authorization ?? '',
      aiApiCode: llm2Values.aiApiCode ?? '',
      model: llm2Values.model?.trim() ?? '',
      temperature: llm2Values.temperature,
      maxTokens: llm2Values.maxTokens,
      enableThinking: Boolean(llm2Values.enableThinking),
    },
    embedding: {
      ...snapshot.embedding,
      baseUrl: embValues.baseUrl?.trim() ?? '',
      authorization: embValues.authorization ?? '',
      aiApiCode: embValues.aiApiCode ?? '',
      model: embValues.model?.trim() ?? '',
    },
    rerank: {
      ...snapshot.rerank,
      baseUrl: rerankValues.baseUrl?.trim() ?? '',
      authorization: rerankValues.authorization ?? '',
      aiApiCode: rerankValues.aiApiCode ?? '',
      model: rerankValues.model?.trim() ?? '',
    },
  };
}

function SecretInput(props: {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  placeholder?: string;
}) {
  return (
    <Input.Password
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      visibilityToggle
      autoComplete="off"
    />
  );
}

export default function ModelConfigPage() {
  const reduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState<ModelConfigKind>('llm');
  const [llmForm] = Form.useForm<LlmFormValues>();
  const [llm2Form] = Form.useForm<LlmFormValues>();
  const [embForm] = Form.useForm<SimpleFormValues>();
  const [rerankForm] = Form.useForm<SimpleFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [snapshot, setSnapshot] = useState<ModelConfig | null>(null);

  const applyConfig = useCallback(
    (config: ModelConfig) => {
      setSnapshot(config);
      llmForm.setFieldsValue(toLlmForm(config.llm));
      llm2Form.setFieldsValue(toLlmForm(config.llm2));
      embForm.setFieldsValue(toSimpleForm(config.embedding));
      rerankForm.setFieldsValue(toSimpleForm(config.rerank));
    },
    [embForm, llm2Form, llmForm, rerankForm],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await fetchModelConfig();
      applyConfig(config);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : '加载模型配置失败';
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  const collectPayload = async (): Promise<ModelConfig | null> => {
    if (!snapshot) {
      return null;
    }
    const llmValues = await llmForm.validateFields();
    const llm2Values = await llm2Form.validateFields();
    const embValues = await embForm.validateFields();
    const rerankValues = await rerankForm.validateFields();
    return buildSavePayload(
      llmValues,
      llm2Values,
      embValues,
      rerankValues,
      snapshot,
    );
  };

  const handleSave = async () => {
    try {
      const payload = await collectPayload();
      if (!payload) {
        return;
      }
      setSaving(true);
      const next = await saveModelConfig(payload);
      applyConfig(next);
      message.success('模型配置已保存');
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        message.warning('请先完善各模型的必填项');
        return;
      }
      const text =
        error instanceof Error ? error.message : '保存模型配置失败';
      message.error(text);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      const payload = await collectPayload();
      if (!payload) {
        return;
      }
      setTesting(true);
      const next = await saveModelConfig(payload);
      applyConfig(next);

      const result = await testModelConfig(activeKey);
      if (result.ok) {
        const latency =
          typeof result.latencyMs === 'number'
            ? `（${result.latencyMs}ms）`
            : '';
        message.success(`${result.message}${latency}`);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        message.warning('请先完善各模型的必填项');
        return;
      }
      const text = error instanceof Error ? error.message : '测试失败';
      message.error(text);
    } finally {
      setTesting(false);
    }
  };

  const activeNav = NAV_ITEMS.find((item) => item.key === activeKey) ?? NAV_ITEMS[0];
  const ActiveIcon = activeNav.icon;

  const renderLlmForm = (
    form: ReturnType<typeof Form.useForm<LlmFormValues>>[0],
    modelPlaceholder: string,
  ) => (
    <Form form={form} layout="vertical" className={styles.form} requiredMark={false}>
      <Form.Item
        label="服务地址"
        name="baseUrl"
        rules={[{ required: true, message: '请输入服务地址' }]}
      >
        <Input placeholder="http://host:port/v1" allowClear />
      </Form.Item>
      <Form.Item label="Authorization" name="authorization">
        <SecretInput placeholder="密钥，可点击右侧眼睛切换显示" />
      </Form.Item>
      <Form.Item label="AI-API-CODE" name="aiApiCode">
        <SecretInput placeholder="API Code" />
      </Form.Item>
      <Form.Item
        label="模型名称"
        name="model"
        rules={[{ required: true, message: '请输入模型名称' }]}
      >
        <Input placeholder={modelPlaceholder} allowClear />
      </Form.Item>
      <div className={`${styles.formRow} ${styles.formRowTwo}`}>
        <Form.Item label="温度 temperature" name="temperature">
          <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="最大输出 Token" name="maxTokens">
          <InputNumber min={1} max={128000} step={256} style={{ width: '100%' }} />
        </Form.Item>
      </div>
      <Form.Item label="启用 Thinking" name="enableThinking" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );

  const renderSimpleForm = (
    form: ReturnType<typeof Form.useForm<SimpleFormValues>>[0],
    opts: { basePlaceholder: string; modelPlaceholder: string },
  ) => (
    <Form form={form} layout="vertical" className={styles.form} requiredMark={false}>
      <Form.Item
        label="服务地址"
        name="baseUrl"
        rules={[{ required: true, message: '请输入服务地址' }]}
      >
        <Input placeholder={opts.basePlaceholder} allowClear />
      </Form.Item>
      <Form.Item label="Authorization" name="authorization">
        <SecretInput placeholder="密钥，可点击右侧眼睛切换显示" />
      </Form.Item>
      <Form.Item label="AI-API-CODE" name="aiApiCode">
        <SecretInput placeholder="API Code" />
      </Form.Item>
      <Form.Item
        label="模型名称"
        name="model"
        rules={[{ required: true, message: '请输入模型名称' }]}
      >
        <Input placeholder={opts.modelPlaceholder} allowClear />
      </Form.Item>
    </Form>
  );

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
              模型配置
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              在此管理各类模型的服务地址与调用参数，按左侧分类切换后即可编辑并保存。
            </Typography.Paragraph>
          </div>
        </motion.header>

        {loading ? (
          <div className={styles.loadingWrap}>
            <Spin tip="加载配置中" />
          </div>
        ) : (
          <>
            <motion.div
              className={styles.workspace}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.32,
                delay: reduceMotion ? 0 : 0.04,
                ease: easeOut,
              }}
            >
              <nav className={styles.nav} aria-label="模型类型">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === activeKey;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                      onClick={() => setActiveKey(item.key)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className={styles.navItemLabel}>
                        <Icon className={styles.navItemIcon} />
                        {item.label}
                      </span>
                      <span className={styles.navItemMeta}>{item.meta}</span>
                    </button>
                  );
                })}
              </nav>

              <section className={styles.panel} aria-label={activeNav.label}>
                <div className={styles.panelHead}>
                  <div className={styles.panelTitleBlock}>
                    <div className={styles.panelTitle}>
                      <ActiveIcon className={styles.panelIcon} />
                      {activeNav.label}
                    </div>
                    <div className={styles.panelMeta}>{activeNav.meta}</div>
                  </div>
                </div>
                <div className={styles.panelBody}>
                  <div hidden={activeKey !== 'llm'}>
                    {renderLlmForm(llmForm, 'Qwen3.6-35B-A3B')}
                  </div>
                  <div hidden={activeKey !== 'llm2'}>
                    {renderLlmForm(llm2Form, 'Qwen3.6-35B-A3B')}
                  </div>
                  <div hidden={activeKey !== 'embedding'}>
                    {renderSimpleForm(embForm, {
                      basePlaceholder: 'http://host:port/v1',
                      modelPlaceholder: 'bge-m3',
                    })}
                  </div>
                  <div hidden={activeKey !== 'rerank'}>
                    {renderSimpleForm(rerankForm, {
                      basePlaceholder: 'http://host:port/rerank',
                      modelPlaceholder: 'bge-reranker-v2-m3',
                    })}
                  </div>
                  <div className={styles.panelActions}>
                    <Button
                      icon={<ExperimentOutlined />}
                      loading={testing}
                      onClick={() => void handleTest()}
                    >
                      测试连通
                    </Button>
                  </div>
                </div>
              </section>
            </motion.div>

            <motion.div
              className={styles.footerBar}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.28,
                delay: reduceMotion ? 0 : 0.08,
                ease: easeOut,
              }}
            >
              <Typography.Text className={styles.footerNote}>
                修改参数后请先保存，再通过测试确认服务可用。
              </Typography.Text>
              <Space wrap>
                <Button onClick={() => void load()} disabled={saving}>
                  重新加载
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => void handleSave()}
                >
                  保存配置
                </Button>
              </Space>
            </motion.div>
          </>
        )}
      </div>
    </main>
  );
}
