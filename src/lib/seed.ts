import type { Client } from "@libsql/client";
import { scoreArticle } from "./scoring";
import { applyExclusionFilter } from "./filter";

// ─── 시드 데이터 정의 ──────────────────────────────────────────────────────────

const SOURCES = [
  { source_name: "연합뉴스",   tier: "wire",    source_type: "rss", source_score: 3, url: "https://www.yna.co.kr/rss/economy.xml" },
  { source_name: "뉴시스",     tier: "wire",    source_type: "rss", source_score: 3, url: "https://newsis.com/rss/finance.xml" },
  { source_name: "한국경제",   tier: "economy", source_type: "rss", source_score: 2, url: "https://rss.hankyung.com/economy.xml" },
  { source_name: "머니투데이", tier: "economy", source_type: "rss", source_score: 2, url: "https://rss.mt.co.kr/economy.xml" },
  { source_name: "파이낸셜뉴스",tier: "economy",source_type: "rss", source_score: 2, url: "https://www.fnnews.com/rss/fn_realestate_news.xml" },
  { source_name: "이데일리",   tier: "economy", source_type: "rss", source_score: 2, url: "https://rss.edaily.co.kr/economy.xml" },
  { source_name: "조선비즈",   tier: "economy", source_type: "rss", source_score: 2, url: "https://biz.chosun.com/rss/economy.xml" },
  { source_name: "아이뉴스24", tier: "general", source_type: "rss", source_score: 1, url: "https://www.inews24.com/rss/fintech.xml" },
  { source_name: "디지털데일리",tier: "general",source_type: "rss", source_score: 1, url: "https://www.ddaily.co.kr/rss/fintech.xml" },
  { source_name: "데일리안",   tier: "general", source_type: "rss", source_score: 1, url: "https://www.dailian.co.kr/rss/fintech.xml" },
];

// partner_keywords_seed.csv 내용 반영
const PARTNER_KEYWORDS: { partner: string; keyword: string; type: string }[] = [
  { partner: "현대캐피탈", keyword: "현대캐피탈",    type: "official" },
  { partner: "현대캐피탈", keyword: "Hyundai Capital", type: "english" },
  { partner: "토스",       keyword: "토스",           type: "official" },
  { partner: "토스",       keyword: "비바리퍼블리카", type: "corporation" },
  { partner: "토스",       keyword: "Toss",           type: "english" },
  { partner: "알다",       keyword: "알다",           type: "official" },
  { partner: "알다",       keyword: "KB알다",         type: "alias" },
  { partner: "알다",       keyword: "KB핀테크",       type: "corporation" },
  { partner: "핀크",       keyword: "핀크",           type: "official" },
  { partner: "핀크",       keyword: "FINNQ",          type: "english" },
  { partner: "핀다",       keyword: "핀다",           type: "official" },
  { partner: "핀다",       keyword: "FINDA",          type: "english" },
  { partner: "신한카드",   keyword: "신한카드",       type: "official" },
  { partner: "현대카드",   keyword: "현대카드",       type: "official" },
  { partner: "우리카드",   keyword: "우리카드",       type: "official" },
  { partner: "카카오페이", keyword: "카카오페이",     type: "official" },
  { partner: "카카오페이", keyword: "Kakao Pay",      type: "english" },
  { partner: "뱅크샐러드", keyword: "뱅크샐러드",    type: "official" },
  { partner: "하나카드",   keyword: "하나카드",       type: "official" },
  { partner: "나이스평가정보", keyword: "나이스평가정보", type: "official" },
  { partner: "네이버페이", keyword: "네이버페이",     type: "official" },
  { partner: "네이버페이", keyword: "네이버파이낸셜", type: "corporation" },
  { partner: "네이버페이", keyword: "Naver Pay",      type: "english" },
  { partner: "오버테이크", keyword: "오버테이크",     type: "official" },
  { partner: "오케이캐피탈", keyword: "오케이캐피탈", type: "official" },
  { partner: "오케이캐피탈", keyword: "OK캐피탈",    type: "alias" },
  { partner: "카카오뱅크", keyword: "카카오뱅크",    type: "official" },
  { partner: "카카오뱅크", keyword: "KakaoBank",     type: "english" },
  { partner: "신한은행",   keyword: "신한은행",       type: "official" },
  { partner: "에이피더핀", keyword: "에이피더핀",    type: "official" },
  { partner: "에이피더핀", keyword: "더핀",          type: "alias" },
  { partner: "한국신용데이터", keyword: "한국신용데이터", type: "official" },
  { partner: "한국신용데이터", keyword: "캐시노트",  type: "service" },
  { partner: "토스뱅크",   keyword: "토스뱅크",      type: "official" },
  { partner: "농협은행",   keyword: "농협은행",       type: "official" },
  { partner: "농협은행",   keyword: "NH농협은행",     type: "alias" },
  { partner: "케이뱅크",   keyword: "케이뱅크",      type: "official" },
  { partner: "케이뱅크",   keyword: "Kbank",         type: "english" },
  { partner: "뱅크몰",     keyword: "뱅크몰",        type: "official" },
  { partner: "모심",       keyword: "모심",           type: "official" },
  { partner: "서민금융진흥원 맞춤대출", keyword: "맞춤대출", type: "service" },
];

