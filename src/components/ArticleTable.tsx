"use client";
import type { Article } from "@/lib/types";
import { AlertBadge, StatusBadge, ReasonBadge } from "./AlertBadge";

function parse(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

function fmt(dt: string) {
  return dt?.slice(0, 16).replace("T", " ") ?? "";
}

interface Props {
  articles: Article[];
  onSelect: (a: Article) => void;
  selected?: number;
}

export default function ArticleTable({ articles, onSelect, selected }: Props) {
  if (articles.length === 0) {
    return <p className="text-center py-10 text-slate-400 text-sm">기사가 없습니다</p>;
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {articles.map((a) => {
          const partners  = parse(a.final_partner);
          const keywords  = parse(a.matched_keywords);
          const isSelected = a.id === selected;
          return (
            <div
              key={a.id}
              onClick={() => onSelect(a)}
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex flex-wrap gap-1">
                  <AlertBadge level={a.alert_level} />
                  <StatusBadge status={a.status} />
                  {a.exclude_reason && <ReasonBadge reason={a.exclude_reason} />}
                </div>
                <span className="text-xs text-slate-400 shrink-0 font-bold">{a.total_score}점</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{a.title}</p>
              <p className="text-xs text-slate-400 mt-1">{a.source_name} · {fmt(a.published_at)}</p>
              {partners.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {partners.map((p) => (
                    <span key={p} className="bg-blue-100 text-blue-700 text-xs rounded px-1.5 py-0.5">{p}</span>
                  ))}
                </div>
              )}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {keywords.slice(0, 3).map((k) => (
                    <span key={k} className="bg-slate-100 text-slate-500 text-xs rounded px-1.5 py-0.5">{k}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="th">발행시각</th>
              <th className="th">언론사</th>
              <th className="th">기사 제목</th>
              <th className="th">제휴사</th>
              <th className="th">키워드</th>
              <th className="th text-center">총점</th>
              <th className="th text-center">중요도</th>
              <th className="th text-center">상태</th>
              <th className="th text-center">제외사유</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const partners  = parse(a.final_partner);
              const keywords  = parse(a.matched_keywords);
              const isSelected = a.id === selected;
              return (
                <tr
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="td whitespace-nowrap text-slate-500">{fmt(a.published_at)}</td>
                  <td className="td whitespace-nowrap font-medium">{a.source_name}</td>
                  <td className="td max-w-xs">
                    <div className="line-clamp-2 font-medium text-slate-800">{a.title}</div>
                    {a.summary && <div className="line-clamp-1 text-xs text-slate-400 mt-0.5">{a.summary}</div>}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {partners.map((p) => (
                        <span key={p} className="inline-block bg-blue-100 text-blue-700 text-xs rounded px-1.5 py-0.5">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {keywords.slice(0, 4).map((k) => (
                        <span key={k} className="inline-block bg-slate-100 text-slate-600 text-xs rounded px-1.5 py-0.5">{k}</span>
                      ))}
                    </div>
                  </td>
                  <td className="td text-center font-bold text-slate-700">{a.total_score}</td>
                  <td className="td text-center"><AlertBadge level={a.alert_level} /></td>
                  <td className="td text-center"><StatusBadge status={a.status} /></td>
                  <td className="td text-center"><ReasonBadge reason={a.exclude_reason} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
