import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  CheckCircle2,
  Drum,
  Ear,
  Grid,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  CHROMATIC_SHARPS,
  getDiatonicKeyChords,
  getScaleNotes,
  lookupChordDiagrams,
  midiToFrequency,
  playChordVoicing,
  playDrumSound,
  playMetronomeClick,
  playReferenceTone,
  PROGRESSION_TEMPLATES,
  SCALE_LIBRARY,
  transposeSongContent,
} from '../../services/musicEngine';
import { ChordDiagramSvg } from './ChordDiagramSvg';

// ============================================================================
// 1. METRÓNOMO DIGITAL + GENERADOR DE PATRONES RÍTMICOS
// ============================================================================

interface RhythmPattern {
  id: string;
  name: string;
  style: string;
  steps: number; // 8 or 16
  kick: number[];
  snare: number[];
  hihat: number[];
}

const RHYTHM_PATTERNS: RhythmPattern[] = [
  {
    id: 'rock',
    name: 'Rock Estándar',
    style: '4/4 · Pulso sólido',
    steps: 8,
    kick: [1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 'pop',
    name: 'Pop Moderno',
    style: '4/4 · Dinámico',
    steps: 8,
    kick: [1, 0, 0, 1, 0, 1, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 'folk',
    name: 'Folk Acústico',
    style: '4/4 · Rasgueo',
    steps: 8,
    kick: [1, 0, 0, 0, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [1, 0, 1, 1, 1, 0, 1, 1],
  },
  {
    id: 'reggae',
    name: 'Reggae One-Drop',
    style: '4/4 · Contratiempo',
    steps: 8,
    kick: [0, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 'bossa',
    name: 'Bossa Nova',
    style: '4/4 · Clave latina',
    steps: 8,
    kick: [1, 0, 0, 1, 1, 0, 0, 1],
    snare: [1, 0, 0, 1, 0, 0, 1, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1],
  },
];

export const MetronomeRhythmTool: React.FC = () => {
  const [bpm, setBpm] = useState(100);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [mode, setMode] = useState<'metronomo' | 'ritmos'>('metronomo');
  const [selectedPatternId, setSelectedPatternId] = useState('rock');
  const [currentStep, setCurrentStep] = useState(0);
  const tapTimesRef = useRef<number[]>([]);

  const activePattern = useMemo(
    () => RHYTHM_PATTERNS.find((p) => p.id === selectedPatternId) || RHYTHM_PATTERNS[0],
    [selectedPatternId]
  );

  // Metronome scheduler
  useEffect(() => {
    if (!running || mode !== 'metronomo') return;
    let beatIdx = 0;
    const stepMs = Math.max(180, Math.round(60000 / bpm));

    playMetronomeClick(true);
    setCurrentBeat(1);

    const id = window.setInterval(() => {
      beatIdx = (beatIdx + 1) % beatsPerBar;
      playMetronomeClick(beatIdx === 0);
      setCurrentBeat(beatIdx + 1);
    }, stepMs);

    return () => window.clearInterval(id);
  }, [running, bpm, beatsPerBar, mode]);

  // Rhythm drum pattern scheduler (eighth notes)
  useEffect(() => {
    if (!running || mode !== 'ritmos') return;
    let stepIdx = 0;
    const eighthMs = Math.max(90, Math.round(30000 / bpm));

    const triggerStep = (idx: number) => {
      if (activePattern.kick[idx]) playDrumSound('kick');
      if (activePattern.snare[idx]) playDrumSound('snare');
      if (activePattern.hihat[idx]) playDrumSound('hihat');
      setCurrentStep(idx);
    };

    triggerStep(0);
    const id = window.setInterval(() => {
      stepIdx = (stepIdx + 1) % activePattern.steps;
      triggerStep(stepIdx);
    }, eighthMs);

    return () => window.clearInterval(id);
  }, [running, bpm, mode, activePattern]);

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 2400);
    taps.push(now);
    tapTimesRef.current = taps.slice(-5);
    if (taps.length >= 2) {
      const diffs = [];
      for (let i = 1; i < taps.length; i++) diffs.push(taps[i] - taps[i - 1]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const computed = Math.round(60000 / avg);
      setBpm(Math.max(30, Math.min(240, computed)));
    }
  };

  return (
    <div className="rounded-2xl border fabro-futuristic-panel p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">
            Metrónomo Digital y Generador de Ritmos
          </h2>
          <p className="text-xs fabro-muted">
            Audio Web Audio en tiempo real · Tap Tempo · Compases y patrones de batería.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setMode('metronomo');
            }}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold cursor-pointer ${
              mode === 'metronomo' ? 'fabro-accent-bg' : 'fabro-muted'
            }`}
          >
            Metrónomo
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setMode('ritmos');
            }}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              mode === 'ritmos' ? 'fabro-accent-bg' : 'fabro-muted'
            }`}
          >
            <Drum className="w-3.5 h-3.5" />
            Patrones Rítmicos
          </button>
        </div>
      </div>

      {/* BPM Control Deck */}
      <div className="rounded-2xl border fabro-border fabro-surface-elevated p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBpm((b) => Math.max(30, b - 1))}
              className="fabro-btn-icon"
              aria-label="Disminuir 1 BPM"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="text-center min-w-[96px]">
              <p className="font-mono text-4xl font-black tabular-nums leading-none fabro-accent-text">
                {bpm}
              </p>
              <p className="text-[11px] font-bold fabro-muted uppercase tracking-wider mt-1">
                BPM
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBpm((b) => Math.min(240, b + 1))}
              className="fabro-btn-icon"
              aria-label="Aumentar 1 BPM"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleTapTempo} className="fabro-btn-secondary">
              Tap Tempo
            </button>
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className={
                running
                  ? 'min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-rose-500/60 bg-rose-600 text-white px-5 py-2 text-xs font-bold cursor-pointer active:scale-95'
                  : 'fabro-btn-primary px-5'
              }
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{running ? 'Detener' : 'Iniciar'}</span>
            </button>
          </div>
        </div>

        <input
          type="range"
          min={30}
          max={240}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full accent-[var(--fabro-accent)] cursor-pointer"
        />

        {mode === 'metronomo' ? (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold fabro-muted">Compás:</span>
              <div className="flex items-center gap-1.5">
                {[2, 3, 4, 6].map((beats) => (
                  <button
                    key={beats}
                    type="button"
                    onClick={() => setBeatsPerBar(beats)}
                    className={`min-h-[34px] px-3 rounded-lg border font-mono font-bold cursor-pointer ${
                      beatsPerBar === beats
                        ? 'fabro-accent-border fabro-accent-bg'
                        : 'fabro-border fabro-surface'
                    }`}
                  >
                    {beats}/4
                  </button>
                ))}
              </div>
            </div>

            {/* Beat Pulse Visualizers */}
            <div className="grid grid-cols-6 gap-2 pt-2">
              {Array.from({ length: beatsPerBar }).map((_, i) => {
                const isLit = running && currentBeat === i + 1;
                return (
                  <div
                    key={i}
                    className={`h-14 rounded-xl border flex flex-col items-center justify-center font-mono transition-all duration-75 ${
                      isLit
                        ? i === 0
                          ? 'border-emerald-400 bg-emerald-500 text-white scale-[1.03] shadow-lg'
                          : 'fabro-accent-border fabro-accent-bg scale-[1.03]'
                        : 'fabro-border fabro-surface fabro-muted'
                    }`}
                  >
                    <span className="text-base font-black tabular-nums">{i + 1}</span>
                    <span className="text-[9px] uppercase">{i === 0 ? 'Acento' : 'Pulso'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap gap-2">
              {RHYTHM_PATTERNS.map((pat) => (
                <button
                  key={pat.id}
                  type="button"
                  onClick={() => setSelectedPatternId(pat.id)}
                  className={`min-h-[36px] px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    selectedPatternId === pat.id
                      ? 'fabro-accent-border fabro-accent-bg'
                      : 'fabro-border fabro-surface'
                  }`}
                >
                  {pat.name}
                </button>
              ))}
            </div>

            {/* Step Grid Visualizer */}
            <div className="space-y-2 text-[11px] font-mono">
              {(
                [
                  { label: 'Hi-Hat', row: activePattern.hihat, color: '#38BDF8' },
                  { label: 'Caja', row: activePattern.snare, color: '#F59E0B' },
                  { label: 'Bombo', row: activePattern.kick, color: '#10B981' },
                ] as const
              ).map((track) => (
                <div key={track.label} className="grid grid-cols-9 gap-1.5 items-center">
                  <span className="font-bold fabro-muted truncate">{track.label}</span>
                  {track.row.map((hit, idx) => {
                    const activeCol = running && currentStep === idx;
                    return (
                      <div
                        key={idx}
                        className="h-8 rounded-lg border flex items-center justify-center transition-all"
                        style={{
                          borderColor: activeCol ? track.color : 'var(--fabro-border)',
                          backgroundColor: hit
                            ? activeCol
                              ? track.color
                              : `${track.color}38`
                            : 'var(--fabro-surface)',
                        }}
                      >
                        {hit ? (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. BIBLIOTECA DE ACORDES (GUITARRA Y BAJO CON AUDIO REAL)
// ============================================================================

const CHORD_TYPES = [
  { id: '', label: 'Mayor' },
  { id: 'm', label: 'Menor' },
  { id: '7', label: 'Séptima (7)' },
  { id: 'maj7', label: 'Maj7' },
  { id: 'm7', label: 'm7' },
  { id: 'sus2', label: 'Sus2' },
  { id: 'sus4', label: 'Sus4' },
  { id: 'dim', label: 'Disminuido' },
  { id: 'aug', label: 'Aumentado' },
  { id: '5', label: 'Power (5)' },
] as const;

export const ChordLibraryTool: React.FC = () => {
  const [instrument, setInstrument] = useState<'guitar' | 'bass'>('guitar');
  const [selectedRoot, setSelectedRoot] = useState<string>('C');
  const [searchQuery, setSearchQuery] = useState('');

  const displayedChords = useMemo(() => {
    const q = searchQuery.trim();
    if (q) {
      const normalized = q.charAt(0).toUpperCase() + q.slice(1);
      return [normalized];
    }
    return CHORD_TYPES.map((t) => `${selectedRoot}${t.id}`);
  }, [selectedRoot, searchQuery]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border fabro-futuristic-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-tight">
              Biblioteca de Acordes (Guitarra y Bajo)
            </h2>
            <p className="text-xs fabro-muted">
              Digitación exacta, cejillas, posiciones alternativas y sonido real para cada acorde.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
            <button
              type="button"
              onClick={() => setInstrument('guitar')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-bold cursor-pointer ${
                instrument === 'guitar' ? 'fabro-accent-bg' : 'fabro-muted'
              }`}
            >
              Guitarra (6 cuerdas)
            </button>
            <button
              type="button"
              onClick={() => setInstrument('bass')}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-bold cursor-pointer ${
                instrument === 'bass' ? 'fabro-accent-bg' : 'fabro-muted'
              }`}
            >
              Bajo (4 cuerdas)
            </button>
          </div>
        </div>

        {/* Search + Root Selector */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative md:w-64">
            <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar acorde (ej: F#m7, Bb)..."
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 text-xs font-mono fabro-input"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {CHROMATIC_SHARPS.map((note) => (
              <button
                key={note}
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRoot(note);
                }}
                className={`min-h-[38px] min-w-[38px] px-2.5 rounded-xl border font-mono text-xs font-extrabold cursor-pointer ${
                  !searchQuery && selectedRoot === note
                    ? 'fabro-accent-border fabro-accent-bg'
                    : 'fabro-border fabro-surface-elevated'
                }`}
              >
                {note}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {displayedChords.map((chord) => (
          <ChordDiagramSvg key={`${chord}-${instrument}`} chordName={chord} instrument={instrument} />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 3. TRANSPOSITOR DE ACORDES + CALCULADORA DE TONALIDADES + PROGRESIONES
// ============================================================================

export const TransposerKeyTool: React.FC = () => {
  const [inputText, setInputText] = useState(
    `{Estribillo}\n[G]Sube la melodía [D]clara y natural\n[Em]entre notas limpias [C]vuelve a resonar`
  );
  const [semitones, setSemitones] = useState(2);
  const [preferFlats, setPreferFlats] = useState(false);

  // Key calculator & progression state
  const [keyRootIdx, setKeyRootIdx] = useState(7); // G
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>('major');

  const transposed = useMemo(
    () => transposeSongContent(inputText, semitones, preferFlats),
    [inputText, semitones, preferFlats]
  );

  const diatonicChords = useMemo(
    () => getDiatonicKeyChords(keyRootIdx, keyMode),
    [keyRootIdx, keyMode]
  );

  const playProgression = (degrees: number[]) => {
    const majorChords = getDiatonicKeyChords(keyRootIdx, 'major');
    degrees.forEach((degIdx, i) => {
      const ch = majorChords[degIdx]?.chord;
      if (!ch) return;
      const voicing = lookupChordDiagrams(ch, 'guitar')[0];
      if (!voicing) return;
      window.setTimeout(() => {
        playChordVoicing(voicing, true);
      }, i * 950);
    });
  };

  return (
    <div className="space-y-5">
      {/* Section A: Chord Sheet Transposer */}
      <div className="rounded-2xl border fabro-futuristic-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 fabro-accent-text" />
              Transpositor de Acordes
            </h2>
            <p className="text-xs fabro-muted">
              Pegá cifrados o letras con acordes [G] y subí o bajá semitonos al instante.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSemitones((s) => s - 1)}
              className="fabro-btn-icon"
              aria-label="Bajar un semitono"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-mono font-extrabold text-sm tabular-nums min-w-[92px] text-center fabro-accent-text">
              {semitones > 0 ? `+${semitones}` : semitones} semitonos
            </span>
            <button
              type="button"
              onClick={() => setSemitones((s) => s + 1)}
              className="fabro-btn-icon"
              aria-label="Subir un semitono"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPreferFlats((f) => !f)}
              className="fabro-btn-secondary min-h-[38px] px-3 text-xs"
            >
              Notación: {preferFlats ? 'Bemoles (♭)' : 'Sostenidos (♯)'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-bold fabro-muted">Original</span>
            <textarea
              rows={7}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3 font-mono text-xs fabro-input"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-bold fabro-accent-text">Resultado transpuesto</span>
            <textarea
              rows={7}
              readOnly
              value={transposed}
              className="w-full rounded-xl border fabro-accent-border fabro-surface p-3 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* Section B: Key Calculator & Harmonic Progressions */}
      <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-extrabold flex items-center gap-2">
              <Sparkles className="w-4 h-4 fabro-accent-text" />
              Calculadora de Tonalidades y Progresiones Armónicas
            </h3>
            <p className="text-xs fabro-muted">
              Tocá cualquier acorde diatónico o progresión para escucharlo en guitarra.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={keyRootIdx}
              onChange={(e) => setKeyRootIdx(Number(e.target.value))}
              className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-mono font-bold"
            >
              {CHROMATIC_SHARPS.map((n, i) => (
                <option key={n} value={i}>
                  Tonalidad: {n}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-xl border fabro-border fabro-surface-elevated p-1">
              <button
                type="button"
                onClick={() => setKeyMode('major')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  keyMode === 'major' ? 'fabro-accent-bg' : 'fabro-muted'
                }`}
              >
                Mayor
              </button>
              <button
                type="button"
                onClick={() => setKeyMode('minor')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  keyMode === 'minor' ? 'fabro-accent-bg' : 'fabro-muted'
                }`}
              >
                Menor
              </button>
            </div>
          </div>
        </div>

        {/* Diatonic Chords Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {diatonicChords.map((item) => (
            <button
              key={item.degree}
              type="button"
              onClick={() => {
                const v = lookupChordDiagrams(item.chord, 'guitar')[0];
                if (v) playChordVoicing(v, true);
              }}
              className="rounded-xl border fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)] p-3 text-left space-y-1 cursor-pointer active:scale-95"
            >
              <div className="flex items-center justify-between text-[11px] font-mono fabro-muted">
                <span>{item.degree}</span>
                <Volume2 className="w-3.5 h-3.5 fabro-accent-text" />
              </div>
              <p className="font-display text-lg font-black">{item.chord}</p>
              <p className="text-[10px] fabro-muted truncate">{item.role}</p>
            </button>
          ))}
        </div>

        {/* Playable Harmonic Progressions */}
        <div className="space-y-2 pt-2 border-t fabro-border">
          <p className="text-xs font-bold">Progresiones recomendadas en {CHROMATIC_SHARPS[keyRootIdx]} Mayor</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {PROGRESSION_TEMPLATES.map((prog) => {
              const majorChords = getDiatonicKeyChords(keyRootIdx, 'major');
              const chordNames = prog.degrees.map((d) => majorChords[d]?.chord || '');
              return (
                <div
                  key={prog.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold truncate">{prog.name}</p>
                    <p className="text-[11px] font-mono fabro-accent-text font-bold truncate">
                      {chordNames.join(' → ')}
                    </p>
                    <p className="text-[10px] fabro-muted">
                      {prog.numerals} · {prog.style}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => playProgression(prog.degrees)}
                    className="fabro-btn-icon shrink-0"
                    title="Escuchar progresión"
                  >
                    <Play className="w-4 h-4 fabro-accent-text" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. ENTRENADOR MUSICAL (ESCALAS + DIAPASÓN INTERACTIVO + ACORDES + OÍDO)
// ============================================================================

const TRAINER_CHORDS = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'G', 'A', 'Am', 'G7', 'A7'];

export const MusicalTrainerTool: React.FC = () => {
  const [tab, setTab] = useState<'escalas' | 'acordes' | 'oido'>('escalas');

  // Scales & Interactive Fretboard
  const [scaleRoot, setScaleRoot] = useState(9); // A
  const [scaleId, setScaleId] = useState('pent-minor');

  // Chord Trainer Quiz
  const [chordTarget, setChordTarget] = useState('Am');
  const [chordOptions, setChordOptions] = useState<string[]>(['Am', 'C', 'Em', 'Dm']);
  const [chordResult, setChordResult] = useState<'idle' | 'ok' | 'err'>('idle');
  const [chordScore, setChordScore] = useState({ ok: 0, total: 0 });

  // Ear Trainer Quiz (Intervals / Major vs Minor)
  const [earQuestion, setEarQuestion] = useState<{
    rootMidi: number;
    label: string;
    intervals: number[];
    options: string[];
  }>({
    rootMidi: 60,
    label: 'Acorde Mayor',
    intervals: [0, 4, 7],
    options: ['Acorde Mayor', 'Acorde Menor', 'Quinta Justa', 'Octava'],
  });
  const [earStatus, setEarStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [earScore, setEarScore] = useState({ ok: 0, total: 0 });

  const scaleNotes = useMemo(() => getScaleNotes(scaleRoot, scaleId), [scaleRoot, scaleId]);
  const scaleMeta = useMemo(
    () => SCALE_LIBRARY.find((s) => s.id === scaleId) || SCALE_LIBRARY[0],
    [scaleId]
  );

  // Guitar standard tuning high-to-low for fretboard display: e4, B3, G3, D3, A2, E2
  const fretboardStrings = [
    { label: 'e', openMidi: 64 },
    { label: 'B', openMidi: 59 },
    { label: 'G', openMidi: 55 },
    { label: 'D', openMidi: 50 },
    { label: 'A', openMidi: 45 },
    { label: 'E', openMidi: 40 },
  ];

  const nextChordQuestion = () => {
    const target = TRAINER_CHORDS[Math.floor(Math.random() * TRAINER_CHORDS.length)];
    const pool = TRAINER_CHORDS.filter((c) => c !== target).sort(() => Math.random() - 0.5).slice(0, 3);
    setChordTarget(target);
    setChordOptions([target, ...pool].sort(() => Math.random() - 0.5));
    setChordResult('idle');
  };

  const handleAnswerChord = (opt: string) => {
    if (chordResult !== 'idle') return;
    const ok = opt === chordTarget;
    setChordResult(ok ? 'ok' : 'err');
    setChordScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
    const v = lookupChordDiagrams(chordTarget, 'guitar')[0];
    if (v) playChordVoicing(v, true);
  };

  const EAR_CHALLENGES = [
    { label: 'Acorde Mayor', intervals: [0, 4, 7] },
    { label: 'Acorde Menor', intervals: [0, 3, 7] },
    { label: 'Quinta Justa', intervals: [0, 7] },
    { label: 'Octava', intervals: [0, 12] },
  ];

  const playEarChallenge = (rootMidi: number, intervals: number[]) => {
    intervals.forEach((iv, i) => {
      window.setTimeout(() => {
        playReferenceTone(midiToFrequency(rootMidi + iv), 0.9, 0.2);
      }, i * 240);
    });
  };

  const nextEarQuestion = () => {
    const rootMidi = 55 + Math.floor(Math.random() * 12);
    const chosen = EAR_CHALLENGES[Math.floor(Math.random() * EAR_CHALLENGES.length)];
    const q = {
      rootMidi,
      label: chosen.label,
      intervals: chosen.intervals,
      options: EAR_CHALLENGES.map((e) => e.label),
    };
    setEarQuestion(q);
    setEarStatus('idle');
    playEarChallenge(q.rootMidi, q.intervals);
  };

  const handleAnswerEar = (opt: string) => {
    if (earStatus !== 'idle') return;
    const ok = opt === earQuestion.label;
    setEarStatus(ok ? 'ok' : 'err');
    setEarScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div className="rounded-2xl border fabro-futuristic-panel p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">
            Entrenador Musical y Diapasón Interactivo
          </h2>
          <p className="text-xs fabro-muted">
            Escalas con audio real al tocar cada traste, entrenamiento visual de acordes y oído musical.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
          <button
            type="button"
            onClick={() => setTab('escalas')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === 'escalas' ? 'fabro-accent-bg' : 'fabro-muted'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            Escalas y Diapasón
          </button>
          <button
            type="button"
            onClick={() => setTab('acordes')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === 'acordes' ? 'fabro-accent-bg' : 'fabro-muted'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Acordes
          </button>
          <button
            type="button"
            onClick={() => setTab('oido')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === 'oido' ? 'fabro-accent-bg' : 'fabro-muted'
            }`}
          >
            <Ear className="w-3.5 h-3.5" />
            Oído Musical
          </button>
        </div>
      </div>

      {/* TAB 1: SCALES + INTERACTIVE FRETBOARD */}
      {tab === 'escalas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <select
              value={scaleRoot}
              onChange={(e) => setScaleRoot(Number(e.target.value))}
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono font-bold"
            >
              {CHROMATIC_SHARPS.map((n, i) => (
                <option key={n} value={i}>
                  Raíz: {n}
                </option>
              ))}
            </select>
            <select
              value={scaleId}
              onChange={(e) => setScaleId(e.target.value)}
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-bold"
            >
              {SCALE_LIBRARY.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="text-xs fabro-muted">{scaleMeta.mood}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold fabro-muted mr-1">Notas:</span>
            {scaleNotes.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className={`px-2.5 py-1 rounded-lg font-mono font-extrabold ${
                  i === 0
                    ? 'fabro-accent-bg'
                    : 'fabro-surface-elevated border fabro-border'
                }`}
              >
                {n}
              </span>
            ))}
          </div>

          {/* Interactive 12-Fret Guitar Fretboard */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[680px] rounded-2xl border fabro-border fabro-surface-elevated p-3 space-y-1.5">
              {/* Fret numbers */}
              <div className="grid grid-cols-13 gap-1 text-[10px] font-mono fabro-muted text-center">
                {Array.from({ length: 13 }).map((_, f) => (
                  <span key={f} className={f === 3 || f === 5 || f === 7 || f === 9 || f === 12 ? 'font-extrabold fabro-accent-text' : ''}>
                    {f === 0 ? 'Al aire' : f}
                  </span>
                ))}
              </div>

              {fretboardStrings.map((str) => (
                <div key={str.label} className="grid grid-cols-13 gap-1 items-center">
                  {Array.from({ length: 13 }).map((_, fret) => {
                    const midi = str.openMidi + fret;
                    const note = CHROMATIC_SHARPS[midi % 12];
                    const inScale = scaleNotes.includes(note);
                    const isRoot = note === CHROMATIC_SHARPS[scaleRoot];
                    return (
                      <button
                        key={fret}
                        type="button"
                        onClick={() => playReferenceTone(midiToFrequency(midi), 0.75, 0.2)}
                        title={`${note} (Cuerda ${str.label}, Traste ${fret})`}
                        className={`h-9 rounded-lg border text-[11px] font-mono font-bold transition-all cursor-pointer active:scale-95 ${
                          isRoot
                            ? 'fabro-accent-border fabro-accent-bg shadow-sm'
                            : inScale
                            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'fabro-border fabro-surface opacity-45 hover:opacity-100'
                        }`}
                      >
                        {inScale ? note : '·'}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] fabro-muted">
            Tocá cualquier casilla del diapasón para escuchar la nota exacta en tiempo real.
          </p>
        </div>
      )}

      {/* TAB 2: CHORD RECOGNITION TRAINER */}
      {tab === 'acordes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div className="flex justify-center">
            <ChordDiagramSvg
              chordName={chordTarget}
              voicingOverride={{
                ...lookupChordDiagrams(chordTarget, 'guitar')[0],
                name: chordResult === 'idle' ? '¿Qué acorde es?' : chordTarget,
              }}
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">Identificá el diagrama</span>
              <span className="font-mono font-bold tabular-nums fabro-accent-text">
                Aciertos: {chordScore.ok}/{chordScore.total}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {chordOptions.map((opt) => {
                const isTarget = opt === chordTarget;
                const stateClass =
                  chordResult === 'idle'
                    ? 'fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)]'
                    : isTarget
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500 font-extrabold'
                    : 'fabro-border fabro-surface opacity-50';
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleAnswerChord(opt)}
                    className={`min-h-[46px] rounded-xl border font-display text-base font-bold cursor-pointer ${stateClass}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {chordResult !== 'idle' && (
              <div className="flex items-center justify-between gap-2 pt-2">
                <span
                  className={`text-xs font-extrabold inline-flex items-center gap-1.5 ${
                    chordResult === 'ok' ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {chordResult === 'ok'
                    ? `¡Correcto! Era ${chordTarget}.`
                    : `Era ${chordTarget}. Escuchalo e intentá el siguiente.`}
                </span>
                <button type="button" onClick={nextChordQuestion} className="fabro-btn-primary">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Siguiente</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EAR TRAINER */}
      {tab === 'oido' && (
        <div className="rounded-2xl border fabro-border fabro-surface-elevated p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-extrabold">
                Entrenamiento Auditivo (Intervalos y Acordes)
              </h3>
              <p className="text-xs fabro-muted">
                Escuchá el sonido real generado y elegí qué intervalo o acorde sonó.
              </p>
            </div>
            <span className="font-mono text-xs font-extrabold tabular-nums fabro-accent-text">
              Puntuación: {earScore.ok}/{earScore.total}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => playEarChallenge(earQuestion.rootMidi, earQuestion.intervals)}
              className="fabro-btn-primary"
            >
              <Volume2 className="w-4 h-4" />
              <span>Escuchar sonido</span>
            </button>
            <button type="button" onClick={nextEarQuestion} className="fabro-btn-secondary">
              <RefreshCw className="w-4 h-4" />
              <span>Nuevo desafío</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {earQuestion.options.map((opt) => {
              const isRight = opt === earQuestion.label;
              const cls =
                earStatus === 'idle'
                  ? 'fabro-border fabro-surface hover:border-[var(--fabro-accent)]'
                  : isRight
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500 font-extrabold'
                  : 'fabro-border fabro-surface opacity-50';
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleAnswerEar(opt)}
                  className={`min-h-[46px] rounded-xl border px-4 text-xs font-bold cursor-pointer ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {earStatus !== 'idle' && (
            <p
              className={`text-xs font-extrabold ${
                earStatus === 'ok' ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {earStatus === 'ok'
                ? `¡Excelente oído! Era ${earQuestion.label}.`
                : `Respuesta correcta: ${earQuestion.label}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
