import type {
  SportLeagueCatalogItem,
  SportsSidebarItem,
  SportsUserState,
} from '../types/sports';

export const SPORTS_SIDEBAR_ORDER: SportsSidebarItem[] = [
  { id: 'inicio-deportivo', number: 1, label: 'Inicio deportivo', shortDesc: 'Resumen hoy, en vivo, noticias y favoritos' },
  { id: 'futbol', number: 2, label: 'Fútbol', shortDesc: 'Argentina, Sudamérica, Europa y selecciones' },
  { id: 'otras-disciplinas', number: 3, label: 'Otras disciplinas', shortDesc: '16 disciplinas polideportivas' },
  { id: 'partidos-en-vivo', number: 4, label: 'Partidos en vivo', shortDesc: 'Marcador actualizado periódicamente' },
  { id: 'calendario', number: 5, label: 'Calendario', shortDesc: 'Hoy, mañana, 7/30 días y anteriores' },
  { id: 'resultados', number: 6, label: 'Resultados', shortDesc: 'Encuentros finalizados y detalle' },
  { id: 'ligas-torneos', number: 7, label: 'Ligas y torneos', shortDesc: 'Catálogo extensible de competiciones' },
  { id: 'tablas-posiciones', number: 8, label: 'Tablas de posiciones', shortDesc: 'Posiciones reales por competición' },
  { id: 'equipos', number: 9, label: 'Equipos', shortDesc: 'Fichas, escudos, partidos y noticias' },
  { id: 'deportistas', number: 10, label: 'Deportistas', shortDesc: 'Fichas públicas, especialidad y noticias' },
  { id: 'noticias', number: 11, label: 'Noticias', shortDesc: 'FABRO NOTICIAS DEPORTIVAS + IA' },
  { id: 'estadisticas', number: 12, label: 'Estadísticas', shortDesc: 'Métricas verificadas y evolución personal' },
  { id: 'entrenamiento', number: 13, label: 'Entrenamiento', shortDesc: 'Running, fuerza, ciclismo y equipo' },
  { id: 'herramientas-deportivas', number: 14, label: 'Herramientas deportivas', shortDesc: 'FABRO SPORT TOOLS y calculadoras' },
  { id: 'entrenadores', number: 15, label: 'Entrenadores', shortDesc: 'Grupos, asistencia, pruebas e informes' },
  { id: 'mis-favoritos', number: 16, label: 'Mis favoritos', shortDesc: 'Panel personalizado MI DEPORTE' },
  { id: 'fabro-sport-ai', number: 17, label: 'FABRO SPORT AI', shortDesc: 'Asistente con datos reales y BYOK' },
  { id: 'configuracion-deportes', number: 18, label: 'Configuración', shortDesc: 'Fuentes, zona horaria, alertas y $0' },
];

