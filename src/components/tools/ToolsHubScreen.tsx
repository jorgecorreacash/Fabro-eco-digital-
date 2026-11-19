import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Check,
  Clock,
  Copy,
  Cpu,
  Delete,
  FileText,
  Flag,
  HeartPulse,
  History,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  Pause,
  Percent,
  Pin,
  Play,
  Receipt,
  RefreshCw,
  RotateCcw,
  Ruler,
  Search,
  Settings,
  SlidersHorizontal,
  SunMoon,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { ALL_SUBMENUS, SECTOR_PALETTES } from '../../data/ecosystemCatalog';
import { vaultGet, vaultSet } from '../../services/localVault';
import {
  convertUnitValue,
  evaluateMathExpression,
  formatMathNumber,
  generateSecurePassword,
  UNIT_CATEGORIES,
  type UnitCategoryId,
} from '../../services/toolsEngine';
import { playSoftBell } from '../../services/webAudioPtt';
import type { CalculatorHistoryEntry, FiveSectorId, SectorId, SubmenuId } from '../../types/ecosystem';

type CalcTab = 'scientifica' | 'porcentajes' | 'historial';
type DockTab = 'conversor' | 'cronometro' | 'gastos' | 'texto-claves';
type DirectoryFilter =
  | 'todas'
  | 'instrumentos'
  | 'estudio'
  | 'bienestar'
  | 'social-info'
  | 'ia-config';

interface UnifiedToolCard {
  id: string;
  title: string;
  subtitle: string;
  groupText: string;
  category: Exclude<DirectoryFilter, 'todas'>;
  keywords: string;
  gradientCss: string;
  icon: React.FC<{ className?: string }>;
  pinnable?: { sector: FiveSectorId; submenu: SubmenuId };
  onOpen: () => void;
}

const SECTOR_ICON_MAP: Record<FiveSectorId, React.FC<{ className?: string }>> = {
  estudio: BookOpen,
  bienestar: HeartPulse,
  social: MessageSquare,
  ia: Cpu,
  configuracion: Settings,
};

function formatStopwatchMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const cs = Math.floor((safe % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatCountdownSec(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export const ToolsHubScreen: React.FC = () => {
  const {
    navigateTo,
    isToolPinned,
    togglePinTool,
    pinnedTools,
    setFloatingChatOpen,
    profile,
  } = useEcosystem();

  const workbenchRef = useRef<HTMLElement | null>(null);

  // Global unified directory filter
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('todas');

  // Calculator state
  const [calcTab, setCalcTab] = useState<CalcTab>('scientifica');
  const [expression, setExpression] = useState('1250 * 1.21');
  const [lastAnswer, setLastAnswer] = useState<number>(1512.5);
  const [calcOutput, setCalcOutput] = useState('1512.5');
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcHistory, setCalcHistory] = useState<CalculatorHistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Percentage & Rule-of-3 quick mode
  const [pctValue, setPctValue] = useState('15');
  const [pctBase, setPctBase] = useState('24000');
  const [ruleA, setRuleA] = useState('100');
  const [ruleB, setRuleB] = useState('350');
  const [ruleC, setRuleC] = useState('45');

  // Right Instrument Dock state
  const [dockTab, setDockTab] = useState<DockTab>('conversor');

  // 1. Unit Converter
  const [unitCat, setUnitCat] = useState<UnitCategoryId>('longitud');
  const [unitFrom, setUnitFrom] = useState('km');
  const [unitTo, setUnitTo] = useState('mi');
  const [unitInput, setUnitInput] = useState('10');

  // 2. Stopwatch & Countdown
  const [timerMode, setTimerMode] = useState<'cronometro' | 'regresiva'>('cronometro');
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsedMs, setSwElapsedMs] = useState(0);
  const [swLaps, setSwLaps] = useState<string[]>([]);
  const swStartRef = useRef<number>(0);

  const [cdMinutesInput, setCdMinutesInput] = useState(5);
  const [cdSecondsLeft, setCdSecondsLeft] = useState(300);
  const [cdRunning, setCdRunning] = useState(false);

  // 3. Split Bill / Expense Calculator
  const [billTotal, setBillTotal] = useState('48000');
  const [billTipPct, setBillTipPct] = useState('10');
  const [billPeople, setBillPeople] = useState('4');

  // 4. Secure Password & Text Utility
  const [pwLength, setPwLength] = useState(14);
  const [pwUpper, setPwUpper] = useState(true);
  const [pwNumbers, setPwNumbers] = useState(true);
  const [pwSymbols, setPwSymbols] = useState(true);
  const [pwPinOnly, setPwPinOnly] = useState(false);
  const [generatedPw, setGeneratedPw] = useState(() =>
    generateSecurePassword({
      length: 14,
      includeUpper: true,
      includeNumbers: true,
      includeSymbols: true,
      pinOnly: false,
    })
  );
  const [textDraft, setTextDraft] = useState('');

  // Load calculator history from IndexedDB
  useEffect(() => {
    let active = true;
    void vaultGet<CalculatorHistoryEntry[]>('calculator_history', []).then((items) => {
      if (active && Array.isArray(items)) setCalcHistory(items);
    });
    return () => {
      active = false;
    };
  }, []);

  // Stopwatch ticker
  useEffect(() => {
    if (!swRunning) return;
    swStartRef.current = performance.now() - swElapsedMs;
    const id = window.setInterval(() => {
      setSwElapsedMs(performance.now() - swStartRef.current);
    }, 32);
    return () => window.clearInterval(id);
  }, [swRunning]);

  // Countdown ticker
  useEffect(() => {
    if (!cdRunning) return;
    const id = window.setInterval(() => {
      setCdSecondsLeft((prev) => {
        if (prev <= 1) {
          setCdRunning(false);
          playSoftBell('focus-end');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [cdRunning]);

  const markCopied = (key: string, text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    setCopiedId(key);
    window.setTimeout(() => setCopiedId((cur) => (cur === key ? null : cur)), 1600);
  };

  // Live preview evaluation while typing
  const liveEval = useMemo(
    () => evaluateMathExpression(expression, lastAnswer),
    [expression, lastAnswer]
  );

  const appendToken = (token: string) => {
    setCalcError(null);
    setExpression((prev) => (prev === '0' && /^[0-9]$/.test(token) ? token : `${prev}${token}`));
  };

  const handleCalculateEquals = () => {
    const res = evaluateMathExpression(expression, lastAnswer);
    if (!res.ok || res.value === undefined || !res.formatted) {
      setCalcError(res.error || 'Expresión inválida');
      return;
    }
    setCalcError(null);
    setCalcOutput(res.formatted);
    setLastAnswer(res.value);

    const entry: CalculatorHistoryEntry = {
      id: `calc-${Date.now()}`,
      expression: expression.trim(),
      result: res.formatted,
      createdAt: new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setCalcHistory((prev) => {
      const next = [entry, ...prev].slice(0, 20);
      void vaultSet('calculator_history', next);
      return next;
    });
  };

  const handleClearCalc = () => {
    setExpression('');
    setCalcOutput('0');
    setCalcError(null);
  };

  const handleBackspaceCalc = () => {
    setCalcError(null);
    setExpression((prev) => prev.slice(0, -1));
  };

  const handleCalcKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCalculateEquals();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClearCalc();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspaceCalc();
    } else if (/^[0-9+\-*/.^()%]$/.test(e.key)) {
      e.preventDefault();
      appendToken(e.key);
    }
  };

  // Unit category change resets unitFrom / unitTo cleanly
  const activeUnitCat = UNIT_CATEGORIES.find((c) => c.id === unitCat) || UNIT_CATEGORIES[0];
  const convertedVal = useMemo(() => {
    const num = Number(unitInput.replace(',', '.'));
    if (!Number.isFinite(num)) return '0';
    return formatMathNumber(convertUnitValue(unitCat, unitFrom, unitTo, num));
  }, [unitCat, unitFrom, unitTo, unitInput]);

  const handleSelectUnitCategory = (catId: UnitCategoryId) => {
    const cat = UNIT_CATEGORIES.find((c) => c.id === catId) || UNIT_CATEGORIES[0];
    setUnitCat(catId);
    setUnitFrom(cat.units[0].id);
    setUnitTo(cat.units[1]?.id || cat.units[0].id);
  };

  // Percentage calculations
  const pctNum = Number(pctValue.replace(',', '.')) || 0;
  const pctBaseNum = Number(pctBase.replace(',', '.')) || 0;
  const pctAmount = (pctBaseNum * pctNum) / 100;
  const pctPlus = pctBaseNum + pctAmount;
  const pctMinus = pctBaseNum - pctAmount;

  const rA = Number(ruleA.replace(',', '.')) || 0;
  const rB = Number(ruleB.replace(',', '.')) || 0;
  const rC = Number(ruleC.replace(',', '.')) || 0;
  const ruleX = rA !== 0 ? (rB * rC) / rA : 0;

  // Split bill calculations
  const billNum = Math.max(0, Number(billTotal.replace(',', '.')) || 0);
  const tipNum = Math.max(0, Number(billTipPct.replace(',', '.')) || 0);
  const peopleNum = Math.max(1, Math.floor(Number(billPeople) || 1));
  const tipAmount = (billNum * tipNum) / 100;
  const billGrandTotal = billNum + tipAmount;
  const perPerson = billGrandTotal / peopleNum;

  // Text metrics
  const textStats = useMemo(() => {
    const trimmed = textDraft.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = textDraft.length;
    const charsNoSpace = textDraft.replace(/\s/g, '').length;
    const lines = textDraft ? textDraft.split(/\r\n|\r|\n/).length : 0;
    const readMin = Math.max(1, Math.ceil(words / 200));
    return { words, chars, charsNoSpace, lines, readMin };
  }, [textDraft]);

  const jumpToWorkbench = (targetDock?: DockTab, targetCalc?: CalcTab) => {
    if (targetDock) setDockTab(targetDock);
    if (targetCalc) setCalcTab(targetCalc);
    workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Build unified directory of ALL tools across FABRO + built-in instruments
  const allUnifiedTools: UnifiedToolCard[] = useMemo(() => {
    const builtinInstruments: UnifiedToolCard[] = [
      {
        id: 'inst-calc',
        title: 'Calculadora Científica y Porcentajes',
        subtitle: 'Operaciones, funciones trigonométricas, raíz, potencias, regla de 3 e historial offline.',
        groupText: 'Instrumentos · Cálculo',
        category: 'instrumentos',
        keywords: 'calculadora cientifica porcentajes descuentos regla de tres matematicas',
        gradientCss: 'linear-gradient(135deg, #0EA5E9, #2563EB)',
        icon: Calculator,
        onOpen: () => jumpToWorkbench(undefined, 'scientifica'),
      },
      {
        id: 'inst-conv',
        title: 'Conversor Universal de Unidades',
        subtitle: 'Longitud, masa, temperatura, datos digitales, velocidad y tiempo al instante.',
        groupText: 'Instrumentos · Medición',
        category: 'instrumentos',
        keywords: 'conversor unidades metros kilometros kilos libras celsius fahrenheit gb mb',
        gradientCss: 'linear-gradient(135deg, #6366F1, #06B6D4)',
        icon: Ruler,
        onOpen: () => jumpToWorkbench('conversor'),
      },
      {
        id: 'inst-timer',
        title: 'Cronómetro de Precisión y Regresiva',
        subtitle: 'Cronómetro con registro de vueltas y temporizador con alarma Web Audio.',
        groupText: 'Instrumentos · Tiempo',
        category: 'instrumentos',
        keywords: 'cronometro vueltas laps temporizador cuenta regresiva alarma',
        gradientCss: 'linear-gradient(135deg, #0891B2, #10B981)',
        icon: Timer,
        onOpen: () => jumpToWorkbench('cronometro'),
      },
      {
        id: 'inst-gastos',
        title: 'Divisor de Gastos y Propinas',
        subtitle: 'Calculá cuánto paga cada persona con recargo o propina y copiá el resumen.',
        groupText: 'Instrumentos · Finanzas rápidas',
        category: 'instrumentos',
        keywords: 'divisor gastos cuentas propina personas dinero repartir',
        gradientCss: 'linear-gradient(135deg, #F59E0B, #EA580C)',
        icon: Receipt,
        onOpen: () => jumpToWorkbench('gastos'),
      },
      {
        id: 'inst-claves',
        title: 'Generador de Claves y Analizador de Texto',
        subtitle: 'Generá contraseñas/PIN criptográficos locales y medí palabras, caracteres y lectura.',
        groupText: 'Instrumentos · Seguridad y Texto',
        category: 'instrumentos',
        keywords: 'contrasenas claves seguras pin generador contador palabras caracteres texto',
        gradientCss: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
        icon: KeyRound,
        onOpen: () => jumpToWorkbench('texto-claves'),
      },
      {
        id: 'panel-hoy-cosmos',
        title: 'Hoy y Cosmos · Hora, Clima, Luna y Frases',
        subtitle: 'Reloj en vivo, clima Open-Meteo, estado lunar, horóscopo y panel de frases comunitarias.',
        groupText: 'Información diaria · Hoy y Cosmos',
        category: 'social-info',
        keywords: 'hoy cosmos hora reloj clima luna horoscopo frases comunidad',
        gradientCss: 'linear-gradient(135deg, #06B6D4, #F59E0B)',
        icon: SunMoon,
        onOpen: () => navigateTo('hoy', 'hoy-cosmos'),
      },
      {
        id: 'panel-espacio',
        title: 'Espacio de Trabajo Configurable',
        subtitle: 'Personalizá columnas, orden y módulos fijados para tener tu escritorio a medida.',
        groupText: 'Organización · Escritorio',
        category: 'ia-config',
        keywords: 'espacio trabajo configurable fijar paneles widgets',
        gradientCss: 'linear-gradient(135deg, #2563EB, #7C3AED)',
        icon: LayoutGrid,
        onOpen: () => navigateTo('inicio', 'dashboard'),
      },
      {
        id: 'panel-chat-flotante',
        title: 'Chat Flotante y Mini-Ventana',
        subtitle: 'Mantené conversaciones abiertas en segundo plano sobre cualquier herramienta.',
        groupText: 'Comunicación · Segundo plano',
        category: 'social-info',
        keywords: 'chat flotante segundo plano pip mini ventana mensajes',
        gradientCss: 'linear-gradient(135deg, #EC4899, #7C3AED)',
        icon: MessageSquare,
        onOpen: () => setFloatingChatOpen(true),
      },
    ];

    const sectorTools: UnifiedToolCard[] = ALL_SUBMENUS.map((sub) => {
      const palette = SECTOR_PALETTES[sub.sector];
      const Icon = SECTOR_ICON_MAP[sub.sector];
      const category: Exclude<DirectoryFilter, 'todas'> =
        sub.sector === 'estudio'
          ? 'estudio'
          : sub.sector === 'bienestar'
          ? 'bienestar'
          : sub.sector === 'social'
          ? 'social-info'
          : 'ia-config';

      return {
        id: `${sub.sector}:${sub.id}`,
        title: sub.label,
        subtitle: sub.description,
        groupText: `${sub.groupLabel}`,
        category,
        keywords: `${sub.label} ${sub.description} ${sub.keywords} ${sub.sector}`,
        gradientCss: palette.gradientCss,
        icon: Icon,
        pinnable: { sector: sub.sector, submenu: sub.id },
        onOpen: () => navigateTo(sub.sector, sub.id),
      };
    });

    return [...builtinInstruments, ...sectorTools];
  }, [navigateTo, setFloatingChatOpen]);

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUnifiedTools.filter((tool) => {
      if (directoryFilter !== 'todas' && tool.category !== directoryFilter) return false;
      if (!q) return true;
      return `${tool.title} ${tool.subtitle} ${tool.groupText} ${tool.keywords}`
        .toLowerCase()
        .includes(q);
    });
  }, [allUnifiedTools, directoryFilter, searchQuery]);

  const calcButtons: Array<{
    label: string;
    value: string;
    kind: 'num' | 'op' | 'fn' | 'action' | 'eq';
  }> = [
    { label: 'sin', value: 'sin(', kind: 'fn' },
    { label: 'cos', value: 'cos(', kind: 'fn' },
    { label: 'tan', value: 'tan(', kind: 'fn' },
    { label: '√', value: 'sqrt(', kind: 'fn' },
    { label: 'x²', value: '^2', kind: 'fn' },

    { label: 'log', value: 'log(', kind: 'fn' },
    { label: 'ln', value: 'ln(', kind: 'fn' },
    { label: 'π', value: 'π', kind: 'fn' },
    { label: '(', value: '(', kind: 'fn' },
    { label: ')', value: ')', kind: 'fn' },

    { label: '7', value: '7', kind: 'num' },
    { label: '8', value: '8', kind: 'num' },
    { label: '9', value: '9', kind: 'num' },
    { label: '÷', value: '/', kind: 'op' },
    { label: 'AC', value: 'AC', kind: 'action' },

    { label: '4', value: '4', kind: 'num' },
    { label: '5', value: '5', kind: 'num' },
    { label: '6', value: '6', kind: 'num' },
    { label: '×', value: '*', kind: 'op' },
    { label: '⌫', value: 'BACK', kind: 'action' },

    { label: '1', value: '1', kind: 'num' },
    { label: '2', value: '2', kind: 'num' },
    { label: '3', value: '3', kind: 'num' },
    { label: '−', value: '-', kind: 'op' },
    { label: 'ANS', value: 'ANS', kind: 'fn' },

    { label: '0', value: '0', kind: 'num' },
    { label: '.', value: '.', kind: 'num' },
    { label: '^', value: '^', kind: 'fn' },
    { label: '+', value: '+', kind: 'op' },
    { label: '=', value: '=', kind: 'eq' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Futuristic Precision Command Header */}
      <section className="relative overflow-hidden rounded-2xl border fabro-futuristic-panel p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-65 fabro-futuristic-grid"
        />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold fabro-accent-text">
                FABRO · Suite Multiuso Integrada
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                Centro Unificado de Herramientas
              </h1>
              <p className="text-xs sm:text-sm fabro-muted leading-relaxed">
                {allUnifiedTools.length} utilidades reunidas para {profile.displayName} · Calculadora científica, conversor, cronómetro y acceso directo a todo el ecosistema.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigateTo('inicio', 'dashboard')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <SlidersHorizontal className="w-4 h-4 fabro-accent-text" />
                Mi Espacio ({pinnedTools.length})
              </button>
              <button
                type="button"
                onClick={() => setFloatingChatOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border fabro-accent-border fabro-accent-bg px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <MessageSquare className="w-4 h-4" />
                Chat Flotante
              </button>
            </div>
          </div>

          {/* Unified Search + Category Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t fabro-border">
            <div className="relative w-full lg:w-80 shrink-0">
              <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar calculadora, conversor, Pomodoro, BYOK..."
                aria-label="Filtrar todas las herramientas de FABRO"
                className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface pl-9 pr-9 py-2 text-xs fabro-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar filtro"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 fabro-muted cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div
              role="tablist"
              aria-label="Categorías de herramientas"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0"
            >
              {(
                [
                  { id: 'todas', label: `Todas (${allUnifiedTools.length})` },
                  { id: 'instrumentos', label: 'Instrumentos' },
                  { id: 'estudio', label: 'Estudio' },
                  { id: 'bienestar', label: 'Bienestar' },
                  { id: 'social-info', label: 'Social y Hoy' },
                  { id: 'ia-config', label: 'IA y Config' },
                ] as Array<{ id: DirectoryFilter; label: string }>
              ).map((tab) => {
                const active = directoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDirectoryFilter(tab.id)}
                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'fabro-accent-border fabro-accent-bg'
                        : 'fabro-border fabro-surface fabro-muted hover:opacity-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Futuristic Multi-Use Instrument Workbench (Calculator + 4-in-1 Utility Dock) */}
      <section
        ref={workbenchRef}
        aria-label="Banco de instrumentos y calculadora"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
      >
        {/* Left: Scientific & Percentage Calculator */}
        <div
          tabIndex={0}
          onKeyDown={handleCalcKeyDown}
          className="lg:col-span-5 rounded-2xl border fabro-futuristic-panel p-5 flex flex-col justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fabro-accent)]"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0EA5E9, #2563EB)' }}
                >
                  <Calculator className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold truncate">Calculadora</h2>
                  <p className="text-[11px] fabro-muted truncate">
                    Teclado físico habilitado · Grados (DEG)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
                {(
                  [
                    { id: 'scientifica', label: 'Científica' },
                    { id: 'porcentajes', label: '% / Regla 3' },
                    { id: 'historial', label: `Hist. (${calcHistory.length})` },
                  ] as Array<{ id: CalcTab; label: string }>
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCalcTab(t.id)}
                    className={`min-h-[32px] rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                      calcTab === t.id ? 'fabro-surface shadow-xs' : 'fabro-muted'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {calcTab === 'scientifica' && (
              <>
                {/* Instrument Readout */}
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono fabro-muted">
                    <span className="truncate">ANS = {formatMathNumber(lastAnswer)}</span>
                    <button
                      type="button"
                      onClick={() => markCopied('calc-res', calcOutput)}
                      className="inline-flex items-center gap-1 font-sans font-semibold hover:opacity-100 cursor-pointer shrink-0"
                    >
                      {copiedId === 'calc-res' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={expression}
                    onChange={(e) => {
                      setCalcError(null);
                      setExpression(e.target.value);
                    }}
                    aria-label="Expresión matemática"
                    placeholder="0"
                    className="w-full bg-transparent text-right font-mono text-sm fabro-muted focus:outline-none tabular-nums"
                  />

                  <div className="flex items-baseline justify-between gap-2 pt-1 border-t fabro-border">
                    <span className="text-[11px] font-medium fabro-muted shrink-0">
                      {calcError ? (
                        <span className="text-rose-600 dark:text-rose-400">{calcError}</span>
                      ) : liveEval.ok && liveEval.formatted ? (
                        `≈ ${liveEval.formatted}`
                      ) : (
                        'Listo'
                      )}
                    </span>
                    <p
                      data-testid="calc-display"
                      className="font-mono text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight truncate"
                    >
                      {calcOutput}
                    </p>
                  </div>
                </div>

                {/* Tactile 5x6 Keypad */}
                <div className="grid grid-cols-5 gap-1.5" data-no-swipe="true">
                  {calcButtons.map((btn) => {
                    const baseStyle =
                      btn.kind === 'eq'
                        ? 'fabro-accent-border fabro-accent-bg'
                        : btn.kind === 'action'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : btn.kind === 'op'
                        ? 'fabro-accent-border fabro-accent-soft fabro-accent-text'
                        : btn.kind === 'fn'
                        ? 'fabro-border fabro-surface-elevated fabro-muted hover:opacity-100'
                        : 'fabro-border fabro-surface hover:border-[var(--fabro-accent)]';

                    return (
                      <button
                        key={`${btn.label}-${btn.value}`}
                        type="button"
                        onClick={() => {
                          if (btn.value === 'AC') handleClearCalc();
                          else if (btn.value === 'BACK') handleBackspaceCalc();
                          else if (btn.value === '=') handleCalculateEquals();
                          else appendToken(btn.value);
                        }}
                        className={`min-h-[44px] rounded-xl border font-mono text-xs sm:text-sm font-bold flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${baseStyle}`}
                      >
                        {btn.value === 'BACK' ? <Delete className="w-4 h-4" /> : btn.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {calcTab === 'porcentajes' && (
              <div className="space-y-4">
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Percent className="w-4 h-4 fabro-accent-text" />
                    Porcentajes y Descuentos / IVA
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1 text-[11px]">
                      <span className="fabro-muted font-medium">Porcentaje (%)</span>
                      <input
                        type="number"
                        value={pctValue}
                        onChange={(e) => setPctValue(e.target.value)}
                        className="w-full min-h-[40px] rounded-lg border fabro-border fabro-surface px-2.5 py-1.5 text-xs font-mono tabular-nums fabro-input"
                      />
                    </label>
                    <label className="space-y-1 text-[11px]">
                      <span className="fabro-muted font-medium">Monto base</span>
                      <input
                        type="number"
                        value={pctBase}
                        onChange={(e) => setPctBase(e.target.value)}
                        className="w-full min-h-[40px] rounded-lg border fabro-border fabro-surface px-2.5 py-1.5 text-xs font-mono tabular-nums fabro-input"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t fabro-border text-xs">
                    <div>
                      <p className="text-[11px] fabro-muted">{pctNum}% es</p>
                      <p className="font-mono font-bold tabular-nums">{formatMathNumber(pctAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] fabro-muted">Con recargo</p>
                      <p className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatMathNumber(pctPlus)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] fabro-muted">Con descuento</p>
                      <p className="font-mono font-bold tabular-nums text-amber-700 dark:text-amber-400">
                        {formatMathNumber(pctMinus)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-3">
                  <p className="text-xs font-bold">Regla de Tres Simple (A → B, C → X)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1 text-[11px]">
                      <span className="fabro-muted">Si A</span>
                      <input
                        type="number"
                        value={ruleA}
                        onChange={(e) => setRuleA(e.target.value)}
                        className="w-full min-h-[38px] rounded-lg border fabro-border fabro-surface px-2 py-1 text-xs font-mono tabular-nums fabro-input"
                      />
                    </label>
                    <label className="space-y-1 text-[11px]">
                      <span className="fabro-muted">Es B</span>
                      <input
                        type="number"
                        value={ruleB}
                        onChange={(e) => setRuleB(e.target.value)}
                        className="w-full min-h-[38px] rounded-lg border fabro-border fabro-surface px-2 py-1 text-xs font-mono tabular-nums fabro-input"
                      />
                    </label>
                    <label className="space-y-1 text-[11px]">
                      <span className="fabro-muted">Entonces C</span>
                      <input
                        type="number"
                        value={ruleC}
                        onChange={(e) => setRuleC(e.target.value)}
                        className="w-full min-h-[38px] rounded-lg border fabro-border fabro-surface px-2 py-1 text-xs font-mono tabular-nums fabro-input"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t fabro-border text-xs">
                    <span className="fabro-muted">Resultado X =</span>
                    <span className="font-mono text-lg font-extrabold tabular-nums fabro-accent-text">
                      {formatMathNumber(ruleX)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {calcTab === 'historial' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="fabro-muted flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Guardado localmente en el dispositivo
                  </span>
                  {calcHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCalcHistory([]);
                        void vaultSet('calculator_history', []);
                      }}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpiar
                    </button>
                  )}
                </div>

                {calcHistory.length === 0 ? (
                  <div className="rounded-xl border fabro-border fabro-surface-elevated p-6 text-center text-xs fabro-muted">
                    Todavía no guardaste resultados. Presioná «=» en la calculadora científica para registrar operaciones.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[310px] overflow-y-auto pr-1">
                    {calcHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setExpression(item.result);
                          setCalcOutput(item.result);
                          setCalcTab('scientifica');
                        }}
                        className="w-full text-left rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 flex items-center justify-between gap-2 hover:border-[var(--fabro-accent)] cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] fabro-muted truncate">{item.expression}</p>
                          <p className="font-mono text-sm font-bold tabular-nums">{item.result}</p>
                        </div>
                        <span className="text-[10px] font-mono fabro-muted shrink-0">{item.createdAt}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: 4-in-1 Multi-Instrument Dock */}
        <div className="lg:col-span-7 rounded-2xl border fabro-surface p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold">Módulo de Utilidades Express</h2>
                <p className="text-[11px] fabro-muted">
                  Cuatro instrumentos de uso diario listos sin salir de esta pantalla
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'conversor', label: 'Conversor', icon: Ruler },
                    { id: 'cronometro', label: 'Cronómetro', icon: Timer },
                    { id: 'gastos', label: 'Dividir Gastos', icon: Receipt },
                    { id: 'texto-claves', label: 'Claves y Texto', icon: KeyRound },
                  ] as Array<{ id: DockTab; label: string; icon: React.FC<{ className?: string }> }>
                ).map((item) => {
                  const Icon = item.icon;
                  const active = dockTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDockTab(item.id)}
                      className={`min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                        active ? 'fabro-surface fabro-accent-text shadow-xs' : 'fabro-muted'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Utility 1: Unit Converter */}
            {dockTab === 'conversor' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {UNIT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectUnitCategory(cat.id)}
                      className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                        unitCat === cat.id
                          ? 'fabro-accent-border fabro-accent-soft fabro-accent-text font-bold'
                          : 'fabro-border fabro-surface-elevated fabro-muted'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <label className="sm:col-span-5 space-y-1 text-xs">
                    <span className="text-[11px] font-semibold fabro-muted">Valor origen</span>
                    <input
                      type="number"
                      value={unitInput}
                      onChange={(e) => setUnitInput(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 font-mono text-sm font-bold tabular-nums fabro-input"
                    />
                  </label>

                  <label className="sm:col-span-3 space-y-1 text-xs">
                    <span className="text-[11px] font-semibold fabro-muted">Desde</span>
                    <select
                      value={unitFrom}
                      onChange={(e) => setUnitFrom(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-2 text-xs font-semibold fabro-input"
                    >
                      {activeUnitCat.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="sm:col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setUnitFrom(unitTo);
                        setUnitTo(unitFrom);
                      }}
                      aria-label="Intercambiar unidades"
                      title="Intercambiar unidades"
                      className="min-h-[44px] min-w-[44px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer active:scale-95"
                    >
                      <ArrowLeftRight className="w-4 h-4 fabro-accent-text" />
                    </button>
                  </div>

                  <label className="sm:col-span-3 space-y-1 text-xs">
                    <span className="text-[11px] font-semibold fabro-muted">Hacia</span>
                    <select
                      value={unitTo}
                      onChange={(e) => setUnitTo(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-2 text-xs font-semibold fabro-input"
                    >
                      {activeUnitCat.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] fabro-muted">Resultado convertido</p>
                    <p className="font-mono text-2xl sm:text-3xl font-extrabold tabular-nums fabro-accent-text">
                      {convertedVal}{' '}
                      <span className="text-sm font-semibold fabro-muted">
                        {activeUnitCat.units.find((u) => u.id === unitTo)?.id.toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => markCopied('conv-res', convertedVal)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    {copiedId === 'conv-res' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar valor
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Utility 2: Stopwatch & Countdown */}
            {dockTab === 'cronometro' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimerMode('cronometro')}
                    className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                      timerMode === 'cronometro'
                        ? 'fabro-accent-border fabro-accent-soft fabro-accent-text'
                        : 'fabro-border fabro-surface-elevated fabro-muted'
                    }`}
                  >
                    Cronómetro con vueltas
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimerMode('regresiva')}
                    className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                      timerMode === 'regresiva'
                        ? 'fabro-accent-border fabro-accent-soft fabro-accent-text'
                        : 'fabro-border fabro-surface-elevated fabro-muted'
                    }`}
                  >
                    Cuenta regresiva
                  </button>
                </div>

                {timerMode === 'cronometro' ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border fabro-border fabro-surface-elevated p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] fabro-muted">Tiempo transcurrido</p>
                        <p className="font-mono text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight">
                          {formatStopwatchMs(swElapsedMs)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSwRunning((r) => !r)}
                          className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border fabro-accent-border fabro-accent-bg px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
                        >
                          {swRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {swRunning ? 'Pausar' : 'Iniciar'}
                        </button>
                        <button
                          type="button"
                          disabled={!swRunning && swElapsedMs === 0}
                          onClick={() =>
                            setSwLaps((prev) => [formatStopwatchMs(swElapsedMs), ...prev].slice(0, 12))
                          }
                          className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-3.5 py-2 text-xs font-bold disabled:opacity-45 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          Vuelta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSwRunning(false);
                            setSwElapsedMs(0);
                            setSwLaps([]);
                          }}
                          aria-label="Reiniciar cronómetro"
                          className="min-h-[42px] min-w-[42px] rounded-xl border fabro-border fabro-surface flex items-center justify-center cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {swLaps.length > 0 && (
                      <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1.5 max-h-36 overflow-y-auto">
                        {swLaps.map((lap, idx) => (
                          <div
                            key={`${lap}-${idx}`}
                            className="flex items-center justify-between text-xs font-mono tabular-nums py-1 border-b last:border-b-0 fabro-border"
                          >
                            <span className="fabro-muted">Vuelta #{swLaps.length - idx}</span>
                            <span className="font-bold">{lap}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 3, 5, 10, 15, 30].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setCdRunning(false);
                            setCdMinutesInput(m);
                            setCdSecondsLeft(m * 60);
                          }}
                          className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-bold cursor-pointer ${
                            cdMinutesInput === m
                              ? 'fabro-accent-border fabro-accent-soft fabro-accent-text'
                              : 'fabro-border fabro-surface-elevated'
                          }`}
                        >
                          {m} min
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={cdMinutesInput}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(240, Number(e.target.value) || 1));
                          setCdRunning(false);
                          setCdMinutesInput(val);
                          setCdSecondsLeft(val * 60);
                        }}
                        aria-label="Minutos personalizados"
                        className="w-20 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1 text-xs font-mono tabular-nums fabro-input"
                      />
                    </div>

                    <div className="rounded-xl border fabro-border fabro-surface-elevated p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] fabro-muted">Temporizador con aviso sonoro</p>
                        <p className="font-mono text-3xl sm:text-4xl font-extrabold tabular-nums">
                          {formatCountdownSec(cdSecondsLeft)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (cdSecondsLeft === 0) setCdSecondsLeft(cdMinutesInput * 60);
                            setCdRunning((r) => !r);
                          }}
                          className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border fabro-accent-border fabro-accent-bg px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
                        >
                          {cdRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {cdRunning ? 'Pausar' : 'Iniciar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCdRunning(false);
                            setCdSecondsLeft(cdMinutesInput * 60);
                          }}
                          aria-label="Restablecer cuenta regresiva"
                          className="min-h-[42px] min-w-[42px] rounded-xl border fabro-border fabro-surface flex items-center justify-center cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Utility 3: Split Bill / Shared Expense Calculator */}
            {dockTab === 'gastos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="space-y-1 text-xs">
                    <span className="text-[11px] font-semibold fabro-muted">Total de la cuenta</span>
                    <input
                      type="number"
                      min={0}
                      value={billTotal}
                      onChange={(e) => setBillTotal(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 font-mono text-sm font-bold tabular-nums fabro-input"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[11px] font-semibold fabro-muted">Propina / Recargo (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={billTipPct}
                      onChange={(e) => setBillTipPct(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 font-mono text-sm font-bold tabular-nums fabro-input"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[11px] font-semibold fabro-muted">Personas</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={billPeople}
                      onChange={(e) => setBillPeople(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 font-mono text-sm font-bold tabular-nums fabro-input"
                    />
                  </label>
                </div>

                <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <p className="text-[11px] fabro-muted">Cada persona paga</p>
                    <p className="font-mono text-2xl font-extrabold tabular-nums fabro-accent-text">
                      ${formatMathNumber(Number(perPerson.toFixed(2)))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] fabro-muted">Total con propina</p>
                    <p className="font-mono text-base font-bold tabular-nums">
                      ${formatMathNumber(Number(billGrandTotal.toFixed(2)))}
                    </p>
                  </div>
                  <div className="flex sm:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        markCopied(
                          'bill-summary',
                          `Total: $${billGrandTotal.toFixed(2)} (${peopleNum} personas) -> $${perPerson.toFixed(2)} c/u`
                        )
                      }
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
                    >
                      {copiedId === 'bill-summary' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Resumen copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar reparto
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Utility 4: Crypto Password Generator & Text Analyzer */}
            {dockTab === 'texto-claves' && (
              <div className="space-y-4">
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 fabro-accent-text" />
                      Generador criptográfico local ({pwLength} caracteres)
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setGeneratedPw(
                            generateSecurePassword({
                              length: pwLength,
                              includeUpper: pwUpper,
                              includeNumbers: pwNumbers,
                              includeSymbols: pwSymbols,
                              pinOnly: pwPinOnly,
                            })
                          )
                        }
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-xs font-bold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Nueva
                      </button>
                      <button
                        type="button"
                        onClick={() => markCopied('pw-copy', generatedPw)}
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border fabro-accent-border fabro-accent-soft fabro-accent-text px-2.5 py-1 text-xs font-bold cursor-pointer"
                      >
                        {copiedId === 'pw-copy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === 'pw-copy' ? 'Copiada' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  <p className="font-mono text-sm font-bold break-all rounded-lg border fabro-border fabro-surface px-3 py-2">
                    {generatedPw}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <label className="flex items-center gap-2">
                      <span className="fabro-muted">Largo</span>
                      <input
                        type="range"
                        min={6}
                        max={28}
                        value={pwLength}
                        onChange={(e) => setPwLength(Number(e.target.value))}
                      />
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pwPinOnly}
                        onChange={(e) => setPwPinOnly(e.target.checked)}
                      />
                      Solo PIN
                    </label>
                    {!pwPinOnly && (
                      <>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pwUpper}
                            onChange={(e) => setPwUpper(e.target.checked)}
                          />
                          Mayús
                        </label>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pwNumbers}
                            onChange={(e) => setPwNumbers(e.target.checked)}
                          />
                          Números
                        </label>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pwSymbols}
                            onChange={(e) => setPwSymbols(e.target.checked)}
                          />
                          Símbolos
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 fabro-accent-text" />
                      Analizador y transformador de texto
                    </span>
                    <span className="font-mono text-[11px] fabro-muted tabular-nums">
                      {textStats.words} palabras · {textStats.chars} car. · ~{textStats.readMin} min lectura
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={textDraft}
                    onChange={(e) => setTextDraft(e.target.value)}
                    placeholder="Pegá cualquier texto para contar palabras, limpiar espacios o cambiar mayúsculas..."
                    className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3 text-xs fabro-input"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTextDraft((t) => t.toUpperCase())}
                      className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                    >
                      MAYÚSCULAS
                    </button>
                    <button
                      type="button"
                      onClick={() => setTextDraft((t) => t.toLowerCase())}
                      className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                    >
                      minúsculas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTextDraft((t) =>
                          t.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        )
                      }
                      className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                    >
                      Formato Título
                    </button>
                    <button
                      type="button"
                      onClick={() => setTextDraft((t) => t.replace(/\s+/g, ' ').trim())}
                      className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                    >
                      Limpiar espacios
                    </button>
                    {textDraft && (
                      <button
                        type="button"
                        onClick={() => markCopied('text-copy', textDraft)}
                        className="min-h-[34px] rounded-lg border fabro-accent-border fabro-accent-soft fabro-accent-text px-2.5 py-1 text-[11px] font-bold cursor-pointer ml-auto"
                      >
                        {copiedId === 'text-copy' ? 'Copiado' : 'Copiar texto'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t fabro-border flex flex-wrap items-center justify-between gap-2 text-[11px] fabro-muted">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 fabro-accent-text" />
              Procesamiento 100% en tu dispositivo · Cero consumo de datos
            </span>
            <button
              type="button"
              onClick={() => navigateTo('estudio', 'academico-panel')}
              className="font-bold fabro-accent-text hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              Ir al Pomodoro académico
              <Clock className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Unified Multi-Use Ecosystem Tools Directory */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">
              Directorio Completo de Herramientas ({filteredTools.length})
            </h2>
            <p className="text-xs fabro-muted">
              Abrí cualquier utilidad al instante o fijá los módulos de cada sector en tu Espacio de Trabajo.
            </p>
          </div>
          {(searchQuery || directoryFilter !== 'todas') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDirectoryFilter('todas');
              }}
              className="min-h-[36px] self-start rounded-xl border fabro-border fabro-surface px-3 py-1.5 text-xs font-semibold cursor-pointer"
            >
              Ver todas
            </button>
          )}
        </div>

        {filteredTools.length === 0 ? (
          <div className="rounded-2xl border fabro-surface p-8 text-center space-y-3">
            <p className="text-sm font-bold">Sin coincidencias para «{searchQuery}»</p>
            <p className="text-xs fabro-muted">
              Probá con otra palabra clave o limpiá el filtro para ver las {allUnifiedTools.length} herramientas.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDirectoryFilter('todas');
              }}
              className="min-h-[40px] rounded-xl border fabro-accent-border fabro-accent-bg px-4 py-2 text-xs font-bold cursor-pointer"
            >
              Restablecer búsqueda
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;
              const pinned = tool.pinnable
                ? isToolPinned(tool.pinnable.sector, tool.pinnable.submenu)
                : false;

              return (
                <article
                  key={tool.id}
                  className="rounded-2xl border fabro-surface p-4 flex flex-col justify-between gap-3.5 transition-colors hover:border-[var(--fabro-accent)]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: tool.gradientCss }}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[11px] font-medium fabro-muted truncate">{tool.groupText}</p>
                      <h3 className="font-display text-sm font-bold leading-snug">{tool.title}</h3>
                      <p className="text-xs fabro-muted leading-relaxed line-clamp-2">
                        {tool.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t fabro-border flex items-center justify-between gap-2">
                    {tool.pinnable ? (
                      <button
                        type="button"
                        onClick={() =>
                          togglePinTool(tool.pinnable!.sector, tool.pinnable!.submenu)
                        }
                        className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 ${
                          pinned
                            ? 'fabro-accent-border fabro-accent-soft fabro-accent-text'
                            : 'fabro-border fabro-surface-elevated fabro-muted hover:opacity-100'
                        }`}
                      >
                        <Pin className={`w-3.5 h-3.5 ${pinned ? 'fill-current' : ''}`} />
                        {pinned ? 'Fijada' : 'Fijar'}
                      </button>
                    ) : (
                      <span className="text-[11px] fabro-muted">Acceso integrado</span>
                    )}

                    <button
                      type="button"
                      onClick={tool.onOpen}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)] px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                      Abrir
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
