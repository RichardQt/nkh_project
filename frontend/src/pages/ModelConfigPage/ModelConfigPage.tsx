import { useCallback, useEffect, useState } from 'react';
import {
  ApiOutlined,
  ExperimentOutlined,
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
} from '../../services/modelConfigApi';
import styles from './ModelConfigPage.module.css';

const SECRET_MASK = '********';

type LlmFormValues = {
  baseUrl: string;
  authorization: string;
  aiApiCode: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enableThinking: boolean;
};

type EmbeddingFormValues = {
  baseUrl: string;
  authorization: string;
  aiApiCode: string;
  model: string;
};

function secretFieldValue(
  configured: boolean,
  current: string,
): string {
  if (configured) {
    return SECRET_MASK;
  }
  return current || '';
}

function toLlmForm(llm: LlmConfig): LlmFormValues {
  return {
    baseUrl: llm.baseUrl,
    authorization: secretFieldValue(
      llm.authorizationConfigured,
      llm.authorization,
    ),
    aiApiCode: secretFieldValue(llm.aiApiCodeConfigured, llm.aiApiCode),
    model: llm.model,
    temperature: llm.temperature,
    maxTokens: llm.maxTokens,
    enableThinking: llm.enableThinking,
  };
}

function toEmbeddingForm(emb: EmbeddingConfig): EmbeddingFormValues {
  return {
    baseUrl: emb.baseUrl,
    authorization: secretFieldValue(
      emb.authorizationConfigured,
      emb.authorization,
    ),
    aiApiCode: secretFieldValue(emb.aiApiCodeConfigured, emb.aiApiCode),
    model: emb.model,
  };
}

function buildSavePayload(
  llmValues: LlmFormValues,
  embValues: EmbeddingFormValues,
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
    embedding: {
      ...snapshot.embedding,
      baseUrl: embValues.baseUrl?.trim() ?? '',
      authorization: embValues.authorization ?? '',
      aiApiCode: embValues.aiApiCode ?? '',
      model: embValues.model?.trim() ?? '',
    },
  };
}

