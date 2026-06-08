"use client";

import { useEffect, useState } from "react";
import { Download, Send, KeyRound, Save, CheckCircle2, AlertCircle, Loader2, Stethoscope, RefreshCw } from "lucide-react";

const SECRET_STORAGE_KEY = "news-dashboard:cron-secret";

type ActionKey = "ingest" | "digest" | "diagnose" | "syncGoogle";

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
    ingest:     INITIAL,
    digest:     INITIAL,
    diagnose:   INITIAL,
    syncGoogle: INITIAL,
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

  // 자동 cron은 ?group=a/b로 분할돼 각 호출이 60초 안에 들어오지만, 한 번에
  // 전체 소스를 돌리면 60초를 넘겨 504가 떨어진다. 그래서 수동 버튼도 a → b
  // 순차로 호출하고 결과를 합쳐서 보여준다.
  async function runIngest() {
    setStates((s) => ({ ...s, ingest: { loading: true, result: null, error: null } }));

    async function callGroup(group: "a" | "b") {
      const res  = await fetch(`/api/cron/ingest?group=${group}`, {
        method:  "GET",
        headers: authHeader(),
      });
      const text = await res.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* leave as text */ }
      return { ok: res.ok, status: res.status, body };
    }

    try {
      const a = await callGroup("a");
      const b = await callGroup("b");

      const errors: string[] = [];
      if (!a.ok) errors.push(`Group A: HTTP ${a.status}`);
      if (!b.ok) errors.push(`Group B: HTTP ${b.status}`);

      setStates((s) => ({
        ...s,
        ingest: {
          loading: false,
          result:  { groupA: a.body, groupB: b.body },
          error:   errors.length ? errors.join(" / ") : null,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStates((s) => ({ ...s, ingest: { loading: false, result: null, error: msg } }));
    }
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

  function runDiagnose() {
    return runAction("diagnose", () =>
      fetch("/api/admin/diagnose?days=7&samples=3", { method: "GET", headers: authHeader() })
    );
  }

  function syncGoogleSources(deactivateLegacy: boolean) {
    const qs = deactivateLegacy ? "?deactivate_legacy=1" : "";
    return runAction("syncGoogle", () =>
      fetch(`/api/admin/sync-google-sources${qs}`, { method: "POST", headers: authHeader() })
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

      {/* 소스 관리 — 어떤 RSS 주소에서 가져올지 결정 */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
          1. 소스 관리
        </h2>
        <ActionCard
          icon={<RefreshCw size={18} />}
          tone="primary"
          title="구글 뉴스 소스 갱신"
          description="활성 파트너의 키워드를 OR로 묶어 구글 뉴스 검색 RSS 주소를 sources 테이블에 자동 등록/업데이트합니다. 동시에 직접 등록된 언론사 RSS는 비활성화돼서 다음 수집부터는 구글 뉴스에서만 받아옵니다. (수집은 안 합니다 — 소스 목록만 갱신)"
          buttonLabel="소스 목록 갱신"
          state={states.syncGoogle}
          onClick={() => syncGoogleSources(true)}
        />
      </div>

      {/* 수집 실행 — 실제로 기사를 받아와 DB에 저장 */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
          2. 수집 실행
        </h2>
        <div className="grid gap-4">
          <ActionCard
            icon={<Download size={18} />}
            tone="primary"
            title="지금 수집"
            description="활성 소스의 RSS를 즉시 파싱해서 새 기사를 DB에 저장합니다. 매일 아침 7시 크론을 기다리지 않고 수동으로 한 번 돌릴 때 사용하세요."
            buttonLabel="지금 수집 실행"
            state={states.ingest}
            onClick={runIngest}
          />
          <ActionCard
            icon={<Stethoscope size={18} />}
            tone="primary"
            title="수집 진단 (DB 저장 없음)"
            description="RSS를 받아오되 DB엔 아무것도 안 씁니다. 소스별로 'RSS 응답 N건 → 파트너 키워드 매칭 M건' 단계별 통계와 매칭/미매칭 제목 샘플을 보여줘서, 수집이 적은 이유가 진짜 뉴스가 없어서인지 필터/키워드 문제인지 판별할 때 씁니다."
            buttonLabel="진단 실행"
            state={states.diagnose}
            onClick={runDiagnose}
          />
        </div>
      </div>

      {/* 알림 */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
          3. 알림
        </h2>
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
