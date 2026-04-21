"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { DashboardStats } from "@/lib/types";

const COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316","#84cc16","#6366f1","#14b8a6","#f43f5e"];

const REASON_LABEL: Record<string, string> = {
  sports: "스포츠", sports_sponsor: "스포츠후원", csr: "사회공헌", marketing: "마케팅", none: "기타",
};

export function PartnerBarChart({ data }: { data: DashboardStats["byPartner"] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="partner" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="total" name="전체" fill="#3b82f6" radius={[3,3,0,0]} />
        <Bar dataKey="alert" name="긴급" fill="#ef4444" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data }: { data: DashboardStats["weeklyTrend"] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="count" name="수집기사" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="alert" name="긴급" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SourceBarChart({ data }: { data: DashboardStats["bySource"] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 20, left: 60, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={60} />
        <Tooltip />
        <Bar dataKey="count" name="기사 수" fill="#10b981" radius={[0,3,3,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExclusionPieChart({ data }: { data: DashboardStats["byExcludeReason"] }) {
  const labeled = data.map((d) => ({ ...d, name: REASON_LABEL[d.reason] ?? d.reason }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={labeled} dataKey="count" nameKey="name"
          cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {labeled.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
