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

function activityFor(skill: SkillResult, _severe: boolean): string {
  const sk = skill.skillName;
  const sub = skill.subjectName;

  if (skill.kind === "behavioral" || sub.includes("اجتماع") || sub.includes("ذات") || sub.includes("حرك")) {
    if (sk.includes("حرك") || sk.includes("أصابع") || sk.includes("عجين") || sk.includes("قلم") || sk.includes("رسم") || sk.includes("تلوين")) {
      return `مشاركة الطفل في اللعب بالعجين الملون، تقطيع أوراق الجرائد بالأصابع، أو رص المكعبات لصقل عضلات اليدين بمرح.`;
    }
    if (sk.includes("معطف") || sk.includes("حذاء") || sk.includes("نظاف") || sk.includes("أدوات") || sk.includes("استقلال")) {
      return `منحه فرصة ارتداء حذائه أو ترتيب ألعابه بنفسه في البيت مع تشجيعه بابتسامة وكلمات فخر لطيفة.`;
    }
    return `مشاركته ألعاباً تفاعلية هادئة في البيت، وتشجيعه على تبادل الأدوار والتعبير عن مشاعره بحرية وأمان.`;
  }

  // Academic / Cognitive / Language
  if (sub.includes("لغ") || sk.includes("تعبير") || sk.includes("صوت") || sk.includes("استماع") || sk.includes("قصة")) {
    return `جلسة دافئة لقراءة قصة مصورة قبل النوم، وسؤاله عن أبطالها وتشجيعه على إعادة سرد أحداثها بكلماته البريئة.`;
  }
  if (sub.includes("استكشاف") || sub.includes("رياض") || sk.includes("فرز") || sk.includes("أشكال") || sk.includes("عد")) {
    return `لعبة البحث الممتعة في البيت (مثل جمع 3 ملاعق متشابهة، أو فرز الفواكه حسب ألوانها أثناء تحضير الطعام).`;
  }

  return `أنشطة استكشافية حرة ولعب حسي يومي يتيح له التعبير عن خياله والتعلم عبر التجربة الدافئة.`;
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
  const goals = notAcquired.slice(0, 3).map((s) => `تشجيع فضول الطفل في «${s.skillName}» عبر اللعب التشاركي الهادف`);
  if (!goals.length && needsSupport.length) {
    goals.push(...needsSupport.slice(0, 3).map((s) => `ترسيخ مهارة «${s.skillName}» لتصبح عادة يومية ممتعة ومستقلة`));
  }

  let trend: StudentAnalysis["trend"] = "unknown";
  const pts = d.progress.map((p) => avg([p.academicPct, p.behavioralPct].filter((x): x is number => x !== null))).filter((x): x is number => x !== null);
  if (pts.length >= 2) {
    const diff = pts[pts.length - 1] - pts[pts.length - 2];
    trend = diff > 3 ? "up" : diff < -3 ? "down" : "stable";
  }

  const isFemale = d.student.gender === "F";
  const name = d.student.fullName.split(" ")[0] || (isFemale ? "صغيرتنا" : "صغيرنا");
  let parentSummary: string;
  if (!results.length) {
    parentSummary = `يسعدنا أن نرحب بـ ${name} في بداية رحلته(ا) التربوية والاستكشافية، ونتطلع معاً لمتابعة خطواته(ا) النامية بحب واهتمام.`;
  } else {
    const topStrengths = strengths.slice(0, 2).map((s) => s.skillName).join(" و");
    const needWork = [...notAcquired, ...needsSupport].slice(0, 2).map((s) => s.skillName).join(" و");

    const intro = isFemale
      ? `تسعدنا مرافقة الغالية ${name} في روضتنا؛ طفلة محبة للاستكشاف ومفعمة بالحيوية والبراءة.`
      : `يسعدنا مرافقة البطل الصغير ${name} في روضتنا؛ طفل محب للاستكشاف ومفعم بالحيوية والبراءة.`;

    const strengthText = topStrengths
      ? ` تجلت خطواته${isFemale ? "ا" : ""} الرائعة وثقته${isFemale ? "ا" : ""} بنفسه${isFemale ? "ا" : ""} في: ${topStrengths}.`
      : ` يخطو خطوات واعدة ومشجعة في التفاعل الإيجابي مع رفاق الفوج وبيئة الروضة.`;

    const supportText = needWork
      ? ` ونواصل معاً برفق مرافقة مهاراته${isFemale ? "ا" : ""} النامية في: ${needWork}.`
      : ` ويحقق تطوراً متوازناً يبعث على الارتياح والسرور.`;

    const tip =
      " نوصي بجلسات حوار دافئة وقراءة القصص المصورة في البيت مع منحه فرصة الاعتماد على نفسه في مهامه اليومية البسيطة.";

    parentSummary = `${intro}${strengthText}${supportText}${tip}`;
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
