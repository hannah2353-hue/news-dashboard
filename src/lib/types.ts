// ─── Core domain types ────────────────────────────────────────────────────────

export type AlertLevel = "alert" | "report" | "hold";
export type ArticleStatus = "new" | "reviewed" | "excluded" | "reported";
export type ExcludeReason = "sports" | "sports_sponsor" | "csr" | "marketing" | null;
export type KeywordType = "official" | "alias" | "english" | "service" | "corporation";
export type ScoringCategory = "partnership" | "financial" | "risk" | "tech";
export type SourceType = "rss" | "html";
export type SourceTier = "wire" | "economy" | "general";

export interface Article {
  id: number;
  collected_at: string;
  published_at: string;
  source_name: string;
  source_type: SourceType;
  title: string;
  summary: string;
  body_text: string;
  url: string;
  auto_partners: string;    // JSON array string
  manual_partner: string | null;
  final_partner: string;    // JSON array string
  matched_keywords: string; // JSON array string
  exclude_keywords: string; // JSON array string
  exclude_reason: ExcludeReason;
  source_score: number;
  keyword_score: number;
  partner_score: number;
  spread_score: number;
  total_score: number;
  alert_level: AlertLevel;
  status: ArticleStatus;
  note: string | null;
  is_duplicate: 0 | 1;
  ai_summary: string | null;
  ai_impact: string | null;
  ai_analyzed_at: string | null;
}

export interface Partner {
  id: number;
  partner_name: string;
  is_active: 0 | 1;
  created_at: string;
}

export interface PartnerKeyword {
  id: number;
  partner_id: number;
  partner_name: string;
  keyword: string;
  keyword_type: KeywordType;
  is_active: 0 | 1;
}

export interface ScoringKeyword {
  id: number;
  keyword: string;
  score: number;
  category: ScoringCategory;
  is_active: 0 | 1;
}

export interface ExclusionKeyword {
  id: number;
  keyword: string;
  reason: Exclude<ExcludeReason, null>;
  is_override: 0 | 1; // 1 = 제외 취소 키워드
  is_active: 0 | 1;
}

export interface Source {
  id: number;
  source_name: string;
  tier: SourceTier;
  source_type: SourceType;
  url: string | null;
  is_active: 0 | 1;
  source_score: number;
  last_collected_at: string | null;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface DashboardStats {
  todayTotal: number;
  todayAlert: number;
  todayExcluded: number;
  activePartners: number;
  weeklyTrend: { date: string; count: number; alert: number }[];
  byPartner: { partner: string; total: number; alert: number }[];
  bySource: { source: string; count: number }[];
  byExcludeReason: { reason: string; count: number }[];
}

export interface ArticleListItem {
  id: number;
  collected_at: string;
  published_at: string;
  source_name: string;
  title: string;
  url: string;
  final_partner: string[];
  auto_partners: string[];
  matched_keywords: string[];
  total_score: number;
  alert_level: AlertLevel;
  status: ArticleStatus;
  exclude_reason: ExcludeReason;
  is_duplicate: boolean;
}

export interface ArticleFilters {
  dateFrom?: string;
  dateTo?: string;
  partner?: string;
  source?: string;
  alertLevel?: AlertLevel;
  status?: ArticleStatus;
  includeExcluded?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}
