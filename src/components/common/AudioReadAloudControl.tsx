import React, { useMemo } from 'react';
import { Download, Loader2, Pause, Square, Volume2 } from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';

export type { TtsVoiceName } from '../../context/AudioPlayerContext';

interface AudioReadAloudControlProps {
  getText: () => string;
  title: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

export const AudioReadAloudControl: React.FC<AudioReadAloudControlProps> = ({
  getText,
  title,
  subtitle = 'FABRO Estudio por voz',
  compact = false,
  className = '',
}) => {
  const {
    activeTrackId,
    isPlaying,
    isPaused,
    loadingTrackId,
    loadingMode,
    togglePlayTrack,
    stopPlayback,
    downloadTrackMp3,
  } = useAudioPlayer();

  const trackId = useMemo(
    () => `track_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48)}`,
    [title]
  );

  const isThisTrack = activeTrackId === trackId;
  const isThisLoadingPlay = loadingTrackId === trackId && loadingMode === 'play';
  const isThisLoadingDownload = loadingTrackId === trackId && loadingMode === 'download';
  const isAnyLoading = loadingTrackId !== null;
  const isThisPlaying = isThisTrack && isPlaying && !isPaused;
  const isThisPaused = isThisTrack && isPaused;

  const handlePlay = () => {
    const text = getText();
    void togglePlayTrack({
      id: trackId,
      title,
      subtitle,
      text,
    });
  };

  const handleDownload = () => {
    const text = getText();
    void downloadTrackMp3({
      id: trackId,
      title,
      subtitle,
      text,
    });
  };

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <button
        type="button"
        disabled={isAnyLoading}
        onClick={handlePlay}
        title={isThisPlaying ? 'Pausar lectura' : 'Escuchar en voz alta (continúa en segundo plano)'}
        className={
          compact
            ? 'inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 disabled:opacity-50 cursor-pointer'
            : `inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer ${
                isThisTrack && isPlaying
                  ? 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`
        }
      >
        {isThisLoadingPlay ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isThisPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
        <span>
          {isThisLoadingPlay
            ? 'Generando...'
            : isThisPlaying
            ? 'Pausar'
            : isThisPaused
            ? 'Reanudar'
            : 'Escuchar'}
        </span>
      </button>

      <button
        type="button"
        disabled={isAnyLoading}
        onClick={handleDownload}
        title="Descargar audio narrado en formato MP3"
        className={
          compact
            ? 'inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 disabled:opacity-50 cursor-pointer'
            : 'inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer'
        }
      >
        {isThisLoadingDownload ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span>{isThisLoadingDownload ? 'MP3...' : 'MP3'}</span>
      </button>

      {isThisTrack && (isPlaying || isPaused) && (
        <button
          type="button"
          onClick={stopPlayback}
          aria-label="Detener reproducción"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-red-500 cursor-pointer"
        >
          <Square className="w-3 h-3" />
          <span>Detener</span>
        </button>
      )}
    </div>
  );
};
