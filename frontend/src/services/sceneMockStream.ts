import {
  ACHIEVEMENT_EVAL_THINKING,
  buildAchievementEvalResult,
  buildSceneResult,
  buildSearchResults,
  PLACEHOLDER,
  POLICY_RECOMMEND_THINKING,
  RESEARCH_DIRECTION_THINKING,
  splitThinkingTokens,
} from '../data/sceneMocks';

import type {
  SceneMockAgentKey,
  SceneResult,
  SearchPreviewState,
} from '../types/scene';
import type {
  ChatStreamCallbacks,
  ChatStreamController,
} from './chatStream';
import type { WorkflowNodeEvent } from '../types/chat';

/** Mock-driven scenes, including demo keyword paths. */
export type SceneMockStreamAgentKey =
  | SceneMockAgentKey
  | 'achievement_eval'
  | 'policy_recommend';

export interface SceneMockStreamCallbacks extends ChatStreamCallbacks {
  onSearchPreview?: (preview: SearchPreviewState) => void;
  onSceneResult?: (result: SceneResult) => void;
}

interface SceneMockStreamInput {
  agentKey: SceneMockStreamAgentKey;
  message: string;
}
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function intentForAgent(agentKey: SceneMockStreamAgentKey): string {
  // Intent follows the frontend scene entry, not the downstream list template.
  if (agentKey === 'policy_recommend') {
    return 'policies';
  }
  if (agentKey === 'achievement_eval') {
    return 'achievement_eval';
  }
  return 'research_direction';
}

function optimizedQueryFor(
  agentKey: SceneMockStreamAgentKey,
  message: string,
): string {
  const base = message.trim() || PLACEHOLDER;
  if (agentKey === 'policy_recommend') {
    return `${base} 政策 申报`;
  }
  if (agentKey === 'achievement_eval') {
    return "单晶金刚石、金刚石籽晶、钼衬底、同质外延、MWCVD";
  }
  return `${base} 研发方向 专家团队 智慧医疗`;
}

function thinkTokens(agentKey: SceneMockStreamAgentKey): string[] {
  if (agentKey === 'policy_recommend') {
    return splitThinkingTokens(POLICY_RECOMMEND_THINKING);
  }
  if (agentKey === 'achievement_eval') {
    return splitThinkingTokens(ACHIEVEMENT_EVAL_THINKING);
  }
  return splitThinkingTokens(RESEARCH_DIRECTION_THINKING);
}

function suggestedFor(agentKey: SceneMockStreamAgentKey): string[] {
  if (agentKey === 'policy_recommend') {
    return [
      '还有哪些完全满足的省级政策？',
      '市级补贴类政策的申报材料有哪些？',
    ];
  }
  if (agentKey === 'achievement_eval') {
    return [
      '如何提升该成果的成熟度得分？',
      '中试验证应优先突破哪些工程化瓶颈？',
    ];
  }
  return [
    '这些专家还能对接哪些企业需求？',
    '研发方向如何拆成阶段目标？',
  ];
}

/**
 * No-data stream: runs the full thought-chain, then surfaces a "no data"
 * message. Does not stream scene-specific mock thinking tokens.
 */
export function startNoDataStream(
  input: SceneMockStreamInput,
  callbacks: Pick<
    SceneMockStreamCallbacks,
    'onNodeStart' | 'onNodeEnd' | 'onToken' | 'onComplete' | 'onError'
  > & { onNoData: (msg: string) => void },
): ChatStreamController {
  const controller = new AbortController();
  const { agentKey } = input;
  const intent = intentForAgent(agentKey);
  const optimizedQuery = optimizedQueryFor(agentKey, input.message);

  void (async () => {
    try {
      const emitStart = async (node: string) => {
        callbacks.onNodeStart?.({ node });
        await wait(320, controller.signal);
      };
      const emitEnd = async (
        node: string,
        extra: Partial<WorkflowNodeEvent> = {},
      ) => {
        callbacks.onNodeEnd?.({
          node,
          intent,
          categories: [intent],
          needClarify: false,
          optimizedQuery:
            node === 'retrieval' || node === 'generate'
              ? optimizedQuery
              : undefined,
          ...extra,
        });
        await wait(420, controller.signal);
      };

      await emitStart('intent_classify');
      await emitEnd('intent_classify');

      await emitStart('followup_check');
      await emitEnd('followup_check', { needClarify: false });

      await emitStart('clarify');
      await emitEnd('clarify', { needClarify: false });

      await emitStart('retrieval');
      await emitEnd('retrieval', { needClarify: false, optimizedQuery });

      await emitStart('generate');
      await emitEnd('generate', { needClarify: false, optimizedQuery });

      // Brief "reasoning" pulse so the thought chain shows 深度思考, without
      // leaking the hit-path mock thinking copy into the answer area.
      callbacks.onToken('');
      await wait(650, controller.signal);

      callbacks.onNoData(
        '当前数据库暂无包含此内容的相关信息，待管理员补充数据后再试。',
      );
      await wait(280, controller.signal);
      callbacks.onComplete();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        callbacks.onError(error);
        return;
      }
      callbacks.onError(
        error instanceof Error ? error : new Error('场景演示生成失败'),
      );
    }
  })();

  return { abort: () => controller.abort() };
}

