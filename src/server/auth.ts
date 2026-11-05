import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";

export type AuthUser = { id: string; institutionId: string; username: string; fullName: string; role: "admin" | "teacher" };

const COOKIE = "taqyim_sid";
const TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt") return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function startSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(sessions).values({ id: sha(token), userId, expiresAt: new Date(Date.now() + TTL_MS) });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: TTL_MS / 1000 });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha(token)));
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, institutionId: users.institutionId, username: users.username, fullName: users.fullName, role: users.role, active: users.active })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || !u.active) return null;
  return { id: u.id, institutionId: u.institutionId, username: u.username, fullName: u.fullName, role: u.role === "admin" ? "admin" : "teacher" };
}

export const unauthorized = () => Response.json({ error: "غير مصرح — يرجى تسجيل الدخول" }, { status: 401 });
export const forbidden = () => Response.json({ error: "ليست لديك صلاحية لهذه العملية" }, { status: 403 });
export const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status });

export async function audit(u: { id: string; institutionId: string }, action: string, entity = "", details: Record<string, unknown> = {}) {
  await db.insert(auditLogs).values({ institutionId: u.institutionId, userId: u.id, action, entity, details });
}

/** Route wrapper: authenticates, optionally requires admin, and converts thrown errors to JSON. */
export function guarded<C = unknown>(
  fn: (req: Request, u: AuthUser, ctx: C) => Promise<Response>,
  opts: { admin?: boolean } = {},
) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const u = await currentUser();
      if (!u) return unauthorized();
      if (opts.admin && u.role !== "admin") return forbidden();
      return await fn(req, u, ctx);
    } catch (e) {
      console.error(e);
      return Response.json({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }, { status: 500 });
    }
  };
}

export type IdCtx = { params: Promise<{ id: string }> };
