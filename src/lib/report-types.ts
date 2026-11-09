import type { Level, ReportOptions } from "./levels";

export type SkillResult = {
  skillId: string;
  skillName: string;
  subjectId: string;
  subjectName: string;
  kind: "academic" | "behavioral";
  levelKey: string;
  levelLabel: string;
  score: number;
  percent: number;
  note: string;
  evaluatedAt: string; // ISO
  teacher: string;
};

export type InstitutionInfo = {
  name: string;
  academicYear: string;
  city: string;
  logo?: string | null; // data URL
  signatureLabel?: string;
};

export type StudentInfo = {
  id: string;
  fullName: string;
  birthDate: string | null;
  gender: string | null;
  nationalId: string | null;
  className: string;
  level: string;
  notes?: string;
  photo?: string | null;
};

export type ProgressPoint = {
  periodName: string;
  academicPct: number | null;
  behavioralPct: number | null;
};

export type StudentReportData = {
  institution: InstitutionInfo;
  student: StudentInfo;
  periodName: string;
  levels: Level[];
  results: SkillResult[];
  progress: ProgressPoint[];
  strengthThreshold: number;
  supportThreshold: number;
  aiText?: { parentSummary?: string; goals?: string[]; activities?: string[]; source?: "ai" | "rules" } | null;
};

export type ClassReportData = {
  institution: InstitutionInfo;
  className: string;
  level: string;
  periodName: string;
  levels: Level[];
  students: { id: string; fullName: string; gender: string | null; academicPct: number | null; behavioralPct: number | null; overallPct: number | null; evaluated: number }[];
  /** per skill aggregate */
  skills: { skillName: string; subjectName: string; kind: string; avgPercent: number; counts: Record<string, number>; total: number }[];
  strengthThreshold: number;
  supportThreshold: number;
};

export type ReportContext = {
  options: ReportOptions;
};
