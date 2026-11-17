import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookmarkPlus,
  BookOpen,
  Check,
  ExternalLink,
  FilePlus2,
  Globe,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  Maximize2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import {
  buildEncyclopediaNoteContent,
  escapeEncyclopediaHtml,
  WikiMediaLightbox,
  type WikiMediaItem,
} from '../common/WikiMediaLightbox';

interface WikiImageFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  canInsert?: boolean;
  onInsertFigureHtml?: (html: string, item: WikiMediaItem) => void;
}

type MediaSourceFilter = 'all' | 'enciclopedia' | 'commons' | 'nasa' | 'met' | 'openverse';
type AIProviderOption = 'auto' | 'gemini' | 'chatgpt' | 'doble_ia';

interface ArticleSummary {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
}

export function buildEncyclopediaFigureHtml(item: WikiMediaItem): string {
  const safeSrc = escapeEncyclopediaHtml(item.thumbUrl || item.fullUrl);
  const safeFull = escapeEncyclopediaHtml(item.fullUrl || item.thumbUrl);
  const safeTitle = escapeEncyclopediaHtml(item.title);
  const safeDesc = escapeEncyclopediaHtml(item.description || '');
  const metaParts = [item.sourceName, item.author, item.license]
    .filter((v): v is string => Boolean(v))
    .map(escapeEncyclopediaHtml)
    .join(' · ');

  return `<figure class="fabro-wiki-figure fabro-wiki-right"><img src="${safeSrc}" data-full-src="${safeFull}" alt="${safeTitle}" /><figcaption><strong>${safeTitle}</strong>${
    safeDesc ? ` — ${safeDesc}` : ''
  }${metaParts ? `<br/><span style="opacity:0.75;font-size:11px;">${metaParts}</span>` : ''}</figcaption></figure><p></p>`;
}

// Backwards-compatible alias
export const buildWikipediaFigureHtml = buildEncyclopediaFigureHtml;

const SOURCE_FILTERS: Array<{ id: MediaSourceFilter; label: string }> = [
  { id: 'all', label: 'Todas las fuentes' },
  { id: 'enciclopedia', label: 'Enciclopedia' },
  { id: 'commons', label: 'Mediateca libre' },
  { id: 'nasa', label: 'Archivo NASA' },
  { id: 'met', label: 'Museo Met Arte' },
  { id: 'openverse', label: 'Openverse CC' },
];

