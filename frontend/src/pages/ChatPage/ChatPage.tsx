import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentRef } from 'react';
import { RedoOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Actions,
  Bubble,
  Prompts,
  Sender,
  ThoughtChain,
} from '@ant-design/x';
import type {
  BubbleItemType,
  BubbleListProps,
  PromptsProps,
  ThoughtChainProps,
} from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { Button, Typography } from 'antd';
import { useReducedMotion } from 'motion/react';
import { useLocation, useParams } from 'react-router-dom';
import AgentGlyph from '../../components/AgentGlyph/AgentGlyph';
import { getAgent } from '../../data/agents';
import {
  startChatStream,
  type ChatStreamController,
} from '../../services/chatStream';
import type { ChatMessage, ChatMessageStatus } from '../../types/chat';
import styles from './ChatPage.module.css';

interface ChatLocationState {
  initialQuestion?: string;
}

function readEntryQuestion(search: string, state: unknown): string {
  const fromState =
    state && typeof state === 'object'
      ? String(
          (state as ChatLocationState).initialQuestion ?? '',
        ).trim()
      : '';
  const fromQuery = new URLSearchParams(search).get('q')?.trim() ?? '';
  return fromState || fromQuery;
}

function pendingStorageKey(agentKey: string) {
  return `nkh:pending-question:${agentKey}`;
}

function createThoughtItems(
  status: ChatMessageStatus,
): ThoughtChainProps['items'] {
  const terminalStatus =
    status === 'error' ? 'error' : status === 'abort' ? 'abort' : 'success';

  return [
    {
      key: 'retrieve',
      title: '检索相关科技资料',
      description: '匹配当前智能体的专业知识与任务线索',
      status: status === 'loading' ? 'loading' : terminalStatus,
      collapsible: true,
    },
    {
      key: 'organize',
      title: '组织关键结论',
      description: '将信息整理为可执行的分析与建议',
      status:
        status === 'loading' || status === 'updating'
          ? 'loading'
          : terminalStatus,
      collapsible: true,
    },
  ];
}

