import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, evaluations, importJobs, periods, skills, students, subjects } from "@/db/schema";
import { audit, bad, guarded } from "@/server/auth";
import { getInstitution } from "@/server/data";
import { parseLegacy } from "@/lib/legacy";
import { mergeSettings, matchLevel } from "@/lib/levels";
import { normName } from "@/lib/import";

export const dynamic = "force-dynamic";

// Never modifies the uploaded source. dryRun=1 only analyzes and reports.
export const POST = guarded(async (req, u) => {
  let text = "";
  let filename = "students_data.json";
  let dryRun = false;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("file");
    if (!(f instanceof File)) return bad("لم يتم اختيار ملف");
    filename = f.name;
    text = Buffer.from(await f.arrayBuffer()).toString("utf8");
    dryRun = fd.get("dryRun") === "1";
  } else {
    const b = await req.json();
    text = String(b.text ?? "");
    dryRun = !!b.dryRun;
  }
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return bad("الملف ليس JSON صالحًا");
  }
  const { students: parsed, warnings } = parseLegacy(json);
  const inst = await getInstitution(u.institutionId);
  const settings = mergeSettings(inst.settings);

  const summary = {
    studentsFound: parsed.length,
    evaluationsFound: parsed.reduce((a, s) => a + s.evaluations.length, 0),
    studentsCreated: 0,
    studentsExisting: 0,
    evaluationsImported: 0,
    evaluationsDuplicate: 0,
    evaluationsRejected: 0,
    rejectedSamples: [] as string[],
    unparsedPreserved: parsed.filter((s) => s.extra.legacy).length,
    warnings,
    dryRun,
  };
  if (dryRun) {
    for (const s of parsed) for (const e of s.evaluations) if (!matchLevel(e.levelRaw, settings.levels)) { summary.evaluationsRejected++; if (summary.rejectedSamples.length < 10) summary.rejectedSamples.push(`${s.fullName}: ${e.skill} = «${e.levelRaw}»`); }
    return Response.json({ ...summary, sample: parsed.slice(0, 5).map((s) => ({ fullName: s.fullName, birthDate: s.birthDate, className: s.className, evaluations: s.evaluations.length })) });
  }

  const inst0 = u.institutionId;
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(students).where(eq(students.institutionId, inst0));
    const byNid = new Map(existing.filter((e) => e.nationalId).map((e) => [e.nationalId!.toLowerCase(), e.id]));
    const byNB = new Map(existing.map((e) => [`${normName(e.fullName)}|${e.birthDate ?? ""}`, e.id]));
    const clsRows = await tx.select().from(classes).where(eq(classes.institutionId, inst0));
    const classByName = new Map(clsRows.map((c) => [c.name.trim(), c.id]));
    const subRows = await tx.select().from(subjects).where(eq(subjects.institutionId, inst0));
    const subByName = new Map(subRows.map((s) => [normName(s.name), s]));
    const skillRows = subRows.length ? await tx.select().from(skills).where(inArray(skills.subjectId, subRows.map((s) => s.id))) : [];
    const skillByKey = new Map(skillRows.map((s) => [`${s.subjectId}|${normName(s.name)}`, s.id]));
    const perRows = await tx.select().from(periods).where(eq(periods.institutionId, inst0));
    const perByName = new Map(perRows.map((p) => [normName(p.name), p.id]));
    let legacyPeriod = perByName.get(normName("السجل القديم"));

    const getPeriod = async (name: string) => {
      if (name) {
        const hit = perByName.get(normName(name));
        if (hit) return hit;
        const [p] = await tx.insert(periods).values({ institutionId: inst0, name, sortOrder: perRows.length + perByName.size }).returning();
        perByName.set(normName(name), p.id);
        return p.id;
      }
      if (!legacyPeriod) {
        const [p] = await tx.insert(periods).values({ institutionId: inst0, name: "السجل القديم", sortOrder: 99 }).returning();
        legacyPeriod = p.id;
      }
      return legacyPeriod;
    };
    const getSkill = async (subject: string, skill: string, behavioral: boolean) => {
      let sub = subByName.get(normName(subject));
      if (!sub) {
        [sub] = await tx.insert(subjects).values({ institutionId: inst0, name: subject, kind: behavioral ? "behavioral" : "academic", sortOrder: 100 + subByName.size }).returning();
        subByName.set(normName(subject), sub);
      }
      const k = `${sub.id}|${normName(skill)}`;
      let id = skillByKey.get(k);
      if (!id) {
        const [s] = await tx.insert(skills).values({ subjectId: sub.id, name: skill, sortOrder: 100 }).returning();
        id = s.id;
        skillByKey.set(k, id);
      }
      return id;
    };

    const seen = new Set<string>();
    const existingEvals = existing.length
      ? await tx.select({ s: evaluations.studentId, k: evaluations.skillId, p: evaluations.periodId, l: evaluations.levelKey, d: evaluations.evaluatedAt }).from(evaluations).where(eq(evaluations.institutionId, inst0))
      : [];
    for (const e of existingEvals) seen.add(`${e.s}|${e.k}|${e.p}|${e.l}|${e.d.toISOString().slice(0, 10)}`);

    for (const s of parsed) {
      let id = (s.nationalId && byNid.get(s.nationalId.toLowerCase())) || byNB.get(`${normName(s.fullName)}|${s.birthDate ?? ""}`);
      if (id) summary.studentsExisting++;
      else {
        let classId: string | null = null;
        if (s.className) {
          classId = classByName.get(s.className.trim()) ?? null;
          if (!classId) {
            const [c] = await tx.insert(classes).values({ institutionId: inst0, name: s.className.trim(), level: s.level, teacherId: u.id }).returning();
            classId = c.id;
            classByName.set(s.className.trim(), c.id);
          }
        }
        const [row] = await tx
          .insert(students)
          .values({ institutionId: inst0, classId, fullName: s.fullName, birthDate: s.birthDate, gender: s.gender, nationalId: s.nationalId && !byNid.has(s.nationalId.toLowerCase()) ? s.nationalId : null, notes: s.notes, extra: { ...s.extra, importedFrom: filename } })
          .returning();
        id = row.id;
        byNB.set(`${normName(s.fullName)}|${s.birthDate ?? ""}`, id);
        if (s.nationalId) byNid.set(s.nationalId.toLowerCase(), id);
        summary.studentsCreated++;
      }
      const batch: (typeof evaluations.$inferInsert)[] = [];
      for (const e of s.evaluations) {
        const lvl = matchLevel(e.levelRaw, settings.levels);
        if (!lvl) {
          summary.evaluationsRejected++;
          if (summary.rejectedSamples.length < 20) summary.rejectedSamples.push(`${s.fullName}: ${e.skill} = «${e.levelRaw}»`);
          continue;
        }
        const skillId = await getSkill(e.subject, e.skill, e.behavioral);
        const periodId = await getPeriod(e.period);
        const date = e.date ?? new Date().toISOString().slice(0, 10);
        const key = `${id}|${skillId}|${periodId}|${lvl.key}|${date}`;
        if (seen.has(key)) {
          summary.evaluationsDuplicate++;
          continue;
        }
        seen.add(key);
        batch.push({ institutionId: inst0, studentId: id, skillId, periodId, levelKey: lvl.key, score: String(lvl.value), note: e.note, evaluatedBy: u.id, evaluatedAt: new Date(`${date}T08:00:00Z`) });
      }
      for (let i = 0; i < batch.length; i += 300) await tx.insert(evaluations).values(batch.slice(i, i + 300));
      summary.evaluationsImported += batch.length;
    }
    await tx.insert(importJobs).values({
      institutionId: inst0,
      kind: "legacy",
      filename,
      total: parsed.length,
      imported: summary.studentsCreated,
      updated: 0,
      skipped: summary.studentsExisting,
      rejected: summary.evaluationsRejected,
      report: summary as unknown as Record<string, unknown>,
      createdBy: u.id,
    });
  });
  await audit(u, "legacy_import", "students", { created: summary.studentsCreated, evaluations: summary.evaluationsImported });
  return Response.json(summary);
});
