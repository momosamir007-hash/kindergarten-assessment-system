import { analyzeClass, analyzeStudent } from "../analysis";
import { DEFAULT_REPORT_OPTIONS, type ReportOptions } from "../levels";
import type { ClassReportData, StudentReportData } from "../report-types";
import { Pdf, type Cell, type HeaderInfo } from "./doc";
import { PDFDocument } from "pdf-lib";

const GENDER: Record<string, string> = { M: "ذكر", F: "أنثى" };

export function opts(o?: Partial<ReportOptions>): ReportOptions {
  return { ...DEFAULT_REPORT_OPTIONS, ...(o ?? {}) };
}

function headerOf(d: { institution: StudentReportData["institution"] }, periodName: string): HeaderInfo {
  return {
    name: d.institution.name || "المؤسسة التعليمية",
    sub: `السنة الدراسية: ${d.institution.academicYear || "—"}${d.institution.city ? " — " + d.institution.city : ""}${periodName ? " — " + periodName : ""}`,
    logo: d.institution.logo,
  };
}

/** Render one student's diagnostic report into an existing Pdf (as its own section). */
export function renderStudentReport(pdf: Pdf, d: StudentReportData, o: ReportOptions) {
  const a = analyzeStudent(d);
  pdf.beginSection(headerOf(d, d.periodName), d.student.fullName);
  pdf.title("دفتر الملاحظة والتقييم النمائي", `الفترة: ${d.periodName || "—"}`);

  if (o.studentInfo) {
    pdf.h2("معلومات الطفل(ة)");
    pdf.kv([
      ["الاسم الكامل", d.student.fullName],
      ["رقم التعريف", d.student.nationalId || "—"],
      ["تاريخ الميلاد", d.student.birthDate || "—"],
      ["الجنس", GENDER[d.student.gender ?? ""] ?? "—"],
      ["الفوج / القسم", d.student.className || "—"],
      ["المستوى", d.student.level || "—"],
    ]);
  }

  const levelColor = (key: string) => d.levels.find((l) => l.key === key)?.color;
  const rowsFor = (kind: "academic" | "behavioral"): Cell[][] =>
    d.results
      .filter((r) => r.kind === kind)
      .map((r) => [
        r.subjectName,
        r.skillName,
        { text: r.levelLabel, color: levelColor(r.levelKey), bold: true },
        ...(o.showPercentages ? [`${r.percent}%`] : []),
        o.teacherNotes ? r.note || "—" : "—",
      ]);
  const heads = o.showPercentages
    ? ["المجال", "المهارة النمائية", "مستوى الاكتساب", "النسبة", "ملاحظة المربية/المعلم"]
    : ["المجال", "المهارة النمائية", "مستوى الاكتساب", "ملاحظة المربية/المعلم"];
  const widths = o.showPercentages ? [2, 3.4, 2, 1, 3] : [2.5, 4.2, 2.5, 3.8];

  if (o.academic) {
    pdf.h2("مجالات التعلم والاستكشاف المبكر");
    const rows = rowsFor("academic");
    if (rows.length) pdf.table(heads, rows, widths);
    else pdf.para("لا توجد ملاحظات مسجلة في هذا المجال في هذه الفترة.");
  }
  if (o.behavioral) {
    pdf.h2("مجالات التنشئة الاجتماعية، الحركية والاستقلالية");
    const rows = rowsFor("behavioral");
    if (rows.length) pdf.table(heads, rows, widths);
    else pdf.para("لا توجد ملاحظات مسجلة في هذا المجال في هذه الفترة.");
  }

  pdf.h2("الحصيلة النمائية للفترة");
  const summaryKvs: [string, string][] = [
    ["إجمالي المهارات الملاحظة", String(d.results.length)],
    ["مكتسب باستقلالية", String(a.strengths.length)],
    ["في طور الاكتساب (بمساعدة)", String(a.needsSupport.length)],
    ["في بداية الظهور / قيد الملاحظة", String(a.notAcquired.length)],
  ];
  if (o.showPercentages) {
    summaryKvs.push(["المعدل الاسترشادي", a.overallPct === null ? "—" : `${a.overallPct}%`]);
  }
  pdf.kv(summaryKvs);

  if (o.charts && a.subjects.length) {
    pdf.h2("الرسم البياني لمجالات النمو");
    pdf.barChart(
      a.subjects.map((s) => ({ label: s.subjectName, value: s.pct, color: s.kind === "behavioral" ? "#7c3aed" : "#0f4c81" })),
    );
  }

  if (o.progress && d.progress.length) {
    pdf.h2("سجل التطور عبر الفترات");
    pdf.table(
      ["الفترة", "المعدل الأكاديمي", "المعدل السلوكي"],
      d.progress.map((p) => [p.periodName, p.academicPct === null ? "—" : `${p.academicPct}%`, p.behavioralPct === null ? "—" : `${p.behavioralPct}%`]),
      [3, 2, 2],
    );
    if (d.progress.length >= 2 && o.charts) {
      pdf.lineChart(
        d.progress.map((p) => ({
          label: p.periodName,
          value:
            p.academicPct === null && p.behavioralPct === null
              ? null
              : Math.round((([p.academicPct, p.behavioralPct].filter((x): x is number => x !== null).reduce((x, y) => x + y, 0)) / [p.academicPct, p.behavioralPct].filter((x) => x !== null).length) * 10) / 10,
        })),
        { title: "تطور المعدل العام (الأقدم على اليمين)" },
      );
    }
  }

  if (o.analysis) {
    pdf.h2("التوجيه النمائي والملاحظات");
    pdf.note("ملاحظات إرشادية مستندة إلى الملاحظة المستمرة في القسم لمرافقة نمو الطفل(ة).");
    pdf.text("نقاط القوة والاستقلالية", { bold: true, size: 10 });
    pdf.bullets(a.strengths.length ? a.strengths.map((s) => `${s.skillName} (${s.subjectName})`) : ["ملاحظات قيد التدوين."]);
    pdf.text("مهارات في طور النمو والتشجيع", { bold: true, size: 10 });
    const sup = [...a.notAcquired, ...a.needsSupport];
    pdf.bullets(sup.length ? sup.map((s) => `${s.skillName} (${s.subjectName}) — ${s.levelLabel}`) : ["الطفل يظهر نمواً متوازناً في كافة المجالات."]);
    pdf.text("ملخص وتوجيهات للأسرة", { bold: true, size: 10 });
    pdf.para(d.aiText?.parentSummary || a.parentSummary);
  }

  if (o.remedial) {
    pdf.h2("الأنشطة والألعاب المقترحة للتحفيز");
    const acts = d.aiText?.activities?.length ? d.aiText.activities : a.remedial.map((r) => r.activity);
    const goals = d.aiText?.goals?.length ? d.aiText.goals : a.goals;
    if (goals.length) {
      pdf.text("أهداف المحطة القادمة", { bold: true, size: 10 });
      pdf.bullets(goals);
    }
    if (acts.length) {
      pdf.text("أنشطة وألعاب محفزة", { bold: true, size: 10 });
      pdf.bullets(acts);
    }
    if (!goals.length && !acts.length) pdf.para("مواصلة الأنشطة الاعتيادية واللعب الحر الهادف.");
    pdf.note(d.aiText?.source === "ai" ? "اقتراحات إرشادية مولَّدة بالذكاء الاصطناعي وتخضع لمراجعة المربية." : "اقتراحات تربوية نابعة من الملاحظات المسجلة وتخضع لتقدير المربية.");
  }

  if (o.signature) pdf.signatureBox(d.institution.signatureLabel || "توقيع المربية / المعلم(ة)");
}

