import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = guarded(async (_req, u) => {
  const rows = await db.select().from(classes).where(eq(classes.institutionId, u.institutionId));
  const counts = await db.select({ classId: students.classId, n: count() }).from(students).where(and(eq(students.institutionId, u.institutionId), eq(students.active, true))).groupBy(students.classId);
  const m = new Map(counts.map((c) => [c.classId, c.n]));
  rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  return Response.json(rows.map((r) => ({ ...r, studentCount: m.get(r.id) ?? 0 })));
});

export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name) return bad("اسم القسم مطلوب");
  const [row] = await db.insert(classes).values({ institutionId: u.institutionId, name, level: String(b.level ?? ""), academicYear: String(b.academicYear ?? ""), teacherId: u.id }).returning();
  await audit(u, "create", "class", { name });
  return Response.json(row);
});

export const PATCH = guarded(async (req, u) => {
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!b.id || !name) return bad("بيانات ناقصة");
  const [row] = await db.update(classes).set({ name, level: String(b.level ?? "") }).where(and(eq(classes.id, b.id), eq(classes.institutionId, u.institutionId))).returning();
  await audit(u, "update", "class", { id: b.id });
  return Response.json(row);
});

export const DELETE = guarded(async (req, u) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("المعرف مطلوب");
  await db.update(students).set({ classId: null }).where(and(eq(students.classId, id), eq(students.institutionId, u.institutionId)));
  await db.delete(classes).where(and(eq(classes.id, id), eq(classes.institutionId, u.institutionId)));
  await audit(u, "delete", "class", { id });
  return Response.json({ ok: true });
}, { admin: true });
