import { XRequest } from '@ant-design/x-sdk';
import type { SSEOutput } from '@ant-design/x-sdk';
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

function parseData(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return { content: data };
    }
  }

  return data && typeof data === 'object'
    ? (data as Record<string, unknown>)
    : {};
}

export function startChatStream(
  input: ChatStreamInput,
  callbacks: ChatStreamCallbacks,
): ChatStreamController {
  const request = XRequest<ChatStreamInput, SSEOutput>('/api/chat/stream', {
    manual: true,
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
    streamTimeout: 30_000,
    callbacks: {
      onUpdate: (chunk) => {
        if (chunk.event !== 'delta') {
          return;
        }

        const payload = parseData(chunk.data);
        if (typeof payload.content === 'string') {
          callbacks.onDelta(payload.content);
        }
      },
      onSuccess: () => callbacks.onComplete(),
      onError: (error) => callbacks.onError(error),
    },
  });

  request.run(input);

  return {
    abort: () => request.abort(),
  };
}

