# 제휴채널 뉴스 이슈 모니터링 대시보드

## 빠른 시작

```bash
cd news-dashboard
npm install
npm run dev
```

브라우저에서 **http://localhost:3000** 접속

> DB는 첫 실행 시 `data/news.db`에 자동 생성됩니다. 샘플 기사 60건이 자동 로드됩니다.

---

## 기술 스택

| 영역 | 라이브러리 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS 3 |
| DB | SQLite (`better-sqlite3`) |
| 차트 | Recharts |
| Excel | xlsx |
| 아이콘 | lucide-react |

---

## 화면 구성

| 경로 | 화면 |
|---|---|
| `/` | 메인 대시보드 (KPI 4개 + 차트 4개) |
| `/articles` | 기사 리스트 (필터 + 페이지네이션 + 상세 드로어) |
| `/partners` | 제휴사 관리 (키워드 관리 포함) |
| `/keywords` | 키워드 정책 (스코어링 / 제외 / 제외취소) |
| `/sources` | 수집 소스 관리 |
| `/api/export?format=xlsx` | Excel 다운로드 |
| `/api/export?format=csv` | CSV 다운로드 |

---

## 스코어링 로직

```
총점 = 출처점수 + 키워드점수 + 파트너점수 (max 20)

출처점수: 통신사=3, 경제지=2, 일반=1
키워드점수: 리스크(규제·제재·종료·중단·과징금)=+5, 금융(수수료·금리·대출·한도)=+4, 
            기술(출시·연동·API)=+3, 제휴(제휴·입점·협력·MOU)=+2
파트너점수: 매칭 파트너 수 × 2 (max 6)

알림 레벨: 8점↑=긴급, 5-7점=보고, 4점↓=보류
```

---

## 제외 필터 로직

```
기사 본문에 제외 키워드 포함 → 제외 후보
  단, 핵심 비즈니스 키워드(제휴/입점/수수료/금리/대출/결제/플랫폼/연동/API/규제/중단/종료/제재) 
  동시 포함 시 → 제외 취소, 정상 처리
```

제외 카테고리: **스포츠 / 스포츠후원 / 사회공헌(CSR) / 마케팅**

---

## DB 스키마

```
articles          - 기사 (수집·분석 결과 통합)
partners          - 제휴사
partner_keywords  - 제휴사 키워드 (공식명·별칭·영문·서비스명·법인명)
scoring_keywords  - 스코어링 키워드 + 점수
exclusion_keywords- 제외 키워드 + 제외취소 키워드
sources           - 수집 소스 (RSS/HTML)
review_logs       - 수동 수정 이력
```

---

## 확장 방법

### RSS 실수집 연동

`src/lib/collector.ts` (예시):

```typescript
import Parser from "rss-parser";
import { getDb } from "./db";
import { scoreArticle } from "./scoring";
import { applyExclusionFilter } from "./filter";

export async function collectRss(url: string, sourceName: string) {
  const parser = new Parser();
  const feed = await parser.parseURL(url);
  const db = getDb();
  for (const item of feed.items) {
    const score  = scoreArticle(db, item.title ?? "", item.summary ?? "", "", sourceName);
    const filter = applyExclusionFilter(db, item.title ?? "", item.summary ?? "", "");
    // INSERT into articles...
  }
}
```

### 스케줄러 추가

`npm install node-cron` 후 `src/lib/scheduler.ts` 생성:

```typescript
import cron from "node-cron";
import { collectRss } from "./collector";

// 30분마다 수집
cron.schedule("*/30 * * * *", async () => {
  const sources = getDb().prepare("SELECT * FROM sources WHERE is_active=1").all();
  for (const s of sources) await collectRss(s.url, s.source_name);
});
```

---

## 환경 변수

`.env.local` (선택사항):

```
# DB 파일 경로 변경 시
# NEWS_DB_PATH=./data/custom.db
```
