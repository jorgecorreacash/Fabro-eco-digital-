export type HabitToneId = 'campana' | 'digital' | 'acorde' | 'suave';

export const HABIT_TONE_LABELS: Record<HabitToneId, string> = {
  campana: 'Campana clásica',
  digital: 'Aviso digital',
  acorde: 'Acorde armónico',
  suave: 'Pulso suave',
};

let activeStopHandle: (() => void) | null = null;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function scheduleToneSequence(
  ctx: AudioContext,
  tone: HabitToneId,
  volume: number,
  startOffsetSec: number
): void {
  const baseTime = ctx.currentTime + startOffsetSec;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0.05, Math.min(1, volume)), baseTime);
  masterGain.connect(ctx.destination);

  const playNote = (
    freq: number,
    offset: number,
    duration: number,
    type: OscillatorType,
    peak = 0.6
  ) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, baseTime + offset);

    g.gain.setValueAtTime(0.0001, baseTime + offset);
    g.gain.exponentialRampToValueAtTime(peak, baseTime + offset + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, baseTime + offset + duration);

    osc.connect(g);
    g.connect(masterGain);

    osc.start(baseTime + offset);
    osc.stop(baseTime + offset + duration + 0.03);
  };

  if (tone === 'campana') {
    playNote(880, 0, 0.7, 'sine', 0.65);
    playNote(1318.5, 0.02, 0.55, 'sine', 0.35);
    playNote(1760, 0.04, 0.45, 'triangle', 0.2);
    return;
  }

  if (tone === 'digital') {
    playNote(784, 0, 0.14, 'triangle', 0.55);
    playNote(1046.5, 0.16, 0.22, 'triangle', 0.65);
    playNote(1318.5, 0.4, 0.26, 'triangle', 0.55);
    return;
  }

  if (tone === 'acorde') {
    playNote(523.25, 0, 0.45, 'sine', 0.45);
    playNote(659.25, 0.09, 0.45, 'sine', 0.45);
    playNote(783.99, 0.18, 0.5, 'sine', 0.45);
    playNote(1046.5, 0.27, 0.65, 'sine', 0.55);
    return;
  }

  // 'suave'
  playNote(432, 0, 0.55, 'sine', 0.45);
  playNote(648, 0.2, 0.6, 'sine', 0.35);
}

export function stopHabitAlertSound(): void {
  if (activeStopHandle) {
    activeStopHandle();
    activeStopHandle = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore speech cancel errors
    }
  }
}

export function playHabitAlertSound(options: {
  tone?: HabitToneId;
  volume?: number;
  repeats?: number;
  spokenMessage?: string;
}): () => void {
  stopHabitAlertSound();

  const tone: HabitToneId = options.tone || 'acorde';
  const volume = typeof options.volume === 'number' ? options.volume : 0.8;
  const repeats = Math.max(1, Math.min(4, options.repeats || 2));

  const AudioCtx = getAudioContextConstructor();
  let ctx: AudioContext | null = null;
  let speechTimer: number | null = null;

  if (AudioCtx) {
    try {
      ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      for (let i = 0; i < repeats; i++) {
        scheduleToneSequence(ctx, tone, volume, i * 0.85);
      }
    } catch {
      ctx = null;
    }
  }

  if (options.spokenMessage && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const delayMs = ctx ? Math.min(repeats * 850, 2600) : 50;
    speechTimer = window.setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(options.spokenMessage!);
        utter.lang = 'es-AR';
        utter.volume = Math.max(0.1, Math.min(1, volume));
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore speech synthesis blocked errors
      }
    }, delayMs);
  }

  const cleanup = () => {
    if (speechTimer !== null) {
      window.clearTimeout(speechTimer);
      speechTimer = null;
    }
    if (ctx) {
      void ctx.close().catch(() => undefined);
      ctx = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  };

  activeStopHandle = cleanup;
  return cleanup;
}
