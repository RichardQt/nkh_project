export type ChatMessageStatus =
  | 'local'
  | 'loading'
  | 'updating'
  | 'success'
  | 'error'
  | 'abort';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  status: ChatMessageStatus;
  kind: 'intro' | 'answer' | 'question';
  sourceQuestion?: string;
}

