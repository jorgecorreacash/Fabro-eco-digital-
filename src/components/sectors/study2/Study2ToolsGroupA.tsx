import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useStudy2 } from '../../../context/Study2Context';
import {
  generateAcademicCitation,
  type CitationFormat,
} from '../../../services/study2ToolsUtils';
import {
  convertUnitValue,
  evaluateMathExpression,
  formatMathNumber,
  UNIT_CATEGORIES,
  type UnitCategoryId,
} from '../../../services/toolsEngine';
import {
  addDaysToDateKey,
  getTodayLocalDateKey,
} from '../../../services/unifiedCalendarService';
import type {
  StudyConceptMapNode,
  StudyQuizCard,
} from '../../../types/study2';

export type GroupAToolId =
  | 'calculadora'
  | 'conversor'
  | 'mapas'
  | 'cuestionarios'
  | 'flashcards'
  | 'diccionario'
  | 'traductor'
  | 'corrector'
  | 'citas';

export const Study2ToolsGroupA: React.FC<{ toolId: GroupAToolId }> = ({ toolId }) => {
  const {
    snapshot,
    saveConceptMap,
    deleteConceptMap,
    saveQuizSet,
    deleteQuizSet,
    upsertFlashcard,
    deleteFlashcard,
    addBibliographyItem,
  } = useStudy2();

  // 1. Scientific Calculator
  const [calcExpr, setCalcExpr] = useState('sqrt(144) + sin(30) * 10');
  const [calcAns, setCalcAns] = useState(0);
  const [calcOut, setCalcOut] = useState('17');
  const [calcErr, setCalcErr] = useState<string | null>(null);

  // 2. Unit Converter
  const [uCat, setUCat] = useState<UnitCategoryId>('longitud');
  const [uFrom, setUFrom] = useState('km');
  const [uTo, setUTo] = useState('m');
  const [uVal, setUVal] = useState('1');

  // 3. Concept Maps
  const [mapTitle, setMapTitle] = useState('Nuevo mapa conceptual');
  const [mapNodes, setMapNodes] = useState<StudyConceptMapNode[]>([
    { id: 'root', label: 'Tema central', parentId: null, color: '#2563EB' },
    { id: 'n1', label: 'Subtema 1', parentId: 'root', color: '#0891B2' },
    { id: 'n2', label: 'Subtema 2', parentId: 'root', color: '#7C3AED' },
  ]);
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeParent, setNewNodeParent] = useState('root');
  const [newNodeColor, setNewNodeColor] = useState('#2563EB');

  // 4. Quizzes
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDraftCards, setQuizDraftCards] = useState<StudyQuizCard[]>([]);
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState(0);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // 5. Flashcards SRS
  const [fcFront, setFcFront] = useState('');
  const [fcBack, setFcBack] = useState('');
  const [fcSubjectId, setFcSubjectId] = useState('');
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);

  // 6. Academic Dictionary
  const [dictWord, setDictWord] = useState('');
  const [dictLoading, setDictLoading] = useState(false);
  const [dictResult, setDictResult] = useState<{
    ok: boolean;
    term?: string;
    definition?: string;
    academicContext?: string;
    sourceLabel?: string;
    sourceUrl?: string;
    error?: string;
  } | null>(null);

  // 7. Translator
  const [trFrom, setTrFrom] = useState('es');
  const [trTo, setTrTo] = useState('en');
  const [trInput, setTrInput] = useState('');
  const [trOutput, setTrOutput] = useState('');
  const [trMeta, setTrMeta] = useState<string | null>(null);
  const [trLoading, setTrLoading] = useState(false);
  const [trError, setTrError] = useState<string | null>(null);

  // 8. Spellchecker
  const [spText, setSpText] = useState('');
  const [spLoading, setSpLoading] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);
  const [spMatches, setSpMatches] = useState<
    Array<{
      id: string;
      message: string;
      offset: number;
      length: number;
      excerpt: string;
      replacements: string[];
      category: string;
    }>
  >([]);
  const [spCheckedOnce, setSpCheckedOnce] = useState(false);

  // 9. Citation Generator
  const [citFormat, setCitFormat] = useState<CitationFormat>('apa7');
  const [citAuthors, setCitAuthors] = useState('');
  const [citYear, setCitYear] = useState('');
  const [citTitle, setCitTitle] = useState('');
  const [citPub, setCitPub] = useState('');
  const [citPages, setCitPages] = useState('');
  const [citUrl, setCitUrl] = useState('');
  const [citKind, setCitKind] = useState<'libro' | 'articulo' | 'web'>('libro');
  const [copiedFlag, setCopiedFlag] = useState(false);

  const activeUnitCat =
    UNIT_CATEGORIES.find((c) => c.id === uCat) || UNIT_CATEGORIES[0];
  const convertedStr = useMemo(() => {
    const num = Number(uVal.replace(',', '.'));
    if (!Number.isFinite(num)) return '0';
    return formatMathNumber(convertUnitValue(uCat, uFrom, uTo, num));
  }, [uCat, uFrom, uTo, uVal]);

  const generatedCitation = useMemo(
    () =>
      generateAcademicCitation(citFormat, {
        authors: citAuthors,
        year: citYear,
        title: citTitle,
        publisherOrJournal: citPub,
        pages: citPages,
        urlOrDoi: citUrl,
        kind: citKind,
      }),
    [citAuthors, citFormat, citKind, citPages, citPub, citTitle, citUrl, citYear]
  );

  // 1. CALCULADORA CIENTÍFICA
  if (toolId === 'calculadora') {
    const runCalc = () => {
      const res = evaluateMathExpression(calcExpr, calcAns);
      if (!res.ok || res.value === undefined || !res.formatted) {
        setCalcErr(res.error || 'Expresión inválida');
        return;
      }
      setCalcErr(null);
      setCalcAns(res.value);
      setCalcOut(res.formatted);
    };

    const keys = [
      'sin(', 'cos(', 'tan(', 'sqrt(', '^2',
      'log(', 'ln(', 'π', '(', ')',
      '7', '8', '9', '/', 'AC',
      '4', '5', '6', '*', '⌫',
      '1', '2', '3', '-', 'ANS',
      '0', '.', '^', '+', '=',
    ];

    return (
      <div className="space-y-4 max-w-md">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
          <input
            type="text"
            value={calcExpr}
            onChange={(e) => {
              setCalcErr(null);
              setCalcExpr(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runCalc();
              }
            }}
            aria-label="Expresión matemática"
            className="w-full bg-transparent text-right font-mono text-sm text-slate-500 focus:outline-none"
          />
          <div className="flex items-baseline justify-between gap-2 border-t border-slate-200 dark:border-slate-800 pt-2">
            <span className="text-xs text-rose-600">{calcErr || 'DEG'}</span>
            <span className="font-mono text-3xl font-extrabold tabular-nums">
              {calcOut}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === 'AC') {
                  setCalcExpr('');
                  setCalcOut('0');
                  setCalcErr(null);
                } else if (k === '⌫') {
                  setCalcExpr((p) => p.slice(0, -1));
                } else if (k === '=') {
                  runCalc();
                } else {
                  setCalcExpr((p) => `${p}${k}`);
                }
              }}
              className={`min-h-[44px] rounded-xl border font-mono text-xs font-bold cursor-pointer ${
                k === '='
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : k === 'AC' || k === '⌫'
                  ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 2. CONVERSOR DE UNIDADES
  if (toolId === 'conversor') {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="flex flex-wrap gap-1.5">
          {UNIT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setUCat(cat.id);
                setUFrom(cat.units[0].id);
                setUTo(cat.units[1]?.id || cat.units[0].id);
              }}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold cursor-pointer border ${
                uCat === cat.id
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <label className="sm:col-span-4 space-y-1 text-xs">
            <span className="font-semibold text-slate-500">Valor</span>
            <input
              type="number"
              value={uVal}
              onChange={(e) => setUVal(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono font-bold"
            />
          </label>
          <label className="sm:col-span-3 space-y-1 text-xs">
            <span className="font-semibold text-slate-500">Desde</span>
            <select
              value={uFrom}
              onChange={(e) => setUFrom(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
            >
              {activeUnitCat.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setUFrom(uTo);
                setUTo(uFrom);
              }}
              aria-label="Intercambiar"
              className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>
          <label className="sm:col-span-3 space-y-1 text-xs">
            <span className="font-semibold text-slate-500">Hacia</span>
            <select
              value={uTo}
              onChange={(e) => setUTo(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
            >
              {activeUnitCat.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
          <p className="text-xs text-slate-500">Resultado exacto</p>
          <p className="font-mono text-2xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">
            {convertedStr} {uTo.toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  // 3. GENERADOR DE MAPAS CONCEPTUALES
  if (toolId === 'mapas') {
    const rootNode = mapNodes.find((n) => n.parentId === null) || mapNodes[0];
    const childrenOf = (pid: string) => mapNodes.filter((n) => n.parentId === pid);
    const level1 = rootNode ? childrenOf(rootNode.id) : [];

    const handleDownloadSvg = () => {
      const el = document.getElementById('fabro-concept-map-svg');
      if (!el) return;
      const xml = new XMLSerializer().serializeToString(el);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mapTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'mapa'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={mapTitle}
            onChange={(e) => setMapTitle(e.target.value)}
            placeholder="Título del mapa conceptual"
            className="flex-1 min-w-[200px] min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold"
          />
          <button
            type="button"
            onClick={() =>
              saveConceptMap({
                id: `map-${Date.now()}`,
                title: mapTitle.trim() || 'Mapa conceptual',
                nodes: mapNodes,
                updatedAt: new Date().toISOString(),
              })
            }
            className="min-h-[38px] rounded-xl bg-blue-600 text-white px-3.5 text-xs font-bold cursor-pointer"
          >
            Guardar mapa
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            SVG
          </button>
        </div>

        {/* Add Node Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newNodeLabel.trim()) return;
            setMapNodes((prev) => [
              ...prev,
              {
                id: `n-${Date.now()}`,
                label: newNodeLabel.trim(),
                parentId: newNodeParent || rootNode?.id || null,
                color: newNodeColor,
              },
            ]);
            setNewNodeLabel('');
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={newNodeLabel}
            onChange={(e) => setNewNodeLabel(e.target.value)}
            placeholder="Nuevo concepto o nodo..."
            className="flex-1 min-w-[160px] min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <select
            value={newNodeParent}
            onChange={(e) => setNewNodeParent(e.target.value)}
            className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
          >
            {mapNodes.map((n) => (
              <option key={n.id} value={n.id}>
                Conectar a: {n.label}
              </option>
            ))}
          </select>
          <input
            type="color"
            value={newNodeColor}
            onChange={(e) => setNewNodeColor(e.target.value)}
            className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
          />
          <button
            type="submit"
            className="min-h-[36px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 text-xs font-bold cursor-pointer"
          >
            + Nodo
          </button>
        </form>

        {/* Live SVG Concept Diagram */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 overflow-x-auto">
          <svg
            id="fabro-concept-map-svg"
            viewBox="0 0 760 340"
            className="w-full min-w-[600px] h-[320px]"
          >
            {rootNode && (
              <>
                {level1.map((child, idx) => {
                  const spacing = 700 / Math.max(1, level1.length);
                  const cx = 30 + spacing * idx + spacing / 2;
                  const cy = 155;
                  const grandchildren = childrenOf(child.id);
                  return (
                    <g key={child.id}>
                      <line
                        x1="380"
                        y1="56"
                        x2={cx}
                        y2={cy - 20}
                        stroke="#94A3B8"
                        strokeWidth="2"
                      />
                      {grandchildren.map((gc, gIdx) => {
                        const gx =
                          cx - ((grandchildren.length - 1) * 110) / 2 + gIdx * 110;
                        const gy = 275;
                        return (
                          <g key={gc.id}>
                            <line
                              x1={cx}
                              y1={cy + 20}
                              x2={gx}
                              y2={gy - 18}
                              stroke="#CBD5E1"
                              strokeWidth="1.5"
                            />
                            <rect
                              x={gx - 52}
                              y={gy - 18}
                              width="104"
                              height="36"
                              rx="10"
                              fill={gc.color}
                            />
                            <text
                              x={gx}
                              y={gy + 4}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="11"
                              fontWeight="600"
                            >
                              {gc.label.slice(0, 16)}
                            </text>
                          </g>
                        );
                      })}
                      <rect
                        x={cx - 68}
                        y={cy - 20}
                        width="136"
                        height="40"
                        rx="12"
                        fill={child.color}
                      />
                      <text
                        x={cx}
                        y={cy + 4}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="12"
                        fontWeight="700"
                      >
                        {child.label.slice(0, 20)}
                      </text>
                    </g>
                  );
                })}
                <rect
                  x="290"
                  y="16"
                  width="180"
                  height="42"
                  rx="14"
                  fill={rootNode.color}
                />
                <text
                  x="380"
                  y="42"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="14"
                  fontWeight="700"
                >
                  {rootNode.label.slice(0, 24)}
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Editable node list + Saved maps */}
        <div className="flex flex-wrap gap-1.5">
          {mapNodes.map((n) => (
            <span
              key={n.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.color }} />
              <input
                type="text"
                value={n.label}
                onChange={(e) =>
                  setMapNodes((prev) =>
                    prev.map((x) => (x.id === n.id ? { ...x, label: e.target.value } : x))
                  )
                }
                className="bg-transparent w-28 focus:outline-none font-medium"
              />
              {n.parentId !== null && (
                <button
                  type="button"
                  onClick={() =>
                    setMapNodes((prev) =>
                      prev.filter((x) => x.id !== n.id && x.parentId !== n.id)
                    )
                  }
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>

        {snapshot.conceptMaps.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-xs font-bold text-slate-500">Mapas guardados</p>
            <div className="flex flex-wrap gap-2">
              {snapshot.conceptMaps.map((m) => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMapTitle(m.title);
                      setMapNodes(m.nodes);
                    }}
                    className="font-semibold hover:underline cursor-pointer"
                  >
                    {m.title} ({m.nodes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConceptMap(m.id)}
                    className="text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. GENERADOR DE CUESTIONARIOS
  if (toolId === 'cuestionarios') {
    const runningQuiz = snapshot.quizSets.find((q) => q.id === activeQuizId) || null;

    if (runningQuiz) {
      const correctCount = runningQuiz.questions.reduce(
        (acc, q) => acc + (quizAnswers[q.id] === q.correctIndex ? 1 : 0),
        0
      );
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">{runningQuiz.title}</h3>
            <button
              type="button"
              onClick={() => {
                setActiveQuizId(null);
                setQuizAnswers({});
                setQuizSubmitted(false);
              }}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Volver a cuestionarios
            </button>
          </div>
          <div className="space-y-3">
            {runningQuiz.questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
              >
                <p className="text-xs font-bold">
                  {idx + 1}. {q.question}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => {
                    const selected = quizAnswers[q.id] === oIdx;
                    const isRight = quizSubmitted && oIdx === q.correctIndex;
                    const isWrong = quizSubmitted && selected && oIdx !== q.correctIndex;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        disabled={quizSubmitted}
                        onClick={() =>
                          setQuizAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                        }
                        className={`min-h-[38px] rounded-xl border px-3 py-2 text-left text-xs font-medium cursor-pointer ${
                          isRight
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                            : isWrong
                            ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                            : selected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!quizSubmitted ? (
            <button
              type="button"
              onClick={() => {
                setQuizSubmitted(true);
                saveQuizSet({
                  ...runningQuiz,
                  lastScore: {
                    correct: correctCount,
                    total: runningQuiz.questions.length,
                    takenAt: new Date().toLocaleDateString('es-AR'),
                  },
                });
              }}
              className="min-h-[40px] rounded-xl bg-blue-600 text-white px-5 text-xs font-bold cursor-pointer"
            >
              Corregir cuestionario
            </button>
          ) : (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center justify-between">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Resultado real: {correctCount} de {runningQuiz.questions.length} correctas (
                {Math.round((correctCount / Math.max(1, runningQuiz.questions.length)) * 100)}%)
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuizAnswers({});
                  setQuizSubmitted(false);
                }}
                className="text-xs font-bold underline cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <input
            type="text"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="Título del cuestionario (ej. Repaso Unidad 1)..."
            className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold"
          />
          <input
            type="text"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Enunciado de la pregunta..."
            className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: 'Opción A', val: qOptA, set: setQOptA },
              { label: 'Opción B', val: qOptB, set: setQOptB },
              { label: 'Opción C', val: qOptC, set: setQOptC },
              { label: 'Opción D', val: qOptD, set: setQOptD },
            ].map((item, idx) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="correct-opt"
                  checked={qCorrect === idx}
                  onChange={() => setQCorrect(idx)}
                  aria-label={`Marcar ${item.label} como correcta`}
                />
                <input
                  type="text"
                  value={item.val}
                  onChange={(e) => item.set(e.target.value)}
                  placeholder={item.label}
                  className="flex-1 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const opts = [qOptA, qOptB, qOptC, qOptD].map((o) => o.trim()).filter(Boolean);
                if (!qText.trim() || opts.length < 2) return;
                setQuizDraftCards((prev) => [
                  ...prev,
                  {
                    id: `q-${Date.now()}`,
                    question: qText.trim(),
                    options: opts,
                    correctIndex: Math.min(qCorrect, opts.length - 1),
                  },
                ]);
                setQText('');
                setQOptA('');
                setQOptB('');
                setQOptC('');
                setQOptD('');
                setQCorrect(0);
              }}
              className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold cursor-pointer"
            >
              + Agregar pregunta ({quizDraftCards.length})
            </button>
            <button
              type="button"
              disabled={quizDraftCards.length === 0}
              onClick={() => {
                saveQuizSet({
                  id: `qs-${Date.now()}`,
                  title: quizTitle.trim() || `Cuestionario (${quizDraftCards.length} preg.)`,
                  questions: quizDraftCards,
                  updatedAt: new Date().toISOString(),
                });
                setQuizTitle('');
                setQuizDraftCards([]);
              }}
              className="min-h-[36px] rounded-xl bg-blue-600 disabled:opacity-40 text-white px-4 text-xs font-bold cursor-pointer"
            >
              Guardar cuestionario
            </button>
          </div>
        </div>

        {snapshot.quizSets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {snapshot.quizSets.map((qs) => (
              <div
                key={qs.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{qs.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {qs.questions.length} preguntas
                    {qs.lastScore
                      ? ` · Último: ${qs.lastScore.correct}/${qs.lastScore.total}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuizId(qs.id);
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                    }}
                    className="min-h-[32px] px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
                  >
                    Practicar
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuizSet(qs.id)}
                    className="p-1.5 text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 5. TARJETAS DE MEMORIA (FLASHCARDS SRS)
  if (toolId === 'flashcards') {
    const cards = snapshot.flashcards;
    const currentCard = cards[fcIndex % Math.max(1, cards.length)] || null;

    const rateCard = (quality: 'dificil' | 'bien' | 'facil') => {
      if (!currentCard) return;
      const nextBox = (
        quality === 'dificil'
          ? 1
          : quality === 'bien'
          ? Math.min(5, currentCard.box + 1)
          : Math.min(5, currentCard.box + 2)
      ) as 1 | 2 | 3 | 4 | 5;
      const intervalDays = [1, 2, 4, 7, 14][nextBox - 1];
      upsertFlashcard({
        ...currentCard,
        box: nextBox,
        reviews: currentCard.reviews + 1,
        nextReviewDate: addDaysToDateKey(getTodayLocalDateKey(), intervalDays),
      });
      setFcFlipped(false);
      setFcIndex((i) => (i + 1) % Math.max(1, cards.length));
    };

    return (
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!fcFront.trim() || !fcBack.trim()) return;
            upsertFlashcard({
              id: `fc-${Date.now()}`,
              subjectId: fcSubjectId || undefined,
              front: fcFront.trim(),
              back: fcBack.trim(),
              box: 1,
              nextReviewDate: getTodayLocalDateKey(),
              reviews: 0,
            });
            setFcFront('');
            setFcBack('');
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2"
        >
          <input
            type="text"
            value={fcFront}
            onChange={(e) => setFcFront(e.target.value)}
            placeholder="Frente (pregunta o concepto)"
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <input
            type="text"
            value={fcBack}
            onChange={(e) => setFcBack(e.target.value)}
            placeholder="Reverso (respuesta o definición)"
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <div className="flex gap-1.5">
            <select
              value={fcSubjectId}
              onChange={(e) => setFcSubjectId(e.target.value)}
              className="flex-1 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"
            >
              <option value="">General</option>
              {snapshot.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-[38px] rounded-xl bg-blue-600 text-white px-3.5 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>

        {!currentCard ? (
          <p className="text-xs text-slate-500 text-center py-8">
            Agregá tu primera tarjeta de memoria para comenzar el repaso espaciado.
          </p>
        ) : (
          <div className="space-y-3 max-w-xl mx-auto">
            <div
              onClick={() => setFcFlipped((v) => !v)}
              className="min-h-[170px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center text-center cursor-pointer space-y-2"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {fcFlipped ? 'Respuesta' : 'Pregunta'} · Caja {currentCard.box}/5 · Tarjeta{' '}
                {(fcIndex % cards.length) + 1} de {cards.length}
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {fcFlipped ? currentCard.back : currentCard.front}
              </p>
              <span className="text-[11px] text-blue-600">
                Tocá para girar la tarjeta
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => rateCard('dificil')}
                className="min-h-[36px] px-3.5 rounded-xl border border-rose-300 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer"
              >
                Difícil (mañana)
              </button>
              <button
                type="button"
                onClick={() => rateCard('bien')}
                className="min-h-[36px] px-3.5 rounded-xl border border-blue-300 text-blue-700 dark:text-blue-300 text-xs font-bold cursor-pointer"
              >
                Bien (+caja)
              </button>
              <button
                type="button"
                onClick={() => rateCard('facil')}
                className="min-h-[36px] px-3.5 rounded-xl border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
              >
                Fácil (+2 cajas)
              </button>
              <button
                type="button"
                onClick={() => deleteFlashcard(currentCard.id)}
                className="min-h-[36px] px-2.5 rounded-xl text-slate-400 hover:text-rose-600 cursor-pointer"
                aria-label="Eliminar tarjeta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 6. DICCIONARIO ACADÉMICO
  if (toolId === 'diccionario') {
    const searchTerm = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!dictWord.trim()) return;
      setDictLoading(true);
      setDictResult(null);
      try {
        const res = await fetch(
          `/api/study/dictionary?word=${encodeURIComponent(dictWord.trim())}`
        );
        const data = await res.json();
        setDictResult(data);
      } catch {
        setDictResult({
          ok: false,
          error: 'Sin conexión para consultar el diccionario académico en línea.',
        });
      } finally {
        setDictLoading(false);
      }
    };

    return (
      <div className="space-y-4 max-w-2xl">
        <form onSubmit={searchTerm} className="flex gap-2">
          <input
            type="text"
            value={dictWord}
            onChange={(e) => setDictWord(e.target.value)}
            placeholder="Ej. Epistemología, Hermenéutica, Mitosis, Jurisprudencia..."
            className="flex-1 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={dictLoading}
            className="min-h-[42px] rounded-xl bg-blue-600 text-white px-5 text-xs font-bold cursor-pointer"
          >
            {dictLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Definir'}
          </button>
        </form>

        {dictResult && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2.5">
            {dictResult.ok ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold capitalize">{dictResult.term}</h3>
                  {dictResult.sourceUrl && (
                    <a
                      href={dictResult.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {dictResult.sourceLabel}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
                  {dictResult.definition}
                </p>
                {dictResult.academicContext && (
                  <p className="text-xs leading-relaxed text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {dictResult.academicContext}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-rose-600">{dictResult.error}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // 7. TRADUCTOR
  if (toolId === 'traductor') {
    const langs = [
      { code: 'es', label: 'Español' },
      { code: 'en', label: 'Inglés' },
      { code: 'pt', label: 'Portugués' },
      { code: 'fr', label: 'Francés' },
      { code: 'de', label: 'Alemán' },
      { code: 'it', label: 'Italiano' },
    ];

    const runTranslate = async () => {
      if (!trInput.trim()) return;
      setTrLoading(true);
      setTrError(null);
      try {
        const res = await fetch('/api/study/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trInput, from: trFrom, to: trTo }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setTrError(data.error || 'Servicio de traducción no disponible.');
        } else {
          setTrOutput(data.translatedText || '');
          setTrMeta(data.provider || null);
        }
      } catch {
        setTrError('Sin conexión con el servicio de traducción gratuito.');
      } finally {
        setTrLoading(false);
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={trFrom}
            onChange={(e) => setTrFrom(e.target.value)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
          >
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setTrFrom(trTo);
              setTrTo(trFrom);
            }}
            className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <select
            value={trTo}
            onChange={(e) => setTrTo(e.target.value)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
          >
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={trLoading}
            onClick={runTranslate}
            className="min-h-[38px] rounded-xl bg-blue-600 text-white px-4 text-xs font-bold cursor-pointer"
          >
            {trLoading ? 'Traduciendo...' : 'Traducir'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <textarea
            rows={6}
            value={trInput}
            onChange={(e) => setTrInput(e.target.value)}
            placeholder="Pegá el texto académico a traducir..."
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs leading-relaxed"
          />
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs leading-relaxed flex flex-col justify-between">
            <p className="whitespace-pre-wrap">
              {trOutput || 'La traducción aparecerá aquí.'}
            </p>
            {trMeta && <p className="text-[10px] text-slate-400 mt-2">{trMeta}</p>}
          </div>
        </div>
        {trError && <p className="text-xs text-rose-600">{trError}</p>}
      </div>
    );
  }

  // 8. CORRECTOR ORTOGRÁFICO Y GRAMATICAL
  if (toolId === 'corrector') {
    const runSpellcheck = async () => {
      if (!spText.trim()) return;
      setSpLoading(true);
      setSpError(null);
      setSpCheckedOnce(true);
      try {
        const res = await fetch('/api/study/spellcheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: spText, language: 'es' }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setSpError(data.error || 'No se pudo conectar con LanguageTool.');
          setSpMatches([]);
        } else {
          setSpMatches(data.matches || []);
        }
      } catch {
        setSpError('Sin conexión para ejecutar la corrección ortográfica en línea.');
        setSpMatches([]);
      } finally {
        setSpLoading(false);
      }
    };

    const applyFix = (offset: number, length: number, replacement: string) => {
      const updated = spText.slice(0, offset) + replacement + spText.slice(offset + length);
      setSpText(updated);
      setSpMatches([]);
    };

    return (
      <div className="space-y-3">
        <textarea
          rows={6}
          value={spText}
          onChange={(e) => setSpText(e.target.value)}
          placeholder="Pegá tu texto en español para revisar ortografía, tildes y gramática (vía LanguageTool)..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs leading-relaxed"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={spLoading}
            onClick={runSpellcheck}
            className="min-h-[38px] rounded-xl bg-blue-600 text-white px-4 text-xs font-bold cursor-pointer"
          >
            {spLoading ? 'Revisando...' : 'Revisar texto'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSpText('');
              setSpMatches([]);
              setSpError(null);
              setSpCheckedOnce(false);
            }}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpiar
          </button>
        </div>

        {spError && <p className="text-xs text-rose-600">{spError}</p>}

        {!spLoading && spCheckedOnce && !spError && spMatches.length === 0 && (
          <p className="text-xs font-semibold text-emerald-600">
            Sin observaciones ortográficas o gramaticales detectadas.
          </p>
        )}

        {spMatches.length > 0 && (
          <div className="space-y-2">
            {spMatches.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 text-xs space-y-1.5"
              >
                <p className="font-bold text-slate-900 dark:text-white">
                  «{m.excerpt}» — {m.message}
                </p>
                {m.replacements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.replacements.map((rep) => (
                      <button
                        key={rep}
                        type="button"
                        onClick={() => applyFix(m.offset, m.length, rep)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:border-blue-600 cursor-pointer"
                      >
                        Aplicar: {rep}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 9. GENERADOR DE CITAS (APA / MLA / Chicago / IEEE / ISO)
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'apa7', label: 'APA 7' },
            { id: 'mla9', label: 'MLA 9' },
            { id: 'chicago', label: 'Chicago' },
            { id: 'ieee', label: 'IEEE' },
            { id: 'iso690', label: 'ISO 690' },
          ] as Array<{ id: CitationFormat; label: string }>
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setCitFormat(f.id)}
            className={`min-h-[34px] px-3 rounded-xl text-xs font-bold cursor-pointer border ${
              citFormat === f.id
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input
          type="text"
          value={citAuthors}
          onChange={(e) => setCitAuthors(e.target.value)}
          placeholder="Autor/es (ej. Bunge, M.)"
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
        />
        <input
          type="text"
          value={citYear}
          onChange={(e) => setCitYear(e.target.value)}
          placeholder="Año (ej. 2018)"
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
        />
        <input
          type="text"
          value={citTitle}
          onChange={(e) => setCitTitle(e.target.value)}
          placeholder="Título de la obra o artículo"
          className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
        />
        <input
          type="text"
          value={citPub}
          onChange={(e) => setCitPub(e.target.value)}
          placeholder="Editorial, revista o sitio web"
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
        />
        <select
          value={citKind}
          onChange={(e) => setCitKind(e.target.value as 'libro' | 'articulo' | 'web')}
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
        >
          <option value="libro">Libro</option>
          <option value="articulo">Artículo científico</option>
          <option value="web">Página web</option>
        </select>
        <input
          type="text"
          value={citPages}
          onChange={(e) => setCitPages(e.target.value)}
          placeholder="Páginas (opcional, ej. 45-62)"
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
        />
        <input
          type="url"
          value={citUrl}
          onChange={(e) => setCitUrl(e.target.value)}
          placeholder="DOI o URL (opcional)"
          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
        />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
        <p className="text-xs leading-relaxed font-medium text-slate-800 dark:text-slate-200">
          {generatedCitation}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(generatedCitation);
              setCopiedFlag(true);
              window.setTimeout(() => setCopiedFlag(false), 1500);
            }}
            className="min-h-[34px] px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            {copiedFlag ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedFlag ? 'Copiada' : 'Copiar cita'}
          </button>
          <button
            type="button"
            disabled={!citTitle.trim()}
            onClick={() =>
              addBibliographyItem({
                title: citTitle.trim(),
                author: citAuthors.trim() || 'Autor desconocido',
                year: citYear.trim() || 's. f.',
                publisher: citPub.trim() || undefined,
                url: citUrl.trim() || undefined,
                kind: citKind,
              })
            }
            className="min-h-[34px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            Guardar en Bibliografía
          </button>
        </div>
      </div>
    </div>
  );
};
