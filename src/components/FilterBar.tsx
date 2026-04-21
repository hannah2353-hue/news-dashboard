"use client";

interface FilterState {
  dateFrom: string;
  dateTo: string;
  partner: string;
  source: string;
  alertLevel: string;
  status: string;
  includeExcluded: boolean;
  search: string;
}

interface Props {
  filters: FilterState;
  partners: string[];
  sources: string[];
  onChange: (f: FilterState) => void;
  onReset: () => void;
}

export const defaultFilters = (): FilterState => ({
  dateFrom: "", dateTo: "", partner: "", source: "",
  alertLevel: "", status: "", includeExcluded: false, search: "",
});

export default function FilterBar({ filters, partners, sources, onChange, onReset }: Props) {
  const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    onChange({ ...filters, [key]: val });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex flex-wrap gap-3">
        {/* 기간 */}
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <label className="text-xs text-slate-500 shrink-0">기간</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)}
            className="input-sm flex-1 sm:flex-none" />
          <span className="text-slate-400 text-xs">~</span>
          <input type="date" value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)}
            className="input-sm flex-1 sm:flex-none" />
        </div>

        {/* 제휴사 */}
        <select value={filters.partner} onChange={(e) => set("partner", e.target.value)} className="input-sm">
          <option value="">전체 제휴사</option>
          {partners.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* 언론사 */}
        <select value={filters.source} onChange={(e) => set("source", e.target.value)} className="input-sm">
          <option value="">전체 언론사</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* 중요도 */}
        <select value={filters.alertLevel} onChange={(e) => set("alertLevel", e.target.value)} className="input-sm">
          <option value="">전체 중요도</option>
          <option value="alert">긴급</option>
          <option value="report">보고</option>
          <option value="hold">보류</option>
        </select>

        {/* 상태 */}
        <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="input-sm">
          <option value="">전체 상태</option>
          <option value="new">신규</option>
          <option value="reviewed">검토완료</option>
          <option value="excluded">제외</option>
          <option value="reported">보고완료</option>
        </select>

        {/* 제외 포함 */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={filters.includeExcluded}
            onChange={(e) => set("includeExcluded", e.target.checked)}
            className="rounded border-slate-300" />
          제외기사 포함
        </label>

        {/* 검색 */}
        <input
          type="text" placeholder="제목/요약 검색..." value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="input-sm w-44"
        />

        <button onClick={onReset}
          className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          초기화
        </button>
      </div>
    </div>
  );
}
