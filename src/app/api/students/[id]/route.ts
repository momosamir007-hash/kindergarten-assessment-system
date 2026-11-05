import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";
import { audit, bad, guarded, type IdCtx } from "@/server/auth";
import { normalizeRows } from "@/lib/import";

export const dynamic = "force-dynamic";

export const GET = guarded<IdCtx>(async (_req, u, ctx) => {
  const { id } = await ctx.params;
  const [row] = await db
    .select({ s: students, className: classes.name, level: classes.level })
    .from(students)
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(and(eq(students.id, id), eq(students.institutionId, u.institutionId)));
  if (!row) return bad("التلميذ غير موجود", 404);
  return Response.json({ ...row.s, className: row.className ?? "", level: row.level ?? "" });
});

export const PATCH = guarded<IdCtx>(async (req, u, ctx) => {
  const { id } = await ctx.params;
  const b = await req.json();
  const set: Partial<typeof students.$inferInsert> = {};
  if ("fullName" in b || "birthDate" in b || "gender" in b || "nationalId" in b) {
    const [cur] = await db.select().from(students).where(and(eq(students.id, id), eq(students.institutionId, u.institutionId)));
    if (!cur) return bad("التلميذ غير موجود", 404);
    const [n] = normalizeRows(
      { headers: ["a", "b", "c", "d"], rows: [[b.fullName ?? cur.fullName, b.birthDate ?? cur.birthDate ?? "", b.gender ?? cur.gender ?? "", b.nationalId ?? cur.nationalId ?? ""]] },
      { a: "fullName", b: "birthDate", c: "gender", d: "nationalId" },
    );
    if (n.errors.length) return bad(n.errors.join("، "));
    set.fullName = n.data.fullName;
    set.birthDate = n.data.birthDate;
    set.gender = n.data.gender;
    set.nationalId = n.data.nationalId || null;
  }
  if ("classId" in b) set.classId = b.classId || null;
  if ("notes" in b) set.notes = String(b.notes ?? "");
  if ("active" in b) set.active = !!b.active;
  if ("extra" in b && b.extra && typeof b.extra === "object") set.extra = b.extra;
  if (!Object.keys(set).length) return bad("لا توجد تغييرات");
  try {
    const [row] = await db.update(students).set(set).where(and(eq(students.id, id), eq(students.institutionId, u.institutionId))).returning();
    await audit(u, "update", "student", { id });
    return Response.json(row);
  } catch {
    return bad("رقم التعريف مستعمل لتلميذ آخر", 409);
  }
});

export const DELETE = guarded<IdCtx>(async (_req, u, ctx) => {
  const { id } = await ctx.params;
  await db.delete(students).where(and(eq(students.id, id), eq(students.institutionId, u.institutionId)));
  await audit(u, "delete", "student", { id });
  return Response.json({ ok: true });
});
