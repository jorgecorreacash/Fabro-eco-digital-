import { jsPDF } from 'jspdf';

// ============================================================================
// FABRO MUSIC ENGINE — Pitch Detection (YIN), Tunings, Chords, Transposer,
// Scales, Web Audio Synth & PDF Songbook Export ($0 Cost, 100% Client-Side)
// ============================================================================

export const CHROMATIC_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const CHROMATIC_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

export interface DetectedNoteInfo {
  noteName: string;
  sharpName: string;
  flatName: string;
  octave: number;
  midi: number;
  exactFreq: number;
  targetFreq: number;
  cents: number;
}

export interface TuningStringDef {
  stringNumber: number; // 1 = highest pitch string, N = lowest
  label: string; // e.g. "E2"
  noteName: string;
  octave: number;
  midi: number;
}

export interface TuningPreset {
  id: string;
  name: string;
  instrument: 'guitar' | 'bass' | 'chromatic';
  category: string;
  description: string;
  strings: TuningStringDef[]; // ordered low-to-high for visual display
  isCustom?: boolean;
}

export function midiToFrequency(midi: number, referenceA4 = 440): number {
  return referenceA4 * Math.pow(2, (midi - 69) / 12);
}

export function noteLabelToMidi(label: string): number {
  const m = label.trim().match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!m) return 69;
  const root = `${m[1].toUpperCase()}${m[2]}`;
  const semitone = NOTE_TO_SEMITONE[root] ?? 9;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + semitone;
}

