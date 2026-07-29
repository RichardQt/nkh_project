import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentRef, ReactNode } from 'react';
import {
  DislikeFilled,
  DislikeOutlined,
  LikeFilled,
  LikeOutlined,
  RedoOutlined,
} from '@ant-design/icons';
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
import { Drawer, Empty, List, Typography } from 'antd';
import { useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { KnowledgeGraphModal } from '../../components/KnowledgeGraph/KnowledgeGraphModal';
import {
  SceneResultPanel,
  SearchPreviewPanel,
} from '../../components/SceneResults/SceneResults';
import { getAgent } from '../../data/agents';
import { resolveKgQueries } from '../../data/kgFieldMap';
import {
  sceneIntroCopy,
  scenePlaceholder,
} from '../../data/sceneMocks';
import {
  GENERIC_STREAM_ERROR_MESSAGE,
  startChatStream,
  type ChatStreamController,
} from '../../services/chatStream';
import { startSceneMockStream } from '../../services/sceneMockStream';
import type { AgentKey } from '../../types/agent';
import type {
  AnswerTurn,
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
import type { KgQueryTarget } from '../../types/kg';
import { isSceneMockAgentKey } from '../../types/scene';
import styles from './ChatPage.module.css';

interface ChatLocationState {
  initialQuestion?: string;
}

interface ChatPageProps {
  /** 首页选中的能力入口 key；null 表示未选场景。 */
  agentKey: AgentKey | null;
}

/** Local-only thumbs feedback for completed assistant answers. */
type MessageFeedback = 'like' | 'dislike';

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

/**
 * Resolve session id for Backend A / B.
 * Mock 联调：URL 加 `?sid=1`（正常）或 `?sid=2`（澄清）；
 * 未指定时沿用 sessionStorage，否则生成新 id。
 */
function resolveSessionId(sessionKey: string, search: string): string {
  const key = sessionIdStorageKey(sessionKey);
  const params = new URLSearchParams(search);
  const fromQuery =
    params.get('sid')?.trim() ||
    params.get('sessionId')?.trim() ||
    params.get('session_id')?.trim() ||
    '';

  if (fromQuery === '1' || fromQuery === '2') {
    sessionStorage.setItem(key, fromQuery);
    return fromQuery;
  }

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
  policies: '政策推荐',
  achievement_eval: '成果评估',
  research_direction: '研究方向',
  platforms: '找平台',
};

function createThoughtState(): ChatThoughtState {
  return {
    intent: { status: 'loading' },
    clarity: { status: 'pending' },
    reasoning: { status: 'pending' },
  };
}

function createAnswerTurn(id: string, question: string): AnswerTurn {
  return {
    id,
    question,
    content: '',
    thinkContent: '',
    thoughtState: createThoughtState(),
    status: 'loading',
  };
}

/** Patch either the root assistant message or one of its inline turns. */
function updateActiveTarget(
  messages: ChatMessage[],
  answerId: string,
  turnId: string | null,
  updater: (target: ChatMessage | AnswerTurn) => ChatMessage | AnswerTurn,
): ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== answerId) {
      return message;
    }
    if (!turnId) {
      return updater(message) as ChatMessage;
    }
    return {
      ...message,
      turns: (message.turns ?? []).map((turn) =>
        turn.id === turnId ? (updater(turn) as AnswerTurn) : turn,
      ),
    };
  });
}

