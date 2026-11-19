import React from 'react';
import {
  Clock,
  Heart,
  Loader2,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useRadio } from '../../context/RadioContext';
import { formatFrequency } from '../../services/radioService';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const RadioMiniPlayer: React.FC = () => {
  const {
    currentStation,
    status,
    togglePlayPause,
    stopRadio,
    nextStation,
    prevStation,
    volume,
    setVolume,
    muted,
    toggleMute,
    isFavorite,
    toggleFavorite,
    sleepSecondsLeft,
    openRadioModal,
    radioModalOpen,
  } = useRadio();

  // Only render when radio is active and full tuner modal is closed
  if (!currentStation || radioModalOpen) return null;

  const fav = isFavorite(currentStation.id);

  return (
    <aside
      aria-label="Mini-reproductor persistente de Radio Digital FABRO"
      className="no-print fixed bottom-[62px] left-2 right-[66px] sm:right-[160px] lg:bottom-5 lg:left-[260px] lg:right-auto lg:w-[460px] z-40 rounded-xl border fabro-border fabro-glass shadow-xl px-2.5 py-1.5 flex items-center gap-2"
    >
      {/* Play / Pause */}
      <button
        type="button"
        onClick={togglePlayPause}
        aria-label={status === 'playing' ? 'Pausar radio' : 'Reproducir radio'}
        className="w-9 h-9 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform"
      >
        {status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === 'playing' ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>

      {/* Station Info (tap opens tuner) */}
      <button
        type="button"
        onClick={() => openRadioModal()}
        className="flex-1 min-w-0 text-left cursor-pointer group"
        title="Abrir sintonizador AM / FM"
      >
        <p className="text-xs font-semibold truncate group-hover:text-[#0284C7] transition-colors flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-[#0284C7] shrink-0" />
          <span className="truncate">{currentStation.name}</span>
        </p>
        <div className="flex items-center gap-1.5 text-[10px] fabro-muted font-mono tabular-nums truncate">
          <span>
            {currentStation.band} {formatFrequency(currentStation.frequency, currentStation.band)}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {status === 'playing'
              ? 'En vivo'
              : status === 'loading'
              ? 'Conectando...'
              : status === 'error'
              ? 'Sin señal'
              : 'Pausa'}
          </span>
          {sleepSecondsLeft > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <Clock className="w-2.5 h-2.5" />
                {formatCountdown(sleepSecondsLeft)}
              </span>
            </>
          )}
        </div>
      </button>

      {/* Station Step & Quick Controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={prevStation}
          aria-label="Frecuencia anterior"
          className="hidden sm:inline-flex w-7 h-7 rounded-lg hover:bg-[var(--fabro-surface-2)] items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={nextStation}
          aria-label="Siguiente frecuencia"
          className="inline-flex w-7 h-7 rounded-lg hover:bg-[var(--fabro-surface-2)] items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Desktop Compact Volume */}
        <div className="hidden md:flex items-center gap-1 pl-1">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Activar sonido' : 'Silenciar radio'}
            className="w-7 h-7 rounded-lg hover:bg-[var(--fabro-surface-2)] flex items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
          >
            {muted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            type="range"
            aria-label="Volumen"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-14 accent-[#0284C7] cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={() => toggleFavorite(currentStation)}
          aria-label={fav ? 'Quitar de favoritas' : 'Guardar en favoritas'}
          className={`hidden sm:inline-flex w-7 h-7 rounded-lg hover:bg-[var(--fabro-surface-2)] items-center justify-center cursor-pointer ${
            fav ? 'text-rose-500' : 'fabro-muted hover:text-rose-500'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-current' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => openRadioModal()}
          aria-label="Abrir sintonizador completo"
          title="Abrir sintonizador AM / FM"
          className="inline-flex w-7 h-7 rounded-lg hover:bg-[var(--fabro-surface-2)] items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={stopRadio}
          aria-label="Apagar radio"
          title="Apagar radio"
          className="inline-flex w-7 h-7 rounded-lg hover:bg-rose-500/15 items-center justify-center fabro-muted hover:text-rose-500 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
