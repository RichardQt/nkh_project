import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentRef } from 'react';
import { RedoOutlined, RobotOutlined } from '@ant-design/icons';
import {
  Actions,
  Bubble,
  Prompts,
  Sender,
  ThoughtChain,
  Welcome,
} from '@ant-design/x';
import type {
  BubbleItemType,
  BubbleListProps,
  ThoughtChainProps,
} from '@ant-design/x';
import { Avatar, Drawer, Empty, List, Typography } from 'antd';
import { useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { getAgent } from '../../data/agents';
import {
  GENERIC_STREAM_ERROR_MESSAGE,
  startChatStream,
  type ChatStreamController,
} from '../../services/chatStream';
import type { AgentKey } from '../../types/agent';
import type {
  ChatMessage,
  ClarificationPayload,
  ChatMessageStatus,
  ChatThoughtState,
  DisplayField,
  RelatedEntriesPayload,
  RelatedEntriesSection,
  RelatedEntryRow,
  ThoughtStepStatus,
  WorkflowNodeEvent,
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

const INTENT_LABELS: Record<string, string> = {
  achievements: '找成果',
  requirements: '找需求',
  expert_team: '找专家',
  enterprises: '找企业',
};

function createThoughtState(): ChatThoughtState {
  return {
    intent: { status: 'loading' },
    clarity: { status: 'pending' },
    reasoning: { status: 'pending' },
  };
}

function completePrecedingStep(status: ThoughtStepStatus): ThoughtStepStatus {
  return status === 'pending' || status === 'loading' ? 'success' : status;
}

function startThoughtStep(status: ThoughtStepStatus): ThoughtStepStatus {
  return status === 'pending' ? 'loading' : status;
}

/**
 * Product contract: ``need_clarify`` on node_end(clarify / followup_check).
 * - false → question is clear, proceed to deep thinking
 * - true  → show clarify panel (question + input + suggested questions)
 * ``event: clarify`` sets clarificationRequested + default answer text.
 */
function shouldAskFollowup(state: ChatThoughtState): boolean | undefined {
  if (state.clarity.clarificationRequested === true) {
    return true;
  }
  if (typeof state.clarity.needClarify === 'boolean') {
    return state.clarity.needClarify;
  }
  if (typeof state.clarity.isFollowup === 'boolean') {
    return state.clarity.isFollowup;
  }
  return undefined;
}

function requestClarification(
  state: ChatThoughtState | undefined,
  question?: string,
  suggestedQuestions?: string[],
): ChatThoughtState {
  const current = state ?? createThoughtState();
  const trimmedQuestion = question?.trim();

  return {
    intent: {
      ...current.intent,
      status: completePrecedingStep(current.intent.status),
    },
    clarity: {
      ...current.clarity,
      status: 'success',
      needClarify: true,
      clarificationRequested: true,
      clarifyQuestion: trimmedQuestion || current.clarity.clarifyQuestion,
      suggestedQuestions: suggestedQuestions?.length
        ? suggestedQuestions
        : current.clarity.suggestedQuestions,
    },
    reasoning:
      current.reasoning.status === 'error' ||
      current.reasoning.status === 'abort'
        ? current.reasoning
        : { status: 'pending' },
  };
}

function applySuggestedQuestions(
  state: ChatThoughtState | undefined,
  suggestedQuestions: string[],
): ChatThoughtState {
  const current = state ?? createThoughtState();
  if (!suggestedQuestions.length) {
    return current;
  }
  return {
    ...current,
    clarity: {
      ...current.clarity,
      suggestedQuestions,
    },
  };
}

function updateThoughtNode(
  state: ChatThoughtState | undefined,
  event: WorkflowNodeEvent,
  phase: 'start' | 'end',
): ChatThoughtState {
  const current = state ?? createThoughtState();

  if (event.node === 'intent_classify') {
    return {
      ...current,
      intent: {
        ...current.intent,
        status:
          phase === 'start'
            ? startThoughtStep(current.intent.status)
            : 'success',
        intent: event.intent ?? current.intent.intent,
        categories: event.categories ?? current.intent.categories,
      },
    };
  }

  // 「分析用户问题」：followup_check 或 clarify 节点
  if (event.node === 'followup_check' || event.node === 'clarify') {
    const needClarify =
      event.needClarify ?? current.clarity.needClarify;
    const clarifyQuestion =
      event.clarifyQuestion ?? current.clarity.clarifyQuestion;
    const isFollowup = event.isFollowup ?? current.clarity.isFollowup;

    if (phase === 'start') {
      return {
        ...current,
        intent: {
          ...current.intent,
          status: completePrecedingStep(current.intent.status),
        },
        clarity: {
          ...current.clarity,
          status: startThoughtStep(current.clarity.status),
          needClarify,
          clarifyQuestion,
          isFollowup,
        },
      };
    }

    // node_end: need_clarify is the source of truth
    if (needClarify === true) {
      return requestClarification(current, clarifyQuestion);
    }

    return {
      ...current,
      intent: {
        ...current.intent,
        status: completePrecedingStep(current.intent.status),
      },
      clarity: {
        ...current.clarity,
        status: 'success',
        needClarify: needClarify ?? false,
        clarificationRequested: false,
        clarifyQuestion,
        isFollowup,
      },
      reasoning:
        current.reasoning.status === 'pending'
          ? { status: 'loading' }
          : current.reasoning,
    };
  }

  return current;
}

function activateReasoning(
  state: ChatThoughtState | undefined,
): ChatThoughtState {
  const current = state ?? createThoughtState();
  return {
    intent: {
      ...current.intent,
      status: completePrecedingStep(current.intent.status),
    },
    clarity: {
      ...current.clarity,
      status: completePrecedingStep(current.clarity.status),
    },
    reasoning: { status: 'loading' },
  };
}

function completeThoughtState(
  state: ChatThoughtState | undefined,
  hasOutput: boolean,
): ChatThoughtState {
  const current = state ?? createThoughtState();
  const needsClarification =
    shouldAskFollowup(current) ?? false;
  const reasoningStatus =
    current.reasoning.status === 'loading' ||
    (current.reasoning.status === 'pending' && hasOutput && !needsClarification)
      ? 'success'
      : current.reasoning.status;

  return {
    intent: {
      ...current.intent,
      status: completePrecedingStep(current.intent.status),
    },
    clarity: {
      ...current.clarity,
      status:
        current.clarity.status === 'loading'
          ? 'success'
          : current.clarity.status,
    },
    reasoning: { status: reasoningStatus },
  };
}

function stopThoughtState(
  state: ChatThoughtState | undefined,
  status: 'error' | 'abort',
): ChatThoughtState {
  const current = state ?? createThoughtState();

  if (current.reasoning.status === 'loading') {
    return { ...current, reasoning: { status } };
  }
  if (current.clarity.status === 'loading') {
    return { ...current, clarity: { ...current.clarity, status } };
  }
  if (current.intent.status === 'loading') {
    return { ...current, intent: { ...current.intent, status } };
  }
  if (
    current.clarity.status === 'pending' &&
    current.intent.status === 'success'
  ) {
    return { ...current, clarity: { ...current.clarity, status } };
  }

  const needsClarification =
    shouldAskFollowup(current) ?? false;
  if (current.reasoning.status === 'pending' && !needsClarification) {
    return { ...current, reasoning: { status } };
  }
  return current;
}

function toThoughtItemStatus(
  status: ThoughtStepStatus,
): 'loading' | 'success' | 'error' | 'abort' | undefined {
  return status === 'pending' ? undefined : status;
}

function intentDescription(state: ChatThoughtState): string {
  switch (state.intent.status) {
    case 'loading':
      return '正在识别用户要查找的对象';
    case 'success':
      return state.intent.intent && INTENT_LABELS[state.intent.intent]
				? `通过对您提出的问题进行分析分类，您提出的问属于"${INTENT_LABELS[state.intent.intent]}"类问题`
				: "已完成用户意图判断";
    case 'error':
      return '意图判断失败';
    case 'abort':
      return '已停止意图判断';
    default:
      return '等待开始';
  }
}

function clarityDescription(state: ChatThoughtState): string {
  switch (state.clarity.status) {
    case 'loading':
      return '正在检查是否需要补充信息';
    case 'success': {
      const needsClarification = shouldAskFollowup(state);
      if (needsClarification === true) {
        return '需要补充相关信息';
      }
      if (needsClarification === false) {
        return '问题明确，可直接进行下一步';
      }
      return '已完成问题明确性判断';
    }
    case 'error':
      return '问题明确性判断失败';
    case 'abort':
      return '已停止问题明确性判断';
    default:
      return '等待意图判断完成';
  }
}

function reasoningDescription(state: ChatThoughtState): string {
  switch (state.reasoning.status) {
    case 'loading':
      return '正在分析并生成回答';
    case 'success':
      return '分析完成';
    case 'error':
      return '分析失败';
    case 'abort':
      return '已停止分析';
    default: {
      const needsClarification =
        shouldAskFollowup(state);
      if (needsClarification) {
        return '等待补充信息后继续';
      }
      return state.clarity.status === 'success'
        ? '准备进入深度思考'
        : '等待问题判断完成';
    }
  }
}

function thoughtAnnouncement(state: ChatThoughtState): string {
  if (state.reasoning.status !== 'pending') {
    return `深度思考：${reasoningDescription(state)}`;
  }
  if (state.clarity.status !== 'pending') {
    return `分析用户问题：${clarityDescription(state)}`;
  }
  return `判断用户意图：${intentDescription(state)}`;
}

function ThoughtProgress({
  message,
  reduceMotion,
}: {
  message: ChatMessage;
  reduceMotion: boolean | null;
}) {
  const state = message.thoughtState ?? {
    intent: { status: 'success' },
    clarity: { status: 'success' },
    reasoning: {
      status:
        message.status === 'error'
          ? 'error'
          : message.status === 'abort'
            ? 'abort'
            : message.status === 'success'
              ? 'success'
              : 'loading',
    },
  } satisfies ChatThoughtState;

  const items: ThoughtChainProps['items'] = [
    {
      key: 'intent',
      title: <span className={styles.thoughtTitle}>判断用户意图</span>,
      description: (
        <span className={styles.thoughtDescription}>
          {intentDescription(state)}
        </span>
      ),
      status: toThoughtItemStatus(state.intent.status),
      blink: !reduceMotion && state.intent.status === 'loading',
    },
    {
      key: 'clarity',
      title: <span className={styles.thoughtTitle}>分析用户问题</span>,
      description: (
        <span className={styles.thoughtDescription}>
          {clarityDescription(state)}
        </span>
      ),
      status: toThoughtItemStatus(state.clarity.status),
      blink: !reduceMotion && state.clarity.status === 'loading',
    },
    {
      key: 'reasoning',
      title: <span className={styles.thoughtTitle}>深度思考</span>,
      description: (
        <span className={styles.thoughtDescription}>
          {reasoningDescription(state)}
        </span>
      ),
      content: message.thinkContent ? (
        <div className={styles.thoughtStream}>{message.thinkContent}</div>
      ) : undefined,
      status: toThoughtItemStatus(state.reasoning.status),
      blink: !reduceMotion && state.reasoning.status === 'loading',
    },
  ];

  return (
    <div
      className={styles.thoughtPanel}
      role="group"
      aria-label="任务处理过程"
    >
      <span
        className={styles.srOnly}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {thoughtAnnouncement(state)}
      </span>
      <ThoughtChain
        items={items}
        line="solid"
        rootClassName={styles.thoughtChain}
        classNames={{
          item: styles.thoughtItem,
          itemHeader: styles.thoughtItemHeader,
          itemContent: styles.thoughtItemContent,
        }}
      />
    </div>
  );
}

interface EntryDetailState {
  title: string;
  sectionLabel?: string;
  listFields: DisplayField[];
  detailFields: DisplayField[];
  item: RelatedEntryRow;
}

function FieldDefinitionList({
  fields,
  item,
  className,
}: {
  fields: DisplayField[];
  item: RelatedEntryRow;
  className?: string;
}) {
  if (!fields.length) {
    return null;
  }
  return (
    <dl className={className ?? styles.entryFields}>
      {fields.map((field) => (
        <div key={field.key} className={styles.entryFieldRow}>
          <dt>{field.label}</dt>
          <dd>{formatCellValue(item[field.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntrySectionList({
  sectionKey,
  fields,
  items,
  onOpenDetail,
}: {
  sectionKey: string;
  fields: DisplayField[];
  items: RelatedEntryRow[];
  onOpenDetail: (item: RelatedEntryRow, index: number) => void;
}) {
  const titleField = fields[0];
  const cardFields = fields.slice(1);

  return (
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
          <List.Item
            key={`${sectionKey}-${index}-${titleText}`}
            className={styles.entryItem}
            onClick={() => onOpenDetail(item, index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenDetail(item, index);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`查看详情：${titleText}`}
          >
            <div className={styles.entryHead}>
              <Typography.Text strong className={styles.entryTitle}>
                {titleText}
              </Typography.Text>
              <span className={styles.entryHint}>详情</span>
            </div>
            <FieldDefinitionList fields={cardFields} item={item} />
          </List.Item>
        );
      }}
    />
  );
}

function RelatedEntriesList({
  payload,
}: {
  payload: RelatedEntriesPayload;
}) {
  const [detail, setDetail] = useState<EntryDetailState | null>(null);

  const sections: RelatedEntriesSection[] =
    payload.sections && payload.sections.length > 0
      ? payload.sections
      : [
          {
            key: payload.listKey || 'items',
            label: '相关结果',
            fields: payload.fields,
            detailFields: payload.detailFields ?? [],
            items: payload.items,
          },
        ];

  const totalCount = sections.reduce((sum, s) => sum + s.items.length, 0);
  const multiSection = Boolean(payload.sections && payload.sections.length > 0);

  if (!totalCount) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无相关条目"
        className={styles.entriesEmpty}
      />
    );
  }

  const openDetail = (
    section: RelatedEntriesSection,
    item: RelatedEntryRow,
    index: number,
  ) => {
    const listFields = section.fields.length
      ? section.fields
      : payload.fields;
    const detailFields = section.detailFields.length
      ? section.detailFields
      : (payload.detailFields ?? []);
    const titleField = listFields[0];
    const title = titleField
      ? formatCellValue(item[titleField.key])
      : `条目 ${index + 1}`;

    setDetail({
      title,
      sectionLabel: multiSection ? section.label : undefined,
      listFields,
      detailFields,
      item,
    });
  };

  return (
    <div className={styles.entriesPanel}>
      <Typography.Text className={styles.entriesTitle}>
        相关结果
        <span className={styles.entriesCount}>{totalCount}</span>
      </Typography.Text>

      <div className={styles.entriesSections}>
        {sections.map((section) => (
          <section
            key={section.key}
            className={styles.entriesSection}
            aria-label={section.label}
          >
            {multiSection ? (
              <Typography.Text className={styles.sectionTitle}>
                {section.label}
                <span className={styles.entriesCount}>{section.items.length}</span>
              </Typography.Text>
            ) : null}
            <EntrySectionList
              sectionKey={section.key}
              fields={
                section.fields.length ? section.fields : payload.fields
              }
              items={section.items}
              onOpenDetail={(item, index) => openDetail(section, item, index)}
            />
          </section>
        ))}
      </div>

      <Drawer
        title={
          <div className={styles.detailDrawerTitle}>
            <span className={styles.detailDrawerName}>{detail?.title ?? '详情'}</span>
            {detail?.sectionLabel ? (
              <span className={styles.detailDrawerBadge}>{detail.sectionLabel}</span>
            ) : null}
          </div>
        }
        placement="right"
        width={440}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        destroyOnHidden
        className={styles.detailDrawer}
        styles={{
          body: { paddingTop: 12 },
        }}
      >
        {detail ? (
          <div className={styles.detailBody}>
            {detail.listFields.length > 0 ? (
              <div className={styles.detailBlock}>
                <Typography.Text className={styles.detailBlockTitle}>
                  基本信息
                </Typography.Text>
                <FieldDefinitionList
                  fields={detail.listFields}
                  item={detail.item}
                  className={styles.detailFields}
                />
              </div>
            ) : null}

            {detail.detailFields.length > 0 ? (
              <div className={styles.detailBlock}>
                <Typography.Text className={styles.detailBlockTitle}>
                  详细信息
                </Typography.Text>
                <FieldDefinitionList
                  fields={detail.detailFields}
                  item={detail.item}
                  className={styles.detailFields}
                />
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无更多详情字段"
                className={styles.entriesEmpty}
              />
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

/**
 * Inline clarify card (not Modal/Drawer):
 * 1) default answer from event:clarify.question
 * 2) mini Sender for free-form follow-up
 * 3) Prompts chips from event:suggested_questions
 */
function ClarifyPanel({
  question,
  suggestedQuestions,
  interactive,
  onSubmit,
}: {
  question: string;
  suggestedQuestions: string[];
  interactive: boolean;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || !interactive) {
      return;
    }
    setDraft('');
    onSubmit(text);
  };

  return (
    <div className={styles.clarifyPanel} role="region" aria-label="补充信息">
      <Typography.Paragraph className={styles.clarifyQuestion}>
        {question}
      </Typography.Paragraph>

      {interactive ? (
        <div className={styles.clarifySenderWrap}>
          <Sender
            value={draft}
            onChange={setDraft}
            onSubmit={() => send(draft)}
            placeholder="补充说明或直接输入更具体的问题…"
            autoSize={{ minRows: 1, maxRows: 4 }}
            className={styles.clarifySender}
          />
        </div>
      ) : null}

      {suggestedQuestions.length > 0 ? (
        <Prompts
          title={
            <span className={styles.clarifyPromptsTitle}>推荐问题</span>
          }
          items={suggestedQuestions.map((item, index) => ({
            key: `sq-${index}`,
            label: item,
            description: item,
          }))}
          wrap
          vertical={false}
          className={styles.clarifyPrompts}
          onItemClick={({ data }) => {
            if (!interactive) {
              return;
            }
            const text =
              typeof data.description === 'string'
                ? data.description
                : typeof data.label === 'string'
                  ? data.label
                  : '';
            if (text.trim()) {
              send(text);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function AnswerBody({
  message,
  reduceMotion,
  clarifyInteractive,
  onClarifySubmit,
}: {
  message: ChatMessage;
  reduceMotion: boolean | null;
  clarifyInteractive?: boolean;
  onClarifySubmit?: (text: string) => void;
}) {
  const status = message.status;
  const isStreaming = status === 'loading' || status === 'updating';
  const showThoughtProgress =
    Boolean(message.thoughtState) ||
    Boolean(message.thinkContent) ||
    isStreaming ||
    status === 'error' ||
    status === 'abort';

  const clarity = message.thoughtState?.clarity;
  const needsClarify =
    Boolean(message.thoughtState) &&
    shouldAskFollowup(message.thoughtState!) === true &&
    clarity?.status === 'success';
  const clarifyQuestion = clarity?.clarifyQuestion?.trim() ?? '';
  const suggestedQuestions = clarity?.suggestedQuestions ?? [];
  const showClarifyPanel =
    needsClarify &&
    Boolean(clarifyQuestion) &&
    !message.relatedEntries &&
    !message.thinkContent;

  return (
    <div className={styles.answerContent}>
      {showThoughtProgress ? (
        <ThoughtProgress message={message} reduceMotion={reduceMotion} />
      ) : null}

      {showClarifyPanel ? (
        <ClarifyPanel
          question={clarifyQuestion}
          suggestedQuestions={suggestedQuestions}
          interactive={Boolean(clarifyInteractive && onClarifySubmit)}
          onSubmit={(text) => onClarifySubmit?.(text)}
        />
      ) : null}

      {message.relatedEntries ? (
        <RelatedEntriesList payload={message.relatedEntries} />
      ) : null}

      {message.content &&
      (status === 'error' ||
        status === 'abort' ||
        (status === 'success' &&
          !message.relatedEntries &&
          !message.thinkContent &&
          !showClarifyPanel)) ? (
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
                thoughtState: stopThoughtState(message.thoughtState, 'abort'),
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
          thoughtState: createThoughtState(),
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
          onNodeStart: (event) => {
            if (
              activeAnswerRef.current !== answerId ||
              (event.node !== 'intent_classify' &&
                event.node !== 'followup_check' &&
                event.node !== 'clarify')
            ) {
              return;
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      thoughtState: updateThoughtNode(
                        message.thoughtState,
                        event,
                        'start',
                      ),
                      status: 'updating',
                    }
                  : message,
              ),
            );
          },
          onNodeEnd: (event) => {
            if (
              activeAnswerRef.current !== answerId ||
              (event.node !== 'intent_classify' &&
                event.node !== 'followup_check' &&
                event.node !== 'clarify')
            ) {
              return;
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      thoughtState: updateThoughtNode(
                        message.thoughtState,
                        event,
                        'end',
                      ),
                      status: 'updating',
                    }
                  : message,
              ),
            );
          },
          onClarify: (payload: ClarificationPayload) => {
            if (activeAnswerRef.current !== answerId) {
              return;
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      thoughtState: requestClarification(
                        message.thoughtState,
                        payload.question,
                        payload.suggestedQuestions,
                      ),
                      status: 'updating',
                    }
                  : message,
              ),
            );
          },
          onSuggestedQuestions: (questions) => {
            if (activeAnswerRef.current !== answerId || !questions.length) {
              return;
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === answerId
                  ? {
                      ...message,
                      thoughtState: applySuggestedQuestions(
                        message.thoughtState,
                        questions,
                      ),
                      status: 'updating',
                    }
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
                      thoughtState: activateReasoning(message.thoughtState),
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
                      thoughtState: activateReasoning(message.thoughtState),
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
                const hasOutput =
                  Boolean(message.thinkContent?.trim()) ||
                  Boolean(message.relatedEntries);
                const isClarificationResponse =
                  message.thoughtState?.clarity.status === 'success' &&
                  shouldAskFollowup(message.thoughtState) === true;
                const completedCleanly = hasOutput || isClarificationResponse;

                return {
                  ...message,
                  status: completedCleanly ? 'success' : 'error',
                  thoughtState: completedCleanly
                    ? completeThoughtState(message.thoughtState, hasOutput)
                    : stopThoughtState(message.thoughtState, 'error'),
                  content: completedCleanly
                    ? message.content
                    : message.content ||
                      '处理流程提前结束，暂时没有可展示的内容，请重试。',
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
                      status: error.name === 'AbortError' ? 'abort' : 'error',
                      thoughtState: stopThoughtState(
                        message.thoughtState,
                        error.name === 'AbortError' ? 'abort' : 'error',
                      ),
                      content:
                        error.name === 'AbortError'
                          ? message.content || '已停止生成。'
                          : GENERIC_STREAM_ERROR_MESSAGE,
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

  const latestAnswerId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.kind === 'answer') {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

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
            const clarifyInteractive =
              !isRequesting &&
              message.id === latestAnswerId &&
              status === 'success' &&
              shouldAskFollowup(message.thoughtState ?? createThoughtState()) ===
                true;

            return (
              <AnswerBody
                message={{ ...message, status }}
                reduceMotion={reduceMotion}
                clarifyInteractive={clarifyInteractive}
                onClarifySubmit={submit}
              />
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
    [assistantAvatar, isRequesting, latestAnswerId, reduceMotion, submit],
  );

  const bubbleItems: BubbleItemType[] = useMemo(
    () =>
      messages.map((message) => {
        const isIntro = message.kind === 'intro';
        const isCompletedAnswer =
          message.kind === 'answer' && message.status === 'success';

        const copyText = [
          message.thinkContent,
          message.thoughtState?.clarity.clarifyQuestion,
          (() => {
            const related = message.relatedEntries;
            if (!related) {
              return '';
            }
            const sections =
              related.sections && related.sections.length > 0
                ? related.sections
                : [
                    {
                      label: '相关结果',
                      fields: related.fields,
                      detailFields: related.detailFields ?? [],
                      items: related.items,
                    },
                  ];
            return sections
              .map((section) => {
                const body = section.items
                  .map((row, i) => {
                    const allFields = [
                      ...section.fields,
                      ...(section.detailFields ?? []),
                    ];
                    const lines = allFields.map(
                      (f) => `${f.label}: ${formatCellValue(row[f.key])}`,
                    );
                    return [`#${i + 1}`, ...lines].join('\n');
                  })
                  .join('\n\n');
                return section.label ? `${section.label}\n${body}` : body;
              })
              .join('\n\n');
          })(),
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
