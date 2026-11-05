import ExcelJS from "exceljs";
import JSZip from "jszip";
import { analyzeStudent } from "../analysis";
import type { ClassReportData, StudentReportData } from "../report-types";
import { splitStudentsPdfs } from "../pdf/reports";
import type { ReportOptions } from "../levels";

export function safeName(s: string): string {
  return (
    s
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 80) || "ملف"
  );
}

/** Content-Disposition header supporting Arabic filenames. */
export function disposition(filename: string, inline = false): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const GENDER: Record<string, string> = { M: "ذكر", F: "أنثى" };

export function resultRows(d: StudentReportData) {
  return d.results.map((r) => ({
    student: d.student.fullName,
    studentId: d.student.id,
    nationalId: d.student.nationalId ?? "",
    className: d.student.className,
    period: d.periodName,
    kind: r.kind === "academic" ? "أكاديمي" : "سلوكي",
    subject: r.subjectName,
    skill: r.skillName,
    level: r.levelLabel,
    percent: r.percent,
    note: r.note,
    date: r.evaluatedAt.slice(0, 10),
    teacher: r.teacher,
  }));
}

const HEAD = ["التلميذ", "رقم التعريف", "القسم", "الفترة", "النوع", "المادة / المجال", "المهارة", "المستوى", "النسبة %", "ملاحظة", "التاريخ", "المعلم"];

function styleSheet(ws: ExcelJS.Worksheet) {
  ws.views = [{ rightToLeft: true, state: "frozen", ySplit: 1 }];
  const hr = ws.getRow(1);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C81" } };
  hr.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.columns.forEach((c) => {
    let max = 10;
    c.eachCell?.({ includeEmpty: false }, (cell) => {
      const l = String(cell.value ?? "").length;
      if (l > max) max = l;
    });
    c.width = Math.min(max + 2, 50);
  });
}

async function wbBytes(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

export async function studentExcel(d: StudentReportData): Promise<Uint8Array> {
  return studentsExcel([d]);
}

/** Excel for one or many students (class workbook). */
export async function studentsExcel(list: StudentReportData[], classData?: ClassReportData): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "تقييم تربوي";
  const sum = wb.addWorksheet("ملخص");
  sum.addRow(["التلميذ", "رقم التعريف", "القسم", "الفترة", "الجنس", "المعدل الأكاديمي %", "المعدل السلوكي %", "المعدل العام %", "عدد المهارات"]);
  for (const d of list) {
    const a = analyzeStudent(d);
    sum.addRow([d.student.fullName, d.student.nationalId ?? "", d.student.className, d.periodName, GENDER[d.student.gender ?? ""] ?? "", a.academicPct ?? "", a.behavioralPct ?? "", a.overallPct ?? "", d.results.length]);
  }
  styleSheet(sum);

  const det = wb.addWorksheet("التقييمات");
  det.addRow(HEAD);
  for (const d of list)
    for (const r of resultRows(d)) det.addRow([r.student, r.nationalId, r.className, r.period, r.kind, r.subject, r.skill, r.level, r.percent, r.note, r.date, r.teacher]);
  styleSheet(det);

  // Matrix: students x skills
  const skillKeys: string[] = [];
  for (const d of list) for (const r of d.results) { const k = `${r.subjectName} / ${r.skillName}`; if (!skillKeys.includes(k)) skillKeys.push(k); }
  if (skillKeys.length) {
    const mx = wb.addWorksheet("مصفوفة النتائج");
    mx.addRow(["التلميذ", ...skillKeys]);
    for (const d of list) {
      const m = new Map(d.results.map((r) => [`${r.subjectName} / ${r.skillName}`, r.levelLabel]));
      mx.addRow([d.student.fullName, ...skillKeys.map((k) => m.get(k) ?? "")]);
    }
    styleSheet(mx);
  }

  if (classData) {
    const sk = wb.addWorksheet("المهارات");
    sk.addRow(["المادة / المجال", "المهارة", "متوسط الاكتساب %", "عدد التقييمات", ...classData.levels.map((l) => l.label)]);
    for (const s of classData.skills) sk.addRow([s.subjectName, s.skillName, s.avgPercent, s.total, ...classData.levels.map((l) => s.counts[l.key] ?? 0)]);
    styleSheet(sk);
  }
  return wbBytes(wb);
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function studentsCsv(list: StudentReportData[]): Uint8Array {
  const lines = [HEAD.join(",")];
  for (const d of list)
    for (const r of resultRows(d)) lines.push([r.student, r.nationalId, r.className, r.period, r.kind, r.subject, r.skill, r.level, r.percent, r.note, r.date, r.teacher].map(csvCell).join(","));
  return new TextEncoder().encode("\uFEFF" + lines.join("\r\n"));
}

export function studentsJson(list: StudentReportData[]): Uint8Array {
  const payload = list.map((d) => ({ student: d.student, period: d.periodName, results: d.results, progress: d.progress }));
  return new TextEncoder().encode(JSON.stringify({ exportedAt: new Date().toISOString(), count: payload.length, students: payload }, null, 2));
}

export type ZipEntry = { name: string; data: Uint8Array };

export async function zipFiles(entries: ZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const e of entries) zip.file(e.name, e.data);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** One PDF per student, unique file names, inside a ZIP. */
export async function studentsZip(list: StudentReportData[], options?: Partial<ReportOptions>): Promise<Uint8Array> {
  const used = new Set<string>();
  const entries: ZipEntry[] = [];
  const pdfs = await splitStudentsPdfs(list, options);
  for (const [i, d] of list.entries()) {
    let base = safeName(d.student.fullName);
    if (used.has(base)) base = `${base}_${d.student.id.slice(0, 6)}`;
    used.add(base);
    entries.push({ name: `${base}.pdf`, data: pdfs[i] });
  }
  return zipFiles(entries);
}
