import type { AuthUser, LoginResponse } from '../auth/types';
import { authHeaders, parseJsonResponse } from './http';

function normalizeUser(raw: unknown): AuthUser {
  if (!raw || typeof raw !== 'object') {
    throw new Error('用户信息无效');
  }
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const username =
    typeof record.username === 'string' ? record.username.trim() : '';
  const role = record.role === 'admin' ? 'admin' : 'user';
  if (!id || !username) {
    throw new Error('用户信息无效');
  }
  return { id, username, role };
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await parseJsonResponse<{
    token?: unknown;
    user?: unknown;
  }>(response);

  if (typeof data.token !== 'string' || !data.token.trim()) {
    throw new Error('登录响应缺少会话令牌');
  }

  return {
    token: data.token.trim(),
    user: normalizeUser(data.user),
  };
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  const data = await parseJsonResponse<{ user?: unknown }>(response);
  return normalizeUser(data.user);
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: authHeaders({ Accept: 'application/json' }),
    });
  } catch {
    // best-effort; local token is cleared by caller
  }
}
