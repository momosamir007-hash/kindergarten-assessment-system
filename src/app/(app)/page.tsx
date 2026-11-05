"use client";
import Link from "next/link";
import { HBar, LineChart } from "@/components/charts";
import { Card, ClassPeriodPicker, Empty, PageTitle, Spinner, useApiData, useApp } from "@/components/ui";
import type { ClassAnalysis } from "@/lib/analysis";
import type { ClassReportData } from "@/lib/report-types";

type Dash = { studentCount: number; classCount: number; evalCount: number; class: ClassReportData | null; analysis?: ClassAnalysis; progress?: { name: string; avg: number }[] };

export default function Dashboard() {
  const { classId, periodId, settings, classes } = useApp();
  const { data, loading, error } = useApiData<Dash>(`/api/dashboard?classId=${classId}&periodId=${periodId}`);
  const levels = settings?.settings.levels ?? [];
  const c = data?.class;
  const a = data?.analysis;
  const totalEv = a ? Object.values(a.distribution).reduce((x, y) => x + y, 0) : 0;

  return (
    <>
      <PageTitle sub="نظرة عامة على القسم والفترة المحددة">لوحة التحكم</PageTitle>
      <div className="mb-4"><ClassPeriodPicker /></div>
      {loading && <Spinner />}
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["التلاميذ", data.studentCount, "🧒"],
              ["الأقسام", data.classCount, "🏫"],
              ["التقييمات المسجلة", data.evalCount, "📝"],
              ["المعدل العام للقسم", a?.avgOverall != null ? `${a.avgOverall}%` : "—", "🎯"],
            ].map(([l, v, i]) => (
              <div key={String(l)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-2xl">{i}</div>
                <div className="text-2xl font-extrabold text-[#0f4c81]">{v}</div>
                <div className="text-xs text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          {!classes.length && <Empty>لا توجد أقسام بعد. أنشئ قسمًا من <Link href="/settings" className="font-bold text-[#0f4c81] underline">الإعدادات</Link> ثم أضف التلاميذ.</Empty>}
          {data.studentCount === 0 && classes.length > 0 && (
            <Empty>لا يوجد تلاميذ بعد. <Link href="/students/new" className="font-bold text-[#0f4c81] underline">أضف تلميذًا</Link> أو <Link href="/import" className="font-bold text-[#0f4c81] underline">استورد قائمة</Link>.</Empty>
          )}
          {c && a && c.students.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="توزيع مستويات الاكتساب">
                {totalEv === 0 ? <Empty>لا توجد تقييمات في هذه الفترة.</Empty> : levels.map((l) => <HBar key={l.key} label={l.label} value={Math.round(((a.distribution[l.key] ?? 0) / totalEv) * 1000) / 10} color={l.color} />)}
              </Card>
              <Card title="تطور معدل القسم عبر الفترات">
                {data.progress && data.progress.length ? <LineChart points={data.progress.map((p) => ({ label: p.name, value: p.avg }))} /> : <Empty>لا توجد بيانات كافية.</Empty>}
              </Card>
              <Card title="المهارات الأكثر صعوبة">
                {a.hardest.length ? a.hardest.map((s) => <HBar key={s.skillName + s.subjectName} label={`${s.skillName} — ${s.subjectName}`} value={s.avgPercent} color="#dc2626" />) : <Empty>لا توجد مهارات دون عتبة التميز.</Empty>}
              </Card>
              <Card title="المهارات الأكثر إتقانًا">
                {a.best.length ? a.best.map((s) => <HBar key={s.skillName + s.subjectName} label={`${s.skillName} — ${s.subjectName}`} value={s.avgPercent} color="#16a34a" />) : <Empty>لا توجد مهارات بلغت عتبة التميز.</Empty>}
              </Card>
              <Card title={`تلاميذ يحتاجون دعمًا (${a.supportGroup.length})`}>
                {a.supportGroup.length ? <div className="flex flex-wrap gap-1">{c.students.filter((s) => a.supportGroup.includes(s.fullName)).map((s) => <Link key={s.id} href={`/students/${s.id}`} className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">{s.fullName}</Link>)}</div> : <Empty>لا يوجد تلاميذ دون عتبة الدعم.</Empty>}
              </Card>
              <Card title="إجراءات سريعة">
                <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                  <Link className="rounded-xl bg-[#0f4c81] p-3 text-center text-white" href="/class-eval">📝 تقييم القسم</Link>
                  <Link className="rounded-xl bg-slate-100 p-3 text-center" href="/reports">🖨️ التقارير والتصدير</Link>
                  <Link className="rounded-xl bg-slate-100 p-3 text-center" href="/import">📥 استيراد تلاميذ</Link>
                  <Link className="rounded-xl bg-slate-100 p-3 text-center" href="/ai">🤖 التحليل الذكي</Link>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