export default function ChatPage() {
  const { agentKey } = useParams();
  const agent = getAgent(agentKey);
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: `intro-${agent.key}`,
      role: 'assistant',
      content: agent.greeting,
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
  // Capture entry question on first render of this mount (before any cleanup).
  const entryQuestionRef = useRef<string | null>(null);
  if (entryQuestionRef.current === null) {
    const fromRoute = readEntryQuestion(location.search, location.state);
    const fromStorage =
      sessionStorage.getItem(pendingStorageKey(agent.key))?.trim() ?? '';
    const question = fromRoute || fromStorage;
    entryQuestionRef.current = question;
    if (question) {
      sessionStorage.setItem(pendingStorageKey(agent.key), question);
    }
  }

  const nextMessageId = useCallback((prefix: string) => {
    messageSequenceRef.current += 1;
    return `${prefix}-${Date.now()}-${messageSequenceRef.current}`;
  }, []);

  const setRequesting = useCallback((value: boolean) => {
    isRequestingRef.current = value;
    setIsRequesting(value);
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
          status: 'loading',
          kind: 'answer',
          sourceQuestion: question,
        },
      ]);

      requestRef.current = startChatStream(
        { agentKey: agent.key, message: question },
        {
          onDelta: (content) => {
            if (activeAnswerRef.current !== answerId) {
              return;
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      content: `${message.content}${content}`,
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
            sessionStorage.removeItem(pendingStorageKey(agent.key));
            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      status: 'success',
                      content:
                        message.content ||
                        '回答已完成，但暂时没有可展示的内容。',
                    }
                  : message,
              ),
            );
          },
          onError: (error) => {
            if (activeAnswerRef.current !== answerId) {
              return;
            }

            activeAnswerRef.current = null;
            requestRef.current = null;
            setRequesting(false);
            // Keep pending question on abort so remount can retry; clear real errors.
            if (error.name !== 'AbortError') {
              sessionStorage.removeItem(pendingStorageKey(agent.key));
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
                            '暂时无法连接智能服务，请确认 FastAPI 服务已启动后重试。',
                    }
                  : message,
              ),
            );
          },
        },
      );

      return true;
    },
    [agent.key, nextMessageId, setRequesting],
  );

  // Auto-ask when arriving from the home composer with a question.
  useEffect(() => {
    if (autoStartedRef.current) {
      return;
    }

    const question =
      entryQuestionRef.current ||
      sessionStorage.getItem(pendingStorageKey(agent.key))?.trim() ||
      '';

    if (!question) {
      return;
    }

    autoStartedRef.current = true;
    const started = submit(question);

    if (started) {
      // Clean the query string without React Router navigation, so we do not
      // remount the chat tree or race AnimatePresence/Outlet.
      if (window.location.search) {
        window.history.replaceState(
          null,
          '',
          `${location.pathname}${window.location.hash ?? ''}`,
        );
      }
      // Keep storage until the stream settles so Strict Mode remount can retry.
    } else {
      autoStartedRef.current = false;
    }
  }, [agent.key, location.pathname, submit]);

  useEffect(
    () => () => {
      // Capture this mount's controller; delayed abort avoids fighting Strict Mode
      // remounts that immediately start a fresh request on a new instance.
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
  }, [agent.key]);

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

  const introPrompts: PromptsProps['items'] = useMemo(
    () =>
      agent.prompts.slice(0, 3).map((prompt) => ({
        key: prompt,
        icon: <SearchOutlined />,
        label: (
          <Button
            type="text"
            block
            disabled={isRequesting}
            className={styles.introPromptAction}
            onClick={(event) => {
              event.stopPropagation();
              submit(prompt);
            }}
          >
            {prompt}
          </Button>
        ),
      })),
    [agent.prompts, isRequesting, submit],
  );

  const roleConfig: BubbleListProps['role'] = useMemo(
    () => ({
      assistant: {
        placement: 'start',
        variant: 'outlined',
        shape: 'corner',
        avatar: <AgentGlyph agentKey={agent.key} size="medium" active />,
        rootClassName: styles.assistantBubble,
        classNames: {
          body: styles.assistantBubbleBody,
          content: styles.assistantBubbleContent,
        },
        contentRender: (content, info) => {
          const status = (info.status ?? 'success') as ChatMessageStatus;
          const kind = info.extraInfo?.kind;

          return (
            <div className={styles.answerContent}>
              {kind === 'answer' && (
                <ThoughtChain
                  items={createThoughtItems(status)}
                  defaultExpandedKeys={[]}
                  line="solid"
                  rootClassName={styles.thoughtChain}
                />
              )}
              {String(content ?? '') ? (
                <XMarkdown
                  rootClassName={styles.markdown}
                  content={String(content)}
                  openLinksInNewTab
                  streaming={{
                    hasNextChunk: status === 'loading' || status === 'updating',
                    enableAnimation: !reduceMotion,
                    animationConfig: {
                      fadeDuration: 160,
                      easing: 'ease-out',
                    },
                    tail: status === 'updating',
                  }}
                />
              ) : null}
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
    [agent.key, reduceMotion],
  );

  const bubbleItems: BubbleItemType[] = useMemo(
    () =>
      messages.map((message) => {
        const isIntro = message.kind === 'intro';
        const isCompletedAnswer =
          message.kind === 'answer' && message.status === 'success';

        const baseItem: BubbleItemType = {
          key: message.id,
          role: message.role,
          content: message.content,
          status: message.status,
          loading: message.status === 'loading',
          streaming: message.status === 'updating',
          extraInfo: { kind: message.kind },
        };

        if (isIntro) {
          return {
            ...baseItem,
            contentRender: () => (
              <div className={styles.introContent}>
                <div className={styles.introStage}>
                  <AgentGlyph agentKey={agent.key} size="medium" active />
                  <div className={styles.introCopy}>
                    <Typography.Text className={styles.introEyebrow}>
                      {agent.shortName}
                    </Typography.Text>
                    <XMarkdown
                      rootClassName={styles.markdown}
                      content={message.content}
                    />
                  </div>
                </div>
                <Typography.Text className={styles.promptLabel}>
                  你可以从这些问题开始
                </Typography.Text>
                <Prompts
                  items={introPrompts}
                  wrap
                  fadeIn={!reduceMotion}
                  classNames={{
                    root: styles.introPrompts,
                    item: styles.introPromptItem,
                    itemContent: styles.introPromptContent,
                  }}
                  onItemClick={({ data }) => submit(data.key)}
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
                    <Actions.Copy text={message.content} aria-label="复制回答" />
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
    [agent.key, agent.shortName, introPrompts, messages, reduceMotion, submit],
  );

  return (
    <main className={styles.page}>
      <section
        className={styles.conversation}
        aria-label={`${agent.name}对话`}
      >
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
            placeholder={agent.placeholder}
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
