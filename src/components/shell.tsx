"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  TrendingUp,
  FileText,
  Sparkles,
  UploadCloud,
  HardDriveDownload,
  Settings,
  Menu,
  X,
  School,
  LogOut,
} from "lucide-react";
import { AppProvider, useApp } from "@/components/ui";
import { api } from "@/lib/client";

const navigation = [
  { name: "لوحة التحكم", href: "/", icon: LayoutDashboard },
  { name: "سجل الأطفال", href: "/students", icon: Users },
  { name: "شبكة التقييم", href: "/class-eval", icon: CheckSquare },
  { name: "المسار النمائي", href: "/progress", icon: TrendingUp },
  { name: "التقارير والدفاتر", href: "/reports", icon: FileText },
  { name: "التوجيه الذكي", href: "/ai", icon: Sparkles },
  { name: "الاستيراد والرقمنة", href: "/import", icon: UploadCloud },
  { name: "النسخ الاحتياطي", href: "/backup", icon: HardDriveDownload },
  { name: "الإعدادات", href: "/settings", icon: Settings },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { user, settings } = useApp();

  const handleLogout = async () => {
    try {
      await api("/api/auth", { json: { action: "logout" } });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 transform bg-white border-l border-slate-200/80 shadow-xs transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 flex flex-col justify-between ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div>
          {/* Institution Header */}
          <div className="flex h-18 items-center justify-between px-5 border-b border-slate-100">
            <Link href="/" className="flex items-center gap-3 min-w-0">
              {settings?.logo ? (
                <img
                  src={settings.logo}
                  alt="شعار المؤسسة"
                  className="h-10 w-10 rounded-xl object-contain border border-slate-200/80 shrink-0 shadow-2xs"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f4c81] to-[#1e6bb8] text-white shadow-xs shrink-0">
                  <School size={20} strokeWidth={2.2} />
                </div>
              )}
              <div className="min-w-0">
                <span className="block text-sm font-black text-slate-800 truncate">
                  {settings?.name || "نظام التقييم التربوي"}
                </span>
                <span className="block text-[11px] font-medium text-slate-400 truncate">
                  {settings?.academicYear ? `الموسم: ${settings.academicYear}` : "مرحلة الطفولة المبكرة"}
                </span>
              </div>
            </Link>

            <button
              className="lg:hidden p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              onClick={() => setSidebarOpen(false)}
              aria-label="إغلاق القائمة"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 p-3 overflow-y-auto max-h-[calc(100vh-10rem)]">
            {navigation.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs md:text-sm font-semibold transition-all duration-150 group ${
                    isActive
                      ? "bg-blue-50/90 text-[#0f4c81] font-bold shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div
                    className={`transition-colors shrink-0 ${
                      isActive ? "text-[#0f4c81]" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
                  </div>
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl">
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-800 truncate">
                {user.fullName || "المستخدم"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {user.role === "admin" ? "مدير المؤسسة" : "معلم / مربية"}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="flex lg:hidden h-14 items-center justify-between bg-white px-4 border-b border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f4c81] text-white">
              <School size={16} />
            </div>
            <span className="text-xs font-black text-slate-800">
              {settings?.name || "التقييم التربوي"}
            </span>
          </div>
          <button
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Page Container */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ShellInner>{children}</ShellInner>
    </AppProvider>
  );
}
