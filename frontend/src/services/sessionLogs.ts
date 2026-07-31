/** Session runtime logs via upstream WebSocket (URL from Backend A config). */

let cachedLogsWsUrl: string | null = null;

export type SessionLogLine = {
  id: string;
  at: number;
  text: string;
  raw?: unknown;
};

export type SessionLogsConnection = {
  close: () => void;
};

function appendSessionId(baseUrl: string, sessionId: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    url.searchParams.set('session_id', sessionId);
    return url.toString();
  } catch {
    const sep = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${sep}session_id=${encodeURIComponent(sessionId)}`;
  }
}

function formatLogPayload(data: string): { text: string; raw?: unknown } {
  const trimmed = data.trim();
  if (!trimmed) {
    return { text: '' };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return { text: parsed, raw: parsed };
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const message =
        (typeof obj.message === 'string' && obj.message) ||
        (typeof obj.msg === 'string' && obj.msg) ||
        (typeof obj.content === 'string' && obj.content) ||
        (typeof obj.log === 'string' && obj.log) ||
        (typeof obj.text === 'string' && obj.text) ||
        '';
      if (message) {
        const level =
          typeof obj.level === 'string'
            ? obj.level
            : typeof obj.severity === 'string'
              ? obj.severity
              : '';
        return {
          text: level ? `[${level}] ${message}` : message,
          raw: parsed,
        };
      }
      return { text: JSON.stringify(parsed, null, 0), raw: parsed };
    }
  } catch {
    // plain text line
  }
  return { text: data };
}

export async function fetchLogsWsUrl(): Promise<string> {
  if (cachedLogsWsUrl) {
    return cachedLogsWsUrl;
  }
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`无法获取日志服务配置 (${response.status})`);
  }
  const body = (await response.json()) as { logsWsUrl?: unknown };
  const url =
    typeof body.logsWsUrl === 'string' ? body.logsWsUrl.trim() : '';
  if (!url) {
    throw new Error('后端未配置日志 WebSocket 地址 (LOGS_WS_URL)');
  }
  cachedLogsWsUrl = url;
  return url;
}

export function buildSessionLogsUrl(
  baseUrl: string,
  sessionId: string,
): string {
  return appendSessionId(baseUrl, sessionId);
}

export function connectSessionLogs(options: {
  sessionId: string;
  baseUrl?: string;
  onLine: (line: SessionLogLine) => void;
  onStatus: (status: 'connecting' | 'open' | 'closed' | 'error') => void;
  onError?: (message: string) => void;
}): SessionLogsConnection {
  const { sessionId, onLine, onStatus, onError } = options;
  let socket: WebSocket | null = null;
  let closed = false;
  let seq = 0;

  const push = (data: string) => {
    const formatted = formatLogPayload(data);
    if (!formatted.text) {
      return;
    }
    seq += 1;
    onLine({
      id: `log-${Date.now()}-${seq}`,
      at: Date.now(),
      text: formatted.text,
      raw: formatted.raw,
    });
  };

  const start = async () => {
    onStatus('connecting');
    try {
      const base = options.baseUrl ?? (await fetchLogsWsUrl());
      if (closed) {
        return;
      }
      const url = buildSessionLogsUrl(base, sessionId);
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (closed) {
          socket?.close();
          return;
        }
        onStatus('open');
      };

      socket.onmessage = (event) => {
        if (closed) {
          return;
        }
        if (typeof event.data === 'string') {
          push(event.data);
          return;
        }
        if (event.data instanceof Blob) {
          void event.data.text().then((text) => {
            if (!closed) {
              push(text);
            }
          });
          return;
        }
        push(String(event.data));
      };

      socket.onerror = () => {
        if (closed) {
          return;
        }
        onStatus('error');
        onError?.('日志连接异常');
      };

      socket.onclose = () => {
        if (closed) {
          return;
        }
        onStatus('closed');
      };
    } catch (error) {
      if (closed) {
        return;
      }
      onStatus('error');
      onError?.(
        error instanceof Error ? error.message : '无法连接日志服务',
      );
    }
  };

  void start();

  return {
    close: () => {
      closed = true;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
        socket = null;
      }
      onStatus('closed');
    },
  };
}
