"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  FileBarChart, 
  UploadCloud, 
  Settings, 
  Menu, 
  X 
} from "lucide-react";
import { Button } from "./ui";

const navigation = [
  { name: "لوحة التحكم", href: "/", icon: LayoutDashboard },
  { name: "التلاميذ", href: "/students", icon: Users },
  { name: "التقييم", href: "/class-eval", icon: CheckSquare },
  { name: "التقارير", href: "/reports", icon: FileBarChart },
  { name: "الاستيراد", href: "/import", icon: UploadCloud },
  { name: "الإعدادات", href: "/settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 transform bg-white border-l border-slate-200 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <span className="text-lg font-bold text-slate-800">نظام رياض الأطفال</span>
          <Button variant="ghost" className="lg:hidden p-1 h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </Button>
        </div>
        
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={20} className={isActive ? "text-blue-600" : "text-slate-400"} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex lg:hidden h-16 items-center justify-between bg-white px-4 border-b border-slate-200 shadow-sm">
          <span className="text-lg font-bold text-slate-800">الرئيسية</span>
          <Button variant="ghost" className="p-2 h-10 w-10" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
