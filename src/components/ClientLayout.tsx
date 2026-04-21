"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800 antialiased">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+, slide-in drawer on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-56 transform transition-transform duration-200 md:static md:translate-x-0 md:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="text-slate-600 hover:text-slate-900"
            aria-label="메뉴 열기"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-slate-700">뉴스 이슈 모니터링</span>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
