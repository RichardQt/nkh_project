import type {
  KgGraphData,
  KgQueryRequest,
  KgQueryResponse,
} from '../types/kg';

export class KgQueryError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'KgQueryError';
    this.status = status;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseGraphData(raw: unknown): KgGraphData | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const categories = Array.isArray(record.categories)
    ? record.categories
        .map((item) => {
          const c = asRecord(item);
          if (!c || typeof c.name !== 'string') {
            return null;
          }
          return {
            name: c.name,
            color: typeof c.color === 'string' ? c.color : '#64748b',
          };
        })
        .filter((c): c is { name: string; color: string } => c !== null)
    : [];

  const nodes = Array.isArray(record.nodes)
    ? record.nodes
        .map((item) => {
          const n = asRecord(item);
          if (!n) {
            return null;
          }
          const id =
            typeof n.id === 'string'
              ? n.id
              : typeof n.name === 'string'
                ? n.name
                : '';
          if (!id) {
            return null;
          }
          const detail = asRecord(n.detail);
          const properties = asRecord(detail?.properties);
          return {
            id,
            name: typeof n.name === 'string' ? n.name : id,
            category: typeof n.category === 'string' ? n.category : '',
            type: typeof n.type === 'string' ? n.type : undefined,
            value: typeof n.value === 'number' ? n.value : undefined,
            symbolSize:
              typeof n.symbolSize === 'number' ? n.symbolSize : undefined,
            description:
              typeof n.description === 'string' ? n.description : undefined,
            detail: properties
              ? {
                  properties: properties as Record<
                    string,
                    string | number | boolean | null | undefined
                  >,
                }
              : detail
                ? { properties: {} }
                : undefined,
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null)
    : [];

  const links = Array.isArray(record.links)
    ? record.links
        .map((item) => {
          const l = asRecord(item);
          if (!l) {
            return null;
          }
          const source =
            typeof l.source === 'string'
              ? l.source
              : l.source != null
                ? String(l.source)
                : '';
          const target =
            typeof l.target === 'string'
              ? l.target
              : l.target != null
                ? String(l.target)
                : '';
          if (!source || !target) {
            return null;
          }
          return {
            source,
            target,
            value: typeof l.value === 'string' ? l.value : undefined,
            category: typeof l.category === 'string' ? l.category : undefined,
            description:
              typeof l.description === 'string' ? l.description : undefined,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null)
    : [];

  const summary = asRecord(record.summary);

  return {
    knowledge_name:
      typeof record.knowledge_name === 'string'
        ? record.knowledge_name
        : undefined,
    source: typeof record.source === 'string' ? record.source : undefined,
    is_demo: typeof record.is_demo === 'boolean' ? record.is_demo : undefined,
    generated_at:
      typeof record.generated_at === 'string'
        ? record.generated_at
        : undefined,
    center_node_id:
      typeof record.center_node_id === 'string'
        ? record.center_node_id
        : undefined,
    summary: summary
      ? {
          node_count:
            typeof summary.node_count === 'number'
              ? summary.node_count
              : undefined,
          link_count:
            typeof summary.link_count === 'number'
              ? summary.link_count
              : undefined,
          document_count:
            typeof summary.document_count === 'number'
              ? summary.document_count
              : undefined,
          paragraph_count:
            typeof summary.paragraph_count === 'number'
              ? summary.paragraph_count
              : undefined,
          question_count:
            typeof summary.question_count === 'number'
              ? summary.question_count
              : undefined,
          entity_count:
            typeof summary.entity_count === 'number'
              ? summary.entity_count
              : undefined,
        }
      : undefined,
    categories,
    nodes,
    links,
  };
}

/**
 * Query knowledge graph subgraph.
 * `hop` is always `"1"` and `uuid` is always `""` per product contract.
 */
export async function queryKnowledgeGraph(
  entityType: string,
  vid: string,
  signal?: AbortSignal,
): Promise<KgGraphData> {
  const body: KgQueryRequest = {
    entity_type: entityType,
    vid,
    hop: '1',
    uuid: '',
  };

  let response: Response;
  try {
    response = await fetch('/api/kg/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new KgQueryError('知识图谱服务暂时不可用，请稍后重试');
  }

  let payload: KgQueryResponse | null = null;
  try {
    payload = (await response.json()) as KgQueryResponse;
  } catch {
    throw new KgQueryError(
      response.ok ? '知识图谱返回数据无法解析' : `知识图谱请求失败（${response.status}）`,
      response.status,
    );
  }

  if (!response.ok) {
    const msg =
      typeof payload?.message === 'string' && payload.message
        ? payload.message
        : `知识图谱请求失败（${response.status}）`;
    throw new KgQueryError(msg, response.status);
  }

  if (typeof payload?.code === 'number' && payload.code !== 200) {
    throw new KgQueryError(
      payload.message || `知识图谱查询失败（code=${payload.code}）`,
      payload.code,
    );
  }

  const data = parseGraphData(payload?.data);
  if (!data) {
    throw new KgQueryError(payload?.message || '知识图谱无数据返回');
  }

  return data;
}
