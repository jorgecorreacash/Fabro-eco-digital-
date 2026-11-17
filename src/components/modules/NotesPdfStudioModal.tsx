import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Download,
  FileStack,
  Loader2,
  Printer,
  RefreshCw,
  Share2,
  X,
} from 'lucide-react';
import {
  exportNotesStudioPdf,
  extractBibliographyFromNotes,
  type PdfStudioNoteInput,
} from '../../lib/exporters';
import type { Note, StudentProfile, Subject } from '../../types/fabro';

export type PdfStudioScope = 'single' | 'subject' | 'custom';

export interface BookPdfCompilation {
  title: string;
  subtitle?: string;
  authorName?: string;
  genreLabel?: string;
  institution?: string;
  accentColor?: string;
  bibliography?: string;
  chapters: PdfStudioNoteInput[];
}

interface NotesPdfStudioModalProps {
  open: boolean;
  onClose: () => void;
  initialScope?: PdfStudioScope;
  currentLiveNote: PdfStudioNoteInput | null;
  currentNoteId: string | null;
  currentSubjectId: string;
  notes: Note[];
  subjects: Subject[];
  profile: StudentProfile | null;
  bookCompilation?: BookPdfCompilation | null;
}

const ACCENT_SWATCHES = [
  { hex: '#0284C7', label: 'Azul FABRO' },
  { hex: '#2563EB', label: 'Cobalto' },
  { hex: '#059669', label: 'Esmeralda' },
  { hex: '#7C3AED', label: 'Violeta' },
  { hex: '#D97706', label: 'Ámbar' },
  { hex: '#0F172A', label: 'Grafito' },
];

