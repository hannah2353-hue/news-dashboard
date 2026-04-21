import type { Client } from "@libsql/client";
import type { ExcludeReason } from "./types";

export interface FilterResult {
  is_excluded: boolean;
  exclude_reason: ExcludeReason;
  exclude_keywords: string[];
}

export async function applyExclusionFilter(
  db: Client,
  title: string,
  summary: string,
  body: string,
): Promise<FilterResult> {
  const text = `${title} ${summary} ${body}`.toLowerCase();

  const res = await db.execute(
    "SELECT keyword, reason, is_override FROM exclusion_keywords WHERE is_active = 1"
  );

  const all = res.rows.map((r) => ({
    keyword:     String(r.keyword),
    reason:      String(r.reason) as Exclude<ExcludeReason, null>,
    is_override: Number(r.is_override),
  }));

  const exclusionKws = all.filter((k) => k.is_override === 0);
  const overrideKws  = all.filter((k) => k.is_override === 1);

  const hitExclusion: { keyword: string; reason: Exclude<ExcludeReason, null> }[] = [];
  for (const { keyword, reason } of exclusionKws) {
    if (text.includes(keyword.toLowerCase())) {
      hitExclusion.push({ keyword, reason });
    }
  }

  if (hitExclusion.length === 0) {
    return { is_excluded: false, exclude_reason: null, exclude_keywords: [] };
  }

  const hasOverride = overrideKws.some((k) => text.includes(k.keyword.toLowerCase()));
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
