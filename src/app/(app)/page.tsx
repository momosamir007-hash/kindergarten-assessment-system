"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  TrendingUp,
  FileText,
  UserPlus,
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Btn, Spinner, useApiData, useApp } from "@/components/ui";

type DashboardStats = {
  studentCount: number;
  classCount: number;
  evalCount: number;
  class?: {
    className: string;
    students: { id: string; evaluated: number }[];
  } | null;
  progress?: { name: string; avg: number }[];
};

export default function DashboardPage() {
  const { classId, periodId } = useApp();
  const url = `/api/dashboard${classId ? `?classId=${classId}${periodId ? `&periodId=${periodId}` : ""}` : ""}`;
  const { data, loading } = useApiData<DashboardStats>(url, [classId, periodId]);

  const studentsCount = data?.studentCount ?? 0;
  const evalsCount = data?.evalCount ?? 0;
  const classesCount = data?.classCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-gradient-to-l from-[#0f4c81] to-[#1e6bb8] p-6 md:p-8 text-white shadow-xs">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
            ✨ نظام الملاحظة والتقييم النمائي الشامل
          </span>
          <h1 className="text-xl md:text-3xl font-black tracking-tight">
            مرحباً بك في لوحة المتابعة التربوية
          </h1>
          <p className="text-xs md:text-sm text-blue-100 max-w-xl leading-relaxed">
            متابعة دقيقة لمكتسبات الأطفال، دفاتر التقييم الفردية، والتقارير الشاملة وفق أسس التربية التحضيرية والطفولة المبكرة.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
          <Link href="/students/new">
            <Btn variant="secondary" className="w-full text-xs md:text-sm bg-white text-[#0f4c81] hover:bg-blue-50 font-bold shadow-xs">
              <UserPlus size={16} />
              <span>تسجيل طفل(ة) جديد</span>
            </Btn>
          </Link>
          <Link href="/class-eval">
            <Btn variant="outline" className="w-full text-xs md:text-sm border-white/30 text-white hover:bg-white/10 font-bold">
              <ClipboardCheck size={16} />
              <span>بدء جلسة تقييم</span>
            </Btn>
          </Link>
        </div>
      </div>

      {loading && !data && <Spinner label="جارٍ تحميل مؤشرات النشاط..." />}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-blue-200 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs md:text-sm font-bold text-slate-500">إجمالي الأطفال المسجلين</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0f4c81]">
              <Users size={18} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{studentsCount}</div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              موزعون على {classesCount} أفواج / أقسام
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-emerald-200 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs md:text-sm font-bold text-slate-500">التقييمات والملاحظات المرصودة</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{evalsCount}</div>
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">
              سجل تراكمي محفوظ لا يُحذف
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-indigo-200 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs md:text-sm font-bold text-slate-500">الأقسام التربوية</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen size={18} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{classesCount}</div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              فوج / قسم تحضيري
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/class-eval" className="block group">
          <Card className="h-full group-hover:border-blue-400 group-hover:shadow-sm transition-all p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0f4c81] group-hover:bg-[#0f4c81] group-hover:text-white transition-colors shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <span>شبكة التقييم</span>
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-[#0f4c81] group-hover:translate-x-[-2px] transition-all" />
                </div>
                <div className="text-xs text-slate-400 truncate">رصد ملاحظات الفوج كاملاً</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/reports" className="block group">
          <Card className="h-full group-hover:border-emerald-400 group-hover:shadow-sm transition-all p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <span>التقارير والدفاتر</span>
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-[-2px] transition-all" />
                </div>
                <div className="text-xs text-slate-400 truncate">تقرير A4 فردي ومجمّع</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/progress" className="block group">
          <Card className="h-full group-hover:border-indigo-400 group-hover:shadow-sm transition-all p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                <TrendingUp size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <span>المسار النمائي</span>
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-[-2px] transition-all" />
                </div>
                <div className="text-xs text-slate-400 truncate">تطور الكفاءات عبر الفترات</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/ai" className="block group">
          <Card className="h-full group-hover:border-purple-400 group-hover:shadow-sm transition-all p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <span>التوجيه الذكي</span>
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-purple-600 group-hover:translate-x-[-2px] transition-all" />
                </div>
                <div className="text-xs text-slate-400 truncate">اقتراحات الدعم والمعالجة</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
