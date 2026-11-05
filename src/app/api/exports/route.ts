import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { guarded } from "@/server/auth";
import { recentExports } from "@/server/exports";

export const dynamic = "force-dynamic";

// GET ?audit=1 -> audit log (admin), otherwise export history
export const GET = guarded(async (req, u) => {
  if (new URL(req.url).searchParams.get("audit")) {
    if (u.role !== "admin") return Response.json({ error: "غير مسموح" }, { status: 403 });
    const rows = await db
      .select({ id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, details: auditLogs.details, createdAt: auditLogs.createdAt, user: users.fullName })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(eq(auditLogs.institutionId, u.institutionId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
    return Response.json(rows);
  }
  return Response.json(await recentExports(u.institutionId));
});
