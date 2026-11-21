import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  Globe,
  KeyRound,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useStudy2 } from '../../../context/Study2Context';
import { sendByokChatCompletion } from '../../../services/byokChatClient';
import {
  downloadStudyAsDoc,
  markdownToWordHtml,
  printStudyDocumentAsPdf,
} from '../../../services/studyDocumentUtils';
import type {
  AcademicWebCitation,
  FabroAiDepth,
  FabroAiStudyMode,
} from '../../../types/study2';

const AI_MODES: Array<{ id: FabroAiStudyMode; label: string; hint: string }> = [
  { id: 'explicar_tema', label: 'Explicar un tema', hint: 'Explicación didáctica y estructurada' },
  { id: 'resumir_documento', label: 'Resumir documento', hint: 'Síntesis fiel a tus archivos' },
  { id: 'analizar_documento', label: 'Analizar documento completo', hint: 'Estructura, argumentos y conceptos' },
  { id: 'mapa_conceptual', label: 'Crear mapa conceptual', hint: 'Jerarquía de nodos y relaciones' },
  { id: 'preguntas_examen', label: 'Generar preguntas de examen', hint: 'Preguntas tipo parcial/final con respuestas' },
  { id: 'cuestionario_interactivo', label: 'Crear cuestionario interactivo', hint: 'Múltiple opción con clave fundamentada' },
  { id: 'flashcards', label: 'Crear tarjetas de memoria', hint: 'Pares pregunta/respuesta para repaso' },
  { id: 'guia_estudio', label: 'Crear guía de estudio', hint: 'Ruta paso a paso de objetivos y lecturas' },
  { id: 'cuadro_comparativo', label: 'Crear cuadro comparativo', hint: 'Tabla Markdown de diferencias y similitudes' },
  { id: 'linea_tiempo', label: 'Crear línea de tiempo', hint: 'Hitos cronológicos ordenados' },
  { id: 'caso_practico', label: 'Resolver caso práctico', hint: 'Aplicación paso a paso con fundamentación' },
  { id: 'corregir_texto', label: 'Corregir texto', hint: 'Ortografía, gramática y precisión conceptual' },
  { id: 'mejorar_redaccion', label: 'Mejorar redacción académica', hint: 'Estilo claro, formal y riguroso' },
  { id: 'plan_estudio', label: 'Crear plan de estudio', hint: 'Distribución realista por sesiones' },
  { id: 'investigar_tema', label: 'Investigar tema', hint: 'Fuentes públicas verificables + síntesis' },
  { id: 'comparar_documentos', label: 'Comparar documentos', hint: 'Coincidencias, matices y contradicciones' },
  { id: 'explicacion_sencilla', label: 'Explicación sencilla', hint: 'Lenguaje claro con ejemplos cotidianos' },
  { id: 'explicacion_academica', label: 'Explicación académica profunda', hint: 'Nivel universitario riguroso' },
];

const DEPTH_OPTIONS: Array<{ id: FabroAiDepth; label: string; detail: string }> = [
  { id: 'breve', label: 'Breve', detail: 'Síntesis directa y concreta' },
  { id: 'intermedio', label: 'Intermedio', detail: 'Desarrollo equilibrado con ejemplos' },
  { id: 'completo', label: 'Completo', detail: 'Desarrollo exhaustivo (predeterminado)' },
  { id: 'muy_profundo', label: 'Muy profundo', detail: 'Nivel académico superior con matices críticos' },
];

