import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aiAnalyses, classes, evaluations, importMappings, institutions, periods, skills, students, subjects, users } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { fileResponse, logExport } from "@/server/exports";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REVIVE_DATES = ["createdAt", "evaluatedAt"];
function revive<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const k of REVIVE_DATES) if (typeof o[k] === "string") o[k] = new Date(o[k] as string);
    return o as T;
  });
}

// Full backup (JSON). Password hashes are NOT included.
export const GET = guarded(async (_req, u) => {
  const id = u.institutionId;
  const [inst] = await db.select().from(institutions).where(eq(institutions.id, id));
  const subs = await db.select().from(subjects).where(eq(subjects.institutionId, id));
  const data = {
    format: "taqyim-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    institution: inst,
    users: (await db.select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role }).from(users).where(eq(users.institutionId, id))),
    classes: await db.select().from(classes).where(eq(classes.institutionId, id)),
    students: await db.select().from(students).where(eq(students.institutionId, id)),
    subjects: subs,
    skills: subs.length ? await db.select().from(skills).where(inArray(skills.subjectId, subs.map((s) => s.id))) : [],
    periods: await db.select().from(periods).where(eq(periods.institutionId, id)),
    evaluations: await db.select().from(evaluations).where(eq(evaluations.institutionId, id)),
    aiAnalyses: await db.select().from(aiAnalyses).where(eq(aiAnalyses.institutionId, id)),
    importMappings: await db.select().from(importMappings).where(eq(importMappings.institutionId, id)),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const name = `نسخة_احتياطية_${new Date().toISOString().slice(0, 10)}.json`;
  await logExport(u, { kind: "backup", format: "json", scope: "كامل", count: data.students.length, filename: name, size: bytes.length });
  await audit(u, "backup", "institution", { students: data.students.length, evaluations: data.evaluations.length });
  return fileResponse(bytes, name, "json");
});

// Restore: replaces institution data (students, evaluations, curriculum, periods, classes) from a backup file.
export const POST = guarded(async (req, u) => {
  const b = await req.json();
  if (b?.format !== "taqyim-backup" || !Array.isArray(b.students)) return bad("الملف ليس نسخة احتياطية صالحة");
  const id = u.institutionId;
  const userIds = new Set((await db.select({ id: users.id }).from(users).where(eq(users.institutionId, id))).map((x) => x.id));
  const fixUser = <T extends Record<string, unknown>>(rows: T[], key: string) => rows.map((r) => ({ ...r, [key]: r[key] && userIds.has(r[key] as string) ? r[key] : null }));
  const chunks = async <T extends Record<string, unknown>>(rows: T[], insert: (c: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 500) await insert(rows.slice(i, i + 500));
  };
  await db.transaction(async (tx) => {
    // wipe (cascades remove evaluations/skills)
    await tx.delete(aiAnalyses).where(eq(aiAnalyses.institutionId, id));
    await tx.delete(importMappings).where(eq(importMappings.institutionId, id));
    await tx.delete(students).where(eq(students.institutionId, id));
    await tx.delete(classes).where(eq(classes.institutionId, id));
    await tx.delete(subjects).where(eq(subjects.institutionId, id));
    await tx.delete(periods).where(eq(periods.institutionId, id));
    const own = <T extends Record<string, unknown>>(rows: T[]) => rows.map((r) => ({ ...r, institutionId: id }));
    await chunks(fixUser(own(revive(b.classes ?? [])), "teacherId") as (typeof classes.$inferInsert)[], (c) => tx.insert(classes).values(c));
    await chunks(own(revive(b.students)) as (typeof students.$inferInsert)[], (c) => tx.insert(students).values(c));
    await chunks(own(b.subjects ?? []) as (typeof subjects.$inferInsert)[], (c) => tx.insert(subjects).values(c));
    await chunks((b.skills ?? []) as (typeof skills.$inferInsert)[], (c) => tx.insert(skills).values(c));
    await chunks(own(b.periods ?? []) as (typeof periods.$inferInsert)[], (c) => tx.insert(periods).values(c));
    await chunks(fixUser(own(revive(b.evaluations ?? [])), "evaluatedBy") as (typeof evaluations.$inferInsert)[], (c) => tx.insert(evaluations).values(c));
    await chunks(fixUser(own(revive(b.aiAnalyses ?? [])), "createdBy") as (typeof aiAnalyses.$inferInsert)[], (c) => tx.insert(aiAnalyses).values(c));
    await chunks(own(revive(b.importMappings ?? [])) as (typeof importMappings.$inferInsert)[], (c) => tx.insert(importMappings).values(c));
    if (b.institution?.settings) await tx.update(institutions).set({ settings: b.institution.settings, name: b.institution.name ?? undefined, academicYear: b.institution.academicYear ?? undefined, city: b.institution.city ?? undefined, logo: b.institution.logo ?? null }).where(eq(institutions.id, id));
  });
  await audit(u, "restore", "institution", { students: b.students.length, evaluations: (b.evaluations ?? []).length });
  return Response.json({ ok: true, students: b.students.length, evaluations: (b.evaluations ?? []).length });
}, { admin: true });
