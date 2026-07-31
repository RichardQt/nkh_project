import type { AgentKey } from '../types/agent';
import type {
  ClarificationPayload,
  DisplayField,
  RelatedEntriesPayload,
  RelatedEntryRow,
  WorkflowNodeEvent,
} from '../types/chat';
import { authHeaders, notifyAuthExpired } from './http';

/** null / undefined / 'general' = home brand mode, no specialist scene. */
export type ChatAgentKey = AgentKey | 'general' | null | undefined;

export const GENERIC_STREAM_ERROR_MESSAGE = '系统响应超时，请稍后重试。';

interface ChatStreamInput {
  agentKey?: ChatAgentKey;
  message: string;
  sessionId: string;
  /** Optional chat model id, e.g. DeepSeek-V4 / Qwen3.6-35B */
  model?: string | null;
}

export interface ChatStreamCallbacks {
  onMeta?: (meta: { sessionId?: string; function?: string; fields?: DisplayField[] }) => void;
  onNodeStart?: (event: WorkflowNodeEvent) => void;
  onNodeEnd?: (event: WorkflowNodeEvent) => void;
  onClarify?: (payload: ClarificationPayload) => void;
  /** Standalone recommended questions (event: suggested_questions). */
  onSuggestedQuestions?: (questions: string[]) => void;
  onToken: (content: string) => void;
  onRelatedEntries: (payload: RelatedEntriesPayload) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export interface ChatStreamController {
  abort: () => void;
}

function parseSseChunk(raw: string): { event: string; data: string } | null {
  const lines = raw.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join('\n') };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseFields(raw: unknown): DisplayField[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const fields: DisplayField[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) {
      continue;
    }
    const key = typeof row.key === 'string' ? row.key : '';
    const label = typeof row.label === 'string' ? row.label : key;
    if (key) {
      fields.push({ key, label });
    }
  }
  return fields;
}

/** Known list/detail field labels when upstream omits fields metadata. */
const DOMAIN_LIST_FIELDS: Record<string, DisplayField[]> = {
  achievements: [
    { key: 'achievement_name', label: '成果名称' },
    { key: 'primary_technology_field', label: '技术领域一级' },
    { key: 'secondary_technology_field', label: '技术领域二级' },
    { key: 'technology_maturity', label: '技术成熟度' },
    { key: 'affiliated_university', label: '所属高校' },
    { key: 'score', label: '关联度' },
  ],
  expert_team: [
    { key: 'expert_team_name', label: '专家团队名称' },
    { key: 'team_leader', label: '团队负责人' },
    { key: 'expertise_areas', label: '擅长方向' },
    { key: 'primary_technology_field', label: '技术领域一级' },
    { key: 'secondary_technology_field', label: '技术领域二级' },
    { key: 'affiliated_university', label: '所属高校' },
    { key: 'publisher', label: '发布人' },
    { key: 'score', label: '关联度' },
  ],
  experts: [
    { key: 'expert_team_name', label: '专家团队名称' },
    { key: 'team_leader', label: '团队负责人' },
    { key: 'expertise_areas', label: '擅长方向' },
    { key: 'primary_technology_field', label: '技术领域一级' },
    { key: 'secondary_technology_field', label: '技术领域二级' },
    { key: 'affiliated_university', label: '所属高校' },
    { key: 'publisher', label: '发布人' },
    { key: 'score', label: '关联度' },
  ],
  requirements: [
    { key: 'requirement_name', label: '需求名称' },
    { key: 'requirement_type', label: '需求类型' },
    { key: 'cooperation_method', label: '合作方式' },
    { key: 'deadline', label: '截止日期' },
    { key: 'primary_technology_field', label: '技术领域一级' },
    { key: 'secondary_technology_field', label: '技术领域二级' },
    { key: 'affiliated_organization', label: '所属单位' },
    { key: 'region', label: '所属地区' },
    { key: 'intended_investment_10k_cny', label: '意向投入金额' },
    { key: 'score', label: '关联度' },
  ],
  demands: [
    { key: 'requirement_name', label: '需求名称' },
    { key: 'requirement_type', label: '需求类型' },
    { key: 'cooperation_method', label: '合作方式' },
    { key: 'deadline', label: '截止日期' },
    { key: 'primary_technology_field', label: '技术领域一级' },
    { key: 'secondary_technology_field', label: '技术领域二级' },
    { key: 'affiliated_organization', label: '所属单位' },
    { key: 'region', label: '所属地区' },
    { key: 'intended_investment_10k_cny', label: '意向投入金额' },
    { key: 'score', label: '关联度' },
  ],
  enterprises: [
    { key: 'company_name', label: '企业名称' },
    { key: 'industry_field', label: '产业领域' },
    { key: 'evaluation_grade', label: '评价等级' },
    { key: 'registered_capital', label: '注册资本' },
    { key: 'district', label: '所属区' },
    { key: 'score', label: '关联度' },
  ],
  policies: [
    { key: 'policy_name', label: '政策名称' },
    { key: 'policy_title', label: '政策标题' },
    { key: 'issuing_authority', label: '发布机关' },
    { key: 'publish_date', label: '发布日期' },
    { key: 'score', label: '关联度' },
  ],
  platforms: [
    { key: 'platform_name', label: '平台名称' },
    { key: 'center_name', label: '名称' },
    { key: 'equipment_name', label: '仪器设备名称' },
    { key: 'score', label: '关联度' },
  ],
};

