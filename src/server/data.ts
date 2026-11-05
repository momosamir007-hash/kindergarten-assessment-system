import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, evaluations, institutions, periods, skills, students, subjects, users } from "@/db/schema";
import { classDataFromStudents } from "@/lib/class-data";
import { mergeSettings, toPercent } from "@/lib/levels";
import type { ClassReportData, ProgressPoint, SkillResult, StudentReportData } from "@/lib/report-types";

export const DEFAULT_CURRICULUM: { name: string; kind: "academic" | "behavioral"; skills: string[] }[] = [
  {
    name: "التعبير اللغوي والتواصل",
    kind: "academic",
    skills: [
      "الاستماع الفعّال وفهم التعليمات البسيطة",
      "التعبير الشفوي وتركيب جمل معبّرة",
      "الوعي الصوتي ونطق الكلمات بوضوح",
      "التهيئة للكتابة (مسك القلم والتحكم في الاتجاه)",
      "سرد ومتابعة أحداث قصة مصورة",
    ],
  },
  {
    name: "الاستكشاف والرياضيات المبكرة",
    kind: "academic",
    skills: [
      "الملاحظة والاستكشاف الحسي للمحيط",
      "الفرز والتصنيف حسب (اللون / الشكل / الحجم)",
      "المفاهيم الفضائية والزمانية (فوق/تحت، داخل/خارج، قبل/بعد)",
      "العدّ الحسي للأشياء وربط الكمية برمزها",
      "المقارنة والتسلسل المنطقي للأشياء",
    ],
  },
  {
    name: "التربية الحسية والحركية",
    kind: "academic",
    skills: [
      "الحركية الدقيقة (العجين، تقطيع الورق، التلوين داخل الإطار)",
      "التناسق الحركي البصري (تركيب المكعبات ونظم الخرز)",
      "الحركية الكبرى والتوازن والتحكم في الحركة",
    ],
  },
  {
    name: "التنشئة الاجتماعية والوجدانية",
    kind: "behavioral",
    skills: [
      "التفاعل الإيجابي واللعب التشاركي مع الأقران",
      "التعبير عن المشاعر والحاجات بهدوء",
      "احترام قواعد الفوج وآداب التعامل",
      "المشاركة والمساعدة وتبادل الأدوار",
    ],
  },
  {
    name: "الاستقلالية والعناية بالذات",
    kind: "behavioral",
    skills: [
      "الاعتماد على النفس في ارتداء المعطف والحذاء",
      "العناية بالنظافة الشخصية وغسل اليدين",
      "ترتيب الأدوات الشخصية والألعاب بعد الانتهاء",
      "المبادرة وإتمام النشاط الموجه",
    ],
  },
  {
    name: "التعبير الفني والابتكاري",
    kind: "behavioral",
    skills: [
      "الرسم والتلوين الحر والتعبير التلقائي",
      "التشكيل اليدوي بالصلصال وخامات البيئة",
      "الإنشاد الجماعي ومحاكاة الإيقاع الصوتي",
      "اللعب التمثيلي والتخيلي الهادف",
    ],
  },
];

export async function seedCurriculum(institutionId: string) {
  let order = 0;
  for (const s of DEFAULT_CURRICULUM) {
    const [sub] = await db.insert(subjects).values({ institutionId, name: s.name, kind: s.kind, sortOrder: order++ }).returning();
    await db.insert(skills).values(s.skills.map((name, i) => ({ subjectId: sub.id, name, sortOrder: i })));
  }
  await db.insert(periods).values([
    { institutionId, name: "فترة الاستكشاف والتهيئة (التشخيصي)", sortOrder: 0 },
    { institutionId, name: "فترة الملاحظة الأولى (بناء العادات)", sortOrder: 1, isCurrent: true },
    { institutionId, name: "فترة الملاحظة الثانية (تطور الكفاءات)", sortOrder: 2 },
    { institutionId, name: "فترة الملاحظة الختامية (حصيلة التهيئة)", sortOrder: 3 },
  ]);
}

export async function getInstitution(id: string) {
  const [inst] = await db.select().from(institutions).where(eq(institutions.id, id));
  return inst;
}

const avg1 = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/**
 * Build report data for many students with a constant number of queries.
 * periodId: specific period, or null => latest evaluation per skill across all periods.
 */
