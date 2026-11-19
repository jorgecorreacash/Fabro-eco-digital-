import { DEFAULT_SPORTS_STATE, SPORTS_LEAGUES_FALLBACK } from '../data/sportsCatalog';
import type {
  SportAthleteProfile,
  SportLeagueCatalogItem,
  SportMatchItem,
  SportMatchSummary,
  SportNewsArticle,
  SportSourceStatus,
  SportStandingsGroup,
  SportTeamProfile,
  SportsUserState,
} from '../types/sports';
import { vaultGet, vaultSetIdbOnly } from './localVault';

const SPORTS_VAULT_KEY = 'fabro_sports_workspace_v1';

export async function loadSportsState(): Promise<SportsUserState> {
  const saved = await vaultGet<Partial<SportsUserState> | null>(SPORTS_VAULT_KEY, null);
  if (!saved || typeof saved !== 'object') return DEFAULT_SPORTS_STATE;
  return {
    ...DEFAULT_SPORTS_STATE,
    ...saved,
    alertPrefs: {
      ...DEFAULT_SPORTS_STATE.alertPrefs,
      ...(saved.alertPrefs || {}),
      notifiedEventIds: Array.isArray(saved.alertPrefs?.notifiedEventIds)
        ? saved.alertPrefs.notifiedEventIds
        : [],
    },
    favoriteTeams: Array.isArray(saved.favoriteTeams) ? saved.favoriteTeams : [],
    favoriteLeagues: Array.isArray(saved.favoriteLeagues)
      ? saved.favoriteLeagues
      : DEFAULT_SPORTS_STATE.favoriteLeagues,
    favoriteAthletes: Array.isArray(saved.favoriteAthletes) ? saved.favoriteAthletes : [],
    favoriteDisciplines: Array.isArray(saved.favoriteDisciplines)
      ? saved.favoriteDisciplines
      : DEFAULT_SPORTS_STATE.favoriteDisciplines,
    favoriteNewsSources: Array.isArray(saved.favoriteNewsSources) ? saved.favoriteNewsSources : [],
    savedNewsArticles: Array.isArray(saved.savedNewsArticles) ? saved.savedNewsArticles : [],
    personalRecords: Array.isArray(saved.personalRecords) ? saved.personalRecords : [],
    recoveryLogs: Array.isArray(saved.recoveryLogs) ? saved.recoveryLogs : [],
    swimSeries: Array.isArray(saved.swimSeries) ? saved.swimSeries : [],
    cyclingLogs: Array.isArray(saved.cyclingLogs) ? saved.cyclingLogs : [],
    runningLogs: Array.isArray(saved.runningLogs) ? saved.runningLogs : [],
    coachGroups: Array.isArray(saved.coachGroups) ? saved.coachGroups : [],
    sportAiMessages: Array.isArray(saved.sportAiMessages) ? saved.sportAiMessages : [],
    lastCachedMatches: Array.isArray(saved.lastCachedMatches) ? saved.lastCachedMatches : [],
    lastCachedNews: Array.isArray(saved.lastCachedNews) ? saved.lastCachedNews : [],
  };
}

export async function saveSportsState(next: SportsUserState): Promise<void> {
  await vaultSetIdbOnly(SPORTS_VAULT_KEY, next);
}

// ---------------------------------------------------------------------------
// Timezone & Date Helpers (Default: America/Argentina/Buenos_Aires)
// ---------------------------------------------------------------------------
export function formatInTimeZone(
  iso: string,
  timeZone = 'America/Argentina/Buenos_Aires',
  mode: 'date' | 'time' | 'datetime' = 'datetime'
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    if (mode === 'date') {
      return new Intl.DateTimeFormat('es-AR', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    }
    if (mode === 'time') {
      return new Intl.DateTimeFormat('es-AR', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    }
    return new Intl.DateTimeFormat('es-AR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleString('es-AR');
  }
}

export function yyyymmddOffset(daysOffset: number, timeZone = 'America/Argentina/Buenos_Aires'): string {
  const d = new Date(Date.now() + daysOffset * 86400000);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value || '2026';
    const m = parts.find((p) => p.type === 'month')?.value || '01';
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    return `${y}${m}${day}`;
  } catch {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }
}

export type CalendarWindowPreset = 'hoy' | 'manana' | '7-dias' | '30-dias' | 'anteriores' | 'temporada';

export function buildDatesParam(
  preset: CalendarWindowPreset,
  timeZone = 'America/Argentina/Buenos_Aires'
): string {
  switch (preset) {
    case 'hoy':
      return yyyymmddOffset(0, timeZone);
    case 'manana':
      return yyyymmddOffset(1, timeZone);
    case '7-dias':
      return `${yyyymmddOffset(0, timeZone)}-${yyyymmddOffset(7, timeZone)}`;
    case '30-dias':
      return `${yyyymmddOffset(0, timeZone)}-${yyyymmddOffset(30, timeZone)}`;
    case 'anteriores':
      return `${yyyymmddOffset(-7, timeZone)}-${yyyymmddOffset(-1, timeZone)}`;
    case 'temporada':
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Direct Browser CORS Fallback Helpers ($0 Public JSON, access-control-allow-origin: *)
// Guarantees sports fixtures, standings, news & profiles ALWAYS load even when
// the app is served statically (Netlify / Firebase Hosting / Shared App URL).
// ---------------------------------------------------------------------------

const LEAGUE_ESPN_PATHS: Record<string, string> = {
  'arg.1': 'soccer/arg.1',
  'arg.2': 'soccer/arg.2',
  'arg.3': 'soccer/arg.3',
  'arg.4': 'soccer/arg.4',
  'arg.copa': 'soccer/arg.copa',
  'fifa.worldq.conmebol': 'soccer/fifa.worldq.conmebol',
  'eng.1': 'soccer/eng.1',
  'esp.1': 'soccer/esp.1',
  'ita.1': 'soccer/ita.1',
  'ger.1': 'soccer/ger.1',
  'fra.1': 'soccer/fra.1',
  'uefa.champions': 'soccer/uefa.champions',
  'uefa.europa': 'soccer/uefa.europa',
  'uefa.europa.conf': 'soccer/uefa.europa.conf',
  'conmebol.libertadores': 'soccer/conmebol.libertadores',
  'conmebol.sudamericana': 'soccer/conmebol.sudamericana',
  'fifa.world': 'soccer/fifa.world',
  nba: 'basketball/nba',
  atp: 'tennis/atp',
  wta: 'tennis/wta',
  f1: 'racing/f1',
  ufc: 'mma/ufc',
  pga: 'golf/pga',
  'rugby.int': 'rugby/289234',
};

async function tryLocalApiJson<T>(url: string, timeoutMs = 5500): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    return (await r.json()) as T;
  } catch {
    window.clearTimeout(timer);
    return null;
  }
}

async function fetchExternalJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    window.clearTimeout(timer);
    return null;
  }
}

