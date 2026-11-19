import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AM_GENRE_PRESETS,
  AM_STEP,
  clampFrequency,
  FM_GENRE_PRESETS,
  FM_STEP,
  formatFrequency,
  loadCustomStations,
  loadRadioFavorites,
  loadRadioPreferences,
  playRadioStaticBurst,
  saveCustomStations,
  saveRadioFavorites,
  saveRadioPreferences,
  searchRadioBrowserStations,
} from '../services/radioService';
import type {
  RadioBand,
  RadioPlaybackStatus,
  RadioPreferences,
  RadioStation,
  SleepTimerMinutes,
} from '../types/radio';

interface RadioContextValue {
  // UI Drawer / Modal
  radioModalOpen: boolean;
  openRadioModal: (presetBand?: RadioBand, presetGenreId?: string) => void;
  closeRadioModal: () => void;

  // Tuner & Band
  band: RadioBand;
  setBand: (band: RadioBand) => void;
  dialFrequency: number;
  tuneDialTo: (freq: number, autoPlayNearest?: boolean) => void;
  stepDial: (deltaSteps: number) => void;

  // Search & Catalog
  countryCode: string;
  setCountryCode: (code: string) => void;
  activeGenreId: string;
  selectGenrePreset: (genreId: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  runStationSearch: (opts?: {
    band?: RadioBand;
    countryCode?: string;
    genreId?: string;
    query?: string;
  }) => Promise<void>;
  stations: RadioStation[]; // merged directory + custom stations for current band
  loadingStations: boolean;
  searchError: string | null;

  // Active Playback
  currentStation: RadioStation | null;
  status: RadioPlaybackStatus;
  playbackError: string | null;
  playStation: (station: RadioStation) => void;
  togglePlayPause: () => void;
  stopRadio: () => void;
  nextStation: () => void;
  prevStation: () => void;

  // Volume & Static Effect
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  staticEffectEnabled: boolean;
  setStaticEffectEnabled: (enabled: boolean) => void;

  // Favorites & Manual Frequencies (LocalStorage)
  favorites: RadioStation[];
  isFavorite: (stationId: string) => boolean;
  toggleFavorite: (station: RadioStation) => void;
  customStations: RadioStation[];
  addCustomStation: (input: {
    name: string;
    streamUrl: string;
    band: RadioBand;
    frequency: number;
    country?: string;
  }) => RadioStation;
  removeCustomStation: (stationId: string) => void;

  // Sleep Timer
  sleepTimerMinutes: SleepTimerMinutes;
  sleepSecondsLeft: number;
  setSleepTimer: (minutes: SleepTimerMinutes) => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export const RadioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialPrefs = useMemo(() => loadRadioPreferences(), []);

  const [radioModalOpen, setRadioModalOpen] = useState(false);
  const [band, setBandState] = useState<RadioBand>(initialPrefs.band);
  const [countryCode, setCountryCodeState] = useState<string>(initialPrefs.countryCode);
  const [activeGenreId, setActiveGenreId] = useState<string>(
    initialPrefs.band === 'FM' ? 'fm-top' : 'am-all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [dialFrequency, setDialFrequency] = useState<number>(
    initialPrefs.band === 'FM' ? 99.9 : 790
  );

  const [directoryStations, setDirectoryStations] = useState<RadioStation[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [favorites, setFavorites] = useState<RadioStation[]>(() => loadRadioFavorites());
  const [customStations, setCustomStations] = useState<RadioStation[]>(() => loadCustomStations());

  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [status, setStatus] = useState<RadioPlaybackStatus>('idle');
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [volume, setVolumeState] = useState<number>(initialPrefs.volume);
  const [muted, setMuted] = useState(false);
  const [staticEffectEnabled, setStaticEffectEnabledState] = useState<boolean>(
    initialPrefs.staticEffectEnabled
  );

  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<SleepTimerMinutes>(0);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const lastStaticAtRef = useRef<number>(0);

  // Persist user prefs
  const persistPrefs = useCallback((patch: Partial<RadioPreferences>) => {
    const next: RadioPreferences = {
      ...loadRadioPreferences(),
      ...patch,
    };
    saveRadioPreferences(next);
  }, []);

  // Merge custom stations for active band with fetched stations (sorted by dial frequency)
  const stations = useMemo(() => {
    const customForBand = customStations.filter((c) => c.band === band);
    const merged = [...customForBand, ...directoryStations];
    return merged.sort((a, b) => a.frequency - b.frequency);
  }, [customStations, directoryStations, band]);

  const stationsRef = useRef<RadioStation[]>(stations);
  stationsRef.current = stations;
  const currentStationRef = useRef<RadioStation | null>(currentStation);
  currentStationRef.current = currentStation;
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;
  const staticEnabledRef = useRef<boolean>(staticEffectEnabled);
  staticEnabledRef.current = staticEffectEnabled;

  // Create persistent single HTML5 <audio> element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volumeRef.current;

    const onPlaying = () => {
      setStatus('playing');
      setPlaybackError(null);
    };
    const onPause = () => {
      setStatus((prev) => (prev === 'idle' ? 'idle' : 'paused'));
    };
    const onWaiting = () => {
      setStatus((prev) => (prev === 'idle' ? 'idle' : 'loading'));
    };
    const onError = () => {
      const st = currentStationRef.current;
      if (!st) return;
      setStatus('error');
      setPlaybackError(
        `No se pudo reproducir «${st.name}» en este navegador (el servidor de la emisora puede estar caído o bloquear HTTPS/CORS). Probá otra emisora del dial.`
      );
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, []);

  // Sync volume & mute to HTML5 Audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const triggerStaticIfEnabled = useCallback((targetBand: RadioBand) => {
    if (!staticEnabledRef.current) return;
    const now = Date.now();
    if (now - lastStaticAtRef.current < 160) return;
    lastStaticAtRef.current = now;
    playRadioStaticBurst(targetBand, volumeRef.current);
  }, []);

