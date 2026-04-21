"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface ScoringKw  { id: number; keyword: string; score: number; category: string; is_active: number; }
interface ExclusionKw{ id: number; keyword: string; reason: string; is_override: number; is_active: number; }

type TabType = "scoring" | "exclusion" | "override";

const CATEGORY_LABEL: Record<string, string> = {
  partnership: "제휴/협력", financial: "금융거래", risk: "리스크", tech: "기술/출시",
};
const CATEGORY_COLOR: Record<string, string> = {
  partnership: "bg-blue-100 text-blue-700",
  financial:   "bg-green-100 text-green-700",
  risk:        "bg-red-100 text-red-700",
  tech:        "bg-purple-100 text-purple-700",
};
const REASON_LABEL: Record<string, string> = {
  sports: "스포츠", sports_sponsor: "스포츠후원", csr: "사회공헌", marketing: "마케팅",
};

export default function KeywordsPage() {
  const [tab, setTab]         = useState<TabType>("scoring");
  const [scoring, setScoring] = useState<ScoringKw[]>([]);
  const [exclusion, setExclusion] = useState<ExclusionKw[]>([]);
  const [override, setOverride]   = useState<ExclusionKw[]>([]);

  const [newSk, setNewSk]   = useState({ keyword: "", score: 2, category: "partnership" });
  const [newEk, setNewEk]   = useState({ keyword: "", reason: "sports" });
  const [newOk, setNewOk]   = useState({ keyword: "" });

  async function loadAll() {
    const [sk, ek] = await Promise.all([
      fetch("/api/keywords?type=scoring").then((r) => r.json()),
      fetch("/api/keywords?type=exclusion").then((r) => r.json()),
    ]);
    setScoring(sk);
    setExclusion(ek.filter((k: ExclusionKw) => k.is_override === 0));
    setOverride(ek.filter((k: ExclusionKw)  => k.is_override === 1));
  }
  useEffect(() => { loadAll(); }, []);

  async function addScoring() {
    if (!newSk.keyword.trim()) return;
    await fetch("/api/keywords?type=scoring", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newSk),
    });
    setNewSk({ keyword: "", score: 2, category: "partnership" });
    loadAll();
  }

  async function addExclusion() {
    if (!newEk.keyword.trim()) return;
    await fetch("/api/keywords?type=exclusion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newEk, is_override: 0 }),
    });
    setNewEk({ keyword: "", reason: "sports" });
    loadAll();
  }

  async function addOverride() {
    if (!newOk.keyword.trim()) return;
    await fetch("/api/keywords?type=exclusion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newOk.keyword, reason: "sports", is_override: 1 }),
    });
    setNewOk({ keyword: "" });
    loadAll();
  }

  async function deleteSk(id: number) {
    await fetch(`/api/keywords/${id}?type=scoring`, { method: "DELETE" });
    loadAll();
  }
  async function deleteEk(id: number) {
    await fetch(`/api/keywords/${id}?type=exclusion`, { method: "DELETE" });
    loadAll();
  }

  const TABS: { key: TabType; label: string; count: number }[] = [
    { key: "scoring",   label: "스코어링 키워드",    count: scoring.length },
    { key: "exclusion", label: "제외 키워드",         count: exclusion.length },
    { key: "override",  label: "제외취소 핵심 키워드", count: override.length },
  ];

  return (
    <div className="p-6 space-y-5">
      <h1 className="page-title">키워드 정책</h1>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {label} <span className="ml-1 text-xs opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {/* 스코어링 */}
      {tab === "scoring" && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center gap-2">
            <input value={newSk.keyword} onChange={(e) => setNewSk({ ...newSk, keyword: e.target.value })}
              placeholder="키워드..." className="input-sm w-40" />
            <input type="number" value={newSk.score} onChange={(e) => setNewSk({ ...newSk, score: Number(e.target.value) })}
              className="input-sm w-20" min={1} max={10} />
            <select value={newSk.category} onChange={(e) => setNewSk({ ...newSk, category: e.target.value })}
              className="input-sm">
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={addScoring} className="btn-primary flex items-center gap-1.5">
              <Plus size={14} /> 추가
            </button>
          </div>
          <div className="card divide-y divide-slate-100">
            {scoring.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{k.keyword}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLOR[k.category] ?? "bg-slate-100 text-slate-600"}`}>
                    {CATEGORY_LABEL[k.category] ?? k.category}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-blue-600">+{k.score}점</span>
                  <button onClick={() => deleteSk(k.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 제외 키워드 */}
      {tab === "exclusion" && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center gap-2">
            <input value={newEk.keyword} onChange={(e) => setNewEk({ ...newEk, keyword: e.target.value })}
              placeholder="제외 키워드..." className="input-sm w-40" />
            <select value={newEk.reason} onChange={(e) => setNewEk({ ...newEk, reason: e.target.value })}
              className="input-sm">
              {Object.entries(REASON_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={addExclusion} className="btn-primary flex items-center gap-1.5">
              <Plus size={14} /> 추가
            </button>
          </div>
          <div className="card divide-y divide-slate-100">
            {exclusion.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-5 py-3">
                <span className="font-medium">{k.keyword}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                    {REASON_LABEL[k.reason] ?? k.reason}
                  </span>
                  <button onClick={() => deleteEk(k.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 제외취소 */}
      {tab === "override" && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
            제외 키워드가 매칭되더라도 아래 핵심 비즈니스 키워드가 함께 있으면 제외가 취소됩니다.
          </div>
          <div className="card p-4 flex items-center gap-2">
            <input value={newOk.keyword} onChange={(e) => setNewOk({ keyword: e.target.value })}
              placeholder="핵심 비즈니스 키워드..." className="input-sm w-48" />
            <button onClick={addOverride} className="btn-primary flex items-center gap-1.5">
              <Plus size={14} /> 추가
            </button>
          </div>
          <div className="card divide-y divide-slate-100">
            {override.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-5 py-3">
                <span className="font-medium">{k.keyword}</span>
                <button onClick={() => deleteEk(k.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
