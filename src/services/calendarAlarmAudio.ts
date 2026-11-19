import type { CalendarAlarmTone } from '../types/ecosystem';

export const CALENDAR_ALARM_TONE_LABELS: Record<CalendarAlarmTone, string> = {
  campana: 'Campana Académica (Claro)',
  pulso: 'Pulso Digital (Enérgico)',
  cristal: 'Arpegio Cristal (Suave)',
  suave: 'Acorde Zen (Sereno)',
};

function createAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

/**
 * Plays a crisp, unmistakable audible reminder tone using native Web Audio API.
 * Works 100% offline with zero external audio files required.
 */
export function playCalendarAlarmTone(tone: CalendarAlarmTone = 'campana'): void {
  const ctx = createAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.14, now);
  master.connect(ctx.destination);

  const note = (
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType = 'sine',
    peak = 0.9
  ) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    env.gain.setValueAtTime(0.001, now + startOffset);
    env.gain.exponentialRampToValueAtTime(peak, now + startOffset + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
    osc.connect(env);
    env.connect(master);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.03);
  };

  if (tone === 'campana') {
    // Clear resonant double bell chime
    note(659.25, 0, 0.35, 'sine', 0.95);
    note(1318.5, 0, 0.22, 'triangle', 0.35);
    note(880, 0.28, 0.45, 'sine', 0.95);
    note(1760, 0.28, 0.25, 'triangle', 0.3);
    note(1046.5, 0.62, 0.6, 'sine', 0.9);
  } else if (tone === 'pulso') {
    // Rhythmic crisp 3-pulse digital alert
    for (let i = 0; i < 3; i += 1) {
      const base = i * 0.28;
      note(784, base, 0.12, 'triangle', 0.9);
      note(1046.5, base + 0.11, 0.13, 'sine', 0.95);
    }
  } else if (tone === 'cristal') {
    // Ascending C-major crystal arpeggio
    const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    freqs.forEach((f, idx) => {
      note(f, idx * 0.14, 0.45, 'sine', 0.85);
    });
  } else {
    // Serene zen harmonic chord
    note(440, 0, 0.85, 'sine', 0.7);
    note(554.37, 0.08, 0.8, 'sine', 0.6);
    note(659.25, 0.16, 0.85, 'sine', 0.65);
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([160, 80, 160, 80, 220]);
    } catch {
      // Ignore unsupported vibration API
    }
  }

  window.setTimeout(() => {
    void ctx.close().catch(() => {});
  }, 1600);
}
