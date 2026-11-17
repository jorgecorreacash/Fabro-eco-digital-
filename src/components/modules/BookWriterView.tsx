import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  BookMarked,
  BookOpen,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  Feather,
  FileStack,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Quote,
  Search,
  Share2,
  Sparkles,
  StickyNote,
  Table as TableIcon,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import {
  exportBookToWord,
  markdownToHtml,
  sanitizeHtmlForPrint,
} from '../../lib/exporters';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';
import {
  BOOK_GENRE_OPTIONS,
  type Book,
  type BookChapter,
  type BookChapterStatus,
  type BookGenre,
  type BookStatus,
} from '../../types/fabro';
import { NotesPdfStudioModal, type BookPdfCompilation } from './NotesPdfStudioModal';
import { AIReadingModeModal } from './AIReadingModeModal';

const BOOK_COVER_COLORS = [
  { hex: '#0284C7', label: 'Azul FABRO' },
  { hex: '#1E293B', label: 'Pizarra Editorial' },
  { hex: '#059669', label: 'Esmeralda' },
  { hex: '#7C3AED', label: 'Índigo' },
  { hex: '#B45309', label: 'Terracota' },
  { hex: '#BE123C', label: 'Carmesí' },
];

const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  finalizado: 'Finalizado',
};

const CHAPTER_STATUS_LABELS: Record<BookChapterStatus, string> = {
  idea: 'Idea',
  borrador: 'Borrador',
  revisado: 'Revisado',
  completo: 'Completo',
};

