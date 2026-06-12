import type { Client } from "@libsql/client";

/**
 * 제목을 정규화해서 클러스터 키로 만든다.
 *
 * - 같은 통신사 기사를 여러 매체가 그대로 송고하는 경우가 많아 제목 일치율이 매우 높다.
 * - 매체별로 끝에 " - 매체명"이 붙기 때문에 그 부분은 제거한다.
 * - 띄어쓰기, 따옴표, 마침표는 매체마다 미세하게 다르므로 한글/영문/숫자만 남긴다.
 * - 너무 짧으면 충돌이 많아지니 길이 12 미만은 빈 키로 반환 (= 클러스터링에서 제외).
 */
/**
 * 제목에서 매체명 꼬리표(" - 매체명")와 머리표([속보] 등)를 떼어낸 '본문 제목'을 돌려준다.
 * 공백/대소문자는 유지 — 토큰 분리용으로도 쓰기 위함.
 */
export function stripTitleDecorations(title: string): string {
  if (!title) return "";
  let t = title.trim();

  // 끝의 " - 매체명", " | 매체명", " · 매체명" 같은 꼬리표 제거 (한두 번 반복 가능)
  for (let i = 0; i < 2; i++) {
    const m = t.match(/^(.+?)\s*[-–—|·]\s*[^-–—|·]{2,30}$/u);
    if (!m) break;
    t = m[1].trim();
  }

  // 흔한 머리표 [속보], [단독], <단독> 등 제거
  t = t.replace(/^(\[[^\]]{1,8}\]|<[^>]{1,8}>)\s*/gu, "");

  return t.trim();
}

export function buildClusterKey(title: string): string {
  const t = stripTitleDecorations(title);

  // 한글/영문/숫자만 남김
  const compact = t.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");

  if (compact.length < 12) return "";
  // 매우 긴 제목은 앞쪽이 충분히 변별력 있으니 24자만 사용
  return compact.slice(0, 24);
}

/** 정규화 제목(매체명/머리표 제거 + 한글·영문·숫자만, 공백 제거) */
function compactTitle(title: string): string {
  return stripTitleDecorations(title)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

/**
 * 글자 단위 n-gram 집합. 한국어는 띄어쓰기·조사가 매체마다 달라 단어 토큰이
 * 쉽게 쪼개지므로("중금리대출" vs "중금리 대출"), 공백을 없앤 문자열의 글자
 * 3-gram으로 비교하면 표현 차이에 훨씬 강건하다.
 */
function charNgrams(s: string, n = 3): Set<string> {
  const out = new Set<string>();
  if (s.length < n) {
    if (s.length > 0) out.add(s);
    return out;
  }
  for (let i = 0; i + n <= s.length; i++) out.add(s.slice(i, i + n));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** 제목을 단어 토큰(2글자 이상) 집합으로. 어순이 바뀐 같은 기사를 잡기 위함. */
function titleTokens(title: string): Set<string> {
  return new Set(
    stripTitleDecorations(title)
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s]+/gu, " ")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2),
  );
}

