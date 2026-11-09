"use client";
import { useRef, useState } from "react";
import { Badge, Btn, Card, Empty, PageTitle, Spinner, inputCls, useApiData, useApp, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { FIELDS, type DuplicateInfo, type Mapping, type NormalizedRow } from "@/lib/import";
import {
  FileSpreadsheet,
  Database,
  History as HistoryIcon,
  UploadCloud,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Search,
  Check,
  FileCheck,
  XCircle,
} from "lucide-react";

type Preview = {
  filename: string;
  format: string;
  headers: string[];
  rows: string[][];
  mapping: Mapping;
  savedMappings: { id: string; name: string; mapping: Mapping }[];
  normalized: NormalizedRow[];
  duplicates: (DuplicateInfo | null)[];
};

type Item = {
  data: NormalizedRow["data"];
  errors: string[];
  warnings: string[];
  dup: DuplicateInfo | null;
  action: "add" | "update" | "skip";
  line: number;
};

type Result = {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  rejected: number;
  report: {
    rejected: { line: number; name: string; reason: string }[];
    warnings: string[];
    classesCreated: string[];
  };
};

const defAction = (d: DuplicateInfo | null, errors: string[]): Item["action"] =>
  errors.length ? "skip" : d ? "skip" : "add";

export default function ImportPage() {
  const [tab, setTab] = useState<"students" | "digitization" | "legacy">("students");

  const tabs = [
    { key: "students" as const, label: "قائمة تلاميذ (Excel / CSV / JSON)", icon: FileSpreadsheet },
    { key: "digitization" as const, label: "من الرقمنة (مطابقة الأعمدة)", icon: Database },
    { key: "legacy" as const, label: "ترحيل بيانات قديمة", icon: HistoryIcon },
  ];

  return (
    <div className="space-y-4">
      <PageTitle sub="معاينة وتصحيح ذكي قبل الاعتماد دون استبدال تلقائي للبيانات">الاستيراد الجماعي والترحيل</PageTitle>

      <div className="flex gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
                active ? "bg-[#0f4c81] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {tab === "legacy" ? <Legacy /> : <Flow key={tab} mode={tab} />}
      <History />
    </div>
  );
}

function Flow({ mode }: { mode: "students" | "digitization" }) {
  const { classes, classId, reload } = useApp();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pv, setPv] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [items, setItems] = useState<Item[]>([]);
  const [defaultClass, setDefaultClass] = useState(classId);
  const [saveName, setSaveName] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toItems = (n: NormalizedRow[], d: (DuplicateInfo | null)[]): Item[] =>
    n.map((r, i) => ({
      data: r.data,
      errors: r.errors,
      warnings: r.warnings,
      dup: d[i],
      action: defAction(d[i], r.errors),
      line: r.index + 1,
    }));

  const load = async (body: FormData | { text: string }) => {
    setBusy(true);
    setResult(null);
    try {
      const p =
        body instanceof FormData
          ? await api<Preview>("/api/import/preview", { method: "POST", body })
          : await api<Preview>("/api/import/preview", { json: body });
      setPv(p);
      setMapping(p.mapping);
      setItems(toItems(p.normalized, p.duplicates));
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy(false);
    }
  };

  const remap = async (m: Mapping) => {
    if (!pv) return;
    setMapping(m);
    const r = await api<{ normalized: NormalizedRow[]; duplicates: (DuplicateInfo | null)[] }>("/api/import/check", {
      json: { table: { headers: pv.headers, rows: pv.rows }, mapping: m },
    });
    setItems(toItems(r.normalized, r.duplicates));
  };

  const recheck = async (list: Item[]) => {
    const r = await api<{ normalized: NormalizedRow[]; duplicates: (DuplicateInfo | null)[] }>("/api/import/check", {
      json: {
        rows: list.map((i) => ({
          ...i.data,
          birthDate: i.data.birthDate ?? "",
          gender: i.data.gender ?? "",
          extra: i.data.extra,
        })),
      },
    });
    setItems(
      list.map((it, i) => ({
        ...it,
        data: r.normalized[i].data,
        errors: r.normalized[i].errors,
        warnings: r.normalized[i].warnings,
        dup: r.duplicates[i],
        action:
          it.action === "skip" && !r.normalized[i].errors.length && !r.duplicates[i]
            ? "add"
            : r.normalized[i].errors.length
            ? "skip"
            : it.action,
      }))
    );
  };

  const edit = (i: number, k: keyof Item["data"], v: string) =>
    setItems(
      items.map((it, j) =>
        j === i
          ? {
              ...it,
              data: {
                ...it.data,
                [k]: v === "" && (k === "birthDate" || k === "gender") ? null : v,
              },
            }
          : it
      )
    );

  const setAction = (i: number, a: Item["action"]) =>
    setItems(items.map((it, j) => (j === i ? { ...it, action: a } : it)));

  const commit = async () => {
    if (mode === "digitization" && !pv) return;
    setBusy(true);
    try {
      const r = await api<Result>("/api/import/commit", {
        json: {
          rows: items.map((i) => ({
            data: i.data,
            action: i.errors.length ? "skip" : i.action,
            targetId: i.dup?.targetId,
            line: i.line - 1,
          })),
          defaultClassId: defaultClass,
          filename: pv?.filename,
          kind: mode,
          mapping: saveName ? mapping : undefined,
          saveMappingName: saveName || undefined,
        },
      });
      setResult(r);
      setPv(null);
      setItems([]);
      reload();
      toast(`تم الاستيراد بنجاح: ${r.imported} جديد، ${r.updated} محدّث`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy(false);
    }
  };

  const stats = {
    add: items.filter((i) => !i.errors.length && i.action === "add").length,
    upd: items.filter((i) => !i.errors.length && i.action === "update").length,
    skip: items.filter((i) => !i.errors.length && i.action === "skip").length,
    err: items.filter((i) => i.errors.length).length,
    dup: items.filter((i) => i.dup).length,
  };

  return (
    <div className="space-y-4">
      {result && (
        <Card title="نتيجة عملية الاستيراد">
          <div className="mb-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5">
            {[
              ["الإجمالي", result.total, "#334155"],
              ["مستورد جديد", result.imported, "#16a34a"],
              ["محدَّث", result.updated, "#0f4c81"],
              ["متجاهَل", result.skipped, "#d97706"],
              ["مرفوض", result.rejected, "#dc2626"],
            ].map(([l, v, c]) => (
              <div key={String(l)} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-2xl font-black" style={{ color: String(c) }}>
                  {v}
                </div>
                <div className="text-xs text-slate-500 font-bold mt-1">{l}</div>
              </div>
            ))}
          </div>
          {result.report.classesCreated.length > 0 && (
            <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              أقسام جديدة أُنشئت تلقائياً: {result.report.classesCreated.join("، ")}
            </p>
          )}
          {result.report.rejected.map((r, i) => (
            <div key={i} className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-100 flex items-center gap-1.5 mt-1">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              <span>السطر {r.line} ({r.name}): {r.reason}</span>
            </div>
          ))}
          {result.report.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 flex items-center gap-1.5 mt-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </Card>
      )}

      {!pv && (
        <Card title={mode === "digitization" ? "1) رفع ملف من نظام الرقمنة الوزاري" : "1) إدخال قائمة التلاميذ"}>
          {mode === "digitization" && (
            <p className="mb-3 text-xs text-slate-600 leading-relaxed">
              ملفات الرقمنة تختلف في أسماء الأعمدة وترتيبها؛ ستتمكن من مطابقة الأعمدة بحقول النظام في الخطوة التالية، مع إمكانية حفظ هذا الربط لاستخدامه دائماً.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-dashed border-slate-300 p-4 bg-slate-50/50 flex flex-col justify-center">
              <div className="mb-2 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UploadCloud className="h-4 w-4 text-[#0f4c81]" />
                <span>ملف Excel (xlsx/xls) أو CSV أو JSON</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt,.json,.ods"
                className={inputCls}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const fd = new FormData();
                    fd.append("file", f);
                    load(fd);
                  }
                }}
              />
              <p className="mt-2 text-[11px] text-slate-400">يدعم سحب وإفلات الملفات أو اختيارها من الجهاز</p>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold text-slate-700">أو الصق مباشرة من جدول Excel (سطر لكل تلميذ):</div>
              <textarea
                className={`${inputCls} h-28 text-xs font-mono`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"الاسم واللقب\tتاريخ الميلاد\tالجنس\nأحمد بن علي\t2019-05-12\tذكر"}
              />
              <Btn className="mt-2" disabled={busy || !text.trim()} onClick={() => load({ text })}>
                <Search className="h-3.5 w-3.5" />
                <span>معاينة البيانات</span>
              </Btn>
            </div>
          </div>
          {busy && <Spinner text="جارٍ قراءة الملف وتحليله ذكياً…" />}
        </Card>
      )}

      {pv && (
        <>
          <Card
            title="2) مطابقة وتعيين الأعمدة"
            actions={
              <Btn
                variant="ghost"
                onClick={() => {
                  setPv(null);
                  setItems([]);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>البدء من جديد</span>
              </Btn>
            }
          >
            {pv.savedMappings.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">قوالب ربط محفوظة:</span>
                {pv.savedMappings.map((s) => (
                  <Btn
                    key={s.id}
                    variant="ghost"
                    onClick={() =>
                      remap(Object.fromEntries(pv.headers.map((h) => [h, s.mapping[h] ?? mapping[h]])))
                    }
                  >
                    {s.name}
                  </Btn>
                ))}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {pv.headers.map((h) => (
                <label key={h} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-xs block">
                  <span className="mb-1 block truncate font-bold text-slate-800" title={h}>
                    العمود: «{h}»
                  </span>
                  <select
                    className={inputCls}
                    value={mapping[h] ?? ""}
                    onChange={(e) => remap({ ...mapping, [h]: e.target.value })}
                  >
                    <option value="">— تجاهل هذا العمود —</option>
                    {FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                    <option value="extra">حقل إضافي (يُحفظ في الملف)</option>
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <input
                className={`${inputCls} max-w-xs`}
                placeholder="اسم لحفظ هذا القالب مستقبلاً (اختياري)"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </div>
          </Card>

          <Card title="3) المعاينة والتصحيح اليدوي">
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge color="#16a34a">جديد: {stats.add}</Badge>
              <Badge color="#0f4c81">تحديث: {stats.upd}</Badge>
              <Badge color="#d97706">تجاهل: {stats.skip}</Badge>
              <Badge color="#dc2626">أخطاء: {stats.err}</Badge>
              <Badge color="#7c3aed">مكررون محتملون: {stats.dup}</Badge>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">القسم الافتراضي (إذا لم يُحدد بالملف):</span>
              <select className={`${inputCls} w-auto`} value={defaultClass} onChange={(e) => setDefaultClass(e.target.value)}>
                <option value="">— بدون قسم —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[820px] text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b">
                  <tr className="text-right text-slate-700 font-bold">
                    <th className="p-2">#</th>
                    <th className="p-2">الاسم واللقب</th>
                    <th className="p-2">تاريخ الميلاد</th>
                    <th className="p-2">الجنس</th>
                    <th className="p-2">القسم</th>
                    <th className="p-2">رقم التعريف</th>
                    <th className="p-2">الحالة / الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, i) => (
                    <tr
                      key={i}
                      className={`align-top hover:bg-slate-50/80 transition-colors ${
                        it.errors.length ? "bg-red-50/60" : it.dup ? "bg-amber-50/60" : ""
                      }`}
                    >
                      <td className="p-1.5 text-slate-400 font-mono">{it.line}</td>
                      {(["fullName", "birthDate", "gender", "className", "nationalId"] as const).map((k) => (
                        <td key={k} className="p-1.5">
                          {k === "gender" ? (
                            <select
                              className={`${inputCls} px-1.5 py-1 text-xs`}
                              value={it.data.gender ?? ""}
                              onChange={(e) => {
                                const next = items.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        data: {
                                          ...x.data,
                                          gender: (e.target.value || null) as "M" | "F" | null,
                                        },
                                      }
                                    : x
                                );
                                setItems(next);
                                recheck(next);
                              }}
                            >
                              <option value="">—</option>
                              <option value="M">ذكر</option>
                              <option value="F">أنثى</option>
                            </select>
                          ) : (
                            <input
                              className={`${inputCls} px-1.5 py-1 text-xs ${
                                k === "birthDate" || k === "nationalId" ? "w-28 font-mono" : ""
                              }`}
                              dir={k === "fullName" || k === "className" ? "rtl" : "ltr"}
                              value={(it.data[k] as string | null) ?? ""}
                              onChange={(e) => edit(i, k, e.target.value)}
                              onBlur={() => recheck(items)}
                            />
                          )}
                        </td>
                      ))}
                      <td className="p-1.5">
                        {it.errors.map((e, j) => (
                          <div key={j} className="font-semibold text-red-700 flex items-center gap-1">
                            <XCircle className="h-3 w-3 shrink-0" />
                            <span>{e}</span>
                          </div>
                        ))}
                        {it.warnings.map((e, j) => (
                          <div key={j} className="text-slate-500 text-[11px]">
                            {e}
                          </div>
                        ))}
                        {it.dup && (
                          <div className="mb-1 text-amber-800 font-semibold text-[11px] flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                            <span>
                              {it.dup.reason}
                              {it.dup.targetName ? ` («${it.dup.targetName}»)` : ""}
                            </span>
                          </div>
                        )}
                        {!it.errors.length && (
                          <select
                            className={`${inputCls} px-1.5 py-1 text-xs`}
                            value={it.action}
                            onChange={(e) => setAction(i, e.target.value as Item["action"])}
                          >
                            <option value="add">{it.dup ? "إضافة كسجل جديد (بعد التأكيد)" : "إضافة"}</option>
                            {it.dup?.targetId && <option value="update">تحديث التلميذ الموجود</option>}
                            <option value="skip">تجاهل السجل</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="success" disabled={busy || stats.add + stats.upd === 0} onClick={commit}>
                <Check className="h-4 w-4" />
                <span>{busy ? "جارٍ الحفظ…" : `اعتماد الاستيراد (${stats.add + stats.upd})`}</span>
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => setItems(items.map((i) => (i.errors.length ? i : { ...i, action: "skip" })))}
              >
                تجاهل الكل
              </Btn>
              <Btn
                variant="ghost"
                onClick={() =>
                  setItems(items.map((i) => (i.errors.length || i.dup ? i : { ...i, action: "add" })))
                }
              >
                إضافة غير المكررين
              </Btn>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

type LegacySummary = {
  studentsFound: number;
  evaluationsFound: number;
  studentsCreated: number;
  studentsExisting: number;
  evaluationsImported: number;
  evaluationsDuplicate: number;
  evaluationsRejected: number;
  rejectedSamples: string[];
  unparsedPreserved: number;
  warnings: string[];
  dryRun: boolean;
  sample?: { fullName: string; className: string; evaluations: number }[];
};

function Legacy() {
  const toast = useToast();
  const { reload } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<LegacySummary | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (dry: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dryRun", dry ? "1" : "0");
      setRes(await api<LegacySummary>("/api/legacy/import", { method: "POST", body: fd }));
      if (!dry) {
        toast("اكتمل الترحيل بنجاح");
        reload();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل الترحيل", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="ترحيل بيانات النظام السابق (students_data.json)">
      <p className="mb-3 text-xs text-slate-600 leading-relaxed">
        يُقرأ الملف بأمان دون حذفه أو تعديل أصله. يُحلل هيكله ويتم استخراج بيانات التلاميذ والتقييمات التاريخية بدقة كاملة.
        ابدأ بـ«تحليل فقط» لمراجعة الإحصائيات قبل الترحيل الفعلي.
      </p>
      <input
        type="file"
        accept=".json"
        className={inputCls}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setRes(null);
        }}
      />
      <div className="mt-3 flex gap-2">
        <Btn variant="ghost" disabled={!file || busy} onClick={() => run(true)}>
          <Search className="h-3.5 w-3.5" />
          <span>تحليل فقط (معاينة آمنة)</span>
        </Btn>
        <Btn variant="success" disabled={!file || busy} onClick={() => run(false)}>
          <UploadCloud className="h-3.5 w-3.5" />
          <span>ترحيل فعلي واعتماد</span>
        </Btn>
      </div>
      {busy && <Spinner text="جارٍ معالجة وترحيل الملف القديم…" />}
      {res && (
        <div className="mt-4 space-y-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <Badge color={res.dryRun ? "#d97706" : "#16a34a"}>
            {res.dryRun ? "تحليل فقط — لم يُحفظ شيء بعد" : "تم الترحيل بنجاح"}
          </Badge>
          <ul className="list-disc space-y-1 pr-5 text-slate-700">
            <li>
              تلاميذ تم اكتشافهم في الملف: <b>{res.studentsFound}</b> — تقييمات مكتشفة: <b>{res.evaluationsFound}</b>
            </li>
            {!res.dryRun && (
              <li>
                تلاميذ جدد تم إنشاؤهم: <b>{res.studentsCreated}</b> — موجودون مسبقاً: <b>{res.studentsExisting}</b>
              </li>
            )}
            {!res.dryRun && (
              <li>
                تقييمات مستوردة: <b>{res.evaluationsImported}</b> — تقييمات مكررة تم تخطيها: <b>{res.evaluationsDuplicate}</b>
              </li>
            )}
            <li>
              تقييمات مرفوضة: <b className="text-red-700">{res.evaluationsRejected}</b>
            </li>
            <li>
              سجلات احتُفظ ببيانات غير مطابقة فيها بأمان: <b>{res.unparsedPreserved}</b>
            </li>
          </ul>
          {res.rejectedSamples.map((s, i) => (
            <div key={i} className="text-red-700 bg-red-50 p-1.5 rounded">
              {s}
            </div>
          ))}
          {res.warnings.map((s, i) => (
            <div key={i} className="text-amber-700 bg-amber-50 p-1.5 rounded">
              {s}
            </div>
          ))}
          {res.sample && res.sample.length > 0 && (
            <div className="text-slate-500 pt-1 border-t border-slate-200">
              عيّنة من البيانات: {res.sample.map((s) => `${s.fullName} (${s.evaluations} تقييم)`).join("، ")}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function History() {
  const { data } = useApiData<
    {
      id: string;
      kind: string;
      filename: string;
      total: number;
      imported: number;
      updated: number;
      skipped: number;
      rejected: number;
      createdAt: string;
    }[]
  >("/api/import/jobs");

  const kinds: Record<string, string> = { students: "قائمة", digitization: "رقمنة", legacy: "ترحيل قديم" };

  return (
    <Card title="سجل عمليات الاستيراد السابقة">
      {!data?.length ? (
        <Empty>لا توجد عمليات استيراد مسجلة.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-right text-slate-600 border-b">
                <th className="p-2.5">التاريخ والوقت</th>
                <th className="p-2.5">النوع</th>
                <th className="p-2.5">اسم الملف</th>
                <th className="p-2.5">الإجمالي</th>
                <th className="p-2.5">جديد</th>
                <th className="p-2.5">محدّث</th>
                <th className="p-2.5">متجاهل</th>
                <th className="p-2.5">مرفوض</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-mono text-slate-500">
                    {new Date(j.createdAt).toLocaleString("ar-DZ-u-nu-latn")}
                  </td>
                  <td className="p-2.5 font-bold text-slate-700">{kinds[j.kind] ?? j.kind}</td>
                  <td className="max-w-40 truncate p-2.5 text-slate-600" title={j.filename}>
                    {j.filename}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-slate-800">{j.total}</td>
                  <td className="p-2.5 font-mono text-emerald-600 font-bold">{j.imported}</td>
                  <td className="p-2.5 font-mono text-blue-600 font-bold">{j.updated}</td>
                  <td className="p-2.5 font-mono text-amber-600">{j.skipped}</td>
                  <td className="p-2.5 font-mono text-red-600">{j.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
