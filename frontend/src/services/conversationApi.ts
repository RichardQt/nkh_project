import { isAgentKey } from '../data/agents';
import type { ChatMessage } from '../types/chat';
import type { AgentKey } from '../types/agent';
import type {
  ConversationDetail,
  ConversationHistoryGroup,
  ConversationListResponse,
  ConversationSummary,
  HistoryGroupKey,
} from '../types/conversation';
import { authHeaders, parseJsonResponse } from './http';

function normalizeAgentKey(value: unknown): AgentKey | null {
  if (typeof value === 'string' && isAgentKey(value)) {
    return value;
  }
  return null;
}

function normalizeSummary(raw: ConversationSummary): ConversationSummary {
  return {
    ...raw,
    agentKey: normalizeAgentKey(raw.agentKey),
    title: (raw.title || '未命名对话').trim() || '未命名对话',
  };
}

export const CONVERSATIONS_CHANGED_EVENT = 'nkh:conversations-changed';

export function notifyConversationsChanged() {
  window.dispatchEvent(new CustomEvent(CONVERSATIONS_CHANGED_EVENT));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createConversationId(): string {
  return newId();
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await fetch('/api/conversations', {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  const data = await parseJsonResponse<ConversationListResponse>(response);
  return Array.isArray(data.items)
    ? data.items.map((item) => normalizeSummary(item))
    : [];
}

export async function getConversation(
  id: string,
): Promise<ConversationDetail> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  const detail = await parseJsonResponse<ConversationDetail>(response);
  return {
    ...normalizeSummary(detail),
    messages: Array.isArray(detail.messages) ? detail.messages : [],
  };
}

export interface SaveConversationInput {
  id: string;
  /** Prefer first user question; server also derives title from messages. */
  title?: string;
  agentKey: AgentKey | null;
  sessionId: string;
  messages: ChatMessage[];
}

export async function saveConversation(
  input: SaveConversationInput,
): Promise<ConversationDetail> {
  const response = await fetch(
    `/api/conversations/${encodeURIComponent(input.id)}`,
    {
      method: 'PUT',
      headers: authHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        title: input.title,
        agentKey: input.agentKey,
        sessionId: input.sessionId,
        messages: input.messages,
      }),
    },
  );
  const detail = await parseJsonResponse<ConversationDetail>(response);
  notifyConversationsChanged();
  return detail;
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<ConversationSummary> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ title }),
  });
  const detail = await parseJsonResponse<ConversationSummary>(response);
  notifyConversationsChanged();
  return normalizeSummary(detail);
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  await parseJsonResponse<{ ok: boolean }>(response);
  notifyConversationsChanged();
}

/** Extract title from first user question in messages. */
export function titleFromMessages(messages: ChatMessage[]): string {
  for (const message of messages) {
    if (
      (message.role === 'user' || message.kind === 'question') &&
      message.content?.trim()
    ) {
      return message.content.trim().slice(0, 200);
    }
    if (message.sourceQuestion?.trim()) {
      return message.sourceQuestion.trim().slice(0, 200);
    }
  }
  return '未命名对话';
}

function startOfLocalDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function parseTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Group conversations into 今日 / 昨天 / 更早 by createdAt (local day).
 * Within each group, newest creation time first.
 */
export function groupConversationsByRecency(
  items: ConversationSummary[],
  now: Date = new Date(),
): ConversationHistoryGroup[] {
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const buckets: Record<HistoryGroupKey, ConversationSummary[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  // Backend already returns created_at DESC; re-sort defensively by creation time.
  const sorted = [...items].sort(
    (a, b) => parseTime(b.createdAt) - parseTime(a.createdAt),
  );

  for (const item of sorted) {
    const ts = parseTime(item.createdAt || item.updatedAt);
    if (ts >= todayStart) {
      buckets.today.push(item);
    } else if (ts >= yesterdayStart) {
      buckets.yesterday.push(item);
    } else {
      buckets.earlier.push(item);
    }
  }

  const labels: Record<HistoryGroupKey, string> = {
    today: '今日',
    yesterday: '昨天',
    earlier: '更早',
  };

  const order: HistoryGroupKey[] = ['today', 'yesterday', 'earlier'];
  return order
    .map((key) => ({
      key,
      label: labels[key],
      items: buckets[key],
    }))
    .filter((group) => group.items.length > 0);
}

/** Build chat route for a stored conversation. */
export function conversationPath(
  item: Pick<ConversationSummary, 'id' | 'agentKey'>,
): string {
  const base =
    item.agentKey && isAgentKey(item.agentKey)
      ? `/chat/${item.agentKey}`
      : '/chat';
  return `${base}?cid=${encodeURIComponent(item.id)}`;
}
