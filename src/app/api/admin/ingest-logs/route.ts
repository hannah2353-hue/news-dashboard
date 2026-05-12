import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 최근 ingest 실행 기록 조회.
 * ?limit=N (기본 14)
 */
export async function GET(req: NextRequest) {
  const url   = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "14")));

  try {
    const db  = await getDb();
    const res = await db.execute({
      sql:  `SELECT id, started_at, finished_at, duration_ms,
                    total_fetched, total_inserted, source_count, error_count, sources_json
             FROM ingest_logs
             ORDER BY started_at DESC
             LIMIT ?`,
      args: [limit],
    });

    const logs = res.rows.map((r) => {
      let sources: unknown[] = [];
      try {
        sources = JSON.parse(String(r.sources_json ?? "[]"));
      } catch {
        sources = [];
      }
      return {
        id:              Number(r.id),
        started_at:      String(r.started_at),
        finished_at:     String(r.finished_at),
        duration_ms:     Number(r.duration_ms),
        total_fetched:   Number(r.total_fetched),
        total_inserted:  Number(r.total_inserted),
        source_count:    Number(r.source_count),
        error_count:     Number(r.error_count),
        sources,
      };
    });

    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/ingest-logs] 실패:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
