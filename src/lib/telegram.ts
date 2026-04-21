const TELEGRAM_API = "https://api.telegram.org";

function getBotConfig() {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.");
  return { token, chatId };
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const { token, chatId } = getBotConfig();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API 오류: ${res.status} ${body}`);
  }
}

export function formatArticleMessage(article: {
  title: string;
  source_name: string;
  published_at: string;
  url: string;
  alert_level: string;
  total_score: number;
  final_partner: string;   // JSON string
  matched_keywords: string; // JSON string
  ai_summary?: string | null;
  ai_impact?: string | null;
}): string {
  const ALERT_EMOJI: Record<string, string> = { alert: "🚨", report: "📋", hold: "📌" };
  const ALERT_LABEL: Record<string, string> = { alert: "긴급", report: "보고", hold: "보류" };

  const partners = tryJson(article.final_partner).join(", ") || "없음";
  const keywords = tryJson(article.matched_keywords).slice(0, 5).join(", ") || "없음";
  const emoji    = ALERT_EMOJI[article.alert_level] ?? "📰";
  const label    = ALERT_LABEL[article.alert_level] ?? article.alert_level;

  const lines = [
    `${emoji} <b>[${label}] ${article.title}</b>`,
    ``,
    `📰 <b>언론사:</b> ${article.source_name}`,
    `🕐 <b>발행:</b> ${article.published_at?.slice(0, 16)}`,
    `📊 <b>총점:</b> ${article.total_score}점`,
    `🤝 <b>제휴사:</b> ${partners}`,
    `🔑 <b>키워드:</b> ${keywords}`,
  ];

  if (article.ai_summary) {
    lines.push(``, `📝 <b>AI 요약:</b>`, article.ai_summary);
  }
  if (article.ai_impact) {
    lines.push(``, `💡 <b>영향도:</b>`, article.ai_impact);
  }

  lines.push(``, `🔗 <a href="${article.url}">기사 원문 보기</a>`);
  return lines.join("\n");
}

function tryJson(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}
