import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Download,
  Gauge,
  Library,
  Mic,
  MicOff,
  Music,
  Play,
  Plus,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { CultureSongEntry } from '../../../types/culture';

interface MusicAudioStudioProps {
  songs: CultureSongEntry[];
  onSaveSong: (song: CultureSongEntry) => void;
  onDeleteSong: (id: string) => void;
}

type MusicTab = 'afinador' | 'metronomo' | 'compositor' | 'acordes' | 'grabadora' | 'biblioteca';

const REFERENCE_NOTES = [
  { name: 'E2 (6ª cuerda)', freq: 82.41 },
  { name: 'A2 (5ª cuerda)', freq: 110.0 },
  { name: 'D3 (4ª cuerda)', freq: 146.83 },
  { name: 'G3 (3ª cuerda)', freq: 196.0 },
  { name: 'B3 (2ª cuerda)', freq: 246.94 },
  { name: 'E4 (1ª cuerda)', freq: 329.63 },
  { name: 'A4 (440 Hz)', freq: 440.0 },
];

const SCALE_NOTES = [
  { label: 'C5', freq: 523.25 },
  { label: 'B4', freq: 493.88 },
  { label: 'A4', freq: 440.0 },
  { label: 'G4', freq: 392.0 },
  { label: 'F4', freq: 349.23 },
  { label: 'E4', freq: 329.63 },
  { label: 'D4', freq: 293.66 },
  { label: 'C4', freq: 261.63 },
];

