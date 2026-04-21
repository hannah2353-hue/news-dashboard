import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb();
  const pRes = await db.execute({ sql: "SELECT * FROM partners WHERE id = ?", args: [params.id] });
  const kRes = await db.execute({
    sql:  "SELECT * FROM partner_keywords WHERE partner_id = ? ORDER BY keyword_type, keyword",
    args: [params.id],
  });
  return NextResponse.json({ partner: pRes.rows[0] ?? null, keywords: kRes.rows });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = await getDb();
  const body = await req.json();
  if ("is_active" in body) {
    await db.execute({ sql: "UPDATE partners SET is_active = ? WHERE id = ?", args: [body.is_active, params.id] });
  }
  if ("partner_name" in body) {
    await db.execute({ sql: "UPDATE partners SET partner_name = ? WHERE id = ?", args: [body.partner_name, params.id] });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM partner_keywords WHERE partner_id = ?", args: [params.id] });
  await db.execute({ sql: "DELETE FROM partners WHERE id = ?",                 args: [params.id] });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = await getDb();
  const body = await req.json();
  const pRes = await db.execute({ sql: "SELECT partner_name FROM partners WHERE id = ?", args: [params.id] });
  if (pRes.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const partnerName = String(pRes.rows[0].partner_name);
  const r = await db.execute({
    sql:  "INSERT OR IGNORE INTO partner_keywords (partner_id, partner_name, keyword, keyword_type) VALUES (?, ?, ?, ?)",
    args: [params.id, partnerName, body.keyword, body.keyword_type ?? "alias"],
  });
  return NextResponse.json({ id: Number(r.lastInsertRowid ?? 0) });
}
