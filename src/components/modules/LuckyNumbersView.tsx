import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Clover,
  Copy,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import type { LuckyNumbersEntry } from '../../types/fabro';

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function generateUniqueSet(count: number, min: number, max: number, seed?: number): number[] {
  const poolSize = max - min + 1;
  const target = Math.min(count, poolSize);
  const picked = new Set<number>();
  let state = seed ?? Date.now();
  let guard = 0;
  while (picked.size < target && guard < 1000) {
    guard++;
    if (seed !== undefined) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      picked.add(min + (state % poolSize));
    } else {
      picked.add(min + Math.floor(Math.random() * poolSize));
    }
  }
  return Array.from(picked).sort((a, b) => a - b);
}

function computeLifePathNumber(dateStr?: string): number | null {
  if (!dateStr) return null;
  const digits = dateStr.replace(/\D/g, '');
  if (!digits) return null;
  let sum = digits.split('').reduce((acc, d) => acc + Number(d), 0);
  while (sum > 9 && sum !== 11 && sum !== 22) {
    sum = String(sum).split('').reduce((acc, d) => acc + Number(d), 0);
  }
  return sum;
}

function computeNameVibration(name: string): number {
  const clean = name.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return 7;
  let sum = clean.split('').reduce((acc, ch) => acc + ((ch.charCodeAt(0) - 65) % 9) + 1, 0);
  while (sum > 9 && sum !== 11 && sum !== 22) {
    sum = String(sum).split('').reduce((acc, d) => acc + Number(d), 0);
  }
  return sum;
}

const RANGE_PRESETS = [
  { id: '0-9', label: 'Dígitos 0–9', min: 0, max: 9 },
  { id: '1-36', label: 'Clásico 1–36', min: 1, max: 36 },
  { id: '1-45', label: 'Lotería 1–45', min: 1, max: 45 },
  { id: '1-99', label: 'Amplio 1–99', min: 1, max: 99 },
];

export const LuckyNumbersView: React.FC = () => {
  const { user, profile } = useFabro();

  const todayKey = new Date().toISOString().slice(0, 10);
  const displayName = profile?.displayName || user?.displayName || 'FABRO';

  const dailyPersonal = useMemo(() => {
    const seed = hashStr(`${todayKey}:${user?.uid || displayName}:clover`);
    return {
      mainSet: generateUniqueSet(5, 1, 99, seed),
      cloverDigit: (seed % 9) + 1,
      powerPair: generateUniqueSet(2, 1, 45, seed + 77),
    };
  }, [todayKey, user?.uid, displayName]);

  const [count, setCount] = useState(5);
  const [rangeId, setRangeId] = useState('1-99');
  const [generated, setGenerated] = useState<number[]>(dailyPersonal.mainSet);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customName, setCustomName] = useState(displayName);
  const [customDate, setCustomDate] = useState(profile?.birthDate || '');
  const [savedEntries, setSavedEntries] = useState<LuckyNumbersEntry[]>([]);

  const storageKey = `fabro_lucky_saved_${user?.uid || 'anon'}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSavedEntries(raw ? (JSON.parse(raw) as LuckyNumbersEntry[]) : []);
    } catch {
      setSavedEntries([]);
    }
  }, [storageKey]);

  const persistSaved = (next: LuckyNumbersEntry[]) => {
    setSavedEntries(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 40)));
    } catch {
      // ignore
    }
  };

  const currentRange = RANGE_PRESETS.find((r) => r.id === rangeId) || RANGE_PRESETS[3];

  const handleGenerate = () => {
    setGenerated(generateUniqueSet(count, currentRange.min, currentRange.max));
  };

  const handleSaveCurrent = () => {
    const entry: LuckyNumbersEntry = {
      id: `luck_${Date.now()}`,
      numbers: generated,
      modeLabel: `${count} números · Trébol 🍀`,
      rangeLabel: currentRange.label,
      createdAt: new Date().toISOString(),
    };
    persistSaved([entry, ...savedEntries]);
  };

  const handleCopy = async (id: string, nums: number[]) => {
    try {
      await navigator.clipboard.writeText(`🍀 Mis números de la suerte FABRO: ${nums.join(' - ')}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const lifePath = useMemo(() => computeLifePathNumber(customDate), [customDate]);
  const nameVib = useMemo(() => computeNameVibration(customName), [customName]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-emerald-500/30 fabro-shell-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <Clover className="w-4 h-4" />
            <span>Trébol de Cuatro Hojas 🍀 · Bienestar Natural</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Números de la Suerte 🍀
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Tu combinación diaria bajo el emblema del trébol de cuatro hojas, generador personalizable sin repeticiones y vibración numerológica personal.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs shrink-0">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">
            🍀 Número Guía de Hoy ({todayKey})
          </p>
          <p className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums">
            {dailyPersonal.mainSet.join(' · ')}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Interactive Clover Generator */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Generador Trébol Personalizado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Elegí cantidad y rango para sortear combinaciones limpias al instante.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sortear 🍀
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Cantidad de números
              </label>
              <div className="flex gap-1.5">
                {[3, 4, 5, 6].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCount(c)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-bold tabular-nums cursor-pointer ${
                      count === c
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Rango de sorteo
              </label>
              <select
                value={rangeId}
                onChange={(e) => setRangeId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              >
                {RANGE_PRESETS.map((rp) => (
                  <option key={rp.id} value={rp.id}>
                    {rp.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Display Balls */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-wrap items-center justify-center gap-3">
            {generated.map((num, i) => (
              <div
                key={`${num}_${i}`}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-display text-xl font-extrabold flex items-center justify-center shadow-sm tabular-nums border border-emerald-300/40"
              >
                {String(num).padStart(2, '0')}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSaveCurrent}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Guardar combinación
            </button>
            <button
              type="button"
              onClick={() => void handleCopy('current', generated)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copiedId === 'current' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === 'current' ? 'Copiado' : 'Copiar números'}
            </button>
          </div>

          {/* Saved Combinations */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tus combinaciones guardadas ({savedEntries.length})
            </h4>
            {savedEntries.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guardá tus combinaciones favoritas para tenerlas siempre a mano.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {savedEntries.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {item.numbers.join(' · ')}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.modeLabel} · {item.rangeLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopy(item.id, item.numbers)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Copiar"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => persistSaved(savedEntries.filter((x) => x.id !== item.id))}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Numerology & Daily Clover Vibes */}
        <aside className="lg:col-span-5 space-y-5">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Numerología Personal
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nombre o palabra clave
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Fecha de nacimiento (opcional)
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">Vibración del nombre</p>
                <p className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                  {nameVib}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">Sendero de vida</p>
                <p className="font-display text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
                  {lifePath ?? '—'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white">
                Las 4 hojas del trébol FABRO 🍀
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Cada hoja simboliza un pilar de nuestro ecosistema: <strong>Esperanza</strong> (Bienestar),{' '}
                <strong>Aprendizaje</strong> (Estudio), <strong>Vínculo</strong> (Social) y{' '}
                <strong>Prosperidad</strong> (Tus herramientas y proyectos).
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono tabular-nums pt-1">
                Par especial de hoy: {dailyPersonal.powerPair.join(' y ')} · Dígito maestro: {dailyPersonal.cloverDigit}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
