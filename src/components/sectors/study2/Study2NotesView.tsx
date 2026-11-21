import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Download,
  FileText,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  List,
  Paperclip,
  Plus,
  Printer,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useStudy2 } from '../../../context/Study2Context';
import { exportNotesStudioPdf } from '../../../lib/exporters';
import { triggerBlobDownload } from '../../../services/study2FileExtractor';
import {
  extractPlainTextFromHtml,
  printStudyDocumentAsPdf,
} from '../../../services/studyDocumentUtils';
import type { FabroAiStudyMode } from '../../../types/study2';

export const Study2NotesView: React.FC = () => {
  const {
    advancedNotes,
    createAdvancedNote,
    updateAdvancedNote,
    deleteAdvancedNote,
    authUser,
    profile,
  } = useEcosystem();
  const {
    snapshot,
    updateNoteMeta,
    uploadLibraryFile,
    sendToFabroAi,
  } = useStudy2();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    advancedNotes[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [aiActionMode, setAiActionMode] = useState<FabroAiStudyMode>('resumir_documento');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return advancedNotes.filter((note) => {
      const meta = snapshot.noteMetadata[note.id];
      if (onlyFavorites && !meta?.favorite) return false;
      if (subjectFilter && meta?.subjectId !== subjectFilter) return false;
      if (!q) return true;
      const plain = (note.contentText || extractPlainTextFromHtml(note.contentHtml || '')).toLowerCase();
      return (
        note.title.toLowerCase().includes(q) ||
        (note.subject || '').toLowerCase().includes(q) ||
        (meta?.unit || '').toLowerCase().includes(q) ||
        (meta?.topic || '').toLowerCase().includes(q) ||
        plain.includes(q)
      );
    });
  }, [advancedNotes, onlyFavorites, searchQuery, snapshot.noteMetadata, subjectFilter]);

  const activeNote = useMemo(
    () =>
      advancedNotes.find((n) => n.id === selectedNoteId) ||
      filteredNotes[0] ||
      null,
    [advancedNotes, filteredNotes, selectedNoteId]
  );

  // Sync contentEditable when switching notes
  useEffect(() => {
    if (!editorRef.current) return;
    const html = activeNote?.contentHtml || '';
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [activeNote?.id]);

  const activeMeta = activeNote ? snapshot.noteMetadata[activeNote.id] || {} : {};
  const attachedFiles = useMemo(() => {
    const ids = new Set(activeMeta.attachmentFileIds || []);
    return snapshot.libraryFiles.filter((f) => ids.has(f.id));
  }, [activeMeta.attachmentFileIds, snapshot.libraryFiles]);

  const flashStatus = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 2600);
  };

  const handleCreateNote = () => {
    const linkedSubject = snapshot.subjects.find((s) => s.id === subjectFilter);
    const created = createAdvancedNote({
      title: 'Nuevo apunte',
      subject: linkedSubject?.name || 'General',
      folder: linkedSubject?.name || 'General',
    });
    if (linkedSubject) {
      updateNoteMeta(created.id, { subjectId: linkedSubject.id });
    }
    setSelectedNoteId(created.id);
  };

  const execFormat = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    if (activeNote) {
      const html = editorRef.current.innerHTML;
      updateAdvancedNote(activeNote.id, {
        contentHtml: html,
        contentText: extractPlainTextFromHtml(html),
        updatedAt: 'Guardado recién',
      });
    }
  };

  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote || !editorRef.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !editorRef.current) return;
      editorRef.current.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<p><img src="${reader.result}" alt="${file.name.replace(/"/g, '')}" style="max-width:100%;border-radius:10px;margin:8px 0;" /></p>`
      );
      const html = editorRef.current.innerHTML;
      updateAdvancedNote(activeNote.id, {
        contentHtml: html,
        contentText: extractPlainTextFromHtml(html),
        updatedAt: 'Guardado recién',
      });
      flashStatus('Imagen insertada en el apunte');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;
    const uploaded = await uploadLibraryFile(file, {
      subjectId: activeMeta.subjectId,
    });
    const nextIds = [...(activeMeta.attachmentFileIds || []), uploaded.id];
    updateNoteMeta(activeNote.id, { attachmentFileIds: nextIds });
    flashStatus(`Archivo "${uploaded.name}" adjuntado y guardado en Biblioteca`);
    e.target.value = '';
  };

  const handleExportPdf = async () => {
    if (!activeNote) return;
    setExportingPdf(true);
    try {
      const html = activeNote.contentHtml || '';
      const plain = activeNote.contentText || extractPlainTextFromHtml(html);
      const result = await exportNotesStudioPdf({
        notes: [
          {
            id: activeNote.id,
            title: activeNote.title,
            subjectName: activeNote.subject || 'General',
            unit: activeMeta.unit,
            contentHtml: html,
            contentText: plain,
            attachments: attachedFiles.map((f) => ({
              name: f.name,
              sizeBytes: f.sizeBytes,
            })),
          },
        ],
        pageSize: 'a4',
        orientation: 'portrait',
        includeCover: false,
        coverTitle: activeNote.title,
        coverAuthor: authUser?.displayName || profile.displayName || 'Estudiante FABRO',
        includeToc: false,
        includePageNumbers: true,
        includeMedia: true,
        includeBibliography: false,
      });
      triggerBlobDownload(result.blob, result.filename);
      flashStatus('PDF exportado correctamente');
    } catch {
      flashStatus('No se pudo generar el PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleShareNote = async () => {
    if (!activeNote) return;
    const plain = `${activeNote.title}\n${activeNote.subject ? `Materia: ${activeNote.subject}\n` : ''}\n${
      activeNote.contentText || extractPlainTextFromHtml(activeNote.contentHtml || '')
    }`;
    if (navigator.share) {
      try {
        await navigator.share({ title: activeNote.title, text: plain });
        return;
      } catch {
        // user cancelled or unsupported -> clipboard fallback
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(plain);
      flashStatus('Contenido copiado al portapapeles para compartir');
    }
  };

  const handleSendNoteToAi = () => {
    if (!activeNote) return;
    const plain = activeNote.contentText || extractPlainTextFromHtml(activeNote.contentHtml || '');
    sendToFabroAi({
      subjectId: activeMeta.subjectId,
      noteTitle: activeNote.title,
      noteText: plain,
      fileIds: activeMeta.attachmentFileIds,
      mode: aiActionMode,
      prompt: `Trabajá sobre mi apunte "${activeNote.title}"${
        activeMeta.unit ? ` (${activeMeta.unit})` : ''
      }.`,
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Mis apuntes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Cuaderno centralizado con formato, imágenes, adjuntos reales, exportación a PDF y envío directo a FABRO IA.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNote}
          className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 text-xs font-bold cursor-pointer whitespace-nowrap self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo apunte</span>
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left List Column */}
        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar apuntes..."
              className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Filtrar apuntes por materia"
              className="flex-1 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
            >
              <option value="">Todas las materias</option>
              {snapshot.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              title="Solo favoritos"
              className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                onlyFavorites
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-[540px] overflow-y-auto pr-0.5">
            {filteredNotes.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No hay apuntes que coincidan con el filtro.
              </p>
            ) : (
              filteredNotes.map((note) => {
                const meta = snapshot.noteMetadata[note.id];
                const isSelected = activeNote?.id === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer space-y-1 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                        : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {note.title}
                      </p>
                      {meta?.favorite && (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {note.subject || 'Sin materia'}
                      {meta?.unit ? ` · ${meta.unit}` : ''}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Editor Canvas */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
          {!activeNote ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold">Creá o seleccioná un apunte para empezar</p>
            </div>
          ) : (
            <>
              {/* Title + Metadata */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) =>
                      updateAdvancedNote(activeNote.id, {
                        title: e.target.value,
                        updatedAt: 'Guardado recién',
                      })
                    }
                    placeholder="Título del apunte..."
                    className="flex-1 font-display text-xl font-bold bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none pb-1 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateNoteMeta(activeNote.id, { favorite: !activeMeta.favorite })
                    }
                    aria-label="Marcar como favorito"
                    className="min-h-[36px] min-w-[36px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        activeMeta.favorite
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-slate-400'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteAdvancedNote(activeNote.id);
                      setSelectedNoteId(null);
                    }}
                    aria-label="Eliminar apunte"
                    className="min-h-[36px] min-w-[36px] rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={activeMeta.subjectId || ''}
                    onChange={(e) => {
                      const sub = snapshot.subjects.find((s) => s.id === e.target.value);
                      updateNoteMeta(activeNote.id, {
                        subjectId: sub?.id || undefined,
                      });
                      updateAdvancedNote(activeNote.id, {
                        subject: sub?.name || 'General',
                      });
                    }}
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs"
                  >
                    <option value="">Sin materia vinculada</option>
                    {snapshot.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={activeMeta.unit || ''}
                    onChange={(e) =>
                      updateNoteMeta(activeNote.id, { unit: e.target.value })
                    }
                    placeholder="Unidad (ej. Unidad 2)"
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs"
                  />

                  <input
                    type="text"
                    value={activeMeta.topic || ''}
                    onChange={(e) =>
                      updateNoteMeta(activeNote.id, { topic: e.target.value })
                    }
                    placeholder="Tema específico"
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Clean Formatting & Media Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1.5">
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', 'h1')}
                  title="Título"
                  className="min-h-[34px] min-w-[34px] rounded-lg hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', 'h2')}
                  title="Subtítulo"
                  className="min-h-[34px] min-w-[34px] rounded-lg hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('bold')}
                  title="Negrita"
                  className="min-h-[34px] min-w-[34px] rounded-lg hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('italic')}
                  title="Cursiva"
                  className="min-h-[34px] min-w-[34px] rounded-lg hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('insertUnorderedList')}
                  title="Lista"
                  className="min-h-[34px] min-w-[34px] rounded-lg hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <List className="w-4 h-4" />
                </button>

                <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInsertImage}
                />
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="min-h-[34px] px-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Imagen
                </button>

                <input
                  ref={attachInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachFile}
                />
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  className="min-h-[34px] px-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  Adjuntar archivo
                </button>
              </div>

              {/* Editable Document Surface */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const html = (e.currentTarget as HTMLDivElement).innerHTML;
                  updateAdvancedNote(activeNote.id, {
                    contentHtml: html,
                    contentText: extractPlainTextFromHtml(html),
                    updatedAt: 'Guardado recién',
                  });
                }}
                className="min-h-[320px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 sm:p-5 prose prose-sm dark:prose-invert max-w-none focus:outline-none focus:border-blue-500"
              />

              {/* Attached Files */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold">Adjuntos:</span>
                  {attachedFiles.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium"
                    >
                      <Paperclip className="w-3 h-3 text-blue-600" />
                      {f.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom Action Bar: Export, Print, Share, Send to FABRO IA */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={exportingPdf}
                    onClick={handleExportPdf}
                    className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportingPdf ? 'Generando PDF...' : 'Exportar PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      printStudyDocumentAsPdf(
                        activeNote.title,
                        activeNote.subject || 'General',
                        activeNote.contentHtml || ''
                      )
                    }
                    className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={handleShareNote}
                    className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Compartir
                  </button>
                </div>

                {/* Direct Send to FABRO IA */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={aiActionMode}
                    onChange={(e) => setAiActionMode(e.target.value as FabroAiStudyMode)}
                    aria-label="Acción para FABRO IA"
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs"
                  >
                    <option value="resumir_documento">Resumir</option>
                    <option value="explicar_tema">Explicar</option>
                    <option value="explicacion_academica">Ampliar</option>
                    <option value="preguntas_examen">Preguntas de examen</option>
                    <option value="flashcards">Crear tarjetas</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSendNoteToAi}
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Enviar a FABRO IA
                  </button>
                </div>
              </div>

              {statusMsg && (
                <p className="text-xs font-semibold text-emerald-600">{statusMsg}</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
