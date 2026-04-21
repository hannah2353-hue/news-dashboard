"use client";
import { useEffect, useState } from "react";
import { Plus, ChevronDown, ChevronUp, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Partner { id: number; partner_name: string; is_active: number; keyword_count: number; }
interface Keyword { id: number; keyword: string; keyword_type: string; is_active: number; }

const TYPE_LABEL: Record<string, string> = {
  official: "공식명", alias: "별칭", english: "영문", service: "서비스", corporation: "법인명",
};
const TYPE_COLOR: Record<string, string> = {
  official: "bg-blue-100 text-blue-700", alias: "bg-amber-100 text-amber-700",
  english: "bg-green-100 text-green-700", service: "bg-purple-100 text-purple-700",
  corporation: "bg-slate-100 text-slate-700",
};

export default function PartnersPage() {
  const [partners, setPartners]   = useState<Partner[]>([]);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [keywords, setKeywords]   = useState<Record<number, Keyword[]>>({});
  const [newName, setNewName]     = useState("");
  const [newKw, setNewKw]         = useState({ keyword: "", keyword_type: "alias" });

  async function load() {
    const d = await fetch("/api/partners").then((r) => r.json());
    setPartners(d);
  }
  useEffect(() => { load(); }, []);

  async function toggle(p: Partner) {
    await fetch(`/api/partners/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: p.is_active ? 0 : 1 }),
    });
    load();
  }

  async function addPartner() {
    if (!newName.trim()) return;
    await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_name: newName.trim() }),
    });
    setNewName("");
    load();
  }

  async function expand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const d = await fetch(`/api/partners/${id}`).then((r) => r.json());
    setKeywords((prev) => ({ ...prev, [id]: d.keywords }));
  }

  async function addKw(partnerId: number) {
    if (!newKw.keyword.trim()) return;
    await fetch(`/api/partners/${partnerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newKw),
    });
    const d = await fetch(`/api/partners/${partnerId}`).then((r) => r.json());
    setKeywords((prev) => ({ ...prev, [partnerId]: d.keywords }));
    setNewKw({ keyword: "", keyword_type: "alias" });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">제휴사 관리</h1>
        <span className="text-sm text-slate-400">{partners.filter((p) => p.is_active).length}개 활성</span>
      </div>

      {/* 신규 추가 */}
      <div className="card p-4 flex items-center gap-3">
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="신규 제휴사명 입력..." className="input-sm flex-1" />
        <button onClick={addPartner} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> 추가
        </button>
      </div>

      {/* 리스트 */}
      <div className="card divide-y divide-slate-100">
        {partners.map((p) => (
          <div key={p.id}>
            <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer"
              onClick={() => expand(p.id)}>
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${p.is_active ? "bg-green-400" : "bg-slate-300"}`} />
                <span className="font-medium text-slate-800">{p.partner_name}</span>
                <span className="text-xs text-slate-400">키워드 {p.keyword_count}개</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); toggle(p); }}
                  className="text-slate-400 hover:text-slate-600">
                  {p.is_active ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                </button>
                {expanded === p.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </div>
            </div>

            {expanded === p.id && (
              <div className="px-5 pb-4 bg-slate-50">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(keywords[p.id] ?? []).map((k) => (
                    <span key={k.id}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${TYPE_COLOR[k.keyword_type] ?? "bg-slate-100 text-slate-600"}`}>
                      {k.keyword}
                      <span className="opacity-60">({TYPE_LABEL[k.keyword_type] ?? k.keyword_type})</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input value={newKw.keyword} onChange={(e) => setNewKw({ ...newKw, keyword: e.target.value })}
                    placeholder="키워드 추가..." className="input-sm w-40" />
                  <select value={newKw.keyword_type} onChange={(e) => setNewKw({ ...newKw, keyword_type: e.target.value })}
                    className="input-sm">
                    {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button onClick={() => addKw(p.id)} className="btn-primary py-1.5 text-xs">추가</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
