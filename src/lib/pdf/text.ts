// Arabic-aware text layout for pdf-lib: shaping (via fontkit), bidi reordering (bidi-js),
// font fallback (Arabic font for Arabic glyphs, Latin font for digits/punctuation), wrapping.
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import bidiFactory from "bidi-js";

const bidi = bidiFactory();

export type Fonts = {
  ar: PDFFont;
  arB: PDFFont;
  la: PDFFont;
  laB: PDFFont;
  sets: Map<PDFFont, Set<number>>;
};

const fontBytesCache = new Map<string, Uint8Array>();
function loadBytes(name: string): Uint8Array {
  let b = fontBytesCache.get(name);
  if (!b) {
    const candidates = [
      path.join(process.cwd(), "assets", "fonts", name),
      path.join(__dirname, "..", "..", "..", "assets", "fonts", name),
      path.join(process.cwd(), "node_modules", "@fontsource", "cairo", "files", name),
      path.join(__dirname, "..", "..", "..", "node_modules", "@fontsource", "cairo", "files", name),
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) throw new Error(`Font file not found: ${name}`);
    b = new Uint8Array(fs.readFileSync(found));
    fontBytesCache.set(name, b);
  }
  return b;
}

export async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [ar, arB, la, laB] = await Promise.all([
    doc.embedFont(loadBytes("cairo-arabic-400-normal.woff"), { subset: true }),
    doc.embedFont(loadBytes("cairo-arabic-700-normal.woff"), { subset: true }),
    doc.embedFont(loadBytes("cairo-latin-400-normal.woff"), { subset: true }),
    doc.embedFont(loadBytes("cairo-latin-700-normal.woff"), { subset: true }),
  ]);
  const sets = new Map<PDFFont, Set<number>>();
  for (const f of [ar, arB, la, laB]) sets.set(f, new Set(f.getCharacterSet()));
  return { ar, arB, la, laB, sets };
}

function isArabicCp(cp: number) {
  return (
    (cp >= 0x600 && cp <= 0x6ff) ||
    (cp >= 0x750 && cp <= 0x77f) ||
    (cp >= 0x8a0 && cp <= 0x8ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff)
  );
}

const DIGITS_AR = "٠١٢٣٤٥٦٧٨٩";
const DIGITS_FA = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeText(t: string): string {
  let out = "";
  for (const ch of t.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x640) continue; // tatweel
    if (cp > 0xffff) {
      out += "?";
      continue;
    }
    if (cp === 0x200e || cp === 0x200f || cp === 0x202a || cp === 0x202b || cp === 0x202c) continue;
    let i = DIGITS_AR.indexOf(ch);
    if (i < 0) i = DIGITS_FA.indexOf(ch);
    out += i >= 0 ? String(i) : ch === "\n" || ch === "\t" || ch === "\r" ? " " : ch;
  }
  return out;
}

export type Run = { text: string; font: PDFFont; level: number };

function pickFont(ch: string, prev: PDFFont | null, f: Fonts, bold: boolean): PDFFont {
  const ar = bold ? f.arB : f.ar;
  const la = bold ? f.laB : f.la;
  const cp = ch.codePointAt(0)!;
  if (ch === " ") return prev ?? ar;
  if (isArabicCp(cp)) return ar;
  if (f.sets.get(la)!.has(cp)) return la;
  if (f.sets.get(ar)!.has(cp)) return ar;
  return la;
}

