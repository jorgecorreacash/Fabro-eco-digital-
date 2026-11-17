import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeftRight,
  BarChart2,
  Calculator,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  QrCode,
  RefreshCw,
  Save,
  SpellCheck,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { markdownToHtml } from '../../lib/exporters';
import { FabroAIActionStrip } from '../common/FabroAIActionStrip';

type ToolTab = 'cientifica' | 'estadistica' | 'unidades' | 'monedas' | 'qr' | 'editor';

// Safe recursive-descent math expression evaluator (no eval / Function)
function evaluateScientificExpression(raw: string): number {
  const src = raw
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/π/gi, 'pi');
  let pos = 0;

  const peek = () => src[pos] || '';
  const consume = () => src[pos++] || '';

  const parseExpression = (): number => {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  };

  const parseTerm = (): number => {
    let val = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePower();
      if (op === '/' && right === 0) throw new Error('División por cero');
      val = op === '*' ? val * right : val / right;
    }
    return val;
  };

  const parsePower = (): number => {
    const base = parseUnary();
    if (peek() === '^') {
      consume();
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  };

  const parseUnary = (): number => {
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    if (peek() === '(') {
      consume();
      const v = parseExpression();
      if (consume() !== ')') throw new Error('Falta paréntesis de cierre');
      return v;
    }
    const rest = src.slice(pos);
    const numMatch = rest.match(/^(?:\d+\.?\d*|\.\d+)/);
    if (numMatch) {
      pos += numMatch[0].length;
      return Number(numMatch[0]);
    }
    const idMatch = rest.match(/^[a-zA-Z]+/);
    if (idMatch) {
      const fn = idMatch[0].toLowerCase();
      pos += idMatch[0].length;
      if (fn === 'pi') return Math.PI;
      if (fn === 'e') return Math.E;
      if (consume() !== '(') throw new Error(`Falta "(" después de ${fn}`);
      const arg = parseExpression();
      if (consume() !== ')') throw new Error(`Falta ")" después de ${fn}(...)`);
      switch (fn) {
        case 'sin':
          return Math.sin(arg);
        case 'cos':
          return Math.cos(arg);
        case 'tan':
          return Math.tan(arg);
        case 'sqrt':
          if (arg < 0) throw new Error('Raíz negativa');
          return Math.sqrt(arg);
        case 'ln':
          if (arg <= 0) throw new Error('Logaritmo no positivo');
          return Math.log(arg);
        case 'log':
          if (arg <= 0) throw new Error('Logaritmo no positivo');
          return Math.log10(arg);
        case 'abs':
          return Math.abs(arg);
        default:
          throw new Error(`Función no reconocida: ${fn}`);
      }
    }
    throw new Error('Expresión matemática inválida');
  };

  if (!src) throw new Error('Ingresá una expresión');
  const result = parseExpression();
  if (pos < src.length) throw new Error(`Carácter inesperado "${src[pos]}"`);
  if (!Number.isFinite(result)) throw new Error('Resultado fuera de rango');
  return result;
}

const UNIT_GROUPS: Record<
  string,
  {
    label: string;
    units: Record<string, { label: string; toBase: (v: number) => number; fromBase: (v: number) => number }>;
  }
