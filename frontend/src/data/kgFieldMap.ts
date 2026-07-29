/**
 * Knowledge-graph field bindings for discovery lists.
 *
 * Maps listKey / sectionKey → field key → { entity_type, which column provides vid }.
 * `vidFrom: 'self'` uses the field's own value; otherwise another field key on the row.
 */

export interface KgFieldBinding {
  entityType: string;
  /** `'self'` or a sibling field key on the same row. */
  vidFrom: 'self' | string;
}

/** listKey / sectionKey → fieldKey → binding */
export const KG_FIELD_MAP: Record<string, Record<string, KgFieldBinding>> = {
  // 成果发现
  achievements: {
    achievement_name: { entityType: '成果', vidFrom: 'self' },
    achievement_contributors: {
      entityType: '人',
      vidFrom: 'achievement_name',
    },
    primary_technology_field: {
      entityType: '技术领域(一级)',
      vidFrom: 'self',
    },
    publishing_organization_name: { entityType: '机构', vidFrom: 'self' },
  },

  // 需求发现
  requirements: {
    requirement_name: { entityType: '需求', vidFrom: 'self' },
    primary_technology_field: {
      entityType: '技术领域(一级)',
      vidFrom: 'self',
    },
    // 按需求：二级字段的 entity_type 为技术领域(二级)，vid 取技术领域一级名称
    secondary_technology_field: {
      entityType: '技术领域(二级)',
      vidFrom: 'primary_technology_field',
    },
    affiliated_organization: { entityType: '机构', vidFrom: 'self' },
  },
  demands: {
    requirement_name: { entityType: '需求', vidFrom: 'self' },
    primary_technology_field: {
      entityType: '技术领域(一级)',
      vidFrom: 'self',
    },
    secondary_technology_field: {
      entityType: '技术领域(二级)',
      vidFrom: 'primary_technology_field',
    },
    affiliated_organization: { entityType: '机构', vidFrom: 'self' },
  },

  // 专家发现
  expert_team: {
    expert_team_name: { entityType: '专家团队', vidFrom: 'self' },
    team_leader: { entityType: '人', vidFrom: 'self' },
    affiliated_university: { entityType: '机构', vidFrom: 'self' },
  },
  experts: {
    expert_team_name: { entityType: '专家团队', vidFrom: 'self' },
    team_leader: { entityType: '人', vidFrom: 'self' },
    affiliated_university: { entityType: '机构', vidFrom: 'self' },
  },

  // 企业发现
  enterprises: {
    company_name: { entityType: '企业', vidFrom: 'self' },
    industry_field: { entityType: '产业领域', vidFrom: 'self' },
  },

  // 平台发现 · 概念验证中心
  proof_of_concept_centers: {
    center_name: { entityType: '概念验证中心', vidFrom: 'self' },
    responsible_organization: { entityType: '机构', vidFrom: 'self' },
    service_field: { entityType: '服务领域', vidFrom: 'self' },
  },
  poc_center: {
    center_name: { entityType: '概念验证中心', vidFrom: 'self' },
    responsible_organization: { entityType: '机构', vidFrom: 'self' },
    service_field: { entityType: '服务领域', vidFrom: 'self' },
  },

  // 平台发现 · 中试平台（entity_type 按需求为 公共服务平台）
  pilot_test_platforms: {
    platform_name: { entityType: '公共服务平台', vidFrom: 'self' },
    operating_entity: { entityType: '机构', vidFrom: 'self' },
    industry_category: { entityType: '产业类别', vidFrom: 'self' },
  },
  pilot_test_platform: {
    platform_name: { entityType: '公共服务平台', vidFrom: 'self' },
    operating_entity: { entityType: '机构', vidFrom: 'self' },
    industry_category: { entityType: '产业类别', vidFrom: 'self' },
  },

  // 平台发现 · 大型仪器设备
  large_equipment: {
    equipment_name: { entityType: '仪器设备', vidFrom: 'self' },
    managing_organization_name: { entityType: '机构', vidFrom: 'self' },
    service_field: { entityType: '服务领域', vidFrom: 'self' },
  },
  large_scale_equipment: {
    equipment_name: { entityType: '仪器设备', vidFrom: 'self' },
    managing_organization_name: { entityType: '机构', vidFrom: 'self' },
    service_field: { entityType: '服务领域', vidFrom: 'self' },
  },

  // 平台发现 · 公共服务平台
  public_service_platforms: {
    platform_name_required: { entityType: '公共服务平台', vidFrom: 'self' },
    responsible_organization_required: { entityType: '机构', vidFrom: 'self' },
    industry_field_required: { entityType: '产业领域', vidFrom: 'self' },
  },
  public_service_platform: {
    platform_name_required: { entityType: '公共服务平台', vidFrom: 'self' },
    responsible_organization_required: { entityType: '机构', vidFrom: 'self' },
    industry_field_required: { entityType: '产业领域', vidFrom: 'self' },
  },
};

export function getKgFieldBinding(
  listOrSectionKey: string | undefined,
  fieldKey: string,
): KgFieldBinding | null {
  if (!listOrSectionKey) {
    return null;
  }
  return KG_FIELD_MAP[listOrSectionKey]?.[fieldKey] ?? null;
}

/** Entity types whose multi-value vid must be split by Chinese顿号 `、`. */
const VID_SPLIT_ENTITY_TYPES = new Set(['服务领域', '产业领域']);

export function shouldSplitKgVid(entityType: string): boolean {
  return VID_SPLIT_ENTITY_TYPES.has(entityType);
}

/**
 * Split multi-value text by顿号 for KG vid.
 * Only applied for 服务领域 / 产业领域.
 */
export function splitKgVidParts(entityType: string, raw: string): string[] {
  const text = raw.trim();
  if (!text || text === '-') {
    return [];
  }
  if (!shouldSplitKgVid(entityType)) {
    return [text];
  }
  return text
    .split('、')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export interface KgResolvedTarget {
  entityType: string;
  vid: string;
}

/**
 * Resolve one or more KG targets for a list-row field.
 * For 服务领域 / 产业领域, values like `A、B` become two targets with vid `A` and `B`.
 */
export function resolveKgQueries(
  listOrSectionKey: string | undefined,
  fieldKey: string,
  row: Record<string, string | number | boolean | null | undefined>,
): KgResolvedTarget[] {
  const binding = getKgFieldBinding(listOrSectionKey, fieldKey);
  if (!binding) {
    return [];
  }

  const raw =
    binding.vidFrom === 'self' ? row[fieldKey] : row[binding.vidFrom];

  if (raw == null || raw === '') {
    return [];
  }
  if (typeof raw === 'boolean') {
    return [];
  }

  const parts = splitKgVidParts(binding.entityType, String(raw));
  return parts.map((vid) => ({
    entityType: binding.entityType,
    vid,
  }));
}

/**
 * Resolve a single entity_type + vid (first segment when multi-value).
 * Prefer {@link resolveKgQueries} when rendering multi-part clickable values.
 */
export function resolveKgQuery(
  listOrSectionKey: string | undefined,
  fieldKey: string,
  row: Record<string, string | number | boolean | null | undefined>,
): KgResolvedTarget | null {
  return resolveKgQueries(listOrSectionKey, fieldKey, row)[0] ?? null;
}
