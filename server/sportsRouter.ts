import { createHash } from 'crypto';
import { Router } from 'express';

export interface SportsLeagueSpec {
  id: string;
  name: string;
  shortName: string;
  country: string;
  sport: 'soccer' | 'basketball' | 'tennis' | 'racing' | 'mma' | 'golf' | 'rugby';
  disciplineLabel: string;
  espnPath: string; // e.g. "soccer/arg.1"
  hasStandings: boolean;
  region: 'argentina' | 'internacional' | 'otras-disciplinas';
}

export const CONFIGURABLE_LEAGUES: SportsLeagueSpec[] = [
  // Argentina Fútbol
  { id: 'arg.1', name: 'Liga Profesional Argentina', shortName: 'LPF Arg', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/arg.1', hasStandings: true, region: 'argentina' },
  { id: 'arg.2', name: 'Primera Nacional', shortName: 'Primera Nacional', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/arg.2', hasStandings: true, region: 'argentina' },
  { id: 'arg.3', name: 'Primera B Metropolitana', shortName: 'Primera B', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/arg.3', hasStandings: true, region: 'argentina' },
  { id: 'arg.4', name: 'Primera C Argentina', shortName: 'Primera C', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/arg.4', hasStandings: true, region: 'argentina' },
  { id: 'arg.copa', name: 'Copa Argentina', shortName: 'Copa Arg', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/arg.copa', hasStandings: false, region: 'argentina' },
  { id: 'fifa.worldq.conmebol', name: 'Eliminatorias Sudamericanas (Selección Argentina)', shortName: 'Eliminatorias', country: 'Sudamérica', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/fifa.worldq.conmebol', hasStandings: true, region: 'argentina' },

  // Fútbol Internacional
  { id: 'eng.1', name: 'Premier League', shortName: 'Premier', country: 'Inglaterra', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/eng.1', hasStandings: true, region: 'internacional' },
  { id: 'esp.1', name: 'LaLiga EA Sports', shortName: 'LaLiga', country: 'España', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/esp.1', hasStandings: true, region: 'internacional' },
  { id: 'ita.1', name: 'Serie A Italia', shortName: 'Serie A', country: 'Italia', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/ita.1', hasStandings: true, region: 'internacional' },
  { id: 'ger.1', name: 'Bundesliga', shortName: 'Bundesliga', country: 'Alemania', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/ger.1', hasStandings: true, region: 'internacional' },
  { id: 'fra.1', name: 'Ligue 1', shortName: 'Ligue 1', country: 'Francia', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/fra.1', hasStandings: true, region: 'internacional' },
  { id: 'uefa.champions', name: 'UEFA Champions League', shortName: 'Champions', country: 'Europa', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/uefa.champions', hasStandings: true, region: 'internacional' },
  { id: 'uefa.europa', name: 'UEFA Europa League', shortName: 'Europa League', country: 'Europa', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/uefa.europa', hasStandings: true, region: 'internacional' },
  { id: 'uefa.europa.conf', name: 'UEFA Conference League', shortName: 'Conference', country: 'Europa', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/uefa.europa.conf', hasStandings: true, region: 'internacional' },
  { id: 'conmebol.libertadores', name: 'Copa Libertadores', shortName: 'Libertadores', country: 'Sudamérica', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/conmebol.libertadores', hasStandings: true, region: 'internacional' },
  { id: 'conmebol.sudamericana', name: 'Copa Sudamericana', shortName: 'Sudamericana', country: 'Sudamérica', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/conmebol.sudamericana', hasStandings: true, region: 'internacional' },
  { id: 'fifa.world', name: 'Copa del Mundo FIFA', shortName: 'Mundial FIFA', country: 'Internacional', sport: 'soccer', disciplineLabel: 'Fútbol', espnPath: 'soccer/fifa.world', hasStandings: true, region: 'internacional' },

  // Otras disciplinas
  { id: 'nba', name: 'NBA Básquet', shortName: 'NBA', country: 'EE. UU. / Int.', sport: 'basketball', disciplineLabel: 'Básquet', espnPath: 'basketball/nba', hasStandings: true, region: 'otras-disciplinas' },
  { id: 'atp', name: 'ATP Tour Tenis', shortName: 'ATP', country: 'Internacional', sport: 'tennis', disciplineLabel: 'Tenis', espnPath: 'tennis/atp', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'wta', name: 'WTA Tour Tenis', shortName: 'WTA', country: 'Internacional', sport: 'tennis', disciplineLabel: 'Tenis', espnPath: 'tennis/wta', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'f1', name: 'Fórmula 1', shortName: 'F1', country: 'Internacional', sport: 'racing', disciplineLabel: 'Fórmula 1', espnPath: 'racing/f1', hasStandings: true, region: 'otras-disciplinas' },
  { id: 'ufc', name: 'UFC / Artes Marciales Mixtas', shortName: 'UFC / MMA', country: 'Internacional', sport: 'mma', disciplineLabel: 'Artes marciales', espnPath: 'mma/ufc', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'pga', name: 'PGA Tour Golf', shortName: 'PGA Golf', country: 'Internacional', sport: 'golf', disciplineLabel: 'Golf', espnPath: 'golf/pga', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'rugby.int', name: 'Rugby Internacional', shortName: 'Rugby Int.', country: 'Internacional', sport: 'rugby', disciplineLabel: 'Rugby', espnPath: 'rugby/289234', hasStandings: false, region: 'otras-disciplinas' },
];

interface RssSourceSpec {
  id: string;
  name: string;
  url: string;
  defaultCategory: string;
  language: string;
  termsNote: string;
}

const RSS_NEWS_SOURCES: RssSourceSpec[] = [
  {
    id: 'rss-ole',
    name: 'Diario Olé',
    url: 'https://www.ole.com.ar/rss/ultimas-noticias/',
    defaultCategory: 'Fútbol argentino',
    language: 'es',
    termsNote: 'Feed RSS público oficial. Solo titulares, extracto breve y enlace al artículo original.',
  },
  {
    id: 'rss-clarin',
    name: 'Clarín Deportes',
    url: 'https://www.clarin.com/rss/deportes/',
    defaultCategory: 'Fútbol argentino',
    language: 'es',
    termsNote: 'Feed RSS público oficial. Solo metadatos y redirección al medio original.',
  },
  {
    id: 'rss-infobae',
    name: 'Infobae Deportes',
    url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/deportes/',
    defaultCategory: 'Fútbol internacional',
    language: 'es',
    termsNote: 'Feed RSS público oficial de Deportes. Resumen breve + enlace directo.',
  },
  {
    id: 'rss-marca',
    name: 'Marca',
    url: 'https://e00-marca.uecdn.es/rss/portada.xml',
    defaultCategory: 'Fútbol internacional',
    language: 'es',
    termsNote: 'Feed RSS público oficial. Enlace directo a la publicación original.',
  },
  {
    id: 'rss-bbc-sport',
    name: 'BBC Sport',
    url: 'https://feeds.bbci.co.uk/sport/rss.xml',
    defaultCategory: 'Deportes olímpicos',
    language: 'en',
    termsNote: 'Feed RSS público BBC Sport. Resumen breve + enlace al medio original.',
  },
];

interface SourceHealthRecord {
  id: string;
  name: string;
  type: 'marcadores-calendarios' | 'tablas-posiciones' | 'noticias-rss' | 'fichas-perfiles';
  url: string;
  accessMethod: string;
  refreshSeconds: number;
  updateMode: 'periodico';
  status: 'ok' | 'degradado' | 'pendiente';
  lastCheckedAt: string | null;
  lastError: string | null;
  termsNote: string;
}

const sourceHealth = new Map<string, SourceHealthRecord>();

function initSourceRegistry() {
  sourceHealth.set('espn-public-json', {
    id: 'espn-public-json',
    name: 'ESPN Public Sports JSON',
    type: 'marcadores-calendarios',
    url: 'https://site.api.espn.com/apis/site/v2/sports/',
    accessMethod: 'HTTP GET JSON público ($0, sin API key)',
    refreshSeconds: 90,
    updateMode: 'periodico',
    status: 'pendiente',
    lastCheckedAt: null,
    lastError: null,
    termsNote: 'Uso informativo con caché respetuosa de 90s; actualización periódica (no transmisión en tiempo real garantizada).',
  });
  sourceHealth.set('thesportsdb-free', {
    id: 'thesportsdb-free',
    name: 'TheSportsDB Public Free API',
    type: 'fichas-perfiles',
    url: 'https://www.thesportsdb.com/api/v1/json/123/',
    accessMethod: 'HTTP GET JSON gratuito (clave pública comunitaria 123)',
    refreshSeconds: 600,
    updateMode: 'periodico',
    status: 'pendiente',
    lastCheckedAt: null,
    lastError: null,
    termsNote: 'Consultas de fichas de equipos y deportistas con caché de 10 minutos.',
  });
  for (const rss of RSS_NEWS_SOURCES) {
    sourceHealth.set(rss.id, {
      id: rss.id,
      name: rss.name,
      type: 'noticias-rss',
      url: rss.url,
      accessMethod: 'RSS XML público ($0)',
      refreshSeconds: 300,
      updateMode: 'periodico',
      status: 'pendiente',
      lastCheckedAt: null,
      lastError: null,
      termsNote: rss.termsNote,
    });
  }
}
initSourceRegistry();

function recordSourceHealth(id: string, ok: boolean, error?: string) {
  const existing = sourceHealth.get(id);
  if (!existing) return;
  existing.status = ok ? 'ok' : 'degradado';
  existing.lastCheckedAt = new Date().toISOString();
  existing.lastError = ok ? null : error || 'Error de conexión';
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: string;
  expiresAtMs: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();

async function withCache<T>(
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>
): Promise<{ data: T; fetchedAt: string; fromCache: boolean }> {
  const now = Date.now();
  const cached = memCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAtMs > now) {
    return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true };
  }
  const data = await fetcher();
  const fetchedAt = new Date().toISOString();
  memCache.set(key, {
    data,
    fetchedAt,
    expiresAtMs: now + ttlSec * 1000,
  });
  return { data, fetchedAt, fromCache: false };
}

async function fetchWithTimeout(url: string, timeoutMs = 6500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FABRO-Deportes/1.0 (+public-rss-json-reader)',
        Accept: 'application/json, application/rss+xml, application/xml, text/xml, */*',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function mapMatchStatus(statusType?: {
  state?: string;
  name?: string;
  shortDetail?: string;
  description?: string;
}): {
  code: 'programado' | 'en-vivo' | 'entretiempo' | 'finalizado' | 'suspendido' | 'postergado' | 'cancelado';
  label: string;
} {
  const name = (statusType?.name || '').toUpperCase();
  const state = (statusType?.state || '').toLowerCase();
  const desc = (statusType?.description || '').toLowerCase();

  if (name.includes('HALFTIME') || desc.includes('halftime')) {
    return { code: 'entretiempo', label: 'Entretiempo' };
  }
  if (name.includes('POSTPONED') || desc.includes('postponed')) {
    return { code: 'postergado', label: 'Postergado' };
  }
  if (name.includes('SUSPENDED') || desc.includes('suspended')) {
    return { code: 'suspendido', label: 'Suspendido' };
  }
  if (name.includes('CANCELED') || name.includes('CANCELLED') || desc.includes('cancel')) {
    return { code: 'cancelado', label: 'Cancelado' };
  }
  if (state === 'in') {
    return { code: 'en-vivo', label: 'En vivo' };
  }
  if (state === 'post') {
    return { code: 'finalizado', label: 'Finalizado' };
  }
  return { code: 'programado', label: 'Programado' };
}

interface NormalizedMatch {
  id: string;
  leagueId: string;
  leagueName: string;
  country: string;
  sport: SportsLeagueSpec['sport'];
  disciplineLabel: string;
  startDateIso: string;
  statusCode: 'programado' | 'en-vivo' | 'entretiempo' | 'finalizado' | 'suspendido' | 'postergado' | 'cancelado';
  statusLabel: string;
  clockDetail: string;
  venue?: string;
  broadcast?: string;
  homeTeam: {
    id: string;
    name: string;
    shortName: string;
    logo?: string;
    score?: string;
    winner?: boolean;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string;
    logo?: string;
    score?: string;
    winner?: boolean;
  };
  titleFallback?: string;
  sourceName: string;
  updateMode: 'periodico';
}

function normalizeEspnScoreboard(raw: Record<string, unknown>, spec: SportsLeagueSpec): NormalizedMatch[] {
  const events = Array.isArray(raw.events) ? (raw.events as Array<Record<string, unknown>>) : [];
  const out: NormalizedMatch[] = [];

  for (const ev of events) {
    const id = String(ev.id || '');
    const startDateIso = String(ev.date || '');
    const competitions = Array.isArray(ev.competitions)
      ? (ev.competitions as Array<Record<string, unknown>>)
      : [];
    const comp = competitions[0] || {};
    const statusObj = (comp.status || ev.status || {}) as Record<string, unknown>;
    const statusType = (statusObj.type || {}) as {
      state?: string;
      name?: string;
      shortDetail?: string;
      description?: string;
    };
    const mappedStatus = mapMatchStatus(statusType);
    const clockDetail = String(statusType.shortDetail || statusObj.displayClock || mappedStatus.label);

    const venueObj = (comp.venue || {}) as { fullName?: string; address?: { city?: string } };
    const venue = venueObj.fullName
      ? `${venueObj.fullName}${venueObj.address?.city ? `, ${venueObj.address.city}` : ''}`
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
      if (!c) {
        return { id: '', name: fallbackName, shortName: fallbackName };
      }
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
        shortName: String(team.shortDisplayName || team.abbreviation || team.displayName || fallbackName),
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
      statusCode: mappedStatus.code,
      statusLabel: mappedStatus.label,
      clockDetail,
      venue,
      broadcast,
      homeTeam: extractTeam(homeRaw, String(ev.shortName || ev.name || 'Evento')),
      awayTeam: extractTeam(awayRaw, competitors.length < 2 ? spec.shortName : 'Por confirmar'),
      titleFallback: String(ev.name || ''),
      sourceName: 'ESPN Public Sports JSON',
      updateMode: 'periodico',
    });
  }

  return out;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferNewsCategory(title: string, summary: string, defaultCategory: string): string {
  const hay = `${title} ${summary}`.toLowerCase();
  if (hay.includes('selección argentina') || hay.includes('scaloni') || hay.includes('messi')) return 'Selección Argentina';
  if (hay.includes('mercado de pases') || hay.includes('refuerzo') || hay.includes('fichaje') || hay.includes('rumor') || hay.includes('transfer')) return 'Mercado de pases';
  if (hay.includes('champions')) return 'Champions League';
  if (hay.includes('libertadores') || hay.includes('sudamericana')) return 'Copa Libertadores';
  if (hay.includes('fútbol femenino') || hay.includes('femenino')) return 'Fútbol femenino';
  if (hay.includes('fórmula 1') || hay.includes('formula 1') || hay.includes('colapinto') || hay.includes('verstappen')) return 'Fórmula 1';
  if (hay.includes('tc ') || hay.includes('turismo carretera') || hay.includes('motogp') || hay.includes('rally')) return 'Automovilismo';
  if (hay.includes('nba') || hay.includes('básquet') || hay.includes('basquet')) return 'Básquet';
  if (hay.includes('tenis') || hay.includes('atp') || hay.includes('wta') || hay.includes('alcaraz') || hay.includes('sinner')) return 'Tenis';
  if (hay.includes('pumas') || hay.includes('rugby')) return 'Rugby';
  if (hay.includes('boxeo') || hay.includes('ufc') || hay.includes('mma')) return 'Boxeo';
  if (hay.includes('ciclismo') || hay.includes('tour de france') || hay.includes('giro')) return 'Ciclismo';
  if (hay.includes('natación') || hay.includes('natacion')) return 'Natación';
  if (hay.includes('atletismo') || hay.includes('maratón') || hay.includes('maraton')) return 'Atletismo';
  if (hay.includes('olímpic') || hay.includes('olimpic')) return 'Deportes olímpicos';
  if (hay.includes('boca') || hay.includes('river') || hay.includes('racing') || hay.includes('independiente') || hay.includes('san lorenzo') || hay.includes('liga profesional')) return 'Fútbol argentino';
  return defaultCategory;
}

function isLikelyRumor(title: string, summary: string): boolean {
  const t = `${title} ${summary}`.toLowerCase();
  return (
    t.includes('rumor') ||
    t.includes('sondea') ||
    t.includes('podría llegar') ||
    t.includes('interesa') ||
    t.includes('en la mira') ||
    t.includes('habría') ||
    t.includes('trascendió') ||
    t.includes('posible salida')
  );
}

interface NormalizedNewsItem {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
  category: string;
  isRumor: boolean;
}

function parseRssXml(xml: string, src: RssSourceSpec): NormalizedNewsItem[] {
  const items: NormalizedNewsItem[] = [];
  const seenIds = new Set<string>();
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (const block of itemMatches.slice(0, 18)) {
    const pick = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeXmlEntities(m[1]) : '';
    };
    const title = pick('title');
    const link = pick('link');
    const description = pick('description');
    const pubDateRaw = pick('pubDate') || pick('dc:date');

    const imgMatch =
      block.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
      block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
      block.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    if (!title || !link) continue;

    const hash = createHash('sha1').update(`${src.id}:${link}`).digest('hex').slice(0, 16);
    const uniqueId = `${src.id}-${hash}`;
    if (seenIds.has(uniqueId)) continue;
    seenIds.add(uniqueId);

    let publishedAt = new Date().toISOString();
    if (pubDateRaw) {
      const parsed = Date.parse(pubDateRaw);
      if (!Number.isNaN(parsed)) publishedAt = new Date(parsed).toISOString();
    }

    const summary = description.slice(0, 260) + (description.length > 260 ? '…' : '');
    items.push({
      id: uniqueId,
      title,
      summary: summary || 'Abrir la nota en el medio original para leer la cobertura completa.',
      sourceName: src.name,
      url: link,
      publishedAt,
      imageUrl,
      category: inferNewsCategory(title, summary, src.defaultCategory),
      isRumor: isLikelyRumor(title, summary),
    });
  }

  return items;
}

export function createSportsRouter(): Router {
  const router = Router();

  // 1. Sources & configurable leagues registry
  router.get('/sources', (_req, res) => {
    res.json({
      ok: true,
      serverTimeIso: new Date().toISOString(),
      leagues: CONFIGURABLE_LEAGUES,
      sources: Array.from(sourceHealth.values()),
    });
  });

  // 2. Single league scoreboard (with optional dates=YYYYMMDD or YYYYMMDD-YYYYMMDD)
  router.get('/scoreboard', async (req, res) => {
    const leagueId = String(req.query.league || 'arg.1');
    const dates = String(req.query.dates || '').replace(/[^0-9-]/g, '');
    const spec = CONFIGURABLE_LEAGUES.find((l) => l.id === leagueId);
    if (!spec) {
      return res.status(404).json({ ok: false, error: `Competición «${leagueId}» no registrada.` });
    }

    const cacheKey = `sb:${leagueId}:${dates || 'default'}`;
    try {
      const { data, fetchedAt, fromCache } = await withCache(cacheKey, 90, async () => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${spec.espnPath}/scoreboard${
          dates ? `?dates=${dates}` : ''
        }`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as Record<string, unknown>;
        recordSourceHealth('espn-public-json', true);
        return normalizeEspnScoreboard(json, spec);
      });

      return res.json({
        ok: true,
        league: spec,
        matches: data,
        fetchedAt,
        fromCache,
        updateMode: 'periodico',
        sourceName: 'ESPN Public Sports JSON',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error consultando fuente deportiva';
      recordSourceHealth('espn-public-json', false, msg);
      return res.status(502).json({
        ok: false,
        error: `No se pudo consultar ${spec.name} en este momento (${msg}).`,
        matches: [],
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  // 3. Aggregated multi-league scoreboard (Today / Live / Upcoming)
  router.get('/multi-scoreboard', async (req, res) => {
    const rawLeagues = String(
      req.query.leagues || 'arg.1,arg.copa,eng.1,esp.1,ita.1,uefa.champions,conmebol.libertadores,nba,f1,atp'
    );
    const dates = String(req.query.dates || '').replace(/[^0-9-]/g, '');
    const ids = rawLeagues
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    const specs = ids
      .map((id) => CONFIGURABLE_LEAGUES.find((l) => l.id === id))
      .filter((s): s is SportsLeagueSpec => Boolean(s));

    const results = await Promise.all(
      specs.map(async (spec) => {
        const cacheKey = `sb:${spec.id}:${dates || 'default'}`;
        try {
          const { data } = await withCache(cacheKey, 90, async () => {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${spec.espnPath}/scoreboard${
              dates ? `?dates=${dates}` : ''
            }`;
            const resp = await fetchWithTimeout(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = (await resp.json()) as Record<string, unknown>;
            recordSourceHealth('espn-public-json', true);
            return normalizeEspnScoreboard(json, spec);
          });
          return { leagueId: spec.id, ok: true, matches: data };
        } catch (err) {
          recordSourceHealth(
            'espn-public-json',
            false,
            err instanceof Error ? err.message : 'Fetch error'
          );
          return { leagueId: spec.id, ok: false, matches: [] as NormalizedMatch[] };
        }
      })
    );

    const allMatches = results
      .flatMap((r) => r.matches)
      .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso));

    return res.json({
      ok: true,
      matches: allMatches,
      fetchedAt: new Date().toISOString(),
      updateMode: 'periodico',
      sourceName: 'ESPN Public Sports JSON',
    });
  });

  // 4. League Standings
  router.get('/standings', async (req, res) => {
    const leagueId = String(req.query.league || 'arg.1');
    const spec = CONFIGURABLE_LEAGUES.find((l) => l.id === leagueId);
    if (!spec) {
      return res.status(404).json({ ok: false, error: 'Competición no encontrada.' });
    }
    if (!spec.hasStandings) {
      return res.json({
        ok: true,
        league: spec,
        groups: [],
        fetchedAt: new Date().toISOString(),
        note: 'Esta competición es de eliminación directa o no ofrece tabla de posiciones en la fuente gratuita.',
      });
    }

    const cacheKey = `st:${leagueId}`;
    try {
      const { data, fetchedAt, fromCache } = await withCache(cacheKey, 300, async () => {
        const url = `https://site.api.espn.com/apis/v2/sports/${spec.espnPath}/standings`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as Record<string, unknown>;
        recordSourceHealth('espn-public-json', true);

        const rawChildren = Array.isArray(json.children)
          ? (json.children as Array<Record<string, unknown>>)
          : [json];

        const groups = rawChildren.map((child) => {
          const groupName = String(child.name || spec.name);
          const standingsObj = (child.standings || {}) as Record<string, unknown>;
          const entries = Array.isArray(standingsObj.entries)
            ? (standingsObj.entries as Array<Record<string, unknown>>)
            : [];

          const rows = entries.map((entry, idx) => {
            const team = (entry.team || {}) as Record<string, unknown>;
            const stats = Array.isArray(entry.stats)
              ? (entry.stats as Array<{ name?: string; abbreviation?: string; value?: number; displayValue?: string }>)
              : [];

            const getStat = (names: string[]) => {
              const found = stats.find(
                (s) =>
                  (s.name && names.includes(s.name)) ||
                  (s.abbreviation && names.includes(s.abbreviation))
              );
              return found ? found.displayValue ?? String(found.value ?? '0') : '0';
            };

            const logos = Array.isArray(team.logos) ? (team.logos as Array<{ href?: string }>) : [];
            return {
              rank: Number(getStat(['rank', 'RK'])) || idx + 1,
              teamId: String(team.id || ''),
              teamName: String(team.displayName || team.name || 'Equipo'),
              teamLogo: logos[0]?.href,
              played: getStat(['gamesPlayed', 'GP']),
              wins: getStat(['wins', 'W']),
              draws: getStat(['ties', 'D']),
              losses: getStat(['losses', 'L']),
              goalsFor: getStat(['pointsFor', 'GF', 'F']),
              goalsAgainst: getStat(['pointsAgainst', 'GA', 'A']),
              goalDiff: getStat(['pointDifferential', 'GD', 'DIFF']),
              points: getStat(['points', 'PTS', 'P']),
              note: (entry.note as { description?: string } | undefined)?.description,
            };
          });

          return { groupName, rows };
        });

        return groups.filter((g) => g.rows.length > 0);
      });

      return res.json({
        ok: true,
        league: spec,
        groups: data,
        fetchedAt,
        fromCache,
        sourceName: 'ESPN Public Sports JSON',
        updateMode: 'periodico',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error consultando tabla';
      recordSourceHealth('espn-public-json', false, msg);
      return res.status(502).json({
        ok: false,
        error: `Tabla de posiciones no disponible temporalmente para ${spec.name} (${msg}).`,
        groups: [],
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  // 5. Match Summary (events, lineups, team stats when provided by ESPN public endpoint)
  router.get('/match-summary', async (req, res) => {
    const leagueId = String(req.query.league || 'arg.1');
    const eventId = String(req.query.eventId || '').replace(/[^0-9a-zA-Z_-]/g, '');
    const spec = CONFIGURABLE_LEAGUES.find((l) => l.id === leagueId);
    if (!spec || !eventId) {
      return res.status(400).json({ ok: false, error: 'Parámetros league y eventId requeridos.' });
    }

    const cacheKey = `sum:${leagueId}:${eventId}`;
    try {
      const { data, fetchedAt, fromCache } = await withCache(cacheKey, 60, async () => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${spec.espnPath}/summary?event=${eventId}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as Record<string, unknown>;

        const keyEventsRaw = Array.isArray(json.keyEvents)
          ? (json.keyEvents as Array<Record<string, unknown>>)
          : [];
        const events = keyEventsRaw.slice(0, 30).map((ev, idx) => ({
          id: String(ev.id || idx),
          clock: String((ev.clock as { displayValue?: string } | undefined)?.displayValue || ''),
          type: String((ev.type as { text?: string } | undefined)?.text || 'Evento'),
          text: String(ev.text || ev.shortText || ''),
          teamName: String((ev.team as { displayName?: string } | undefined)?.displayName || ''),
        }));

        const boxscore = (json.boxscore || {}) as Record<string, unknown>;
        const teamsStatsRaw = Array.isArray(boxscore.teams)
          ? (boxscore.teams as Array<Record<string, unknown>>)
          : [];
        const teamStats = teamsStatsRaw.map((t) => ({
          teamName: String((t.team as { displayName?: string } | undefined)?.displayName || ''),
          stats: (Array.isArray(t.statistics) ? t.statistics : []).slice(0, 10).map((s: Record<string, unknown>) => ({
            label: String(s.label || s.name || ''),
            value: String(s.displayValue || ''),
          })),
        }));

        const rostersRaw = Array.isArray(json.rosters)
          ? (json.rosters as Array<Record<string, unknown>>)
          : [];
        const lineups = rostersRaw.map((r) => ({
          teamName: String((r.team as { displayName?: string } | undefined)?.displayName || ''),
          formation: String(r.formation || ''),
          players: (Array.isArray(r.roster) ? r.roster : [])
            .filter((p: Record<string, unknown>) => Boolean(p.starter))
            .slice(0, 15)
            .map((p: Record<string, unknown>) => ({
              name: String((p.athlete as { displayName?: string } | undefined)?.displayName || ''),
              jersey: String(p.jersey || ''),
              position: String((p.position as { abbreviation?: string } | undefined)?.abbreviation || ''),
            })),
        }));

        return { events, teamStats, lineups };
      });

      return res.json({
        ok: true,
        ...data,
        fetchedAt,
        fromCache,
        sourceName: 'ESPN Public Sports JSON',
        updateMode: 'periodico',
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: `No hay detalle extendido disponible para este encuentro (${err instanceof Error ? err.message : 'sin fuente'}).`,
        events: [],
        teamStats: [],
        lineups: [],
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  // 6. Real Sports News Aggregator (RSS públicos autorizados + deduplicación)
  router.get('/news', async (req, res) => {
    const category = String(req.query.category || 'Todas');
    const q = String(req.query.q || '').trim().toLowerCase();

    try {
      const { data: allArticles, fetchedAt, fromCache } = await withCache(
        'news:all',
        300,
        async () => {
          const settled = await Promise.all(
            RSS_NEWS_SOURCES.map(async (src) => {
              try {
                const resp = await fetchWithTimeout(src.url, 6000);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const xml = await resp.text();
                recordSourceHealth(src.id, true);
                return parseRssXml(xml, src);
              } catch (err) {
                recordSourceHealth(
                  src.id,
                  false,
                  err instanceof Error ? err.message : 'RSS fetch error'
                );
                return [] as NormalizedNewsItem[];
              }
            })
          );

          // Deduplicate by normalized title prefix
          const seen = new Set<string>();
          const merged: NormalizedNewsItem[] = [];
          for (const item of settled.flat()) {
            const key = item.title.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, '').slice(0, 48);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(item);
          }

          return merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        }
      );

      let filtered = allArticles;
      if (category && category !== 'Todas') {
        filtered = filtered.filter((a) => a.category.toLowerCase() === category.toLowerCase());
      }
      if (q) {
        filtered = filtered.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.summary.toLowerCase().includes(q) ||
            a.sourceName.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
        );
      }

      return res.json({
        ok: true,
        articles: filtered.slice(0, 60),
        totalAvailable: allArticles.length,
        fetchedAt,
        fromCache,
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Error leyendo noticias deportivas',
        articles: [],
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  // 7. Team & Athlete Profile Lookup (TheSportsDB Public Free Key 123)
  router.get('/search', async (req, res) => {
    const type = String(req.query.type || 'team');
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ ok: true, items: [], fetchedAt: new Date().toISOString() });
    }

    const cacheKey = `tsdb:${type}:${q.toLowerCase()}`;
    try {
      const { data, fetchedAt, fromCache } = await withCache(cacheKey, 600, async () => {
        const endpoint =
          type === 'player'
            ? `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(q)}`
            : `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(q)}`;
        const resp = await fetchWithTimeout(endpoint);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as Record<string, unknown>;
        recordSourceHealth('thesportsdb-free', true);

        if (type === 'player') {
          const players = Array.isArray(json.player)
            ? (json.player as Array<Record<string, unknown>>)
            : [];
          return players.slice(0, 12).map((p) => ({
            id: String(p.idPlayer || ''),
            kind: 'player' as const,
            name: String(p.strPlayer || ''),
            sport: String(p.strSport || ''),
            country: String(p.strNationality || ''),
            team: String(p.strTeam || ''),
            position: String(p.strPosition || ''),
            birthDate: String(p.dateBorn || ''),
            image: String(p.strThumb || p.strCutout || ''),
            description: String(p.strDescriptionES || p.strDescriptionEN || '').slice(0, 420),
          }));
        }

        const teams = Array.isArray(json.teams)
          ? (json.teams as Array<Record<string, unknown>>)
          : [];
        return teams.slice(0, 12).map((t) => ({
          id: String(t.idTeam || ''),
          kind: 'team' as const,
          name: String(t.strTeam || ''),
          sport: String(t.strSport || ''),
          country: String(t.strCountry || ''),
          league: String(t.strLeague || ''),
          stadium: String(t.strStadium || ''),
          formedYear: String(t.intFormedYear || ''),
          image: String(t.strBadge || t.strLogo || ''),
          description: String(t.strDescriptionES || t.strDescriptionEN || '').slice(0, 420),
        }));
      });

      return res.json({
        ok: true,
        items: data,
        fetchedAt,
        fromCache,
        sourceName: 'TheSportsDB Public Free API',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error consultando fichas';
      recordSourceHealth('thesportsdb-free', false, msg);
      return res.status(502).json({
        ok: false,
        error: `No se pudo consultar fichas en este momento (${msg}).`,
        items: [],
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  return router;
}
