import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';

function stripHtmlToLines(html: string): string[] {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const blocks = Array.from(doc.body.querySelectorAll('h1, h2, h3, p, li, tr'));
  if (blocks.length === 0) {
    return (doc.body.textContent || '').split('\n').filter((line) => line.trim().length > 0);
  }
  return blocks
    .map((el) => {
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim();
      if (!text) return '';
      if (tag === 'h1') return `# ${text}`;
      if (tag === 'h2') return `## ${text}`;
      if (tag === 'h3') return `### ${text}`;
      if (tag === 'li') return `• ${text}`;
      return text;
    })
    .filter(Boolean);
}

export function sanitizeHtmlForPrint(html: string): string {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src') && /^javascript:/i.test(val)) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

interface InlineStyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  code: boolean;
  linkHref?: string;
}

interface InlineRun extends InlineStyleState {
  text: string;
}

interface LoadedPdfImage {
  dataUrl: string;
  width: number;
  height: number;
}

function normalizePdfText(raw: string): string {
  return (raw || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[→➔➜]/g, '->')
    .replace(/[←]/g, '<-')
    .replace(/[⇒]/g, '=>')
    .replace(/[≤]/g, '<=')
    .replace(/[≥]/g, '>=')
    .replace(/[≠]/g, '!=')
    .replace(/[≈]/g, '~')
    .replace(/[✓✔]/g, '[v]')
    .replace(/[✗✘]/g, '[x]')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function loadImageForPdf(src: string): Promise<LoadedPdfImage | null> {
  return new Promise((resolve) => {
    if (!src || /^javascript:/i.test(src.trim())) {
      resolve(null);
      return;
    }

    const img = new Image();
    let settled = false;
    const finish = (result: LoadedPdfImage | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };

    const timer = window.setTimeout(() => finish(null), 8000);

    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 1;
        const naturalH = img.naturalHeight || img.height || 1;
        const maxCanvasDim = 1600;
        const scale = Math.min(1, maxCanvasDim / Math.max(naturalW, naturalH));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(naturalW * scale));
        canvas.height = Math.max(1, Math.round(naturalH * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        // White paper background ensures transparent PNGs/SVGs print cleanly
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.88);
        finish({
          dataUrl: jpegUrl,
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        finish(null);
      }
    };

    img.onerror = () => finish(null);
    img.src = src;
  });
}

function getFontStyleName(bold: boolean, italic: boolean): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function readElementStyleState(el: HTMLElement, parent: InlineStyleState): InlineStyleState {
  const tag = el.tagName.toLowerCase();
  const inlineStyle = el.getAttribute('style') || '';
  const hasBoldStyle =
    /font-weight\s*:\s*(bold|[6-9]00)/i.test(inlineStyle);
  const hasItalicStyle = /font-style\s*:\s*italic/i.test(inlineStyle);
  const hasUnderlineStyle = /text-decoration[^;]*underline/i.test(inlineStyle);

  const linkHref =
    tag === 'a' && el.getAttribute('href') && /^https?:\/\//i.test(el.getAttribute('href')!.trim())
      ? el.getAttribute('href')!.trim()
      : parent.linkHref;

  return {
    bold: parent.bold || tag === 'strong' || tag === 'b' || tag === 'th' || hasBoldStyle,
    italic: parent.italic || tag === 'em' || tag === 'i' || hasItalicStyle,
    underline: parent.underline || tag === 'u' || hasUnderlineStyle || tag === 'a',
    code: parent.code || tag === 'code',
    linkHref,
  };
}

function collectInlineRuns(node: Node, style: InlineStyleState, out: InlineRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = normalizePdfText(node.textContent || '');
    const collapsed = raw.replace(/\s+/g, ' ');
    if (collapsed.length > 0) {
      out.push({ ...style, text: collapsed });
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    out.push({ ...style, text: '\n' });
    return;
  }
  if (tag === 'script' || tag === 'style' || tag === 'img' || tag === 'svg') return;

  const nextStyle = readElementStyleState(el, style);
  for (const child of Array.from(el.childNodes)) {
    collectInlineRuns(child, nextStyle, out);
  }
}

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'table',
  'blockquote',
  'pre',
  'hr',
  'section',
  'article',
]);

export interface PdfStudioNoteInput {
  id?: string;
  title: string;
  subjectName?: string;
  unit?: string;
  folder?: string;
  tags?: string[];
  attachments?: Array<{ name: string; sizeBytes?: number }>;
  contentHtml: string;
  contentText: string;
}

export interface PdfStudioOptions {
  notes: PdfStudioNoteInput[];
  pageSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  includeCover: boolean;
  coverTitle: string;
  coverSubtitle?: string;
  coverAuthor?: string;
  coverInstitution?: string;
  coverSubjectLine?: string;
  coverDate?: string;
  accentColorHex?: string;
  includeToc: boolean;
  includePageNumbers: boolean;
  includeMedia: boolean;
  includeBibliography: boolean;
  bibliographyText?: string;
  fileName?: string;
}

export interface PdfStudioResult {
  blob: Blob;
  filename: string;
  pageCount: number;
}

function hexToRgb(hex?: string): [number, number, number] {
  const cleaned = (hex || '').replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return [2, 132, 199]; // FABRO Sky Blue fallback
}

function svgToDataUrl(svgEl: SVGElement): string | null {
  try {
    const clone = svgEl.cloneNode(true) as SVGElement;
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    const serialized = new XMLSerializer().serializeToString(clone);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  } catch {
    return null;
  }
}

export function extractBibliographyFromNotes(
  notes: PdfStudioNoteInput[],
  subjectBibliography?: string
): string {
  const entries: string[] = [];
  const seen = new Set<string>();

  if (subjectBibliography && subjectBibliography.trim()) {
    for (const line of subjectBibliography.split('\n')) {
      const clean = line.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        entries.push(clean);
      }
    }
  }

  for (const note of notes) {
    const doc = new DOMParser().parseFromString(note.contentHtml || '', 'text/html');
    const links = Array.from(doc.body.querySelectorAll('a[href]'));
    for (const a of links) {
      const href = (a.getAttribute('href') || '').trim();
      if (!/^https?:\/\//i.test(href)) continue;
      const label = (a.textContent || '').trim();
      const formatted =
        label && label !== href && !label.startsWith('http')
          ? `${label} — ${href}`
          : href;
      if (!seen.has(href.toLowerCase())) {
        seen.add(href.toLowerCase());
        entries.push(formatted);
      }
    }
  }

  return entries.join('\n');
}

