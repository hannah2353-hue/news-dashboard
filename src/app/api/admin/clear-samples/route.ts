import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clearSampleArticles } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/**
 * seed 단계에서 들어간 가짜 기사(`https://example.com/aXXX`)를 일괄 삭제합니다.
 * CRON_SECRET이 설정돼 있으면 Authorization 헤더가 일치해야 실행됩니다.
 */
export async function POST(req: NextRequest) {
  const secret   = process.env.CRON_SECRET;
  const authz    = req.headers.get("authorization");
  const expected = secret ? `Bearer ${secret}` : null;

  if (expected && authz !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const deleted = await clearSampleArticles(db);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/clear-samples] 실패:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