function countWordsFromText(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function getGenreLabel(genre: BookGenre): string {
  return BOOK_GENRE_OPTIONS.find((g) => g.value === genre)?.label || 'Libro';
}

export const BookWriterView: React.FC = () => {
  const {
    profile,
    subjects,
    notes,
    books,
    createBook,
    updateBook,
    deleteBook,
    subscribeBookChapters,
    createBookChapter,
    updateBookChapter,
    reorderBookChapters,
    deleteBookChapter,
    syncBookMetrics,
  } = useFabro();

  // Navigation & shelf filters
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [shelfSearch, setShelfSearch] = useState('');
  const [shelfStatusFilter, setShelfStatusFilter] = useState<'all' | BookStatus>('all');
  const [confirmDeleteBookId, setConfirmDeleteBookId] = useState<string | null>(null);

  // Create / Edit Book Modal state
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formAuthorName, setFormAuthorName] = useState('');
  const [formGenre, setFormGenre] = useState<BookGenre>('academico');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formLanguage, setFormLanguage] = useState('Español');
  const [formTargetWords, setFormTargetWords] = useState(20000);
  const [formCoverColor, setFormCoverColor] = useState('#0284C7');
  const [formStatus, setFormStatus] = useState<BookStatus>('borrador');
  const [formSynopsis, setFormSynopsis] = useState('');
  const [formDedication, setFormDedication] = useState('');
  const [formBibliography, setFormBibliography] = useState('');
  const [savingBookMeta, setSavingBookMeta] = useState(false);

  // Active Book Chapters state
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'chapters' | 'editor'>('chapters');

  // Chapter Editor state
  const [chapTitle, setChapTitle] = useState('');
  const [chapSummary, setChapSummary] = useState('');
  const [chapNotes, setChapNotes] = useState('');
  const [chapStatus, setChapStatus] = useState<BookChapterStatus>('borrador');
  const [chapWordCount, setChapWordCount] = useState(0);
  const [saveState, setSaveState] = useState<'guardado' | 'guardando' | 'sin_cambios'>('sin_cambios');
  const [editorError, setEditorError] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [readingPreviewMode, setReadingPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showChapterGuide, setShowChapterGuide] = useState(false);
  const [confirmDeleteChapId, setConfirmDeleteChapId] = useState<string | null>(null);

  // Co-Author AI Assistant drawer
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiResponseText, setAiResponseText] = useState('');
  const [aiSuggestedChapters, setAiSuggestedChapters] = useState<
    Array<{ title: string; summary: string }>
  >([]);
  const [aiCopied, setAiCopied] = useState(false);
  const [applyingOutline, setApplyingOutline] = useState(false);

  // Export & PDF Studio
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [readingModeOpen, setReadingModeOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimer = useRef<number | null>(null);

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) || null,
    [books, selectedBookId]
  );

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) || null,
    [chapters, selectedChapterId]
  );

  // Subscribe to chapters when a book is opened
  useEffect(() => {
    if (!selectedBookId) {
      setChapters([]);
      setSelectedChapterId(null);
      return;
    }
    const unsub = subscribeBookChapters(selectedBookId, (list) => {
      setChapters(list);
      setSelectedChapterId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id || null;
      });
    });
    return () => unsub();
  }, [selectedBookId, subscribeBookChapters]);

  // Keep fresh draft ref for debounced auto-save
  const latestChapterDraftRef = useRef({
    bookId: '',
    chapterId: '',
    title: '',
    summary: '',
    notes: '',
    status: 'borrador' as BookChapterStatus,
  });

  useEffect(() => {
    latestChapterDraftRef.current = {
      bookId: selectedBook?.id || '',
      chapterId: selectedChapter?.id || '',
      title: chapTitle,
      summary: chapSummary,
      notes: chapNotes,
      status: chapStatus,
    };
  }, [selectedBook?.id, selectedChapter?.id, chapTitle, chapSummary, chapNotes, chapStatus]);

  // Load selected chapter into editor when switching chapter
  useEffect(() => {
    if (!selectedChapter) {
      setChapTitle('');
      setChapSummary('');
      setChapNotes('');
      setChapStatus('borrador');
      setChapWordCount(0);
      setPreviewHtml('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setSaveState('sin_cambios');
      return;
    }
    setChapTitle(selectedChapter.title);
    setChapSummary(selectedChapter.summary || '');
    setChapNotes(selectedChapter.notes || '');
    setChapStatus(selectedChapter.status || 'borrador');
    const html = selectedChapter.contentHtml || '';
    if (editorRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
    setPreviewHtml(sanitizeHtmlForPrint(html));
    const wc =
      selectedChapter.wordCount || countWordsFromText(selectedChapter.contentText || '');
    setChapWordCount(wc);
    setSaveState('sin_cambios');
    setEditorError('');
  }, [selectedChapter?.id]);

  // Compute live total words for active book
  const liveBookTotalWords = useMemo(() => {
    return chapters.reduce((sum, ch) => {
      if (ch.id === selectedChapter?.id) {
        return sum + chapWordCount;
      }
      return sum + (ch.wordCount || 0);
    }, 0);
  }, [chapters, selectedChapter?.id, chapWordCount]);

  // Trigger debounced auto-save for chapter + sync book counters
  const triggerChapterAutoSave = useCallback(
    (override?: {
      title?: string;
      summary?: string;
      notes?: string;
      status?: BookChapterStatus;
    }) => {
      const bookId = selectedBook?.id;
      const chapterId = selectedChapter?.id;
      if (!bookId || !chapterId) return;

      const html = editorRef.current?.innerHTML || '';
      const text = editorRef.current?.innerText || '';
      const wordCount = countWordsFromText(text);
      setChapWordCount(wordCount);
      setPreviewHtml(sanitizeHtmlForPrint(html));
      setSaveState('guardando');

      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }

      autoSaveTimer.current = window.setTimeout(() => {
        const snap = latestChapterDraftRef.current;
        if (snap.bookId !== bookId || snap.chapterId !== chapterId) return;

        const currentHtml = editorRef.current?.innerHTML || '';
        const currentText = editorRef.current?.innerText || '';
        const currentWc = countWordsFromText(currentText);

        void updateBookChapter(bookId, chapterId, {
          title: override?.title ?? snap.title,
          summary: override?.summary ?? snap.summary,
          notes: override?.notes ?? snap.notes,
          status: override?.status ?? snap.status,
          contentHtml: currentHtml,
          contentText: currentText,
          wordCount: currentWc,
        })
          .then(() => {
            setSaveState('guardado');
            const totalWords = chapters.reduce(
              (acc, ch) => acc + (ch.id === chapterId ? currentWc : ch.wordCount || 0),
              0
            );
            void syncBookMetrics(bookId, chapters.length, totalWords);
          })
          .catch(() => {
            setEditorError('No se pudo sincronizar el capítulo. Verificá tu conexión.');
            setSaveState('sin_cambios');
          });
      }, 750);
    },
    [selectedBook?.id, selectedChapter?.id, chapters, updateBookChapter, syncBookMetrics]
  );

  // Filtered books on shelf
  const filteredBooks = useMemo(() => {
    const q = shelfSearch.trim().toLowerCase();
    return books.filter((b) => {
      if (shelfStatusFilter !== 'all' && b.status !== shelfStatusFilter) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.subtitle.toLowerCase().includes(q) ||
        b.authorName.toLowerCase().includes(q) ||
        b.synopsis.toLowerCase().includes(q)
      );
    });
  }, [books, shelfSearch, shelfStatusFilter]);

  const openCreateBookModal = () => {
    setEditingBook(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormAuthorName(profile?.displayName || '');
    setFormGenre('academico');
    setFormSubjectId('');
    setFormLanguage('Español');
    setFormTargetWords(20000);
    setFormCoverColor('#0284C7');
    setFormStatus('borrador');
    setFormSynopsis('');
    setFormDedication('');
    setFormBibliography('');
    setBookModalOpen(true);
  };

  const openEditBookModal = (book: Book) => {
    setEditingBook(book);
    setFormTitle(book.title);
    setFormSubtitle(book.subtitle || '');
    setFormAuthorName(book.authorName || profile?.displayName || '');
    setFormGenre(book.genre);
    setFormSubjectId(book.subjectId || '');
    setFormLanguage(book.language || 'Español');
    setFormTargetWords(book.targetWords || 20000);
    setFormCoverColor(book.coverColor || '#0284C7');
    setFormStatus(book.status || 'borrador');
    setFormSynopsis(book.synopsis || '');
    setFormDedication(book.dedication || '');
    setFormBibliography(book.bibliography || '');
    setBookModalOpen(true);
  };

  const handleSaveBookModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || savingBookMeta) return;
    setSavingBookMeta(true);
    try {
      if (editingBook) {
        await updateBook(editingBook.id, {
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          authorName: formAuthorName.trim() || profile?.displayName || 'Autor',
          genre: formGenre,
          subjectId: formSubjectId,
          language: formLanguage.trim() || 'Español',
          targetWords: Number(formTargetWords) || 20000,
          coverColor: formCoverColor,
          status: formStatus,
          synopsis: formSynopsis.trim(),
          dedication: formDedication.trim(),
          bibliography: formBibliography.trim(),
        });
      } else {
        const newBookId = await createBook({
          subjectId: formSubjectId,
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          authorName: formAuthorName.trim() || profile?.displayName || 'Autor',
          genre: formGenre,
          language: formLanguage.trim() || 'Español',
          synopsis: formSynopsis.trim(),
          targetWords: Number(formTargetWords) || 20000,
          coverColor: formCoverColor,
          dedication: formDedication.trim(),
          bibliography: formBibliography.trim(),
          status: formStatus,
        });
        const firstChapId = await createBookChapter(newBookId, {
          orderIndex: 0,
          title: 'Capítulo 1',
          summary: '',
          notes: '',
          contentHtml: '<p></p>',
          contentText: '',
          wordCount: 0,
          status: 'borrador',
        });
        await syncBookMetrics(newBookId, 1, 0);
        setSelectedBookId(newBookId);
        setSelectedChapterId(firstChapId);
        setMobilePanel('editor');
      }
      setBookModalOpen(false);
    } finally {
      setSavingBookMeta(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    await deleteBook(bookId);
    setConfirmDeleteBookId(null);
    if (selectedBookId === bookId) {
      setSelectedBookId(null);
    }
  };

  const handleCreateChapter = async () => {
    if (!selectedBook) return;
    setEditorError('');
    try {
      const nextIndex = chapters.length;
      const newChapId = await createBookChapter(selectedBook.id, {
        orderIndex: nextIndex,
        title: `Capítulo ${nextIndex + 1}`,
        summary: '',
        notes: '',
        contentHtml: '<p></p>',
        contentText: '',
        wordCount: 0,
        status: 'borrador',
      });
      await syncBookMetrics(selectedBook.id, chapters.length + 1, liveBookTotalWords);
      setSelectedChapterId(newChapId);
      setMobilePanel('editor');
    } catch {
      setEditorError('No se pudo crear el capítulo.');
    }
  };

  const handleMoveChapter = async (chapId: string, dir: -1 | 1) => {
    if (!selectedBook) return;
    const idx = chapters.findIndex((c) => c.id === chapId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= chapters.length) return;
    const reordered = [...chapters];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(target, 0, moved);
    await reorderBookChapters(
      selectedBook.id,
      reordered.map((c) => c.id)
    );
  };

  const handleDeleteChapter = async (chapId: string) => {
    if (!selectedBook) return;
    const remaining = chapters.filter((c) => c.id !== chapId);
    await deleteBookChapter(selectedBook.id, chapId);
    setConfirmDeleteChapId(null);
    const totalWords = remaining.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);
    await syncBookMetrics(selectedBook.id, remaining.length, totalWords);
    if (selectedChapterId === chapId) {
      setSelectedChapterId(remaining[0]?.id || null);
    }
  };

  // Rich formatting actions
  const execFormat = (command: string, value?: string) => {
    if (readingPreviewMode) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    triggerChapterAutoSave();
  };

  const handleInsertTable = () => {
    const tableHtml =
      '<table><thead><tr><th>Elemento</th><th>Descripción</th></tr></thead><tbody><tr><td>Dato 1</td><td>Detalle</td></tr></tbody></table><p></p>';
    execFormat('insertHTML', tableHtml);
  };

  const handleInsertSceneBreak = () => {
    execFormat('insertHTML', '<hr /><p></p>');
  };

  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditorError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      const safeAlt = file.name.replace(/["<>]/g, '');

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
          setEditorError('La imagen es demasiado grande para incrustar en el capítulo.');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let compressed = canvas.toDataURL('image/jpeg', 0.78);
        if (compressed.length > 220000) {
          compressed = canvas.toDataURL('image/jpeg', 0.55);
        }
        if (compressed.length > 250000) {
          setEditorError('La imagen supera el tamaño máximo permitido por capítulo.');
          return;
        }
        execFormat('insertHTML', `<img src="${compressed}" alt="${safeAlt}" /><p></p>`);
      };
      img.onerror = () => setEditorError('No se pudo procesar la imagen.');
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Co-Author AI Assistant calls
  const runBookAssist = async (
    action: 'outline' | 'continue' | 'rewrite' | 'expand' | 'review' | 'custom'
  ) => {
    if (!selectedBook) return;
    if (action === 'custom' && !aiCustomPrompt.trim()) {
      setAiError('Escribí una indicación para el Coautor AI.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    setAiSuggestedChapters([]);
    try {
      const currentText =
        editorRef.current?.innerText || selectedChapter?.contentText || '';
      const res = await authFetch('/api/ai/book-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          bookTitle: selectedBook.title,
          bookSubtitle: selectedBook.subtitle,
          genre: getGenreLabel(selectedBook.genre),
          synopsis: selectedBook.synopsis,
          chapterTitle: chapTitle || selectedChapter?.title || '',
          chapterSummary: chapSummary || selectedChapter?.summary || '',
          chapterText: currentText,
          existingChapters: chapters.map((c) => c.title),
          customPrompt: aiCustomPrompt.trim(),
          educationLevel: profile?.educationLevel || 'universitario',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo conectar con el Coautor AI.');
      }
      setAiResponseText(data.text || '');
      setAiSuggestedChapters(Array.isArray(data.suggestedChapters) ? data.suggestedChapters : []);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al consultar al Coautor AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleInsertAiTextIntoChapter = () => {
    if (!aiResponseText.trim() || !selectedChapter) return;
    const htmlChunk = markdownToHtml(aiResponseText.trim());
    if (readingPreviewMode) {
      setReadingPreviewMode(false);
    }
    if (editorRef.current) {
      const current = editorRef.current.innerHTML.trim();
      const base = current === '<p></p>' || current === '<br>' ? '' : current;
      editorRef.current.innerHTML = `${base}${base ? '<p></p>' : ''}${htmlChunk}<p></p>`;
      triggerChapterAutoSave();
    }
  };

  const handleApplySuggestedOutline = async () => {
    if (!selectedBook || aiSuggestedChapters.length === 0 || applyingOutline) return;
    setApplyingOutline(true);
    try {
      let nextOrder = chapters.length;
      let firstCreatedId: string | null = null;
      for (const item of aiSuggestedChapters) {
        const createdId = await createBookChapter(selectedBook.id, {
          orderIndex: nextOrder,
          title: item.title,
          summary: item.summary,
          notes: '',
          contentHtml: '<p></p>',
          contentText: '',
          wordCount: 0,
          status: 'idea',
        });
        if (!firstCreatedId) firstCreatedId = createdId;
        nextOrder += 1;
      }
      await syncBookMetrics(
        selectedBook.id,
        chapters.length + aiSuggestedChapters.length,
        liveBookTotalWords
      );
      if (firstCreatedId && !selectedChapterId) {
        setSelectedChapterId(firstCreatedId);
      }
      setAiSuggestedChapters([]);
    } finally {
      setApplyingOutline(false);
    }
  };

  const handleCopyAiResponse = async () => {
    if (!aiResponseText.trim()) return;
    try {
      await navigator.clipboard?.writeText(aiResponseText);
      setAiCopied(true);
      window.setTimeout(() => setAiCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  // Build live book compilation payload for PDF Studio & Word Export
  const bookCompilation: BookPdfCompilation | null = useMemo(() => {
    if (!selectedBook) return null;
    const liveHtml = editorRef.current?.innerHTML;
    const liveText = editorRef.current?.innerText;

    const preparedChapters = chapters.map((ch, idx) => {
      const isCurrent = ch.id === selectedChapter?.id;
      const html = isCurrent && liveHtml !== undefined ? liveHtml : ch.contentHtml || '';
      const text = isCurrent && liveText !== undefined ? liveText : ch.contentText || '';
      const titleText = isCurrent ? chapTitle || ch.title : ch.title;

      const introPrefix =
        idx === 0 && selectedBook.dedication.trim()
          ? `<blockquote><em>${selectedBook.dedication.trim()}</em></blockquote><hr />`
          : '';

      return {
        id: ch.id,
        title: `Capítulo ${idx + 1}. ${titleText}`,
        subjectName: selectedBook.title,
        unit: CHAPTER_STATUS_LABELS[isCurrent ? chapStatus : ch.status],
        folder: getGenreLabel(selectedBook.genre),
        contentHtml: `${introPrefix}${html}`,
        contentText: text,
      };
    });

    const linkedSubject = subjects.find((s) => s.id === selectedBook.subjectId);

    return {
      title: selectedBook.title,
      subtitle: selectedBook.subtitle,
      authorName: selectedBook.authorName || profile?.displayName || 'Autor',
      genreLabel: `${getGenreLabel(selectedBook.genre)}${
        linkedSubject ? ` · ${linkedSubject.name}` : ''
      }`,
      institution: linkedSubject?.institution || profile?.institution || '',
      accentColor: selectedBook.coverColor || '#0284C7',
      bibliography: selectedBook.bibliography || linkedSubject?.bibliography || '',
      chapters: preparedChapters,
    };
  }, [
    selectedBook,
    chapters,
    selectedChapter?.id,
    chapTitle,
    chapStatus,
    subjects,
    profile?.displayName,
    profile?.institution,
  ]);

  const handleExportBookWord = async () => {
    if (!selectedBook || exportingWord) return;
    setExportingWord(true);
    try {
      const liveHtml = editorRef.current?.innerHTML;
      const liveText = editorRef.current?.innerText;
      await exportBookToWord({
        title: selectedBook.title,
        subtitle: selectedBook.subtitle,
        authorName: selectedBook.authorName || profile?.displayName || 'Autor',
        genreLabel: getGenreLabel(selectedBook.genre),
        dedication: selectedBook.dedication,
        synopsis: selectedBook.synopsis,
        bibliography: selectedBook.bibliography,
        chapters: chapters.map((ch) => {
          const isCurrent = ch.id === selectedChapter?.id;
          return {
            title: isCurrent ? chapTitle || ch.title : ch.title,
            contentHtml: isCurrent && liveHtml !== undefined ? liveHtml : ch.contentHtml || '',
            contentText: isCurrent && liveText !== undefined ? liveText : ch.contentText || '',
          };
        }),
      });
    } finally {
      setExportingWord(false);
    }
  };

  // ==================================================================
  // RENDER: 1. Shelf Overview (When no book is selected)
  // ==================================================================
  if (!selectedBook) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
              Taller de escritura de libros
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Escribí libros académicos, tesis, ensayos o ficción organizados por capítulos con metas de palabras, asistente Coautor AI y exportación a PDF editorial o Word.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateBookModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo libro
          </button>
        </section>

        {/* Search & Status Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={shelfSearch}
              onChange={(e) => setShelfSearch(e.target.value)}
              placeholder="Buscar libros por título, autor o sinopsis..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'borrador', label: 'Borradores' },
                { id: 'en_revision', label: 'En revisión' },
                { id: 'finalizado', label: 'Finalizados' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setShelfStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  shelfStatusFilter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shelf Grid or Empty State */}
        {filteredBooks.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-10 text-center space-y-4">
            <Feather className="w-10 h-10 text-sky-600 dark:text-sky-400 mx-auto" />
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {books.length === 0 ? 'Comenzá tu primer libro' : 'No hay libros que coincidan'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {books.length === 0
                  ? 'Creá un proyecto editorial, organizá sus capítulos y exportá el manuscrito completo cuando quieras.'
                  : 'Probá limpiando el filtro o buscando con otro término.'}
              </p>
            </div>
            {books.length === 0 && (
              <button
                type="button"
                onClick={openCreateBookModal}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Crear primer libro
              </button>
            )}
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredBooks.map((book) => {
              const target = Math.max(100, book.targetWords || 20000);
              const pct = Math.min(100, Math.round(((book.totalWords || 0) / target) * 100));
              const isConfirmingDelete = confirmDeleteBookId === book.id;

              return (
                <article
                  key={book.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Tactile Editorial Cover Thumbnail */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBookId(book.id);
                        setMobilePanel('chapters');
                      }}
                      className="w-20 h-28 rounded-r-lg rounded-l-sm shrink-0 p-2.5 flex flex-col justify-between text-left text-white shadow-md transition-transform hover:-translate-y-0.5 cursor-pointer relative overflow-hidden"
                      style={{ backgroundColor: book.coverColor || '#0284C7' }}
                      aria-label={`Abrir libro ${book.title}`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-2 bg-black/25"
                        aria-hidden="true"
                      />
                      <span className="pl-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/80 truncate">
                        {getGenreLabel(book.genre).split(' ')[0]}
                      </span>
                      <span className="pl-1.5 font-display text-[11px] font-bold leading-tight line-clamp-3">
                        {book.title}
                      </span>
                      <span className="pl-1.5 text-[9px] text-white/75 truncate">
                        {book.authorName || 'Autor'}
                      </span>
                    </button>

                    {/* Book Metadata */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {book.title}
                      </h3>
                      {book.subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {book.subtitle}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <span>{BOOK_STATUS_LABELS[book.status]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{book.chaptersCount || 0} cap.</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {(book.totalWords || 0).toLocaleString('es-AR')} pal.
                        </span>
                      </div>
                    </div>
                  </div>

                  {book.synopsis && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {book.synopsis}
                    </p>
                  )}

                  {/* Word Goal Progress */}
                  <div className="space-y-1.5 mt-auto">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        Meta: {(book.totalWords || 0).toLocaleString('es-AR')} /{' '}
                        {target.toLocaleString('es-AR')} palabras
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: book.coverColor || '#0284C7',
                        }}
                      />
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBookId(book.id);
                        setMobilePanel('chapters');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 whitespace-nowrap cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Escribir libro
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditBookModal(book)}
                        aria-label={`Editar ficha de ${book.title}`}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <BookMarked className="w-4 h-4" />
                      </button>

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDeleteBook(book.id)}
                            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBookId(null)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteBookId(book.id)}
                          aria-label={`Eliminar libro ${book.title}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Create / Edit Book Modal */}
        {bookModalOpen && (
          <BookMetadataModal
            editingBook={editingBook}
            subjects={subjects}
            title={formTitle}
            setTitle={setFormTitle}
            subtitle={formSubtitle}
            setSubtitle={setFormSubtitle}
            authorName={formAuthorName}
            setAuthorName={setFormAuthorName}
            genre={formGenre}
            setGenre={setFormGenre}
            subjectId={formSubjectId}
            setSubjectId={setFormSubjectId}
            language={formLanguage}
            setLanguage={setFormLanguage}
            targetWords={formTargetWords}
            setTargetWords={setFormTargetWords}
            coverColor={formCoverColor}
            setCoverColor={setFormCoverColor}
            status={formStatus}
            setStatus={setFormStatus}
            synopsis={formSynopsis}
            setSynopsis={setFormSynopsis}
            dedication={formDedication}
            setDedication={setFormDedication}
            bibliography={formBibliography}
            setBibliography={setFormBibliography}
            saving={savingBookMeta}
            onClose={() => setBookModalOpen(false)}
            onSubmit={handleSaveBookModal}
          />
        )}
      </div>
    );
  }

  // ==================================================================
  // RENDER: 2. Active Book Studio (Chapters + Manuscript + Co-Author AI)
  // ==================================================================
  const readingMinutes = Math.max(1, Math.round(chapWordCount / 220));
  const bookGoal = Math.max(100, selectedBook.targetWords || 20000);
  const bookProgressPct = Math.min(100, Math.round((liveBookTotalWords / bookGoal) * 100));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[calc(100dvh-9.5rem)]">
        {/* Left: Chapter Index & Book Summary (Hidden in Focus Mode) */}
        {!focusMode && (
          <aside
            className={`lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden ${
              mobilePanel === 'chapters' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Book Header Summary */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBookId(null);
                    setAiDrawerOpen(false);
                    setFocusMode(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Mis libros
                </button>
                <button
                  type="button"
                  onClick={() => openEditBookModal(selectedBook)}
                  className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Ficha del libro
                </button>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-14 rounded-r-md rounded-l-xs shrink-0 relative shadow-sm"
                  style={{ backgroundColor: selectedBook.coverColor || '#0284C7' }}
                >
                  <span className="absolute inset-y-0 left-0 w-1.5 bg-black/25" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                    {selectedBook.title}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {selectedBook.authorName || 'Autor'} · {getGenreLabel(selectedBook.genre)}
                  </p>
                </div>
              </div>

              {/* Overall Word Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>
                    {liveBookTotalWords.toLocaleString('es-AR')} /{' '}
                    {bookGoal.toLocaleString('es-AR')} pal.
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {bookProgressPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${bookProgressPct}%`,
                      backgroundColor: selectedBook.coverColor || '#0284C7',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Chapters List Header */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                Capítulos ({chapters.length})
              </span>
              <button
                type="button"
                onClick={() => void handleCreateChapter()}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Capítulo
              </button>
            </div>

            {/* Chapters List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 max-h-[60dvh] lg:max-h-none">
              {chapters.length === 0 ? (
                <div className="p-6 text-center space-y-3 text-xs text-slate-500 dark:text-slate-400">
                  <p>Todavía no hay capítulos en este libro.</p>
                  <button
                    type="button"
                    onClick={() => void handleCreateChapter()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Capítulo 1
                  </button>
                </div>
              ) : (
                chapters.map((ch, idx) => {
                  const active = ch.id === selectedChapterId;
                  const liveWc = active ? chapWordCount : ch.wordCount || 0;
                  const isConfirming = confirmDeleteChapId === ch.id;

                  return (
                    <div
                      key={ch.id}
                      className={`p-3 transition-colors ${
                        active
                          ? 'bg-sky-600/10 dark:bg-sky-500/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChapterId(ch.id);
                            setMobilePanel('editor');
                          }}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            <span className="font-mono text-slate-400 mr-1.5 tabular-nums">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            {ch.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {CHAPTER_STATUS_LABELS[active ? chapStatus : ch.status]} ·{' '}
                            {liveWc.toLocaleString('es-AR')} pal.
                          </p>
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => void handleMoveChapter(ch.id, -1)}
                            aria-label="Subir capítulo"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === chapters.length - 1}
                            onClick={() => void handleMoveChapter(ch.id, 1)}
                            aria-label="Bajar capítulo"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          {chapters.length > 1 && (
                            isConfirming ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteChapter(ch.id)}
                                className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white cursor-pointer"
                              >
                                Borrar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteChapId(ch.id)}
                                aria-label="Eliminar capítulo"
                                className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Book Export Footer inside Left Sidebar */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/70 dark:bg-slate-900/40">
              <button
                type="button"
                disabled={chapters.length === 0}
                onClick={() => setPdfStudioOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                <FileStack className="w-3.5 h-3.5" />
                Exportar libro PDF
              </button>
              <button
                type="button"
                disabled={chapters.length === 0 || exportingWord}
                onClick={() => void handleExportBookWord()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {exportingWord ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Descargar Word (.docx)
              </button>
            </div>
          </aside>
        )}

        {/* Center: Chapter Manuscript Editor */}
        <section
          className={`${
            focusMode
              ? 'lg:col-span-12'
              : aiDrawerOpen
              ? 'lg:col-span-6'
              : 'lg:col-span-9'
          } rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden ${
            mobilePanel === 'editor' || focusMode ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!selectedChapter ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-400" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Seleccioná o creá un capítulo
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md">
                Podés redactar tu libro por capítulos, usar el Coautor AI para armar un índice o continuar escenas, y compilar el libro completo a PDF o Word.
              </p>
              <button
                type="button"
                onClick={() => void handleCreateChapter()}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Crear primer capítulo
              </button>
            </div>
          ) : (
            <>
              {/* Editor Top Control Bar */}
              <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusMode(false);
                        setMobilePanel('chapters');
                      }}
                      className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Capítulos
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {saveState === 'guardando' ? 'Guardando...' : 'Sincronizado'}
                    </span>
                    <span className="text-xs text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                      {chapWordCount.toLocaleString('es-AR')} pal. · ~{readingMinutes} min lectura
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={chapStatus}
                      onChange={(e) => {
                        const next = e.target.value as BookChapterStatus;
                        setChapStatus(next);
                        triggerChapterAutoSave({ status: next });
                      }}
                      aria-label="Estado del capítulo"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium"
                    >
                      <option value="idea">Estado: Idea</option>
                      <option value="borrador">Estado: Borrador</option>
                      <option value="revisado">Estado: Revisado</option>
                      <option value="completo">Estado: Completo</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowChapterGuide((v) => !v)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                        showChapterGuide
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Guía</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReadingPreviewMode((v) => !v)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                        readingPreviewMode
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {readingPreviewMode ? (
                        <Edit3 className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {readingPreviewMode ? 'Editar' : 'Lectura'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReadingModeOpen(true)}
                      title="Abrir capítulo en Modo de Lectura IA con temas e imágenes enciclopédicas"
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Lectura IA</span>
                    </button>

                    <AudioReadAloudControl
                      getText={() =>
                        `${chapTitle ? `${chapTitle}. ` : ''}${editorRef.current?.innerText || selectedChapter.contentText || ''}`
                      }
                      title={`${selectedBook?.title || 'libro'}_${chapTitle || 'capitulo'}`}
                    />

                    <a
                      href={
                        buildWhatsAppShareHref(
                          formatForWhatsApp({
                            title: `${selectedBook?.title || 'Libro'} · ${chapTitle || 'Capítulo'}`,
                            subtitle: selectedBook?.authorName || undefined,
                            body: editorRef.current?.innerHTML || selectedChapter.contentHtml || selectedChapter.contentText || '',
                            isHtml: true,
                          })
                        ).href
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Compartir capítulo por WhatsApp"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setFocusMode((v) => !v);
                        if (!focusMode) setAiDrawerOpen(false);
                      }}
                      title={focusMode ? 'Salir de modo enfoque' : 'Modo escritura sin distracciones'}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {focusMode ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden md:inline">
                        {focusMode ? 'Normal' : 'Enfoque'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFocusMode(false);
                        setAiDrawerOpen((v) => !v);
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                        aiDrawerOpen
                          ? 'bg-sky-600 text-white'
                          : 'border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Coautor AI
                    </button>

                    <button
                      type="button"
                      onClick={() => setPdfStudioOpen(true)}
                      className="lg:hidden inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      <FileStack className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>

                {editorError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    {editorError}
                  </div>
                )}

                <input
                  type="text"
                  maxLength={200}
                  value={chapTitle}
                  onChange={(e) => {
                    setChapTitle(e.target.value);
                    triggerChapterAutoSave({ title: e.target.value });
                  }}
                  placeholder="Título del capítulo"
                  className="w-full bg-transparent font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Optional Collapsible Chapter Summary & Scratchpad Notes */}
              {showChapterGuide && (
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Sinopsis u objetivo del capítulo
                    </label>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={chapSummary}
                      onChange={(e) => {
                        setChapSummary(e.target.value);
                        triggerChapterAutoSave({ summary: e.target.value });
                      }}
                      placeholder="¿Qué ocurre o se demuestra en este capítulo?"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Notas del autor (personajes, citas, ideas sueltas)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={5000}
                      value={chapNotes}
                      onChange={(e) => {
                        setChapNotes(e.target.value);
                        triggerChapterAutoSave({ notes: e.target.value });
                      }}
                      placeholder="Recordatorios internos que no salen en el libro exportado..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Literary Formatting Toolbar */}
              {!readingPreviewMode && (
                <div className="px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center gap-1 overflow-x-auto">
                  <button type="button" onClick={() => execFormat('formatBlock', '<h1>')} title="Sección principal" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Heading1 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => execFormat('formatBlock', '<h2>')} title="Subsección" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Heading2 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => execFormat('formatBlock', '<blockquote>')} title="Cita literaria o epígrafe" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Quote className="w-4 h-4" /></button>
                  <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
                  <button type="button" onClick={() => execFormat('bold')} title="Negrita" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Bold className="w-4 h-4" /></button>
                  <button type="button" onClick={() => execFormat('italic')} title="Cursiva" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Italic className="w-4 h-4" /></button>
                  <button type="button" onClick={() => execFormat('underline')} title="Subrayado" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Underline className="w-4 h-4" /></button>
                  <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
                  <button type="button" onClick={() => execFormat('insertUnorderedList')} title="Lista con viñetas" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><List className="w-4 h-4" /></button>
                  <button type="button" onClick={() => execFormat('insertOrderedList')} title="Lista numerada" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><ListOrdered className="w-4 h-4" /></button>
                  <button type="button" onClick={handleInsertTable} title="Insertar tabla" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><TableIcon className="w-4 h-4" /></button>
                  <button type="button" onClick={handleInsertSceneBreak} title="Separador de escena" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><Minus className="w-4 h-4" /></button>
                  <button type="button" onClick={() => imageInputRef.current?.click()} title="Insertar ilustración o imagen" className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"><ImageIcon className="w-4 h-4" /></button>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleInsertImage} />
                </div>
              )}

              {/* Manuscript Sheet (Editable or Editorial Reading Preview) */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 bg-slate-50/50 dark:bg-[#0B101B]">
                <div className="max-w-[74ch] mx-auto w-full rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0F1623] px-5 sm:px-10 py-8 min-h-[460px]">
                  {readingPreviewMode ? (
                    <article className="space-y-4">
                      <header className="pb-4 border-b border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {selectedBook.title} · Capítulo{' '}
                          {chapters.findIndex((c) => c.id === selectedChapter.id) + 1}
                        </p>
                        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                          {chapTitle || 'Capítulo sin título'}
                        </h2>
                      </header>
                      <div
                        className="fabro-editor text-base leading-[1.8] text-slate-800 dark:text-slate-100"
                        dangerouslySetInnerHTML={{
                          __html:
                            previewHtml ||
                            '<p class="text-slate-400">Este capítulo aún no tiene contenido redactado.</p>',
                        }}
                      />
                    </article>
                  ) : (
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Escribí aquí tu capítulo..."
                      onInput={() => triggerChapterAutoSave()}
                      className="fabro-editor min-h-[400px] text-base leading-[1.8] text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right: Coautor AI Drawer (When toggled open) */}
        {aiDrawerOpen && !focusMode && (
          <aside className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                  Coautor AI
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAiDrawerOpen(false)}
                aria-label="Cerrar Coautor AI"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 space-y-3 border-b border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Asistencia editorial contextual para <strong>{selectedBook.title}</strong>.
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'outline' as const, label: 'Índice de capítulos' },
                  { id: 'continue' as const, label: 'Continuar texto' },
                  { id: 'rewrite' as const, label: 'Pulir estilo' },
                  { id: 'expand' as const, label: 'Ampliar escena' },
                  { id: 'review' as const, label: 'Revisión crítica' },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    disabled={aiLoading}
                    onClick={() => void runBookAssist(act.id)}
                    className={`rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/60 hover:bg-sky-500/5 text-left cursor-pointer disabled:opacity-50 ${
                      act.id === 'outline' ? 'col-span-2' : ''
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <textarea
                  rows={2}
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  placeholder="Pedile algo puntual al Coautor (ej: redactá el prólogo o un diálogo)..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={aiLoading || !aiCustomPrompt.trim()}
                  onClick={() => void runBookAssist('custom')}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                >
                  {aiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {aiLoading ? 'Redactando...' : 'Consultar al Coautor'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 max-h-[55dvh] lg:max-h-none">
              {aiError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300">
                  {aiError}
                </div>
              )}

              {!aiLoading && !aiResponseText && aiSuggestedChapters.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Elegí una acción rápida o escribí una instrucción para recibir propuestas editoriales listas para insertar en tu libro.
                </p>
              )}

              {aiSuggestedChapters.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Capítulos propuestos ({aiSuggestedChapters.length})
                    </span>
                    <button
                      type="button"
                      disabled={applyingOutline}
                      onClick={() => void handleApplySuggestedOutline()}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    >
                      {applyingOutline ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Agregar al libro
                    </button>
                  </div>
                  <div className="space-y-2">
                    {aiSuggestedChapters.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-2.5 space-y-1"
                      >
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {idx + 1}. {item.title}
                        </p>
                        {item.summary && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {item.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiResponseText && (
                <div className="space-y-2.5">
                  <div className="fabro-markdown text-xs leading-relaxed text-slate-800 dark:text-slate-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponseText}</ReactMarkdown>
                  </div>

                  {aiSuggestedChapters.length === 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {selectedChapter && (
                        <button
                          type="button"
                          onClick={handleInsertAiTextIntoChapter}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          Insertar en capítulo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyAiResponse()}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        {aiCopied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {aiCopied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Edit Book Metadata Modal */}
      {bookModalOpen && (
        <BookMetadataModal
          editingBook={editingBook}
          subjects={subjects}
          title={formTitle}
          setTitle={setFormTitle}
          subtitle={formSubtitle}
          setSubtitle={setFormSubtitle}
          authorName={formAuthorName}
          setAuthorName={setFormAuthorName}
          genre={formGenre}
          setGenre={setFormGenre}
          subjectId={formSubjectId}
          setSubjectId={setFormSubjectId}
          language={formLanguage}
          setLanguage={setFormLanguage}
          targetWords={formTargetWords}
          setTargetWords={setFormTargetWords}
          coverColor={formCoverColor}
          setCoverColor={setFormCoverColor}
          status={formStatus}
          setStatus={setFormStatus}
          synopsis={formSynopsis}
          setSynopsis={setFormSynopsis}
          dedication={formDedication}
          setDedication={setFormDedication}
          bibliography={formBibliography}
          setBibliography={setFormBibliography}
          saving={savingBookMeta}
          onClose={() => setBookModalOpen(false)}
          onSubmit={handleSaveBookModal}
        />
      )}

      {/* Full Book PDF Publishing Studio */}
      <NotesPdfStudioModal
        open={pdfStudioOpen}
        onClose={() => setPdfStudioOpen(false)}
        currentLiveNote={null}
        currentNoteId={null}
        currentSubjectId={selectedBook.subjectId || ''}
        notes={notes}
        subjects={subjects}
        profile={profile}
        bookCompilation={bookCompilation}
      />

      {selectedChapter && (
        <AIReadingModeModal
          isOpen={readingModeOpen}
          onClose={() => setReadingModeOpen(false)}
          title={`${selectedBook.title} — ${chapTitle || 'Capítulo'}`}
          contentText={editorRef.current?.innerText || selectedChapter.contentText || ''}
          contentHtml={editorRef.current?.innerHTML || selectedChapter.contentHtml || ''}
          onInsertWikiImageToNote={(figureHtml) => {
            if (!editorRef.current) return;
            editorRef.current.innerHTML = `${editorRef.current.innerHTML}<p></p>${figureHtml}<p></p>`;
            triggerChapterAutoSave();
          }}
        />
      )}
    </div>
  );
};

interface BookMetadataModalProps {
  editingBook: Book | null;
  subjects: Array<{ id: string; name: string }>;
  title: string;
  setTitle: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  authorName: string;
  setAuthorName: (v: string) => void;
  genre: BookGenre;
  setGenre: (v: BookGenre) => void;
  subjectId: string;
  setSubjectId: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  targetWords: number;
  setTargetWords: (v: number) => void;
  coverColor: string;
  setCoverColor: (v: string) => void;
  status: BookStatus;
  setStatus: (v: BookStatus) => void;
  synopsis: string;
  setSynopsis: (v: string) => void;
  dedication: string;
  setDedication: (v: string) => void;
  bibliography: string;
  setBibliography: (v: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const BookMetadataModal: React.FC<BookMetadataModalProps> = ({
  editingBook,
  subjects,
  title,
  setTitle,
  subtitle,
  setSubtitle,
  authorName,
  setAuthorName,
  genre,
  setGenre,
  subjectId,
  setSubjectId,
  language,
  setLanguage,
  targetWords,
  setTargetWords,
  coverColor,
  setCoverColor,
  status,
  setStatus,
  synopsis,
  setSynopsis,
  dedication,
  setDedication,
  bibliography,
  setBibliography,
  saving,
  onClose,
  onSubmit,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingBook ? 'Editar ficha del libro' : 'Nuevo libro'}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl max-h-[92dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {editingBook ? 'Ficha editorial del libro' : 'Crear nuevo libro'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título del libro *
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Fundamentos de Derecho Constitucional o Crónicas del Sur"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subtítulo
              </label>
              <input
                type="text"
                maxLength={300}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Bajada o subtítulo editorial (opcional)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Autor / Autora
              </label>
              <input
                type="text"
                maxLength={120}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Nombre del autor"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Género
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as BookGenre)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm"
              >
                {BOOK_GENRE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Materia vinculada (opcional)
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm"
              >
                <option value="">Obra independiente (sin materia)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Meta de palabras
              </label>
              <input
                type="number"
                min={100}
                max={500000}
                step={500}
                value={targetWords}
                onChange={(e) => setTargetWords(Number(e.target.value) || 20000)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estado del proyecto
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm"
              >
                <option value="borrador">Borrador</option>
                <option value="en_revision">En revisión</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Idioma
              </label>
              <input
                type="text"
                maxLength={40}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Color de portada
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {BOOK_COVER_COLORS.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => setCoverColor(swatch.hex)}
                  title={swatch.label}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                    coverColor === swatch.hex
                      ? 'border-slate-900 dark:border-white scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sinopsis o argumento
            </label>
            <textarea
              rows={3}
              maxLength={4000}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="De qué trata el libro, enfoque, tesis o trama..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dedicatoria o epígrafe (opcional)
              </label>
              <textarea
                rows={2}
                maxLength={1500}
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
                placeholder="A quienes acompañan este camino..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bibliografía y fuentes del libro (una por línea)
              </label>
              <textarea
                rows={2}
                maxLength={10000}
                value={bibliography}
                onChange={(e) => setBibliography(e.target.value)}
                placeholder="Autor (Año). Título de la obra..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/70 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editingBook ? 'Guardar cambios' : 'Crear libro'}
          </button>
        </div>
      </form>
    </div>
  );
};