export async function buildStudentsData(institutionId: string, studentIds: string[], periodId: string | null): Promise<StudentReportData[]> {
  if (!studentIds.length) return [];
  const inst = await getInstitution(institutionId);
  const settings = mergeSettings(inst.settings);
  const stRows = await db.select().from(students).where(and(eq(students.institutionId, institutionId), inArray(students.id, studentIds)));
  const clsRows = await db.select().from(classes).where(eq(classes.institutionId, institutionId));
  const clsMap = new Map(clsRows.map((c) => [c.id, c]));
  const subRows = await db.select().from(subjects).where(eq(subjects.institutionId, institutionId));
  const subMap = new Map(subRows.map((s) => [s.id, s]));
  const skillRows = await db
    .select({ id: skills.id, name: skills.name, subjectId: skills.subjectId, so: skills.sortOrder })
    .from(skills)
    .innerJoin(subjects, eq(subjects.id, skills.subjectId))
    .where(eq(subjects.institutionId, institutionId));
  const skillMap = new Map(skillRows.map((s) => [s.id, s]));
  const perRows = await db.select().from(periods).where(eq(periods.institutionId, institutionId));
  perRows.sort((a, b) => a.sortOrder - b.sortOrder);
  const userRows = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(eq(users.institutionId, institutionId));
  const userMap = new Map(userRows.map((u) => [u.id, u.fullName]));

  // Fetch in chunks to keep parameter lists bounded
  const evs: (typeof evaluations.$inferSelect)[] = [];
  const ids = stRows.map((s) => s.id);
  for (let i = 0; i < ids.length; i += 500) {
    evs.push(...(await db.select().from(evaluations).where(inArray(evaluations.studentId, ids.slice(i, i + 500)))));
  }
  evs.sort((a, b) => a.evaluatedAt.getTime() - b.evaluatedAt.getTime()); // later overrides earlier

  const periodName = periodId ? perRows.find((p) => p.id === periodId)?.name ?? "" : "كل الفترات (آخر تقييم)";
  const byStudent = new Map<string, (typeof evs)[number][]>();
  for (const e of evs) {
    const l = byStudent.get(e.studentId) ?? [];
    l.push(e);
    byStudent.set(e.studentId, l);
  }

  const order = new Map(studentIds.map((id, i) => [id, i]));
  const out: StudentReportData[] = [];
  for (const st of stRows) {
    const list = byStudent.get(st.id) ?? [];
    const toResult = (e: (typeof evs)[number]): SkillResult | null => {
      const sk = skillMap.get(e.skillId);
      if (!sk) return null;
      const sub = subMap.get(sk.subjectId);
      if (!sub) return null;
      const lvl = settings.levels.find((l) => l.key === e.levelKey);
      const score = Number(e.score);
      return {
        skillId: sk.id,
        skillName: sk.name,
        subjectId: sub.id,
        subjectName: sub.name,
        kind: sub.kind === "behavioral" ? "behavioral" : "academic",
        levelKey: e.levelKey,
        levelLabel: lvl?.label ?? e.levelKey,
        score,
        percent: toPercent(score, settings.levels),
        note: e.note,
        evaluatedAt: e.evaluatedAt.toISOString(),
        teacher: e.evaluatedBy ? userMap.get(e.evaluatedBy) ?? "" : "",
      };
    };
    const latest = (pred: (e: (typeof evs)[number]) => boolean) => {
      const m = new Map<string, (typeof evs)[number]>();
      for (const e of list) if (pred(e)) m.set(e.skillId, e);
      return [...m.values()].map(toResult).filter((r): r is SkillResult => r !== null);
    };
    const results = latest((e) => (periodId ? e.periodId === periodId : true)).sort(
      (a, b) => (skillMap.get(a.skillId)?.so ?? 0) - (skillMap.get(b.skillId)?.so ?? 0) || a.subjectName.localeCompare(b.subjectName, "ar"),
    );
    // keep subject grouping stable
    results.sort((a, b) => a.kind.localeCompare(b.kind) || a.subjectName.localeCompare(b.subjectName, "ar"));
    const progress: ProgressPoint[] = [];
    for (const p of perRows) {
      const rs = latest((e) => e.periodId === p.id);
      if (!rs.length) continue;
      progress.push({
        periodName: p.name,
        academicPct: avg1(rs.filter((r) => r.kind === "academic").map((r) => r.percent)),
        behavioralPct: avg1(rs.filter((r) => r.kind === "behavioral").map((r) => r.percent)),
      });
    }
    const cls = st.classId ? clsMap.get(st.classId) : undefined;
    out.push({
      institution: { name: inst.name, academicYear: inst.academicYear, city: inst.city, logo: inst.logo, signatureLabel: settings.teacherSignatureLabel },
      student: { id: st.id, fullName: st.fullName, birthDate: st.birthDate, gender: st.gender, nationalId: st.nationalId, className: cls?.name ?? "", level: cls?.level ?? "", notes: st.notes },
      periodName,
      levels: settings.levels,
      results,
      progress,
      strengthThreshold: settings.strengthThreshold,
      supportThreshold: settings.supportThreshold,
    });
  }
  out.sort((a, b) => (order.get(a.student.id) ?? 0) - (order.get(b.student.id) ?? 0));
  return out;
}

export async function buildClassData(institutionId: string, classId: string, periodId: string | null, studentIds?: string[]): Promise<{ data: ClassReportData; students: StudentReportData[] } | null> {
  const [cls] = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId)));
  if (!cls) return null;
  let ids = studentIds;
  if (!ids) {
    const rows = await db.select({ id: students.id, n: students.fullName }).from(students).where(and(eq(students.classId, classId), eq(students.active, true)));
    rows.sort((a, b) => a.n.localeCompare(b.n, "ar"));
    ids = rows.map((r) => r.id);
  }
  const list = await buildStudentsData(institutionId, ids, periodId);
  const inst = await getInstitution(institutionId);
  const settings = mergeSettings(inst.settings);
  const data = classDataFromStudents(list, {
    className: cls.name,
    level: cls.level,
    periodName: list[0]?.periodName ?? "",
    institution: { name: inst.name, academicYear: inst.academicYear, city: inst.city, logo: inst.logo, signatureLabel: settings.teacherSignatureLabel },
    levels: settings.levels,
    strengthThreshold: settings.strengthThreshold,
    supportThreshold: settings.supportThreshold,
  });
  return { data, students: list };
}
