import { eq } from "drizzle-orm";
import { db } from "@/db";
import { importMappings, students } from "@/db/schema";
import { bad, guarded } from "@/server/auth";
import { parseBuffer, parseText } from "@/server/parse-file";
import { autoMapping, detectDuplicates, normalizeRows } from "@/lib/import";

export const dynamic = "force-dynamic";

export const POST = guarded(async (req, u) => {
  let parsed;
  let filename = "لصق مباشر";
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const f = fd.get("file");
      if (!(f instanceof File)) return bad("لم يتم اختيار ملف");
      if (f.size > 15 * 1024 * 1024) return bad("حجم الملف كبير (الحد 15 ميغابايت)");
      filename = f.name;
      parsed = parseBuffer(Buffer.from(await f.arrayBuffer()), f.name);
    } else {
      const b = await req.json();
      const text = String(b.text ?? "");
      if (!text.trim()) return bad("النص فارغ");
      parsed = parseText(text);
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : "تعذرت قراءة الملف");
  }
  if (!parsed.rows.length) return bad("لم يتم العثور على أي سطر بيانات");
  if (parsed.rows.length > 5000) return bad("عدد الأسطر كبير (الحد 5000 في العملية الواحدة)");
  const saved = await db.select().from(importMappings).where(eq(importMappings.institutionId, u.institutionId));
  const mapping = autoMapping(parsed.headers);
  const normalized = normalizeRows(parsed, mapping);
  const existing = await db.select({ id: students.id, fullName: students.fullName, birthDate: students.birthDate, nationalId: students.nationalId, classId: students.classId }).from(students).where(eq(students.institutionId, u.institutionId));
  const duplicates = detectDuplicates(normalized, existing);
  return Response.json({ filename, format: parsed.format, headers: parsed.headers, rows: parsed.rows, headerDetected: parsed.headerDetected, mapping, savedMappings: saved.map((s) => ({ id: s.id, name: s.name, mapping: s.mapping })), normalized, duplicates });
});
