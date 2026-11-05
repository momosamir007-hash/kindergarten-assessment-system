// Rule-based pedagogical analysis computed ONLY from recorded evaluations.
// Everything produced here is marked as "suggestion" in the UI/reports; it never replaces the teacher.
import type { ClassReportData, SkillResult, StudentReportData } from "./report-types";

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export type SubjectSummary = { subjectName: string; kind: string; pct: number; count: number };

export type StudentAnalysis = {
  academicPct: number | null;
  behavioralPct: number | null;
  overallPct: number | null;
  subjects: SubjectSummary[];
  strengths: SkillResult[];
  needsSupport: SkillResult[];
  notAcquired: SkillResult[];
  remedial: { skill: string; activity: string }[];
  goals: string[];
  parentSummary: string;
  trend: "up" | "down" | "stable" | "unknown";
};

export function summarizeSubjects(results: SkillResult[]): SubjectSummary[] {
  const map = new Map<string, { kind: string; v: number[] }>();
  for (const r of results) {
    const m = map.get(r.subjectName) ?? { kind: r.kind, v: [] };
    m.v.push(r.percent);
    map.set(r.subjectName, m);
  }
  return [...map.entries()].map(([subjectName, m]) => ({
    subjectName,
    kind: m.kind,
    pct: avg(m.v) ?? 0,
    count: m.v.length,
  }));
}

export function pctByKind(results: SkillResult[], kind: "academic" | "behavioral"): number | null {
  return avg(results.filter((r) => r.kind === kind).map((r) => r.percent));
}

function activityFor(skill: SkillResult, severe: boolean): string {
  if (skill.kind === "behavioral") {
    return severe
      ? `تخصيص أنشطة لعب جماعي وأدوار تمثيلية هادفة لتعزيز «${skill.skillName}» مع تشجيع لفظي إيجابي فوري.`
      : `تحفيز الطفل على ممارسة «${skill.skillName}» ضمن ألعاب الفوج والمشاركة الودية.`;
  }
  return severe
    ? `نشاط لعب موجّه وحسي لدعم «${skill.skillName}» (في مجال ${skill.subjectName}) بالانطلاق من المحسوسات والمجسمات وخامات البيئة.`
    : `ألعاب تفاعلية ومحاكاة ممتعة لصقل «${skill.skillName}» (${skill.subjectName}) مع ملاحظة تطوره برفق.`;
}

