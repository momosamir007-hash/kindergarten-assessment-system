import * as XLSX from "xlsx";
import { parseDelimited, toTable, type TableInput } from "@/lib/import";

export type ParsedFile = TableInput & { format: string };

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function parseBuffer(buf: Buffer, filename: string): ParsedFile {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm") || lower.endsWith(".ods")) {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
    const rows = aoa.map((r) => r.map(cellToString)).filter((r) => r.some((c) => c.trim() !== ""));
    return { ...toTable(rows), format: "excel" };
  }
  const text = buf.toString("utf8");
  if (lower.endsWith(".json") || /^\s*[[{]/.test(text)) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("ملف JSON غير صالح");
    }
    let arr: unknown[] = [];
    if (Array.isArray(data)) arr = data;
    else if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      const candidate = ["students", "eleves", "تلاميذ", "data", "rows"].map((k) => o[k]).find(Array.isArray);
      arr = (candidate as unknown[]) ?? Object.values(o);
    }
    const objs = arr.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
    if (!objs.length) throw new Error("لم أجد قائمة سجلات داخل ملف JSON");
    const headers = [...new Set(objs.flatMap((o) => Object.keys(o)))];
    const rows = objs.map((o) => headers.map((h) => (typeof o[h] === "object" && o[h] !== null ? JSON.stringify(o[h]) : cellToString(o[h]))));
    return { headers, rows, headerDetected: true, format: "json" };
  }
  return { ...toTable(parseDelimited(text)), format: "csv" };
}

export function parseText(text: string): ParsedFile {
  return { ...toTable(parseDelimited(text)), format: "text" };
}
