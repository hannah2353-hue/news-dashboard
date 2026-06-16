import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// 외부 시스템(예: 시장 인텔리전스 대시보드 루틴)이 임의 텍스트를 같은 텔레그램 방으로
// 중계 발송하기 위한 엔드포인트. MI_RELAY_SECRET 환경변수로 보호된다.
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MI_RELAY_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "MI_RELAY_SECRET이 설정되지 않았습니다." }, { status: 500 });
    }

    const body = await req.json() as { text?: string; secret?: string };
    if (body.secret !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json({ error: "text 파라미터가 필요합니다." }, { status: 400 });
    }

    await sendTelegramMessage(body.text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
