import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ingestAllSources } from "@/lib/ingest";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 붙입니다.
  // 로컬 테스트 시 CRON_SECRET을 unset하면 이 체크가 스킵됩니다.
  const secret   = process.env.CRON_SECRET;
  const authz    = req.headers.get("authorization");
  const expected = secret ? `Bearer ${secret}` : null;

  if (expected && authz !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const summary = await ingestAllSources(db);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/ingest] 실패:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
