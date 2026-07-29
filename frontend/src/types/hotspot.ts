import type { DisplayField, RelatedEntryRow } from './chat';

/** One category from GET /api/hotspots (top N rows of one Excel sheet). */
export interface HotspotSection {
  key: string;
  label: string;
  /** Primary title field key for list rows. */
  titleKey: string;
  /** List-card fields (信息匹配.md). */
  fields: DisplayField[];
  /** Detail-page fields (信息匹配.md). */
  detailFields: DisplayField[];
  items: RelatedEntryRow[];
}

export interface HotspotsResponse {
  source: string;
  topN: number;
  sections: HotspotSection[];
}