export function renderChartToDataUrl(params: {
  chartType: 'bar' | 'line';
  title: string;
  items: Array<{ label: string; value: number }>;
  accentColor?: string;
}): string {
  const width = 920;
  const height = 460;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const [r, g, b] = hexToRgb(params.accentColor || '#0284C7');
  const accentCss = `rgb(${r}, ${g}, ${b})`;

  // Clean white card canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(params.title || 'Gráfico de estudio', 36, 46);

  const items = params.items.slice(0, 12);
  if (items.length === 0) return canvas.toDataURL('image/png');

  const padLeft = 72;
  const padRight = 36;
  const padTop = 76;
  const padBottom = 78;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(1, ...items.map((i) => i.value));
  const minVal = Math.min(0, ...items.map((i) => i.value));
  const range = Math.max(1, maxVal - minVal);

  // Gridlines + Y-axis labels
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  for (let step = 0; step <= 4; step++) {
    const yPos = padTop + (plotH * step) / 4;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, yPos);
    ctx.lineTo(width - padRight, yPos);
    ctx.stroke();

    const val = maxVal - (range * step) / 4;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText(Number.isInteger(val) ? String(val) : val.toFixed(1), padLeft - 10, yPos + 5);
  }

  // Baseline X axis
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop + plotH);
  ctx.lineTo(width - padRight, padTop + plotH);
  ctx.stroke();

  if (params.chartType === 'bar') {
    const slotW = plotW / items.length;
    const barW = Math.min(68, slotW * 0.58);
    items.forEach((item, idx) => {
      const normalized = (item.value - minVal) / range;
      const barH = Math.max(4, normalized * plotH);
      const bx = padLeft + idx * slotW + (slotW - barW) / 2;
      const by = padTop + plotH - barH;

      ctx.fillStyle = accentCss;
      ctx.fillRect(bx, by, barW, barH);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.value), bx + barW / 2, by - 8);

      ctx.fillStyle = '#475569';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      const label = item.label.length > 14 ? `${item.label.slice(0, 13)}…` : item.label;
      ctx.fillText(label, bx + barW / 2, padTop + plotH + 24);
    });
  } else {
    const points = items.map((item, idx) => {
      const px =
        items.length === 1
          ? padLeft + plotW / 2
          : padLeft + (idx * plotW) / (items.length - 1);
      const normalized = (item.value - minVal) / range;
      const py = padTop + plotH - normalized * plotH;
      return { px, py, item };
    });

    ctx.strokeStyle = accentCss;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    });
    ctx.stroke();

    points.forEach((p) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.px, p.py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accentCss;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(p.item.value), p.px, p.py - 12);

      ctx.fillStyle = '#475569';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      const label = p.item.label.length > 14 ? `${p.item.label.slice(0, 13)}…` : p.item.label;
      ctx.fillText(label, p.px, padTop + plotH + 24);
    });
  }

  ctx.textAlign = 'left';
  return canvas.toDataURL('image/png');
}

