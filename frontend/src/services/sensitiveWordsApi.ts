import { authHeaders, parseJsonResponse } from './http';

export interface SensitiveWordItem {
  id: string;
  word: string;
  category: string;
  subcategory: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensitiveWordListParams {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface SensitiveWordListResult {
  items: SensitiveWordItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SensitiveWordPayload {
  word: string;
  category?: string;
  subcategory?: string;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeItem(raw: unknown): SensitiveWordItem {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: asString(record.id),
    word: asString(record.word),
    category: asString(record.category),
    subcategory: asString(record.subcategory),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

/** Login-user word list for client-side matching. */
export async function fetchActiveSensitiveWords(): Promise<string[]> {
  const response = await fetch('/api/sensitive-words', {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  const data = await parseJsonResponse<{ words?: unknown }>(response);
  const words = data.words;
  if (!Array.isArray(words)) {
    return [];
  }
  return words
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

/** Admin paginated list. */
export async function listSensitiveWords(
  params: SensitiveWordListParams,
): Promise<SensitiveWordListResult> {
  const search = new URLSearchParams();
  if (params.q?.trim()) {
    search.set('q', params.q.trim());
  }
  if (params.category?.trim()) {
    search.set('category', params.category.trim());
  }
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 20));

  const response = await fetch(
    `/api/admin/sensitive-words?${search.toString()}`,
    {
      method: 'GET',
      headers: authHeaders({ Accept: 'application/json' }),
    },
  );
  const data = await parseJsonResponse<Record<string, unknown>>(response);
  return {
    items: (Array.isArray(data.items) ? data.items : []).map(normalizeItem),
    total: asNumber(data.total, 0),
    page: asNumber(data.page, params.page ?? 1),
    pageSize: asNumber(data.pageSize, params.pageSize ?? 20),
  };
}

export async function listSensitiveWordCategories(): Promise<string[]> {
  const response = await fetch('/api/admin/sensitive-words/categories', {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  const data = await parseJsonResponse<{ categories?: unknown }>(response);
  const categories = data.categories;
  if (!Array.isArray(categories)) {
    return [];
  }
  return categories
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export async function createSensitiveWord(
  payload: SensitiveWordPayload,
): Promise<SensitiveWordItem> {
  const response = await fetch('/api/admin/sensitive-words', {
    method: 'POST',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      word: payload.word,
      category: payload.category ?? '',
      subcategory: payload.subcategory ?? '',
    }),
  });
  const data = await parseJsonResponse<unknown>(response);
  return normalizeItem(data);
}

export async function updateSensitiveWord(
  id: string,
  payload: SensitiveWordPayload,
): Promise<SensitiveWordItem> {
  const response = await fetch(
    `/api/admin/sensitive-words/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: authHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        word: payload.word,
        category: payload.category ?? '',
        subcategory: payload.subcategory ?? '',
      }),
    },
  );
  const data = await parseJsonResponse<unknown>(response);
  return normalizeItem(data);
}

export async function deleteSensitiveWord(
  id: string,
): Promise<SensitiveWordItem> {
  const response = await fetch(
    `/api/admin/sensitive-words/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: authHeaders({ Accept: 'application/json' }),
    },
  );
  const data = await parseJsonResponse<unknown>(response);
  return normalizeItem(data);
}