export const SPORTS_LEAGUES_FALLBACK: SportLeagueCatalogItem[] = [
  { id: 'arg.1', name: 'Liga Profesional Argentina', shortName: 'LPF Arg', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'argentina' },
  { id: 'arg.2', name: 'Primera Nacional', shortName: 'Primera Nacional', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'argentina' },
  { id: 'arg.3', name: 'Primera B Metropolitana', shortName: 'Primera B', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'argentina' },
  { id: 'arg.4', name: 'Primera C Argentina', shortName: 'Primera C', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'argentina' },
  { id: 'arg.copa', name: 'Copa Argentina', shortName: 'Copa Arg', country: 'Argentina', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: false, region: 'argentina' },
  { id: 'fifa.worldq.conmebol', name: 'Eliminatorias Sudamericanas (Selección Argentina)', shortName: 'Eliminatorias', country: 'Sudamérica', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'argentina' },
  { id: 'eng.1', name: 'Premier League', shortName: 'Premier', country: 'Inglaterra', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'esp.1', name: 'LaLiga EA Sports', shortName: 'LaLiga', country: 'España', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'ita.1', name: 'Serie A Italia', shortName: 'Serie A', country: 'Italia', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'ger.1', name: 'Bundesliga', shortName: 'Bundesliga', country: 'Alemania', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'fra.1', name: 'Ligue 1', shortName: 'Ligue 1', country: 'Francia', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'uefa.champions', name: 'UEFA Champions League', shortName: 'Champions', country: 'Europa', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'uefa.europa', name: 'UEFA Europa League', shortName: 'Europa League', country: 'Europa', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'uefa.europa.conf', name: 'UEFA Conference League', shortName: 'Conference', country: 'Europa', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'conmebol.libertadores', name: 'Copa Libertadores', shortName: 'Libertadores', country: 'Sudamérica', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'conmebol.sudamericana', name: 'Copa Sudamericana', shortName: 'Sudamericana', country: 'Sudamérica', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'fifa.world', name: 'Copa del Mundo FIFA', shortName: 'Mundial FIFA', country: 'Internacional', sport: 'soccer', disciplineLabel: 'Fútbol', hasStandings: true, region: 'internacional' },
  { id: 'nba', name: 'NBA Básquet', shortName: 'NBA', country: 'EE. UU. / Int.', sport: 'basketball', disciplineLabel: 'Básquet', hasStandings: true, region: 'otras-disciplinas' },
  { id: 'atp', name: 'ATP Tour Tenis', shortName: 'ATP', country: 'Internacional', sport: 'tennis', disciplineLabel: 'Tenis', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'wta', name: 'WTA Tour Tenis', shortName: 'WTA', country: 'Internacional', sport: 'tennis', disciplineLabel: 'Tenis', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'f1', name: 'Fórmula 1', shortName: 'F1', country: 'Internacional', sport: 'racing', disciplineLabel: 'Fórmula 1', hasStandings: true, region: 'otras-disciplinas' },
  { id: 'ufc', name: 'UFC / Artes Marciales Mixtas', shortName: 'UFC / MMA', country: 'Internacional', sport: 'mma', disciplineLabel: 'Artes marciales', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'pga', name: 'PGA Tour Golf', shortName: 'PGA Golf', country: 'Internacional', sport: 'golf', disciplineLabel: 'Golf', hasStandings: false, region: 'otras-disciplinas' },
  { id: 'rugby.int', name: 'Rugby Internacional', shortName: 'Rugby Int.', country: 'Internacional', sport: 'rugby', disciplineLabel: 'Rugby', hasStandings: false, region: 'otras-disciplinas' },
];

