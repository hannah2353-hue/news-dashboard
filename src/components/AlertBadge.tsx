import type { AlertLevel, ArticleStatus, ExcludeReason } from "@/lib/types";

const ALERT_STYLE: Record<AlertLevel, string> = {
  alert:  "bg-red-100   text-red-700   border border-red-200",
  report: "bg-amber-100 text-amber-700 border border-amber-200",
  hold:   "bg-slate-100 text-slate-600 border border-slate-200",
};
const ALERT_LABEL: Record<AlertLevel, string> = {
  alert: "긴급", report: "보고", hold: "보류",
};

const STATUS_STYLE: Record<ArticleStatus, string> = {
  new:      "bg-blue-100  text-blue-700  border border-blue-200",
  reviewed: "bg-green-100 text-green-700 border border-green-200",
  excluded: "bg-orange-100 text-orange-700 border border-orange-200",
  reported: "bg-purple-100 text-purple-700 border border-purple-200",
};
const STATUS_LABEL: Record<ArticleStatus, string> = {
  new: "신규", reviewed: "검토완료", excluded: "제외", reported: "보고완료",
};

const REASON_LABEL: Record<string, string> = {
  sports: "스포츠", sports_sponsor: "스포츠후원", csr: "사회공헌", marketing: "마케팅",
};

export function AlertBadge({ level }: { level: AlertLevel }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ALERT_STYLE[level]}`}>
      {ALERT_LABEL[level]}
    </span>
  );
}

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ReasonBadge({ reason }: { reason: ExcludeReason }) {
  if (!reason) return null;
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
      {REASON_LABEL[reason] ?? reason}
    </span>
  );
}
