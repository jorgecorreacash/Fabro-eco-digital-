import type { CachedWeatherSnapshot, ZodiacSignId } from '../types/ecosystem';

export interface WeatherCityPreset {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const WEATHER_CITY_PRESETS: WeatherCityPreset[] = [
  { id: 'buenos-aires', name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816 },
  { id: 'madrid', name: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
  { id: 'mexico', name: 'Ciudad de México', latitude: 19.4326, longitude: -99.1332 },
  { id: 'santiago', name: 'Santiago', latitude: -33.4489, longitude: -70.6693 },
  { id: 'bogota', name: 'Bogotá', latitude: 4.711, longitude: -74.0721 },
  { id: 'montevideo', name: 'Montevideo', latitude: -34.9011, longitude: -56.1645 },
];

export function describeWmoWeather(code: number): { label: string; tone: string } {
  if (code === 0) return { label: 'Cielo despejado', tone: '#F59E0B' };
  if (code >= 1 && code <= 3) return { label: 'Parcialmente nublado', tone: '#06B6D4' };
  if (code === 45 || code === 48) return { label: 'Niebla suave', tone: '#64748B' };
  if (code >= 51 && code <= 57) return { label: 'Llovizna ligera', tone: '#0284C7' };
  if (code >= 61 && code <= 67) return { label: 'Lluvia', tone: '#2563EB' };
  if (code >= 71 && code <= 77) return { label: 'Nieve o aguanieve', tone: '#38BDF8' };
  if (code >= 80 && code <= 82) return { label: 'Chaparrones', tone: '#1D4ED8' };
  if (code >= 95) return { label: 'Tormenta eléctrica', tone: '#7C3AED' };
  return { label: 'Condición variable', tone: '#0891B2' };
}

export async function fetchLiveWeather(
  latitude: number,
  longitude: number,
  cityName: string
): Promise<CachedWeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudo consultar el pronóstico en este momento.');
  }
  const data = (await response.json()) as {
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      is_day: number;
      weather_code: number;
      wind_speed_10m: number;
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
    };
  };

  const forecastDays = (data.daily?.time || []).slice(1, 4).map((isoDate, idx) => {
    const parsed = new Date(`${isoDate}T12:00:00`);
    const dateLabel = Number.isNaN(parsed.getTime())
      ? isoDate
      : parsed.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
    return {
      dateLabel,
      weatherCode: data.daily.weather_code[idx + 1] ?? 1,
      maxC: Math.round(data.daily.temperature_2m_max[idx + 1] ?? data.current.temperature_2m),
      minC: Math.round(data.daily.temperature_2m_min[idx + 1] ?? data.current.temperature_2m - 5),
    };
  });

  return {
    cityName,
    latitude,
    longitude,
    temperatureC: Math.round(data.current.temperature_2m),
    apparentC: Math.round(data.current.apparent_temperature),
    humidityPct: Math.round(data.current.relative_humidity_2m),
    windKmh: Math.round(data.current.wind_speed_10m),
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1,
    dailyMaxC: Math.round(data.daily?.temperature_2m_max?.[0] ?? data.current.temperature_2m + 3),
    dailyMinC: Math.round(data.daily?.temperature_2m_min?.[0] ?? data.current.temperature_2m - 4),
    fetchedAtIso: new Date().toISOString(),
    forecastDays,
  };
}

export interface LunarPhaseInfo {
  phaseName: string;
  illuminationPct: number;
  ageDays: number;
  cycleFraction: number;
  daysUntilFullMoon: number;
  daysUntilNewMoon: number;
  advice: string;
}

