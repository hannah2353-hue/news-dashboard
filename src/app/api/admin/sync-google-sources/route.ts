import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 활성 파트너마다 구글 뉴스 검색 RSS URL을 만들어 sources 테이블에 등록한다.
 * - 이미 같은 source_name이 있으면 URL만 갱신
 * - 키워드는 partner_keywords의 is_active=1 항목을 OR로 묶어 검색
 * - source_name 컨벤션: "구글뉴스 - <파트너명>"
 *
 * 옵션:
 *   ?deactivate_legacy=1 — 'rss' 타입 중 'news.google.com'을 url에 포함하지 않는
 *     기존 source를 일괄 is_active=0으로 비활성화. 기본 false.
 */

function buildGoogleNewsUrl(keywords: string[]): string {
  const q = keywords
    .filter((k) => k.trim().length > 0)
    .map((k) => `"${k.trim()}"`)
    .join(" OR ");
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
}

type SyncAction = "created" | "updated" | "skipped_no_keywords";

interface SyncItem {
  partner: string;
  source_name: string;
  url: string;
  keyword_count: number;
  action: SyncAction;
}

export async function POST(req: NextRequest) {
  const secret   = process.env.CRON_SECRET;
  const authz    = req.headers.get("authorization");
  const expected = secret ? `Bearer ${secret}` : null;
  if (expected && authz !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url             = new URL(req.url);
  const deactivateLegacy = url.searchParams.get("deactivate_legacy") === "1";

  try {
    const db = await getDb();

    const pRes = await db.execute(
      `SELECT id, partner_name FROM partners WHERE is_active = 1 ORDER BY partner_name`
    );
    const partners = pRes.rows.map((r) => ({
      id:   Number(r.id),
      name: String(r.partner_name),
    }));

    const items: SyncItem[] = [];
    let created = 0;
    let updated = 0;

    for (const p of partners) {
      const kRes = await db.execute({
        sql:  `SELECT keyword FROM partner_keywords
               WHERE partner_id = ? AND is_active = 1`,
        args: [p.id],
      });
      const keywords = kRes.rows
        .map((r) => String(r.keyword ?? "").trim())
        .filter(Boolean);

      const sourceName = `구글뉴스 - ${p.name}`;

      if (keywords.length === 0) {
        items.push({
          partner:       p.name,
          source_name:   sourceName,
          url:           "",
          keyword_count: 0,
          action:        "skipped_no_keywords",
        });
        continue;
      }

      const newsUrl = buildGoogleNewsUrl(keywords);

      const exRes = await db.execute({
        sql:  `SELECT id FROM sources WHERE source_name = ?`,
        args: [sourceName],
      });

      if (exRes.rows.length > 0) {
        await db.execute({
          sql: `UPDATE sources
                SET url = ?, is_active = 1, source_type = 'rss',
                    tier = 'aggregator', source_score = 2
                WHERE source_name = ?`,
          args: [newsUrl, sourceName],
        });
        updated++;
        items.push({
          partner:       p.name,
          source_name:   sourceName,
          url:           newsUrl,
          keyword_count: keywords.length,
          action:        "updated",
        });
      } else {
        await db.execute({
          sql:  `INSERT INTO sources
                   (source_name, tier, source_type, url, is_active, source_score)
                 VALUES (?, 'aggregator', 'rss', ?, 1, 2)`,
          args: [sourceName, newsUrl],
        });
        created++;
        items.push({
          partner:       p.name,
          source_name:   sourceName,
          url:           newsUrl,
          keyword_count: keywords.length,
          action:        "created",
        });
      }
    }

    let deactivated = 0;
    if (deactivateLegacy) {
      const res = await db.execute(
        `UPDATE sources
         SET is_active = 0
         WHERE source_type = 'rss'
           AND (url IS NULL OR url NOT LIKE '%news.google.com%')`
      );
      deactivated = Number(res.rowsAffected ?? 0);
    }

    return NextResponse.json({
      ok:           true,
      partner_count: partners.length,
      created,
      updated,
      deactivated_legacy: deactivated,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/sync-google-sources] 실패:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
