import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type SqlVal = string | number | null;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db   = await getDb();
  const body = await req.json();
  const type = req.nextUrl.searchParams.get("type");

  if (type === "exclusion") {
    const sets: string[] = [];
    const vals: SqlVal[] = [];
    for (const f of ["keyword", "reason", "is_override", "is_active"]) {
      if (f in body) { sets.push(`${f}=?`); vals.push((body as Record<string, SqlVal>)[f]); }
    }
    if (sets.length) {
      await db.execute({
        sql:  `UPDATE exclusion_keywords SET ${sets.join(",")} WHERE id=?`,
        args: [...vals, params.id],
      });
    }
    return NextResponse.json({ ok: true });
  }
  const sets: string[] = [];
  const vals: SqlVal[] = [];
  for (const f of ["keyword", "score", "category", "is_active"]) {
    if (f in body) { sets.push(`${f}=?`); vals.push((body as Record<string, SqlVal>)[f]); }
  }
  if (sets.length) {
    await db.execute({
      sql:  `UPDATE scoring_keywords SET ${sets.join(",")} WHERE id=?`,
      args: [...vals, params.id],
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db   = await getDb();
  const type = _req.nextUrl.searchParams.get("type");
  if (type === "exclusion") {
    await db.execute({ sql: "DELETE FROM exclusion_keywords WHERE id=?", args: [params.id] });
  } else {
    await db.execute({ sql: "DELETE FROM scoring_keywords WHERE id=?",   args: [params.id] });
  }
  return NextResponse.json({ ok: true });
}
