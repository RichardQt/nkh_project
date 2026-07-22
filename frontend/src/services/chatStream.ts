import type { AgentKey } from '../types/agent';

interface ChatStreamInput {
  agentKey: AgentKey;
  message: string;
}

interface ChatStreamCallbacks {
  onDelta: (content: string) => void;
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
    return null;
  } catch {
    return data || null;
  }
}

/**
 * Stream chat tokens from the FastAPI SSE endpoint.
 * Uses fetch + ReadableStream so custom `event: delta` frames are reliable.
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
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          detail || `聊天服务响应异常（${response.status}）`,
        );
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

          if (frame.event === 'delta') {
            const content = extractContent(frame.data);
            if (content) {
              callbacks.onDelta(content);
            }
            continue;
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

      // Stream closed without explicit done — still treat as complete.
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
          : new Error('暂时无法连接智能服务，请确认 FastAPI 服务已启动后重试。');
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
