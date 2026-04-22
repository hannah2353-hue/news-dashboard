"use client";

import { useEffect, useState } from "react";
import { Trash2, Download, Send, KeyRound, Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const SECRET_STORAGE_KEY = "news-dashboard:cron-secret";

type ActionKey = "clear" | "ingest" | "digest";

interface ActionState {
  loading: boolean;
  result: unknown;
  error: string | null;
}

const INITIAL: ActionState = { loading: false, result: null, error: null };

export default function AdminPage() {
  const [secret,     setSecret]     = useState("");
  const [savedSecret, setSavedSecret] = useState<string | null>(null);
  const [states,     setStates]     = useState<Record<ActionKey, ActionState>>({
    clear:  INITIAL,
    ingest: INITIAL,
    digest: INITIAL,
  });

  // localStorage에서 이전에 저장한 secret 불러오기
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SECRET_STORAGE_KEY);
    if (saved) {
      setSecret(saved);
      setSavedSecret(saved);
    }
  }, []);

  function saveSecret() {
    if (typeof window === "undefined") return;
    if (secret) {
      window.localStorage.setItem(SECRET_STORAGE_KEY, secret);
    } else {
      window.localStorage.removeItem(SECRET_STORAGE_KEY);
    }
    setSavedSecret(secret || null);
  }

  function authHeader(): Record<string, string> {
    return secret ? { Authorization: `Bearer ${secret}` } : {};
  }

  async function runAction(key: ActionKey, fn: () => Promise<Response>) {
    setStates((s) => ({ ...s, [key]: { loading: true, result: null, error: null } }));
    try {
      const res = await fn();
      const text = await res.text();
      let json: unknown = text;
      try { json = JSON.parse(text); } catch { /* leave as text */ }

      if (!res.ok) {
        const msg = typeof json === "object" && json && "error" in (json as Record<string, unknown>)
          ? String((json as Record<string, unknown>).error)
          : `HTTP ${res.status}`;
        setStates((s) => ({ ...s, [key]: { loading: false, result: json, error: msg } }));
        return;
      }

      setStates((s) => ({ ...s, [key]: { loading: false, result: json, error: null } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStates((s) => ({ ...s, [key]: { loading: false, result: null, error: msg } }));
    }
  }

  function clearSamples() {
    return runAction("clear", () =>
      fetch("/api/admin/clear-samples", { method: "POST", headers: authHeader() })
    );
  }

  function runIngest() {
    return runAction("ingest", () =>
      fetch("/api/cron/ingest", { method: "GET", headers: authHeader() })
    );
  }

  function testDigest() {
    return runAction("digest", () =>
      fetch("/api/notify", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ digest: true }),
      })
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">관리자 도구</h1>
        <p className="mt-1 text-sm text-slate-600">
          샘플 기사 정리, RSS 수집 즉시 실행, 텔레그램 발송 테스트를 한 곳에서 처리합니다.
        </p>
      </header>

      {/* CRON_SECRET 입력 카드 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <KeyRound className="text-slate-500 mt-0.5" size={18} />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">CRON_SECRET</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Vercel 환경변수에 <code className="bg-slate-100 px-1 rounded">CRON_SECRET</code>을 설정했다면 여기에 붙여넣고 저장하세요.
              설정 안 했으면 비워둬도 동작합니다.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="(선택) CRON_SECRET 값"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              <button
                onClick={saveSecret}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700"
              >
                <Save size={14} />
                저장
              </button>
            </div>
            {savedSecret != null && (
              <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} />
                브라우저에 저장됨 (이 기기에서만 유지)
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 작업 카드 3개 */}
      <div className="grid gap-4">
        <ActionCard
          icon={<Trash2 size={18} />}
          tone="danger"
          title="샘플 기사 삭제"
          description="seed 단계에서 들어간 가짜 기사(URL이 https://example.com/aXXX인 것들)만 일괄 삭제합니다. 실제 수집된 기사는 건드리지 않아요."
          buttonLabel="샘플 60건 삭제"
          state={states.clear}
          onClick={clearSamples}
        />
        <ActionCard
          icon={<Download size={18} />}
          tone="primary"
          title="RSS 지금 수집"
          description="활성 소스의 RSS를 즉시 파싱해서 파트너 키워드 매칭된 기사만 저장합니다. 크론(하루 1회)을 기다리지 않고 수동으로 돌릴 때."
          buttonLabel="지금 실행"
          state={states.ingest}
          onClick={runIngest}
        />
        <ActionCard
          icon={<Send size={18} />}
          tone="primary"
          title="텔레그램 일일 요약 테스트"
          description="/api/notify에 digest=true를 호출합니다. Vercel에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DASHBOARD_URL이 설정돼 있어야 실제 메시지가 도착합니다."
          buttonLabel="테스트 전송"
          state={states.digest}
          onClick={testDigest}
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon, tone, title, description, buttonLabel, state, onClick,
}: {
  icon: React.ReactNode;
  tone: "primary" | "danger";
  title: string;
  description: string;
  buttonLabel: string;
  state: ActionState;
  onClick: () => void;
}) {
  const btn = tone === "danger"
    ? "bg-rose-600 hover:bg-rose-700"
    : "bg-blue-600 hover:bg-blue-700";

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={tone === "danger" ? "text-rose-500" : "text-blue-500"}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>

          <button
            onClick={onClick}
            disabled={state.loading}
            className={`mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${btn}`}
          >
            {state.loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {buttonLabel}
          </button>

          {state.error && (
            <div className="mt-3 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="break-all">{state.error}</span>
            </div>
          )}
          {state.result != null && !state.error && (
            <div className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <pre className="whitespace-pre-wrap break-all text-slate-700">
                {typeof state.result === "string"
                  ? state.result
                  : JSON.stringify(state.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
