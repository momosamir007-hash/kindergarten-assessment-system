import { DEFAULT_LEVELS, toPercent } from "../src/lib/levels";
import type { ClassReportData, SkillResult, StudentReportData } from "../src/lib/report-types";

const SUBJECTS: { name: string; kind: "academic" | "behavioral"; skills: string[] }[] = [
  { name: "اللغة العربية", kind: "academic", skills: ["قراءة نص قصير قراءة سليمة", "التعبير الكتابي عن وضعية", "إملاء الكلمات المألوفة"] },
  { name: "الرياضيات", kind: "academic", skills: ["العمليات الأربع على الأعداد", "حل مسألة بسيطة", "التعرف على الأشكال الهندسية"] },
  { name: "المهارات الاجتماعية", kind: "behavioral", skills: ["التعاون مع الزملاء", "احترام قواعد القسم", "المشاركة الشفوية"] },
];

const FIRST = ["محمد", "عبد الرحمن", "فاطمة الزهراء", "أسامة", "خديجة", "يوسف", "مريم", "عبد الله"];
const LAST = ["بن عبد القادر الحسني", "المرابطي", "السعدي الإدريسي", "بوعزيز", "الأنصاري", "قاسمي"];

export function makeStudent(i: number, opts: { longName?: boolean } = {}): StudentReportData {
  const levels = DEFAULT_LEVELS;
  const results: SkillResult[] = [];
  let k = 0;
  for (const s of SUBJECTS)
    for (const sk of s.skills) {
      const lv = levels[(i + k++) % levels.length];
      results.push({
        skillId: `sk-${s.name}-${sk}`,
        skillName: sk,
        subjectId: s.name,
        subjectName: s.name,
        kind: s.kind,
        levelKey: lv.key,
        levelLabel: lv.label,
        score: lv.value,
        percent: toPercent(lv.value, levels),
        note: k % 3 === 0 ? "يحتاج إلى مزيد من التشجيع (ملاحظة 12) ويبدي تحسنًا" : "",
        evaluatedAt: "2025-11-20T08:00:00.000Z",
        teacher: "أستاذ تجريبي",
      });
    }
  const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}${opts.longName ? " " + LAST[(i + 1) % LAST.length] + " " + LAST[(i + 2) % LAST.length] + " بن محمد بن علي" : ""} ${i}`;
  return {
    institution: { name: "مدرسة الاختبار الابتدائية", academicYear: "2025/2026", city: "الجزائر" },
    student: { id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, fullName: name, birthDate: "2017-03-14", gender: i % 2 ? "F" : "M", nationalId: `ID${1000 + i}`, className: "السنة الثانية أ", level: "السنة الثانية" },
    periodName: "الفصل الأول",
    levels,
    results,
    progress: [
      { periodName: "التشخيصي", academicPct: 40, behavioralPct: 50 },
      { periodName: "الفصل الأول", academicPct: 60, behavioralPct: 70 },
    ],
    strengthThreshold: 80,
    supportThreshold: 50,
  };
}

export function makeClass(n: number): { students: StudentReportData[]; cls: ClassReportData } {
  const students = Array.from({ length: n }, (_, i) => makeStudent(i));
  const skillMap = new Map<string, ClassReportData["skills"][number]>();
  for (const st of students)
    for (const r of st.results) {
      const e = skillMap.get(r.skillId) ?? { skillName: r.skillName, subjectName: r.subjectName, kind: r.kind, avgPercent: 0, counts: {}, total: 0 };
      e.avgPercent += r.percent;
      e.total++;
      e.counts[r.levelKey] = (e.counts[r.levelKey] ?? 0) + 1;
      skillMap.set(r.skillId, e);
    }
  const skills = [...skillMap.values()].map((s) => ({ ...s, avgPercent: Math.round((s.avgPercent / s.total) * 10) / 10 }));
  const cls: ClassReportData = {
    institution: students[0].institution,
    className: "السنة الثانية أ",
    level: "السنة الثانية",
    periodName: "الفصل الأول",
    levels: DEFAULT_LEVELS,
    students: students.map((s) => {
      const avg = Math.round((s.results.reduce((a, r) => a + r.percent, 0) / s.results.length) * 10) / 10;
      return { id: s.student.id, fullName: s.student.fullName, gender: s.student.gender, academicPct: avg, behavioralPct: avg, overallPct: avg, evaluated: s.results.length };
    }),
    skills,
    strengthThreshold: 80,
    supportThreshold: 50,
  };
  return { students, cls };
}
