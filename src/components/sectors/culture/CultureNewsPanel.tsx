import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  ExternalLink,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  CULTURE_NEWS_CATEGORIES,
  fetchCultureNews,
  formatRelativeCultureDate,
  loadSavedCultureNews,
  saveCultureNewsBookmarks,
} from '../../../services/cultureNewsService';
import type { CultureNewsArticle, CultureNewsCategory } from '../../../types/culture';

type RefreshIntervalSec = 120 | 180 | 300 | 0;

const INTERVAL_OPTIONS: Array<{ value: RefreshIntervalSec; label: string }> = [
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 0, label: 'Manual' },
];

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const CultureNewsPanel: React.FC = () => {
  const [articles, setArticles] = useState<CultureNewsArticle[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [savedArticles, setSavedArticles] = useState<CultureNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [freshCount, setFreshCount] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState<CultureNewsCategory | 'guardadas'>(
    'todas'
  );
  const [selectedSource, setSelectedSource] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [intervalSec, setIntervalSec] = useState<RefreshIntervalSec>(180);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState<number>(180);

  const knownIdsRef = useRef<Set<string>>(new Set());

  const loadNews = useCallback(async (forceRefresh = false, silent = false) => {
    if (!silent) setRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await fetchCultureNews(forceRefresh);
      if (res.articles.length > 0) {
        if (knownIdsRef.current.size > 0) {
          const added = res.articles.filter((a) => !knownIdsRef.current.has(a.id)).length;
          if (added > 0) setFreshCount((c) => c + added);
        }
        knownIdsRef.current = new Set(res.articles.map((a) => a.id));
        setArticles(res.articles);
        setSources(res.sources);
        setUpdatedAt(res.updatedAt);
      } else {
        setErrorMsg(
          'No se pudieron obtener noticias culturales en este momento. Reintentá en unos segundos.'
        );
      }
    } catch {
      setErrorMsg('No se pudo conectar con las fuentes culturales. Verificá tu conexión.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNews(false, false);
    void loadSavedCultureNews().then(setSavedArticles);
  }, [loadNews]);

  useEffect(() => {
    setSecondsLeft(intervalSec);
  }, [intervalSec]);

  useEffect(() => {
    if (!autoEnabled || intervalSec === 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (document.visibilityState === 'visible') {
            void loadNews(true, true);
          }
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoEnabled, intervalSec, loadNews]);

  const savedIdSet = useMemo(() => new Set(savedArticles.map((a) => a.id)), [savedArticles]);

  const toggleSaveArticle = (article: CultureNewsArticle) => {
    setSavedArticles((prev) => {
      const exists = prev.some((a) => a.id === article.id);
      const next = exists ? prev.filter((a) => a.id !== article.id) : [article, ...prev];
      void saveCultureNewsBookmarks(next);
      return next;
    });
  };

  const filteredArticles = useMemo(() => {
    const base = selectedCategory === 'guardadas' ? savedArticles : articles;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((art) => {
      if (
        selectedCategory !== 'todas' &&
        selectedCategory !== 'guardadas' &&
        art.category !== selectedCategory
      ) {
        return false;
      }
      if (selectedSource !== 'todas' && art.source !== selectedSource) {
        return false;
      }
      if (!q) return true;
      return `${art.title} ${art.summary} ${art.source} ${art.categoryLabel}`
        .toLowerCase()
        .includes(q);
    });
  }, [articles, savedArticles, selectedCategory, selectedSource, searchQuery]);

  const leadArticle = filteredArticles[0] || null;
  const secondaryArticles = filteredArticles.slice(1, 5);
  const archiveArticles = filteredArticles.slice(5);

  const formattedUpdatedTime = useMemo(() => {
    if (!updatedAt) return 'Cargando...';
    try {
      return new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(updatedAt));
    } catch {
      return 'Reciente';
    }
  }, [updatedAt]);

  return (
    <div className="space-y-6">
      {/* Editorial Header & Live Auto-Refresh Controls */}
      <section className="rounded-2xl border fabro-border fabro-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9A3412] dark:text-[#FDBA74]">
              FABRO Cultura · Redacción Cultural en Vivo
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              Noticias Culturales en Actualización
            </h1>
            <p className="text-xs sm:text-sm fabro-muted leading-relaxed">
              Actualidad de arte, cine, música, literatura, teatro, museos y patrimonio en español. Se actualiza automáticamente sin costos ni suscripciones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAutoEnabled((v) => !v);
                if (!autoEnabled && intervalSec === 0) setIntervalSec(180);
              }}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                autoEnabled && intervalSec > 0
                  ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                  : 'fabro-border fabro-surface-elevated fabro-muted'
              }`}
            >
              {autoEnabled && intervalSec > 0 ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Auto-actualización</span>
                  <span className="font-mono tabular-nums">{formatCountdown(secondsLeft)}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Pausado</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setFreshCount(0);
                setSecondsLeft(intervalSec);
                void loadNews(true, false);
              }}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#9A3412] text-white px-3.5 text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Actualizando...' : 'Actualizar ahora'}</span>
            </button>
          </div>
        </div>

        {/* Operational Strip: Updated time + Interval + Search + Source */}
        <div className="pt-4 border-t fabro-border flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs fabro-muted">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[var(--fabro-text)]">
                <Clock className="w-3.5 h-3.5 text-[#9A3412] dark:text-[#FDBA74]" />
                Actualizado {formattedUpdatedTime}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{articles.length} noticias activas</span>
              {sources.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{sources.length} medios conectados</span>
                </>
              )}
              {freshCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setFreshCount(0)}
                    className="font-semibold text-[#9A3412] dark:text-[#FDBA74] hover:underline cursor-pointer"
                  >
                    +{freshCount} nuevas incorporadas
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl border fabro-border fabro-surface-elevated">
              <span className="px-2 text-[11px] fabro-muted">Frecuencia:</span>
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setIntervalSec(opt.value);
                    setAutoEnabled(opt.value > 0);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    intervalSec === opt.value
                      ? 'bg-[#1E3A8A] text-white'
                      : 'fabro-muted hover:text-[var(--fabro-text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + Source Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="relative sm:col-span-8">
              <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por tema, artista, museo, libro, película o medio..."
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 text-xs fabro-input"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                aria-label="Filtrar por medio cultural"
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input cursor-pointer"
              >
                <option value="todas">Todos los medios ({sources.length})</option>
                {sources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl border fabro-border fabro-surface-elevated">
            {CULTURE_NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[#9A3412] text-white font-semibold'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedCategory('guardadas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                selectedCategory === 'guardadas'
                  ? 'bg-[#1E3A8A] text-white font-semibold'
                  : 'fabro-muted hover:text-[var(--fabro-text)]'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              <span>Guardadas ({savedArticles.length})</span>
            </button>
          </div>
        </div>
      </section>

      {/* Loading / Error / Empty */}
      {loading && articles.length === 0 ? (
        <section className="rounded-2xl border fabro-border fabro-surface p-8 text-center space-y-2 text-xs fabro-muted">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#9A3412]" />
          <p className="font-semibold text-[var(--fabro-text)]">
            Cargando noticias culturales actualizadas...
          </p>
          <p>Consultando medios culturales en español (Infobae, Clarín, La Nación, El País, BBC, RTVE).</p>
        </section>
      ) : errorMsg && filteredArticles.length === 0 ? (
        <section className="rounded-2xl border fabro-border fabro-surface p-6 text-center space-y-3 text-xs">
          <p className="font-semibold">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void loadNews(true, false)}
            className="min-h-[38px] rounded-xl bg-[#9A3412] text-white px-4 font-bold cursor-pointer"
          >
            Reintentar carga
          </button>
        </section>
      ) : filteredArticles.length === 0 ? (
        <section className="rounded-2xl border fabro-border fabro-surface p-8 text-center space-y-2 text-xs fabro-muted">
          <Newspaper className="w-5 h-5 mx-auto opacity-70" />
          <p className="font-semibold text-[var(--fabro-text)]">
            No hay noticias que coincidan con los filtros actuales.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('todas');
              setSelectedSource('todas');
              setSearchQuery('');
            }}
            className="text-[#9A3412] dark:text-[#FDBA74] font-semibold hover:underline cursor-pointer"
          >
            Mostrar todas las noticias
          </button>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Tier 1: Lead Editorial Story */}
          {leadArticle && (
            <article className="rounded-2xl border fabro-border fabro-surface overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-5 relative min-h-[210px] bg-[var(--fabro-surface-2)]">
                {leadArticle.image ? (
                  <img
                    src={leadArticle.image}
                    alt={leadArticle.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover min-h-[210px] max-h-[320px] lg:max-h-none"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full min-h-[210px] flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#9A3412]/10 to-[#1E3A8A]/10">
                    <Newspaper className="w-8 h-8 text-[#9A3412]/60 mb-2" />
                    <span className="text-xs font-semibold fabro-muted">{leadArticle.source}</span>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs fabro-muted">
                    <span className="font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                      {leadArticle.categoryLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[var(--fabro-text)]">
                      {leadArticle.source}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatRelativeCultureDate(leadArticle.publishedAt)}
                    </span>
                  </div>

                  <h2 className="font-display text-xl sm:text-2xl font-bold leading-snug text-balance">
                    <a
                      href={leadArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#9A3412] dark:hover:text-[#FDBA74] transition-colors"
                    >
                      {leadArticle.title}
                    </a>
                  </h2>

                  <p className="text-xs sm:text-sm fabro-muted leading-relaxed line-clamp-3">
                    {leadArticle.summary}
                  </p>
                </div>

                <div className="pt-3 border-t fabro-border flex items-center justify-between gap-3">
                  <a
                    href={leadArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#9A3412] text-white px-4 text-xs font-bold hover:opacity-95 whitespace-nowrap"
                  >
                    <span>Leer nota completa</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => toggleSaveArticle(leadArticle)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    {savedIdSet.has(leadArticle.id) ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#93C5FD]" />
                        <span>Guardada</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          )}

          {/* Tier 2: Secondary Featured Grid */}
          {secondaryArticles.length > 0 && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {secondaryArticles.map((art, idx) => {
                const isSaved = savedIdSet.has(art.id);
                return (
                  <article
                    key={`${art.id}-${idx}`}
                    className="rounded-2xl border fabro-border fabro-surface overflow-hidden flex flex-col justify-between"
                  >
                    {art.image && (
                      <div className="h-40 w-full bg-[var(--fabro-surface-2)] overflow-hidden">
                        <img
                          src={art.image}
                          alt={art.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] fabro-muted">
                          <span className="font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                            {art.categoryLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{art.source}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {formatRelativeCultureDate(art.publishedAt)}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold leading-snug">
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#9A3412] dark:hover:text-[#FDBA74] transition-colors"
                          >
                            {art.title}
                          </a>
                        </h3>
                        <p className="text-xs fabro-muted line-clamp-2 leading-relaxed">
                          {art.summary}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t fabro-border flex items-center justify-between gap-2 text-xs">
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline"
                        >
                          <span>Abrir fuente</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => toggleSaveArticle(art)}
                          className="inline-flex items-center gap-1 fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                        >
                          {isSaved ? (
                            <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#93C5FD]" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5" />
                          )}
                          <span>{isSaved ? 'Guardada' : 'Guardar'}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {/* Tier 3: Compact Editorial News Wire List */}
          {archiveArticles.length > 0 && (
            <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b fabro-border">
                <h2 className="font-display text-base font-bold">Últimas noticias culturales</h2>
                <span className="text-xs font-mono tabular-nums fabro-muted">
                  {archiveArticles.length} notas
                </span>
              </div>

              <div className="divide-y fabro-border">
                {archiveArticles.map((art, idx) => {
                  const isSaved = savedIdSet.has(art.id);
                  return (
                    <article
                      key={`${art.id}-row-${idx}`}
                      className="py-3 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] fabro-muted">
                          <span className="font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                            {art.categoryLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{art.source}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {formatRelativeCultureDate(art.publishedAt)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold leading-snug">
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#9A3412] dark:hover:text-[#FDBA74] transition-colors"
                          >
                            {art.title}
                          </a>
                        </h3>
                        <p className="text-xs fabro-muted line-clamp-2">{art.summary}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 sm:pt-1">
                        <button
                          type="button"
                          onClick={() => toggleSaveArticle(art)}
                          aria-label={isSaved ? 'Quitar de guardadas' : 'Guardar noticia'}
                          className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border fabro-border fabro-surface-elevated cursor-pointer"
                        >
                          {isSaved ? (
                            <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#93C5FD]" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5 fabro-muted" />
                          )}
                        </button>
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface-elevated px-2.5 text-xs font-semibold text-[#1E3A8A] dark:text-[#93C5FD] whitespace-nowrap"
                        >
                          <span>Leer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
