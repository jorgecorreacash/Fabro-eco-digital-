import React from 'react';
import {
  FastForward,
  Headphones,
  Pause,
  Play,
  Rewind,
  Square,
  X,
} from 'lucide-react';
import {
  PLAYBACK_SPEED_OPTIONS,
  TTS_VOICE_OPTIONS,
  useAudioPlayer,
  type TtsVoiceName,
} from '../../context/AudioPlayerContext';

export const GlobalAudioMiniPlayer: React.FC = () => {
  const {
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
    progress,
    duration,
    notice,
    error,
    clearMessages,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    seekTo,
    skipSeconds,
  } = useAudioPlayer();

  if (!activeTrackId && !notice && !error) return null;

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="no-print fixed bottom-[62px] lg:bottom-4 right-2 sm:right-4 left-2 sm:left-auto sm:w-[440px] z-40 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-[#0F1623]/95 backdrop-blur-md shadow-xl p-3 space-y-2">
      {(notice || error) && (
        <div className="flex items-start justify-between gap-2 text-[11px]">
          <p className={error ? 'text-red-600 dark:text-red-400' : 'text-sky-700 dark:text-sky-300'}>
            {error || notice}
          </p>
          <button
            type="button"
            onClick={clearMessages}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
            aria-label="Cerrar aviso de audio"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeTrackId && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-600/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {activeTitle}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {activeSubtitle} · Reproducción en segundo plano activa
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={stopPlayback}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer shrink-0"
              aria-label="Cerrar y detener reproductor"
              title="Detener y cerrar reproductor"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>

          {!usingBrowserVoice && duration > 0 && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 w-9 text-right">
                {formatTime(progress)}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                step={0.5}
                value={progress}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="flex-1 accent-sky-600 h-1.5 cursor-pointer"
                aria-label="Progreso del audio"
              />
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 w-9">
                {formatTime(duration)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {!usingBrowserVoice && (
                <button
                  type="button"
                  onClick={() => skipSeconds(-15)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Retroceder 15 segundos"
                  aria-label="Retroceder 15 segundos"
                >
                  <Rewind className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isPlaying && !isPaused) pausePlayback();
                  else void resumePlayback();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                {isPlaying && !isPaused ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Reanudar</span>
                  </>
                )}
              </button>

              {!usingBrowserVoice && (
                <button
                  type="button"
                  onClick={() => skipSeconds(15)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Adelantar 15 segundos"
                  aria-label="Adelantar 15 segundos"
                >
                  <FastForward className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                aria-label="Velocidad de reproducción"
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {PLAYBACK_SPEED_OPTIONS.map((spd) => (
                  <option key={spd} value={spd}>
                    {spd}x
                  </option>
                ))}
              </select>

              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value as TtsVoiceName)}
                aria-label="Voz"
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 max-w-[125px] cursor-pointer"
              >
                {TTS_VOICE_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
