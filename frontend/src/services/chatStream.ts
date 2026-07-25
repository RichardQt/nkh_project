import type { AgentKey } from '../types/agent';
import type {
  ClarificationPayload,
  DisplayField,
  RelatedEntriesPayload,
  RelatedEntryRow,
  WorkflowNodeEvent,
} from '../types/chat';

/** null / undefined / 'general' = home brand mode, no specialist scene. */
export type ChatAgentKey = AgentKey | 'general' | null | undefined;

export const GENERIC_STREAM_ERROR_MESSAGE = '系统响应超时，请稍后重试。';

interface ChatStreamInput {
  agentKey?: ChatAgentKey;
  message: string;
  sessionId: string;
}

export interface ChatStreamCallbacks {
  onMeta?: (meta: { sessionId?: string; function?: string; fields?: DisplayField[] }) => void;
  onNodeStart?: (event: WorkflowNodeEvent) => void;
  onNodeEnd?: (event: WorkflowNodeEvent) => void;
  onClarify?: (payload: ClarificationPayload) => void;
  /** Standalone recommended questions (event: suggested_questions). */
  onSuggestedQuestions?: (questions: string[]) => void;
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

function parseWorkflowNodeEvent(data: string): WorkflowNodeEvent | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    const node = typeof record?.node === 'string' ? record.node.trim() : '';

    if (!record || !node) {
      return null;
    }

    const event: WorkflowNodeEvent = { node };

    if (typeof record.intent === 'string') {
      event.intent = record.intent;
    }
    if (Array.isArray(record.categories)) {
      event.categories = record.categories.filter(
        (category): category is string => typeof category === 'string',
      );
    }
    if (typeof record.need_clarify === 'boolean') {
      event.needClarify = record.need_clarify;
    }
    if (typeof record.clarify_question === 'string') {
      event.clarifyQuestion = record.clarify_question;
    }
    if (typeof record.clarify_stage === 'number') {
      event.clarifyStage = record.clarify_stage;
    }
    if (typeof record.is_followup === 'boolean') {
      event.isFollowup = record.is_followup;
    }
    if (typeof record.is_new_topic === 'boolean') {
      event.isNewTopic = record.is_new_topic;
    }
    if (typeof record.rag_count === 'number') {
      event.ragCount = record.rag_count;
    }
    if (typeof record.kg_count === 'number') {
      event.kgCount = record.kg_count;
    }

    return event;
  } catch {
    return null;
  }
}

function normalizeSuggestedQuestions(raw: unknown): string[] {
  const items: string[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && item.trim()) {
        items.push(item.trim());
      }
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    for (const part of raw.replace(/，/g, ',').split(',')) {
      if (part.trim()) {
        items.push(part.trim());
      }
    }
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      ordered.push(item);
    }
  }
  return ordered;
}

function parseClarification(data: string): ClarificationPayload | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    if (!record) {
      return null;
    }

    const rawQuestion =
      typeof record.question === 'string'
        ? record.question
        : typeof record.clarify_question === 'string'
          ? record.clarify_question
          : '';
    const question = rawQuestion.trim();
    if (!question) {
      return null;
    }

    const rawSuggestions =
      record.suggested_questions ??
      record.suggestedQuestions ??
      record.questions;
    const suggestedQuestions = normalizeSuggestedQuestions(rawSuggestions);

    return { question, suggestedQuestions };
  } catch {
    return null;
  }
}

function parseSuggestedQuestions(data: string): string[] | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    if (!record) {
      return null;
    }
    const questions = normalizeSuggestedQuestions(
      record.questions ?? record.suggested_questions ?? record.suggestedQuestions,
    );
    return questions.length ? questions : null;
  } catch {
    return null;
  }
}

function parseEntryRows(raw: unknown): RelatedEntryRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (row): row is RelatedEntryRow =>
      !!row && typeof row === 'object' && !Array.isArray(row),
  ) as RelatedEntryRow[];
}

