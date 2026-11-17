import React, { useState } from 'react';
import {
  BookmarkPlus,
  FileDown,
  FileText,
  Link2,
  MessageSquare,
  PlayCircle,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import { exportMarkdownToPdf, markdownToHtml } from '../../lib/exporters';
import { DEFAULT_ACADEMY_TAXONOMY } from '../../types/fabro';

interface VideoSearchItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  youtubeUrl: string;
}

const STUDY_MODES = [
  { id: 'resumen_breve', label: 'Resumen breve' },
  { id: 'resumen_completo', label: 'Resumen completo' },
  { id: 'explicacion_detallada', label: 'Explicación detallada' },
  { id: 'principiantes', label: 'Para principiantes' },
  { id: 'universitario', label: 'Nivel universitario' },
  { id: 'examen', label: 'Puntos clave para examen' },
  { id: 'cuestionario', label: 'Cuestionario autoevaluación' },
  { id: 'tarjetas', label: 'Tarjetas de estudio' },
] as const;

export const VideoLearningView: React.FC = () => {
  const { user, createNote, subjects, selectedSubjectId, setActiveSection } = useFabro();
  const { youtubeVideos, saveVideoResource, deleteVideoResource } = usePlatform();

  const [searchQuery, setSearchQuery] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VideoSearchItem[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const [activeVideo, setActiveVideo] = useState<VideoSearchItem | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptAvailable, setTranscriptAvailable] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptStatusNote, setTranscriptStatusNote] = useState<string | null>(null);
  const [userVideoNotes, setUserVideoNotes] = useState('');

  const [selectedMode, setSelectedMode] = useState<string>('resumen_completo');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [providerUsed, setProviderUsed] = useState('');
  const [qaInput, setQaInput] = useState('');
  const [qaHistory, setQaHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);

  const [videoArea, setVideoArea] = useState(DEFAULT_ACADEMY_TAXONOMY[0].area);
  const [videoTag, setVideoTag] = useState('');
  const [savePublic, setSavePublic] = useState(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadVideoAndTranscript = async (item: VideoSearchItem) => {
    setActiveVideo(item);
    setAiOutput('');
    setQaHistory([]);
    setSavedNotice(null);
    setErrorMsg(null);
    setTranscriptText('');
    setTranscriptAvailable(false);
    setTranscriptLoading(true);
    try {
      const resp = await fetch('/api/youtube/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: item.videoId, lang: 'es' }),
      });
      const json = (await resp.json()) as {
        transcriptAvailable?: boolean;
        transcriptText?: string;
        note?: string;
      };
      setTranscriptAvailable(Boolean(json.transcriptAvailable));
      setTranscriptText(json.transcriptText || '');
      setTranscriptStatusNote(json.note || null);
    } catch {
      setTranscriptStatusNote('No se pudo consultar la transcripción automática.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const handleSearchVideos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setErrorMsg(null);
    setSearchNote(null);
    try {
      const resp = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const json = (await resp.json()) as {
        items?: VideoSearchItem[];
        sourceMode?: string;
        note?: string;
        error?: string;
      };
      if (!resp.ok) throw new Error(json.error || 'Error buscando videos');
      setSearchResults(json.items || []);
      if (json.note) {
        setSearchNote(json.note);
      } else if (json.sourceMode === 'google_search_oembed') {
        setSearchNote('Resultados verificados vía Google Search + oEmbed oficial de YouTube.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al buscar videos');
    } finally {
      setSearching(false);
    }
  };

  const handleLoadUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteUrl.trim()) return;
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/youtube/oembed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pasteUrl.trim() }),
      });
      const json = (await resp.json()) as VideoSearchItem & { error?: string };
      if (!resp.ok) throw new Error(json.error || 'URL de YouTube no reconocida');
      setPasteUrl('');
      await loadVideoAndTranscript(json);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cargar el enlace de YouTube');
    }
  };

  const handleExplainVideo = async (modeOverride?: string, question?: string) => {
    if (!activeVideo) return;
    const modeToUse = modeOverride || selectedMode;
    setAiLoading(true);
    setErrorMsg(null);
    try {
      const resp = await authFetch('/api/ai/explain-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: activeVideo.videoId,
          title: activeVideo.title,
          channelTitle: activeVideo.channelTitle,
          area: videoArea,
          mode: modeToUse,
          transcriptText,
          userNotes: userVideoNotes,
          qaQuestion: question || '',
          history: qaHistory,
        }),
      });
      const json = (await resp.json()) as { text?: string; providerUsed?: string; error?: string };
      if (!resp.ok) throw new Error(json.error || 'No se pudo analizar el video');
      const reply = json.text || '';
      setProviderUsed(json.providerUsed || '');
      if (question) {
        setQaHistory((prev) => [
          ...prev,
          { role: 'user', text: question },
          { role: 'model', text: reply },
        ]);
        setQaInput('');
      } else {
        setAiOutput(reply);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error analizando el video');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveToNotes = async () => {
    if (!activeVideo || !aiOutput.trim()) return;
    await createNote({
      subjectId: selectedSubjectId || subjects[0]?.id || '',
      unit: videoTag || videoArea,
      folder: 'Videos y Clases',
      title: `Video: ${activeVideo.title}`,
      contentHtml: markdownToHtml(`**Fuente:** ${activeVideo.youtubeUrl} (${activeVideo.channelTitle})\n\n${aiOutput}`),
      contentText: `${activeVideo.youtubeUrl}\n\n${aiOutput}`,
      tags: ['video', 'youtube', videoArea].filter(Boolean),
      attachments: [],
      offlineAvailable: true,
    });
    setSavedNotice('Explicación guardada en tus Apuntes personales.');
  };

  const handleSaveToVideoteca = async () => {
    if (!activeVideo) return;
    await saveVideoResource({
      youtubeVideoId: activeVideo.videoId,
      title: activeVideo.title,
      channelTitle: activeVideo.channelTitle,
      thumbnailUrl: activeVideo.thumbnailUrl,
      youtubeUrl: activeVideo.youtubeUrl,
      area: videoArea,
      subjectTag: videoTag || searchQuery || 'Clase recomendada',
      keywords: [videoArea, videoTag, activeVideo.channelTitle].filter(Boolean),
      transcriptAvailable,
      transcriptText: transcriptText || userVideoNotes,
      aiSummaryMarkdown: aiOutput,
      isPublic: savePublic,
    });
    setSavedNotice('Video guardado en la Videoteca Educativa Inteligente.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
            VIDEOTECA EDUCATIVA + FABRO IA EXPLICA VIDEOS
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Aprendizaje con videos educativos y análisis pedagógico
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Buscá clases reales en YouTube o pegá cualquier enlace para reproducirlo sin salir de FABRO, extraer sus subtítulos disponibles y generar resúmenes, cuestionarios, tarjetas o PDFs de estudio.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <form onSubmit={(e) => void handleSearchVideos(e)} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar clase, oficio o tema (ej.: cálculo diferencial, carpintería)..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {searching ? 'Buscando...' : 'Buscar videos'}
            </button>
          </form>

          <form onSubmit={(e) => void handleLoadUrl(e)} className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="Pegá un enlace de YouTube (https://youtube.com/watch?v=...)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer whitespace-nowrap"
            >
              Cargar enlace
            </button>
          </form>
        </div>

        {searchNote && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{searchNote}</p>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}
      </section>

      {/* Active Video Player + AI Study Workbench */}
      {activeVideo && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-3">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                <iframe
                  title={activeVideo.title}
                  src={`https://www.youtube.com/embed/${activeVideo.videoId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {activeVideo.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Canal: {activeVideo.channelTitle}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <select
                  value={videoArea}
                  onChange={(e) => setVideoArea(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                >
                  {DEFAULT_ACADEMY_TAXONOMY.map((t) => (
                    <option key={t.id} value={t.area}>
                      {t.area}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={videoTag}
                  onChange={(e) => setVideoTag(e.target.value)}
                  placeholder="Materia o etiqueta (ej.: Análisis Matemático)"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savePublic}
                    onChange={(e) => setSavePublic(e.target.checked)}
                  />
                  <span>Compartir en Videoteca pública</span>
                </label>
                <button
                  type="button"
                  onClick={() => void handleSaveToVideoteca()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Guardar en Videoteca
                </button>
              </div>
            </div>

            {/* Real Transcript / User Notes Panel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900 dark:text-white">
                  Transcripción y apuntes base
                </p>
                {transcriptLoading && <span className="text-sky-500">Extrayendo subtítulos...</span>}
              </div>
              {transcriptStatusNote && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{transcriptStatusNote}</p>
              )}
              {transcriptText ? (
                <textarea
                  rows={6}
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                />
              ) : (
                <textarea
                  rows={4}
                  value={userVideoNotes}
                  onChange={(e) => setUserVideoNotes(e.target.value)}
                  placeholder="Si el video no tuvo subtítulos públicos, pegá aquí fragmentos o tus notas para que FABRO IA las analice con total fidelidad..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-2.5 text-xs text-slate-900 dark:text-white"
                />
              )}
            </div>
          </div>

          {/* FABRO IA Explica Videos */}
          <div className="xl:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-500" />
                FABRO IA Explica Videos
              </h3>
              {providerUsed && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Motor: {providerUsed}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {STUDY_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={aiLoading}
                  onClick={() => {
                    setSelectedMode(m.id);
                    void handleExplainVideo(m.id);
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold text-left cursor-pointer transition-colors ${
                    selectedMode === m.id && aiOutput
                      ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {savedNotice && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <span>{savedNotice}</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('apuntes')}
                  className="font-semibold underline cursor-pointer"
                >
                  Ver Apuntes
                </button>
              </div>
            )}

            {aiLoading ? (
              <div className="py-10 text-center text-xs text-sky-600 dark:text-sky-400">
                Analizando video y elaborando material pedagógico...
              </div>
            ) : aiOutput ? (
              <div className="space-y-3">
                <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-4 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {aiOutput}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveToNotes()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Guardar en Apuntes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportMarkdownToPdf({
                        title: activeVideo.title,
                        subjectName: `${videoArea}${videoTag ? ` · ${videoTag}` : ''}`,
                        sourceUrls: [{ title: activeVideo.channelTitle, url: activeVideo.youtubeUrl }],
                        markdown: aiOutput,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Descargar PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Elegí uno de los 8 modos arriba para generar el desarrollo del video con FABRO IA.
              </div>
            )}

            {/* Q&A sobre el video */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                Preguntale a FABRO IA sobre este video
              </p>
              {qaHistory.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
                  {qaHistory.map((m, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg px-3 py-2 ${
                        m.role === 'user'
                          ? 'bg-sky-500/10 text-sky-900 dark:text-sky-200'
                          : 'bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 whitespace-pre-wrap'
                      }`}
                    >
                      <strong>{m.role === 'user' ? 'Vos: ' : 'FABRO IA: '}</strong>
                      {m.text}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  placeholder="Ej.: ¿Podés explicar con un ejemplo el concepto del minuto 04:20?"
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={aiLoading || !qaInput.trim()}
                  onClick={() => void handleExplainVideo(selectedMode, qaInput)}
                  className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                >
                  Consultar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Resultados de YouTube ({searchResults.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {searchResults.map((item) => (
              <article
                key={item.videoId}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden flex flex-col justify-between"
              >
                <div className="aspect-video bg-slate-900 relative">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {item.channelTitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadVideoAndTranscript(item)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Abrir y analizar con IA
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Saved Videoteca */}
      <section className="space-y-3">
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
          Videoteca Educativa Compartida ({youtubeVideos.length})
        </h3>
        {youtubeVideos.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Todavía no hay videos guardados en la videoteca. Buscá o pegá un enlace de YouTube arriba para sumar el primero.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {youtubeVideos.map((v) => (
              <article
                key={v.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden flex flex-col justify-between"
              >
                <div className="aspect-video bg-slate-900">
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 truncate">
                      {v.area} · {v.subjectTag}
                    </p>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                      {v.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Por {v.addedByName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVideo({
                          videoId: v.youtubeVideoId,
                          title: v.title,
                          channelTitle: v.channelTitle,
                          thumbnailUrl: v.thumbnailUrl,
                          youtubeUrl: v.youtubeUrl,
                        });
                        setTranscriptAvailable(v.transcriptAvailable);
                        setTranscriptText(v.transcriptText);
                        setAiOutput(v.aiSummaryMarkdown);
                      }}
                      className="flex-1 rounded-lg bg-sky-600 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                    >
                      Estudiar
                    </button>
                    {v.addedBy === user?.uid && (
                      <button
                        type="button"
                        onClick={() => void deleteVideoResource(v.id)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                        aria-label="Quitar video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
