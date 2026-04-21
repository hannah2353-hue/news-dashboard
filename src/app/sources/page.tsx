"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Source {
  id: number; source_name: string; tier: string; source_type: string;
  url: string | null; is_active: number; source_score: number; last_collected_at: string | null;
}

const TIER_LABEL: Record<string, string> = { wire: "통신사(3점)", economy: "경제지(2점)", general: "일반(1점)" };
const TIER_COLOR: Record<string, string> = {
  wire:    "bg-blue-100 text-blue-700",
  economy: "bg-amber-100 text-amber-700",
  general: "bg-slate-100 text-slate-600",
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm]       = useState({ source_name: "", tier: "economy", source_type: "rss", url: "", source_score: 2 });

  async function load() {
    const d = await fetch("/api/sources").then((r) => r.json());
    setSources(d);
  }
  useEffect(() => { load(); }, []);

  async function toggle(s: Source) {
    await fetch(`/api/sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: s.is_active ? 0 : 1 }),
    });
    load();
  }

  async function del(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    load();
  }

  async function add() {
    if (!form.source_name.trim()) return;
    await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ source_name: "", tier: "economy", source_type: "rss", url: "", source_score: 2 });
    load();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">수집 소스 관리</h1>
        <span className="text-sm text-slate-400">{sources.filter((s) => s.is_active).length}개 활성</span>
      </div>

      {/* 추가 폼 */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">신규 소스 추가</p>
        <div className="flex flex-wrap gap-2">
          <input value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })}
            placeholder="언론사명" className="input-sm w-36" />
          <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value, source_score: e.target.value === "wire" ? 3 : e.target.value === "economy" ? 2 : 1 })}
            className="input-sm">
            {Object.entries(TIER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}
            className="input-sm">
            <option value="rss">RSS</option>
            <option value="html">HTML</option>
          </select>
          <input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="RSS/수집 URL" className="input-sm w-72" />
          <button onClick={add} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> 추가
          </button>
        </div>
      </div>

      {/* 소스 테이블 */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="th">언론사</th>
              <th className="th">구분</th>
              <th className="th">수집방식</th>
              <th className="th">출처점수</th>
              <th className="th">URL</th>
              <th className="th">최근 수집</th>
              <th className="th text-center">활성</th>
              <th className="th text-center">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sources.map((s) => (
              <tr key={s.id} className={s.is_active ? "" : "opacity-50"}>
                <td className="td font-medium">{s.source_name}</td>
                <td className="td">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${TIER_COLOR[s.tier] ?? "bg-slate-100"}`}>
                    {TIER_LABEL[s.tier] ?? s.tier}
                  </span>
                </td>
                <td className="td uppercase text-xs font-mono">{s.source_type}</td>
                <td className="td font-bold text-center">{s.source_score}</td>
                <td className="td max-w-xs">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-xs truncate block max-w-[240px]">
                      {s.url}
                    </a>
                  ) : <span className="text-slate-300">-</span>}
                </td>
                <td className="td text-xs text-slate-400">
                  {s.last_collected_at?.slice(0, 16) ?? "-"}
                </td>
                <td className="td text-center">
                  <button onClick={() => toggle(s)}>
                    {s.is_active
                      ? <ToggleRight size={20} className="text-green-500" />
                      : <ToggleLeft  size={20} className="text-slate-400" />}
                  </button>
                </td>
                <td className="td text-center">
                  <button onClick={() => del(s.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
