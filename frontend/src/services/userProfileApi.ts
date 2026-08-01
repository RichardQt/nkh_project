import { authHeaders, parseJsonResponse } from './http';
import type {
  PersonaRoleType,
  UserProfile,
  UserProfilePayload,
} from '../types/userProfile';
import { emptyUserProfile } from '../types/userProfile';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const text = item.trim();
      if (text) {
        result.push(text);
      }
    }
  }
  return result;
}

function asRoleType(value: unknown): PersonaRoleType | '' {
  if (
    value === 'university' ||
    value === 'enterprise' ||
    value === 'tech_manager'
  ) {
    return value;
  }
  return '';
}

function normalizeProfile(raw: unknown): UserProfile {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    userId: asString(record.userId),
    roleType: asRoleType(record.roleType),
    needs: asString(record.needs),
    focusAreas: asStringList(record.focusAreas),
    preferredScenes: asStringList(record.preferredScenes),
    memoryNotes: asString(record.memoryNotes),
    updatedAt: asString(record.updatedAt),
  };
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const response = await fetch('/api/user/profile', {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  const data = await parseJsonResponse<unknown>(response);
  if (!data || typeof data !== 'object') {
    return emptyUserProfile();
  }
  return normalizeProfile(data);
}

export async function saveUserProfile(
  payload: UserProfilePayload,
): Promise<UserProfile> {
  const response = await fetch('/api/user/profile', {
    method: 'PUT',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      roleType: payload.roleType,
      needs: payload.needs,
      focusAreas: payload.focusAreas,
      preferredScenes: payload.preferredScenes,
      memoryNotes: payload.memoryNotes,
    }),
  });
  const data = await parseJsonResponse<unknown>(response);
  return normalizeProfile(data);
}
