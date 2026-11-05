"use client";
import { useState } from "react";
import { DEFAULT_REPORT_OPTIONS, type ReportOptions } from "@/lib/levels";
import { fetchFile, printBlob, saveBlob, shareBlob, sendToFlutterBridge, type FetchedFile } from "@/lib/client";
import { Btn, useToast } from "./ui";

const OPTION_LABELS: [keyof ReportOptions, string][] = [
  ["studentInfo", "معلومات الطفل"],
  ["academic", "مجالات التعلم والاستكشاف"],
  ["behavioral", "التنشئة، الحركية والاستقلالية"],
  ["analysis", "التوجيه النمائي والملاحظات"],
  ["remedial", "خطة الأنشطة والألعاب المقترحة"],
  ["charts", "الرسوم البيانية لمجالات النمو"],
  ["progress", "سجل التطور عبر الفترات"],
  ["teacherNotes", "ملاحظات المربية/المعلم"],
  ["signature", "مساحة التوقيع"],
];

export function useReportOptions() {
  const [o, setO] = useState<ReportOptions>(() => {
    if (typeof window === "undefined") return DEFAULT_REPORT_OPTIONS;
    try {
      return { ...DEFAULT_REPORT_OPTIONS, ...JSON.parse(localStorage.getItem("tq.reportOptions") ?? "{}") };
    } catch {
      return DEFAULT_REPORT_OPTIONS;
    }
  });
  const set = (v: ReportOptions) => {
    setO(v);
    localStorage.setItem("tq.reportOptions", JSON.stringify(v));
  };
  return [o, set] as const;
}

export function ReportOptionsForm({ value, onChange }: { value: ReportOptions; onChange: (o: ReportOptions) => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPTION_LABELS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} className="h-4 w-4" />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">نمط الطباعة:</span>
        {([["color", "ملوّن"], ["bw", "أبيض وأسود"], ["eco", "اقتصادي (بدون تعبئة)"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-1">
            <input type="radio" name="mode" checked={value.mode === k} onChange={() => onChange({ ...value, mode: k })} />
            {l}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Generic file action row: download / preview / print / share. */
export function FileActions({ getFile, label = "PDF", preview = true }: { getFile: () => Promise<FetchedFile>; label?: string; preview?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [prev, setPrev] = useState<{ url: string; name: string } | null>(null);
  const run = async (what: string, fn: (f: FetchedFile) => void | Promise<void>) => {
    setBusy(what);
    try {
      const f = await getFile();
      await fn(f);
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل", "err");
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Btn disabled={!!busy} onClick={() => run("dl", async (f) => { await saveBlob(f); toast(`تم تنزيل ${f.filename}`); })}>{busy === "dl" ? "…" : `⬇ تنزيل ${label}`}</Btn>
        {preview && <Btn variant="ghost" disabled={!!busy} onClick={() => run("pv", async (f) => { if (await sendToFlutterBridge("preview", f)) return; setPrev({ url: URL.createObjectURL(f.blob), name: f.filename }); })}>👁 معاينة</Btn>}
        {preview && <Btn variant="ghost" disabled={!!busy} onClick={() => run("pr", async (f) => { await printBlob(f); })}>🖨 طباعة</Btn>}
        <Btn variant="ghost" disabled={!!busy} onClick={() => run("sh", async (f) => { if (await sendToFlutterBridge("share", f)) return; if (!(await shareBlob(f))) { await saveBlob(f); toast("المشاركة غير مدعومة في هذا المتصفح، تم حفظ الملف بدلًا من ذلك"); } })}>↗ مشاركة</Btn>
      </div>
      {prev && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-2 sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-3">
              <b className="truncate px-2 text-sm">{prev.name}</b>
              <div className="flex gap-2">
                <a href={prev.url} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-1.5 text-xs sm:text-sm hover:bg-slate-50">فتح في تبويب</a>
                <a href={prev.url} download={prev.name} className="rounded-xl bg-[#0f4c81] px-3 py-1.5 text-xs text-white sm:text-sm">تنزيل</a>
                <Btn variant="danger" onClick={() => { URL.revokeObjectURL(prev.url); setPrev(null); }}>إغلاق</Btn>
              </div>
            </div>
            <object data={prev.url} type="application/pdf" className="h-full w-full flex-1 rounded-b-2xl">
              <iframe src={prev.url} className="h-full w-full flex-1 rounded-b-2xl" title="معاينة التقرير">
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-600">
                  <p className="mb-2 font-medium">يتعذر عرض ملف الـ PDF مباشرة داخل نافذة هذا المتصفح.</p>
                  <p className="mb-4 text-xs text-slate-500">يمكنك فتحه في تبويب مستقل أو تنزيله وعرضه في قارئ المستندات.</p>
                  <div className="flex gap-2">
                    <a href={prev.url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#0f4c81] px-4 py-2 text-sm text-white">فتح في تبويب جديد ↗</a>
                    <a href={prev.url} download={prev.name} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">تنزيل الملف ⬇</a>
                  </div>
                </div>
              </iframe>
            </object>
          </div>
        </div>
      )}
    </>
  );
}

export function StudentExport({ studentId, periodId }: { studentId: string; periodId: string }) {
  const [opts, setOpts] = useReportOptions();
  const toast = useToast();
  const q = (format: string, inline = false) => `/api/reports/student/${studentId}?format=${format}&periodId=${periodId}${inline ? "&inline=1" : ""}&options=${encodeURIComponent(JSON.stringify(opts))}`;
  return (
    <div className="space-y-4">
      <ReportOptionsForm value={opts} onChange={setOpts} />
      <FileActions getFile={() => fetchFile(q("pdf"))} />
      <div className="flex flex-wrap gap-2 text-sm">
        {(["xlsx", "csv", "json"] as const).map((f) => (
          <Btn key={f} variant="ghost" onClick={async () => { try { saveBlob(await fetchFile(q(f))); } catch (e) { toast(e instanceof Error ? e.message : "فشل", "err"); } }}>
            ⬇ {f === "xlsx" ? "Excel" : f.toUpperCase()}
          </Btn>
        ))}
      </div>
    </div>
  );
}
