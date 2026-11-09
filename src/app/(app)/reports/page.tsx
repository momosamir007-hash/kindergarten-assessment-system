"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Layers,
  Users,
  Printer,
  Archive,
  Download,
  CheckCircle2,
  History,
  CheckSquare,
  Square,
  ArrowRight,
} from "lucide-react";
import { FileActions, ReportOptionsForm, useReportOptions } from "@/components/export";
import { StudentReportView } from "@/components/student-report-view";
import {
  Badge,
  Btn,
  Card,
  ClassPeriodPicker,
  Empty,
  PageTitle,
  Spinner,
  inputCls,
  useApiData,
  useApp,
  useToast,
} from "@/components/ui";
import { fetchFile, saveBlob, type FetchedFile } from "@/lib/client";
import type { StudentReportData } from "@/lib/report-types";

type Stu = { id: string; fullName: string; photo?: string | null };
type Log = {
  id: string;
  kind: string;
  format: string;
  scope: string;
  count: number;
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

const FORMATS = [
  { id: "merged", label: "ملف PDF واحد موحد (صفحة A4 لكل تلميذ للطباعة الجماعية)", icon: FileText },
  { id: "zip", label: "أرشيف ZIP (ملف PDF مستقل لكل تلميذ)", icon: Archive },
  { id: "xlsx", label: "جدول Excel شامل لنتائج القسم", icon: Layers },
  { id: "csv", label: "ملف بيانات CSV", icon: Download },
  { id: "json", label: "نسخة بيانات كاملة JSON", icon: Download },
] as const;

export default function Reports() {
  const { classId, periodId, classes } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<"bulk" | "single" | "class" | "log">("bulk");
  const [opts, setOpts] = useReportOptions();
  const stu = useApiData<Stu[]>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const logs = useApiData<Log[]>("/api/exports");
  const [one, setOne] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("merged");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<FetchedFile | null>(null);

  const shown = useMemo(
    () => (stu.data ?? []).filter((s) => s.fullName.includes(filter)),
    [stu.data, filter]
  );
  const optQ = encodeURIComponent(JSON.stringify(opts));
  const cls = classes.find((c) => c.id === classId);

  const startBulk = async () => {
    setBusy(true);
    setOut(null);
    try {
      const ids = sel.size ? [...sel] : undefined;
      const f = await fetchFile("/api/reports/bulk", {
        json: { classId, studentIds: ids, periodId, format, options: opts },
      });
      setOut(f);
      saveBlob(f);
      toast(`تم تصدير ${f.filename} بنجاح (${(f.blob.size / 1024).toFixed(0)} ك.ب)`);
      logs.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشلت عملية التصدير", "err");
    } finally {
      setBusy(false);
    }
  };

  // For single student report preview
  const singleUrl = one
    ? `/api/reports/student/${one}?format=json&inline=1${periodId ? `&periodId=${periodId}` : ""}`
    : null;
  const singleReport = useApiData<{ students: StudentReportData[] }>(singleUrl, [one, periodId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle sub="تصدير دفاتر الملاحظة الفردية A4، تقارير القسم، وحزم الطباعة الجماعية الموحدة">
          التقارير والدفاتر التربوية
        </PageTitle>
        <ClassPeriodPicker />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white border border-slate-200/80 p-1.5 shadow-2xs">
        {[
          { id: "bulk", label: "الطباعة والتصدير الجماعي للفوج", icon: Layers },
          { id: "single", label: "دفتر تلميذ فردي (معاينة وطباعة)", icon: FileText },
          { id: "class", label: "تقرير إحصائيات القسم", icon: Users },
          { id: "log", label: "سجل التصدير السريع", icon: History },
        ].map((t) => {
          const isActive = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs md:text-sm font-bold transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-[#0f4c81] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.3 : 1.8} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Options Form for all report tabs */}
      {tab !== "log" && (
        <Card title="خيارات إعداد التقرير ونمط الألوان" className="mb-4">
          <ReportOptionsForm value={opts} onChange={setOpts} />
        </Card>
      )}

      {/* Tab: Single Student Report Preview & Print */}
      {tab === "single" && (
        <div className="space-y-4">
          <Card title="اختيار التلميذ للمعاينة والطباعة">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className={`${inputCls} max-w-sm text-xs md:text-sm font-bold`}
                value={one}
                onChange={(e) => setOne(e.target.value)}
              >
                <option value="">— اختر التلميذ لعرض دفتره التربوي —</option>
                {stu.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              {one && (
                <span className="text-xs text-slate-500 font-semibold">
                  جاهز للطباعة المباشرة بحجم A4
                </span>
              )}
            </div>
          </Card>

          {one ? (
            singleReport.loading ? (
              <Spinner label="جارٍ تجهيز دفتر التلميذ..." />
            ) : singleReport.data?.students?.[0] ? (
              <StudentReportView
                data={singleReport.data.students[0]}
                studentId={one}
                periodId={periodId}
              />
            ) : (
              <Empty>تعذر استخراج بيانات التقرير لهذا التلميذ.</Empty>
            )
          ) : (
            <Empty>يرجى اختيار تلميذ من القائمة أعلاه لمعاينة تقريره وطباعته.</Empty>
          )}
        </div>
      )}

      {/* Tab: Class Aggregate Report */}
      {tab === "class" && (
        <Card title={`تقرير إحصائيات ونتائج الفوج: ${cls?.name ?? ""}`}>
          {classId ? (
            <div className="space-y-4">
              <p className="text-xs md:text-sm text-slate-600">
                تقرير شامل لنتائج القسم، مصفوفة المهارات ونسب الاكتساب لجميع التلاميذ.
              </p>
              <FileActions
                getFile={() =>
                  fetchFile(`/api/reports/class/${classId}?format=pdf&periodId=${periodId}&options=${optQ}`)
                }
              />
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {(["xlsx", "csv", "json"] as const).map((f) => (
                  <Btn
                    key={f}
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const file = await fetchFile(
                          `/api/reports/class/${classId}?format=${f}&periodId=${periodId}`
                        );
                        saveBlob(file);
                        logs.reload();
                        toast(`تم تنزيل ${file.filename}`);
                      } catch (e) {
                        toast(e instanceof Error ? e.message : "فشل", "err");
                      }
                    }}
                  >
                    <Download size={14} />
                    <span>{f === "xlsx" ? "جدول Excel للقسم" : f.toUpperCase()}</span>
                  </Btn>
                ))}
              </div>
            </div>
          ) : (
            <Empty>يرجى اختيار فوج أو قسم من الأعلى لعرض تقريره.</Empty>
          )}
        </Card>
      )}

      {/* Tab: Bulk Export */}
      {tab === "bulk" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Column 1: Select Students */}
          <Card
            title={`1) تحديد التلاميذ (${sel.size ? sel.size : "كامل الفوج"} من ${stu.data?.length ?? 0})`}
            actions={
              <div className="flex gap-2">
                <Btn
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setSel(new Set((stu.data ?? []).map((s) => s.id)))}
                >
                  <CheckSquare size={13} />
                  <span>تحديد الكل</span>
                </Btn>
                <Btn
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setSel(new Set())}
                >
                  <Square size={13} />
                  <span>إلغاء التحديد</span>
                </Btn>
              </div>
            }
          >
            <input
              className={`${inputCls} mb-3`}
              placeholder="تصفية بالاسم..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <p className="mb-2 text-xs text-slate-400 font-medium">
              عند عدم تحديد تلاميذ، يتم تصدير الفوج كاملاً تلقائياً.
            </p>

            <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-slate-200/80 p-2 divide-y divide-slate-100">
              {shown.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg p-2 text-xs md:text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded-md accent-[#0f4c81]"
                    checked={sel.has(s.id)}
                    onChange={(e) => {
                      const n = new Set(sel);
                      if (e.target.checked) n.add(s.id);
                      else n.delete(s.id);
                      setSel(n);
                    }}
                  />
                  <span>{s.fullName}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* Column 2: Choose Format & Export */}
          <Card title="2) اختيار صيغة التصدير وبدء الإنشاء">
            <div className="space-y-3">
              {FORMATS.map((f) => {
                const isSelected = format === f.id;
                const Icon = f.icon;
                return (
                  <label
                    key={f.id}
                    className={`flex items-center gap-3 rounded-xl border p-3.5 text-xs md:text-sm font-bold cursor-pointer transition-all ${
                      isSelected
                        ? "border-[#0f4c81] bg-blue-50/70 text-[#0f4c81] shadow-2xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      checked={isSelected}
                      onChange={() => setFormat(f.id)}
                      className="accent-[#0f4c81]"
                    />
                    <Icon size={18} className={isSelected ? "text-[#0f4c81]" : "text-slate-400"} />
                    <span>{f.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-semibold">
                العدد المستهدف: <b>{sel.size ? sel.size : stu.data?.length ?? 0}</b> تلميذ
              </div>
              <Btn onClick={startBulk} disabled={busy || !stu.data?.length} className="font-bold text-sm">
                <Download size={16} />
                <span>{busy ? "جارٍ التوليد والتصدير..." : "توليد وتنزيل التقرير الجماعي"}</span>
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Export History Logs */}
      {tab === "log" && (
        <Card title="سجل عمليات التصدير الأخيرة">
          {!logs.data?.length ? (
            <Empty>لا توجد عمليات تصدير مسجلة بعد.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b text-slate-400 text-[11px] font-bold">
                    <th className="pb-2">اسم الملف</th>
                    <th className="pb-2">الصيغة</th>
                    <th className="pb-2">النطاق</th>
                    <th className="pb-2">العدد</th>
                    <th className="pb-2">الحجم</th>
                    <th className="pb-2">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.data.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-800">{l.filename}</td>
                      <td className="py-2.5">
                        <Badge color="#0f4c81">{l.format.toUpperCase()}</Badge>
                      </td>
                      <td className="py-2.5 text-slate-600">{l.scope || "—"}</td>
                      <td className="py-2.5 font-bold">{l.count}</td>
                      <td className="py-2.5 text-slate-500">{(l.sizeBytes / 1024).toFixed(0)} ك.ب</td>
                      <td className="py-2.5 text-slate-400" dir="ltr">
                        {new Date(l.createdAt).toLocaleString("ar-DZ-u-nu-latn")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
