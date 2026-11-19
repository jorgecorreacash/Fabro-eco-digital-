import React, { useEffect, useState } from 'react';
import { Camera, Clock, Film, Loader2, Play, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  compressImageOnCanvas,
  getMediaObjectUrl,
  saveVideoAttachmentToVault,
} from '../../../services/mediaVault';
import type { EphemeralStory } from '../../../types/ecosystem';

const PRESET_STATUSES = [
  { tag: 'Estudiando para un final', gradient: 'linear-gradient(135deg, #2563EB, #06B6D4)' },
  { tag: 'Entrenando', gradient: 'linear-gradient(135deg, #10B981, #F59E0B)' },
  { tag: 'Modo enfoque', gradient: 'linear-gradient(135deg, #7C3AED, #EC4899)' },
];

export const EphemeralStoriesBar: React.FC = () => {
  const { profile, ephemeralStories, addEphemeralStory, deleteEphemeralStory } = useEcosystem();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewing, setViewing] = useState<EphemeralStory | null>(null);
  const [viewingVideoUrl, setViewingVideoUrl] = useState<string | null>(null);

  const [statusTag, setStatusTag] = useState(PRESET_STATUSES[2].tag);
  const [ringGradient, setRingGradient] = useState(PRESET_STATUSES[2].gradient);
  const [text, setText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const visibleStories = ephemeralStories.filter(
    (s) => Date.now() - s.createdAtMs < 24 * 60 * 60 * 1000
  );

  useEffect(() => {
    let active = true;
    if (viewing?.mediaKind === 'video' && viewing.videoMediaId) {
      void getMediaObjectUrl(viewing.videoMediaId).then((url) => {
        if (active) setViewingVideoUrl(url);
      });
    } else {
      setViewingVideoUrl(null);
    }
    return () => {
      active = false;
    };
  }, [viewing]);

  const handleMediaPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type.startsWith('video/')) {
      setVideoFile(file);
      setImageDataUrl(undefined);
      return;
    }
    if (file.type.startsWith('image/')) {
      setProcessing(true);
      try {
        const compressed = await compressImageOnCanvas(file, {
          maxWidth: 960,
          maxHeight: 960,
          quality: 0.82,
        });
        setImageDataUrl(compressed.dataUrl);
        setVideoFile(null);
      } finally {
        setProcessing(false);
      }
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageDataUrl && !videoFile) return;
    setProcessing(true);
    try {
      let videoMediaId: string | undefined;
      let videoPosterUrl: string | undefined;
      let mediaKind: 'text' | 'image' | 'video' = imageDataUrl ? 'image' : 'text';

      if (videoFile) {
        const saved = await saveVideoAttachmentToVault(videoFile, text.trim() || statusTag);
        videoMediaId = saved.mediaVaultId;
        videoPosterUrl = saved.posterDataUrl;
        mediaKind = 'video';
      }

      addEphemeralStory({
        author: profile.displayName,
        fabroId: profile.fabroId,
        authorAvatar: profile.photoURL,
        statusTag,
        text: text.trim() || statusTag,
        imageDataUrl,
        videoMediaId,
        videoPosterUrl,
        mediaKind,
        ringGradient,
      });
      setText('');
      setImageDataUrl(undefined);
      setVideoFile(null);
      setComposerOpen(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#EC4899]" />
          <h3 className="font-display text-sm font-bold">Estados e Historias 24h</h3>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen((v) => !v)}
          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Tu historia
        </button>
      </div>

      {/* Horizontal swipeable ring row */}
      <div
        data-no-swipe="true"
        className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory pb-1 no-scrollbar"
      >
        {visibleStories.map((st) => {
          const thumb = st.imageDataUrl || st.videoPosterUrl || st.authorAvatar;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setViewing(st)}
              className="min-w-[152px] max-w-[168px] snap-start rounded-2xl border fabro-border fabro-surface-elevated p-3 text-left space-y-2 cursor-pointer transition-transform active:scale-95 shrink-0"
            >
              <div className="flex items-center gap-2">
                <div
                  style={{ background: st.ringGradient }}
                  className="relative w-10 h-10 rounded-full p-0.5 shrink-0"
                >
                  <div className="w-full h-full rounded-full fabro-surface flex items-center justify-center text-xs font-bold overflow-hidden">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={st.author}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      st.author.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  {st.mediaKind === 'video' && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#EC4899] text-white flex items-center justify-center">
                      <Play className="w-2.5 h-2.5 fill-current" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{st.author}</p>
                  <p className="text-[10px] font-semibold text-[#7C3AED] dark:text-[#C4B5FD] truncate">
                    {st.statusTag}
                  </p>
                </div>
              </div>
              <p className="text-[11px] fabro-muted line-clamp-2 leading-snug">{st.text}</p>
            </button>
          );
        })}
      </div>

      {composerOpen && (
        <form
          onSubmit={handlePublish}
          className="rounded-xl border border-[#EC4899]/35 fabro-surface-elevated p-3.5 space-y-3 text-xs"
        >
          <div className="flex flex-wrap gap-1.5">
            {PRESET_STATUSES.map((p) => (
              <button
                key={p.tag}
                type="button"
                onClick={() => {
                  setStatusTag(p.tag);
                  setRingGradient(p.gradient);
                }}
                className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-semibold cursor-pointer active:scale-95 ${
                  statusTag === p.tag
                    ? 'border-[#EC4899] bg-[#EC4899]/15 text-[#BE185D] dark:text-[#F472B6]'
                    : 'fabro-border fabro-surface'
                }`}
              >
                {p.tag}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="¿Qué estás haciendo ahora?"
            className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-3 py-1.5 text-xs font-semibold cursor-pointer">
              {videoFile ? (
                <Film className="w-4 h-4 text-[#EC4899]" />
              ) : (
                <Camera className="w-4 h-4 text-[#7C3AED]" />
              )}
              <span>
                {videoFile
                  ? `Video: ${videoFile.name.slice(0, 18)}`
                  : imageDataUrl
                  ? 'Foto lista'
                  : 'Foto o video'}
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaPick}
                className="hidden"
              />
            </label>
            <button
              type="submit"
              disabled={processing}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-4 py-1.5 text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Publicar 24h
            </button>
          </div>
        </form>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewing(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#EC4899] fabro-surface p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{viewing.author}</p>
                <p className="text-[11px] font-semibold text-[#7C3AED] dark:text-[#C4B5FD] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {viewing.statusTag} · {viewing.expiresLabel}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {viewing.fabroId.toUpperCase() === profile.fabroId.toUpperCase() && (
                  <button
                    type="button"
                    onClick={() => {
                      deleteEphemeralStory(viewing.id);
                      setViewing(null);
                    }}
                    aria-label="Eliminar mi historia"
                    className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  aria-label="Cerrar historia"
                  className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {viewing.mediaKind === 'video' && viewingVideoUrl ? (
              <video
                src={viewingVideoUrl}
                poster={viewing.videoPosterUrl}
                controls
                autoPlay
                playsInline
                className="w-full max-h-72 rounded-xl bg-black object-contain"
              />
            ) : viewing.imageDataUrl ? (
              <img
                src={viewing.imageDataUrl}
                alt={viewing.statusTag}
                referrerPolicy="no-referrer"
                className="w-full max-h-72 object-cover rounded-xl border fabro-border"
              />
            ) : (
              <div
                style={{ background: viewing.ringGradient }}
                className="rounded-xl p-6 text-center text-white font-display text-base font-bold shadow-inner"
              >
                {viewing.text}
              </div>
            )}

            {(viewing.imageDataUrl || viewing.mediaKind === 'video') && (
              <p className="text-sm leading-relaxed">{viewing.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
