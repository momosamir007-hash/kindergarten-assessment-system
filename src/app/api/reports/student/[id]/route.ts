import { bad, guarded, audit, type IdCtx } from "@/server/auth";
import { attachAi, fileResponse, logExport, optionsFrom } from "@/server/exports";
import { buildStudentsData } from "@/server/data";
import { studentReportPdf } from "@/lib/pdf/reports";
import { safeName, studentExcel, studentsCsv, studentsJson } from "@/lib/export/files";
import { sanitizePedagogicalNote } from "@/lib/pedagogical-sanitizer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET ?format=pdf|xlsx|csv|json &periodId= &inline=1 &options=<urlencoded JSON>
export const GET = guarded<IdCtx>(async (req, u, ctx) => {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "pdf";
  const periodId = sp.get("periodId") || null;
  let options = {};
  try {
    options = JSON.parse(sp.get("options") ?? "{}");
  } catch {}
  const list = await attachAi(u.institutionId, await buildStudentsData(u.institutionId, [id], periodId), periodId);
  const d = list[0];
  if (!d) return bad("التلميذ غير موجود", 404);
  const rawCustomNote = (options as { parentSummary?: string })?.parentSummary || sp.get("note");
  const customNote = sanitizePedagogicalNote(rawCustomNote);
  if (customNote) {
    d.aiText = { ...d.aiText, parentSummary: customNote, source: "ai" };
  }
  const base = `تقرير_${safeName(d.student.fullName)}`;
  let bytes: Uint8Array;
  if (format === "pdf") bytes = await studentReportPdf(d, optionsFrom(options));
  else if (format === "xlsx") bytes = await studentExcel(d);
  else if (format === "csv") bytes = studentsCsv([d]);
  else if (format === "json") bytes = studentsJson([d]);
  else return bad("صيغة غير مدعومة");
  const inline = sp.get("inline") === "1";
  if (!inline) {
    await logExport(u, { kind: "student", format, scope: d.student.fullName, count: 1, filename: `${base}.${format}`, size: bytes.length });
    await audit(u, "export", "student", { id, format });
  }
  return fileResponse(bytes, `${base}.${format}`, format, inline);
});
