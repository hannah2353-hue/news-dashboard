// 서버 타임존과 무관하게 항상 한국 시간(KST, UTC+9) 기준으로 반환한다.
// Vercel은 UTC라서 KST 아침 8시가 UTC 전날 23시로 잡히면서
// "오늘" 쿼리가 전날 데이터를 가져오는 버그를 막기 위함.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function kstDbDate(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}
