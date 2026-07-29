import type { RelatedEntriesPayload } from './chat';

/** Fake search-engine hit shown before final scene results. */
export interface SearchResultItem {
  title: string;
  source: string;
  snippet: string;
  url: string;
}

export interface SearchPreviewState {
  query: string;
  status: 'loading' | 'success';
  results: SearchResultItem[];
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

export const SCENE_MOCK_AGENT_KEYS = [
  'policy_recommend',
  'achievement_eval',
  'research_direction',
] as const;

export type SceneMockAgentKey = (typeof SCENE_MOCK_AGENT_KEYS)[number];

export function isSceneMockAgentKey(
  value: string | null | undefined,
): value is SceneMockAgentKey {
  return (
    value === 'policy_recommend' ||
    value === 'achievement_eval' ||
    value === 'research_direction'
  );
}