export async function exportNotesStudioPdf(options: PdfStudioOptions): Promise<PdfStudioResult> {
  const notes = options.notes.length > 0
    ? options.notes
    : [{ title: 'Apunte sin título', contentHtml: '', contentText: '' }];

  const parsedDocs = notes.map((n) => new DOMParser().parseFromString(n.contentHtml || '', 'text/html'));
  const imageCache = new Map<string, LoadedPdfImage | null>();
  const svgCache = new Map<SVGElement, LoadedPdfImage | null>();

  if (options.includeMedia) {
    const imgSrcs = new Set<string>();
    const svgs: SVGElement[] = [];
    for (const doc of parsedDocs) {
      Array.from(doc.body.querySelectorAll('img')).forEach((img) => {
        const src = img.getAttribute('src') || '';
        if (src) imgSrcs.add(src);
      });
      Array.from(doc.body.querySelectorAll('svg')).forEach((svg) => {
        svgs.push(svg);
      });
    }

    await Promise.all([
      ...Array.from(imgSrcs).map(async (src) => {
        imageCache.set(src, await loadImageForPdf(src));
      }),
      ...svgs.map(async (svg) => {
        const dataUrl = svgToDataUrl(svg);
        svgCache.set(svg, dataUrl ? await loadImageForPdf(dataUrl) : null);
      }),
    ]);
  }

  const [accR, accG, accB] = hexToRgb(options.accentColorHex);
  const pdf = new jsPDF({
    unit: 'pt',
    format: options.pageSize,
    orientation: options.orientation,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  const topMargin = 48;
  const bottomMargin = 48;
  const maxWidth = pageWidth - marginX * 2;

  interface TocEntry {
    title: string;
    level: 1 | 2;
    rawPage: number;
  }
  const tocEntries: TocEntry[] = [];

  // 1. Optional Custom Cover Page
  if (options.includeCover) {
    // Left vertical editorial bar + top band
    pdf.setFillColor(accR, accG, accB);
    pdf.rect(0, 0, 14, pageHeight, 'F');
    pdf.rect(marginX, 54, 72, 4, 'F');

    let cy = 86;
    if (options.coverInstitution?.trim()) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(accR, accG, accB);
      const instLines = pdf.splitTextToSize(
        normalizePdfText(options.coverInstitution.trim().toUpperCase()),
        maxWidth - 20
      );
      pdf.text(instLines, marginX, cy);
      cy += instLines.length * 14 + 16;
    } else {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(accR, accG, accB);
      pdf.text('FABRO · CUADERNO ACADÉMICO', marginX, cy);
      cy += 30;
    }

    if (options.coverSubjectLine?.trim()) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(71, 85, 105);
      const subLine = pdf.splitTextToSize(normalizePdfText(options.coverSubjectLine.trim()), maxWidth - 20);
      pdf.text(subLine, marginX, cy);
      cy += subLine.length * 16 + 14;
    }

    // Main Cover Title centered in upper-middle area
    cy = Math.max(cy + 20, pageHeight * 0.3);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(28);
    pdf.setTextColor(15, 23, 42);
    const coverTitleLines = pdf.splitTextToSize(
      normalizePdfText(options.coverTitle.trim() || 'Compilado de Apuntes'),
      maxWidth - 20
    );
    pdf.text(coverTitleLines, marginX, cy);
    cy += coverTitleLines.length * 34 + 12;

    if (options.coverSubtitle?.trim()) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(13.5);
      pdf.setTextColor(71, 85, 105);
      const subTitleLines = pdf.splitTextToSize(
        normalizePdfText(options.coverSubtitle.trim()),
        maxWidth - 20
      );
      pdf.text(subTitleLines, marginX, cy);
      cy += subTitleLines.length * 19 + 14;
    }

    // Bottom Metadata Box
    const metaBoxY = pageHeight - 138;
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(marginX, metaBoxY, maxWidth, 78, 6, 6, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(
      normalizePdfText(`Estudiante: ${options.coverAuthor?.trim() || 'Estudiante FABRO'}`),
      marginX + 16,
      metaBoxY + 26
    );

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    const secondMeta = [
      `Fecha: ${normalizePdfText(options.coverDate?.trim() || new Date().toLocaleDateString('es-AR'))}`,
      `${notes.length} ${notes.length === 1 ? 'apunte incluido' : 'apuntes incluidos'}`,
    ].join('  ·  ');
    pdf.text(secondMeta, marginX + 16, metaBoxY + 48);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text('Documento formateado con FABRO', marginX, pageHeight - 30);

    pdf.addPage();
  }

  const startBodyPage = pdf.getCurrentPageInfo().pageNumber;
  let y = topMargin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - bottomMargin) {
      pdf.addPage();
      y = topMargin;
      return true;
    }
    return false;
  };

  const renderInlineRuns = (
    runs: InlineRun[],
    opts: {
      x: number;
      availWidth: number;
      fontSize: number;
      lineHeight: number;
      color: [number, number, number];
      afterSpacing: number;
      leftAccentBar?: boolean;
    }
  ) => {
    const { x, availWidth, fontSize, lineHeight, color, afterSpacing, leftAccentBar } = opts;

    interface Token extends InlineStyleState {
      text: string;
      width: number;
      isNewline?: boolean;
    }

    const applyStyle = (t: InlineStyleState) => {
      pdf.setFont(t.code ? 'courier' : 'helvetica', getFontStyleName(t.bold, t.italic));
      pdf.setFontSize(t.code ? Math.max(8.5, fontSize - 0.8) : fontSize);
    };

    const splitOversizedWord = (word: string, state: InlineStyleState): Token[] => {
      applyStyle(state);
      const chunks: Token[] = [];
      let current = '';
      for (const ch of word) {
        const test = current + ch;
        if (current && pdf.getTextWidth(test) > availWidth) {
          chunks.push({ ...state, text: current, width: pdf.getTextWidth(current) });
          current = ch;
        } else {
          current = test;
        }
      }
      if (current) {
        chunks.push({ ...state, text: current, width: pdf.getTextWidth(current) });
      }
      return chunks;
    };

    const tokens: Token[] = [];
    for (const run of runs) {
      const parts = run.text.split(/(\n|\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (part === '\n') {
          tokens.push({ ...run, text: '', width: 0, isNewline: true });
          continue;
        }
        applyStyle(run);
        const w = pdf.getTextWidth(part);
        if (w > availWidth && !/^\s+$/.test(part)) {
          tokens.push(...splitOversizedWord(part, run));
        } else {
          tokens.push({ ...run, text: part, width: w });
        }
      }
    }

    while (tokens.length > 0 && !tokens[0].isNewline && /^\s+$/.test(tokens[0].text)) {
      tokens.shift();
    }
    while (
      tokens.length > 0 &&
      !tokens[tokens.length - 1].isNewline &&
      /^\s+$/.test(tokens[tokens.length - 1].text)
    ) {
      tokens.pop();
    }
    if (tokens.length === 0) return;

    const lines: Token[][] = [[]];
    let currentLineWidth = 0;

    for (const tok of tokens) {
      if (tok.isNewline) {
        lines.push([]);
        currentLineWidth = 0;
        continue;
      }

      const line = lines[lines.length - 1];
      const isSpace = /^\s+$/.test(tok.text);
      if (line.length === 0 && isSpace) continue;

      if (line.length > 0 && currentLineWidth + tok.width > availWidth) {
        while (line.length > 0 && /^\s+$/.test(line[line.length - 1].text)) {
          line.pop();
        }
        if (isSpace) {
          lines.push([]);
          currentLineWidth = 0;
        } else {
          lines.push([tok]);
          currentLineWidth = tok.width;
        }
      } else {
        line.push(tok);
        currentLineWidth += tok.width;
      }
    }

    while (lines.length > 0 && lines[lines.length - 1].length === 0) {
      lines.pop();
    }
    if (lines.length === 0) return;

    for (const line of lines) {
      ensureSpace(lineHeight + 2);

      if (leftAccentBar) {
        pdf.setFillColor(accR, accG, accB);
        pdf.rect(x - 10, y - fontSize * 0.85, 2.5, lineHeight, 'F');
      }

      if (line.length > 0) {
        let cursorX = x;
        for (const tok of line) {
          applyStyle(tok);
          if (tok.code) {
            pdf.setFillColor(241, 245, 249);
            pdf.roundedRect(
              cursorX - 1,
              y - fontSize * 0.82,
              tok.width + 2,
              fontSize * 1.08,
              2,
              2,
              'F'
            );
          }

          if (tok.linkHref) {
            pdf.setTextColor(accR, accG, accB);
          } else if (tok.code) {
            pdf.setTextColor(15, 23, 42);
          } else {
            pdf.setTextColor(color[0], color[1], color[2]);
          }

          pdf.text(tok.text, cursorX, y);

          if ((tok.underline || tok.linkHref) && tok.text.trim().length > 0) {
            pdf.setDrawColor(
              tok.linkHref ? accR : color[0],
              tok.linkHref ? accG : color[1],
              tok.linkHref ? accB : color[2]
            );
            pdf.setLineWidth(0.6);
            pdf.line(cursorX, y + 1.8, cursorX + tok.width, y + 1.8);
          }

          if (tok.linkHref && tok.text.trim().length > 0) {
            pdf.link(cursorX, y - fontSize * 0.88, tok.width, fontSize * 1.15, {
              url: tok.linkHref,
            });
          }

          cursorX += tok.width;
        }
      }

      y += lineHeight;
    }

    y += afterSpacing;
  };

  const renderLoadedImageBox = (loaded: LoadedPdfImage | null, altText: string) => {
    if (!loaded) {
      ensureSpace(26);
      pdf.setDrawColor(203, 213, 225);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(marginX, y - 11, maxWidth, 22, 4, 4, 'FD');
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`[Elemento visual no incrustable: ${altText}]`, marginX + 8, y + 3);
      y += 26;
      return;
    }

    const usablePageHeight = pageHeight - topMargin - bottomMargin - 16;
    const widthScale = maxWidth / loaded.width;
    const heightScale = usablePageHeight / loaded.height;
    const scale = Math.min(1, widthScale, heightScale);
    const drawW = loaded.width * scale;
    const drawH = loaded.height * scale;

    ensureSpace(drawH + 14);
    const drawX = marginX + Math.max(0, (maxWidth - drawW) / 2);

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.6);
    pdf.addImage(loaded.dataUrl, 'JPEG', drawX, y - 6, drawW, drawH, undefined, 'FAST');
    pdf.rect(drawX, y - 6, drawW, drawH, 'S');
    y += drawH + 10;
  };

  const renderTableElement = (tableEl: HTMLTableElement) => {
    const rows = Array.from(tableEl.rows);
    if (rows.length === 0) return;

    const colCount = Math.max(1, ...rows.map((r) => r.cells.length));
    const colWidths = Array.from({ length: colCount }, () => maxWidth / colCount);
    const cellPadX = 6;
    const cellPadY = 6;
    const cellFontSize = 9.5;
    const cellLineHeight = 13;

    interface ParsedRow {
      isHeader: boolean;
      cells: Array<{ lines: string[]; isHeaderCell: boolean }>;
      height: number;
    }

    const parsedRows: ParsedRow[] = rows.map((row) => {
      const cellsArr = Array.from(row.cells);
      const isHeaderRow =
        row.parentElement?.tagName.toLowerCase() === 'thead' ||
        (cellsArr.length > 0 && cellsArr.every((c) => c.tagName.toLowerCase() === 'th'));

      let maxLines = 1;
      const parsedCells = Array.from({ length: colCount }, (_, idx) => {
        const cell = cellsArr[idx];
        const isHeaderCell = cell ? cell.tagName.toLowerCase() === 'th' : isHeaderRow;
        const text = normalizePdfText((cell?.textContent || '').trim().replace(/\s+/g, ' '));
        pdf.setFont('helvetica', isHeaderCell ? 'bold' : 'normal');
        pdf.setFontSize(cellFontSize);
        const lines = text ? pdf.splitTextToSize(text, colWidths[idx] - cellPadX * 2) : [''];
        if (lines.length > maxLines) maxLines = lines.length;
        return { lines, isHeaderCell };
      });

      return {
        isHeader: isHeaderRow,
        cells: parsedCells,
        height: maxLines * cellLineHeight + cellPadY * 2,
      };
    });

    const headerRows = parsedRows.filter((r) => r.isHeader);

    const drawRow = (row: ParsedRow, rowIdx: number) => {
      let cx = marginX;
      const topY = y - 10;
      for (let c = 0; c < colCount; c++) {
        const w = colWidths[c];
        const cell = row.cells[c];
        if (cell.isHeaderCell) {
          pdf.setFillColor(241, 245, 249);
          pdf.rect(cx, topY, w, row.height, 'F');
        } else if (rowIdx % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(cx, topY, w, row.height, 'F');
        }
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.6);
        pdf.rect(cx, topY, w, row.height, 'S');

        pdf.setFont('helvetica', cell.isHeaderCell ? 'bold' : 'normal');
        pdf.setFontSize(cellFontSize);
        pdf.setTextColor(
          cell.isHeaderCell ? 15 : 30,
          cell.isHeaderCell ? 23 : 41,
          cell.isHeaderCell ? 42 : 59
        );

        let textY = topY + cellPadY + 9;
        for (const line of cell.lines) {
          pdf.text(line, cx + cellPadX, textY);
          textY += cellLineHeight;
        }
        cx += w;
      }
      y += row.height;
    };

    y += 4;
    for (let rIdx = 0; rIdx < parsedRows.length; rIdx++) {
      const row = parsedRows[rIdx];
      if (y - 10 + row.height > pageHeight - bottomMargin) {
        pdf.addPage();
        y = topMargin;
        if (!row.isHeader && headerRows.length > 0) {
          headerRows.forEach((hr, hIdx) => drawRow(hr, hIdx));
        }
      }
      drawRow(row, rIdx);
    }
    y += 10;
  };

  const renderListElement = (listEl: HTMLElement, ordered: boolean, depth = 0) => {
    const items = Array.from(listEl.children).filter(
      (c): c is HTMLElement => c.tagName.toLowerCase() === 'li'
    );
    const indent = marginX + 14 + depth * 16;
    const avail = maxWidth - (indent - marginX);

    items.forEach((li, index) => {
      const nestedLists: HTMLElement[] = [];
      const inlineRuns: InlineRun[] = [];
      const childVisuals: HTMLElement[] = [];

      for (const child of Array.from(li.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const cel = child as HTMLElement;
          const ctag = cel.tagName.toLowerCase();
          if (ctag === 'ul' || ctag === 'ol') {
            nestedLists.push(cel);
            continue;
          }
          if (ctag === 'img' || ctag === 'svg') {
            childVisuals.push(cel);
            continue;
          }
        }
        collectInlineRuns(
          child,
          { bold: false, italic: false, underline: false, code: false },
          inlineRuns
        );
      }

      if (inlineRuns.length > 0) {
        ensureSpace(18);
        if (ordered) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10.5);
          pdf.setTextColor(71, 85, 105);
          pdf.text(`${index + 1}.`, indent - 13, y);
        } else {
          pdf.setFillColor(accR, accG, accB);
          pdf.setDrawColor(accR, accG, accB);
          pdf.circle(indent - 7, y - 3.5, 1.9, depth % 2 === 0 ? 'F' : 'S');
        }
        renderInlineRuns(inlineRuns, {
          x: indent,
          availWidth: avail,
          fontSize: 10.8,
          lineHeight: 15.5,
          color: [30, 41, 59],
          afterSpacing: 3,
        });
      }

      if (options.includeMedia) {
        for (const vis of childVisuals) {
          if (vis.tagName.toLowerCase() === 'img') {
            const src = vis.getAttribute('src') || '';
            const alt = normalizePdfText(vis.getAttribute('alt') || 'Imagen');
            renderLoadedImageBox(src ? imageCache.get(src) || null : null, alt);
          } else {
            renderLoadedImageBox(svgCache.get(vis as unknown as SVGElement) || null, 'Gráfico');
          }
        }
      }

      for (const sub of nestedLists) {
        renderListElement(sub, sub.tagName.toLowerCase() === 'ol', depth + 1);
      }
    });

    if (depth === 0) y += 4;
  };

  const renderElementOrNodes = (container: HTMLElement, allowSubToc: boolean) => {
    let inlineBuffer: InlineRun[] = [];

    const flushInline = () => {
      if (inlineBuffer.length === 0) return;
      renderInlineRuns(inlineBuffer, {
        x: marginX,
        availWidth: maxWidth,
        fontSize: 10.8,
        lineHeight: 15.8,
        color: [30, 41, 59],
        afterSpacing: 5,
      });
      inlineBuffer = [];
    };

    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        collectInlineRuns(
          node,
          { bold: false, italic: false, underline: false, code: false },
          inlineBuffer
        );
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'img') {
        flushInline();
        if (options.includeMedia) {
          const src = el.getAttribute('src') || '';
          const alt = normalizePdfText(el.getAttribute('alt') || 'Imagen del apunte');
          renderLoadedImageBox(src ? imageCache.get(src) || null : null, alt);
        }
        continue;
      }

      if (tag === 'svg') {
        flushInline();
        if (options.includeMedia) {
          renderLoadedImageBox(svgCache.get(el as unknown as SVGElement) || null, 'Gráfico');
        }
        continue;
      }

      if (tag === 'hr') {
        flushInline();
        ensureSpace(14);
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.7);
        pdf.line(marginX, y, pageWidth - marginX, y);
        y += 12;
        continue;
      }

      if (
        tag === 'h1' ||
        tag === 'h2' ||
        tag === 'h3' ||
        tag === 'h4' ||
        tag === 'h5' ||
        tag === 'h6'
      ) {
        flushInline();
        const runs: InlineRun[] = [];
        collectInlineRuns(el, { bold: true, italic: false, underline: false, code: false }, runs);
        const fontSize = tag === 'h1' ? 15.5 : tag === 'h2' ? 13.2 : 11.5;
        const lineHeight = tag === 'h1' ? 20 : tag === 'h2' ? 17.5 : 15.5;
        y += tag === 'h1' ? 8 : 5;
        ensureSpace(lineHeight + 14);
        const headingPage = pdf.getCurrentPageInfo().pageNumber;
        const headingTitle = normalizePdfText((el.textContent || '').trim());
        if (allowSubToc && headingTitle && (tag === 'h1' || tag === 'h2')) {
          tocEntries.push({
            title: headingTitle,
            level: notes.length === 1 && tag === 'h1' ? 1 : 2,
            rawPage: headingPage,
          });
        }
        renderInlineRuns(runs, {
          x: marginX,
          availWidth: maxWidth,
          fontSize,
          lineHeight,
          color: [15, 23, 42],
          afterSpacing: tag === 'h1' ? 6 : 4,
        });
        continue;
      }

      if (tag === 'ul' || tag === 'ol') {
        flushInline();
        renderListElement(el, tag === 'ol', 0);
        continue;
      }

      if (tag === 'table') {
        flushInline();
        if (options.includeMedia) {
          renderTableElement(el as HTMLTableElement);
        }
        continue;
      }

      if (tag === 'blockquote') {
        flushInline();
        const runs: InlineRun[] = [];
        collectInlineRuns(el, { bold: false, italic: true, underline: false, code: false }, runs);
        renderInlineRuns(runs, {
          x: marginX + 14,
          availWidth: maxWidth - 14,
          fontSize: 10.5,
          lineHeight: 15.5,
          color: [71, 85, 105],
          afterSpacing: 6,
          leftAccentBar: true,
        });
        continue;
      }

      if (tag === 'pre') {
        flushInline();
        const rawCode = normalizePdfText(el.textContent || '').replace(/\r\n/g, '\n');
        const codeLines = rawCode.split('\n');
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(9);
        const wrappedCode: string[] = [];
        for (const cl of codeLines) {
          const split = pdf.splitTextToSize(cl || ' ', maxWidth - 16);
          wrappedCode.push(...split);
        }
        const boxH = wrappedCode.length * 12.5 + 14;
        ensureSpace(Math.min(boxH, 120));
        let lineOffset = 0;
        for (let idx = 0; idx < wrappedCode.length; idx++) {
          const wl = wrappedCode[idx];
          if (y + 14 > pageHeight - bottomMargin) {
            pdf.addPage();
            y = topMargin;
            lineOffset = 0;
          }
          if (lineOffset === 0) {
            const remainingLines = Math.min(
              wrappedCode.length - idx,
              Math.floor((pageHeight - bottomMargin - y) / 12.5)
            );
            const sliceH = Math.max(22, remainingLines * 12.5 + 10);
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.7);
            pdf.roundedRect(marginX, y - 9, maxWidth, sliceH, 4, 4, 'FD');
          }
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(30, 41, 59);
          pdf.text(wl, marginX + 8, y + 4);
          y += 12.5;
          lineOffset++;
        }
        y += 12;
        continue;
      }

      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        flushInline();
        const hasNestedBlockOrImage = Array.from(el.children).some(
          (c) =>
            BLOCK_TAGS.has(c.tagName.toLowerCase()) ||
            c.tagName.toLowerCase() === 'img' ||
            c.tagName.toLowerCase() === 'svg' ||
            Boolean(c.querySelector('img, svg, table, ul, ol'))
        );
        if (hasNestedBlockOrImage) {
          renderElementOrNodes(el, allowSubToc);
        } else {
          const runs: InlineRun[] = [];
          collectInlineRuns(el, { bold: false, italic: false, underline: false, code: false }, runs);
          if (runs.length > 0) {
            renderInlineRuns(runs, {
              x: marginX,
              availWidth: maxWidth,
              fontSize: 10.8,
              lineHeight: 15.8,
              color: [30, 41, 59],
              afterSpacing: 5,
            });
          } else if (el.innerHTML.includes('<br')) {
            y += 8;
          }
        }
        continue;
      }

      if (el.querySelector('img, svg')) {
        flushInline();
        renderElementOrNodes(el, allowSubToc);
      } else {
        collectInlineRuns(
          el,
          { bold: false, italic: false, underline: false, code: false },
          inlineBuffer
        );
      }
    }

    flushInline();
  };

  // 2. Render Each Note
  notes.forEach((note, noteIdx) => {
    if (noteIdx > 0) {
      pdf.addPage();
      y = topMargin;
    }

    const noteStartPage = pdf.getCurrentPageInfo().pageNumber;
    const noteTitle = normalizePdfText(note.title || `Apunte ${noteIdx + 1}`);
    tocEntries.push({
      title: notes.length > 1 ? `${noteIdx + 1}. ${noteTitle}` : noteTitle,
      level: 1,
      rawPage: noteStartPage,
    });

    // Note editorial header
    pdf.setFillColor(accR, accG, accB);
    pdf.rect(marginX, y - 14, maxWidth, 3, 'F');
    y += 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(accR, accG, accB);
    pdf.text(
      notes.length > 1
        ? `FABRO · APUNTE ${noteIdx + 1} DE ${notes.length}`
        : 'FABRO · APUNTE ACADÉMICO',
      marginX,
      y
    );
    y += 18;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(19);
    pdf.setTextColor(15, 23, 42);
    const titleLines = pdf.splitTextToSize(noteTitle, maxWidth);
    pdf.text(titleLines, marginX, y);
    y += titleLines.length * 23 + 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(100, 116, 139);
    const metaParts = [
      `Materia: ${note.subjectName || 'General'}`,
      note.unit ? `Unidad: ${note.unit}` : '',
      note.folder ? `Carpeta: ${note.folder}` : '',
      note.tags && note.tags.length > 0 ? `Etiquetas: ${note.tags.join(', ')}` : '',
      new Date().toLocaleDateString('es-AR'),
    ]
      .filter(Boolean)
      .map(normalizePdfText);
    const metaWrapped = pdf.splitTextToSize(metaParts.join(' · '), maxWidth);
    pdf.text(metaWrapped, marginX, y);
    y += metaWrapped.length * 13 + 6;

    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.8);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 18;

    const doc = parsedDocs[noteIdx];
    if (doc.body.childNodes.length > 0) {
      renderElementOrNodes(doc.body, true);
    } else if (note.contentText.trim()) {
      renderInlineRuns(
        [{ text: normalizePdfText(note.contentText), bold: false, italic: false, underline: false, code: false }],
        {
          x: marginX,
          availWidth: maxWidth,
          fontSize: 10.8,
          lineHeight: 15.8,
          color: [30, 41, 59],
          afterSpacing: 5,
        }
      );
    }

    if (note.attachments && note.attachments.length > 0) {
      ensureSpace(44);
      y += 8;
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.line(marginX, y, pageWidth - marginX, y);
      y += 16;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Archivos adjuntos en la biblioteca', marginX, y);
      y += 14;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(71, 85, 105);
      for (const att of note.attachments) {
        const sizeKb = att.sizeBytes ? ` (${Math.max(1, Math.round(att.sizeBytes / 1024))} KB)` : '';
        const line = normalizePdfText(`• ${att.name}${sizeKb}`);
        const wrapped = pdf.splitTextToSize(line, maxWidth);
        ensureSpace(wrapped.length * 13 + 3);
        pdf.text(wrapped, marginX, y);
        y += wrapped.length * 13 + 3;
      }
    }
  });

  // 3. Optional Bibliography & Citations section
  const bibLines = (options.bibliographyText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (options.includeBibliography && bibLines.length > 0) {
    pdf.addPage();
    y = topMargin;
    const bibPage = pdf.getCurrentPageInfo().pageNumber;
    tocEntries.push({
      title: 'Bibliografía y citas',
      level: 1,
      rawPage: bibPage,
    });

    pdf.setFillColor(accR, accG, accB);
    pdf.rect(marginX, y - 14, maxWidth, 3, 'F');
    y += 4;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Bibliografía y citas', marginX, y);
    y += 14;

    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.8);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 20;

    bibLines.forEach((entry, idx) => {
      const cleanEntry = normalizePdfText(`${idx + 1}. ${entry}`);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10.2);
      pdf.setTextColor(30, 41, 59);
      const wrapped = pdf.splitTextToSize(cleanEntry, maxWidth - 8);
      ensureSpace(wrapped.length * 14.5 + 8);
      pdf.text(wrapped, marginX, y);

      const urlMatch = entry.match(/https?:\/\/[^\s)]+/i);
      if (urlMatch) {
        pdf.link(marginX, y - 10, maxWidth, wrapped.length * 14.5, { url: urlMatch[0] });
      }
      y += wrapped.length * 14.5 + 8;
    });
  }

  // 4. Optional Automatic Table of Contents (inserted right before startBodyPage with exact shifted pages)
  if (options.includeToc && tocEntries.length > 0) {
    const tocTopHeaderH = 56;
    const rowH = 22;
    const usableTocH = pageHeight - topMargin - bottomMargin - tocTopHeaderH;
    const rowsPerPage = Math.max(8, Math.floor(usableTocH / rowH));
    const tocPagesCount = Math.max(1, Math.ceil(tocEntries.length / rowsPerPage));

    for (let p = 0; p < tocPagesCount; p++) {
      pdf.insertPage(startBodyPage);
    }

    for (let p = 0; p < tocPagesCount; p++) {
      pdf.setPage(startBodyPage + p);
      let ty = topMargin;

      pdf.setFillColor(accR, accG, accB);
      pdf.rect(marginX, ty - 14, maxWidth, 3, 'F');
      ty += 4;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.setTextColor(15, 23, 42);
      pdf.text(
        p === 0 ? 'Índice de contenidos' : 'Índice de contenidos (continuación)',
        marginX,
        ty
      );
      ty += 12;

      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.8);
      pdf.line(marginX, ty, pageWidth - marginX, ty);
      ty += 24;

      const slice = tocEntries.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
      for (const entry of slice) {
        const finalTargetPage = entry.rawPage + tocPagesCount;
        const displayPageNum = options.includeCover ? finalTargetPage - 1 : finalTargetPage;
        const indentX = entry.level === 1 ? marginX : marginX + 18;
        const availTextW = maxWidth - (indentX - marginX) - 42;

        pdf.setFont('helvetica', entry.level === 1 ? 'bold' : 'normal');
        pdf.setFontSize(entry.level === 1 ? 10.8 : 9.8);
        pdf.setTextColor(entry.level === 1 ? 15 : 51, entry.level === 1 ? 23 : 65, entry.level === 1 ? 42 : 85);

        let label = entry.title;
        while (label.length > 8 && pdf.getTextWidth(label) > availTextW) {
          label = `${label.slice(0, -4)}...`;
        }
        const labelW = pdf.getTextWidth(label);
        pdf.text(label, indentX, ty);

        const pageStr = String(displayPageNum);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(accR, accG, accB);
        const pageNumW = pdf.getTextWidth(pageStr);
        pdf.text(pageStr, pageWidth - marginX - pageNumW, ty);

        // Dotted leader between label and page number
        const dotsStartX = indentX + labelW + 6;
        const dotsEndX = pageWidth - marginX - pageNumW - 8;
        if (dotsEndX > dotsStartX + 10) {
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.6);
          for (let dx = dotsStartX; dx < dotsEndX; dx += 5) {
            pdf.line(dx, ty - 1, dx + 1.5, ty - 1);
          }
        }

        pdf.link(indentX, ty - 11, maxWidth - (indentX - marginX), 16, {
          pageNumber: finalTargetPage,
        });
        ty += rowH;
      }
    }
  }

  // 5. Page Numbering Footer (skips Cover Page if Cover is enabled)
  const totalPages = pdf.getNumberOfPages();
  const footerStartPage = options.includeCover ? 2 : 1;
  const displayTotalPages = options.includeCover ? Math.max(1, totalPages - 1) : totalPages;
  const footerDocLabel = normalizePdfText(
    options.coverTitle?.trim() || notes[0]?.title || 'Apunte FABRO'
  ).slice(0, 55);

  if (options.includePageNumbers) {
    for (let i = footerStartPage; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(marginX, pageHeight - 32, pageWidth - marginX, pageHeight - 32);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`FABRO · ${footerDocLabel}`, marginX, pageHeight - 19);

      const displayCurrent = options.includeCover ? i - 1 : i;
      const pageLabel = `Página ${displayCurrent} de ${displayTotalPages}`;
      const labelW = pdf.getTextWidth(pageLabel);
      pdf.text(pageLabel, pageWidth - marginX - labelW, pageHeight - 19);
    }
  }

  const baseName = options.fileName || options.coverTitle || notes[0]?.title || 'apuntes-fabro';
  const filename = `${safeFileSlug(baseName)}.pdf`;
  const blob = pdf.output('blob');
  return { blob, filename, pageCount: totalPages };
}

