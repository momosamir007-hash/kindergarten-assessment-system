import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { attachAi, fileResponse, logExport, optionsFrom } from "@/server/exports";
import { buildClassData } from "@/server/data";
import { mergedStudentsPdf } from "@/lib/pdf/reports";
import { safeName, studentsCsv, studentsExcel, studentsJson, studentsZip } from "@/lib/export/files";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST {classId, studentIds?: string[] (omit = whole class), periodId, format: zip|merged|xlsx|csv|json, options}
 */
export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const format = String(b.format ?? "zip");
  const periodId: string | null = b.periodId || null;
  if (!b.classId) return bad("اختر القسم");
  const [cls] = await db.select().from(classes).where(and(eq(classes.id, b.classId), eq(classes.institutionId, u.institutionId)));
  if (!cls) return bad("القسم غير موجود", 404);
  let ids: string[] | undefined;
  if (Array.isArray(b.studentIds) && b.studentIds.length) {
    const ok = await db.select({ id: students.id }).from(students).where(and(eq(students.classId, b.classId), eq(students.institutionId, u.institutionId)));
    const set = new Set(ok.map((r) => r.id));
    ids = (b.studentIds as string[]).filter((i) => set.has(i));
    if (!ids.length) return bad("التلاميذ المحددون غير موجودين في هذا القسم");
  }
  const res = await buildClassData(u.institutionId, b.classId, periodId, ids);
  if (!res || !res.students.length) return bad("لا يوجد تلاميذ للتصدير");
  const list = await attachAi(u.institutionId, res.students, periodId);
  const opts = optionsFrom(b.options);
  const base = safeName(`${cls.name}_${res.data.periodName || "تقارير"}`);
  let bytes: Uint8Array;
  let ext: string;
  let name: string;
  switch (format) {
    case "zip":
      bytes = await studentsZip(list, opts);
      ext = "zip";
      name = `تقارير_${base}.zip`;
      break;
    case "merged":
      bytes = await mergedStudentsPdf(list, opts);
      ext = "pdf";
      name = `تقارير_${base}.pdf`;
      break;
    case "xlsx":
      bytes = await studentsExcel(list, res.data);
      ext = "xlsx";
      name = `نتائج_${base}.xlsx`;
      break;
    case "csv":
      bytes = studentsCsv(list);
      ext = "csv";
      name = `بيانات_${base}.csv`;
      break;
    case "json":
      bytes = studentsJson(list);
      ext = "json";
      name = `بيانات_${base}.json`;
      break;
    default:
      return bad("صيغة غير مدعومة");
  }
  await logExport(u, { kind: "bulk", format: format === "merged" ? "pdf (واحد)" : format, scope: cls.name, count: list.length, filename: name, size: bytes.length });
  await audit(u, "export", "bulk", { classId: b.classId, format, count: list.length });
  return fileResponse(bytes, name, ext);
});