const SCORING_KEYWORDS = [
  // 제휴/협력 +2
  { keyword: "제휴", score: 2, category: "partnership" },
  { keyword: "입점", score: 2, category: "partnership" },
  { keyword: "협력", score: 2, category: "partnership" },
  { keyword: "MOU", score: 2, category: "partnership" },
  // 금융 +4
  { keyword: "수수료", score: 4, category: "financial" },
  { keyword: "금리", score: 4, category: "financial" },
  { keyword: "대출", score: 4, category: "financial" },
  { keyword: "한도", score: 4, category: "financial" },
  { keyword: "결제", score: 3, category: "financial" },
  // 리스크 +5
  { keyword: "규제", score: 5, category: "risk" },
  { keyword: "제재", score: 5, category: "risk" },
  { keyword: "종료", score: 5, category: "risk" },
  { keyword: "중단", score: 5, category: "risk" },
  { keyword: "과징금", score: 5, category: "risk" },
  // 기술/출시 +3
  { keyword: "출시", score: 3, category: "tech" },
  { keyword: "연동", score: 3, category: "tech" },
  { keyword: "API", score: 3, category: "tech" },
  { keyword: "데이터", score: 2, category: "tech" },
  { keyword: "플랫폼", score: 2, category: "tech" },
];

const EXCLUSION_KEYWORDS = [
  // A. 스포츠
  { keyword: "축구", reason: "sports", is_override: 0 },
  { keyword: "야구", reason: "sports", is_override: 0 },
  { keyword: "농구", reason: "sports", is_override: 0 },
  { keyword: "배구", reason: "sports", is_override: 0 },
  { keyword: "골프", reason: "sports", is_override: 0 },
  { keyword: "K리그", reason: "sports", is_override: 0 },
  { keyword: "선수", reason: "sports", is_override: 0 },
  { keyword: "감독", reason: "sports", is_override: 0 },
  { keyword: "홈런", reason: "sports", is_override: 0 },
  { keyword: "우승", reason: "sports", is_override: 0 },
  { keyword: "구단", reason: "sports", is_override: 0 },
  { keyword: "리그", reason: "sports", is_override: 0 },
  { keyword: "프로야구", reason: "sports", is_override: 0 },
  // B. 스포츠 후원
  { keyword: "스폰서", reason: "sports_sponsor", is_override: 0 },
  { keyword: "후원", reason: "sports_sponsor", is_override: 0 },
  { keyword: "챔피언십", reason: "sports_sponsor", is_override: 0 },
  { keyword: "컵대회", reason: "sports_sponsor", is_override: 0 },
  { keyword: "월드컵", reason: "sports_sponsor", is_override: 0 },
  { keyword: "올림픽", reason: "sports_sponsor", is_override: 0 },
  // C. 사회공헌/CSR
  { keyword: "사회공헌", reason: "csr", is_override: 0 },
  { keyword: "봉사", reason: "csr", is_override: 0 },
  { keyword: "기부", reason: "csr", is_override: 0 },
  { keyword: "ESG", reason: "csr", is_override: 0 },
  { keyword: "친환경", reason: "csr", is_override: 0 },
  { keyword: "금융교육", reason: "csr", is_override: 0 },
  { keyword: "플로깅", reason: "csr", is_override: 0 },
  // D. 광고/마케팅
  { keyword: "광고모델", reason: "marketing", is_override: 0 },
  { keyword: "앰버서더", reason: "marketing", is_override: 0 },
  { keyword: "홍보대사", reason: "marketing", is_override: 0 },
  { keyword: "브랜드 캠페인", reason: "marketing", is_override: 0 },
  { keyword: "이벤트 진행", reason: "marketing", is_override: 0 },
  // 제외 취소 키워드 (is_override=1)
  { keyword: "제휴",     reason: "sports", is_override: 1 },
  { keyword: "입점",     reason: "sports", is_override: 1 },
  { keyword: "수수료",   reason: "sports", is_override: 1 },
  { keyword: "금리",     reason: "sports", is_override: 1 },
  { keyword: "대출",     reason: "sports", is_override: 1 },
  { keyword: "결제",     reason: "sports", is_override: 1 },
  { keyword: "플랫폼",   reason: "sports", is_override: 1 },
  { keyword: "서비스 출시", reason: "sports", is_override: 1 },
  { keyword: "연동",     reason: "sports", is_override: 1 },
  { keyword: "API",      reason: "sports", is_override: 1 },
  { keyword: "규제",     reason: "sports", is_override: 1 },
  { keyword: "중단",     reason: "sports", is_override: 1 },
  { keyword: "종료",     reason: "sports", is_override: 1 },
  { keyword: "제재",     reason: "sports", is_override: 1 },
];

