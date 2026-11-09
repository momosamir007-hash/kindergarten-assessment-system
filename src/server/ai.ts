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

const SYSTEM = `أنت مربية أطفال واستشارية تربوية خبيرة ومحبة في مرحلة الطفولة المبكرة والتعليم التحضيري (ما قبل المدرسي).
تحدثي بصوت المربية الحنون والمهني المشجع، كأنك تكتبين رسالة شخصية دافئة تفخر بخطوات الطفل الأولى.

القواعد الصارمة:
1. ممنوع منعاً باتاً البدء بعبارات إدارية جافة مثل "عزيزي/عزيزتي الوالد(ة)" أو "نلاحظ أن طفلك لا يزال في مرحلة البداية".
2. خاطبي ولي الأمر بنبرة حب واعتزاز، وسمّي الطفل باسمه الأول بود ودفء.
3. التقرير وصفي إيجابي يحتفي بتفرد الطفل ونموه الفطري؛ لا أحكام سلبية ولا تصنيفات محبطة ولا مقارنات جافة.
4. في (parentSummary): اكتبي فقرة بليغة وقصيرة (من 3 إلى 4 أسطر كحد أقصى) تجمع بين:
   - لمحة إيجابية ومبهجة عن شخصية الطفل ومشاركته في الروضة.
   - ما تميز فيه واستمتع به.
   - المهارة النامية التي نرافقه فيها برفق لنبني ثقته بنفسه.
   - نصيحة أسرية دافئة بسيطة (مثل حكاية قبل النوم، تبادل أطراف الحديث، اللعب اليومي).
5. في الأنشطة المقترحة (remedialActivities): قدمي نشاطين إلى ثلاثة أنشطة أسرية ممتعة جداً ولطيفة في البيت (مثل: لعبة الألوان في غرفة الجلوس، اللعب بالعجين، ترتيب أدوات المائدة معاً) وتجنبي المصطلحات المدرسية الجافة.
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

  const isFemale = d.student.gender === "F";
  const firstName = d.student.fullName.split(" ")[0] || (isFemale ? "الطفلة" : "الطفل");
  const payload = {
    childName: firstName,
    gender: isFemale ? "أنثى" : "ذكر",
    level: d.student.level || "التعليم التحضيري (4-5 سنوات)",
    currentPeriod: d.periodName,
    results: d.results.map((r) => ({
      subject: r.subjectName,
      skill: r.skillName,
      level: r.levelLabel,
      percent: r.percent,
    })),
    progress: d.progress,
  };

  try {
    const j = await executeAiCall(
      effectiveConfig,
      SYSTEM,
      `بيانات متابعة نمائية وتربوية للطفل(ة) «${firstName}» لمرحلة التعليم التحضيري والطفولة المبكرة:\n${JSON.stringify(payload)}\n\nالمخطط المطلوب JSON: {"strengths":["أبرز نقاط قوة الطفولة"],"support":["مهارات في طور التفتح"],"progressComparison":"تطور نمائي دافئ ومختصر","remedialActivities":["فكرة نشاط منزلي ممتع وبسيط 1","فكرة نشاط منزلي ممتع وبسيط 2"],"shortTermGoals":["هدف تشجيعي لطيف"],"parentSummary":"فقرة دافئة وملهمة وموجزة للأسرة تخاطبهم بمحبة وتذكر اسم الطفل","teacherRecommendations":["توصية عملية محبة للمربية"]}`,
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