function stableHashId(prefix: string, raw: string): string {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}-${Math.abs(h).toString(16)}`;
}

function mapClientEspnStatus(statusType?: {
  state?: string;
  name?: string;
  shortDetail?: string;
  description?: string;
}): { code: SportMatchItem['statusCode']; label: string } {
  const name = String(statusType?.name || '').toUpperCase();
  const state = String(statusType?.state || '').toLowerCase();
  const detail = String(statusType?.shortDetail || statusType?.description || '');
  if (name.includes('POSTPONED')) return { code: 'postergado', label: 'Postergado' };
  if (name.includes('SUSPENDED')) return { code: 'suspendido', label: 'Suspendido' };
  if (name.includes('CANCELED') || name.includes('CANCELLED')) {
    return { code: 'cancelado', label: 'Cancelado' };
  }
  if (name.includes('HALFTIME')) return { code: 'entretiempo', label: 'Entretiempo' };
  if (state === 'in') return { code: 'en-vivo', label: detail || 'En juego (periódico)' };
  if (state === 'post' || name.includes('FINAL')) return { code: 'finalizado', label: 'Finalizado' };
  return { code: 'programado', label: 'Programado' };
}

function normalizeClientEspnScoreboard(
  raw: Record<string, unknown>,
  leagueId: string
): SportMatchItem[] {
  const spec =
    SPORTS_LEAGUES_FALLBACK.find((l) => l.id === leagueId) || SPORTS_LEAGUES_FALLBACK[0];
  const events = Array.isArray(raw.events) ? (raw.events as Array<Record<string, unknown>>) : [];
  const out: SportMatchItem[] = [];

  for (const ev of events) {
    const id = String(ev.id || '');
    const startDateIso = String(ev.date || '');
    const competitions = Array.isArray(ev.competitions)
      ? (ev.competitions as Array<Record<string, unknown>>)
      : [];
    const comp = competitions[0] || {};
    const statusObj = (comp.status || ev.status || {}) as {
      displayClock?: string;
      type?: { state?: string; name?: string; shortDetail?: string; description?: string };
    };
    const mapped = mapClientEspnStatus(statusObj.type);
    const clockDetail = String(statusObj.type?.shortDetail || statusObj.displayClock || '');
    const venueObj = (comp.venue || {}) as {
      fullName?: string;
      address?: { city?: string; country?: string };
    };
    const venue = venueObj.fullName
      ? [venueObj.fullName, venueObj.address?.city].filter(Boolean).join(', ')
      : undefined;

    const broadcasts = Array.isArray(comp.broadcasts)
      ? (comp.broadcasts as Array<{ names?: string[] }>)
      : [];
    const broadcastNames = broadcasts.flatMap((b) => (Array.isArray(b.names) ? b.names : []));
    const broadcast = broadcastNames.length > 0 ? broadcastNames.slice(0, 3).join(', ') : undefined;

    const competitors = Array.isArray(comp.competitors)
      ? (comp.competitors as Array<Record<string, unknown>>)
      : [];
    const homeRaw = competitors.find((c) => c.homeAway === 'home') || competitors[0];
    const awayRaw = competitors.find((c) => c.homeAway === 'away') || competitors[1];

    const extractTeam = (c?: Record<string, unknown>, fallbackName = 'Por confirmar') => {
      if (!c) return { id: '', name: fallbackName, shortName: fallbackName };
      const team = (c.team || c.athlete || {}) as Record<string, unknown>;
      const logo =
        typeof team.logo === 'string'
          ? team.logo
          : Array.isArray(team.logos) && team.logos[0]
          ? String((team.logos[0] as { href?: string }).href || '')
          : undefined;
      return {
        id: String(team.id || c.id || ''),
        name: String(team.displayName || team.name || fallbackName),
        shortName: String(
          team.shortDisplayName || team.abbreviation || team.displayName || fallbackName
        ),
        logo: logo || undefined,
        score: c.score !== undefined && c.score !== null ? String(c.score) : undefined,
        winner: Boolean(c.winner),
      };
    };

    out.push({
      id,
      leagueId: spec.id,
      leagueName: spec.name,
      country: spec.country,
      sport: spec.sport,
      disciplineLabel: spec.disciplineLabel,
      startDateIso,
      statusCode: mapped.code,
      statusLabel: mapped.label,
      clockDetail,
      venue,
      broadcast,
      homeTeam: extractTeam(homeRaw, String(ev.shortName || ev.name || 'Evento')),
      awayTeam: extractTeam(awayRaw, competitors.length < 2 ? spec.shortName : 'Por confirmar'),
      titleFallback: String(ev.name || ''),
      sourceName: 'ESPN Public Sports JSON (directo)',
      updateMode: 'periodico',
    });
  }
  return out;
}

async function fetchDirectEspnScoreboard(
  leagueId: string,
  dates = ''
): Promise<SportMatchItem[]> {
  const path = LEAGUE_ESPN_PATHS[leagueId];
  if (!path) return [];
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard${
    dates ? `?dates=${encodeURIComponent(dates)}` : ''
  }`;
  const raw = await fetchExternalJson<Record<string, unknown>>(url);
  if (!raw) return [];
  return normalizeClientEspnScoreboard(raw, leagueId);
}