// ─── 샘플 기사 60건 ────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

const SAMPLE_ARTICLES: Array<{
  days: number;
  source: string;
  title: string;
  summary: string;
  url: string;
}> = [
  // 고중요(alert)
  { days: 0, source: "연합뉴스",   title: "토스, 수수료 체계 개편...입점 파트너사 부담 경감", summary: "토스가 제휴 파트너사 대상 수수료 정책을 전면 개편한다고 밝혔다. 이번 개편으로 소상공인 부담이 크게 줄 것으로 보인다.", url: "https://example.com/a001" },
  { days: 0, source: "한국경제",   title: "금융당국, 카카오페이 결제 API 규제 강화 검토", summary: "금융위원회가 카카오페이 간편결제 API에 대한 규제 수위를 높이는 방안을 검토 중이다.", url: "https://example.com/a002" },
  { days: 0, source: "머니투데이", title: "네이버페이, 케이뱅크와 제휴 대출 연동 출시", summary: "네이버페이가 케이뱅크와 제휴해 대출 연동 서비스를 출시했다. 플랫폼 내에서 대출 한도 조회가 가능해진다.", url: "https://example.com/a003" },
  { days: 1, source: "뉴시스",     title: "핀다, 금리 비교 플랫폼에 토스뱅크 신규 입점", summary: "핀다가 금리 비교 플랫폼에 토스뱅크를 신규 입점시켰다. 소비자들의 선택 폭이 넓어질 전망이다.", url: "https://example.com/a004" },
  { days: 1, source: "이데일리",   title: "신한카드, API 기반 마이데이터 연동 중단 공지", summary: "신한카드가 마이데이터 API 연동 서비스를 내달부터 중단한다고 공지했다. 파트너사들의 대응이 시급하다.", url: "https://example.com/a005" },
  { days: 1, source: "파이낸셜뉴스", title: "카카오뱅크, 제휴사 대출 한도 조정 통보...규제 영향", summary: "카카오뱅크가 주요 제휴사에 대출 한도 조정을 통보했다. 금융당국의 규제 강화 영향으로 분석된다.", url: "https://example.com/a006" },
  { days: 2, source: "연합뉴스",   title: "농협은행-뱅크샐러드, MOU 체결...데이터 제휴 확대", summary: "NH농협은행이 뱅크샐러드와 MOU를 체결하고 데이터 제휴를 확대하기로 했다.", url: "https://example.com/a007" },
  { days: 2, source: "한국경제",   title: "현대캐피탈, 핀테크 연동 수수료 인하...제휴 생태계 강화", summary: "현대캐피탈이 핀테크 파트너사와의 연동 수수료를 대폭 인하했다. 제휴 생태계 확대가 목적이다.", url: "https://example.com/a008" },
  { days: 2, source: "머니투데이", title: "우리카드, 제휴 종료 파트너사 20곳 발표...업계 충격", summary: "우리카드가 수익성 악화를 이유로 제휴 계약 종료 파트너사 목록을 발표했다.", url: "https://example.com/a009" },
  { days: 3, source: "뉴시스",     title: "토스뱅크, 대출 금리 체계 전면 개편...플랫폼 경쟁 심화", summary: "토스뱅크가 대출 금리 체계를 전면 개편하며 인터넷전문은행 경쟁이 가열되고 있다.", url: "https://example.com/a010" },
  { days: 3, source: "조선비즈",   title: "네이버파이낸셜, 결제 데이터 규제 대응 방안 발표", summary: "네이버파이낸셜이 개인정보위로부터 결제 데이터 처리 관련 제재를 받은 후 개선 방안을 공표했다.", url: "https://example.com/a011" },
  { days: 3, source: "이데일리",   title: "핀크, FINNQ 앱 서비스 중단...카드사 연동 종료 통보", summary: "핀크(FINNQ)가 일부 카드사와의 앱 연동 서비스를 중단한다고 발표했다.", url: "https://example.com/a012" },

  // 보통(report)
  { days: 4, source: "한국경제",   title: "카카오페이, 온라인 쇼핑몰 결제 제휴 확대", summary: "카카오페이가 온라인 쇼핑몰과의 결제 제휴를 확대하며 사용자 편의를 높이고 있다.", url: "https://example.com/a013" },
  { days: 4, source: "머니투데이", title: "뱅크샐러드, 신한카드 데이터 제휴 연장 협의 중", summary: "뱅크샐러드가 신한카드와의 데이터 제휴 계약 연장을 논의 중인 것으로 알려졌다.", url: "https://example.com/a014" },
  { days: 4, source: "파이낸셜뉴스", title: "케이뱅크(Kbank), API 생태계 구축 본격화", summary: "케이뱅크가 외부 파트너사 대상 오픈 API 생태계 구축에 박차를 가하고 있다.", url: "https://example.com/a015" },
  { days: 5, source: "연합뉴스",   title: "하나카드, 대형 플랫폼 입점 비용 협상 중", summary: "하나카드가 국내 주요 플랫폼과 신규 입점 비용 협상을 진행 중이라고 밝혔다.", url: "https://example.com/a016" },
  { days: 5, source: "뉴시스",     title: "핀다, 대출 비교 서비스에 농협은행 입점 완료", summary: "핀다 대출 비교 서비스에 NH농협은행이 신규 입점을 완료했다.", url: "https://example.com/a017" },
  { days: 5, source: "조선비즈",   title: "신한은행, 마이데이터 플랫폼 제휴사 확대 발표", summary: "신한은행이 마이데이터 플랫폼 제휴사를 기존 대비 30% 확대하겠다는 계획을 발표했다.", url: "https://example.com/a018" },
  { days: 6, source: "이데일리",   title: "캐시노트, 한국신용데이터 기반 소상공인 대출 서비스 출시", summary: "한국신용데이터 캐시노트가 소상공인 대출 서비스를 출시했다. 매출 데이터 연동으로 한도를 산정한다.", url: "https://example.com/a019" },
  { days: 6, source: "한국경제",   title: "현대카드, 데이터 분석 플랫폼 제휴 파트너 모집", summary: "현대카드가 빅데이터 분석 플랫폼 사업을 위한 제휴 파트너사를 공개 모집한다.", url: "https://example.com/a020" },
  { days: 7, source: "머니투데이", title: "오케이캐피탈(OK캐피탈), 핀테크 플랫폼 입점 확대", summary: "오케이캐피탈이 주요 핀테크 플랫폼에 신규 입점하며 디지털 채널을 강화하고 있다.", url: "https://example.com/a021" },
  { days: 7, source: "파이낸셜뉴스", title: "알다(KB알다), 제휴 금융사 연동 서비스 업데이트", summary: "KB알다가 제휴 금융사 연동 서비스를 업데이트했다. 신규 파트너 3곳이 추가됐다.", url: "https://example.com/a022" },
  { days: 7, source: "아이뉴스24", title: "뱅크몰, 보험사 제휴 상품 출시...플랫폼 확장", summary: "뱅크몰이 보험사와 제휴해 전용 상품을 출시했다. 플랫폼 내 상품군이 확대됐다.", url: "https://example.com/a023" },
  { days: 8, source: "디지털데일리", title: "토스, 카드사 결제 데이터 API 연동 확대 추진", summary: "토스(비바리퍼블리카)가 국내 주요 카드사와의 결제 데이터 API 연동을 확대 추진한다.", url: "https://example.com/a024" },
  { days: 8, source: "연합뉴스",   title: "나이스평가정보, 금융사 신용평가 데이터 제공 확대", summary: "나이스평가정보가 핀테크 파트너사 대상 신용평가 데이터 제공 범위를 확대한다.", url: "https://example.com/a025" },
  { days: 8, source: "한국경제",   title: "에이피더핀(더핀), 저신용자 대출 플랫폼 서비스 출시", summary: "더핀(에이피더핀)이 저신용자 대상 중금리 대출 플랫폼 서비스를 새로 출시했다.", url: "https://example.com/a026" },
  { days: 9, source: "뉴시스",     title: "카카오뱅크, 제휴 카드사 결제 서비스 확대 검토", summary: "카카오뱅크가 제휴 카드사와의 결제 서비스 범위를 확대하는 방안을 내부 검토 중이다.", url: "https://example.com/a027" },
  { days: 9, source: "조선비즈",   title: "핀다, 카드론 금리 비교 서비스 오픈...5개 카드사 입점", summary: "핀다가 카드론 금리 비교 서비스를 오픈했다. 신한·현대·우리·하나·KB카드 5곳이 입점했다.", url: "https://example.com/a028" },
  { days: 10, source: "머니투데이", title: "모심, 아파트 관리비 결제 서비스 제휴 확대", summary: "모심이 대형 관리업체와 제휴해 아파트 관리비 결제 서비스 범위를 넓혔다.", url: "https://example.com/a029" },
  { days: 10, source: "이데일리",  title: "서민금융진흥원 맞춤대출, 핀테크 플랫폼 연동 강화", summary: "서민금융진흥원 맞춤대출 서비스가 주요 핀테크 플랫폼과의 연동을 대폭 강화했다.", url: "https://example.com/a030" },

  // 낮은 중요도(hold)
  { days: 11, source: "아이뉴스24", title: "카카오페이, 해외결제 서비스 베타 오픈", summary: "카카오페이가 해외결제 서비스를 베타 오픈했다. 이용자들의 반응이 주목된다.", url: "https://example.com/a031" },
  { days: 11, source: "디지털데일리", title: "토스뱅크, 예금 상품 라인업 확대 예고", summary: "토스뱅크가 하반기 예금 상품 라인업을 확대할 계획이라고 밝혔다.", url: "https://example.com/a032" },
  { days: 12, source: "데일리안",  title: "핀크, 앱 리뉴얼...UI 전면 개편", summary: "핀크(FINNQ)가 모바일 앱 UI를 전면 개편했다. 사용성 향상에 중점을 뒀다.", url: "https://example.com/a033" },
  { days: 12, source: "아이뉴스24", title: "뱅크샐러드, 자산관리 기능 업데이트", summary: "뱅크샐러드가 자산관리 기능을 대폭 업데이트했다. 분석 리포트 기능이 추가됐다.", url: "https://example.com/a034" },
  { days: 13, source: "디지털데일리", title: "케이뱅크, 제2 오피스 이전 완료", summary: "케이뱅크가 서울 서초구로 제2 사무소 이전을 완료했다고 발표했다.", url: "https://example.com/a035" },
  { days: 13, source: "데일리안",  title: "알다, 앱 월간 활성 사용자 100만 돌파", summary: "KB알다의 월간 활성 사용자(MAU)가 100만 명을 돌파했다고 밝혔다.", url: "https://example.com/a036" },

  // 제외 - 스포츠
  { days: 1, source: "뉴시스",     title: "현대카드 코리아오픈 테니스 후원...선수단 지원 확대", summary: "현대카드가 코리아오픈 테니스대회 스폰서로서 선수단 지원을 확대하기로 했다.", url: "https://example.com/a037" },
  { days: 2, source: "연합뉴스",   title: "신한카드, K리그 공식 스폰서 계약 3년 연장", summary: "신한카드가 K리그 구단 공식 후원사 계약을 3년 연장했다. 마케팅 활동을 강화한다.", url: "https://example.com/a038" },
  { days: 3, source: "한국경제",   title: "하나카드, 골프대회 타이틀 스폰서 참여", summary: "하나카드가 국내 유명 골프대회 타이틀 스폰서로 참여해 브랜드 노출을 높인다.", url: "https://example.com/a039" },
  { days: 5, source: "머니투데이", title: "우리카드, 프로야구 홈런왕 시상...야구 마케팅 강화", summary: "우리카드가 프로야구 시즌 홈런왕 시상을 진행했다. 야구 팬 마케팅을 강화한다.", url: "https://example.com/a040" },
  { days: 6, source: "파이낸셜뉴스", title: "카카오뱅크, 농구대잔치 공식 후원사로 참여", summary: "카카오뱅크가 농구 올스타전 공식 후원사로 참여해 스포츠 마케팅을 확대한다.", url: "https://example.com/a041" },
  { days: 7, source: "이데일리",   title: "토스, 프로배구 리그 감독 인터뷰 이벤트 진행", summary: "토스가 프로배구 팬을 대상으로 감독 인터뷰 이벤트를 진행한다고 발표했다.", url: "https://example.com/a042" },

  // 제외 - CSR
  { days: 2, source: "뉴시스",     title: "신한카드, ESG 경영 강화...탄소중립 실천 선언", summary: "신한카드가 ESG 경영 강화 차원에서 탄소중립 실천을 선언하고 친환경 캠페인을 시작했다.", url: "https://example.com/a043" },
  { days: 4, source: "연합뉴스",   title: "카카오뱅크, 금융교육 봉사활동 진행...사회공헌 확대", summary: "카카오뱅크가 청소년 금융교육 봉사활동을 진행했다. 지역사회 사회공헌 활동을 확대한다.", url: "https://example.com/a044" },
  { days: 6, source: "한국경제",   title: "현대캐피탈, 기부 캠페인 '나눔 드라이브' 진행", summary: "현대캐피탈이 임직원 기부 캠페인을 실시했다. 수익금은 취약계층 지원에 쓰인다.", url: "https://example.com/a045" },
  { days: 8, source: "머니투데이", title: "농협은행, ESG 보고서 발간...친환경 금융 성과 공개", summary: "NH농협은행이 ESG 보고서를 발간하며 친환경 금융 실적을 공개했다.", url: "https://example.com/a046" },

  // 제외 - 마케팅
  { days: 1, source: "파이낸셜뉴스", title: "카카오페이, 신규 광고모델 배우 김OO 발탁", summary: "카카오페이가 신규 브랜드 캠페인을 위해 배우 김OO를 앰버서더로 발탁했다.", url: "https://example.com/a047" },
  { days: 3, source: "이데일리",   title: "토스, 홍보대사 BTS 멤버 RM과 이벤트 진행", summary: "토스가 홍보대사 RM과 함께 특별 이벤트 진행을 발표했다.", url: "https://example.com/a048" },
  { days: 5, source: "아이뉴스24", title: "네이버페이, 광고 캠페인 '일상 속 Naver Pay' 론칭", summary: "네이버페이가 새로운 브랜드 캠페인을 론칭했다. TV·디지털 채널을 통해 집중 노출된다.", url: "https://example.com/a049" },

  // 복합 (제외키워드 + 핵심키워드 → 제외 취소)
  { days: 0, source: "한국경제",   title: "신한카드, 골프대회 스폰서지만 수수료 인하 제휴 조건 포함", summary: "신한카드가 골프대회 스폰서 계약에 가맹점 수수료 인하 제휴 조건을 포함시킨 것으로 알려졌다.", url: "https://example.com/a050" },

  // 추가 정상 기사
  { days: 14, source: "연합뉴스",  title: "금융위, 핀테크 플랫폼 입점 규제 완화 방안 발표", summary: "금융위원회가 핀테크 플랫폼 입점 관련 규제를 완화하는 방안을 발표했다.", url: "https://example.com/a051" },
  { days: 15, source: "뉴시스",    title: "케이뱅크, 중금리 대출 금리 인하...경쟁사 압박", summary: "케이뱅크가 중금리 대출 금리를 0.5%p 인하했다. 카카오뱅크·토스뱅크와의 경쟁이 가열된다.", url: "https://example.com/a052" },
  { days: 16, source: "조선비즈",  title: "핀다, 보험 비교 서비스 런칭...제휴 보험사 10곳 입점", summary: "핀다가 보험 비교 서비스를 론칭하며 제휴 보험사 10곳이 동시에 입점했다.", url: "https://example.com/a053" },
  { days: 17, source: "이데일리",  title: "토스, 금융 API 개방 확대...외부 개발자 연동 가능", summary: "토스(비바리퍼블리카)가 금융 API를 외부 개발사에 개방하며 생태계 확장에 나섰다.", url: "https://example.com/a054" },
  { days: 18, source: "한국경제",  title: "현대카드, 데이터 플랫폼 연동 스타트업 3곳 선정", summary: "현대카드가 데이터 플랫폼 연동 스타트업 지원 프로그램 최종 선정 3곳을 발표했다.", url: "https://example.com/a055" },
  { days: 19, source: "머니투데이", title: "카카오뱅크, 카드론 금리 전면 인하...대출 경쟁 가속", summary: "카카오뱅크가 카드론 금리를 전면 인하했다. 인터넷은행 간 대출 경쟁이 가속화된다.", url: "https://example.com/a056" },
  { days: 20, source: "파이낸셜뉴스", title: "뱅크샐러드, 농협은행 데이터 분석 제휴 MOU 체결", summary: "뱅크샐러드가 NH농협은행과 데이터 분석 제휴 MOU를 체결했다.", url: "https://example.com/a057" },
  { days: 21, source: "연합뉴스",  title: "오케이캐피탈, 소비자금융 수수료 체계 개편 예고", summary: "OK캐피탈이 소비자금융 수수료 체계를 개편할 예정이라고 밝혔다.", url: "https://example.com/a058" },
  { days: 22, source: "뉴시스",    title: "신한은행, 마이데이터 API 오류 수정...파트너사에 사과", summary: "신한은행이 마이데이터 API에서 발생한 오류를 수정하고 파트너사에 공식 사과했다.", url: "https://example.com/a059" },
  { days: 25, source: "조선비즈",  title: "금융당국, 플랫폼 대출 규제 세부 지침 발표 예정", summary: "금융감독원이 플랫폼 대출 규제 세부 지침을 다음 달 발표할 예정이다.", url: "https://example.com/a060" },
];

