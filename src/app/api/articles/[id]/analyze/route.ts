import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analyzeArticle } from "@/lib/analyzer";

export const dynamic     = "force-dynamic";
// Gemini 호출이 평균 8~10초, cold start까지 더해지면 Vercel Hobby 기본 10초
// 안에 못 끝나서 504가 떨어졌다. ingest route와 동일하게 60초로 늘려둔다.
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const db  = await getDb();
  const res = await db.execute({ sql: "SELECT title, summary, body_text FROM articles WHERE id = ?", args: [params.id] });
  if (res.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const row       = res.rows[0];
  const title     = String(row.title ?? "");
  const summary   = String(row.summary ?? "");
  const body_text = String(row.body_text ?? "");

  try {
    const { summary: aiSummary, impact } = await analyzeArticle(title, summary, body_text);
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    await db.execute({
      sql:  "UPDATE articles SET ai_summary = ?, ai_impact = ?, ai_analyzed_at = ? WHERE id = ?",
      args: [aiSummary, impact, now, params.id],
    });

    return NextResponse.json({ ok: true, ai_summary: aiSummary, ai_impact: impact, ai_analyzed_at: now });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
