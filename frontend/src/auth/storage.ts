const TOKEN_KEY = 'nkh_session_token';

export function getSessionToken(): string | null {
  try {
    const value = localStorage.getItem(TOKEN_KEY);
    if (!value || !value.trim()) {
      return null;
    }
    return value.trim();
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
