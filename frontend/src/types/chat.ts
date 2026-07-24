export type ChatMessageStatus =
  | 'local'
  | 'loading'
  | 'updating'
  | 'success'
  | 'error'
  | 'abort';

/** One display column projected by Backend A. */
export interface DisplayField {
  key: string;
  label: string;
}

/** One list row after field projection (only selected keys). */
export type RelatedEntryRow = Record<string, string | number | boolean | null | undefined>;

/**
 * One platform sub-type section (概念验证中心 / 中试平台 / …).
 * Present when upstream returns multi-key related_entries for platforms.
 */
export interface RelatedEntriesSection {
  key: string;
  label: string;
  fields: DisplayField[];
  detailFields: DisplayField[];
  items: RelatedEntryRow[];
}

export interface RelatedEntriesPayload {
  listKey: string;
  /** List-card fields (信息匹配.md 列表卡片). */
  fields: DisplayField[];
  /** Detail-drawer fields (信息匹配.md 详情页). */
  detailFields?: DisplayField[];
  items: RelatedEntryRow[];
  /**
   * Multi-section layout for 平台发现.
   * When non-empty, frontend renders each section title + its list in order.
   */
  sections?: RelatedEntriesSection[];
}

export interface ClarificationPayload {
  question: string;
  suggestedQuestions: string[];
}

export type ThoughtStepStatus =
  | 'pending'
  | 'loading'
  | 'success'
  | 'error'
  | 'abort';

export interface WorkflowNodeEvent {
  node: string;
  intent?: string;
  categories?: string[];
  needClarify?: boolean;
  clarifyQuestion?: string;
  clarifyStage?: number;
  isFollowup?: boolean;
  isNewTopic?: boolean;
  ragCount?: number;
  kgCount?: number;
}

export interface IntentThoughtStep {
  status: ThoughtStepStatus;
  intent?: string;
  categories?: string[];
}

export interface ClarityThoughtStep {
  status: ThoughtStepStatus;
  needClarify?: boolean;
  clarifyQuestion?: string;
  isFollowup?: boolean;
  clarificationRequested?: boolean;
  suggestedQuestions?: string[];
}

export interface ChatThoughtState {
  intent: IntentThoughtStep;
  clarity: ClarityThoughtStep;
  reasoning: {
    status: ThoughtStepStatus;
  };
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  /** Fallback / error plain text (not the main answer body). */
  content: string;
  status: ChatMessageStatus;
  kind: 'intro' | 'answer' | 'question';
  sourceQuestion?: string;
  /** Streaming thinking chain text (event: token). */
  thinkContent?: string;
  /** Structured workflow progress from node_start / node_end events. */
  thoughtState?: ChatThoughtState;
  /** Projected related list (event: related_entries). */
  relatedEntries?: RelatedEntriesPayload;
  /** Field schema from meta (same as relatedEntries.fields when present). */
  displayFields?: DisplayField[];
}
