import assert from 'node:assert/strict';
import {
  detectPitchYin,
  frequencyToNoteInfo,
  findClosestTargetString,
  lookupChordDiagrams,
  parseSongDocument,
  transposeChord,
  transposeSongContent,
  TUNING_PRESETS,
  SCALE_LIBRARY,
  getScaleNotes,
  getDiatonicKeyChords,
  DEFAULT_SONGBOOK_SONGS,
} from '../src/services/musicEngine';
import {
  FABRO_THEMES,
  PRIMARY_SCREENS_ORDER,
  normalizeThemeId,
} from '../src/data/ecosystemCatalog';

function synthesizeSine(freqHz: number, sampleRate = 48000, samples = 4096): Float32Array {
  const buf = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buf[i] = 0.65 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return buf;
}

console.log('1. Probando detector de pitch YIN sobre ondas senoidales puras...');
const pitchTargets = [
  { label: 'B0 (Bajo 5ª)', hz: 30.8677 },
  { label: 'E1 (Bajo 4ª)', hz: 41.2034 },
  { label: 'E2 (Guitarra 6ª)', hz: 82.4069 },
  { label: 'A2 (Guitarra 5ª)', hz: 110.0 },
  { label: 'E4 (Guitarra 1ª)', hz: 329.6276 },
  { label: 'A4 (Referencia)', hz: 440.0 },
];

for (const target of pitchTargets) {
  const buf = synthesizeSine(target.hz);
  const res = detectPitchYin(buf, 48000);
  assert.ok(res, `YIN debe detectar ${target.label} (${target.hz} Hz)`);
  const centsErr = Math.abs(1200 * Math.log2(res.frequency / target.hz));
  assert.ok(
    centsErr < 2.0,
    `${target.label}: esperado ${target.hz} Hz, obtenido ${res.frequency.toFixed(2)} Hz (error ${centsErr.toFixed(2)} cents)`
  );
  console.log(`   OK ${target.label}: ${res.frequency.toFixed(2)} Hz (error ${centsErr.toFixed(2)} cents)`);
}

console.log('2. Probando silence gate (ruido cero debe retornar null)...');
const silence = new Float32Array(4096);
assert.equal(detectPitchYin(silence, 48000), null, 'Silencio debe devolver null');

console.log('3. Probando conversión de frecuencia a nota y calibración A4...');
const a4Std = frequencyToNoteInfo(440, 440);
assert.equal(a4Std.noteName, 'A');
assert.equal(a4Std.octave, 4);
assert.equal(a4Std.cents, 0);

const a4Custom = frequencyToNoteInfo(432, 432);
assert.equal(a4Custom.noteName, 'A');
assert.equal(a4Custom.octave, 4);
assert.equal(a4Custom.cents, 0);

const guitarStd = TUNING_PRESETS.find((t) => t.id === 'guitar-standard');
assert.ok(guitarStd && guitarStd.strings.length === 6);
const closest = findClosestTargetString(110, guitarStd.strings, 440);
assert.ok(closest && closest.stringDef.label === 'A2' && Math.abs(closest.cents) < 0.5);
assert.equal(TUNING_PRESETS.length, 12, 'Deben existir las 12 afinaciones configuradas');

console.log('4. Probando transposición de acordes y canciones...');
assert.equal(transposeChord('G', 2), 'A');
assert.equal(transposeChord('F#m7', 3), 'Am7');
assert.equal(transposeChord('D/F#', 2), 'E/G#');
assert.equal(transposeChord('Bbmaj7', 2, true), 'Cmaj7');

const transposed = transposeSongContent('[G]Hola [D/F#]mundo [Em7]FABRO', 2);
assert.equal(transposed, '[A]Hola [E/G#]mundo [F#m7]FABRO');

const parsed = parseSongDocument('{title: Test}\n[Estribillo]\n[G]Camino [D]libre [Em]hoy');
assert.ok(
  parsed.uniqueChords.includes('G') &&
    parsed.uniqueChords.includes('D') &&
    parsed.uniqueChords.includes('Em')
);
assert.ok(parsed.lines.some((l) => l.kind === 'section'));

console.log('5. Probando biblioteca de acordes (Guitarra y Bajo) y escalas...');
for (const chord of ['G', 'C', 'F#m7', 'Bbmaj7', 'Asus4']) {
  const gVoicings = lookupChordDiagrams(chord, 'guitar');
  assert.ok(gVoicings.length >= 1, `Guitarra debe tener diagrama para ${chord}`);
  assert.equal(gVoicings[0].frets.length, 6);
}
for (const chord of ['E', 'Am', 'G7']) {
  const bVoicings = lookupChordDiagrams(chord, 'bass');
  assert.ok(bVoicings.length >= 1, `Bajo debe tener diagrama para ${chord}`);
  assert.equal(bVoicings[0].frets.length, 4);
}
assert.ok(SCALE_LIBRARY.length >= 8);
assert.equal(getScaleNotes(0, 'major').join(','), 'C,D,E,F,G,A,B');
assert.equal(getDiatonicKeyChords(0, 'major').length, 7);
assert.ok(DEFAULT_SONGBOOK_SONGS.length >= 2);

console.log('6. Probando TEMAS FABRO (10 plantillas + migración legacy) y orden de 6 sectores...');
const requiredThemes = [
  'midnight-purple',
  'cyber-blue',
  'neon-green',
  'galaxy',
  'obsidian',
  'arctic',
  'minimal-white',
  'sunset',
  'emerald',
  'gold-premium',
];
assert.equal(FABRO_THEMES.length, 10, 'TEMAS FABRO debe tener exactamente 10 plantillas');
for (const id of requiredThemes) {
  assert.ok(
    FABRO_THEMES.some((t) => t.id === id),
    `Falta plantilla obligatoria ${id}`
  );
}
assert.equal(normalizeThemeId('estandar'), 'midnight-purple');
assert.equal(normalizeThemeId('minimalista-claro'), 'minimal-white');
assert.equal(normalizeThemeId('unknown-legacy-id'), 'midnight-purple');

assert.equal(PRIMARY_SCREENS_ORDER[0].sector, 'social');
const sectorOrder = PRIMARY_SCREENS_ORDER.slice(1).map((s) => s.sector);
assert.deepEqual(
  sectorOrder,
  ['estudio', 'cultura', 'deportes', 'bienestar', 'herramientas', 'configuracion'],
  'El orden de los 6 sectores principales debe ser exacto'
);

console.log('TODAS LAS PRUEBAS PASARON CORRECTAMENTE (100%).');
