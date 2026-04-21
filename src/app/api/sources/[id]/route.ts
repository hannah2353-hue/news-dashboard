import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type SqlVal = string | number | null;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = await getDb();
  const body = await req.json();
  const sets: string[] = [];
  const vals: SqlVal[] = [];
  for (const f of ["source_name","tier","source_type","url","is_active","source_score"]) {
    if (f in body) { sets.push(`${f}=?`); vals.push((body as Record<string, SqlVal>)[f]); }
  }
  if (sets.length) {
    await db.execute({
      sql:  `UPDATE sources SET ${sets.join(",")} WHERE id=?`,
      args: [...vals, params.id],
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM sources WHERE id=?", args: [params.id] });
  return NextResponse.json({ ok: true });
}
