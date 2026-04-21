import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `당신은 저축은행 대출 비교서비스를 운영하는 기획자입니다.
주어진 뉴스 기사를 분석하여 두 가지를 제공하세요:

1. 기사 요약 (3-5문장): 핵심 내용을 간결하게 요약
2. 영향도 분석 (3-5문장): 저축은행 대출 비교서비스 운영 관점에서 이 기사가 서비스, 파트너사, 사용자, 규제 환경에 미치는 영향을 분석

반드시 다음 JSON 형식으로만 응답하세요:
{"summary": "요약 텍스트", "impact": "영향도 분석 텍스트"}`;

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];

async function callGemini(apiKey: string, modelName: string, content: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
    },
  });
  const result = await model.generateContent(content);
  return result.response.text?.() ?? "";
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function analyzeArticle(
  title: string,
  summary: string,
  bodyText: string,
): Promise<{ summary: string; impact: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const content = [
    `제목: ${title}`,
    summary  ? `요약: ${summary}`                 : "",
    bodyText ? `본문: ${bodyText.slice(0, 2000)}` : "",
  ].filter(Boolean).join("\n\n");

  let lastError: unknown = null;
  let text = "";

  outer: for (const modelName of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        text = await callGemini(apiKey, modelName, content);
        if (text) { lastError = null; break outer; }
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = /\b(503|429|500|502|504|ECONNRESET|ETIMEDOUT)\b/i.test(msg);
        console.warn(`[analyzer] ${modelName} attempt ${attempt + 1} 실패:`, msg.slice(0, 150));
        if (!isTransient) break;
        await sleep(1500 * (attempt + 1));
      }
    }
  }

  if (!text) {
    const msg = lastError instanceof Error ? lastError.message : "알 수 없는 오류";
    throw new Error(`Gemini 호출 실패(모든 모델/재시도 소진): ${msg}`);
  }

  let parsed: { summary?: string; impact?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`LLM 응답 파싱 실패. 원문: ${text.slice(0, 200)}`);
    parsed = JSON.parse(jsonMatch[0]);
  }

  return {
    summary: parsed.summary ?? "",
    impact:  parsed.impact  ?? "",
  };
}