// ─── 시드 실행 함수 ────────────────────────────────────────────────────────────

export async function seedSources(db: Client) {
  // 1. 출처
  for (const s of SOURCES) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO sources (source_name, tier, source_type, source_score, url)
            VALUES (?, ?, ?, ?, ?)`,
      args: [s.source_name, s.tier, s.source_type, s.source_score, s.url],
    });
  }

  // 2. 파트너
  const partnerNames = [...new Set(PARTNER_KEYWORDS.map((p) => p.partner))];
  for (const name of partnerNames) {
    await db.execute({
      sql:  "INSERT OR IGNORE INTO partners (partner_name) VALUES (?)",
      args: [name],
    });
  }
  for (const { partner, keyword, type } of PARTNER_KEYWORDS) {
    const res = await db.execute({
      sql:  "SELECT id FROM partners WHERE partner_name = ?",
      args: [partner],
    });
    const row = res.rows[0];
    if (row) {
      await db.execute({
        sql:  "INSERT OR IGNORE INTO partner_keywords (partner_id, partner_name, keyword, keyword_type) VALUES (?, ?, ?, ?)",
        args: [Number(row.id), partner, keyword, type],
      });
    }
  }

  // 3. 스코어링 키워드
  for (const k of SCORING_KEYWORDS) {
    await db.execute({
      sql:  "INSERT OR IGNORE INTO scoring_keywords (keyword, score, category) VALUES (?, ?, ?)",
      args: [k.keyword, k.score, k.category],
    });
  }

  // 4. 제외 키워드
  for (const k of EXCLUSION_KEYWORDS) {
    await db.execute({
      sql:  "INSERT OR IGNORE INTO exclusion_keywords (keyword, reason, is_override) VALUES (?, ?, ?)",
      args: [k.keyword, k.reason, k.is_override],
    });
  }

  // 5. 기사
  for (const art of SAMPLE_ARTICLES) {
    const published_at = daysAgo(art.days);
    const collected_at = new Date(new Date(published_at).getTime() + 15 * 60000)
      .toISOString().slice(0, 19).replace("T", " ");

    const score  = await scoreArticle(db, art.title, art.summary, "", art.source);
    const filter = await applyExclusionFilter(db, art.title, art.summary, "");

    const status = filter.is_excluded ? "excluded" : "new";

    await db.execute({
      sql: `INSERT OR IGNORE INTO articles
              (collected_at, published_at, source_name, source_type,
               title, summary, body_text, url,
               auto_partners, manual_partner, final_partner,
               matched_keywords, exclude_keywords, exclude_reason,
               source_score, keyword_score, partner_score, spread_score, total_score,
               alert_level, status, is_duplicate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [
        collected_at, published_at, art.source, "rss",
        art.title, art.summary, "", art.url,
        JSON.stringify(score.auto_partners), null, JSON.stringify(score.auto_partners),
        JSON.stringify(score.matched_keywords), JSON.stringify(filter.exclude_keywords),
        filter.exclude_reason,
        score.source_score, score.keyword_score, score.partner_score, 0, score.total_score,
        filter.is_excluded ? "hold" : score.alert_level, status,
      ],
    });
  }
}
