import { getDb } from "./db";
import { sendTelegramMessage } from "./telegram";
import { kstDateString } from "./datetime";
import { dedupeForDigest } from "./dedup";

export async function sendDailyDigest() {
  const db    = await getDb();
  const today = kstDateString();

  // "오늘 수집" 알림은 collected_at 기준. 새벽 KST 8~9시엔 published_at=오늘인
  // 기사가 거의 없어서 발행일 기준이면 매번 0건이 떴다. cron이 어제 발행 기사를
  // 오늘 새로 가져온 경우도 "오늘 수집"으로 잡아야 사용자 의도와 맞다.
  const res = await db.execute({
    sql: `SELECT * FROM articles
          WHERE DATE(collected_at) = ? AND status != 'excluded' AND is_duplicate = 0
          ORDER BY total_score DESC, published_at DESC`,
    args: [today],
  });

  const rawArticles = res.rows.map((r) => ({
    title:         String(r.title ?? ""),
    source_name:   String(r.source_name ?? ""),
    url:           String(r.url ?? ""),
    final_partner: String(r.final_partner ?? "[]"),
    total_score:   Number(r.total_score ?? 0),
    alert_level:   String(r.alert_level ?? ""),
  }));

  // DB cluster_key(앞 24자 완전일치) dedup이 못 잡은, 같은 사건의 다른 제목 기사들을
  // 발송 직전에 제목 유사도로 한 번 더 묶어 대표 1건씩만 남긴다. "오늘 수집 N건"
  // 숫자와 TOP 5 모두 이 deduped 집합을 기준으로 산정된다.
  const articles = dedupeForDigest(rawArticles);

  const total   = articles.length;
  const alerts  = articles.filter((a) => a.alert_level === "alert").length;
  const reports = articles.filter((a) => a.alert_level === "report").length;

  const dashboardUrl = process.env.DASHBOARD_URL;

  if (total === 0) {
    const tail = dashboardUrl ? `\n\n🔗 <a href="${dashboardUrl}">대시보드 열기</a>` : "";
    await sendTelegramMessage(
      `📰 <b>[일일 뉴스 모니터링 요약] ${today}</b>\n\n오늘 수집된 기사가 없습니다.${tail}`
    );
    return;
  }

  const topArticles = articles.slice(0, 5);
  const lines = [
    `📰 <b>[일일 뉴스 모니터링 요약] ${today}</b>`,
    ``,
    `📊 오늘 수집: <b>${total}건</b> (긴급 ${alerts}건 / 보고 ${reports}건)`,
    ``,
    `<b>🔝 주요 기사 TOP ${topArticles.length}</b>`,
  ];

  topArticles.forEach((a, i) => {
    const EMOJI: Record<string, string> = { alert: "🚨", report: "📋", hold: "📌" };
    const partners = tryJson(a.final_partner).join(", ") || "없음";
    lines.push(
      ``,
      `${i + 1}. ${EMOJI[a.alert_level] ?? "📰"} <b>${a.title}</b>`,
      `   ${a.source_name} · 총점 ${a.total_score}점 · ${partners}`,
      `   <a href="${a.url}">원문</a>`,
    );
  });

  if (dashboardUrl) {
    lines.push(``, `🔗 <a href="${dashboardUrl}">대시보드 열기</a>`);
  }

  await sendTelegramMessage(lines.join("\n"));
}

function tryJson(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}
