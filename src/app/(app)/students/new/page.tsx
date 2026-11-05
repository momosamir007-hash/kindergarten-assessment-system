"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Card, Field, PageTitle, inputCls, useApp, useToast } from "@/components/ui";
import { api } from "@/lib/client";

export default function NewStudent() {
  const router = useRouter();
  const toast = useToast();
  const { classes, classId, reload } = useApp();
  const [f, setF] = useState({ fullName: "", birthDate: "", gender: "", nationalId: "", classId, notes: "" });
  const [extras, setExtras] = useState<{ k: string; v: string }[]>([]);
  const [err, setErr] = useState("");
  const [dup, setDup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (force = false) => {
    setBusy(true);
    setErr("");
    try {
      const extra = Object.fromEntries(extras.filter((x) => x.k.trim()).map((x) => [x.k.trim(), x.v]));
      const r = await api<{ id: string }>("/api/students", { json: { ...f, extra, force } });
      toast("تمت إضافة التلميذ");
      await reload();
      router.push(`/students/${r.id}`);
    } catch (e) {
      const x = e as Error & { status?: number };
      if (x.status === 409) setDup(x.message);
      else setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDup(null); };

  return (
    <>
      <PageTitle>إضافة تلميذ</PageTitle>
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم الكامل *"><input className={inputCls} value={f.fullName} onChange={set("fullName")} required /></Field>
          <Field label="رقم التعريف" hint="يُستعمل لمنع التكرار"><input className={inputCls} dir="ltr" value={f.nationalId} onChange={set("nationalId")} /></Field>
          <Field label="تاريخ الميلاد"><input type="date" className={inputCls} value={f.birthDate} onChange={set("birthDate")} /></Field>
          <Field label="الجنس">
            <select className={inputCls} value={f.gender} onChange={set("gender")}><option value="">—</option><option value="M">ذكر</option><option value="F">أنثى</option></select>
          </Field>
          <Field label="القسم">
            <select className={inputCls} value={f.classId} onChange={set("classId")}><option value="">— بدون قسم —</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field label="ملاحظات"><input className={inputCls} value={f.notes} onChange={set("notes")} /></Field>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-semibold">معلومات إضافية مخصصة</div>
            {extras.map((x, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input className={inputCls} placeholder="الحقل (مثال: اسم الولي)" value={x.k} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, k: e.target.value } : y)))} />
                <input className={inputCls} placeholder="القيمة" value={x.v} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, v: e.target.value } : y)))} />
                <Btn type="button" variant="ghost" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>✕</Btn>
              </div>
            ))}
            <Btn type="button" variant="ghost" onClick={() => setExtras([...extras, { k: "", v: "" }])}>+ حقل إضافي</Btn>
          </div>
          {err && <div className="rounded-xl bg-red-50 p-2 text-sm text-red-700 sm:col-span-2">{err}</div>}
          {dup && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm sm:col-span-2">
              <b>⚠ {dup}</b>
              <div className="mt-2 flex gap-2"><Btn type="button" variant="ghost" onClick={() => submit(true)}>إضافة كسجل جديد رغم ذلك</Btn><Btn type="button" variant="ghost" onClick={() => router.push("/students")}>إلغاء</Btn></div>
            </div>
          )}
          <div className="sm:col-span-2"><Btn disabled={busy}>{busy ? "…" : "حفظ التلميذ"}</Btn></div>
        </form>
      </Card>
    </>
  );
}
