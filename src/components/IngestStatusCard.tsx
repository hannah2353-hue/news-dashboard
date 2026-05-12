"use client";
import { useEffect, useState } from "react";
import { Activity, AlertCircle, RefreshCw } from "lucide-react";

interface SourceResult {
  source: string;
  url: string;
  fetched: number;
  inserted: number;
  skipped_no_partner: number;
  skipped_too_old: number;
  skipped_duplicate: number;
  skipped_invalid: number;
  error?: string;
}

interface IngestLog {
  id: number;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  total_fetched: number;
  total_inserted: number;
  source_count: number;
  error_count: number;
  sources: SourceResult[];
}

function timeAgoKo(iso: string): string {
  const t  = new Date(iso.replace(" ", "T") + "+09:00").getTime();
  const dt = Date.now() - t;
  if (Number.isNaN(t) || dt < 0) return iso;
  const m = Math.floor(dt / 60_000);
  if (m < 1)  return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export default function IngestStatusCard() {
  const [log, setLog]         = useState<IngestLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/ingest-logs?limit=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setLog(data.logs?.[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="card p-5 text-sm text-slate-400 flex items-center gap-2">
        <RefreshCw size={14} className="animate-spin" /> 수집 상태 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-5 text-sm text-rose-700 flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5" /> 수집 상태 조회 실패: {error}
      </div>
    );
  }

  if (!log) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
          <Activity size={14} /> 최근 수집 상태
        </h2>
        <p className="text-xs text-slate-500">
          아직 수집 기록이 없어요. 관리자 페이지에서 &lsquo;RSS 지금 수집&rsquo;을 한 번 실행하면 이 자리에 통계가 나타납니다.
        </p>
      </div>
    );
  }

  const totalSkipped =
    log.sources.reduce((s, r) => s + r.skipped_no_partner + r.skipped_too_old + r.skipped_duplicate + r.skipped_invalid, 0);
  const noPartner    = log.sources.reduce((s, r) => s + r.skipped_no_partner, 0);
  const tooOld       = log.sources.reduce((s, r) => s + r.skipped_too_old, 0);
  const duplicate    = log.sources.reduce((s, r) => s + r.skipped_duplicate, 0);

  // 효율이 낮은(파트너 매칭 0건이면서 fetched > 0) 소스
  const lowYield = log.sources
    .filter((r) => !r.error && r.fetched > 0 && r.inserted === 0)
    .sort((a, b) => b.fetched - a.fetched)
    .slice(0, 5);
  const errored = log.sources.filter((r) => r.error);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Activity size={14} /> 최근 수집 상태
          <span className="text-xs font-normal text-slate-400">
            {timeAgoKo(log.started_at)} · {(log.duration_ms / 1000).toFixed(1)}s
          </span>
        </h2>
        <button onClick={load} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="RSS 응답" value={log.total_fetched} />
        <Stat label="실제 저장" value={log.total_inserted} tone="green" />
        <Stat label="파트너 키워드 미포함" value={noPartner} tone="amber" />
        <Stat label="중복/너무 오래됨" value={duplicate + tooOld} />
      </div>

      <div className="text-xs text-slate-500 mb-3">
        총 {log.source_count}개 소스 · 에러 {log.error_count}건 · 스킵 {totalSkipped}건
      </div>

      {lowYield.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-slate-600 mb-1.5">⚠️ 받았지만 한 건도 못 건진 소스</div>
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 font-normal">소스</th>
                <th className="py-1 font-normal text-right">받음</th>
                <th className="py-1 font-normal text-right">파트너 X</th>
                <th className="py-1 font-normal text-right">7일 초과</th>
                <th className="py-1 font-normal text-right">중복</th>
              </tr>
            </thead>
            <tbody>
              {lowYield.map((r) => (
                <tr key={r.source} className="border-b border-slate-100">
                  <td className="py-1 text-slate-700 truncate max-w-[180px]">{r.source}</td>
                  <td className="py-1 text-right tabular-nums">{r.fetched}</td>
                  <td className="py-1 text-right tabular-nums text-amber-700">{r.skipped_no_partner}</td>
                  <td className="py-1 text-right tabular-nums text-slate-500">{r.skipped_too_old}</td>
                  <td className="py-1 text-right tabular-nums text-slate-500">{r.skipped_duplicate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errored.length > 0 && (
        <div>
          <div className="text-xs font-medium text-rose-600 mb-1.5">🔴 RSS 응답 실패 ({errored.length})</div>
          <ul className="text-xs text-slate-600 space-y-0.5">
            {errored.slice(0, 5).map((r) => (
              <li key={r.source} className="truncate">
                <span className="text-slate-700">{r.source}</span>
                <span className="text-slate-400"> — {r.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" }) {
  const color =
    tone === "green" ? "text-emerald-700" :
    tone === "amber" ? "text-amber-700"   :
    "text-slate-800";
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
