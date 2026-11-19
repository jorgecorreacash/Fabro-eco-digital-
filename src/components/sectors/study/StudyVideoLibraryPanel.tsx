import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ExternalLink,
  FilePlus2,
  Film,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { isDirectHtml5VideoUrl, parseVideoEmbedUrl } from '../../../services/videoEmbedUtils';
import type { VideoLibraryItem } from '../../../types/ecosystem';

const DEFAULT_STUDY_SUBJECTS = [
  'General',
  'Derecho',
  'IPC / Metodología',
  'Programación',
  'Historia',
  'Matemática',
  'Biología',
  'Economía',
];

export const StudyVideoLibraryPanel: React.FC = () => {
  const {
    studyVideos,
    addVideoLibraryItem,
    updateVideoNotes,
    deleteVideoLibraryItem,
    shareVideoToWall,
    createAdvancedNote,
    updateAdvancedNote,
    advancedNotes,
    navigateTo,
  } = useEcosystem();

  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('General');
  const [notesInput, setNotesInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('Todas');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(studyVideos[0]?.id || null);

  const allSubjects = useMemo(() => {
    const set = new Set<string>(DEFAULT_STUDY_SUBJECTS);
    advancedNotes.forEach((n) => {
      if (n.subject.trim()) set.add(n.subject.trim());
    });
    studyVideos.forEach((v) => {
      if (v.categoryOrSubject.trim()) set.add(v.categoryOrSubject.trim());
    });
    return Array.from(set);
  }, [advancedNotes, studyVideos]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studyVideos.filter((v) => {
      const matchesSubject =
        subjectFilter === 'Todas' || v.categoryOrSubject === subjectFilter;
      const matchesQuery =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.categoryOrSubject.toLowerCase().includes(q) ||
        v.notes.toLowerCase().includes(q);
      return matchesSubject && matchesQuery;
    });
  }, [searchQuery, studyVideos, subjectFilter]);

  const activeVideo: VideoLibraryItem | null =
    studyVideos.find((v) => v.id === activeVideoId) || filteredVideos[0] || studyVideos[0] || null;

  const showToast = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = parseVideoEmbedUrl(urlInput);
    if (!parsed) {
      setFormError('Pegá un enlace válido de YouTube, Vimeo, Google Drive o clase grabada.');
      return;
    }
    const cleanTitle = titleInput.trim() || `Clase de ${subjectInput.trim() || 'Estudio'}`;
    const created = addVideoLibraryItem({
      sector: 'estudio',
      title: cleanTitle,
      url: parsed.cleanUrl,
      embedUrl: parsed.embedUrl,
      provider: parsed.provider,
      thumbnailUrl: parsed.thumbnailUrl,
      categoryOrSubject: subjectInput.trim() || 'General',
      notes: notesInput.trim(),
    });
    setActiveVideoId(created.id);
    setUrlInput('');
    setTitleInput('');
    setNotesInput('');
    showToast(`Video «${created.title}» guardado en tu Videoteca Educativa.`);
  };

  const handleSendNotesToWordSheet = (video: VideoLibraryItem) => {
    const text = `Videoclase: ${video.title}\nEnlace: ${video.url}\nMateria: ${video.categoryOrSubject}\n\nNotas clave:\n${
      video.notes.trim() || 'Sin notas cargadas todavía.'
    }`;
    const created = createAdvancedNote({
      title: `Apunte · ${video.title}`,
      subject: video.categoryOrSubject || 'General',
      folder: 'Videoteca Educativa',
    });
    updateAdvancedNote(created.id, {
      tags: ['videoclase', video.categoryOrSubject.toLowerCase()],
      mainIdea: `Resumen de la clase: ${video.title}`,
      summaryText: video.notes.trim().slice(0, 320),
      contentHtml: `<h2>${video.title}</h2><p><strong>Materia:</strong> ${video.categoryOrSubject} · <a href="${video.url}" target="_blank" rel="noopener noreferrer">Ver enlace original</a></p><p>${(
        video.notes.trim() || 'Escribí tus apuntes aquí...'
      ).replace(/\n/g, '<br/>')}</p>`,
      contentText: text,
    });
    showToast('Notas enviadas a tus Apuntes de Estudio.');
  };

  const handleShareVideo = async (video: VideoLibraryItem) => {
    await shareVideoToWall(video);
    showToast('Video publicado en el Muro de Estudio y en el Muro General.');
  };

  return (
    <div className="space-y-4">
      {/* Add Video Compact Form */}
      <form
        onSubmit={handleAddVideo}
        className="rounded-2xl border-2 border-[#2563EB]/35 fabro-surface p-4 sm:p-5 space-y-3.5 text-xs shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Film className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              Videoteca Educativa · Clases y Apuntes en Vivo
            </h2>
            <p className="text-[11px] fabro-muted mt-0.5">
              Pegá enlaces de YouTube, Vimeo, Drive o clases grabadas para reproducirlos acá y tomar notas al lado.
            </p>
          </div>
          <span className="rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-semibold tabular-nums">
            {studyVideos.length} clases guardadas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... o Vimeo / Drive"
            className="md:col-span-5 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
            required
          />
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Título de la clase o tema..."
            className="md:col-span-4 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
          />
          <div className="md:col-span-3 flex gap-2">
            <select
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              aria-label="Materia de la videoclase"
              className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface-elevated px-2.5 py-2 text-xs font-semibold fabro-input"
            >
              {allSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Notas clave iniciales o minutos importantes (opcional, ej. 12:40 definición central)..."
            className="flex-1 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
          />
          <button
            type="submit"
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Guardar Clase
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

      {/* Active Embedded Player + Side-by-Side Live Notes */}
      {activeVideo && (
        <div className="rounded-2xl border-2 border-[#2563EB]/40 fabro-surface p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 shadow-sm">
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="inline-block rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/10 px-2 py-0.5 text-[11px] font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
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
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold hover:border-[#2563EB] whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir fuente
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
                onClick={() => void handleShareVideo(activeVideo)}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB]/12 text-[#1D4ED8] dark:text-[#93C5FD] px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                {activeVideo.sharedToWall
                  ? 'Volver a compartir en Muro de Estudio'
                  : 'Compartir en Muro de Estudio'}
              </button>
              <button
                type="button"
                onClick={() => navigateTo('estudio', 'muro-estudio')}
                className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
              >
                Ver Muro de Estudio →
              </button>
            </div>
          </div>

          {/* Live Notes beside the video */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm font-bold flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#06B6D4]" />
                Apuntes mientras mirás la clase
              </p>
              <span className="text-[10px] fabro-muted">Guardado automático</span>
            </div>
            <textarea
              rows={9}
              value={activeVideo.notes}
              onChange={(e) => updateVideoNotes('estudio', activeVideo.id, e.target.value)}
              placeholder="Anotá conceptos clave, fechas, fórmulas o marcas de tiempo (ej. 08:15 — Tesis principal)..."
              className="flex-1 w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed fabro-input"
            />
            <button
              type="button"
              onClick={() => handleSendNotesToWordSheet(activeVideo)}
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-600 bg-emerald-600 text-white px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
            >
              <FilePlus2 className="w-4 h-4" />
              Guardar notas como Apunte en mi Cuaderno
            </button>
          </div>
        </div>
      )}

      {/* Search & Subject Filter + Saved Videos Grid */}
      <div className="rounded-2xl border-2 fabro-border fabro-surface p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar video por título, materia o nota..."
              className="min-h-[42px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated pl-9 pr-3 py-1.5 text-xs fabro-input"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {['Todas', ...allSubjects].map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubjectFilter(sub)}
                className={`min-h-[36px] rounded-xl border-2 px-3 py-1 text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                  subjectFilter === sub
                    ? 'border-[#2563EB] bg-[#2563EB] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted hover:text-current'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed fabro-border p-8 text-center space-y-1.5">
            <Film className="w-7 h-7 mx-auto text-[#2563EB] opacity-75" />
            <p className="text-sm font-bold">Tu Videoteca Educativa está lista</p>
            <p className="text-xs fabro-muted max-w-md mx-auto">
              Pegá arriba cualquier enlace de YouTube, Vimeo o clase grabada para verla acá dentro sin distracciones mientras tomás notas.
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
                      ? 'border-[#2563EB] bg-[#2563EB]/8'
                      : 'fabro-border fabro-surface-elevated hover:border-[#2563EB]/60'
                  }`}
                >
                  <div className="space-y-2">
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
                        <div className="aspect-video rounded-xl border fabro-border bg-gradient-to-br from-[#2563EB]/20 to-[#06B6D4]/20 flex flex-col items-center justify-center gap-1 text-xs font-bold">
                          <Film className="w-6 h-6 text-[#2563EB]" />
                          <span>{isSelected ? 'Reproduciendo' : 'Reproducir clase'}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-[#2563EB] dark:text-[#60A5FA] truncate">
                          {vid.categoryOrSubject}
                        </span>
                        <span className="fabro-muted shrink-0">{vid.createdAt}</span>
                      </div>
                      <h4 className="font-display text-sm font-bold line-clamp-2">{vid.title}</h4>
                      {vid.notes && (
                        <p className="text-[11px] fabro-muted line-clamp-2">{vid.notes}</p>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t fabro-border">
                    <button
                      type="button"
                      onClick={() => void handleShareVideo(vid)}
                      className="min-h-[38px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#2563EB]/50 bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#93C5FD] px-2.5 py-1 text-[11px] font-bold cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Compartir en Muro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVideoLibraryItem('estudio', vid.id)}
                      aria-label={`Eliminar ${vid.title}`}
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border-2 fabro-border fabro-surface text-rose-600 dark:text-rose-400 cursor-pointer active:scale-95"
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
