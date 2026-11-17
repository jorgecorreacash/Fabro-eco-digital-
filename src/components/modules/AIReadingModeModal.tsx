import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookmarkPlus,
  BookOpen,
  Check,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Send,
  Sparkles,
  Sun,
  Type as TypeIcon,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';
import {
  buildEncyclopediaNoteContent,
  WikiMediaLightbox,
  type WikiMediaItem,
} from '../common/WikiMediaLightbox';
import { buildEncyclopediaFigureHtml } from './WikiImageFinderModal';

type PaperTheme = 'light' | 'sepia' | 'dark';
type ColumnWidth = 'narrow' | 'optimal' | 'wide';
type ReadingStyle = 'claro' | 'profundo' | 'resumen' | 'autoevaluacion';

interface AIReadingModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subjectName?: string;
  contentText: string;
  contentHtml?: string;
  onInsertWikiImageToNote?: (figureHtml: string) => void;
}

function extractImagesFromHtml(html: string, fallbackTitle: string): WikiMediaItem[] {
  if (!html || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'));
  const items: WikiMediaItem[] = [];
  const seen = new Set<string>();
  imgs.forEach((img, idx) => {
    const src = img.getAttribute('src') || '';
    const full = img.getAttribute('data-full-src') || src;
    if (!src || seen.has(src)) return;
    seen.add(src);
    const fig = img.closest('figure');
    const captionText = fig?.querySelector('figcaption')?.textContent?.trim() || '';
    items.push({
      id: `doc_img_${idx}`,
      title: img.getAttribute('alt') || `${fallbackTitle} · Figura ${idx + 1}`,
      thumbUrl: src,
      fullUrl: full,
      description: captionText || img.getAttribute('alt') || 'Figura incluida en el documento.',
      source: 'nota',
    });
  });
  return items;
}

export const AIReadingModeModal: React.FC<AIReadingModeModalProps> = ({
  isOpen,
  onClose,
  title,
  subjectName = '',
  contentText,
  contentHtml = '',
  onInsertWikiImageToNote,
}) => {
  const { profile, createNote, selectedSubjectId } = useFabro();

  const [paperTheme, setPaperTheme] = useState<PaperTheme>('sepia');
  const [fontSize, setFontSize] = useState(18);
  const [colWidth, setColWidth] = useState<ColumnWidth>('optimal');
  const [showSidebar, setShowSidebar] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // Reading content mode
  const [aiProvider, setAiProvider] = useState<'auto' | 'gemini' | 'chatgpt'>('auto');
  const [viewMode, setViewMode] = useState<'original' | 'ai'>('original');
  const [readingStyle, setReadingStyle] = useState<ReadingStyle>('claro');
  const [aiMarkdown, setAiMarkdown] = useState('');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [providerUsed, setProviderUsed] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  // Contextual Q&A inside reading mode
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string; provider?: string }>>([]);

  // Encyclopedic image gallery for the article
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiImages, setWikiImages] = useState<WikiMediaItem[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  const embeddedImages = useMemo(
    () => extractImagesFromHtml(contentHtml, title || 'Apunte'),
    [contentHtml, title]
  );

  const allGalleryImages = useMemo(() => {
    const merged: WikiMediaItem[] = [...embeddedImages];
    const seen = new Set(merged.map((m) => m.fullUrl));
    for (const w of wikiImages) {
      if (!seen.has(w.fullUrl)) {
        seen.add(w.fullUrl);
        merged.push(w);
      }
    }
    return merged;
  }, [embeddedImages, wikiImages]);

  const fetchWikiImagesForTerm = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setLoadingImages(true);
    try {
      const resp = await fetch(`/api/media/encyclopedia-images?q=${encodeURIComponent(clean)}&limit=10`);
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.images)) {
        setWikiImages(data.images);
      }
    } catch {
      // Non-fatal if network unavailable
    } finally {
      setLoadingImages(false);
    }
  };

  // Reset & preload encyclopedic images when opening
  useEffect(() => {
    if (!isOpen) return;
    setAiMarkdown('');
    setKeyTakeaways([]);
    setEstimatedMinutes(null);
    setAiError('');
    setQaHistory([]);
    setViewMode('original');
    const initialSearch = (title || subjectName || '').replace(/^(Apunte|Definición|Tema \d+):?\s*/i, '').trim();
    setWikiQuery(initialSearch);
    if (initialSearch) {
      void fetchWikiImagesForTerm(initialSearch);
    }
  }, [isOpen, title, subjectName]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxIdx === null) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, lightboxIdx, onClose]);

  const handleRunEnhance = async (style: ReadingStyle) => {
    setReadingStyle(style);
    setLoadingAI(true);
    setAiError('');
    try {
      const resp = await authFetch('/api/ai/reading-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enhance',
          title,
          subjectName,
          content: contentText,
          readingStyle: style,
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo activar el modo de lectura IA.');
      }
      setAiMarkdown(data.adaptedMarkdown || contentText);
      setKeyTakeaways(Array.isArray(data.keyTakeaways) ? data.keyTakeaways : []);
      setEstimatedMinutes(data.estimatedReadMinutes || null);
      setProviderUsed(data.providerUsed || '');
      setViewMode('ai');

      if (Array.isArray(data.imageQueries) && data.imageQueries[0]) {
        setWikiQuery(data.imageQueries[0]);
        void fetchWikiImagesForTerm(data.imageQueries[0]);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error generando lectura guiada IA.');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAiError('');
    try {
      const resp = await authFetch('/api/ai/reading-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          title,
          subjectName,
          content: aiMarkdown || contentText,
          question: q,
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo responder la consulta.');
      }
      setQaHistory((prev) => [
        ...prev,
        { q, a: data.answerMarkdown || '', provider: data.providerUsed },
      ]);
      setQuestion('');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error respondiendo la consulta.');
    } finally {
      setAsking(false);
    }
  };

  if (!isOpen) return null;

  const paperClasses: Record<PaperTheme, string> = {
    light: 'bg-white text-slate-900',
    sepia: 'bg-[#F7F1E3] text-[#2B241A]',
    dark: 'bg-[#0B111D] text-slate-100',
  };

  const barClasses: Record<PaperTheme, string> = {
    light: 'bg-slate-50 border-slate-200 text-slate-800',
    sepia: 'bg-[#EFE6D4] border-[#DCD0B8] text-[#2B241A]',
    dark: 'bg-[#0F172A] border-slate-800 text-slate-200',
  };

  const widthClass: Record<ColumnWidth, string> = {
    narrow: 'max-w-[60ch]',
    optimal: 'max-w-[72ch]',
    wide: 'max-w-[92ch]',
  };

  const activeTextForAudio = viewMode === 'ai' && aiMarkdown ? aiMarkdown : contentText;

  return (
    <>
      <div className={`fixed inset-0 z-50 flex flex-col ${paperClasses[paperTheme]}`}>
        {/* Top Editorial Control Bar */}
        <header
          className={`px-3 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${barClasses[paperTheme]}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-4 h-4 text-sky-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] opacity-75 truncate">
                Modo de lectura IA{subjectName ? ` · ${subjectName}` : ''}
                {estimatedMinutes ? ` · ~${estimatedMinutes} min` : ''}
              </p>
              <h2 className="font-display text-sm font-bold truncate">
                {title || 'Lectura académica'}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Switch Original vs AI Guided Reading */}
            <div className="inline-flex rounded-lg border border-current/15 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('original')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  viewMode === 'original' ? 'bg-sky-600 text-white' : 'opacity-75 hover:opacity-100'
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => {
                  if (aiMarkdown) {
                    setViewMode('ai');
                  } else {
                    void handleRunEnhance('claro');
                  }
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  viewMode === 'ai' ? 'bg-sky-600 text-white' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Lectura IA
              </button>
            </div>

            {/* Paper Theme */}
            <div className="inline-flex items-center gap-1 rounded-lg border border-current/15 px-1.5 py-1 text-xs">
              <Sun className="w-3.5 h-3.5 opacity-60 mr-0.5" />
              {(['light', 'sepia', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPaperTheme(t)}
                  className={`px-2 py-0.5 rounded capitalize cursor-pointer ${
                    paperTheme === t ? 'bg-sky-600 text-white font-semibold' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {t === 'light' ? 'Claro' : t === 'sepia' ? 'Sepia' : 'Noche'}
                </button>
              ))}
            </div>

            {/* Font Size & Width */}
            <div className="hidden md:inline-flex items-center gap-1 rounded-lg border border-current/15 px-2 py-1 text-xs">
              <TypeIcon className="w-3.5 h-3.5 opacity-60" />
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="px-1.5 font-bold hover:text-sky-600 cursor-pointer"
                aria-label="Reducir texto"
              >
                A-
              </button>
              <span className="font-mono text-[11px] tabular-nums">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(24, s + 2))}
                className="px-1.5 font-bold hover:text-sky-600 cursor-pointer"
                aria-label="Aumentar texto"
              >
                A+
              </button>
              <span className="mx-1 opacity-30">|</span>
              {(['narrow', 'optimal', 'wide'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setColWidth(w)}
                  className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer ${
                    colWidth === w ? 'bg-sky-600 text-white' : 'opacity-70'
                  }`}
                >
                  {w === 'narrow' ? 'Angosto' : w === 'optimal' ? 'Óptimo' : 'Amplio'}
                </button>
              ))}
            </div>

            <AudioReadAloudControl
              compact
              title={`lectura_${title}`}
              subtitle="Modo Lectura FABRO"
              getText={() => activeTextForAudio}
            />

            <button
              type="button"
              onClick={() => setShowSidebar((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-current/20 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
              title="Mostrar u ocultar asistente IA y enciclopedia visual"
            >
              {showSidebar ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">IA e Imágenes</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Salir del modo lectura"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900/10 dark:bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-red-500/20 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* Main Split: Editorial Reading Body + AI & Wikipedia Images Panel */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Article Viewport */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-10 py-8 sm:py-10">
            <article className={`mx-auto ${widthClass[colWidth]} space-y-6`}>
              <header className="space-y-2 pb-5 border-b border-current/15">
                {subjectName && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                    {subjectName}
                  </p>
                )}
                <h1 className="font-display text-2xl sm:text-4xl font-bold leading-tight">
                  {title || 'Lectura sin título'}
                </h1>
                {viewMode === 'ai' && providerUsed && (
                  <p className="text-xs opacity-70">
                    Lectura guiada generada con {providerUsed} · Estilo: {readingStyle}
                  </p>
                )}
              </header>

              {/* Key Takeaways Strip when AI mode active */}
              {viewMode === 'ai' && keyTakeaways.length > 0 && (
                <section className="rounded-xl border border-current/15 bg-current/[0.03] p-4 space-y-2">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider opacity-75">
                    Ideas centrales de esta lectura
                  </h3>
                  <ul className="space-y-1.5 text-sm list-disc pl-5">
                    {keyTakeaways.map((idea, idx) => (
                      <li key={idx}>{idea}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Featured Wikipedia-Style Infobox Figure alongside article */}
              {allGalleryImages.length > 0 && (
                <aside className="sm:float-right sm:ml-6 mb-5 sm:w-72 rounded-xl border border-current/20 bg-current/[0.03] p-2.5 space-y-2">
                  <button
                    type="button"
                    onClick={() => setLightboxIdx(0)}
                    className="group relative w-full overflow-hidden rounded-lg block cursor-zoom-in"
                  >
                    <img
                      src={allGalleryImages[0].thumbUrl}
                      alt={allGalleryImages[0].title}
                      className="w-full max-h-56 object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="absolute right-2 bottom-2 rounded-md bg-black/70 text-white px-2 py-1 text-[10px] inline-flex items-center gap-1">
                      <Maximize2 className="w-3 h-3" />
                      Ver galería ({allGalleryImages.length})
                    </span>
                  </button>
                  <div className="text-xs leading-snug space-y-0.5">
                    <p className="font-semibold">{allGalleryImages[0].title}</p>
                    {allGalleryImages[0].description && (
                      <p className="opacity-80 line-clamp-3">{allGalleryImages[0].description}</p>
                    )}
                  </div>
                </aside>
              )}

              {/* Article Text Content */}
              {loadingAI ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-sm opacity-80">
                  <Loader2 className="w-7 h-7 animate-spin text-sky-600" />
                  <span>Adaptando el texto con Modo de Lectura IA...</span>
                </div>
              ) : viewMode === 'ai' && aiMarkdown ? (
                <div
                  className="fabro-markdown leading-relaxed"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
                >
                  <Markdown remarkPlugins={[remarkGfm]}>{aiMarkdown}</Markdown>
                </div>
              ) : contentHtml ? (
                <div
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'IMG') {
                      const src = target.getAttribute('src');
                      const foundIdx = allGalleryImages.findIndex((i) => i.thumbUrl === src || i.fullUrl === src);
                      if (foundIdx >= 0) setLightboxIdx(foundIdx);
                    }
                  }}
                  className="fabro-editor leading-relaxed"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />
              ) : (
                <div
                  className="fabro-markdown leading-relaxed"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
                >
                  <Markdown remarkPlugins={[remarkGfm]}>{contentText}</Markdown>
                </div>
              )}

              {/* Bottom Visual Gallery */}
              {allGalleryImages.length > 1 && (
                <section className="clear-both pt-6 mt-8 border-t border-current/15 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-sky-600" />
                      Atlas visual relacionado ({allGalleryImages.length})
                    </h3>
                    <span className="text-[11px] opacity-70">Hacé clic en cualquier imagen para abrir el visor completo</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allGalleryImages.slice(0, 6).map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLightboxIdx(idx)}
                        className="text-left rounded-xl border border-current/15 bg-current/[0.03] overflow-hidden hover:border-sky-500/60 transition-colors cursor-zoom-in"
                      >
                        <img
                          src={item.thumbUrl}
                          alt={item.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-32 object-cover"
                        />
                        <p className="p-2 text-[11px] font-medium line-clamp-2">{item.title}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </article>
          </div>

          {/* Right Collapsible AI Reading Assistant & Encyclopedic Images Drawer */}
          {showSidebar && (
            <>
              <div
                onClick={() => setShowSidebar(false)}
                className="fixed inset-0 z-20 bg-black/40 lg:hidden"
              />
              <aside
                className={`fixed inset-y-0 right-0 z-30 w-[min(92vw,360px)] shadow-2xl lg:static lg:w-96 lg:shadow-none shrink-0 border-l overflow-y-auto p-4 space-y-5 ${barClasses[paperTheme]}`}
              >
                <div className="flex items-center justify-between lg:hidden pb-2 border-b border-current/15">
                  <span className="font-display text-xs font-bold uppercase tracking-wider">
                    Asistente IA e Imágenes
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSidebar(false)}
                    className="p-1.5 rounded-lg hover:bg-black/10 cursor-pointer"
                    aria-label="Cerrar panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              {/* AI Reading Styles */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    Lectura IA
                  </h3>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as 'auto' | 'gemini' | 'chatgpt')}
                    aria-label="Motor IA"
                    className="rounded-md border border-current/20 bg-transparent px-1.5 py-0.5 text-[10px]"
                  >
                    <option value="auto" className="text-slate-900">Auto (Multi-IA)</option>
                    <option value="gemini" className="text-slate-900">Gemini</option>
                    <option value="chatgpt" className="text-slate-900">ChatGPT</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'claro', label: 'Lectura clara' },
                      { id: 'profundo', label: 'Académico a fondo' },
                      { id: 'resumen', label: 'Síntesis rápida' },
                      { id: 'autoevaluacion', label: 'Con preguntas' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      disabled={loadingAI}
                      onClick={() => void handleRunEnhance(st.id)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                        viewMode === 'ai' && readingStyle === st.id
                          ? 'border-sky-500 bg-sky-600 text-white'
                          : 'border-current/20 hover:border-sky-500/50'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                {aiError && (
                  <p className="text-xs text-red-500">{aiError}</p>
                )}
              </div>

              {/* Contextual Q&A */}
              <div className="pt-4 border-t border-current/15 space-y-2.5">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                  Preguntar sobre esta lectura
                </h3>
                <form onSubmit={(e) => void handleAskQuestion(e)} className="flex gap-1.5">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ej: ¿Qué significa este párrafo?"
                    className="flex-1 min-w-0 rounded-lg border border-current/20 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={asking || !question.trim()}
                    className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shrink-0"
                    aria-label="Consultar al lector IA"
                  >
                    {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </form>

                {qaHistory.length > 0 && (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {qaHistory.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-current/15 p-2.5 text-xs space-y-1">
                        <p className="font-semibold text-sky-600">{item.q}</p>
                        <div className="fabro-markdown opacity-90">
                          <Markdown remarkPlugins={[remarkGfm]}>{item.a}</Markdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Encyclopedic Image Explorer */}
              <div className="pt-4 border-t border-current/15 space-y-2.5">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                  Enciclopedia visual
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void fetchWikiImagesForTerm(wikiQuery);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={wikiQuery}
                    onChange={(e) => setWikiQuery(e.target.value)}
                    placeholder="Buscar lámina, mapa o foto..."
                    className="flex-1 min-w-0 rounded-lg border border-current/20 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={loadingImages || !wikiQuery.trim()}
                    className="rounded-lg border border-current/20 px-2.5 py-1.5 text-xs hover:border-sky-500 cursor-pointer shrink-0"
                    aria-label="Buscar en enciclopedia visual"
                  >
                    {loadingImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </button>
                </form>

                {allGalleryImages.length === 0 && !loadingImages ? (
                  <p className="text-[11px] opacity-70">
                    Buscá un concepto para ver láminas enciclopédicas, archivos NASA y obras relacionadas.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {allGalleryImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className="rounded-lg border border-current/15 overflow-hidden bg-current/[0.02] flex flex-col justify-between"
                      >
                        <button
                          type="button"
                          onClick={() => setLightboxIdx(idx)}
                          className="w-full h-24 overflow-hidden cursor-zoom-in block"
                        >
                          <img
                            src={img.thumbUrl}
                            alt={img.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <div className="p-1.5 space-y-1">
                          <p className="text-[10px] font-medium line-clamp-1">{img.title}</p>
                          <div className="flex gap-1">
                            {img.source !== 'nota' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const payload = buildEncyclopediaNoteContent(img);
                                  await createNote({
                                    title: payload.title,
                                    contentHtml: payload.contentHtml,
                                    contentText: payload.contentText,
                                    subjectId: selectedSubjectId || '',
                                    folder: 'Enciclopedia visual',
                                    tags: payload.tags,
                                    attachments: [],
                                    offlineAvailable: true,
                                  });
                                  setSavedNoteId(img.id);
                                  window.setTimeout(() => setSavedNoteId(null), 2200);
                                }}
                                title="Guardar ficha e imagen en Apuntes"
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 py-1 text-[10px] font-semibold hover:bg-emerald-600/25 cursor-pointer"
                              >
                                {savedNoteId === img.id ? (
                                  <>
                                    <Check className="w-3 h-3" /> Apunte
                                  </>
                                ) : (
                                  <>
                                    <BookmarkPlus className="w-3 h-3" /> Guardar
                                  </>
                                )}
                              </button>
                            )}
                            {onInsertWikiImageToNote && img.source !== 'nota' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onInsertWikiImageToNote(buildEncyclopediaFigureHtml(img));
                                  setInsertedId(img.id);
                                  window.setTimeout(() => setInsertedId(null), 2000);
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-sky-600/15 text-sky-600 py-1 text-[10px] font-semibold hover:bg-sky-600/25 cursor-pointer"
                              >
                                {insertedId === img.id ? (
                                  <>
                                    <Check className="w-3 h-3" /> Listo
                                  </>
                                ) : (
                                  <>
                                    <FilePlus2 className="w-3 h-3" /> Insertar
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
            </>
          )}
        </div>
      </div>

      <WikiMediaLightbox
        isOpen={lightboxIdx !== null}
        items={allGalleryImages}
        initialIndex={lightboxIdx ?? 0}
        onClose={() => setLightboxIdx(null)}
        defaultSubjectId={selectedSubjectId || ''}
        defaultSubjectName={subjectName}
        onInsertImage={
          onInsertWikiImageToNote
            ? (item) => {
                onInsertWikiImageToNote(buildEncyclopediaFigureHtml(item));
                setLightboxIdx(null);
              }
            : undefined
        }
      />
    </>
  );
};
