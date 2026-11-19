import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Check,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Star,
  Table2,
  User,
  Users,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import {
  SPORTS_LEAGUES_FALLBACK,
  SPORTS_NEWS_CATEGORIES,
} from '../../../../data/sportsCatalog';
import { sendByokChatCompletion } from '../../../../services/byokChatClient';
import { findByokKeyForWellnessEngine } from '../../../../services/wellnessAiService';
import {
  fetchLeagueStandings,
  formatInTimeZone,
  searchSportsProfiles,
} from '../../../../services/sportsService';
import type {
  SportAthleteProfile,
  SportLeagueCatalogItem,
  SportMatchItem,
  SportNewsArticle,
  SportStandingsGroup,
  SportTeamProfile,
  SportsUserState,
} from '../../../../types/sports';
import type { WellnessStateSnapshot } from '../../../../types/wellness';

interface SportsTablesProfilesNewsPanelProps {
  section: 'tablas-posiciones' | 'equipos' | 'deportistas' | 'noticias' | 'estadisticas';
  sportsState: SportsUserState;
  wellnessState: WellnessStateSnapshot;
  leagues: SportLeagueCatalogItem[];
  matches: SportMatchItem[];
  news: SportNewsArticle[];
  selectedStandingsLeague: string;
  onSelectStandingsLeague: (leagueId: string) => void;
  onRefreshNews: () => Promise<void>;
  onUpdateSportsState: (updater: (prev: SportsUserState) => SportsUserState) => void;
}

