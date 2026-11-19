// Original synthesized Push-to-Talk tones generated cleanly with Web Audio API (no trademarked assets)

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

export function playPttTone(kind: 'start' | 'end' | 'receive'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.08, now);
  master.connect(ctx.destination);

  const playNote = (freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    env.gain.setValueAtTime(0.001, now + startOffset);
    env.gain.exponentialRampToValueAtTime(0.9, now + startOffset + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
    osc.connect(env);
    env.connect(master);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.02);
  };

  if (kind === 'start') {
    playNote(520, 0, 0.075, 'triangle');
    playNote(740, 0.07, 0.095, 'sine');
  } else if (kind === 'end') {
    playNote(680, 0, 0.07, 'sine');
    playNote(440, 0.065, 0.11, 'triangle');
  } else {
    playNote(587.33, 0, 0.07, 'sine');
    playNote(880, 0.08, 0.12, 'sine');
  }

  window.setTimeout(() => {
    void ctx.close().catch(() => {});
  }, 450);
}

export function playSoftBell(kind: 'focus-end' | 'break-end' | 'interval'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.09, now);
  master.connect(ctx.destination);

  const strike = (freq: number, delay: number, dur: number) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    env.gain.setValueAtTime(0.001, now + delay);
    env.gain.exponentialRampToValueAtTime(0.85, now + delay + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
    osc.connect(env);
    env.connect(master);
    osc.start(now + delay);
    osc.stop(now + delay + dur + 0.03);
  };

  if (kind === 'focus-end') {
    strike(523.25, 0, 0.25);
    strike(659.25, 0.16, 0.28);
    strike(783.99, 0.32, 0.42);
  } else if (kind === 'break-end') {
    strike(659.25, 0, 0.22);
    strike(880, 0.18, 0.35);
  } else {
    strike(740, 0, 0.14);
  }

  window.setTimeout(() => {
    void ctx.close().catch(() => {});
  }, 950);
}
