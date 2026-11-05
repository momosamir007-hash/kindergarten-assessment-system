// Heuristic converter for legacy JSON exports (e.g. students_data.json of the old Streamlit app).
// It never modifies the source; anything it cannot map is preserved in `extra.legacy`.
import { autoMapField, normKey, normalizeDate, normalizeGender } from "./import";

export type LegacyEval = { subject: string; skill: string; levelRaw: string; date: string | null; note: string; period: string; behavioral: boolean };
export type LegacyStudent = {
  fullName: string;
  birthDate: string | null;
  gender: "M" | "F" | null;
  level: string;
  className: string;
  nationalId: string;
  notes: string;
  extra: Record<string, unknown>;
  evaluations: LegacyEval[];
};

const NAME_KEYS = ["name", "nom", "full name", "fullname", "nom complet", "الاسم", "الاسم الكامل", "اسم التلميذ", "nom et prenom", "student name", "eleve"];
const EVAL_KEYS = ["evaluations", "evaluation", "assessments", "assessment", "scores", "results", "resultats", "competences", "skills", "matieres", "subjects", "تقييمات", "التقييمات", "تقييم", "نتائج", "النتائج", "المواد", "المهارات", "behavior", "behaviour", "comportement", "سلوك", "السلوك", "تقييم سلوكي", "التقييم السلوكي", "academic", "اكاديمي", "التقييم الاكاديمي", "history", "historique", "سجل", "السجل", "progress", "تطور"];
const BEHAV_HINT = /(behav|comport|سلوك|social|اجتماع|حركي|moteur|autonom|استقلال)/i;
const LEVEL_KEYS = ["level", "niveau", "مستوى", "المستوى", "value", "valeur", "score", "status", "etat", "الحالة", "تقييم", "evaluation", "result"];
const DATE_KEYS = ["date", "تاريخ", "التاريخ", "evaluated at", "evaluated_at", "created"];
const NOTE_KEYS = ["note", "notes", "remarque", "ملاحظة", "ملاحظات", "comment", "observation"];
const SKILL_KEYS = ["skill", "competence", "مهارة", "المهارة", "item", "critere", "name", "nom", "الاسم"];
const SUBJECT_KEYS = ["subject", "matiere", "مادة", "المادة", "domain", "domaine", "المجال", "category", "categorie"];
const PERIOD_KEYS = ["period", "periode", "trimestre", "semester", "الفترة", "الفصل", "term"];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const scalar = (v: unknown) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";
const findKey = (o: Record<string, unknown>, names: string[]) => Object.keys(o).find((k) => names.includes(normKey(k)));
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const looksLikeDate = (k: string) => normalizeDate(k).value !== null;

function walkEvals(node: unknown, path: string[], ctx: { date: string | null; period: string }, out: LegacyEval[], behavioral: boolean) {
  if (Array.isArray(node)) {
    node.forEach((n) => walkEvals(n, path, ctx, out, behavioral));
    return;
  }
  if (isObj(node)) {
    const lk = findKey(node, LEVEL_KEYS);
    const sk = findKey(node, SKILL_KEYS);
    if (lk && scalar(node[lk]) && (sk || path.length)) {
      const dk = findKey(node, DATE_KEYS);
      const nk = findKey(node, NOTE_KEYS);
      const sj = findKey(node, SUBJECT_KEYS);
      const pk = findKey(node, PERIOD_KEYS);
      const skill = sk && scalar(node[sk]) ? str(node[sk]) : path[path.length - 1];
      const subject = sj ? str(node[sj]) : path.length > (sk ? 0 : 1) ? path[path.length - (sk ? 1 : 2)] ?? "" : "";
      out.push({
        subject: subject || "مواد مستوردة",
        skill,
        levelRaw: str(node[lk]),
        date: dk ? normalizeDate(node[dk]).value ?? ctx.date : ctx.date,
        note: nk ? str(node[nk]) : "",
        period: pk ? str(node[pk]) : ctx.period,
        behavioral: behavioral || BEHAV_HINT.test(subject),
      });
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (looksLikeDate(k)) walkEvals(v, path, { ...ctx, date: normalizeDate(k).value }, out, behavioral);
      else walkEvals(v, [...path, k], ctx, out, behavioral || BEHAV_HINT.test(k));
    }
    return;
  }
  if (scalar(node) && path.length >= 1 && str(node) !== "") {
    out.push({
      subject: path.length >= 2 ? path[path.length - 2] : "مواد مستوردة",
      skill: path[path.length - 1],
      levelRaw: str(node),
      date: ctx.date,
      note: "",
      period: ctx.period,
      behavioral: behavioral || BEHAV_HINT.test(path.join(" ")),
    });
  }
}

