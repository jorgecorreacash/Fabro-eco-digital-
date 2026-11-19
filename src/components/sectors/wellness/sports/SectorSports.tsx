import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CloudOff,
  ExternalLink,
  Menu,
  RefreshCw,
  Trophy,
  Tv,
  X,
} from 'lucide-react';
import {
  DEFAULT_SPORTS_STATE,
  SPORTS_LEAGUES_FALLBACK,
  SPORTS_SIDEBAR_ORDER,
} from '../../../../data/sportsCatalog';
import {
  fetchMultiScoreboard,
  fetchSportsNews,
  fetchSportsSources,
  formatInTimeZone,
  loadSportsState,
  saveSportsState,
} from '../../../../services/sportsService';
import type {
  SportLeagueCatalogItem,
  SportMatchItem,
  SportNewsArticle,
  SportSourceStatus,
  SportsNavId,
  SportsUserState,
} from '../../../../types/sports';
import type { WellnessStateSnapshot } from '../../../../types/wellness';
import { SportsFavoritesAiConfigPanel } from './SportsFavoritesAiConfigPanel';
import { SportsOverviewFixturesPanel } from './SportsOverviewFixturesPanel';
import { SportsTablesProfilesNewsPanel } from './SportsTablesProfilesNewsPanel';
import { SportsToolsTrainingCoachPanel } from './SportsToolsTrainingCoachPanel';

interface SectorSportsProps {
  wellnessState: WellnessStateSnapshot;
  onUpdateWellnessState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
  onBackToWellness: () => void;
}

const DEFAULT_MULTI_LEAGUES = [
  'arg.1',
  'arg.2',
  'arg.copa',
  'conmebol.libertadores',
  'conmebol.sudamericana',
  'uefa.champions',
  'eng.1',
  'esp.1',
  'nba',
  'f1',
];

