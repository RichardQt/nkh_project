import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchActiveSensitiveWords } from '../services/sensitiveWordsApi';
import {
  matchSensitiveWord,
  SENSITIVE_WORD_BLOCK_MESSAGE,
} from '../utils/sensitiveWordMatch';

interface SensitiveWordsContextValue {
  words: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  match: (text: string) => string | null;
  blockMessage: string;
}

const SensitiveWordsContext =
  createContext<SensitiveWordsContextValue | null>(null);

export function SensitiveWordsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setWords([]);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchActiveSensitiveWords();
      setWords(next);
    } catch {
      // Fail open: empty lexicon means no accidental blocks.
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const match = useCallback(
    (text: string) => matchSensitiveWord(text, words),
    [words],
  );

  const value = useMemo(
    () => ({
      words,
      loading,
      refresh,
      match,
      blockMessage: SENSITIVE_WORD_BLOCK_MESSAGE,
    }),
    [words, loading, refresh, match],
  );

  return (
    <SensitiveWordsContext.Provider value={value}>
      {children}
    </SensitiveWordsContext.Provider>
  );
}

export function useSensitiveWords(): SensitiveWordsContextValue {
  const ctx = useContext(SensitiveWordsContext);
  if (!ctx) {
    throw new Error(
      'useSensitiveWords must be used within SensitiveWordsProvider',
    );
  }
  return ctx;
}