/**
 * Local fake SSE for policy / eval / research scenes.
 * Event order mirrors backend/test/mock_sse_fixed.py normal flow:
 * node_start/end (intent → followup → clarify → retrieval → generate)
 * → token* → (search preview) → scene result / related_entries → suggested_questions
 */
export function startSceneMockStream(
  input: SceneMockStreamInput,
  callbacks: SceneMockStreamCallbacks,
): ChatStreamController {
  const controller = new AbortController();
  const { agentKey, message } = input;
  const intent = intentForAgent(agentKey);
  const optimizedQuery = optimizedQueryFor(agentKey, message);
  const needsSearch =
    agentKey === 'achievement_eval' || agentKey === 'research_direction';

  void (async () => {
    try {
      const emitStart = async (node: string) => {
        callbacks.onNodeStart?.({ node });
        await wait(320, controller.signal);
      };

      const emitEnd = async (
        node: string,
        extra: Partial<WorkflowNodeEvent> = {},
      ) => {
        callbacks.onNodeEnd?.({
          node,
          intent,
          categories: [intent],
          needClarify: false,
          optimizedQuery:
            node === 'retrieval' || node === 'generate'
              ? optimizedQuery
              : undefined,
          ...extra,
        });
        await wait(420, controller.signal);
      };

      // Same workflow skeleton as mock_sse_fixed._build_normal_frames
      await emitStart('intent_classify');
      await emitEnd('intent_classify');

      await emitStart('followup_check');
      await emitEnd('followup_check', { needClarify: false });

      await emitStart('clarify');
      await emitEnd('clarify', { needClarify: false });

      await emitStart('retrieval');
      await emitEnd('retrieval', {
        needClarify: false,
        optimizedQuery,
      });

      await emitStart('generate');
      await emitEnd('generate', {
        needClarify: false,
        optimizedQuery,
      });

      for (const token of thinkTokens(agentKey)) {
        callbacks.onToken(token);
        await wait(
          agentKey === 'research_direction' ? 95 : 110,
          controller.signal,
        );
      }

      // Pause after thinking before surface results
      await wait(450, controller.signal);

      if (needsSearch) {
        const search = buildSearchResults(agentKey, message);
        callbacks.onSearchPreview?.({
          query: search.query,
          status: 'loading',
          results: [],
        });
        await wait(1100, controller.signal);
        callbacks.onSearchPreview?.({
          query: search.query,
          status: 'success',
          results: search.results,
        });
        await wait(700, controller.signal);
      }

      const result =
        agentKey === 'achievement_eval'
          ? buildAchievementEvalResult(message)
          : buildSceneResult(agentKey, message);

      if (result.kind === 'research_direction') {
        // First surface experts + empty summary shell, then type the summary.
        callbacks.onSceneResult?.({
          ...result,
          summary: '',
        });
        await wait(500, controller.signal);
        callbacks.onMeta?.({
          function: 'expert_team',
          fields: result.experts.fields,
        });
        callbacks.onRelatedEntries(result.experts);
        await wait(550, controller.signal);

        let summary = '';
        for (const token of splitThinkingTokens(result.summary)) {
          summary += token;
          callbacks.onSceneResult?.({
            ...result,
            summary,
          });
          await wait(72, controller.signal);
        }
        // Ensure final full text is committed.
        callbacks.onSceneResult?.(result);
      } else {
        callbacks.onSceneResult?.(result);
      }

      await wait(650, controller.signal);
      callbacks.onSuggestedQuestions?.(suggestedFor(agentKey));
      await wait(280, controller.signal);
      callbacks.onComplete();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        callbacks.onError(error);
        return;
      }
      callbacks.onError(
        error instanceof Error ? error : new Error('场景演示生成失败'),
      );
    }
  })();

  return {
    abort: () => controller.abort(),
  };
}