function inferClientNewsCategory(title: string, summary: string, fallback: string): string {
  const hay = `${title} ${summary}`.toLowerCase();
  if (hay.includes('selección argentina') || hay.includes('scaloni') || hay.includes('messi')) {
    return 'Selección Argentina';
  }
  if (hay.includes('mercado de pases') || hay.includes('refuerzo') || hay.includes('fichaje')) {
    return 'Mercado de pases';
  }
  if (hay.includes('champions')) return 'Champions League';
  if (hay.includes('libertadores') || hay.includes('sudamericana')) return 'Copa Libertadores';
  if (hay.includes('fórmula 1') || hay.includes('formula 1') || hay.includes('colapinto')) {
    return 'Fórmula 1';
  }
  if (hay.includes('nba') || hay.includes('básquet')) return 'Básquet';
  if (hay.includes('tenis') || hay.includes('atp') || hay.includes('wta')) return 'Tenis';
  if (hay.includes('rugby') || hay.includes('pumas')) return 'Rugby';
  if (hay.includes('boxeo') || hay.includes('ufc') || hay.includes('mma')) return 'Boxeo';
  if (hay.includes('boca') || hay.includes('river') || hay.includes('racing') || hay.includes('liga profesional')) {
    return 'Fútbol argentino';
  }
  return fallback;
}

function isLikelyClientRumor(title: string, summary: string): boolean {
  const t = `${title} ${summary}`.toLowerCase();
  return (
    t.includes('rumor') ||
    t.includes('sondea') ||
    t.includes('podría llegar') ||
    t.includes('en la mira') ||
    t.includes('trascendió') ||
    t.includes('posible salida')
  );
}

async function fetchDirectPublicNews(): Promise<SportNewsArticle[]> {
  const espnFeeds = [
    {
      url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/news?lang=es&region=ar',
      source: 'ESPN Argentina',
      category: 'Fútbol argentino',
    },
    {
      url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/news?lang=es&region=ar',
      source: 'ESPN Fútbol Internacional',
      category: 'Champions League',
    },
    {
      url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?lang=es&region=ar',
      source: 'ESPN NBA',
      category: 'Básquet',
    },
    {
      url: 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/news?lang=es&region=ar',
      source: 'ESPN Fórmula 1',
      category: 'Fórmula 1',
    },
    {
      url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/news?lang=es&region=ar',
      source: 'ESPN Tenis',
      category: 'Tenis',
    },
  ];

  const rss2JsonFeeds = [
    {
      url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.ole.com.ar%2Frss%2Fultimas-noticias%2F',
      source: 'Diario Olé',
      category: 'Fútbol argentino',
    },
    {
      url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.infobae.com%2Farc%2Foutboundfeeds%2Frss%2Fcategory%2Fdeportes%2F',
      source: 'Infobae Deportes',
      category: 'Fútbol argentino',
    },
  ];

  const [espnResults, rssResults] = await Promise.all([
    Promise.all(
      espnFeeds.map(async (f) => {
        const json = await fetchExternalJson<{
          articles?: Array<{
            id?: string | number;
            headline?: string;
            description?: string;
            published?: string;
            links?: { web?: { href?: string } };
            images?: Array<{ url?: string }>;
          }>;
        }>(f.url);
        const list = Array.isArray(json?.articles) ? json.articles : [];
        return list
          .map((a): SportNewsArticle | null => {
            const title = String(a.headline || '').trim();
            const link = String(a.links?.web?.href || '').trim();
            if (!title || !link) return null;
            const summary = String(a.description || '').trim();
            return {
              id: stableHashId('espn-ar', `${f.source}:${a.id || link}`),
              title,
              summary:
                summary || 'Abrir la cobertura completa en el portal deportivo original.',
              sourceName: f.source,
              url: link,
              publishedAt: a.published || new Date().toISOString(),
              imageUrl: a.images?.[0]?.url,
              category: inferClientNewsCategory(title, summary, f.category),
              isRumor: isLikelyClientRumor(title, summary),
            };
          })
          .filter((x): x is SportNewsArticle => Boolean(x));
      })
    ),
    Promise.all(
      rss2JsonFeeds.map(async (f) => {
        const json = await fetchExternalJson<{
          status?: string;
          items?: Array<{
            title?: string;
            link?: string;
            pubDate?: string;
            description?: string;
            thumbnail?: string;
            enclosure?: { link?: string };
          }>;
        }>(f.url);
        if (json?.status !== 'ok' || !Array.isArray(json.items)) return [];
        return json.items
          .map((it): SportNewsArticle | null => {
            const title = String(it.title || '').trim();
            const link = String(it.link || '').trim();
            if (!title || !link) return null;
            const cleanDesc = String(it.description || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 240);
            const parsedDate = it.pubDate ? Date.parse(it.pubDate.replace(' ', 'T') + 'Z') : NaN;
            return {
              id: stableHashId('rss-pub', `${f.source}:${link}`),
              title,
              summary: cleanDesc || 'Leer nota completa en el medio original.',
              sourceName: f.source,
              url: link,
              publishedAt: Number.isNaN(parsedDate)
                ? new Date().toISOString()
                : new Date(parsedDate).toISOString(),
              imageUrl: it.thumbnail || it.enclosure?.link || undefined,
              category: inferClientNewsCategory(title, cleanDesc, f.category),
              isRumor: isLikelyClientRumor(title, cleanDesc),
            };
          })
          .filter((x): x is SportNewsArticle => Boolean(x));
      })
    ),
  ]);

  const seenUrls = new Set<string>();
  const combined: SportNewsArticle[] = [];
  for (const art of [...rssResults.flat(), ...espnResults.flat()]) {
    if (seenUrls.has(art.url)) continue;
    seenUrls.add(art.url);
    combined.push(art);
  }
  combined.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return combined.slice(0, 60);
}