> = {
  longitud: {
    label: 'Longitud',
    units: {
      m: { label: 'Metro (m)', toBase: (v) => v, fromBase: (v) => v },
      km: { label: 'Kilómetro (km)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      cm: { label: 'Centímetro (cm)', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
      mm: { label: 'Milímetro (mm)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      in: { label: 'Pulgada (in)', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
      mi: { label: 'Milla (mi)', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
    },
  },
  masa: {
    label: 'Masa',
    units: {
      kg: { label: 'Kilogramo (kg)', toBase: (v) => v, fromBase: (v) => v },
      g: { label: 'Gramo (g)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      mg: { label: 'Miligramo (mg)', toBase: (v) => v / 1e6, fromBase: (v) => v * 1e6 },
      lb: { label: 'Libra (lb)', toBase: (v) => v * 0.45359237, fromBase: (v) => v / 0.45359237 },
    },
  },
  temperatura: {
    label: 'Temperatura',
    units: {
      c: { label: 'Celsius (°C)', toBase: (v) => v, fromBase: (v) => v },
      f: { label: 'Fahrenheit (°F)', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      k: { label: 'Kelvin (K)', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    },
  },
  datos: {
    label: 'Almacenamiento digital',
    units: {
      mb: { label: 'Megabyte (MB)', toBase: (v) => v, fromBase: (v) => v },
      kb: { label: 'Kilobyte (KB)', toBase: (v) => v / 1024, fromBase: (v) => v * 1024 },
      gb: { label: 'Gigabyte (GB)', toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
      tb: { label: 'Terabyte (TB)', toBase: (v) => v * 1024 * 1024, fromBase: (v) => v / (1024 * 1024) },
    },
  },
};

const COMMON_SPELLING_RULES: Array<{ pattern: RegExp; tip: string }> = [
  { pattern: /\s{2,}/g, tip: 'Espacios dobles consecutivos detectados.' },
  { pattern: /\b(atravez|atravéz)\b/gi, tip: 'Posible error ortográfico: "a través" se escribe separado y con tilde.' },
  { pattern: /\b(haver|haiga)\b/gi, tip: 'Forma no normativa detectada ("haber" / "haya").' },
  { pattern: /\b(enserio)\b/gi, tip: 'En registro formal suele escribirse "en serio" (separado).' },
  { pattern: /\b(osea)\b/gi, tip: 'El conector explicativo correcto es "o sea" (separado).' },
  { pattern: /\b(hubieron\s+\w+)\b/gi, tip: 'El verbo "haber" impersonal se usa en singular ("hubo", no "hubieron").' },
];

export const FabroToolsView: React.FC = () => {
  const { createNote, selectedSubjectId, subjects } = useFabro();

  const [tab, setTab] = useState<ToolTab>('cientifica');
  const [notice, setNotice] = useState<string | null>(null);

  // 1. Scientific calculator
  const [expr, setExpr] = useState('sqrt(144) + sin(pi/2) * 3^2');
  const [calcHistory, setCalcHistory] = useState<Array<{ expr: string; result: string }>>([]);
  const [calcError, setCalcError] = useState<string | null>(null);

  const runCalculation = () => {
    setCalcError(null);
    try {
      const value = evaluateScientificExpression(expr);
      const formatted = Number.isInteger(value) ? String(value) : Number(value.toPrecision(10)).toString();
      setCalcHistory((prev) => [{ expr, result: formatted }, ...prev].slice(0, 12));
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : 'Error de cálculo');
    }
  };

  // 2. Statistical calculator
  const [statsInput, setStatsInput] = useState('12, 15, 18, 18, 21, 24, 30');
  const stats = useMemo(() => {
    const nums = statsInput
      .split(/[\s,;]+/)
      .map((s) => Number(s.replace(',', '.')))
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;
    const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const freq = new Map<number, number>();
    sorted.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
    let maxFreq = 0;
    let modeVal = sorted[0];
    freq.forEach((f, val) => {
      if (f > maxFreq) {
        maxFreq = f;
        modeVal = val;
      }
    });
    const variancePop = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDevPop = Math.sqrt(variancePop);
    return {
      n,
      sum,
      mean,
      median,
      mode: maxFreq > 1 ? String(modeVal) : 'Sin moda única',
      min: sorted[0],
      max: sorted[n - 1],
      range: sorted[n - 1] - sorted[0],
      variancePop,
      stdDevPop,
    };
  }, [statsInput]);

  // 3. Unit converter
  const [unitGroupKey, setUnitGroupKey] = useState<string>('longitud');
  const [unitValue, setUnitValue] = useState<string>('10');
  const [fromUnit, setFromUnit] = useState<string>('km');
  const [toUnit, setToUnit] = useState<string>('m');

  const unitResult = useMemo(() => {
    const grp = UNIT_GROUPS[unitGroupKey];
    const num = Number(unitValue);
    if (!grp || !Number.isFinite(num)) return '';
    const f = grp.units[fromUnit];
    const t = grp.units[toUnit];
    if (!f || !t) return '';
    const base = f.toBase(num);
    const out = t.fromBase(base);
    return Number(out.toPrecision(8)).toString();
  }, [fromUnit, toUnit, unitGroupKey, unitValue]);

  // 4. Live FX currency converter
  const [fxBase, setFxBase] = useState('USD');
  const [fxAmount, setFxAmount] = useState('100');
  const [fxTarget, setFxTarget] = useState('EUR');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [fxDate, setFxDate] = useState('');
  const [fxSource, setFxSource] = useState('');
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);

  const loadFxRates = async (base: string) => {
    setFxLoading(true);
    setFxError(null);
    try {
      const resp = await fetch(`/api/tools/fx-rates?base=${encodeURIComponent(base)}`);
      const data = await resp.json();
      if (!resp.ok || !data?.rates) {
        throw new Error(data?.error || 'No se pudieron obtener cotizaciones en vivo.');
      }
      setFxRates(data.rates);
      setFxDate(data.date || '');
      setFxSource(data.source || 'Frankfurter / Banco Central Europeo');
    } catch (err) {
      setFxError(err instanceof Error ? err.message : 'Error al consultar cotizaciones.');
    } finally {
      setFxLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'monedas' && Object.keys(fxRates).length === 0) {
      void loadFxRates(fxBase);
    }
  }, [fxBase, fxRates, tab]);

  // 5. QR Generator
  const [qrInput, setQrInput] = useState('https://scholar.google.com');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (tab !== 'qr') return;
    const txt = qrInput.trim() || 'https://fabro.edu';
    void QRCode.toDataURL(txt, { width: 280, margin: 2 }).then(setQrDataUrl).catch(() => {});
    if (qrCanvasRef.current) {
      void QRCode.toCanvas(qrCanvasRef.current, txt, { width: 280, margin: 2 }).catch(() => {});
    }
  }, [qrInput, tab]);

  // 6. Local Text Editor, Counter & Spell Checker
  const [editorTitle, setEditorTitle] = useState('Borrador académico');
  const [editorText, setEditorText] = useState('');

  const textStats = useMemo(() => {
    const trimmed = editorText.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = editorText.length;
    const charsNoSpace = editorText.replace(/\s/g, '').length;
    const sentences = trimmed ? trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0).length : 0;
    const paragraphs = trimmed ? trimmed.split(/\n+/).filter((p) => p.trim().length > 0).length : 0;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    const issues: string[] = [];
    for (const rule of COMMON_SPELLING_RULES) {
      if (rule.pattern.test(editorText)) {
        issues.push(rule.tip);
      }
    }
    return { words, chars, charsNoSpace, sentences, paragraphs, readMinutes, issues };
  }, [editorText]);

  const handleSaveEditorToNotes = async () => {
    if (!editorText.trim()) return;
    await createNote({
      subjectId: selectedSubjectId || subjects[0]?.id || '',
      unit: '',
      folder: 'FABRO TOOLS',
      title: editorTitle.trim() || 'Texto editado en FABRO TOOLS',
      contentHtml: markdownToHtml(editorText),
      contentText: editorText,
      tags: ['fabro-tools', 'redaccion'],
      attachments: [],
      offlineAvailable: true,
    });
    setNotice('Borrador guardado en Apuntes.');
  };

  const activeContentForAI =
    tab === 'editor' && editorText.trim()
      ? editorText
      : tab === 'estadistica' && stats
      ? `Datos: ${statsInput}\nN=${stats.n}, Media=${stats.mean.toFixed(4)}, Mediana=${stats.median}, Desv. Estándar=${stats.stdDevPop.toFixed(4)}`
      : `Resultado herramienta FABRO TOOLS (${tab}): ${expr}`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            FABRO TOOLS · UTILIDADES LOCALES Y EN VIVO
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Calculadoras, Conversores, Códigos QR y Editor de Redacción
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl">
            Herramientas exactas ejecutadas localmente en tu navegador (sin consumo de cuota IA), excepto el conversor de monedas que consulta tipos de cambio reales del Banco Central Europeo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'cientifica', label: 'Calculadora científica', icon: Calculator },
            { id: 'estadistica', label: 'Calculadora estadística', icon: BarChart2 },
            { id: 'unidades', label: 'Conversor de unidades', icon: ArrowLeftRight },
            { id: 'monedas', label: 'Monedas en vivo', icon: Coins },
            { id: 'qr', label: 'Generador QR local', icon: QrCode },
            { id: 'editor', label: 'Editor y corrector local', icon: SpellCheck },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as ToolTab)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                  active
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {tab === 'cientifica' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runCalculation();
              }}
              placeholder="Ej.: (25^2 - sqrt(16)) / log(100)"
              className="flex-1 min-w-[240px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={runCalculation}
              className="rounded-xl bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              Calcular (=)
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['sin(', 'cos(', 'tan(', 'sqrt(', 'log(', 'ln(', 'abs(', 'pi', 'e', '^'].map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => setExpr((prev) => prev + tok)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500/50 cursor-pointer"
              >
                {tok}
              </button>
            ))}
          </div>
          {calcError && <p className="text-rose-500 font-medium">{calcError}</p>}
          {calcHistory.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 pt-2">
              {calcHistory.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between gap-2 font-mono">
                  <span className="text-slate-600 dark:text-slate-300">{item.expr}</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 tabular-nums">= {item.result}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'estadistica' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs">
          <label className="block font-semibold text-slate-700 dark:text-slate-300">
            Ingresá valores numéricos separados por coma, espacio o salto de línea:
          </label>
          <textarea
            rows={3}
            value={statsInput}
            onChange={(e) => setStatsInput(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3 font-mono text-slate-900 dark:text-white"
          />
          {stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Muestra (n)', val: String(stats.n) },
                { label: 'Media', val: stats.mean.toFixed(4) },
                { label: 'Mediana', val: stats.median.toFixed(4) },
                { label: 'Moda', val: stats.mode },
                { label: 'Desv. estándar', val: stats.stdDevPop.toFixed(4) },
                { label: 'Varianza', val: stats.variancePop.toFixed(4) },
                { label: 'Suma', val: stats.sum.toFixed(2) },
                { label: 'Mínimo', val: String(stats.min) },
                { label: 'Máximo', val: String(stats.max) },
                { label: 'Rango', val: stats.range.toFixed(2) },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3"
                >
                  <p className="text-[11px] text-slate-500">{m.label}</p>
                  <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {m.val}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">Ingresá al menos un número válido para calcular.</p>
          )}
        </section>
      )}

      {tab === 'unidades' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            {Object.entries(UNIT_GROUPS).map(([key, grp]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setUnitGroupKey(key);
                  const keys = Object.keys(grp.units);
                  setFromUnit(keys[0]);
                  setToUnit(keys[1] || keys[0]);
                }}
                className={`rounded-lg border px-3 py-1.5 font-semibold cursor-pointer ${
                  unitGroupKey === key
                    ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-semibold mb-1">Valor</label>
              <input
                type="number"
                value={unitValue}
                onChange={(e) => setUnitValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Desde</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2"
              >
                {Object.entries(UNIT_GROUPS[unitGroupKey].units).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Hacia</label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2"
              >
                {Object.entries(UNIT_GROUPS[unitGroupKey].units).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 font-mono text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300">
            {unitValue || 0} {fromUnit} = {unitResult || '—'} {toUnit}
          </div>
        </section>
      )}

      {tab === 'monedas' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block font-semibold mb-1">Monto</label>
              <input
                type="number"
                value={fxAmount}
                onChange={(e) => setFxAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Moneda origen</label>
              <select
                value={fxBase}
                onChange={(e) => {
                  const next = e.target.value;
                  setFxBase(next);
                  void loadFxRates(next);
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2"
              >
                {['USD', 'EUR', 'BRL', 'MXN', 'CLP', 'GBP', 'JPY', 'CHF'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Moneda destino</label>
              <select
                value={fxTarget}
                onChange={(e) => setFxTarget(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2"
              >
                {[fxBase, ...Object.keys(fxRates)].filter((v, i, a) => a.indexOf(v) === i).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void loadFxRates(fxBase)}
              disabled={fxLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fxLoading ? 'animate-spin' : ''}`} />
              Actualizar tasas
            </button>
          </div>

          {fxError && <p className="text-rose-500 font-medium">{fxError}</p>}

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
            <p className="font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {fxAmount || 0} {fxBase} ={' '}
              {fxTarget === fxBase
                ? Number(fxAmount || 0).toFixed(2)
                : fxRates[fxTarget]
                ? (Number(fxAmount || 0) * fxRates[fxTarget]).toFixed(4)
                : '—'}{' '}
              {fxTarget}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Fuente real: {fxSource || 'Banco Central Europeo (Frankfurter API)'}{' '}
              {fxDate ? `· Fecha de referencia: ${fxDate}` : ''}
            </p>
          </div>
        </section>
      )}

      {tab === 'qr' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-center text-xs">
          <div className="md:col-span-7 space-y-3">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              URL de investigación, apunte o texto para codificar en QR:
            </label>
            <textarea
              rows={3}
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3 text-slate-900 dark:text-white"
            />
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`fabro_qr_${Date.now()}.png`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700"
              >
                <Download className="w-4 h-4" />
                Descargar QR en PNG
              </a>
            )}
          </div>
          <div className="md:col-span-5 flex justify-center">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-4">
              <canvas ref={qrCanvasRef} />
            </div>
          </div>
        </section>
      )}

      {tab === 'editor' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-semibold text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => void handleSaveEditorToNotes()}
              disabled={!editorText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar en Apuntes
            </button>
          </div>

          <textarea
            rows={8}
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            placeholder="Redactá o pegá tu texto para medir extensión, tiempo de lectura y revisar errores formales locales..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3.5 text-sm text-slate-900 dark:text-white leading-relaxed"
          />

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {[
              { label: 'Palabras', val: textStats.words },
              { label: 'Caracteres', val: textStats.chars },
              { label: 'Sin espacios', val: textStats.charsNoSpace },
              { label: 'Oraciones', val: textStats.sentences },
              { label: 'Párrafos', val: textStats.paragraphs },
              { label: 'Lectura (min)', val: textStats.readMinutes },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-2.5"
              >
                <p className="text-[11px] text-slate-500">{s.label}</p>
                <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                  {s.val}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5 space-y-1.5">
            <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-500" />
              Revisión ortográfica y de estilo local ({textStats.issues.length})
            </p>
            {textStats.issues.length === 0 ? (
              <p className="text-emerald-600 dark:text-emerald-400">
                Sin advertencias locales en este borrador.
              </p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-amber-600 dark:text-amber-300">
                {textStats.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Acciones directas con FABRO IA
        </p>
        <FabroAIActionStrip
          title={tab === 'editor' ? editorTitle : `FABRO TOOLS · ${tab}`}
          content={activeContentForAI}
          onSavedNote={(msg) => setNotice(msg)}
        />
      </section>
    </div>
  );
};