export const OTHER_DISCIPLINES_CATALOG: Array<{
  id: string;
  label: string;
  leagueId?: string;
  newsCategory: string;
  coverageNote: string;
  officialRef: string;
}> = [
  { id: 'basquet', label: 'Básquet', leagueId: 'nba', newsCategory: 'Básquet', coverageNote: 'Calendario, resultados y tablas NBA en vivo periódico + noticias RSS.', officialRef: 'NBA / FIBA / LNB' },
  { id: 'tenis', label: 'Tenis', leagueId: 'atp', newsCategory: 'Tenis', coverageNote: 'Torneos y resultados ATP / WTA desde fuente pública + noticias RSS.', officialRef: 'ATP / WTA / AAT' },
  { id: 'rugby', label: 'Rugby', leagueId: 'rugby.int', newsCategory: 'Rugby', coverageNote: 'Encuentros internacionales (fuente pública) + noticias de Los Pumas y torneos.', officialRef: 'World Rugby / UAR' },
  { id: 'formula-1', label: 'Fórmula 1', leagueId: 'f1', newsCategory: 'Fórmula 1', coverageNote: 'Calendario de Grandes Premios y clasificaciones F1 + noticias actualizadas.', officialRef: 'FIA Formula 1' },
  { id: 'automovilismo', label: 'Automovilismo', leagueId: 'f1', newsCategory: 'Automovilismo', coverageNote: 'Noticias RSS de TC, Rally, MotoGP y categorías nacionales/internacionales.', officialRef: 'ACTC / FIA / FIM' },
  { id: 'boxeo', label: 'Boxeo', newsCategory: 'Boxeo', coverageNote: 'Noticias verificadas por RSS y registro de entrenamiento propio (sin API gratuita de veladas).', officialRef: 'FAB / CMB / AMB' },
  { id: 'artes-marciales', label: 'Artes marciales', leagueId: 'ufc', newsCategory: 'Boxeo', coverageNote: 'Carteleras UFC vía fuente pública gratuita + noticias de deportes de combate.', officialRef: 'UFC / Federaciones' },
  { id: 'atletismo', label: 'Atletismo', newsCategory: 'Atletismo', coverageNote: 'Noticias RSS + herramientas completas de pace, tiempos y planes 5K/10K/21K/42K.', officialRef: 'World Athletics / CADA' },
  { id: 'ciclismo', label: 'Ciclismo', newsCategory: 'Ciclismo', coverageNote: 'Noticias RSS + bitácora propia de rutas, velocidad media y desnivel.', officialRef: 'UCI' },
  { id: 'natacion', label: 'Natación', newsCategory: 'Natación', coverageNote: 'Noticias RSS + planificador propio de series de natación y marcas personales.', officialRef: 'World Aquatics / CADDA' },
  { id: 'voley', label: 'Vóley', newsCategory: 'Deportes olímpicos', coverageNote: 'Seguimiento por noticias RSS y preparación física de deportes de equipo.', officialRef: 'FIVB / FeVA' },
  { id: 'hockey', label: 'Hockey', newsCategory: 'Deportes olímpicos', coverageNote: 'Seguimiento por noticias RSS (Las Leonas / Los Leones) y herramientas físicas.', officialRef: 'FIH / CAH' },
  { id: 'golf', label: 'Golf', leagueId: 'pga', newsCategory: 'Deportes olímpicos', coverageNote: 'Torneos PGA Tour vía fuente pública gratuita + noticias.', officialRef: 'PGA Tour / AAG' },
  { id: 'gimnasia', label: 'Gimnasia', newsCategory: 'Deportes olímpicos', coverageNote: 'Seguimiento por noticias olímpicas y biblioteca de movilidad/calistenia.', officialRef: 'FIG' },
  { id: 'olimpicos', label: 'Deportes olímpicos', newsCategory: 'Deportes olímpicos', coverageNote: 'Cobertura periodística RSS internacional y nacional (COI / COA).', officialRef: 'COI / COA' },
  { id: 'esports', label: 'Deportes electrónicos', newsCategory: 'Otras disciplinas', coverageNote: 'Seguimiento informativo sin API comercial paga; pausas activas integradas.', officialRef: 'Torneos oficiales' },
];

export const SPORTS_NEWS_CATEGORIES = [
  'Todas',
  'Fútbol argentino',
  'Fútbol internacional',
  'Selección Argentina',
  'Mercado de pases',
  'Champions League',
  'Copa Libertadores',
  'Fútbol femenino',
  'Básquet',
  'Tenis',
  'Automovilismo',
  'Fórmula 1',
  'Rugby',
  'Boxeo',
  'Atletismo',
  'Ciclismo',
  'Natación',
  'Deportes olímpicos',
] as const;

export const RUNNING_PROGRAMS = [
  {
    id: 'run-init',
    title: 'Principiantes (Caminar / Trotar 6 semanas)',
    distance: '0 a 3–5 km',
    weeklySessions: 3,
    summary: 'Progresión suave alternando intervalos de caminata y trote cómodo en Zona 2.',
    weeks: [
      'Sem 1–2: 3 días × (2 min trote suave + 2 min caminata) × 6 bloques.',
      'Sem 3–4: 3 días × (4 min trote + 2 min caminata) × 5 bloques + movilidad de tobillos.',
      'Sem 5–6: 3 días × 18 a 25 min continuos a ritmo conversacional.',
    ],
  },
  {
    id: 'run-5k',
    title: 'Preparación 5 km (8 semanas)',
    distance: '5 km',
    weeklySessions: 3,
    summary: 'Construye base aeróbica con 1 rodaje suave, 1 bloque de cambios de ritmo y 1 tirada progresiva.',
    weeks: [
      'Día 1: Rodaje continuo suave 25–30 min (Zona 2).',
      'Día 2: Fartlek 6 × (2 min ritmo activo + 2 min trote muy suave).',
      'Día 3: Tirada aeróbica 4 a 6 km + 10 min de técnica y estiramientos.',
    ],
  },
  {
    id: 'run-10k',
    title: 'Preparación 10 km (10 semanas)',
    distance: '10 km',
    weeklySessions: 4,
    summary: 'Combina resistencia aeróbica, umbral controlado y fuerza preventiva de tren inferior.',
    weeks: [
      'Día 1: 40 min aeróbico suave.',
      'Día 2: Series 5 × 1000 m a ritmo objetivo 10K (pausa 2 min).',
      'Día 3: Fuerza de piernas, core y movilidad (35 min).',
      'Día 4: Tirada larga progresiva de 8 a 12 km.',
    ],
  },
  {
    id: 'run-21k',
    title: 'Media Maratón 21 km (12 semanas)',
    distance: '21.1 km',
    weeklySessions: 4,
    summary: 'Enfocado en economía de carrera, hidratación en tiradas largas y recuperación programada.',
    weeks: [
      '2 rodajes aeróbicos de 45–60 min + 1 sesión de ritmo controlado (tempo 20–30 min).',
      'Tirada larga semanal creciendo de 10 km hasta 18 km (descarga cada 4.ª semana).',
      '2 sesiones breves de fuerza y prevención tendinosa.',
    ],
  },
  {
    id: 'run-42k',
    title: 'Maratón 42 km (16 semanas · Guía estructural)',
    distance: '42.2 km',
    weeklySessions: 5,
    summary: 'Estructura orientativa para corredores con base previa de 21K; recomienda chequeo médico previo.',
    weeks: [
      'Base aeróbica constante en Zona 2 (75–80% del volumen semanal).',
      'Tiradas largas progresivas hasta 30–32 km probando hidratación y carbohidratos.',
      'Tapering (descarga) obligatorio las últimas 2–3 semanas antes de la carrera.',
    ],
  },
];