export async function exportNoteToPdf(params: {
  title: string;
  subjectName?: string;
  unit?: string;
  folder?: string;
  tags?: string[];
  attachments?: Array<{ name: string; sizeBytes?: number }>;
  contentHtml: string;
  contentText: string;
}) {
  const result = await exportNotesStudioPdf({
    notes: [
      {
        title: params.title,
        subjectName: params.subjectName,
        unit: params.unit,
        folder: params.folder,
        tags: params.tags,
        attachments: params.attachments,
        contentHtml: params.contentHtml,
        contentText: params.contentText,
      },
    ],
    pageSize: 'a4',
    orientation: 'portrait',
    includeCover: false,
    coverTitle: params.title || 'Apunte FABRO',
    includeToc: false,
    includePageNumbers: true,
    includeMedia: true,
    includeBibliography: false,
    fileName: params.title || 'apunte-fabro',
  });
  triggerBlobDownload(result.blob, result.filename);
}

export async function exportNoteToWord(params: {
  title: string;
  subjectName?: string;
  folder?: string;
  tags?: string[];
  contentHtml: string;
  contentText: string;
}) {
  const lines = stripHtmlToLines(params.contentHtml);
  const bodyLines = lines.length > 0 ? lines : (params.contentText || '').split('\n');

  const children: Paragraph[] = [
    new Paragraph({
      text: params.title || 'Apunte sin título',
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: [
            params.subjectName || 'General',
            params.folder ? `Carpeta: ${params.folder}` : '',
            params.tags && params.tags.length > 0 ? `Etiquetas: ${params.tags.join(', ')}` : '',
            `Exportado desde FABRO (${new Date().toLocaleDateString('es-AR')})`,
          ]
            .filter(Boolean)
            .join(' · '),
          color: '64748B',
          size: 20,
        }),
      ],
      spacing: { after: 280 },
    }),
  ];

  for (const rawLine of bodyLines) {
    if (rawLine.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: rawLine.slice(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (rawLine.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: rawLine.slice(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 160, after: 80 },
        })
      );
    } else if (rawLine.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: rawLine.slice(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 120, after: 60 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          text: rawLine,
          spacing: { after: 110 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = (params.title || 'apunte-fabro').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]+/g, '_');
  anchor.href = url;
  anchor.download = `${safeName}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(escapedLine: string): string {
  return escapedLine
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function markdownToHtml(markdown: string): string {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  const splitTableCells = (row: string): string[] => {
    const cleaned = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    return cleaned.split('|').map((c) => c.trim());
  };

  const isTableSeparator = (row: string): boolean => {
    const trimmed = row.trim();
    if (!trimmed.includes('|')) return false;
    return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(trimmed);
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    // Markdown table block
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeLists();
      const headers = splitTableCells(trimmed);
      i += 2; // skip header + separator
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && !isTableSeparator(lines[i])) {
        bodyRows.push(splitTableCells(lines[i]));
        i++;
      }
      i--; // compensate outer loop increment

      const theadHtml = `<thead><tr>${headers
        .map((h) => `<th>${formatInlineMarkdown(escapeHtml(h))}</th>`)
        .join('')}</tr></thead>`;
      const tbodyHtml =
        bodyRows.length > 0
          ? `<tbody>${bodyRows
              .map(
                (r) =>
                  `<tr>${headers
                    .map((_, idx) => `<td>${formatInlineMarkdown(escapeHtml(r[idx] || ''))}</td>`)
                    .join('')}</tr>`
              )
              .join('')}</tbody>`
          : '';
      out.push(`<table>${theadHtml}${tbodyHtml}</table>`);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      closeLists();
      out.push(`<h3>${formatInlineMarkdown(escapeHtml(trimmed.slice(4)))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      closeLists();
      out.push(`<h2>${formatInlineMarkdown(escapeHtml(trimmed.slice(3)))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      closeLists();
      out.push(`<h1>${formatInlineMarkdown(escapeHtml(trimmed.slice(2)))}</h1>`);
    } else if (trimmed.startsWith('> ')) {
      closeLists();
      out.push(`<blockquote><p>${formatInlineMarkdown(escapeHtml(trimmed.slice(2)))}</p></blockquote>`);
    } else if (/^[-*•]\s+/.test(trimmed)) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^[-*•]\s+/, '')))}</li>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^\d+\.\s+/, '')))}</li>`);
    } else if (/^[-*_]{3,}$/.test(trimmed)) {
      closeLists();
      out.push('<hr />');
    } else {
      closeLists();
      out.push(`<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`);
    }
  }
  closeLists();
  return out.join('');
}

