import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db  = await getDb();
  const res = await db.execute(
    "SELECT p.*, (SELECT COUNT(*) FROM partner_keywords pk WHERE pk.partner_id = p.id AND pk.is_active=1) as keyword_count FROM partners p ORDER BY p.partner_name"
  );
  return NextResponse.json(res.rows);
}

export async function POST(req: NextRequest) {
  const db   = await getDb();
  const body = await req.json();
  const r    = await db.execute({
    sql:  "INSERT INTO partners (partner_name) VALUES (?)",
    args: [body.partner_name],
  });
  return NextResponse.json({ id: Number(r.lastInsertRowid ?? 0) });
}
