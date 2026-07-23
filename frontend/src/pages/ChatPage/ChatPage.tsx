import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentRef } from 'react';
import { RedoOutlined, RobotOutlined, SyncOutlined } from '@ant-design/icons';
import { Actions, Bubble, Sender, Think, Welcome } from '@ant-design/x';
import type { BubbleItemType, BubbleListProps } from '@ant-design/x';
import { Avatar, Empty, List, Typography } from 'antd';
import { useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { getAgent } from '../../data/agents';
import {
  startChatStream,
  type ChatStreamController,
} from '../../services/chatStream';
import type { AgentKey } from '../../types/agent';
import type {
  ChatMessage,
  ChatMessageStatus,
  DisplayField,
  RelatedEntriesPayload,
  RelatedEntryRow,
} from '../../types/chat';
import styles from './ChatPage.module.css';

interface ChatLocationState {
  initialQuestion?: string;
}

interface ChatPageProps {
  /** 首页选中的能力入口 key；null 表示未选场景。 */
  agentKey: AgentKey | null;
}

const CHAT_UI = {
  name: 'AI 创新赋能助手',
  greeting: '你好，请直接输入问题。系统将调用服务接口为你返回结果。',
  placeholder: '描述你的问题或目标，Enter 发送，Shift + Enter 换行',
} as const;

function readEntryQuestion(search: string, state: unknown): string {
  const fromState =
    state && typeof state === 'object'
      ? String((state as ChatLocationState).initialQuestion ?? '').trim()
      : '';
  const fromQuery = new URLSearchParams(search).get('q')?.trim() ?? '';
  return fromState || fromQuery;
}

function pendingStorageKey(sessionKey: string) {
  return `nkh:pending-question:${sessionKey}`;
}

function sessionIdStorageKey(sessionKey: string) {
  return `nkh:session-id:${sessionKey}`;
}

function ensureSessionId(sessionKey: string): string {
  const key = sessionIdStorageKey(sessionKey);
  const existing = sessionStorage.getItem(key)?.trim();
  if (existing) {
    return existing;
  }
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(key, next);
  return next;
}

function formatCellValue(value: RelatedEntryRow[string]): string {
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return String(value);
}

function RelatedEntriesList({
  payload,
}: {
  payload: RelatedEntriesPayload;
}) {
  const fields = payload.fields;
  const items = payload.items;

  if (!items.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无相关条目"
        className={styles.entriesEmpty}
      />
    );
  }

  const titleField = fields[0];
  const detailFields = fields.slice(1);

  return (
    <div className={styles.entriesPanel}>
      <Typography.Text className={styles.entriesTitle}>
        相关结果
        <span className={styles.entriesCount}>{items.length}</span>
      </Typography.Text>
      <List
        className={styles.entriesList}
        itemLayout="vertical"
        dataSource={items}
        split
        renderItem={(item, index) => {
          const titleText = titleField
            ? formatCellValue(item[titleField.key])
            : `条目 ${index + 1}`;

          return (
            <List.Item key={`${index}-${titleText}`} className={styles.entryItem}>
              <div className={styles.entryHead}>
                <Typography.Text strong className={styles.entryTitle}>
                  {titleText}
                </Typography.Text>
              </div>
              {detailFields.length > 0 ? (
                <dl className={styles.entryFields}>
                  {detailFields.map((field: DisplayField) => (
                    <div key={field.key} className={styles.entryFieldRow}>
                      <dt>{field.label}</dt>
                      <dd>{formatCellValue(item[field.key])}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </List.Item>
          );
        }}
      />
    </div>
  );
}

function AnswerBody({
  message,
  reduceMotion,
}: {
  message: ChatMessage;
  reduceMotion: boolean | null;
}) {
  const status = message.status;
  const thinking = Boolean(message.thinkContent);
  const isStreaming =
    status === 'loading' || status === 'updating';
  const thinkLoading = isStreaming && !message.relatedEntries;

  const thinkTitle = thinkLoading
    ? '正在思考'
    : thinking
      ? '思考过程'
      : status === 'error'
        ? '处理失败'
        : status === 'abort'
          ? '已停止'
          : '思考过程';

  const showThink = thinking || isStreaming || status === 'error' || status === 'abort';

  return (
    <div className={styles.answerContent}>
      {showThink ? (
        <Think
          title={thinkTitle}
          blink={!reduceMotion && thinkLoading}
          loading={
            thinkLoading ? (
              <SyncOutlined className={styles.thinkSpin} />
            ) : (
              false
            )
          }
          defaultExpanded
          rootClassName={styles.thinkRoot}
        >
          {message.thinkContent ||
            (status === 'loading'
              ? '正在连接服务…'
              : status === 'error'
                ? message.content || '请求失败'
                : status === 'abort'
                  ? message.content || '已停止生成。'
                  : '')}
        </Think>
      ) : null}

      {message.relatedEntries ? (
        <RelatedEntriesList payload={message.relatedEntries} />
      ) : null}

      {!message.relatedEntries &&
      !message.thinkContent &&
      message.content &&
      (status === 'error' || status === 'abort' || status === 'success') ? (
        <Typography.Paragraph className={styles.fallbackText}>
          {message.content}
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}

export default function ChatPage({ agentKey }: ChatPageProps) {
  const scene = agentKey ? getAgent(agentKey) : null;
  const sessionKey = agentKey ?? 'general';
  const displayName = scene ? `${CHAT_UI.name} · ${scene.label}` : CHAT_UI.name;
  const sessionIdRef = useRef(ensureSessionId(sessionKey));

  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: `intro-${sessionKey}`,
      role: 'assistant',
      content: scene
        ? `当前场景：${scene.label}。${CHAT_UI.greeting}`
        : CHAT_UI.greeting,
      status: 'success',
      kind: 'intro',
    },
  ]);
  const requestRef = useRef<ChatStreamController | null>(null);
  const bubbleListRef = useRef<ComponentRef<typeof Bubble.List>>(null);
  const activeAnswerRef = useRef<string | null>(null);
  const isRequestingRef = useRef(false);
  const messageSequenceRef = useRef(0);
  const shouldFollowOutputRef = useRef(true);
  const previousMessageCountRef = useRef(messages.length);
  const smoothScrollLockUntilRef = useRef(0);
  const autoStartedRef = useRef(false);
  const entryQuestionRef = useRef<string | null>(null);

  if (entryQuestionRef.current === null) {
    const fromRoute = readEntryQuestion(location.search, location.state);
    const fromStorage =
      sessionStorage.getItem(pendingStorageKey(sessionKey))?.trim() ?? '';
    const question = fromRoute || fromStorage;
    entryQuestionRef.current = question;
    if (question) {
      sessionStorage.setItem(pendingStorageKey(sessionKey), question);
    }
  }

  const nextMessageId = useCallback((prefix: string) => {
    messageSequenceRef.current += 1;
    return `${prefix}-${Date.now()}-${messageSequenceRef.current}`;
  }, []);

  const setRequesting = useCallback((next: boolean) => {
    isRequestingRef.current = next;
    setIsRequesting(next);
  }, []);

  const cancelRequest = useCallback(() => {
    const activeAnswerId = activeAnswerRef.current;
    activeAnswerRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    setRequesting(false);

    if (activeAnswerId) {
      setMessages((current) =>
        current.map((message) =>
          message.id === activeAnswerId
            ? {
                ...message,
                status: 'abort',
                content: message.content || '已停止生成。',
              }
            : message,
        ),
      );
    }
  }, [setRequesting]);

  const submit = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || isRequestingRef.current || activeAnswerRef.current) {
        return false;
      }

      const userId = nextMessageId('user');
      const answerId = nextMessageId('assistant');

      setValue('');
      setRequesting(true);
      activeAnswerRef.current = answerId;
      shouldFollowOutputRef.current = true;
      setMessages((current) => [
        ...current.filter((message) => message.kind !== 'intro'),
        {
          id: userId,
          role: 'user',
          content: question,
          status: 'success',
          kind: 'question',
        },
        {
          id: answerId,
          role: 'assistant',
          content: '',
          thinkContent: '',
          status: 'loading',
          kind: 'answer',
          sourceQuestion: question,
        },
      ]);

      requestRef.current = startChatStream(
        {
          agentKey,
          message: question,
          sessionId: sessionIdRef.current,
        },
        {
          onMeta: ({ fields }) => {
            if (activeAnswerRef.current !== answerId || !fields?.length) {
              return;
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? { ...message, displayFields: fields }
                  : message,
              ),
            );
          },
          onToken: (content) => {
            if (activeAnswerRef.current !== answerId) {
              return;
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      thinkContent: `${message.thinkContent ?? ''}${content}`,
                      status: 'updating',
                    }
                  : message,
              ),
            );
          },
          onRelatedEntries: (payload) => {
            if (activeAnswerRef.current !== answerId) {
              return;
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      relatedEntries: payload,
                      displayFields: payload.fields.length
                        ? payload.fields
                        : message.displayFields,
                      status: 'updating',
                    }
                  : message,
              ),
            );
          },
          onComplete: () => {
            if (activeAnswerRef.current !== answerId) {
              return;
            }

            activeAnswerRef.current = null;
            requestRef.current = null;
            setRequesting(false);
            sessionStorage.removeItem(pendingStorageKey(sessionKey));
            setMessages((current) =>
              current.map((message) => {
                if (message.id !== answerId) {
                  return message;
                }
                const hasPayload =
                  Boolean(message.thinkContent?.trim()) ||
                  (message.relatedEntries?.items.length ?? 0) > 0;
                return {
                  ...message,
                  status: 'success',
                  content: hasPayload
                    ? message.content
                    : message.content ||
                      '回答已完成，但暂时没有可展示的内容。',
                };
              }),
            );
          },
          onError: (error) => {
            if (activeAnswerRef.current !== answerId) {
              return;
            }

            activeAnswerRef.current = null;
            requestRef.current = null;
            setRequesting(false);
            if (error.name !== 'AbortError') {
              sessionStorage.removeItem(pendingStorageKey(sessionKey));
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      status: 'error',
                      content:
                        error.name === 'AbortError'
                          ? message.content || '已停止生成。'
                          : error.message ||
                            '暂时无法连接服务，请确认后端已启动后重试。',
                    }
                  : message,
              ),
            );
          },
        },
      );

      return true;
    },
    [agentKey, nextMessageId, sessionKey, setRequesting],
  );

  useEffect(() => {
    if (autoStartedRef.current) {
      return;
    }

    const question =
      entryQuestionRef.current ||
      sessionStorage.getItem(pendingStorageKey(sessionKey))?.trim() ||
      '';

    if (!question) {
      return;
    }

    autoStartedRef.current = true;
    const started = submit(question);

    if (started) {
      if (window.location.search) {
        window.history.replaceState(
          null,
          '',
          `${location.pathname}${window.location.hash ?? ''}`,
        );
      }
    } else {
      autoStartedRef.current = false;
    }
  }, [location.pathname, sessionKey, submit]);

  useEffect(
    () => () => {
      const active = requestRef.current;
      window.setTimeout(() => {
        active?.abort();
      }, 0);
      activeAnswerRef.current = null;
      isRequestingRef.current = false;
      requestRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const scrollBox = bubbleListRef.current?.scrollBoxNativeElement;
    if (!scrollBox) {
      return;
    }

    const updateFollowPreference = () => {
      if (performance.now() < smoothScrollLockUntilRef.current) {
        return;
      }

      const distanceFromBottom =
        scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight;
      shouldFollowOutputRef.current = distanceFromBottom <= 96;
    };

    scrollBox.addEventListener('scroll', updateFollowPreference, {
      passive: true,
    });
    updateFollowPreference();

    return () => scrollBox.removeEventListener('scroll', updateFollowPreference);
  }, [sessionKey]);

  useEffect(() => {
    const didAddMessage = messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    const frame = window.requestAnimationFrame(() => {
      const scrollBox = bubbleListRef.current?.scrollBoxNativeElement;
      if (!scrollBox || !shouldFollowOutputRef.current) {
        return;
      }

      const behavior = didAddMessage && !reduceMotion ? 'smooth' : 'auto';
      if (behavior === 'smooth') {
        smoothScrollLockUntilRef.current = performance.now() + 420;
      }

      scrollBox.scrollTo({
        top: scrollBox.scrollHeight,
        behavior,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, reduceMotion]);

  const assistantAvatar = useMemo(
    () => (
      <Avatar
        shape="square"
        size={42}
        icon={<RobotOutlined />}
        className={styles.generalAvatar}
      />
    ),
    [],
  );

  const roleConfig: BubbleListProps['role'] = useMemo(
    () => ({
      assistant: {
        placement: 'start',
        variant: 'outlined',
        shape: 'corner',
        avatar: assistantAvatar,
        rootClassName: styles.assistantBubble,
        classNames: {
          body: styles.assistantBubbleBody,
          content: styles.assistantBubbleContent,
        },
        contentRender: (_content, info) => {
          const status = (info.status ?? 'success') as ChatMessageStatus;
          const kind = info.extraInfo?.kind;
          const message = info.extraInfo?.message as ChatMessage | undefined;

          if (kind === 'answer' && message) {
            return (
              <AnswerBody message={{ ...message, status }} reduceMotion={reduceMotion} />
            );
          }

          return (
            <div className={styles.answerContent}>
              <Typography.Paragraph className={styles.fallbackText}>
                {String(_content ?? '')}
              </Typography.Paragraph>
            </div>
          );
        },
      },
      user: {
        placement: 'end',
        variant: 'filled',
        shape: 'corner',
        rootClassName: styles.userBubble,
        classNames: { content: styles.userBubbleContent },
      },
    }),
    [assistantAvatar, reduceMotion],
  );

  const bubbleItems: BubbleItemType[] = useMemo(
    () =>
      messages.map((message) => {
        const isIntro = message.kind === 'intro';
        const isCompletedAnswer =
          message.kind === 'answer' && message.status === 'success';

        const copyText = [
          message.thinkContent,
          message.relatedEntries?.items
            .map((row, i) => {
              const fields = message.relatedEntries?.fields ?? [];
              const lines = fields.map(
                (f) => `${f.label}: ${formatCellValue(row[f.key])}`,
              );
              return [`#${i + 1}`, ...lines].join('\n');
            })
            .join('\n\n'),
          message.content,
        ]
          .filter(Boolean)
          .join('\n\n');

        const baseItem: BubbleItemType = {
          key: message.id,
          role: message.role,
          content: message.content,
          status: message.status,
          loading: false,
          streaming: message.status === 'updating',
          extraInfo: { kind: message.kind, message },
        };

        if (isIntro) {
          return {
            ...baseItem,
            contentRender: () => (
              <div className={styles.introContent}>
                <Welcome
                  variant="borderless"
                  title={displayName}
                  description={message.content}
                  classNames={{
                    root: styles.generalWelcome,
                    title: styles.generalWelcomeTitle,
                    description: styles.generalWelcomeDescription,
                  }}
                />
              </div>
            ),
          };
        }

        return {
          ...baseItem,
          footer: isCompletedAnswer ? (
            <Actions
              variant="borderless"
              fadeIn
              items={[
                {
                  key: 'copy',
                  actionRender: (
                    <Actions.Copy text={copyText} aria-label="复制回答" />
                  ),
                },
                {
                  key: 'retry',
                  label: '重新生成',
                  icon: <RedoOutlined aria-label="重新生成" />,
                },
              ]}
              onClick={({ key }) => {
                if (key === 'retry' && message.sourceQuestion) {
                  submit(message.sourceQuestion);
                }
              }}
            />
          ) : undefined,
        };
      }),
    [displayName, messages, submit],
  );

  return (
    <main className={styles.page}>
      <section className={styles.conversation} aria-label={`${displayName}对话`}>
        <div className={styles.messageViewport}>
          <Bubble.List
            ref={bubbleListRef}
            items={bubbleItems}
            role={roleConfig}
            autoScroll={false}
            rootClassName={styles.bubbleList}
            classNames={{ scroll: styles.bubbleScroll }}
          />
        </div>

        <footer className={styles.composerDock}>
          <Sender
            value={value}
            loading={isRequesting}
            autoSize={{ minRows: 1, maxRows: 6 }}
            submitType="enter"
            placeholder={CHAT_UI.placeholder}
            onChange={setValue}
            onSubmit={(next) => {
              submit(next);
            }}
            onCancel={cancelRequest}
            rootClassName={styles.sender}
          />
          <Typography.Text type="secondary" className={styles.disclaimer}>
            AI 生成内容仅供参考，请结合实际场景完成专业验证
          </Typography.Text>
        </footer>
      </section>
    </main>
  );
}
