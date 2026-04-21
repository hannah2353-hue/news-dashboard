"use client";
import { useEffect, useState } from "react";
import KpiCard from "@/components/KpiCard";
import {
  PartnerBarChart, TrendLineChart, SourceBarChart, ExclusionPieChart,
} from "@/components/DashboardCharts";
import type { DashboardStats } from "@/lib/types";
import { RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/dashboard");
    const data = await res.json();
    setStats(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw size={20} className="animate-spin mr-2" /> 로딩 중...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="text-sm text-slate-400 mt-0.5">오늘 기준 실시간 현황</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-1.5">
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="오늘 수집 기사" value={stats.todayTotal}   sub="제외 기사 제외"   color="blue" />
        <KpiCard title="오늘 긴급 기사"  value={stats.todayAlert}  sub="총점 8점 이상"    color="red" />
        <KpiCard title="오늘 제외 기사"  value={stats.todayExcluded} sub="스포츠/CSR/마케팅" color="amber" />
        <KpiCard title="모니터링 제휴사" value={stats.activePartners} sub="활성 제휴사 수" color="green" />
      </div>

      {/* 일별 추이 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">일별 기사 수집 추이 (최근 14일)</h2>
        <TrendLineChart data={stats.weeklyTrend} />
      </div>

      {/* 2-col 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">제휴사별 기사 수 (Top 12)</h2>
          <PartnerBarChart data={stats.byPartner} />
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">언론사별 기사 수 (Top 10)</h2>
          <SourceBarChart data={stats.bySource} />
        </div>
      </div>

      {/* 제외 사유 도넛 */}
      {stats.byExcludeReason.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">제외 사유별 현황</h2>
          <ExclusionPieChart data={stats.byExcludeReason} />
        </div>
      )}
    </div>
  );
}
