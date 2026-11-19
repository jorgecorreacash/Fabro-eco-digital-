import type { SrsFlashcard } from '../types/ecosystem';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  // Bold + italic
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code style="background:rgba(37,99,235,0.1);padding:1px 5px;border-radius:4px;font-family:monospace;">$1</code>');
  return out;
}

/**
 * Convierte respuesta Markdown de la IA BYOK en HTML semántico y editable para la Hoja tipo Word.
 */
export function markdownToWordHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      blocks.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      blocks.push('</ol>');
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeLists();
      blocks.push('<hr style="margin:18px 0;border:none;border-top:1px solid rgba(148,163,184,0.4);" />');
      continue;
    }

    if (trimmed.startsWith('### ')) {
      closeLists();
      blocks.push(`<h3>${formatInlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeLists();
      blocks.push(`<h2>${formatInlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      closeLists();
      blocks.push(`<h1>${formatInlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      closeLists();
      blocks.push(
        `<blockquote style="border-left:4px solid #2563EB;background:rgba(37,99,235,0.08);padding:10px 14px;border-radius:0 10px 10px 0;margin:12px 0;">${formatInlineMarkdown(
          trimmed.slice(2)
        )}</blockquote>`
      );
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        blocks.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        blocks.push('<ul style="list-style:disc;padding-left:1.5rem;margin:8px 0;">');
        inUl = true;
      }
      blocks.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        blocks.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        blocks.push('<ol style="list-style:decimal;padding-left:1.5rem;margin:8px 0;">');
        inOl = true;
      }
      blocks.push(`<li>${formatInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    blocks.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  }

  closeLists();
  return blocks.join('');
}

export function extractPlainTextFromHtml(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.innerText || div.textContent || '').trim();
}

/**
 * Extrae fichas de repaso (Flashcards SRS) automáticamente desde el documento de estudio.
 */
export function buildFlashcardsFromStudyDocument(
  title: string,
  subject: string,
  plainText: string
): SrsFlashcard[] {
  const lines = plainText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 12);

  const cards: SrsFlashcard[] = [];
  const usedFronts = new Set<string>();

  const pushCard = (front: string, back: string) => {
    const cleanFront = front.replace(/^[-*•\d.)\s]+/, '').trim();
    const cleanBack = back.replace(/^[-*•\s]+/, '').trim();
    if (cleanFront.length < 6 || cleanBack.length < 8) return;
    const key = cleanFront.toLowerCase();
    if (usedFronts.has(key)) return;
    usedFronts.add(key);
    cards.push({
      id: `fc-doc-${Date.now()}-${cards.length}`,
      subject: subject || 'Estudio',
      front: cleanFront.slice(0, 200),
      back: cleanBack.slice(0, 420),
      difficulty: 'nueva',
      intervalLabel: 'Hoy',
      reviews: 0,
    });
  };

  // Pass 1: Explicit Q&A or "Concepto: Definición" lines
  for (let i = 0; i < lines.length && cards.length < 10; i++) {
    const line = lines[i];
    if (line.includes('¿') && line.includes('?')) {
      const qEnd = line.indexOf('?') + 1;
      const q = line.slice(0, qEnd).trim();
      const rest = line.slice(qEnd).replace(/^[:\-\s]+/, '').trim();
      const answer = rest || lines[i + 1] || '';
      if (answer) pushCard(q, answer);
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 4 && colonIdx < 80) {
      const concept = line.slice(0, colonIdx).trim();
      const def = line.slice(colonIdx + 1).trim();
      if (def.length >= 16) {
        pushCard(`¿Qué es o qué implica "${concept}"?`, def);
      }
    }
  }

  // Pass 2: Headings followed by explanation paragraphs
  if (cards.length < 4) {
    for (let i = 0; i < lines.length - 1 && cards.length < 8; i++) {
      const cur = lines[i];
      const next = lines[i + 1];
      if (cur.length <= 75 && !cur.endsWith('.') && next.length >= 28) {
        pushCard(`Explicá: ${cur}`, next);
      }
    }
  }

  // Fallback card if text is a short paragraph
  if (cards.length === 0 && plainText.trim().length > 15) {
    pushCard(
      `Idea principal de "${title || subject || 'este apunte'}"`,
      plainText.trim().slice(0, 380)
    );
  }

  return cards;
}

function slugifyFileName(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'apunte-fabro'
  );
}

/**
 * Descarga el apunte como archivo .doc compatible con Word, LibreOffice y Google Docs.
 */
export function downloadStudyAsDoc(title: string, subject: string, htmlBody: string): void {
  const safeTitle = escapeHtml(title || 'Apunte de Estudio FABRO');
  const safeSubject = escapeHtml(subject || 'Estudio General');
  const docHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="es">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  body { font-family: Calibri, Georgia, Arial, sans-serif; color: #0f172a; line-height: 1.65; margin: 2.2cm; font-size: 11.5pt; }
  h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 1.5pt solid #cbd5e1; padding-bottom: 6pt; margin-bottom: 10pt; }
  h2 { font-size: 14.5pt; color: #1d4ed8; margin-top: 16pt; margin-bottom: 6pt; }
  h3 { font-size: 12.5pt; color: #0f172a; margin-top: 12pt; margin-bottom: 4pt; }
  blockquote { border-left: 4pt solid #2563eb; background: #eff6ff; padding: 8pt 12pt; margin: 10pt 0; }
  .meta { font-size: 9.5pt; color: #475569; margin-bottom: 16pt; }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p class="meta">Materia: <strong>${safeSubject}</strong> · Generado y editado en FABRO Estudio</p>
  ${htmlBody}
</body>
</html>`;

  const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugifyFileName(title)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga el apunte como archivo .txt limpio.
 */
export function downloadStudyAsTxt(title: string, subject: string, plainText: string): void {
  const content = `${title || 'Apunte FABRO'}\nMateria: ${subject || 'General'}\n${'='.repeat(
    50
  )}\n\n${plainText}\n`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugifyFileName(title)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Genera impresión / PDF limpio con formato de documento académico mediante un iframe oculto
 * (evita window.open bloqueado en iframes).
 */
export function printStudyDocumentAsPdf(title: string, subject: string, htmlBody: string): void {
  if (typeof document === 'undefined') return;
  const safeTitle = escapeHtml(title || 'Apunte de Estudio FABRO');
  const safeSubject = escapeHtml(subject || 'Estudio General');
  const dateLabel = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; line-height: 1.7; font-size: 11.5pt; }
  header { border-bottom: 2px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 20px; }
  h1 { font-family: system-ui, -apple-system, sans-serif; font-size: 20pt; margin: 0 0 6px 0; color: #0f172a; }
  .meta { font-family: system-ui, sans-serif; font-size: 9.5pt; color: #475569; margin: 0; }
  h2 { font-family: system-ui, sans-serif; font-size: 14pt; color: #1d4ed8; margin-top: 18px; }
  h3 { font-family: system-ui, sans-serif; font-size: 12pt; color: #1e293b; margin-top: 14px; }
  blockquote { border-left: 4px solid #2563eb; background: #eff6ff; padding: 10px 14px; margin: 12px 0; }
  ul, ol { padding-left: 22px; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
  <header>
    <h1>${safeTitle}</h1>
    <p class="meta">Materia: ${safeSubject} · Fecha: ${dateLabel} · Cuaderno Académico FABRO</p>
  </header>
  <main>${htmlBody}</main>
</body>
</html>`);
  doc.close();

  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1500);
    }
  }, 180);
}