function finalizeStreamTarget(
  target: ChatMessage | AnswerTurn,
): ChatMessage | AnswerTurn {
  const hasOutput =
    Boolean(target.thinkContent?.trim()) ||
    Boolean(target.relatedEntries) ||
    Boolean(target.sceneResult) ||
    Boolean(target.searchPreview);
  const isClarificationResponse =
    target.thoughtState?.clarity.status === 'success' &&
    shouldAskFollowup(target.thoughtState) === true;
  const completedCleanly = hasOutput || isClarificationResponse;

  return {
    ...target,
    status: completedCleanly ? 'success' : 'error',
    thoughtState: completedCleanly
      ? completeThoughtState(target.thoughtState, hasOutput)
      : stopThoughtState(target.thoughtState, 'error'),
    content: completedCleanly
      ? target.content
      : target.content ||
        '处理流程提前结束，暂时没有可展示的内容，请重试。',
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

    // 问题已明确，但仍需等 retrieval 的关键词再标记 success
    return {
      ...current,
      intent: {
        ...current.intent,
        status: completePrecedingStep(current.intent.status),
      },
      clarity: {
        ...current.clarity,
        status: 'loading',
        needClarify: needClarify ?? false,
        clarificationRequested: false,
        clarifyQuestion,
        isFollowup,
      },
      reasoning: current.reasoning,
    };
  }

  // retrieval 节点：拿到优化后的查询关键词后，才完成「分析用户问题」
  if (event.node === 'retrieval') {
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
        },
      };
    }

    const optimizedQuery =
      event.optimizedQuery?.trim() || current.clarity.optimizedQuery;
    const needClarify = event.needClarify ?? current.clarity.needClarify;
    const clarityDone =
      Boolean(optimizedQuery) || needClarify === true;

    return {
      ...current,
      intent: {
        ...current.intent,
        intent: event.intent ?? current.intent.intent,
        categories: event.categories ?? current.intent.categories,
        status: completePrecedingStep(current.intent.status),
      },
      clarity: {
        ...current.clarity,
        status: clarityDone ? 'success' : 'loading',
        needClarify,
        optimizedQuery,
      },
      reasoning:
        clarityDone &&
        needClarify !== true &&
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
  const clarityReady =
    current.clarity.status === 'success' ||
    Boolean(current.clarity.optimizedQuery?.trim()) ||
    shouldAskFollowup(current) === true;

  return {
    intent: {
      ...current.intent,
      status: completePrecedingStep(current.intent.status),
    },
    clarity: {
      ...current.clarity,
      // 有关键词或确认需澄清时才收成 success；否则保持 loading + blink
      status: clarityReady
        ? completePrecedingStep(current.clarity.status)
        : startThoughtStep(current.clarity.status),
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
  const hasKeywords = Boolean(current.clarity.optimizedQuery?.trim());
  const reasoningStatus =
    current.reasoning.status === 'loading' ||
    (current.reasoning.status === 'pending' && hasOutput && !needsClarification)
      ? 'success'
      : current.reasoning.status;

  // 分析步骤：有关键词 / 需澄清 / 已有输出时再收成 success，避免闪过“问题明确…”
  let clarityStatus = current.clarity.status;
  if (clarityStatus === 'loading') {
    if (needsClarification || hasKeywords || hasOutput) {
      clarityStatus = 'success';
    }
  }

  return {
    intent: {
      ...current.intent,
      status: completePrecedingStep(current.intent.status),
    },
    clarity: {
      ...current.clarity,
      status: clarityStatus,
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

function intentDescription(state: ChatThoughtState): ReactNode {
  switch (state.intent.status) {
    case 'loading':
      return '正在识别用户要查找的对象';
    case 'success': {
      const label =
        state.intent.intent && INTENT_LABELS[state.intent.intent]
          ? INTENT_LABELS[state.intent.intent]
          : '';
      if (label) {
        return (
          <>
            通过对您提出的问题进行分析分类，您提出的问属于"
            <span className={styles.thoughtHighlight}>{label}</span>
            "类问题
          </>
        );
      }
      return '已完成用户意图判断';
    }
    case 'error':
      return '意图判断失败';
    case 'abort':
      return '已停止意图判断';
    default:
      return '等待开始';
  }
}

function clarityDescription(state: ChatThoughtState): ReactNode {
  switch (state.clarity.status) {
    case 'loading':
      return '正在分析用户问题';
    case 'success': {
      const needsClarification = shouldAskFollowup(state);
      if (needsClarification === true) {
        return '需要补充相关信息';
      }
      const keywordList =
        state.clarity.optimizedQuery?.split(/\s+/).filter(Boolean) ?? [];
      if (keywordList.length > 0) {
        return (
          <>
            用户问题分析成功，与
            <span className={styles.thoughtHighlight}>
              {keywordList.join('、')}
            </span>
            关键词相关
          </>
        );
      }
      return '用户问题分析成功';
    }
    case 'error':
      return '用户问题分析失败';
    case 'abort':
      return '已停止分析用户问题';
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
  if (state.clarity.status === 'loading') {
    return '分析用户问题：正在分析用户问题';
  }
  if (state.clarity.status !== 'pending') {
    const keywords =
      state.clarity.optimizedQuery?.split(/\s+/).filter(Boolean).join('、') ??
      '';
    if (shouldAskFollowup(state) === true) {
      return '分析用户问题：需要补充相关信息';
    }
    if (keywords) {
      return `分析用户问题：用户问题分析成功，与${keywords}关键词相关`;
    }
    if (state.clarity.status === 'success') {
      return '分析用户问题：用户问题分析成功';
    }
    return '分析用户问题：正在分析用户问题';
  }
  const label =
    state.intent.intent && INTENT_LABELS[state.intent.intent]
      ? INTENT_LABELS[state.intent.intent]
      : '';
  if (state.intent.status === 'success' && label) {
    return `判断用户意图：通过对您提出的问题进行分析分类，您提出的问属于"${label}"类问题`;
  }
  if (state.intent.status === 'loading') {
    return '判断用户意图：正在识别用户要查找的对象';
  }
  return '判断用户意图：等待开始';
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
      title: '判断用户意图',
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
      title: '分析用户问题',
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
      title: '深度思考',
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
  /** listKey / sectionKey used for knowledge-graph field mapping */
  listKey?: string;
}

function KgValueLinks({
  fieldLabel,
  display,
  targets,
  className,
  onOpenKg,
}: {
  fieldLabel: string;
  display: string;
  targets: Array<{ entityType: string; vid: string }>;
  className: string;
  onOpenKg: (target: KgQueryTarget) => void;
}) {
  if (!targets.length) {
    return <>{display}</>;
  }

  // Single target: keep original full display text as the link label.
  if (targets.length === 1) {
    const kg = targets[0];
    return (
      <button
        type="button"
        className={className}
        onClick={() =>
          onOpenKg({
            entityType: kg.entityType,
            vid: kg.vid,
            label: `${fieldLabel}：${kg.vid}`,
          })
        }
        title="查看知识图谱"
      >
        {display}
      </button>
    );
  }

  // Multi-value (服务领域 / 产业领域 split by 、): each segment is a separate query.
  return (
    <span className={styles.kgMultiValue}>
      {targets.map((kg, index) => (
        <span key={`${kg.entityType}-${kg.vid}-${index}`}>
          {index > 0 ? <span className={styles.kgValueSep}>、</span> : null}
          <button
            type="button"
            className={className}
            onClick={() =>
              onOpenKg({
                entityType: kg.entityType,
                vid: kg.vid,
                label: `${fieldLabel}：${kg.vid}`,
              })
            }
            title="查看知识图谱"
          >
            {kg.vid}
          </button>
        </span>
      ))}
    </span>
  );
}

function FieldDefinitionList({
  fields,
  item,
  className,
  listKey,
  onOpenKg,
}: {
  fields: DisplayField[];
  item: RelatedEntryRow;
  className?: string;
  /** listKey / sectionKey for KG field mapping */
  listKey?: string;
  onOpenKg?: (target: KgQueryTarget) => void;
}) {
  if (!fields.length) {
    return null;
  }
  return (
    <dl className={className ?? styles.entryFields}>
      {fields.map((field) => {
        const display = formatCellValue(item[field.key]);
        const kgTargets =
          onOpenKg && listKey && display !== '-'
            ? resolveKgQueries(listKey, field.key, item)
            : [];

        return (
          <div key={field.key} className={styles.entryFieldRow}>
            <dt>{field.label}</dt>
            <dd>
              {kgTargets.length > 0 && onOpenKg ? (
                <KgValueLinks
                  fieldLabel={field.label}
                  display={display}
                  targets={kgTargets}
                  className={styles.kgFieldLink}
                  onOpenKg={onOpenKg}
                />
              ) : (
                display
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function EntrySectionList({
  sectionKey,
  fields,
  items,
  onOpenDetail,
  onOpenKg,
}: {
  sectionKey: string;
  fields: DisplayField[];
  items: RelatedEntryRow[];
  onOpenDetail: (item: RelatedEntryRow, index: number) => void;
  onOpenKg: (target: KgQueryTarget) => void;
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
        const titleKgTargets =
          titleField && titleText !== '-'
            ? resolveKgQueries(sectionKey, titleField.key, item)
            : [];

        return (
          <List.Item
            key={`${sectionKey}-${index}-${titleText}`}
            className={styles.entryItem}
          >
            <div className={styles.entryHead}>
              {titleKgTargets.length > 0 && titleField ? (
                <KgValueLinks
                  fieldLabel={titleField.label}
                  display={titleText}
                  targets={titleKgTargets}
                  className={styles.kgTitleLink}
                  onOpenKg={onOpenKg}
                />
              ) : (
                <Typography.Text strong className={styles.entryTitle}>
                  {titleText}
                </Typography.Text>
              )}
              <button
                type="button"
                className={styles.entryHint}
                onClick={() => onOpenDetail(item, index)}
                aria-label={`查看详情：${titleText}`}
              >
                详情
              </button>
            </div>
            <FieldDefinitionList
              fields={cardFields}
              item={item}
              listKey={sectionKey}
              onOpenKg={onOpenKg}
            />
          </List.Item>
        );
      }}
    />
  );
}

function RelatedEntriesList({
  payload,
  title = '相关结果',
}: {
  payload: RelatedEntriesPayload;
  title?: string;
}) {
  const [detail, setDetail] = useState<EntryDetailState | null>(null);
  const [kgTarget, setKgTarget] = useState<KgQueryTarget | null>(null);

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
  // Platforms may return multiple types; always show each type label when present.
  const multiSection = sections.length > 1 || Boolean(payload.sections?.length);

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
    const titleText = titleField
      ? formatCellValue(item[titleField.key])
      : `条目 ${index + 1}`;

    setDetail({
      title: titleText,
      sectionLabel: multiSection ? section.label : undefined,
      listFields,
      detailFields,
      item,
      listKey: section.key,
    });
  };

  const openKg = (target: KgQueryTarget) => {
    setKgTarget(target);
  };

  return (
    <div className={styles.entriesPanel}>
      {title ? (
        <Typography.Text className={styles.entriesTitle}>
          {title}
          <span className={styles.entriesCount}>{totalCount}</span>
        </Typography.Text>
      ) : null}

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
              onOpenKg={openKg}
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
                  listKey={detail.listKey}
                  onOpenKg={openKg}
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
                  listKey={detail.listKey}
                  onOpenKg={openKg}
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

      <KnowledgeGraphModal
        open={Boolean(kgTarget)}
        target={kgTarget}
        onClose={() => setKgTarget(null)}
      />
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
            rootClassName={styles.clarifySender}
          />
        </div>
      ) : null}

      {suggestedQuestions.length > 0 ? (
        <Prompts
          title={
            <span className={styles.entriesTitle}>
              推荐问题
              <span className={styles.entriesCount}>
                {suggestedQuestions.length}
              </span>
            </span>
          }
          items={suggestedQuestions.map((item, index) => ({
            key: `sq-${index}`,
            label: item,
            disabled: !interactive,
          }))}
          wrap
          vertical={false}
          className={styles.clarifyPrompts}
          classNames={{
            list: styles.promptChipList,
            item: styles.promptChipItem,
          }}
          onItemClick={({ data }) => {
            if (!interactive) {
              return;
            }
            const text =
              typeof data.label === 'string'
                ? data.label
                : typeof data.description === 'string'
                  ? data.description
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

/** Follow-up chips under a completed normal answer (not the clarify panel). */
function FollowupPrompts({
  questions,
  interactive,
  onSubmit,
}: {
  questions: string[];
  interactive: boolean;
  onSubmit?: (text: string) => void;
}) {
  if (!questions.length) {
    return null;
  }

  return (
    <div className={styles.followupPrompts} role="region" aria-label="推荐问题">
      <Prompts
        title={
          <span className={styles.entriesTitle}>
            推荐问题
            <span className={styles.entriesCount}>{questions.length}</span>
          </span>
        }
        items={questions.map((item, index) => ({
          key: `fq-${index}`,
          label: item,
          disabled: !interactive,
        }))}
        wrap
        vertical={false}
        className={styles.followupPromptsList}
        classNames={{
          list: styles.promptChipList,
          item: styles.promptChipItem,
        }}
        onItemClick={({ data }) => {
          if (!interactive || !onSubmit) {
            return;
          }
          const text = typeof data.label === 'string' ? data.label : '';
          if (text.trim()) {
            onSubmit(text.trim());
          }
        }}
      />
    </div>
  );
}

function segmentNeedsClarify(target: ChatMessage | AnswerTurn): boolean {
  const clarity = target.thoughtState?.clarity;
  return (
    Boolean(target.thoughtState) &&
    shouldAskFollowup(target.thoughtState!) === true &&
    clarity?.status === 'success'
  );
}

function AnswerSegment({
  target,
  reduceMotion,
  clarifyInteractive,
  promptsInteractive,
  onClarifySubmit,
  onRecommendSubmit,
}: {
  target: ChatMessage | AnswerTurn;
  reduceMotion: boolean | null;
  clarifyInteractive?: boolean;
  promptsInteractive?: boolean;
  /** Clarify panel → stays inside the current bubble. */
  onClarifySubmit?: (text: string) => void;
  /** Recommended questions after a normal answer → new chat bubbles. */
  onRecommendSubmit?: (text: string) => void;
}) {
  const status = target.status;
  const isStreaming = status === 'loading' || status === 'updating';
  const showThoughtProgress =
    Boolean(target.thoughtState) || Boolean(target.thinkContent);

  const clarity = target.thoughtState?.clarity;
  const needsClarify = segmentNeedsClarify(target);
  const clarifyQuestion = clarity?.clarifyQuestion?.trim() ?? '';
  const suggestedQuestions = clarity?.suggestedQuestions ?? [];
  const showClarifyPanel =
    needsClarify &&
    Boolean(clarifyQuestion) &&
    !target.relatedEntries &&
    !target.thinkContent &&
    !target.sceneResult &&
    !target.searchPreview;

  // 正常回答结束后展示推荐问题（与澄清面板互斥）
  const showFollowupPrompts =
    !showClarifyPanel &&
    !needsClarify &&
    status === 'success' &&
    suggestedQuestions.length > 0 &&
    (Boolean(target.relatedEntries) ||
      Boolean(target.thinkContent) ||
      Boolean(target.sceneResult));

  // ThoughtProgress expects ChatMessage-shaped fields; AnswerTurn is compatible enough.
  const progressMessage = target as ChatMessage;

  return (
    <div className={styles.answerSegment}>
      {showThoughtProgress ? (
        <ThoughtProgress message={progressMessage} reduceMotion={reduceMotion} />
      ) : null}

      {showClarifyPanel ? (
        <ClarifyPanel
          question={clarifyQuestion}
          suggestedQuestions={suggestedQuestions}
          interactive={Boolean(clarifyInteractive && onClarifySubmit)}
          onSubmit={(text) => onClarifySubmit?.(text)}
        />
      ) : null}

      {target.searchPreview ? (
        <SearchPreviewPanel
          preview={target.searchPreview}
          reduceMotion={reduceMotion}
        />
      ) : null}

      {target.sceneResult ? (
        <SceneResultPanel
          result={target.sceneResult}
          streaming={isStreaming}
          expertsSlot={
            target.sceneResult.kind === 'research_direction' &&
            target.relatedEntries ? (
              <RelatedEntriesList
                payload={target.relatedEntries}
                title=""
              />
            ) : null
          }
        />
      ) : null}

      {!target.sceneResult && target.relatedEntries ? (
        <RelatedEntriesList payload={target.relatedEntries} />
      ) : null}

      {showFollowupPrompts ? (
        <FollowupPrompts
          questions={suggestedQuestions}
          interactive={Boolean(promptsInteractive && onRecommendSubmit)}
          onSubmit={onRecommendSubmit}
        />
      ) : null}

      {target.content &&
      (status === 'error' ||
        status === 'abort' ||
        (status === 'success' &&
          !target.relatedEntries &&
          !target.thinkContent &&
          !target.sceneResult &&
          !target.searchPreview &&
          !showClarifyPanel)) ? (
        <Typography.Paragraph className={styles.fallbackText}>
          {target.content}
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}

function AnswerBody({
  message,
  reduceMotion,
  interactive,
  onClarifySubmit,
  onRecommendSubmit,
}: {
  message: ChatMessage;
  reduceMotion: boolean | null;
  /** Latest answer bubble can accept clarify / recommended follow-ups. */
  interactive?: boolean;
  /** Clarify（需要补充信息）→ stays inside current bubble. */
  onClarifySubmit?: (text: string) => void;
  /** Recommended questions after normal answer → new chat bubbles. */
  onRecommendSubmit?: (text: string) => void;
}) {
  const turns = message.turns ?? [];
  const latestTarget: ChatMessage | AnswerTurn =
    turns.length > 0 ? turns[turns.length - 1]! : message;
  const latestStreaming =
    latestTarget.status === 'loading' || latestTarget.status === 'updating';
  const canInteract =
    Boolean(interactive && (onClarifySubmit || onRecommendSubmit)) &&
    !latestStreaming &&
    latestTarget.status === 'success';

  const rootInteractive = canInteract && turns.length === 0;
  const rootNeedsClarify = segmentNeedsClarify(message);

  return (
    <div className={styles.answerContent}>
      <AnswerSegment
        target={message}
        reduceMotion={reduceMotion}
        clarifyInteractive={rootInteractive && rootNeedsClarify}
        promptsInteractive={rootInteractive && !rootNeedsClarify}
        onClarifySubmit={onClarifySubmit}
        onRecommendSubmit={onRecommendSubmit}
      />

      {turns.map((turn, index) => {
        const isLatestTurn = index === turns.length - 1;
        const turnInteractive = canInteract && isLatestTurn;
        const turnNeedsClarify = segmentNeedsClarify(turn);

        return (
          <div key={turn.id} className={styles.answerTurn}>
            <div className={styles.answerTurnQuestion} role="note">
              <span className={styles.answerTurnLabel}>你的补充</span>
              <Typography.Text className={styles.answerTurnText}>
                {turn.question}
              </Typography.Text>
            </div>
            <AnswerSegment
              target={turn}
              reduceMotion={reduceMotion}
              clarifyInteractive={turnInteractive && turnNeedsClarify}
              promptsInteractive={turnInteractive && !turnNeedsClarify}
              onClarifySubmit={onClarifySubmit}
              onRecommendSubmit={onRecommendSubmit}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function ChatPage({ agentKey }: ChatPageProps) {
  const scene = agentKey ? getAgent(agentKey) : null;
  const sessionKey = agentKey ?? 'general';
  const displayName = scene ? `${CHAT_UI.name} · ${scene.label}` : CHAT_UI.name;
  const location = useLocation();
  const sessionIdRef = useRef(resolveSessionId(sessionKey, location.search));

  // Mock 联调：URL `?sid=1|2` 变化时同步 sessionId（不影响其它逻辑）
  useEffect(() => {
    sessionIdRef.current = resolveSessionId(sessionKey, location.search);
  }, [location.search, sessionKey]);
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  /** Per-message like / dislike (frontend only, not persisted). */
  const [feedbackById, setFeedbackById] = useState<
    Record<string, MessageFeedback | undefined>
  >({});

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: `intro-${sessionKey}`,
      role: 'assistant',
      content: isSceneMockAgentKey(agentKey)
        ? sceneIntroCopy(agentKey)
        : scene
          ? `当前场景：${scene.label}。${CHAT_UI.greeting}`
          : CHAT_UI.greeting,
      status: 'success',
      kind: 'intro',
    },
  ]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const requestRef = useRef<ChatStreamController | null>(null);
  const bubbleListRef = useRef<ComponentRef<typeof Bubble.List>>(null);
  const activeAnswerRef = useRef<string | null>(null);
  const activeTurnRef = useRef<string | null>(null);
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
    const activeTurnId = activeTurnRef.current;
    activeAnswerRef.current = null;
    activeTurnRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    setRequesting(false);

    if (activeAnswerId) {
      setMessages((current) =>
        updateActiveTarget(current, activeAnswerId, activeTurnId, (target) => ({
          ...target,
          status: 'abort',
          content: target.content || '已停止生成。',
          thoughtState: stopThoughtState(target.thoughtState, 'abort'),
        })),
      );
    }
  }, [setRequesting]);

  const beginStream = useCallback(
    (answerId: string, turnId: string | null, question: string) => {
      setRequesting(true);
      activeAnswerRef.current = answerId;
      activeTurnRef.current = turnId;
      shouldFollowOutputRef.current = true;

      const isActiveTarget = () =>
        activeAnswerRef.current === answerId &&
        activeTurnRef.current === turnId;

      const patchTarget = (
        updater: (target: ChatMessage | AnswerTurn) => ChatMessage | AnswerTurn,
      ) => {
        setMessages((current) =>
          updateActiveTarget(current, answerId, turnId, updater),
        );
      };

      if (isSceneMockAgentKey(agentKey)) {
        requestRef.current = startSceneMockStream(
          {
            agentKey,
            message: question,
          },
          {
            onMeta: ({ fields }) => {
              if (!isActiveTarget() || !fields?.length) {
                return;
              }
              patchTarget((target) => ({ ...target, displayFields: fields }));
            },
            onNodeStart: (event) => {
              if (
                !isActiveTarget() ||
                (event.node !== 'intent_classify' &&
                  event.node !== 'followup_check' &&
                  event.node !== 'clarify' &&
                  event.node !== 'retrieval')
              ) {
                return;
              }
              patchTarget((target) => ({
                ...target,
                thoughtState: updateThoughtNode(
                  target.thoughtState,
                  event,
                  'start',
                ),
                status: 'updating',
              }));
            },
            onNodeEnd: (event) => {
              if (
                !isActiveTarget() ||
                (event.node !== 'intent_classify' &&
                  event.node !== 'followup_check' &&
                  event.node !== 'clarify' &&
                  event.node !== 'retrieval')
              ) {
                return;
              }
              patchTarget((target) => ({
                ...target,
                thoughtState: updateThoughtNode(
                  target.thoughtState,
                  event,
                  'end',
                ),
                status: 'updating',
              }));
            },
            onSuggestedQuestions: (questions) => {
              if (!isActiveTarget() || !questions.length) {
                return;
              }
              patchTarget((target) => ({
                ...target,
                thoughtState: applySuggestedQuestions(
                  target.thoughtState,
                  questions,
                ),
                status: 'updating',
              }));
            },
            onToken: (content) => {
              if (!isActiveTarget()) {
                return;
              }
              patchTarget((target) => ({
                ...target,
                thinkContent: `${target.thinkContent ?? ''}${content}`,
                thoughtState: activateReasoning(target.thoughtState),
                status: 'updating',
              }));
            },
            onRelatedEntries: (payload) => {
              if (!isActiveTarget()) {
                return;
              }
              patchTarget((target) => ({
                ...target,
                relatedEntries: payload,
                thoughtState: activateReasoning(target.thoughtState),
                displayFields: payload.fields.length
                  ? payload.fields
                  : target.displayFields,
                status: 'updating',
              }));
            },
            onSearchPreview: (preview) => {
              if (!isActiveTarget()) {
                return;
              }
              patchTarget((target) => ({
                ...target,
                searchPreview: preview,
                thoughtState: activateReasoning(target.thoughtState),
                status: 'updating',
              }));
            },
            onSceneResult: (result) => {
              if (!isActiveTarget()) {
                return;
              }
              patchTarget((target) => ({
                ...target,
                sceneResult: result,
                relatedEntries:
                  result.kind === 'research_direction'
                    ? result.experts
                    : target.relatedEntries,
                displayFields:
                  result.kind === 'research_direction'
                    ? result.experts.fields
                    : target.displayFields,
                thoughtState: activateReasoning(target.thoughtState),
                status: 'updating',
              }));
            },
            onComplete: () => {
              if (!isActiveTarget()) {
                return;
              }

              activeAnswerRef.current = null;
              activeTurnRef.current = null;
              requestRef.current = null;
              setRequesting(false);
              sessionStorage.removeItem(pendingStorageKey(sessionKey));
              setMessages((current) =>
                updateActiveTarget(current, answerId, turnId, finalizeStreamTarget),
              );
            },
            onError: (error) => {
              if (!isActiveTarget()) {
                return;
              }

              activeAnswerRef.current = null;
              activeTurnRef.current = null;
              requestRef.current = null;
              setRequesting(false);
              if (error.name !== 'AbortError') {
                sessionStorage.removeItem(pendingStorageKey(sessionKey));
              }
              const fallbackMessage =
                error.name === 'AbortError'
                  ? '已停止生成。'
                  : error.message?.trim() || GENERIC_STREAM_ERROR_MESSAGE;
              setMessages((current) =>
                updateActiveTarget(current, answerId, turnId, (target) => ({
                  ...target,
                  status: error.name === 'AbortError' ? 'abort' : 'error',
                  thoughtState: stopThoughtState(
                    target.thoughtState,
                    error.name === 'AbortError' ? 'abort' : 'error',
                  ),
                  content:
                    error.name === 'AbortError'
                      ? target.content || fallbackMessage
                      : fallbackMessage,
                })),
              );
            },
          },
        );
        return;
      }

      requestRef.current = startChatStream(
        {
          agentKey,
          message: question,
          sessionId: sessionIdRef.current,
        },
        {
          onMeta: ({ fields }) => {
            if (!isActiveTarget() || !fields?.length) {
              return;
            }
            patchTarget((target) => ({ ...target, displayFields: fields }));
          },
          onNodeStart: (event) => {
            if (
              !isActiveTarget() ||
              (event.node !== 'intent_classify' &&
                event.node !== 'followup_check' &&
                event.node !== 'clarify' &&
                event.node !== 'retrieval')
            ) {
              return;
            }
            patchTarget((target) => ({
              ...target,
              thoughtState: updateThoughtNode(
                target.thoughtState,
                event,
                'start',
              ),
              status: 'updating',
            }));
          },
          onNodeEnd: (event) => {
            if (
              !isActiveTarget() ||
              (event.node !== 'intent_classify' &&
                event.node !== 'followup_check' &&
                event.node !== 'clarify' &&
                event.node !== 'retrieval')
            ) {
              return;
            }
            patchTarget((target) => ({
              ...target,
              thoughtState: updateThoughtNode(
                target.thoughtState,
                event,
                'end',
              ),
              status: 'updating',
            }));
          },
          onClarify: (payload: ClarificationPayload) => {
            if (!isActiveTarget()) {
              return;
            }
            patchTarget((target) => ({
              ...target,
              thoughtState: requestClarification(
                target.thoughtState,
                payload.question,
                payload.suggestedQuestions,
              ),
              status: 'updating',
            }));
          },
          onSuggestedQuestions: (questions) => {
            if (!isActiveTarget() || !questions.length) {
              return;
            }
            patchTarget((target) => ({
              ...target,
              thoughtState: applySuggestedQuestions(
                target.thoughtState,
                questions,
              ),
              status: 'updating',
            }));
          },
          onToken: (content) => {
            if (!isActiveTarget()) {
              return;
            }
            patchTarget((target) => ({
              ...target,
              thinkContent: `${target.thinkContent ?? ''}${content}`,
              thoughtState: activateReasoning(target.thoughtState),
              status: 'updating',
            }));
          },
          onRelatedEntries: (payload) => {
            if (!isActiveTarget()) {
              return;
            }
            patchTarget((target) => ({
              ...target,
              relatedEntries: payload,
              thoughtState: activateReasoning(target.thoughtState),
              displayFields: payload.fields.length
                ? payload.fields
                : target.displayFields,
              status: 'updating',
            }));
          },
          onComplete: () => {
            if (!isActiveTarget()) {
              return;
            }

            activeAnswerRef.current = null;
            activeTurnRef.current = null;
            requestRef.current = null;
            setRequesting(false);
            sessionStorage.removeItem(pendingStorageKey(sessionKey));
            setMessages((current) =>
              updateActiveTarget(current, answerId, turnId, finalizeStreamTarget),
            );
          },
          onError: (error) => {
            if (!isActiveTarget()) {
              return;
            }

            activeAnswerRef.current = null;
            activeTurnRef.current = null;
            requestRef.current = null;
            setRequesting(false);
            if (error.name !== 'AbortError') {
              sessionStorage.removeItem(pendingStorageKey(sessionKey));
            }
            const fallbackMessage =
              error.name === 'AbortError'
                ? '已停止生成。'
                : error.message?.trim() || GENERIC_STREAM_ERROR_MESSAGE;
            setMessages((current) =>
              updateActiveTarget(current, answerId, turnId, (target) => ({
                ...target,
                status: error.name === 'AbortError' ? 'abort' : 'error',
                thoughtState: stopThoughtState(
                  target.thoughtState,
                  error.name === 'AbortError' ? 'abort' : 'error',
                ),
                content:
                  error.name === 'AbortError'
                    ? target.content || fallbackMessage
                    : fallbackMessage,
              })),
            );
          },
        },
      );
    },
    [agentKey, sessionKey, setRequesting],
  );

  const submit = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || isRequestingRef.current || activeAnswerRef.current) {
        return false;
      }

      const userId = nextMessageId('user');
      const answerId = nextMessageId('assistant');

      setValue('');
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
          turns: [],
        },
      ]);
      beginStream(answerId, null, question);
      return true;
    },
    [beginStream, nextMessageId],
  );

  /**
   * Continue inside the current assistant bubble instead of opening a new pair.
   * Used by clarify panel / recommended-question chips.
   */
  const submitInline = useCallback(
    (answerId: string, rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || isRequestingRef.current || activeAnswerRef.current) {
        return false;
      }

      const target = messagesRef.current.find(
        (message) => message.id === answerId && message.kind === 'answer',
      );
      if (!target) {
        return false;
      }

      const turnId = nextMessageId('turn');
      setMessages((current) =>
        current.map((message) =>
          message.id === answerId
            ? {
                ...message,
                turns: [
                  ...(message.turns ?? []),
                  createAnswerTurn(turnId, question),
                ],
              }
            : message,
        ),
      );
      beginStream(answerId, turnId, question);
      return true;
    },
    [beginStream, nextMessageId],
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
      activeTurnRef.current = null;
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
        rootClassName: styles.assistantBubble,
        classNames: {
          body: styles.assistantBubbleBody,
          content: styles.assistantBubbleContent,
        },
        contentRender: (_content, info) => {
          const kind = info.extraInfo?.kind;
          const message = info.extraInfo?.message as ChatMessage | undefined;

          if (kind === 'answer' && message) {
            const turns = message.turns ?? [];
            const latestTarget =
              turns.length > 0 ? turns[turns.length - 1]! : message;
            const latestDone =
              latestTarget.status === 'success' ||
              latestTarget.status === 'error' ||
              latestTarget.status === 'abort';
            const interactive =
              !isRequesting &&
              message.id === latestAnswerId &&
              latestDone;

            return (
              <AnswerBody
                message={message}
                reduceMotion={reduceMotion}
                interactive={interactive}
                onClarifySubmit={(text) => submitInline(message.id, text)}
                onRecommendSubmit={submit}
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
    [isRequesting, latestAnswerId, reduceMotion, submit, submitInline],
  );

  const bubbleItems: BubbleItemType[] = useMemo(
    () =>
      messages.map((message) => {
        const isIntro = message.kind === 'intro';
        const turns = message.turns ?? [];
        const latestTarget =
          message.kind === 'answer' && turns.length > 0
            ? turns[turns.length - 1]!
            : message;
        const isCompletedAnswer =
          message.kind === 'answer' && latestTarget.status === 'success';
        const isStreamingAnswer =
          message.kind === 'answer' &&
          (latestTarget.status === 'loading' ||
            latestTarget.status === 'updating');

        const copyParts: string[] = [];
        const collectCopy = (target: ChatMessage | AnswerTurn, question?: string) => {
          if (question) {
            copyParts.push(`补充：${question}`);
          }
          if (target.thinkContent) {
            copyParts.push(target.thinkContent);
          }
          if (target.thoughtState?.clarity.clarifyQuestion) {
            copyParts.push(target.thoughtState.clarity.clarifyQuestion);
          }
          if (target.searchPreview) {
            copyParts.push(
              [
                '搜索引擎结果',
                `检索词：${target.searchPreview.query}`,
                ...target.searchPreview.results.map(
                  (item, index) =>
                    [
                      `${index + 1}. ${item.title}`,
                      item.source,
                      item.snippet,
                      item.url,
                    ].join('\n'),
                ),
              ].join('\n'),
            );
          }
          if (target.sceneResult) {
            const scene = target.sceneResult;
            if (scene.kind === 'policy_recommend') {
              const formatProvincial = (
                item: (typeof scene.fullyMatched.provincial)[number],
              ) =>
                [
                  `事项名称: ${item.item_name}`,
                  `级别: ${item.level}`,
                  `资助金额: ${item.funding_amount}`,
                  `事项类别介绍: ${item.item_category_description}`,
                  `项目介绍: ${item.project_description}`,
                  `申报要求: ${item.application_requirements}`,
                  `申报途径: ${item.application_channel}`,
                  `申报网址: ${item.application_url}`,
                  `相关政策文件名称: ${item.related_policy_document_name}`,
                ].join('\n');
              const formatMunicipal = (
                item: (typeof scene.fullyMatched.municipal)[number],
              ) =>
                [
                  `政策类别: ${item.policy_category}`,
                  `支持区域: ${item.supported_region}`,
                  `支持对象: ${item.supported_entities}`,
                  `支持内容: ${item.support_content}`,
                  `来源文件: ${item.source_document || '—'}`,
                ].join('\n');
              const formatGroup = (
                label: string,
                group: typeof scene.fullyMatched,
              ) => {
                const parts = [label];
                if (group.provincial.length) {
                  parts.push(
                    '省级政策',
                    ...group.provincial.map(formatProvincial),
                  );
                }
                if (group.municipal.length) {
                  parts.push(
                    '市级政策',
                    ...group.municipal.map(formatMunicipal),
                  );
                }
                if (!group.provincial.length && !group.municipal.length) {
                  parts.push('（暂无）');
                }
                return parts.join('\n\n');
              };
              copyParts.push(
                [
                  formatGroup('完全满足政策', scene.fullyMatched),
                  formatGroup('部分满足政策', scene.partiallyMatched),
                ].join('\n\n'),
              );
            } else if (scene.kind === 'achievement_eval') {
              copyParts.push(
                scene.evaluations
                  .map((item) =>
                    [
                      `评估对象: ${item.title}`,
                      `总得分: ${item.total}/${item.maxTotal}`,
                      '一、评分总结',
                      '评分维度',
                      ...item.dimensions.flatMap((dim) => [
                        `${dim.label}: ${dim.score}/${dim.max}`,
                        `亮点: ${dim.highlight}`,
                        `不足: ${dim.weakness}`,
                      ]),
                      '推荐原因',
                      item.reason,
                    ].join('\n'),
                  )
                  .join('\n\n'),
              );
            } else {
              copyParts.push(
                [
                  '推荐理由',
                  scene.recommendReason,
                  '研发方向总结',
                  scene.summary,
                ].join('\n'),
              );
            }
          }
          if (target.relatedEntries) {
            const related = target.relatedEntries;
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
            copyParts.push(
              sections
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
                .join('\n\n'),
            );
          }
          if (target.content) {
            copyParts.push(target.content);
          }
        };

        if (message.kind === 'answer') {
          collectCopy(message);
          for (const turn of turns) {
            collectCopy(turn, turn.question);
          }
        } else if (message.content) {
          copyParts.push(message.content);
        }

        const copyText = copyParts.filter(Boolean).join('\n\n');

        const baseItem: BubbleItemType = {
          key: message.id,
          role: message.role,
          content: message.content,
          status: latestTarget.status,
          loading: false,
          streaming: isStreamingAnswer,
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

        const feedback = feedbackById[message.id];

        return {
          ...baseItem,
          footer: isCompletedAnswer ? (
            <Actions
              variant="borderless"
              fadeIn
              items={[
                {
                  key: 'retry',
                  label: '重新生成',
                  icon: <RedoOutlined aria-label="重新生成" />,
                },
                {
                  key: 'copy',
                  actionRender: (
                    <Actions.Copy text={copyText} aria-label="复制回答" />
                  ),
                },
                {
                  key: 'like',
                  label: '点赞',
                  icon:
                    feedback === 'like' ? (
                      <LikeFilled
                        className={styles.feedbackLiked}
                        aria-label="已点赞"
                      />
                    ) : (
                      <LikeOutlined aria-label="点赞" />
                    ),
                },
                {
                  key: 'dislike',
                  label: '点踩',
                  icon:
                    feedback === 'dislike' ? (
                      <DislikeFilled
                        className={styles.feedbackDisliked}
                        aria-label="已点踩"
                      />
                    ) : (
                      <DislikeOutlined aria-label="点踩" />
                    ),
                },
              ]}
              onClick={({ key }) => {
                if (key === 'retry' && message.sourceQuestion) {
                  submit(message.sourceQuestion);
                  return;
                }
                if (key === 'like') {
                  setFeedbackById((prev) => ({
                    ...prev,
                    [message.id]:
                      prev[message.id] === 'like' ? undefined : 'like',
                  }));
                  return;
                }
                if (key === 'dislike') {
                  setFeedbackById((prev) => ({
                    ...prev,
                    [message.id]:
                      prev[message.id] === 'dislike' ? undefined : 'dislike',
                  }));
                }
              }}
            />
          ) : undefined,
        };
      }),
    [displayName, feedbackById, messages, submit],
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
            placeholder={
              isSceneMockAgentKey(agentKey)
                ? scenePlaceholder(agentKey)
                : CHAT_UI.placeholder
            }
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
