import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/apiClient';

export type TtsVoiceName = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

export const TTS_VOICE_OPTIONS: Array<{ value: TtsVoiceName; label: string }> = [
  { value: 'Kore', label: 'Voz Kore (Clara)' },
  { value: 'Zephyr', label: 'Voz Zephyr (Cálida)' },
  { value: 'Puck', label: 'Voz Puck (Dinámica)' },
  { value: 'Charon', label: 'Voz Charon (Profunda)' },
  { value: 'Fenrir', label: 'Voz Fenrir (Firme)' },
];

export const PLAYBACK_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export interface AudioTrackInput {
  id: string;
  title: string;
  subtitle?: string;
  text: string;
}

interface AudioPlayerContextValue {
  activeTrackId: string | null;
  activeTitle: string;
  activeSubtitle: string;
  voice: TtsVoiceName;
  setVoice: (v: TtsVoiceName) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  isPlaying: boolean;
  isPaused: boolean;
  usingBrowserVoice: boolean;
  loadingTrackId: string | null;
  loadingMode: 'play' | 'download' | null;
  progress: number;
  duration: number;
  notice: string;
  error: string;
  clearMessages: () => void;
  togglePlayTrack: (track: AudioTrackInput) => Promise<void>;
  pausePlayback: () => void;
  resumePlayback: () => Promise<void>;
  stopPlayback: () => void;
  seekTo: (seconds: number) => void;
  skipSeconds: (delta: number) => void;
  downloadTrackMp3: (track: AudioTrackInput) => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

function computeTextSignature(voice: string, text: string): string {
  const sample = `${text.slice(0, 180)}|${text.slice(-180)}|${text.length}`;
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash + sample.charCodeAt(i)) | 0;
  }
  return `${voice}:${hash}`;
}

function base64ToMp3Blob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'audio/mpeg' });
}

