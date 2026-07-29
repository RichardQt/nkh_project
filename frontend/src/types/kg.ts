/** Knowledge-graph query request (POST /api/kg/query). */
export interface KgQueryRequest {
  entity_type: string;
  vid: string;
  /** Always `"1"`. */
  hop: '1';
  /** Always empty. */
  uuid: '';
}

export interface KgCategory {
  name: string;
  color: string;
}

export interface KgNodeDetail {
  properties?: Record<string, string | number | boolean | null | undefined>;
}

export interface KgNode {
  id: string;
  name: string;
  category: string;
  type?: string;
  value?: number;
  symbolSize?: number;
  description?: string;
  detail?: KgNodeDetail;
}

export interface KgLink {
  source: string;
  target: string;
  value?: string;
  category?: string;
  description?: string;
}

export interface KgSummary {
  node_count?: number;
  link_count?: number;
  document_count?: number;
  paragraph_count?: number;
  question_count?: number;
  entity_count?: number;
}

/** `data` payload from `/api/kg/query`. */
export interface KgGraphData {
  knowledge_name?: string;
  source?: string;
  is_demo?: boolean;
  generated_at?: string;
  center_node_id?: string;
  summary?: KgSummary;
  categories: KgCategory[];
  nodes: KgNode[];
  links: KgLink[];
}

export interface KgQueryResponse {
  message?: string;
  code?: number;
  data?: KgGraphData | null;
}

/** Resolved target used to open the knowledge-graph modal. */
export interface KgQueryTarget {
  entityType: string;
  vid: string;
  /** Optional label for modal title (field label + display text). */
  label?: string;
}