const CHORD_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const ROOT_FREQS: Record<string, number> = {
  C: 261.63,
  'C#': 277.18,
  D: 293.66,
  'D#': 311.13,
  E: 329.63,
  F: 349.23,
  'F#': 369.99,
  G: 392.0,
  'G#': 415.3,
  A: 440.0,
  'A#': 466.16,
  B: 493.88,
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function detectPitchAutocorr(buf: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.015) return null;

  let bestOffset = -1;
  let bestCorr = 0;
  const minOffset = Math.floor(sampleRate / 1000);
  const maxOffset = Math.floor(sampleRate / 65);
  for (let offset = minOffset; offset <= maxOffset && offset < buf.length / 2; offset++) {
    let corr = 0;
    for (let i = 0; i < buf.length / 2; i++) {
      corr += buf[i] * buf[i + offset];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }
  return bestOffset > 0 ? sampleRate / bestOffset : null;
}

export const MusicAudioStudio: React.FC<MusicAudioStudioProps> = ({
  songs,
  onSaveSong,
  onDeleteSong,
}) => {
  const [activeTab, setActiveTab] = useState<MusicTab>('afinador');
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = (freq: number, durationSec = 0.7, type: OscillatorType = 'triangle') => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.24, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationSec + 0.02);
  };

  // 1. Tuner (Mic Pitch Detection + Reference Tones)
  const [micActive, setMicActive] = useState(false);
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [detectedNote, setDetectedNote] = useState<string>('—');
  const [centsOff, setCentsOff] = useState<number>(0);
  const [tunerError, setTunerError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopMicTuner = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicActive(false);
  };

  const startMicTuner = async () => {
    setTunerError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setTunerError('Tu navegador no permite micrófono aquí; usá los tonos calibrados de referencia.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = getCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      setMicActive(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const freq = detectPitchAutocorr(buf, ctx.sampleRate);
        if (freq && freq > 65 && freq < 1100) {
          const midi = Math.round(69 + 12 * Math.log2(freq / 440));
          const targetFreq = 440 * Math.pow(2, (midi - 69) / 12);
          const cents = Math.round(1200 * Math.log2(freq / targetFreq));
          const octave = Math.floor(midi / 12) - 1;
          setDetectedFreq(Math.round(freq * 10) / 10);
          setDetectedNote(`${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`);
          setCentsOff(Math.max(-50, Math.min(50, cents)));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setTunerError('No se otorgó permiso de micrófono. Podés afinar con los tonos de referencia.');
    }
  };

  useEffect(() => {
    return () => {
      stopMicTuner();
    };
  }, []);

  // 2. Metronome
  const [bpm, setBpm] = useState(96);
  const [beatsPerBar, setBeatsPerBar] = useState<2 | 3 | 4 | 6>(4);
  const [metroRunning, setMetroRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!metroRunning) return;
    let beatIdx = 0;
    const playClick = () => {
      const accent = beatIdx % beatsPerBar === 0;
      playTone(accent ? 1080 : 740, 0.06, 'sine');
      setCurrentBeat((beatIdx % beatsPerBar) + 1);
      beatIdx += 1;
    };
    playClick();
    const interval = window.setInterval(playClick, Math.round((60 / bpm) * 1000));
    return () => window.clearInterval(interval);
  }, [bpm, beatsPerBar, metroRunning]);

  const handleTapTempo = () => {
    const now = Date.now();
    const list = [...tapTimesRef.current.filter((t) => now - t < 2500), now].slice(-5);
    tapTimesRef.current = list;
    if (list.length >= 2) {
      const diffs = list.slice(1).map((t, i) => t - list[i]);
      const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const computed = Math.round(60000 / avgMs);
      if (computed >= 40 && computed <= 220) setBpm(computed);
    }
  };

  // 3. Composer & Sheet Grid (8 rows x 16 steps)
  const [grid, setGrid] = useState<boolean[][]>(() =>
    SCALE_NOTES.map((_, row) =>
      Array.from({ length: 16 }, (__, col) => (row === 7 && col === 0) || (row === 5 && col === 4) || (row === 3 && col === 8) || (row === 0 && col === 12))
    )
  );
  const [seqPlaying, setSeqPlaying] = useState(false);
  const [seqStep, setSeqStep] = useState(-1);
  const [scoreTitle, setScoreTitle] = useState('Estudio melódico en Do');

  useEffect(() => {
    if (!seqPlaying) {
      setSeqStep(-1);
      return;
    }
    let step = 0;
    const id = window.setInterval(() => {
      setSeqStep(step);
      SCALE_NOTES.forEach((n, rIdx) => {
        if (grid[rIdx][step]) {
          playTone(n.freq, 0.28, 'triangle');
        }
      });
      step = (step + 1) % 16;
    }, Math.round((60 / bpm / 2) * 1000));
    return () => window.clearInterval(id);
  }, [bpm, grid, seqPlaying]);

  const exportScoreText = () => {
    const lines = [
      `PARTITURA / SECUENCIA — ${scoreTitle}`,
      `Tempo: ${bpm} BPM`,
      '',
      ...SCALE_NOTES.map(
        (n, r) => `${n.label.padEnd(3)} | ${grid[r].map((v) => (v ? '●' : '·')).join(' ')}`
      ),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${scoreTitle.replace(/\s+/g, '_').toLowerCase()}.txt`;
    a.click();
  };

  // 4. Chord Generator
  const [rootKey, setRootKey] = useState<(typeof CHORD_ROOTS)[number]>('C');
  const [scaleMode, setScaleMode] = useState<'mayor' | 'menor'>('mayor');

  const chordProgression =
    scaleMode === 'mayor'
      ? [
          { degree: 'I', label: `${rootKey}`, intervals: [0, 4, 7] },
          { degree: 'V', label: `${NOTE_NAMES[(NOTE_NAMES.indexOf(rootKey) + 7) % 12]}`, intervals: [7, 11, 14] },
          { degree: 'vi', label: `${NOTE_NAMES[(NOTE_NAMES.indexOf(rootKey) + 9) % 12]}m`, intervals: [9, 12, 16] },
          { degree: 'IV', label: `${NOTE_NAMES[(NOTE_NAMES.indexOf(rootKey) + 5) % 12]}`, intervals: [5, 9, 12] },
        ]
      : [
          { degree: 'i', label: `${rootKey}m`, intervals: [0, 3, 7] },
          { degree: 'VI', label: `${NOTE_NAMES[(NOTE_NAMES.indexOf(rootKey) + 8) % 12]}`, intervals: [8, 12, 15] },
          { degree: 'III', label: `${NOTE_NAMES[(NOTE_NAMES.indexOf(rootKey) + 3) % 12]}`, intervals: [3, 7, 10] },
          { degree: 'V7', label: `${NOTE_NAMES[(NOTE_NAMES.indexOf(rootKey) + 7) % 12]}7`, intervals: [7, 11, 14, 17] },
        ];

  const playChord = (intervals: number[]) => {
    const base = ROOT_FREQS[rootKey] || 261.63;
    intervals.forEach((semi, idx) => {
      const f = base * Math.pow(2, semi / 12);
      window.setTimeout(() => playTone(f, 0.9, 'triangle'), idx * 35);
    });
  };

  // 5. Audio Recorder (MediaRecorder API)
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordings, setRecordings] = useState<Array<{ id: string; title: string; url: string; sec: number }>>([]);
  const [recError, setRecError] = useState<string | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  const startRecording = async () => {
    setRecError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecError('Tu navegador no soporta MediaRecorder API en este entorno.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordings((prev) => [
          {
            id: `rec-${Date.now()}`,
            title: `Toma musical ${prev.length + 1}`,
            url,
            sec: recordSeconds || 1,
          },
          ...prev,
        ]);
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mediaRecRef.current = rec;
      setRecordSeconds(0);
      rec.start();
      setRecording(true);
    } catch {
      setRecError('No pudimos acceder al micrófono. Verificá los permisos del navegador.');
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
  };

  // 6. Song Organizer & Music Library
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songKey, setSongKey] = useState('Am');
  const [songBpm, setSongBpm] = useState(92);
  const [songChords, setSongChords] = useState('');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border fabro-border fabro-surface">
        {(
          [
            { id: 'afinador', label: 'Afinador', icon: Activity },
            { id: 'metronomo', label: 'Metrónomo', icon: Gauge },
            { id: 'compositor', label: 'Compositor y partituras', icon: Music },
            { id: 'acordes', label: 'Generador de acordes', icon: Volume2 },
            { id: 'grabadora', label: 'Grabadora de audio', icon: Mic },
            { id: 'biblioteca', label: 'Biblioteca y canciones', icon: Library },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#1E3A8A] text-white'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. TUNER */}
      {activeTab === 'afinador' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Afinador Cromático (Web Audio API · A4 = 440 Hz)</h3>
              <p className="text-xs fabro-muted">
                Tocá un tono calibrado de referencia o activá el micrófono para afinar tu instrumento en vivo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (micActive ? stopMicTuner() : void startMicTuner())}
              className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl px-4 text-xs font-bold cursor-pointer ${
                micActive ? 'bg-rose-600 text-white' : 'bg-[#1E3A8A] text-white'
              }`}
            >
              {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{micActive ? 'Detener micrófono' : 'Activar detector por micrófono'}</span>
            </button>
          </div>

          {tunerError && (
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">{tunerError}</p>
          )}

          <div className="rounded-xl border fabro-border fabro-surface-elevated p-5 text-center space-y-2">
            <p className="font-mono text-4xl font-extrabold tracking-tight">{detectedNote}</p>
            <p className="text-xs font-mono tabular-nums fabro-muted">
              {detectedFreq ? `${detectedFreq} Hz · Desviación ${centsOff > 0 ? `+${centsOff}` : centsOff} cents` : 'Esperando señal o seleccioná una nota de referencia abajo'}
            </p>
            <div className="max-w-xs mx-auto h-2 rounded-full bg-black/10 dark:bg-white/10 relative overflow-hidden">
              <div
                className="w-3 h-2 rounded-full bg-[#1E3A8A] absolute top-0 transition-transform"
                style={{ left: `${50 + centsOff}%`, transform: 'translateX(-50%)' }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold fabro-muted">Tonos de referencia calibrados</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {REFERENCE_NOTES.map((n) => (
                <button
                  key={n.name}
                  type="button"
                  onClick={() => {
                    playTone(n.freq, 1.3, 'sine');
                    setDetectedNote(n.name.split(' ')[0]);
                    setDetectedFreq(n.freq);
                    setCentsOff(0);
                  }}
                  className="min-h-[48px] rounded-xl border fabro-border fabro-surface-elevated p-2 text-xs font-semibold hover:border-[#1E3A8A] cursor-pointer"
                >
                  <span className="block">{n.name}</span>
                  <span className="text-[11px] font-mono fabro-muted">{n.freq} Hz</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. METRONOME */}
      {activeTab === 'metronomo' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Metrónomo de Precisión</h3>
              <p className="text-xs fabro-muted">Ajustá tempo (40–220 BPM), compás y pulso acentuado.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTapTempo}
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3.5 text-xs font-semibold cursor-pointer"
              >
                Tap Tempo
              </button>
              <button
                type="button"
                onClick={() => setMetroRunning((v) => !v)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer ${
                  metroRunning ? 'bg-rose-600 text-white' : 'bg-[#1E3A8A] text-white'
                }`}
              >
                {metroRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{metroRunning ? 'Detener' : 'Iniciar'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-3">
              <p className="font-mono text-4xl font-extrabold tabular-nums">{bpm} BPM</p>
              <input
                type="range"
                min={40}
                max={220}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex items-center gap-2">
                {([2, 3, 4, 6] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBeatsPerBar(b)}
                    className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      beatsPerBar === b
                        ? 'border-[#1E3A8A] bg-[#1E3A8A]/12 text-[#1E3A8A] dark:text-[#93C5FD]'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    {b === 6 ? '6/8' : `${b}/4`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 py-4">
              {Array.from({ length: beatsPerBar }, (_, idx) => {
                const active = metroRunning && currentBeat === idx + 1;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-mono text-sm font-bold transition-transform ${
                      active
                        ? idx === 0
                          ? 'border-[#9A3412] bg-[#9A3412] text-white scale-110'
                          : 'border-[#1E3A8A] bg-[#1E3A8A] text-white scale-105'
                        : 'fabro-border fabro-surface-elevated fabro-muted'
                    }`}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPOSER & SHEET MUSIC */}
      {activeTab === 'compositor' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={scoreTitle}
              onChange={(e) => setScoreTitle(e.target.value)}
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold fabro-input w-64"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSeqPlaying((v) => !v)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer ${
                  seqPlaying ? 'bg-rose-600 text-white' : 'bg-[#1E3A8A] text-white'
                }`}
              >
                {seqPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{seqPlaying ? 'Detener' : 'Reproducir partitura'}</span>
              </button>
              <button
                type="button"
                onClick={exportScoreText}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border px-3 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar partitura</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="min-w-[640px] space-y-1">
              {SCALE_NOTES.map((note, rIdx) => (
                <div key={note.label} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => playTone(note.freq, 0.45)}
                    className="w-11 h-8 rounded-lg border fabro-border fabro-surface-elevated font-mono text-[11px] font-bold cursor-pointer shrink-0"
                  >
                    {note.label}
                  </button>
                  <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 flex-1">
                    {grid[rIdx].map((active, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => {
                          setGrid((prev) =>
                            prev.map((row, ri) =>
                              ri === rIdx ? row.map((v, ci) => (ci === cIdx ? !v : v)) : row
                            )
                          );
                          if (!active) playTone(note.freq, 0.25);
                        }}
                        className={`h-8 rounded-md border cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#1E3A8A] border-[#1E3A8A]'
                            : cIdx === seqStep
                            ? 'bg-[#9A3412]/25 border-[#9A3412]/50'
                            : cIdx % 4 === 0
                            ? 'fabro-border fabro-surface-elevated'
                            : 'fabro-border/60 fabro-surface'
                        }`}
                        aria-label={`${note.label} paso ${cIdx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. CHORD GENERATOR */}
      {activeTab === 'acordes' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {CHORD_ROOTS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRootKey(k)}
                  className={`w-10 h-10 rounded-xl border text-xs font-bold cursor-pointer ${
                    rootKey === k
                      ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {(['mayor', 'menor'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setScaleMode(m)}
                  className={`min-h-[38px] rounded-xl border px-3.5 text-xs font-semibold capitalize cursor-pointer ${
                    scaleMode === m
                      ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  Modo {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {chordProgression.map((ch) => (
              <button
                key={ch.degree}
                type="button"
                onClick={() => playChord(ch.intervals)}
                className="rounded-xl border fabro-border fabro-surface-elevated p-4 text-left hover:border-[#1E3A8A] cursor-pointer space-y-1"
              >
                <span className="text-[11px] font-mono fabro-muted">Grado {ch.degree}</span>
                <p className="font-display text-2xl font-bold">{ch.label}</p>
                <span className="text-xs text-[#1E3A8A] dark:text-[#93C5FD] font-semibold inline-flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> Escuchar acorde
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. AUDIO RECORDER */}
      {activeTab === 'grabadora' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Grabadora Local de Audio (MediaRecorder)</h3>
              <p className="text-xs fabro-muted">
                Las tomas quedan en la memoria del navegador y podés descargarlas a tu dispositivo sin servicios pagos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : void startRecording())}
              className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl px-4 text-xs font-bold cursor-pointer ${
                recording ? 'bg-rose-600 text-white' : 'bg-[#9A3412] text-white'
              }`}
            >
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{recording ? `Detener (${recordSeconds}s)` : 'Grabar toma'}</span>
            </button>
          </div>
          {recError && <p className="text-xs text-amber-700 dark:text-amber-300">{recError}</p>}

          {recordings.length === 0 ? (
            <p className="text-xs fabro-muted py-4">Aún no grabaste tomas en esta sesión.</p>
          ) : (
            <div className="space-y-2.5">
              {recordings.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="text-xs">
                    <p className="font-bold">{r.title}</p>
                    <p className="fabro-muted font-mono">{r.sec}s · Audio local</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <audio src={r.url} controls className="h-8 max-w-[220px]" />
                    <a
                      href={r.url}
                      download={`${r.title.replace(/\s+/g, '_')}.webm`}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border px-2.5 text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Bajar</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. MUSIC LIBRARY & SONG ORGANIZER */}
      {activeTab === 'biblioteca' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!songTitle.trim()) return;
              onSaveSong({
                id: `song-${Date.now()}`,
                title: songTitle.trim(),
                artist: songArtist.trim() || 'Propia',
                keySignature: songKey.trim() || 'C',
                bpm: songBpm,
                chordsAndLyrics: songChords.trim(),
                status: 'Ensayando',
              });
              setSongTitle('');
              setSongArtist('');
              setSongChords('');
            }}
            className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">Agregar canción o repertorio</h3>
            <input
              type="text"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="Título de la canción"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={songArtist}
                onChange={(e) => setSongArtist(e.target.value)}
                placeholder="Autor"
                className="col-span-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="text"
                value={songKey}
                onChange={(e) => setSongKey(e.target.value)}
                placeholder="Tono (Am)"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="number"
                value={songBpm}
                onChange={(e) => setSongBpm(Number(e.target.value) || 90)}
                placeholder="BPM"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </div>
            <textarea
              value={songChords}
              onChange={(e) => setSongChords(e.target.value)}
              rows={4}
              placeholder="Acordes, estructura y letra..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 font-mono fabro-input"
            />
            <button
              type="submit"
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E3A8A] text-white font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar en Biblioteca Musical</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {songs.map((song) => (
              <div
                key={song.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold">{song.title}</h4>
                    <p className="text-xs fabro-muted">
                      {song.artist} · Tono {song.keySignature} · {song.bpm} BPM · {song.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteSong(song.id)}
                    className="p-1.5 fabro-muted hover:text-rose-600 cursor-pointer"
                    aria-label="Eliminar canción"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {song.chordsAndLyrics && (
                  <pre className="text-xs font-mono whitespace-pre-wrap rounded-xl border fabro-border fabro-surface-elevated p-3">
                    {song.chordsAndLyrics}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