export function analyzeStudent(d: StudentReportData): StudentAnalysis {
  const { results, strengthThreshold, supportThreshold } = d;
  const academicPct = pctByKind(results, "academic");
  const behavioralPct = pctByKind(results, "behavioral");
  const overallPct = avg(results.map((r) => r.percent));
  const strengths = results.filter((r) => r.percent >= strengthThreshold);
  const needsSupport = results.filter((r) => r.percent < strengthThreshold && r.percent >= supportThreshold);
  const notAcquired = results.filter((r) => r.percent < supportThreshold);

  const remedial = [
    ...notAcquired.map((s) => ({ skill: s.skillName, activity: activityFor(s, true) })),
    ...needsSupport.map((s) => ({ skill: s.skillName, activity: activityFor(s, false) })),
  ];
  const goals = notAcquired.slice(0, 3).map((s) => `بلوغ مستوى «في طور الاكتساب» في مهارة: ${s.skillName} عبر اللعب والأنشطة اليومية`);
  if (!goals.length && needsSupport.length) {
    goals.push(...needsSupport.slice(0, 3).map((s) => `تثبيت مهارة: ${s.skillName} ليصل الطفل إلى استقلالية تامة فيها`));
  }

  let trend: StudentAnalysis["trend"] = "unknown";
  const pts = d.progress.map((p) => avg([p.academicPct, p.behavioralPct].filter((x): x is number => x !== null))).filter((x): x is number => x !== null);
  if (pts.length >= 2) {
    const diff = pts[pts.length - 1] - pts[pts.length - 2];
    trend = diff > 3 ? "up" : diff < -3 ? "down" : "stable";
  }

  const first = d.student.fullName.split(" ")[0] || "الطفل(ة)";
  let parentSummary: string;
  if (!results.length) {
    parentSummary = `لا توجد ملاحظات تقييمية مسجلة لـ ${first} في هذه الفترة بعد.`;
  } else {
    parentSummary =
      `خلال الفترة «${d.periodName}»، أظهر(ت) ${first} تفاعلاً طيباً في مجالات الأنشطة المتنوعة (${results.length} مؤشراً نمائياً مقيّماً). ` +
      (strengths.length ? `وتجلّت استقلاليته(ا) وتميزه(ا) في: ${strengths.slice(0, 3).map((s) => s.skillName).join("، ")}. ` : "") +
      (notAcquired.length || needsSupport.length
        ? `ويحظى بالتشجيع والمرافقة الودية في: ${[...notAcquired, ...needsSupport].slice(0, 3).map((s) => s.skillName).join("، ")}. `
        : "") +
      (trend === "up" ? "ويُسجَّل تطور ملحوظ في وتيرة النمو والمشاركة مقارنة بالفترة السابقة. " : trend === "down" ? "ويُستحسن تنويع الألعاب التفاعلية في البيت لتشجيع مكتسباته بالتعاون مع المربية. " : "") +
      "هذا التقرير وصفي إرشادي مستند إلى الملاحظة المباشرة لأنشطة وسلوكيات الطفل اليومية.";
  }

  return {
    academicPct,
    behavioralPct,
    overallPct,
    subjects: summarizeSubjects(results),
    strengths,
    needsSupport,
    notAcquired,
    remedial,
    goals,
    parentSummary,
    trend,
  };
}

export type ClassAnalysis = {
  avgOverall: number | null;
  hardest: ClassReportData["skills"];
  best: ClassReportData["skills"];
  distribution: Record<string, number>; // level key -> count of evaluations
  supportGroup: string[]; // student names
  advancedGroup: string[];
  middleGroup: string[];
  collectiveActivities: string[];
  enrichment: string[];
};

export function analyzeClass(d: ClassReportData): ClassAnalysis {
  const evaluated = d.students.filter((s) => s.overallPct !== null);
  const avgOverall = avg(evaluated.map((s) => s.overallPct as number));
  const sorted = [...d.skills].sort((a, b) => a.avgPercent - b.avgPercent);
  const hardest = sorted.filter((s) => s.avgPercent < d.strengthThreshold).slice(0, 5);
  const best = [...sorted].reverse().filter((s) => s.avgPercent >= d.strengthThreshold).slice(0, 5);
  const distribution: Record<string, number> = {};
  for (const s of d.skills) for (const [k, v] of Object.entries(s.counts)) distribution[k] = (distribution[k] ?? 0) + v;

  const supportGroup = evaluated.filter((s) => (s.overallPct as number) < d.supportThreshold).map((s) => s.fullName);
  const advancedGroup = evaluated.filter((s) => (s.overallPct as number) >= d.strengthThreshold).map((s) => s.fullName);
  const middleGroup = evaluated
    .filter((s) => (s.overallPct as number) >= d.supportThreshold && (s.overallPct as number) < d.strengthThreshold)
    .map((s) => s.fullName);
  return {
    avgOverall,
    hardest,
    best,
    distribution,
    supportGroup,
    advancedGroup,
    middleGroup,
    collectiveActivities: hardest.map((s) => `معالجة جماعية للمهارة «${s.skillName}» (${s.subjectName}) — متوسط الاكتساب ${s.avgPercent}%.`),
    enrichment: best.slice(0, 3).map((s) => `أنشطة إثرائية للمتقدمين انطلاقًا من المهارة «${s.skillName}».`),
  };
}
