import { pctByKind } from "./analysis";
import type { ClassReportData, StudentReportData } from "./report-types";

export function classDataFromStudents(
  list: StudentReportData[],
  base: { className: string; level: string; periodName: string; institution: ClassReportData["institution"]; levels: ClassReportData["levels"]; strengthThreshold: number; supportThreshold: number },
): ClassReportData {
  const skillMap = new Map<string, ClassReportData["skills"][number] & { sum: number }>();
  for (const st of list)
    for (const r of st.results) {
      const e = skillMap.get(r.skillId) ?? { skillName: r.skillName, subjectName: r.subjectName, kind: r.kind, avgPercent: 0, counts: {}, total: 0, sum: 0 };
      e.sum += r.percent;
      e.total++;
      e.counts[r.levelKey] = (e.counts[r.levelKey] ?? 0) + 1;
      skillMap.set(r.skillId, e);
    }
  const skills = [...skillMap.values()].map(({ sum, ...s }) => ({ ...s, avgPercent: Math.round((sum / s.total) * 10) / 10 }));
  return {
    ...base,
    students: list.map((s) => {
      const overall = s.results.length ? Math.round((s.results.reduce((a, r) => a + r.percent, 0) / s.results.length) * 10) / 10 : null;
      return { id: s.student.id, fullName: s.student.fullName, gender: s.student.gender, academicPct: pctByKind(s.results, "academic"), behavioralPct: pctByKind(s.results, "behavioral"), overallPct: overall, evaluated: s.results.length };
    }),
    skills,
  };
}
