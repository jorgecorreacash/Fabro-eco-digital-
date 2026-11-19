import React, { useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Star,
  Trophy,
  Tv,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import {
  OTHER_DISCIPLINES_CATALOG,
  SPORTS_LEAGUES_FALLBACK,
} from '../../../../data/sportsCatalog';
import {
  buildDatesParam,
  fetchLeagueScoreboard,
  fetchMatchSummary,
  formatInTimeZone,
  type CalendarWindowPreset,
} from '../../../../services/sportsService';
import type {
  SportLeagueCatalogItem,
  SportMatchItem,
  SportMatchSummary,
  SportNewsArticle,
  SportsNavId,
  SportsUserState,
} from '../../../../types/sports';

interface SportsOverviewFixturesPanelProps {
  section:
    | 'inicio-deportivo'
    | 'futbol'
    | 'otras-disciplinas'
    | 'partidos-en-vivo'
    | 'calendario'
    | 'resultados'
    | 'ligas-torneos';
  sportsState: SportsUserState;
  leagues: SportLeagueCatalogItem[];
  matches: SportMatchItem[];
  news: SportNewsArticle[];
  loading: boolean;
  lastUpdatedAt: string | null;
  errorMsg: string | null;
  onRefresh: (datesParam?: string, customLeagues?: string[]) => Promise<void>;
  onNavigateSports: (id: SportsNavId) => void;
  onUpdateSportsState: (updater: (prev: SportsUserState) => SportsUserState) => void;
  onSelectLeagueForStandings: (leagueId: string) => void;
}

const STATUS_STYLE: Record<SportMatchItem['statusCode'], string> = {
  'en-vivo': 'text-red-600 dark:text-red-400 font-bold',
  entretiempo: 'text-amber-600 dark:text-amber-400 font-bold',
  programado: 'text-sky-700 dark:text-sky-400 font-semibold',
  finalizado: 'fabro-muted font-semibold',
  suspendido: 'text-rose-600 font-semibold',
  postergado: 'text-amber-700 font-semibold',
  cancelado: 'text-rose-700 font-semibold',
};

export const SportsOverviewFixturesPanel: React.FC<SportsOverviewFixturesPanelProps> = ({
  section,
  sportsState,
  leagues,
  matches,
  news,
  loading,
  lastUpdatedAt,
  errorMsg,
  onRefresh,
  onNavigateSports,
  onUpdateSportsState,
  onSelectLeagueForStandings,
}) => {
  const { addScheduledReminder } = useEcosystem();
  const tz = sportsState.timeZone || 'America/Argentina/Buenos_Aires';
  const activeLeagues = leagues.length > 0 ? leagues : SPORTS_LEAGUES_FALLBACK;

  const [sportFilter, setSportFilter] = useState<string>('Todos');
  const [leagueFilter, setLeagueFilter] = useState<string>('todas');
  const [teamQuery, setTeamQuery] = useState('');
  const [footballRegion, setFootballRegion] = useState<'todas' | 'argentina' | 'internacional'>('todas');
  const [calendarPreset, setCalendarPreset] = useState<CalendarWindowPreset>('7-dias');
  const [selectedLeagueSingle, setSelectedLeagueSingle] = useState<string>('arg.1');
  const [singleMatches, setSingleMatches] = useState<SportMatchItem[] | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  // Expanded match detail state
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [summaryCache, setSummaryCache] = useState<Record<string, SportMatchSummary | null>>({});
  const [summaryLoadingId, setSummaryLoadingId] = useState<string | null>(null);
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const toggleFavoriteTeam = (teamName: string) => {
    if (!teamName || teamName === 'Por confirmar') return;
    onUpdateSportsState((prev) => {
      const exists = prev.favoriteTeams.includes(teamName);
      return {
        ...prev,
        favoriteTeams: exists
          ? prev.favoriteTeams.filter((t) => t !== teamName)
          : [teamName, ...prev.favoriteTeams],
      };
    });
  };

  const toggleFavoriteLeague = (leagueId: string) => {
    onUpdateSportsState((prev) => {
      const exists = prev.favoriteLeagues.includes(leagueId);
      return {
        ...prev,
        favoriteLeagues: exists
          ? prev.favoriteLeagues.filter((l) => l !== leagueId)
          : [leagueId, ...prev.favoriteLeagues],
      };
    });
  };

  const scheduleMatchReminder = (m: SportMatchItem) => {
    if (sportsState.alertPrefs.notifiedEventIds.includes(m.id)) {
      notify('Ya programaste una alerta para este encuentro (sin duplicados).');
      return;
    }
    const startMs = new Date(m.startDateIso).getTime();
    const minsFromNow = Math.max(1, Math.round((startMs - Date.now()) / 60000) - 10);
    addScheduledReminder(
      `Partido: ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.leagueName})`,
      'bienestar',
      'organizador-integral',
      minsFromNow
    );
    onUpdateSportsState((prev) => ({
      ...prev,
      alertPrefs: {
        ...prev.alertPrefs,
        notifiedEventIds: [m.id, ...prev.alertPrefs.notifiedEventIds].slice(0, 120),
      },
    }));
    notify(`Recordatorio programado para ${m.homeTeam.name} vs ${m.awayTeam.name}.`);
  };

  const handleToggleSummary = async (m: SportMatchItem) => {
    if (expandedMatchId === m.id) {
      setExpandedMatchId(null);
      return;
    }
    setExpandedMatchId(m.id);
    if (summaryCache[m.id] !== undefined) return;
    setSummaryLoadingId(m.id);
    const res = await fetchMatchSummary(m.leagueId, m.id);
    setSummaryLoadingId(null);
    if (res.ok && res.summary) {
      setSummaryCache((prev) => ({ ...prev, [m.id]: res.summary || null }));
    } else {
      setSummaryCache((prev) => ({ ...prev, [m.id]: null }));
      setSummaryErrors((prev) => ({
        ...prev,
        [m.id]: res.error || 'Sin estadísticas detalladas disponibles en la fuente gratuita.',
      }));
    }
  };

  const handleLoadSingleLeague = async (leagueId: string, preset: CalendarWindowPreset) => {
    setSelectedLeagueSingle(leagueId);
    setCalendarPreset(preset);
    setSingleLoading(true);
    const dates = buildDatesParam(preset, tz);
    const res = await fetchLeagueScoreboard(leagueId, dates);
    setSingleLoading(false);
    setSingleMatches(res.matches);
  };

  const baseMatches = useMemo(() => {
    let list = matches;
    if (section === 'futbol') {
      list = list.filter((m) => m.sport === 'soccer');
      if (footballRegion === 'argentina') {
        list = list.filter((m) => m.leagueId.startsWith('arg.') || m.leagueId.includes('conmebol'));
      } else if (footballRegion === 'internacional') {
        list = list.filter((m) => !m.leagueId.startsWith('arg.'));
      }
    } else if (section === 'otras-disciplinas') {
      list = list.filter((m) => m.sport !== 'soccer');
    } else if (section === 'partidos-en-vivo') {
      list = list.filter((m) => m.statusCode === 'en-vivo' || m.statusCode === 'entretiempo');
    } else if (section === 'resultados') {
      list = list.filter((m) => m.statusCode === 'finalizado');
    }

    if (sportFilter !== 'Todos') {
      list = list.filter((m) => m.disciplineLabel === sportFilter);
    }
    if (leagueFilter !== 'todas') {
      list = list.filter((m) => m.leagueId === leagueFilter);
    }
    const q = teamQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.leagueName.toLowerCase().includes(q) ||
          m.country.toLowerCase().includes(q)
      );
    }
    return list;
  }, [matches, section, footballRegion, sportFilter, leagueFilter, teamQuery]);

  const renderMatchCard = (m: SportMatchItem) => {
    const isExpanded = expandedMatchId === m.id;
    const summary = summaryCache[m.id];
    const isFavHome = sportsState.favoriteTeams.includes(m.homeTeam.name);
    const isFavAway = sportsState.favoriteTeams.includes(m.awayTeam.name);
    const isReminded = sportsState.alertPrefs.notifiedEventIds.includes(m.id);

    return (
      <article
        key={`${m.leagueId}-${m.id}`}
        className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-[#0284C7] truncate">{m.leagueName}</span>
            <span className="fabro-muted">· {m.country}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={STATUS_STYLE[m.statusCode]}>{m.statusLabel}</span>
            <span className="font-mono tabular-nums fabro-muted">{m.clockDetail}</span>
          </div>
        </div>

        {/* Teams & Score */}
        <div className="grid grid-cols-11 items-center gap-2 py-1">
          <div className="col-span-5 flex items-center gap-2 min-w-0">
            {m.homeTeam.logo ? (
              <img
                src={m.homeTeam.logo}
                alt={m.homeTeam.name}
                className="w-6 h-6 object-contain shrink-0"
                loading="lazy"
              />
            ) : (
              <span className="w-6 h-6 rounded-full border fabro-border flex items-center justify-center text-[10px] font-bold shrink-0">
                {m.homeTeam.shortName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className={`font-semibold truncate ${m.homeTeam.winner ? 'text-[#059669]' : ''}`}>
              {m.homeTeam.name}
            </span>
            <button
              type="button"
              onClick={() => toggleFavoriteTeam(m.homeTeam.name)}
              title="Seguir equipo local"
              className="fabro-muted hover:text-amber-500 cursor-pointer shrink-0"
            >
              <Star className={`w-3.5 h-3.5 ${isFavHome ? 'text-amber-500 fill-amber-500' : ''}`} />
            </button>
          </div>

          <div className="col-span-1 text-center font-mono text-sm font-bold tabular-nums">
            {m.statusCode === 'programado'
              ? 'vs'
              : `${m.homeTeam.score ?? '-'}–${m.awayTeam.score ?? '-'}`}
          </div>

          <div className="col-span-5 flex items-center justify-end gap-2 min-w-0">
            <button
              type="button"
              onClick={() => toggleFavoriteTeam(m.awayTeam.name)}
              title="Seguir equipo visitante"
              className="fabro-muted hover:text-amber-500 cursor-pointer shrink-0"
            >
              <Star className={`w-3.5 h-3.5 ${isFavAway ? 'text-amber-500 fill-amber-500' : ''}`} />
            </button>
            <span className={`font-semibold truncate text-right ${m.awayTeam.winner ? 'text-[#059669]' : ''}`}>
              {m.awayTeam.name}
            </span>
            {m.awayTeam.logo ? (
              <img
                src={m.awayTeam.logo}
                alt={m.awayTeam.name}
                className="w-6 h-6 object-contain shrink-0"
                loading="lazy"
              />
            ) : (
              <span className="w-6 h-6 rounded-full border fabro-border flex items-center justify-center text-[10px] font-bold shrink-0">
                {m.awayTeam.shortName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border text-[11px] fabro-muted">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Clock className="w-3 h-3" />
              {formatInTimeZone(m.startDateIso, tz, 'datetime')}
            </span>
            {m.venue && (
              <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                <MapPin className="w-3 h-3 shrink-0" />
                {m.venue}
              </span>
            )}
            {m.broadcast && (
              <span className="inline-flex items-center gap-1">
                <Tv className="w-3 h-3 shrink-0" />
                {m.broadcast}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {m.statusCode === 'programado' && (
              <button
                type="button"
                onClick={() => scheduleMatchReminder(m)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-semibold cursor-pointer ${
                  isReminded
                    ? 'border-[#059669] text-[#059669]'
                    : 'fabro-border hover:border-[#0284C7]'
                }`}
              >
                <Bell className="w-3 h-3" />
                {isReminded ? 'Alerta activa' : 'Recordar'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleToggleSummary(m)}
              className="inline-flex items-center gap-1 rounded-lg border fabro-border px-2 py-1 font-semibold hover:border-[#0284C7] cursor-pointer"
            >
              Detalle
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Expandable Match Summary (Goals, Cards, Lineups, Stats) */}
        {isExpanded && (
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-3 text-[11px]">
            {summaryLoadingId === m.id ? (
              <p className="inline-flex items-center gap-1.5 fabro-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Consultando incidencias, alineaciones y estadísticas reales...
              </p>
            ) : summary ? (
              <div className="space-y-3">
                <p className="font-mono text-[10px] fabro-muted">
                  Fuente: {summary.sourceName} · Actualización periódica · Consultado:{' '}
                  {formatInTimeZone(summary.fetchedAt, tz, 'time')}
                </p>
                {summary.events.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-semibold">Incidencias (goles, tarjetas, cambios)</p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {summary.events.map((ev) => (
                        <li key={ev.id} className="flex items-start gap-2">
                          <span className="font-mono font-bold text-[#0284C7] w-10 shrink-0">
                            {ev.clock || '—'}
                          </span>
                          <span>
                            <strong>{ev.type}:</strong> {ev.text}{' '}
                            {ev.teamName ? `(${ev.teamName})` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.teamStats.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {summary.teamStats.map((ts) => (
                      <div key={ts.teamName} className="rounded-lg border fabro-border fabro-surface p-2.5 space-y-1">
                        <p className="font-semibold">{ts.teamName}</p>
                        {ts.stats.map((s) => (
                          <div key={s.label} className="flex justify-between font-mono">
                            <span className="fabro-muted">{s.label}</span>
                            <span>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {summary.lineups.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {summary.lineups.map((lu) => (
                      <div key={lu.teamName} className="rounded-lg border fabro-border fabro-surface p-2.5 space-y-1">
                        <p className="font-semibold">
                          {lu.teamName} {lu.formation ? `(${lu.formation})` : ''}
                        </p>
                        <p className="fabro-muted leading-relaxed">
                          {lu.players.map((p) => `${p.jersey ? `#${p.jersey} ` : ''}${p.name}`).join(' · ') ||
                            'Alineación no publicada aún.'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {summary.events.length === 0 &&
                  summary.teamStats.length === 0 &&
                  summary.lineups.length === 0 && (
                    <p className="fabro-muted">
                      La fuente pública aún no publicó alineaciones ni estadísticas detalladas para este encuentro.
                    </p>
                  )}
              </div>
            ) : (
              <p className="fabro-muted">
                {summaryErrors[m.id] || 'No hay detalle extendido disponible para este evento.'}
              </p>
            )}
          </div>
        )}
      </article>
    );
  };

  // =========================================================================
  // 1. INICIO DEPORTIVO
  // =========================================================================
  if (section === 'inicio-deportivo') {
    const liveMatches = matches.filter(
      (m) => m.statusCode === 'en-vivo' || m.statusCode === 'entretiempo'
    );
    const upcomingMatches = matches.filter((m) => m.statusCode === 'programado').slice(0, 6);
    const recentResults = matches.filter((m) => m.statusCode === 'finalizado').slice(0, 6);

    return (
      <div className="space-y-5">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
                01 · Inicio deportivo · Zona horaria: {tz}
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                FABRO DEPORTES — Centro deportivo actualizado
              </h2>
              <p className="text-xs fabro-muted mt-0.5">
                Calendarios, resultados, tablas, noticias RSS y herramientas de entrenamiento con fuentes públicas $0.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href="https://pelotalibres.st/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Ver partidos en vivo</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-90" />
              </a>
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={loading}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] text-white px-4 text-xs font-semibold cursor-pointer disabled:opacity-60 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar ahora
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border text-[11px] fabro-muted font-mono">
            <span>
              Última actualización:{' '}
              {lastUpdatedAt ? formatInTimeZone(lastUpdatedAt, tz, 'datetime') : 'Consultando...'} ·
              Modo: Actualización periódica (caché 90s)
            </span>
            <span>{matches.length} eventos · {news.length} noticias</span>
          </div>

          {errorMsg && <p className="text-xs text-amber-700 dark:text-amber-400">{errorMsg}</p>}
          {toast && <p className="text-xs font-semibold text-[#059669]">{toast}</p>}
        </section>

        {/* Quick KPI Row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <button
            type="button"
            onClick={() => onNavigateSports('partidos-en-vivo')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-1 hover:border-red-500 cursor-pointer"
          >
            <p className="fabro-muted flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-red-600" />
              En juego ahora
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums">{liveMatches.length}</p>
            <p className="text-[11px] fabro-muted">Actualización periódica</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigateSports('calendario')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-1 hover:border-[#0284C7] cursor-pointer"
          >
            <p className="fabro-muted flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0284C7]" />
              Próximos encuentros
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {matches.filter((m) => m.statusCode === 'programado').length}
            </p>
            <p className="text-[11px] fabro-muted">Hora local ({tz.split('/').pop()})</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigateSports('mis-favoritos')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-1 hover:border-amber-500 cursor-pointer"
          >
            <p className="fabro-muted flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500" />
              MI DEPORTE (Favoritos)
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {sportsState.favoriteTeams.length + sportsState.favoriteAthletes.length}
            </p>
            <p className="text-[11px] fabro-muted">{sportsState.favoriteLeagues.length} ligas seguidas</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigateSports('herramientas-deportivas')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-1 hover:border-[#059669] cursor-pointer"
          >
            <p className="fabro-muted flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#059669]" />
              Sport Tools & Marcas
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {sportsState.personalRecords.length}
            </p>
            <p className="text-[11px] fabro-muted">Cronómetro, pace, zonas FC</p>
          </button>
        </section>

        {/* Live Matches if any */}
        {liveMatches.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-600" />
              Partidos en juego (actualización periódica)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {liveMatches.slice(0, 6).map(renderMatchCard)}
            </div>
          </section>
        )}

        {/* Upcoming + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Próximos partidos y eventos</h3>
              <button
                type="button"
                onClick={() => onNavigateSports('calendario')}
                className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
              >
                Ver calendario completo →
              </button>
            </div>
            {upcomingMatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed fabro-border p-6 text-center text-xs fabro-muted">
                No hay encuentros programados en la ventana actual. Abrí «5. Calendario» para ver los próximos 7 o 30 días.
              </div>
            ) : (
              <div className="space-y-2.5">{upcomingMatches.map(renderMatchCard)}</div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Resultados recientes</h3>
              <button
                type="button"
                onClick={() => onNavigateSports('resultados')}
                className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
              >
                Todos los resultados →
              </button>
            </div>
            {recentResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed fabro-border p-6 text-center text-xs fabro-muted">
                Aún no hay partidos finalizados en la ventana consultada.
              </div>
            ) : (
              <div className="space-y-2.5">{recentResults.map(renderMatchCard)}</div>
            )}
          </section>
        </div>

        {/* Highlighted Real News */}
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold">Noticias deportivas destacadas (RSS reales)</h3>
            <button
              type="button"
              onClick={() => onNavigateSports('noticias')}
              className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
            >
              Ir a FABRO Noticias Deportivas →
            </button>
          </div>
          {news.length === 0 ? (
            <p className="text-xs fabro-muted">Cargando titulares verificados desde fuentes RSS públicas...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {news.slice(0, 6).map((n, idx) => (
                <a
                  key={`${n.id}-${n.url}-${idx}`}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1.5 hover:border-[#0284C7] transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] fabro-muted">
                      <span className="font-semibold text-[#0284C7]">{n.category}</span>
                      <span className="font-mono">{formatInTimeZone(n.publishedAt, tz, 'datetime')}</span>
                    </div>
                    <p className="font-semibold leading-snug line-clamp-2">{n.title}</p>
                    <p className="fabro-muted line-clamp-2 text-[11px]">{n.summary}</p>
                  </div>
                  <div className="pt-2 flex items-center justify-between text-[10px] fabro-muted">
                    <span>{n.sourceName}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // =========================================================================
  // 3. OTRAS DISCIPLINAS (16 disciplinas)
  // =========================================================================
  if (section === 'otras-disciplinas') {
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
            03 · Polideportivo · 16 disciplinas
          </p>
          <h2 className="font-display text-xl font-bold">
            Otras disciplinas deportivas (calendarios reales y cobertura transparente)
          </h2>
          <p className="fabro-muted">
            Mostramos eventos reales donde existen fuentes públicas gratuitas (NBA, ATP/WTA, F1, UFC, PGA, Rugby) y cobertura RSS + herramientas de entrenamiento para el resto, sin inventar resultados.
          </p>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {OTHER_DISCIPLINES_CATALOG.map((d) => (
            <article
              key={d.id}
              className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold">{d.label}</h3>
                  <span className="text-[10px] font-mono fabro-muted">{d.officialRef}</span>
                </div>
                <p className="text-[11px] fabro-muted leading-relaxed">{d.coverageNote}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.leagueId && (
                  <button
                    type="button"
                    onClick={() => void handleLoadSingleLeague(d.leagueId!, '7-dias')}
                    className="rounded-lg bg-[#0284C7] text-white px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                  >
                    Ver calendario
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateSports('noticias')}
                  className="rounded-lg border fabro-border px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                >
                  Noticias
                </button>
              </div>
            </article>
          ))}
        </div>

        {singleMatches && (
          <section className="space-y-3">
            <h3 className="font-display text-base font-bold">
              Eventos consultados ({activeLeagues.find((l) => l.id === selectedLeagueSingle)?.name})
            </h3>
            {singleMatches.length === 0 ? (
              <p className="fabro-muted">No se registraron encuentros en los próximos 7 días para esta disciplina.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {singleMatches.map(renderMatchCard)}
              </div>
            )}
          </section>
        )}

        {baseMatches.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display text-base font-bold">Eventos polideportivos cargados</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {baseMatches.slice(0, 14).map(renderMatchCard)}
            </div>
          </section>
        )}
      </div>
    );
  }

  // =========================================================================
  // 7. LIGAS Y TORNEOS
  // =========================================================================
  if (section === 'ligas-torneos') {
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
            07 · Catálogo extensible de competiciones
          </p>
          <h2 className="font-display text-xl font-bold">
            Ligas y torneos nacionales e internacionales ({activeLeagues.length} activos)
          </h2>
          <p className="fabro-muted">
            Arquitectura basada en registro configurable en el servidor: se pueden sumar nuevas competiciones sin reconstruir el módulo.
          </p>
        </section>

        {(
          [
            ['argentina', 'Fútbol Argentino y Selección'],
            ['internacional', 'Fútbol Internacional y Copas'],
            ['otras-disciplinas', 'Polideportivo Internacional'],
          ] as const
        ).map(([region, heading]) => (
          <section key={region} className="space-y-2.5">
            <h3 className="font-display text-base font-bold">{heading}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeLeagues
                .filter((l) => l.region === region)
                .map((l) => {
                  const isFav = sportsState.favoriteLeagues.includes(l.id);
                  return (
                    <div
                      key={l.id}
                      className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm">{l.name}</p>
                          <p className="text-[11px] fabro-muted">
                            {l.disciplineLabel} · {l.country}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavoriteLeague(l.id)}
                          className="cursor-pointer"
                          title="Seguir liga"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isFav ? 'text-amber-500 fill-amber-500' : 'fabro-muted'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void handleLoadSingleLeague(l.id, '30-dias');
                            onNavigateSports('calendario');
                          }}
                          className="rounded-lg border fabro-border px-2.5 py-1 font-semibold hover:border-[#0284C7] cursor-pointer"
                        >
                          Calendario
                        </button>
                        {l.hasStandings && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectLeagueForStandings(l.id);
                              onNavigateSports('tablas-posiciones');
                            }}
                            className="rounded-lg bg-[#0284C7] text-white px-2.5 py-1 font-semibold cursor-pointer"
                          >
                            Tabla de posiciones
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // =========================================================================
  // 2. FÚTBOL / 4. PARTIDOS EN VIVO / 5. CALENDARIO / 6. RESULTADOS
  // =========================================================================
  const displayedMatches = singleMatches !== null && section === 'calendario' ? singleMatches : baseMatches;

  return (
    <div className="space-y-5 text-xs">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
              {section === 'futbol'
                ? '02 · Fútbol nacional e internacional'
                : section === 'partidos-en-vivo'
                ? '04 · Marcador en juego (actualización periódica)'
                : section === 'calendario'
                ? '05 · Calendario deportivo'
                : '06 · Resultados recientes'}
            </p>
            <h2 className="font-display text-xl font-bold">
              {section === 'futbol'
                ? 'Fútbol argentino, sudamericano y europeo'
                : section === 'partidos-en-vivo'
                ? 'Partidos en juego ahora'
                : section === 'calendario'
                ? 'Agenda y próximos encuentros'
                : 'Resultados finalizados'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(section === 'partidos-en-vivo' || section === 'futbol') && (
              <a
                href="https://pelotalibres.st/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 font-bold transition-colors whitespace-nowrap"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Ver partidos en vivo</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-90" />
              </a>
            )}
            <button
              type="button"
              onClick={() => void onRefresh(buildDatesParam(calendarPreset, tz))}
              disabled={loading || singleLoading}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] text-white px-4 font-semibold cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || singleLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {section === 'partidos-en-vivo' && (
          <p className="fabro-muted">
            Nota de transparencia: las fuentes gratuitas públicas operan por <strong>actualización periódica</strong> (cada 90 s con caché respetuosa). No simulamos transmisiones minuto a minuto ni inventamos goles.
          </p>
        )}

        {section === 'futbol' && (
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['todas', 'Todo el fútbol'],
                ['argentina', 'Argentina y CONMEBOL'],
                ['internacional', 'Europa y FIFA'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFootballRegion(id)}
                className={`px-3 py-1.5 rounded-xl border font-semibold cursor-pointer ${
                  footballRegion === id
                    ? 'border-[#0284C7] bg-[#0284C7] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Calendar Window Presets */}
        {(section === 'calendario' || section === 'futbol' || section === 'resultados') && (
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['hoy', 'Hoy'],
                ['manana', 'Mañana'],
                ['7-dias', 'Próximos 7 días'],
                ['30-dias', 'Próximos 30 días'],
                ['anteriores', 'Fechas anteriores'],
                ['temporada', 'Ventana oficial liga'],
              ] as Array<[CalendarWindowPreset, string]>
            ).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setCalendarPreset(preset);
                  if (section === 'calendario' && leagueFilter !== 'todas') {
                    void handleLoadSingleLeague(leagueFilter, preset);
                  } else {
                    setSingleMatches(null);
                    void onRefresh(buildDatesParam(preset, tz));
                  }
                }}
                className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer ${
                  calendarPreset === preset
                    ? 'border-[#059669] bg-[#059669] text-white font-semibold'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t fabro-border">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={teamQuery}
              onChange={(e) => setTeamQuery(e.target.value)}
              placeholder="Filtrar por equipo, liga o país..."
              className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated pl-8 pr-3 fabro-input"
            />
          </div>
          <select
            value={leagueFilter}
            onChange={(e) => {
              const val = e.target.value;
              setLeagueFilter(val);
              if (section === 'calendario' && val !== 'todas') {
                void handleLoadSingleLeague(val, calendarPreset);
              } else {
                setSingleMatches(null);
              }
            }}
            className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          >
            <option value="todas">Todas las competiciones</option>
            {activeLeagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.country})
              </option>
            ))}
          </select>
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          >
            <option value="Todos">Todos los deportes</option>
            <option value="Fútbol">Fútbol</option>
            <option value="Básquet">Básquet</option>
            <option value="Tenis">Tenis</option>
            <option value="Fórmula 1">Fórmula 1</option>
            <option value="Rugby">Rugby</option>
            <option value="Artes marciales">Artes marciales</option>
            <option value="Golf">Golf</option>
          </select>
        </div>

        <p className="text-[11px] font-mono fabro-muted">
          Zona horaria: {tz} · Última consulta:{' '}
          {lastUpdatedAt ? formatInTimeZone(lastUpdatedAt, tz, 'datetime') : '—'} · Mostrando{' '}
          {displayedMatches.length} eventos
        </p>
        {toast && <p className="font-semibold text-[#059669]">{toast}</p>}
      </section>

      {displayedMatches.length === 0 ? (
        <div className="rounded-2xl border border-dashed fabro-border p-8 text-center space-y-2.5 fabro-muted">
          <p className="font-semibold text-[var(--fabro-text)]">
            {section === 'partidos-en-vivo'
              ? 'No hay encuentros en juego en este momento en las competiciones conectadas.'
              : 'No se encontraron partidos para los filtros y fechas elegidos.'}
          </p>
          <p>
            Probá cambiar el rango de fechas (por ejemplo «Próximos 7 días» o «Próximos 30 días») o elegir una liga específica.
          </p>
          {section === 'partidos-en-vivo' && (
            <div className="pt-1">
              <a
                href="https://pelotalibres.st/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 font-bold transition-colors"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Abrir partidos en vivo</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-90" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {displayedMatches.map(renderMatchCard)}
        </div>
      )}
    </div>
  );
};
