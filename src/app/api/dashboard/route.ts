import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { kstDateString } from "@/lib/datetime";

export const dynamic = "force-dynamic";

async function scalar(db: Awaited<ReturnType<typeof getDb>>, sql: string, args: (string | number)[] = []) {
  const res = await db.execute({ sql, args });
  return Number(res.rows[0]?.n ?? 0);
}

export async function GET() {
  const db    = await getDb();
  const today = kstDateString();

  const todayTotal    = await scalar(db, "SELECT COUNT(*) as n FROM articles WHERE DATE(published_at) = ? AND status != 'excluded'", [today]);
  const todayAlert    = await scalar(db, "SELECT COUNT(*) as n FROM articles WHERE DATE(published_at) = ? AND alert_level = 'alert' AND status != 'excluded'", [today]);
  const todayExcluded = await scalar(db, "SELECT COUNT(*) as n FROM articles WHERE DATE(published_at) = ? AND status = 'excluded'", [today]);
  const activePartners = await scalar(db, "SELECT COUNT(*) as n FROM partners WHERE is_active = 1");

  const weeklyRes = await db.execute(`
    SELECT
      DATE(published_at) as date,
      COUNT(*) as count,
      SUM(CASE WHEN alert_level = 'alert' AND status != 'excluded' THEN 1 ELSE 0 END) as alert
    FROM articles
    WHERE published_at >= date('now', '+9 hours', '-13 days')
      AND status != 'excluded'
    GROUP BY DATE(published_at)
    ORDER BY date ASC
  `);
  const weeklyTrend = weeklyRes.rows.map((r) => ({
    date:  String(r.date),
    count: Number(r.count),
    alert: Number(r.alert),
  }));

  const articlesRes = await db.execute("SELECT final_partner, alert_level, status FROM articles");
  const partnerMap: Record<string, { total: number; alert: number }> = {};
  for (const r of articlesRes.rows) {
    const status = String(r.status);
    if (status === "excluded") continue;
    let partners: string[] = [];
    try { partners = JSON.parse(String(r.final_partner)); } catch { partners = []; }
    const alert = String(r.alert_level);
    for (const p of partners) {
      if (!partnerMap[p]) partnerMap[p] = { total: 0, alert: 0 };
      partnerMap[p].total++;
      if (alert === "alert") partnerMap[p].alert++;
    }
  }
  const byPartner = Object.entries(partnerMap)
    .map(([partner, v]) => ({ partner, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const bySourceRes = await db.execute(`
    SELECT source_name as source, COUNT(*) as count
    FROM articles
    WHERE status != 'excluded'
    GROUP BY source_name
    ORDER BY count DESC
    LIMIT 10
  `);
  const bySource = bySourceRes.rows.map((r) => ({
    source: String(r.source),
    count:  Number(r.count),
  }));

  const reasonRes = await db.execute(`
    SELECT
      COALESCE(exclude_reason, 'none') as reason,
      COUNT(*) as count
    FROM articles
    WHERE status = 'excluded'
    GROUP BY exclude_reason
  `);
  const byExcludeReason = reasonRes.rows.map((r) => ({
    reason: String(r.reason),
    count:  Number(r.count),
  }));

  return NextResponse.json({
    todayTotal, todayAlert, todayExcluded, activePartners,
    weeklyTrend, byPartner, bySource, byExcludeReason,
  });
}