export const SectorSports: React.FC<SectorSportsProps> = ({
  wellnessState,
  onUpdateWellnessState,
  onBackToWellness,
}) => {
  const [activeNav, setActiveNav] = useState<SportsNavId>('inicio-deportivo');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState('');

  const [sportsState, setSportsState] = useState<SportsUserState>(DEFAULT_SPORTS_STATE);
  const [hydrated, setHydrated] = useState(false);

  const [leagues, setLeagues] = useState<SportLeagueCatalogItem[]>(SPORTS_LEAGUES_FALLBACK);
  const [sources, setSources] = useState<SportSourceStatus[]>([]);
  const [matches, setMatches] = useState<SportMatchItem[]>([]);
  const [news, setNews] = useState<SportNewsArticle[]>([]);
  const [selectedStandingsLeague, setSelectedStandingsLeague] = useState<string>('arg.1');

  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  const stateRef = useRef<SportsUserState>(DEFAULT_SPORTS_STATE);
  stateRef.current = sportsState;

  const updateSportsState = useCallback(
    (updater: (prev: SportsUserState) => SportsUserState) => {
      setSportsState((prev) => {
        const next = updater(prev);
        void saveSportsState(next);
        return next;
      });
    },
    []
  );

  // 1. Hydrate local IndexedDB state & cached matches/news for instant offline-first UX
  useEffect(() => {
    let mounted = true;
    void loadSportsState().then((loaded) => {
      if (!mounted) return;
      setSportsState(loaded);
      if (loaded.lastCachedMatches.length > 0) {
        setMatches(loaded.lastCachedMatches);
      }
      if (loaded.lastCachedNews.length > 0) {
        setNews(loaded.lastCachedNews);
      }
      if (loaded.lastSyncAt) {
        setLastUpdatedAt(loaded.lastSyncAt);
      }
      if (loaded.favoriteLeagues[0]) {
        setSelectedStandingsLeague(loaded.favoriteLeagues[0]);
      }
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Refresh fixtures (periodic cached polling via $0 Express gateway)
  const refreshFixtures = useCallback(
    async (datesParam?: string, customLeagues?: string[]) => {
      setLoading(true);
      setErrorMsg(null);
      const st = stateRef.current;
      const targetLeagues =
        customLeagues && customLeagues.length > 0
          ? customLeagues
          : Array.from(
              new Set([...(st.favoriteLeagues || []), ...DEFAULT_MULTI_LEAGUES])
            ).slice(0, 12);

      const resolvedDates = datesParam !== undefined ? datesParam : '';

      const [sourcesRes, boardRes] = await Promise.all([
        fetchSportsSources(),
        fetchMultiScoreboard(targetLeagues, resolvedDates),
      ]);

      if (sourcesRes.ok) {
        if (sourcesRes.leagues.length > 0) setLeagues(sourcesRes.leagues);
        setSources(sourcesRes.sources);
      }

      if (boardRes.ok) {
        setMatches(boardRes.matches);
        setLastUpdatedAt(boardRes.fetchedAt);
        setIsOfflineFallback(false);
        updateSportsState((prev) => ({
          ...prev,
          lastCachedMatches: boardRes.matches.slice(0, 120),
          lastSyncAt: boardRes.fetchedAt,
        }));
      } else {
        setIsOfflineFallback(true);
        setErrorMsg(
          boardRes.error ||
            'No se pudieron actualizar las competiciones. Se muestran los datos en caché local.'
        );
      }
      setLoading(false);
    },
    [updateSportsState]
  );

  const refreshNews = useCallback(async () => {
    const res = await fetchSportsNews('Todas', '');
    if (res.ok && res.articles.length > 0) {
      setNews(res.articles);
      setLastUpdatedAt((prev) => prev || res.fetchedAt);
      updateSportsState((prev) => ({
        ...prev,
        lastCachedNews: res.articles.slice(0, 80),
        lastSyncAt: res.fetchedAt,
      }));
    } else if (stateRef.current.lastCachedNews.length > 0) {
      setNews(stateRef.current.lastCachedNews);
    }
  }, [updateSportsState]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshFixtures(), refreshNews()]);
  }, [refreshFixtures, refreshNews]);

  // 3. Initial load once hydrated
  useEffect(() => {
    if (!hydrated) return;
    void refreshAll();
  }, [hydrated, refreshAll]);

  // 4. Respectful periodic refresh (120s, aligned with 90s server cache TTL; only when visible)
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshFixtures();
      }
    }, 120_000);
    return () => window.clearInterval(id);
  }, [hydrated, refreshFixtures]);

  const filteredSidebarItems = useMemo(() => {
    const q = sidebarFilter.trim().toLowerCase();
    if (!q) return SPORTS_SIDEBAR_ORDER;
    return SPORTS_SIDEBAR_ORDER.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.shortDesc.toLowerCase().includes(q) ||
        String(item.number).includes(q)
    );
  }, [sidebarFilter]);

  const activeEntry = useMemo(
    () => SPORTS_SIDEBAR_ORDER.find((i) => i.id === activeNav) || SPORTS_SIDEBAR_ORDER[0],
    [activeNav]
  );

  const selectNav = (id: SportsNavId) => {
    setActiveNav(id);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectLeagueForStandings = (leagueId: string) => {
    setSelectedStandingsLeague(leagueId);
    selectNav('tablas-posiciones');
  };

  const tz = sportsState.timeZone || 'America/Argentina/Buenos_Aires';

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b fabro-border space-y-2.5">
        <button
          type="button"
          onClick={onBackToWellness}
          className="w-full min-h-[34px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 text-[11px] font-semibold inline-flex items-center gap-1.5 hover:border-[#059669] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#059669]" />
          Volver a FABRO Bienestar
        </button>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-[#0284C7] dark:text-[#38BDF8]">
            <Trophy className="w-4 h-4 shrink-0" />
            FABRO DEPORTES
          </span>
          <span className="text-[11px] font-mono tabular-nums fabro-muted">18 áreas</span>
        </div>
        <p className="text-[11px] fabro-muted leading-snug">
          Centro deportivo · Fuentes públicas verificables ($0)
        </p>

        <a
          href="https://pelotalibres.st/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[38px] rounded-xl bg-red-600 hover:bg-red-700 text-white px-3 text-xs font-bold inline-flex items-center justify-between gap-2 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <Tv className="w-3.5 h-3.5 shrink-0" />
            <span>Ver partidos en vivo</span>
          </span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-90" />
        </a>

        <div className="flex items-center justify-between gap-2 text-[10px] font-mono fabro-muted">
          <span className="truncate">
            {lastUpdatedAt ? `Act. ${formatInTimeZone(lastUpdatedAt, tz, 'time')}` : 'Sin sincronizar'}
          </span>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[#0284C7] font-semibold hover:underline cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        <input
          type="search"
          value={sidebarFilter}
          onChange={(e) => setSidebarFilter(e.target.value)}
          placeholder="Filtrar 18 secciones..."
          className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
        />
      </div>

      <nav
        aria-label="Menú lateral de FABRO DEPORTES"
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
      >
        {filteredSidebarItems.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNav(item.id)}
              className={`w-full min-h-[38px] rounded-xl px-2.5 py-1.5 text-left text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                active
                  ? 'bg-[#0284C7] text-white font-semibold'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <span
                className={`font-mono text-[10px] w-5 text-right shrink-0 tabular-nums ${
                  active ? 'text-white/85' : 'opacity-65'
                }`}
              >
                {String(item.number).padStart(2, '0')}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeNav) {
      case 'inicio-deportivo':
      case 'futbol':
      case 'otras-disciplinas':
      case 'partidos-en-vivo':
      case 'calendario':
      case 'resultados':
      case 'ligas-torneos':
        return (
          <SportsOverviewFixturesPanel
            section={activeNav}
            sportsState={sportsState}
            leagues={leagues}
            matches={matches}
            news={news}
            loading={loading}
            lastUpdatedAt={lastUpdatedAt}
            errorMsg={errorMsg}
            onRefresh={refreshFixtures}
            onNavigateSports={selectNav}
            onUpdateSportsState={updateSportsState}
            onSelectLeagueForStandings={handleSelectLeagueForStandings}
          />
        );
      case 'tablas-posiciones':
      case 'equipos':
      case 'deportistas':
      case 'noticias':
      case 'estadisticas':
        return (
          <SportsTablesProfilesNewsPanel
            section={activeNav}
            sportsState={sportsState}
            wellnessState={wellnessState}
            leagues={leagues}
            matches={matches}
            news={news}
            selectedStandingsLeague={selectedStandingsLeague}
            onSelectStandingsLeague={setSelectedStandingsLeague}
            onRefreshNews={refreshNews}
            onUpdateSportsState={updateSportsState}
          />
        );
      case 'entrenamiento':
      case 'herramientas-deportivas':
      case 'entrenadores':
        return (
          <SportsToolsTrainingCoachPanel
            section={activeNav}
            sportsState={sportsState}
            wellnessState={wellnessState}
            onUpdateSportsState={updateSportsState}
            onUpdateWellnessState={onUpdateWellnessState}
          />
        );
      case 'mis-favoritos':
      case 'fabro-sport-ai':
      case 'configuracion-deportes':
        return (
          <SportsFavoritesAiConfigPanel
            section={activeNav}
            sportsState={sportsState}
            leagues={leagues}
            matches={matches}
            news={news}
            sources={sources}
            lastUpdatedAt={lastUpdatedAt}
            onRefreshAll={refreshAll}
            onNavigateSports={selectNav}
            onUpdateSportsState={updateSportsState}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Mobile Header Bar */}
      <div className="lg:hidden flex items-center justify-between gap-2 rounded-2xl border fabro-border fabro-surface px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4 text-[#0284C7]" />
            Deportes (18)
          </button>
          <button
            type="button"
            onClick={onBackToWellness}
            className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated px-2.5 text-[11px] font-medium fabro-muted cursor-pointer shrink-0"
            title="Volver a FABRO Bienestar"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Bienestar
          </button>
        </div>
        <div className="text-right min-w-0">
          <p className="text-[10px] font-mono fabro-muted">
            {String(activeEntry.number).padStart(2, '0')} / 18
          </p>
          <p className="text-xs font-bold truncate">{activeEntry.label}</p>
        </div>
      </div>

      {/* Offline cache banner if network is down */}
      {isOfflineFallback && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
            <CloudOff className="w-4 h-4 shrink-0" />
            Modo sin conexión o red inestable: se muestran los últimos datos guardados en caché local. Tus herramientas deportivas y entrenamientos siguen funcionando 100% offline.
          </span>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="min-h-[32px] rounded-xl border border-amber-500/40 px-3 text-[11px] font-semibold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Cerrar menú de FABRO DEPORTES"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/45"
          />
          <aside className="relative z-10 w-72 max-w-[84vw] h-full fabro-surface border-r fabro-border flex flex-col">
            <div className="flex items-center justify-end p-2 border-b fabro-border">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="min-h-[36px] min-w-[36px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{renderSidebarContent()}</div>
          </aside>
        </div>
      )}

      {/* Desktop Split Workspace matching FABRO Cultura & Bienestar */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <aside className="hidden lg:block w-64 shrink-0 sticky top-20 rounded-2xl border fabro-border fabro-surface overflow-hidden max-h-[calc(100vh-6.5rem)]">
          {renderSidebarContent()}
        </aside>

        <section className="flex-1 min-w-0 w-full space-y-5">
          {renderActiveSection()}
        </section>
      </div>
    </div>
  );
};