const DOMAIN_DETAIL_FIELDS: Record<string, DisplayField[]> = {
  achievements: [
    { key: 'achievement_introduction', label: '成果简介' },
    { key: 'application_field', label: '应用领域' },
    { key: 'intellectual_property', label: '知识产权' },
    { key: 'contact_name', label: '联系人' },
    { key: 'contact_info', label: '联系方式' },
  ],
  expert_team: [
    { key: 'team_size', label: '团队人数' },
    { key: 'team_introduction', label: '团队介绍' },
    { key: 'representative_achievements', label: '代表性成果' },
  ],
  experts: [
    { key: 'team_size', label: '团队人数' },
    { key: 'team_introduction', label: '团队介绍' },
    { key: 'representative_achievements', label: '代表性成果' },
  ],
  requirements: [
    { key: 'requirement_description', label: '需求描述' },
    { key: 'existing_foundation', label: '现有基础' },
    { key: 'contact_name', label: '联系人' },
    { key: 'contact_info', label: '联系方式' },
    { key: 'rd_lead_name', label: '研发负责人' },
    { key: 'rd_lead_phone', label: '研发负责人电话' },
  ],
  demands: [
    { key: 'requirement_description', label: '需求描述' },
    { key: 'existing_foundation', label: '现有基础' },
    { key: 'contact_name', label: '联系人' },
    { key: 'contact_info', label: '联系方式' },
    { key: 'rd_lead_name', label: '研发负责人' },
    { key: 'rd_lead_phone', label: '研发负责人电话' },
  ],
  enterprises: [
    { key: 'company_introduction', label: '企业介绍' },
    { key: 'business_scope', label: '经营范围' },
    { key: 'legal_representative', label: '法定代表人' },
    { key: 'contact_info', label: '联系方式' },
  ],
  policies: [
    { key: 'policy_summary', label: '政策摘要' },
    { key: 'policy_content', label: '政策内容' },
  ],
  platforms: [
    { key: 'platform_introduction', label: '平台介绍' },
    { key: 'service_content', label: '服务内容' },
    { key: 'contact_name', label: '联系人' },
    { key: 'contact_phone', label: '联系电话' },
  ],
};

const TITLE_FIELD_KEYS = [
  'requirement_name',
  'achievement_name',
  'expert_team_name',
  'company_name',
  'enterprise_name',
  'policy_name',
  'policy_title',
  'platform_name',
  'center_name',
  'equipment_name',
  'name',
  'title',
] as const;

const HIDDEN_SYNTH_KEYS = new Set([
  'score',
  'serial_no',
  'id',
  'uuid',
  'vid',
  '_id',
]);

function presentKeys(items: RelatedEntryRow[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      keys.add(key);
    }
  }
  return keys;
}

