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

/** One potential demand direction from ``event: research_directions``. */
export interface ResearchDirectionPillar {
  title: string;
  reason: string;
}

export interface ResearchDirectionResult {
  kind: 'research_direction';
  inputSummary: string;
  /** Expert list payload (same shape as 专家发现 related_entries). */
  experts: RelatedEntriesPayload;
  /** Standalone recommend reason shown below expert list. */
  recommendReason: string;
  /**
   * Flattened summary text (mock stream / fallback parse).
   * Real B path prefers structured fields below.
   */
  summary: string;
  /** section_stream sum_Requirements — 企业潜在需求总结 */
  requirementsSummary?: string;
  /** event research_directions — 潜在需求方向 */
  directions?: ResearchDirectionPillar[];
  /** section_stream Overall — 综合研判 */
  overall?: string;
}

export type SceneResult =
  | PolicyRecommendResult
  | AchievementEvalResult
  | ResearchDirectionResult;

/**
 * Scenes that still have a local mock demo path.
 * research_direction / achievement_eval / policy_recommend hit mock only on demo keyword;
 * otherwise they use real /api/chat/stream.
 */
export const SCENE_MOCK_AGENT_KEYS = ['research_direction'] as const;

export type SceneMockAgentKey = (typeof SCENE_MOCK_AGENT_KEYS)[number];

export function isSceneMockAgentKey(
  value: string | null | undefined,
): value is SceneMockAgentKey {
  return value === 'research_direction';
}

const EMPTY_RESEARCH_EXPERTS: RelatedEntriesPayload = {
  listKey: 'expert_team',
  fields: [],
  items: [],
};

/** Empty research_direction scene shell for progressive SSE patches. */
export function emptyResearchDirectionResult(
  inputSummary = '',
): ResearchDirectionResult {
  return {
    kind: 'research_direction',
    inputSummary: inputSummary.trim(),
    experts: EMPTY_RESEARCH_EXPERTS,
    recommendReason: '',
    summary: '',
  };
}

/** Ensure target has a research_direction sceneResult (create if missing). */
export function ensureResearchDirectionResult(
  current: SceneResult | undefined | null,
  options?: {
    inputSummary?: string;
    experts?: RelatedEntriesPayload;
  },
): ResearchDirectionResult {
  if (current?.kind === 'research_direction') {
    return current;
  }
  return {
    ...emptyResearchDirectionResult(options?.inputSummary ?? ''),
    ...(options?.experts ? { experts: options.experts } : {}),
  };
}

/** Patch recommend reason from ``event: recommended_expert``. */
export function patchResearchRecommendReason(
  result: ResearchDirectionResult,
  reason: string,
): ResearchDirectionResult {
  return { ...result, recommendReason: reason };
}

/** Patch experts from ``event: related_entries``. */
export function patchResearchExperts(
  result: ResearchDirectionResult,
  experts: RelatedEntriesPayload,
): ResearchDirectionResult {
  return { ...result, experts };
}

