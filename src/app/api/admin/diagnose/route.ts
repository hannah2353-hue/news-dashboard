import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import { getDb } from "@/lib/db";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const parser = new Parser({
  timeout: 10_000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; NewsDashboard/1.0; +https://vercel.app)",
  },
});

interface DiagnoseSourceResult {
  source: string;
  url: string;
  fetched: number;
  partner_matched: number;
  too_old: number;
  invalid: number;
  matched_samples: string[];
  unmatched_samples: string[];
  newest_pub_date: string | null;
  oldest_pub_date: string | null;
  error?: string;
}

/**
 * Dry-run 진단: RSS를 실제로 받아오되 DB에는 아무것도 쓰지 않는다.
 * "RSS 응답에는 N건 있는데 파트너 매칭에서 M건 떨어진다"를 확인하기 위함.
 *
 * 쿼리 파라미터:
 *   ?days=N  — 며칠치 기사를 살아있다고 볼지 (기본 7)
 *   ?samples=N — 매칭/미매칭 샘플 제목을 몇 건씩 보여줄지 (기본 3)
 */
export async function GET(req: NextRequest) {
  const secret   = process.env.CRON_SECRET;
  const authz    = req.headers.get("authorization");
  const expected = secret ? `Bearer ${secret}` : null;
  if (expected && authz !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url        = new URL(req.url);
  const maxAgeDays = Math.max(1, Math.min(30, Number(url.searchParams.get("days") ?? "7")));
  const sampleN    = Math.max(0, Math.min(10, Number(url.searchParams.get("samples") ?? "3")));
  const cutoffMs   = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    const db = await getDb();

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
      `SELECT source_name, url
       FROM sources
       WHERE is_active = 1 AND source_type = 'rss' AND url IS NOT NULL AND url != ''`
    );
    const sources = srcRes.rows.map((r) => ({
      name: String(r.source_name),
      url:  String(r.url),
    }));

    async function diagnoseOne(src: { name: string; url: string }): Promise<DiagnoseSourceResult> {
      const r: DiagnoseSourceResult = {
        source: src.name,
        url: src.url,
        fetched: 0,
        partner_matched: 0,
        too_old: 0,
        invalid: 0,
        matched_samples: [],
        unmatched_samples: [],
        newest_pub_date: null,
        oldest_pub_date: null,
      };

      try {
        const feed  = await parser.parseURL(src.url);
        const items = feed.items ?? [];
        r.fetched = items.length;

        let newest = -Infinity;
        let oldest = Infinity;

        for (const item of items) {
          const title = (item.title ?? "").trim();
          const link  = item.link?.trim();
          if (!title || !link) {
            r.invalid++;
            continue;
          }

          const pubRaw  = item.isoDate ?? item.pubDate ?? null;
          const pubDate = pubRaw ? new Date(pubRaw) : null;
          if (pubDate && !Number.isNaN(pubDate.getTime())) {
            const t = pubDate.getTime();
            if (t > newest) newest = t;
            if (t < oldest) oldest = t;
            if (t < cutoffMs) {
              r.too_old++;
              continue;
            }
          }

          const bodyText = typeof item.content === "string" ? item.content : "";
          const haystack = `${title} ${bodyText}`;

          if (hasAnyPartner(haystack)) {
            r.partner_matched++;
            if (r.matched_samples.length < sampleN) {
              r.matched_samples.push(title);
            }
          } else if (r.unmatched_samples.length < sampleN) {
            r.unmatched_samples.push(title);
          }
        }

        if (Number.isFinite(newest)) r.newest_pub_date = new Date(newest).toISOString();
        if (Number.isFinite(oldest)) r.oldest_pub_date = new Date(oldest).toISOString();
      } catch (err) {
        r.error = err instanceof Error ? err.message : String(err);
      }

      return r;
    }

    // 동시 8개씩 묶어서 처리. 순차로 돌면 파트너가 많을 때 60초 함수 timeout에 걸린다.
    const CONCURRENCY = 8;
    const results: DiagnoseSourceResult[] = [];
    for (let i = 0; i < sources.length; i += CONCURRENCY) {
      const chunk = sources.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(diagnoseOne));
      results.push(...chunkResults);
    }

    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      max_age_days: maxAgeDays,
      partner_keyword_count: partnerKeywordsLower.length,
      totals: {
        sources:           results.length,
        with_error:        results.filter((r) => r.error).length,
        fetched:           results.reduce((s, r) => s + r.fetched, 0),
        partner_matched:   results.reduce((s, r) => s + r.partner_matched, 0),
        too_old:           results.reduce((s, r) => s + r.too_old, 0),
        invalid:           results.reduce((s, r) => s + r.invalid, 0),
      },
      sources: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/diagnose] 실패:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
