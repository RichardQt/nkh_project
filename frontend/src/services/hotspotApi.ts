import type { HotspotSection, HotspotsResponse } from '../types/hotspot';
import type { DisplayField, RelatedEntryRow } from '../types/chat';
import { authHeaders, notifyAuthExpired } from './http';

function asString(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value).trim();
}

function normalizeFields(raw: unknown): DisplayField[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: DisplayField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const key = asString((item as { key?: unknown }).key);
    const label = asString((item as { label?: unknown }).label);
    if (!key || !label) {
      continue;
    }
    out.push({ key, label });
  }
  return out;
}

function normalizeItems(raw: unknown): RelatedEntryRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (row): row is RelatedEntryRow =>
      Boolean(row) && typeof row === 'object' && !Array.isArray(row),
  );
}

function normalizeSection(raw: unknown): HotspotSection | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const key = asString(obj.key);
  const label = asString(obj.label);
  if (!key || !label) {
    return null;
  }
  const titleKey = asString(obj.titleKey);
  const fields = normalizeFields(obj.fields);
  const detailFields = normalizeFields(obj.detailFields);
  const items = normalizeItems(obj.items);
  if (!items.length) {
    return null;
  }
  return {
    key,
    label,
    titleKey: titleKey || fields[0]?.key || '',
    fields,
    detailFields,
    items,
  };
}

/** Fetch projected hotspot sections (cached on Backend A). */
export async function fetchHotspots(
  signal?: AbortSignal,
): Promise<HotspotsResponse> {
  const response = await fetch('/api/hotspots', {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      notifyAuthExpired();
    }
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `热点推荐加载失败 (${response.status})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const sections = Array.isArray(data.sections)
    ? data.sections
        .map(normalizeSection)
        .filter((s): s is HotspotSection => s != null)
    : [];

  return {
    source: asString(data.source) || '英文字段.xlsx',
    topN: typeof data.topN === 'number' ? data.topN : 5,
    sections,
  };
}

/** Compact display value for a cell. */
export function hotspotCellText(
  row: RelatedEntryRow,
  key: string,
  maxLen?: number,
): string {
  const raw = row[key];
  if (raw == null) {
    return '';
  }
  const text = String(raw).replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  if (maxLen != null && text.length > maxLen) {
    return `${text.slice(0, maxLen - 1)}…`;
  }
  return text;
}

/** Title for a list row. */
export function hotspotTitle(
  section: HotspotSection,
  row: RelatedEntryRow,
  index: number,
): string {
  return (
    hotspotCellText(row, section.titleKey) ||
    section.fields
      .map((f) => hotspotCellText(row, f.key))
      .find(Boolean) ||
    `${section.label} #${index + 1}`
  );
}
