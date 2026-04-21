import { NextRequest, NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 붙입니다.
  const secret   = process.env.CRON_SECRET;
  const authz    = req.headers.get("authorization");
  const expected = secret ? `Bearer ${secret}` : null;

  if (expected && authz !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sendDailyDigest();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/digest] 실패:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