function filterFieldsByPresent(
  catalog: DisplayField[],
  present: Set<string>,
): DisplayField[] {
  return catalog.filter((field) => present.has(field.key));
}

function synthesizeFieldsFromRows(items: RelatedEntryRow[]): DisplayField[] {
  const present = presentKeys(items);
  const ordered: DisplayField[] = [];
  for (const key of TITLE_FIELD_KEYS) {
    if (present.has(key)) {
      ordered.push({ key, label: key });
    }
  }
  for (const key of present) {
    if (HIDDEN_SYNTH_KEYS.has(key)) {
      continue;
    }
    if (ordered.some((field) => field.key === key)) {
      continue;
    }
    ordered.push({ key, label: key });
  }
  if (present.has('score')) {
    ordered.unshift({ key: 'score', label: '关联度' });
  }
  return ordered;
}

/** Normalize domain / list keys from upstream categories or aliases. */
function normalizeDomainKey(raw: string): string {
  const token = raw.trim().toLowerCase();
  if (!token) {
    return raw;
  }
  const aliases: Record<string, string> = {
    achievement: 'achievements',
    achievements: 'achievements',
    expert: 'expert_team',
    experts: 'expert_team',
    expert_team: 'expert_team',
    demand: 'requirements',
    demands: 'requirements',
    requirement: 'requirements',
    requirements: 'requirements',
    enterprise: 'enterprises',
    enterprises: 'enterprises',
    policy: 'policies',
    policies: 'policies',
    platform: 'platforms',
    platforms: 'platforms',
  };
  return aliases[token] ?? token;
}

function categoryHints(categories?: unknown): string[] {
  if (!Array.isArray(categories)) {
    return [];
  }
  return categories
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => normalizeDomainKey(value));
}

function resolveDomainKey(
  listKey: string,
  items: RelatedEntryRow[],
  categories?: unknown,
): string {
  const fromList =
    listKey && listKey !== 'items' && listKey !== 'entries' && listKey !== 'list'
      ? normalizeDomainKey(listKey)
      : '';
  if (fromList && (DOMAIN_LIST_FIELDS[fromList] || fromList !== listKey)) {
    return fromList;
  }

  for (const cat of categoryHints(categories)) {
    if (DOMAIN_LIST_FIELDS[cat] || DOMAIN_DETAIL_FIELDS[cat]) {
      return cat;
    }
  }

  const present = presentKeys(items);
  if (present.has('requirement_name') || present.has('requirement_type')) {
    return 'requirements';
  }
  if (present.has('achievement_name')) {
    return 'achievements';
  }
  if (
    present.has('expert_team_name') ||
    present.has('team_leader') ||
    present.has('expertise_areas')
  ) {
    return 'expert_team';
  }
  if (present.has('company_name') || present.has('enterprise_name')) {
    return 'enterprises';
  }
  if (present.has('policy_name') || present.has('policy_title')) {
    return 'policies';
  }
  if (
    present.has('platform_name') ||
    present.has('center_name') ||
    present.has('equipment_name')
  ) {
    return 'platforms';
  }
  return fromList || listKey || 'items';
}

function ensureDisplayFields(
  listKey: string,
  items: RelatedEntryRow[],
  fields: DisplayField[],
  detailFields: DisplayField[],
  categories?: unknown,
): {
  listKey: string;
  fields: DisplayField[];
  detailFields: DisplayField[];
} {
  if (!items.length) {
    return { listKey, fields, detailFields };
  }

  const domainKey = resolveDomainKey(listKey, items, categories);
  const present = presentKeys(items);

  let nextFields = fields;
  if (!nextFields.length) {
    const catalog = DOMAIN_LIST_FIELDS[domainKey];
    nextFields = catalog
      ? filterFieldsByPresent(catalog, present)
      : synthesizeFieldsFromRows(items);
    // Catalog miss or row shape drift: still show something usable
    if (!nextFields.length) {
      nextFields = synthesizeFieldsFromRows(items);
    }
  }

  let nextDetail = detailFields;
  if (!nextDetail.length) {
    const catalog = DOMAIN_DETAIL_FIELDS[domainKey];
    if (catalog) {
      nextDetail = filterFieldsByPresent(catalog, present);
    }
    if (!nextDetail.length) {
      const listKeys = new Set(nextFields.map((field) => field.key));
      nextDetail = [...present]
        .filter((key) => !listKeys.has(key) && !HIDDEN_SYNTH_KEYS.has(key))
        .map((key) => ({ key, label: key }));
    }
  }

  return {
    listKey: domainKey || listKey,
    fields: nextFields,
    detailFields: nextDetail,
  };
}

