import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aiAnalyses, exportLogs } from "@/db/schema";
import { disposition } from "@/lib/export/files";
import { DEFAULT_REPORT_OPTIONS, type ReportOptions } from "@/lib/levels";
import { sanitizePedagogicalNote } from "@/lib/pedagogical-sanitizer";
import type { StudentReportData } from "@/lib/report-types";
import type { StudentAiResult } from "./ai";
import type { AuthUser } from "./auth";

export const MIME: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  zip: "application/zip",
};

export function fileResponse(bytes: Uint8Array, filename: string, ext: string, inline = false) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": disposition(filename, inline),
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function optionsFrom(raw: unknown): ReportOptions {
  const o = { ...DEFAULT_REPORT_OPTIONS };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(o) as (keyof ReportOptions)[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (k === "mode") {
        if (v === "color" || v === "bw" || v === "eco") o.mode = v;
      } else if (k !== "name" && typeof v === "boolean") (o as Record<string, unknown>)[k] = v;
    }
  }
  return o;
}

export async function logExport(u: AuthUser, e: { kind: string; format: string; scope?: string; count: number; filename: string; size: number }) {
  await db.insert(exportLogs).values({ institutionId: u.institutionId, kind: e.kind, format: e.format, scope: e.scope ?? "", count: e.count, filename: e.filename, sizeBytes: e.size, userId: u.id });
}

export async function recentExports(institutionId: string) {
  return db.select().from(exportLogs).where(eq(exportLogs.institutionId, institutionId)).orderBy(desc(exportLogs.createdAt)).limit(100);
}

/** Attach the most recent saved AI-generated suggestions (only genuine AI ones) to report data. */
export async function attachAi(institutionId: string, list: StudentReportData[], periodId: string | null) {
  if (!list.length) return list;
  const rows = await db
    .select()
    .from(aiAnalyses)
    .where(and(eq(aiAnalyses.institutionId, institutionId), eq(aiAnalyses.scope, "student"), eq(aiAnalyses.source, "ai"), inArray(aiAnalyses.targetId, list.map((l) => l.student.id))))
    .orderBy(desc(aiAnalyses.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.targetId) && (!periodId || r.periodId === periodId)) latest.set(r.targetId, r);
  for (const d of list) {
    const r = latest.get(d.student.id);
    if (!r) continue;
    const c = r.content as unknown as StudentAiResult;
    const cleanParentSummary = sanitizePedagogicalNote(c.parentSummary);
    d.aiText = {
      parentSummary: cleanParentSummary || undefined,
      goals: c.shortTermGoals,
      activities: c.remedialActivities,
      source: "ai",
    };
  }
  return list;
}
