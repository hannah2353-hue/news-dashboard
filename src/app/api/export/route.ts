import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  sports: "스포츠",
  sports_sponsor: "스포츠후원",
  csr: "사회공헌",
  marketing: "마케팅",
};

const ALERT_LABEL: Record<string, string> = {
  alert: "긴급",
  report: "보고",
  hold: "보류",
};

const STATUS_LABEL: Record<string, string> = {
  new: "신규",
  reviewed: "검토완료",
  excluded: "제외",
  reported: "보고완료",
};

export async function GET(req: NextRequest) {
  const db  = await getDb();
  const fmt = req.nextUrl.searchParams.get("format") ?? "xlsx";

  const res = await db.execute("SELECT * FROM articles ORDER BY published_at DESC");

  const data = res.rows.map((r) => ({
    "수집시각":       String(r.collected_at ?? ""),
    "발행시각":       String(r.published_at ?? ""),
    "언론사":         String(r.source_name ?? ""),
    "기사제목":       String(r.title ?? ""),
    "요약":           String(r.summary ?? ""),
    "URL":            String(r.url ?? ""),
    "자동매칭제휴사": tryJson(String(r.auto_partners ?? "[]")).join(", "),
    "최종제휴사":     tryJson(String(r.final_partner ?? "[]")).join(", "),
    "매칭키워드":     tryJson(String(r.matched_keywords ?? "[]")).join(", "),
    "출처점수":       Number(r.source_score ?? 0),
    "키워드점수":     Number(r.keyword_score ?? 0),
    "파트너점수":     Number(r.partner_score ?? 0),
    "총점":           Number(r.total_score ?? 0),
    "중요도":         ALERT_LABEL[String(r.alert_level ?? "")] ?? String(r.alert_level ?? ""),
    "상태":           STATUS_LABEL[String(r.status ?? "")] ?? String(r.status ?? ""),
    "제외사유":       r.exclude_reason ? (REASON_LABEL[String(r.exclude_reason)] ?? String(r.exclude_reason)) : "",
    "메모":           String(r.note ?? ""),
    "AI요약":         String(r.ai_summary ?? ""),
    "AI영향도":       String(r.ai_impact ?? ""),
  }));

  if (fmt === "csv") {
    const ws  = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="news_monitoring.csv"',
      },
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    {wch:18},{wch:18},{wch:12},{wch:60},{wch:40},{wch:40},
    {wch:20},{wch:20},{wch:20},{wch:8},{wch:8},{wch:8},{wch:6},{wch:6},{wch:8},{wch:10},{wch:30},{wch:60},{wch:60},
  ];
  XLSX.utils.book_append_sheet(wb, ws, "기사목록");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="news_monitoring.xlsx"',
    },
  });
}

function tryJson(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}