// ---------------------------------------------------------------------------
// API Clients to /api/sports/* with automatic $0 Direct CORS Fallback
// ---------------------------------------------------------------------------
export async function fetchSportsSources(): Promise<{
  ok: boolean;
  leagues: SportLeagueCatalogItem[];
  sources: SportSourceStatus[];
  serverTimeIso?: string;
}> {
  const local = await tryLocalApiJson<{
    ok: boolean;
    leagues: SportLeagueCatalogItem[];
    sources: SportSourceStatus[];
    serverTimeIso?: string;
  }>('/api/sports/sources');

  if (local?.ok) return local;

  const now = new Date().toISOString();
  return {
    ok: true,
    leagues: SPORTS_LEAGUES_FALLBACK,
    serverTimeIso: now,
    sources: [
      {
        id: 'espn-public-json',
        name: 'ESPN Public Sports JSON (Conexión directa)',
        type: 'marcadores-calendarios',
        url: 'https://site.api.espn.com',
        accessMethod: 'JSON público CORS (sin clave API)',
        refreshSeconds: 120,
        updateMode: 'periodico',
        status: 'ok',
        lastCheckedAt: now,
        lastError: null,
        termsNote: 'Endpoint público gratuito CORS sin clave API. Actualización periódica.',
      },
      {
        id: 'espn-ar-news',
        name: 'ESPN Argentina / Internacional Noticias JSON',
        type: 'noticias-rss',
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/news',
        accessMethod: 'JSON público CORS en español',
        refreshSeconds: 300,
        updateMode: 'periodico',
        status: 'ok',
        lastCheckedAt: now,
        lastError: null,
        termsNote: 'Noticias deportivas públicas en español sin facturación.',
      },
      {
        id: 'rss-ole-infobae',
        name: 'Diario Olé / Infobae Deportes (RSS)',
        type: 'noticias-rss',
        url: 'https://www.ole.com.ar/rss/ultimas-noticias/',
        accessMethod: 'RSS público',
        refreshSeconds: 300,
        updateMode: 'periodico',
        status: 'ok',
        lastCheckedAt: now,
        lastError: null,
        termsNote: 'Feeds RSS públicos con enlace al medio original.',
      },
      {
        id: 'thesportsdb-free',
        name: 'TheSportsDB Public Free API',
        type: 'fichas-perfiles',
        url: 'https://www.thesportsdb.com/api/v1/json/123/',
        accessMethod: 'API pública gratuita CORS',
        refreshSeconds: 600,
        updateMode: 'periodico',
        status: 'ok',
        lastCheckedAt: now,
        lastError: null,
        termsNote: 'Perfiles gratuitos de clubes y deportistas.',
      },
    ],
  };
}