export const NotesPdfStudioModal: React.FC<NotesPdfStudioModalProps> = ({
  open,
  onClose,
  initialScope = 'single',
  currentLiveNote,
  currentNoteId,
  currentSubjectId,
  notes,
  subjects,
  profile,
  bookCompilation = null,
}) => {
  const [scope, setScope] = useState<PdfStudioScope>(initialScope);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(
    currentSubjectId || subjects[0]?.id || ''
  );
  const [customOrderIds, setCustomOrderIds] = useState<string[]>([]);
  const [customFilterSubject, setCustomFilterSubject] = useState<string>('');

  // Page & Layout Options
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Cover & Structure Options
  const [includeCover, setIncludeCover] = useState<boolean>(initialScope !== 'single');
  const [coverTitle, setCoverTitle] = useState('');
  const [coverSubtitle, setCoverSubtitle] = useState('');
  const [coverAuthor, setCoverAuthor] = useState('');
  const [coverInstitution, setCoverInstitution] = useState('');
  const [coverSubjectLine, setCoverSubjectLine] = useState('');
  const [coverDate, setCoverDate] = useState(() => new Date().toLocaleDateString('es-AR'));
  const [accentColorHex, setAccentColorHex] = useState('#0284C7');

  const [includeToc, setIncludeToc] = useState<boolean>(initialScope !== 'single');
  const [includePageNumbers, setIncludePageNumbers] = useState<boolean>(true);
  const [includeMedia, setIncludeMedia] = useState<boolean>(true);
  const [includeBibliography, setIncludeBibliography] = useState<boolean>(false);
  const [bibliographyText, setBibliographyText] = useState<string>('');

  // Generation & Preview State
  const [generating, setGenerating] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewFilename, setPreviewFilename] = useState<string>('apuntes-fabro.pdf');
  const [previewPages, setPreviewPages] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [mobileView, setMobileView] = useState<'config' | 'preview'>('config');

  const printIframeRef = useRef<HTMLIFrameElement | null>(null);
  const prevUrlRef = useRef<string>('');

  const getSubjectById = (id: string) => subjects.find((s) => s.id === id);

  const noteToStudioInput = (note: Note): PdfStudioNoteInput => {
    if (currentLiveNote && currentNoteId && note.id === currentNoteId) {
      return currentLiveNote;
    }
    return {
      id: note.id,
      title: note.title,
      subjectName: getSubjectById(note.subjectId)?.name || 'General',
      unit: note.unit || '',
      folder: note.folder || 'General',
      tags: note.tags || [],
      attachments: note.attachments || [],
      contentHtml: note.contentHtml || '',
      contentText: note.contentText || '',
    };
  };

  // Ordered notes for Subject mode
  const [subjectOrderIds, setSubjectOrderIds] = useState<string[]>([]);

  useEffect(() => {
    const matching = notes
      .filter((n) => (selectedSubjectFilter ? n.subjectId === selectedSubjectFilter : true))
      .map((n) => n.id);
    setSubjectOrderIds(matching);
  }, [notes, selectedSubjectFilter]);

  // Initialize studio defaults when opened
  useEffect(() => {
    if (!open) return;
    if (bookCompilation) {
      setIncludeCover(true);
      setIncludeToc(true);
      setCoverTitle(bookCompilation.title || 'Libro FABRO');
      setCoverSubtitle(bookCompilation.subtitle || 'Edición preparada en FABRO');
      setCoverAuthor(bookCompilation.authorName || profile?.displayName || 'Autor');
      setCoverInstitution(bookCompilation.institution || profile?.institution || '');
      setCoverSubjectLine(bookCompilation.genreLabel || 'Publicación de autor');
      setAccentColorHex(bookCompilation.accentColor || '#0284C7');
      const bookBib = extractBibliographyFromNotes(
        bookCompilation.chapters,
        bookCompilation.bibliography
      );
      setBibliographyText(bookBib);
      setIncludeBibliography(Boolean(bookBib.trim()));
      setStatusMessage('');
      setErrorMessage('');
      return;
    }

    const targetScope = !currentLiveNote && initialScope === 'single' ? 'subject' : initialScope;
    setScope(targetScope);
    const subjId = currentSubjectId || subjects[0]?.id || '';
    setSelectedSubjectFilter(subjId);

    if (currentNoteId) {
      setCustomOrderIds((prev) => (prev.length > 0 ? prev : [currentNoteId]));
    } else if (notes.length > 0) {
      setCustomOrderIds((prev) => (prev.length > 0 ? prev : notes.slice(0, 3).map((n) => n.id)));
    }

    const subj = getSubjectById(subjId);
    setIncludeCover(targetScope !== 'single');
    setIncludeToc(targetScope !== 'single');
    setCoverAuthor(profile?.displayName || 'Estudiante');
    setCoverInstitution(subj?.institution || profile?.institution || '');
    setCoverSubjectLine(
      subj
        ? `${subj.name}${subj.career ? ` · ${subj.career}` : ''}${subj.professor ? ` · Cátedra ${subj.professor}` : ''}`
        : 'Apuntes académicos'
    );
    setCoverTitle(
      targetScope === 'single'
        ? currentLiveNote?.title || 'Apunte de estudio'
        : subj
        ? `Compilado de ${subj.name}`
        : 'Compilado de Apuntes FABRO'
    );
    setCoverSubtitle(
      targetScope === 'single'
        ? currentLiveNote?.unit || 'Material de estudio formateado'
        : 'Apuntes, cuadros, gráficos y referencias organizados para estudiar'
    );
    setAccentColorHex(subj?.color || '#0284C7');

    const initialBib = extractBibliographyFromNotes(
      currentLiveNote ? [currentLiveNote] : notes.slice(0, 5).map(noteToStudioInput),
      subj?.bibliography
    );
    setBibliographyText(initialBib);
    setIncludeBibliography(Boolean(initialBib.trim()));
    setStatusMessage('');
    setErrorMessage('');
  }, [open, bookCompilation]);

  // Clean up object URLs safely
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== previewUrl) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    prevUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = '';
      }
    };
  }, []);

  const includedNotes: PdfStudioNoteInput[] = useMemo(() => {
    if (bookCompilation) {
      return bookCompilation.chapters;
    }
    if (scope === 'single') {
      return currentLiveNote ? [currentLiveNote] : [];
    }
    if (scope === 'subject') {
      return subjectOrderIds
        .map((id) => notes.find((n) => n.id === id))
        .filter((n): n is Note => Boolean(n))
        .map(noteToStudioInput);
    }
    return customOrderIds
      .map((id) => notes.find((n) => n.id === id))
      .filter((n): n is Note => Boolean(n))
      .map(noteToStudioInput);
  }, [bookCompilation, scope, currentLiveNote, subjectOrderIds, customOrderIds, notes, currentNoteId]);

  const filteredCustomCandidates = useMemo(() => {
    return notes.filter((n) =>
      customFilterSubject ? n.subjectId === customFilterSubject : true
    );
  }, [notes, customFilterSubject]);

  const handleToggleCustomNote = (id: string) => {
    setCustomOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const moveOrderId = (listType: 'subject' | 'custom', id: string, dir: -1 | 1) => {
    const updater = (prev: string[]) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    };
    if (listType === 'subject') setSubjectOrderIds(updater);
    else setCustomOrderIds(updater);
  };

  const handleRefreshBibliography = () => {
    const subj =
      scope === 'subject'
        ? getSubjectById(selectedSubjectFilter)
        : getSubjectById(currentSubjectId);
    const extracted = extractBibliographyFromNotes(includedNotes, subj?.bibliography);
    setBibliographyText(extracted);
    if (extracted.trim()) {
      setIncludeBibliography(true);
      setStatusMessage('Bibliografía y citas extraídas de la materia y los apuntes seleccionados.');
    } else {
      setStatusMessage('No se detectaron citas automáticas; podés escribir tus referencias manualmente.');
    }
  };

  const buildPdf = async () => {
    if (includedNotes.length === 0) {
      setErrorMessage('Seleccioná al menos un apunte para generar el PDF.');
      return null;
    }
    setGenerating(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const result = await exportNotesStudioPdf({
        notes: includedNotes,
        pageSize,
        orientation,
        includeCover,
        coverTitle,
        coverSubtitle,
        coverAuthor,
        coverInstitution,
        coverSubjectLine,
        coverDate,
        accentColorHex,
        includeToc,
        includePageNumbers,
        includeMedia,
        includeBibliography,
        bibliographyText,
        fileName: coverTitle || includedNotes[0]?.title || 'apuntes-fabro',
      });
      const url = URL.createObjectURL(result.blob);
      setPreviewBlob(result.blob);
      setPreviewUrl(url);
      setPreviewFilename(result.filename);
      setPreviewPages(result.pageCount);
      setMobileView('preview');
      return { ...result, url };
    } catch {
      setErrorMessage('Ocurrió un error al compilar el PDF. Verificá las imágenes o el contenido.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const res = previewBlob ? { blob: previewBlob, filename: previewFilename } : await buildPdf();
    if (!res) return;
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage(`Archivo descargado: ${res.filename}`);
  };

  const handlePrintPdf = async () => {
    const res = previewUrl ? { url: previewUrl } : await buildPdf();
    if (!res?.url) return;
    const iframe = printIframeRef.current;
    if (iframe) {
      iframe.src = res.url;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          setStatusMessage('Usá el botón de descarga o impresión dentro de la vista previa del PDF.');
        }
      };
    }
  };

  const handleSharePdf = async () => {
    const res = previewBlob
      ? { blob: previewBlob, filename: previewFilename }
      : await buildPdf();
    if (!res) return;

    const file = new File([res.blob], res.filename, { type: 'application/pdf' });
    const navWithShare = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
    };

    if (navWithShare.share && (!navWithShare.canShare || navWithShare.canShare({ files: [file] }))) {
      try {
        await navWithShare.share({
          files: [file],
          title: coverTitle || 'Apuntes FABRO',
          text: `Comparto "${coverTitle || 'Apuntes FABRO'}" (${includedNotes.length} apunte/s).`,
        });
        setStatusMessage('PDF compartido correctamente.');
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Fallback when Web Share with files isn't supported in the embedded frame/desktop browser
    try {
      await navigator.clipboard?.writeText(
        `${coverTitle || 'Apuntes FABRO'} — ${includedNotes.map((n) => n.title).join(', ')}`
      );
    } catch {
      // Ignore clipboard failure
    }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage(
      'Tu navegador no admite compartir archivos directamente aquí: descargamos el PDF y copiamos el título para que puedas enviarlo.'
    );
  };

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Estudio de exportación PDF"
    >
      <div className="w-full max-w-6xl max-h-[94dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileStack className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                Estudio de exportación PDF
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                Compilá apuntes, portada personalizada, índice automático, gráficos y bibliografía
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar estudio PDF"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="lg:hidden grid grid-cols-2 gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={() => setMobileView('config')}
            className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
              mobileView === 'config'
                ? 'bg-white dark:bg-[#0F1623] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Configuración ({includedNotes.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileView('preview')}
            className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
              mobileView === 'preview'
                ? 'bg-white dark:bg-[#0F1623] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Vista previa y acciones
          </button>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Configuration Controls */}
          <div
            className={`lg:col-span-6 overflow-y-auto p-4 sm:p-5 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 ${
              mobileView === 'config' ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* 1. Scope Selector */}
            {bookCompilation ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  1. Capítulos del libro ({includedNotes.length})
                </label>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-800 max-h-40 overflow-y-auto">
                  {includedNotes.map((ch, idx) => (
                    <div key={ch.id || idx} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {idx + 1}. {ch.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                1. Apuntes a incluir
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
                {[
                  { id: 'single' as const, label: 'Apunte actual', disabled: !currentLiveNote },
                  { id: 'subject' as const, label: 'Por materia', disabled: false },
                  { id: 'custom' as const, label: 'Unir varios', disabled: false },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      setScope(opt.id);
                      if (opt.id !== 'single') {
                        setIncludeCover(true);
                        setIncludeToc(true);
                      }
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                      scope === opt.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {scope === 'single' && currentLiveNote && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {currentLiveNote.title || 'Apunte sin título'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Materia: {currentLiveNote.subjectName || 'General'} · Carpeta: {currentLiveNote.folder || 'General'}
                  </p>
                </div>
              )}

              {scope === 'subject' && (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nombre de la materia
                    </label>
                    <select
                      value={selectedSubjectFilter}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedSubjectFilter(nextId);
                        const subj = getSubjectById(nextId);
                        if (subj) {
                          setCoverTitle(`Compilado de ${subj.name}`);
                          setCoverSubjectLine(
                            `${subj.name}${subj.career ? ` · ${subj.career}` : ''}`
                          );
                          setCoverInstitution(subj.institution || profile?.institution || '');
                          setAccentColorHex(subj.color || '#0284C7');
                        } else {
                          setCoverTitle('Compilado general de apuntes');
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                    >
                      <option value="">Todas las materias ({notes.length} apuntes)</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({notes.filter((n) => n.subjectId === s.id).length} apuntes)
                        </option>
                      ))}
                    </select>
                  </div>

                  {includedNotes.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Esta materia todavía no tiene apuntes creados.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                      {includedNotes.map((n, idx) => (
                        <div
                          key={n.id || idx}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-slate-800 dark:text-slate-200">
                            <span className="font-semibold text-slate-400 mr-1.5">{idx + 1}.</span>
                            {n.title}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => n.id && moveOrderId('subject', n.id, -1)}
                              aria-label="Subir orden"
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === includedNotes.length - 1}
                              onClick={() => n.id && moveOrderId('subject', n.id, 1)}
                              aria-label="Bajar orden"
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {scope === 'custom' && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      value={customFilterSubject}
                      onChange={(e) => setCustomFilterSubject(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                    >
                      <option value="">Filtrar por materia (todas)</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setCustomOrderIds(filteredCustomCandidates.map((n) => n.id))}
                        className="text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomOrderIds([])}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                    {filteredCustomCandidates.map((n) => {
                      const orderIdx = customOrderIds.indexOf(n.id);
                      const checked = orderIdx >= 0;
                      return (
                        <div
                          key={n.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleCustomNote(n.id)}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                checked
                                  ? 'bg-sky-600 border-sky-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3" />}
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200">
                              {checked && (
                                <span className="font-bold text-sky-600 dark:text-sky-400 mr-1.5">
                                  #{orderIdx + 1}
                                </span>
                              )}
                              {n.title}
                            </span>
                          </button>

                          {checked && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={orderIdx === 0}
                                onClick={() => moveOrderId('custom', n.id, -1)}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={orderIdx === customOrderIds.length - 1}
                                onClick={() => moveOrderId('custom', n.id, 1)}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* 2. Page Format & Orientation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Tamaño de página
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                  {[
                    { id: 'a4' as const, label: 'A4' },
                    { id: 'letter' as const, label: 'Carta' },
                  ].map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setPageSize(sz.id)}
                      className={`py-1.5 rounded text-xs font-semibold cursor-pointer ${
                        pageSize === sz.id
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Orientación
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                  {[
                    { id: 'portrait' as const, label: 'Vertical' },
                    { id: 'landscape' as const, label: 'Horizontal' },
                  ].map((or) => (
                    <button
                      key={or.id}
                      type="button"
                      onClick={() => setOrientation(or.id)}
                      className={`py-1.5 rounded text-xs font-semibold cursor-pointer ${
                        orientation === or.id
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {or.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Editorial Options */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Estructura y elementos
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  {
                    checked: includeCover,
                    onChange: setIncludeCover,
                    label: 'Portada personalizada',
                  },
                  {
                    checked: includeToc,
                    onChange: setIncludeToc,
                    label: 'Índice automático',
                  },
                  {
                    checked: includePageNumbers,
                    onChange: setIncludePageNumbers,
                    label: 'Numerar páginas',
                  },
                  {
                    checked: includeMedia,
                    onChange: setIncludeMedia,
                    label: 'Imágenes, tablas y gráficos',
                  },
                  {
                    checked: includeBibliography,
                    onChange: setIncludeBibliography,
                    label: 'Bibliografía y citas',
                  },
                ].map((opt) => (
                  <label
                    key={opt.label}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  >
                    <input
                      type="checkbox"
                      checked={opt.checked}
                      onChange={(e) => opt.onChange(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Custom Cover Editor */}
            {includeCover && (
              <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Portada personalizada
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={coverTitle}
                    onChange={(e) => setCoverTitle(e.target.value)}
                    placeholder="Título principal de portada"
                    className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={coverSubtitle}
                    onChange={(e) => setCoverSubtitle(e.target.value)}
                    placeholder="Subtítulo o unidad temática"
                    className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={coverAuthor}
                    onChange={(e) => setCoverAuthor(e.target.value)}
                    placeholder="Autor / Estudiante"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={coverInstitution}
                    onChange={(e) => setCoverInstitution(e.target.value)}
                    placeholder="Institución / Universidad"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={coverSubjectLine}
                    onChange={(e) => setCoverSubjectLine(e.target.value)}
                    placeholder="Materia / Cátedra / Carrera"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={coverDate}
                    onChange={(e) => setCoverDate(e.target.value)}
                    placeholder="Fecha"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Color editorial:
                  </span>
                  {ACCENT_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.label}
                      aria-label={sw.label}
                      onClick={() => setAccentColorHex(sw.hex)}
                      style={{ backgroundColor: sw.hex }}
                      className={`w-5 h-5 rounded-full cursor-pointer border-2 ${
                        accentColorHex.toLowerCase() === sw.hex.toLowerCase()
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 5. Bibliography & Citations */}
            {includeBibliography && (
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Bibliografía y citas (una por línea)
                  </label>
                  <button
                    type="button"
                    onClick={handleRefreshBibliography}
                    className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Extraer de materia y enlaces
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={bibliographyText}
                  onChange={(e) => setBibliographyText(e.target.value)}
                  placeholder="Ej: Hernández Sampieri, R. (2018). Metodología de la investigación. McGraw-Hill."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2.5 text-xs"
                />
              </div>
            )}
          </div>

          {/* Right: Preview & Download / Print / Share */}
          <div
            className={`lg:col-span-6 flex flex-col p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-900/30 overflow-y-auto space-y-3 ${
              mobileView === 'preview' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Vista previa del documento
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {includedNotes.length} {includedNotes.length === 1 ? 'apunte' : 'apuntes'} ·{' '}
                  {pageSize === 'a4' ? 'A4' : 'Carta'} ({orientation === 'portrait' ? 'Vertical' : 'Horizontal'})
                  {previewPages > 0 ? ` · ${previewPages} páginas` : ''}
                </p>
              </div>

              <button
                type="button"
                disabled={generating || includedNotes.length === 0}
                onClick={() => void buildPdf()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {generating ? 'Compilando PDF...' : previewUrl ? 'Actualizar vista previa' : 'Generar PDF'}
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            {statusMessage && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                {statusMessage}
              </div>
            )}

            <div className="flex-1 min-h-[300px] sm:min-h-[380px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden flex flex-col">
              {previewUrl ? (
                <iframe
                  title="Vista previa del PDF compilado"
                  src={previewUrl}
                  className="w-full flex-1 min-h-[340px]"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <BookOpen className="w-10 h-10 text-sky-600/70 dark:text-sky-400/70" />
                  <div className="space-y-1 max-w-sm">
                    <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Listo para compilar tu PDF
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Presioná <strong>Generar PDF</strong> para previsualizar el diseño final con portada, índice, imágenes, tablas, gráficos y bibliografía.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Output Actions: Descargar, Imprimir, Compartir */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                disabled={generating || includedNotes.length === 0}
                onClick={() => void handleDownload()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 px-3 text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
              <button
                type="button"
                disabled={generating || includedNotes.length === 0}
                onClick={() => void handlePrintPdf()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] text-slate-800 dark:text-slate-200 py-2.5 px-3 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
              <button
                type="button"
                disabled={generating || includedNotes.length === 0}
                onClick={() => void handleSharePdf()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] text-slate-800 dark:text-slate-200 py-2.5 px-3 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden iframe used exclusively for programmatic PDF printing without window.open */}
      <iframe ref={printIframeRef} title="Impresión PDF" className="hidden" />
    </div>
  );
};
