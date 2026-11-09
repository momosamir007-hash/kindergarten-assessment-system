import { analyzeClass, analyzeStudent } from "../analysis";
import { DEFAULT_REPORT_OPTIONS, type ReportOptions } from "../levels";
import type { ClassReportData, StudentReportData } from "../report-types";
import { Pdf, type Cell, type HeaderInfo } from "./doc";
import { PDFDocument, type PDFImage } from "pdf-lib";

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

/** Render one student's individual report into an existing Pdf (designed for 1 A4 page). */
export function renderStudentReport(
  pdf: Pdf,
  d: StudentReportData,
  o: ReportOptions,
  photoImg: PDFImage | null = null
) {
  const a = analyzeStudent(d);
  pdf.beginSection(headerOf(d, d.periodName), d.student.fullName);

  // Title
  pdf.title("التقرير الفردي لمكتسبات التلميذ", `الفترة: ${d.periodName || "التقييم المستمر"}`);

  // 1. Student Header Profile Card (with embedded photo)
  if (o.studentInfo) {
    pdf.drawStudentHeaderCard(
      {
        fullName: d.student.fullName,
        className: d.student.className,
        level: d.student.level,
        birthDate: d.student.birthDate,
        nationalId: d.student.nationalId,
      },
      photoImg
    );
  }

  // Calculate actual counts from real evaluations
  let acquired = 0;
  let inProgress = 0;
  let notAcquired = 0;
  for (const r of d.results) {
    if (r.levelKey === "acquired") acquired++;
    else if (r.levelKey === "in_progress") inProgress++;
    else notAcquired++;
  }

  // 2. Visual summary stat counters (3 boxes)
  pdf.drawSummaryCounters({ acquired, inProgress, notAcquired });

  // 3. Evaluation Symbols Legend (displayed once above the table)
  pdf.drawLegendBar();

  // 4. Competencies Evaluation Table (with circles only, NO repeated strings)
  const rows: Cell[][] = d.results.map((r) => [
    r.subjectName,
    r.skillName,
    { text: "", circle: r.levelKey },
  ]);

  const heads = ["المجال / المادة", "الكفاءة أو التعلم المستهدف", "التقييم"];
  const widths = [3, 6, 1.8];

  if (rows.length > 0) {
    pdf.table(heads, rows, widths, { size: 8, align: ["right", "right", "center"] });
  } else {
    pdf.para("لا توجد كفاءات أو ملاحظات مسجلة لهذا التلميذ في هذه الفترة.", { size: 9 });
  }

  // 5. Pedagogical Summary & Strengths
  if (o.analysis) {
    const strengths = d.results.filter((r) => r.levelKey === "acquired").slice(0, 3);
    const support = d.results.filter((r) => r.levelKey !== "acquired").slice(0, 3);

    const summaryPairs: [string, string][] = [];
    if (strengths.length) {
      summaryPairs.push(["أبرز خطوات الاكتساب", strengths.map((s) => s.skillName).join("، ")]);
    }
    if (support.length) {
      summaryPairs.push(["مجالات نرافقها بمحبة", support.map((s) => s.skillName).join("، ")]);
    }

    if (summaryPairs.length) {
      pdf.kv(summaryPairs);
    }

    const noteText = d.aiText?.parentSummary || a.parentSummary;

    pdf.text(`رسالة المربية والتوجيهات: ${noteText}`, {
      size: 7.5,
      bold: false,
      color: pdf.theme.muted,
    });
    pdf.gap(3);
  }

  if (o.remedial) {
    const acts = d.aiText?.activities?.length ? d.aiText.activities : a.remedial.map((r) => r.activity);
    if (acts.length) {
      pdf.text("أفكار أسرية داعمة في البيت: " + acts.slice(0, 2).join(" • "), { size: 7.5, color: pdf.theme.muted });
      pdf.gap(2);
    }
  }

  // 6. Signatures (Dual signatures: Teacher & Guardian)
  if (o.signature) {
    pdf.drawDualSignatures(d.institution.signatureLabel || "توقيع وملاحظة المربية / المعلم");
  }
}

export async function studentReportPdf(
  d: StudentReportData,
  options?: Partial<ReportOptions>
): Promise<Uint8Array> {
  const o = opts(options);
  const pdf = await Pdf.create(o.mode, headerOf(d, d.periodName), `تقرير ${d.student.fullName}`, false);
  const photoImg = await pdf.embedImage(d.student.photo);
  renderStudentReport(pdf, d, o, photoImg);
  return pdf.finish();
}

/** All students as one PDF file, reports one after another (each student on their own page). */
export async function mergedStudentsPdf(
  list: StudentReportData[],
  options?: Partial<ReportOptions>
): Promise<Uint8Array> {
  const o = opts(options);
  if (!list.length) throw new Error("لا يوجد تلاميذ للتصدير");
  const pdf = await Pdf.create(o.mode, headerOf(list[0], list[0].periodName), "تقارير التلاميذ", false);
  for (const d of list) {
    const photoImg = await pdf.embedImage(d.student.photo);
    renderStudentReport(pdf, d, o, photoImg);
  }
  return pdf.finish();
}

/** One standalone PDF per student, generated from one shared document. */
export async function splitStudentsPdfs(
  list: StudentReportData[],
  options?: Partial<ReportOptions>
): Promise<Uint8Array[]> {
  const o = opts(options);
  if (!list.length) return [];
  const pdf = await Pdf.create(o.mode, headerOf(list[0], list[0].periodName), "تقارير التلاميذ", false);
  for (const d of list) {
    const photoImg = await pdf.embedImage(d.student.photo);
    renderStudentReport(pdf, d, o, photoImg);
  }
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

/** Class summary report. */
export async function classReportPdf(d: ClassReportData, options?: Partial<ReportOptions>): Promise<Uint8Array> {
  const o = opts(options);
  const c = analyzeClass(d);
  const pdf = await Pdf.create(o.mode, headerOf(d, d.periodName), `تقرير قسم ${d.className}`);
  pdf.title(`تقرير متابعة الفوج / القسم: ${d.className}`, `المستوى: ${d.level || "—"} • الفترة: ${d.periodName || "—"}`);

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
    d.levels.map((l) => [
      { text: l.label, color: l.color, bold: true },
      String(c.distribution[l.key] ?? 0),
      totalEv ? `${Math.round(((c.distribution[l.key] ?? 0) / totalEv) * 1000) / 10}%` : "—",
    ]),
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

  if (o.signature) pdf.signatureBox(d.institution.signatureLabel || "توقيع المعلم");
  return pdf.finish();
}
