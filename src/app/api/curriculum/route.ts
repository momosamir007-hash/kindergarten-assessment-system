import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { skills, subjects } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = guarded(async (_req, u) => {
  const subs = await db.select().from(subjects).where(eq(subjects.institutionId, u.institutionId));
  const sk = subs.length ? await db.select().from(skills).where(inArray(skills.subjectId, subs.map((s) => s.id))) : [];
  subs.sort((a, b) => a.sortOrder - b.sortOrder);
  return Response.json(subs.map((s) => ({ ...s, skills: sk.filter((k) => k.subjectId === s.id).sort((a, b) => a.sortOrder - b.sortOrder) })));
});

// POST {type:'subject', name, kind} | {type:'skill', subjectId, name}
export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name) return bad("الاسم مطلوب");
  if (b.type === "subject") {
    const [r] = await db.insert(subjects).values({ institutionId: u.institutionId, name, kind: b.kind === "behavioral" ? "behavioral" : "academic", sortOrder: 1000 }).returning();
    await audit(u, "create", "subject", { name });
    return Response.json(r);
  }
  const [sub] = await db.select().from(subjects).where(and(eq(subjects.id, b.subjectId), eq(subjects.institutionId, u.institutionId)));
  if (!sub) return bad("المادة غير موجودة", 404);
  const [r] = await db.insert(skills).values({ subjectId: sub.id, name, sortOrder: 1000 }).returning();
  await audit(u, "create", "skill", { name });
  return Response.json(r);
}, { admin: true });

export const PATCH = guarded(async (req, u) => {
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name || !b.id) return bad("بيانات ناقصة");
  if (b.type === "subject") await db.update(subjects).set({ name }).where(and(eq(subjects.id, b.id), eq(subjects.institutionId, u.institutionId)));
  else {
    const [sk] = await db.select({ id: skills.id }).from(skills).innerJoin(subjects, eq(subjects.id, skills.subjectId)).where(and(eq(skills.id, b.id), eq(subjects.institutionId, u.institutionId)));
    if (sk) await db.update(skills).set({ name }).where(eq(skills.id, b.id));
  }
  return Response.json({ ok: true });
}, { admin: true });

export const DELETE = guarded(async (req, u) => {
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  if (!id) return bad("المعرف مطلوب");
  if (sp.get("type") === "subject") await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.institutionId, u.institutionId)));
  else {
    const [sk] = await db.select({ id: skills.id }).from(skills).innerJoin(subjects, eq(subjects.id, skills.subjectId)).where(and(eq(skills.id, id), eq(subjects.institutionId, u.institutionId)));
    if (sk) await db.delete(skills).where(eq(skills.id, id));
  }
  await audit(u, "delete", sp.get("type") ?? "skill", { id });
  return Response.json({ ok: true });
}, { admin: true });
