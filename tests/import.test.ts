import { describe, expect, it } from "vitest";
import { autoMapping, detectDuplicates, normalizeDate, normalizeGender, normalizeRows, parseDelimited, toTable } from "../src/lib/import";
import { parseLegacy } from "../src/lib/legacy";
import { DEFAULT_LEVELS, matchLevel } from "../src/lib/levels";

describe("import", () => {
  it("maps French/Arabic digitization columns", () => {
    const t = toTable(parseDelimited("Nom;Prénom;Date de naissance;Sexe;Matricule\nبن علي;أحمد;14/03/2017;ذكر;A1\nSaid;Lina;2016-01-02;F;A2"));
    const m = autoMapping(t.headers);
    expect(m["Nom"]).toBe("lastName");
    expect(m["Date de naissance"]).toBe("birthDate");
    expect(m["Matricule"]).toBe("nationalId");
    const rows = normalizeRows(t, m);
    expect(rows[0].data.fullName).toBe("بن علي أحمد");
    expect(rows[0].data.birthDate).toBe("2017-03-14");
    expect(rows[0].data.gender).toBe("M");
    expect(rows[1].data.gender).toBe("F");
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });
  it("accepts a pasted list of names", () => {
    const t = toTable(parseDelimited("أحمد بن علي\nفاطمة الزهراء"));
    expect(t.headers).toEqual(["الاسم الكامل"]);
    expect(normalizeRows(t, autoMapping(t.headers)).map((r) => r.data.fullName)).toEqual(["أحمد بن علي", "فاطمة الزهراء"]);
  });
  it("understands Arabic gender words", () => {
    expect(normalizeGender("أنثى").value).toBe("F");
    expect(normalizeGender("ذكر").value).toBe("M");
    expect(normalizeGender("fille").value).toBe("F");
  });
  it("reports invalid data", () => {
    expect(normalizeDate("31/02/2017").error).toBeTruthy();
    expect(normalizeDate("١٤/٠٣/٢٠١٧").value).toBe("2017-03-14");
    const t = { headers: ["الاسم", "الجنس"], rows: [["", "x"]] };
    const [r] = normalizeRows(t, { الاسم: "fullName", الجنس: "gender" });
    expect(r.errors.length).toBe(2);
  });
  it("detects duplicates without relying on name alone", () => {
    const t = { headers: ["n", "b", "i"], rows: [["محمد أمين", "2017-01-01", "X1"], ["أمين محمد", "2017-01-01", ""], ["محمد أمين", "2018-05-05", ""], ["سارة", "", "X1"]] };
    const rows = normalizeRows(t, { n: "fullName", b: "birthDate", i: "nationalId" });
    const d = detectDuplicates(rows, [{ id: "1", fullName: "محمد أمين", birthDate: "2017-01-01", nationalId: "X1", classId: null }]);
    expect(d[0]?.kind).toBe("exact");
    expect(d[1]?.kind).toBe("likely"); // token order differs, same birth date
    expect(d[2]?.kind).toBe("possible"); // name only -> needs confirmation
    expect(d[3]?.kind).toBe("exact");
  });
});

describe("levels & legacy", () => {
  it("matches level text", () => {
    expect(matchLevel("مكتسب", DEFAULT_LEVELS)?.key).toBe("acquired");
    expect(matchLevel("غير مكتسب", DEFAULT_LEVELS)?.key).toBe("not_acquired");
    expect(matchLevel("في طريق الاكتساب", DEFAULT_LEVELS)?.key).toBe("in_progress");
    expect(matchLevel("???", DEFAULT_LEVELS)).toBeUndefined();
  });
  it("parses nested legacy structures and preserves unknown data", () => {
    const { students } = parseLegacy({
      "أحمد بن علي": { الجنس: "ذكر", "تاريخ الميلاد": "2017-03-14", التقييمات: { الرياضيات: { "العدّ": "مكتسب", "الجمع": "غير مكتسب" } }, ملاحظات_خاصة: { a: 1 } },
      other: { name: "Lina", history: [{ date: "2025-10-01", subject: "اللغة", skill: "القراءة", level: "في طريق الاكتساب" }] },
    });
    expect(students.length).toBe(2);
    expect(students[0].evaluations.length).toBe(2);
    expect(students[0].extra.legacy).toBeTruthy();
    expect(students[1].evaluations[0]).toMatchObject({ subject: "اللغة", skill: "القراءة", date: "2025-10-01" });
  });
});
