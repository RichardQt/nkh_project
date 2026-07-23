import type { AgentKey } from '../types/agent';
import type { DisplayField, RelatedEntriesPayload, RelatedEntryRow } from '../types/chat';

/** null / undefined / 'general' = home brand mode, no specialist scene. */
export type ChatAgentKey = AgentKey | 'general' | null | undefined;

interface ChatStreamInput {
  agentKey?: ChatAgentKey;
  message: string;
  sessionId: string;
}

export interface ChatStreamCallbacks {
  onMeta?: (meta: { sessionId?: string; function?: string; fields?: DisplayField[] }) => void;
  onToken: (content: string) => void;
  onRelatedEntries: (payload: RelatedEntriesPayload) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export interface ChatStreamController {
  abort: () => void;
}

function parseSseChunk(raw: string): { event: string; data: string } | null {
  const lines = raw.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join('\n') };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseFields(raw: unknown): DisplayField[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const fields: DisplayField[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    const key = typeof row.key === 'string' ? row.key : '';
    const label = typeof row.label === 'string' ? row.label : key;
    if (key) {
      fields.push({ key, label });
    }
  }
  return fields;
}

function parseRelatedEntries(data: string): RelatedEntriesPayload | null {
  try {
    const payload = JSON.parse(data) as unknown;
    const record = asRecord(payload);
    if (!record) {
      return null;
    }

    const fields = parseFields(record.fields);
    const listKey =
      typeof record.listKey === 'string' && record.listKey
        ? record.listKey
        : 'items';

    let items: RelatedEntryRow[] = [];
    if (Array.isArray(record.items)) {
      items = record.items.filter(
        (row): row is RelatedEntryRow =>
          !!row && typeof row === 'object' && !Array.isArray(row),
      ) as RelatedEntryRow[];
    } else if (Array.isArray(record[listKey])) {
      items = (record[listKey] as unknown[]).filter(
        (row): row is RelatedEntryRow =>
          !!row && typeof row === 'object' && !Array.isArray(row),
      ) as RelatedEntryRow[];
    } else if (Array.isArray(record.achievements)) {
      items = (record.achievements as unknown[]).filter(
        (row): row is RelatedEntryRow =>
          !!row && typeof row === 'object' && !Array.isArray(row),
      ) as RelatedEntryRow[];
    }

    return { listKey, fields, items };
  } catch {
    return null;
  }
}

function extractContent(data: string): string | null {
  try {
    const payload = JSON.parse(data) as unknown;
    if (!payload || typeof payload !== 'object') {
      return typeof payload === 'string' ? payload : null;
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.content === 'string') {
      return record.content;
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
    return null;
  } catch {
    return data || null;
  }
}

function normalizeAgentKey(agentKey: ChatAgentKey): string | null {
  if (agentKey == null || agentKey === 'general') {
    return null;
  }
  return agentKey;
}

/**
 * Stream chat from Backend A SSE:
 *   meta → token* → related_entries → done
 */
export function startChatStream(
  input: ChatStreamInput,
  callbacks: ChatStreamCallbacks,
): ChatStreamController {
  const controller = new AbortController();
  let settled = false;

  const settleError = (error: Error) => {
    if (settled || controller.signal.aborted) {
      return;
    }
    settled = true;
    callbacks.onError(error);
  };

  const settleSuccess = () => {
    if (settled) {
      return;
    }
    settled = true;
    callbacks.onComplete();
  };

  void (async () => {
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.message,
          agentKey: normalizeAgentKey(input.agentKey),
          sessionId: input.sessionId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `聊天服务响应异常（${response.status}）`);
      }

      if (!response.body) {
        throw new Error('浏览器不支持流式响应');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const frame = parseSseChunk(part);
          if (!frame) {
            continue;
          }

          if (frame.event === 'meta') {
            try {
              const payload = JSON.parse(frame.data) as Record<string, unknown>;
              callbacks.onMeta?.({
                sessionId:
                  typeof payload.sessionId === 'string'
                    ? payload.sessionId
                    : undefined,
                function:
                  typeof payload.function === 'string'
                    ? payload.function
                    : undefined,
                fields: parseFields(payload.fields),
              });
            } catch {
              // ignore malformed meta
            }
            continue;
          }

          if (frame.event === 'token' || frame.event === 'delta') {
            const content = extractContent(frame.data);
            if (content) {
              callbacks.onToken(content);
            }
            continue;
          }

          if (frame.event === 'related_entries') {
            const entries = parseRelatedEntries(frame.data);
            if (entries) {
              callbacks.onRelatedEntries(entries);
            }
            continue;
          }

          if (frame.event === 'error') {
            const message =
              extractContent(frame.data) || '服务返回错误，请稍后重试。';
            settleError(new Error(message));
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            return;
          }

          if (frame.event === 'done') {
            settleSuccess();
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            return;
          }
        }
      }

      settleSuccess();
    } catch (error) {
      if (controller.signal.aborted) {
        settleError(
          Object.assign(new Error('已停止生成'), { name: 'AbortError' }),
        );
        return;
      }

      const err =
        error instanceof Error
          ? error
          : new Error(
              '暂时无法连接智能服务，请确认 FastAPI 服务已启动后重试。',
            );
      settleError(err);
    }
  })();

  return {
    abort: () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    },
  };
}