/** final_partner(JSON 문자열)를 정규화한 제휴사 키. 같은 제휴사 집합이면 같은 키. */
function partnerKey(finalPartner: string | undefined): string {
  let arr: unknown;
  try { arr = JSON.parse(finalPartner ?? "[]"); } catch { arr = []; }
  if (!Array.isArray(arr)) return "";
  return [...new Set(arr.map((x) => String(x).trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join("|");
}

/**
 * 발송 직전 in-memory 2차 중복 제거.
 *
 * DB의 cluster_key(앞 24자 완전일치) 기반 dedup은 같은 사건을 매체마다 다르게 쓴
 * 제목(길이/표현/띄어쓰기 차이)을 못 잡는다. 여기서 더 공격적으로 한 번 더 묶어
 * 클러스터마다 점수가 가장 높은 1건만 대표로 남긴다.
 *
 * 핵심: 순수 글자 유사도만 낮추면 'OK저축은행 ○○'과 '웰컴저축은행 ○○'처럼 회사만
 * 다른 기사가 잘못 합쳐진다("저축은행 ○○" 부분이 겹쳐서 유사도가 높음). 그래서
 * **같은 제휴사(final_partner) 집합일 때만** 유사도로 묶고, 회사가 다르면 절대 안 묶는다.
 * 제휴사 가드가 보호해주므로 같은 회사 안에서는 기준을 과감하게 낮출 수 있다.
 *
 * 묶는 기준 (하나라도 만족하면 같은 기사로 간주):
 *  1) 정규화 제목(공백 제거)이 완전히 동일 — 사실상 같은 송고 (제휴사 무관)
 *  2) 같은 제휴사 집합 + (글자 3-gram 유사도 ≥ gramThreshold  OR  단어 토큰 유사도 ≥ tokenThreshold)
 *     - 3-gram: 표현/띄어쓰기 차이에 강건  /  토큰: 어순이 바뀐 같은 기사를 잡음
 *
 * union-find의 전이성 덕분에 A~B, B~C면 A·B·C가 한 클러스터로 묶인다.
 * 대표는 total_score가 가장 높은 건 — 발송 메시지에 노출할 가치가 가장 큰 기사.
 */
export function dedupeForDigest<T extends { title: string; total_score: number; final_partner?: string }>(
  articles: T[],
  opts: { gramThreshold?: number; tokenThreshold?: number } = {},
): T[] {
  const gramThreshold  = opts.gramThreshold  ?? 0.22;
  const tokenThreshold = opts.tokenThreshold ?? 0.28;
  const n = articles.length;
  if (n <= 1) return [...articles];

  const compacts = articles.map((a) => compactTitle(a.title));
  const grams    = compacts.map((c) => charNgrams(c, 3));
  const tokens   = articles.map((a) => titleTokens(a.title));
  const pkeys    = articles.map((a) => partnerKey(a.final_partner));

  // union-find로 유사 기사들을 한 덩어리로 묶는다.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const exact = compacts[i].length >= 8 && compacts[i] === compacts[j];

      const samePartner = pkeys[i] === pkeys[j];
      const fuzzy =
        samePartner &&
        compacts[i].length >= 8 &&
        compacts[j].length >= 8 &&
        (jaccard(grams[i], grams[j]) >= gramThreshold ||
          jaccard(tokens[i], tokens[j]) >= tokenThreshold);

      if (exact || fuzzy) union(i, j);
    }
  }

  // 클러스터별 대표(최고 점수) 1건만 추린다.
  const bestByRoot = new Map<number, T>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const cur = bestByRoot.get(r);
    if (!cur || articles[i].total_score > cur.total_score) bestByRoot.set(r, articles[i]);
  }

  return [...bestByRoot.values()].sort((a, b) => b.total_score - a.total_score);
}

/**
 * cluster_key가 비어있는 articles를 모두 채운다.
 * (마이그레이션 직후 첫 실행에서만 의미가 있고, 그 다음부터는 INSERT가 채우므로 0건 처리됨.)
 */
export async function backfillClusterKeys(db: Client): Promise<number> {
  const res = await db.execute(
    "SELECT id, title FROM articles WHERE cluster_key IS NULL OR cluster_key = ''"
  );
  let n = 0;
  for (const r of res.rows) {
    const id    = Number(r.id);
    const title = String(r.title ?? "");
    const key   = buildClusterKey(title);
    if (!key) continue;
    await db.execute({
      sql:  "UPDATE articles SET cluster_key = ? WHERE id = ?",
      args: [key, id],
    });
    n++;
  }
  return n;
}

/**
 * cluster_key 그룹별로 published_at이 가장 빠른 1건만 is_duplicate=0,
 * 나머지는 is_duplicate=1로 마킹한다.
 *
 * cluster_key가 빈 row(짧은 제목 등)는 손대지 않아서 그대로 표시된다.
 */
export async function applyDedup(db: Client): Promise<{ winners: number; duplicates: number }> {
  // 1단계: 클러스터에 속한 모든 row를 일단 중복 처리
  await db.execute(
    "UPDATE articles SET is_duplicate = 1 WHERE cluster_key != '' AND cluster_key IS NOT NULL"
  );

  // 2단계: 각 클러스터의 winner(가장 빠른 published_at, 동률이면 id가 작은 쪽)만 is_duplicate=0
  await db.execute(`
    UPDATE articles
    SET is_duplicate = 0
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY cluster_key
                 ORDER BY published_at ASC, id ASC
               ) AS rn
        FROM articles
        WHERE cluster_key != '' AND cluster_key IS NOT NULL
      )
      WHERE rn = 1
    )
  `);

  const winnersRes = await db.execute(
    "SELECT COUNT(*) AS n FROM articles WHERE cluster_key != '' AND cluster_key IS NOT NULL AND is_duplicate = 0"
  );
  const dupsRes = await db.execute(
    "SELECT COUNT(*) AS n FROM articles WHERE cluster_key != '' AND cluster_key IS NOT NULL AND is_duplicate = 1"
  );

  return {
    winners:    Number(winnersRes.rows[0]?.n ?? 0),
    duplicates: Number(dupsRes.rows[0]?.n ?? 0),
  };
}

/**
 * 신규 ingest 후 호출할 통합 dedup. backfill까지 함께 수행.
 */
export async function runDedup(db: Client): Promise<{
  backfilled: number;
  winners:    number;
  duplicates: number;
}> {
  const backfilled = await backfillClusterKeys(db);
  const { winners, duplicates } = await applyDedup(db);
  return { backfilled, winners, duplicates };
}
