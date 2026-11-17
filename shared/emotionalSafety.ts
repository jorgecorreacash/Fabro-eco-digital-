export interface CrisisHelpline {
  country: string;
  service: string;
  number: string;
  availability: string;
  url?: string;
}

export interface EmotionalCrisisDetectionResult {
  isCrisis: boolean;
  matchedTriggers: string[];
  severity: 'high' | 'none';
}

const HELPLINES_DIRECTORY: CrisisHelpline[] = [
  {
    country: 'Argentina',
    service: 'Línea de Prevención del Suicidio y Asistencia al Suicida',
    number: '135 (CABA/GBA) o 0800-345-1435 (todo el país)',
    availability: 'Gratuita · 24 horas',
  },
  {
    country: 'Argentina',
    service: 'Salud Mental Responde / Emergencias',
    number: '0800-333-1665 o 107 / 911',
    availability: '24 horas',
  },
  {
    country: 'España',
    service: 'Línea de atención a la conducta suicida',
    number: '024',
    availability: 'Gratuita y confidencial · 24 horas',
  },
  {
    country: 'México',
    service: 'Línea de la Vida (CONASAMA)',
    number: '800 911 2000',
    availability: 'Gratuita · 24 horas',
  },
  {
    country: 'Chile',
    service: 'Línea de Prevención del Suicidio *4141',
    number: '*4141',
    availability: 'Gratuita · 24 horas',
  },
  {
    country: 'Colombia',
    service: 'Línea de Salud Mental / Emergencias',
    number: '106 o 123',
    availability: '24 horas',
  },
  {
    country: 'Uruguay',
    service: 'Línea de Vida (MSP / ASSE)',
    number: '0800 0767 o *0767',
    availability: 'Gratuita · 24 horas',
  },
  {
    country: 'Perú',
    service: 'Línea 113 Salud — Orientación en Salud Mental',
    number: '113 (opción 5)',
    availability: 'Gratuita · 24 horas',
  },
  {
    country: 'Estados Unidos y Puerto Rico',
    service: '988 Suicide & Crisis Lifeline (en español)',
    number: '988',
    availability: 'Gratuita y confidencial · 24 horas',
  },
  {
    country: 'Internacional',
    service: 'Directorio global de líneas de ayuda gratuitas',
    number: 'findahelpline.com (o emergencias locales 911 / 112)',
    availability: 'Disponible en más de 130 países',
    url: 'https://findahelpline.com/',
  },
];

const CRISIS_PHRASE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'ideacion_suicida', pattern: /\b(suicid\w*|quitarme la vida|terminar con mi vida|acabar con mi vida)\b/i },
  { label: 'autolesion', pattern: /\b(autolesion\w*|cortarme|hacerme dano|lastimarme|autoagredir\w*)\b/i },
  { label: 'deseo_morir', pattern: /\b(quiero morir\w*|quisiera morir\w*|ojala estuviera muert[oa]|no quiero vivir mas|no quiero seguir viviendo|mejor muert[oa])\b/i },
  { label: 'plan_despedida', pattern: /\b(matarme|voy a matarme|me voy a matar|nota de despedida|despedirme para siempre)\b/i },
  { label: 'crisis_en', pattern: /\b(kill myself|end my life|commit suicide|want to die|self[- ]harm|hurt myself)\b/i },
];

export function normalizeTextForSafety(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectEmotionalCrisis(text: string): EmotionalCrisisDetectionResult {
  const normalized = normalizeTextForSafety(text);
  if (!normalized || normalized.length < 4) {
    return { isCrisis: false, matchedTriggers: [], severity: 'none' };
  }

  const matchedTriggers: string[] = [];
  for (const rule of CRISIS_PHRASE_PATTERNS) {
    if (rule.pattern.test(normalized)) {
      matchedTriggers.push(rule.label);
    }
  }

  if (matchedTriggers.length > 0) {
    return {
      isCrisis: true,
      matchedTriggers,
      severity: 'high',
    };
  }

  return { isCrisis: false, matchedTriggers: [], severity: 'none' };
}

export function getCrisisSupportResources(countryHint?: string): CrisisHelpline[] {
  const cleanCountry = normalizeTextForSafety(countryHint || '');
  if (!cleanCountry) {
    return HELPLINES_DIRECTORY;
  }
  const prioritized = HELPLINES_DIRECTORY.filter(
    (item) =>
      normalizeTextForSafety(item.country).includes(cleanCountry) ||
      cleanCountry.includes(normalizeTextForSafety(item.country))
  );
  const rest = HELPLINES_DIRECTORY.filter((item) => !prioritized.includes(item));
  return [...prioritized, ...rest];
}

export function buildCrisisSupportMessage(countryHint?: string): string {
  const lines = getCrisisSupportResources(countryHint).slice(0, 4);
  const formattedLines = lines
    .map((l) => `- **${l.country} — ${l.service}**: ${l.number} (${l.availability})`)
    .join('\n');

  return [
    'Gracias por compartir lo que estás sintiendo. Tu vida y tu bienestar importan mucho, y no tenés que atravesar este momento en soledad.',
    '',
    'Si estás sintiendo angustia intensa o pensamientos de hacerte daño, por favor buscá acompañamiento humano inmediato de un profesional, un familiar, una amistad cercana o una línea gratuita de asistencia:',
    '',
    formattedLines,
    '',
    'Si estás en peligro inmediato, llamá al número de emergencias de tu país (911, 107 o 112) o acudí a la guardia de salud más cercana. FABRO IA no reemplaza a un profesional de la salud mental.',
  ].join('\n');
}

export const COUNSELOR_SYSTEM_SAFETY_INSTRUCTION = [
  'Sos "FABRO IA — Consejero Personal", un acompañante reflexivo, cálido, respetuoso y práctico integrado en el módulo "EL ÚLTIMO DÍA DE TU VIDA" dentro de FABRO.',
  'Propósito: ayudar al usuario a valorar su presente, redactar y mejorar textos personales (cartas, poemas, relatos, diarios, autobiografía), proponer ejercicios de reflexión e introspección, ordenar pensamientos y emociones, priorizar actividades valiosas del día, ofrecer motivación positiva y sugerir actividades saludables acordes a sus gustos.',
  'REGLAS OBLIGATORIAS DE SEGURIDAD Y CUIDADO EMOCIONAL:',
  '1. NO realizás diagnósticos médicos, psiquiátricos ni psicológicos, ni prescribís tratamientos o medicación. Aclará cuando corresponda que no reemplazás a un profesional de la salud.',
  '2. NUNCA generés cuentas regresivas a la muerte, mensajes fatalistas ni fomentés el aislamiento.',
  '3. NUNCA alentés ni brindés instrucciones vinculadas a autolesiones, suicidio o despedidas definitivas.',
  '4. Si el usuario pide resumir su diario, solo trabajá con los fragmentos explícitamente incluidos en esta solicitud.',
  '5. Respondé siempre en español claro, empático, humano y concreto.',
].join('\n');
