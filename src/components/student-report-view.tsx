"use client";

import React from "react";
import { Printer, Download, School } from "lucide-react";
import { StudentAvatar } from "./photo-upload";
import { EvalCircle, EvalLegend, EvalSummaryCards } from "./eval-circles";
import { Btn } from "./ui";
import { fetchFile, saveBlob } from "@/lib/client";
import type { SkillResult, StudentReportData } from "@/lib/report-types";

export function StudentReportView({
  data,
  studentId,
  periodId,
}: {
  data: StudentReportData;
  studentId: string;
  periodId?: string | null;
}) {
  const [downloading, setDownloading] = React.useState(false);

  const student = data?.student ?? {
    id: studentId,
    fullName: "التلميذ",
    birthDate: null,
    gender: null,
    nationalId: null,
    className: "",
    level: "التحضيري",
    notes: "",
    photo: null,
  };

  const institution = data?.institution ?? {
    name: "المؤسسة التربوية",
    academicYear: "—",
    city: "",
    logo: null,
    signatureLabel: "توقيع وملاحظة المربية / المعلم",
  };

  const results: SkillResult[] = Array.isArray(data?.results) ? data.results : [];
  const periodName = data?.periodName || (data as unknown as { period?: string })?.period || "التقييم المستمر";
  const aiText = data?.aiText;

  // Real counts computed from actual data
  const counts = React.useMemo(() => {
    let acquired = 0;
    let inProgress = 0;
    let notAcquired = 0;
    for (const r of results) {
      if (r.levelKey === "acquired") acquired++;
      else if (r.levelKey === "in_progress") inProgress++;
      else notAcquired++;
    }
    return { acquired, inProgress, notAcquired };
  }, [results]);

  // Group competencies by subject
  const groupedResults = React.useMemo(() => {
    const map = new Map<string, { name: string; kind: string; skills: SkillResult[] }>();
    for (const r of results) {
      const subId = r.subjectId || r.subjectName || "general";
      if (!map.has(subId)) {
        map.set(subId, { name: r.subjectName || "المجال العام", kind: r.kind || "academic", skills: [] });
      }
      map.get(subId)!.skills.push(r);
    }
    return Array.from(map.values());
  }, [results]);

  // Derived Pedagogical Strengths and Support Areas from actual evaluations
  const strengths = React.useMemo(() => {
    return results.filter((r) => r.levelKey === "acquired").slice(0, 4);
  }, [results]);

  const supportAreas = React.useMemo(() => {
    return results.filter((r) => r.levelKey !== "acquired").slice(0, 4);
  }, [results]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const q = periodId ? `?periodId=${periodId}` : "";
      const file = await fetchFile(`/api/reports/student/${studentId}${q}`);
      await saveBlob(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل تحميل ملف PDF");
    } finally {
      setDownloading(false);
    }
  };

  const currentDate = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Action Toolbar (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200/80 p-3 shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-xs font-bold text-slate-700">معاينة التقرير الفردي المخصص للطباعة (A4)</span>
        </div>

        <div className="flex items-center gap-2">
          <Btn variant="outline" onClick={handlePrint} className="text-xs font-bold">
            <Printer size={15} />
            <span>طباعة مباشرة (A4)</span>
          </Btn>
          <Btn
            variant="primary"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="text-xs font-bold"
          >
            <Download size={15} />
            <span>{downloading ? "جارٍ التحميل..." : "تنزيل نسخة PDF"}</span>
          </Btn>
        </div>
      </div>

      {/* A4 Sheet Container */}
      <div className="mx-auto max-w-[210mm] min-h-[297mm] bg-white text-slate-900 border border-slate-300/80 shadow-md p-6 sm:p-10 rounded-2xl print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none flex flex-col justify-between">
        <div className="space-y-4">
          {/* 1. Header Band */}
          <div className="flex items-center justify-between border-b-2 border-[#0f4c81] pb-4">
            <div className="flex items-center gap-3">
              {institution?.logo ? (
                <img
                  src={institution.logo}
                  alt="شعار المؤسسة"
                  className="h-16 w-16 object-contain rounded-xl border border-slate-100"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f4c81] to-[#1e6bb8] text-white">
                  <School size={28} />
                </div>
              )}
              <div>
                <h2 className="text-base font-black text-slate-900">{institution?.name || "المؤسسة التربوية"}</h2>
                <p className="text-xs text-slate-500 font-medium">
                  السنة الدراسية: {institution?.academicYear || "—"} {institution?.city ? `• ${institution.city}` : ""}
                </p>
                <p className="text-xs font-bold text-[#0f4c81]">
                  الفترة: {periodName || "التقييم المستمر"}
                </p>
              </div>
            </div>

            <div className="text-left">
              <div className="inline-block rounded-xl bg-blue-50/80 border border-blue-200 px-3.5 py-1 text-xs font-black text-[#0f4c81]">
                التقرير الفردي لمكتسبات التلميذ
              </div>
              <p className="mt-1 text-[11px] text-slate-400 font-medium">
                تاريخ الإصدار: {currentDate}
              </p>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 p-4">
            <div className="flex items-center gap-4">
              <StudentAvatar src={student?.photo} alt={student?.fullName} size="lg" />
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">{student?.fullName}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                  <span>
                    <b>القسم/الفوج:</b> {student?.className || "—"}
                  </span>
                  <span>
                    <b>المستوى:</b> {student?.level || "التحضيري"}
                  </span>
                  {student?.birthDate && (
                    <span>
                      <b>تاريخ الميلاد:</b> <span dir="ltr">{student.birthDate}</span>
                    </span>
                  )}
                  {student?.nationalId && (
                    <span>
                      <b>رقم التعريف:</b> <span dir="ltr">{student.nationalId}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Visual Summary Counters */}
          <EvalSummaryCards
            acquired={counts.acquired}
            inProgress={counts.inProgress}
            notAcquired={counts.notAcquired}
          />

          {/* 3. Legend (مفتاح تفسير الرموز) */}
          <div className="pt-1">
            <EvalLegend />
          </div>

          {/* 4. Competencies Evaluation Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-[#0f4c81] text-white text-[11px] font-black">
                  <th className="py-2 px-3 w-1/4">المادة / المجال النمائي</th>
                  <th className="py-2 px-3 w-7/12">الكفاءة أو التعلم المستهدف</th>
                  <th className="py-2 px-3 w-2/12 text-center">التقييم البصري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedResults.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400 font-medium">
                      لا توجد ملاحظات أو كفاءات مسجلة في هذه الفترة.
                    </td>
                  </tr>
                ) : (
                  groupedResults.map((group, gi) => (
                    <React.Fragment key={gi}>
                      {group.skills.map((skill, si) => (
                        <tr
                          key={skill.skillId || `${gi}-${si}`}
                          className={`${
                            si % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          } hover:bg-blue-50/40 transition-colors`}
                        >
                          {si === 0 ? (
                            <td
                              rowSpan={group.skills.length}
                              className="py-2 px-3 align-top font-bold text-slate-800 border-l border-slate-100 bg-slate-50/30"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#0f4c81]"></span>
                                <span>{group.name}</span>
                              </div>
                            </td>
                          ) : null}

                          <td className="py-1.5 px-3 font-medium text-slate-700">
                            {skill.skillName}
                          </td>

                          <td className="py-1.5 px-3 text-center align-middle">
                            <div className="flex justify-center">
                              <EvalCircle levelKey={skill.levelKey} size={16} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 5. Pedagogical Summary & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
              <div className="text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                <span>🌟 أبرز نقاط القوة والاكتساب</span>
              </div>
              {strengths.length > 0 ? (
                <ul className="text-[11px] text-emerald-950 font-medium space-y-0.5 list-disc list-inside">
                  {strengths.map((s, idx) => (
                    <li key={idx} className="truncate">
                      {s.skillName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500">قيد الملاحظة والتطور الأولي.</p>
              )}
            </div>

            <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-3">
              <div className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                <span>🎯 مجالات تحتاج إلى تعزيز ومرافقة</span>
              </div>
              {supportAreas.length > 0 ? (
                <ul className="text-[11px] text-amber-950 font-medium space-y-0.5 list-disc list-inside">
                  {supportAreas.map((s, idx) => (
                    <li key={idx} className="truncate">
                      {s.skillName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500">تحقق متوازن في كافة المجالات.</p>
              )}
            </div>
          </div>

          {/* 6. AI or Pedagogical Brief Note */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
            <div className="text-xs font-bold text-slate-800 mb-1">
              📝 الخلاصة والتوجيهات التربوية للمعلم والولي:
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              {aiText?.parentSummary ||
                (counts.acquired >= counts.inProgress
                  ? "يُظهر الطفل تطوراً متواصلاً واستقلالية جيدة في أداء المهارات والأنشطة الموجهة. يُوصى بالاستمرار في تشجيعه عبر اللعب التشاركي وتعزيز مهارات التعبير الشفوي."
                  : "يحقق الطفل تقدماً مشجعاً مع حاجته إلى المرافقة الهادئة في بعض المهارات الحركية والتواصلية. التكرار والأنشطة المنزلية المعززة يسهمان في ترسيخ هذه المكتسبات.")}
            </p>
          </div>
        </div>

        {/* 7. Signatures Area */}
        <div className="grid grid-cols-2 gap-8 border-t-2 border-slate-200 pt-3 mt-4 text-xs font-bold text-slate-700">
          <div className="text-center space-y-8">
            <div>{institution?.signatureLabel || "توقيع وملاحظة المربية / المعلم"}</div>
            <div className="border-b border-dashed border-slate-300 w-3/4 mx-auto"></div>
          </div>
          <div className="text-center space-y-8">
            <div>ملاحظة وتوقيع ولي الأمر</div>
            <div className="border-b border-dashed border-slate-300 w-3/4 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