function stripMarkdownSyntax(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function safeFileSlug(title: string): string {
  return (title || 'resumen-fabro').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]+/g, '_').slice(0, 80);
}

export function exportMarkdownToPdf(params: {
  title: string;
  subjectName?: string;
  sourceUrls?: Array<{ title?: string; url: string }>;
  markdown: string;
}) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = 56;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin - 20) {
      pdf.addPage();
      y = margin;
    }
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.setTextColor(15, 23, 42);
  const titleLines = pdf.splitTextToSize(params.title || 'Resumen de fuentes · FABRO', maxWidth);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 21 + 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(100, 116, 139);
  const metaText = [
    params.subjectName ? `Materia: ${params.subjectName}` : 'FABRO Investigación',
    `Generado el ${new Date().toLocaleDateString('es-AR')}`,
  ].join(' · ');
  pdf.text(metaText, margin, y);
  y += 16;

  pdf.setDrawColor(203, 213, 225);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 20;

  const lines = (params.markdown || '').replace(/\r\n/g, '\n').split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      y += 6;
      continue;
    }

    let fontSize = 10.5;
    let isBold = false;
    let text = stripMarkdownSyntax(trimmed);

    if (trimmed.startsWith('# ')) {
      fontSize = 14.5;
      isBold = true;
      text = stripMarkdownSyntax(trimmed.slice(2));
      y += 6;
    } else if (trimmed.startsWith('## ')) {
      fontSize = 12.5;
      isBold = true;
      text = stripMarkdownSyntax(trimmed.slice(3));
      y += 5;
    } else if (trimmed.startsWith('### ')) {
      fontSize = 11.2;
      isBold = true;
      text = stripMarkdownSyntax(trimmed.slice(4));
      y += 3;
    } else if (/^[-*]\s+/.test(trimmed)) {
      text = `• ${stripMarkdownSyntax(trimmed.replace(/^[-*]\s+/, ''))}`;
    }

    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(30, 41, 59);

    const wrapped = pdf.splitTextToSize(text, maxWidth);
    const neededHeight = wrapped.length * (fontSize * 1.4) + 5;
    ensureSpace(neededHeight);
    pdf.text(wrapped, margin, y);
    y += neededHeight;
  }

  if (params.sourceUrls && params.sourceUrls.length > 0) {
    ensureSpace(48);
    y += 10;
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 16;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Enlaces de fuentes consultadas', margin, y);
    y += 14;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    for (const s of params.sourceUrls) {
      const label = s.title ? `${s.title}: ${s.url}` : s.url;
      const wrapped = pdf.splitTextToSize(label, maxWidth);
      const needed = wrapped.length * 13 + 3;
      ensureSpace(needed);
      pdf.text(wrapped, margin, y);
      y += needed;
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`FABRO · Página ${i} de ${totalPages}`, pageWidth - margin - 95, pageHeight - 24);
  }

  pdf.save(`${safeFileSlug(params.title)}.pdf`);
}