function parseRelatedSections(
  raw: unknown,
): RelatedEntriesPayload['sections'] {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const sections = raw
    .map((entry) => {
      const section = asRecord(entry);
      if (!section) {
        return null;
      }
      const key =
        typeof section.key === 'string' && section.key
          ? section.key
          : '';
      const label =
        typeof section.label === 'string' && section.label
          ? section.label
          : key || '相关结果';
      if (!key && !Array.isArray(section.items)) {
        return null;
      }
      const items = parseEntryRows(section.items);
      if (!items.length) {
        return null;
      }
      return {
        key: key || label,
        label,
        fields: parseFields(section.fields),
        detailFields: parseFields(section.detailFields),
        items,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return sections.length ? sections : undefined;
}

function parseRelatedEntries(data: string): RelatedEntriesPayload | null {
  try {
    const payload = JSON.parse(data) as unknown;
    const record = asRecord(payload);
    if (!record) {
      return null;
    }

    const fields = parseFields(record.fields);
    const detailFields = parseFields(record.detailFields);
    const listKey =
      typeof record.listKey === 'string' && record.listKey
        ? record.listKey
        : 'items';

    const sections = parseRelatedSections(record.sections);

    // Multi-section platforms: sections alone are enough
    if (sections?.length) {
      const items =
        parseEntryRows(record.items).length > 0
          ? parseEntryRows(record.items)
          : sections.flatMap((s) => s.items);
      return {
        listKey,
        fields: fields.length ? fields : sections[0]?.fields ?? [],
        detailFields:
          detailFields.length > 0
            ? detailFields
            : sections[0]?.detailFields ?? [],
        items,
        sections,
      };
    }

    let rawItems: unknown[] | null = null;
    if (Array.isArray(record.items)) {
      rawItems = record.items;
    } else if (Array.isArray(record[listKey])) {
      rawItems = record[listKey] as unknown[];
    } else {
      const alias = [
        'achievements',
        'requirements',
        'expert_team',
        'experts',
        'demands',
        'enterprises',
        'platforms',
        'poc_center',
        'pilot_test_platform',
        'large_scale_equipment',
        'public_service_platform',
      ].find((key) => Array.isArray(record[key]));
      if (alias) {
        rawItems = record[alias] as unknown[];
      }
    }

    // Upstream may send platform sub-keys without a projected sections array
    if (!rawItems) {
      const platformKeys = [
        ['poc_center', '概念验证中心'],
        ['pilot_test_platform', '中试平台'],
        ['large_scale_equipment', '大型仪器设备'],
        ['public_service_platform', '公共服务平台'],
      ] as const;
      const inferred = platformKeys
        .map(([key, label]) => {
          const items = parseEntryRows(record[key]);
          if (!items.length) {
            return null;
          }
          return {
            key,
            label,
            fields,
            detailFields,
            items,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      if (inferred.length) {
        return {
          listKey: 'platforms',
          fields,
          detailFields,
          items: inferred.flatMap((s) => s.items),
          sections: inferred,
        };
      }
      return null;
    }

    const items = parseEntryRows(rawItems);
    return {
      listKey,
      fields,
      detailFields,
      items,
      sections: undefined,
    };
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

const FAILURE_FINISH_REASONS = new Set([
  'error',
  'fail',
  'failed',
  'abort',
  'aborted',
  'cancel',
  'cancelled',
]);

function parseFinishReason(data: string): string | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    const reason =
      typeof record?.finishReason === 'string'
        ? record.finishReason.trim().toLowerCase()
        : '';
    return reason || null;
  } catch {
    return null;
  }
}

function isFailureFinishReason(reason: string): boolean {
  return FAILURE_FINISH_REASONS.has(reason);
}

function normalizeAgentKey(agentKey: ChatAgentKey): string | null {
  if (agentKey == null || agentKey === 'general') {
    return null;
  }
  return agentKey;
}

/**
 * Stream chat from Backend A SSE:
 *   meta → node_start / node_end → [clarify | token*] → related_entries → done
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

      const dispatchFrame = async (
        frame: NonNullable<ReturnType<typeof parseSseChunk>>,
      ): Promise<boolean> => {
        const eventName = frame.event.trim().toLowerCase();

        if (eventName === 'meta') {
          try {
            const payload = asRecord(JSON.parse(frame.data) as unknown);
            if (payload) {
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
            }
          } catch {
            // ignore malformed meta
          }
          return true;
        }

        if (eventName === 'node_start' || eventName === 'node_end') {
          const nodeEvent = parseWorkflowNodeEvent(frame.data);
          if (nodeEvent) {
            if (eventName === 'node_start') {
              callbacks.onNodeStart?.(nodeEvent);
            } else {
              callbacks.onNodeEnd?.(nodeEvent);
            }
          }
          return true;
        }

        if (eventName === 'clarify') {
          const clarification = parseClarification(frame.data);
          if (clarification) {
            callbacks.onClarify?.(clarification);
          }
          return true;
        }

        if (
          eventName === 'suggested_questions' ||
          eventName === 'suggestedQuestions'
        ) {
          const questions = parseSuggestedQuestions(frame.data);
          if (questions?.length) {
            callbacks.onSuggestedQuestions?.(questions);
          }
          return true;
        }

        if (eventName === 'token' || eventName === 'delta') {
          const content = extractContent(frame.data);
          if (content) {
            callbacks.onToken(content);
          }
          return true;
        }

        if (eventName === 'related_entries') {
          const entries = parseRelatedEntries(frame.data);
          if (!entries) {
            settleError(new Error('服务返回的结果列表格式不正确。'));
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            return false;
          }
          callbacks.onRelatedEntries(entries);
          return true;
        }

        if (eventName === 'error') {
          settleError(new Error(GENERIC_STREAM_ERROR_MESSAGE));
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return false;
        }

        if (eventName === 'done') {
          const finishReason = parseFinishReason(frame.data);
          if (!finishReason || isFailureFinishReason(finishReason)) {
            settleError(new Error('服务未能完成请求，请稍后重试。'));
          } else {
            settleSuccess();
          }
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return false;
        }

        return true;
      };

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
          if (frame && !(await dispatchFrame(frame))) {
            return;
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        const trailingFrame = parseSseChunk(buffer);
        if (trailingFrame && !(await dispatchFrame(trailingFrame))) {
          return;
        }
      }

      settleError(new Error('响应流提前结束，请重试。'));
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
