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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db  = await getDb();
  const res = await db.execute({ sql: "SELECT * FROM articles WHERE id = ?", args: [params.id] });
  if (res.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(rowToArticle(res.rows[0] as Record<string, unknown>));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = await getDb();
  const body = await req.json() as Partial<Article>;

  const allowed = ["manual_partner", "final_partner", "status", "note", "alert_level"];
  const sets: string[] = [];
  const vals: SqlVal[] = [];

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`);
      const v = (body as Record<string, unknown>)[key];
      const serialized = Array.isArray(v) ? JSON.stringify(v) : (v as SqlVal);
      vals.push(serialized);
    }
  }
  if (!sets.length) return NextResponse.json({ error: "no fields" }, { status: 400 });

  await db.execute({
    sql:  `UPDATE articles SET ${sets.join(", ")} WHERE id = ?`,
    args: [...vals, params.id],
  });

  for (const key of allowed) {
    if (key in body) {
      const v = (body as Record<string, unknown>)[key];
      await db.execute({
        sql:  "INSERT INTO review_logs (article_id, field, new_value) VALUES (?, ?, ?)",
        args: [params.id, key, Array.isArray(v) ? JSON.stringify(v) : String(v ?? "")],
      });
    }
  }

  const updated = await db.execute({ sql: "SELECT * FROM articles WHERE id = ?", args: [params.id] });
  return NextResponse.json(rowToArticle(updated.rows[0] as Record<string, unknown>));
}
