// Pure import helpers: delimiter parsing, column auto-mapping (AR/FR/EN), normalization, validation, duplicate detection.

export const FIELDS = [
  { key: "fullName", label: "الاسم الكامل" },
  { key: "lastName", label: "اللقب" },
  { key: "firstName", label: "الاسم الشخصي" },
  { key: "birthDate", label: "تاريخ الميلاد" },
  { key: "gender", label: "الجنس" },
  { key: "level", label: "المستوى" },
  { key: "className", label: "القسم" },
  { key: "nationalId", label: "رقم التعريف" },
  { key: "notes", label: "ملاحظات" },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];

const ALIASES: Record<FieldKey, string[]> = {
  fullName: ["الاسم", "الاسم الكامل", "اسم التلميذ", "الاسم و اللقب", "اللقب والاسم", "اسم ولقب", "nom complet", "nom et prenom", "nom prenom", "full name", "fullname", "name", "eleve", "student", "nom_complet", "تلميذ"],
  lastName: ["اللقب", "لقب", "nom", "nom de famille", "last name", "lastname", "family name", "surname"],
  firstName: ["الاسم الشخصي", "الاسم الأول", "اسم", "prenom", "first name", "firstname", "given name"],
  birthDate: ["تاريخ الميلاد", "الميلاد", "تاريخ الازدياد", "date de naissance", "naissance", "date naissance", "dob", "birth date", "birthdate", "birthday", "date_naissance", "ddn"],
  gender: ["الجنس", "النوع", "sexe", "genre", "gender", "sex"],
  level: ["المستوى", "السنة", "المستوى الدراسي", "niveau", "level", "grade", "année", "annee"],
  className: ["القسم", "الفوج", "الفصل", "classe", "class", "groupe", "section", "group"],
  nationalId: ["رقم التعريف", "رقم التسجيل", "رقم التلميذ", "المعرف", "matricule", "id", "identifiant", "numero", "n°", "code", "student id", "national id", "num_id", "massar", "رقم مسار"],
  notes: ["ملاحظات", "ملاحظة", "remarques", "observations", "notes", "remarque", "comment"],
};

