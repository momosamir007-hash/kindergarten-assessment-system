// Small layout toolkit on top of pdf-lib for RTL Arabic reports (A4).
import { PDFDocument, rgb, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { drawLine, embedFonts, textWidth, wrapText, type Fonts } from "./text";

export type PdfMode = "color" | "bw" | "eco";

export type Theme = {
  primary: RGB;
  text: RGB;
  muted: RGB;
  border: RGB;
  headFill: RGB | null;
  headText: RGB;
  zebra: RGB | null;
  boxFill: RGB | null;
  useColor: boolean;
};

export function themeFor(mode: PdfMode): Theme {
  if (mode === "color")
    return {
      primary: rgb(0.06, 0.3, 0.5),
      text: rgb(0.1, 0.1, 0.12),
      muted: rgb(0.4, 0.4, 0.45),
      border: rgb(0.75, 0.78, 0.82),
      headFill: rgb(0.06, 0.3, 0.5),
      headText: rgb(1, 1, 1),
      zebra: rgb(0.96, 0.97, 0.98),
      boxFill: rgb(0.93, 0.96, 0.99),
      useColor: true,
    };
  if (mode === "bw")
    return {
      primary: rgb(0, 0, 0),
      text: rgb(0, 0, 0),
      muted: rgb(0.3, 0.3, 0.3),
      border: rgb(0.5, 0.5, 0.5),
      headFill: rgb(0.85, 0.85, 0.85),
      headText: rgb(0, 0, 0),
      zebra: rgb(0.95, 0.95, 0.95),
      boxFill: rgb(0.93, 0.93, 0.93),
      useColor: false,
    };
  return {
    primary: rgb(0, 0, 0),
    text: rgb(0, 0, 0),
    muted: rgb(0.25, 0.25, 0.25),
    border: rgb(0.4, 0.4, 0.4),
    headFill: null,
    headText: rgb(0, 0, 0),
    zebra: null,
    boxFill: null,
    useColor: false,
  };
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export type Cell = string | { text: string; color?: string; bold?: boolean };

export type HeaderInfo = {
  name: string;
  sub: string;
  logo?: string | null;
};

const PW = 595.28;
const PH = 841.89;
const M = 36;

export class Pdf {
  doc!: PDFDocument;
  fonts!: Fonts;
  theme!: Theme;
  page!: PDFPage;
  y = 0;
  logo: PDFImage | null = null;
  header: HeaderInfo = { name: "", sub: "" };
  /** page index at which the current section starts, for per-section page numbering */
  sectionStart = 0;
  sections: { start: number; end: number; label: string }[] = [];
  sectionLabel = "";
  readonly w = PW;
  readonly left = M;
  readonly right = PW - M;

  static async create(mode: PdfMode, header: HeaderInfo, title?: string, firstPage = true): Promise<Pdf> {
    const p = new Pdf();
    p.doc = await PDFDocument.create();
    if (title) p.doc.setTitle(title);
    p.doc.setProducer("Taqyim Tarbawi");
    p.fonts = await embedFonts(p.doc);
    p.theme = themeFor(mode);
    p.header = header;
    await p.setLogo(header.logo);
    p.header = header;
    if (firstPage) p.beginSection(header, "");
    return p;
  }

  private async setLogo(dataUrl?: string | null) {
    this.logo = null;
    if (!dataUrl) return;
    try {
      const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
      if (!m) return;
      const bytes = Buffer.from(m[2], "base64");
      this.logo = m[1].toLowerCase() === "png" ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
    } catch {
      this.logo = null;
    }
  }

  /** Start a new logical report (new page); page numbers restart per section. */
  beginSection(header: HeaderInfo, label: string) {
    this.closeSection();
    this.header = header;
    this.sectionLabel = label;
    this.sectionStart = this.doc.getPageCount();
    this.newPage();
  }

  private closeSection() {
    const count = this.doc.getPageCount();
    if (count > this.sectionStart && this.page) this.sections.push({ start: this.sectionStart, end: count, label: this.sectionLabel });
  }

  newPage() {
    this.page = this.doc.addPage([PW, PH]);
    const t = this.theme;
    const top = PH - 24;
    // header band
    let rightEdge = this.right;
    if (this.logo) {
      const h = 34;
      const w = (this.logo.width / this.logo.height) * h;
      this.page.drawImage(this.logo, { x: this.right - Math.min(w, 80), y: top - h + 6, width: Math.min(w, 80), height: h });
      rightEdge = this.right - Math.min(w, 80) - 8;
    }
    drawLine(this.page, this.header.name, this.fonts, this.left, rightEdge, top - 8, { size: 12, bold: true, color: t.primary });
    drawLine(this.page, this.header.sub, this.fonts, this.left, rightEdge, top - 24, { size: 9, color: t.muted });
    this.page.drawLine({ start: { x: this.left, y: top - 34 }, end: { x: this.right, y: top - 34 }, thickness: 1, color: t.primary });
    this.y = top - 50;
  }

  ensure(h: number) {
    if (this.y - h < 50) this.newPage();
  }

  gap(h = 8) {
    this.y -= h;
  }

  text(text: string, o: { size?: number; bold?: boolean; color?: RGB; align?: "right" | "left" | "center"; x1?: number; x2?: number } = {}) {
    const size = o.size ?? 10;
    const x1 = o.x1 ?? this.left;
    const x2 = o.x2 ?? this.right;
    const lines = wrapText(text, x2 - x1, this.fonts, !!o.bold, size);
    const lh = size * 1.7;
    for (const ln of lines) {
      this.ensure(lh);
      this.y -= lh;
      drawLine(this.page, ln, this.fonts, x1, x2, this.y + size * 0.35, { size, bold: o.bold, color: o.color ?? this.theme.text, align: o.align });
    }
  }

  title(text: string, sub?: string) {
    this.ensure(50);
    this.text(text, { size: 18, bold: true, color: this.theme.primary, align: "center" });
    if (sub) this.text(sub, { size: 10, color: this.theme.muted, align: "center" });
    this.gap(6);
  }

  h2(text: string) {
    this.ensure(60);
    this.gap(6);
    const t = this.theme;
    const h = 22;
    this.y -= h;
    if (t.boxFill) this.page.drawRectangle({ x: this.left, y: this.y, width: this.right - this.left, height: h, color: t.boxFill });
    this.page.drawRectangle({ x: this.right - 4, y: this.y, width: 4, height: h, color: t.primary });
    drawLine(this.page, text, this.fonts, this.left, this.right - 12, this.y + 7, { size: 12, bold: true, color: t.primary });
    this.gap(6);
  }

  para(text: string, o: { size?: number; color?: RGB } = {}) {
    this.text(text, { size: o.size ?? 10, color: o.color });
    this.gap(2);
  }

  bullets(items: string[], size = 10) {
    for (const it of items) {
      const lines = wrapText(it, this.right - this.left - 16, this.fonts, false, size);
      const lh = size * 1.7;
      this.ensure(lh * Math.min(lines.length, 2));
      lines.forEach((ln, i) => {
        this.ensure(lh);
        this.y -= lh;
        if (i === 0) this.page.drawCircle({ x: this.right - 4, y: this.y + size * 0.65, size: 1.8, color: this.theme.primary });
        drawLine(this.page, ln, this.fonts, this.left, this.right - 14, this.y + size * 0.35, { size, color: this.theme.text });
      });
    }
    this.gap(2);
  }

  /** key/value grid, 2 pairs per row, RTL */
  kv(pairs: [string, string][]) {
    const size = 10;
    const colW = (this.right - this.left) / 2;
    const t = this.theme;
    for (let i = 0; i < pairs.length; i += 2) {
      const row = pairs.slice(i, i + 2);
      const heights = row.map(([k, v]) => Math.max(1, wrapText(v, colW - 100, this.fonts, false, size).length));
      const h = Math.max(...heights) * size * 1.6 + 8;
      this.ensure(h);
      this.y -= h;
      row.forEach(([k, v], j) => {
        const xr = this.right - j * colW;
        const xl = xr - colW;
        this.page.drawRectangle({ x: xl + 2, y: this.y, width: colW - 4, height: h, borderColor: t.border, borderWidth: 0.6, color: undefined });
        drawLine(this.page, k, this.fonts, xl, xr - 6, this.y + h - size - 3, { size: 9, bold: true, color: t.muted });
        const lines = wrapText(v, colW - 100, this.fonts, false, size);
        lines.forEach((ln, li) => drawLine(this.page, ln, this.fonts, xl + 6, xr - 96, this.y + h - size - 3 - li * size * 1.6, { size, color: t.text }));
      });
    }
    this.gap(4);
  }

  /**
   * Table with repeating header, rows never split across pages.
   * widths are fractions; column 0 is the RIGHT-most column.
   */
  table(headers: string[], rows: Cell[][], widths: number[], opts: { size?: number; align?: ("right" | "center" | "left")[] } = {}) {
    const size = opts.size ?? 9;
    const t = this.theme;
    const total = this.right - this.left;
    const sum = widths.reduce((a, b) => a + b, 0);
    const colW = widths.map((w) => (w / sum) * total);
    const pad = 4;
    const lh = size * 1.6;
    const colRight: number[] = [];
    let acc = this.right;
    for (const w of colW) {
      colRight.push(acc);
      acc -= w;
    }
    const aligns = opts.align ?? headers.map(() => "right" as const);

    const drawHeader = () => {
      const hh = lh + 8;
      this.ensure(hh + lh * 2 + 8);
      this.y -= hh;
      if (t.headFill) this.page.drawRectangle({ x: this.left, y: this.y, width: total, height: hh, color: t.headFill });
      else this.page.drawRectangle({ x: this.left, y: this.y, width: total, height: hh, borderColor: t.border, borderWidth: 0.8 });
      headers.forEach((h, i) => {
        drawLine(this.page, h, this.fonts, colRight[i] - colW[i] + pad, colRight[i] - pad, this.y + 6, {
          size,
          bold: true,
          color: t.headText,
          align: aligns[i] === "right" ? "right" : aligns[i],
        });
      });
    };
    drawHeader();
    rows.forEach((row, ri) => {
      const cells = row.map((c) => (typeof c === "string" ? { text: c } : c));
      const wrapped = cells.map((c, i) => wrapText(c.text, colW[i] - pad * 2, this.fonts, !!(c as { bold?: boolean }).bold, size));
      const nLines = Math.max(1, ...wrapped.map((w) => w.length));
      const h = nLines * lh + 6;
      if (this.y - h < 50) {
        this.newPage();
        drawHeader();
      }
      this.y -= h;
      if (t.zebra && ri % 2 === 1) this.page.drawRectangle({ x: this.left, y: this.y, width: total, height: h, color: t.zebra });
      // borders
      this.page.drawLine({ start: { x: this.left, y: this.y }, end: { x: this.right, y: this.y }, thickness: 0.4, color: t.border });
      colRight.forEach((cr, i) => {
        if (i === 0) this.page.drawLine({ start: { x: cr, y: this.y }, end: { x: cr, y: this.y + h }, thickness: 0.4, color: t.border });
        this.page.drawLine({ start: { x: cr - colW[i], y: this.y }, end: { x: cr - colW[i], y: this.y + h }, thickness: 0.4, color: t.border });
      });
      cells.forEach((c, i) => {
        const col = c.color && t.useColor ? hexToRgb(c.color) : t.text;
        wrapped[i].forEach((ln, li) =>
          drawLine(this.page, ln, this.fonts, colRight[i] - colW[i] + pad, colRight[i] - pad, this.y + h - lh - li * lh + 2.5, {
            size,
            bold: c.bold,
            color: col,
            align: aligns[i],
          }),
        );
      });
    });
    this.gap(8);
  }

  /** Horizontal bar chart: values 0..100 */
  barChart(items: { label: string; value: number; color?: string }[], o: { title?: string } = {}) {
    const t = this.theme;
    const rowH = 16;
    const labelW = 170;
    this.ensure(rowH * Math.min(items.length, 4) + 20);
    if (o.title) this.text(o.title, { size: 10, bold: true, color: t.muted });
    const barL = this.left + 36;
    const barR = this.right - labelW - 6;
    for (const it of items) {
      this.ensure(rowH);
      this.y -= rowH;
      const lines = wrapText(it.label, labelW, this.fonts, false, 9);
      drawLine(this.page, lines[0] ?? "", this.fonts, this.right - labelW, this.right, this.y + 4, { size: 9, color: t.text });
      this.page.drawRectangle({ x: barL, y: this.y + 2, width: barR - barL, height: 9, borderColor: t.border, borderWidth: 0.5 });
      const v = Math.max(0, Math.min(100, it.value));
      if (v > 0) {
        // fill grows from the right (RTL)
        const w = ((barR - barL) * v) / 100;
        const fill = t.useColor ? hexToRgb(it.color ?? "#0f4c81") : t.headFill ? rgb(0.35, 0.35, 0.35) : rgb(0.2, 0.2, 0.2);
        this.page.drawRectangle({ x: barR - w, y: this.y + 2, width: w, height: 9, color: fill });
      }
      drawLine(this.page, `${v}%`, this.fonts, this.left, barL - 4, this.y + 3, { size: 8, color: t.text, align: "right" });
    }
    this.gap(6);
  }

  /** Simple line chart (0..100), points ordered chronologically, drawn RTL (oldest at right). */
  lineChart(points: { label: string; value: number | null }[], o: { title?: string; h?: number } = {}) {
    const t = this.theme;
    const h = o.h ?? 110;
    this.ensure(h + 30);
    if (o.title) this.text(o.title, { size: 10, bold: true, color: t.muted });
    this.y -= h + 16;
    const x0 = this.left + 30;
    const x1 = this.right - 10;
    const y0 = this.y + 14;
    this.page.drawRectangle({ x: x0, y: y0, width: x1 - x0, height: h, borderColor: t.border, borderWidth: 0.5 });
    for (const g of [0, 50, 100]) {
      const yy = y0 + (h * g) / 100;
      this.page.drawLine({ start: { x: x0, y: yy }, end: { x: x1, y: yy }, thickness: 0.3, color: t.border, dashArray: [2, 2] });
      drawLine(this.page, `${g}`, this.fonts, this.left, x0 - 3, yy - 3, { size: 7, color: t.muted, align: "right" });
    }
    const n = points.length;
    const step = n > 1 ? (x1 - x0 - 40) / (n - 1) : 0;
    let prev: { x: number; y: number } | null = null;
    points.forEach((p, i) => {
      const x = x1 - 20 - i * step;
      drawLine(this.page, p.label, this.fonts, x - 40, x + 40, y0 - 11, { size: 7, color: t.muted, align: "center" });
      if (p.value === null) {
        prev = null;
        return;
      }
      const y = y0 + (h * p.value) / 100;
      if (prev) this.page.drawLine({ start: prev, end: { x, y }, thickness: 1.4, color: t.primary });
      this.page.drawCircle({ x, y, size: 2.6, color: t.primary });
      drawLine(this.page, `${p.value}%`, this.fonts, x - 20, x + 20, y + 5, { size: 7, color: t.text, align: "center" });
      prev = { x, y };
    });
    this.gap(4);
  }

  signatureBox(label: string) {
    this.ensure(70);
    this.gap(14);
    const t = this.theme;
    this.y -= 50;
    const w = 180;
    this.page.drawRectangle({ x: this.left, y: this.y, width: w, height: 50, borderColor: t.border, borderWidth: 0.6 });
    drawLine(this.page, label, this.fonts, this.left, this.left + w - 6, this.y + 38, { size: 9, bold: true, color: t.muted });
  }

  note(text: string) {
    this.text(text, { size: 8, color: this.theme.muted });
  }

  /** Add footers and return the PDF bytes. */
  async finish(): Promise<Uint8Array> {
    this.closeSection();
    const pages = this.doc.getPages();
    for (const s of this.sections) {
      const total = s.end - s.start;
      for (let i = s.start; i < s.end; i++) {
        const pg = pages[i];
        const ln = 40;
        pg.drawLine({ start: { x: this.left, y: ln }, end: { x: this.right, y: ln }, thickness: 0.4, color: this.theme.border });
        drawLine(pg, `صفحة ${i - s.start + 1} من ${total}`, this.fonts, this.left, this.right, 26, { size: 8, color: this.theme.muted, align: "center" });
        if (s.label) drawLine(pg, s.label, this.fonts, this.left, this.right, 26, { size: 8, color: this.theme.muted, align: "right" });
      }
    }
    return this.doc.save();
  }

  measure(text: string, size: number, bold = false) {
    return textWidth(text, this.fonts, bold, size);
  }
}
