import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, importJobs, importMappings, students } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { normalizeRows } from "@/lib/import";

export const dynamic = "force-dynamic";

type InRow = { data: Record<string, unknown>; action: "add" | "update" | "skip"; targetId?: string; line?: number };

export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const rows = (b.rows ?? []) as InRow[];
  if (!rows.length) return bad("لا توجد سجلات للاعتماد");
  if (rows.length > 5000) return bad("عدد السجلات كبير");
  const kind = b.kind === "digitization" ? "digitization" : "students";
  const clsRows = await db.select().from(classes).where(eq(classes.institutionId, u.institutionId));
  const classByName = new Map(clsRows.map((c) => [c.name.trim(), c.id]));
  const report = { imported: [] as string[], updated: [] as string[], skipped: [] as string[], rejected: [] as { line: number; name: string; reason: string }[], warnings: [] as string[], classesCreated: [] as string[] };
  let imported = 0, updated = 0, skipped = 0, rejected = 0;

  await db.transaction(async (tx) => {
    for (const r of rows) {
      const line = (r.line ?? 0) + 1;
      if (r.action === "skip") {
        skipped++;
        report.skipped.push(String(r.data.fullName ?? ""));
        continue;
      }
      const keys = ["fullName", "birthDate", "gender", "level", "className", "nationalId", "notes"];
      const [n] = normalizeRows({ headers: keys, rows: [keys.map((k) => String(r.data[k] ?? ""))] }, Object.fromEntries(keys.map((k) => [k, k])));
      if (n.errors.length) {
        rejected++;
        report.rejected.push({ line, name: String(r.data.fullName ?? ""), reason: n.errors.join("، ") });
        continue;
      }
      let classId: string | null = (b.defaultClassId as string) || null;
      const cn = n.data.className.trim();
      if (cn) {
        let id = classByName.get(cn);
        if (!id) {
          const [c] = await tx.insert(classes).values({ institutionId: u.institutionId, name: cn, level: n.data.level, teacherId: u.id }).returning();
          id = c.id;
          classByName.set(cn, id);
          report.classesCreated.push(cn);
        }
        classId = id;
      }
      const extra = (r.data.extra && typeof r.data.extra === "object" ? r.data.extra : {}) as Record<string, unknown>;
      if (r.action === "update" && r.targetId) {
        const [cur] = await tx.select().from(students).where(and(eq(students.id, r.targetId), eq(students.institutionId, u.institutionId)));
        if (!cur) {
          rejected++;
          report.rejected.push({ line, name: n.data.fullName, reason: "التلميذ المراد تحديثه غير موجود" });
          continue;
        }
        await tx
          .update(students)
          .set({
            birthDate: n.data.birthDate ?? cur.birthDate,
            gender: n.data.gender ?? cur.gender,
            nationalId: cur.nationalId ?? (n.data.nationalId || null),
            classId: classId ?? cur.classId,
            notes: n.data.notes || cur.notes,
            extra: { ...cur.extra, ...extra },
          })
          .where(eq(students.id, cur.id));
        updated++;
        report.updated.push(cur.fullName);
        continue;
      }
      let nid: string | null = n.data.nationalId || null;
      if (nid) {
        const [clash] = await tx.select({ id: students.id }).from(students).where(and(eq(students.institutionId, u.institutionId), eq(students.nationalId, nid)));
        if (clash) {
          report.warnings.push(`«${n.data.fullName}»: رقم التعريف ${nid} مستعمل، أُضيف السجل بدون رقم تعريف.`);
          extra.duplicatedNationalId = nid;
          nid = null;
        }
      }
      await tx.insert(students).values({ institutionId: u.institutionId, classId, fullName: n.data.fullName, birthDate: n.data.birthDate, gender: n.data.gender, nationalId: nid, notes: n.data.notes, extra });
      imported++;
      report.imported.push(n.data.fullName);
    }
    if (b.saveMappingName && b.mapping) await tx.insert(importMappings).values({ institutionId: u.institutionId, name: String(b.saveMappingName), mapping: b.mapping });
    await tx.insert(importJobs).values({ institutionId: u.institutionId, kind, filename: String(b.filename ?? ""), total: rows.length, imported, updated, skipped, rejected, report, createdBy: u.id });
  });
  await audit(u, "import", "students", { imported, updated, skipped, rejected });
  return Response.json({ total: rows.length, imported, updated, skipped, rejected, report });
});