function parseWorkflowNodeEvent(data: string): WorkflowNodeEvent | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    const node = typeof record?.node === 'string' ? record.node.trim() : '';

    if (!record || !node) {
      return null;
    }

    const event: WorkflowNodeEvent = { node };

    if (typeof record.intent === 'string') {
      event.intent = record.intent;
    }
    if (Array.isArray(record.categories)) {
      event.categories = record.categories.filter(
        (category): category is string => typeof category === 'string',
      );
    }
    if (typeof record.need_clarify === 'boolean') {
      event.needClarify = record.need_clarify;
    }
    if (typeof record.clarify_question === 'string') {
      event.clarifyQuestion = record.clarify_question;
    }
    if (typeof record.clarify_stage === 'number') {
      event.clarifyStage = record.clarify_stage;
    }
    if (typeof record.is_followup === 'boolean') {
      event.isFollowup = record.is_followup;
    }
    if (typeof record.is_new_topic === 'boolean') {
      event.isNewTopic = record.is_new_topic;
    }
    if (typeof record.rag_count === 'number') {
      event.ragCount = record.rag_count;
    }
    if (typeof record.kg_count === 'number') {
      event.kgCount = record.kg_count;
    }
    if (typeof record.optimized_query === 'string') {
      event.optimizedQuery = record.optimized_query;
    }

    return event;
  } catch {
    return null;
  }
}

function normalizeSuggestedQuestions(raw: unknown): string[] {
  const items: string[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && item.trim()) {
        items.push(item.trim());
      }
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    for (const part of raw.replace(/，/g, ',').split(',')) {
      if (part.trim()) {
        items.push(part.trim());
      }
    }
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      ordered.push(item);
    }
  }
  return ordered;
}

function parseClarification(data: string): ClarificationPayload | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    if (!record) {
      return null;
    }

    const rawQuestion =
      typeof record.question === 'string'
        ? record.question
        : typeof record.clarify_question === 'string'
          ? record.clarify_question
          : '';
    const question = rawQuestion.trim();
    if (!question) {
      return null;
    }

    const rawSuggestions =
      record.suggested_questions ??
      record.suggestedQuestions ??
      record.questions;
    const suggestedQuestions = normalizeSuggestedQuestions(rawSuggestions);

    return { question, suggestedQuestions };
  } catch {
    return null;
  }
}

function parseSuggestedQuestions(data: string): string[] | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    if (!record) {
      return null;
    }
    const questions = normalizeSuggestedQuestions(
      record.questions ?? record.suggested_questions ?? record.suggestedQuestions,
    );
    return questions.length ? questions : null;
  } catch {
    return null;
  }
}

function parseEntryRows(raw: unknown): RelatedEntryRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (row): row is RelatedEntryRow =>
      !!row && typeof row === 'object' && !Array.isArray(row),
  ) as RelatedEntryRow[];
}

