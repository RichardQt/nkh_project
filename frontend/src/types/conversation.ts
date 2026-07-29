import type { ChatMessage } from './chat';
import type { AgentKey } from './agent';

/** Sidebar list item (no full messages). */
export interface ConversationSummary {
  id: string;
  /** First user question of this conversation. */
  title: string;
  agentKey: AgentKey | null;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

/** Full conversation snapshot for restore. */
export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

export interface ConversationListResponse {
  items: ConversationSummary[];
}

export type HistoryGroupKey = 'today' | 'yesterday' | 'earlier';

export interface ConversationHistoryGroup {
  key: HistoryGroupKey;
  label: string;
  items: ConversationSummary[];
}
