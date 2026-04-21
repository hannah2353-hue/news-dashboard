import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Article } from "@/lib/types";

export const dynamic = "force-dynamic";

type SqlVal = string | number | null;

function rowToArticle(r: Record<string, unknown>): Article {
  return {
    id:               Number(r.id),
    collected_at:     String(r.collected_at ?? ""),
    published_at:     String(r.published_at ?? ""),
    source_name:      String(r.source_name ?? ""),
    source_type:      String(r.source_type ?? "rss") as Article["source_type"],
    title:            String(r.title ?? ""),
    summary:          String(r.summary ?? ""),
    body_text:        String(r.body_text ?? ""),
    url:              String(r.url ?? ""),
    auto_partners:    String(r.auto_partners ?? "[]"),
    manual_partner:   r.manual_partner == null ? null : String(r.manual_partner),
    final_partner:    String(r.final_partner ?? "[]"),
    matched_keywords: String(r.matched_keywords ?? "[]"),
    exclude_keywords: String(r.exclude_keywords ?? "[]"),
    exclude_reason:   (r.exclude_reason == null ? null : String(r.exclude_reason)) as Article["exclude_reason"],
    source_score:     Number(r.source_score ?? 0),
    keyword_score:    Number(r.keyword_score ?? 0),
    partner_score:    Number(r.partner_score ?? 0),
    spread_score:     Number(r.spread_score ?? 0),
    total_score:      Number(r.total_score ?? 0),
    alert_level:      String(r.alert_level ?? "hold") as Article["alert_level"],
    status:           String(r.status ?? "new")       as Article["status"],
    note:             r.note == null ? null : String(r.note),
    is_duplicate:     (Number(r.is_duplicate ?? 0) ? 1 : 0) as 0 | 1,
    ai_summary:       r.ai_summary     == null ? null : String(r.ai_summary),
    ai_impact:        r.ai_impact      == null ? null : String(r.ai_impact),
    ai_analyzed_at:   r.ai_analyzed_at == null ? null : String(r.ai_analyzed_at),
  };
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const p  = req.nextUrl.searchParams;

  const page     = Math.max(1, Number(p.get("page")  ?? 1));
  const pageSize = Math.min(100, Math.max(5, Number(p.get("pageSize") ?? 20)));
  const offset   = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: SqlVal[] = [];

  if (p.get("dateFrom")) { conditions.push("DATE(published_at) >= ?"); params.push(p.get("dateFrom")!); }
  if (p.get("dateTo"))   { conditions.push("DATE(published_at) <= ?"); params.push(p.get("dateTo")!); }
  if (p.get("source"))   { conditions.push("source_name = ?");         params.push(p.get("source")!); }
  if (p.get("alertLevel")) { conditions.push("alert_level = ?");        params.push(p.get("alertLevel")!); }
  if (p.get("status"))   { conditions.push("status = ?");               params.push(p.get("status")!); }
  if (!p.get("includeExcluded") || p.get("includeExcluded") === "false") {
    conditions.push("status != 'excluded'");
  }
  if (p.get("search")) {
    conditions.push("(title LIKE ? OR summary LIKE ?)");
    const q = `%${p.get("search")}%`;
    params.push(q, q);
  }
  if (p.get("partner")) {
    conditions.push("final_partner LIKE ?");
    params.push(`%${p.get("partner")}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRes = await db.execute({ sql: `SELECT COUNT(*) as n FROM articles ${where}`, args: params });
  const total    = Number(totalRes.rows[0]?.n ?? 0);

  const rowsRes = await db.execute({
    sql:  `SELECT * FROM articles ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
    args: [...params, pageSize, offset],
  });
  const rows = rowsRes.rows.map((r) => rowToArticle(r as Record<string, unknown>));

  return NextResponse.json({ total, page, pageSize, rows });
}

export async function POST(req: NextRequest) {
  const db   = await getDb();
  const body = await req.json() as {
    title: string; summary?: string; body_text?: string; url: string;
    source_name: string; source_type?: string; published_at?: string;
  };

  const { scoreArticle }         = await import("@/lib/scoring");
  const { applyExclusionFilter } = await import("@/lib/filter");

  const score  = await scoreArticle(db, body.title, body.summary ?? "", body.body_text ?? "", body.source_name);
  const filter = await applyExclusionFilter(db, body.title, body.summary ?? "", body.body_text ?? "");

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const res = await db.execute({
    sql: `INSERT OR IGNORE INTO articles
            (collected_at, published_at, source_name, source_type,
             title, summary, body_text, url,
             auto_partners, final_partner, matched_keywords,
             exclude_keywords, exclude_reason,
             source_score, keyword_score, partner_score, spread_score, total_score,
             alert_level, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      now, body.published_at ?? now, body.source_name, body.source_type ?? "rss",
      body.title, body.summary ?? "", body.body_text ?? "", body.url,
      JSON.stringify(score.auto_partners), JSON.stringify(score.auto_partners),
      JSON.stringify(score.matched_keywords), JSON.stringify(filter.exclude_keywords),
      filter.exclude_reason,
      score.source_score, score.keyword_score, score.partner_score, 0, score.total_score,
      filter.is_excluded ? "hold" : score.alert_level,
      filter.is_excluded ? "excluded" : "new",
    ],
  });

  return NextResponse.json({ id: Number(res.lastInsertRowid ?? 0) });
}
