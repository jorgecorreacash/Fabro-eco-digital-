import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  ImageOff,
  Info,
  Loader2,
  Maximize2,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';

export interface WikiMediaItem {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  description?: string;
  extendedInfo?: string;
  author?: string;
  license?: string;
  dateCreated?: string;
  dimensions?: string;
  mimeType?: string;
  categoryTag?: string;
  sourceName?: string;
  sourceDomain?: string;
  sourcePageUrl?: string;
  width?: number;
  height?: number;
  aiAnalysisMarkdown?: string;
  source?: 'enciclopedia' | 'commons' | 'nasa' | 'openverse' | 'met' | 'wikipedia' | 'nota';
}

export function escapeEncyclopediaHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function simpleMarkdownToHtml(md: string): string {
  if (!md) return '';
  const lines = md.split('\n');
  const htmlParts: string[] = [];
  let inList = false;

  const inlineFormat = (txt: string) =>
    escapeEncyclopediaHtml(txt)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
    } else if (/^[-*•]\s+/.test(line)) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${inlineFormat(line.replace(/^[-*•]\s+/, ''))}</li>`);
    } else {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(`<p>${inlineFormat(line)}</p>`);
    }
  }
  if (inList) htmlParts.push('</ul>');
  return htmlParts.join('\n');
}

export function buildEncyclopediaNoteContent(
  item: WikiMediaItem,
  aiAnalysisMarkdown?: string
): { title: string; contentHtml: string; contentText: string; tags: string[] } {
  const safeSrc = escapeEncyclopediaHtml(item.fullUrl || item.thumbUrl);
  const safeThumb = escapeEncyclopediaHtml(item.thumbUrl || item.fullUrl);
  const safeTitle = escapeEncyclopediaHtml(item.title || 'Lámina enciclopédica');
  const safeDesc = escapeEncyclopediaHtml(item.description || '');
  const safeExtended = escapeEncyclopediaHtml(item.extendedInfo || '');
  const dims =
    item.dimensions ||
    (item.width && item.height ? `${item.width} × ${item.height} px` : '');

  const rows: Array<[string, string]> = [
    ['Fuente / Archivo', item.sourceName || item.sourceDomain || 'Atlas enciclopédico'],
    ...(item.author ? [['Autoría / Colección', item.author] as [string, string]] : []),
    ...(item.dateCreated ? [['Fecha de registro', item.dateCreated] as [string, string]] : []),
    ...(item.license ? [['Licencia', item.license] as [string, string]] : []),
    ...(dims ? [['Resolución', dims] as [string, string]] : []),
    ...(item.categoryTag ? [['Categoría', item.categoryTag] as [string, string]] : []),
  ];

  const tableHtml = `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
    <tbody>
      ${rows
        .map(
          ([k, v]) =>
            `<tr><th style="text-align:left;padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;width:32%;">${escapeEncyclopediaHtml(
              k
            )}</th><td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeEncyclopediaHtml(
              v
            )}</td></tr>`
        )
        .join('')}
      ${
        item.sourcePageUrl
          ? `<tr><th style="text-align:left;padding:6px 8px;border:1px solid #cbd5e1;background:#f8fafc;">Enlace documental</th><td style="padding:6px 8px;border:1px solid #cbd5e1;"><a href="${escapeEncyclopediaHtml(
              item.sourcePageUrl
            )}" target="_blank" rel="noopener noreferrer">${escapeEncyclopediaHtml(
              item.sourcePageUrl
            )}</a></td></tr>`
          : ''
      }
    </tbody>
  </table>`;

  const figureHtml = `<figure class="fabro-wiki-figure fabro-wiki-right"><img src="${safeThumb}" data-full-src="${safeSrc}" alt="${safeTitle}" /><figcaption><strong>${safeTitle}</strong>${
    safeDesc ? ` — ${safeDesc}` : ''
  }</figcaption></figure>`;

  const analysisMd = aiAnalysisMarkdown || item.aiAnalysisMarkdown || '';
  const analysisHtml = analysisMd ? `<hr/>${simpleMarkdownToHtml(analysisMd)}` : '';

  const contentHtml = [
    `<h1>${safeTitle}</h1>`,
    figureHtml,
    safeDesc ? `<p>${safeDesc}</p>` : '',
    safeExtended && safeExtended !== safeDesc ? `<p>${safeExtended}</p>` : '',
    `<h2>Ficha enciclopédica y técnica</h2>`,
    tableHtml,
    analysisHtml,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 290000);

  const contentText = [
    item.title,
    item.description || '',
    item.extendedInfo && item.extendedInfo !== item.description ? item.extendedInfo : '',
    rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    item.sourcePageUrl ? `Fuente: ${item.sourcePageUrl}` : '',
    analysisMd,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 290000);

  const tags = [
    'enciclopedia-visual',
    item.sourceName ? item.sourceName.slice(0, 40) : '',
    item.categoryTag ? item.categoryTag.split('·')[0].trim().slice(0, 40) : '',
  ].filter(Boolean);

  return {
    title: (item.title || 'Lámina enciclopédica').slice(0, 200),
    contentHtml,
    contentText,
    tags: Array.from(new Set(tags)).slice(0, 8),
  };
}

interface WikiMediaLightboxProps {
  isOpen: boolean;
  items: WikiMediaItem[];
  initialIndex?: number;
  onClose: () => void;
  onInsertImage?: (item: WikiMediaItem) => void;
  onSaveNoteFromMedia?: (item: WikiMediaItem, aiAnalysisMarkdown?: string) => Promise<void> | void;
  defaultSubjectId?: string;
  defaultSubjectName?: string;
}

export const WikiMediaLightbox: React.FC<WikiMediaLightboxProps> = ({
  isOpen,
  items,
  initialIndex = 0,
  onClose,
  onInsertImage,
  onSaveNoteFromMedia,
  defaultSubjectId = '',
  defaultSubjectName = '',
}) => {
  const { createNote, selectedSubjectId, subjects, profile } = useFabro();

  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState<1 | 1.6 | 2.2>(1);
  const [showInspector, setShowInspector] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);

  const [aiExplanations, setAiExplanations] = useState<Record<string, { md: string; provider: string }>>({});
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState('');

  const [savingNote, setSavingNote] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIndex(Math.max(0, Math.min(items.length - 1, initialIndex)));
      setZoom(1);
      setImgFailed(false);
      setSavedFeedback('');
      setExplainError('');
    }
  }, [isOpen, initialIndex, items.length]);

  useEffect(() => {
    setImgFailed(false);
    setSavedFeedback('');
    setExplainError('');
  }, [index]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && items.length > 1) {
        setZoom(1);
        setIndex((i) => (i + 1) % items.length);
      }
      if (e.key === 'ArrowLeft' && items.length > 1) {
        setZoom(1);
        setIndex((i) => (i - 1 + items.length) % items.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, items.length, onClose]);

  if (!isOpen || items.length === 0) return null;
  const active = items[index] || items[0];
  const activeAi = aiExplanations[active.id]?.md || active.aiAnalysisMarkdown || '';
  const activeAiProvider = aiExplanations[active.id]?.provider || '';
  const targetSubjectId = defaultSubjectId || selectedSubjectId || '';
  const targetSubjectName =
    defaultSubjectName || subjects.find((s) => s.id === targetSubjectId)?.name || '';

  const cycleZoom = () => {
    setZoom((z) => (z === 1 ? 1.6 : z === 1.6 ? 2.2 : 1));
  };

  const handleExplainWithAI = async () => {
    if (loadingExplain) return;
    setLoadingExplain(true);
    setExplainError('');
    try {
      const resp = await authFetch('/api/media/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: active.title,
          description: active.description || '',
          extendedInfo: active.extendedInfo || '',
          author: active.author || '',
          license: active.license || '',
          sourceName: active.sourceName || '',
          sourcePageUrl: active.sourcePageUrl || '',
          subjectName: targetSubjectName,
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider: 'auto',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo generar la explicación enciclopédica.');
      }
      setAiExplanations((prev) => ({
        ...prev,
        [active.id]: {
          md: data.explanationMarkdown || '',
          provider: data.providerUsed || 'Multi-IA',
        },
      }));
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Error consultando análisis IA.');
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleSaveToNotes = async () => {
    if (savingNote) return;
    setSavingNote(true);
    setSavedFeedback('');
    try {
      if (onSaveNoteFromMedia) {
        await onSaveNoteFromMedia(active, activeAi);
      } else {
        const payload = buildEncyclopediaNoteContent(active, activeAi);
        await createNote({
          title: payload.title,
          contentHtml: payload.contentHtml,
          contentText: payload.contentText,
          subjectId: targetSubjectId,
          folder: 'Enciclopedia visual',
          tags: payload.tags,
          attachments: [],
          offlineAvailable: true,
        });
      }
      setSavedFeedback(
        targetSubjectName
          ? `Guardado en Apuntes (${targetSubjectName})`
          : 'Guardado en Apuntes (disponible offline)'
      );
      window.setTimeout(() => setSavedFeedback(''), 3500);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'No se pudo guardar en Apuntes.');
    } finally {
      setSavingNote(false);
    }
  };

  const sourceDisplay =
    active.sourceName ||
    active.sourceDomain ||
    (active.source === 'commons'
      ? 'Wikimedia Commons'
      : active.source === 'nasa'
        ? 'Archivo NASA'
        : active.source === 'met'
          ? 'Museo Metropolitano'
          : active.source === 'openverse'
            ? 'Openverse CC'
            : active.source === 'nota'
              ? 'Apunte del estudiante'
              : 'Enciclopedia Libre');

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#060911]/95 backdrop-blur-sm text-slate-100 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Visor enciclopédico: ${active.title}`}
    >
      {/* Top Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400 truncate">
            Navegador visual enciclopédico · {sourceDisplay} ·{' '}
            <span className="font-mono tabular-nums">
              {index + 1} / {items.length}
            </span>
          </p>
          <h3 className="font-display text-sm sm:text-base font-semibold text-white truncate">
            {active.title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={cycleZoom}
            title="Cambiar zoom"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            {zoom > 1 ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            <span className="font-mono tabular-nums">{zoom}x</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInspector((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
              showInspector
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ficha completa</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSaveToNotes()}
            disabled={savingNote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {savingNote ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedFeedback ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <BookmarkPlus className="w-3.5 h-3.5" />
            )}
            <span>{savedFeedback ? 'Guardado' : 'Guardar en Apuntes'}</span>
          </button>

          {onInsertImage && (
            <button
              type="button"
              onClick={() => onInsertImage(active)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              Insertar en apunte
            </button>
          )}

          {active.sourcePageUrl && (
            <a
              href={active.sourcePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Fuente original
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor"
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {savedFeedback && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-1.5 text-xs text-emerald-300 text-center">
          {savedFeedback}
        </div>
      )}

      {/* Main Split Workspace: Image Canvas + Browser Metadata/AI Inspector */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div className="relative flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8 overflow-auto">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setIndex((i) => (i - 1 + items.length) % items.length);
              }}
              aria-label="Imagen anterior"
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/85 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {imgFailed ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center max-w-md space-y-2">
              <ImageOff className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-200">{active.title}</p>
              <p className="text-xs text-slate-400">
                No se pudo cargar la vista previa directa desde el servidor externo, pero podés consultar la ficha completa o abrir la fuente original.
              </p>
              {active.sourcePageUrl && (
                <a
                  href={active.sourcePageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir fuente externa
                </a>
              )}
            </div>
          ) : (
            <img
              src={active.fullUrl || active.thumbUrl}
              alt={active.title}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              onClick={cycleZoom}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-200 cursor-zoom-in select-none"
            />
          )}

          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-lg bg-slate-900/85 border border-slate-700 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-slate-800 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Ajustar
            </button>
          )}

          {items.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setIndex((i) => (i + 1) % items.length);
              }}
              aria-label="Imagen siguiente"
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/85 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {showInspector && (
          <aside className="w-full lg:w-[390px] max-h-[42vh] lg:max-h-none border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#0B101C] overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                Información de navegador enciclopédico
              </p>
              <h4 className="font-display text-sm font-bold text-white leading-snug">
                {active.title}
              </h4>
              {active.description && (
                <p className="text-xs text-slate-300 leading-relaxed">{active.description}</p>
              )}
              {active.extendedInfo && active.extendedInfo !== active.description && (
                <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-slate-800/80">
                  {active.extendedInfo}
                </p>
              )}
            </div>

            <dl className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Fuente</dt>
                <dd className="text-slate-100 font-medium text-right">{sourceDisplay}</dd>
              </div>
              {active.author && (
                <div className="flex justify-between gap-2 border-t border-slate-800/70 pt-1.5">
                  <dt className="text-slate-400">Autoría</dt>
                  <dd className="text-slate-200 text-right">{active.author}</dd>
                </div>
              )}
              {active.dateCreated && (
                <div className="flex justify-between gap-2 border-t border-slate-800/70 pt-1.5">
                  <dt className="text-slate-400">Fecha</dt>
                  <dd className="text-slate-200 font-mono tabular-nums text-right">{active.dateCreated}</dd>
                </div>
              )}
              {active.license && (
                <div className="flex justify-between gap-2 border-t border-slate-800/70 pt-1.5">
                  <dt className="text-slate-400">Licencia</dt>
                  <dd className="text-slate-200 text-right">{active.license}</dd>
                </div>
              )}
              {(active.dimensions || (active.width && active.height)) && (
                <div className="flex justify-between gap-2 border-t border-slate-800/70 pt-1.5">
                  <dt className="text-slate-400">Resolución</dt>
                  <dd className="text-slate-200 font-mono tabular-nums text-right">
                    {active.dimensions || `${active.width} × ${active.height} px`}
                  </dd>
                </div>
              )}
              {active.categoryTag && (
                <div className="flex justify-between gap-2 border-t border-slate-800/70 pt-1.5">
                  <dt className="text-slate-400">Área</dt>
                  <dd className="text-slate-300 text-right">{active.categoryTag}</dd>
                </div>
              )}
              {active.sourcePageUrl && (
                <div className="border-t border-slate-800/70 pt-2">
                  <a
                    href={active.sourcePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sky-400 hover:underline break-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    Abrir página documental completa
                  </a>
                </div>
              )}
            </dl>

            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Análisis enciclopédico IA
                </span>
                <button
                  type="button"
                  onClick={() => void handleExplainWithAI()}
                  disabled={loadingExplain}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600/20 border border-sky-500/40 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {loadingExplain ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {activeAi ? 'Regenerar' : 'Explicar tema'}
                </button>
              </div>

              {explainError && <p className="text-xs text-red-400">{explainError}</p>}

              {activeAi ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                  {activeAiProvider && (
                    <p className="text-[10px] text-slate-400">Generado con {activeAiProvider}</p>
                  )}
                  <div className="fabro-markdown text-xs text-slate-200 leading-relaxed">
                    <Markdown remarkPlugins={[remarkGfm]}>{activeAi}</Markdown>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Generá una síntesis enciclopédica con conceptos clave y preguntas de repaso antes de guardarla en tus Apuntes.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Thumbnail Strip */}
      {items.length > 1 && (
        <div className="border-t border-slate-800/90 bg-[#080C15] px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto pb-0.5">
            {items.map((item, idx) => (
              <button
                key={`${item.id}_${idx}`}
                type="button"
                onClick={() => {
                  setZoom(1);
                  setIndex(idx);
                }}
                title={item.title}
                className={`shrink-0 w-13 h-13 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  idx === index
                    ? 'border-sky-500 opacity-100'
                    : 'border-transparent opacity-55 hover:opacity-90'
                }`}
              >
                <img
                  src={item.thumbUrl || item.fullUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
