"use client";

import Link from "next/link";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus, ExternalLink } from "lucide-react";
import { Card, ClassPeriodPicker, Empty, PageTitle, Spinner, useApiData, useApp } from "@/components/ui";
import type { ProgressPoint } from "@/lib/report-types";

type Resp = {
  students: {
    student: { id: string; fullName: string };
    progress: ProgressPoint[];
  }[];
};

const avg = (p: ProgressPoint) => {
  const v = [p.academicPct, p.behavioralPct].filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

export default function ProgressPage() {
  const { classId, periods } = useApp();
  const { data, loading } = useApiData<Resp>(
    classId ? `/api/reports/class/${classId}?format=json&inline=1` : null,
    [classId]
  );
  const names = periods.map((p) => p.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle sub="متابعة المسار النمائي والتطور التراكمي لكل طفل عبر فترات الملاحظة المتتابعة">
          المسار النمائي وتطور الكفاءات
        </PageTitle>
        <ClassPeriodPicker withPeriod={false} />
      </div>

      <Card>
        {loading && <Spinner label="جارٍ حساب مؤشرات التطور..." />}
        {data && !data.students.length && <Empty>لا يوجد أطفال مسجلون في هذا القسم بعد.</Empty>}

        {data && data.students.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-bold">
                  <th className="pb-3 text-right pr-2">الطفل(ة)</th>
                  {names.map((n) => (
                    <th key={n} className="pb-3 text-center px-2">
                      {n}
                    </th>
                  ))}
                  <th className="pb-3 text-center px-2">اتجاه المسار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.students.map((s) => {
                  const vals = names.map((n) => {
                    const p = s.progress.find((x) => x.periodName === n);
                    return p ? avg(p) : null;
                  });
                  const done = vals.filter((v): v is number => v !== null);
                  const d = done.length >= 2 ? done[done.length - 1] - done[done.length - 2] : null;

                  return (
                    <tr key={s.student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pr-2 text-right font-bold text-slate-800">
                        <Link
                          className="hover:text-[#0f4c81] hover:underline inline-flex items-center gap-1.5"
                          href={`/students/${s.student.id}`}
                        >
                          <span>{s.student.fullName}</span>
                          <ExternalLink size={12} className="text-slate-400" />
                        </Link>
                      </td>

                      {vals.map((v, i) => (
                        <td key={i} className="py-3 px-2 text-center font-mono font-medium">
                          {v === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                              {v}%
                            </span>
                          )}
                        </td>
                      ))}

                      <td className="py-3 px-2 text-center font-bold">
                        {d === null ? (
                          <span className="text-slate-400 text-xs">—</span>
                        ) : d > 3 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                            <ArrowUpRight size={13} />
                            <span>تطور إيجابي (+{Math.round(d)}%)</span>
                          </span>
                        ) : d < -3 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                            <ArrowDownRight size={13} />
                            <span>يحتاج مرافقة ({Math.round(d)}%)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                            <Minus size={12} />
                            <span>مستقر</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
