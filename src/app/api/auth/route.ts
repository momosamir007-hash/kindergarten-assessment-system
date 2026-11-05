import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, institutions, users } from "@/db/schema";
import { audit, bad, currentUser, endSession, hashPassword, startSession, verifyPassword } from "@/server/auth";
import { seedCurriculum } from "@/server/data";
import { DEFAULT_SETTINGS } from "@/lib/levels";

export const dynamic = "force-dynamic";

// GET: session state
export async function GET() {
  const [{ n }] = await db.select({ n: count() }).from(users);
  const user = await currentUser();
  return Response.json({ needsSetup: n === 0, user });
}

const attempts = new Map<string, { n: number; t: number }>();

// POST {action: login|logout|register}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (action === "logout") {
    await endSession();
    return Response.json({ ok: true });
  }
  if (action === "login") {
    const username = String(body.username ?? "").trim().toLowerCase();
    const a = attempts.get(username);
    if (a && a.n >= 8 && Date.now() - a.t < 5 * 60_000) return bad("محاولات كثيرة، أعد المحاولة بعد بضع دقائق", 429);
    const [u] = await db.select().from(users).where(eq(users.username, username));
    if (!u || !u.active || !verifyPassword(String(body.password ?? ""), u.passwordHash)) {
      attempts.set(username, { n: (a?.n ?? 0) + 1, t: Date.now() });
      return bad("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
    }
    attempts.delete(username);
    await startSession(u.id);
    await audit(u, "login");
    return Response.json({ ok: true });
  }
  if (action === "register") {
    const [{ n }] = await db.select({ n: count() }).from(users);
    if (n > 0) return bad("تم إعداد النظام مسبقًا", 403);
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const instName = String(body.institutionName ?? "").trim();
    if (!instName || !fullName || username.length < 3) return bad("يرجى ملء اسم المؤسسة والاسم الكامل واسم المستخدم (3 أحرف على الأقل)");
    if (password.length < 6) return bad("كلمة المرور قصيرة (6 أحرف على الأقل)");
    const [inst] = await db
      .insert(institutions)
      .values({ name: instName, academicYear: String(body.academicYear ?? ""), city: String(body.city ?? ""), settings: DEFAULT_SETTINGS as unknown as Record<string, unknown> })
      .returning();
    const [u] = await db.insert(users).values({ institutionId: inst.id, username, fullName, passwordHash: hashPassword(password), role: "admin" }).returning();
    await seedCurriculum(inst.id);
    if (body.className) await db.insert(classes).values({ institutionId: inst.id, name: String(body.className), level: String(body.level ?? ""), academicYear: String(body.academicYear ?? ""), teacherId: u.id });
    await startSession(u.id);
    await audit(u, "setup", "institution");
    return Response.json({ ok: true });
  }
  return bad("عملية غير معروفة");
}