function parseRelatedSections(
  raw: unknown,
): RelatedEntriesPayload['sections'] {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const sections = raw
    .map((entry) => {
      const section = asRecord(entry);
      if (!section) {
        return null;
      }
      const key =
        typeof section.key === 'string' && section.key
          ? section.key
          : '';
      const label =
        typeof section.label === 'string' && section.label
          ? section.label
          : key || '相关结果';
      if (!key && !Array.isArray(section.items)) {
        return null;
      }
      const items = parseEntryRows(section.items);
      if (!items.length) {
        return null;
      }
      return {
        key: key || label,
        label,
        fields: parseFields(section.fields),
        detailFields: parseFields(section.detailFields),
        items,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return sections.length ? sections : undefined;
}

function parseRelatedEntries(data: string): RelatedEntriesPayload | null {
  try {
    const payload = JSON.parse(data) as unknown;

    // Top-level array fallback
    if (Array.isArray(payload)) {
      const items = parseEntryRows(payload);
      if (!items.length) {
        return null;
      }
      const ensured = ensureDisplayFields('items', items, [], [], undefined);
      return {
        listKey: ensured.listKey,
        fields: ensured.fields,
        detailFields: ensured.detailFields,
        items,
        sections: undefined,
      };
    }

    const record = asRecord(payload);
    if (!record) {
      return null;
    }

    const fields = parseFields(record.fields);
    const detailFields = parseFields(record.detailFields);
    const listKey =
      typeof record.listKey === 'string' && record.listKey
        ? record.listKey
        : 'items';

    const sections = parseRelatedSections(record.sections);

    // Multi-section platforms: sections alone are enough
    if (sections?.length) {
      const items =
        parseEntryRows(record.items).length > 0
          ? parseEntryRows(record.items)
          : sections.flatMap((s) => s.items);
      const baseFields = fields.length ? fields : sections[0]?.fields ?? [];
      const baseDetail =
        detailFields.length > 0
          ? detailFields
          : sections[0]?.detailFields ?? [];
      const ensured = ensureDisplayFields(
        listKey,
        items,
        baseFields,
        baseDetail,
        record.categories,
      );
      const nextSections = sections.map((section) => {
        if (section.fields.length && section.detailFields.length) {
          return section;
        }
        const sectionEnsured = ensureDisplayFields(
          section.key,
          section.items,
          section.fields.length ? section.fields : ensured.fields,
          section.detailFields.length
            ? section.detailFields
            : ensured.detailFields,
          record.categories,
        );
        return {
          ...section,
          fields: sectionEnsured.fields,
          detailFields: sectionEnsured.detailFields,
        };
      });
      return {
        listKey: ensured.listKey,
        fields: ensured.fields,
        detailFields: ensured.detailFields,
        items,
        sections: nextSections,
      };
    }

    // Row marker: any object list that has `serial_no` is the related list.
    // Works with or without projected `items` (empty shell + domain key).
    const META_KEYS = new Set([
      'fields',
      'detailFields',
      'sections',
      'categories',
      'listKey',
    ]);

    const isObjectRowList = (value: unknown): value is unknown[] =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.some((row) => row != null && typeof row === 'object' && !Array.isArray(row));

    const listHasSerialNo = (value: unknown): value is unknown[] =>
      isObjectRowList(value) &&
      value.some(
        (row) =>
          row != null &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          Object.prototype.hasOwnProperty.call(row, 'serial_no'),
      );

    const preferredOrder = [
      ...categoryHints(record.categories),
      listKey,
      'items',
      'achievements',
      'requirements',
      'expert_team',
      'experts',
      'demands',
      'enterprises',
      'platforms',
      'policies',
      'proof_of_concept_centers',
      'pilot_test_platforms',
      'large_equipment',
      'public_service_platforms',
      'poc_center',
      'pilot_test_platform',
      'large_scale_equipment',
      'public_service_platform',
      'entries',
      'list',
    ].filter((key, index, arr) => key && arr.indexOf(key) === index);

    let resolvedListKey = listKey;
    let rawItems: unknown[] | null = null;

    // 1) Prefer any list whose rows carry serial_no
    for (const key of preferredOrder) {
      if (listHasSerialNo(record[key])) {
        resolvedListKey = normalizeDomainKey(key);
        rawItems = record[key] as unknown[];
        break;
      }
    }
    if (!rawItems) {
      for (const [key, value] of Object.entries(record)) {
        if (META_KEYS.has(key)) {
          continue;
        }
        if (listHasSerialNo(value)) {
          resolvedListKey = normalizeDomainKey(key);
          rawItems = value;
          break;
        }
      }
    }

    // 2) Fallback: non-empty object lists (no serial_no yet)
    if (!rawItems) {
      for (const key of preferredOrder) {
        if (isObjectRowList(record[key])) {
          resolvedListKey = normalizeDomainKey(key);
          rawItems = record[key] as unknown[];
          break;
        }
      }
    }
    if (!rawItems) {
      for (const [key, value] of Object.entries(record)) {
        if (META_KEYS.has(key)) {
          continue;
        }
        if (isObjectRowList(value)) {
          resolvedListKey = normalizeDomainKey(key);
          rawItems = value;
          break;
        }
      }
    }

    // 3) Keep empty array shell if nothing else found
    if (!rawItems) {
      if (Array.isArray(record.items)) {
        rawItems = record.items;
      } else if (Array.isArray(record[listKey])) {
        rawItems = record[listKey] as unknown[];
      }
    }

    // Upstream may send platform sub-keys without a projected sections array
    if (!rawItems) {
      const platformKeys = [
        ['proof_of_concept_centers', '概念验证中心'],
        ['pilot_test_platforms', '中试平台'],
        ['large_equipment', '大型仪器设备'],
        ['public_service_platforms', '公共服务平台'],
        // legacy singular keys
        ['poc_center', '概念验证中心'],
        ['pilot_test_platform', '中试平台'],
        ['large_scale_equipment', '大型仪器设备'],
        ['public_service_platform', '公共服务平台'],
      ] as const;
      const seenKeys = new Set<string>();
      const inferred = platformKeys
        .map(([key, label]) => {
          if (seenKeys.has(label)) {
            return null;
          }
          const items = parseEntryRows(record[key]);
          if (!items.length) {
            return null;
          }
          seenKeys.add(label);
          return {
            key,
            label,
            fields,
            detailFields,
            items,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      if (inferred.length) {
        const flatItems = inferred.flatMap((s) => s.items);
        const ensured = ensureDisplayFields(
          'platforms',
          flatItems,
          fields,
          detailFields,
          record.categories,
        );
        return {
          listKey: 'platforms',
          fields: ensured.fields,
          detailFields: ensured.detailFields,
          items: flatItems,
          sections: inferred.map((section) => {
            if (section.fields.length) {
              return section;
            }
            const sectionEnsured = ensureDisplayFields(
              section.key,
              section.items,
              [],
              [],
              record.categories,
            );
            return {
              ...section,
              fields: sectionEnsured.fields,
              detailFields: sectionEnsured.detailFields,
            };
          }),
        };
      }
      return null;
    }

    const items = parseEntryRows(rawItems);
    const ensured = ensureDisplayFields(
      resolvedListKey,
      items,
      fields,
      detailFields,
      record.categories,
    );
    return {
      listKey: ensured.listKey,
      fields: ensured.fields,
      detailFields: ensured.detailFields,
      items,
      sections: undefined,
    };
  } catch {
    return null;
  }
}

function extractContent(data: string): string | null {
  try {
    const payload = JSON.parse(data) as unknown;
    if (!payload || typeof payload !== 'object') {
      return typeof payload === 'string' ? payload : null;
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.content === 'string') {
      return record.content;
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
    return null;
  } catch {
    return data || null;
  }
}

const FAILURE_FINISH_REASONS = new Set([
  'error',
  'fail',
  'failed',
  'abort',
  'aborted',
  'cancel',
  'cancelled',
]);

function parseFinishReason(data: string): string | null {
  try {
    const record = asRecord(JSON.parse(data) as unknown);
    const reason =
      typeof record?.finishReason === 'string'
        ? record.finishReason.trim().toLowerCase()
        : '';
    return reason || null;
  } catch {
    return null;
  }
}

function isFailureFinishReason(reason: string): boolean {
  return FAILURE_FINISH_REASONS.has(reason);
}

function normalizeAgentKey(agentKey: ChatAgentKey): string | null {
  if (agentKey == null || agentKey === 'general') {
    return null;
  }
  return agentKey;
}

/**
 * Stream chat from Backend A SSE:
 *   meta → node_start / node_end → [clarify | token*] → related_entries → done
 */
export function startChatStream(
  input: ChatStreamInput,
  callbacks: ChatStreamCallbacks,
): ChatStreamController {
  const controller = new AbortController();
  let settled = false;

  const settleError = (error: Error) => {
    if (settled || controller.signal.aborted) {
      return;
    }
    settled = true;
    callbacks.onError(error);
  };

  const settleSuccess = () => {
    if (settled) {
      return;
    }
    settled = true;
    callbacks.onComplete();
  };

  void (async () => {
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: authHeaders({
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          message: input.message,
          agentKey: normalizeAgentKey(input.agentKey),
          sessionId: input.sessionId,
          ...(input.model?.trim() ? { model: input.model.trim() } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          notifyAuthExpired();
        }
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `聊天服务响应异常（${response.status}）`);
      }

      if (!response.body) {
        throw new Error('浏览器不支持流式响应');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const dispatchFrame = async (
        frame: NonNullable<ReturnType<typeof parseSseChunk>>,
      ): Promise<boolean> => {
        const eventName = frame.event.trim().toLowerCase();

        if (eventName === 'meta') {
          try {
            const payload = asRecord(JSON.parse(frame.data) as unknown);
            if (payload) {
              callbacks.onMeta?.({
                sessionId:
                  typeof payload.sessionId === 'string'
                    ? payload.sessionId
                    : undefined,
                function:
                  typeof payload.function === 'string'
                    ? payload.function
                    : undefined,
                fields: parseFields(payload.fields),
              });
            }
          } catch {
            // ignore malformed meta
          }
          return true;
        }

        if (eventName === 'node_start' || eventName === 'node_end') {
          const nodeEvent = parseWorkflowNodeEvent(frame.data);
          if (nodeEvent) {
            if (eventName === 'node_start') {
              callbacks.onNodeStart?.(nodeEvent);
            } else {
              callbacks.onNodeEnd?.(nodeEvent);
            }
          }
          return true;
        }

        if (eventName === 'clarify') {
          const clarification = parseClarification(frame.data);
          if (clarification) {
            callbacks.onClarify?.(clarification);
          }
          return true;
        }

        if (
          eventName === 'suggested_questions' ||
          eventName === 'suggestedQuestions'
        ) {
          const questions = parseSuggestedQuestions(frame.data);
          if (questions?.length) {
            callbacks.onSuggestedQuestions?.(questions);
          }
          return true;
        }

        if (eventName === 'token' || eventName === 'delta') {
          const content = extractContent(frame.data);
          if (content) {
            callbacks.onToken(content);
          }
          return true;
        }

        if (eventName === 'related_entries') {
          const entries = parseRelatedEntries(frame.data);
          if (!entries) {
            settleError(new Error('服务返回的结果列表格式不正确。'));
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            return false;
          }
          callbacks.onRelatedEntries(entries);
          return true;
        }

        if (eventName === 'error') {
          let message = GENERIC_STREAM_ERROR_MESSAGE;
          try {
            const payload = asRecord(JSON.parse(frame.data) as unknown);
            const upstream =
              (typeof payload?.message === 'string' && payload.message.trim()) ||
              (typeof payload?.detail === 'string' && payload.detail.trim()) ||
              (typeof payload?.error === 'string' && payload.error.trim()) ||
              '';
            if (upstream) {
              message = upstream;
            }
          } catch {
            if (frame.data?.trim()) {
              message = frame.data.trim();
            }
          }
          settleError(new Error(message));
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return false;
        }

        if (eventName === 'done') {
          const finishReason = parseFinishReason(frame.data);
          if (!finishReason || isFailureFinishReason(finishReason)) {
            settleError(new Error('服务未能完成请求，请稍后重试。'));
          } else {
            settleSuccess();
          }
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return false;
        }

        return true;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const frame = parseSseChunk(part);
          if (frame && !(await dispatchFrame(frame))) {
            return;
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        const trailingFrame = parseSseChunk(buffer);
        if (trailingFrame && !(await dispatchFrame(trailingFrame))) {
          return;
        }
      }

      settleError(new Error('响应流提前结束，请重试。'));
    } catch (error) {
      if (controller.signal.aborted) {
        settleError(
          Object.assign(new Error('已停止生成'), { name: 'AbortError' }),
        );
        return;
      }

      const err =
        error instanceof Error
          ? error
          : new Error(
              '暂时无法连接智能服务，请确认 FastAPI 服务已启动后重试。',
            );
      settleError(err);
    }
  })();

  return {
    abort: () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    },
  };
}
