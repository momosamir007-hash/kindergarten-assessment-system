import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit, bad, guarded, hashPassword } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = guarded(async (_req, u) => {
  const rows = await db.select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role, active: users.active }).from(users).where(eq(users.institutionId, u.institutionId));
  return Response.json(rows);
});

export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const username = String(b.username ?? "").trim().toLowerCase();
  if (username.length < 3 || String(b.password ?? "").length < 6 || !String(b.fullName ?? "").trim()) return bad("بيانات المستخدم غير مكتملة (كلمة المرور 6 أحرف على الأقل)");
  try {
    const [r] = await db.insert(users).values({ institutionId: u.institutionId, username, fullName: String(b.fullName).trim(), passwordHash: hashPassword(String(b.password)), role: b.role === "admin" ? "admin" : "teacher" }).returning({ id: users.id });
    await audit(u, "create", "user", { username });
    return Response.json(r);
  } catch {
    return bad("اسم المستخدم مستعمل", 409);
  }
}, { admin: true });

export const PATCH = guarded(async (req, u) => {
  const b = await req.json();
  if (!b.id) return bad("المعرف مطلوب");
  const set: Partial<typeof users.$inferInsert> = {};
  if (typeof b.active === "boolean" && b.id !== u.id) set.active = b.active;
  if (b.role && b.id !== u.id) set.role = b.role === "admin" ? "admin" : "teacher";
  if (b.password) {
    if (String(b.password).length < 6) return bad("كلمة المرور قصيرة");
    set.passwordHash = hashPassword(String(b.password));
  }
  if (Object.keys(set).length) await db.update(users).set(set).where(and(eq(users.id, b.id), eq(users.institutionId, u.institutionId)));
  await audit(u, "update", "user", { id: b.id });
  return Response.json({ ok: true });
}, { admin: true });