export const Study2AiStudio: React.FC = () => {
  const {
    byokKeys,
    getByokSecret,
    navigateTo,
    advancedNotes,
    createAdvancedNote,
    updateAdvancedNote,
  } = useEcosystem();
  const {
    snapshot,
    aiHandoff,
    clearAiHandoff,
    appendAiTurn,
    clearAiHistory,
    uploadLibraryFile,
    updateNoteMeta,
    setActiveNav,
  } = useStudy2();

  const [mode, setMode] = useState<FabroAiStudyMode>('explicar_tema');
  const [depth, setDepth] = useState<FabroAiDepth>('completo'); // Default COMPLETO as required
  const [subjectId, setSubjectId] = useState<string>('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [inlineNoteContext, setInlineNoteContext] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [enableWebResearch, setEnableWebResearch] = useState<boolean>(true);
  const [selectedKeyId, setSelectedKeyId] = useState<string>(() => byokKeys[0]?.id || '');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep selected BYOK key valid
  useEffect(() => {
    if (!selectedKeyId && byokKeys.length > 0) {
      setSelectedKeyId(byokKeys[0].id);
    }
  }, [byokKeys, selectedKeyId]);

  // Consume handoff from Mis Apuntes, Mis Estudios, or Biblioteca
  useEffect(() => {
    if (!aiHandoff) return;
    if (aiHandoff.subjectId) setSubjectId(aiHandoff.subjectId);
    if (aiHandoff.mode) setMode(aiHandoff.mode);
    if (aiHandoff.prompt) setPrompt(aiHandoff.prompt);
    if (aiHandoff.fileIds && aiHandoff.fileIds.length > 0) {
      setSelectedFileIds(aiHandoff.fileIds);
    }
    if (aiHandoff.noteTitle && aiHandoff.noteText) {
      setInlineNoteContext({ title: aiHandoff.noteTitle, text: aiHandoff.noteText });
    }
    clearAiHandoff();
  }, [aiHandoff, clearAiHandoff]);

  const activeSubject = useMemo(
    () => snapshot.subjects.find((s) => s.id === subjectId) || null,
    [snapshot.subjects, subjectId]
  );

  const selectedFiles = useMemo(
    () => snapshot.libraryFiles.filter((f) => selectedFileIds.includes(f.id)),
    [selectedFileIds, snapshot.libraryFiles]
  );

  const activeByokKey = useMemo(
    () => byokKeys.find((k) => k.id === selectedKeyId) || byokKeys[0] || null,
    [byokKeys, selectedKeyId]
  );

  const handleUploadDirectDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const uploaded = await uploadLibraryFile(file, {
        subjectId: subjectId || undefined,
        runImageOcr: file.type.startsWith('image/'),
      });
      setSelectedFileIds((prev) =>
        prev.includes(uploaded.id) ? prev : [...prev, uploaded.id]
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const buildSubjectContextBlock = (): string => {
    if (!activeSubject) return '';
    const unitLines = activeSubject.units
      .map(
        (u) =>
          `- ${u.title}: ${u.topics.map((t) => `${t.title}${t.completed ? ' [visto]' : ''}`).join(', ') || 'sin temas'}`
      )
      .join('\n');
    const subNotes = advancedNotes
      .filter((n) => snapshot.noteMetadata[n.id]?.subjectId === activeSubject.id)
      .slice(0, 3)
      .map(
        (n) =>
          `Apunte "${n.title}": ${(n.contentText || n.contentHtml || '').replace(/<[^>]+>/g, ' ').slice(0, 800)}`
      )
      .join('\n');

    return [
      `[CONTEXTO DE LA MATERIA: ${activeSubject.name}]`,
      activeSubject.institution ? `Institución: ${activeSubject.institution}` : '',
      activeSubject.syllabus ? `Programa:\n${activeSubject.syllabus.slice(0, 3000)}` : '',
      unitLines ? `Unidades y temas:\n${unitLines}` : '',
      subNotes ? `Apuntes del estudiante:\n${subNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleRunQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt && selectedFiles.length === 0 && !inlineNoteContext) {
      setErrorMsg('Escribí una consulta o adjuntá un documento/apunte para analizar.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const modeMeta = AI_MODES.find((m) => m.id === mode) || AI_MODES[0];
    const effectivePrompt =
      cleanPrompt || `Aplicar modo "${modeMeta.label}" sobre el material adjunto.`;

    // Step 1: Real free web academic research (if toggled or mode === investigar_tema)
    let webSources: AcademicWebCitation[] = [];
    let webResearchNote = '';
    if (enableWebResearch || mode === 'investigar_tema') {
      try {
        const searchQuery = [activeSubject?.name, cleanPrompt || selectedFiles[0]?.name]
          .filter(Boolean)
          .join(' ')
          .slice(0, 180);
        if (searchQuery.trim().length >= 2) {
          const res = await fetch(
            `/api/study/research?q=${encodeURIComponent(searchQuery.trim())}`
          );
          if (res.ok) {
            const data = (await res.json()) as {
              sources?: AcademicWebCitation[];
              providers?: Record<string, string>;
            };
            webSources = Array.isArray(data.sources) ? data.sources.slice(0, 6) : [];
          } else {
            webResearchNote =
              'No se pudieron consultar las fuentes académicas externas en este momento.';
          }
        }
      } catch {
        webResearchNote =
          'Sin conexión al servidor de búsqueda académica externa (OpenAlex / Crossref / Wikipedia).';
      }
    }

    // Record user turn
    const docNames = [
      ...selectedFiles.map((f) => f.name),
      ...(inlineNoteContext ? [`Apunte: ${inlineNoteContext.title}`] : []),
    ];

    appendAiTurn({
      id: `ai-u-${Date.now()}`,
      role: 'user',
      mode,
      depth,
      subjectId: subjectId || undefined,
      content: effectivePrompt,
      documentNames: docNames,
      webSources: [],
      createdAt: new Date().toISOString(),
    });

    // Step 2: Build real attachments from extracted document text + inline note + subject context
    const attachments = [
      ...selectedFiles.map((f) => ({
        id: f.id,
        title: f.name,
        subject: activeSubject?.name || 'Biblioteca',
        contentText:
          f.extractedText ||
          `[Aviso: el archivo "${f.name}" no tiene texto extraíble: ${f.extractionNote || 'sin texto'}]`,
      })),
      ...(inlineNoteContext
        ? [
            {
              id: 'inline-note',
              title: inlineNoteContext.title,
              subject: activeSubject?.name || 'Mis apuntes',
              contentText: inlineNoteContext.text,
            },
          ]
        : []),
    ];

    const subjectCtx = buildSubjectContextBlock();
    const sourcesCtx =
      webSources.length > 0
        ? `\n\n[FUENTES EXTERNAS VERIFICABLES ENCONTRADAS EN ESTA CONSULTA]\n${webSources
            .map(
              (s, idx) =>
                `[${idx + 1}] ${s.title} — ${s.authors.join(', ') || 'Autor no listado'} (${s.year}) | Fuente: ${s.sourceName} | URL: ${s.url}\nExtracto: ${s.excerpt}`
            )
            .join('\n\n')}`
        : '';

    const depthInstruction: Record<FabroAiDepth, string> = {
      breve: 'NIVEL DE PROFUNDIDAD: BREVE. Sé claro, directo y sintético sin perder rigor.',
      intermedio:
        'NIVEL DE PROFUNDIDAD: INTERMEDIO. Desarrollá definiciones, relaciones clave y ejemplos prácticos.',
      completo:
        'NIVEL DE PROFUNDIDAD: COMPLETO (predeterminado). Ofrecé una respuesta académica completa, bien organizada con títulos, definiciones, argumentos, ejemplos y cierre integrador.',
      muy_profundo:
        'NIVEL DE PROFUNDIDAD: MUY PROFUNDO. Elaborá un análisis exhaustivo de nivel universitario/posgrado con marco teórico, matices, tensiones conceptuales, aplicaciones y preguntas críticas.',
    };

    const systemInstruction = [
      'Sos FABRO IA, un entorno académico riguroso dentro de FABRO Estudio.',
      `MODO SOLICITADO: ${modeMeta.label} (${modeMeta.hint}).`,
      depthInstruction[depth],
      'REGLAS DE RIGOR Y TRANSPARENCIA OBLIGATORIAS:',
      '1. NUNCA inventes bibliografía, autores, páginas, DOI ni enlaces URL. Solo citá URLs que figuren exactamente en [FUENTES EXTERNAS VERIFICABLES] o en los documentos adjuntos.',
      '2. Distinguí explícitamente en tu respuesta usando secciones claras:',
      '   - **De tus documentos y apuntes** (si hubo archivos/apuntes adjuntos)',
      '   - **Respaldado en fuentes externas verificables** (solo si se encontraron fuentes arriba)',
      '   - **Desarrollo y análisis de FABRO IA**',
      '   - **Límites o puntos no verificados** (si falta información en el material aportado, decilo claramente)',
      '3. Respondé siempre en español claro y profesional usando Markdown limpio.',
      subjectCtx,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Step 3: Execute real BYOK LLM call if the user configured a key; otherwise deliver honest non-fabricated result
    if (activeByokKey) {
      const secret = getByokSecret(activeByokKey.id);
      const result = await sendByokChatCompletion({
        keyMeta: activeByokKey,
        rawApiKey: secret,
        history: [],
        userText: `${effectivePrompt}${sourcesCtx}`,
        attachments,
        systemInstructionOverride: systemInstruction,
      });

      if (result.ok) {
        appendAiTurn({
          id: `ai-a-${Date.now()}`,
          role: 'assistant',
          mode,
          depth,
          subjectId: subjectId || undefined,
          content: result.content,
          documentNames: docNames,
          webSources,
          usedByokProvider: `${activeByokKey.providerName}${
            activeByokKey.modelName ? ` · ${activeByokKey.modelName}` : ''
          }`,
          createdAt: new Date().toISOString(),
        });
        setPrompt('');
      } else {
        setErrorMsg(result.error || 'No se pudo completar la consulta con tu proveedor BYOK.');
        // Still record real web sources / document extracts if found so work isn't lost
        if (webSources.length > 0) {
          appendAiTurn({
            id: `ai-a-${Date.now()}`,
            role: 'assistant',
            mode,
            depth,
            subjectId: subjectId || undefined,
            content: `### Fuentes externas verificables encontradas\n\nNo se pudo ejecutar la síntesis generativa con tu proveedor BYOK (${result.error}), pero sí se recuperaron **${webSources.length} fuentes reales verificables** de OpenAlex / Crossref / Wikipedia ES listadas debajo.`,
            documentNames: docNames,
            webSources,
            createdAt: new Date().toISOString(),
          });
        }
      }
      setLoading(false);
      return;
    }

    // Honest no-BYOK path: NEVER pretend to run an LLM; present real extracted document digest + real academic web sources
    const sections: string[] = [];
    if (selectedFiles.length > 0 || inlineNoteContext) {
      sections.push(
        `### 1. Información extraída de tus documentos\n\n${attachments
          .map(
            (a) =>
              `**${a.title}** (${a.contentText.length.toLocaleString('es-AR')} caracteres extraídos):\n\n> ${a.contentText
                .slice(0, 650)
                .replace(/\n+/g, ' ')}${a.contentText.length > 650 ? '…' : ''}`
          )
          .join('\n\n')}`
      );
    }

    if (webSources.length > 0) {
      sections.push(
        `### 2. Fuentes externas verificables (${webSources.length})\n\n${webSources
          .map(
            (s, i) =>
              `${i + 1}. **${s.title}** — ${s.authors.join(', ') || 'Autor no especificado'} (${s.year}) · *${s.sourceName}*\n   ${s.excerpt}`
          )
          .join('\n\n')}`
      );
    } else if (webResearchNote) {
      sections.push(`### Fuentes externas\n\n${webResearchNote}`);
    }

    sections.push(
      `### 3. Análisis generativo IA (requiere clave BYOK)\n\nFABRO opera sin APIs de pago precargadas. Para generar respuestas redactadas, guías completas, mapas conceptuales o correcciones en modo **${modeMeta.label}** (profundidad **${depth}**), conectá tu propia clave API (Gemini, OpenAI, Anthropic, DeepSeek o Qwen) en **Configuración → Claves API (BYOK)**.`
    );

    appendAiTurn({
      id: `ai-a-${Date.now()}`,
      role: 'assistant',
      mode,
      depth,
      subjectId: subjectId || undefined,
      content: sections.join('\n\n'),
      documentNames: docNames,
      webSources,
      createdAt: new Date().toISOString(),
    });
    setPrompt('');
    setLoading(false);
  };

  const handleSaveResponseAsNote = (content: string, turnMode: FabroAiStudyMode) => {
    const modeLabel = AI_MODES.find((m) => m.id === turnMode)?.label || 'FABRO IA';
    const created = createAdvancedNote({
      title: `${modeLabel}${activeSubject ? ` · ${activeSubject.name}` : ''}`,
      subject: activeSubject?.name || 'FABRO IA',
      folder: activeSubject?.name || 'FABRO IA',
    });
    updateAdvancedNote(created.id, {
      contentHtml: markdownToWordHtml(content),
      contentText: content,
      updatedAt: 'Ahora mismo',
    });
    if (activeSubject) {
      updateNoteMeta(created.id, { subjectId: activeSubject.id });
    }
    setSavedNotice('Guardado en Mis apuntes');
    window.setTimeout(() => setSavedNotice(null), 2600);
  };

  return (
    <div className="space-y-5">
      {/* Studio Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Centro Académico Inteligente
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              FABRO IA
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Analizá tus documentos reales, investigá en fuentes verificables (OpenAlex, Crossref, Wikipedia) y estudiá con el contexto de tus materias.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {byokKeys.length > 0 ? (
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                aria-label="Seleccionar proveedor BYOK"
                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-semibold"
              >
                {byokKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.providerName} {k.modelName ? `(${k.modelName})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo('ia', 'claves-byok')}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 text-xs font-bold cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Conectar clave BYOK
              </button>
            )}
          </div>
        </div>

        {/* Context & Depth Configuration Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Modo de estudio (18)
            </span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as FabroAiStudyMode)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold"
            >
              {AI_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Profundidad de respuesta
            </span>
            <select
              value={depth}
              onChange={(e) => setDepth(e.target.value as FabroAiDepth)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold"
            >
              {DEPTH_OPTIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} — {d.detail}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Contexto de materia (opcional)
            </span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold"
            >
              <option value="">Estudio general (sin materia)</option>
              {snapshot.subjects
                .filter((s) => !s.archived)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {/* Document Picker + Direct Upload + Web Research Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv,image/*"
              className="hidden"
              onChange={handleUploadDirectDoc}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>Subir PDF / Word / Imagen</span>
            </button>

            {snapshot.libraryFiles.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id && !selectedFileIds.includes(id)) {
                    setSelectedFileIds((prev) => [...prev, id]);
                  }
                }}
                aria-label="Adjuntar archivo desde Biblioteca"
                className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
              >
                <option value="">+ Adjuntar de mi Biblioteca ({snapshot.libraryFiles.length})</option>
                {snapshot.libraryFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enableWebResearch}
              onChange={(e) => setEnableWebResearch(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            Buscar fuentes académicas verificables
          </label>
        </div>

        {/* Attached Context Chips */}
        {(selectedFiles.length > 0 || inlineNoteContext) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {inlineNoteContext && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                <FileText className="w-3 h-3" />
                Apunte: {inlineNoteContext.title}
                <button
                  type="button"
                  onClick={() => setInlineNoteContext(null)}
                  className="cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedFiles.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold"
              >
                <Paperclip className="w-3 h-3 text-blue-600" />
                {f.name}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFileIds((prev) => prev.filter((id) => id !== f.id))
                  }
                  className="cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Query Composer */}
      <form
        onSubmit={handleRunQuery}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
      >
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribí tu consulta académica, pegá una consigna o pedí un análisis completo de los documentos adjuntos..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 p-3 text-sm leading-relaxed focus:outline-none focus:border-blue-500"
        />

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            {savedNotice ? (
              <span className="text-emerald-600 font-semibold">{savedNotice}</span>
            ) : (
              'Las citas externas muestran únicamente enlaces reales devueltos por OpenAlex, Crossref y Wikipedia.'
            )}
          </p>

          <div className="flex items-center gap-2">
            {snapshot.aiHistory.length > 0 && (
              <button
                type="button"
                onClick={clearAiHistory}
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpiar historial
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 text-xs font-bold cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Ejecutar análisis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Conversation & Verifiable Citations Stream */}
      {snapshot.aiHistory.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
          <Sparkles className="w-7 h-7 text-blue-600 mx-auto" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Listo para estudiar en profundidad
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Elegí uno de los 18 modos educativos, adjuntá tus PDFs o apuntes y ejecutá tu consulta.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {[...snapshot.aiHistory].reverse().map((turn) => {
            const isUser = turn.role === 'user';
            const modeLabel = AI_MODES.find((m) => m.id === turn.mode)?.label || turn.mode;

            return (
              <article
                key={turn.id}
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
                  isUser
                    ? 'border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className={isUser ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}>
                      {isUser ? 'Tu consulta' : 'FABRO IA'}
                    </span>
                    <span>·</span>
                    <span>{modeLabel}</span>
                    <span>·</span>
                    <span className="capitalize">{turn.depth.replace('_', ' ')}</span>
                    {turn.usedByokProvider && (
                      <>
                        <span>·</span>
                        <span>{turn.usedByokProvider}</span>
                      </>
                    )}
                  </div>
                  {turn.documentNames.length > 0 && (
                    <span className="truncate max-w-xs">
                      Adjuntos: {turn.documentNames.join(', ')}
                    </span>
                  )}
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
                </div>

                {/* Verifiable Academic Sources Panel */}
                {turn.webSources.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 p-3.5 space-y-2">
                    <p className="text-xs font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      Fuentes académicas verificables ({turn.webSources.length})
                    </p>
                    <div className="space-y-2">
                      {turn.webSources.map((src) => (
                        <div
                          key={src.id}
                          className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {src.title}
                            </p>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline shrink-0"
                            >
                              Ver fuente
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {src.authors.join(', ') || 'Autor no informado'} ({src.year}) ·{' '}
                            {src.sourceName}
                            {src.institution ? ` · ${src.institution}` : ''}
                            {src.doi ? ` · DOI: ${src.doi}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isUser && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(turn.content);
                        setCopiedId(turn.id);
                        window.setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === turn.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedId === turn.id ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveResponseAsNote(turn.content, turn.mode)}
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-blue-600" />
                      Guardar en Mis apuntes
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadStudyAsDoc(
                          modeLabel,
                          activeSubject?.name || 'FABRO Estudio',
                          markdownToWordHtml(turn.content)
                        )
                      }
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Exportar Word (.doc)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        printStudyDocumentAsPdf(
                          modeLabel,
                          activeSubject?.name || 'FABRO Estudio',
                          markdownToWordHtml(turn.content)
                        )
                      }
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Imprimir / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNav('mis-apuntes')}
                      className="ml-auto text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Abrir Mis apuntes
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