export async function fetchLeagueScoreboard(
  leagueId: string,
  dates = ''
): Promise<{
  ok: boolean;
  matches: SportMatchItem[];
  fetchedAt: string;
  fromCache?: boolean;
  error?: string;
}> {
  const q = new URLSearchParams({ league: leagueId });
  if (dates) q.set('dates', dates);
  const local = await tryLocalApiJson<{
    ok: boolean;
    matches?: SportMatchItem[];
    fetchedAt?: string;
    fromCache?: boolean;
    error?: string;
  }>(`/api/sports/scoreboard?${q.toString()}`);

  if (local?.ok && Array.isArray(local.matches)) {
    return {
      ok: true,
      matches: local.matches,
      fetchedAt: local.fetchedAt || new Date().toISOString(),
      fromCache: local.fromCache,
    };
  }

  // Direct CORS fallback to ESPN Public JSON
  const direct = await fetchDirectEspnScoreboard(leagueId, dates);
  if (direct.length > 0 || LEAGUE_ESPN_PATHS[leagueId]) {
    return {
      ok: true,
      matches: direct,
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    ok: false,
    matches: [],
    fetchedAt: new Date().toISOString(),
    error: 'Sin conexión con las fuentes deportivas. Mostrando caché local si existe.',
  };
}

export async function fetchMultiScoreboard(
  leagues: string[],
  dates = ''
): Promise<{
  ok: boolean;
  matches: SportMatchItem[];
  fetchedAt: string;
  error?: string;
}> {
  const q = new URLSearchParams({ leagues: leagues.join(',') });
  if (dates) q.set('dates', dates);
  const local = await tryLocalApiJson<{
    ok: boolean;
    matches?: SportMatchItem[];
    fetchedAt?: string;
    error?: string;
  }>(`/api/sports/multi-scoreboard?${q.toString()}`, 9000);

  if (local?.ok && Array.isArray(local.matches) && local.matches.length > 0) {
    return {
      ok: true,
      matches: local.matches,
      fetchedAt: local.fetchedAt || new Date().toISOString(),
    };
  }

  // Direct CORS fallback: query ESPN Public JSON directly from browser
  const batches = await Promise.all(
    leagues.slice(0, 10).map((lid) => fetchDirectEspnScoreboard(lid, dates))
  );
  const merged = batches
    .flat()
    .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso));

  if (merged.length > 0) {
    return {
      ok: true,
      matches: merged,
      fetchedAt: new Date().toISOString(),
    };
  }

  // If narrow dates range yielded 0 events, retry without date restriction to get current round
  if (dates) {
    const fallbackBatches = await Promise.all(
      leagues.slice(0, 8).map((lid) => fetchDirectEspnScoreboard(lid, ''))
    );
    const roundMatches = fallbackBatches
      .flat()
      .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso));
    if (roundMatches.length > 0) {
      return {
        ok: true,
        matches: roundMatches,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  return {
    ok: false,
    matches: [],
    fetchedAt: new Date().toISOString(),
    error: 'No se pudo actualizar el calendario deportivo (modo offline o red no disponible).',
  };
}

export async function fetchLeagueStandings(leagueId: string): Promise<{
  ok: boolean;
  groups: SportStandingsGroup[];
  fetchedAt: string;
  note?: string;
  error?: string;
}> {
  const local = await tryLocalApiJson<{
    ok: boolean;
    groups?: SportStandingsGroup[];
    fetchedAt?: string;
    note?: string;
    error?: string;
  }>(`/api/sports/standings?league=${encodeURIComponent(leagueId)}`);

  if (local?.ok) {
    return {
      ok: true,
      groups: Array.isArray(local.groups) ? local.groups : [],
      fetchedAt: local.fetchedAt || new Date().toISOString(),
      note: local.note,
    };
  }

  const spec = SPORTS_LEAGUES_FALLBACK.find((l) => l.id === leagueId);
  const path = LEAGUE_ESPN_PATHS[leagueId];
  if (!spec?.hasStandings || !path) {
    return {
      ok: true,
      groups: [],
      fetchedAt: new Date().toISOString(),
      note: 'Esta competición es de eliminación directa o no ofrece tabla en la fuente gratuita.',
    };
  }

  const json = await fetchExternalJson<Record<string, unknown>>(
    `https://site.api.espn.com/apis/v2/sports/${path}/standings`
  );
  if (!json) {
    return {
      ok: false,
      groups: [],
      fetchedAt: new Date().toISOString(),
      error: 'No se pudo cargar la tabla de posiciones en este momento.',
    };
  }

  const rawChildren = Array.isArray(json.children)
    ? (json.children as Array<Record<string, unknown>>)
    : [json];

  const groups: SportStandingsGroup[] = rawChildren
    .map((child) => {
      const groupName = String(child.name || spec.name);
      const standingsObj = (child.standings || {}) as Record<string, unknown>;
      const entries = Array.isArray(standingsObj.entries)
        ? (standingsObj.entries as Array<Record<string, unknown>>)
        : [];
      const rows = entries.map((entry, idx) => {
        const team = (entry.team || {}) as Record<string, unknown>;
        const stats = Array.isArray(entry.stats)
          ? (entry.stats as Array<{ name?: string; abbreviation?: string; displayValue?: string }>)
          : [];
        const pick = (...names: string[]) => {
          const found = stats.find(
            (s) =>
              names.includes(String(s.name || '').toLowerCase()) ||
              names.includes(String(s.abbreviation || '').toLowerCase())
          );
          return found?.displayValue ?? '—';
        };
        const logos = Array.isArray(team.logos) ? (team.logos as Array<{ href?: string }>) : [];
        return {
          rank: Number(pick('rank', 'rk')) || idx + 1,
          teamId: String(team.id || ''),
          teamName: String(team.displayName || team.name || 'Equipo'),
          logo: logos[0]?.href,
          played: pick('gamesplayed', 'gp'),
          wins: pick('wins', 'w'),
          draws: pick('ties', 'd'),
          losses: pick('losses', 'l'),
          goalsFor: pick('pointsfor', 'gf', 'f'),
          goalsAgainst: pick('pointsagainst', 'ga', 'a'),
          goalDiff: pick('pointdifferential', 'gd', 'diff'),
          points: pick('points', 'pts', 'p', 'winpercent'),
          note: (entry.note as { description?: string } | undefined)?.description,
        };
      });
      return { groupName, rows };
    })
    .filter((g) => g.rows.length > 0);

  return {
    ok: true,
    groups,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchMatchSummary(
  leagueId: string,
  eventId: string
): Promise<{ ok: boolean; summary?: SportMatchSummary; error?: string }> {
  const local = await tryLocalApiJson<SportMatchSummary & { ok: boolean; error?: string }>(
    `/api/sports/match-summary?league=${encodeURIComponent(leagueId)}&eventId=${encodeURIComponent(eventId)}`
  );
  if (local?.ok) return { ok: true, summary: local };

  const path = LEAGUE_ESPN_PATHS[leagueId];
  if (!path) return { ok: false, error: 'Sin detalle extendido disponible.' };
  const raw = await fetchExternalJson<Record<string, unknown>>(
    `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(eventId)}`
  );
  if (!raw) return { ok: false, error: 'Error consultando detalle del encuentro.' };

  const box = (raw.boxscore || {}) as {
    teams?: Array<{
      team?: { displayName?: string };
      statistics?: Array<{ label?: string; displayValue?: string }>;
    }>;
  };
  const rosters = Array.isArray(raw.rosters)
    ? (raw.rosters as Array<{
        team?: { displayName?: string };
        formation?: string;
        roster?: Array<{
          athlete?: { displayName?: string };
          jersey?: string;
          position?: { abbreviation?: string; name?: string };
        }>;
      }>)
    : [];
  const keyEvs = Array.isArray(raw.keyEvents)
    ? (raw.keyEvents as Array<{
        id?: string;
        clock?: { displayValue?: string };
        type?: { text?: string };
        text?: string;
        team?: { displayName?: string };
      }>)
    : [];

  return {
    ok: true,
    summary: {
      events: keyEvs.slice(0, 20).map((e, idx) => ({
        id: String(e.id || `ev-${idx}`),
        clock: String(e.clock?.displayValue || ''),
        type: String(e.type?.text || 'Incidencia'),
        text: String(e.text || ''),
        teamName: String(e.team?.displayName || ''),
      })),
      teamStats: (box.teams || []).map((t) => ({
        teamName: t.team?.displayName || 'Equipo',
        stats: (t.statistics || []).slice(0, 10).map((s) => ({
          label: s.label || '',
          value: s.displayValue || '—',
        })),
      })),
      lineups: rosters.map((r) => ({
        teamName: r.team?.displayName || 'Equipo',
        formation: r.formation || '',
        players: (r.roster || []).slice(0, 18).map((p) => ({
          name: p.athlete?.displayName || 'Jugador',
          jersey: p.jersey || '',
          position: p.position?.abbreviation || p.position?.name || '',
        })),
      })),
      fetchedAt: new Date().toISOString(),
      sourceName: 'ESPN Public Sports JSON (directo)',
    },
  };
}

export async function fetchSportsNews(
  category = 'Todas',
  q = ''
): Promise<{
  ok: boolean;
  articles: SportNewsArticle[];
  fetchedAt: string;
  error?: string;
}> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (q.trim()) params.set('q', q.trim());
  const local = await tryLocalApiJson<{
    ok: boolean;
    articles?: SportNewsArticle[];
    fetchedAt?: string;
    error?: string;
  }>(`/api/sports/news?${params.toString()}`, 8000);

  if (local?.ok && Array.isArray(local.articles) && local.articles.length > 0) {
    return {
      ok: true,
      articles: local.articles,
      fetchedAt: local.fetchedAt || new Date().toISOString(),
    };
  }

  // Direct CORS fallback: ESPN Argentina/ES JSON News + RSS2JSON Olé/Infobae
  let directArticles = await fetchDirectPublicNews();
  if (category && category !== 'Todas') {
    const catLower = category.toLowerCase();
    directArticles = directArticles.filter((a) => a.category.toLowerCase() === catLower);
  }
  if (q.trim()) {
    const ql = q.trim().toLowerCase();
    directArticles = directArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(ql) ||
        a.summary.toLowerCase().includes(ql) ||
        a.sourceName.toLowerCase().includes(ql)
    );
  }

  if (directArticles.length > 0) {
    return {
      ok: true,
      articles: directArticles,
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    ok: false,
    articles: [],
    fetchedAt: new Date().toISOString(),
    error: 'Sin conexión a las fuentes deportivas de noticias.',
  };
}

export async function searchSportsProfiles(
  type: 'team' | 'player',
  q: string
): Promise<{
  ok: boolean;
  items: Array<SportTeamProfile | SportAthleteProfile>;
  fetchedAt: string;
  error?: string;
}> {
  const cleanQ = q.trim();
  if (!cleanQ) {
    return { ok: true, items: [], fetchedAt: new Date().toISOString() };
  }

  const local = await tryLocalApiJson<{
    ok: boolean;
    items?: Array<SportTeamProfile | SportAthleteProfile>;
    fetchedAt?: string;
    error?: string;
  }>(`/api/sports/search?type=${type}&q=${encodeURIComponent(cleanQ)}`);

  if (local?.ok && Array.isArray(local.items)) {
    return {
      ok: true,
      items: local.items,
      fetchedAt: local.fetchedAt || new Date().toISOString(),
    };
  }

  // Direct CORS fallback to TheSportsDB Public Free API (key 123)
  const endpoint =
    type === 'player'
      ? `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(cleanQ)}`
      : `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(cleanQ)}`;

  const raw = await fetchExternalJson<Record<string, unknown>>(endpoint);
  if (!raw) {
    return {
      ok: false,
      items: [],
      fetchedAt: new Date().toISOString(),
      error: 'Error consultando perfiles en TheSportsDB.',
    };
  }

  if (type === 'player') {
    const players = Array.isArray(raw.player) ? (raw.player as Array<Record<string, unknown>>) : [];
    const items: SportAthleteProfile[] = players.slice(0, 12).map((p) => ({
      id: String(p.idPlayer || ''),
      kind: 'player',
      name: String(p.strPlayer || ''),
      sport: String(p.strSport || ''),
      country: String(p.strNationality || ''),
      team: String(p.strTeam || ''),
      position: String(p.strPosition || ''),
      birthDate: String(p.dateBorn || ''),
      image: String(p.strCutout || p.strThumb || ''),
      description: String(p.strDescriptionES || p.strDescriptionEN || '').slice(0, 420),
    }));
    return { ok: true, items, fetchedAt: new Date().toISOString() };
  }

  const teams = Array.isArray(raw.teams) ? (raw.teams as Array<Record<string, unknown>>) : [];
  const items: SportTeamProfile[] = teams.slice(0, 12).map((t) => ({
    id: String(t.idTeam || ''),
    kind: 'team',
    name: String(t.strTeam || ''),
    sport: String(t.strSport || ''),
    country: String(t.strCountry || ''),
    league: String(t.strLeague || ''),
    stadium: String(t.strStadium || ''),
    formedYear: String(t.intFormedYear || ''),
    image: String(t.strBadge || ''),
    description: String(t.strDescriptionES || t.strDescriptionEN || '').slice(0, 420),
  }));
  return { ok: true, items, fetchedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Verified Sports Performance Calculators (100% offline, explicit formulas)
// ---------------------------------------------------------------------------
export function formatSecondsToMinSec(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.round(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function calculateRunningMetrics(distanceKm: number, totalMinutes: number): {
  paceSecPerKm: number;
  paceLabel: string;
  speedKmh: number;
  projections: Array<{ label: string; time: string }>;
} | null {
  if (distanceKm <= 0 || totalMinutes <= 0) return null;
  const totalSec = totalMinutes * 60;
  const paceSecPerKm = totalSec / distanceKm;
  const speedKmh = Number((distanceKm / (totalMinutes / 60)).toFixed(2));
  const projections = [
    { label: '5 km', dist: 5 },
    { label: '10 km', dist: 10 },
    { label: '21.1 km', dist: 21.0975 },
    { label: '42.2 km', dist: 42.195 },
  ].map((p) => ({
    label: p.label,
    time: formatSecondsToMinSec(paceSecPerKm * p.dist),
  }));
  return {
    paceSecPerKm,
    paceLabel: `${formatSecondsToMinSec(paceSecPerKm)} /km`,
    speedKmh,
    projections,
  };
}

export function calculateHeartRateZones(age: number, restingHr?: number): {
  fcMaxEstimated: number;
  formulaUsed: string;
  zones: Array<{ zone: string; name: string; minBpm: number; maxBpm: number; purpose: string }>;
} | null {
  if (age < 12 || age > 95) return null;
  const fcMax = Math.round(208 - 0.7 * age); // Fórmula Tanaka (2001)
  const useKarvonen = typeof restingHr === 'number' && restingHr >= 35 && restingHr <= 110;
  const calc = (pct: number) =>
    useKarvonen
      ? Math.round(restingHr + (fcMax - restingHr) * pct)
      : Math.round(fcMax * pct);

  return {
    fcMaxEstimated: fcMax,
    formulaUsed: useKarvonen
      ? `Tanaka (FCmáx = 208 − 0.7 × edad = ${fcMax}) + Reserva de Karvonen (FC reposo ${restingHr} lpm)`
      : `Tanaka orientativa (FCmáx = 208 − 0.7 × edad = ${fcMax})`,
    zones: [
      { zone: 'Z1', name: 'Recuperación', minBpm: calc(0.5), maxBpm: calc(0.6), purpose: 'Regenerativo y calentamiento suave' },
      { zone: 'Z2', name: 'Base aeróbica', minBpm: calc(0.6), maxBpm: calc(0.7), purpose: 'Resistencia fundamental, ritmo conversacional' },
      { zone: 'Z3', name: 'Tempo / Aeróbico medio', minBpm: calc(0.7), maxBpm: calc(0.8), purpose: 'Ritmo sostenido moderado-alto' },
      { zone: 'Z4', name: 'Umbral anaeróbico', minBpm: calc(0.8), maxBpm: calc(0.9), purpose: 'Series exigentes de rendimiento' },
      { zone: 'Z5', name: 'Potencia máxima', minBpm: calc(0.9), maxBpm: fcMax, purpose: 'Intervalos breves de alta intensidad' },
    ],
  };
}

export function calculateBodyFatUsNavy(params: {
  sex: 'masculino' | 'femenino';
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipCm?: number;
}): { bodyFatPct: number; formula: string } | null {
  const { sex, heightCm, neckCm, waistCm, hipCm } = params;
  if (heightCm < 120 || neckCm < 20 || waistCm <= neckCm) return null;
  if (sex === 'masculino') {
    const val =
      495 /
        (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) -
      450;
    if (!Number.isFinite(val) || val < 2 || val > 65) return null;
    return {
      bodyFatPct: Number(val.toFixed(1)),
      formula: 'Fórmula circunferencial US Navy (estimación indirecta, margen ±3–5%)',
    };
  }
  if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
  const val =
    495 /
      (1.29579 -
        0.35004 * Math.log10(waistCm + hipCm - neckCm) +
        0.221 * Math.log10(heightCm)) -
    450;
  if (!Number.isFinite(val) || val < 5 || val > 68) return null;
  return {
    bodyFatPct: Number(val.toFixed(1)),
    formula: 'Fórmula circunferencial US Navy femenina (estimación indirecta, margen ±3–5%)',
  };
}

export function calculateMetEnergyKcal(met: number, weightKg: number, minutes: number): number {
  if (met <= 0 || weightKg <= 0 || minutes <= 0) return 0;
  return Math.round(met * weightKg * (minutes / 60));
}

export function suggestStrengthRestSeconds(goal: 'fuerza' | 'hipertrofia' | 'resistencia'): {
  rangeSec: string;
  recommendedSec: number;
  rationale: string;
} {
  if (goal === 'fuerza') {
    return {
      rangeSec: '150 a 240 seg (2:30–4:00 min)',
      recommendedSec: 180,
      rationale: 'Permite recuperar fosfocreatina y sistema nervioso central para cargas altas (1–5 reps).',
    };
  }
  if (goal === 'hipertrofia') {
    return {
      rangeSec: '60 a 120 seg (1:00–2:00 min)',
      recommendedSec: 90,
      rationale: 'Equilibrio entre tensión mecánica y recuperación suficiente para series de 6–12 reps.',
    };
  }
  return {
    rangeSec: '30 a 60 seg',
    recommendedSec: 45,
    rationale: 'Mantiene estímulo metabólico y tolerancia a la fatiga en bloques de 15+ reps o circuitos.',
  };
}

// ---------------------------------------------------------------------------
// FABRO SPORT AI — Honest Real-Data Query Engine (Zero Fabrication)
// ---------------------------------------------------------------------------
export function buildLocalSportAiReply(params: {
  question: string;
  matches: SportMatchItem[];
  news: SportNewsArticle[];
  timeZone: string;
  lastSyncAt?: string;
}): string {
  const { question, matches, news, timeZone, lastSyncAt } = params;
  const q = question.toLowerCase();
  const blocks: string[] = [];

  // 1. Check for team/match queries in real loaded fixtures
  const keywords = q
    .replace(/[¿?¡!.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['que', 'hoy', 'hora', 'juega', 'cuando', 'como', 'esta', 'partidos', 'hay', 'manana', 'sobre', 'noticias', 'para'].includes(w));

  const matchedFixtures =
    keywords.length > 0
      ? matches.filter((m) => {
          const hay = `${m.homeTeam.name} ${m.awayTeam.name} ${m.leagueName} ${m.disciplineLabel}`.toLowerCase();
          return keywords.some((k) => hay.includes(k));
        })
      : matches.slice(0, 8);

  if (q.includes('ritmo') || q.includes('pace') || q.includes('resistencia') || q.includes('rutina')) {
    blocks.push(
      '[Estimación y orientación de entrenamiento]\n• Para calcular tu ritmo de carrera: dividí el tiempo total en minutos por la distancia en kilómetros (ej. 50 min ÷ 10 km = 5:00 min/km). Podés usar la calculadora exacta en «14. Herramientas deportivas».\n• Para mejorar resistencia aeróbica: combiná 2 rodajes suaves en Zona 2 (ritmo conversacional) con 1 sesión semanal de cambios de ritmo controlados y 1 sesión de fuerza preventiva.'
    );
  }

  if (matchedFixtures.length > 0) {
    const lines = matchedFixtures.slice(0, 6).map((m) => {
      const dt = formatInTimeZone(m.startDateIso, timeZone, 'datetime');
      const score =
        m.statusCode === 'programado'
          ? 'Programado'
          : `${m.homeTeam.score ?? '-'}–${m.awayTeam.score ?? '-'} (${m.statusLabel})`;
      return `• [${m.leagueName}] ${m.homeTeam.name} vs ${m.awayTeam.name} — ${dt} (${timeZone}) · ${score}`;
    });
    blocks.push(
      `[Datos oficiales / fuente pública: ESPN Public Sports JSON · actualización periódica${
        lastSyncAt ? ` · ${formatInTimeZone(lastSyncAt, timeZone, 'time')}` : ''
      }]\n${lines.join('\n')}`
    );
  } else if (q.includes('juega') || q.includes('partido') || q.includes('hora') || q.includes('champions') || q.includes('boca') || q.includes('river') || q.includes('seleccion')) {
    blocks.push(
      `[Datos de calendario consultados]\nNo aparecen partidos coincidentes en los ${matches.length} encuentros cargados para esta ventana de fechas. Probá ampliar el rango a «Próximos 30 días» o seleccionar la liga específica en «5. Calendario» para consultar directamente la fuente sin inventar horarios.`
    );
  }

  const matchedNews =
    keywords.length > 0
      ? news.filter((n) => {
          const hay = `${n.title} ${n.summary} ${n.category}`.toLowerCase();
          return keywords.some((k) => hay.includes(k));
        })
      : news.slice(0, 4);

  if (matchedNews.length > 0) {
    const nLines = matchedNews.slice(0, 4).map((n) => {
      const tag = n.isRumor ? ' [Rumor / versión periodística]' : '';
      return `• ${n.title}${tag} — ${n.sourceName} (${formatInTimeZone(n.publishedAt, timeZone, 'datetime')})`;
    });
    blocks.push(`[Medios periodísticos · RSS públicos]\n${nLines.join('\n')}`);
  }

  if (blocks.length === 0) {
    blocks.push(
      '[Análisis local]\nNo encontré datos cargados que respondan exactamente esa consulta sin especular. Actualizá las fuentes en «1. Inicio deportivo» o «11. Noticias», o conectá tu clave propia en IA BYOK para análisis más profundos sobre los datos verificados.'
    );
  }

  return blocks.join('\n\n');
}
