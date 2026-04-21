import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendTelegramMessage, formatArticleMessage } from "@/lib/telegram";
import { sendDailyDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { articleId?: number; digest?: boolean };

    if (body.digest) {
      await sendDailyDigest();
      return NextResponse.json({ ok: true, type: "digest" });
    }

    if (body.articleId != null) {
      const db  = await getDb();
      const res = await db.execute({ sql: "SELECT * FROM articles WHERE id = ?", args: [body.articleId] });
      if (res.rows.length === 0) return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });

      const r = res.rows[0];
      const text = formatArticleMessage({
        title:            String(r.title ?? ""),
        source_name:      String(r.source_name ?? ""),
        published_at:     String(r.published_at ?? ""),
        url:              String(r.url ?? ""),
        alert_level:      String(r.alert_level ?? ""),
        total_score:      Number(r.total_score ?? 0),
        final_partner:    String(r.final_partner ?? "[]"),
        matched_keywords: String(r.matched_keywords ?? "[]"),
        ai_summary:       r.ai_summary == null ? null : String(r.ai_summary),
        ai_impact:        r.ai_impact  == null ? null : String(r.ai_impact),
      });
      await sendTelegramMessage(text);
      return NextResponse.json({ ok: true, type: "article" });
    }

    return NextResponse.json({ error: "articleId 또는 digest 파라미터가 필요합니다." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
