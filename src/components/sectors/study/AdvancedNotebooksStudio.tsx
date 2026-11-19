import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eraser,
  FileDown,
  FolderPlus,
  GitBranch,
  Heading1,
  Heading2,
  Highlighter,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Mic,
  Plus,
  Printer,
  Quote,
  Search,
  Sparkles,
  Square,
  Star,
  Tag,
  Trash2,
  Underline,
  Volume2,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { exportNoteToPdf } from '../../../lib/exporters';
import { DEFAULT_NOTEBOOK_FOLDERS, DEFAULT_SUBJECTS_CATALOG } from '../../../services/localVault';
import { activateMediaSession, stopMediaSession } from '../../../services/mediaSessionBridge';
import type { NoteAudioClip } from '../../../types/ecosystem';
import { ShareResourceButton } from '../../common/ShareResourceButton';

const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Amarillo', hex: '#FEF08A', dotClass: 'bg-[#FEF08A]' },
  { id: 'green', label: 'Verde', hex: '#BBF7D0', dotClass: 'bg-[#BBF7D0]' },
  { id: 'cyan', label: 'Celeste', hex: '#BAE6FD', dotClass: 'bg-[#BAE6FD]' },
  { id: 'pink', label: 'Rosa', hex: '#FBCFE8', dotClass: 'bg-[#FBCFE8]' },
] as const;

function stripHtmlTags(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Imagen vacía.'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxWidth = 900;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function synthesizeNoteLocally(html: string, fallbackText: string, title: string): {
  mainIdea: string;
  summaryText: string;
} {
  if (typeof DOMParser === 'undefined') {
    return {
      mainIdea: title || 'Idea principal del apunte',
      summaryText: fallbackText.slice(0, 320),
    };
  }
  const doc = new DOMParser().parseFromString(html || `<p>${fallbackText}</p>`, 'text/html');
  const marks = Array.from(doc.querySelectorAll('mark'))
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);
  const headings = Array.from(doc.querySelectorAll('h1, h2'))
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);
  const quotes = Array.from(doc.querySelectorAll('blockquote'))
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);
  const paragraphs = Array.from(doc.querySelectorAll('p, li'))
    .map((el) => (el.textContent || '').trim())
    .filter((t) => t.length > 18);

  const mainIdea =
    marks[0] ||
    quotes[0] ||
    paragraphs[0] ||
    headings[0] ||
    title ||
    'Sintetizá en una oración la idea central de este tema.';

  const lines: string[] = [];
  if (headings.length > 0) {
    lines.push(`• Ejes del tema: ${headings.slice(0, 4).join(' · ')}`);
  }
  if (marks.length > 0) {
    lines.push(`• Puntos resaltados: ${marks.slice(0, 4).join(' / ')}`);
  }
  if (quotes.length > 0) {
    lines.push(`• Cita clave: ${quotes[0]}`);
  }
  if (paragraphs.length > 1 && lines.length < 3) {
    paragraphs.slice(0, 3).forEach((p) => {
      const compact = p.length > 130 ? `${p.slice(0, 127)}...` : p;
      lines.push(`• ${compact}`);
    });
  }

  return {
    mainIdea,
    summaryText:
      lines.join('\n') ||
      '• Completá el cuerpo del apunte con títulos, listas o texto resaltado para sintetizar automáticamente.',
  };
}

