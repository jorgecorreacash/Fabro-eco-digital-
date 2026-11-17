import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bold,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  CloudOff,
  Copy,
  Download,
  FileStack,
  FileText,
  Folder,
  GitBranch,
  Globe,
  Heading1,
  Heading2,
  History,
  Image as ImageIcon,
  Italic,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Plus,
  Printer,
  Save,
  Search,
  Share2,
  Table as TableIcon,
  Trash2,
  Underline,
  Wifi,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import {
  exportNoteToPdf,
  exportNoteToWord,
  renderChartToDataUrl,
  sanitizeHtmlForPrint,
  type PdfStudioNoteInput,
} from '../../lib/exporters';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import { NotesPdfStudioModal, type PdfStudioScope } from './NotesPdfStudioModal';
import { VisualStudyStudioModal, type VisualStudyKind } from './VisualStudyStudioModal';
import { NoteTimelineExtractorModal } from './NoteTimelineExtractorModal';
import { WikiImageFinderModal } from './WikiImageFinderModal';
import { AIReadingModeModal } from './AIReadingModeModal';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';
import { WikiMediaLightbox, type WikiMediaItem } from '../common/WikiMediaLightbox';
import type { Note, NoteAttachment } from '../../types/fabro';

export const NotesView: React.FC = () => {
  const {
    profile,
    notes,
    subjects,
    calendarEvents,
    selectedSubjectId,
    createNote,
    updateNote,
    deleteNote,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    uploadLibraryDocument,
    isOnline,
    recentNoteIds,
    markNoteAccessed,
  } = useFabro();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mobileShowEditor, setMobileShowEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState(selectedSubjectId || '');
  const [filterFolder, setFilterFolder] = useState('');

  // Local editor state
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [unit, setUnit] = useState('');
  const [folder, setFolder] = useState('General');
  const [tagsInput, setTagsInput] = useState('');
  const [offlineAvailable, setOfflineAvailable] = useState(true);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [saveState, setSaveState] = useState<'guardado' | 'guardando' | 'guardado_offline' | 'sin_cambios'>('sin_cambios');
  const [noteError, setNoteError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printHtml, setPrintHtml] = useState('');

  // Inline Link Insertion state (avoids window.prompt inside iframes/mobile)
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  // Inline Chart Insertion state
  const [showChartInput, setShowChartInput] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [chartTitle, setChartTitle] = useState('Rendimiento por unidad');
  const [chartRowsText, setChartRowsText] = useState(
    'Unidad 1: 85\nUnidad 2: 72\nUnidad 3: 94'
  );

  // PDF Studio Modal state
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const [pdfStudioScope, setPdfStudioScope] = useState<PdfStudioScope>('single');

  // Visual Study Studio (Esquemas & Líneas cronológicas)
  const [visualModalOpen, setVisualModalOpen] = useState(false);
  const [visualKind, setVisualKind] = useState<VisualStudyKind>('esquema');

  // Wikipedia Image Finder, Lightbox & AI Reading Mode
  const [wikiImageModalOpen, setWikiImageModalOpen] = useState(false);
  const [readingModeOpen, setReadingModeOpen] = useState(false);
  const [editorLightboxItems, setEditorLightboxItems] = useState<WikiMediaItem[]>([]);
  const [editorLightboxIdx, setEditorLightboxIdx] = useState<number | null>(null);

  // Selected-text Timeline Extractor
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineSeedText, setTimelineSeedText] = useState('');

  // Share menu, Save feedback & Note-linked Reminders
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copiedShareFeedback, setCopiedShareFeedback] = useState(false);
  const [manualSavedPulse, setManualSavedPulse] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [newRemTitle, setNewRemTitle] = useState('');
  const [newRemDate, setNewRemDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newRemTime, setNewRemTime] = useState('18:00');
  const [savingRem, setSavingRem] = useState(false);
  const [showChecklistBar, setShowChecklistBar] = useState(false);
  const [checklistDraft, setChecklistDraft] = useState('');

  const editorRef = useRef<HTMLDivElement | null>(null);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!shareMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [shareMenuOpen]);

  // Sync filterSubject if user jumped from a Subject Workspace
  useEffect(() => {
    if (selectedSubjectId) {
      setFilterSubject(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const selectedNote: Note | null = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  // Keep fresh values in a ref so debounced auto-save never captures stale closures
  const latestDraftRef = useRef({
    noteId: '' as string,
    title: '',
    subjectId: '',
    unit: '',
    folder: 'General',
    tagsInput: '',
    attachments: [] as NoteAttachment[],
    offlineAvailable: true,
  });

  useEffect(() => {
    latestDraftRef.current = {
      noteId: selectedNote?.id || '',
      title,
      subjectId,
      unit,
      folder,
      tagsInput,
      attachments,
      offlineAvailable,
    };
  }, [selectedNote?.id, title, subjectId, unit, folder, tagsInput, attachments, offlineAvailable]);

  // Auto-select first note when notes load from Firestore (without forcing mobile into editor)
  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      const firstMatch = filterSubject
        ? notes.find((n) => n.subjectId === filterSubject) || notes[0]
        : notes[0];
      if (firstMatch) setSelectedNoteId(firstMatch.id);
    }
  }, [notes, selectedNoteId, filterSubject]);

  // Cancel pending timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // Sync editor DOM & record recent access when switching selected note
  useEffect(() => {
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    if (!selectedNote) return;
    markNoteAccessed(selectedNote.id);
    setTitle(selectedNote.title);
    setSubjectId(selectedNote.subjectId || '');
    setUnit(selectedNote.unit || '');
    setFolder(selectedNote.folder || 'General');
    setTagsInput((selectedNote.tags || []).join(', '));
    setOfflineAvailable(Boolean(selectedNote.offlineAvailable));
    setAttachments(selectedNote.attachments || []);
    if (editorRef.current) {
      editorRef.current.innerHTML = selectedNote.contentHtml || '';
    }
    setPrintHtml(sanitizeHtmlForPrint(selectedNote.contentHtml || ''));
    setSaveState(isOnline ? 'guardado' : 'guardado_offline');
    setNoteError('');
  }, [selectedNote?.id, markNoteAccessed]);

  const folders = useMemo(() => {
    const set = new Set<string>(['General']);
    for (const n of notes) if (n.folder) set.add(n.folder);
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (filterSubject && n.subjectId !== filterSubject) return false;
      if (filterFolder && n.folder !== filterFolder) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.contentText.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, searchQuery, filterSubject, filterFolder]);

  const triggerAutoSave = useCallback(
    (override?: Partial<Note>) => {
      const activeId = selectedNote?.id;
      if (!activeId) return;
      if (editorRef.current) {
        setPrintHtml(sanitizeHtmlForPrint(editorRef.current.innerHTML));
      }
      setSaveState('guardando');
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);

      autoSaveTimer.current = window.setTimeout(() => {
        const snap = latestDraftRef.current;
        if (snap.noteId !== activeId) return;

        const html = editorRef.current?.innerHTML || '';
        const text = editorRef.current?.innerText || '';
        const tags = (
          override?.tags ??
          snap.tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        ).slice(0, 15);

        void updateNote(activeId, {
          title: override?.title ?? snap.title,
          subjectId: override?.subjectId ?? snap.subjectId,
          unit: override?.unit ?? snap.unit,
          folder: override?.folder ?? snap.folder,
          tags,
          contentHtml: html,
          contentText: text,
          attachments: override?.attachments ?? snap.attachments,
          offlineAvailable: override?.offlineAvailable ?? snap.offlineAvailable,
        })
          .then(() => {
            setNoteError('');
            setSaveState(navigator.onLine ? 'guardado' : 'guardado_offline');
          })
          .catch(() => {
            if (!navigator.onLine) {
              setSaveState('guardado_offline');
              return;
            }
            setNoteError('No se pudo sincronizar el apunte. Verificá tu conexión.');
            setSaveState('sin_cambios');
          });
      }, 700);
    },
    [selectedNote?.id, updateNote]
  );

  const handleManualSaveNow = useCallback(async () => {
    if (!selectedNote) return;
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setSaveState('guardando');
    const html = editorRef.current?.innerHTML || '';
    const text = editorRef.current?.innerText || '';
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 15);
    try {
      await updateNote(selectedNote.id, {
        title: title.trim() || 'Apunte sin título',
        subjectId,
        unit,
        folder,
        tags,
        contentHtml: html,
        contentText: text,
        attachments,
        offlineAvailable,
      });
      setNoteError('');
      setSaveState(navigator.onLine ? 'guardado' : 'guardado_offline');
      setManualSavedPulse(true);
      window.setTimeout(() => setManualSavedPulse(false), 1800);
    } catch {
      if (!navigator.onLine) {
        setSaveState('guardado_offline');
        setManualSavedPulse(true);
        window.setTimeout(() => setManualSavedPulse(false), 1800);
        return;
      }
      setNoteError('No se pudo guardar el apunte en este momento.');
      setSaveState('sin_cambios');
    }
  }, [selectedNote, title, subjectId, unit, folder, tagsInput, attachments, offlineAvailable, updateNote]);

  const noteReminders = useMemo(() => {
    if (!selectedNote) return [];
    const tag = `[Apunte:${selectedNote.id}]`;
    return calendarEvents
      .filter((ev) => (ev.notes || '').includes(tag))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [calendarEvents, selectedNote]);

  const handleAddNoteReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote || !newRemTitle.trim() || savingRem) return;
    setSavingRem(true);
    try {
      await createCalendarEvent({
        subjectId,
        title: newRemTitle.trim(),
        type: 'recordatorio',
        date: newRemDate || new Date().toISOString().slice(0, 10),
        time: newRemTime || '',
        notes: `[Apunte:${selectedNote.id}] ${title || selectedNote.title}`,
        completed: false,
      });
      setNewRemTitle('');
    } catch {
      setNoteError('No se pudo guardar el recordatorio para este apunte.');
    } finally {
      setSavingRem(false);
    }
  };

  const handleCreateNote = async () => {
    setNoteError('');
    try {
      const id = await createNote({
        subjectId: filterSubject || selectedSubjectId || subjects[0]?.id || '',
        unit: '',
        folder: filterFolder || 'General',
        title: 'Nuevo apunte',
        contentHtml: '<p></p>',
        contentText: '',
        tags: [],
        attachments: [],
        offlineAvailable: true,
      });
      setSelectedNoteId(id);
      setMobileShowEditor(true);
    } catch {
      setNoteError('No se pudo crear el apunte.');
    }
  };

  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    triggerAutoSave();
  };

  const handleInsertChecklistItem = (rawLabel?: string) => {
    const clean = (rawLabel || 'Tarea o punto clave a estudiar')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const itemHtml = `<li class="fabro-checklist-item" data-checked="false"><input type="checkbox" /> <span>${clean}</span></li>`;
    if (editorRef.current) {
      const lists = editorRef.current.querySelectorAll('ul.fabro-checklist');
      const sel = window.getSelection();
      const anchorNode = sel?.anchorNode || null;
      let targetList: Element | null = null;
      if (anchorNode) {
        const anchorEl = anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement;
        targetList = anchorEl?.closest('ul.fabro-checklist') || null;
      }
      if (!targetList && lists.length > 0 && rawLabel) {
        targetList = lists[lists.length - 1];
      }
      if (targetList) {
        targetList.insertAdjacentHTML('beforeend', itemHtml);
        setPrintHtml(sanitizeHtmlForPrint(editorRef.current.innerHTML));
        triggerAutoSave();
        return;
      }
    }
    execFormat('insertHTML', `<ul class="fabro-checklist">${itemHtml}</ul><p></p>`);
  };

  const handleOpenTimelineExtractor = () => {
    let captured = '';
    const sel = window.getSelection();
    if (sel && editorRef.current && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        captured = sel.toString().trim();
      }
    }
    setTimelineSeedText(captured);
    setTimelineModalOpen(true);
  };

  const handleInsertTable = () => {
    const tableHtml =
      '<table><thead><tr><th>Concepto</th><th>Definición</th></tr></thead><tbody><tr><td>Elemento 1</td><td>Detalle</td></tr></tbody></table><p></p>';
    execFormat('insertHTML', tableHtml);
  };

  const handleApplyLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = linkUrl.trim();
    if (cleaned && /^https?:\/\//i.test(cleaned)) {
      execFormat('insertHTML', `<a href="${cleaned.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${cleaned}</a> `);
    }
    setShowLinkInput(false);
    setLinkUrl('https://');
  };

  const handleInsertChart = (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError('');
    const parsedItems = chartRowsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const sepIdx = line.includes(':') ? line.lastIndexOf(':') : line.lastIndexOf(',');
        if (sepIdx <= 0) return null;
        const label = line.slice(0, sepIdx).trim();
        const rawVal = line.slice(sepIdx + 1).trim().replace(',', '.');
        const value = Number(rawVal);
        if (!label || !Number.isFinite(value)) return null;
        return { label, value };
      })
      .filter((item): item is { label: string; value: number } => item !== null);

    if (parsedItems.length === 0) {
      setNoteError('Ingresá al menos una fila válida con el formato "Etiqueta: valor".');
      return;
    }

    const activeAccent =
      subjects.find((s) => s.id === subjectId)?.color || '#0284C7';
    const dataUrl = renderChartToDataUrl({
      chartType,
      title: chartTitle.trim() || 'Gráfico de estudio',
      items: parsedItems,
      accentColor: activeAccent,
    });

    if (!dataUrl || dataUrl.length > 240000) {
      setNoteError('No se pudo insertar el gráfico en el apunte.');
      return;
    }

    const safeAlt = (chartTitle.trim() || 'Gráfico de estudio').replace(/["<>]/g, '');
    execFormat('insertHTML', `<img src="${dataUrl}" alt="Gráfico: ${safeAlt}" /><p></p>`);
    setShowChartInput(false);
  };

  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNoteError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      const safeAlt = file.name.replace(/["<>]/g, '');

      // If small enough, insert directly; otherwise downscale via canvas to stay under Firestore's 300KB limit
      if (rawDataUrl.length <= 220000) {
        execFormat('insertHTML', `<img src="${rawDataUrl}" alt="${safeAlt}" /><p></p>`);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxDim = 1024;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setNoteError('La imagen es demasiado grande para incrustar en el apunte.');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let compressed = canvas.toDataURL('image/jpeg', 0.78);
        if (compressed.length > 220000) {
          compressed = canvas.toDataURL('image/jpeg', 0.55);
        }
        if (compressed.length > 250000) {
          setNoteError('La imagen supera el tamaño máximo del apunte. Adjuntala desde el ícono de clip (Biblioteca).');
          return;
        }
        execFormat('insertHTML', `<img src="${compressed}" alt="${safeAlt}" /><p></p>`);
      };
      img.onerror = () => {
        setNoteError('No se pudo procesar la imagen seleccionada.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNote) return;
    setNoteError('');
    try {
      const libId = await uploadLibraryDocument({
        file,
        title: file.name,
        category: file.type.startsWith('image/') ? 'foto_apunte' : 'pdf',
        subjectId,
        tags: ['adjunto'],
        aiAuthorized: true,
        extractedText: '',
      });
      const nextAttachments: NoteAttachment[] = [
        ...attachments,
        {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          url: '',
          libraryDocId: libId,
        },
      ].slice(0, 10);
      setAttachments(nextAttachments);
      triggerAutoSave({ attachments: nextAttachments });
    } catch {
      setNoteError('No se pudo adjuntar el archivo.');
    } finally {
      e.target.value = '';
    }
  };

  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name || 'General';
  const currentSubjectUnits = subjects.find((s) => s.id === subjectId)?.units || [];

  const handleExportPdf = async () => {
    if (!selectedNote || exportingPdf) return;
    setExportingPdf(true);
    setNoteError('');
    try {
      await exportNoteToPdf({
        title,
        subjectName: getSubjectName(subjectId),
        unit,
        folder,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        attachments,
        contentHtml: editorRef.current?.innerHTML || '',
        contentText: editorRef.current?.innerText || '',
      });
    } catch {
      setNoteError('No se pudo generar el archivo PDF del apunte.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrintNote = () => {
    setPrintHtml(sanitizeHtmlForPrint(editorRef.current?.innerHTML || ''));
    window.setTimeout(() => {
      window.print();
    }, 60);
  };

  const handleOpenPdfStudio = (scope: PdfStudioScope) => {
    setPdfStudioScope(scope);
    setPdfStudioOpen(true);
  };

  const handleOpenEditorImageLightbox = (clickedImg: HTMLImageElement) => {
    if (!editorRef.current) return;
    const imgs = Array.from(editorRef.current.querySelectorAll('img'));
    const items: WikiMediaItem[] = [];
    let matchIdx = 0;
    imgs.forEach((imgEl, idx) => {
      const src = imgEl.getAttribute('src') || '';
      if (!src) return;
      const full = imgEl.getAttribute('data-full-src') || src;
      const figCaption = imgEl.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '';
      if (imgEl === clickedImg) {
        matchIdx = items.length;
      }
      items.push({
        id: `editor_img_${idx}`,
        title: imgEl.getAttribute('alt') || `Figura ${idx + 1}`,
        thumbUrl: src,
        fullUrl: full,
        description: figCaption || imgEl.getAttribute('alt') || 'Imagen incrustada en el apunte.',
        source: 'nota',
      });
    });
    if (items.length > 0) {
      setEditorLightboxItems(items);
      setEditorLightboxIdx(matchIdx);
    }
  };

  const currentLiveNote: PdfStudioNoteInput | null = selectedNote
    ? {
        id: selectedNote.id,
        title: title || selectedNote.title,
        subjectName: getSubjectName(subjectId),
        unit,
        folder,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        attachments,
        contentHtml: editorRef.current?.innerHTML ?? selectedNote.contentHtml ?? '',
        contentText: editorRef.current?.innerText ?? selectedNote.contentText ?? '',
      }
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-h-[calc(100dvh-10rem)]">
      {/* Left Notes Navigator (Master view on mobile when editor isn't open) */}
      <aside
        className={`no-print lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden ${
          mobileShowEditor ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Mis apuntes ({filteredNotes.length})
            </h2>
            <div className="flex items-center gap-1.5">
              {notes.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPdfStudio(filterSubject ? 'subject' : 'custom')
                  }
                  title="Unir o exportar apuntes en PDF con portada e índice"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileStack className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="hidden sm:inline">Compilar PDF</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleCreateNote()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, texto o etiqueta..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-8 pr-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              aria-label="Filtrar por materia"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
            >
              <option value="">Todas las materias</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={filterFolder}
              onChange={(e) => setFilterFolder(e.target.value)}
              aria-label="Filtrar por carpeta"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
            >
              <option value="">Todas las carpetas</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 max-h-[65dvh] lg:max-h-none">
          {filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3">
              <p>No se encontraron apuntes. Creá uno nuevo para comenzar.</p>
              <button
                type="button"
                onClick={() => void handleCreateNote()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear apunte
              </button>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const active = note.id === selectedNoteId;
              const isRecent = recentNoteIds.includes(note.id);
              const isPrecached = note.offlineAvailable || isRecent;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    markNoteAccessed(note.id);
                    setMobileShowEditor(true);
                  }}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-600/10 dark:bg-sky-500/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {note.title}
                    </p>
                    {isPrecached && (
                      <span
                        title={
                          isRecent
                            ? 'Acceso reciente precargado para lectura y edición offline'
                            : 'Disponible sin conexión'
                        }
                        className="shrink-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                      >
                        {isRecent ? 'Reciente · Offline' : 'Offline'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Materia: {getSubjectName(note.subjectId)} · {note.folder || 'General'}
                  </p>
                  {note.contentText && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {note.contentText}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Rich Text Note Editor (Detail view on mobile) */}
      <section
        className={`no-print lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden ${
          mobileShowEditor ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!selectedNote ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-10 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-400" />
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Seleccioná o creá un apunte
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Editor avanzado con formato enriquecido, tablas, imágenes, guardado automático en la nube y exportación a PDF o Word.
            </p>
            <button
              type="button"
              onClick={() => void handleCreateNote()}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear apunte
            </button>
          </div>
        ) : (
          <>
            {/* Note Metadata & Export Actions */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileShowEditor(false)}
                    className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Apuntes
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {saveState === 'guardando'
                      ? 'Guardando...'
                      : saveState === 'guardado_offline' || !isOnline
                      ? 'Guardado offline (local)'
                      : 'Sincronizado'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => void handleManualSaveNow()}
                    disabled={saveState === 'guardando'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                      manualSavedPulse
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                  >
                    {manualSavedPulse ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{manualSavedPulse ? 'Guardado' : 'Guardar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRemindersOpen((v) => !v)}
                    title="Recordatorios vinculados a este apunte"
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                      remindersOpen || noteReminders.length > 0
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Recordatorios</span>
                    {noteReminders.length > 0 && (
                      <span className="font-mono text-[11px] font-bold">({noteReminders.length})</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !offlineAvailable;
                      setOfflineAvailable(next);
                      triggerAutoSave({ offlineAvailable: next });
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                      offlineAvailable
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {offlineAvailable ? <Wifi className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{offlineAvailable ? 'Offline activo' : 'Solo nube'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintNote}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Imprimir</span>
                  </button>

                  <button
                    type="button"
                    disabled={exportingPdf}
                    onClick={() => void handleExportPdf()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                  >
                    {exportingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {exportingPdf ? 'Generando...' : 'PDF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenPdfStudio('single')}
                    title="Abrir estudio PDF (portada, índice, unir apuntes, A4/Carta, compartir)"
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                  >
                    <FileStack className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Estudio PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void exportNoteToWord({
                        title,
                        subjectName: getSubjectName(subjectId),
                        folder,
                        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
                        contentHtml: editorRef.current?.innerHTML || '',
                        contentText: editorRef.current?.innerText || '',
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Word
                  </button>

                  <button
                    type="button"
                    onClick={() => setReadingModeOpen(true)}
                    title="Abrir en Modo de Lectura IA con temas claro, sepia, noche e imágenes enciclopédicas"
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Lectura IA</span>
                  </button>

                  <AudioReadAloudControl
                    getText={() =>
                      `${title ? `${title}. ` : ''}${editorRef.current?.innerText || selectedNote.contentText || ''}`
                    }
                    title={title || 'apunte-fabro'}
                  />

                  <div ref={shareMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShareMenuOpen((v) => !v)}
                      title="Compartir apunte"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Compartir</span>
                    </button>

                    {shareMenuOpen && (
                      <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] shadow-xl p-1.5 z-40 space-y-1">
                        <a
                          href={
                            buildWhatsAppShareHref(
                              formatForWhatsApp({
                                title: title || 'Apunte FABRO',
                                subtitle: [getSubjectName(subjectId), unit].filter(Boolean).join(' · '),
                                body: editorRef.current?.innerHTML || selectedNote.contentHtml || selectedNote.contentText || '',
                                isHtml: true,
                              })
                            ).href
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShareMenuOpen(false)}
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Enviar por WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const formatted = `${title || 'Apunte FABRO'}\n${[getSubjectName(subjectId), unit].filter(Boolean).join(' · ')}\n\n${editorRef.current?.innerText || selectedNote.contentText || ''}`;
                            void navigator.clipboard?.writeText(formatted).then(() => {
                              setCopiedShareFeedback(true);
                              window.setTimeout(() => setCopiedShareFeedback(false), 1800);
                            });
                          }}
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {copiedShareFeedback ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedShareFeedback ? 'Texto copiado' : 'Copiar texto del apunte'}
                        </button>
                        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                          <button
                            type="button"
                            onClick={() => {
                              const textBody = editorRef.current?.innerText || selectedNote.contentText || '';
                              void navigator.share({
                                title: title || 'Apunte FABRO',
                                text: `${title || 'Apunte FABRO'}\n\n${textBody.slice(0, 3000)}`,
                              }).catch(() => {});
                              setShareMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-sky-500" />
                            Compartir con el dispositivo
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void deleteNote(selectedNote.id);
                      setSelectedNoteId(null);
                      setMobileShowEditor(false);
                    }}
                    aria-label="Eliminar apunte"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {noteError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {noteError}
                </div>
              )}

              <input
                type="text"
                maxLength={200}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  triggerAutoSave({ title: e.target.value });
                }}
                placeholder="Título del apunte"
                className="w-full bg-transparent font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white focus:outline-none"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    triggerAutoSave({ subjectId: e.target.value });
                  }}
                  aria-label="Nombre de la materia"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                >
                  <option value="">Materia: General</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      Materia: {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={unit}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    triggerAutoSave({ unit: e.target.value });
                  }}
                  aria-label="Unidad temática"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                >
                  <option value="">Sin unidad</option>
                  {currentSubjectUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2">
                  <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    maxLength={100}
                    value={folder}
                    onChange={(e) => {
                      setFolder(e.target.value);
                      triggerAutoSave({ folder: e.target.value });
                    }}
                    placeholder="Carpeta"
                    className="w-full bg-transparent text-xs focus:outline-none"
                  />
                </div>

                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    triggerAutoSave({
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    });
                  }}
                  placeholder="Etiquetas (separadas por coma)"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                />
              </div>
            </div>

            {remindersOpen && (
              <div className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-amber-500/5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <Bell className="w-3.5 h-3.5" />
                    Recordatorios de este apunte (sincronizados con tu agenda)
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemindersOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={(e) => void handleAddNoteReminder(e)} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={newRemTitle}
                    onChange={(e) => setNewRemTitle(e.target.value)}
                    placeholder="Ej. Repasar unidad 2 antes del parcial..."
                    className="sm:col-span-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                  />
                  <input
                    type="date"
                    value={newRemDate}
                    onChange={(e) => setNewRemDate(e.target.value)}
                    className="sm:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="time"
                    value={newRemTime}
                    onChange={(e) => setNewRemTime(e.target.value)}
                    className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    disabled={savingRem || !newRemTitle.trim()}
                    className="sm:col-span-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                  >
                    {savingRem ? '...' : '+'}
                  </button>
                </form>

                {noteReminders.length > 0 && (
                  <div className="space-y-1.5">
                    {noteReminders.map((rem) => (
                      <div
                        key={rem.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-3 py-1.5 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => void updateCalendarEvent(rem.id, { completed: !rem.completed })}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              rem.completed ? 'text-emerald-500' : 'text-slate-400'
                            }`}
                          />
                          <span className={`truncate ${rem.completed ? 'line-through opacity-60' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                            {rem.title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">
                            {rem.date}{rem.time ? ` ${rem.time}` : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteCalendarEvent(rem.id)}
                          aria-label="Eliminar recordatorio"
                          className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Horizontally Scrollable Formatting Toolbar on Mobile */}
            <div className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center gap-1 overflow-x-auto">
              <button type="button" onClick={() => execFormat('formatBlock', '<h1>')} title="Título" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Heading1 className="w-4 h-4" /></button>
              <button type="button" onClick={() => execFormat('formatBlock', '<h2>')} title="Subtítulo" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Heading2 className="w-4 h-4" /></button>
              <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
              <button type="button" onClick={() => execFormat('bold')} title="Negrita" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Bold className="w-4 h-4" /></button>
              <button type="button" onClick={() => execFormat('italic')} title="Cursiva" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Italic className="w-4 h-4" /></button>
              <button type="button" onClick={() => execFormat('underline')} title="Subrayado" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Underline className="w-4 h-4" /></button>
              <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
              <button type="button" onClick={() => execFormat('insertUnorderedList')} title="Lista con viñetas" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><List className="w-4 h-4" /></button>
              <button type="button" onClick={() => execFormat('insertOrderedList')} title="Lista numerada" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><ListOrdered className="w-4 h-4" /></button>
              <button
                type="button"
                onClick={() => setShowChecklistBar((v) => !v)}
                title="Insertar casillas de marcación interactivas"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 whitespace-nowrap ${
                  showChecklistBar
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'text-sky-700 dark:text-sky-300 hover:bg-sky-500/10'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Casillas
              </button>
              <button type="button" onClick={handleInsertTable} title="Insertar tabla" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><TableIcon className="w-4 h-4" /></button>
              <button
                type="button"
                onClick={() => {
                  setShowChartInput((v) => !v);
                  setShowLinkInput(false);
                }}
                title="Insertar gráfico de barras o líneas"
                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0 ${
                  showChartInput ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : ''
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkInput((v) => !v);
                  setShowChartInput(false);
                }}
                title="Insertar enlace"
                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0 ${
                  showLinkInput ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : ''
                }`}
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => imageInputRef.current?.click()} title="Insertar imagen local" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><ImageIcon className="w-4 h-4" /></button>
              <button
                type="button"
                onClick={() => setWikiImageModalOpen(true)}
                title="Explorar láminas, archivos científicos e imágenes enciclopédicas"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Globe className="w-3.5 h-3.5" />
                Enciclopedia visual
              </button>
              <button type="button" onClick={() => attachInputRef.current?.click()} title="Adjuntar PDF, DOCX o archivo" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Paperclip className="w-4 h-4" /></button>
              <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setVisualKind('esquema');
                  setVisualModalOpen(true);
                }}
                title="Crear e insertar esquema conceptual"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Esquema
              </button>
              <button
                type="button"
                onClick={handleOpenTimelineExtractor}
                title="Extraer fechas clave del texto seleccionado y generar línea cronológica visual"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Extraer Cronología
              </button>
              <button
                type="button"
                onClick={() => {
                  setVisualKind('linea_cronologica');
                  setVisualModalOpen(true);
                }}
                title="Crear e insertar línea periódica histórica cronológica"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <History className="w-3.5 h-3.5" />
                Línea cronológica
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleInsertImage} />
              <input ref={attachInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,image/*" className="hidden" onChange={(e) => void handleAttachFile(e)} />
            </div>

            {showChecklistBar && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInsertChecklistItem(checklistDraft.trim() || 'Punto clave por completar');
                  setChecklistDraft('');
                }}
                className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-sky-500/5 flex flex-wrap items-center gap-2"
              >
                <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <input
                  type="text"
                  value={checklistDraft}
                  onChange={(e) => setChecklistDraft(e.target.value)}
                  placeholder="Escribí una casilla de verificación (ej. Repasar capítulo 3)..."
                  className="flex-1 min-w-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Insertar casilla
                </button>
                <button
                  type="button"
                  onClick={() => setShowChecklistBar(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            )}

            {currentSubjectUnits.length > 0 && !unit && (
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-sky-500/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Sugerencia de estudio: comenzá por <strong>{currentSubjectUnits[0]}</strong> y desarrollá cada tema en apuntes separados.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const firstUnit = currentSubjectUnits[0];
                    setUnit(firstUnit);
                    setFolder(firstUnit);
                    triggerAutoSave({ unit: firstUnit, folder: firstUnit });
                  }}
                  className="font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Asignar a {currentSubjectUnits[0]}
                </button>
              </div>
            )}

            {showLinkInput && (
              <form
                onSubmit={handleApplyLink}
                className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/20 flex items-center gap-2"
              >
                <input
                  type="url"
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                >
                  Insertar
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkInput(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            )}

            {showChartInput && (
              <form
                onSubmit={handleInsertChart}
                className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/20 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Insertar gráfico en el apunte
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowChartInput(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value === 'line' ? 'line' : 'bar')}
                    aria-label="Tipo de gráfico"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                  >
                    <option value="bar">Gráfico de barras</option>
                    <option value="line">Gráfico de líneas</option>
                  </select>
                  <input
                    type="text"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    placeholder="Título del gráfico"
                    className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                  <textarea
                    rows={3}
                    value={chartRowsText}
                    onChange={(e) => setChartRowsText(e.target.value)}
                    placeholder={'Unidad 1: 85\nUnidad 2: 72\nUnidad 3: 94'}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer shrink-0"
                  >
                    Insertar gráfico
                  </button>
                </div>
              </form>
            )}

            {/* Editable Surface */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Comenzá a redactar tus apuntes aquí... (Tocá cualquier imagen para abrir el visor enciclopédico)"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
                  const checkbox = target as HTMLInputElement;
                  if (checkbox.checked) {
                    checkbox.setAttribute('checked', 'checked');
                  } else {
                    checkbox.removeAttribute('checked');
                  }
                  const itemLi = checkbox.closest('.fabro-checklist-item');
                  if (itemLi) {
                    itemLi.setAttribute('data-checked', checkbox.checked ? 'true' : 'false');
                  }
                  setPrintHtml(sanitizeHtmlForPrint(editorRef.current?.innerHTML || ''));
                  triggerAutoSave();
                  return;
                }
                if (target.tagName === 'IMG') {
                  handleOpenEditorImageLightbox(target as HTMLImageElement);
                }
              }}
              onInput={() => {
                setPrintHtml(sanitizeHtmlForPrint(editorRef.current?.innerHTML || ''));
                triggerAutoSave();
              }}
              className="fabro-editor flex-1 p-4 sm:p-6 text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none overflow-y-auto min-h-[300px]"
            />

            {attachments.length > 0 && (
              <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-400">Adjuntos:</span>
                {attachments.map((att, idx) => (
                  <span key={idx} className="text-slate-700 dark:text-slate-300 break-all">
                    {att.name} ({Math.max(1, Math.round(att.sizeBytes / 1024))} KB)
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Print-ready A4 Sheet (visible only during print / Ctrl+P) */}
      {selectedNote && (
        <article className="hidden print:block fabro-print-sheet col-span-12 bg-white text-slate-900">
          <div className="border-t-4 border-sky-600 pt-4 pb-4 mb-5 border-b border-slate-300">
            <p className="text-[10px] font-bold tracking-widest uppercase text-sky-700 mb-1">
              FABRO · APUNTE ACADÉMICO
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {title || 'Apunte sin título'}
            </h1>
            <p className="text-xs text-slate-600 mt-1.5">
              {[
                `Materia: ${getSubjectName(subjectId)}`,
                unit ? `Unidad: ${unit}` : '',
                folder ? `Carpeta: ${folder}` : '',
                tagsInput.trim() ? `Etiquetas: ${tagsInput}` : '',
                new Date().toLocaleDateString('es-AR'),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div
            className="fabro-editor text-sm leading-relaxed text-slate-900"
            dangerouslySetInnerHTML={{ __html: printHtml }}
          />

          {attachments.length > 0 && (
            <div className="mt-8 pt-4 border-t border-slate-300 text-xs text-slate-700">
              <p className="font-semibold text-slate-900 mb-1">Archivos adjuntos:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {attachments.map((att, idx) => (
                  <li key={idx}>
                    {att.name} ({Math.max(1, Math.round(att.sizeBytes / 1024))} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
      <NotesPdfStudioModal
        open={pdfStudioOpen}
        onClose={() => setPdfStudioOpen(false)}
        initialScope={pdfStudioScope}
        currentLiveNote={currentLiveNote}
        currentNoteId={selectedNote?.id || null}
        currentSubjectId={subjectId || filterSubject || selectedSubjectId || ''}
        notes={notes}
        subjects={subjects}
        profile={profile}
      />

      <VisualStudyStudioModal
        isOpen={visualModalOpen}
        onClose={() => setVisualModalOpen(false)}
        initialKind={visualKind}
        defaultTopic={title || unit || ''}
        defaultContext={editorRef.current?.innerText || selectedNote?.contentText || ''}
        subjectId={subjectId || filterSubject || ''}
        subjectName={subjectId ? getSubjectName(subjectId) : ''}
        canInsertIntoCurrentNote={Boolean(selectedNote)}
        onInsertHtml={(html) => {
          if (!editorRef.current) return;
          editorRef.current.innerHTML = `${editorRef.current.innerHTML}<p></p>${html}<p></p>`;
          setPrintHtml(sanitizeHtmlForPrint(editorRef.current.innerHTML));
          triggerAutoSave();
          setVisualModalOpen(false);
        }}
      />

      <WikiImageFinderModal
        isOpen={wikiImageModalOpen}
        onClose={() => setWikiImageModalOpen(false)}
        initialQuery={title || unit || (subjectId ? getSubjectName(subjectId) : '')}
        canInsert={Boolean(selectedNote)}
        onInsertFigureHtml={(figureHtml: string) => {
          execFormat('insertHTML', `${figureHtml}<p></p>`);
        }}
      />

      {selectedNote && (
        <AIReadingModeModal
          isOpen={readingModeOpen}
          onClose={() => setReadingModeOpen(false)}
          title={title || selectedNote.title}
          subjectName={subjectId ? getSubjectName(subjectId) : ''}
          contentText={editorRef.current?.innerText || selectedNote.contentText || ''}
          contentHtml={editorRef.current?.innerHTML || selectedNote.contentHtml || ''}
          onInsertWikiImageToNote={(figureHtml) => {
            if (!editorRef.current) return;
            editorRef.current.innerHTML = `${editorRef.current.innerHTML}<p></p>${figureHtml}<p></p>`;
            setPrintHtml(sanitizeHtmlForPrint(editorRef.current.innerHTML));
            triggerAutoSave();
          }}
        />
      )}

      <WikiMediaLightbox
        isOpen={editorLightboxIdx !== null}
        items={editorLightboxItems}
        initialIndex={editorLightboxIdx ?? 0}
        onClose={() => setEditorLightboxIdx(null)}
      />

      <NoteTimelineExtractorModal
        isOpen={timelineModalOpen}
        onClose={() => setTimelineModalOpen(false)}
        selectedText={timelineSeedText}
        fullNoteText={editorRef.current?.innerText || selectedNote?.contentText || ''}
        noteTitle={title || selectedNote?.title || 'Apunte'}
        subjectId={subjectId || filterSubject || ''}
        subjectName={subjectId ? getSubjectName(subjectId) : ''}
        canInsertIntoCurrentNote={Boolean(selectedNote)}
        onInsertHtml={(html) => {
          if (!editorRef.current) return;
          editorRef.current.innerHTML = `${editorRef.current.innerHTML}<p></p>${html}<p></p>`;
          setPrintHtml(sanitizeHtmlForPrint(editorRef.current.innerHTML));
          triggerAutoSave();
          setTimelineModalOpen(false);
        }}
      />
    </div>
  );
};
