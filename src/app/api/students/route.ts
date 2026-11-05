import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { detectDuplicates, normalizeRows } from "@/lib/import";

export const dynamic = "force-dynamic";

export const GET = guarded(async (req, u) => {
  const sp = new URL(req.url).searchParams;
  const conds = [eq(students.institutionId, u.institutionId)];
  if (sp.get("active") !== "all") conds.push(eq(students.active, true));
  const classId = sp.get("classId");
  if (classId === "none") conds.push(isNull(students.classId));
  else if (classId) conds.push(eq(students.classId, classId));
  const q = sp.get("q")?.trim();
  if (q) conds.push(or(ilike(students.fullName, `%${q}%`), ilike(students.nationalId, `%${q}%`))!);
  const rows = await db
    .select({ id: students.id, fullName: students.fullName, birthDate: students.birthDate, gender: students.gender, nationalId: students.nationalId, classId: students.classId, className: classes.name, notes: students.notes, active: students.active })
    .from(students)
    .leftJoin(classes, eq(classes.id, students.classId))
    .where(and(...conds));
  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
  return Response.json(rows);
});

export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const [n] = normalizeRows(
    { headers: ["fullName", "birthDate", "gender", "nationalId", "notes"], rows: [[b.fullName ?? "", b.birthDate ?? "", b.gender ?? "", b.nationalId ?? "", b.notes ?? ""]] },
    { fullName: "fullName", birthDate: "birthDate", gender: "gender", nationalId: "nationalId", notes: "notes" },
  );
  if (n.errors.length) return bad(n.errors.join("، "));
  const existing = await db.select({ id: students.id, fullName: students.fullName, birthDate: students.birthDate, nationalId: students.nationalId, classId: students.classId }).from(students).where(eq(students.institutionId, u.institutionId));
  const [dup] = detectDuplicates([n], existing);
  if (dup && !(b.force === true && dup.kind !== "exact")) {
    return Response.json({ error: `احتمال تكرار: ${dup.reason} (${dup.targetName})`, duplicate: dup }, { status: 409 });
  }
  const [row] = await db
    .insert(students)
    .values({
      institutionId: u.institutionId,
      classId: b.classId || null,
      fullName: n.data.fullName,
      birthDate: n.data.birthDate,
      gender: n.data.gender,
      nationalId: n.data.nationalId || null,
      notes: n.data.notes,
      extra: (b.extra && typeof b.extra === "object" ? b.extra : {}) as Record<string, unknown>,
    })
    .returning();
  await audit(u, "create", "student", { id: row.id });
  return Response.json(row);
});