  const runStationSearch = useCallback(
    async (opts?: {
      band?: RadioBand;
      countryCode?: string;
      genreId?: string;
      query?: string;
    }) => {
      const targetBand = opts?.band ?? band;
      const targetCountry = opts?.countryCode ?? countryCode;
      const targetGenreId = opts?.genreId ?? activeGenreId;
      const targetQuery = opts?.query !== undefined ? opts.query : searchQuery;

      const presets = targetBand === 'FM' ? FM_GENRE_PRESETS : AM_GENRE_PRESETS;
      const preset = presets.find((p) => p.id === targetGenreId);

      setLoadingStations(true);
      setSearchError(null);

      const finalQuery = targetQuery.trim() || (!preset?.tag ? preset?.query || '' : '');
      const res = await searchRadioBrowserStations({
        band: targetBand,
        countryCode: targetCountry,
        tag: targetQuery.trim() ? '' : preset?.tag || '',
        query: finalQuery,
        globalSearch: Boolean(preset?.globalSearch && !targetQuery.trim()),
        limit: 42,
      });

      // Fallback if AM + "AM" query returned few stations in a specific country
      if (res.stations.length === 0 && targetBand === 'AM' && !targetQuery.trim()) {
        const retry = await searchRadioBrowserStations({
          band: 'AM',
          countryCode: targetCountry,
          tag: 'news',
          limit: 30,
        });
        setDirectoryStations(retry.stations);
        setSearchError(retry.error || null);
      } else {
        setDirectoryStations(res.stations);
        setSearchError(res.error || null);
      }

      setLoadingStations(false);
      setHasLoadedOnce(true);
    },
    [band, countryCode, activeGenreId, searchQuery]
  );

