import { clearSessionToken, getSessionToken } from '../auth/storage';

export const AUTH_EXPIRED_EVENT = 'nkh:auth-expired';

export function authHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getSessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function notifyAuthExpired(): void {
  clearSessionToken();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

export function handleUnauthorized(status: number): void {
  if (status === 401) {
    notifyAuthExpired();
  }
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    notifyAuthExpired();
  }

  if (!response.ok) {
    let detail = `请求失败 (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string' && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}
