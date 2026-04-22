import type { Client } from "@libsql/client";
import Parser from "rss-parser";
import { scoreArticle } from "./scoring";
import { applyExclusionFilter } from "./filter";

const parser = new Parser({
  timeout: 10_000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; NewsDashboard/1.0; +https://vercel.app)",
  },
});

export interface IngestSourceResult {
  source: string;
  url: string;
  fetched: number;
  inserted: number;
  skipped_no_partner: number;
  skipped_too_old: number;
  skipped_duplicate: number;
  skipped_invalid: number;
  error?: string;
}

export interface IngestSummary {
  ok: boolean;
  total_inserted: number;
  total_fetched: number;
  duration_ms: number;
  sources: IngestSourceResult[];
}

interface IngestOptions {
  /** 기사 게시일이 N일보다 오래되면 건너뜀 (기본 7일) */
  maxAgeDays?: number;
  /** true면 파트너 키워드 매칭 없는 기사는 저장 안 함 (기본 true) */
  onlyPartnerMatched?: boolean;
}

function toDbDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBodyText(item: Parser.Item): string {
  const candidates: unknown[] = [
    (item as unknown as Record<string, unknown>)["content:encoded"],
    item.content,
    (item as unknown as Record<string, unknown>).contentSnippet,
    item.summary,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return stripHtml(c);
  }
  return "";
}

/**
 * 활성화된 모든 RSS source를 순회하며 신규 기사를 수집합니다.
 * - UNIQUE(url) 기반 중복 무시
 * - 파트너 키워드 매칭 안 된 기사는 기본 스킵 (옵션 변경 가능)
 * - exclusion 필터도 같이 돌려서 status/alert_level 세팅
 */
export async function ingestAllSources(
  db: Client,
  opts: IngestOptions = {},
): Promise<IngestSummary> {
  const startedAt           = Date.now();
  const maxAgeDays          = opts.maxAgeDays ?? 7;
  const onlyPartnerMatched  = opts.onlyPartnerMatched ?? true;
  const cutoffMs            = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  // 파트너 키워드 캐시 — 각 기사마다 DB 조회하지 않도록
  const pkRes = await db.execute(
    `SELECT pk.keyword
     FROM partner_keywords pk
     JOIN partners p ON p.id = pk.partner_id
     WHERE pk.is_active = 1 AND p.is_active = 1`
  );
  const partnerKeywordsLower = pkRes.rows
    .map((r) => String(r.keyword ?? "").toLowerCase())
    .filter(Boolean);

  const hasAnyPartner = (text: string): boolean => {
    const lower = text.toLowerCase();
    return partnerKeywordsLower.some((kw) => lower.includes(kw));
  };

  const srcRes = await db.execute(
    `SELECT source_name, url, source_type
     FROM sources
     WHERE is_active = 1 AND source_type = 'rss' AND url IS NOT NULL AND url != ''`
  );
  const sources = srcRes.rows.map((r) => ({
    name: String(r.source_name),
    url:  String(r.url),
  }));

  const results: IngestSourceResult[] = [];

  for (const src of sources) {
    const result: IngestSourceResult = {
      source: src.name,
      url: src.url,
      fetched: 0,
      inserted: 0,
      skipped_no_partner: 0,
      skipped_too_old: 0,
      skipped_duplicate: 0,
      skipped_invalid: 0,
    };

    try {
      const feed = await parser.parseURL(src.url);
      const items = feed.items ?? [];
      result.fetched = items.length;

      for (const item of items) {
        const url = item.link?.trim();
        const title = (item.title ?? "").trim();
        if (!url || !title) {
          result.skipped_invalid++;
          continue;
        }

        const pubRaw = item.isoDate ?? item.pubDate ?? null;
        const pubDate = pubRaw ? new Date(pubRaw) : new Date();
        if (Number.isNaN(pubDate.getTime())) {
          result.skipped_invalid++;
          continue;
        }
        if (pubDate.getTime() < cutoffMs) {
          result.skipped_too_old++;
          continue;
        }

        const bodyText = extractBodyText(item);
        const summary  = bodyText.slice(0, 500);

        if (onlyPartnerMatched && !hasAnyPartner(`${title} ${summary} ${bodyText}`)) {
          result.skipped_no_partner++;
          continue;
        }

        const score  = await scoreArticle(db, title, summary, bodyText, src.name);
        const filter = await applyExclusionFilter(db, title, summary, bodyText);

        const published_at = toDbDate(pubDate);
        const collected_at = toDbDate(new Date());

        const ins = await db.execute({
          sql: `INSERT OR IGNORE INTO articles
                  (collected_at, published_at, source_name, source_type,
                   title, summary, body_text, url,
                   auto_partners, final_partner, matched_keywords,
                   exclude_keywords, exclude_reason,
                   source_score, keyword_score, partner_score, spread_score, total_score,
                   alert_level, status, is_duplicate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          args: [
            collected_at, published_at, src.name, "rss",
            title, summary, bodyText, url,
            JSON.stringify(score.auto_partners),
            JSON.stringify(score.auto_partners),
            JSON.stringify(score.matched_keywords),
            JSON.stringify(filter.exclude_keywords),
            filter.exclude_reason,
            score.source_score, score.keyword_score, score.partner_score, 0, score.total_score,
            filter.is_excluded ? "hold" : score.alert_level,
            filter.is_excluded ? "excluded" : "new",
          ],
        });

        if (Number(ins.rowsAffected ?? 0) > 0) {
          result.inserted++;
        } else {
          result.skipped_duplicate++;
        }
      }

      await db.execute({
        sql:  "UPDATE sources SET last_collected_at = ? WHERE source_name = ?",
        args: [toDbDate(new Date()), src.name],
      });
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      console.warn(`[ingest] ${src.name} 실패:`, result.error);
    }

    results.push(result);
  }

  return {
    ok: true,
    total_inserted: results.reduce((s, r) => s + r.inserted, 0),
    total_fetched:  results.reduce((s, r) => s + r.fetched, 0),
    duration_ms:    Date.now() - startedAt,
    sources: results,
  };
}

/** seed 단계에서 들어간 예시 URL(`https://example.com/...`)을 가진 기사만 삭제 */
export async function clearSampleArticles(db: Client): Promise<number> {
  const res = await db.execute(
    "DELETE FROM articles WHERE url LIKE 'https://example.com/%'"
  );
  return Number(res.rowsAffected ?? 0);
}
