import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { importJobs, importMappings } from "@/db/schema";
import { guarded } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = guarded(async (req, u) => {
  const withMaps = new URL(req.url).searchParams.get("mappings");
  if (withMaps) return Response.json(await db.select().from(importMappings).where(eq(importMappings.institutionId, u.institutionId)));
  const rows = await db.select().from(importJobs).where(eq(importJobs.institutionId, u.institutionId)).orderBy(desc(importJobs.createdAt)).limit(50);
  return Response.json(rows);
});

export const DELETE = guarded(async (req, u) => {
  const id = new URL(req.url).searchParams.get("mappingId");
  if (id) await db.delete(importMappings).where(and(eq(importMappings.id, id), eq(importMappings.institutionId, u.institutionId)));
  return Response.json({ ok: true });
});