export function makeStrings(labelsLowToHigh: string[]): TuningStringDef[] {
  const total = labelsLowToHigh.length;
  return labelsLowToHigh.map((raw, idx) => {
    const clean = raw.trim();
    const midi = noteLabelToMidi(clean);
    const m = clean.match(/^([A-Ga-g][#b]?)(-?\d)$/);
    const noteName = m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : 'A';
    const octave = m ? parseInt(m[2], 10) : 4;
    return {
      stringNumber: total - idx,
      label: `${noteName}${octave}`,
      noteName,
      octave,
      midi,
    };
  });
}

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: 'guitar-standard',
    name: 'Guitarra Estándar (E A D G B E)',
    instrument: 'guitar',
    category: 'Guitarra',
    description: 'Afinación universal de 6 cuerdas.',
    strings: makeStrings(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  },
  {
    id: 'guitar-drop-d',
    name: 'Guitarra Drop D (D A D G B E)',
    instrument: 'guitar',
    category: 'Guitarra',
    description: '6ª cuerda bajada un tono para riffs y acordes potentes.',
    strings: makeStrings(['D2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  },
  {
    id: 'guitar-d-standard',
    name: 'Guitarra D Estándar (D G C F A D)',
    instrument: 'guitar',
    category: 'Guitarra',
    description: 'Todas las cuerdas un tono completo abajo.',
    strings: makeStrings(['D2', 'G2', 'C3', 'F3', 'A3', 'D4']),
  },
  {
    id: 'guitar-7',
    name: 'Guitarra 7 Cuerdas (B E A D G B E)',
    instrument: 'guitar',
    category: 'Guitarra',
    description: 'Rango extendido con 7ª cuerda grave en Si (B1).',
    strings: makeStrings(['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  },
  {
    id: 'guitar-open-g',
    name: 'Abierta Open G (D G D G B D)',
    instrument: 'guitar',
    category: 'Abiertas',
    description: 'Acorde de Sol Mayor al aire ideal para blues y slide.',
    strings: makeStrings(['D2', 'G2', 'D3', 'G3', 'B3', 'D4']),
  },
  {
    id: 'guitar-open-d',
    name: 'Abierta Open D (D A D F# A D)',
    instrument: 'guitar',
    category: 'Abiertas',
    description: 'Acorde de Re Mayor al aire, cálido y resonante.',
    strings: makeStrings(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4']),
  },
  {
    id: 'guitar-open-e',
    name: 'Abierta Open E (E B E G# B E)',
    instrument: 'guitar',
    category: 'Abiertas',
    description: 'Acorde de Mi Mayor al aire.',
    strings: makeStrings(['E2', 'B2', 'E3', 'G#3', 'B3', 'E4']),
  },
  {
    id: 'guitar-dadgad',
    name: 'Abierta DADGAD (D A D G A D)',
    instrument: 'guitar',
    category: 'Abiertas',
    description: 'Afinación modal celta / acústica moderna.',
    strings: makeStrings(['D2', 'A2', 'D3', 'G3', 'A3', 'D4']),
  },
  {
    id: 'bass-4',
    name: 'Bajo 4 Cuerdas (E A D G)',
    instrument: 'bass',
    category: 'Bajo',
    description: 'Afinación estándar de bajo eléctrico y acústico.',
    strings: makeStrings(['E1', 'A1', 'D2', 'G2']),
  },
  {
    id: 'bass-5',
    name: 'Bajo 5 Cuerdas (B E A D G)',
    instrument: 'bass',
    category: 'Bajo',
    description: 'Bajo extendido con 5ª cuerda grave en Si (B0 · 30.87 Hz).',
    strings: makeStrings(['B0', 'E1', 'A1', 'D2', 'G2']),
  },
  {
    id: 'bass-6',
    name: 'Bajo 6 Cuerdas (B E A D G C)',
    instrument: 'bass',
    category: 'Bajo',
    description: 'Bajo de rango completo de Si grave a Do agudo.',
    strings: makeStrings(['B0', 'E1', 'A1', 'D2', 'G2', 'C3']),
  },
  {
    id: 'chromatic',
    name: 'Cromático Libre (Todas las notas)',
    instrument: 'chromatic',
    category: 'Cromático',
    description: 'Detecta libremente cualquier nota musical de C0 a F6.',
    strings: [],
  },
];

export function frequencyToNoteInfo(freqHz: number, referenceA4 = 440): DetectedNoteInfo {
  const safeFreq = Math.max(16, freqHz);
  const floatMidi = 69 + 12 * Math.log2(safeFreq / referenceA4);
  const midi = Math.round(floatMidi);
  const semitone = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const targetFreq = midiToFrequency(midi, referenceA4);
  const cents = Math.round(1200 * Math.log2(safeFreq / targetFreq) * 10) / 10;

  return {
    noteName: CHROMATIC_SHARPS[semitone],
    sharpName: CHROMATIC_SHARPS[semitone],
    flatName: CHROMATIC_FLATS[semitone],
    octave,
    midi,
    exactFreq: Math.round(safeFreq * 100) / 100,
    targetFreq: Math.round(targetFreq * 100) / 100,
    cents,
  };
}

export function findClosestTargetString(
  freqHz: number,
  strings: TuningStringDef[],
  referenceA4 = 440
): { stringDef: TuningStringDef; targetFreq: number; cents: number } | null {
  if (!strings.length || !Number.isFinite(freqHz) || freqHz <= 0) return null;
  let best: { stringDef: TuningStringDef; targetFreq: number; cents: number } | null = null;
  let bestAbsCents = Infinity;

  for (const s of strings) {
    const targetFreq = midiToFrequency(s.midi, referenceA4);
    const cents = Math.round(1200 * Math.log2(freqHz / targetFreq) * 10) / 10;
    const absCents = Math.abs(cents);
    if (absCents < bestAbsCents) {
      bestAbsCents = absCents;
      best = {
        stringDef: s,
        targetFreq: Math.round(targetFreq * 100) / 100,
        cents,
      };
    }
  }
  return best;
}

/**
 * YIN Fundamental Frequency Estimator (de Cheveigné & Kawahara, 2002)
 * Accurate down to B0 (30.87 Hz) with 4096-sample time-domain buffers.
 */
export function detectPitchYin(
  buffer: Float32Array,
  sampleRate: number,
  rmsThreshold = 0.012,
  yinThreshold = 0.14
): { frequency: number; clarity: number; rms: number } | null {
  const n = buffer.length;
  if (n < 512 || sampleRate <= 0) return null;

  // 1. RMS Noise Gate + DC offset removal
  let mean = 0;
  for (let i = 0; i < n; i++) mean += buffer[i];
  mean /= n;

  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = buffer[i] - mean;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / n);
  if (rms < rmsThreshold) return null;

  const halfLen = Math.floor(n / 2);
  const minLag = Math.max(8, Math.floor(sampleRate / 1450)); // ~1450 Hz max
  const maxLag = Math.min(halfLen - 2, Math.floor(sampleRate / 28)); // ~28 Hz min (B0 bass = 30.87 Hz)
  if (maxLag <= minLag) return null;

  const diff = new Float32Array(maxLag + 1);

  // 2. Squared difference function
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const d = (buffer[i] - mean) - (buffer[i + tau] - mean);
      sum += d * d;
    }
    diff[tau] = sum;
  }

  // 3. Cumulative Mean Normalized Difference Function (CMNDF)
  const cmndf = new Float32Array(maxLag + 1);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  // 4. Absolute threshold search
  let tauEstimate = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmndf[tau] < yinThreshold) {
      while (tau + 1 <= maxLag && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // Fallback to global minimum if signal is clear enough
  if (tauEstimate === -1) {
    let minVal = 1;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmndf[tau] < minVal) {
        minVal = cmndf[tau];
        tauEstimate = tau;
      }
    }
    if (minVal > 0.28 || tauEstimate === -1) return null;
  }

  // 5. Parabolic interpolation around tauEstimate for sub-cent precision
  let betterTau = tauEstimate;
  if (tauEstimate > 1 && tauEstimate < maxLag) {
    const s0 = cmndf[tauEstimate - 1];
    const s1 = cmndf[tauEstimate];
    const s2 = cmndf[tauEstimate + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-9) {
      betterTau = tauEstimate + (s2 - s0) / denom;
    }
  }

  const frequency = sampleRate / betterTau;
  if (!Number.isFinite(frequency) || frequency < 27 || frequency > 1500) return null;

  const clarity = Math.max(0, Math.min(1, 1 - cmndf[tauEstimate]));
  return { frequency, clarity, rms };
}

export function medianFrequency(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ============================================================================
// CHORD ENGINE — Voicings, Guitar & Bass Diagrams, Movable Barre & Transposer
// ============================================================================

export type ChordQuality =
  | ''
  | 'm'
  | '7'
  | 'maj7'
  | 'm7'
  | 'sus2'
  | 'sus4'
  | 'dim'
  | 'aug'
  | '5';

export interface ChordVoicing {
  name: string;
  label: string; // e.g. "Posición abierta" or "Cejilla (Traste 3)"
  instrument: 'guitar' | 'bass';
  frets: number[]; // -1 = muted (X), 0 = open (O), >0 = absolute fret number
  fingers: number[]; // 0 = open/muted, 1..4 = finger
  baseFret: number; // starting fret shown on diagram (1 for open chords)
  barre?: { fret: number; fromString: number; toString: number }; // 0-indexed low-to-high
}

const GUITAR_OPEN_CHORDS: Record<string, ChordVoicing[]> = {
  C: [
    { name: 'C', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
    { name: 'C', label: 'Cejilla (Traste 3)', instrument: 'guitar', frets: [-1, 3, 5, 5, 5, 3], fingers: [0, 1, 2, 3, 4, 1], baseFret: 3, barre: { fret: 3, fromString: 1, toString: 5 } },
  ],
  Cm: [
    { name: 'Cm', label: 'Cejilla (Traste 3)', instrument: 'guitar', frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], baseFret: 3, barre: { fret: 3, fromString: 1, toString: 5 } },
  ],
  C7: [
    { name: 'C7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
  ],
  Cmaj7: [
    { name: 'Cmaj7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], baseFret: 1 },
  ],
  D: [
    { name: 'D', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
    { name: 'D', label: 'Cejilla (Traste 5)', instrument: 'guitar', frets: [-1, 5, 7, 7, 7, 5], fingers: [0, 1, 2, 3, 4, 1], baseFret: 5, barre: { fret: 5, fromString: 1, toString: 5 } },
  ],
  Dm: [
    { name: 'Dm', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
    { name: 'Dm', label: 'Cejilla (Traste 5)', instrument: 'guitar', frets: [-1, 5, 7, 7, 6, 5], fingers: [0, 1, 3, 4, 2, 1], baseFret: 5, barre: { fret: 5, fromString: 1, toString: 5 } },
  ],
  D7: [
    { name: 'D7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], baseFret: 1 },
  ],
  Dmaj7: [
    { name: 'Dmaj7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3], baseFret: 1 },
  ],
  Dm7: [
    { name: 'Dm7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], baseFret: 1 },
  ],
  Dsus2: [
    { name: 'Dsus2', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0], baseFret: 1 },
  ],
  Dsus4: [
    { name: 'Dsus4', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3], baseFret: 1 },
  ],
  E: [
    { name: 'E', label: 'Posición abierta', instrument: 'guitar', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
  ],
  Em: [
    { name: 'Em', label: 'Posición abierta', instrument: 'guitar', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
    { name: 'Em', label: 'Cejilla (Traste 7)', instrument: 'guitar', frets: [-1, 7, 9, 9, 8, 7], fingers: [0, 1, 3, 4, 2, 1], baseFret: 7, barre: { fret: 7, fromString: 1, toString: 5 } },
  ],
  E7: [
    { name: 'E7', label: 'Posición abierta', instrument: 'guitar', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  ],
  Em7: [
    { name: 'Em7', label: 'Posición abierta', instrument: 'guitar', frets: [0, 2, 2, 0, 3, 0], fingers: [0, 1, 2, 0, 3, 0], baseFret: 1 },
  ],
  F: [
    { name: 'F', label: 'Cejilla completa (Traste 1)', instrument: 'guitar', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barre: { fret: 1, fromString: 0, toString: 5 } },
    { name: 'F', label: 'Posición reducida', instrument: 'guitar', frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], baseFret: 1 },
  ],
  Fmaj7: [
    { name: 'Fmaj7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], baseFret: 1 },
  ],
  G: [
    { name: 'G', label: 'Posición abierta', instrument: 'guitar', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], baseFret: 1 },
    { name: 'G', label: 'Acústica moderna (4 dedos)', instrument: 'guitar', frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4], baseFret: 1 },
    { name: 'G', label: 'Cejilla (Traste 3)', instrument: 'guitar', frets: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], baseFret: 3, barre: { fret: 3, fromString: 0, toString: 5 } },
  ],
  G7: [
    { name: 'G7', label: 'Posición abierta', instrument: 'guitar', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  ],
  A: [
    { name: 'A', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
    { name: 'A', label: 'Cejilla (Traste 5)', instrument: 'guitar', frets: [5, 7, 7, 6, 5, 5], fingers: [1, 3, 4, 2, 1, 1], baseFret: 5, barre: { fret: 5, fromString: 0, toString: 5 } },
  ],
  Am: [
    { name: 'Am', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
    { name: 'Am', label: 'Cejilla (Traste 5)', instrument: 'guitar', frets: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], baseFret: 5, barre: { fret: 5, fromString: 0, toString: 5 } },
  ],
  A7: [
    { name: 'A7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], baseFret: 1 },
  ],
  Am7: [
    { name: 'Am7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], baseFret: 1 },
  ],
  Asus2: [
    { name: 'Asus2', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 2, 3, 0, 0], baseFret: 1 },
  ],
  Asus4: [
    { name: 'Asus4', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
  ],
  B: [
    { name: 'B', label: 'Cejilla (Traste 2)', instrument: 'guitar', frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], baseFret: 2, barre: { fret: 2, fromString: 1, toString: 5 } },
  ],
  Bm: [
    { name: 'Bm', label: 'Cejilla (Traste 2)', instrument: 'guitar', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], baseFret: 2, barre: { fret: 2, fromString: 1, toString: 5 } },
  ],
  B7: [
    { name: 'B7', label: 'Posición abierta', instrument: 'guitar', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },
  ],
};

function buildMovableGuitarChord(
  chordName: string,
  rootSemitone: number,
  quality: string
): ChordVoicing[] {
  // E-shape barre (root on 6th string E=4)
  const eRootFret = ((rootSemitone - 4) % 12 + 12) % 12 || 12;
  // A-shape barre (root on 5th string A=9)
  const aRootFret = ((rootSemitone - 9) % 12 + 12) % 12 || 12;

  const q = quality.toLowerCase();
  const list: ChordVoicing[] = [];

  if (q === '' || q === 'maj') {
    list.push({
      name: chordName,
      label: `Cejilla forma E (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 2, eRootFret + 2, eRootFret + 1, eRootFret, eRootFret],
      fingers: [1, 3, 4, 2, 1, 1],
      baseFret: eRootFret,
      barre: { fret: eRootFret, fromString: 0, toString: 5 },
    });
    list.push({
      name: chordName,
      label: `Cejilla forma A (Traste ${aRootFret})`,
      instrument: 'guitar',
      frets: [-1, aRootFret, aRootFret + 2, aRootFret + 2, aRootFret + 2, aRootFret],
      fingers: [0, 1, 2, 3, 4, 1],
      baseFret: aRootFret,
      barre: { fret: aRootFret, fromString: 1, toString: 5 },
    });
  } else if (q === 'm' || q === 'min') {
    list.push({
      name: chordName,
      label: `Cejilla forma Em (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 2, eRootFret + 2, eRootFret, eRootFret, eRootFret],
      fingers: [1, 3, 4, 1, 1, 1],
      baseFret: eRootFret,
      barre: { fret: eRootFret, fromString: 0, toString: 5 },
    });
    list.push({
      name: chordName,
      label: `Cejilla forma Am (Traste ${aRootFret})`,
      instrument: 'guitar',
      frets: [-1, aRootFret, aRootFret + 2, aRootFret + 2, aRootFret + 1, aRootFret],
      fingers: [0, 1, 3, 4, 2, 1],
      baseFret: aRootFret,
      barre: { fret: aRootFret, fromString: 1, toString: 5 },
    });
  } else if (q === '7') {
    list.push({
      name: chordName,
      label: `Cejilla 7ª (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 2, eRootFret, eRootFret + 1, eRootFret, eRootFret],
      fingers: [1, 3, 1, 2, 1, 1],
      baseFret: eRootFret,
      barre: { fret: eRootFret, fromString: 0, toString: 5 },
    });
  } else if (q === 'maj7') {
    list.push({
      name: chordName,
      label: `Posición Maj7 (Traste ${aRootFret})`,
      instrument: 'guitar',
      frets: [-1, aRootFret, aRootFret + 2, aRootFret + 1, aRootFret + 2, aRootFret],
      fingers: [0, 1, 3, 2, 4, 1],
      baseFret: aRootFret,
      barre: { fret: aRootFret, fromString: 1, toString: 5 },
    });
  } else if (q === 'm7') {
    list.push({
      name: chordName,
      label: `Cejilla m7 (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 2, eRootFret, eRootFret, eRootFret, eRootFret],
      fingers: [1, 3, 1, 1, 1, 1],
      baseFret: eRootFret,
      barre: { fret: eRootFret, fromString: 0, toString: 5 },
    });
  } else if (q === 'sus2') {
    list.push({
      name: chordName,
      label: `Posición Sus2 (Traste ${aRootFret})`,
      instrument: 'guitar',
      frets: [-1, aRootFret, aRootFret + 2, aRootFret + 2, aRootFret, aRootFret],
      fingers: [0, 1, 3, 4, 1, 1],
      baseFret: aRootFret,
      barre: { fret: aRootFret, fromString: 1, toString: 5 },
    });
  } else if (q === 'sus4') {
    list.push({
      name: chordName,
      label: `Posición Sus4 (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 2, eRootFret + 2, eRootFret + 2, eRootFret, eRootFret],
      fingers: [1, 2, 3, 4, 1, 1],
      baseFret: eRootFret,
      barre: { fret: eRootFret, fromString: 0, toString: 5 },
    });
  } else if (q === 'dim' || q === 'dim7') {
    list.push({
      name: chordName,
      label: `Disminuido (Traste ${aRootFret})`,
      instrument: 'guitar',
      frets: [-1, aRootFret, aRootFret + 1, aRootFret + 2, aRootFret + 1, -1],
      fingers: [0, 1, 2, 4, 3, 0],
      baseFret: aRootFret,
    });
  } else if (q === 'aug' || q === '+') {
    list.push({
      name: chordName,
      label: `Aumentado (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 3, eRootFret + 2, eRootFret + 1, eRootFret + 1, -1],
      fingers: [1, 4, 3, 2, 2, 0],
      baseFret: eRootFret,
    });
  } else if (q === '5') {
    list.push({
      name: chordName,
      label: `Power Chord (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 2, eRootFret + 2, -1, -1, -1],
      fingers: [1, 3, 4, 0, 0, 0],
      baseFret: eRootFret,
    });
  } else {
    list.push({
      name: chordName,
      label: `Posición base (Traste ${eRootFret})`,
      instrument: 'guitar',
      frets: [eRootFret, eRootFret + 2, eRootFret + 2, eRootFret + 1, eRootFret, eRootFret],
      fingers: [1, 3, 4, 2, 1, 1],
      baseFret: eRootFret,
      barre: { fret: eRootFret, fromString: 0, toString: 5 },
    });
  }

  return list;
}

function buildBassChord(chordName: string, rootSemitone: number, quality: string): ChordVoicing[] {
  // 4-string bass: E1(4), A1(9), D2(2), G2(7)
  const eFret = ((rootSemitone - 4) % 12 + 12) % 12;
  const aFret = ((rootSemitone - 9) % 12 + 12) % 12;
  const q = quality.toLowerCase();
  const isMinor = q.startsWith('m') && !q.startsWith('maj');

  const thirdOffset = isMinor ? 3 : 4;
  const baseE = eFret === 0 ? 1 : eFret;
  const baseA = aFret === 0 ? 1 : aFret;

  return [
    {
      name: chordName,
      label: `Arpegio / Posición en 4ª cuerda (E)`,
      instrument: 'bass',
      frets: [eFret, eFret + 2, eFret + 2, eFret + thirdOffset - 1 >= 0 ? eFret + thirdOffset - 1 : -1],
      fingers: [1, 3, 4, 2],
      baseFret: Math.max(1, baseE),
    },
    {
      name: chordName,
      label: `Posición en 3ª cuerda (A)`,
      instrument: 'bass',
      frets: [-1, aFret, aFret + 2, aFret + (isMinor ? 0 : 1)],
      fingers: [0, 1, 3, 2],
      baseFret: Math.max(1, baseA),
    },
  ];
}

export function lookupChordDiagrams(
  rawChord: string,
  instrument: 'guitar' | 'bass' = 'guitar'
): ChordVoicing[] {
  const clean = rawChord.trim().split('/')[0]; // ignore slash bass for main voicing lookup
  const match = clean.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return [];

  const root = `${match[1]}${match[2]}`;
  const quality = match[3] || '';
  const rootSemitone = NOTE_TO_SEMITONE[root];
  if (rootSemitone === undefined) return [];

  if (instrument === 'bass') {
    return buildBassChord(rawChord.trim(), rootSemitone, quality);
  }

  // Exact open-chord lookup first (including enharmonic equivalents)
  const sharpRoot = CHROMATIC_SHARPS[rootSemitone];
  const exactKey = `${sharpRoot}${quality}`;
  const openMatches = GUITAR_OPEN_CHORDS[clean] || GUITAR_OPEN_CHORDS[exactKey];
  const movable = buildMovableGuitarChord(rawChord.trim(), rootSemitone, quality);

  if (openMatches && openMatches.length > 0) {
    return [...openMatches, ...movable.slice(0, 1)];
  }
  return movable;
}

export function transposeNoteName(
  note: string,
  semitones: number,
  preferFlats = false
): string {
  const semi = NOTE_TO_SEMITONE[note];
  if (semi === undefined) return note;
  const next = ((semi + semitones) % 12 + 12) % 12;
  return preferFlats ? CHROMATIC_FLATS[next] : CHROMATIC_SHARPS[next];
}

export function transposeChord(
  chord: string,
  semitones: number,
  preferFlats = false
): string {
  if (!semitones) return chord;
  const trimmed = chord.trim();
  const m = trimmed.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;

  const [, root, suffix, bass] = m;
  const nextRoot = transposeNoteName(root, semitones, preferFlats);
  const nextBass = bass ? `/${transposeNoteName(bass, semitones, preferFlats)}` : '';
  return `${nextRoot}${suffix}${nextBass}`;
}

export function isLikelyChordToken(token: string): boolean {
  return /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:sus[24]|add[0-9]|maj7|m7|dim7)?(?:\/[A-G][#b]?)?$/.test(
    token.trim()
  );
}

export function transposeSongContent(
  content: string,
  semitones: number,
  preferFlats = false
): string {
  if (!semitones) return content;

  return content
    .split('\n')
    .map((line) => {
      // 1. ChordPro inline brackets [G], [F#m7], [D/F#]
      if (/\[[A-G][#b]?[^\]]*\]/.test(line)) {
        return line.replace(/\[([^\]]+)\]/g, (full, inner: string) => {
          if (isLikelyChordToken(inner)) {
            return `[${transposeChord(inner, semitones, preferFlats)}]`;
          }
          return full;
        });
      }

      // 2. Standalone chord line (all tokens are chords)
      const tokens = line.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0 && tokens.every((t) => isLikelyChordToken(t))) {
        return line.replace(/[A-G][#b]?(?:[a-zA-Z0-9+#]*)?(?:\/[A-G][#b]?)?/g, (tok) =>
          isLikelyChordToken(tok) ? transposeChord(tok, semitones, preferFlats) : tok
        );
      }

      return line;
    })
    .join('\n');
}

export interface ParsedChordSegment {
  chord: string | null;
  lyric: string;
}

export interface ParsedSongLine {
  kind: 'section' | 'empty' | 'chords-lyrics';
  sectionTitle?: string;
  segments: ParsedChordSegment[];
}

export function parseSongDocument(content: string): {
  lines: ParsedSongLine[];
  uniqueChords: string[];
} {
  const uniqueSet = new Set<string>();
  const rawLines = content.split('\n');
  const lines: ParsedSongLine[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      lines.push({ kind: 'empty', segments: [] });
      continue;
    }

    // Section headers like {Coro} or [Estribillo] (not a chord)
    const secMatch = trimmed.match(/^(?:\[([^\]]+)\]|\{([^}]+)\})$/);
    if (secMatch) {
      const label = (secMatch[1] || secMatch[2] || '').trim();
      if (!isLikelyChordToken(label)) {
        lines.push({ kind: 'section', sectionTitle: label, segments: [] });
        continue;
      }
    }

    // Parse ChordPro inline [Chord]text segments
    if (rawLine.includes('[')) {
      const segments: ParsedChordSegment[] = [];
      const regex = /\[([^\]]+)\]/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(rawLine)) !== null) {
        if (match.index > lastIndex) {
          const textBefore = rawLine.slice(lastIndex, match.index);
          if (segments.length === 0) {
            segments.push({ chord: null, lyric: textBefore });
          } else {
            segments[segments.length - 1].lyric += textBefore;
          }
        }
        const token = match[1].trim();
        if (isLikelyChordToken(token)) {
          uniqueSet.add(token);
          segments.push({ chord: token, lyric: '' });
        } else {
          segments.push({ chord: null, lyric: `[${token}]` });
        }
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < rawLine.length) {
        const tail = rawLine.slice(lastIndex);
        if (segments.length === 0) {
          segments.push({ chord: null, lyric: tail });
        } else {
          segments[segments.length - 1].lyric += tail;
        }
      }

      lines.push({ kind: 'chords-lyrics', segments });
    } else {
      // Check if plain chord-only line
      const tokens = trimmed.split(/\s+/).filter(Boolean);
      if (tokens.length > 0 && tokens.every((t) => isLikelyChordToken(t))) {
        tokens.forEach((t) => uniqueSet.add(t));
        lines.push({
          kind: 'chords-lyrics',
          segments: tokens.map((t) => ({ chord: t, lyric: '   ' })),
        });
      } else {
        lines.push({
          kind: 'chords-lyrics',
          segments: [{ chord: null, lyric: rawLine }],
        });
      }
    }
  }

  return { lines, uniqueChords: Array.from(uniqueSet) };
}

// ============================================================================
// SCALES, KEYS & HARMONIC PROGRESSIONS
// ============================================================================

export interface ScaleDefinition {
  id: string;
  name: string;
  intervals: number[]; // semitones from root
  mood: string;
}

export const SCALE_LIBRARY: ScaleDefinition[] = [
  { id: 'major', name: 'Mayor (Jónica)', intervals: [0, 2, 4, 5, 7, 9, 11], mood: 'Brillante, alegre y estable' },
  { id: 'minor', name: 'Menor Natural (Eólica)', intervals: [0, 2, 3, 5, 7, 8, 10], mood: 'Melancólica, profunda y expresiva' },
  { id: 'pent-minor', name: 'Pentatónica Menor', intervals: [0, 3, 5, 7, 10], mood: 'Rock, blues e improvisación directa' },
  { id: 'pent-major', name: 'Pentatónica Mayor', intervals: [0, 2, 4, 7, 9], mood: 'Folk, pop acústico y melodías abiertas' },
  { id: 'blues', name: 'Escala de Blues', intervals: [0, 3, 5, 6, 7, 10], mood: 'Tensión blues con blue-note (b5)' },
  { id: 'dorian', name: 'Dórico', intervals: [0, 2, 3, 5, 7, 9, 10], mood: 'Funk, jazz modal y rock sofisticado' },
  { id: 'mixolydian', name: 'Mixolidio', intervals: [0, 2, 4, 5, 7, 9, 10], mood: 'Dominante rock clásico y grooves' },
  { id: 'harmonic-minor', name: 'Menor Armónica', intervals: [0, 2, 3, 5, 7, 8, 11], mood: 'Dramática, clásica y flamenca' },
];

export function getScaleNotes(rootSemitone: number, scaleId: string): string[] {
  const scale = SCALE_LIBRARY.find((s) => s.id === scaleId) || SCALE_LIBRARY[0];
  return scale.intervals.map((iv) => CHROMATIC_SHARPS[(rootSemitone + iv) % 12]);
}

export interface DiatonicChordItem {
  degree: string;
  chord: string;
  role: string;
}

export function getDiatonicKeyChords(
  rootSemitone: number,
  mode: 'major' | 'minor' = 'major'
): DiatonicChordItem[] {
  if (mode === 'minor') {
    const intervals = [0, 2, 3, 5, 7, 8, 10];
    const suffixes = ['m', 'dim', '', 'm', 'm', '', ''];
    const degrees = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
    const roles = ['Tónica', 'Supertónica', 'Mediante', 'Subdominante', 'Dominante menor', 'Submediante', 'Subtónica'];
    return intervals.map((iv, idx) => ({
      degree: degrees[idx],
      chord: `${CHROMATIC_SHARPS[(rootSemitone + iv) % 12]}${suffixes[idx]}`,
      role: roles[idx],
    }));
  }

  const intervals = [0, 2, 4, 5, 7, 9, 11];
  const suffixes = ['', 'm', 'm', '', '', 'm', 'dim'];
  const degrees = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const roles = ['Tónica', 'Supertónica', 'Mediante', 'Subdominante', 'Dominante', 'Relativa menor', 'Sensible'];
  return intervals.map((iv, idx) => ({
    degree: degrees[idx],
    chord: `${CHROMATIC_SHARPS[(rootSemitone + iv) % 12]}${suffixes[idx]}`,
    role: roles[idx],
  }));
}

export interface ProgressionPreset {
  id: string;
  name: string;
  style: string;
  degrees: number[]; // 0-indexed into diatonic major scale
  numerals: string;
}

export const PROGRESSION_TEMPLATES: ProgressionPreset[] = [
  { id: 'pop', name: 'Pop Universal', style: 'Pop / Rock', degrees: [0, 4, 5, 3], numerals: 'I – V – vi – IV' },
  { id: 'balada', name: 'Balada Emotiva', style: 'Acústico / Balada', degrees: [5, 3, 0, 4], numerals: 'vi – IV – I – V' },
  { id: 'clasica', name: 'Cadencia Clásica', style: 'Rock / Folk', degrees: [0, 3, 4, 0], numerals: 'I – IV – V – I' },
  { id: 'jazz', name: 'Jazz Turnaround', style: 'Jazz / Soul', degrees: [1, 4, 0, 5], numerals: 'ii – V – I – vi' },
  { id: 'canon', name: 'Secuencia Armónica', style: 'Indie / Clásico', degrees: [0, 4, 5, 2, 3, 0, 3, 4], numerals: 'I – V – vi – iii – IV – I – IV – V' },
];

// ============================================================================
// WEB AUDIO SYNTHESIZER (Tuner Reference Tones, Chord Strum, Metronome, Drums)
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;

export function getMusicAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function playReferenceTone(freqHz: number, durationSec = 1.15, gainLevel = 0.22): void {
  const ctx = getMusicAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc1.type = 'triangle';
  osc2.type = 'sine';
  osc1.frequency.setValueAtTime(freqHz, now);
  osc2.frequency.setValueAtTime(freqHz * 2, now); // gentle 2nd harmonic warmth

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(3200, freqHz * 6), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, freqHz * 2.2), now + durationSec);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(gainLevel, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

  const h2Gain = ctx.createGain();
  h2Gain.gain.setValueAtTime(0.18, now);

  osc1.connect(filter);
  osc2.connect(h2Gain);
  h2Gain.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + durationSec + 0.04);
  osc2.stop(now + durationSec + 0.04);
}

export function playChordVoicing(voicing: ChordVoicing, arpeggiate = true): void {
  const ctx = getMusicAudioContext();
  if (!ctx) return;

  const baseMidi =
    voicing.instrument === 'bass'
      ? [28, 33, 38, 43] // E1 A1 D2 G2
      : [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

  const now = ctx.currentTime;
  let noteIdx = 0;

  voicing.frets.forEach((fret, stringIdx) => {
    if (fret < 0 || stringIdx >= baseMidi.length) return;
    const midi = baseMidi[stringIdx] + fret;
    const freq = midiToFrequency(midi);
    const delay = arpeggiate ? noteIdx * 0.055 : 0;
    noteIdx += 1;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = voicing.instrument === 'bass' ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + delay);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voicing.instrument === 'bass' ? 900 : 2400, now + delay);
    filter.frequency.exponentialRampToValueAtTime(420, now + delay + 1.35);

    gain.gain.setValueAtTime(0.001, now + delay);
    gain.gain.linearRampToValueAtTime(0.11, now + delay + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + delay + 1.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + 1.5);
  });
}

export function playMetronomeClick(accent: boolean): void {
  const ctx = getMusicAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(accent ? 1320 : 880, now);
  osc.frequency.exponentialRampToValueAtTime(accent ? 660 : 440, now + 0.045);

  gain.gain.setValueAtTime(accent ? 0.34 : 0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

export function playDrumSound(kind: 'kick' | 'snare' | 'hihat' | 'rim'): void {
  const ctx = getMusicAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (kind === 'kick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
    return;
  }

  if (kind === 'rim') {
    playMetronomeClick(true);
    return;
  }

  // Noise burst for snare / hihat
  const length = Math.floor(ctx.sampleRate * (kind === 'snare' ? 0.14 : 0.05));
  const noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = kind === 'snare' ? 'bandpass' : 'highpass';
  filter.frequency.setValueAtTime(kind === 'snare' ? 1600 : 6500, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(kind === 'snare' ? 0.28 : 0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'snare' ? 0.14 : 0.05));

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
}

// ============================================================================
// FABRO CANCIONEROS — Data Models, Original Defaults & PDF Export
// ============================================================================

export type SongDifficulty = 'Principiante' | 'Intermedio' | 'Avanzado';

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  key: string;
  capo: number;
  difficulty: SongDifficulty;
  tuningId: string;
  folder: string;
  favorite: boolean;
  isDraft?: boolean;
  content: string; // ChordPro format: [G]Letra...
  updatedAt: string;
}

export const DEFAULT_SONGBOOK_SONGS: SongItem[] = [
  {
    id: 'song-fabro-amanecer',
    title: 'Amanecer en Sol (Estudio Acústico)',
    artist: 'FABRO Taller Musical (Original)',
    album: 'Cuaderno Acústico',
    genre: 'Folk / Acústico',
    key: 'G',
    capo: 0,
    difficulty: 'Principiante',
    tuningId: 'guitar-standard',
    folder: 'Mis Canciones',
    favorite: true,
    updatedAt: new Date().toISOString(),
    content: `{Introducción}
[G]   [D]   [Em]   [C]

{Verso 1}
[G]Suena la mañana sobre el [D]patio azul
[Em]cada cuerda guarda su pro[C]pia quietud
[G]respiramos lento antes de [D]empezar
[C]y el acorde abierto invita a [D]caminar.

{Estribillo}
[G]Sube la melodía, [D]clara y natural
[Em]entre notas limpias [C]vuelve a resonar
[Am]si cambias el tono, [D]cambia el color
[C]pero sigue viva la [D]misma canción [G].`,
  },
  {
    id: 'song-fabro-nocturno',
    title: 'Nocturno en La Menor (Progresión Creativa)',
    artist: 'FABRO Taller Musical (Original)',
    album: 'Estudios de Armonía',
    genre: 'Rock / Balada',
    key: 'Am',
    capo: 0,
    difficulty: 'Intermedio',
    tuningId: 'guitar-standard',
    folder: 'Práctica',
    favorite: false,
    updatedAt: new Date().toISOString(),
    content: `{Verso 1}
[Am]Luces en la ruta bajo el [F]cielo gris
[C]marca el metrónomo un [G]pulso sutil
[Am]rasgueo constante sin [F]perder el compás
[Dm]buscando el acorde que [E7]quiera quedar.

{Estribillo}
[F]Todo el horizonte se [G]vuelve canción
[C]cuando afinamos la [Am]inspiración
[Dm]puente de cuerdas hacia [G]otro lugar
[Am]listo para volver a tocar.`,
  },
];

function renderSongToPdfDoc(doc: jsPDF, song: SongItem, transposeSemitones = 0, isFirstPage = true) {
  if (!isFirstPage) doc.addPage();
  const transposedContent = transposeSongContent(song.content, transposeSemitones);
  const parsed = parseSongDocument(transposedContent);
  const transposedKey = transposeChord(song.key, transposeSemitones);

  let y = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(song.title || 'Sin título', 14, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 96, 110);
  const metaLine = `${song.artist || 'Autor propio'}  ·  Género: ${song.genre || 'General'}  ·  Tono: ${transposedKey}  ·  Capo: ${song.capo}  ·  Dificultad: ${song.difficulty}`;
  doc.text(metaLine, 14, y);
  y += 6;

  if (parsed.uniqueChords.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(67, 56, 202);
    doc.text(`Acordes: ${parsed.uniqueChords.join('   ')}`, 14, y);
    y += 7;
  }

  doc.setDrawColor(210, 215, 225);
  doc.line(14, y - 2, 196, y - 2);
  y += 4;

  for (const line of parsed.lines) {
    if (y > 272) {
      doc.addPage();
      y = 18;
    }

    if (line.kind === 'empty') {
      y += 4.5;
      continue;
    }

    if (line.kind === 'section') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text(`[${line.sectionTitle || 'Sección'}]`, 14, y);
      y += 6;
      continue;
    }

    const hasAnyChord = line.segments.some((s) => Boolean(s.chord));
    if (hasAnyChord) {
      let x = 14;
      for (const seg of line.segments) {
        if (seg.chord) {
          doc.setFont('courier', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(124, 58, 237);
          doc.text(seg.chord, x, y);
        }
        doc.setFont('courier', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(20, 24, 34);
        const lyricText = seg.lyric || '';
        doc.text(lyricText, x, y + 4.3);
        const advance = Math.max(
          doc.getTextWidth(lyricText),
          seg.chord ? doc.getTextWidth(seg.chord) + 2.5 : 0
        );
        x += advance;
      }
      y += 10.2;
    } else {
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(20, 24, 34);
      const plain = line.segments.map((s) => s.lyric).join('');
      doc.text(plain, 14, y);
      y += 5.5;
    }
  }
}

export function exportSongToPdf(song: SongItem, transposeSemitones = 0): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  renderSongToPdfDoc(doc, song, transposeSemitones, true);
  const safeName = (song.title || 'cancion-fabro').replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`${safeName}_FABRO.pdf`);
}

export function exportSongbookCollectionToPdf(collectionName: string, songs: SongItem[]): void {
  if (!songs.length) return;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Cover page
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(30, 41, 59);
  doc.text('FABRO CANCIONEROS', 14, 36);

  doc.setFontSize(16);
  doc.setTextColor(124, 58, 237);
  doc.text(collectionName || 'Mi Cancionero', 14, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(90, 96, 110);
  doc.text(`Total de canciones: ${songs.length}  ·  Generado desde FABRO`, 14, 58);

  let iy = 74;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Índice del Cancionero', 14, iy);
  iy += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  songs.forEach((song, idx) => {
    if (iy > 272) {
      doc.addPage();
      iy = 20;
    }
    doc.text(`${idx + 1}. ${song.title} — ${song.artist} (${song.key})`, 16, iy);
    iy += 6;
  });

  songs.forEach((song) => {
    renderSongToPdfDoc(doc, song, 0, false);
  });

  const safeCol = (collectionName || 'cancionero').replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`FABRO_Cancionero_${safeCol}.pdf`);
}
