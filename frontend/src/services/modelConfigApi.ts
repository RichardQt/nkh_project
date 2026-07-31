import { authHeaders, parseJsonResponse } from './http';

export interface LlmConfig {
  baseUrl: string;
  authorization: string;
  authorizationConfigured: boolean;
  aiApiCode: string;
  aiApiCodeConfigured: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  enableThinking: boolean;
}

export interface EmbeddingConfig {
  baseUrl: string;
  authorization: string;
  authorizationConfigured: boolean;
  aiApiCode: string;
  aiApiCodeConfigured: boolean;
  model: string;
}

export interface ModelConfig {
  llm: LlmConfig;
  embedding: EmbeddingConfig;
}

export interface ModelConfigTestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeLlm(raw: unknown): LlmConfig {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    baseUrl: asString(record.baseUrl),
    authorization: asString(record.authorization),
    authorizationConfigured: asBool(record.authorizationConfigured),
    aiApiCode: asString(record.aiApiCode),
    aiApiCodeConfigured: asBool(record.aiApiCodeConfigured),
    model: asString(record.model),
    temperature: asNumber(record.temperature, 0.7),
    maxTokens: asNumber(record.maxTokens, 4096),
    enableThinking: asBool(record.enableThinking),
  };
}

function normalizeEmbedding(raw: unknown): EmbeddingConfig {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    baseUrl: asString(record.baseUrl),
    authorization: asString(record.authorization),
    authorizationConfigured: asBool(record.authorizationConfigured),
    aiApiCode: asString(record.aiApiCode),
    aiApiCodeConfigured: asBool(record.aiApiCodeConfigured),
    model: asString(record.model),
  };
}

function normalizeConfig(raw: unknown): ModelConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('模型配置响应无效');
  }
  const record = raw as Record<string, unknown>;
  return {
    llm: normalizeLlm(record.llm),
    embedding: normalizeEmbedding(record.embedding),
  };
}

export async function fetchModelConfig(): Promise<ModelConfig> {
  const response = await fetch('/api/admin/model-config', {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  const data = await parseJsonResponse<unknown>(response);
  return normalizeConfig(data);
}

export async function saveModelConfig(
  payload: ModelConfig,
): Promise<ModelConfig> {
  const response = await fetch('/api/admin/model-config', {
    method: 'PUT',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<unknown>(response);
  return normalizeConfig(data);
}

export async function testModelConfig(
  kind: 'llm' | 'embedding',
): Promise<ModelConfigTestResult> {
  const response = await fetch('/api/admin/model-config/test', {
    method: 'POST',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ kind }),
  });
  const data = await parseJsonResponse<Record<string, unknown>>(response);
  return {
    ok: asBool(data.ok),
    message: asString(data.message, data.ok ? '测试成功' : '测试失败'),
    latencyMs:
      typeof data.latencyMs === 'number' && Number.isFinite(data.latencyMs)
        ? data.latencyMs
        : undefined,
  };
}