export const SportsTablesProfilesNewsPanel: React.FC<SportsTablesProfilesNewsPanelProps> = ({
  section,
  sportsState,
  wellnessState,
  leagues,
  matches,
  news,
  selectedStandingsLeague,
  onSelectStandingsLeague,
  onRefreshNews,
  onUpdateSportsState,
}) => {
  const { profile, addWallPost, byokKeys, getByokSecret, wellnessAiEngine } = useEcosystem();
  const tz = sportsState.timeZone || 'America/Argentina/Buenos_Aires';
  const activeLeagues = leagues.length > 0 ? leagues : SPORTS_LEAGUES_FALLBACK;

  // Standings state
  const [standingsGroups, setStandingsGroups] = useState<SportStandingsGroup[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsFetchedAt, setStandingsFetchedAt] = useState<string | null>(null);
  const [standingsNote, setStandingsNote] = useState<string | null>(null);

  // Team / Athlete search
  const [profileQuery, setProfileQuery] = useState(section === 'equipos' ? 'Boca Juniors' : 'Lionel Messi');
  const [profileResults, setProfileResults] = useState<Array<SportTeamProfile | SportAthleteProfile>>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // News filters & IA digest
  const [newsCategory, setNewsCategory] = useState<string>('Todas');
  const [newsQuery, setNewsQuery] = useState('');
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [newsAiDigest, setNewsAiDigest] = useState<string | null>(null);
  const [newsAiLoading, setNewsAiLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (section !== 'tablas-posiciones' && section !== 'estadisticas') return;
    let active = true;
    setStandingsLoading(true);
    setStandingsNote(null);
    void fetchLeagueStandings(selectedStandingsLeague).then((res) => {
      if (!active) return;
      setStandingsLoading(false);
      setStandingsGroups(res.groups);
      setStandingsFetchedAt(res.fetchedAt);
      setStandingsNote(res.note || res.error || null);
    });
    return () => {
      active = false;
    };
  }, [section, selectedStandingsLeague]);

  const handleProfileSearch = async (e?: React.FormEvent, qOverride?: string) => {
    if (e) e.preventDefault();
    const q = (qOverride ?? profileQuery).trim();
    if (q.length < 2) return;
    setProfileLoading(true);
    setProfileError(null);
    const kind = section === 'deportistas' ? 'player' : 'team';
    const res = await searchSportsProfiles(kind, q);
    setProfileLoading(false);
    setProfileResults(res.items);
    if (!res.ok) setProfileError(res.error || 'No se pudo consultar la ficha.');
  };

  const filteredNews = useMemo(() => {
    const q = newsQuery.trim().toLowerCase();
    return news.filter((a) => {
      if (newsCategory !== 'Todas' && a.category !== newsCategory) return false;
      if (onlyConfirmed && a.isRumor) return false;
      if (
        q &&
        !a.title.toLowerCase().includes(q) &&
        !a.summary.toLowerCase().includes(q) &&
        !a.sourceName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [news, newsCategory, newsQuery, onlyConfirmed]);

  const handleGenerateNewsDigest = async () => {
    const sample = filteredNews.slice(0, 12);
    if (sample.length === 0) {
      setNewsAiDigest('No hay noticias filtradas para resumir en este momento.');
      return;
    }

    const foundByok = findByokKeyForWellnessEngine(byokKeys, getByokSecret, wellnessAiEngine);
    if (foundByok) {
      setNewsAiLoading(true);
      const res = await sendByokChatCompletion({
        keyMeta: foundByok.keyMeta,
        rawApiKey: foundByok.secret,
        history: [],
        userText: `Elaborá un resumen diario estructurado en español a partir EXCLUSIVAMENTE de estos titulares reales verificados (no inventes resultados, fechas ni citas). Separá claramente «Hechos informados» de «Rumores o versiones de mercado» e indicá siempre el medio original:

${sample.map((n, i) => `${i + 1}. [${n.category}] ${n.title} (${n.sourceName}, ${n.publishedAt})${n.isRumor ? ' [POSIBLE RUMOR]' : ''}`).join('\n')}`,
        systemInstructionOverride:
          'Sos el editor deportivo de FABRO NOTICIAS DEPORTIVAS. Solo sintetizás titulares reales provistos, jamás inventás información ni copiás artículos completos.',
      });
      setNewsAiLoading(false);
      if (res.ok && res.content.trim()) {
        setNewsAiDigest(`[Resumen generado con tu clave BYOK · ${foundByok.keyMeta.providerName}]\n\n${res.content.trim()}`);
        return;
      }
    }

    // Honest local $0 grouping and rumor-separation digest
    const byCat = new Map<string, SportNewsArticle[]>();
    for (const art of sample) {
      const arr = byCat.get(art.category) || [];
      arr.push(art);
      byCat.set(art.category, arr);
    }
    const rumors = sample.filter((a) => a.isRumor);
    const lines: string[] = [
      `[Resumen diario local $0 · ${sample.length} titulares analizados · sin invención de hechos]`,
    ];
    for (const [cat, items] of byCat.entries()) {
      lines.push(`\n• ${cat} (${items.length}): ${items.map((x) => `${x.title} (${x.sourceName})`).join(' | ')}`);
    }
    if (rumors.length > 0) {
      lines.push(
        `\n[Atención · Posibles rumores o trascendidos detectados (${rumors.length})]:\n` +
          rumors.map((r) => `• ${r.title} (${r.sourceName}) — Tratar como versión periodística hasta confirmación oficial.`).join('\n')
      );
    }
    setNewsAiDigest(lines.join('\n'));
  };

  // =========================================================================
  // 8. TABLAS DE POSICIONES
  // =========================================================================
  if (section === 'tablas-posiciones') {
    const standingsLeagues = activeLeagues.filter((l) => l.hasStandings);
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
                08 · Tablas de posiciones verificadas
              </p>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Table2 className="w-5 h-5 text-[#0284C7]" />
                Posiciones reales por competición
              </h2>
            </div>
            <select
              value={selectedStandingsLeague}
              onChange={(e) => onSelectStandingsLeague(e.target.value)}
              className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-semibold fabro-input"
            >
              {standingsLeagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.country})
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] font-mono fabro-muted">
            Fuente: ESPN Public Sports JSON · Actualización periódica · Consultado:{' '}
            {standingsFetchedAt ? formatInTimeZone(standingsFetchedAt, tz, 'datetime') : '—'}
          </p>
        </section>

        {standingsLoading ? (
          <div className="rounded-2xl border fabro-border fabro-surface p-8 text-center fabro-muted">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Consultando tabla oficial...
          </div>
        ) : standingsGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed fabro-border p-8 text-center fabro-muted">
            {standingsNote || 'No hay tabla de posiciones publicada actualmente para esta competición.'}
          </div>
        ) : (
          <div className="space-y-4">
            {standingsGroups.map((grp) => (
              <div
                key={grp.groupName}
                className="rounded-2xl border fabro-border fabro-surface overflow-hidden"
              >
                <div className="px-4 py-3 border-b fabro-border font-display text-sm font-bold">
                  {grp.groupName}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b fabro-border text-[11px] fabro-muted font-mono">
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Equipo</th>
                        <th className="py-2.5 px-2 text-right">PJ</th>
                        <th className="py-2.5 px-2 text-right">G</th>
                        <th className="py-2.5 px-2 text-right">E</th>
                        <th className="py-2.5 px-2 text-right">P</th>
                        <th className="py-2.5 px-2 text-right">GF</th>
                        <th className="py-2.5 px-2 text-right">GC</th>
                        <th className="py-2.5 px-2 text-right">DG</th>
                        <th className="py-2.5 px-3 text-right font-bold">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y fabro-border font-mono tabular-nums">
                      {grp.rows.map((r) => (
                        <tr key={`${grp.groupName}-${r.teamName}-${r.rank}`} className="hover:bg-[var(--fabro-surface-2)]">
                          <td className="py-2 px-3 fabro-muted">{r.rank}</td>
                          <td className="py-2 px-3 font-sans font-semibold">
                            <div className="flex items-center gap-2">
                              {r.teamLogo && (
                                <img
                                  src={r.teamLogo}
                                  alt={r.teamName}
                                  className="w-5 h-5 object-contain shrink-0"
                                  loading="lazy"
                                />
                              )}
                              <span className="truncate">{r.teamName}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">{r.played}</td>
                          <td className="py-2 px-2 text-right">{r.wins}</td>
                          <td className="py-2 px-2 text-right">{r.draws}</td>
                          <td className="py-2 px-2 text-right">{r.losses}</td>
                          <td className="py-2 px-2 text-right">{r.goalsFor}</td>
                          <td className="py-2 px-2 text-right">{r.goalsAgainst}</td>
                          <td className="py-2 px-2 text-right">{r.goalDiff}</td>
                          <td className="py-2 px-3 text-right font-bold text-[#0284C7]">{r.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 9. EQUIPOS & 10. DEPORTISTAS
  // =========================================================================
  if (section === 'equipos' || section === 'deportistas') {
    const isPlayer = section === 'deportistas';
    const quickSuggestions = isPlayer
      ? ['Lionel Messi', 'Julian Alvarez', 'Franco Colapinto', 'Manu Ginobili', 'Novak Djokovic']
      : ['Boca Juniors', 'River Plate', 'Racing Club', 'Real Madrid', 'Barcelona', 'Manchester City'];

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
              {isPlayer ? '10 · Fichas de deportistas' : '09 · Fichas de clubes y selecciones'}
            </p>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              {isPlayer ? <User className="w-5 h-5 text-[#0284C7]" /> : <Users className="w-5 h-5 text-[#0284C7]" />}
              {isPlayer ? 'Buscar deportistas y seguir favoritos' : 'Buscar equipos, escudos, partidos y noticias'}
            </h2>
          </div>

          <form onSubmit={handleProfileSearch} className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={profileQuery}
                onChange={(e) => setProfileQuery(e.target.value)}
                placeholder={isPlayer ? 'Ej. Lionel Messi, Lautaro Martinez, Carlos Alcaraz...' : 'Ej. Boca Juniors, River Plate, Arsenal...'}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 fabro-input"
              />
            </div>
            <button
              type="submit"
              disabled={profileLoading}
              className="min-h-[40px] rounded-xl bg-[#0284C7] text-white px-5 font-semibold cursor-pointer disabled:opacity-60"
            >
              {profileLoading ? 'Buscando...' : 'Buscar ficha'}
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {quickSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setProfileQuery(s);
                  void handleProfileSearch(undefined, s);
                }}
                className="rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 hover:border-[#0284C7] cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>

          {profileError && <p className="text-amber-700 dark:text-amber-400">{profileError}</p>}
          {toast && <p className="font-semibold text-[#059669]">{toast}</p>}
        </section>

        {profileResults.length === 0 ? (
          <div className="rounded-2xl border border-dashed fabro-border p-8 text-center fabro-muted">
            Usá el buscador superior para consultar fichas reales desde TheSportsDB (fuente pública gratuita).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profileResults.map((item) => {
              const isFav = isPlayer
                ? sportsState.favoriteAthletes.includes(item.name)
                : sportsState.favoriteTeams.includes(item.name);
              const relatedMatches = matches.filter((m) =>
                `${m.homeTeam.name} ${m.awayTeam.name}`.toLowerCase().includes(item.name.toLowerCase().split(' ')[0])
              );
              const relatedNews = news.filter((n) =>
                `${n.title} ${n.summary}`.toLowerCase().includes(item.name.toLowerCase().split(' ')[0])
              );

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 object-contain rounded-xl border fabro-border p-1 shrink-0 bg-white"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-base font-bold truncate">{item.name}</h3>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSportsState((prev) =>
                              isPlayer
                                ? {
                                    ...prev,
                                    favoriteAthletes: isFav
                                      ? prev.favoriteAthletes.filter((x) => x !== item.name)
                                      : [item.name, ...prev.favoriteAthletes],
                                  }
                                : {
                                    ...prev,
                                    favoriteTeams: isFav
                                      ? prev.favoriteTeams.filter((x) => x !== item.name)
                                      : [item.name, ...prev.favoriteTeams],
                                  }
                            );
                            notify(isFav ? `Quitado ${item.name} de MI DEPORTE.` : `${item.name} agregado a MI DEPORTE.`);
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold cursor-pointer shrink-0 ${
                            isFav ? 'border-amber-500 text-amber-600' : 'fabro-border'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-500 text-amber-500' : ''}`} />
                          {isFav ? 'Siguiendo' : 'Seguir'}
                        </button>
                      </div>
                      <p className="fabro-muted mt-0.5">
                        {item.sport} · {item.country}
                        {item.kind === 'team'
                          ? `${item.league ? ` · ${item.league}` : ''}${item.stadium ? ` · Estadio: ${item.stadium}` : ''}`
                          : `${item.team ? ` · ${item.team}` : ''}${item.position ? ` · ${item.position}` : ''}${item.birthDate ? ` · Nac: ${item.birthDate}` : ''}`}
                      </p>
                    </div>
                  </div>
                  {item.description && (
                    <p className="fabro-muted leading-relaxed line-clamp-4">{item.description}</p>
                  )}
                  <div className="pt-2 border-t fabro-border flex flex-wrap gap-3 text-[11px] font-mono fabro-muted">
                    <span>Partidos en agenda: {relatedMatches.length}</span>
                    <span>Noticias relacionadas: {relatedNews.length}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 11. FABRO NOTICIAS DEPORTIVAS + IA PARA NOTICIAS
  // =========================================================================
  if (section === 'noticias') {
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
                11 · FABRO NOTICIAS DEPORTIVAS
              </p>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-[#0284C7]" />
                Actualidad deportiva desde RSS públicos verificados
              </h2>
              <p className="fabro-muted mt-0.5">
                Resúmenes breves propios y enlace directo al medio original (sin copiar artículos protegidos).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleGenerateNewsDigest()}
                disabled={newsAiLoading}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#4338CA] text-white px-3.5 font-semibold cursor-pointer disabled:opacity-60"
              >
                {newsAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Resumen diario / Detector rumores
              </button>
              <button
                type="button"
                onClick={() => void onRefreshNews()}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar RSS
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              value={newsQuery}
              onChange={(e) => setNewsQuery(e.target.value)}
              placeholder="Buscar por equipo, deportista, liga o tema..."
              className="flex-1 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <label className="inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={onlyConfirmed}
                onChange={(e) => setOnlyConfirmed(e.target.checked)}
                className="accent-[#0284C7]"
              />
              <span>Ocultar rumores de mercado</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SPORTS_NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setNewsCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                  newsCategory === cat
                    ? 'bg-[#0284C7] text-white font-semibold'
                    : 'fabro-surface-elevated fabro-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {toast && (
            <p className="font-semibold text-[#059669] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {toast}
            </p>
          )}
        </section>

        {newsAiDigest && (
          <section className="rounded-2xl border border-[#4338CA]/35 bg-[#4338CA]/5 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4338CA] dark:text-[#A5B4FC]">
                Síntesis periodística (FABRO IA)
              </h3>
              <button
                type="button"
                onClick={() => setNewsAiDigest(null)}
                className="text-[11px] fabro-muted hover:underline cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{newsAiDigest}</p>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNews.map((art, idx) => {
            const isSaved = sportsState.savedNewsArticles.some(
              (s) => s.url === art.url || s.id === art.id
            );
            return (
              <article
                key={`${art.id}-${art.url}-${idx}`}
                className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  {art.imageUrl && (
                    <img
                      src={art.imageUrl}
                      alt={art.title}
                      className="w-full h-36 object-cover rounded-xl border fabro-border"
                      loading="lazy"
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-[#0284C7]">{art.category}</span>
                    <span className="font-mono fabro-muted">
                      {formatInTimeZone(art.publishedAt, tz, 'datetime')}
                    </span>
                  </div>
                  {art.isRumor && (
                    <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Versión / posible rumor de mercado (no confirmado oficialmente)
                    </p>
                  )}
                  <h3 className="font-display text-sm font-bold leading-snug">{art.title}</h3>
                  <p className="fabro-muted leading-relaxed">{art.summary}</p>
                </div>

                <div className="pt-2.5 border-t fabro-border flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold fabro-muted">Fuente: {art.sourceName}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSportsState((prev) => ({
                          ...prev,
                          savedNewsArticles: isSaved
                            ? prev.savedNewsArticles.filter((x) => x.id !== art.id)
                            : [art, ...prev.savedNewsArticles].slice(0, 50),
                        }));
                        notify(isSaved ? 'Quitada de guardadas.' : 'Noticia guardada en tus favoritas.');
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 cursor-pointer ${
                        isSaved ? 'border-amber-500 text-amber-600' : 'fabro-border fabro-muted'
                      }`}
                    >
                      <Bookmark className="w-3 h-3" />
                      {isSaved ? 'Guardada' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await addWallPost({
                          author: profile.displayName || 'Usuario FABRO',
                          fabroId: profile.fabroId || 'FABRO',
                          authorAvatar: profile.photoURL,
                          text: `Noticia deportiva (${art.sourceName}): «${art.title}»\nFuente original: ${art.url} #Deportes #Bienestar`,
                          origin: 'bienestar',
                          categoryTag: 'Entrenamiento',
                        });
                        notify('Noticia compartida en Comunidad FABRO.');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border fabro-border px-2 py-1 fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      Compartir
                    </button>
                    <a
                      href={art.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0284C7] text-white px-2.5 py-1 font-semibold"
                    >
                      Leer nota
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 12. ESTADÍSTICAS (Competiciones + Evolución Deportiva Personal integrada)
  // =========================================================================
  const totalWorkoutMin = wellnessState.workoutLogs.reduce((a, b) => a + b.durationMin, 0);
  const totalRunKm = Number(
    sportsState.runningLogs.reduce((a, b) => a + b.distanceKm, 0).toFixed(1)
  );
  const totalCycleKm = Number(
    sportsState.cyclingLogs.reduce((a, b) => a + b.distanceKm, 0).toFixed(1)
  );
  const topRows = standingsGroups[0]?.rows.slice(0, 5) || [];

  return (
    <div className="space-y-5 text-xs">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
          12 · Estadísticas deportivas y rendimiento personal
        </p>
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#0284C7]" />
          Métricas verificadas sin duplicar registros con FABRO Bienestar
        </h2>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-1">
          <p className="fabro-muted">Sesiones totales (Bienestar + Deportes)</p>
          <p className="font-mono text-2xl font-bold tabular-nums">{wellnessState.workoutLogs.length}</p>
          <p className="text-[11px] font-mono fabro-muted">{totalWorkoutMin} min acumulados</p>
        </div>
        <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-1">
          <p className="fabro-muted">Kilómetros Running</p>
          <p className="font-mono text-2xl font-bold tabular-nums">{totalRunKm} km</p>
          <p className="text-[11px] font-mono fabro-muted">{sportsState.runningLogs.length} salidas</p>
        </div>
        <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-1">
          <p className="fabro-muted">Kilómetros Ciclismo</p>
          <p className="font-mono text-2xl font-bold tabular-nums">{totalCycleKm} km</p>
          <p className="text-[11px] font-mono fabro-muted">{sportsState.cyclingLogs.length} recorridos</p>
        </div>
        <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-1">
          <p className="fabro-muted">Marcas personales (PRs)</p>
          <p className="font-mono text-2xl font-bold tabular-nums">{sportsState.personalRecords.length}</p>
          <p className="text-[11px] fabro-muted">Registradas por vos</p>
        </div>
      </div>

      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Líderes actuales de competición (tabla oficial)</h3>
          <select
            value={selectedStandingsLeague}
            onChange={(e) => onSelectStandingsLeague(e.target.value)}
            className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 fabro-input"
          >
            {activeLeagues
              .filter((l) => l.hasStandings)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>
        {topRows.length === 0 ? (
          <p className="fabro-muted">
            Seleccioná una liga con tabla activa. Las estadísticas individuales detalladas (goleadores/asistencias/vallas invictas) se muestran únicamente cuando la fuente pública gratuita las provee, sin inventar cifras.
          </p>
        ) : (
          <div className="divide-y fabro-border font-mono tabular-nums">
            {topRows.map((r) => (
              <div key={r.teamName} className="py-2 flex items-center justify-between gap-2">
                <span className="font-sans font-semibold">
                  {r.rank}. {r.teamName}
                </span>
                <span>
                  {r.points} pts · PJ {r.played} · GF {r.goalsFor} · GC {r.goalsAgainst} · DG {r.goalDiff}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
