export type SportsNavId =
  | 'inicio-deportivo'
  | 'futbol'
  | 'otras-disciplinas'
  | 'partidos-en-vivo'
  | 'calendario'
  | 'resultados'
  | 'ligas-torneos'
  | 'tablas-posiciones'
  | 'equipos'
  | 'deportistas'
  | 'noticias'
  | 'estadisticas'
  | 'entrenamiento'
  | 'herramientas-deportivas'
  | 'entrenadores'
  | 'mis-favoritos'
  | 'fabro-sport-ai'
  | 'configuracion-deportes';

export interface SportsSidebarItem {
  id: SportsNavId;
  number: number;
  label: string;
  shortDesc: string;
}

export interface SportLeagueCatalogItem {
  id: string;
  name: string;
  shortName: string;
  country: string;
  sport: 'soccer' | 'basketball' | 'tennis' | 'racing' | 'mma' | 'golf' | 'rugby';
  disciplineLabel: string;
  hasStandings: boolean;
  region: 'argentina' | 'internacional' | 'otras-disciplinas';
}

export interface SportMatchItem {
  id: string;
  leagueId: string;
  leagueName: string;
  country: string;
  sport: SportLeagueCatalogItem['sport'];
  disciplineLabel: string;
  startDateIso: string;
  statusCode:
    | 'programado'
    | 'en-vivo'
    | 'entretiempo'
    | 'finalizado'
    | 'suspendido'
    | 'postergado'
    | 'cancelado';
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

export interface SportStandingsRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  played: string;
  wins: string;
  draws: string;
  losses: string;
  goalsFor: string;
  goalsAgainst: string;
  goalDiff: string;
  points: string;
  note?: string;
}

export interface SportStandingsGroup {
  groupName: string;
  rows: SportStandingsRow[];
}

export interface SportMatchSummary {
  events: Array<{
    id: string;
    clock: string;
    type: string;
    text: string;
    teamName: string;
  }>;
  teamStats: Array<{
    teamName: string;
    stats: Array<{ label: string; value: string }>;
  }>;
  lineups: Array<{
    teamName: string;
    formation: string;
    players: Array<{ name: string; jersey: string; position: string }>;
  }>;
  fetchedAt: string;
  sourceName: string;
}

export interface SportNewsArticle {
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

export interface SportTeamProfile {
  id: string;
  kind: 'team';
  name: string;
  sport: string;
  country: string;
  league: string;
  stadium: string;
  formedYear: string;
  image: string;
  description: string;
}

export interface SportAthleteProfile {
  id: string;
  kind: 'player';
  name: string;
  sport: string;
  country: string;
  team: string;
  position: string;
  birthDate: string;
  image: string;
  description: string;
}

export interface SportSourceStatus {
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

// Personal Athlete & Coach Records (persisted in IndexedDB)
export interface PersonalRecordEntry {
  id: string;
  date: string;
  discipline: string;
  metricName: string;
  valueLabel: string;
  notes?: string;
}

export interface RecoveryFatigueLog {
  id: string;
  date: string;
  restingHrBpm?: number;
  fatigueLevel: number; // 1-10
  recoveryScore: number; // 1-10
  notes?: string;
}

export interface CoachAthleteMember {
  id: string;
  name: string;
  discipline: string;
  consentGranted: boolean;
  attendanceDates: string[];
  physicalTests: Array<{
    id: string;
    date: string;
    testName: string;
    result: string;
  }>;
  goalNote?: string;
}

export interface CoachTrainingGroup {
  id: string;
  name: string;
  sport: string;
  schedule: string;
  athletes: CoachAthleteMember[];
  sharedPlans: Array<{
    id: string;
    date: string;
    title: string;
    details: string;
  }>;
}

export interface SportAlertPreferences {
  matchStart: boolean;
  scheduleChanges: boolean;
  finalScores: boolean;
  goalsAndKeyEvents: boolean;
  breakingNews: boolean;
  favoriteTournaments: boolean;
  notifiedEventIds: string[];
}

export interface SportsUserState {
  version: 1;
  timeZone: string;
  favoriteTeams: string[];
  favoriteLeagues: string[];
  favoriteAthletes: string[];
  favoriteDisciplines: string[];
  favoriteNewsSources: string[];
  savedNewsArticles: SportNewsArticle[];
  alertPrefs: SportAlertPreferences;
  personalRecords: PersonalRecordEntry[];
  recoveryLogs: RecoveryFatigueLog[];
  swimSeries: Array<{
    id: string;
    date: string;
    title: string;
    totalMeters: number;
    details: string;
  }>;
  cyclingLogs: Array<{
    id: string;
    date: string;
    route: string;
    distanceKm: number;
    durationMin: number;
    elevationM?: number;
  }>;
  runningLogs: Array<{
    id: string;
    date: string;
    distanceKm: number;
    durationMin: number;
    pacePerKm: string;
    notes?: string;
  }>;
  coachGroups: CoachTrainingGroup[];
  sportAiMessages: Array<{
    id: string;
    role: 'user' | 'ai';
    text: string;
    sourceLabel?: string;
    createdAt: string;
  }>;
  lastCachedMatches: SportMatchItem[];
  lastCachedNews: SportNewsArticle[];
  lastSyncAt?: string;
}
