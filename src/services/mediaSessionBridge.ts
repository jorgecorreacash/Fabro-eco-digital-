export type MediaSessionMode = 'timer' | 'speech' | 'audio';

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onStop?: () => void;
}

export interface MediaSessionConfig {
  title: string;
  artist: string;
  album?: string;
  mode: MediaSessionMode;
  playbackState: 'playing' | 'paused';
  handlers?: MediaSessionHandlers;
  keepSilentAudioAlive?: boolean;
}

let silentAudioUrl: string | null = null;
let keepAliveAudio: HTMLAudioElement | null = null;
let activeMode: MediaSessionMode | null = null;
let currentHandlers: MediaSessionHandlers = {};

// Build a tiny 1-second silent PCM WAV in memory (zero network) so Android/Chrome registers lock-screen MediaSession
function getSilentWavDataUrl(): string {
  if (silentAudioUrl) return silentAudioUrl;
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  silentAudioUrl = URL.createObjectURL(blob);
  return silentAudioUrl;
}

function ensureKeepAliveAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!keepAliveAudio) {
    keepAliveAudio = new Audio(getSilentWavDataUrl());
    keepAliveAudio.loop = true;
    keepAliveAudio.volume = 0.001;
    keepAliveAudio.setAttribute('playsinline', 'true');
  }
  return keepAliveAudio;
}

export function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function activateMediaSession(config: MediaSessionConfig): void {
  if (typeof window === 'undefined') return;
  activeMode = config.mode;
  currentHandlers = config.handlers || {};

  if (config.keepSilentAudioAlive !== false) {
    const audio = ensureKeepAliveAudio();
    if (audio) {
      if (config.playbackState === 'playing') {
        void audio.play().catch(() => {
          // Autoplay restriction ignored if triggered outside gesture
        });
      } else {
        audio.pause();
      }
    }
  }

  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: config.title,
      artist: config.artist,
      album: config.album || '🍀 FABRO 🍀',
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = config.playbackState;

    const bindHandler = (
      action: MediaSessionAction,
      fn?: () => void
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, fn ? () => fn() : null);
      } catch {
        // unsupported action in this browser
      }
    };

    bindHandler('play', currentHandlers.onPlay);
    bindHandler('pause', currentHandlers.onPause);
    bindHandler('nexttrack', currentHandlers.onNext);
    bindHandler('previoustrack', currentHandlers.onPrev);
    bindHandler('stop', currentHandlers.onStop);
  } catch {
    // ignore mediaSession errors on restricted browsers
  }
}

export function updateMediaSessionPosition(
  durationSec: number,
  positionSec: number
): void {
  if (!isMediaSessionSupported()) return;
  if (typeof navigator.mediaSession.setPositionState !== 'function') return;
  try {
    const safeDuration = Math.max(1, durationSec);
    const safePos = Math.min(safeDuration, Math.max(0, positionSec));
    navigator.mediaSession.setPositionState({
      duration: safeDuration,
      playbackRate: 1,
      position: safePos,
    });
  } catch {
    // ignore invalid position state
  }
}

export function stopMediaSession(modeToClear?: MediaSessionMode): void {
  if (modeToClear && activeMode && activeMode !== modeToClear) return;
  activeMode = null;
  currentHandlers = {};

  if (keepAliveAudio) {
    keepAliveAudio.pause();
  }

  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.playbackState = 'none';
    const actions: MediaSessionAction[] = [
      'play',
      'pause',
      'nexttrack',
      'previoustrack',
      'stop',
    ];
    actions.forEach((a) => {
      try {
        navigator.mediaSession.setActionHandler(a, null);
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}
