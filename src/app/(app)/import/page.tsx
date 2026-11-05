"use client";
import { useRef, useState } from "react";
import { Badge, Btn, Card, Empty, PageTitle, Spinner, inputCls, useApiData, useApp, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { FIELDS, type DuplicateInfo, type Mapping, type NormalizedRow } from "@/lib/import";

type Preview = { filename: string; format: string; headers: string[]; rows: string[][]; mapping: Mapping; savedMappings: { id: string; name: string; mapping: Mapping }[]; normalized: NormalizedRow[]; duplicates: (DuplicateInfo | null)[] };
type Item = { data: NormalizedRow["data"]; errors: string[]; warnings: string[]; dup: DuplicateInfo | null; action: "add" | "update" | "skip"; line: number };
type Result = { total: number; imported: number; updated: number; skipped: number; rejected: number; report: { rejected: { line: number; name: string; reason: string }[]; warnings: string[]; classesCreated: string[] } };

const defAction = (d: DuplicateInfo | null, errors: string[]): Item["action"] => (errors.length ? "skip" : d ? "skip" : "add");

export default function ImportPage() {
  const [tab, setTab] = useState<"students" | "digitization" | "legacy">("students");
  return (
    <>
      <PageTitle sub="معاينة وتصحيح قبل الاعتماد، دون استبدال تلقائي للبيانات الموجودة">الاستيراد الجماعي</PageTitle>
      <div className="mb-4 flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {([["students", "قائمة تلاميذ (Excel / CSV / JSON / لصق)"], ["digitization", "من الرقمنة (ربط الأعمدة)"], ["legacy", "ترحيل البيانات القديمة"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold sm:text-sm ${tab === k ? "bg-[#0f4c81] text-white" : "text-slate-600"}`}>{l}</button>
        ))}
      </div>
      {tab === "legacy" ? <Legacy /> : <Flow key={tab} mode={tab} />}
      <History />
    </>
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

  const toItems = (n: NormalizedRow[], d: (DuplicateInfo | null)[]): Item[] => n.map((r, i) => ({ data: r.data, errors: r.errors, warnings: r.warnings, dup: d[i], action: defAction(d[i], r.errors), line: r.index + 1 }));

  const load = async (body: FormData | { text: string }) => {
    setBusy(true);
    setResult(null);
    try {
      const p = body instanceof FormData ? await api<Preview>("/api/import/preview", { method: "POST", body }) : await api<Preview>("/api/import/preview", { json: body });
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
    const r = await api<{ normalized: NormalizedRow[]; duplicates: (DuplicateInfo | null)[] }>("/api/import/check", { json: { table: { headers: pv.headers, rows: pv.rows }, mapping: m } });
    setItems(toItems(r.normalized, r.duplicates));
  };

  const recheck = async (list: Item[]) => {
    const r = await api<{ normalized: NormalizedRow[]; duplicates: (DuplicateInfo | null)[] }>("/api/import/check", { json: { rows: list.map((i) => ({ ...i.data, birthDate: i.data.birthDate ?? "", gender: i.data.gender ?? "", extra: i.data.extra })) } });
    setItems(list.map((it, i) => ({ ...it, data: r.normalized[i].data, errors: r.normalized[i].errors, warnings: r.normalized[i].warnings, dup: r.duplicates[i], action: it.action === "skip" && !r.normalized[i].errors.length && !r.duplicates[i] ? "add" : r.normalized[i].errors.length ? "skip" : it.action })));
  };

  const edit = (i: number, k: keyof Item["data"], v: string) => setItems(items.map((it, j) => (j === i ? { ...it, data: { ...it.data, [k]: v === "" && (k === "birthDate" || k === "gender") ? null : v } } : it)));
  const setAction = (i: number, a: Item["action"]) => setItems(items.map((it, j) => (j === i ? { ...it, action: a } : it)));

  const commit = async () => {
    if (mode === "digitization" && !pv) return;
    setBusy(true);
    try {
      const r = await api<Result>("/api/import/commit", {
        json: {
          rows: items.map((i) => ({ data: i.data, action: i.errors.length ? "skip" : i.action, targetId: i.dup?.targetId, line: i.line - 1 })),
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
      toast(`تم الاستيراد: ${r.imported} جديد، ${r.updated} محدّث`);
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
        <Card title="تقرير الاستيراد">
          <div className="mb-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5">
            {[["الإجمالي", result.total, "#334155"], ["مستورد جديد", result.imported, "#16a34a"], ["محدَّث", result.updated, "#0f4c81"], ["متجاهَل", result.skipped, "#d97706"], ["مرفوض", result.rejected, "#dc2626"]].map(([l, v, c]) => (
              <div key={String(l)} className="rounded-xl border p-2"><div className="text-xl font-extrabold" style={{ color: String(c) }}>{v}</div><div className="text-xs text-slate-500">{l}</div></div>
            ))}
          </div>
          {result.report.classesCreated.length > 0 && <p className="text-sm">أقسام أُنشئت: {result.report.classesCreated.join("، ")}</p>}
          {result.report.rejected.map((r, i) => <div key={i} className="text-sm text-red-700">السطر {r.line} ({r.name}): {r.reason}</div>)}
          {result.report.warnings.map((w, i) => <div key={i} className="text-sm text-amber-700">{w}</div>)}
        </Card>
      )}

      {!pv && (
        <Card title={mode === "digitization" ? "1) رفع ملف من نظام الرقمنة" : "1) إدخال القائمة"}>
          {mode === "digitization" && <p className="mb-3 text-sm text-slate-600">ملفات الرقمنة تختلف في أسماء الأعمدة وترتيبها؛ ستربط الأعمدة بحقول النظام في الخطوة التالية، ويمكنك حفظ هذا الربط لإعادة استعماله.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-semibold">ملف Excel (xlsx/xls) أو CSV أو JSON</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.json,.ods" className={inputCls} onChange={(e) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); load(fd); } }} />
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold">أو الصق من Excel / قائمة أسماء (سطر لكل تلميذ)</div>
              <textarea className={`${inputCls} h-32`} value={text} onChange={(e) => setText(e.target.value)} placeholder={"الاسم\tتاريخ الميلاد\tالجنس\n..."} />
              <Btn className="mt-2" disabled={busy || !text.trim()} onClick={() => load({ text })}>معاينة</Btn>
            </div>
          </div>
          {busy && <Spinner text="جارٍ التحليل…" />}
        </Card>
      )}

      {pv && (
        <>
          <Card title="2) ربط الأعمدة بحقول النظام" actions={<Btn variant="ghost" onClick={() => { setPv(null); setItems([]); }}>↩ البدء من جديد</Btn>}>
            {pv.savedMappings.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">ربط محفوظ:</span>
                {pv.savedMappings.map((s) => <Btn key={s.id} variant="ghost" onClick={() => remap(Object.fromEntries(pv.headers.map((h) => [h, s.mapping[h] ?? mapping[h]])))}>{s.name}</Btn>)}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {pv.headers.map((h) => (
                <label key={h} className="text-xs">
                  <span className="mb-1 block truncate font-semibold" title={h}>العمود: «{h}»</span>
                  <select className={inputCls} value={mapping[h] ?? ""} onChange={(e) => remap({ ...mapping, [h]: e.target.value })}>
                    <option value="">— تجاهل —</option>
                    {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    <option value="extra">حقل إضافي (يُحفظ كما هو)</option>
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <input className={`${inputCls} max-w-xs`} placeholder="اسم لحفظ هذا الربط (اختياري)" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            </div>
          </Card>

          <Card title="3) المعاينة والتصحيح">
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge color="#16a34a">جديد: {stats.add}</Badge><Badge color="#0f4c81">تحديث: {stats.upd}</Badge><Badge color="#d97706">تجاهل: {stats.skip}</Badge><Badge color="#dc2626">أخطاء: {stats.err}</Badge><Badge color="#7c3aed">مكررون محتملون: {stats.dup}</Badge>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">القسم الافتراضي (عند غياب عمود القسم):</span>
              <select className={`${inputCls} w-auto`} value={defaultClass} onChange={(e) => setDefaultClass(e.target.value)}><option value="">— بدون —</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl border">
              <table className="w-full min-w-[820px] text-xs">
                <thead className="sticky top-0 bg-slate-100"><tr className="text-right"><th className="p-2">#</th><th className="p-2">الاسم الكامل</th><th className="p-2">الميلاد</th><th className="p-2">الجنس</th><th className="p-2">القسم</th><th className="p-2">رقم التعريف</th><th className="p-2">الحالة / الإجراء</th></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className={`border-t align-top ${it.errors.length ? "bg-red-50" : it.dup ? "bg-amber-50" : ""}`}>
                      <td className="p-1 text-slate-400">{it.line}</td>
                      {(["fullName", "birthDate", "gender", "className", "nationalId"] as const).map((k) => (
                        <td key={k} className="p-1">
                          {k === "gender" ? (
                            <select className={`${inputCls} px-1 py-1 text-xs`} value={it.data.gender ?? ""} onChange={(e) => { const next = items.map((x, j) => (j === i ? { ...x, data: { ...x.data, gender: (e.target.value || null) as "M" | "F" | null } } : x)); setItems(next); recheck(next); }}><option value="">—</option><option value="M">ذكر</option><option value="F">أنثى</option></select>
                          ) : (
                            <input className={`${inputCls} px-1 py-1 text-xs ${k === "birthDate" || k === "nationalId" ? "w-28" : ""}`} dir={k === "fullName" || k === "className" ? "rtl" : "ltr"} value={(it.data[k] as string | null) ?? ""} onChange={(e) => edit(i, k, e.target.value)} onBlur={() => recheck(items)} />
                          )}
                        </td>
                      ))}
                      <td className="p-1">
                        {it.errors.map((e, j) => <div key={j} className="font-semibold text-red-700">✖ {e}</div>)}
                        {it.warnings.map((e, j) => <div key={j} className="text-slate-500">⚠ {e}</div>)}
                        {it.dup && <div className="mb-1 text-amber-800">⚠ {it.dup.reason}{it.dup.targetName ? ` («${it.dup.targetName}»)` : ""}</div>}
                        {!it.errors.length && (
                          <select className={`${inputCls} px-1 py-1 text-xs`} value={it.action} onChange={(e) => setAction(i, e.target.value as Item["action"])}>
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
              <Btn variant="success" disabled={busy || stats.add + stats.upd === 0} onClick={commit}>{busy ? "…" : `✔ اعتماد الاستيراد (${stats.add + stats.upd})`}</Btn>
              <Btn variant="ghost" onClick={() => setItems(items.map((i) => (i.errors.length ? i : { ...i, action: "skip" })))}>تجاهل الكل</Btn>
              <Btn variant="ghost" onClick={() => setItems(items.map((i) => (i.errors.length || i.dup ? i : { ...i, action: "add" })))}>إضافة غير المكررين</Btn>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

type LegacySummary = { studentsFound: number; evaluationsFound: number; studentsCreated: number; studentsExisting: number; evaluationsImported: number; evaluationsDuplicate: number; evaluationsRejected: number; rejectedSamples: string[]; unparsedPreserved: number; warnings: string[]; dryRun: boolean; sample?: { fullName: string; className: string; evaluations: number }[] };

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
      if (!dry) { toast("اكتمل الترحيل"); reload(); }
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="ترحيل بيانات النظام القديم (students_data.json وغيره)">
      <p className="mb-3 text-sm text-slate-600">يُقرأ الملف كما هو دون تعديله أو حذفه. يُحلَّل هيكله تلقائيًا (معلومات التلميذ، التقييمات، السجل التاريخي)، وما لا يمكن مطابقته يُحفظ كما هو في سجل التلميذ. ابدأ بـ«تحليل فقط» لمراجعة النتيجة قبل الترحيل الفعلي. إعادة الترحيل لا تكرر التلاميذ ولا التقييمات.</p>
      <input type="file" accept=".json" className={inputCls} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); }} />
      <div className="mt-3 flex gap-2"><Btn variant="ghost" disabled={!file || busy} onClick={() => run(true)}>🔍 تحليل فقط</Btn><Btn variant="success" disabled={!file || busy} onClick={() => run(false)}>⬆ ترحيل فعلي</Btn></div>
      {busy && <Spinner text="جارٍ المعالجة…" />}
      {res && (
        <div className="mt-4 space-y-2 text-sm">
          <Badge color={res.dryRun ? "#d97706" : "#16a34a"}>{res.dryRun ? "تحليل فقط — لم يُحفظ شيء" : "تم الترحيل"}</Badge>
          <ul className="list-disc space-y-1 pr-5">
            <li>تلاميذ في الملف: <b>{res.studentsFound}</b> — تقييمات مكتشفة: <b>{res.evaluationsFound}</b></li>
            {!res.dryRun && <li>تلاميذ جدد: <b>{res.studentsCreated}</b> — موجودون مسبقًا: <b>{res.studentsExisting}</b></li>}
            {!res.dryRun && <li>تقييمات مستوردة: <b>{res.evaluationsImported}</b> — مكررة (تم تخطيها): <b>{res.evaluationsDuplicate}</b></li>}
            <li>تقييمات مرفوضة (مستوى غير مفهوم): <b className="text-red-700">{res.evaluationsRejected}</b></li>
            <li>سجلات احتُفظ ببيانات غير مطابَقة فيها: <b>{res.unparsedPreserved}</b></li>
          </ul>
          {res.rejectedSamples.map((s, i) => <div key={i} className="text-xs text-red-700">{s}</div>)}
          {res.warnings.map((s, i) => <div key={i} className="text-xs text-amber-700">{s}</div>)}
          {res.sample && res.sample.length > 0 && <div className="text-xs text-slate-500">عيّنة: {res.sample.map((s) => `${s.fullName} (${s.evaluations} تقييم)`).join("، ")}</div>}
        </div>
      )}
    </Card>
  );
}

function History() {
  const { data } = useApiData<{ id: string; kind: string; filename: string; total: number; imported: number; updated: number; skipped: number; rejected: number; createdAt: string }[]>("/api/import/jobs");
  const kinds: Record<string, string> = { students: "قائمة", digitization: "رقمنة", legacy: "قديم" };
  return (
    <Card title="سجل عمليات الاستيراد" className="mt-4">
      {!data?.length ? <Empty>لا توجد عمليات استيراد.</Empty> : (
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-right text-slate-500"><th className="p-1">التاريخ</th><th>النوع</th><th>الملف</th><th>الإجمالي</th><th>جديد</th><th>محدّث</th><th>متجاهل</th><th>مرفوض</th></tr></thead>
          <tbody>{data.map((j) => <tr key={j.id} className="border-t"><td className="p-1">{new Date(j.createdAt).toLocaleString("ar-DZ-u-nu-latn")}</td><td>{kinds[j.kind] ?? j.kind}</td><td className="max-w-40 truncate">{j.filename}</td><td>{j.total}</td><td>{j.imported}</td><td>{j.updated}</td><td>{j.skipped}</td><td>{j.rejected}</td></tr>)}</tbody></table></div>
      )}
    </Card>
  );
}
