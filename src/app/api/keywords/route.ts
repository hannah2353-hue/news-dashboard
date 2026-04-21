import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db   = await getDb();
  const type = req.nextUrl.searchParams.get("type");

  if (type === "exclusion") {
    const res = await db.execute(
      "SELECT * FROM exclusion_keywords ORDER BY is_override, reason, keyword"
    );
    return NextResponse.json(res.rows);
  }
  const res = await db.execute(
    "SELECT * FROM scoring_keywords ORDER BY score DESC, keyword"
  );
  return NextResponse.json(res.rows);
}

export async function POST(req: NextRequest) {
  const db   = await getDb();
  const body = await req.json();
  const type = req.nextUrl.searchParams.get("type");

  if (type === "exclusion") {
    const r = await db.execute({
      sql:  "INSERT OR IGNORE INTO exclusion_keywords (keyword, reason, is_override) VALUES (?, ?, ?)",
      args: [body.keyword, body.reason ?? "sports", body.is_override ?? 0],
    });
    return NextResponse.json({ id: Number(r.lastInsertRowid ?? 0) });
  }
  const r = await db.execute({
    sql:  "INSERT OR IGNORE INTO scoring_keywords (keyword, score, category) VALUES (?, ?, ?)",
    args: [body.keyword, body.score ?? 2, body.category ?? "partnership"],
  });
  return NextResponse.json({ id: Number(r.lastInsertRowid ?? 0) });
}
