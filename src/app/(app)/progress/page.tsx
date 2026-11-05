"use client";
import Link from "next/link";
import { Card, ClassPeriodPicker, Empty, PageTitle, Spinner, useApiData, useApp } from "@/components/ui";
import type { ProgressPoint } from "@/lib/report-types";

type Resp = { students: { student: { id: string; fullName: string }; progress: ProgressPoint[] }[] };
const avg = (p: ProgressPoint) => { const v = [p.academicPct, p.behavioralPct].filter((x): x is number => x !== null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };

export default function ProgressPage() {
  const { classId, periods } = useApp();
  const { data, loading } = useApiData<Resp>(classId ? `/api/reports/class/${classId}?format=json&inline=1` : null, [classId]);
  const names = periods.map((p) => p.name);
  return (
    <>
      <PageTitle sub="المعدل العام لكل تلميذ في كل فترة، مع اتجاه التطور بين آخر فترتين مقيَّمتين">متابعة التطور</PageTitle>
      <div className="mb-3"><ClassPeriodPicker withPeriod={false} /></div>
      <Card>
        {loading && <Spinner />}
        {data && !data.students.length && <Empty>لا يوجد تلاميذ.</Empty>}
        {data && data.students.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b text-xs text-slate-500"><th className="p-2 text-right">التلميذ</th>{names.map((n) => <th key={n} className="p-2">{n}</th>)}<th className="p-2">الاتجاه</th></tr></thead>
              <tbody>
                {data.students.map((s) => {
                  const vals = names.map((n) => { const p = s.progress.find((x) => x.periodName === n); return p ? avg(p) : null; });
                  const done = vals.filter((v): v is number => v !== null);
                  const d = done.length >= 2 ? done[done.length - 1] - done[done.length - 2] : null;
                  return (
                    <tr key={s.student.id} className="border-b text-center last:border-0">
                      <td className="p-2 text-right font-semibold"><Link className="text-[#0f4c81] hover:underline" href={`/students/${s.student.id}`}>{s.student.fullName}</Link></td>
                      {vals.map((v, i) => <td key={i} className="p-2">{v === null ? <span className="text-slate-300">—</span> : `${v}%`}</td>)}
                      <td className="p-2 font-bold">{d === null ? "—" : d > 3 ? <span className="text-green-600">▲ +{Math.round(d)}</span> : d < -3 ? <span className="text-red-600">▼ {Math.round(d)}</span> : <span className="text-slate-500">● مستقر</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