/** Patch section_stream sum_Requirements / Overall (and optional flattened summary). */
export function patchResearchSectionFields(
  result: ResearchDirectionResult,
  patch: {
    requirementsSummary?: string;
    overall?: string;
    summary?: string;
  },
): ResearchDirectionResult {
  return {
    ...result,
    ...(patch.requirementsSummary !== undefined
      ? { requirementsSummary: patch.requirementsSummary }
      : {}),
    ...(patch.overall !== undefined ? { overall: patch.overall } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
  };
}

/** Pull directions array from common B/proxy payload shapes. */
function extractResearchDirectionsArray(
  payload: Record<string, unknown>,
): unknown[] {
  const directKeys = ['directions', 'items', 'list', 'research_directions'];
  for (const key of directKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  for (const wrapKey of ['data', 'result', 'payload', 'body']) {
    const nested = payload[wrapKey];
    if (Array.isArray(nested)) {
      return nested;
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const row = nested as Record<string, unknown>;
      for (const key of directKeys) {
        const value = row[key];
        if (Array.isArray(value)) {
          return value;
        }
      }
    }
  }
  return [];
}

function researchDirectionText(
  row: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

/** Map ``event: research_directions`` into UI pillars. */
export function buildResearchDirectionsFromPayload(
  payload: Record<string, unknown> | unknown[],
): ResearchDirectionPillar[] {
  const raw = Array.isArray(payload)
    ? payload
    : extractResearchDirectionsArray(payload);
  if (!raw.length) {
    return [];
  }
  const out: ResearchDirectionPillar[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const title = researchDirectionText(row, [
      'title',
      'name',
      'direction',
      'label',
    ]);
    const reason = researchDirectionText(row, [
      'reason',
      'body',
      'content',
      'description',
      'desc',
      'summary',
      'brief',
    ]);
    if (!title && !reason) {
      continue;
    }
    out.push({ title: title || '潜在需求方向', reason });
  }
  return out;
}

/** Merge directions list into an existing research result. */
export function patchResearchDirections(
  result: ResearchDirectionResult,
  directions: ResearchDirectionPillar[],
): ResearchDirectionResult {
  return { ...result, directions };
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

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapProvincialPolicy(
  raw: unknown,
  idPrefix: string,
  index: number,
): ProvincialPolicy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const item_name =
    asTrimmedString(row.policy_name) || asTrimmedString(row.item_name);
  if (!item_name) {
    return null;
  }
  return {
    id: `${idPrefix}-p-${index}`,
    item_name,
    level: asTrimmedString(row.source_level) || asTrimmedString(row.level) || '省级',
    funding_amount: asTrimmedString(row.funding_amount),
    item_category_description:
      asTrimmedString(row.category_intro) ||
      asTrimmedString(row.item_category_description),
    project_description:
      asTrimmedString(row.project_intro) ||
      asTrimmedString(row.project_description),
    application_requirements:
      asTrimmedString(row.requirements) ||
      asTrimmedString(row.application_requirements),
    application_channel: asTrimmedString(row.application_channel),
    application_url: asTrimmedString(row.application_url),
    related_policy_document_name:
      asTrimmedString(row.source_document) ||
      asTrimmedString(row.related_policy_document_name),
  };
}

function mapMunicipalPolicy(
  raw: unknown,
  idPrefix: string,
  index: number,
): MunicipalPolicy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const policy_category = asTrimmedString(row.policy_category);
  const support_content = asTrimmedString(row.support_content);
  if (!policy_category && !support_content) {
    return null;
  }
  return {
    id: `${idPrefix}-m-${index}`,
    policy_category: policy_category || '市级政策',
    supported_region:
      asTrimmedString(row.support_region) ||
      asTrimmedString(row.supported_region),
    supported_entities:
      asTrimmedString(row.support_target) ||
      asTrimmedString(row.supported_entities),
    support_content,
    source_document: asTrimmedString(row.source_document),
  };
}

function mapPolicyList(
  items: unknown,
  mapFn: (raw: unknown, idPrefix: string, index: number) => ProvincialPolicy | MunicipalPolicy | null,
  idPrefix: string,
): (ProvincialPolicy | MunicipalPolicy)[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const out: (ProvincialPolicy | MunicipalPolicy)[] = [];
  items.forEach((item, index) => {
    const mapped = mapFn(item, idPrefix, index);
    if (mapped) {
      out.push(mapped);
    }
  });
  return out;
}

function readMatchBucket(raw: unknown): {
  fully: unknown[];
  inadequate: unknown[];
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fully: [], inadequate: [] };
  }
  const record = raw as Record<string, unknown>;
  return {
    fully: Array.isArray(record.fully) ? record.fully : [],
    inadequate: Array.isArray(record.inadequate) ? record.inadequate : [],
  };
}

/** Map upstream ``event: policy_match`` into UI result. */
export function buildPolicyRecommendFromMatch(
  payload: Record<string, unknown>,
  options?: { inputSummary?: string; recommendReason?: string },
): PolicyRecommendResult {
  const province = readMatchBucket(payload.province ?? payload.provincial);
  const city = readMatchBucket(payload.city ?? payload.municipal);

  const fullyProvincial = mapPolicyList(
    province.fully,
    mapProvincialPolicy,
    'full',
  ) as ProvincialPolicy[];
  const partialProvincial = mapPolicyList(
    province.inadequate,
    mapProvincialPolicy,
    'partial',
  ) as ProvincialPolicy[];
  const fullyMunicipal = mapPolicyList(
    city.fully,
    mapMunicipalPolicy,
    'full',
  ) as MunicipalPolicy[];
  const partialMunicipal = mapPolicyList(
    city.inadequate,
    mapMunicipalPolicy,
    'partial',
  ) as MunicipalPolicy[];

  return {
    kind: 'policy_recommend',
    inputSummary: options?.inputSummary?.trim() ?? '',
    fullyMatched: {
      provincial: fullyProvincial,
      municipal: fullyMunicipal,
    },
    partiallyMatched: {
      provincial: partialProvincial,
      municipal: partialMunicipal,
    },
    recommendReason: options?.recommendReason?.trim() ?? '',
  };
}

/** Merge streaming summary into an existing policy recommend result. */
export function patchPolicyRecommendReason(
  result: PolicyRecommendResult,
  reason: string,
): PolicyRecommendResult {
  return {
    ...result,
    recommendReason: reason,
  };
}