export function getLunarStatus(date: Date = new Date()): LunarPhaseInfo {
  const SYNODIC_MONTH = 29.530588853;
  // Known New Moon reference: 2000-01-06 18:14 UTC
  const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
  const diffDays = (date.getTime() - KNOWN_NEW_MOON_MS) / 86400000;
  const ageDays = ((diffDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const cycleFraction = ageDays / SYNODIC_MONTH;
  const illuminationPct = Math.round(((1 - Math.cos(2 * Math.PI * cycleFraction)) / 2) * 100);

  let phaseName = 'Luna Nueva';
  let advice = 'Buen momento para sembrar hábitos nuevos y definir metas claras.';

  if (cycleFraction >= 0.03 && cycleFraction < 0.22) {
    phaseName = 'Luna Creciente';
    advice = 'Energía favorable para iniciar proyectos de estudio y sumar ritmo.';
  } else if (cycleFraction >= 0.22 && cycleFraction < 0.28) {
    phaseName = 'Cuarto Creciente';
    advice = 'Impulso práctico ideal para resolver pendientes y sostener foco.';
  } else if (cycleFraction >= 0.28 && cycleFraction < 0.47) {
    phaseName = 'Gibosa Creciente';
    advice = 'Etapa de perfeccionamiento: pulí tus apuntes y ajustá detalles.';
  } else if (cycleFraction >= 0.47 && cycleFraction < 0.53) {
    phaseName = 'Luna Llena';
    advice = 'Máxima claridad nocturna: celebrá avances y cuidá tu descanso.';
  } else if (cycleFraction >= 0.53 && cycleFraction < 0.72) {
    phaseName = 'Gibosa Menguante';
    advice = 'Buen ciclo para compartir lo aprendido y agradecer vínculos.';
  } else if (cycleFraction >= 0.72 && cycleFraction < 0.78) {
    phaseName = 'Cuarto Menguante';
    advice = 'Tiempo de ordenar tu espacio, depurar tareas y soltar distracciones.';
  } else if (cycleFraction >= 0.78 && cycleFraction < 0.97) {
    phaseName = 'Luna Menguante';
    advice = 'Pausa reparadora: priorizá descanso profundo y reflexión serena.';
  }

  const fullMoonAge = SYNODIC_MONTH / 2;
  const daysUntilFullMoon = Math.round(
    ageDays <= fullMoonAge ? fullMoonAge - ageDays : SYNODIC_MONTH - ageDays + fullMoonAge
  );
  const daysUntilNewMoon = Math.round(SYNODIC_MONTH - ageDays);

  return {
    phaseName,
    illuminationPct,
    ageDays: Number(ageDays.toFixed(1)),
    cycleFraction,
    daysUntilFullMoon,
    daysUntilNewMoon,
    advice,
  };
}

export interface ZodiacMeta {
  id: ZodiacSignId;
  name: string;
  symbol: string;
  dateRange: string;
  element: 'Fuego' | 'Tierra' | 'Aire' | 'Agua';
  accent: string;
}

export const ZODIAC_SIGNS: ZodiacMeta[] = [
  { id: 'aries', name: 'Aries', symbol: '♈', dateRange: '21 mar – 19 abr', element: 'Fuego', accent: '#EF4444' },
  { id: 'tauro', name: 'Tauro', symbol: '♉', dateRange: '20 abr – 20 may', element: 'Tierra', accent: '#10B981' },
  { id: 'geminis', name: 'Géminis', symbol: '♊', dateRange: '21 may – 20 jun', element: 'Aire', accent: '#06B6D4' },
  { id: 'cancer', name: 'Cáncer', symbol: '♋', dateRange: '21 jun – 22 jul', element: 'Agua', accent: '#3B82F6' },
  { id: 'leo', name: 'Leo', symbol: '♌', dateRange: '23 jul – 22 ago', element: 'Fuego', accent: '#F59E0B' },
  { id: 'virgo', name: 'Virgo', symbol: '♍', dateRange: '23 ago – 22 sep', element: 'Tierra', accent: '#059669' },
  { id: 'libra', name: 'Libra', symbol: '♎', dateRange: '23 sep – 22 oct', element: 'Aire', accent: '#EC4899' },
  { id: 'escorpio', name: 'Escorpio', symbol: '♏', dateRange: '23 oct – 21 nov', element: 'Agua', accent: '#7C3AED' },
  { id: 'sagitario', name: 'Sagitario', symbol: '♐', dateRange: '22 nov – 21 dic', element: 'Fuego', accent: '#EA580C' },
  { id: 'capricornio', name: 'Capricornio', symbol: '♑', dateRange: '22 dic – 19 ene', element: 'Tierra', accent: '#475569' },
  { id: 'acuario', name: 'Acuario', symbol: '♒', dateRange: '20 ene – 18 feb', element: 'Aire', accent: '#0284C7' },
  { id: 'piscis', name: 'Piscis', symbol: '♓', dateRange: '19 feb – 20 mar', element: 'Agua', accent: '#6366F1' },
];

const ENERGY_LINES = [
  'Tu claridad mental abre soluciones simples a problemas que parecían trabados.',
  'Hoy conviene avanzar paso a paso sin exigirte perfección inmediata.',
  'Una conversación honesta te devuelve perspectiva y calma.',
  'Buen momento para ordenar prioridades y liberar espacio mental.',
  'Tu constancia silenciosa empieza a dar frutos visibles.',
  'Cuidar tu ritmo de descanso multiplica tu creatividad de la tarde.',
];

const STUDY_LINES = [
  'Un bloque Pomodoro de 25 minutos bien enfocado vale más que tres horas dispersas.',
  'Resumir en tus propias palabras fija mejor los conceptos clave hoy.',
  'Repasar tarjetas o esquemas cortos a media tarde te dará seguridad.',
  'Anotar dudas concretas acelera tu aprendizaje en el próximo encuentro.',
];

const BOND_LINES = [
  'Dejá un mensaje breve a alguien que apreciás aunque esté sin conexión.',
  'Escuchar sin apuro fortalece la confianza con tu círculo cercano.',
  'Compartir un apunte o una buena frase alegra el día de otro.',
  'Elegí vínculos que sumen serenidad y diálogo genuino.',
];

const HARMONY_COLORS = ['Azul Cobalto', 'Verde Salvia', 'Ámbar Dorado', 'Violeta Serena', 'Turquesa Claro', 'Coral Suave'];

export function getDailyHoroscope(signId: ZodiacSignId, date: Date = new Date()) {
  const signIdx = Math.max(
    0,
    ZODIAC_SIGNS.findIndex((s) => s.id === signId)
  );
  const daySeed =
    date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate() + signIdx * 7;

  return {
    meta: ZODIAC_SIGNS[signIdx],
    energy: ENERGY_LINES[daySeed % ENERGY_LINES.length],
    study: STUDY_LINES[(daySeed + 3) % STUDY_LINES.length],
    bonds: BOND_LINES[(daySeed + 5) % BOND_LINES.length],
    luckyNumber: ((daySeed % 9) + 1) * 3 + (signIdx % 4),
    harmonyColor: HARMONY_COLORS[(daySeed + signIdx) % HARMONY_COLORS.length],
  };
}
