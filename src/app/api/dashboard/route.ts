import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, evaluations, students } from "@/db/schema";
import { guarded } from "@/server/auth";
import { buildClassData, buildStudentsData } from "@/server/data";
import { analyzeClass } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export const GET = guarded(async (req, u) => {
  const sp = new URL(req.url).searchParams;
  const classId = sp.get("classId");
  const periodId = sp.get("periodId") || null;
  const [{ n: studentCount }] = await db.select({ n: count() }).from(students).where(and(eq(students.institutionId, u.institutionId), eq(students.active, true)));
  const [{ n: classCount }] = await db.select({ n: count() }).from(classes).where(eq(classes.institutionId, u.institutionId));
  const [{ n: evalCount }] = await db.select({ n: count() }).from(evaluations).where(eq(evaluations.institutionId, u.institutionId));
  if (!classId) return Response.json({ studentCount, classCount, evalCount, class: null });
  const res = await buildClassData(u.institutionId, classId, periodId);
  if (!res) return Response.json({ studentCount, classCount, evalCount, class: null });
  const analysis = analyzeClass(res.data);
  // class average per period (from each student's progress)
  const all = await buildStudentsData(u.institutionId, res.students.map((s) => s.student.id), null);
  const acc = new Map<string, number[]>();
  const order: string[] = [];
  for (const s of all)
    for (const p of s.progress) {
      const vals = [p.academicPct, p.behavioralPct].filter((x): x is number => x !== null);
      if (!vals.length) continue;
      if (!acc.has(p.periodName)) {
        acc.set(p.periodName, []);
        order.push(p.periodName);
      }
      acc.get(p.periodName)!.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  const progress = order.map((name) => ({ name, avg: Math.round((acc.get(name)!.reduce((a, b) => a + b, 0) / acc.get(name)!.length) * 10) / 10 }));
  return Response.json({ studentCount, classCount, evalCount, class: res.data, analysis, progress });
});
