import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, periods, skills, students, subjects, users } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { getInstitution } from "@/server/data";
import { mergeSettings } from "@/lib/levels";

export const dynamic = "force-dynamic";

/**
 * GET ?studentId=&periodId=  -> current (latest) result per skill for that student/period + full history
 * GET ?classId=&periodId=    -> current results for all students of a class (grid)
 */
export const GET = guarded(async (req, u) => {
  const sp = new URL(req.url).searchParams;
  const periodId = sp.get("periodId");
  const studentId = sp.get("studentId");
  const classId = sp.get("classId");
  let ids: string[] = [];
  if (studentId) ids = [studentId];
  else if (classId) ids = (await db.select({ id: students.id }).from(students).where(and(eq(students.classId, classId), eq(students.institutionId, u.institutionId), eq(students.active, true)))).map((r) => r.id);
  else return bad("studentId أو classId مطلوب");
  if (!ids.length) return Response.json({ current: [], history: [] });
  const conds = [eq(evaluations.institutionId, u.institutionId), inArray(evaluations.studentId, ids)];
  if (periodId) conds.push(eq(evaluations.periodId, periodId));
  const rows = await db
    .select({ id: evaluations.id, studentId: evaluations.studentId, skillId: evaluations.skillId, periodId: evaluations.periodId, levelKey: evaluations.levelKey, score: evaluations.score, note: evaluations.note, evaluatedAt: evaluations.evaluatedAt, teacher: users.fullName })
    .from(evaluations)
    .leftJoin(users, eq(users.id, evaluations.evaluatedBy))
    .where(and(...conds))
    .orderBy(desc(evaluations.evaluatedAt));
  const seen = new Set<string>();
  const current = rows.filter((r) => {
    const k = `${r.studentId}|${r.skillId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return Response.json({ current, history: studentId ? rows : [] });
});

// POST {periodId, items:[{studentId, skillId, levelKey, note?}], date?}
export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const items = (b.items ?? []) as { studentId: string; skillId: string; levelKey: string; note?: string }[];
  if (!items.length) return bad("لا توجد تقييمات للحفظ");
  if (items.length > 5000) return bad("عدد التقييمات كبير");
  const inst = await getInstitution(u.institutionId);
  const levels = mergeSettings(inst.settings).levels;
  if (b.periodId) {
    const [p] = await db.select({ id: periods.id }).from(periods).where(and(eq(periods.id, b.periodId), eq(periods.institutionId, u.institutionId)));
    if (!p) return bad("الفترة غير موجودة");
  }
  const stIds = [...new Set(items.map((i) => i.studentId))];
  const skIds = [...new Set(items.map((i) => i.skillId))];
  const okSt = new Set((await db.select({ id: students.id }).from(students).where(and(eq(students.institutionId, u.institutionId), inArray(students.id, stIds)))).map((r) => r.id));
  const okSk = new Set((await db.select({ id: skills.id }).from(skills).innerJoin(subjects, eq(subjects.id, skills.subjectId)).where(and(eq(subjects.institutionId, u.institutionId), inArray(skills.id, skIds)))).map((r) => r.id));
  const when = b.date ? new Date(`${b.date}T08:00:00Z`) : new Date();
  const values: (typeof evaluations.$inferInsert)[] = [];
  for (const i of items) {
    const lv = levels.find((l) => l.key === i.levelKey);
    if (!lv || !okSt.has(i.studentId) || !okSk.has(i.skillId)) return bad("تقييم غير صالح (تلميذ أو مهارة أو مستوى غير معروف)");
    values.push({ institutionId: u.institutionId, studentId: i.studentId, skillId: i.skillId, periodId: b.periodId || null, levelKey: lv.key, score: String(lv.value), note: String(i.note ?? ""), evaluatedBy: u.id, evaluatedAt: when });
  }
  for (let i = 0; i < values.length; i += 300) await db.insert(evaluations).values(values.slice(i, i + 300));
  await audit(u, "evaluate", "evaluation", { count: values.length });
  return Response.json({ saved: values.length });
});
