import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  BookOpen,
  Check,
  Copy,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  Highlighter,
  Italic,
  KeyRound,
  Layers,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Printer,
  Quote,
  Save,
  Sparkles,
  Square,
  Trash2,
  Underline,
  Volume2,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { sendByokChatCompletion } from '../../../services/byokChatClient';
import { DEFAULT_FLASHCARDS, vaultGet, vaultSet } from '../../../services/localVault';
import { activateMediaSession, stopMediaSession } from '../../../services/mediaSessionBridge';
import {
  buildFlashcardsFromStudyDocument,
  downloadStudyAsDoc,
  downloadStudyAsTxt,
  extractPlainTextFromHtml,
  markdownToWordHtml,
  printStudyDocumentAsPdf,
} from '../../../services/studyDocumentUtils';
import type { SrsFlashcard } from '../../../types/ecosystem';
import { ShareResourceButton } from '../../common/ShareResourceButton';

type StudyHelpMode =
  | 'explicacion'
  | 'resumen'
  | 'preguntas'
  | 'esquema'
  | 'simulacro';

const HELP_MODE_OPTIONS: Array<{ id: StudyHelpMode; label: string; instruction: string }> = [
  {
    id: 'explicacion',
    label: 'Explicación detallada',
    instruction:
      'Desarrollá una explicación clara, didáctica y bien estructurada con títulos (## y ###), ejemplos cotidianos y un bloque de idea clave (> cita) al cierre.',
  },
  {
    id: 'resumen',
    label: 'Resumen estructurado',
    instruction:
      'Redactá un resumen estructurado ideal para parcial: definición central, puntos clave en viñetas, conceptos clave en negrita y conclusión breve.',
  },
  {
    id: 'preguntas',
    label: 'Guía de preguntas y respuestas',
    instruction:
      'Creá una guía de 6 a 8 preguntas frecuentes de examen con respuestas claras, precisas y fáciles de repasar (formato ¿Pregunta? seguido de respuesta concreta).',
  },
  {
    id: 'esquema',
    label: 'Esquema conceptual',
    instruction:
      'Construí un esquema conceptual jerárquico con títulos, ramas en listas numeradas y relaciones causa-efecto fáciles de memorizar.',
  },
  {
    id: 'simulacro',
    label: 'Simulacro de examen',
    instruction:
      'Armá un simulacro de examen con 5 preguntas (opción múltiple y desarrollo breve) y al final una sección "## Clave de corrección" con explicaciones cortas.',
  },
];

const HIGHLIGHT_SWATCHES = [
  { id: 'yellow', label: 'Amarillo', bg: '#FEF08A', dot: '#EAB308' },
  { id: 'green', label: 'Verde', bg: '#BBF7D0', dot: '#22C55E' },
  { id: 'sky', label: 'Celeste', bg: '#BAE6FD', dot: '#0EA5E9' },
  { id: 'pink', label: 'Rosa', bg: '#FBCFE8', dot: '#EC4899' },
];

const SUBJECT_PRESETS = [
  'Estudio General',
  'Derecho Constitucional',
  'Metodología de la Investigación',
  'Historia',
  'Biología / Salud',
  'Matemática / Lógica',
  'Programación',
  'Filosofía',
];

const SPEECH_RATES = [1, 1.25, 1.5] as const;

