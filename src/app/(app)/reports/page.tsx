"use client";
import { useMemo, useState } from "react";
import { FileActions, ReportOptionsForm, StudentExport, useReportOptions } from "@/components/export";
import { Badge, Btn, Card, ClassPeriodPicker, Empty, PageTitle, inputCls, useApiData, useApp, useToast } from "@/components/ui";
import { fetchFile, saveBlob, type FetchedFile } from "@/lib/client";

type Stu = { id: string; fullName: string };
type Log = { id: string; kind: string; format: string; scope: string; count: number; filename: string; sizeBytes: number; createdAt: string };
const FORMATS = [
  ["zip", "ملف ZIP يحتوي PDF منفصل لكل تلميذ"],
  ["merged", "ملف PDF واحد بكل التقارير متتابعة"],
  ["xlsx", "Excel شامل لنتائج القسم"],
  ["csv", "CSV للبيانات"],
  ["json", "JSON للنسخ الاحتياطي"],
] as const;

export default function Reports() {
  const { classId, periodId, classes } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<"single" | "class" | "bulk" | "log">("bulk");
  const [opts, setOpts] = useReportOptions();
  const stu = useApiData<Stu[]>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const logs = useApiData<Log[]>("/api/exports");
  const [one, setOne] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number][0]>("zip");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<FetchedFile | null>(null);
  const shown = useMemo(() => (stu.data ?? []).filter((s) => s.fullName.includes(filter)), [stu.data, filter]);
  const optQ = encodeURIComponent(JSON.stringify(opts));
  const cls = classes.find((c) => c.id === classId);

  const start = async () => {
    setBusy(true);
    setOut(null);
    try {
      const ids = sel.size ? [...sel] : undefined;
      const f = await fetchFile("/api/reports/bulk", { json: { classId, studentIds: ids, periodId, format, options: opts } });
      setOut(f);
      saveBlob(f);
      toast(`تم إنشاء ${f.filename} (${(f.blob.size / 1024).toFixed(0)} ك.ب)`);
      logs.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle sub="تقارير فردية وجماعية وتقارير القسم — PDF وExcel وCSV وJSON — للتنزيل والطباعة والمشاركة">التقارير والتصدير</PageTitle>
      <div className="mb-3"><ClassPeriodPicker /></div>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        {([["bulk", "التصدير الجماعي"], ["single", "تقرير تلميذ"], ["class", "تقرير القسم"], ["log", "سجل التصدير"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? "bg-[#0f4c81] text-white" : "text-slate-600"}`}>{l}</button>
        ))}
      </div>

      {tab !== "log" && (
        <Card title="محتوى التقرير" className="mb-4"><ReportOptionsForm value={opts} onChange={setOpts} /></Card>
      )}

      {tab === "single" && (
        <Card title="تقرير تلميذ واحد">
          <select className={`${inputCls} mb-3 max-w-sm`} value={one} onChange={(e) => setOne(e.target.value)}>
            <option value="">— اختر التلميذ —</option>
            {stu.data?.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </select>
          {one ? <StudentExport studentId={one} periodId={periodId} /> : <Empty>اختر تلميذًا.</Empty>}
        </Card>
      )}

      {tab === "class" && (
        <Card title={`تقرير القسم: ${cls?.name ?? ""}`}>
          {classId ? (
            <div className="space-y-3">
              <FileActions getFile={() => fetchFile(`/api/reports/class/${classId}?format=pdf&periodId=${periodId}&options=${optQ}`)} />
              <div className="flex gap-2">
                {(["xlsx", "csv", "json"] as const).map((f) => <Btn key={f} variant="ghost" onClick={async () => { try { saveBlob(await fetchFile(`/api/reports/class/${classId}?format=${f}&periodId=${periodId}`)); logs.reload(); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); } }}>⬇ {f === "xlsx" ? "Excel" : f.toUpperCase()}</Btn>)}
              </div>
            </div>
          ) : <Empty>اختر قسمًا.</Empty>}
        </Card>
      )}

      {tab === "bulk" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={`1) تحديد التلاميذ (${sel.size ? sel.size : "كل القسم"} من ${stu.data?.length ?? 0})`}
            actions={<><Btn variant="ghost" onClick={() => setSel(new Set((stu.data ?? []).map((s) => s.id)))}>تحديد الكل</Btn><Btn variant="ghost" onClick={() => setSel(new Set())}>إلغاء التحديد</Btn></>}>
            <input className={`${inputCls} mb-2`} placeholder="تصفية بالاسم…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <p className="mb-2 text-xs text-slate-500">دون تحديد أي تلميذ يُصدَّر القسم بأكمله.</p>
            <div className="max-h-80 space-y-1 overflow-auto rounded-xl border p-2">
              {shown.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded px-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="h-4 w-4" checked={sel.has(s.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(s.id); else n.delete(s.id); setSel(n); }} />
                  {s.fullName}
                </label>
              ))}
              {!shown.length && <Empty>لا يوجد تلاميذ.</Empty>}
            </div>
          </Card>
          <Card title="2) الصيغة والتنفيذ">
            <div className="space-y-2">
              {FORMATS.map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="fmt" checked={format === k} onChange={() => setFormat(k)} />{l}</label>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">الفترة: {periodId ? "المحددة أعلاه" : "كل الفترات (آخر تقييم لكل مهارة)"}. يُنزَّل الملف مباشرة، ثم يمكنك مشاركته أو معاينته.</p>
            <Btn className="mt-3 w-full" disabled={busy || !classId || !(stu.data?.length)} onClick={start}>{busy ? "جارٍ الإنشاء… (قد يستغرق بعض الوقت)" : "🚀 بدء التصدير"}</Btn>
            {out && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
                <div className="mb-2 text-sm font-bold text-green-800">✔ {out.filename}</div>
                <FileActions label="مرة أخرى" preview={out.filename.endsWith(".pdf")} getFile={async () => out} />
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "log" && (
        <Card title="سجل عمليات التصدير" actions={<Btn variant="ghost" onClick={logs.reload}>تحديث</Btn>}>
          {!logs.data?.length ? <Empty>لا توجد عمليات تصدير بعد.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-right text-slate-500"><th className="p-1">التاريخ</th><th>النوع</th><th>الصيغة</th><th>النطاق</th><th>العدد</th><th>الملف</th><th>الحجم</th></tr></thead>
              <tbody>{logs.data.map((l) => <tr key={l.id} className="border-t"><td className="p-1">{new Date(l.createdAt).toLocaleString("ar-DZ-u-nu-latn")}</td><td><Badge>{{ student: "تلميذ", class: "قسم", bulk: "جماعي", backup: "نسخة احتياطية" }[l.kind] ?? l.kind}</Badge></td><td>{l.format}</td><td>{l.scope}</td><td>{l.count}</td><td className="max-w-48 truncate">{l.filename}</td><td>{(l.sizeBytes / 1024).toFixed(0)} ك.ب</td></tr>)}</tbody></table></div>
          )}
        </Card>
      )}
    </>
  );
}
