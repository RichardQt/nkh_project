import type { RelatedEntriesPayload } from './chat';

/** Search-engine hit (mock or real web_search event). */
export interface SearchResultItem {
  title: string;
  /** Optional; omitted when upstream has no source field. */
  source?: string;
  snippet: string;
  /** Optional; empty URL is not shown as a link. */
  url?: string;
}

export interface SearchPreviewState {
  query: string;
  status: 'loading' | 'success';
  results: SearchResultItem[];
  /** Shown while loading, e.g. 正在调取联网搜索 */
  statusHint?: string;
}

/** 省级政策（provincial_policies）— 列表 + 详情字段 */
export interface ProvincialPolicy {
  id: string;
  /** 列表 · 事项名称 */
  item_name: string;
  /** 列表 · 级别 */
  level: string;
  /** 列表 · 资助金额 */
  funding_amount: string;
  /** 详情 · 事项类别介绍 */
  item_category_description: string;
  /** 详情 · 项目介绍 */
  project_description: string;
  /** 详情 · 申报要求 */
  application_requirements: string;
  /** 详情 · 申报途径 */
  application_channel: string;
  /** 详情 · 申报网址 */
  application_url: string;
  /** 详情 · 相关政策文件名称 */
  related_policy_document_name: string;
}

/** 市级政策（municipal_policies）— 列表 + 详情字段 */
export interface MunicipalPolicy {
  id: string;
  /** 列表 · 政策类别 */
  policy_category: string;
  /** 列表 · 支持区域 */
  supported_region: string;
  /** 列表 · 支持对象 */
  supported_entities: string;
  /** 列表/详情 · 支持内容 */
  support_content: string;
  /** 详情 · 来源文件 */
  source_document: string;
}

/** 一组匹配结果：省级 + 市级 */
export interface PolicyMatchGroup {
  provincial: ProvincialPolicy[];
  municipal: MunicipalPolicy[];
}

export interface PolicyRecommendResult {
  kind: 'policy_recommend';
  inputSummary: string;
  fullyMatched: PolicyMatchGroup;
  partiallyMatched: PolicyMatchGroup;
  /** Standalone recommend reason shown below policy lists, above suggested questions. */
  recommendReason: string;
}

/** One scoring dimension (创新性 / 成熟度 / 市场前景 / 可行性). */
export interface AchievementEvalDimension {
  /** Display label, e.g. 创新性 */
  label: string;
  /** Score numerator, e.g. 18 */
  score: number;
  /** Score denominator, typically 25 */
  max: number;
  /** Visible highlight text */
  highlight: string;
  /** Weakness text shown on ? icon hover/focus */
  weakness: string;
}

export interface AchievementEvalItem {
  title: string;
  dimensions: AchievementEvalDimension[];
  total: number;
  maxTotal: number;
  reason: string;
}

export interface AchievementEvalResult {
  kind: 'achievement_eval';
  inputSummary: string;
  evaluations: AchievementEvalItem[];
}

export interface ResearchDirectionResult {
  kind: 'research_direction';
  inputSummary: string;
  /** Expert list payload (same shape as 专家发现 related_entries). */
  experts: RelatedEntriesPayload;
  /** Standalone recommend reason shown below expert list. */
  recommendReason: string;
  summary: string;
}

export type SceneResult =
  | PolicyRecommendResult
  | AchievementEvalResult
  | ResearchDirectionResult;

/** Scenes still driven by local mock SSE (achievement_eval uses real /api/chat/stream). */
export const SCENE_MOCK_AGENT_KEYS = [
  'policy_recommend',
  'research_direction',
] as const;

export type SceneMockAgentKey = (typeof SCENE_MOCK_AGENT_KEYS)[number];

export function isSceneMockAgentKey(
  value: string | null | undefined,
): value is SceneMockAgentKey {
  return value === 'policy_recommend' || value === 'research_direction';
}

/** Dimension keys from upstream ``event: score``. */
export const ACHIEVEMENT_EVAL_SCORE_KEYS = [
  'innovation',
  'maturity',
  'market_prospect',
  'feasibility',
] as const;

export type AchievementEvalScoreKey =
  (typeof ACHIEVEMENT_EVAL_SCORE_KEYS)[number];

export const ACHIEVEMENT_EVAL_SCORE_LABELS: Record<
  AchievementEvalScoreKey,
  string
> = {
  innovation: '创新性',
  maturity: '成熟度',
  market_prospect: '市场前景',
  feasibility: '可行性',
};

export interface AchievementEvalScoreDim {
  score?: number;
  advantage?: string;
  disadvantage?: string;
}

/** Raw payload from ``event: score`` (achievement_eval). */
export interface AchievementEvalScorePayload {
  innovation?: AchievementEvalScoreDim;
  maturity?: AchievementEvalScoreDim;
  market_prospect?: AchievementEvalScoreDim;
  feasibility?: AchievementEvalScoreDim;
  total_score?: number;
  simple_brief?: string;
}

const DEFAULT_DIM_MAX = 25;

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function asScoreDim(raw: unknown): AchievementEvalScoreDim | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const dim: AchievementEvalScoreDim = {};
  const score = asFiniteNumber(record.score);
  if (score !== null) {
    dim.score = score;
  }
  if (typeof record.advantage === 'string') {
    dim.advantage = record.advantage;
  }
  if (typeof record.disadvantage === 'string') {
    dim.disadvantage = record.disadvantage;
  }
  // Accept dim if any field is present (score / advantage / disadvantage).
  if (
    dim.score === undefined &&
    !dim.advantage?.trim() &&
    !dim.disadvantage?.trim()
  ) {
    return null;
  }
  return dim;
}

/** Map upstream ``event: score`` + summary text into UI result. */
export function buildAchievementEvalFromScore(
  payload: Record<string, unknown>,
  options?: { reason?: string; inputSummary?: string },
): AchievementEvalResult {
  const dimensions: AchievementEvalDimension[] = [];
  for (const key of ACHIEVEMENT_EVAL_SCORE_KEYS) {
    const dim = asScoreDim(payload[key]);
    if (!dim) {
      continue;
    }
    dimensions.push({
      label: ACHIEVEMENT_EVAL_SCORE_LABELS[key],
      score: typeof dim.score === 'number' ? dim.score : 0,
      max: DEFAULT_DIM_MAX,
      highlight: dim.advantage?.trim() ?? '',
      weakness: dim.disadvantage?.trim() ?? '',
    });
  }

  const totalFromPayload = asFiniteNumber(payload.total_score);
  const total =
    totalFromPayload ??
    dimensions.reduce((sum, item) => sum + item.score, 0);
  const maxTotal =
    dimensions.length > 0
      ? dimensions.reduce((sum, item) => sum + item.max, 0)
      : 100;
  const title =
    typeof payload.simple_brief === 'string' && payload.simple_brief.trim()
      ? payload.simple_brief.trim()
      : options?.inputSummary?.trim() || '成果评估';

  return {
    kind: 'achievement_eval',
    inputSummary: options?.inputSummary?.trim() ?? '',
    evaluations: [
      {
        title,
        dimensions,
        total,
        maxTotal,
        reason: options?.reason?.trim() ?? '',
      },
    ],
  };
}

/** Merge streaming summary / reason into an existing eval result. */
export function patchAchievementEvalReason(
  result: AchievementEvalResult,
  reason: string,
): AchievementEvalResult {
  if (!result.evaluations.length) {
    return result;
  }
  return {
    ...result,
    evaluations: result.evaluations.map((item, index) =>
      index === 0 ? { ...item, reason } : item,
    ),
  };
}
