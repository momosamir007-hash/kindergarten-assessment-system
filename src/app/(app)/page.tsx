import React from "react";
import Link from "next/link";
import { Users, FileText, CheckCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";

export default async function DashboardPage() {
  const stats = { students: 120, evaluations: 450, completion: "85%" };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">مرحباً بك في لوحة التحكم</h1>
        <p className="text-slate-500 mt-1">نظرة عامة على نشاط النظام والتقييمات الحديثة.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">إجمالي التلاميذ</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.students}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">التقييمات المنجزة</CardTitle>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.evaluations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">نسبة الاكتمال</CardTitle>
            <TrendingUp className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.completion}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>إجراءات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            <Link href="/students/new" className="flex-1 block">
              <Button className="w-full h-12 text-base">
                <Users size={20} />
                إضافة تلميذ جديد
              </Button>
            </Link>
            <Link href="/class-eval" className="flex-1 block">
              <Button variant="outline" className="w-full h-12 text-base">
                <FileText size={20} />
                بدء جلسة تقييم
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
