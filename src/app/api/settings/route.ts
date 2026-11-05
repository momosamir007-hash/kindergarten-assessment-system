import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { mergeSettings } from "@/lib/levels";
import { getInstitution } from "@/server/data";

export const dynamic = "force-dynamic";

export const GET = guarded(async (_req, u) => {
  const inst = await getInstitution(u.institutionId);
  const settings = mergeSettings(inst.settings);
  const isAiConfigured = !!(settings.ai?.apiKey?.trim() || process.env.AI_API_KEY);
  return Response.json({
    name: inst.name,
    academicYear: inst.academicYear,
    city: inst.city,
    logo: inst.logo,
    settings,
    aiConfigured: isAiConfigured,
  });
});

export const PUT = guarded(async (req, u) => {
  const b = await req.json();
  const inst = await getInstitution(u.institutionId);
  const cur = mergeSettings(inst.settings);
  const set: Partial<typeof institutions.$inferInsert> = {};
  if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim();
  if (typeof b.academicYear === "string") set.academicYear = b.academicYear;
  if (typeof b.city === "string") set.city = b.city;
  if ("logo" in b) {
    if (b.logo && (!/^data:image\/(png|jpe?g);base64,/.test(b.logo) || b.logo.length > 1_500_000)) return bad("الشعار يجب أن يكون PNG أو JPG بحجم أقل من 1 ميغابايت");
    set.logo = b.logo || null;
  }
  if (b.settings) {
    const s = b.settings as Partial<typeof cur>;
    if (s.levels) {
      if (!Array.isArray(s.levels) || s.levels.length < 2 || s.levels.some((l) => !l.key || !l.label || typeof l.value !== "number")) return bad("مستويات التقييم غير صالحة (مستويان على الأقل)");
      if (new Set(s.levels.map((l) => l.key)).size !== s.levels.length) return bad("مفاتيح المستويات مكررة");
    }
    set.settings = { ...cur, ...s } as unknown as Record<string, unknown>;
  }
  await db.update(institutions).set(set).where(eq(institutions.id, u.institutionId));
  await audit(u, "update", "settings");
  return Response.json({ ok: true });
}, { admin: true });