export const TEAM_SPORTS_DRILLS = [
  { id: 'ts-speed', area: 'Velocidad', title: 'Aceleraciones cortas 10–20 m', detail: '6 repeticiones con recuperación completa (90 s) cuidando postura e impulso inicial.' },
  { id: 'ts-agility', area: 'Agilidad', title: 'Cambios de dirección en T / conos', detail: '4 series de 20 s frenando con centro de gravedad bajo y rodillas alineadas.' },
  { id: 'ts-endurance', area: 'Resistencia', title: 'Intervalos intermitentes 15s/15s', detail: '2 bloques de 6 min simulando esfuerzos repetidos de fútbol, básquet o hockey.' },
  { id: 'ts-coord', area: 'Coordinación', title: 'Escalera de coordinación y saltos unipodales', detail: 'Apoyos rápidos y aterrizajes suaves para estabilidad de tobillo y rodilla.' },
  { id: 'ts-mob', area: 'Movilidad', title: 'Cadera, aductores y columna torácica', detail: '10 min previos a cada práctica para reducir sobrecargas musculares.' },
];

export const COMMON_TIMEZONES = [
  { id: 'America/Argentina/Buenos_Aires', label: 'Argentina (America/Argentina/Buenos_Aires)' },
  { id: 'America/Montevideo', label: 'Uruguay (America/Montevideo)' },
  { id: 'America/Santiago', label: 'Chile (America/Santiago)' },
  { id: 'America/Bogota', label: 'Colombia / Perú (America/Bogota)' },
  { id: 'America/Mexico_City', label: 'México (America/Mexico_City)' },
  { id: 'Europe/Madrid', label: 'España (Europe/Madrid)' },
  { id: 'UTC', label: 'UTC' },
];

export const DEFAULT_SPORTS_STATE: SportsUserState = {
  version: 1,
  timeZone: 'America/Argentina/Buenos_Aires',
  favoriteTeams: [],
  favoriteLeagues: ['arg.1', 'conmebol.libertadores', 'uefa.champions'],
  favoriteAthletes: [],
  favoriteDisciplines: ['Fútbol', 'Básquet', 'Tenis', 'Fórmula 1'],
  favoriteNewsSources: [],
  savedNewsArticles: [],
  alertPrefs: {
    matchStart: true,
    scheduleChanges: true,
    finalScores: true,
    goalsAndKeyEvents: false,
    breakingNews: false,
    favoriteTournaments: true,
    notifiedEventIds: [],
  },
  personalRecords: [],
  recoveryLogs: [],
  swimSeries: [],
  cyclingLogs: [],
  runningLogs: [],
  coachGroups: [],
  sportAiMessages: [],
  lastCachedMatches: [],
  lastCachedNews: [],
};
