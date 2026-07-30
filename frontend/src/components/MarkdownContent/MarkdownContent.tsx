import XMarkdown from '@ant-design/x-markdown';
import styles from './MarkdownContent.module.css';

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** When true, enables streaming-friendly incomplete-markdown handling. */
  streaming?: boolean;
}

export function MarkdownContent({
  content,
  className,
  streaming = false,
}: MarkdownContentProps) {
  const text = content ?? '';
  if (!text) {
    return null;
  }

  return (
    <XMarkdown
      content={text}
      openLinksInNewTab
      rootClassName={[styles.root, className].filter(Boolean).join(' ')}
      streaming={
        streaming
          ? {
              hasNextChunk: true,
              enableAnimation: false,
            }
          : undefined
      }
    />
  );
}