export const WordStudyWorkspace: React.FC = () => {
  const {
    byokKeys,
    getByokSecret,
    navigateTo,
    advancedNotes,
    createAdvancedNote,
    updateAdvancedNote,
    deleteAdvancedNote,
    notesSaveState,
    lastNotesSavedAt,
    profile,
    authUser,
  } = useEcosystem();

  const configuredKeys = useMemo(
    () => byokKeys.filter((k) => Boolean(getByokSecret(k.id)?.trim())),
    [byokKeys, getByokSecret]
  );

  // Selected note & editable Word document state
  const [activeNoteId, setActiveNoteId] = useState<string>(() => advancedNotes[0]?.id || '');
  const [docTitle, setDocTitle] = useState<string>(
    () => advancedNotes[0]?.title || 'Hoja de Estudio'
  );
  const [docSubject, setDocSubject] = useState<string>(
    () => advancedNotes[0]?.subject || 'Estudio General'
  );
  const [docHtml, setDocHtml] = useState<string>(
    () =>
      advancedNotes[0]?.contentHtml ||
      '<p>Escribí directamente en esta hoja o pedile un tema a tu IA en la barra superior para empezar a estudiar sin distracciones.</p>'
  );

  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastLoadedIdRef = useRef<string>('');

  // Top AI Study Prompt Bar state
  const [studyPrompt, setStudyPrompt] = useState('');
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [helpMode, setHelpMode] = useState<StudyHelpMode>('explicacion');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Saved notes drawer & distraction-free reading
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [distractionFree, setDistractionFree] = useState(false);

  // Bottom tools feedback & TTS audio state
  const [copiedOk, setCopiedOk] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [flashcardsToast, setFlashcardsToast] = useState<string | null>(null);
  const [ttsState, setTtsState] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const [ttsRate, setTtsRate] = useState<(typeof SPEECH_RATES)[number]>(1);
  const [highlightPaletteOpen, setHighlightPaletteOpen] = useState(false);

  // Keep selected BYOK key synchronized
  useEffect(() => {
    if (configuredKeys.length > 0 && !configuredKeys.some((k) => k.id === selectedKeyId)) {
      setSelectedKeyId(configuredKeys[0].id);
    }
  }, [configuredKeys, selectedKeyId]);

  // Sync editor DOM when switching active note
  useEffect(() => {
    if (!editorRef.current) return;
    if (lastLoadedIdRef.current !== activeNoteId) {
      editorRef.current.innerHTML = docHtml;
      lastLoadedIdRef.current = activeNoteId;
    }
  }, [activeNoteId, docHtml]);

  // Initial mount populate
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = docHtml;
    }
  }, [docHtml]);

  // Stop speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopMediaSession('speech');
    };
  }, []);

  const plainText = useMemo(() => extractPlainTextFromHtml(docHtml), [docHtml]);
  const wordCount = useMemo(
    () => (plainText ? plainText.split(/\s+/).filter(Boolean).length : 0),
    [plainText]
  );

  const subjectOptions = useMemo(() => {
    const dynamic = advancedNotes.map((n) => n.subject).filter(Boolean);
    return Array.from(new Set([...SUBJECT_PRESETS, ...dynamic, docSubject].filter(Boolean)));
  }, [advancedNotes, docSubject]);

  const filteredSavedNotes = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
    if (!q) return advancedNotes;
    return advancedNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.subject.toLowerCase().includes(q) ||
        n.contentText.toLowerCase().includes(q)
    );
  }, [advancedNotes, drawerSearch]);

  const syncFromEditorDom = () => {
    if (!editorRef.current) return;
    setDocHtml(editorRef.current.innerHTML);
  };

  const applyFormatCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand(command, false, value);
      syncFromEditorDom();
    } catch {
      // Fallback safely if browser restricts execCommand
    }
  };

  const insertKeyIdeaBlock = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection()?.toString().trim();
    const snippet = `<blockquote style="border-left:4px solid #2563EB;background:rgba(37,99,235,0.09);padding:10px 14px;border-radius:0 10px 10px 0;margin:12px 0;"><strong>Idea clave:</strong> ${
      sel || 'Escribí acá el concepto central o cita importante para recordar...'
    }</blockquote><p><br/></p>`;
    try {
      document.execCommand('insertHTML', false, snippet);
      syncFromEditorDom();
    } catch {
      editorRef.current.innerHTML += snippet;
      syncFromEditorDom();
    }
  };

  const applyHighlightColor = (color: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand('hiliteColor', false, color);
      syncFromEditorDom();
    } catch {
      try {
        document.execCommand('backColor', false, color);
        syncFromEditorDom();
      } catch {
        // Ignore unsupported browser
      }
    }
    setHighlightPaletteOpen(false);
  };

  const handleBlankSheet = () => {
    const created = createAdvancedNote({
      title: 'Nuevo apunte sin título',
      subject: docSubject || 'Estudio General',
      folder: docSubject || 'Estudio General',
    });
    const blankHtml = '<p></p>';
    updateAdvancedNote(created.id, {
      contentHtml: blankHtml,
      contentText: '',
      mainIdea: '',
      summaryText: '',
    });
    setActiveNoteId(created.id);
    setDocTitle(created.title);
    setDocSubject(created.subject);
    setDocHtml(blankHtml);
    lastLoadedIdRef.current = created.id;
    if (editorRef.current) {
      editorRef.current.innerHTML = blankHtml;
      editorRef.current.focus();
    }
    setAiError(null);
  };

  const handleLoadNote = (noteId: string) => {
    const found = advancedNotes.find((n) => n.id === noteId);
    if (!found) return;
    setActiveNoteId(found.id);
    setDocTitle(found.title);
    setDocSubject(found.subject || 'Estudio General');
    const html = found.contentHtml || `<p>${found.contentText || ''}</p>`;
    setDocHtml(html);
    lastLoadedIdRef.current = found.id;
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
    }
    setDrawerOpen(false);
  };

  const handleSaveToNotebook = (silent = false) => {
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : docHtml;
    const currentText = extractPlainTextFromHtml(currentHtml);
    const cleanTitle = docTitle.trim() || 'Apunte de Estudio';
    const cleanSubject = docSubject.trim() || 'Estudio General';

    if (activeNoteId && advancedNotes.some((n) => n.id === activeNoteId)) {
      updateAdvancedNote(activeNoteId, {
        title: cleanTitle,
        subject: cleanSubject,
        folder: cleanSubject,
        contentHtml: currentHtml,
        contentText: currentText,
        summaryText: currentText.slice(0, 320),
      });
    } else {
      const created = createAdvancedNote({
        title: cleanTitle,
        subject: cleanSubject,
        folder: cleanSubject,
      });
      updateAdvancedNote(created.id, {
        title: cleanTitle,
        subject: cleanSubject,
        folder: cleanSubject,
        contentHtml: currentHtml,
        contentText: currentText,
        summaryText: currentText.slice(0, 320),
      });
      setActiveNoteId(created.id);
      lastLoadedIdRef.current = created.id;
    }

    if (!silent) {
      setSaveToast(
        authUser
          ? 'Guardado en Mi Cuaderno (IndexedDB + sincronizado con Firebase).'
          : 'Guardado en Mi Cuaderno local (IndexedDB).'
      );
      window.setTimeout(() => setSaveToast(null), 2800);
    }
  };

  const handleGenerateWithAI = async (mode: 'replace-or-fill' | 'append' = 'replace-or-fill') => {
    setAiError(null);
    const trimmedPrompt = studyPrompt.trim();
    if (!trimmedPrompt) {
      setAiError('Escribí arriba qué tema querés estudiar o qué necesitás preparar.');
      return;
    }

    const activeKey = configuredKeys.find((k) => k.id === selectedKeyId) || configuredKeys[0];
    if (!activeKey) {
      setAiError(
        'Todavía no conectaste ninguna clave API en BYOK. Configurala en Sector 4 o escribí manualmente en la hoja.'
      );
      return;
    }

    const rawSecret = getByokSecret(activeKey.id);
    const selectedHelp =
      HELP_MODE_OPTIONS.find((h) => h.id === helpMode) || HELP_MODE_OPTIONS[0];
    const currentPlain = extractPlainTextFromHtml(
      editorRef.current ? editorRef.current.innerHTML : docHtml
    );

    const promptText =
      mode === 'append' && currentPlain.length > 20
        ? `Materia: ${docSubject}\nDocumento actual del estudiante (resumen parcial):\n${currentPlain.slice(
            0,
            2400
          )}\n\nNueva solicitud para ampliar o profundizar dentro del mismo apunte:\n${trimmedPrompt}\n\nTipo de ayuda solicitada: ${
            selectedHelp.label
          }. ${selectedHelp.instruction}`
        : `Materia: ${docSubject}\nSolicitud del estudiante:\n${trimmedPrompt}\n\nTipo de ayuda solicitada: ${selectedHelp.label}. ${selectedHelp.instruction}`;

    setGenerating(true);
    try {
      const result = await sendByokChatCompletion({
        keyMeta: activeKey,
        rawApiKey: rawSecret,
        history: [],
        userText: promptText,
        systemInstructionOverride:
          'Sos un tutor académico y redactor de apuntes universitarios dentro de FABRO. Respondé siempre en español claro y ordenado usando Markdown limpio (#, ##, ###, **negritas**, listas y citas > para ideas clave). No agregues saludos innecesarios al inicio: entregá contenido listo para leer y editar en una hoja de estudio.',
      });

      if (!result.ok) {
        setAiError(result.error || 'No se pudo obtener respuesta de tu proveedor BYOK.');
        return;
      }

      const generatedHtml = markdownToWordHtml(result.content);
      const currentDomHtml = editorRef.current ? editorRef.current.innerHTML : docHtml;
      const isStarterText =
        currentPlain.length < 18 ||
        currentPlain.includes('Escribí directamente en esta hoja o pedile un tema a tu IA');

      const nextHtml =
        mode === 'append' && !isStarterText
          ? `${currentDomHtml}<hr style="margin:20px 0;border:none;border-top:1px dashed rgba(37,99,235,0.4);" />${generatedHtml}`
          : generatedHtml;

      setDocHtml(nextHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = nextHtml;
      }

      // Suggest title automatically if currently untitled or starter
      const nextTitle =
        !docTitle.trim() ||
        docTitle === 'Hoja de Estudio' ||
        docTitle === 'Nuevo apunte sin título'
          ? trimmedPrompt.slice(0, 68)
          : docTitle;
      setDocTitle(nextTitle);

      // Persist automatically to active note
      const cleanText = extractPlainTextFromHtml(nextHtml);
      if (activeNoteId && advancedNotes.some((n) => n.id === activeNoteId)) {
        updateAdvancedNote(activeNoteId, {
          title: nextTitle,
          subject: docSubject,
          folder: docSubject,
          contentHtml: nextHtml,
          contentText: cleanText,
          summaryText: cleanText.slice(0, 320),
        });
      } else {
        const created = createAdvancedNote({
          title: nextTitle,
          subject: docSubject,
          folder: docSubject,
        });
        updateAdvancedNote(created.id, {
          contentHtml: nextHtml,
          contentText: cleanText,
          summaryText: cleanText.slice(0, 320),
        });
        setActiveNoteId(created.id);
        lastLoadedIdRef.current = created.id;
      }

      setSaveToast(`Generado con ${activeKey.providerName} y listo para editar en tu hoja.`);
      window.setTimeout(() => setSaveToast(null), 3200);
    } finally {
      setGenerating(false);
    }
  };

  // --- Bottom Tools Handlers ---
  const handleCopyText = async () => {
    const textToCopy = `${docTitle}\nMateria: ${docSubject}\n\n${plainText}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedOk(true);
      window.setTimeout(() => setCopiedOk(false), 2000);
    } catch {
      setSaveToast('No se pudo copiar automáticamente; podés seleccionar el texto en la hoja.');
      window.setTimeout(() => setSaveToast(null), 2600);
    }
  };

  const startReadAloud = (rateOverride?: (typeof SPEECH_RATES)[number]) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSaveToast('Tu navegador no soporta lectura en voz alta nativa.');
      return;
    }
    const text = `${docTitle}. ${plainText}`.trim();
    if (!text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = rateOverride ?? ttsRate;
    utterance.onend = () => {
      setTtsState('idle');
      stopMediaSession('speech');
    };
    utterance.onerror = () => {
      setTtsState('idle');
      stopMediaSession('speech');
    };

    setTtsState('speaking');
    activateMediaSession({
      title: docTitle || 'Apunte de Estudio FABRO',
      artist: docSubject || 'Sector 1 · Estudio',
      album: '🍀 FABRO · Lectura en voz alta',
      mode: 'speech',
      playbackState: 'playing',
      handlers: {
        onPause: () => {
          window.speechSynthesis.pause();
          setTtsState('paused');
        },
        onPlay: () => {
          window.speechSynthesis.resume();
          setTtsState('speaking');
        },
        onStop: () => {
          window.speechSynthesis.cancel();
          setTtsState('idle');
          stopMediaSession('speech');
        },
      },
    });
    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePauseSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (ttsState === 'speaking') {
      window.speechSynthesis.pause();
      setTtsState('paused');
    } else if (ttsState === 'paused') {
      window.speechSynthesis.resume();
      setTtsState('speaking');
    } else {
      startReadAloud();
    }
  };

  const handleStopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setTtsState('idle');
    stopMediaSession('speech');
  };

  const handleChangeTtsRate = (nextRate: (typeof SPEECH_RATES)[number]) => {
    setTtsRate(nextRate);
    if (ttsState !== 'idle') {
      startReadAloud(nextRate);
    }
  };

  const handleConvertToFlashcards = async () => {
    const generated = buildFlashcardsFromStudyDocument(docTitle, docSubject, plainText);
    if (generated.length === 0) {
      setFlashcardsToast('Escribí o generá algo más de contenido antes de crear flashcards.');
      window.setTimeout(() => setFlashcardsToast(null), 2800);
      return;
    }
    const existing = await vaultGet<SrsFlashcard[]>('srs_flashcards', DEFAULT_FLASHCARDS);
    const merged = [...generated, ...existing];
    await vaultSet('srs_flashcards', merged);
    setFlashcardsToast(
      `Se crearon ${generated.length} Flashcards de "${docSubject}" listas para repasar.`
    );
    window.setTimeout(() => setFlashcardsToast(null), 5000);
  };

  return (
    <div className="space-y-4">
      {/* ============================================================
          NIVEL 1: BARRA SUPERIOR DE SOLICITUD DE ESTUDIO (COMPACTA)
         ============================================================ */}
      <section className="rounded-2xl border fabro-surface p-4 sm:p-5 space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB]/15 border border-[#2563EB]/40 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-bold truncate">
                Hoja de Estudio + Asistente IA (BYOK)
              </h2>
              <p className="text-[11px] fabro-muted truncate">
                Pedí un tema o escribí libremente: todo se edita directo en tu documento.
              </p>
            </div>
          </div>

          {/* Discreet Subject / Folder + Saved Notes Drawer Trigger */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1 text-xs">
              <FolderOpen className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
              <select
                value={docSubject}
                onChange={(e) => setDocSubject(e.target.value)}
                aria-label="Materia o carpeta"
                className="bg-transparent text-xs font-semibold outline-none cursor-pointer max-w-[165px]"
              >
                {subjectOptions.map((subj) => (
                  <option key={subj} value={subj} className="text-slate-900">
                    {subj}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated hover:border-[#2563EB] px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#06B6D4]" />
              Mis Apuntes ({advancedNotes.length})
            </button>
          </div>
        </div>

        {/* Main Prompt Input */}
        <div className="space-y-2.5">
          <textarea
            rows={2}
            value={studyPrompt}
            onChange={(e) => setStudyPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleGenerateWithAI('replace-or-fill');
              }
            }}
            placeholder='Ej: "Explicame las fuentes del derecho con ejemplos y armame un resumen para parcial"'
            aria-label="Qué tema querés estudiar o preparar"
            className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5 text-sm leading-relaxed fabro-input resize-y min-h-[60px]"
          />

          {/* Compact Controls Row: AI Selector + Help Type + Primary Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* BYOK AI Provider Selector */}
            <div className="inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 min-h-[40px] text-xs">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  configuredKeys.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {configuredKeys.length > 0 ? (
                <select
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  aria-label="Seleccionar IA BYOK configurada"
                  className="bg-transparent font-semibold outline-none cursor-pointer max-w-[175px]"
                >
                  {configuredKeys.map((k) => (
                    <option key={k.id} value={k.id} className="text-slate-900">
                      {k.providerName} · {k.modelName}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo('ia', 'claves-byok')}
                  className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Conectar clave BYOK
                </button>
              )}
            </div>

            {/* Help Type Selector */}
            <select
              value={helpMode}
              onChange={(e) => setHelpMode(e.target.value as StudyHelpMode)}
              aria-label="Tipo de ayuda académica"
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer"
            >
              {HELP_MODE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="text-slate-900">
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex-1" />

            {/* Action Buttons */}
            <button
              type="button"
              onClick={handleBlankSheet}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated hover:border-[#2563EB] px-3.5 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all whitespace-nowrap"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              Hoja en blanco
            </button>

            {plainText.length > 40 && configuredKeys.length > 0 && (
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGenerateWithAI('append')}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#06B6D4]/60 bg-[#06B6D4]/10 text-[#0E7490] dark:text-[#67E8F9] px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Ampliar en hoja
              </button>
            )}

            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateWithAI('replace-or-fill')}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[#2563EB] bg-gradient-to-r from-[#2563EB] to-[#0284C7] hover:brightness-110 text-white px-4 py-1.5 text-xs sm:text-sm font-bold shadow-[0_6px_18px_-6px_rgba(37,99,235,0.65)] cursor-pointer active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redactando en hoja...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generar con mi IA
                </>
              )}
            </button>
          </div>
        </div>

        {/* Friendly BYOK notice when no key is connected yet */}
        {configuredKeys.length === 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
              <strong>Modo BYOK activo (sin APIs de pago precargadas):</strong> podés escribir y
              formatear manualmente en la hoja ahora mismo, o conectar tu propia clave de Gemini,
              ChatGPT, Claude o DeepSeek para generar apuntes automáticos.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('ia', 'claves-byok')}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500 bg-amber-500 text-slate-950 px-3 py-1 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Ir a Configuración BYOK
            </button>
          </div>
        )}

        {aiError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {aiError}
          </div>
        )}
      </section>

      {/* ============================================================
          NIVEL 2: AMPLIA HOJA DE TEXTO ESTILO WORD (PROCESADOR LIMPIO)
         ============================================================ */}
      <section className="max-w-4xl mx-auto w-full rounded-2xl border fabro-surface shadow-[0_12px_36px_-18px_rgba(15,23,42,0.45)] overflow-hidden">
        {/* Word-style Formatting Toolbar */}
        <div className="border-b fabro-border fabro-surface-elevated px-3 sm:px-4 py-2 flex flex-wrap items-center gap-1">
          {/* Basic Text Styles */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatCommand('bold')}
            title="Negrita"
            aria-label="Negrita"
            className="min-h-[36px] min-w-[36px] rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] flex items-center justify-center cursor-pointer active:scale-95"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatCommand('italic')}
            title="Cursiva"
            aria-label="Cursiva"
            className="min-h-[36px] min-w-[36px] rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] flex items-center justify-center cursor-pointer active:scale-95"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatCommand('underline')}
            title="Subrayado"
            aria-label="Subrayado"
            className="min-h-[36px] min-w-[36px] rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] flex items-center justify-center cursor-pointer active:scale-95"
          >
            <Underline className="w-4 h-4" />
          </button>

          <span className="h-5 w-px bg-slate-400/30 mx-1" aria-hidden="true" />

          {/* Headings H1 H2 H3 */}
          {(['H1', 'H2', 'H3'] as const).map((hTag) => (
            <button
              key={hTag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormatCommand('formatBlock', hTag)}
              title={`Título ${hTag}`}
              className="min-h-[36px] px-2.5 rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] text-xs font-bold cursor-pointer active:scale-95"
            >
              {hTag}
            </button>
          ))}

          <span className="h-5 w-px bg-slate-400/30 mx-1" aria-hidden="true" />

          {/* Lists */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatCommand('insertUnorderedList')}
            title="Lista con viñetas"
            aria-label="Lista con viñetas"
            className="min-h-[36px] min-w-[36px] rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] flex items-center justify-center cursor-pointer active:scale-95"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormatCommand('insertOrderedList')}
            title="Lista numerada"
            aria-label="Lista numerada"
            className="min-h-[36px] min-w-[36px] rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] flex items-center justify-center cursor-pointer active:scale-95"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <span className="h-5 w-px bg-slate-400/30 mx-1" aria-hidden="true" />

          {/* 4-Color Highlighter */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setHighlightPaletteOpen((v) => !v)}
              title="Resaltador en colores"
              className="min-h-[36px] px-2.5 rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Resaltar</span>
            </button>

            {highlightPaletteOpen && (
              <div className="absolute left-0 top-10 z-30 rounded-xl border fabro-surface shadow-xl p-2 flex items-center gap-1.5">
                {HIGHLIGHT_SWATCHES.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlightColor(sw.bg)}
                    title={`Resaltar ${sw.label}`}
                    aria-label={`Resaltar ${sw.label}`}
                    className="w-7 h-7 rounded-lg border border-slate-400/50 cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: sw.bg }}
                  />
                ))}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHighlightColor('transparent')}
                  title="Quitar resaltado"
                  className="px-2 h-7 rounded-lg border fabro-border text-[11px] font-semibold cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            )}
          </div>

          {/* Key Idea / Callout Quote */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertKeyIdeaBlock}
            title="Insertar bloque de idea clave / cita"
            className="min-h-[36px] px-2.5 rounded-lg border fabro-border fabro-surface hover:border-[#2563EB] inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95"
          >
            <Quote className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span className="hidden sm:inline">Idea clave</span>
          </button>

          <div className="flex-1" />

          {/* Live word count + auto status */}
          <span className="text-[11px] fabro-muted font-mono tabular-nums px-1.5">
            {wordCount} pal. · {notesSaveState === 'guardando' ? 'Guardando...' : lastNotesSavedAt}
          </span>
        </div>

        {/* Clean Word Page Canvas */}
        <div className="px-5 py-6 sm:px-10 sm:py-9 space-y-4">
          <div className="border-b fabro-border pb-3 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
              {docSubject}
            </p>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Título de tu apunte o documento..."
              aria-label="Título del documento de estudio"
              className="w-full bg-transparent font-display text-xl sm:text-2xl font-extrabold tracking-tight outline-none"
            />
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncFromEditorDom}
            aria-label="Hoja editable de estudio estilo Word"
            className="min-h-[380px] sm:min-h-[480px] outline-none text-[15px] sm:text-base leading-[1.8] space-y-3 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#2563EB] dark:[&_h2]:text-[#60A5FA] [&_h2]:mt-5 [&_h2]:mb-1.5 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-[#2563EB] [&_blockquote]:bg-[#2563EB]/10 [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:rounded-r-xl"
          />
        </div>
      </section>

      {/* ============================================================
          NIVEL 3: PANEL INFERIOR ORDENADO DE HERRAMIENTAS DE ESTUDIO
         ============================================================ */}
      <section className="max-w-4xl mx-auto w-full rounded-2xl border fabro-surface p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Category 1: Lectura y Audio */}
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide fabro-muted">
              Lectura y Audio
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePauseSpeech}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
                  ttsState !== 'idle'
                    ? 'border-[#2563EB] bg-[#2563EB] text-white'
                    : 'fabro-border fabro-surface hover:border-[#2563EB]'
                }`}
              >
                {ttsState === 'speaking' ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pausar
                  </>
                ) : ttsState === 'paused' ? (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Reanudar
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                    Leer en voz alta
                  </>
                )}
              </button>

              {ttsState !== 'idle' && (
                <button
                  type="button"
                  onClick={handleStopSpeech}
                  aria-label="Detener lectura"
                  className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-300 px-2.5 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <Square className="w-3 h-3" />
                  Detener
                </button>
              )}

              <button
                type="button"
                onClick={() => setDistractionFree(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface hover:border-[#2563EB] px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Modo Lectura
              </button>
            </div>

            {/* Speed Controls */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="fabro-muted mr-1">Velocidad:</span>
              {SPEECH_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleChangeTtsRate(r)}
                  className={`px-2 py-0.5 rounded-lg border font-mono font-bold cursor-pointer ${
                    ttsRate === r
                      ? 'border-[#2563EB] bg-[#2563EB] text-white'
                      : 'fabro-border fabro-surface fabro-muted'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          {/* Category 2: Copiado y Exportación */}
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide fabro-muted">
              Copiado y Exportación
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleCopyText()}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
                  copiedOk
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'fabro-border fabro-surface hover:border-[#2563EB]'
                }`}
              >
                {copiedOk ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedOk ? 'Copiado' : 'Copiar texto'}
              </button>

              <button
                type="button"
                onClick={() =>
                  printStudyDocumentAsPdf(
                    docTitle,
                    docSubject,
                    editorRef.current ? editorRef.current.innerHTML : docHtml
                  )
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface hover:border-[#2563EB] px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
              >
                <Printer className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                PDF
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadStudyAsDoc(
                    docTitle,
                    docSubject,
                    editorRef.current ? editorRef.current.innerHTML : docHtml
                  )
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface hover:border-[#2563EB] px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                .doc
              </button>

              <button
                type="button"
                onClick={() => downloadStudyAsTxt(docTitle, docSubject, plainText)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface hover:border-[#2563EB] px-2.5 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
              >
                .txt
              </button>
            </div>
          </div>

          {/* Category 3: Transformar y Compartir */}
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide fabro-muted">
              Transformar y Compartir
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleConvertToFlashcards()}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#06B6D4]/60 bg-[#06B6D4]/10 text-[#0E7490] dark:text-[#67E8F9] px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
              >
                <Layers className="w-3.5 h-3.5" />
                A Flashcards
              </button>

              <ShareResourceButton
                compact
                label="WhatsApp / Enlace"
                payload={{
                  v: 1,
                  kind: 'note',
                  title: docTitle || 'Apunte de Estudio FABRO',
                  subject: docSubject || 'Estudio General',
                  body: plainText.slice(0, 6000),
                  summaryText: plainText.slice(0, 280),
                  author: profile.displayName,
                }}
              />

              <button
                type="button"
                onClick={() => handleSaveToNotebook(false)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar en Mi Cuaderno
              </button>
            </div>
          </div>
        </div>

        {(saveToast || flashcardsToast) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span>{flashcardsToast || saveToast}</span>
            {flashcardsToast && (
              <button
                type="button"
                onClick={() => navigateTo('estudio', 'mapas-flashcards')}
                className="underline font-bold cursor-pointer"
              >
                Ir a practicar Flashcards →
              </button>
            )}
          </div>
        )}
      </section>

      {/* ============================================================
          DRAWER LATERAL DISCRETO: "MIS APUNTES GUARDADOS"
         ============================================================ */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Mis Apuntes Guardados"
            className="w-full max-w-sm h-full border-l fabro-surface p-4 sm:p-5 flex flex-col gap-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2563EB]" />
                  Mis Apuntes Guardados
                </h3>
                <p className="text-[11px] fabro-muted">
                  {authUser ? 'IndexedDB + Firebase sincronizado' : 'Bóveda local IndexedDB'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar lista de apuntes"
                className="min-h-[40px] min-w-[40px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="search"
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder="Buscar apunte o materia..."
                className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  handleBlankSheet();
                  setDrawerOpen(false);
                }}
                className="min-h-[40px] rounded-xl border border-[#2563EB] bg-[#2563EB] text-white px-3 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                + Nuevo
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredSavedNotes.length === 0 ? (
                <p className="text-xs fabro-muted text-center py-8">
                  No hay apuntes que coincidan con la búsqueda.
                </p>
              ) : (
                filteredSavedNotes.map((note) => {
                  const selected = note.id === activeNoteId;
                  return (
                    <div
                      key={note.id}
                      className={`rounded-xl border p-3 transition-all ${
                        selected
                          ? 'border-[#2563EB] bg-[#2563EB]/10'
                          : 'fabro-border fabro-surface-elevated hover:border-[#2563EB]/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadNote(note.id)}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <p className="text-xs font-bold truncate">{note.title}</p>
                          <p className="text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-medium truncate">
                            {note.subject} · {note.updatedAt}
                          </p>
                          <p className="text-[11px] fabro-muted line-clamp-2 mt-1">
                            {note.contentText || 'Hoja lista para redactar'}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAdvancedNote(note.id)}
                          aria-label={`Eliminar ${note.title}`}
                          className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border flex items-center justify-center text-rose-500 hover:bg-rose-500/10 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ============================================================
          MODO LECTURA SIN DISTRACCIONES (PANTALLA COMPLETA)
         ============================================================ */}
      {distractionFree && (
        <div className="fixed inset-0 z-50 fabro-surface overflow-y-auto">
          <div className="sticky top-0 z-10 border-b fabro-border fabro-surface/95 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] uppercase">
                Modo Lectura · {docSubject}
              </p>
              <p className="font-display text-sm sm:text-base font-bold truncate">{docTitle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTogglePauseSpeech}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#2563EB]" />
                {ttsState === 'speaking' ? 'Pausar voz' : 'Escuchar'}
              </button>
              <button
                type="button"
                onClick={() => setDistractionFree(false)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB] bg-[#2563EB] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Salir de lectura
              </button>
            </div>
          </div>

          <article className="max-w-3xl mx-auto px-5 sm:px-10 py-8 sm:py-12 space-y-5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              {docTitle}
            </h1>
            <div
              className="text-base sm:text-lg leading-[1.9] space-y-4 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-extrabold [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#2563EB] dark:[&_h2]:text-[#60A5FA] [&_h2]:mt-6 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-[#2563EB] [&_blockquote]:bg-[#2563EB]/10 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:rounded-r-xl"
              dangerouslySetInnerHTML={{
                __html: editorRef.current ? editorRef.current.innerHTML : docHtml,
              }}
            />
          </article>
        </div>
      )}
    </div>
  );
};
