"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  User,
  BookOpen,
  HeartHandshake,
  TrendingUp,
  Sparkles,
  FileText,
  Edit3,
  Trash2,
  Calendar,
  CreditCard,
  School,
  ArrowLeft,
  Camera,
} from "lucide-react";
import Link from "next/link";
import { AiBanner, StudentAiView } from "@/components/ai-view";
import { LineChart } from "@/components/charts";
import { EvalForm } from "@/components/eval-form";
import { StudentReportView } from "@/components/student-report-view";
import { StudentAvatar, PhotoUpload } from "@/components/photo-upload";
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
import { GENDER_LABEL, api } from "@/lib/client";
import type { SkillResult, StudentReportData } from "@/lib/report-types";

type Student = {
  id: string;
  fullName: string;
  birthDate: string | null;
  gender: string | null;
  nationalId: string | null;
  classId: string | null;
  className: string;
  level: string;
  notes: string;
  photo?: string | null;
  extra: Record<string, unknown>;
};

type Ai = {
  id: string;
  source: string;
  provider: string;
  content: Record<string, unknown>;
  createdAt: string;
  error?: string;
  recorded?: SkillResult[];
};

const TABS = [
  { id: "report", label: "التقرير الفردي لمكتسبات التلميذ", icon: FileText },
  { id: "academic", label: "التعلم والاستكشاف", icon: BookOpen },
  { id: "behavioral", label: "الحركية والاستقلالية", icon: HeartHandshake },
  { id: "progress", label: "المسار النمائي", icon: TrendingUp },
  { id: "ai", label: "التوجيه الذكي", icon: Sparkles },
  { id: "file", label: "بطاقة وبيانات الطفل", icon: User },
] as const;

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { classes, periodId, reload } = useApp();
  const [tab, setTab] = useState<string>("report");
  const { data: s, loading, reload: rl } = useApiData<Student>(`/api/students/${id}`);
  const [edit, setEdit] = useState<Partial<Student> | null>(null);

  if (loading && !s) return <Spinner label="جارٍ تحميل ملف التلميذ..." />;
  if (!s) return <Empty>التلميذ غير موجود أو تم حذفه.</Empty>;

  const saveEdit = async () => {
    try {
      await api(`/api/students/${id}`, { method: "PATCH", json: edit });
      toast("تم حفظ التعديلات بنجاح");
      setEdit(null);
      rl();
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل حفظ التعديلات", "err");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/students" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0f4c81]">
          <ArrowLeft size={14} />
          <span>العودة لقائمة الأطفال</span>
        </Link>
        <ClassPeriodPicker withClass={false} />
      </div>

      {/* Profile Header Banner */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 md:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <StudentAvatar src={s.photo} alt={s.fullName} size="xl" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900">{s.fullName}</h1>
              {s.className && <Badge color="#0f4c81">{s.className}</Badge>}
              {s.level && <span className="text-xs font-semibold text-slate-500">({s.level})</span>}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
              {s.birthDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400" />
                  <span dir="ltr">{s.birthDate}</span>
                </span>
              )}
              {s.gender && (
                <span>الجنس: <b>{GENDER_LABEL[s.gender] ?? s.gender}</b></span>
              )}
              {s.nationalId && (
                <span className="flex items-center gap-1">
                  <CreditCard size={13} className="text-slate-400" />
                  <span dir="ltr">{s.nationalId}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Btn
            variant="outline"
            className="text-xs"
            onClick={() => {
              setTab("file");
              setEdit({
                fullName: s.fullName,
                birthDate: s.birthDate ?? "",
                gender: s.gender ?? "",
                nationalId: s.nationalId ?? "",
                classId: s.classId,
                notes: s.notes,
                photo: s.photo,
              });
            }}
          >
            <Edit3 size={14} />
            <span>تعديل البيانات والصورة</span>
          </Btn>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white border border-slate-200/80 p-1.5 shadow-2xs">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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

      {/* Tab 1: New Individual Report (التقرير الفردي لمكتسبات التلميذ) */}
      {tab === "report" && (
        <ReportTabWrapper studentId={id} periodId={periodId} />
      )}

      {/* Tab 2: Academic Skills Form */}
      {tab === "academic" && (
        <Card title="مجالات التعلم والاستكشاف المبكر (لغة، رياضيات حسية، استكشاف)">
          <EvalForm studentId={id} kind="academic" />
        </Card>
      )}

      {/* Tab 3: Behavioral Skills Form */}
      {tab === "behavioral" && (
        <Card title="مجالات التنشئة الاجتماعية، الحركية، الاستقلالية والعناية بالذات">
          <EvalForm studentId={id} kind="behavioral" />
        </Card>
      )}

      {/* Tab 4: Developmental Progress */}
      {tab === "progress" && <Progress id={id} periodId={periodId} />}

      {/* Tab 5: Intelligent AI Guidance */}
      {tab === "ai" && <AiTab id={id} periodId={periodId} />}

      {/* Tab 6: Student File & Photo Management */}
      {tab === "file" && (
        <Card
          title="بيانات وبطاقة الطفل"
          actions={
            !edit && (
              <Btn
                variant="outline"
                className="text-xs"
                onClick={() =>
                  setEdit({
                    fullName: s.fullName,
                    birthDate: s.birthDate ?? "",
                    gender: s.gender ?? "",
                    nationalId: s.nationalId ?? "",
                    classId: s.classId,
                    notes: s.notes,
                    photo: s.photo,
                  })
                }
              >
                <Edit3 size={14} />
                <span>تعديل</span>
              </Btn>
            )
          }
        >
          {!edit ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <StudentAvatar src={s.photo} size="lg" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">الصورة الشخصية الحالية</h4>
                  <p className="text-xs text-slate-500">تظهر في أعلى التقرير الفردي وبطاقة المتابعة المطبوعة</p>
                </div>
              </div>

              <dl className="grid gap-4 text-xs md:text-sm sm:grid-cols-2">
                {[
                  ["الاسم الكامل", s.fullName],
                  ["رقم التعريف المدرسي أو الوطني", s.nationalId || "—"],
                  ["تاريخ الميلاد", s.birthDate || "—"],
                  ["الجنس", GENDER_LABEL[s.gender ?? ""] ?? "—"],
                  ["الفوج / القسم", s.className || "—"],
                  ["المستوى الدراسي", s.level || "—"],
                  ["الملاحظات الصحية والتربوية", s.notes || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                    <dt className="text-xs font-bold text-slate-400 mb-1">{k}</dt>
                    <dd className="font-bold text-slate-800">{v}</dd>
                  </div>
                ))}

                {Object.entries(s.extra ?? {})
                  .filter(([k, v]) => k !== "photo" && typeof v !== "object")
                  .map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                      <dt className="text-xs font-bold text-slate-400 mb-1">{k}</dt>
                      <dd className="font-bold text-slate-800">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-2">
                  تحديث الصورة الشخصية للطفل
                </label>
                <PhotoUpload
                  value={edit.photo}
                  onChange={(photo) => setEdit({ ...edit, photo })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className={inputCls}
                  value={edit.fullName ?? ""}
                  onChange={(e) => setEdit({ ...edit, fullName: e.target.value })}
                  placeholder="الاسم الكامل"
                />
                <input
                  className={inputCls}
                  dir="ltr"
                  value={edit.nationalId ?? ""}
                  onChange={(e) => setEdit({ ...edit, nationalId: e.target.value })}
                  placeholder="رقم التعريف"
                />
                <input
                  type="date"
                  className={inputCls}
                  value={edit.birthDate ?? ""}
                  onChange={(e) => setEdit({ ...edit, birthDate: e.target.value })}
                />
                <select
                  className={inputCls}
                  value={edit.gender ?? ""}
                  onChange={(e) => setEdit({ ...edit, gender: e.target.value })}
                >
                  <option value="">الجنس</option>
                  <option value="M">ذكر</option>
                  <option value="F">أنثى</option>
                </select>
                <select
                  className={inputCls}
                  value={edit.classId ?? ""}
                  onChange={(e) => setEdit({ ...edit, classId: e.target.value })}
                >
                  <option value="">بدون قسم</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  value={edit.notes ?? ""}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  placeholder="ملاحظات"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <Btn variant="ghost" onClick={() => setEdit(null)}>
                  إلغاء
                </Btn>
                <Btn onClick={saveEdit} className="font-bold">
                  حفظ التعديلات
                </Btn>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 flex justify-between items-center">
            <span className="text-xs text-slate-400 font-medium">العمليات المتقدمة</span>
            <Btn
              variant="danger"
              className="text-xs"
              onClick={async () => {
                if (confirm(`حذف التلميذ «${s.fullName}» نهائياً مع كافة تقييماته وملاحظاته؟`)) {
                  await api(`/api/students/${id}`, { method: "DELETE" });
                  await reload();
                  router.replace("/students");
                }
              }}
            >
              <Trash2 size={14} />
              <span>حذف التلميذ نهائياً</span>
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

function ReportTabWrapper({ studentId, periodId }: { studentId: string; periodId: string }) {
  const url = `/api/reports/student/${studentId}?format=json&inline=1${periodId ? `&periodId=${periodId}` : ""}`;
  const { data, loading, error } = useApiData<{ students: StudentReportData[] }>(url, [periodId]);

  if (loading) return <Spinner label="جارٍ تجهيز التقرير الفردي المخصص للطباعة..." />;
  if (error || !data?.students?.[0]) {
    return <Empty>تعذر استخراج بيانات التقرير لهذا التلميذ.</Empty>;
  }

  return (
    <StudentReportView
      data={data.students[0]}
      studentId={studentId}
      periodId={periodId}
    />
  );
}

function Progress({ id, periodId }: { id: string; periodId: string }) {
  const { data, loading } = useApiData<{ students: { progress: StudentReportData["progress"]; results: SkillResult[] }[] }>(
    `/api/reports/student/${id}?format=json&inline=1${periodId ? `&periodId=${periodId}` : ""}`
  );
  const { settings } = useApp();
  if (loading) return <Spinner label="جارٍ تحليل مؤشرات التطور..." />;
  const p = data?.students[0]?.progress ?? [];
  const levels = settings?.settings.levels ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="تطور المعدلات عبر الفترات">
        {p.length < 1 ? (
          <Empty>لا توجد تقييمات مسجلة بعد.</Empty>
        ) : (
          <LineChart
            points={p.map((x) => {
              const v = [x.academicPct, x.behavioralPct].filter((n): n is number => n !== null);
              return {
                label: x.periodName,
                value: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null,
              };
            })}
          />
        )}
        {p.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b pb-1">
                <th className="p-1 text-right">الفترة</th>
                <th>أكاديمي</th>
                <th>سلوكي</th>
              </tr>
            </thead>
            <tbody>
              {p.map((x) => (
                <tr key={x.periodName} className="border-t text-center">
                  <td className="p-1 text-right font-medium">{x.periodName}</td>
                  <td>{x.academicPct ?? "—"}%</td>
                  <td>{x.behavioralPct ?? "—"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="النتائج المرصودة في الفترة">
        {(data?.students[0]?.results ?? []).length === 0 ? (
          <Empty>لا توجد نتائج مسجلة في الفترة المحددة.</Empty>
        ) : (
          <ul className="space-y-1 text-xs md:text-sm divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {data!.students[0].results.map((r) => (
              <li key={r.skillId} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-bold text-slate-800">{r.skillName}</span>
                  <span className="block text-[11px] text-slate-400">{r.subjectName}</span>
                </div>
                <Badge color={levels.find((l) => l.key === r.levelKey)?.color}>
                  {r.levelLabel}
                </Badge>
              </li>
            ))}
          </ul>
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
      toast("تم إعداد التحليل الذكي بنجاح");
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل التحليل", "err");
    } finally {
      setBusy(false);
    }
  };

  const shown = res ?? (old.data?.[0] ? { ...old.data[0] } : null);

  return (
    <Card
      title="التحليل والتوجيه التربوي الذكي"
      actions={
        <Btn disabled={busy} onClick={run} className="text-xs font-bold">
          <Sparkles size={14} />
          <span>{busy ? "جارٍ التحليل..." : "تحليل نتائج التلميذ"}</span>
        </Btn>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        يُرسل إلى المحرك الذكي رمز مجهول ونتائج الكفاءات فقط، دون أسماء أو بيانات شخصية حفاظاً على الخصوصية.
      </p>

      {shown ? (
        <>
          <AiBanner source={shown.source} provider={shown.provider} error={res?.error} />
          <StudentAiView c={shown.content} />
          <div className="mt-3 text-[11px] text-slate-400">
            تاريخ التحليل: {new Date(shown.createdAt).toLocaleString("ar-DZ-u-nu-latn")}
          </div>
        </>
      ) : (
        <Empty>لم يُجرَ تحليل تربوي ذكي بعد لهذا التلميذ. اضغط على الزر أعلاه لتوليد التوجيهات.</Empty>
      )}
    </Card>
  );
}
