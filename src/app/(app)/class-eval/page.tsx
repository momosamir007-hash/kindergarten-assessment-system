"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Save,
  RotateCcw,
  CheckSquare,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
} from "lucide-react";
import {
  Btn,
  Card,
  ClassPeriodPicker,
  Empty,
  PageTitle,
  Spinner,
  useApiData,
  useApp,
  useToast,
} from "@/components/ui";
import { EvalCircle, EvalLegend } from "@/components/eval-circles";
import { api } from "@/lib/client";

type Subject = {
  id: string;
  name: string;
  kind: string;
  skills: { id: string; name: string }[];
};
type Stu = { id: string; fullName: string; photo?: string | null };
type Cur = { studentId: string; skillId: string; levelKey: string };

export default function ClassEval() {
  const { classId, periodId, settings } = useApp();
  const toast = useToast();
  const levels = settings?.settings.levels ?? [
    { key: "acquired", label: "مكتسب باستقلالية", value: 2, color: "#16a34a" },
    { key: "in_progress", label: "في طور الاكتساب (بمساعدة)", value: 1, color: "#d97706" },
    { key: "not_acquired", label: "في بداية الظهور / قيد الملاحظة", value: 0, color: "#94a3b8" },
  ];

  const subs = useApiData<Subject[]>("/api/curriculum");
  const stu = useApiData<Stu[]>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const ev = useApiData<{ current: Cur[] }>(
    classId && periodId ? `/api/evaluations?classId=${classId}&periodId=${periodId}` : null,
    [classId, periodId]
  );

  const [subjectId, setSubjectId] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({}); // `${studentId}|${skillId}` -> levelKey
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    if (!subjectId && subs.data?.length) setSubjectId(subs.data[0].id);
  }, [subs.data, subjectId]);

  useEffect(() => setDraft({}), [classId, periodId, subjectId]);

  const cur = useMemo(
    () => new Map((ev.data?.current ?? []).map((c) => [`${c.studentId}|${c.skillId}`, c.levelKey])),
    [ev.data]
  );
  const subject = subs.data?.find((s) => s.id === subjectId);

  const save = async () => {
    setBusy(true);
    try {
      const items = Object.entries(draft).map(([k, levelKey]) => {
        const [studentId, skillId] = k.split("|");
        return { studentId, skillId, levelKey };
      });
      await api("/api/evaluations", { json: { periodId, items } });
      toast(`تم حفظ ${items.length} تقييم بنجاح في السجل التراكمي`);
      setDraft({});
      ev.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل حفظ التقييمات", "err");
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

  const cycleLevel = (studentId: string, skillId: string, currentKey: string) => {
    const k = `${studentId}|${skillId}`;
    const order = ["acquired", "in_progress", "not_acquired"];
    const idx = order.indexOf(currentKey);
    const nextKey = idx === -1 ? "acquired" : order[(idx + 1) % order.length];
    setDraft({ ...draft, [k]: nextKey });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle sub="رصد الملاحظات والتقييمات النمائية لكافة أطفال الفوج مع اعتماد نظام الدوائر البصرية الثلاث">
          شبكة الملاحظة الجماعية للفوج
        </PageTitle>

        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              viewMode === "table" ? "bg-[#0f4c81] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TableIcon size={14} />
            <span>عرض الجدول</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              viewMode === "cards" ? "bg-[#0f4c81] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid size={14} />
            <span>وضع البطاقات</span>
          </button>
        </div>
      </div>

      {/* Top Filter & Domain Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <ClassPeriodPicker />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">المجال / المادة:</span>
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs md:text-sm font-bold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-none"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {subs.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kind === "behavioral" ? "🧩 " : "📘 "}
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <EvalLegend className="py-1 px-3 text-xs" />
      </div>

      {!periodId && <Empty>يرجى اختيار فترة دراسية محددة للبدء في الرصد.</Empty>}
      {periodId && (stu.loading || ev.loading || subs.loading) && (
        <Spinner label="جارٍ تحميل شبكة التقييم..." />
      )}
      {periodId && stu.data && stu.data.length === 0 && (
        <Empty>لا يوجد أطفال مسجلون في هذا القسم حالياً.</Empty>
      )}

      {periodId && stu.data && stu.data.length > 0 && subject && (
        <div className="space-y-4">
          <Card>
            {/* Cards View (Mobile & Tablet) */}
            {viewMode === "cards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stu.data.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3"
                  >
                    <div className="font-bold text-slate-900 text-sm border-b border-slate-200/80 pb-2 flex items-center justify-between">
                      <span>🧒 {s.fullName}</span>
                    </div>

                    <div className="space-y-2">
                      {subject.skills.map((sk) => {
                        const k = `${s.id}|${sk.id}`;
                        const currentVal = draft[k] ?? cur.get(k) ?? "not_acquired";
                        return (
                          <div
                            key={sk.id}
                            className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs"
                          >
                            <span className="text-xs font-semibold text-slate-700 max-w-[65%]">
                              {sk.name}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {levels.map((l) => {
                                const isSelected = currentVal === l.key;
                                return (
                                  <button
                                    key={l.key}
                                    type="button"
                                    onClick={() => setDraft({ ...draft, [k]: l.key })}
                                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                      isSelected
                                        ? "border-[#0f4c81] bg-blue-50 shadow-2xs scale-105"
                                        : "border-slate-200 hover:bg-slate-50"
                                    }`}
                                    title={l.label}
                                  >
                                    <EvalCircle levelKey={l.key} size={16} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {viewMode === "table" && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[700px] text-xs">
                  <thead className="bg-[#0f4c81] text-white">
                    <tr>
                      <th className="sticky right-0 z-10 bg-[#0f4c81] p-3 text-right font-black w-48 border-l border-blue-900">
                        الطفل(ة)
                      </th>
                      {subject.skills.map((sk) => (
                        <th key={sk.id} className="min-w-40 p-2.5 text-center align-top border-l border-blue-900">
                          <div className="mb-2 font-bold leading-tight">{sk.name}</div>
                          <select
                            className="w-full rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-[11px] font-medium text-white focus:outline-none"
                            value=""
                            onChange={(e) => fillColumn(sk.id, e.target.value)}
                          >
                            <option value="" className="text-slate-800">تعبئة العمود بالكامل...</option>
                            {levels.map((l) => (
                              <option key={l.key} value={l.key} className="text-slate-800">
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {stu.data.map((s, ri) => (
                      <tr
                        key={s.id}
                        className={`${ri % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/30 transition-colors`}
                      >
                        <td className="sticky right-0 z-10 bg-inherit p-3 font-bold text-slate-800 border-l border-slate-100 shadow-xs">
                          {s.fullName}
                        </td>
                        {subject.skills.map((sk) => {
                          const k = `${s.id}|${sk.id}`;
                          const v = draft[k] ?? cur.get(k) ?? "";
                          return (
                            <td key={sk.id} className="p-2 text-center align-middle border-l border-slate-100">
                              <div className="flex items-center justify-center gap-1">
                                {levels.map((l) => {
                                  const isSelected = v === l.key;
                                  return (
                                    <button
                                      key={l.key}
                                      type="button"
                                      onClick={() => setDraft({ ...draft, [k]: l.key })}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                        isSelected
                                          ? "border-blue-600 bg-blue-50/80 shadow-xs scale-110"
                                          : "border-slate-200/80 opacity-40 hover:opacity-100"
                                      }`}
                                      title={l.label}
                                    >
                                      <EvalCircle levelKey={l.key} size={15} />
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Save Actions Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500">
                {Object.keys(draft).length > 0 ? (
                  <span className="text-blue-600 font-bold">
                    ● لديك {Object.keys(draft).length} تغييرات غير محفوظة
                  </span>
                ) : (
                  <span>كافة التقييمات محفوظة ومزامنة</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {Object.keys(draft).length > 0 && (
                  <Btn variant="ghost" onClick={() => setDraft({})} disabled={busy}>
                    <RotateCcw size={14} />
                    <span>تراجع</span>
                  </Btn>
                )}
                <Btn
                  disabled={busy || !Object.keys(draft).length}
                  onClick={save}
                  className="font-bold text-sm"
                >
                  <Save size={15} />
                  <span>
                    {busy ? "جارٍ الحفظ..." : `حفظ التقييمات (${Object.keys(draft).length})`}
                  </span>
                </Btn>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
