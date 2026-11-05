import fs from "node:fs";
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { classReportPdf, mergedStudentsPdf, studentReportPdf } from "../src/lib/pdf/reports";
import { studentsCsv, studentsExcel, studentsJson, studentsZip } from "../src/lib/export/files";
import { makeClass, makeStudent } from "./fixtures";

const OUT = "/tmp/taqyim-out";
fs.mkdirSync(OUT, { recursive: true });

const isPdf = (b: Uint8Array) => Buffer.from(b.slice(0, 5)).toString() === "%PDF-";

describe("PDF export", () => {
  it("creates a valid, non-empty PDF per student (long Arabic names)", async () => {
    const d = makeStudent(1, { longName: true });
    const pdf = await studentReportPdf(d);
    expect(isPdf(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(5000);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    fs.writeFileSync(`${OUT}/student.pdf`, pdf);
  });

  it("supports eco and black/white modes", async () => {
    for (const mode of ["bw", "eco"] as const) {
      const pdf = await studentReportPdf(makeStudent(2), { mode });
      expect(isPdf(pdf)).toBe(true);
      fs.writeFileSync(`${OUT}/student-${mode}.pdf`, pdf);
    }
  });

  it("respects content options", async () => {
    const full = await studentReportPdf(makeStudent(3));
    const minimal = await studentReportPdf(makeStudent(3), { analysis: false, remedial: false, charts: false, progress: false, signature: false });
    expect(minimal.length).toBeLessThan(full.length);
  });

  it("creates a class PDF", async () => {
    const { cls } = makeClass(30);
    const pdf = await classReportPdf(cls);
    expect(isPdf(pdf)).toBe(true);
    fs.writeFileSync(`${OUT}/class.pdf`, pdf);
  });

  it("handles a student without evaluations", async () => {
    const d = makeStudent(4);
    d.results = [];
    d.progress = [];
    expect(isPdf(await studentReportPdf(d))).toBe(true);
  });

  for (const n of [30, 50, 100]) {
    it(`bulk exports for a class of ${n}`, { timeout: 180_000 }, async () => {
      const { students, cls } = makeClass(n);
      // merged PDF: one section per student, pages never lost
      const merged = await mergedStudentsPdf(students);
      const mdoc = await PDFDocument.load(merged);
      const single = await PDFDocument.load(await studentReportPdf(students[0]));
      expect(mdoc.getPageCount()).toBeGreaterThanOrEqual(n * single.getPageCount());
      // ZIP: one non-empty openable PDF per student, no duplicates
      const zipBytes = await studentsZip(students);
      const zip = await JSZip.loadAsync(zipBytes);
      const names = Object.keys(zip.files);
      expect(names.length).toBe(n);
      expect(new Set(names).size).toBe(n);
      for (const nm of names.slice(0, 5)) {
        const b = await zip.files[nm].async("uint8array");
        expect(isPdf(b)).toBe(true);
        expect(b.length).toBeGreaterThan(3000);
      }
      // Excel
      const xl = await studentsExcel(students, cls);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(Buffer.from(xl) as unknown as ArrayBuffer);
      expect(wb.getWorksheet("ملخص")!.rowCount).toBe(n + 1);
      expect(wb.getWorksheet("التقييمات")!.rowCount).toBe(n * students[0].results.length + 1);
      // CSV and JSON keep all data
      const csv = new TextDecoder().decode(studentsCsv(students));
      expect(csv.split("\r\n").length).toBe(n * students[0].results.length + 1);
      const json = JSON.parse(new TextDecoder().decode(studentsJson(students)));
      expect(json.count).toBe(n);
      expect(json.students[0].student.fullName).toBe(students[0].student.fullName);
    });
  }
});
