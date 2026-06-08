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

/**
 * scoreArticle은 매 기사마다 같은 3개 SELECT를 친다. ingest처럼 한 번에 수백 건
 * 처리하는 경로에선 이게 60초 timeout의 주범이 되므로 사전에 한 번만 로드해 둔
 * 캐시를 넘긴다. 캐시 키는 lowercase로 사전 변환해 article마다의 toLowerCase도
 * 줄였다.
 */
export interface ScoringCache {
  partnerKeywords: { keywordLower: string; partner_name: string }[];
  scoringKeywords: { keywordLower: string; keyword: string; score: number }[];
  sourceScores:    Map<string, number>;
}

export async function loadScoringCache(db: Client): Promise<ScoringCache> {
  const [partnerRes, scoringRes, srcRes] = await Promise.all([
    db.execute(
      `SELECT pk.keyword, pk.partner_name
       FROM partner_keywords pk
       JOIN partners p ON p.id = pk.partner_id
       WHERE pk.is_active = 1 AND p.is_active = 1`
    ),
    db.execute("SELECT keyword, score FROM scoring_keywords WHERE is_active = 1"),
    db.execute("SELECT source_name, source_score FROM sources"),
  ]);

  return {
    partnerKeywords: partnerRes.rows.map((r) => ({
      keywordLower: String(r.keyword).toLowerCase(),
      partner_name: String(r.partner_name),
    })),
    scoringKeywords: scoringRes.rows.map((r) => ({
      keywordLower: String(r.keyword).toLowerCase(),
      keyword:      String(r.keyword),
      score:        Number(r.score),
    })),
    sourceScores: new Map(
      srcRes.rows.map((r) => [String(r.source_name), Number(r.source_score)])
    ),
  };
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
  cache?: ScoringCache,
): Promise<ScoreResult> {
  const c    = cache ?? (await loadScoringCache(db));
  const text = haystack(title, summary, body);

  // ── 1. 파트너 키워드 매칭 ──────────────────────────────
  const matchedPartnerSet = new Set<string>();
  for (const { keywordLower, partner_name } of c.partnerKeywords) {
    if (text.includes(keywordLower)) matchedPartnerSet.add(partner_name);
  }
  const auto_partners = [...matchedPartnerSet];

  // ── 2. 스코어링 키워드 매칭 ──────────────────────────────
  const matchedKwSet = new Set<string>();
  let keyword_score  = 0;
  for (const { keywordLower, keyword, score } of c.scoringKeywords) {
    if (text.includes(keywordLower)) {
      matchedKwSet.add(keyword);
      keyword_score += score;
    }
  }
  const matched_keywords = [...matchedKwSet];

  // ── 3. 출처 점수 ──────────────────────────────────────
  const source_score = c.sourceScores.get(sourceName) ?? 1;

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
