import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Heart,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import type { ZodiacSignId, ZodiacSignMeta } from '../../types/fabro';

export const ZODIAC_SIGNS: ZodiacSignMeta[] = [
  { id: 'aries', name: 'Aries', symbol: '♈', dateRange: '21 mar – 19 abr', element: 'Fuego', planet: 'Marte', traits: 'Iniciativa, coraje y energía directa', compatibleWith: ['leo', 'sagitario', 'geminis', 'acuario'] },
  { id: 'tauro', name: 'Tauro', symbol: '♉', dateRange: '20 abr – 20 may', element: 'Tierra', planet: 'Venus', traits: 'Constancia, calma sensorial y lealtad', compatibleWith: ['virgo', 'capricornio', 'cancer', 'piscis'] },
  { id: 'geminis', name: 'Géminis', symbol: '♊', dateRange: '21 may – 20 jun', element: 'Aire', planet: 'Mercurio', traits: 'Curiosidad, diálogo ágil y versatilidad', compatibleWith: ['libra', 'acuario', 'aries', 'leo'] },
  { id: 'cancer', name: 'Cáncer', symbol: '♋', dateRange: '21 jun – 22 jul', element: 'Agua', planet: 'Luna', traits: 'Sensibilidad, cuidado y memoria afectiva', compatibleWith: ['escorpio', 'piscis', 'tauro', 'virgo'] },
  { id: 'leo', name: 'Leo', symbol: '♌', dateRange: '23 jul – 22 ago', element: 'Fuego', planet: 'Sol', traits: 'Calidez creativa, liderazgo y generosidad', compatibleWith: ['aries', 'sagitario', 'libra', 'geminis'] },
  { id: 'virgo', name: 'Virgo', symbol: '♍', dateRange: '23 ago – 22 sep', element: 'Tierra', planet: 'Mercurio', traits: 'Precisión, servicio práctico y claridad', compatibleWith: ['tauro', 'capricornio', 'cancer', 'escorpio'] },
  { id: 'libra', name: 'Libra', symbol: '♎', dateRange: '23 sep – 22 oct', element: 'Aire', planet: 'Venus', traits: 'Armonía, diplomacia y sentido estético', compatibleWith: ['geminis', 'acuario', 'leo', 'sagitario'] },
  { id: 'escorpio', name: 'Escorpio', symbol: '♏', dateRange: '23 oct – 21 nov', element: 'Agua', planet: 'Plutón', traits: 'Profundidad, enfoque y transformación', compatibleWith: ['cancer', 'piscis', 'virgo', 'capricornio'] },
  { id: 'sagitario', name: 'Sagitario', symbol: '♐', dateRange: '22 nov – 21 dic', element: 'Fuego', planet: 'Júpiter', traits: 'Horizonte amplio, optimismo y aventura', compatibleWith: ['aries', 'leo', 'acuario', 'libra'] },
  { id: 'capricornio', name: 'Capricornio', symbol: '♑', dateRange: '22 dic – 19 ene', element: 'Tierra', planet: 'Saturno', traits: 'Disciplina serena, visión y estructura', compatibleWith: ['tauro', 'virgo', 'escorpio', 'piscis'] },
  { id: 'acuario', name: 'Acuario', symbol: '♒', dateRange: '20 ene – 18 feb', element: 'Aire', planet: 'Urano', traits: 'Originalidad, mente comunitaria y futuro', compatibleWith: ['geminis', 'libra', 'aries', 'sagitario'] },
  { id: 'piscis', name: 'Piscis', symbol: '♓', dateRange: '19 feb – 20 mar', element: 'Agua', planet: 'Neptuno', traits: 'Empatía, intuición artística y compasión', compatibleWith: ['cancer', 'escorpio', 'tauro', 'capricornio'] },
];

export function detectZodiacFromBirthDate(birthDate?: string): ZodiacSignId | null {
  if (!birthDate) return null;
  const parts = birthDate.split('-').map(Number);
  if (parts.length < 3 || Number.isNaN(parts[1]) || Number.isNaN(parts[2])) return null;
  const m = parts[1];
  const d = parts[2];
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 'aries';
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 'tauro';
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 'geminis';
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 'cancer';
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 'leo';
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 'virgo';
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 'libra';
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 'escorpio';
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 'sagitario';
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 'capricornio';
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 'acuario';
  return 'piscis';
}

function seedHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const LOVE_MSGS = [
  'Una conversación honesta y sin apuro abre la puerta a una cercanía genuina.',
  'Hoy conviene escuchar con atención antes de sacar conclusiones rápidas.',
  'Valorá los gestos cotidianos: la calidez discreta fortalece tus vínculos.',
  'Es un buen día para agradecer a alguien importante lo que aporta a tu vida.',
  'El equilibrio entre tu espacio personal y el tiempo compartido traerá armonía.',
];

const STUDY_MSGS = [
  'Tu foco rinde más en bloques cortos de 25–40 minutos sin distracciones.',
  'Ordenar tus apuntes y prioridades al comienzo de la jornada multiplica tu claridad.',
  'Un problema complejo se destraba cuando lo dividís en tres pasos simples.',
  'Aprovechá la mañana o tu horario de mayor lucidez para el tema más exigente.',
  'Compartir una duda con un compañero o revisar ejemplos prácticos consolidará lo aprendido.',
];

const WELLNESS_MSGS = [
  'Regalate pausas de respiración profunda y caminatas breves al aire libre.',
  'Hidratarte bien y cuidar tus horas de descanso marcará la diferencia en tu ánimo.',
  'Soltá la tensión de hombros y cuello con estiramientos suaves antes de dormir.',
  'Elegí alimentos frescos y comé sin pantallas para digerir con mayor calma.',
  'Un momento de escritura breve te ayudará a ordenar tus emociones del día.',
];

const COLORS_OF_DAY = [
  'Verde Esmeralda',
  'Azul Noche',
  'Ámbar Dorado',
  'Marfil Cálido',
  'Rosa Botánico',
  'Índigo Sereno',
];

