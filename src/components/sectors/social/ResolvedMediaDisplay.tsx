import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, Play, X } from 'lucide-react';
import { getMediaObjectUrl, PHOTO_FILTER_CSS } from '../../../services/mediaVault';
import type { SocialMediaAttachment } from '../../../types/ecosystem';

interface ResolvedMediaDisplayProps {
  item: SocialMediaAttachment;
  className?: string;
  compact?: boolean;
  onOpenLightbox?: () => void;
}

export const ResolvedMediaDisplay: React.FC<ResolvedMediaDisplayProps> = ({
  item,
  className = '',
  compact = false,
  onOpenLightbox,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(item.dataUrl || null);
  const [loading, setLoading] = useState<boolean>(!item.dataUrl && Boolean(item.mediaVaultId));

  useEffect(() => {
    let active = true;
    if (item.mediaVaultId) {
      setLoading(true);
      void getMediaObjectUrl(item.mediaVaultId).then((url) => {
        if (!active) return;
        if (url) {
          setResolvedUrl(url);
        } else if (item.dataUrl) {
          setResolvedUrl(item.dataUrl);
        }
        setLoading(false);
      });
    } else {
      setResolvedUrl(item.dataUrl || null);
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [item.dataUrl, item.mediaVaultId]);

  const filterCss = item.filter && item.filter !== 'none' ? PHOTO_FILTER_CSS[item.filter] : undefined;

  if (item.kind === 'video') {
    if (compact) {
      return (
        <button
          type="button"
          onClick={onOpenLightbox}
          className={`group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-left dark:border-slate-700 ${className}`}
        >
          {item.posterDataUrl ? (
            <img
              src={item.posterDataUrl}
              alt={item.caption || 'Video compartido'}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-1.5 bg-slate-900 text-slate-300">
              <Film className="h-7 w-7 text-cyan-400" />
              <span className="text-[11px] font-medium">Video guardado</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30 transition-colors group-hover:bg-slate-950/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-lg">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
          {typeof item.durationSec === 'number' && item.durationSec > 0 && (
            <span className="absolute bottom-2 right-2 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
              {Math.floor(item.durationSec / 60)}:{String(item.durationSec % 60).padStart(2, '0')}
            </span>
          )}
        </button>
      );
    }

    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-700 ${className}`}
      >
        {resolvedUrl ? (
          <video
            src={resolvedUrl}
            poster={item.posterDataUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-[420px] w-full bg-black object-contain"
          />
        ) : loading ? (
          <div className="flex h-52 items-center justify-center text-xs text-slate-300">
            Cargando video desde bóveda local...
          </div>
        ) : (
          <div className="flex h-52 flex-col items-center justify-center gap-1.5 px-4 text-center text-xs text-slate-300">
            <Film className="h-6 w-6 text-cyan-400" />
            <span>Video almacenado localmente en el dispositivo de origen.</span>
          </div>
        )}
        {item.caption && (
          <div className="border-t border-slate-800 bg-slate-950/90 px-3 py-2 text-xs text-slate-200">
            {item.caption}
          </div>
        )}
      </div>
    );
  }

  // Image rendering
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {resolvedUrl ? (
        <button
          type="button"
          onClick={onOpenLightbox}
          className="block h-full w-full cursor-zoom-in text-left"
        >
          <img
            src={resolvedUrl}
            alt={item.caption || 'Imagen compartida en FABRO'}
            referrerPolicy="no-referrer"
            style={filterCss ? { filter: filterCss } : undefined}
            className={`w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${
              compact ? 'h-full' : 'max-h-[420px]'
            }`}
          />
        </button>
      ) : (
        <div className="flex h-44 items-center justify-center text-xs text-slate-500">
          {loading ? 'Cargando imagen...' : 'Imagen no disponible'}
        </div>
      )}
      {!compact && item.caption && (
        <div className="border-t border-slate-200/80 bg-white/95 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-200">
          {item.caption}
        </div>
      )}
    </div>
  );
};

interface MediaLightboxModalProps {
  items: SocialMediaAttachment[];
  initialIndex: number;
  onClose: () => void;
  title?: string;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  items,
  initialIndex,
  onClose,
  title,
}) => {
  const [index, setIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1))
  );
  const current = items[index];
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(current?.dataUrl || null);

  useEffect(() => {
    if (!current) return;
    let active = true;
    if (current.mediaVaultId) {
      void getMediaObjectUrl(current.mediaVaultId).then((url) => {
        if (!active) return;
        setResolvedUrl(url || current.dataUrl || null);
      });
    } else {
      setResolvedUrl(current.dataUrl || null);
    }
    return () => {
      active = false;
    };
  }, [current]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && items.length > 1) {
        setIndex((i) => (i + 1) % items.length);
      }
      if (e.key === 'ArrowLeft' && items.length > 1) {
        setIndex((i) => (i - 1 + items.length) % items.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items.length, onClose]);

  if (!current) return null;
  const filterCss =
    current.filter && current.filter !== 'none' ? PHOTO_FILTER_CSS[current.filter] : undefined;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950/92 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Visor multimedia"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title || 'Galería FABRO'}</p>
          <p className="text-[11px] tabular-nums text-slate-300">
            {index + 1} de {items.length} · {current.kind === 'video' ? 'Video' : 'Foto'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20"
          aria-label="Cerrar visor"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-4 sm:p-8">
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            className="absolute left-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-white hover:bg-slate-800"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <div className="flex max-h-[80vh] max-w-4xl flex-col items-center justify-center">
          {current.kind === 'video' ? (
            resolvedUrl ? (
              <video
                key={current.id}
                src={resolvedUrl}
                poster={current.posterDataUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[74vh] max-w-full rounded-2xl bg-black shadow-2xl"
              />
            ) : (
              <div className="rounded-2xl border border-white/15 bg-slate-900 px-6 py-10 text-center text-sm text-slate-300">
                Video almacenado en el dispositivo de origen.
              </div>
            )
          ) : resolvedUrl ? (
            <img
              src={resolvedUrl}
              alt={current.caption || 'Vista ampliada'}
              referrerPolicy="no-referrer"
              style={filterCss ? { filter: filterCss } : undefined}
              className="max-h-[74vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          ) : (
            <div className="text-sm text-slate-300">Cargando medio...</div>
          )}

          {current.caption && (
            <p className="mt-3 max-w-2xl rounded-xl bg-white/10 px-4 py-2 text-center text-sm text-slate-100">
              {current.caption}
            </p>
          )}
        </div>

        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            className="absolute right-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-white hover:bg-slate-800"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};
