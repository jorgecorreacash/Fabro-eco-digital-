/**
 * Custom synthesized Web Audio walkie-talkie / Push-to-Talk cues for FABRO Social.
 * All tones are procedurally generated with oscillators — zero copyrighted trademarks.
 */

let sharedCtx: AudioContext | null = null;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function playBeep(freq: number, startSec: number, durationSec: number, peak = 0.22, type: OscillatorType = 'triangle') {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime + startSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

/** Crisp double rising chirp when pressing & holding "PRESIONAR PARA HABLAR" */
export function playPttStartBeep(enabled = true): void {
  if (!enabled) return;
  try {
    playBeep(980, 0, 0.055, 0.2, 'sine');
    playBeep(1480, 0.06, 0.075, 0.22, 'triangle');
  } catch {
    // ignore audio block
  }
}

/** Characteristic short Roger-chirp when releasing PTT to transmit voice clip */
export function playPttEndChirp(enabled = true): void {
  if (!enabled) return;
  try {
    playBeep(1320, 0, 0.045, 0.18, 'sine');
    playBeep(1760, 0.05, 0.06, 0.16, 'sine');
    playBeep(1180, 0.12, 0.07, 0.14, 'triangle');
  } catch {
    // ignore
  }
}

/** Distinct incoming radio alert chime when receiving/auto-playing a PTT clip */
export function playPttIncomingChirp(enabled = true): void {
  if (!enabled) return;
  try {
    playBeep(1120, 0, 0.05, 0.16, 'triangle');
    playBeep(1560, 0.06, 0.08, 0.18, 'sine');
  } catch {
    // ignore
  }
}

/** Soft cancel descending tone */
export function playPttCancelBeep(enabled = true): void {
  if (!enabled) return;
  try {
    playBeep(640, 0, 0.05, 0.14, 'sine');
    playBeep(420, 0.055, 0.07, 0.12, 'sine');
  } catch {
    // ignore
  }
}