/** Produce runs in VISUAL left-to-right order for an RTL base-direction line. */
export function visualRuns(textIn: string, f: Fonts, bold: boolean): Run[] {
  const text = normalizeText(textIn);
  if (!text) return [];
  const { levels } = bidi.getEmbeddingLevels(text, "rtl");
  const runs: Run[] = [];
  let prev: PDFFont | null = null;
  for (let i = 0; i < text.length; i++) {
    const level = levels[i];
    let ch = text[i];
    if (level % 2 === 1) {
      const m = bidi.getMirroredCharacter(ch);
      if (m) ch = m;
    }
    let font = pickFont(ch, prev, f, bold);
    // chars the chosen font cannot draw -> fall back so we never throw
    if (!f.sets.get(font)!.has(ch.codePointAt(0)!)) {
      const alt = font === f.ar || font === f.arB ? (bold ? f.laB : f.la) : bold ? f.arB : f.ar;
      if (f.sets.get(alt)!.has(ch.codePointAt(0)!)) font = alt;
      else {
        ch = " ";
        font = prev ?? font;
      }
    }
    const last = runs[runs.length - 1];
    if (last && last.level === level && last.font === font) last.text += ch;
    else runs.push({ text: ch, font, level });
    prev = font;
  }
  // UAX#9 L2 on run granularity
  const maxLevel = Math.max(...runs.map((r) => r.level));
  const minOdd = Math.min(...runs.filter((r) => r.level % 2 === 1).map((r) => r.level), maxLevel);
  for (let lvl = maxLevel; lvl >= minOdd && lvl >= 1; lvl--) {
    let i = 0;
    while (i < runs.length) {
      if (runs[i].level >= lvl) {
        let j = i;
        while (j < runs.length && runs[j].level >= lvl) j++;
        const seg = runs.slice(i, j).reverse();
        runs.splice(i, j - i, ...seg);
        i = j;
      } else i++;
    }
  }
  return runs;
}

const widthCache = new Map<string, number>();

export function textWidth(text: string, f: Fonts, bold: boolean, size: number): number {
  const key = `${bold ? 1 : 0}|${size}|${text}`;
  const hit = widthCache.get(key);
  // cache is only valid within the same Fonts instance -> include a font id
  const id = fontId(f);
  const k2 = `${id}|${key}`;
  const h2 = widthCache.get(k2);
  if (h2 !== undefined) return h2;
  void hit;
  let w = 0;
  for (const r of visualRuns(text, f, bold)) w += r.font.widthOfTextAtSize(r.text, size);
  if (widthCache.size > 20000) widthCache.clear();
  widthCache.set(k2, w);
  return w;
}

const ids = new WeakMap<Fonts, number>();
let idCounter = 1;
function fontId(f: Fonts) {
  let v = ids.get(f);
  if (!v) {
    v = idCounter++;
    ids.set(f, v);
  }
  return v;
}

export type DrawOpts = {
  size: number;
  bold?: boolean;
  color: RGB;
  align?: "right" | "left" | "center";
};

/** Draw one already-wrapped line inside [left, right] horizontally. */
export function drawLine(page: PDFPage, text: string, f: Fonts, left: number, right: number, y: number, o: DrawOpts) {
  const runs = visualRuns(text, f, !!o.bold);
  if (!runs.length) return;
  const widths = runs.map((r) => r.font.widthOfTextAtSize(r.text, o.size));
  const total = widths.reduce((a, b) => a + b, 0);
  let x = right - total; // RTL default: flush right
  if (o.align === "left") x = left;
  else if (o.align === "center") x = left + (right - left - total) / 2;
  runs.forEach((r, i) => {
    page.drawText(r.text, { x, y, size: o.size, font: r.font, color: o.color });
    x += widths[i];
  });
}

/** Greedy wrap in logical order. */
export function wrapText(text: string, maxWidth: number, f: Fonts, bold: boolean, size: number): string[] {
  const out: string[] = [];
  const paragraphs = String(text ?? "").split(/\r?\n/);
  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (textWidth(cand, f, bold, size) <= maxWidth) {
        line = cand;
        continue;
      }
      if (line) out.push(line);
      if (textWidth(w, f, bold, size) <= maxWidth) {
        line = w;
      } else {
        // hard break very long token
        let chunk = "";
        for (const ch of w) {
          if (textWidth(chunk + ch, f, bold, size) > maxWidth && chunk) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      }
    }
    if (line) out.push(line);
  }
  return out;
}
