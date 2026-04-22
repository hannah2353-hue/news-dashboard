"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Newspaper, Users, Tags, Radio, Download, X, Settings,
} from "lucide-react";

const NAV = [
  { href: "/",          label: "대시보드",      icon: LayoutDashboard },
  { href: "/articles",  label: "기사 리스트",   icon: Newspaper },
  { href: "/partners",  label: "제휴사 관리",   icon: Users },
  { href: "/keywords",  label: "키워드 정책",   icon: Tags },
  { href: "/sources",   label: "수집 소스",     icon: Radio },
  { href: "/admin",     label: "관리자 도구",   icon: Settings },
];

interface Props { onClose?: () => void; }

export default function Sidebar({ onClose }: Props) {
  const path = usePathname();
  return (
    <aside className="w-56 h-full min-h-screen bg-slate-900 text-slate-200 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-700 flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">News Monitor</p>
          <h1 className="mt-1 text-base font-bold text-white leading-tight">제휴채널<br/>뉴스 이슈 모니터링</h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white mt-1" aria-label="닫기">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700 space-y-1">
        <a
          href="/api/export?format=xlsx"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Download size={16} />
          Excel 다운로드
        </a>
        <a
          href="/api/export?format=csv"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Download size={16} />
          CSV 다운로드
        </a>
      </div>
    </aside>
  );
}
