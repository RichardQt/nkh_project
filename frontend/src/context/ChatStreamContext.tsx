import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface ChatStreamContextValue {
  isRequesting: boolean;
  setIsRequesting: (v: boolean) => void;
}

const ChatStreamContext = createContext<ChatStreamContextValue | null>(null);

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const [isRequesting, setIsRequesting] = useState(false);
  const value = useMemo(
    () => ({ isRequesting, setIsRequesting }),
    [isRequesting],
  );
  return (
    <ChatStreamContext.Provider value={value}>
      {children}
    </ChatStreamContext.Provider>
  );
}

export function useChatStream(): ChatStreamContextValue {
  const ctx = useContext(ChatStreamContext);
  if (!ctx) {
    // Outside ChatPage — safe fallback (no stream running)
    return { isRequesting: false, setIsRequesting: () => undefined };
  }
  return ctx;
}
