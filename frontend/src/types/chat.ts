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

export interface RelatedEntriesPayload {
  listKey: string;
  fields: DisplayField[];
  items: RelatedEntryRow[];
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
  /** Projected related list (event: related_entries). */
  relatedEntries?: RelatedEntriesPayload;
  /** Field schema from meta (same as relatedEntries.fields when present). */
  displayFields?: DisplayField[];
}