export const HoroscopeView: React.FC = () => {
  const { profile, user } = useFabro();
  const detectedSign = useMemo(
    () => detectZodiacFromBirthDate(profile?.birthDate),
    [profile?.birthDate]
  );

  const [selectedSignId, setSelectedSignId] = useState<ZodiacSignId>(detectedSign || 'aries');
  const [partnerSignId, setPartnerSignId] = useState<ZodiacSignId>('leo');
  const [aiReading, setAiReading] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `fabro_zodiac_${user?.uid || 'anon'}`;

  useEffect(() => {
    if (detectedSign) {
      setSelectedSignId(detectedSign);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey) as ZodiacSignId | null;
      if (saved && ZODIAC_SIGNS.some((s) => s.id === saved)) {
        setSelectedSignId(saved);
      }
    } catch {
      // ignore
    }
  }, [detectedSign, storageKey]);

  const handleSelectSign = (id: ZodiacSignId) => {
    setSelectedSignId(id);
    setAiReading('');
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      // ignore
    }
  };

  const signMeta = useMemo(
    () => ZODIAC_SIGNS.find((s) => s.id === selectedSignId) || ZODIAC_SIGNS[0],
    [selectedSignId]
  );

  const daily = useMemo(() => {
    const h = seedHash(`${todayKey}:${selectedSignId}`);
    const cloverOne = (h % 89) + 1;
    const cloverTwo = ((h >> 4) % 89) + 1;
    return {
      energyPercent: 68 + (h % 30),
      love: LOVE_MSGS[h % LOVE_MSGS.length],
      study: STUDY_MSGS[(h >> 2) % STUDY_MSGS.length],
      wellness: WELLNESS_MSGS[(h >> 3) % WELLNESS_MSGS.length],
      color: COLORS_OF_DAY[(h >> 5) % COLORS_OF_DAY.length],
      luckyPair: [cloverOne, cloverTwo === cloverOne ? (cloverOne % 89) + 2 : cloverTwo].sort((a, b) => a - b),
      bestMatch: ZODIAC_SIGNS.find((z) => z.id === signMeta.compatibleWith[h % signMeta.compatibleWith.length]) || ZODIAC_SIGNS[0],
    };
  }, [todayKey, selectedSignId, signMeta]);

  const compatibilitySummary = useMemo(() => {
    const p = ZODIAC_SIGNS.find((s) => s.id === partnerSignId) || ZODIAC_SIGNS[0];
    const isDirect = signMeta.compatibleWith.includes(p.id);
    const sameElement = signMeta.element === p.element;
    const score = isDirect ? 92 : sameElement ? 86 : partnerSignId === selectedSignId ? 84 : 72;
    return {
      partner: p,
      score,
      note: isDirect
        ? `Afinidad armónica entre ${signMeta.name} (${signMeta.element}) y ${p.name} (${p.element}): fluye el entendimiento y el apoyo mutuo.`
        : sameElement
        ? `Comparten el elemento ${signMeta.element}, lo que favorece valores y ritmos similares.`
        : `Combinación complementaria: aprender del estilo distinto del otro enriquece el vínculo si hay diálogo claro.`,
    };
  }, [signMeta, partnerSignId, selectedSignId]);

  const handleAskAIReflection = async () => {
    setAiLoading(true);
    try {
      const resp = await authFetch('/api/ai/counselor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generá una reflexión breve, luminosa y práctica (máximo 110 palabras) inspirada en el signo ${signMeta.name} (elemento ${signMeta.element}, regido por ${signMeta.planet}) para hoy ${todayKey}, enfocada en estudiar con calma, agradecer y cuidar el bienestar cotidiano. Sin predicciones deterministas.`,
          provider: 'auto',
        }),
      });
      const data = (await resp.json()) as { text?: string; reply?: string; message?: string };
      setAiReading(data.text || data.reply || data.message || 'Hoy tu mejor brújula es avanzar un paso claro a la vez y cuidar tu calma.');
    } catch {
      setAiReading('No se pudo conectar con FABRO IA en este momento, pero tu guía diaria sigue disponible arriba.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <Star className="w-4 h-4" />
            <span>Lectura Diaria & Reflexión · Bienestar Natural</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Horóscopos del Día
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Explorá los 12 signos del zodíaco para recibir inspiración cotidiana sobre vínculos, estudio, energía vital y afinidad.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs shrink-0">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            {signMeta.symbol} {signMeta.name} · {signMeta.dateRange}
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
            Elemento {signMeta.element} · Regente {signMeta.planet}
          </p>
        </div>
      </section>

      {/* 12 Zodiac Sign Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {ZODIAC_SIGNS.map((sign) => {
          const active = sign.id === selectedSignId;
          return (
            <button
              key={sign.id}
              type="button"
              onClick={() => handleSelectSign(sign.id)}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                active
                  ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10'
                  : 'border-slate-200 dark:border-slate-800 fabro-shell-surface hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl leading-none">{sign.symbol}</span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {sign.element}
                </span>
              </div>
              <p className="font-display text-xs font-bold text-slate-900 dark:text-white mt-1.5">
                {sign.name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {sign.dateRange}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Sign Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl">
                {signMeta.symbol}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {signMeta.name} · Hoy {todayKey}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {signMeta.traits}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Energía vital</p>
              <p className="font-display text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {daily.energyPercent}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                <Heart className="w-3.5 h-3.5" />
                <span>Amor y Vínculos</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {daily.love}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                <Compass className="w-3.5 h-3.5" />
                <span>Estudio y Proyectos</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {daily.study}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Sun className="w-3.5 h-3.5" />
                <span>Bienestar Natural</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {daily.wellness}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs">
            <span>
              Color sugerido: <strong className="text-slate-900 dark:text-white">{daily.color}</strong>
            </span>
            <span className="tabular-nums">
              Números afines del día: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{daily.luckyPair.join(' · ')} 🍀</strong>
            </span>
            <span>
              Afinidad destacada: <strong className="text-slate-900 dark:text-white">{daily.bestMatch.symbol} {daily.bestMatch.name}</strong>
            </span>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void handleAskAIReflection()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? 'Consultando a FABRO IA...' : 'Generar consejo personalizado con FABRO IA'}
            </button>
            {aiReading && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-slate-800 dark:text-slate-100">
                {aiReading}
              </div>
            )}
          </div>
        </section>

        {/* Sign Compatibility Checker */}
        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Compatibilidad entre signos
          </h3>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Comparar {signMeta.name} con:
            </label>
            <select
              value={partnerSignId}
              onChange={(e) => setPartnerSignId(e.target.value as ZodiacSignId)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            >
              {ZODIAC_SIGNS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.symbol} {s.name} ({s.element})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {signMeta.symbol} + {compatibilitySummary.partner.symbol}
              </span>
              <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {compatibilitySummary.score}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${compatibilitySummary.score}%` }}
              />
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
              {compatibilitySummary.note}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
