import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
} from '../services/authApi';
import { AUTH_EXPIRED_EVENT } from '../services/http';
import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from './storage';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  bootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = getSessionToken();
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setBootstrapping(false);
        }
        return;
      }

      try {
        const me = await fetchCurrentUser();
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        clearSessionToken();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginRequest(username, password);
    setSessionToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    clearSessionToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      login,
      logout,
    }),
    [user, bootstrapping, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return ctx;
}
