// Multi-Provider AI Analysis Service for Early Childhood / Preschool Assessment
import { analyzeClass, analyzeStudent } from "@/lib/analysis";
import type { ClassReportData, StudentReportData } from "@/lib/report-types";
import type { AiConfig } from "@/lib/levels";
import { executeAiCall, AI_PROVIDERS } from "@/lib/ai-providers";

export type StudentAiResult = {
  strengths: string[];
  support: string[];
  progressComparison: string;
  remedialActivities: string[];
  shortTermGoals: string[];
  parentSummary: string;
  teacherRecommendations: string[];
};

export type ClassAiResult = {
  summary: string;
  commonDifficulties: string[];
  strengths: string[];
  collectiveActivities: string[];
  supportGroups: { label: string; students: string[] }[];
  enrichment: string[];
};

export const aiConfigured = (cfg?: AiConfig) => {
  if (cfg?.apiKey && cfg.apiKey.trim().length > 0) return true;
  return !!process.env.AI_API_KEY;
};

export const getEffectiveAiConfig = (cfg?: AiConfig): AiConfig | null => {
  if (cfg?.apiKey && cfg.apiKey.trim().length > 0) {
    return {
      provider: cfg.provider || "gemini",
      apiKey: cfg.apiKey.trim(),
      baseUrl: cfg.baseUrl,
      model: cfg.model || AI_PROVIDERS[cfg.provider || "gemini"]?.defaultModel || "gemini-2.5-flash",
      enabled: cfg.enabled !== false,
    };
  }
  if (process.env.AI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.AI_API_KEY.trim(),
      baseUrl: process.env.AI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.AI_MODEL || "gpt-4o-mini",
      enabled: true,
    };
  }
  return null;
};

export const providerLabel = (cfg?: AiConfig | null) => {
  if (!cfg) return "القواعد البيداغوجية المدمجة (بدون إنترنت)";
  const meta = AI_PROVIDERS[cfg.provider];
  return `${meta?.name ?? cfg.provider} (${cfg.model})`;
};

const SYSTEM = `أنت مساعد تربوي واستشاري متخصص في مرحلة الطفولة المبكرة والتعليم التحضيري وما قبل المدرسي.
الأطفال في هذه المرحلة لا ينجزون اختبارات ورقية ولا يحصلون على درجات أو معدلات، بل يتم تقييمهم عبر الملاحظة المستمرة واللعب الهادف ومجالات النمو الشاملة (الحركية، اللغوية، المعرفية، الاجتماعية، الوجدانية، والاستقلالية).
القواعد:
1. لغة عربية سليمة ومحفّزة ودافئة.
2. لا تشخيصات طبية أو نفسية؛ لا أحكام سلبية أو تصنيفات محبطة للطفل؛ كل طفل ينمو بوتيرته الخاصة.
3. اقتراحات عملية قابلة للتطبيق مستندة إلى اللعب الموجه والأنشطة الحسية الحركية، وأنشطة منزلية تفاعلية يشارك فيها الوالدان.
4. أنت لا تقدّم حكماً نهائياً بل مقترحات استرشادية تراجعها المربية.
أجب بـ JSON صالح فقط وفق المخطط المطلوب.`;

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 12) : []);

export function rulesStudent(d: StudentReportData): StudentAiResult {
  const a = analyzeStudent(d);
  const prog = d.progress.length >= 2 ? `تطور ملحوظ في مجالات النمو من فترة «${d.progress[d.progress.length - 2].periodName}» إلى «${d.progress[d.progress.length - 1].periodName}».` : "لا تتوفر فترتان مقيَّمتان للمقارنة بعد.";
  return {
    strengths: a.strengths.map((s) => `${s.skillName} (${s.subjectName})`),
    support: [...a.notAcquired, ...a.needsSupport].map((s) => `${s.skillName} (${s.subjectName}) — ${s.levelLabel}`),
    progressComparison: prog,
    remedialActivities: a.remedial.map((r) => r.activity),
    shortTermGoals: a.goals,
    parentSummary: a.parentSummary,
    teacherRecommendations: a.remedial.length ? ["التركيز على الألعاب الحسية والأنشطة العملية لدعم المهارات النامية.", "مشاركة الملاحظات الإيجابية مع الولي لتعزيز ثقة الطفل بنفسه.", "إعادة الملاحظة خلال الأنشطة الحرة والموجهة."] : ["مواصلة تعزيز المبادرة الذاتية وتقديم أنشطة إثرائية إبداعية."],
  };
}