function toStudent(raw: Record<string, unknown>, fallbackName: string): LegacyStudent | null {
  const flat: Record<string, unknown> = {};
  const extra: Record<string, unknown> = { legacy: {} };
  const legacy = extra.legacy as Record<string, unknown>;
  const evalNodes: [string, unknown][] = [];
  for (const [k, v] of Object.entries(raw)) {
    const nk = normKey(k);
    if (scalar(v)) flat[k] = v;
    else if (EVAL_KEYS.includes(nk) && v !== null) evalNodes.push([k, v]);
    else if (isObj(v) && /(info|personal|معلومات|identite|profil)/.test(nk)) Object.entries(v).forEach(([k2, v2]) => scalar(v2) && (flat[k2] = v2));
    else if (v !== null && v !== undefined) legacy[k] = v;
  }
  const nameKey = findKey(flat, NAME_KEYS);
  let fullName = nameKey ? str(flat[nameKey]) : "";
  if (!fullName) {
    const ln = Object.keys(flat).find((k) => autoMapField(k) === "lastName");
    const fn = Object.keys(flat).find((k) => autoMapField(k) === "firstName");
    fullName = [ln && str(flat[ln]), fn && str(flat[fn])].filter(Boolean).join(" ");
  }
  if (!fullName) fullName = fallbackName;
  if (!fullName) return null;
  const pick = (f: string) => {
    const k = Object.keys(flat).find((x) => autoMapField(x) === f);
    return k ? str(flat[k]) : "";
  };
  for (const [k, v] of Object.entries(flat)) if (autoMapField(k) === "" && !(nameKey && k === nameKey)) extra[k] = v;
  const evaluations: LegacyEval[] = [];
  for (const [k, v] of evalNodes) walkEvals(v, [], { date: null, period: "" }, evaluations, BEHAV_HINT.test(k));
  // evaluation nodes whose structure we could not parse are preserved
  if (evalNodes.length && !evaluations.length) for (const [k, v] of evalNodes) legacy[k] = v;
  if (!Object.keys(legacy).length) delete extra.legacy;
  return {
    fullName,
    birthDate: normalizeDate(pick("birthDate")).value,
    gender: normalizeGender(pick("gender")).value,
    level: pick("level"),
    className: pick("className"),
    nationalId: pick("nationalId"),
    notes: pick("notes"),
    extra,
    evaluations,
  };
}

export function parseLegacy(json: unknown): { students: LegacyStudent[]; warnings: string[] } {
  const warnings: string[] = [];
  let items: [string, Record<string, unknown>][] = [];
  const fromArray = (a: unknown[]) => a.filter(isObj).map((o) => ["", o] as [string, Record<string, unknown>]);
  if (Array.isArray(json)) items = fromArray(json);
  else if (isObj(json)) {
    const holder = Object.entries(json).find(([k, v]) => Array.isArray(v) && ["students", "eleves", "تلاميذ", "التلاميذ", "data"].includes(normKey(k)));
    if (holder) items = fromArray(holder[1] as unknown[]);
    else {
      const nested = Object.entries(json).find(([k, v]) => isObj(v) && ["students", "eleves", "تلاميذ", "التلاميذ", "data"].includes(normKey(k)));
      const dict = nested ? (nested[1] as Record<string, unknown>) : json;
      items = Object.entries(dict).filter((e): e is [string, Record<string, unknown>] => isObj(e[1]));
    }
  }
  if (!items.length) warnings.push("لم يتم العثور على سجلات تلاميذ في الملف.");
  const students: LegacyStudent[] = [];
  items.forEach(([key, obj], i) => {
    const s = toStudent(obj, key);
    if (s) students.push(s);
    else warnings.push(`السجل رقم ${i + 1} بدون اسم — تم تجاهله.`);
  });
  return { students, warnings };
}
