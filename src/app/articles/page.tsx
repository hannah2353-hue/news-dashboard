"use client";
import { useEffect, useState, useCallback } from "react";
import FilterBar, { defaultFilters } from "@/components/FilterBar";
import ArticleTable from "@/components/ArticleTable";
import ArticleDrawer from "@/components/ArticleDrawer";
import type { Article } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Filters = ReturnType<typeof defaultFilters>;

export default function ArticlesPage() {
  const [filters, setFilters]       = useState<Filters>(defaultFilters());
  const [articles, setArticles]     = useState<Article[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<Article | null>(null);
  const [partners, setPartners]     = useState<string[]>([]);
  const [sources, setSources]       = useState<string[]>([]);

  const PAGE_SIZE = 20;

  useEffect(() => {
    fetch("/api/partners").then((r) => r.json()).then((d: { partner_name: string }[]) =>
      setPartners(d.map((p) => p.partner_name))
    );
    fetch("/api/sources").then((r) => r.json()).then((d: { source_name: string }[]) =>
      setSources(d.map((s) => s.source_name))
    );
  }, []);

  const load = useCallback(async (f: Filters, pg: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    if (f.dateTo)   params.set("dateTo",   f.dateTo);
    if (f.partner)  params.set("partner",  f.partner);
    if (f.source)   params.set("source",   f.source);
    if (f.alertLevel) params.set("alertLevel", f.alertLevel);
    if (f.status)   params.set("status",   f.status);
    if (f.includeExcluded) params.set("includeExcluded", "true");
    if (f.search)   params.set("search",   f.search);
    params.set("page", String(pg));
    params.set("pageSize", String(PAGE_SIZE));

    const res  = await fetch(`/api/articles?${params}`);
    const data = await res.json();
    setArticles(data.rows);
    setTotal(data.total);
    setLoading(false);
  }, []);

  useEffect(() => { load(filters, page); }, [filters, page, load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">기사 리스트</h1>
          <p className="text-sm text-slate-400 mt-0.5">총 {total.toLocaleString()}건</p>
        </div>
      </div>

      <FilterBar
        filters={filters}
        partners={partners}
        sources={sources}
        onChange={(f) => { setFilters(f); setPage(1); }}
        onReset={() => { setFilters(defaultFilters()); setPage(1); }}
      />

      <div className="card">
        {loading ? (
          <div className="text-center py-16 text-slate-400">로딩 중...</div>
        ) : (
          <ArticleTable
            articles={articles}
            onSelect={setSelected}
            selected={selected?.id}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">{page} / {totalPages} 페이지</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const pg = page <= 4 ? i + 1 : page - 3 + i;
                if (pg < 1 || pg > totalPages) return null;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-8 h-8 text-xs rounded ${pg === page ? "bg-blue-600 text-white" : "hover:bg-slate-100"}`}>
                    {pg}
                  </button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ArticleDrawer
        key={selected?.id ?? "none"}
        article={selected}
        onClose={() => setSelected(null)}
        onSaved={(updated) => {
          setArticles((prev) => prev.map((a) => a.id === updated.id ? updated : a));
          setSelected(updated);
        }}
      />
    </div>
  );
}
