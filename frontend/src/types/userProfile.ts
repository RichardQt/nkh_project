export type PersonaRoleType = 'university' | 'enterprise' | 'tech_manager';

export interface UserProfile {
  userId: string;
  roleType: PersonaRoleType | '';
  needs: string;
  focusAreas: string[];
  preferredScenes: string[];
  memoryNotes: string;
  updatedAt: string;
}

export interface UserProfilePayload {
  roleType: PersonaRoleType | '';
  needs: string;
  focusAreas: string[];
  preferredScenes: string[];
  memoryNotes: string;
}

export const PERSONA_ROLE_OPTIONS: readonly {
  value: PersonaRoleType;
  label: string;
  description: string;
}[] = [
  {
    value: 'university',
    label: '高校',
    description: '科研院所与高校用户，侧重成果转化与合作对接',
  },
  {
    value: 'enterprise',
    label: '企业',
    description: '产业与企业用户，侧重技术需求与资源匹配',
  },
  {
    value: 'tech_manager',
    label: '技术经理人',
    description: '技术经纪与中介角色，侧重供需撮合与服务',
  },
] as const;

export const PERSONA_SCENE_OPTIONS: readonly {
  value: string;
  label: string;
}[] = [
  { value: 'achievement_discover', label: '成果发现' },
  { value: 'demand_discover', label: '需求发现' },
  { value: 'expert_discover', label: '专家发现' },
  { value: 'enterprise_discover', label: '企业发现' },
  { value: 'platform_discover', label: '平台发现' },
  { value: 'policy_recommend', label: '政策推荐' },
  { value: 'achievement_eval', label: '成果评估' },
  { value: 'research_direction', label: '研究方向' },
] as const;

export const FOCUS_AREA_SUGGESTIONS: readonly string[] = [
  '新材料',
  '人工智能',
  '生物医药',
  '先进制造',
  '新能源',
  '集成电路',
  '数字经济',
  '绿色低碳',
] as const;

export function emptyUserProfile(userId = ''): UserProfile {
  return {
    userId,
    roleType: '',
    needs: '',
    focusAreas: [],
    preferredScenes: [],
    memoryNotes: '',
    updatedAt: '',
  };
}

export function personaRoleLabel(roleType: PersonaRoleType | ''): string {
  if (!roleType) {
    return '未设置';
  }
  return (
    PERSONA_ROLE_OPTIONS.find((item) => item.value === roleType)?.label ??
    '未设置'
  );
}
