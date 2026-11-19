import React, { useMemo, useState } from 'react';
import {
  Check,
  Dumbbell,
  ExternalLink,
  Film,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { isDirectHtml5VideoUrl, parseVideoEmbedUrl } from '../../../services/videoEmbedUtils';
import type { VideoLibraryItem, WellnessVideoCategory } from '../../../types/ecosystem';

const WELLNESS_VIDEO_CATEGORIES: WellnessVideoCategory[] = [
  'Fuerza',
  'Cardio',
  'Nutrición',
  'Mindfulness / Estoicismo',
];

export const WellnessVideoLibraryPanel: React.FC = () => {
  const {
    wellnessVideos,
    addVideoLibraryItem,
    updateVideoNotes,
    deleteVideoLibraryItem,
    shareVideoToWall,
    navigateTo,
  } = useEcosystem();

  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<WellnessVideoCategory>('Fuerza');
  const [notesInput, setNotesInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todas' | WellnessVideoCategory>('Todas');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(wellnessVideos[0]?.id || null);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wellnessVideos.filter((v) => {
      const matchesCat = categoryFilter === 'Todas' || v.categoryOrSubject === categoryFilter;
      const matchesQ =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.categoryOrSubject.toLowerCase().includes(q) ||
        v.notes.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [categoryFilter, searchQuery, wellnessVideos]);

  const activeVideo: VideoLibraryItem | null =
    wellnessVideos.find((v) => v.id === activeVideoId) ||
    filteredVideos[0] ||
    wellnessVideos[0] ||
    null;

  const showToast = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = parseVideoEmbedUrl(urlInput);
    if (!parsed) {
      setFormError('Pegá un enlace válido de YouTube, Vimeo o video de entrenamiento/salud.');
      return;
    }
    const created = addVideoLibraryItem({
      sector: 'bienestar',
      title: titleInput.trim() || `Rutina de ${categoryInput}`,
      url: parsed.cleanUrl,
      embedUrl: parsed.embedUrl,
      provider: parsed.provider,
      thumbnailUrl: parsed.thumbnailUrl,
      categoryOrSubject: categoryInput,
      notes: notesInput.trim(),
    });
    setActiveVideoId(created.id);
    setUrlInput('');
    setTitleInput('');
    setNotesInput('');
    showToast(`Video «${created.title}» guardado en tu Videoteca de Bienestar.`);
  };

  const handleShare = async (video: VideoLibraryItem) => {
    await shareVideoToWall(video);
    showToast('Video recomendado en el Muro de Bienestar y en el Muro General (#Bienestar).');
  };

  return (
    <div className="space-y-4">
      {/* Add Video Form */}
      <form
        onSubmit={handleAddVideo}
        className="rounded-2xl border-2 border-[#10B981]/40 fabro-surface p-4 sm:p-5 space-y-3.5 text-xs shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#10B981]" />
              Videoteca de Bienestar, Entrenamiento y Salud
            </h2>
            <p className="text-[11px] fabro-muted mt-0.5">
              Guardá videos de fuerza, cardio, movilidad, recetas saludables o meditación estoica y reproducilos dentro de FABRO.
            </p>
          </div>
          <span className="rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-semibold tabular-nums">
            {wellnessVideos.length} videos guardados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... (rutina, receta o meditación)"
            className="md:col-span-5 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
            required
          />
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Título del video (ej. Movilidad matutina 15 min)..."
            className="md:col-span-4 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
          />
          <select
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value as WellnessVideoCategory)}
            aria-label="Categoría del video de bienestar"
            className="md:col-span-3 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-2.5 py-2 text-xs font-semibold fabro-input"
          >
            {WELLNESS_VIDEO_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Notas de técnica, series, ingredientes o sensaciones (opcional)..."
            className="flex-1 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
          />
          <button
            type="submit"
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Guardar Video
          </button>
        </div>

        {formError && (
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{formError}</p>
        )}
        {notice && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {notice}
          </p>
        )}
      </form>

      {/* Active Embedded Player + Notes */}
      {activeVideo && (
        <div className="rounded-2xl border-2 border-[#10B981]/40 fabro-surface p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="inline-block rounded-lg border border-[#10B981]/40 bg-[#10B981]/12 px-2 py-0.5 text-[11px] font-bold text-[#047857] dark:text-[#34D399]">
                  {activeVideo.categoryOrSubject}
                </span>
                <h3 className="font-display text-base font-bold mt-1 truncate">
                  {activeVideo.title}
                </h3>
              </div>
              <a
                href={activeVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold hover:border-[#10B981]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir enlace
              </a>
            </div>

            <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 fabro-border bg-black">
              {isDirectHtml5VideoUrl(activeVideo.embedUrl) ? (
                <video
                  src={activeVideo.embedUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <iframe
                  src={activeVideo.embedUrl}
                  title={activeVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleShare(activeVideo)}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981]/12 text-[#047857] dark:text-[#34D399] px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartir en Muro de Bienestar
              </button>
              <button
                type="button"
                onClick={() => navigateTo('bienestar', 'muro-bienestar')}
                className="text-xs font-bold text-[#047857] dark:text-[#34D399] hover:underline cursor-pointer"
              >
                Ver Muro de Bienestar →
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-2">
            <p className="font-display text-sm font-bold">
              Mis notas de rutina / ingredientes / práctica
            </p>
            <textarea
              rows={9}
              value={activeVideo.notes}
              onChange={(e) => updateVideoNotes('bienestar', activeVideo.id, e.target.value)}
              placeholder="Anotá peso usado, variantes sin impacto, ingredientes de la receta o cómo te sentiste al terminar..."
              className="flex-1 w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed fabro-input"
            />
          </div>
        </div>
      )}

      {/* Filter & Saved Videos Grid */}
      <div className="rounded-2xl border-2 fabro-border fabro-surface p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar video por título, categoría o nota..."
              className="min-h-[42px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated pl-9 pr-3 py-1.5 text-xs fabro-input"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['Todas', ...WELLNESS_VIDEO_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[36px] rounded-xl border-2 px-3 py-1 text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                  categoryFilter === cat
                    ? 'border-[#10B981] bg-[#10B981] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted hover:text-current'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed fabro-border p-8 text-center space-y-1.5">
            <Film className="w-7 h-7 mx-auto text-[#10B981] opacity-75" />
            <p className="text-sm font-bold">Tu Videoteca de Bienestar está lista</p>
            <p className="text-xs fabro-muted max-w-md mx-auto">
              Pegá enlaces de rutinas de fuerza, cardio, estiramientos, recetas saludables o meditación guiada para tenerlos siempre a mano.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredVideos.map((vid) => {
              const isSelected = activeVideo?.id === vid.id;
              return (
                <article
                  key={vid.id}
                  className={`rounded-2xl border-2 p-3.5 space-y-2.5 flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-[#10B981] bg-[#10B981]/8'
                      : 'fabro-border fabro-surface-elevated hover:border-[#10B981]/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveVideoId(vid.id)}
                    className="w-full text-left space-y-2 cursor-pointer"
                  >
                    {vid.thumbnailUrl ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden border fabro-border bg-black">
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute bottom-2 right-2 rounded-lg bg-black/80 text-white px-2 py-0.5 text-[10px] font-bold">
                          {isSelected ? 'Reproduciendo' : 'Reproducir ▶'}
                        </span>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl border fabro-border bg-gradient-to-br from-[#10B981]/20 to-[#F59E0B]/20 flex flex-col items-center justify-center gap-1 text-xs font-bold">
                        <Dumbbell className="w-6 h-6 text-[#10B981]" />
                        <span>{isSelected ? 'Reproduciendo' : 'Reproducir video'}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-[#047857] dark:text-[#34D399] truncate">
                        {vid.categoryOrSubject}
                      </span>
                      <span className="fabro-muted shrink-0">{vid.createdAt}</span>
                    </div>
                    <h4 className="font-display text-sm font-bold line-clamp-2">{vid.title}</h4>
                    {vid.notes && (
                      <p className="text-[11px] fabro-muted line-clamp-2">{vid.notes}</p>
                    )}
                  </button>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t fabro-border">
                    <button
                      type="button"
                      onClick={() => void handleShare(vid)}
                      className="min-h-[38px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#10B981]/50 bg-[#10B981]/10 text-[#047857] dark:text-[#34D399] px-2.5 py-1 text-[11px] font-bold cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Compartir en Muro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVideoLibraryItem('bienestar', vid.id)}
                      aria-label={`Eliminar ${vid.title}`}
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border-2 fabro-border fabro-surface text-rose-600 cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
