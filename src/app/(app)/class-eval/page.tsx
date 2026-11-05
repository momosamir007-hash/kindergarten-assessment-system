"use client";
import { useEffect, useMemo, useState } from "react";
import { Btn, Card, ClassPeriodPicker, Empty, PageTitle, Spinner, useApiData, useApp, useToast } from "@/components/ui";
import { api } from "@/lib/client";

type Subject = { id: string; name: string; kind: string; skills: { id: string; name: string }[] };
type Stu = { id: string; fullName: string };
type Cur = { studentId: string; skillId: string; levelKey: string };

export default function ClassEval() {
  const { classId, periodId, settings } = useApp();
  const toast = useToast();
  const levels = settings?.settings.levels ?? [];
  const subs = useApiData<Subject[]>("/api/curriculum");
  const stu = useApiData<Stu[]>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const ev = useApiData<{ current: Cur[] }>(classId && periodId ? `/api/evaluations?classId=${classId}&periodId=${periodId}` : null, [classId, periodId]);
  const [subjectId, setSubjectId] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({}); // `${studentId}|${skillId}` -> levelKey
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");

  useEffect(() => { if (!subjectId && subs.data?.length) setSubjectId(subs.data[0].id); }, [subs.data, subjectId]);
  useEffect(() => setDraft({}), [classId, periodId, subjectId]);
  const cur = useMemo(() => new Map((ev.data?.current ?? []).map((c) => [`${c.studentId}|${c.skillId}`, c.levelKey])), [ev.data]);
  const subject = subs.data?.find((s) => s.id === subjectId);

  const save = async () => {
    setBusy(true);
    try {
      const items = Object.entries(draft).map(([k, levelKey]) => { const [studentId, skillId] = k.split("|"); return { studentId, skillId, levelKey }; });
      await api("/api/evaluations", { json: { periodId, items } });
      toast(`تم حفظ ${items.length} تقييم`);
      setDraft({});
      ev.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy(false);
    }
  };
  const fillColumn = (skillId: string, levelKey: string) => {
    if (!stu.data || !levelKey) return;
    const d = { ...draft };
    for (const s of stu.data) d[`${s.id}|${skillId}`] = levelKey;
    setDraft(d);
  };
  const color = (k?: string) => levels.find((l) => l.key === k)?.color ?? "#94a3b8";

  return (
    <>
      <PageTitle sub="رصد الملاحظات النمائية لكافة أطفال الفوج في جدول موحّد مع حفظ تراكمي مستمر">شبكة الملاحظة الجماعية للفوج</PageTitle>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ClassPeriodPicker />
          <select className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subs.data?.map((s) => <option key={s.id} value={s.id}>{s.kind === "behavioral" ? "🧩 " : "📘 "}{s.name}</option>)}
          </select>
        </div>
        <div className="flex rounded-xl border bg-slate-100 p-0.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition bg-white text-slate-800 shadow-sm"
          >
            {viewMode === "table" ? "📊 عرض الجدول" : "📱 وضع بطاقات الهاتف"}
          </button>
        </div>
      </div>
      {!periodId && <Empty>اختر فترة دراسية محددة للتقييم.</Empty>}
      {periodId && (stu.loading || ev.loading || subs.loading) && <Spinner />}
      {periodId && stu.data && !stu.data.length && <Empty>لا يوجد تلاميذ في هذا القسم.</Empty>}
      {periodId && stu.data && stu.data.length > 0 && subject && (
        <Card>
          {/* Mobile Quick Cards View (Default on phone or when toggled) */}
          <div className={viewMode === "table" ? "hidden" : "block md:hidden space-y-3"}>
            {stu.data.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                <div className="mb-2 font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>🧒 {s.fullName}</span>
                </div>
                <div className="space-y-2">
                  {subject.skills.map((sk) => {
                    const k = `${s.id}|${sk.id}`;
                    const v = draft[k] ?? cur.get(k) ?? "";
                    return (
                      <div key={sk.id} className="rounded-lg bg-white p-2 border border-slate-100 shadow-xs">
                        <div className="mb-1 text-xs font-semibold text-slate-700">{sk.name}</div>
                        <div className="grid grid-cols-3 gap-1">
                          {levels.map((l) => (
                            <button
                              key={l.key}
                              type="button"
                              onClick={() => setDraft({ ...draft, [k]: l.key })}
                              className="rounded-lg py-1 px-1 text-[11px] font-bold transition text-center border truncate"
                              style={
                                v === l.key
                                  ? { background: l.color, borderColor: l.color, color: "#fff" }
                                  : { borderColor: `${l.color}55`, color: l.color, background: "#fff" }
                              }
                            >
                              {l.label.split(" ")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Table View (Default on desktop or when toggled) */}
          <div className={viewMode === "cards" ? "hidden" : "hidden md:block overflow-auto rounded-xl border"} style={{ maxHeight: "65vh" }}>
            <table className="w-full min-w-[640px] text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr>
                  <th className="sticky right-0 bg-slate-100 p-2 text-right">التلميذ</th>
                  {subject.skills.map((sk) => (
                    <th key={sk.id} className="min-w-36 p-2 text-center align-bottom">
                      <div className="mb-1 font-bold">{sk.name}</div>
                      <select className="w-full rounded border bg-white p-1 text-[11px] font-normal" value="" onChange={(e) => fillColumn(sk.id, e.target.value)}>
                        <option value="">تعبئة العمود…</option>
                        {levels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stu.data.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="sticky right-0 bg-white p-2 font-semibold">{s.fullName}</td>
                    {subject.skills.map((sk) => {
                      const k = `${s.id}|${sk.id}`;
                      const v = draft[k] ?? cur.get(k) ?? "";
                      return (
                        <td key={sk.id} className="p-1">
                          <select value={v} onChange={(e) => e.target.value && setDraft({ ...draft, [k]: e.target.value })}
                            className="w-full rounded-lg border-2 p-1 text-xs font-bold" style={{ borderColor: color(v), color: color(v), background: draft[k] ? `${color(v)}18` : "#fff" }}>
                            <option value="">—</option>
                            {levels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Btn disabled={busy || !Object.keys(draft).length} onClick={save}>{busy ? "…" : `💾 حفظ (${Object.keys(draft).length} تعديل)`}</Btn>
            {Object.keys(draft).length > 0 && <Btn variant="ghost" onClick={() => setDraft({})}>تراجع</Btn>}
          </div>
        </Card>
      )}
    </>
  );
}
