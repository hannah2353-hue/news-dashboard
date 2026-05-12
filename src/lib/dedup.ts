import type { Client } from "@libsql/client";

/**
 * 제목을 정규화해서 클러스터 키로 만든다.
 *
 * - 같은 통신사 기사를 여러 매체가 그대로 송고하는 경우가 많아 제목 일치율이 매우 높다.
 * - 매체별로 끝에 " - 매체명"이 붙기 때문에 그 부분은 제거한다.
 * - 띄어쓰기, 따옴표, 마침표는 매체마다 미세하게 다르므로 한글/영문/숫자만 남긴다.
 * - 너무 짧으면 충돌이 많아지니 길이 12 미만은 빈 키로 반환 (= 클러스터링에서 제외).
 */
export function buildClusterKey(title: string): string {
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

  // 한글/영문/숫자만 남김
  const compact = t.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");

  if (compact.length < 12) return "";
  // 매우 긴 제목은 앞쪽이 충분히 변별력 있으니 24자만 사용
  return compact.slice(0, 24);
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
