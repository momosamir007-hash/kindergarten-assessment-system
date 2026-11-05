"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AiBanner, StudentAiView } from "@/components/ai-view";
import { LineChart } from "@/components/charts";
import { EvalForm } from "@/components/eval-form";
import { StudentExport } from "@/components/export";
import { Badge, Btn, Card, ClassPeriodPicker, Empty, PageTitle, Spinner, inputCls, useApiData, useApp, useToast } from "@/components/ui";
import { GENDER_LABEL, api } from "@/lib/client";
import type { SkillResult, StudentReportData } from "@/lib/report-types";

type Student = { id: string; fullName: string; birthDate: string | null; gender: string | null; nationalId: string | null; classId: string | null; className: string; level: string; notes: string; extra: Record<string, unknown> };
type Ai = { id: string; source: string; provider: string; content: Record<string, unknown>; createdAt: string; error?: string; recorded?: SkillResult[] };

const TABS = [["file", "ملف الطفل"], ["academic", "التعلم والاستكشاف"], ["behavioral", "الحركية والاستقلالية"], ["progress", "المسار النمائي"], ["ai", "التوجيه الذكي"], ["export", "الدفتر والتقارير"]] as const;

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { classes, periodId, reload } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("file");
  const { data: s, loading, reload: rl } = useApiData<Student>(`/api/students/${id}`);
  const [edit, setEdit] = useState<Partial<Student> | null>(null);

  if (loading && !s) return <Spinner />;
  if (!s) return <Empty>التلميذ غير موجود.</Empty>;

  const saveEdit = async () => {
    try {
      await api(`/api/students/${id}`, { method: "PATCH", json: edit });
      toast("تم حفظ التعديلات");
      setEdit(null);
      rl();
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    }
  };

  return (
    <>
      <PageTitle sub={`${s.className || "بدون قسم"}${s.level ? " — " + s.level : ""}`}>{s.fullName}</PageTitle>
      <div className="mb-3"><ClassPeriodPicker withClass={false} /></div>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${tab === k ? "bg-[#0f4c81] text-white" : "text-slate-600"}`}>{l}</button>
        ))}
      </div>

      {tab === "file" && (
        <Card title="المعلومات الشخصية" actions={!edit && <Btn variant="ghost" onClick={() => setEdit({ fullName: s.fullName, birthDate: s.birthDate ?? "", gender: s.gender ?? "", nationalId: s.nationalId ?? "", classId: s.classId, notes: s.notes })}>✏️ تعديل</Btn>}>
          {!edit ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {([["الاسم الكامل", s.fullName], ["رقم التعريف", s.nationalId || "—"], ["تاريخ الميلاد", s.birthDate || "—"], ["الجنس", GENDER_LABEL[s.gender ?? ""] ?? "—"], ["القسم", s.className || "—"], ["ملاحظات", s.notes || "—"]] as [string, string][]).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
              {Object.entries(s.extra ?? {}).filter(([, v]) => typeof v !== "object").map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold">{String(v)}</dd></div>)}
            </dl>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputCls} value={edit.fullName ?? ""} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} placeholder="الاسم الكامل" />
              <input className={inputCls} dir="ltr" value={edit.nationalId ?? ""} onChange={(e) => setEdit({ ...edit, nationalId: e.target.value })} placeholder="رقم التعريف" />
              <input type="date" className={inputCls} value={edit.birthDate ?? ""} onChange={(e) => setEdit({ ...edit, birthDate: e.target.value })} />
              <select className={inputCls} value={edit.gender ?? ""} onChange={(e) => setEdit({ ...edit, gender: e.target.value })}><option value="">الجنس</option><option value="M">ذكر</option><option value="F">أنثى</option></select>
              <select className={inputCls} value={edit.classId ?? ""} onChange={(e) => setEdit({ ...edit, classId: e.target.value })}><option value="">بدون قسم</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input className={inputCls} value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="ملاحظات" />
              <div className="flex gap-2"><Btn onClick={saveEdit}>حفظ</Btn><Btn variant="ghost" onClick={() => setEdit(null)}>إلغاء</Btn></div>
            </div>
          )}
          <div className="mt-4 border-t pt-3"><Btn variant="danger" onClick={async () => { if (confirm("حذف التلميذ نهائيًا مع كل تقييماته؟")) { await api(`/api/students/${id}`, { method: "DELETE" }); await reload(); router.replace("/students"); } }}>حذف التلميذ</Btn></div>
        </Card>
      )}
      {tab === "academic" && <Card title="مجالات التعلم والاستكشاف المبكر (لغة، رياضيات حسية، استكشاف)"><EvalForm studentId={id} kind="academic" /></Card>}
      {tab === "behavioral" && <Card title="مجالات التنشئة الاجتماعية، الحركية، الاستقلالية والفنون"><EvalForm studentId={id} kind="behavioral" /></Card>}
      {tab === "progress" && <Progress id={id} periodId={periodId} />}
      {tab === "ai" && <AiTab id={id} periodId={periodId} />}
      {tab === "export" && <Card title="دفتر التقييم النمائي للطفل"><StudentExport studentId={id} periodId={periodId} /></Card>}
    </>
  );
}

function Progress({ id, periodId }: { id: string; periodId: string }) {
  const { data, loading } = useApiData<{ students: { progress: StudentReportData["progress"]; results: SkillResult[] }[] }>(`/api/reports/student/${id}?format=json&inline=1&periodId=${periodId}`);
  const { settings } = useApp();
  if (loading) return <Spinner />;
  const p = data?.students[0]?.progress ?? [];
  const levels = settings?.settings.levels ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="تطور المعدلات عبر الفترات">
        {p.length < 1 ? <Empty>لا توجد تقييمات مسجلة بعد.</Empty> : <LineChart points={p.map((x) => { const v = [x.academicPct, x.behavioralPct].filter((n): n is number => n !== null); return { label: x.periodName, value: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null }; })} />}
        {p.length > 0 && (
          <table className="mt-3 w-full text-sm"><thead><tr className="text-xs text-slate-500"><th className="p-1 text-right">الفترة</th><th>أكاديمي</th><th>سلوكي</th></tr></thead><tbody>{p.map((x) => <tr key={x.periodName} className="border-t text-center"><td className="p-1 text-right">{x.periodName}</td><td>{x.academicPct ?? "—"}%</td><td>{x.behavioralPct ?? "—"}%</td></tr>)}</tbody></table>
        )}
      </Card>
      <Card title="النتائج الحالية">
        {(data?.students[0]?.results ?? []).length === 0 ? <Empty>لا توجد نتائج في الفترة المحددة.</Empty> : (
          <ul className="space-y-1 text-sm">{data!.students[0].results.map((r) => <li key={r.skillId} className="flex justify-between border-b py-1"><span>{r.skillName} <span className="text-xs text-slate-400">({r.subjectName})</span></span><Badge color={levels.find((l) => l.key === r.levelKey)?.color}>{r.levelLabel}</Badge></li>)}</ul>
        )}
      </Card>
    </div>
  );
}

function AiTab({ id, periodId }: { id: string; periodId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Ai | null>(null);
  const old = useApiData<Ai[]>(`/api/ai?scope=student&targetId=${id}`);
  const run = async () => {
    setBusy(true);
    try {
      setRes(await api<Ai>("/api/ai", { json: { scope: "student", targetId: id, periodId } }));
      old.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل التحليل", "err");
    } finally {
      setBusy(false);
    }
  };
  const shown = res ?? (old.data?.[0] ? { ...old.data[0] } : null);
  return (
    <Card title="التحليل التربوي الذكي" actions={<Btn disabled={busy} onClick={run}>{busy ? "جارٍ التحليل…" : "🤖 تحليل نتائج التلميذ"}</Btn>}>
      <p className="mb-3 text-xs text-slate-500">يُرسل إلى مزوّد الذكاء الاصطناعي (إن وُجد) رمز مجهول ونتائج المهارات فقط — دون الاسم أو أي بيانات شخصية أو ملاحظات نصية.</p>
      {shown ? (
        <>
          <AiBanner source={shown.source} provider={shown.provider} error={res?.error} />
          <StudentAiView c={shown.content} />
          <div className="mt-2 text-xs text-slate-400">تاريخ التحليل: {new Date(shown.createdAt).toLocaleString("ar-DZ-u-nu-latn")}</div>
        </>
      ) : <Empty>لم يُجرَ تحليل بعد لهذا التلميذ.</Empty>}
    </Card>
  );
}
