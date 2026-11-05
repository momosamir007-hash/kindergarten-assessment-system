import { eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { bad, guarded } from "@/server/auth";
import { detectDuplicates, normalizeRows, type Mapping } from "@/lib/import";

export const dynamic = "force-dynamic";

// Re-normalize + re-check duplicates, either from raw table + mapping, or from corrected row objects.
export const POST = guarded(async (req, u) => {
  const b = await req.json();
  let normalized;
  if (b.table && b.mapping) {
    normalized = normalizeRows(b.table as { headers: string[]; rows: string[][] }, b.mapping as Mapping);
  } else if (Array.isArray(b.rows)) {
    const keys = ["fullName", "birthDate", "gender", "level", "className", "nationalId", "notes"];
    const rows = (b.rows as Record<string, string>[]).map((r) => keys.map((k) => String(r[k] ?? "")));
    normalized = normalizeRows({ headers: keys, rows }, Object.fromEntries(keys.map((k) => [k, k])));
    normalized.forEach((n, i) => (n.data.extra = (b.rows[i].extra as Record<string, string>) ?? {}));
  } else return bad("بيانات غير صالحة");
  const existing = await db.select({ id: students.id, fullName: students.fullName, birthDate: students.birthDate, nationalId: students.nationalId, classId: students.classId }).from(students).where(eq(students.institutionId, u.institutionId));
  return Response.json({ normalized, duplicates: detectDuplicates(normalized, existing) });
});