  const playStation = useCallback(
    (station: RadioStation) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (fadeTimerRef.current) {
        window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }

      triggerStaticIfEnabled(station.band);
      setCurrentStation(station);
      setBandState(station.band);
      setDialFrequency(station.frequency);
      setStatus('loading');
      setPlaybackError(null);
      persistPrefs({ lastStationId: station.id, band: station.band });

      audio.pause();
      audio.src = station.streamUrl;
      audio.volume = muted ? 0 : volumeRef.current;
      audio.load();
      void audio.play().catch(() => {
        setStatus('error');
        setPlaybackError(
          `El navegador bloqueó el inicio automático o la transmisión de «${station.name}» no responde. Tocá Reproducir o elegí otra frecuencia.`
        );
      });
    },
    [muted, persistPrefs, triggerStaticIfEnabled]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentStationRef.current) {
      const first = stationsRef.current[0] || favorites[0];
      if (first) {
        playStation(first);
      }
      return;
    }

    if (audio.paused) {
      setStatus('loading');
      setPlaybackError(null);
      if (!audio.src && currentStationRef.current) {
        audio.src = currentStationRef.current.streamUrl;
      }
      void audio.play().catch(() => {
        setStatus('error');
        setPlaybackError('No se pudo reanudar la transmisión. Probá otra emisora.');
      });
    } else {
      audio.pause();
      setStatus('paused');
    }
  }, [favorites, playStation]);

  const stopRadio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setCurrentStation(null);
    setStatus('idle');
    setPlaybackError(null);
    setSleepTimerMinutes(0);
    setSleepSecondsLeft(0);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }, []);

  const nextStation = useCallback(() => {
    const list = stationsRef.current.length > 0 ? stationsRef.current : favorites;
    if (list.length === 0) return;
    const cur = currentStationRef.current;
    if (!cur) {
      playStation(list[0]);
      return;
    }
    const idx = list.findIndex((s) => s.id === cur.id);
    const nextIdx = idx >= 0 ? (idx + 1) % list.length : 0;
    playStation(list[nextIdx]);
  }, [favorites, playStation]);

  const prevStation = useCallback(() => {
    const list = stationsRef.current.length > 0 ? stationsRef.current : favorites;
    if (list.length === 0) return;
    const cur = currentStationRef.current;
    if (!cur) {
      playStation(list[list.length - 1]);
      return;
    }
    const idx = list.findIndex((s) => s.id === cur.id);
    const prevIdx = idx >= 0 ? (idx - 1 + list.length) % list.length : list.length - 1;
    playStation(list[prevIdx]);
  }, [favorites, playStation]);

  // -------------------------------------------------------------------------
  // Media Session API (Background playback + Lock screen & Notification bar)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!currentStation) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    const artwork: MediaImage[] = currentStation.favicon
      ? [{ src: currentStation.favicon, sizes: '192x192', type: 'image/png' }]
      : [];

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentStation.name,
        artist: `${currentStation.band} ${formatFrequency(currentStation.frequency, currentStation.band)} · ${currentStation.country}`,
        album: 'FABRO Radio Digital',
        artwork,
      });
    } catch {
      // ignore older MediaMetadata edge cases
    }

    navigator.mediaSession.playbackState = status === 'playing' ? 'playing' : 'paused';

    const safeSetHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // unsupported action in this browser
      }
    };

    safeSetHandler('play', () => togglePlayPause());
    safeSetHandler('pause', () => togglePlayPause());
    safeSetHandler('nexttrack', () => nextStation());
    safeSetHandler('previoustrack', () => prevStation());
    safeSetHandler('stop', () => stopRadio());
  }, [currentStation, status, togglePlayPause, nextStation, prevStation, stopRadio]);

  // -------------------------------------------------------------------------
  // Sleep Timer Countdown with Smooth Fade-Out
  // -------------------------------------------------------------------------
  const setSleepTimer = useCallback((minutes: SleepTimerMinutes) => {
    setSleepTimerMinutes(minutes);
    setSleepSecondsLeft(minutes * 60);
  }, []);

  useEffect(() => {
    if (sleepSecondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSleepSecondsLeft((prev) => {
        if (prev <= 1) {
          // Fade out over ~1.5s then pause
          const audio = audioRef.current;
          if (audio && !audio.paused) {
            const startVol = audio.volume;
            let step = 0;
            fadeTimerRef.current = window.setInterval(() => {
              step += 1;
              const nextVol = Math.max(0, startVol * (1 - step / 10));
              if (audioRef.current) audioRef.current.volume = nextVol;
              if (step >= 10) {
                if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);
                fadeTimerRef.current = null;
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.volume = volumeRef.current;
                }
                setStatus('paused');
              }
            }, 150);
          }
          setSleepTimerMinutes(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepSecondsLeft > 0]);

  // -------------------------------------------------------------------------
  // Tuner Actions
  // -------------------------------------------------------------------------
  const setBand = useCallback(
    (nextBand: RadioBand) => {
      if (nextBand === band) return;
      triggerStaticIfEnabled(nextBand);
      const nextGenre = nextBand === 'FM' ? 'fm-top' : 'am-all';
      setBandState(nextBand);
      setActiveGenreId(nextGenre);
      setDialFrequency(nextBand === 'FM' ? 99.9 : 790);
      persistPrefs({ band: nextBand });
      void runStationSearch({ band: nextBand, genreId: nextGenre, query: '' });
    },
    [band, persistPrefs, runStationSearch, triggerStaticIfEnabled]
  );

  const setCountryCode = useCallback(
    (code: string) => {
      setCountryCodeState(code);
      persistPrefs({ countryCode: code });
      void runStationSearch({ countryCode: code });
    },
    [persistPrefs, runStationSearch]
  );

  const selectGenrePreset = useCallback(
    (genreId: string) => {
      setActiveGenreId(genreId);
      setSearchQuery('');
      void runStationSearch({ genreId, query: '' });
    },
    [runStationSearch]
  );

  const tuneDialTo = useCallback(
    (freq: number, autoPlayNearest = false) => {
      const clamped = clampFrequency(freq, band);
      setDialFrequency(clamped);
      triggerStaticIfEnabled(band);

      if (autoPlayNearest && stationsRef.current.length > 0) {
        const tolerance = band === 'FM' ? 0.45 : 35;
        let nearest: RadioStation | null = null;
        let minDiff = Infinity;
        for (const st of stationsRef.current) {
          const d = Math.abs(st.frequency - clamped);
          if (d < minDiff) {
            minDiff = d;
            nearest = st;
          }
        }
        if (nearest && minDiff <= tolerance) {
          playStation(nearest);
        }
      }
    },
    [band, playStation, triggerStaticIfEnabled]
  );

  const stepDial = useCallback(
    (deltaSteps: number) => {
      const step = band === 'FM' ? FM_STEP : AM_STEP;
      const nextFreq = clampFrequency(dialFrequency + deltaSteps * step, band);
      tuneDialTo(nextFreq, true);
    },
    [band, dialFrequency, tuneDialTo]
  );

  const openRadioModal = useCallback(
    (presetBand?: RadioBand, presetGenreId?: string) => {
      setRadioModalOpen(true);
      if (presetBand && presetBand !== band) {
        const targetGenre = presetGenreId || (presetBand === 'FM' ? 'fm-top' : 'am-all');
        setBandState(presetBand);
        setActiveGenreId(targetGenre);
        setDialFrequency(presetBand === 'FM' ? 99.9 : 790);
        persistPrefs({ band: presetBand });
        void runStationSearch({ band: presetBand, genreId: targetGenre, query: '' });
        return;
      }
      if (presetGenreId) {
        setActiveGenreId(presetGenreId);
        void runStationSearch({ genreId: presetGenreId, query: '' });
        return;
      }
      if (!hasLoadedOnce) {
        void runStationSearch();
      }
    },
    [band, hasLoadedOnce, persistPrefs, runStationSearch]
  );

  const closeRadioModal = useCallback(() => setRadioModalOpen(false), []);

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.min(1, Math.max(0, v));
      setVolumeState(clamped);
      if (clamped > 0 && muted) setMuted(false);
      persistPrefs({ volume: clamped });
    },
    [muted, persistPrefs]
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const setStaticEffectEnabled = useCallback(
    (enabled: boolean) => {
      setStaticEffectEnabledState(enabled);
      persistPrefs({ staticEffectEnabled: enabled });
    },
    [persistPrefs]
  );

  const isFavorite = useCallback(
    (stationId: string) => favorites.some((f) => f.id === stationId),
    [favorites]
  );

  const toggleFavorite = useCallback((station: RadioStation) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === station.id);
      const next = exists ? prev.filter((f) => f.id !== station.id) : [station, ...prev];
      saveRadioFavorites(next);
      return next;
    });
  }, []);

  const addCustomStation = useCallback(
    (input: {
      name: string;
      streamUrl: string;
      band: RadioBand;
      frequency: number;
      country?: string;
    }): RadioStation => {
      const station: RadioStation = {
        id: `custom-${Date.now()}`,
        name: input.name.trim(),
        streamUrl: input.streamUrl.trim(),
        country: input.country?.trim() || 'Frecuencia local',
        countryCode: countryCode || 'AR',
        tags: ['manual', input.band.toLowerCase()],
        codec: input.streamUrl.toLowerCase().includes('.m3u8')
          ? 'HLS'
          : input.streamUrl.toLowerCase().includes('.aac')
          ? 'AAC'
          : 'MP3',
        bitrate: 0,
        band: input.band,
        frequency: clampFrequency(input.frequency, input.band),
        isCustom: true,
      };
      setCustomStations((prev) => {
        const next = [station, ...prev];
        saveCustomStations(next);
        return next;
      });
      return station;
    },
    [countryCode]
  );

  const removeCustomStation = useCallback((stationId: string) => {
    setCustomStations((prev) => {
      const next = prev.filter((c) => c.id !== stationId);
      saveCustomStations(next);
      return next;
    });
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== stationId);
      saveRadioFavorites(next);
      return next;
    });
  }, []);

  const value: RadioContextValue = {
    radioModalOpen,
    openRadioModal,
    closeRadioModal,
    band,
    setBand,
    dialFrequency,
    tuneDialTo,
    stepDial,
    countryCode,
    setCountryCode,
    activeGenreId,
    selectGenrePreset,
    searchQuery,
    setSearchQuery,
    runStationSearch,
    stations,
    loadingStations,
    searchError,
    currentStation,
    status,
    playbackError,
    playStation,
    togglePlayPause,
    stopRadio,
    nextStation,
    prevStation,
    volume,
    setVolume,
    muted,
    toggleMute,
    staticEffectEnabled,
    setStaticEffectEnabled,
    favorites,
    isFavorite,
    toggleFavorite,
    customStations,
    addCustomStation,
    removeCustomStation,
    sleepTimerMinutes,
    sleepSecondsLeft,
    setSleepTimer,
  };

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
};

export function useRadio(): RadioContextValue {
  const ctx = useContext(RadioContext);
  if (!ctx) {
    throw new Error('useRadio debe usarse dentro de RadioProvider');
  }
  return ctx;
}
