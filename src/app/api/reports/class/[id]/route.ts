import { bad, guarded, audit, type IdCtx } from "@/server/auth";
import { fileResponse, logExport, optionsFrom } from "@/server/exports";
import { buildClassData } from "@/server/data";
import { classReportPdf } from "@/lib/pdf/reports";
import { safeName, studentsCsv, studentsExcel, studentsJson } from "@/lib/export/files";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = guarded<IdCtx>(async (req, u, ctx) => {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "pdf";
  const periodId = sp.get("periodId") || null;
  let options = {};
  try {
    options = JSON.parse(sp.get("options") ?? "{}");
  } catch {}
  const res = await buildClassData(u.institutionId, id, periodId);
  if (!res) return bad("القسم غير موجود", 404);
  const base = `تقرير_القسم_${safeName(res.data.className)}`;
  let bytes: Uint8Array;
  if (format === "pdf") bytes = await classReportPdf(res.data, optionsFrom(options));
  else if (format === "xlsx") bytes = await studentsExcel(res.students, res.data);
  else if (format === "csv") bytes = studentsCsv(res.students);
  else if (format === "json") bytes = studentsJson(res.students);
  else return bad("صيغة غير مدعومة");
  const inline = sp.get("inline") === "1";
  if (!inline) {
    await logExport(u, { kind: "class", format, scope: res.data.className, count: res.students.length, filename: `${base}.${format}`, size: bytes.length });
    await audit(u, "export", "class", { id, format });
  }
  return fileResponse(bytes, `${base}.${format}`, format, inline);
});
