"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Btn, Card, Empty, PageTitle, Spinner, inputCls, useApiData, useApp, useToast } from "@/components/ui";
import { GENDER_LABEL, api } from "@/lib/client";

type S = { id: string; fullName: string; birthDate: string | null; gender: string | null; nationalId: string | null; classId: string | null; className: string | null };

export default function Students() {
  const { classes, reload } = useApp();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("");
  const url = `/api/students?q=${encodeURIComponent(q)}${cls ? `&classId=${cls}` : ""}`;
  const { data, loading, reload: rl } = useApiData<S[]>(url);

  const remove = async (s: S) => {
    if (!confirm(`حذف التلميذ «${s.fullName}» وجميع تقييماته نهائيًا؟`)) return;
    try {
      await api(`/api/students/${s.id}`, { method: "DELETE" });
      toast("تم الحذف");
      rl();
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    }
  };

  return (
    <>
      <PageTitle sub="سجل الملاحظة والبيانات الفردية لكل طفل(ة) في مرحلة الطفولة المبكرة">سجل الأطفال</PageTitle>
      <Card
        actions={
          <>
            <Link href="/students/new"><Btn>➕ إضافة طفل(ة)</Btn></Link>
            <Link href="/import"><Btn variant="ghost">📥 استيراد جماعي</Btn></Link>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={`${inputCls} max-w-xs`} placeholder="بحث بالاسم أو رقم التعريف…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${inputCls} w-auto`} value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">كل الأفواج / الأقسام</option>
            <option value="none">بدون فوج</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="self-center text-sm font-semibold text-slate-500">{data?.length ?? 0} طفل(ة)</span>
        </div>
        {loading && !data && <Spinner />}
        {data && !data.length && <Empty>لا يوجد تلاميذ مطابقون.</Empty>}
        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-xs text-slate-500">
                  <th className="p-2">الاسم الكامل</th><th className="p-2">القسم</th><th className="hidden p-2 sm:table-cell">الميلاد</th><th className="hidden p-2 sm:table-cell">الجنس</th><th className="hidden p-2 md:table-cell">رقم التعريف</th><th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-2 font-semibold"><Link href={`/students/${s.id}`} className="text-[#0f4c81] hover:underline">{s.fullName}</Link></td>
                    <td className="p-2">{s.className ? <Badge color="#0f4c81">{s.className}</Badge> : "—"}</td>
                    <td className="hidden p-2 sm:table-cell" dir="ltr">{s.birthDate ?? "—"}</td>
                    <td className="hidden p-2 sm:table-cell">{GENDER_LABEL[s.gender ?? ""] ?? "—"}</td>
                    <td className="hidden p-2 md:table-cell" dir="ltr">{s.nationalId ?? "—"}</td>
                    <td className="p-2 text-left"><button onClick={() => remove(s)} className="text-xs text-red-600 hover:underline">حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