export async function analyzeStudentAi(
  d: StudentReportData,
  customConfig?: AiConfig,
): Promise<{ result: StudentAiResult; source: "ai" | "rules"; provider: string; error?: string }> {
  const effectiveConfig = getEffectiveAiConfig(customConfig);
  if (!effectiveConfig) {
    return { result: rulesStudent(d), source: "rules", provider: providerLabel(null) };
  }

  const payload = {
    studentCode: "S1",
    levels: d.levels.map((l) => ({ label: l.label, value: l.value })),
    thresholds: { strength: d.strengthThreshold, support: d.supportThreshold },
    currentPeriod: d.periodName,
    results: d.results.map((r) => ({ subject: r.subjectName, skill: r.skillName, kind: r.kind, level: r.levelLabel, percent: r.percent })),
    progress: d.progress,
  };

  try {
    const j = await executeAiCall(
      effectiveConfig,
      SYSTEM,
      `بيانات تلميذ مجهول الهوية لمرحلة ما قبل التمدرس:\n${JSON.stringify(payload)}\n\nالمخطط المطلوب JSON: {"strengths":[],"support":[],"progressComparison":"","remedialActivities":[],"shortTermGoals":[],"parentSummary":"","teacherRecommendations":[]}`,
    );

    return {
      result: {
        strengths: arr(j.strengths),
        support: arr(j.support),
        progressComparison: String(j.progressComparison ?? ""),
        remedialActivities: arr(j.remedialActivities),
        shortTermGoals: arr(j.shortTermGoals),
        parentSummary: String(j.parentSummary ?? ""),
        teacherRecommendations: arr(j.teacherRecommendations),
      },
      source: "ai",
      provider: providerLabel(effectiveConfig),
    };
  } catch (e) {
    return {
      result: rulesStudent(d),
      source: "rules",
      provider: providerLabel(null),
      error: e instanceof Error ? e.message : "AI error",
    };
  }
}

export function rulesClass(d: ClassReportData): ClassAiResult {
  const c = analyzeClass(d);
  return {
    summary: c.avgOverall === null ? "لا توجد تقييمات كافية لتحليل القسم." : `المعدل العام للقسم ${c.avgOverall}% في الفترة «${d.periodName}». ${c.hardest.length} مهارة دون عتبة التميز و${c.best.length} مهارة متقنة.`,
    commonDifficulties: c.hardest.map((s) => `${s.skillName} (${s.subjectName}) — ${s.avgPercent}%`),
    strengths: c.best.map((s) => `${s.skillName} (${s.subjectName}) — ${s.avgPercent}%`),
    collectiveActivities: c.collectiveActivities,
    supportGroups: [
      ...(c.supportGroup.length ? [{ label: "مجموعة الدعم المكثف", students: c.supportGroup }] : []),
      ...(c.middleGroup.length ? [{ label: "مجموعة التدعيم", students: c.middleGroup }] : []),
      ...(c.advancedGroup.length ? [{ label: "مجموعة الإثراء", students: c.advancedGroup }] : []),
    ],
    enrichment: c.enrichment,
  };
}

export async function analyzeClassAi(
  d: ClassReportData,
  customConfig?: AiConfig,
): Promise<{ result: ClassAiResult; source: "ai" | "rules"; provider: string; error?: string }> {
  const effectiveConfig = getEffectiveAiConfig(customConfig);
  if (!effectiveConfig) {
    return { result: rulesClass(d), source: "rules", provider: providerLabel(null) };
  }

  const codes = new Map(d.students.map((s, i) => [`S${i + 1}`, s.fullName]));
  const payload = {
    period: d.periodName,
    thresholds: { strength: d.strengthThreshold, support: d.supportThreshold },
    students: d.students.map((s, i) => ({ code: `S${i + 1}`, overall: s.overallPct })),
    skills: d.skills.map((s) => ({ subject: s.subjectName, skill: s.skillName, avgPercent: s.avgPercent, counts: s.counts })),
    levels: d.levels.map((l) => ({ key: l.key, label: l.label })),
  };

  try {
    const j = await executeAiCall(
      effectiveConfig,
      SYSTEM,
      `بيانات قسم لمرحلة ما قبل التمدرس (التلاميذ مرمّزون لحماية الخصوصية):\n${JSON.stringify(payload)}\n\nالمخطط المطلوب JSON: {"summary":"","commonDifficulties":[],"strengths":[],"collectiveActivities":[],"supportGroups":[{"label":"","students":["S1"]}],"enrichment":[]}`,
    );

    const groups = Array.isArray(j.supportGroups) ? (j.supportGroups as { label?: unknown; students?: unknown }[]) : [];
    return {
      result: {
        summary: String(j.summary ?? ""),
        commonDifficulties: arr(j.commonDifficulties),
        strengths: arr(j.strengths),
        collectiveActivities: arr(j.collectiveActivities),
        supportGroups: groups.map((g) => ({ label: String(g.label ?? ""), students: arr(g.students).map((c) => codes.get(c) ?? "").filter(Boolean) })),
        enrichment: arr(j.enrichment),
      },
      source: "ai",
      provider: providerLabel(effectiveConfig),
    };
  } catch (e) {
    return {
      result: rulesClass(d),
      source: "rules",
      provider: providerLabel(null),
      error: e instanceof Error ? e.message : "AI error",
    };
  }
}