export async function exportMarkdownToWord(params: {
  title: string;
  subjectName?: string;
  sourceUrls?: Array<{ title?: string; url: string }>;
  markdown: string;
}) {
  const children: Paragraph[] = [
    new Paragraph({
      text: params.title || 'Resumen de fuentes · FABRO',
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: [
            params.subjectName ? `Materia: ${params.subjectName}` : 'FABRO Investigación',
            `Generado el ${new Date().toLocaleDateString('es-AR')}`,
          ].join(' · '),
          color: '64748B',
          size: 20,
        }),
      ],
      spacing: { after: 260 },
    }),
  ];

  const lines = (params.markdown || '').replace(/\r\n/g, '\n').split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: stripMarkdownSyntax(trimmed.slice(2)),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: stripMarkdownSyntax(trimmed.slice(3)),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 160, after: 80 },
        })
      );
    } else if (trimmed.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: stripMarkdownSyntax(trimmed.slice(4)),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 120, after: 60 },
        })
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      children.push(
        new Paragraph({
          text: stripMarkdownSyntax(trimmed.replace(/^[-*]\s+/, '')),
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          text: stripMarkdownSyntax(trimmed),
          spacing: { after: 110 },
        })
      );
    }
  }

  if (params.sourceUrls && params.sourceUrls.length > 0) {
    children.push(
      new Paragraph({
        text: 'Fuentes consultadas',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
      })
    );
    for (const s of params.sourceUrls) {
      children.push(
        new Paragraph({
          text: s.title ? `${s.title} — ${s.url}` : s.url,
          bullet: { level: 0 },
          spacing: { after: 70 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, `${safeFileSlug(params.title)}.docx`);
}

export function exportMarkdownToHtmlPrint(params: {
  title: string;
  subjectName?: string;
  sourceUrls?: Array<{ title?: string; url: string }>;
  markdown: string;
}) {
  const bodyHtml = markdownToHtml(params.markdown);
  const sourcesHtml =
    params.sourceUrls && params.sourceUrls.length > 0
      ? `<section class="sources"><h2>Enlaces de fuentes consultadas</h2><ul>${params.sourceUrls
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.title || s.url)}</strong>: <a href="${escapeHtml(s.url)}">${escapeHtml(s.url)}</a></li>`
          )
          .join('')}</ul></section>`
      : '';

  const fullHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.title || 'Resumen de fuentes · FABRO')}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.6; max-width: 760px; margin: 32px auto; padding: 0 20px; }
    header { border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { font-size: 22px; margin: 0 0 6px; color: #0f172a; }
    .meta { font-size: 12px; color: #475569; }
    h2 { font-size: 16px; margin-top: 20px; color: #0f172a; }
    h3 { font-size: 14px; margin-top: 14px; color: #1e293b; }
    p { margin: 0 0 10px; font-size: 13.5px; }
    ul, ol { margin: 0 0 12px; padding-left: 22px; font-size: 13.5px; }
    li { margin-bottom: 4px; }
    a { color: #0284c7; word-break: break-all; }
    code { font-family: ui-monospace, monospace; font-size: 12px; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
    .sources { margin-top: 24px; padding-top: 14px; border-top: 1px solid #cbd5e1; }
    .print-bar { margin-bottom: 20px; text-align: right; }
    .print-btn { background: #0284c7; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; }
    @media print { .print-bar { display: none; } body { margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <div class="print-bar"><button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <header>
    <h1>${escapeHtml(params.title || 'Resumen de fuentes')}</h1>
    <div class="meta">${escapeHtml(params.subjectName ? `Materia: ${params.subjectName}` : 'FABRO Investigación')} · ${escapeHtml(new Date().toLocaleDateString('es-AR'))}</div>
  </header>
  <main>${bodyHtml}</main>
  ${sourcesHtml}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  triggerBlobDownload(blob, `${safeFileSlug(params.title)}.html`);
}

export function exportMarkdownToText(params: {
  title: string;
  subjectName?: string;
  sourceUrls?: Array<{ title?: string; url: string }>;
  markdown: string;
  format: 'md' | 'txt';
}) {
  const header =
    params.format === 'md'
      ? `# ${params.title}\n\n_${params.subjectName ? `Materia: ${params.subjectName} · ` : ''}${new Date().toLocaleDateString('es-AR')}_\n\n`
      : `${params.title.toUpperCase()}\n${params.subjectName ? `Materia: ${params.subjectName} · ` : ''}${new Date().toLocaleDateString('es-AR')}\n${'='.repeat(48)}\n\n`;

  const body =
    params.format === 'md'
      ? params.markdown
      : params.markdown
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1');

  const sourcesBlock =
    params.sourceUrls && params.sourceUrls.length > 0
      ? `\n\n${params.format === 'md' ? '## Fuentes consultadas' : 'FUENTES CONSULTADAS'}\n` +
        params.sourceUrls.map((s) => `- ${s.title ? `${s.title}: ` : ''}${s.url}`).join('\n')
      : '';

  const mime = params.format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
  const blob = new Blob([header + body + sourcesBlock], { type: mime });
  triggerBlobDownload(blob, `${safeFileSlug(params.title)}.${params.format}`);
}

export async function exportBookToWord(params: {
  title: string;
  subtitle?: string;
  authorName?: string;
  genreLabel?: string;
  dedication?: string;
  synopsis?: string;
  bibliography?: string;
  chapters: Array<{
    title: string;
    contentHtml: string;
    contentText: string;
  }>;
}) {
  const children: Paragraph[] = [
    new Paragraph({
      text: params.title || 'Libro sin título',
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
  ];

  if (params.subtitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: params.subtitle,
            italics: true,
            color: '475569',
            size: 26,
          }),
        ],
        spacing: { after: 160 },
      })
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: [
            params.authorName ? `Autor: ${params.authorName}` : '',
            params.genreLabel || '',
            `Exportado desde FABRO (${new Date().toLocaleDateString('es-AR')})`,
          ]
            .filter(Boolean)
            .join(' · '),
          color: '64748B',
          size: 20,
        }),
      ],
      spacing: { after: 320 },
    })
  );

  if (params.dedication && params.dedication.trim()) {
    children.push(
      new Paragraph({
        text: 'Dedicatoria',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: params.dedication.trim(),
            italics: true,
          }),
        ],
        spacing: { after: 280 },
      })
    );
  }

  if (params.synopsis && params.synopsis.trim()) {
    children.push(
      new Paragraph({
        text: 'Sinopsis',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 80 },
      }),
      new Paragraph({
        text: params.synopsis.trim(),
        spacing: { after: 280 },
      })
    );
  }

  params.chapters.forEach((chapter, idx) => {
    children.push(
      new Paragraph({
        text: `Capítulo ${idx + 1}: ${chapter.title || 'Sin título'}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 140 },
      })
    );

    const lines = stripHtmlToLines(chapter.contentHtml);
    const bodyLines = lines.length > 0 ? lines : (chapter.contentText || '').split('\n');
    for (const rawLine of bodyLines) {
      if (!rawLine.trim()) continue;
      if (rawLine.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: rawLine.slice(2),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 90 },
          })
        );
      } else if (rawLine.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: rawLine.slice(3),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 70 },
          })
        );
      } else if (rawLine.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: rawLine.slice(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 120, after: 60 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: rawLine,
            spacing: { after: 120 },
          })
        );
      }
    }
  });

  if (params.bibliography && params.bibliography.trim()) {
    children.push(
      new Paragraph({
        text: 'Bibliografía y referencias',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 120 },
      })
    );
    for (const line of params.bibliography.split('\n')) {
      if (!line.trim()) continue;
      children.push(
        new Paragraph({
          text: line.trim(),
          spacing: { after: 90 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, `${safeFileSlug(params.title || 'libro-fabro')}.docx`);
}

export function exportCourseCertificatePdf(params: {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  area: string;
  estimatedHours: number;
  completionDate?: string;
}) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, w, h, 'F');

  pdf.setDrawColor(2, 132, 199);
  pdf.setLineWidth(6);
  pdf.rect(24, 24, w - 48, h - 48, 'S');
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(1);
  pdf.rect(34, 34, w - 68, h - 68, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(2, 132, 199);
  pdf.text('PROYECTO FABRO · FABRO ACADEMY', w / 2, 90, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(30);
  pdf.setTextColor(15, 23, 42);
  pdf.text('CONSTANCIA DE PARTICIPACIÓN Y FINALIZACIÓN', w / 2, 145, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Se deja constancia de que', w / 2, 200, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(26);
  pdf.setTextColor(15, 23, 42);
  pdf.text(normalizePdfText(params.studentName || 'Estudiante'), w / 2, 245, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(71, 85, 105);
  pdf.text('completó satisfactoriamente el curso abierto y gratuito', w / 2, 290, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(2, 132, 199);
  const wrappedTitle = pdf.splitTextToSize(normalizePdfText(params.courseTitle), w - 160);
  pdf.text(wrappedTitle, w / 2, 332, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.setTextColor(51, 65, 85);
  pdf.text(
    normalizePdfText(
      `Área: ${params.area} · Carga horaria estimada: ${params.estimatedHours} h · Fecha: ${params.completionDate || new Date().toLocaleDateString('es-AR')}`
    ),
    w / 2,
    405,
    { align: 'center' }
  );

  pdf.setDrawColor(148, 163, 184);
  pdf.line(130, 485, 340, 485);
  pdf.line(w - 340, 485, w - 130, 485);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(normalizePdfText(params.instructorName || 'Instructor FABRO'), 235, 505, { align: 'center' });
  pdf.text('PROYECTO FABRO · Educación Universal', w - 235, 505, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Docente / Instructor del curso', 235, 522, { align: 'center' });
  pdf.text('Plataforma educativa abierta y gratuita', w - 235, 522, { align: 'center' });

  pdf.save(`Constancia_${safeFileSlug(params.courseTitle)}.pdf`);
}