export const AdvancedNotebooksStudio: React.FC = () => {
  const {
    profile,
    advancedNotes,
    glossaryTerms,
    notesSaveState,
    lastNotesSavedAt,
    createAdvancedNote,
    updateAdvancedNote,
    deleteAdvancedNote,
    addGlossaryTerm,
    deleteGlossaryTerm,
  } = useEcosystem();

  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    () => advancedNotes[0]?.id || ''
  );
  const [filterSubject, setFilterSubject] = useState<string>('Todas');
  const [filterFolder, setFilterFolder] = useState<string>('Todas');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customFolders, setCustomFolders] = useState<string[]>(DEFAULT_NOTEBOOK_FOLDERS);
  const [newFolderDraft, setNewFolderDraft] = useState<string>('');
  const [showNewFolderInput, setShowNewFolderInput] = useState<boolean>(false);

  const [tagDraft, setTagDraft] = useState<string>('');
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Synthesis block toggle
  const [summaryExpanded, setSummaryExpanded] = useState<boolean>(true);

  // Diagram / Schema inline inserter
  const [showSchemaModal, setShowSchemaModal] = useState<boolean>(false);
  const [schemaRoot, setSchemaRoot] = useState<string>('Concepto Central');
  const [schemaBranchA, setSchemaBranchA] = useState<string>('Causa / Origen');
  const [schemaBranchB, setSchemaBranchB] = useState<string>('Idea Clave');
  const [schemaBranchC, setSchemaBranchC] = useState<string>('Ejemplo Práctico');

  // Lateral Dictionary / Glossary state
  const [glossaryOpen, setGlossaryOpen] = useState<boolean>(true);
  const [glossaryShowAllSubjects, setGlossaryShowAllSubjects] = useState<boolean>(false);
  const [glossarySearch, setGlossarySearch] = useState<string>('');
  const [newTerm, setNewTerm] = useState<string>('');
  const [newDef, setNewDef] = useState<string>('');

  // Embedded Audio Recorder per note
  const [recording, setRecording] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [audioTitleDraft, setAudioTitleDraft] = useState<string>('');
  const [audioError, setAudioError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef<number>(0);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedNoteIdRef = useRef<string>('');
  const [readingNoteSpeech, setReadingNoteSpeech] = useState<boolean>(false);
  const speechActiveRef = useRef<boolean>(false);

  // Compute subject and folder lists dynamically
  const allSubjects = useMemo(() => {
    const set = new Set<string>(DEFAULT_SUBJECTS_CATALOG);
    advancedNotes.forEach((n) => {
      if (n.subject.trim()) set.add(n.subject.trim());
    });
    return Array.from(set);
  }, [advancedNotes]);

  const allFolders = useMemo(() => {
    const set = new Set<string>(customFolders);
    advancedNotes.forEach((n) => {
      if (n.folder.trim()) set.add(n.folder.trim());
    });
    return Array.from(set);
  }, [advancedNotes, customFolders]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return advancedNotes.filter((n) => {
      if (filterSubject !== 'Todas' && n.subject !== filterSubject) return false;
      if (filterFolder !== 'Todas' && n.folder !== filterFolder) return false;
      if (onlyFavorites && !n.favorite) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.subject.toLowerCase().includes(q) ||
        n.folder.toLowerCase().includes(q) ||
        n.mainIdea.toLowerCase().includes(q) ||
        n.contentText.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [advancedNotes, filterFolder, filterSubject, onlyFavorites, searchQuery]);

  // Keep selectedNoteId valid
  useEffect(() => {
    if (advancedNotes.length === 0) {
      setSelectedNoteId('');
      return;
    }
    if (!advancedNotes.some((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(advancedNotes[0].id);
    }
  }, [advancedNotes, selectedNoteId]);

  const activeNote = useMemo(
    () => advancedNotes.find((n) => n.id === selectedNoteId) || null,
    [advancedNotes, selectedNoteId]
  );

  // Sync contentEditable DOM ONLY when switching notes so cursor never jumps
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !activeNote) return;
    if (hydratedNoteIdRef.current !== activeNote.id) {
      el.innerHTML = activeNote.contentHtml || '<p></p>';
      hydratedNoteIdRef.current = activeNote.id;
    }
  }, [activeNote]);

  // Recording timer
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  // Cleanup active mic stream and Web Speech on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (speechActiveRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        stopMediaSession('speech');
      }
    };
  }, []);

  const syncEditorToVault = () => {
    if (!activeNote || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const text = stripHtmlTags(html);
    updateAdvancedNote(activeNote.id, {
      contentHtml: html,
      contentText: text,
    });
  };

  const applyFormatCommand = (command: string, value?: string) => {
    if (!editorRef.current || !activeNote) return;
    editorRef.current.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      // ignore unsupported browser command
    }
    syncEditorToVault();
  };

  const applyHighlight = (hexColor: string | null) => {
    if (!editorRef.current || !activeNote) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    if (hexColor === null) {
      try {
        document.execCommand('removeFormat', false);
      } catch {
        // ignore
      }
      syncEditorToVault();
      return;
    }

    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      const selectedText = range.toString();
      const safeHtml = `<mark style="background-color: ${hexColor}; color: #0F172A; padding: 0 3px; border-radius: 4px;">${escapeHtml(
        selectedText
      )}</mark>&nbsp;`;
      try {
        document.execCommand('insertHTML', false, safeHtml);
      } catch {
        // fallback
      }
    } else {
      try {
        document.execCommand('hiliteColor', false, hexColor);
      } catch {
        // ignore
      }
    }
    syncEditorToVault();
  };

  const insertRichBlockHtml = (blockHtml: string) => {
    if (!editorRef.current || !activeNote) return;
    editorRef.current.focus();
    try {
      document.execCommand('insertHTML', false, blockHtml);
    } catch {
      editorRef.current.innerHTML += blockHtml;
    }
    syncEditorToVault();
  };

  const handleInsertQuoteBlock = () => {
    const sel = window.getSelection();
    const text = sel && !sel.isCollapsed ? sel.toString() : 'Cita o definición destacada de la materia...';
    insertRichBlockHtml(
      `<blockquote>${escapeHtml(text)}</blockquote><p><br /></p>`
    );
  };

  const handleInsertSummaryBlock = () => {
    insertRichBlockHtml(
      `<div data-fabro-summary="true" style="border-left: 4px solid #2563EB; background: rgba(37,99,235,0.09); padding: 10px 12px; border-radius: 10px; margin: 10px 0;"><strong>Bloque de resumen:</strong> Escribí acá la síntesis clave para repasar en 30 segundos.</div><p><br /></p>`
    );
  };

  const handleInsertImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeNote) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      insertRichBlockHtml(
        `<figure style="margin: 10px 0;"><img src="${dataUrl}" alt="${escapeHtml(
          file.name
        )}" style="max-width: 100%; border-radius: 12px; border: 2px solid rgba(37,99,235,0.25);" /></figure><p><br /></p>`
      );
      setActionNotice('Imagen insertada y guardada en el apunte.');
    } catch {
      setActionNotice('No se pudo cargar la imagen seleccionada.');
    }
  };

  const handleInsertSchemaDiagram = () => {
    const root = escapeHtml(schemaRoot.trim() || 'Idea Central');
    const bA = escapeHtml(schemaBranchA.trim() || 'Subtema 1');
    const bB = escapeHtml(schemaBranchB.trim() || 'Subtema 2');
    const bC = escapeHtml(schemaBranchC.trim() || 'Subtema 3');
    const html = `
      <div data-fabro-schema="true" style="border: 2px solid #06B6D4; border-radius: 14px; padding: 12px; margin: 12px 0; background: rgba(6,182,212,0.08);">
        <p style="margin: 0 0 8px 0; font-weight: 800; color: #0284C7;">Esquema visual: ${root}</p>
        <ul style="margin: 0; padding-left: 18px;">
          <li><strong>Rama 1:</strong> ${bA}</li>
          <li><strong>Rama 2:</strong> ${bB}</li>
          <li><strong>Rama 3:</strong> ${bC}</li>
        </ul>
      </div>
      <p><br /></p>
    `;
    insertRichBlockHtml(html);
    setShowSchemaModal(false);
    setActionNotice('Esquema visual insertado en el apunte.');
  };

  const handleCreateNote = () => {
    const subjectSeed = filterSubject !== 'Todas' ? filterSubject : allSubjects[0];
    const folderSeed = filterFolder !== 'Todas' ? filterFolder : 'General';
    const created = createAdvancedNote({
      title: `Apunte de ${subjectSeed}`,
      subject: subjectSeed,
      folder: folderSeed,
    });
    hydratedNoteIdRef.current = '';
    setSelectedNoteId(created.id);
    setConfirmDeleteNoteId(null);
    setActionNotice('Nuevo apunte creado y guardado localmente.');
  };

  const handleAddFolder = () => {
    const clean = newFolderDraft.trim();
    if (!clean) return;
    if (!customFolders.includes(clean)) {
      setCustomFolders((prev) => [...prev, clean]);
    }
    if (activeNote) {
      updateAdvancedNote(activeNote.id, { folder: clean });
    }
    setFilterFolder(clean);
    setNewFolderDraft('');
    setShowNewFolderInput(false);
  };

  const handleAddTag = () => {
    if (!activeNote) return;
    const clean = tagDraft.trim().replace(/^#/, '').toLowerCase();
    if (!clean) return;
    if (!activeNote.tags.includes(clean)) {
      updateAdvancedNote(activeNote.id, { tags: [...activeNote.tags, clean] });
    }
    setTagDraft('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeNote) return;
    updateAdvancedNote(activeNote.id, {
      tags: activeNote.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleAutoSynthesize = () => {
    if (!activeNote) return;
    const currentHtml = editorRef.current?.innerHTML || activeNote.contentHtml;
    const result = synthesizeNoteLocally(
      currentHtml,
      activeNote.contentText,
      activeNote.title
    );
    updateAdvancedNote(activeNote.id, {
      mainIdea: result.mainIdea,
      summaryText: result.summaryText,
    });
    setSummaryExpanded(true);
    setActionNotice('Resumen e Idea Principal generados localmente desde tus títulos y resaltados.');
  };

  // Embedded voice note recorder for the active note
  const startNoteRecording = async () => {
    if (!activeNote) return;
    setAudioError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setAudioError('Este navegador no soporta grabación de audio local.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          if (!dataUrl) return;
          const clip: NoteAudioClip = {
            id: `clip-${Date.now()}`,
            label:
              audioTitleDraft.trim() ||
              `Audio de clase #${activeNote.audioClips.length + 1}`,
            durationSec: Math.max(1, elapsedRef.current),
            audioDataUrl: dataUrl,
            createdAt: new Date().toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          updateAdvancedNote(activeNote.id, {
            audioClips: [clip, ...activeNote.audioClips],
          });
          setAudioTitleDraft('');
          setActionNotice('Nota de voz adjuntada y guardada dentro del apunte.');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      elapsedRef.current = 0;
      setElapsedSec(0);
      recorder.start();
      setRecording(true);
    } catch {
      setAudioError('No se pudo acceder al micrófono. Verificá permisos del dispositivo.');
    }
  };

  const stopNoteRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleDeleteAudioClip = (clipId: string) => {
    if (!activeNote) return;
    updateAdvancedNote(activeNote.id, {
      audioClips: activeNote.audioClips.filter((c) => c.id !== clipId),
    });
  };

  const stopNoteSpeech = () => {
    speechActiveRef.current = false;
    setReadingNoteSpeech(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopMediaSession('speech');
  };

  const toggleReadActiveNote = () => {
    if (!activeNote) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setActionNotice('Este navegador no soporta lectura sintética por voz.');
      return;
    }
    if (readingNoteSpeech) {
      stopNoteSpeech();
      return;
    }

    const fullText = `${activeNote.title}. ${activeNote.mainIdea ? `${activeNote.mainIdea}. ` : ''}${
      stripHtmlTags(editorRef.current?.innerHTML || activeNote.contentHtml) || activeNote.contentText
    }`.trim();

    if (!fullText) return;

    const chunks = fullText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    window.speechSynthesis.cancel();
    speechActiveRef.current = true;
    setReadingNoteSpeech(true);

    let index = 0;
    const speakNext = () => {
      if (!speechActiveRef.current || index >= chunks.length) {
        stopNoteSpeech();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[index]);
      u.lang = 'es-ES';
      u.onend = () => {
        index += 1;
        speakNext();
      };
      u.onerror = () => {
        stopNoteSpeech();
      };
      window.speechSynthesis.speak(u);
    };

    activateMediaSession({
      title: activeNote.title,
      artist: `${activeNote.subject} · Lectura de Apunte`,
      album: '🍀 FABRO · Cuadernos Digitales',
      mode: 'speech',
      playbackState: 'playing',
      handlers: {
        onPause: () => stopNoteSpeech(),
        onStop: () => stopNoteSpeech(),
        onNext: () => {
          window.speechSynthesis.cancel();
          index += 1;
          speakNext();
        },
      },
    });
    speakNext();
  };

  const subjectGlossary = useMemo(() => {
    const q = glossarySearch.trim().toLowerCase();
    return glossaryTerms.filter((item) => {
      if (
        !glossaryShowAllSubjects &&
        activeNote &&
        item.subject !== activeNote.subject &&
        item.subject !== 'General'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.term.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q)
      );
    });
  }, [activeNote, glossarySearch, glossaryShowAllSubjects, glossaryTerms]);

  const handleExportPdf = async () => {
    if (!activeNote) return;
    setExportingPdf(true);
    setActionNotice(null);
    try {
      const currentHtml = editorRef.current?.innerHTML || activeNote.contentHtml;
      const summaryHtmlParts: string[] = [];
      if (activeNote.mainIdea.trim()) {
        summaryHtmlParts.push(
          `<blockquote><strong>Idea Principal:</strong> ${escapeHtml(
            activeNote.mainIdea
          )}</blockquote>`
        );
      }
      if (activeNote.summaryText.trim()) {
        summaryHtmlParts.push(
          `<h2>Resumen rápido pre-examen</h2><p>${escapeHtml(activeNote.summaryText).replace(
            /\n/g,
            '<br />'
          )}</p>`
        );
      }
      const glossaryHtml =
        subjectGlossary.length > 0
          ? `<h2>Glosario de ${escapeHtml(activeNote.subject)}</h2><ul>${subjectGlossary
              .map(
                (g) =>
                  `<li><strong>${escapeHtml(g.term)}:</strong> ${escapeHtml(
                    g.definition
                  )}</li>`
              )
              .join('')}</ul>`
          : '';

      await exportNoteToPdf({
        title: activeNote.title,
        subjectName: activeNote.subject,
        folder: activeNote.folder,
        tags: activeNote.tags,
        contentHtml: `${summaryHtmlParts.join('')}${currentHtml}${glossaryHtml}`,
        contentText: activeNote.contentText,
        attachments: activeNote.audioClips.map((c) => ({ name: `${c.label} (${c.durationSec}s)` })),
      });
      setActionNotice('Archivo PDF generado y descargado correctamente.');
    } catch {
      setActionNotice('No se pudo generar el PDF automático; podés usar «Imprimir / PDF».');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Studio Header + Save State + Primary Exports */}
      <div className="rounded-2xl border-2 border-[#2563EB]/35 fabro-surface p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold">
              Cuadernos Digitales y Apuntes Avanzados
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                notesSaveState === 'guardando'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {notesSaveState === 'guardando'
                ? 'Guardando en IndexedDB...'
                : `Guardado · ${lastNotesSavedAt}`}
            </span>
          </div>
          <p className="text-xs fabro-muted">
            Organizá por materia y carpeta, resaltá en 4 colores, grabá audios de clase, exportá a PDF y compartí sin registro.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateNote}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_14px_rgba(37,99,235,0.28)] cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nuevo apunte
          </button>

          {activeNote && (
            <>
              <button
                type="button"
                disabled={exportingPdf}
                onClick={() => void handleExportPdf()}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#06B6D4] bg-[#06B6D4]/15 text-[#0369A1] dark:text-[#38BDF8] px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-60"
              >
                <FileDown className="w-4 h-4" />
                {exportingPdf ? 'Generando PDF...' : 'Exportar PDF'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>

              <button
                type="button"
                onClick={toggleReadActiveNote}
                className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 ${
                  readingNoteSpeech
                    ? 'border-[#10B981] bg-[#10B981] text-white'
                    : 'border-[#06B6D4]/50 bg-[#06B6D4]/10 text-[#0369A1] dark:text-[#38BDF8]'
                }`}
              >
                {readingNoteSpeech ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {readingNoteSpeech ? 'Detener lectura' : 'Leer apunte en voz'}
              </button>

              <button
                type="button"
                onClick={() => setGlossaryOpen((v) => !v)}
                className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 ${
                  glossaryOpen
                    ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#60A5FA]'
                    : 'fabro-border fabro-surface-elevated'
                }`}
              >
                <BookMarked className="w-4 h-4" />
                Glosario ({subjectGlossary.length})
              </button>
            </>
          )}
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            aria-label="Cerrar aviso"
            className="p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 3-Zone Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Subjects, Folders, Search, Favorites & Notes List */}
        <aside className="lg:col-span-4 xl:col-span-3 rounded-2xl border-2 fabro-border fabro-surface p-4 space-y-3.5">
          <div className="relative">
            <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar apuntes, #etiquetas o ideas..."
              aria-label="Buscador interno de apuntes"
              className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated pl-9 pr-3 py-2 text-xs fabro-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
            <label className="space-y-1 block">
              <span className="text-[11px] font-bold fabro-muted">Materia</span>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                aria-label="Filtrar por materia"
                className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 font-semibold fabro-input"
              >
                <option value="Todas">Todas las materias</option>
                {allSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold fabro-muted">Carpetas</span>
                <button
                  type="button"
                  onClick={() => setShowNewFolderInput((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  Nueva
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Todas', ...allFolders].map((folderName) => (
                  <button
                    key={folderName}
                    type="button"
                    onClick={() => setFilterFolder(folderName)}
                    className={`min-h-[36px] rounded-xl border-2 px-2.5 py-1 text-[11px] font-bold cursor-pointer active:scale-95 ${
                      filterFolder === folderName
                        ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#1D4ED8] dark:text-[#60A5FA]'
                        : 'fabro-border fabro-surface-elevated fabro-muted'
                    }`}
                  >
                    {folderName}
                  </button>
                ))}
              </div>
              {showNewFolderInput && (
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newFolderDraft}
                    onChange={(e) => setNewFolderDraft(e.target.value)}
                    placeholder="Nombre de carpeta..."
                    className="min-h-[40px] flex-1 rounded-xl border-2 fabro-border fabro-surface-elevated px-2.5 text-xs fabro-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddFolder}
                    className="min-h-[40px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-3 text-xs font-bold cursor-pointer"
                  >
                    Crear
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`w-full min-h-[44px] rounded-xl border-2 px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer active:scale-95 ${
              onlyFavorites
                ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Star className={`w-4 h-4 ${onlyFavorites ? 'fill-amber-500 text-amber-500' : ''}`} />
              Solo favoritos
            </span>
            <span className="font-mono text-[11px]">
              {advancedNotes.filter((n) => n.favorite).length}
            </span>
          </button>

          {/* Notes List */}
          <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
            {filteredNotes.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed fabro-border p-4 text-center text-xs fabro-muted space-y-2">
                <p>No hay apuntes que coincidan con este filtro.</p>
                <button
                  type="button"
                  onClick={handleCreateNote}
                  className="min-h-[44px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#60A5FA] px-3 py-1.5 text-xs font-bold cursor-pointer"
                >
                  + Crear primer apunte aquí
                </button>
              </div>
            ) : (
              filteredNotes.map((item) => {
                const isActive = item.id === activeNote?.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border-2 p-3 transition-all ${
                      isActive
                        ? 'border-[#2563EB] bg-[#2563EB]/10'
                        : 'fabro-border fabro-surface-elevated hover:border-[#06B6D4]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          hydratedNoteIdRef.current = '';
                          setSelectedNoteId(item.id);
                          setConfirmDeleteNoteId(null);
                        }}
                        className="flex-1 text-left min-w-0 cursor-pointer"
                      >
                        <p className="text-xs font-bold leading-snug line-clamp-2">
                          {item.title}
                        </p>
                        <p className="text-[11px] fabro-muted mt-1 truncate">
                          {item.subject} · {item.folder}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateAdvancedNote(item.id, { favorite: !item.favorite })
                        }
                        aria-label={
                          item.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'
                        }
                        className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            item.favorite
                              ? 'fill-amber-400 text-amber-500'
                              : 'fabro-muted'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2 text-[10px] fabro-muted font-mono">
                      <span>{item.updatedAt}</span>
                      <span className="flex items-center gap-2">
                        {item.audioClips.length > 0 && (
                          <span className="text-[#06B6D4] font-bold">
                            🎙 {item.audioClips.length}
                          </span>
                        )}
                        {item.tags.slice(0, 2).map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* CENTER COLUMN: Active Rich Notebook Editor + Synthesis + Audio + Share */}
        <div
          className={`space-y-4 ${
            glossaryOpen ? 'lg:col-span-8 xl:col-span-6' : 'lg:col-span-8 xl:col-span-9'
          }`}
        >
          {!activeNote ? (
            <div className="rounded-2xl border-2 fabro-border fabro-surface p-8 text-center space-y-3">
              <p className="font-display text-base font-bold">
                Elegí o creá un cuaderno digital para empezar
              </p>
              <p className="text-xs fabro-muted">
                Todos tus apuntes, resaltados, imágenes, glosario y audios se guardan automáticamente offline en tu dispositivo.
              </p>
              <button
                type="button"
                onClick={handleCreateNote}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-5 py-2.5 text-xs font-bold cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Crear nuevo apunte
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-[#2563EB]/30 fabro-surface p-4 sm:p-6 space-y-4">
              {/* Metadata Row: Title, Subject, Folder, Favorite, Delete */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) =>
                      updateAdvancedNote(activeNote.id, { title: e.target.value })
                    }
                    placeholder="Título del apunte..."
                    aria-label="Título del apunte"
                    className="flex-1 min-w-[200px] min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-sm font-bold fabro-input"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateAdvancedNote(activeNote.id, {
                        favorite: !activeNote.favorite,
                      })
                    }
                    className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-bold cursor-pointer active:scale-95 ${
                      activeNote.favorite
                        ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        activeNote.favorite ? 'fill-amber-400 text-amber-500' : ''
                      }`}
                    />
                    Favorito
                  </button>

                  {confirmDeleteNoteId === activeNote.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          deleteAdvancedNote(activeNote.id);
                          setConfirmDeleteNoteId(null);
                          setActionNotice('Apunte eliminado de este dispositivo.');
                        }}
                        className="min-h-[44px] rounded-xl border-2 border-red-600 bg-red-600 text-white px-3 py-2 text-xs font-bold cursor-pointer active:scale-95"
                      >
                        Confirmar borrado
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteNoteId(null)}
                        className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteNoteId(activeNote.id)}
                      aria-label="Eliminar este apunte"
                      className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated flex items-center justify-center text-rose-600 dark:text-rose-400 cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <label className="space-y-1 block">
                    <span className="text-[11px] fabro-muted font-semibold">Materia</span>
                    <input
                      type="text"
                      list="fabro-subjects-list"
                      value={activeNote.subject}
                      onChange={(e) =>
                        updateAdvancedNote(activeNote.id, { subject: e.target.value })
                      }
                      aria-label="Materia del apunte"
                      className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 font-semibold fabro-input"
                    />
                    <datalist id="fabro-subjects-list">
                      {allSubjects.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] fabro-muted font-semibold">Carpeta</span>
                    <select
                      value={activeNote.folder}
                      onChange={(e) =>
                        updateAdvancedNote(activeNote.id, { folder: e.target.value })
                      }
                      aria-label="Carpeta del apunte"
                      className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 font-semibold fabro-input"
                    >
                      {allFolders.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Tags Strip */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Tag className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                  {activeNote.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-mono font-semibold"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Quitar etiqueta ${tag}`}
                        className="hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="+ etiqueta"
                      className="min-h-[36px] w-28 rounded-lg border-2 fabro-border fabro-surface-elevated px-2 py-1 text-[11px] fabro-input"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="min-h-[36px] rounded-lg border-2 fabro-border fabro-surface-elevated px-2.5 text-[11px] font-bold cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>

              {/* Generador de Resumen / Idea Principal (Pre-Examen) */}
              <section className="rounded-2xl border-2 border-[#06B6D4]/40 bg-[#06B6D4]/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSummaryExpanded((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#0891B2] dark:text-[#38BDF8] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Idea Principal y Síntesis Pre-Examen
                    {summaryExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoSynthesize}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#06B6D4] bg-[#06B6D4] text-white px-3 py-1.5 text-[11px] font-bold cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generar síntesis desde el apunte
                  </button>
                </div>

                {summaryExpanded && (
                  <div className="space-y-2.5 text-xs">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-bold fabro-muted">
                        Idea principal en 1 oración
                      </span>
                      <input
                        type="text"
                        value={activeNote.mainIdea}
                        onChange={(e) =>
                          updateAdvancedNote(activeNote.id, { mainIdea: e.target.value })
                        }
                        placeholder="¿Cuál es la tesis o idea central que no podés olvidar?"
                        className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 font-semibold fabro-input"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-bold fabro-muted">
                        Bloque de resumen rápido (repaso antes de rendir)
                      </span>
                      <textarea
                        rows={3}
                        value={activeNote.summaryText}
                        onChange={(e) =>
                          updateAdvancedNote(activeNote.id, { summaryText: e.target.value })
                        }
                        placeholder="Puntos clave, fórmulas o pasos resumidos..."
                        className="w-full rounded-xl border-2 fabro-border fabro-surface p-2.5 leading-relaxed fabro-input"
                      />
                    </label>
                  </div>
                )}
              </section>

              {/* Full Rich Formatting Toolbar */}
              <div className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-2.5 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyFormatCommand('formatBlock', 'h1')}
                    title="Título principal"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 rounded-xl border-2 fabro-border fabro-surface px-2.5 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    <Heading1 className="w-4 h-4" />
                    <span className="hidden sm:inline">Título</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatCommand('formatBlock', 'h2')}
                    title="Subtítulo"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 rounded-xl border-2 fabro-border fabro-surface px-2.5 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    <Heading2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Subtítulo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyFormatCommand('bold')}
                    title="Negrita"
                    aria-label="Negrita"
                    className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatCommand('italic')}
                    title="Cursiva"
                    aria-label="Cursiva"
                    className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatCommand('underline')}
                    title="Subrayado"
                    aria-label="Subrayado"
                    className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <Underline className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => applyFormatCommand('insertUnorderedList')}
                    title="Lista con viñetas"
                    aria-label="Lista con viñetas"
                    className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatCommand('insertOrderedList')}
                    title="Lista numerada"
                    aria-label="Lista numerada"
                    className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertQuoteBlock}
                    className="min-h-[44px] inline-flex items-center gap-1 rounded-xl border-2 fabro-border fabro-surface px-2.5 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    <Quote className="w-4 h-4 text-[#2563EB]" />
                    Cita
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertSummaryBlock}
                    className="min-h-[44px] inline-flex items-center gap-1 rounded-xl border-2 fabro-border fabro-surface px-2.5 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-[#06B6D4]" />
                    Bloque resumen
                  </button>

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="min-h-[44px] inline-flex items-center gap-1 rounded-xl border-2 fabro-border fabro-surface px-2.5 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    Imagen
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleInsertImageFile(e)}
                  />

                  <button
                    type="button"
                    onClick={() => setShowSchemaModal((v) => !v)}
                    className="min-h-[44px] inline-flex items-center gap-1 rounded-xl border-2 fabro-border fabro-surface px-2.5 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    <GitBranch className="w-4 h-4 text-[#0284C7]" />
                    Esquema
                  </button>
                </div>

                {/* 4-Color Highlighter Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t fabro-border text-xs">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold fabro-muted">
                    <Highlighter className="w-3.5 h-3.5" />
                    Resaltador:
                  </span>
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => applyHighlight(color.hex)}
                      title={`Resaltar en ${color.label}`}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface px-2.5 py-1 text-[11px] font-bold cursor-pointer active:scale-95"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border border-slate-400/50 ${color.dotClass}`}
                      />
                      {color.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => applyHighlight(null)}
                    title="Quitar resaltado"
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border-2 fabro-border fabro-surface px-2.5 py-1 text-[11px] font-semibold cursor-pointer active:scale-95"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                </div>

                {/* Inline Schema / Visual Diagram Builder */}
                {showSchemaModal && (
                  <div className="rounded-xl border-2 border-[#06B6D4] fabro-surface p-3.5 space-y-2.5 text-xs">
                    <p className="font-bold text-[#0891B2] dark:text-[#38BDF8]">
                      Insertar esquema conceptual rápido en el apunte
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={schemaRoot}
                        onChange={(e) => setSchemaRoot(e.target.value)}
                        placeholder="Concepto central"
                        className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 fabro-input"
                      />
                      <input
                        type="text"
                        value={schemaBranchA}
                        onChange={(e) => setSchemaBranchA(e.target.value)}
                        placeholder="Rama 1"
                        className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 fabro-input"
                      />
                      <input
                        type="text"
                        value={schemaBranchB}
                        onChange={(e) => setSchemaBranchB(e.target.value)}
                        placeholder="Rama 2"
                        className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 fabro-input"
                      />
                      <input
                        type="text"
                        value={schemaBranchC}
                        onChange={(e) => setSchemaBranchC(e.target.value)}
                        placeholder="Rama 3"
                        className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 fabro-input"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleInsertSchemaDiagram}
                        className="min-h-[40px] rounded-xl border-2 border-[#06B6D4] bg-[#06B6D4] text-white px-4 py-1.5 font-bold cursor-pointer"
                      >
                        Insertar esquema en el apunte
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSchemaModal(false)}
                        className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 font-semibold cursor-pointer"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rich ContentEditable Canvas */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncEditorToVault}
                aria-label="Editor enriquecido del cuaderno digital"
                className="min-h-[260px] rounded-2xl border-2 fabro-border fabro-surface-elevated p-4 sm:p-5 text-sm leading-relaxed focus:outline-none focus:border-[#2563EB] [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-extrabold [&_h1]:mb-2 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#2563EB] [&_blockquote]:bg-[#2563EB]/10 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:rounded-r-xl [&_blockquote]:italic [&_blockquote]:my-2"
              />

              {/* Integrated Note Audio Recorder */}
              <div className="rounded-2xl border-2 border-[#06B6D4]/35 fabro-surface-elevated p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-[#06B6D4]" />
                    Grabadora de Audio adjunta en este apunte
                  </p>
                  <span className="font-mono text-[11px] fabro-muted">
                    {activeNote.audioClips.length} audios guardados
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 text-xs">
                  <input
                    type="text"
                    value={audioTitleDraft}
                    onChange={(e) => setAudioTitleDraft(e.target.value)}
                    placeholder="Etiqueta del audio (ej. Explicación profesor min 12)"
                    className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                  />
                  {!recording ? (
                    <button
                      type="button"
                      onClick={() => void startNoteRecording()}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 shrink-0"
                    >
                      <Mic className="w-4 h-4" />
                      Grabar nota de voz
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopNoteRecording}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-red-600 bg-red-600 text-white px-4 py-2 font-bold cursor-pointer active:scale-95 shrink-0"
                    >
                      <Square className="w-4 h-4" />
                      Detener ({elapsedSec}s)
                    </button>
                  )}
                </div>

                {audioError && (
                  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    {audioError}
                  </p>
                )}

                {activeNote.audioClips.length > 0 && (
                  <div className="space-y-2">
                    {activeNote.audioClips.map((clip) => (
                      <div
                        key={clip.id}
                        className="rounded-xl border fabro-border fabro-surface p-2.5 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold truncate">
                            {clip.label}{' '}
                            <span className="font-mono font-normal fabro-muted">
                              · {clip.durationSec}s · {clip.createdAt}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAudioClip(clip.id)}
                            aria-label={`Borrar ${clip.label}`}
                            className="p-1.5 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <audio
                          controls
                          src={clip.audioDataUrl}
                          className="w-full h-9"
                          onPlay={(e) => {
                            const audioEl = e.currentTarget;
                            activateMediaSession({
                              title: clip.label,
                              artist: `${activeNote.title} · ${activeNote.subject}`,
                              album: '🍀 FABRO · Audio de Apunte',
                              mode: 'audio',
                              playbackState: 'playing',
                              keepSilentAudioAlive: false,
                              handlers: {
                                onPlay: () => void audioEl.play(),
                                onPause: () => audioEl.pause(),
                                onStop: () => {
                                  audioEl.pause();
                                  audioEl.currentTime = 0;
                                  stopMediaSession('audio');
                                },
                              },
                            });
                          }}
                          onPause={() => stopMediaSession('audio')}
                          onEnded={() => stopMediaSession('audio')}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Share by WhatsApp / Direct Zero-Registration Link */}
              <div className="pt-1">
                <ShareResourceButton
                  label="Compartir este apunte por WhatsApp / Enlace sin registro"
                  payload={{
                    v: 1,
                    kind: 'note',
                    title: activeNote.title,
                    subject: activeNote.subject,
                    body: activeNote.contentText,
                    mainIdea: activeNote.mainIdea || undefined,
                    summaryText: activeNote.summaryText || undefined,
                    tags: activeNote.tags,
                    glossary: subjectGlossary.slice(0, 8).map((g) => ({
                      term: g.term,
                      definition: g.definition,
                    })),
                    author: profile.displayName,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Lateral Dictionary & Subject Glossary */}
        {glossaryOpen && (
          <aside className="lg:col-span-12 xl:col-span-3 rounded-2xl border-2 border-[#06B6D4]/35 fabro-surface p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold flex items-center gap-1.5">
                <BookMarked className="w-4 h-4 text-[#06B6D4]" />
                Diccionario y Glosario
              </h3>
              <button
                type="button"
                onClick={() => setGlossaryShowAllSubjects((v) => !v)}
                className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] cursor-pointer"
              >
                {glossaryShowAllSubjects ? 'Solo esta materia' : 'Ver todas'}
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                placeholder="Buscar término..."
                className="min-h-[40px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated pl-8 pr-3 py-1.5 text-xs fabro-input"
              />
            </div>

            {/* Add new definition */}
            <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 space-y-2 text-xs">
              <p className="font-bold text-[11px] fabro-muted">
                Guardar definición en «{activeNote?.subject || 'General'}»
              </p>
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="Término clave (ej. Habeas Corpus)"
                className="min-h-[40px] w-full rounded-xl border-2 fabro-border fabro-surface px-2.5 py-1.5 fabro-input"
              />
              <textarea
                rows={2}
                value={newDef}
                onChange={(e) => setNewDef(e.target.value)}
                placeholder="Definición breve para repasar..."
                className="w-full rounded-xl border-2 fabro-border fabro-surface p-2 fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newTerm.trim() || !newDef.trim()) return;
                  addGlossaryTerm(activeNote?.subject || 'General', newTerm, newDef);
                  setNewTerm('');
                  setNewDef('');
                  setActionNotice('Definición guardada en el glosario de la materia.');
                }}
                className="w-full min-h-[44px] rounded-xl border-2 border-[#06B6D4] bg-[#06B6D4] text-white px-3 py-2 font-bold cursor-pointer active:scale-95"
              >
                + Guardar definición
              </button>
            </div>

            {/* Glossary entries */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {subjectGlossary.length === 0 ? (
                <p className="text-xs fabro-muted text-center py-4">
                  Todavía no hay términos guardados para esta materia.
                </p>
              ) : (
                subjectGlossary.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{entry.term}</p>
                        <p className="text-[10px] fabro-muted">{entry.subject}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteGlossaryTerm(entry.id)}
                        aria-label={`Eliminar término ${entry.term}`}
                        className="p-1 text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="fabro-muted leading-relaxed">{entry.definition}</p>
                    {activeNote && (
                      <button
                        type="button"
                        onClick={() => {
                          insertRichBlockHtml(
                            `<p><strong>${escapeHtml(entry.term)}:</strong> ${escapeHtml(
                              entry.definition
                            )}</p>`
                          );
                          setActionNotice(`«${entry.term}» insertado en el apunte.`);
                        }}
                        className="min-h-[34px] rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] cursor-pointer"
                      >
                        + Insertar en apunte
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