export default function ModelConfigPage() {
  const reduceMotion = useReducedMotion();
  const [llmForm] = Form.useForm<LlmFormValues>();
  const [embForm] = Form.useForm<EmbeddingFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingEmb, setTestingEmb] = useState(false);
  const [snapshot, setSnapshot] = useState<ModelConfig | null>(null);

  const applyConfig = useCallback(
    (config: ModelConfig) => {
      setSnapshot(config);
      llmForm.setFieldsValue(toLlmForm(config.llm));
      embForm.setFieldsValue(toEmbeddingForm(config.embedding));
    },
    [embForm, llmForm],
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

  const handleSave = async () => {
    if (!snapshot) {
      return;
    }
    try {
      const llmValues = await llmForm.validateFields();
      const embValues = await embForm.validateFields();
      setSaving(true);
      const payload = buildSavePayload(llmValues, embValues, snapshot);
      const next = await saveModelConfig(payload);
      applyConfig(next);
      message.success('模型配置已保存');
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      const text =
        error instanceof Error ? error.message : '保存模型配置失败';
      message.error(text);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (kind: 'llm' | 'embedding') => {
    if (!snapshot) {
      return;
    }
    const setBusy = kind === 'llm' ? setTestingLlm : setTestingEmb;
    setBusy(true);
    try {
      // Persist current form first so test uses latest non-secret fields.
      const llmValues = await llmForm.validateFields();
      const embValues = await embForm.validateFields();
      const payload = buildSavePayload(llmValues, embValues, snapshot);
      const next = await saveModelConfig(payload);
      applyConfig(next);

      const result = await testModelConfig(kind);
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
        return;
      }
      const text = error instanceof Error ? error.message : '测试失败';
      message.error(text);
    } finally {
      setBusy(false);
    }
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
              模型配置
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              配置大语言模型与 Embedding 接入参数。密钥脱敏展示，留空或保持掩码表示不修改。
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
              className={styles.grid}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.32,
                delay: reduceMotion ? 0 : 0.04,
                ease: easeOut,
              }}
            >
              <section className={styles.card} aria-label="大语言模型">
                <div className={styles.cardHead}>
                  <div className={styles.cardTitleBlock}>
                    <div className={styles.cardTitle}>
                      <ApiOutlined className={styles.cardIcon} />
                      大语言模型
                    </div>
                    <div className={styles.cardMeta}>
                      OpenAI 兼容 /chat/completions
                    </div>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <Form
                    form={llmForm}
                    layout="vertical"
                    className={styles.form}
                    requiredMark={false}
                  >
                    <Form.Item
                      label="服务地址"
                      name="baseUrl"
                      rules={[{ required: true, message: '请输入服务地址' }]}
                    >
                      <Input placeholder="http://host:port/v1" allowClear />
                    </Form.Item>
                    <Form.Item label="Authorization" name="authorization">
                      <Input.Password
                        placeholder="密钥"
                        visibilityToggle
                        autoComplete="off"
                      />
                    </Form.Item>
                    <div className={styles.secretHint}>
                      已配置时显示掩码；填写新值可覆盖，保持掩码则不改动。
                    </div>
                    <Form.Item label="AI-API-CODE" name="aiApiCode">
                      <Input.Password
                        placeholder="API Code"
                        visibilityToggle
                        autoComplete="off"
                      />
                    </Form.Item>
                    <Form.Item
                      label="模型名称"
                      name="model"
                      rules={[{ required: true, message: '请输入模型名称' }]}
                    >
                      <Input placeholder="Qwen3.6-35B-A3B" allowClear />
                    </Form.Item>
                    <Form.Item label="温度 temperature" name="temperature">
                      <InputNumber
                        min={0}
                        max={2}
                        step={0.1}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item label="最大输出 Token" name="maxTokens">
                      <InputNumber
                        min={1}
                        max={128000}
                        step={256}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="启用 Thinking"
                      name="enableThinking"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Form>
                  <div className={styles.cardActions}>
                    <Button
                      icon={<ExperimentOutlined />}
                      loading={testingLlm}
                      onClick={() => void handleTest('llm')}
                    >
                      测试连通
                    </Button>
                  </div>
                </div>
              </section>

              <section className={styles.card} aria-label="Embedding 模型">
                <div className={styles.cardHead}>
                  <div className={styles.cardTitleBlock}>
                    <div className={styles.cardTitle}>
                      <ApiOutlined className={styles.cardIcon} />
                      Embedding 模型
                    </div>
                    <div className={styles.cardMeta}>
                      OpenAI 兼容 /embeddings · 默认 bge-m3
                    </div>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <Form
                    form={embForm}
                    layout="vertical"
                    className={styles.form}
                    requiredMark={false}
                  >
                    <Form.Item
                      label="服务地址"
                      name="baseUrl"
                      rules={[{ required: true, message: '请输入服务地址' }]}
                    >
                      <Input placeholder="http://host:port/v1" allowClear />
                    </Form.Item>
                    <Form.Item label="Authorization" name="authorization">
                      <Input.Password
                        placeholder="密钥"
                        visibilityToggle
                        autoComplete="off"
                      />
                    </Form.Item>
                    <div className={styles.secretHint}>
                      已配置时显示掩码；填写新值可覆盖，保持掩码则不改动。
                    </div>
                    <Form.Item label="AI-API-CODE" name="aiApiCode">
                      <Input.Password
                        placeholder="API Code"
                        visibilityToggle
                        autoComplete="off"
                      />
                    </Form.Item>
                    <Form.Item
                      label="模型名称"
                      name="model"
                      rules={[{ required: true, message: '请输入模型名称' }]}
                    >
                      <Input placeholder="bge-m3" allowClear />
                    </Form.Item>
                  </Form>
                  <div className={styles.cardActions}>
                    <Button
                      icon={<ExperimentOutlined />}
                      loading={testingEmb}
                      onClick={() => void handleTest('embedding')}
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
