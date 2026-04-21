import type { Client } from "@libsql/client";

export interface ScoreResult {
  auto_partners: string[];
  matched_keywords: string[];
  source_score: number;
  keyword_score: number;
  partner_score: number;
  total_score: number;
  alert_level: "alert" | "report" | "hold";
}

function haystack(title: string, summary: string, body: string) {
  return `${title} ${summary} ${body}`.toLowerCase();
}

export async function scoreArticle(
  db: Client,
  title: string,
  summary: string,
  body: string,
  sourceName: string,
): Promise<ScoreResult> {
  const text = haystack(title, summary, body);

  // ── 1. 파트너 키워드 매칭 ──────────────────────────────
  const partnerRes = await db.execute(
    `SELECT pk.keyword, pk.partner_name
     FROM partner_keywords pk
     JOIN partners p ON p.id = pk.partner_id
     WHERE pk.is_active = 1 AND p.is_active = 1`
  );

  const matchedPartnerSet = new Set<string>();
  for (const row of partnerRes.rows) {
    const keyword      = String(row.keyword);
    const partner_name = String(row.partner_name);
    if (text.includes(keyword.toLowerCase())) matchedPartnerSet.add(partner_name);
  }
  const auto_partners = [...matchedPartnerSet];

  // ── 2. 스코어링 키워드 매칭 ──────────────────────────────
  const scoringRes = await db.execute(
    "SELECT keyword, score FROM scoring_keywords WHERE is_active = 1"
  );

  const matchedKwSet = new Set<string>();
  let keyword_score  = 0;
  for (const row of scoringRes.rows) {
    const keyword = String(row.keyword);
    const score   = Number(row.score);
    if (text.includes(keyword.toLowerCase())) {
      matchedKwSet.add(keyword);
      keyword_score += score;
    }
  }
  const matched_keywords = [...matchedKwSet];

  // ── 3. 출처 점수 ──────────────────────────────────────
  const srcRes = await db.execute({
    sql:  "SELECT source_score FROM sources WHERE source_name = ?",
    args: [sourceName],
  });
  const source_score = srcRes.rows[0] ? Number(srcRes.rows[0].source_score) : 1;

  // ── 4. 파트너 점수 ────────────────────────────────────
  const partner_score = Math.min(auto_partners.length * 2, 6);

  // ── 5. 총점 + 알림 레벨 ──────────────────────────────
  const total_score = Math.min(source_score + keyword_score + partner_score, 20);
  const alert_level: "alert" | "report" | "hold" =
    total_score >= 8 ? "alert" : total_score >= 5 ? "report" : "hold";

  return {
    auto_partners,
    matched_keywords,
    source_score,
    keyword_score,
    partner_score,
    total_score,
    alert_level,
  };
}
