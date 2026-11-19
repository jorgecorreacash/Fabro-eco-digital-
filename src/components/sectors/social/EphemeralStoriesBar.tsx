import React, { useEffect, useState } from 'react';
import { Camera, Clock, Plus, Sparkles, X } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { DEFAULT_STORIES, vaultGet, vaultSet } from '../../../services/localVault';
import type { EphemeralStory } from '../../../types/ecosystem';

const PRESET_STATUSES = [
  { tag: 'Estudiando para un final', gradient: 'linear-gradient(135deg, #2563EB, #06B6D4)' },
  { tag: 'Entrenando', gradient: 'linear-gradient(135deg, #10B981, #F59E0B)' },
  { tag: 'Modo enfoque', gradient: 'linear-gradient(135deg, #7C3AED, #EC4899)' },
];

export const EphemeralStoriesBar: React.FC = () => {
  const { profile } = useEcosystem();
  const [stories, setStories] = useState<EphemeralStory[]>(DEFAULT_STORIES);
  const [hydrated, setHydrated] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewing, setViewing] = useState<EphemeralStory | null>(null);

  const [statusTag, setStatusTag] = useState(PRESET_STATUSES[2].tag);
  const [ringGradient, setRingGradient] = useState(PRESET_STATUSES[2].gradient);
  const [text, setText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void vaultGet<EphemeralStory[]>('ephemeral_stories', DEFAULT_STORIES).then((stored) => {
      if (!active) return;
      const now = Date.now();
      const valid = stored.filter((s) => now - s.createdAtMs < 24 * 60 * 60 * 1000);
      setStories(valid.length > 0 ? valid : DEFAULT_STORIES);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void vaultSet('ephemeral_stories', stories);
  }, [stories, hydrated]);

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageDataUrl) return;
    const item: EphemeralStory = {
      id: `st-${Date.now()}`,
      author: profile.displayName,
      fabroId: profile.fabroId,
      statusTag,
      text: text.trim() || statusTag,
      imageDataUrl,
      ringGradient,
      expiresLabel: 'Expira en 24h',
      createdAtMs: Date.now(),
    };
    setStories((prev) => [item, ...prev]);
    setText('');
    setImageDataUrl(undefined);
    setComposerOpen(false);
  };

  return (
    <div className="rounded-2xl border-2 border-[#7C3AED]/30 fabro-surface p-4 space-y-3 shadow-[0_8px_24px_-12px_rgba(124,58,237,0.28)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#EC4899]" />
          <h3 className="font-display text-sm font-bold">Estados Efímeros 24h</h3>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen((v) => !v)}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#7C3AED] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white px-3.5 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)] cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Tu estado
        </button>
      </div>

      {/* Horizontal swipeable ring row */}
      <div className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory pb-1 no-scrollbar">
        {stories.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setViewing(st)}
            className="min-w-[148px] max-w-[164px] snap-start rounded-2xl border-2 fabro-border fabro-surface-elevated p-3 text-left space-y-2 cursor-pointer transition-transform active:scale-95 shrink-0"
          >
            <div className="flex items-center gap-2">
              <div
                style={{ background: st.ringGradient }}
                className="w-10 h-10 rounded-full p-0.5 shrink-0"
              >
                <div className="w-full h-full rounded-full fabro-surface flex items-center justify-center text-xs font-bold overflow-hidden">
                  {st.imageDataUrl ? (
                    <img src={st.imageDataUrl} alt={st.author} className="w-full h-full object-cover" />
                  ) : (
                    st.author.slice(0, 2).toUpperCase()
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{st.author}</p>
                <p className="text-[10px] font-semibold text-[#7C3AED] dark:text-[#C084FC] truncate">
                  {st.statusTag}
                </p>
              </div>
            </div>
            <p className="text-[11px] fabro-muted line-clamp-2 leading-snug">{st.text}</p>
          </button>
        ))}
      </div>

      {composerOpen && (
        <form
          onSubmit={handlePublish}
          className="rounded-xl border-2 border-[#EC4899]/35 fabro-surface-elevated p-3.5 space-y-3 text-xs"
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
                className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
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
            className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs font-semibold cursor-pointer">
              <Camera className="w-4 h-4 text-[#7C3AED]" />
              <span>{imageDataUrl ? 'Foto cargada' : 'Foto local'}</span>
              <input type="file" accept="image/*" onChange={handlePhotoPick} className="hidden" />
            </label>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
            >
              Publicar 24h
            </button>
          </div>
        </form>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border-2 border-[#EC4899] fabro-surface p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{viewing.author}</p>
                <p className="text-[11px] font-semibold text-[#7C3AED] dark:text-[#C084FC] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {viewing.statusTag} · {viewing.expiresLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label="Cerrar estado"
                className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {viewing.imageDataUrl && (
              <img
                src={viewing.imageDataUrl}
                alt={viewing.statusTag}
                className="w-full max-h-60 object-cover rounded-xl border fabro-border"
              />
            )}
            <p className="text-sm leading-relaxed">{viewing.text}</p>
          </div>
        </div>
      )}
    </div>
  );
};