export const WikiImageFinderModal: React.FC<WikiImageFinderModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  canInsert = true,
  onInsertFigureHtml,
}) => {
  const { createNote, subjects, selectedSubjectId, profile } = useFabro();

  const [query, setQuery] = useState(initialQuery);
  const [sourceFilter, setSourceFilter] = useState<MediaSourceFilter>('all');
  const [aiProvider, setAiProvider] = useState<AIProviderOption>('auto');
  const [images, setImages] = useState<WikiMediaItem[]>([]);
  const [articleSummary, setArticleSummary] = useState<ArticleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedItem, setSelectedItem] = useState<WikiMediaItem | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Subject target when saving directly to Apuntes
  const [targetSubjectId, setTargetSubjectId] = useState(selectedSubjectId || '');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState('');

  // Per-item AI encyclopedic analysis cache
  const [aiExplanations, setAiExplanations] = useState<
    Record<string, { main: string; second?: string; provider?: string; secondProvider?: string }>
  >({});
  const [explainingId, setExplainingId] = useState<string | null>(null);

  const searchEncyclopediaImages = async (term: string, src: MediaSourceFilter = sourceFilter) => {
    const clean = term.trim();
    if (!clean) return;
    setLoading(true);
    setError('');
    setSavedNotice('');
    try {
      const resp = await fetch(
        `/api/media/encyclopedia-images?q=${encodeURIComponent(clean)}&sources=${encodeURIComponent(src)}&limit=24`
      );
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudieron cargar imágenes enciclopédicas.');
      }
      const list = Array.isArray(data.images) ? (data.images as WikiMediaItem[]) : [];
      setImages(list);
      setArticleSummary(data.articleSummary || null);
      setSelectedItem(list[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error consultando repositorios visuales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery);
    setTargetSubjectId(selectedSubjectId || '');
    setSavedNotice('');
    if (initialQuery.trim()) {
      void searchEncyclopediaImages(initialQuery, sourceFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialQuery]);

  const handleFilterChange = (nextFilter: MediaSourceFilter) => {
    setSourceFilter(nextFilter);
    if (query.trim()) {
      void searchEncyclopediaImages(query, nextFilter);
    }
  };

  const handleExplainItem = async (item: WikiMediaItem) => {
    setExplainingId(item.id);
    setError('');
    try {
      const subjectName = subjects.find((s) => s.id === targetSubjectId)?.name || '';
      const resp = await authFetch('/api/media/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.description || '',
          extendedInfo: item.extendedInfo || '',
          author: item.author || '',
          license: item.license || '',
          sourceName: item.sourceName || '',
          sourcePageUrl: item.sourcePageUrl || '',
          subjectName,
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo generar la explicación enciclopédica.');
      }
      setAiExplanations((prev) => ({
        ...prev,
        [item.id]: {
          main: data.explanationMarkdown || '',
          second: data.secondOpinionMarkdown || '',
          provider: data.providerUsed || '',
          secondProvider: data.secondProviderUsed || '',
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error consultando el análisis Multi-IA.');
    } finally {
      setExplainingId(null);
    }
  };

  const handleSaveToNotes = async (item: WikiMediaItem) => {
    setSavingId(item.id);
    setError('');
    try {
      const cachedAi = aiExplanations[item.id];
      const combinedMd = cachedAi
        ? [
            cachedAi.main,
            cachedAi.second
              ? `\n\n## Análisis complementario (${cachedAi.secondProvider || 'Segunda IA'})\n${cachedAi.second}`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '';

      const payload = buildEncyclopediaNoteContent(item, combinedMd);
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
      const subjName = subjects.find((s) => s.id === targetSubjectId)?.name;
      setSavedNotice(
        subjName
          ? `"${item.title}" guardado en Apuntes (${subjName}).`
          : `"${item.title}" guardado en Apuntes y disponible offline.`
      );
      window.setTimeout(() => setSavedNotice(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar en Apuntes.');
    } finally {
      setSavingId(null);
    }
  };

  if (!isOpen) return null;

  const activeAi = selectedItem ? aiExplanations[selectedItem.id] : undefined;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4">
        <div className="w-full max-w-6xl h-[92dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                Explorador Enciclopédico Visual y Atlas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consultá múltiples archivos enciclopédicos, científicos y museográficos con ficha completa y análisis Multi-IA para guardar directo en Apuntes.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar explorador visual"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Source Filters Bar */}
          <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/70 dark:bg-slate-900/40">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void searchEncyclopediaImages(query, sourceFilter);
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej: Célula eucariota, Sistema solar, Revolución Francesa, Catedral gótica, ADN..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as AIProviderOption)}
                aria-label="Motor de IA para fichas"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="auto">IA: Auto (Gemini / Respaldo)</option>
                <option value="gemini">IA: Google Gemini</option>
                <option value="chatgpt">IA: OpenAI ChatGPT</option>
                <option value="doble_ia">IA: Doble IA comparada</option>
              </select>

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Explorar atlas
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {SOURCE_FILTERS.map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    onClick={() => handleFilterChange(sf.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      sourceFilter === sf.id
                        ? 'bg-sky-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-500/50'
                    }`}
                  >
                    {sf.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <span>Guardar en materia:</span>
                <select
                  value={targetSubjectId}
                  onChange={(e) => setTargetSubjectId(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200"
                >
                  <option value="">General</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notices & Errors */}
          {(error || savedNotice) && (
            <div className="px-5 pt-3 space-y-2">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
              {savedNotice && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{savedNotice}</span>
                </div>
              )}
            </div>
          )}

          {/* Split Body: Left Results Grid + Right Encyclopedic Browser Inspector */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* Left Gallery & Context */}
            <div className="lg:col-span-7 overflow-y-auto p-4 space-y-4">
              {articleSummary && (
                <div className="rounded-xl border border-sky-500/25 bg-sky-50/70 dark:bg-sky-950/20 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
                      <BookOpen className="w-3.5 h-3.5" />
                      Contexto enciclopédico: {articleSummary.title}
                    </span>
                    <a
                      href={articleSummary.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Artículo completo
                    </a>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {articleSummary.summary}
                  </p>
                </div>
              )}

              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                  <span>Consultando enciclopedias, mediateca científica, archivo NASA y museos...</span>
                </div>
              ) : images.length === 0 ? (
                <div className="py-16 text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <ImageIcon className="w-9 h-9 mx-auto opacity-45" />
                  <p>
                    Escribí un concepto, fenómeno científico, obra de arte o período histórico para explorar imágenes con información enciclopédica completa.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {images.map((item, idx) => {
                    const isSelected = selectedItem?.id === item.id;
                    const isBroken = Boolean(failedImages[item.id]);
                    return (
                      <article
                        key={item.id}
                        className={`rounded-xl border transition-colors overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40'
                        }`}
                      >
                        <div
                          onClick={() => setSelectedItem(item)}
                          className="cursor-pointer"
                        >
                          <div className="relative w-full h-40 bg-slate-200 dark:bg-slate-950 overflow-hidden flex items-center justify-center">
                            {isBroken ? (
                              <div className="text-center px-3 text-slate-400 space-y-1">
                                <ImageOff className="w-6 h-6 mx-auto" />
                                <p className="text-[11px]">Vista previa no disponible</p>
                              </div>
                            ) : (
                              <img
                                src={item.thumbUrl}
                                alt={item.title}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                                }
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIdx(idx);
                              }}
                              className="absolute right-2 bottom-2 rounded-md bg-black/75 text-white px-2 py-1 text-[10px] inline-flex items-center gap-1 hover:bg-black cursor-pointer"
                            >
                              <Maximize2 className="w-3 h-3" />
                              Visor
                            </button>
                          </div>

                          <div className="p-3 space-y-1">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                              {item.title}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.sourceName || 'Archivo enciclopédico'}
                              {item.dateCreated ? ` · ${item.dateCreated}` : ''}
                            </p>
                            {item.description && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="px-3 pb-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveToNotes(item)}
                            disabled={savingId === item.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer"
                          >
                            {savingId === item.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <BookmarkPlus className="w-3 h-3" />
                            )}
                            Guardar en Apuntes
                          </button>

                          {canInsert && onInsertFigureHtml && (
                            <button
                              type="button"
                              onClick={() => {
                                onInsertFigureHtml(buildEncyclopediaFigureHtml(item), item);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 cursor-pointer"
                            >
                              <FilePlus2 className="w-3 h-3" />
                              Insertar
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Browser-Style Inspector Panel */}
            <aside className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0B101C] overflow-y-auto p-4 sm:p-5">
              {!selectedItem ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 space-y-2 py-10">
                  <Globe className="w-8 h-8 opacity-40" />
                  <p>Seleccioná cualquier imagen para inspeccionar toda su ficha documental, contexto histórico/científico y explicación con Multi-IA.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 overflow-hidden">
                    {failedImages[selectedItem.id] ? (
                      <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5">
                        <ImageOff className="w-7 h-7" />
                        <span>No se pudo previsualizar esta imagen</span>
                      </div>
                    ) : (
                      <img
                        src={selectedItem.fullUrl || selectedItem.thumbUrl}
                        alt={selectedItem.title}
                        referrerPolicy="no-referrer"
                        onClick={() => {
                          const i = images.findIndex((x) => x.id === selectedItem.id);
                          if (i >= 0) setLightboxIdx(i);
                        }}
                        className="w-full max-h-60 object-contain mx-auto cursor-zoom-in"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      {selectedItem.sourceName || 'Atlas enciclopédico'}
                    </p>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {selectedItem.title}
                    </h3>
                    {selectedItem.description && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedItem.description}
                      </p>
                    )}
                    {selectedItem.extendedInfo &&
                      selectedItem.extendedInfo !== selectedItem.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-200/70 dark:border-slate-800">
                          {selectedItem.extendedInfo}
                        </p>
                      )}
                  </div>

                  {/* Full Browser Metadata Table */}
                  <dl className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 space-y-1.5 text-xs">
                    {selectedItem.author && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Autoría / Archivo</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right">{selectedItem.author}</dd>
                      </div>
                    )}
                    {selectedItem.dateCreated && (
                      <div className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
                        <dt className="text-slate-500">Fecha</dt>
                        <dd className="text-slate-800 dark:text-slate-200 font-mono tabular-nums text-right">
                          {selectedItem.dateCreated}
                        </dd>
                      </div>
                    )}
                    {selectedItem.license && (
                      <div className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
                        <dt className="text-slate-500">Licencia</dt>
                        <dd className="text-slate-800 dark:text-slate-200 text-right">{selectedItem.license}</dd>
                      </div>
                    )}
                    {(selectedItem.dimensions || (selectedItem.width && selectedItem.height)) && (
                      <div className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
                        <dt className="text-slate-500">Dimensiones</dt>
                        <dd className="text-slate-800 dark:text-slate-200 font-mono tabular-nums text-right">
                          {selectedItem.dimensions || `${selectedItem.width} × ${selectedItem.height} px`}
                        </dd>
                      </div>
                    )}
                    {selectedItem.categoryTag && (
                      <div className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
                        <dt className="text-slate-500">Área</dt>
                        <dd className="text-slate-700 dark:text-slate-300 text-right">{selectedItem.categoryTag}</dd>
                      </div>
                    )}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={selectedItem.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir página fuente original
                      </a>
                      <a
                        href={selectedItem.fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-600"
                      >
                        Archivo original
                      </a>
                    </div>
                  </dl>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleExplainItem(selectedItem)}
                      disabled={explainingId === selectedItem.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {explainingId === selectedItem.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {activeAi ? 'Regenerar ficha Multi-IA' : 'Explicar con Multi-IA'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleSaveToNotes(selectedItem)}
                      disabled={savingId === selectedItem.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    >
                      {savingId === selectedItem.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      )}
                      Guardar en Apuntes
                    </button>

                    {canInsert && onInsertFigureHtml && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertFigureHtml(buildEncyclopediaFigureHtml(selectedItem), selectedItem);
                          onClose();
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" />
                        Insertar figura en el apunte abierto
                      </button>
                    )}
                  </div>

                  {/* Multi-IA Encyclopedic Analysis Result */}
                  {activeAi && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3.5 space-y-2">
                        {activeAi.provider && (
                          <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                            Análisis principal · {activeAi.provider}
                          </p>
                        )}
                        <div className="fabro-markdown text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                          <Markdown remarkPlugins={[remarkGfm]}>{activeAi.main}</Markdown>
                        </div>
                      </div>

                      {activeAi.second && (
                        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3.5 space-y-2">
                          <p className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                            Perspectiva complementaria · {activeAi.secondProvider || 'Segunda IA'}
                          </p>
                          <div className="fabro-markdown text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                            <Markdown remarkPlugins={[remarkGfm]}>{activeAi.second}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      <WikiMediaLightbox
        isOpen={lightboxIdx !== null}
        items={images}
        initialIndex={lightboxIdx ?? 0}
        onClose={() => setLightboxIdx(null)}
        defaultSubjectId={targetSubjectId}
        defaultSubjectName={subjects.find((s) => s.id === targetSubjectId)?.name || ''}
        onInsertImage={
          canInsert && onInsertFigureHtml
            ? (item) => {
                onInsertFigureHtml(buildEncyclopediaFigureHtml(item), item);
                setLightboxIdx(null);
                onClose();
              }
            : undefined
        }
      />
    </>
  );
};
