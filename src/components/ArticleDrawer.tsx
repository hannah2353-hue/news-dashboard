"use client";
import { useState } from "react";
import type { Article, AlertLevel, ArticleStatus } from "@/lib/types";
import { AlertBadge, StatusBadge, ReasonBadge } from "./AlertBadge";
import { X, ExternalLink, Save, Sparkles, Send } from "lucide-react";

function parse(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

interface Props {
  article: Article | null;
  onClose: () => void;
  onSaved: (a: Article) => void;
}

const STATUSES: { value: ArticleStatus; label: string }[] = [
  { value: "new",      label: "신규" },
  { value: "reviewed", label: "검토완료" },
  { value: "excluded", label: "제외" },
  { value: "reported", label: "보고완료" },
];

const ALERTS: { value: AlertLevel; label: string }[] = [
  { value: "alert",  label: "긴급" },
  { value: "report", label: "보고" },
  { value: "hold",   label: "보류" },
];

export default function ArticleDrawer({ article, onClose, onSaved }: Props) {
  const [status, setStatus]         = useState<ArticleStatus>(article?.status ?? "new");
  const [alertLevel, setAlertLevel] = useState<AlertLevel>(article?.alert_level ?? "hold");
  const [note, setNote]             = useState(article?.note ?? "");
  const [saving, setSaving]         = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [aiSummary, setAiSummary]   = useState<string | null>(article?.ai_summary ?? null);
  const [aiImpact, setAiImpact]     = useState<string | null>(article?.ai_impact ?? null);
  const [sending, setSending]       = useState(false);
  const [sentOk, setSentOk]         = useState(false);

  if (!article) return null;

  const key = article.id;

  async function handleSave() {
    if (!article) return;
    setSaving(true);
    const res = await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, alert_level: alertLevel, note }),
    });
    const updated: Article = await res.json();
    setSaving(false);
    onSaved(updated);
  }

  async function handleAnalyze() {
    if (!article) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/analyze`, { method: "POST" });
      const data = await res.json() as { ai_summary?: string; ai_impact?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setAiSummary(data.ai_summary ?? null);
      setAiImpact(data.ai_impact ?? null);
    } catch (err) {
      alert("분석 실패: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSendTelegram() {
    if (!article) return;
    setSending(true);
    setSentOk(false);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "전송 실패");
      setSentOk(true);
      setTimeout(() => setSentOk(false), 3000);
    } catch (err) {
      alert("텔레그램 전송 실패: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSending(false);
    }
  }

  const autoPartners = parse(article.auto_partners);
  const finalPartner = parse(article.final_partner);
  const matchedKws   = parse(article.matched_keywords);
  const excludeKws   = parse(article.exclude_keywords);
  const scoreItems   = [
    { label: "출처점수",   val: article.source_score },
    { label: "키워드점수", val: article.keyword_score },
    { label: "파트너점수", val: article.partner_score },
    { label: "확산점수",   val: article.spread_score },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" key={key}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative w-full md:w-[520px] h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <AlertBadge level={article.alert_level} />
              <StatusBadge status={article.status} />
              {article.exclude_reason && <ReasonBadge reason={article.exclude_reason} />}
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">{article.title}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {article.source_name} · {article.published_at?.slice(0, 16)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* URL */}
          <a href={article.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 text-xs hover:underline break-all">
            <ExternalLink size={12} /> {article.url}
          </a>

          {/* 요약 */}
          {article.summary && (
            <div>
              <p className="section-title">요약</p>
              <p className="text-sm text-slate-600 leading-relaxed">{article.summary}</p>
            </div>
          )}

          {/* 점수 */}
          <div>
            <p className="section-title">점수 상세</p>
            <div className="grid grid-cols-4 gap-2">
              {scoreItems.map(({ label, val }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-slate-700">{val}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 bg-blue-50 rounded-lg p-2 text-center">
              <span className="text-xs text-blue-600 font-medium">총점 </span>
              <span className="text-xl font-bold text-blue-700">{article.total_score}</span>
            </div>
          </div>

          {/* 파트너 */}
          <div>
            <p className="section-title">제휴사 매칭</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20 shrink-0">자동매칭</span>
                <div className="flex flex-wrap gap-1">
                  {autoPartners.map((p) => (
                    <span key={p} className="bg-blue-100 text-blue-700 text-xs rounded px-2 py-0.5">{p}</span>
                  ))}
                  {autoPartners.length === 0 && <span className="text-xs text-slate-400">없음</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20 shrink-0">최종확정</span>
                <div className="flex flex-wrap gap-1">
                  {finalPartner.map((p) => (
                    <span key={p} className="bg-green-100 text-green-700 text-xs rounded px-2 py-0.5">{p}</span>
                  ))}
                  {finalPartner.length === 0 && <span className="text-xs text-slate-400">없음</span>}
                </div>
              </div>
            </div>
          </div>

          {/* 키워드 */}
          <div>
            <p className="section-title">매칭 키워드</p>
            <div className="flex flex-wrap gap-1">
              {matchedKws.map((k) => (
                <span key={k} className="bg-slate-100 text-slate-700 text-xs rounded px-2 py-0.5">{k}</span>
              ))}
              {matchedKws.length === 0 && <span className="text-xs text-slate-400">없음</span>}
            </div>
          </div>

          {/* 제외 키워드 */}
          {excludeKws.length > 0 && (
            <div>
              <p className="section-title">제외 키워드</p>
              <div className="flex flex-wrap gap-1">
                {excludeKws.map((k) => (
                  <span key={k} className="bg-orange-100 text-orange-700 text-xs rounded px-2 py-0.5">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* AI 분석 */}
          <div className="border border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/40">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1">
                <Sparkles size={12} /> AI 분석
              </p>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Sparkles size={12} />
                {analyzing ? "분석 중..." : (aiSummary ? "재분석" : "분석하기")}
              </button>
            </div>

            {(aiSummary || aiImpact) ? (
              <div className="space-y-3">
                {aiSummary && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">기사 요약</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{aiSummary}</p>
                  </div>
                )}
                {aiImpact && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">영향도 분석 <span className="text-purple-600">(저축은행 대출 비교서비스 관점)</span></p>
                    <p className="text-sm text-slate-700 leading-relaxed">{aiImpact}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                분석하기 버튼을 누르면 Claude AI가 저축은행 대출 비교서비스 기획자 관점에서 기사를 분석합니다.
              </p>
            )}
          </div>

          {/* 수동 수정 */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="section-title">수동 수정</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">상태</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                  className="input-sm w-full">
                  {STATUSES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">중요도 조정</label>
                <select value={alertLevel} onChange={(e) => setAlertLevel(e.target.value as AlertLevel)}
                  className="input-sm w-full">
                  {ALERTS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">메모</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="담당자 메모..." className="input-sm w-full resize-none" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <Save size={14} />
                {saving ? "저장 중..." : "저장"}
              </button>
              <button onClick={handleSendTelegram} disabled={sending || sentOk}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  sentOk
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}>
                <Send size={14} />
                {sentOk ? "전송완료!" : sending ? "전송 중..." : "텔레그램"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