export function normKey(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[_\-.:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripDiacritics(s: string): string {
  return s.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
}

export function normName(s: string): string {
  return stripDiacritics(String(s ?? ""))
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function parseDelimited(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLines = t.split("\n").filter((l) => l.trim()).slice(0, 5);
  const count = (d: string) => firstLines.reduce((a, l) => a + l.split(d).length - 1, 0);
  const cands = ["\t", ";", ",", "|"].map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1]);
  const delim = cands[0][1] > 0 ? cands[0][0] : "\u0000";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n") {
      row.push(cell.trim());
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export function autoMapField(header: string): FieldKey | "" {
  const h = normKey(header);
  if (!h) return "";
  // exact alias first, in an order that prefers specific fields
  const order: FieldKey[] = ["nationalId", "birthDate", "gender", "className", "level", "fullName", "lastName", "firstName", "notes"];
  for (const k of order) if (ALIASES[k].some((a) => normKey(a) === h)) return k;
  for (const k of order) if (ALIASES[k].some((a) => normKey(a).length > 3 && h.includes(normKey(a)))) return k;
  return "";
}

export type TableInput = { headers: string[]; rows: string[][]; headerDetected: boolean };

/** Decide whether first row is a header; build generic headers otherwise. */
export function toTable(raw: string[][], assumeHeader?: boolean): TableInput {
  if (!raw.length) return { headers: [], rows: [], headerDetected: false };
  const width = Math.max(...raw.map((r) => r.length));
  const pad = raw.map((r) => [...r, ...Array(width - r.length).fill("")]);
  const matches = pad[0].filter((c) => autoMapField(c) !== "").length;
  const detected = assumeHeader ?? matches >= 1;
  if (detected) return { headers: pad[0].map((h, i) => h || `عمود ${i + 1}`), rows: pad.slice(1), headerDetected: true };
  if (width === 1) return { headers: ["الاسم الكامل"], rows: pad, headerDetected: false };
  return { headers: pad[0].map((_, i) => `عمود ${i + 1}`), rows: pad, headerDetected: false };
}

export type Mapping = Record<string, string>; // header -> FieldKey | "extra" | ""

export function autoMapping(headers: string[], saved?: Mapping | null): Mapping {
  const m: Mapping = {};
  const used = new Set<string>();
  headers.forEach((h, i) => {
    let v = saved && h in saved ? saved[h] : autoMapField(h);
    if (headers.length === 1 && !v) v = "fullName";
    if (!v) v = i === 0 && headers.every((x) => autoMapField(x) === "") ? "fullName" : "extra";
    if (v !== "extra" && v !== "" && used.has(v)) v = "extra";
    if (v !== "extra" && v !== "") used.add(v);
    m[h] = v;
  });
  return m;
}

export function normalizeDate(input: unknown): { value: string | null; error?: string } {
  if (input === null || input === undefined) return { value: null };
  let s = String(input).trim();
  if (!s) return { value: null };
  s = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let y: number, m: number, d: number;
  let mt: RegExpExecArray | null;
  if ((mt = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) {
    [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  } else if ((mt = /^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})/.exec(s))) {
    [d, m, y] = [+mt[1], +mt[2], +mt[3]];
    if (y < 100) y += y > 30 ? 1900 : 2000;
  } else if (/^\d{5}$/.test(s)) {
    const dt = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else return { value: null, error: `تاريخ ميلاد غير مفهوم: «${s}»` };
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return { value: null, error: `تاريخ غير صحيح: «${s}»` };
  const now = new Date().getUTCFullYear();
  if (y < 1990 || y > now) return { value: null, error: `سنة الميلاد غير منطقية: ${y}` };
  return { value: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

export function normalizeGender(input: unknown): { value: "M" | "F" | null; error?: string } {
  const s = normKey(String(input ?? ""));
  if (!s) return { value: null };
  if (/^(m|h|g|male|homme|garcon|masculin|ذكر|ذ|ولد|صبي|1)$/.test(s)) return { value: "M" };
  if (/^(f|female|femme|fille|feminin|انثى|أنثى|ا|أ|بنت|2)$/.test(s) || s === "انثي") return { value: "F" };
  return { value: null, error: `قيمة الجنس غير مفهومة: «${input}»` };
}

export type NormalizedRow = {
  index: number; // 0-based position in file
  data: {
    fullName: string;
    birthDate: string | null;
    gender: "M" | "F" | null;
    level: string;
    className: string;
    nationalId: string;
    notes: string;
    extra: Record<string, string>;
  };
  errors: string[];
  warnings: string[];
};

export function normalizeRows(table: { headers: string[]; rows: string[][] }, mapping: Mapping): NormalizedRow[] {
  const idx = (f: string) => table.headers.findIndex((h) => mapping[h] === f);
  const iF = Object.fromEntries(FIELDS.map((f) => [f.key, idx(f.key)])) as Record<FieldKey, number>;
  const extraCols = table.headers.map((h, i) => ({ h, i })).filter((c) => mapping[c.h] === "extra");
  return table.rows.map((r, index) => {
    const get = (k: FieldKey) => (iF[k] >= 0 ? String(r[iF[k]] ?? "").trim() : "");
    const errors: string[] = [];
    const warnings: string[] = [];
    let fullName = get("fullName");
    if (!fullName) fullName = [get("lastName"), get("firstName")].filter(Boolean).join(" ");
    fullName = fullName.replace(/\s+/g, " ").trim();
    if (!fullName) errors.push("الاسم مفقود");
    else if (fullName.length < 3) errors.push("الاسم قصير جدًا");
    const bd = normalizeDate(get("birthDate"));
    if (bd.error) errors.push(bd.error);
    else if (!bd.value) warnings.push("تاريخ الميلاد ناقص");
    const g = normalizeGender(get("gender"));
    if (g.error) errors.push(g.error);
    else if (!g.value) warnings.push("الجنس ناقص");
    const extra: Record<string, string> = {};
    for (const c of extraCols) if (String(r[c.i] ?? "").trim()) extra[c.h] = String(r[c.i]).trim();
    return {
      index,
      data: { fullName, birthDate: bd.value, gender: g.value, level: get("level"), className: get("className"), nationalId: get("nationalId"), notes: get("notes"), extra },
      errors,
      warnings,
    };
  });
}

export type ExistingStudent = { id: string; fullName: string; birthDate: string | null; nationalId: string | null; classId: string | null };
export type DuplicateInfo = { kind: "exact" | "likely" | "possible" | "in_file"; targetId?: string; targetName?: string; withRow?: number; reason: string };

/** Never relies on name alone for "exact"; name-only matches are "possible" and need confirmation. */
export function detectDuplicates(rows: NormalizedRow[], existing: ExistingStudent[]): (DuplicateInfo | null)[] {
  const byNid = new Map<string, ExistingStudent>();
  const byNameBirth = new Map<string, ExistingStudent>();
  const byName = new Map<string, ExistingStudent>();
  for (const e of existing) {
    if (e.nationalId) byNid.set(e.nationalId.trim().toLowerCase(), e);
    const n = normName(e.fullName);
    if (e.birthDate) byNameBirth.set(`${n}|${e.birthDate}`, e);
    byName.set(n, e);
  }
  const seenNid = new Map<string, number>();
  const seenNB = new Map<string, number>();
  return rows.map((r) => {
    if (r.errors.length) return null;
    const nid = r.data.nationalId.trim().toLowerCase();
    const n = normName(r.data.fullName);
    if (nid && byNid.has(nid)) {
      const t = byNid.get(nid)!;
      return { kind: "exact", targetId: t.id, targetName: t.fullName, reason: "نفس رقم التعريف موجود مسبقًا" };
    }
    const nb = r.data.birthDate ? `${n}|${r.data.birthDate}` : "";
    if (nb && byNameBirth.has(nb)) {
      const t = byNameBirth.get(nb)!;
      return { kind: "likely", targetId: t.id, targetName: t.fullName, reason: "نفس الاسم وتاريخ الميلاد" };
    }
    if (nid && seenNid.has(nid)) return { kind: "in_file", withRow: seenNid.get(nid)! + 1, reason: `رقم التعريف مكرر في الملف (السطر ${seenNid.get(nid)! + 1})` };
    if (nb && seenNB.has(nb)) return { kind: "in_file", withRow: seenNB.get(nb)! + 1, reason: `نفس الاسم وتاريخ الميلاد مكرر في الملف (السطر ${seenNB.get(nb)! + 1})` };
    if (nid) seenNid.set(nid, r.index);
    if (nb) seenNB.set(nb, r.index);
    if (byName.has(n)) {
      const t = byName.get(n)!;
      return { kind: "possible", targetId: t.id, targetName: t.fullName, reason: "اسم مطابق لتلميذ موجود (تاريخ الميلاد مختلف أو غير متوفر)" };
    }
    return null;
  });
}
