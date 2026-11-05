import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { periods } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = guarded(async (_req, u) => {
  const rows = await db.select().from(periods).where(eq(periods.institutionId, u.institutionId));
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  return Response.json(rows);
});

export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name) return bad("اسم الفترة مطلوب");
  const all = await db.select().from(periods).where(eq(periods.institutionId, u.institutionId));
  const [r] = await db.insert(periods).values({ institutionId: u.institutionId, name, startDate: b.startDate || null, endDate: b.endDate || null, sortOrder: all.length }).returning();
  await audit(u, "create", "period", { name });
  return Response.json(r);
}, { admin: true });

export const PATCH = guarded(async (req, u) => {
  const b = await req.json();
  if (!b.id) return bad("المعرف مطلوب");
  if (b.isCurrent) {
    await db.update(periods).set({ isCurrent: false }).where(eq(periods.institutionId, u.institutionId));
    await db.update(periods).set({ isCurrent: true }).where(and(eq(periods.id, b.id), eq(periods.institutionId, u.institutionId)));
  }
  if (b.name) await db.update(periods).set({ name: String(b.name) }).where(and(eq(periods.id, b.id), eq(periods.institutionId, u.institutionId)));
  return Response.json({ ok: true });
}, { admin: true });

export const DELETE = guarded(async (req, u) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("المعرف مطلوب");
  await db.delete(periods).where(and(eq(periods.id, id), eq(periods.institutionId, u.institutionId)));
  await audit(u, "delete", "period", { id });
  return Response.json({ ok: true });
}, { admin: true });
