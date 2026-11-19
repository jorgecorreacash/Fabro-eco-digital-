import { DEFAULT_SPORTS_STATE } from '../data/sportsCatalog';
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
// API Clients to /api/sports/* ($0 backend gateway)
// ---------------------------------------------------------------------------
export async function fetchSportsSources(): Promise<{
  ok: boolean;
  leagues: SportLeagueCatalogItem[];
  sources: SportSourceStatus[];
  serverTimeIso?: string;
}> {
  try {
    const r = await fetch('/api/sports/sources');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as {
      ok: boolean;
      leagues: SportLeagueCatalogItem[];
      sources: SportSourceStatus[];
      serverTimeIso?: string;
    };
  } catch {
    return { ok: false, leagues: [], sources: [] };
  }
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
  try {
    const q = new URLSearchParams({ league: leagueId });
    if (dates) q.set('dates', dates);
    const r = await fetch(`/api/sports/scoreboard?${q.toString()}`);
    const data = (await r.json()) as {
      ok: boolean;
      matches?: SportMatchItem[];
      fetchedAt?: string;
      fromCache?: boolean;
      error?: string;
    };
    return {
      ok: Boolean(data.ok),
      matches: Array.isArray(data.matches) ? data.matches : [],
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      fromCache: data.fromCache,
      error: data.error,
    };
  } catch {
    return {
      ok: false,
      matches: [],
      fetchedAt: new Date().toISOString(),
      error: 'Sin conexión con el servidor de fuentes deportivas. Mostrando caché local si existe.',
    };
  }
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
  try {
    const q = new URLSearchParams({ leagues: leagues.join(',') });
    if (dates) q.set('dates', dates);
    const r = await fetch(`/api/sports/multi-scoreboard?${q.toString()}`);
    const data = (await r.json()) as {
      ok: boolean;
      matches?: SportMatchItem[];
      fetchedAt?: string;
      error?: string;
    };
    return {
      ok: Boolean(data.ok),
      matches: Array.isArray(data.matches) ? data.matches : [],
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      error: data.error,
    };
  } catch {
    return {
      ok: false,
      matches: [],
      fetchedAt: new Date().toISOString(),
      error: 'No se pudo actualizar el calendario deportivo (modo offline o red no disponible).',
    };
  }
}

export async function fetchLeagueStandings(leagueId: string): Promise<{
  ok: boolean;
  groups: SportStandingsGroup[];
  fetchedAt: string;
  note?: string;
  error?: string;
}> {
  try {
    const r = await fetch(`/api/sports/standings?league=${encodeURIComponent(leagueId)}`);
    const data = (await r.json()) as {
      ok: boolean;
      groups?: SportStandingsGroup[];
      fetchedAt?: string;
      note?: string;
      error?: string;
    };
    return {
      ok: Boolean(data.ok),
      groups: Array.isArray(data.groups) ? data.groups : [],
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      note: data.note,
      error: data.error,
    };
  } catch {
    return {
      ok: false,
      groups: [],
      fetchedAt: new Date().toISOString(),
      error: 'No se pudo cargar la tabla de posiciones en este momento.',
    };
  }
}

export async function fetchMatchSummary(
  leagueId: string,
  eventId: string
): Promise<{ ok: boolean; summary?: SportMatchSummary; error?: string }> {
  try {
    const r = await fetch(
      `/api/sports/match-summary?league=${encodeURIComponent(leagueId)}&eventId=${encodeURIComponent(eventId)}`
    );
    const data = (await r.json()) as SportMatchSummary & { ok: boolean; error?: string };
    if (!data.ok) return { ok: false, error: data.error || 'Sin detalle extendido disponible.' };
    return { ok: true, summary: data };
  } catch {
    return { ok: false, error: 'Error consultando detalle del encuentro.' };
  }
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
  try {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    const r = await fetch(`/api/sports/news?${params.toString()}`);
    const data = (await r.json()) as {
      ok: boolean;
      articles?: SportNewsArticle[];
      fetchedAt?: string;
      error?: string;
    };
    return {
      ok: Boolean(data.ok),
      articles: Array.isArray(data.articles) ? data.articles : [],
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      error: data.error,
    };
  } catch {
    return {
      ok: false,
      articles: [],
      fetchedAt: new Date().toISOString(),
      error: 'Sin conexión a los feeds RSS deportivos.',
    };
  }
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
  try {
    const r = await fetch(
      `/api/sports/search?type=${type}&q=${encodeURIComponent(q.trim())}`
    );
    const data = (await r.json()) as {
      ok: boolean;
      items?: Array<SportTeamProfile | SportAthleteProfile>;
      fetchedAt?: string;
      error?: string;
    };
    return {
      ok: Boolean(data.ok),
      items: Array.isArray(data.items) ? data.items : [],
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      error: data.error,
    };
  } catch {
    return {
      ok: false,
      items: [],
      fetchedAt: new Date().toISOString(),
      error: 'Error consultando perfiles en TheSportsDB.',
    };
  }
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
