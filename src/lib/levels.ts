// Evaluation levels & calculation config (pure, shared by client/server/tests).

export type Level = {
  key: string;
  label: string;
  value: number; // numeric value used in calculations (editable)
  color: string; // hex
};

export const DEFAULT_LEVELS: Level[] = [
  { key: "not_acquired", label: "في بداية الظهور / قيد الملاحظة", value: 0, color: "#64748b" },
  { key: "in_progress", label: "في طور الاكتساب (بمساعدة)", value: 1, color: "#d97706" },
  { key: "acquired", label: "مكتسب باستقلالية", value: 2, color: "#16a34a" },
];

export type AiProviderId =
  | "gemini"
  | "openai"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "mistral"
  | "custom";

export type AiConfig = {
  provider: AiProviderId;
  apiKey: string;
  baseUrl?: string;
  model: string;
  enabled?: boolean;
};

export type InstitutionSettings = {
  levels: Level[];
  // percentage thresholds used by the analysis
  strengthThreshold: number; // >= => strength
  supportThreshold: number; // < => needs support
  schoolName?: string;
  teacherSignatureLabel?: string;
  reportTemplates?: ReportOptions[];
  ai?: AiConfig;
};

export const DEFAULT_SETTINGS: InstitutionSettings = {
  levels: DEFAULT_LEVELS,
  strengthThreshold: 80,
  supportThreshold: 50,
};

export type ReportOptions = {
  name?: string;
  studentInfo: boolean;
  academic: boolean;
  behavioral: boolean;
  analysis: boolean;
  remedial: boolean;
  charts: boolean;
  progress: boolean;
  teacherNotes: boolean;
  signature: boolean;
  showPercentages?: boolean; // false for preschool/kindergarten qualitative developmental view
  mode: "color" | "bw" | "eco"; // eco = economical printing
};

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  studentInfo: true,
  academic: true,
  behavioral: true,
  analysis: true,
  remedial: true,
  charts: true,
  progress: true,
  teacherNotes: true,
  signature: true,
  showPercentages: false,
  mode: "color",
};

export function mergeSettings(raw: Record<string, unknown> | null | undefined): InstitutionSettings {
  const r = (raw ?? {}) as Partial<InstitutionSettings>;
  const levels = Array.isArray(r.levels) && r.levels.length >= 2 ? r.levels : DEFAULT_LEVELS;
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    levels: [...levels].sort((a, b) => a.value - b.value),
  };
}

export function maxLevelValue(levels: Level[]): number {
  return Math.max(...levels.map((l) => l.value), 1);
}

export function levelByKey(levels: Level[], key: string): Level | undefined {
  return levels.find((l) => l.key === key);
}

/** Percentage 0..100 of a numeric score given the levels. */
export function toPercent(score: number, levels: Level[]): number {
  const max = maxLevelValue(levels);
  return Math.round((score / max) * 1000) / 10;
}

/** Find the level matching free text (label, key, numeric value, common abbreviations). */
export function matchLevel(input: unknown, levels: Level[]): Level | undefined {
  if (input === null || input === undefined) return undefined;
  const raw = String(input).trim();
  if (!raw) return undefined;
  const norm = raw.toLowerCase().replace(/\s+/g, " ");
  for (const l of levels) {
    if (l.key === norm || l.label === raw) return l;
  }
  // order matters: check "not acquired" forms before "acquired"
  const notAcq = /(غير\s*مكتسب|لم\s*يكتسب|بداية\s*الظهور|قيد\s*الملاحظة|لم\s*يُ?لاحظ|na\b|non\s*acquis|not\s*acquired|^0$)/i;
  const prog = /(في\s*طريق|في\s*طور|قيد\s*الاكتساب|طور\s*الاكتساب|بمساعدة|partiel|en\s*cours|\bec\b|in\s*progress|developing|^1$)/i;
  const acq = /(مكتسب|باستقلالية|acquis|\ba\b|acquired|\bok\b|^2$|^3$)/i;
  const sorted = [...levels].sort((a, b) => a.value - b.value);
  if (notAcq.test(norm)) return sorted[0];
  if (prog.test(norm) && sorted.length > 2) return sorted[Math.floor((sorted.length - 1) / 2)];
  if (acq.test(norm)) return sorted[sorted.length - 1];
  const n = Number(norm.replace(",", "."));
  if (!Number.isNaN(n)) {
    const exact = levels.find((l) => l.value === n);
    if (exact) return exact;
  }
  return undefined;
}
