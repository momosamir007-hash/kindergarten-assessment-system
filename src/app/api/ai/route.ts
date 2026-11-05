import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiAnalyses } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { buildClassData, buildStudentsData, getInstitution } from "@/server/data";
import { analyzeClassAi, analyzeStudentAi } from "@/server/ai";

export const dynamic = "force-dynamic";

export const GET = guarded(async (req, u) => {
  const sp = new URL(req.url).searchParams;
  const targetId = sp.get("targetId");
  if (!targetId) return bad("targetId مطلوب");
  const rows = await db
    .select()
    .from(aiAnalyses)
    .where(and(eq(aiAnalyses.institutionId, u.institutionId), eq(aiAnalyses.targetId, targetId), eq(aiAnalyses.scope, sp.get("scope") === "class" ? "class" : "student")))
    .orderBy(desc(aiAnalyses.createdAt))
    .limit(10);
  return Response.json(rows);
});

// POST {scope: 'student'|'class', targetId, periodId}
export const POST = guarded(async (req, u) => {
  const b = await req.json();
  const periodId: string | null = b.periodId || null;
  if (!b.targetId) return bad("targetId مطلوب");
  const inst = await getInstitution(u.institutionId);
  const aiConfig = inst.settings?.ai as import("@/lib/levels").AiConfig | undefined;

  if (b.scope === "class") {
    const res = await buildClassData(u.institutionId, b.targetId, periodId);
    if (!res) return bad("القسم غير موجود", 404);
    if (!res.data.skills.length) return bad("لا توجد تقييمات مسجلة في هذه الفترة لتحليلها");
    const out = await analyzeClassAi(res.data, aiConfig);
    const [row] = await db.insert(aiAnalyses).values({ institutionId: u.institutionId, scope: "class", targetId: b.targetId, periodId, source: out.source, provider: out.provider, content: out.result as unknown as Record<string, unknown>, createdBy: u.id }).returning();
    await audit(u, "analyze", "class", { id: b.targetId, source: out.source });
    return Response.json({ ...row, error: out.error });
  }
  const [d] = await buildStudentsData(u.institutionId, [b.targetId], periodId);
  if (!d) return bad("التلميذ غير موجود", 404);
  if (!d.results.length) return bad("لا توجد تقييمات مسجلة لهذا التلميذ في الفترة المحددة");
  const out = await analyzeStudentAi(d, aiConfig);
  const [row] = await db.insert(aiAnalyses).values({ institutionId: u.institutionId, scope: "student", targetId: b.targetId, periodId, source: out.source, provider: out.provider, content: out.result as unknown as Record<string, unknown>, createdBy: u.id }).returning();
  await audit(u, "analyze", "student", { id: b.targetId, source: out.source });
  return Response.json({ ...row, error: out.error, recorded: d.results });
});
