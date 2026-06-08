import type { Client } from "@libsql/client";
import type { ExcludeReason } from "./types";

export interface FilterResult {
  is_excluded: boolean;
  exclude_reason: ExcludeReason;
  exclude_keywords: string[];
}

/**
 * 매 기사마다 같은 SELECT를 치지 않도록 사전 로드한 캐시. ingest 시작 시 한 번
 * 만들어 article 루프에 전달한다.
 */
export interface FilterCache {
  exclusionKws: { keywordLower: string; keyword: string; reason: Exclude<ExcludeReason, null> }[];
  overrideKws:  { keywordLower: string }[];
}

export async function loadFilterCache(db: Client): Promise<FilterCache> {
  const res = await db.execute(
    "SELECT keyword, reason, is_override FROM exclusion_keywords WHERE is_active = 1"
  );
  const all = res.rows.map((r) => ({
    keyword:      String(r.keyword),
    keywordLower: String(r.keyword).toLowerCase(),
    reason:       String(r.reason) as Exclude<ExcludeReason, null>,
    is_override:  Number(r.is_override),
  }));
  return {
    exclusionKws: all
      .filter((k) => k.is_override === 0)
      .map(({ keywordLower, keyword, reason }) => ({ keywordLower, keyword, reason })),
    overrideKws:  all
      .filter((k) => k.is_override === 1)
      .map(({ keywordLower }) => ({ keywordLower })),
  };
}

export async function applyExclusionFilter(
  db: Client,
  title: string,
  summary: string,
  body: string,
  cache?: FilterCache,
): Promise<FilterResult> {
  const c    = cache ?? (await loadFilterCache(db));
  const text = `${title} ${summary} ${body}`.toLowerCase();

  const hitExclusion: { keyword: string; reason: Exclude<ExcludeReason, null> }[] = [];
  for (const { keywordLower, keyword, reason } of c.exclusionKws) {
    if (text.includes(keywordLower)) {
      hitExclusion.push({ keyword, reason });
    }
  }

  if (hitExclusion.length === 0) {
    return { is_excluded: false, exclude_reason: null, exclude_keywords: [] };
  }

  const hasOverride = c.overrideKws.some((k) => text.includes(k.keywordLower));
  if (hasOverride) {
    return { is_excluded: false, exclude_reason: null, exclude_keywords: [] };
  }

  const reasonCount: Record<string, number> = {};
  for (const { reason } of hitExclusion) {
    reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
  }
  const primaryReason = Object.entries(reasonCount).sort((a, b) => b[1] - a[1])[0][0] as Exclude<ExcludeReason, null>;

  return {
    is_excluded: true,
    exclude_reason: primaryReason,
    exclude_keywords: hitExclusion.map((h) => h.keyword),
  };
}