export async function studentReportPdf(d: StudentReportData, options?: Partial<ReportOptions>): Promise<Uint8Array> {
  const o = opts(options);
  const pdf = await Pdf.create(o.mode, headerOf(d, d.periodName), `تقرير ${d.student.fullName}`, false);
  renderStudentReport(pdf, d, o);
  return pdf.finish();
}

/** All students as one PDF file, reports one after another. */
export async function mergedStudentsPdf(list: StudentReportData[], options?: Partial<ReportOptions>): Promise<Uint8Array> {
  const o = opts(options);
  if (!list.length) throw new Error("لا يوجد تلاميذ للتصدير");
  const pdf = await Pdf.create(o.mode, headerOf(list[0], list[0].periodName), "تقارير التلاميذ", false);
  for (const d of list) renderStudentReport(pdf, d, o);
  return pdf.finish();
}

/** One standalone PDF per student, generated from one shared document (fast: fonts parsed once). */
export async function splitStudentsPdfs(list: StudentReportData[], options?: Partial<ReportOptions>): Promise<Uint8Array[]> {
  const o = opts(options);
  if (!list.length) return [];
  const pdf = await Pdf.create(o.mode, headerOf(list[0], list[0].periodName), "تقارير التلاميذ", false);
  for (const d of list) renderStudentReport(pdf, d, o);
  const bytes = await pdf.finish();
  const src = await PDFDocument.load(bytes);
  const out: Uint8Array[] = [];
  for (const sec of pdf.sections) {
    const doc = await PDFDocument.create();
    const idx = Array.from({ length: sec.end - sec.start }, (_, i) => sec.start + i);
    const pages = await doc.copyPages(src, idx);
    pages.forEach((p) => doc.addPage(p));
    out.push(await doc.save());
  }
  return out;
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(f);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

export async function classReportPdf(d: ClassReportData, options?: Partial<ReportOptions>): Promise<Uint8Array> {
  const o = opts(options);
  const c = analyzeClass(d);
  const pdf = await Pdf.create(o.mode, headerOf(d, d.periodName), `تقرير القسم ${d.className}`);
  pdf.title("تقرير القسم", `${d.className}${d.level ? " — " + d.level : ""} — الفترة: ${d.periodName || "—"}`);

  pdf.h2("إحصائيات القسم");
  pdf.kv([
    ["عدد التلاميذ", String(d.students.length)],
    ["التلاميذ المقيَّمون", String(d.students.filter((s) => s.overallPct !== null).length)],
    ["المعدل العام للقسم", c.avgOverall === null ? "—" : `${c.avgOverall}%`],
    ["مجموعة الدعم / المتقدمون", `${c.supportGroup.length} / ${c.advancedGroup.length}`],
  ]);

  pdf.h2("توزيع مستويات الاكتساب");
  const totalEv = Object.values(c.distribution).reduce((a, b) => a + b, 0);
  pdf.table(
    ["المستوى", "عدد التقييمات", "النسبة"],
    d.levels.map((l) => [{ text: l.label, color: l.color, bold: true }, String(c.distribution[l.key] ?? 0), totalEv ? `${Math.round(((c.distribution[l.key] ?? 0) / totalEv) * 1000) / 10}%` : "—"]),
    [3, 2, 2],
  );

  pdf.h2("قائمة التلاميذ ونتائجهم");
  pdf.table(
    ["#", "الاسم الكامل", "الجنس", "أكاديمي", "سلوكي", "العام", "عدد المهارات"],
    d.students.map((s, i) => [
      String(i + 1),
      s.fullName,
      GENDER[s.gender ?? ""] ?? "—",
      s.academicPct === null ? "—" : `${s.academicPct}%`,
      s.behavioralPct === null ? "—" : `${s.behavioralPct}%`,
      { text: s.overallPct === null ? "—" : `${s.overallPct}%`, bold: true },
      String(s.evaluated),
    ]),
    [0.7, 4, 1.2, 1.4, 1.4, 1.4, 1.5],
  );

  if (d.skills.length) {
    pdf.h2("متوسط الاكتساب حسب المهارة");
    pdf.table(
      ["المادة / المجال", "المهارة", "متوسط الاكتساب", "عدد التقييمات"],
      [...d.skills].sort((a, b) => a.avgPercent - b.avgPercent).map((s) => [s.subjectName, s.skillName, `${s.avgPercent}%`, String(s.total)]),
      [2.5, 4, 1.6, 1.5],
    );
  }

  pdf.h2("المهارات الأكثر صعوبة");
  pdf.bullets(c.hardest.length ? c.hardest.map((s) => `${s.skillName} (${s.subjectName}) — ${s.avgPercent}%`) : ["لا توجد مهارات دون عتبة التميز."]);
  pdf.h2("المهارات الأكثر إتقانًا");
  pdf.bullets(c.best.length ? c.best.map((s) => `${s.skillName} (${s.subjectName}) — ${s.avgPercent}%`) : ["لا توجد مهارات بلغت عتبة التميز بعد."]);

  pdf.h2("نقاط تحتاج إلى معالجة جماعية");
  pdf.note("اقتراحات مولَّدة من النتائج المسجلة وتخضع لتقدير المعلم.");
  pdf.bullets(c.collectiveActivities.length ? c.collectiveActivities : ["لا توجد نقاط معالجة جماعية حسب النتائج الحالية."]);
  if (c.supportGroup.length) {
    pdf.text("مجموعة الدعم المقترحة", { bold: true });
    pdf.para(c.supportGroup.join("، "));
  }
  if (c.advancedGroup.length) {
    pdf.text("مجموعة الإثراء المقترحة", { bold: true });
    pdf.para(c.advancedGroup.join("، "));
    pdf.bullets(c.enrichment);
  }
  if (o.signature) pdf.signatureBox("توقيع المعلم");
  return pdf.finish();
}