function triggerMp3Download(blob: Blob, title: string) {
  const slug = (title || 'audio-fabro')
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]+/g, '_')
    .slice(0, 72);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug || 'audio-fabro'}.mp3`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeSubtitle, setActiveSubtitle] = useState('');
  const [voice, setVoiceState] = useState<TtsVoiceName>('Kore');
  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [usingBrowserVoice, setUsingBrowserVoice] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<'play' | 'download' | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Single root HTMLAudioElement persists across route changes, tab switches & background app usage
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheMapRef = useRef<Map<string, { blob: Blob; url: string }>>(new Map());
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const updateMediaSessionState = useCallback(
    (title: string, subtitle: string, playing: boolean) => {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title || 'FABRO Audio de Estudio',
          artist: 'FABRO · Lectura en segundo plano',
          album: subtitle || 'Material Académico',
        });
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      } catch {
        // Safe fallback for browsers without MediaMetadata
      }
    },
    []
  );

  const updatePositionState = useCallback((el: HTMLAudioElement) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: el.duration,
        playbackRate: el.playbackRate || 1,
        position: Math.min(el.duration, Math.max(0, el.currentTime || 0)),
      });
    } catch {
      // Ignore invalid position state errors
    }
  }, []);

  const ensureAudioElement = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(0);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'none';
        }
      };
      audio.ontimeupdate = () => {
        setProgress(audio.currentTime || 0);
        setDuration(audio.duration || 0);
        updatePositionState(audio);
      };
      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 0);
        audio.playbackRate = playbackRateRef.current;
        updatePositionState(audio);
      };
      audio.onplay = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };
      audio.onpause = () => {
        if (!audio.ended && audio.currentTime > 0) {
          setIsPaused(true);
        }
      };
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [updatePositionState]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setUsingBrowserVoice(false);
    setProgress(0);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }, []);

  const pausePlayback = useCallback(() => {
    if (usingBrowserVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      updateMediaSessionState(activeTitle, activeSubtitle, false);
      return;
    }
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
      updateMediaSessionState(activeTitle, activeSubtitle, false);
    }
  }, [activeSubtitle, activeTitle, updateMediaSessionState, usingBrowserVoice]);

  const resumePlayback = useCallback(async () => {
    if (usingBrowserVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      updateMediaSessionState(activeTitle, activeSubtitle, true);
      return;
    }
    const audio = audioRef.current;
    if (audio && audio.src) {
      audio.playbackRate = playbackRateRef.current;
      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
      updateMediaSessionState(activeTitle, activeSubtitle, true);
    }
  }, [activeSubtitle, activeTitle, updateMediaSessionState, usingBrowserVoice]);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration)) return;
      const clamped = Math.max(0, Math.min(audio.duration, seconds));
      audio.currentTime = clamped;
      setProgress(clamped);
      updatePositionState(audio);
    },
    [updatePositionState]
  );

  const skipSeconds = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seekTo((audio.currentTime || 0) + delta);
    },
    [seekTo]
  );

  // Register OS-level Media Session controls (lockscreen / notification bar / background app switching)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => {
        void resumePlayback();
      });
      ms.setActionHandler('pause', () => {
        pausePlayback();
      });
      ms.setActionHandler('stop', () => {
        stopPlayback();
      });
      ms.setActionHandler('seekbackward', (details) => {
        skipSeconds(-(details?.seekOffset || 15));
      });
      ms.setActionHandler('seekforward', (details) => {
        skipSeconds(details?.seekOffset || 15);
      });
      ms.setActionHandler('seekto', (details) => {
        if (typeof details?.seekTime === 'number') {
          seekTo(details.seekTime);
        }
      });
    } catch {
      // Some browsers don't support all MediaSession action handlers
    }
  }, [pausePlayback, resumePlayback, seekTo, skipSeconds, stopPlayback]);

  // Cleanup cached blob URLs on root unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      for (const item of cacheMapRef.current.values()) {
        URL.revokeObjectURL(item.url);
      }
      cacheMapRef.current.clear();
    };
  }, []);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      const clamped = Math.max(0.5, Math.min(3, rate));
      setPlaybackRateState(clamped);
      playbackRateRef.current = clamped;
      if (audioRef.current) {
        audioRef.current.playbackRate = clamped;
        updatePositionState(audioRef.current);
      }
    },
    [updatePositionState]
  );

  const setVoice = useCallback(
    (nextVoice: TtsVoiceName) => {
      stopPlayback();
      setVoiceState(nextVoice);
    },
    [stopPlayback]
  );

  const ensureMp3ForTrack = useCallback(
    async (track: AudioTrackInput): Promise<{ blob: Blob; url: string }> => {
      const sig = computeTextSignature(voice, track.text);
      const cached = cacheMapRef.current.get(sig);
      if (cached) return cached;

      const resp = await authFetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: track.text,
          title: track.title,
          voiceName: voice,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.audioBase64) {
        throw new Error(data.error || 'No se pudo generar el audio MP3.');
      }

      const blob = base64ToMp3Blob(data.audioBase64);
      const url = URL.createObjectURL(blob);
      const entry = { blob, url };
      cacheMapRef.current.set(sig, entry);
      if (data.truncated) {
        setNotice('Audio generado sobre los primeros ~13.000 caracteres del texto.');
      }
      return entry;
    },
    [voice]
  );

  const speakWithBrowserFallback = useCallback(
    (track: AudioTrackInput) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setError('Tu navegador no admite lectura por voz sin conexión.');
        return;
      }
      window.speechSynthesis.cancel();
      const clean = track.text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/https?:\/\/[^\s)]+/gi, '')
        .trim()
        .slice(0, 12000);

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-AR';
      utterance.rate = Math.min(2.5, playbackRateRef.current);
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => v.lang.toLowerCase().startsWith('es'));
      if (esVoice) utterance.voice = esVoice;

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setUsingBrowserVoice(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setUsingBrowserVoice(false);
      };

      setActiveTrackId(track.id);
      setActiveTitle(track.title);
      setActiveSubtitle(track.subtitle || 'Voz local');
      setUsingBrowserVoice(true);
      setIsPlaying(true);
      setIsPaused(false);
      updateMediaSessionState(track.title, track.subtitle || 'Voz local', true);
      window.speechSynthesis.speak(utterance);
    },
    [updateMediaSessionState]
  );

  const togglePlayTrack = useCallback(
    async (track: AudioTrackInput) => {
      setError('');
      setNotice('');

      const cleanText = (track.text || '').trim();
      if (!cleanText) {
        setError('No hay contenido de texto para leer en voz alta.');
        return;
      }

      if (activeTrackId === track.id) {
        if (isPlaying && !isPaused) {
          pausePlayback();
          return;
        }
        if (isPaused) {
          await resumePlayback();
          return;
        }
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setNotice('Sin conexión: reproduciendo con la voz local del dispositivo.');
        speakWithBrowserFallback(track);
        return;
      }

      setLoadingTrackId(track.id);
      setLoadingMode('play');
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        const { url } = await ensureMp3ForTrack(track);
        const audio = ensureAudioElement();
        if (audio.src !== url) {
          audio.src = url;
        }
        audio.playbackRate = playbackRateRef.current;
        setActiveTrackId(track.id);
        setActiveTitle(track.title);
        setActiveSubtitle(track.subtitle || 'Lectura en segundo plano');
        setUsingBrowserVoice(false);
        await audio.play();
        setIsPlaying(true);
        setIsPaused(false);
        updateMediaSessionState(track.title, track.subtitle || 'FABRO', true);
      } catch {
        setNotice('Voz neural temporalmente ocupada; reproduciendo con voz local del dispositivo.');
        speakWithBrowserFallback(track);
      } finally {
        setLoadingTrackId(null);
        setLoadingMode(null);
      }
    },
    [
      activeTrackId,
      ensureAudioElement,
      ensureMp3ForTrack,
      isPaused,
      isPlaying,
      pausePlayback,
      resumePlayback,
      speakWithBrowserFallback,
      updateMediaSessionState,
    ]
  );

  const downloadTrackMp3 = useCallback(
    async (track: AudioTrackInput) => {
      setError('');
      setNotice('');
      const cleanText = (track.text || '').trim();
      if (!cleanText) {
        setError('No hay contenido para exportar en MP3.');
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('La descarga de audio MP3 requiere conexión a internet.');
        return;
      }

      setLoadingTrackId(track.id);
      setLoadingMode('download');
      try {
        const { blob } = await ensureMp3ForTrack(track);
        triggerMp3Download(blob, track.title);
        setNotice('Archivo MP3 descargado.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo generar el archivo MP3.');
      } finally {
        setLoadingTrackId(null);
        setLoadingMode(null);
      }
    },
    [ensureMp3ForTrack]
  );

  const clearMessages = useCallback(() => {
    setError('');
    setNotice('');
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        activeTrackId,
        activeTitle,
        activeSubtitle,
        voice,
        setVoice,
        playbackRate,
        setPlaybackRate,
        isPlaying,
        isPaused,
        usingBrowserVoice,
        loadingTrackId,
        loadingMode,
        progress,
        duration,
        notice,
        error,
        clearMessages,
        togglePlayTrack,
        pausePlayback,
        resumePlayback,
        stopPlayback,
        seekTo,
        skipSeconds,
        downloadTrackMp3,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer debe usarse dentro de AudioPlayerProvider');
  return ctx;
}
