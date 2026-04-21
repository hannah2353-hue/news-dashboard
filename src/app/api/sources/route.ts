import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db  = await getDb();
  const res = await db.execute("SELECT * FROM sources ORDER BY tier, source_name");
  return NextResponse.json(res.rows);
}

export async function POST(req: NextRequest) {
  const db   = await getDb();
  const body = await req.json();
  const r = await db.execute({
    sql:  "INSERT INTO sources (source_name, tier, source_type, url, source_score) VALUES (?, ?, ?, ?, ?)",
    args: [body.source_name, body.tier ?? "general", body.source_type ?? "rss", body.url ?? null, body.source_score ?? 1],
  });
  return NextResponse.json({ id: Number(r.lastInsertRowid ?? 0) });
}
