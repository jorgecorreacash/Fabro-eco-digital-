import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertTriangle,
  BookmarkPlus,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Crown,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  History,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Trash2,
  Wand2,
  WifiOff,
  X,
} from 'lucide-react';
import { authFetch } from '../../lib/apiClient';
import { computeFabroId, getSectorAiPreferences } from '../../lib/fabroId';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  exportMarkdownToPdf,
  exportMarkdownToWord,
  markdownToHtml,
} from '../../lib/exporters';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';
import { VisualStudyStudioModal, type VisualStudyKind } from './VisualStudyStudioModal';
import { AIReadingModeModal } from './AIReadingModeModal';
import { WikiImageFinderModal } from './WikiImageFinderModal';
import { FabroAIImageStudioModal } from './FabroAIImageStudioModal';
import type {
  AIChatMessage,
  AIProviderId,
  AIRoutingMode,
  AIWebSource,
  FabroAnalysisMetadata,
  FabroWorkMode,
} from '../../types/fabro';

const WORK_MODE_OPTIONS: Array<{
  id: FabroWorkMode;
  command: string;
  label: string;
  shortDesc: string;
}> = [
  { id: 'DESARROLLO', command: '/DESARROLLO', label: 'Desarrollo', shortDesc: '16 secciones universitarias' },
  { id: 'RESUMEN', command: '/RESUMEN', label: 'Resumen', shortDesc: 'Síntesis integral rigurosa' },
  { id: 'EXPLICAR', command: '/EXPLICAR', label: 'Explicar', shortDesc: 'Didáctica en 8 pasos' },
  { id: 'INVESTIGAR', command: '/INVESTIGAR', label: 'Investigar', shortDesc: 'Fuentes académicas en vivo' },
  { id: 'COMPARAR', command: '/COMPARAR', label: 'Comparar', shortDesc: 'Contraste entre autores' },
  { id: 'EXAMEN', command: '/EXAMEN', label: 'Examen', shortDesc: 'Preguntas y casos universitarios' },
  { id: 'BIBLIOGRAFIA', command: '/BIBLIOGRAFIA', label: 'Bibliografía', shortDesc: 'Referencias verificadas' },
  { id: 'PROGRAMA', command: '/PROGRAMA', label: 'Programa', shortDesc: 'Mapa de unidades y ruta' },
  { id: 'GLOSARIO', command: '/GLOSARIO', label: 'Glosario', shortDesc: 'Términos técnicos y ejemplos' },
  { id: 'REPASO', command: '/REPASO', label: 'Repaso', shortDesc: 'Integración y temas débiles' },
];

const QUICK_PROMPTS = [
  '/DESARROLLO Desarrollá en profundidad este tema integrando mis documentos seleccionados con bibliografía académica universitaria, autores, debates y preguntas de examen',
  '/COMPARAR Compará las posturas, autores y enfoques presentes en mis documentos frente a la bibliografía académica externa',
  '/INVESTIGAR Buscá fuentes académicas universitarias y repositorios oficiales sobre este tema y contrastalas con mis apuntes',
  '/EXPLICAR Explicame paso a paso los conceptos más complejos de mis apuntes con definición técnica, ejemplo aplicado y errores frecuentes',
  '/EXAMEN Generá un examen universitario exigente con preguntas de desarrollo, análisis de casos y criterios de corrección sobre esta materia',
];

type ResponseDepth = 'directo' | 'profundo' | 'desarrollo_completo' | 'exhaustivo';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo adjunto.'));
    reader.readAsDataURL(file);
  });
}

export const FabroAIView: React.FC = () => {
  const {
    user,
    profile,
    subjects,
    selectedSubjectId,
    libraryDocs,
    notes,
    exams,
    books,
    aiChats,
    aiDraftPrompt,
    setAiDraftPrompt,
    saveAIChatThread,
    deleteAIChatThread,
    createNote,
    logStudySession,
    getMemoryForSubject,
    upsertSubjectMemory,
    setActiveSection,
  } = useFabro();

  const {
    providers: gatewayProviders,
    models: gatewayModels,
    adminSettings,
    effectivePlanPolicy,
    conversations: gatewayConversations,
    messagesByConversation,
    ensureConversation,
    renameConversation,
    toggleFavoriteConversation,
    deleteConversation,
    recordGatewayTurn,
    sendGatewayChat,
    sendGatewayChatStream,
    freemiumStatus,
    openPlansModal,
    personalConnections,
    sendPersonalChat,
    comparePersonalConnections,
  } = useAIGateway();

  const isOnline = useOnlineStatus();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeGatewayConvId, setActiveGatewayConvId] = useState<string | null>(null);
  const [mode, setMode] = useState<'sencillo' | 'academico'>('academico');
  const [workMode, setWorkMode] = useState<FabroWorkMode>('DESARROLLO');
  const [responseDepth, setResponseDepth] = useState<ResponseDepth>('desarrollo_completo');
  const [routingMode, setRoutingMode] = useState<AIRoutingMode>('automatica');
  const [selectedProviderId, setSelectedProviderId] = useState<AIProviderId | 'auto'>('auto');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [useGatewayStream, setUseGatewayStream] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [threadListTab, setThreadListTab] = useState<'gateway' | 'tutor'>('gateway');
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState<string>('');
  const [visualModal, setVisualModal] = useState<{
    open: boolean;
    kind: VisualStudyKind;
    topic: string;
    context: string;
  }>({ open: false, kind: 'esquema', topic: '', context: '' });
  const [readingMsg, setReadingMsg] = useState<{ title: string; text: string } | null>(null);
  const [wikiSearchOpen, setWikiSearchOpen] = useState(false);
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [includeExamDiagnosis, setIncludeExamDiagnosis] = useState(true);
  const [subjectId, setSubjectId] = useState(selectedSubjectId || '');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; mimeType: string; base64: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMobileConfig, setShowMobileConfig] = useState(false);
  const [showMemoryDetails, setShowMemoryDetails] = useState(false);
  const [executionTarget, setExecutionTarget] = useState<string>('fabro'); // 'fabro' | 'personal:<connectionId>'
  const [pendingSwitchApproval, setPendingSwitchApproval] = useState<{
    promptText: string;
    reason: string;
    failedLabel: string;
  } | null>(null);
  const [personalCompareOpen, setPersonalCompareOpen] = useState(false);
  const [comparePromptInput, setComparePromptInput] = useState('');
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareOutput, setCompareOutput] = useState<
    Array<{
      connectionId: string;
      label: string;
      modelUsed: string;
      status: 'ok' | 'error';
      text: string;
      error: string;
      latencyMs: number;
    }>
  >([]);

  const verifiedPersonalConnections = useMemo(
    () => personalConnections.filter((c) => c.status === 'connected' && c.lastTestStatus === 'verified'),
    [personalConnections]
  );

  const selectedPersonalConnection = useMemo(() => {
    if (!executionTarget.startsWith('personal:')) return null;
    const cid = executionTarget.slice('personal:'.length);
    return verifiedPersonalConnections.find((c) => c.id === cid) || null;
  }, [executionTarget, verifiedPersonalConnections]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectableProviders = useMemo(() => gatewayProviders, [gatewayProviders]);
  const modelsForSelectedProvider = useMemo(() => {
    if (selectedProviderId === 'auto') return gatewayModels.filter((m) => m.enabled);
    return gatewayModels.filter((m) => m.providerId === selectedProviderId);
  }, [gatewayModels, selectedProviderId]);

  useEffect(() => {
    const applyEstudioSectorPref = () => {
      const pref = getSectorAiPreferences(user?.uid).estudio;
      if (pref.providerMode === 'personal' && pref.personalConnectionId) {
        const exists = verifiedPersonalConnections.some((c) => c.id === pref.personalConnectionId);
        if (exists) {
          setExecutionTarget(`personal:${pref.personalConnectionId}`);
          return;
        }
      }
      setExecutionTarget('fabro');
      if (pref.providerMode === 'fabro_gemini') {
        setRoutingMode('manual');
        setSelectedProviderId('gemini');
      } else if (pref.providerMode === 'fabro_openai') {
        setRoutingMode('manual');
        setSelectedProviderId('openai');
      } else if (pref.providerMode === 'auto') {
        setRoutingMode('automatica');
        setSelectedProviderId('auto');
      }
    };
    applyEstudioSectorPref();
    window.addEventListener('fabro-sector-ai-updated', applyEstudioSectorPref);
    return () => window.removeEventListener('fabro-sector-ai-updated', applyEstudioSectorPref);
  }, [user?.uid, verifiedPersonalConnections]);

  useEffect(() => {
    if (routingMode === 'manual' && selectedProviderId === 'auto') {
      const firstReady =
        gatewayProviders.find((p) => p.enabled && p.configuredInBackend) || gatewayProviders[0];
      if (firstReady) {
        setSelectedProviderId(firstReady.id);
        setSelectedModelId(firstReady.defaultModelId);
      }
    }
  }, [routingMode, selectedProviderId, gatewayProviders]);

  useEffect(() => {
    if (selectedSubjectId && !activeThreadId) {
      setSubjectId(selectedSubjectId);
    }
  }, [selectedSubjectId, activeThreadId]);

  useEffect(() => {
    if (aiDraftPrompt) {
      setInput(aiDraftPrompt);
      setAiDraftPrompt('');
    }
  }, [aiDraftPrompt, setAiDraftPrompt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const activeSubjectMemory = useMemo(
    () => getMemoryForSubject(subjectId || ''),
    [getMemoryForSubject, subjectId]
  );

  const authorizedDocs = useMemo(
    () => libraryDocs.filter((d) => d.aiAuthorized),
    [libraryDocs]
  );

  const relevantNotes = useMemo(() => {
    if (!subjectId) return notes;
    const subjectNotes = notes.filter((n) => n.subjectId === subjectId);
    const otherNotes = notes.filter((n) => n.subjectId !== subjectId);
    return [...subjectNotes, ...otherNotes];
  }, [notes, subjectId]);

  const subjectExamStats = useMemo(() => {
    const filtered = subjectId
      ? exams.filter((e) => e.subjectId === subjectId && e.status === 'completado')
      : exams.filter((e) => e.status === 'completado');
    const weakTopicsSet = new Set<string>();
    for (const ex of filtered) {
      for (const topic of ex.weakTopics || []) {
        if (topic && topic.trim()) weakTopicsSet.add(topic.trim());
      }
    }
    const avgScore =
      filtered.length > 0
        ? Math.round(filtered.reduce((acc, e) => acc + (e.scorePercent || 0), 0) / filtered.length)
        : null;
    const recentExamsSummary = filtered
      .slice(0, 4)
      .map((e) => `${e.title} (${e.mode}, ${e.scorePercent}%)`)
      .join('; ');
    return {
      completedCount: filtered.length,
      avgScore,
      weakTopics: Array.from(weakTopicsSet),
      recentExamsSummary,
    };
  }, [exams, subjectId]);

  const relatedBooksSummary = useMemo(() => {
    const matching = subjectId
      ? books.filter((b) => b.subjectId === subjectId)
      : books.slice(0, 3);
    if (matching.length === 0) return '';
    return matching
      .slice(0, 3)
      .map((b) => `"${b.title}" (${b.genre}, ${b.totalWords} palabras): ${b.synopsis || 'Sin sinopsis'}`)
      .join('\n');
  }, [books, subjectId]);

  const loadThread = (threadId: string) => {
    const thread = aiChats.find((c) => c.id === threadId);
    if (!thread) return;
    setActiveThreadId(thread.id);
    setActiveGatewayConvId(null);
    setMode(thread.mode);
    setSubjectId(thread.subjectId || '');
    setSelectedDocIds(thread.selectedDocIds || []);
    setMessages(thread.messages || []);
    setError('');
    setShowMobileConfig(false);
  };

  const loadGatewayConversation = (convId: string) => {
    const conv = gatewayConversations.find((c) => c.id === convId);
    if (!conv) return;
    setActiveGatewayConvId(conv.id);
    setActiveThreadId(null);
    setSubjectId(conv.subjectId || '');
    setRoutingMode(conv.routingMode === 'manual' ? 'manual' : 'automatica');
    if (conv.preferredProviderId && conv.preferredProviderId !== 'auto') {
      setSelectedProviderId(conv.preferredProviderId);
      setSelectedModelId(conv.preferredModelId || '');
    } else {
      setSelectedProviderId('auto');
      setSelectedModelId('');
    }
    const msgs = (messagesByConversation[convId] || []).map(
      (m): AIChatMessage => ({
        id: m.id,
        role: m.role === 'user' ? 'user' : 'model',
        text: m.content,
        timestamp: new Date().toISOString(),
        providerId: m.providerId,
        modelUsed: m.modelId,
        providerUsed: m.providerId ? `${m.providerId} (${m.modelId || ''})` : undefined,
        accessTier: m.accessTier,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        estimatedCostUsd: m.estimatedCostUsd,
        latencyMs: m.latencyMs,
        routingReason: m.routingReason,
        fallbackNotice: m.fallbackNotice,
      })
    );
    setMessages(msgs);
    setError('');
    setShowMobileConfig(false);
  };

  const startNewThread = () => {
    setActiveThreadId(null);
    setActiveGatewayConvId(null);
    setMessages([]);
    setStreamingText('');
    setError('');
    setShowMobileConfig(false);
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId].slice(0, 10)
    );
  };

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId].slice(0, 6)
    );
  };

  const selectRecentNotesForSubject = () => {
    const pool = subjectId ? notes.filter((n) => n.subjectId === subjectId) : notes;
    const target = (pool.length > 0 ? pool : notes).slice(0, 3).map((n) => n.id);
    setSelectedNoteIds(target);
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError('El archivo supera el límite de 15 MB para análisis directo.');
      e.target.value = '';
      return;
    }
    setError('');
    try {
      const base64 = await fileToBase64(file);
      setAttachment({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo adjunto.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = (customText ?? input).trim();
    if (!textToSend && !attachment) return;
    if (!isOnline) {
      setError('FABRO IA 2.0 requiere conexión a internet para investigar y procesar documentos.');
      return;
    }

    setError('');
    setSending(true);

    const slashMatch = textToSend.match(/^\/([a-záéíóúñ]+)\b/i);
    let effectiveWorkMode: FabroWorkMode = workMode;
    if (slashMatch) {
      const candidate = slashMatch[1]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase() as FabroWorkMode;
      if (WORK_MODE_OPTIONS.some((w) => w.id === candidate)) {
        effectiveWorkMode = candidate;
        setWorkMode(candidate);
      }
    }

    const userMsg: AIChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: textToSend || `Archivo adjunto: ${attachment?.name}`,
      timestamp: new Date().toISOString(),
      workMode: effectiveWorkMode,
      ...(attachment ? { attachmentName: attachment.name } : {}),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!customText) setInput('');

    const activeSubject = subjects.find((s) => s.id === subjectId);
    const subjectContext = activeSubject
      ? [
          `Materia: ${activeSubject.name}`,
          activeSubject.career ? `Carrera: ${activeSubject.career}` : '',
          activeSubject.institution ? `Institución: ${activeSubject.institution}` : '',
          activeSubject.professor ? `Cátedra/Docente: ${activeSubject.professor}` : '',
          activeSubject.syllabus ? `Programa: ${activeSubject.syllabus}` : '',
          activeSubject.syllabusExtractedText
            ? `Texto completo del programa: ${activeSubject.syllabusExtractedText.slice(0, 22000)}`
            : '',
          activeSubject.bibliography ? `Bibliografía declarada: ${activeSubject.bibliography}` : '',
          activeSubject.units.length > 0 ? `Unidades: ${activeSubject.units.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('. ')
      : '';

    const documentsContext = authorizedDocs
      .filter((d) => selectedDocIds.includes(d.id))
      .map((d) => ({
        id: d.id,
        title: d.title,
        content: d.extractedText || `Archivo: ${d.fileName}`,
        ...(d.coverage ? { coverage: d.coverage } : {}),
      }));

    const selectedNotesPayload = notes
      .filter((n) => selectedNoteIds.includes(n.id))
      .map((n) => ({
        title: n.title,
        unit: n.unit || '',
        content: n.contentText || '',
      }));

    const studyAnalysis = {
      notes: selectedNotesPayload,
      weakTopics: includeExamDiagnosis ? subjectExamStats.weakTopics : [],
      recentExamsSummary:
        includeExamDiagnosis && subjectExamStats.completedCount > 0
          ? `${subjectExamStats.completedCount} examen(es), promedio ${subjectExamStats.avgScore}% (${subjectExamStats.recentExamsSummary})`
          : '',
      activeBooks: relatedBooksSummary,
    };

    const shouldUseDirectGateway =
      routingMode === 'manual' ||
      useGatewayStream ||
      (selectedProviderId !== 'auto' && selectedProviderId !== 'gemini');

    try {
      // STRICT ISOLATION: If student selected a Personal Connected AI, route ONLY to /api/connect/chat (0 FABRO quota consumed!)
      if (executionTarget.startsWith('personal:')) {
        if (!selectedPersonalConnection) {
          setPendingSwitchApproval({
            promptText: textToSend,
            reason: 'La conexión personal elegida ya no está activa o fue desconectada.',
            failedLabel: 'IA personal seleccionada',
          });
          setSending(false);
          return;
        }
        const docsDigest = documentsContext
          .map((d) => `Documento "${d.title}":\n${d.content.slice(0, 6000)}`)
          .join('\n\n---\n\n');
        const notesDigest = selectedNotesPayload
          .map((n) => `Apunte "${n.title}" (${n.unit || 'General'}):\n${n.content.slice(0, 3500)}`)
          .join('\n\n---\n\n');
        const personalPrompt = [
          textToSend || 'Analizá el contenido proporcionado.',
          docsDigest ? `\n\n[DOCUMENTOS SELECCIONADOS]\n${docsDigest}` : '',
          notesDigest ? `\n\n[APUNTES DEL ESTUDIANTE]\n${notesDigest}` : '',
        ]
          .filter(Boolean)
          .join('');
        const personalSys = [
          `Sos un tutor académico (${effectiveWorkMode}) en nivel ${profile?.educationLevel || 'universitario'}.`,
          subjectContext ? `Contexto de materia: ${subjectContext.slice(0, 3500)}` : '',
          'Respondé en español claro, riguroso y bien estructurado.',
        ]
          .filter(Boolean)
          .join('\n');

        try {
          const pRes = await sendPersonalChat({
            connectionId: selectedPersonalConnection.id,
            prompt: personalPrompt,
            systemInstruction: personalSys,
            history: messages.map((m) => ({ role: m.role, text: m.text })),
          });
          setPendingSwitchApproval(null);
          const aiMsg: AIChatMessage = {
            id: `m_${Date.now()}`,
            role: 'model',
            text: pRes.text,
            timestamp: new Date().toISOString(),
            depth: responseDepth,
            workMode: effectiveWorkMode,
            providerUsed: `CONSUMO PERSONAL · ${pRes.connectionLabel} (${pRes.modelUsed})`,
            modelUsed: pRes.modelUsed,
            inputTokens: pRes.inputTokens,
            outputTokens: pRes.outputTokens,
            estimatedCostUsd: pRes.estimatedCostUsd,
            latencyMs: pRes.latencyMs,
            routingReason: 'Ejecución exclusiva con credencial personal del estudiante (0 consultas FABRO consumidas).',
          };
          const fullThreadMessages = [...nextMessages, aiMsg];
          setMessages(fullThreadMessages);
          setAttachment(null);
          const savedId = await saveAIChatThread(activeThreadId, {
            subjectId,
            title: (textToSend || pRes.connectionLabel).slice(0, 75),
            mode,
            selectedDocIds,
            messages: fullThreadMessages,
          });
          setActiveThreadId(savedId);
          return;
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Fallo en la IA personal seleccionada.';
          setPendingSwitchApproval({
            promptText: textToSend,
            reason,
            failedLabel: selectedPersonalConnection.label,
          });
          setError(reason);
          return;
        }
      }

      const convTitle = (textToSend || `Adjunto: ${attachment?.name || 'Documento'}`).slice(0, 80);
      const convId = await ensureConversation({
        conversationId: activeGatewayConvId,
        subjectId,
        title: convTitle,
        routingMode,
        preferredProviderId: selectedProviderId,
        preferredModelId: selectedModelId,
      });
      setActiveGatewayConvId(convId);

      if (shouldUseDirectGateway) {
        const docsDigest = documentsContext
          .map((d) => `Documento "${d.title}":\n${d.content.slice(0, 6000)}`)
          .join('\n\n---\n\n');
        const notesDigest = selectedNotesPayload
          .map((n) => `Apunte "${n.title}" (${n.unit || 'General'}):\n${n.content.slice(0, 3500)}`)
          .join('\n\n---\n\n');
        const fullGatewayPrompt = [
          textToSend || 'Analizá el archivo adjunto en profundidad.',
          docsDigest ? `\n\n[DOCUMENTOS SELECCIONADOS]\n${docsDigest}` : '',
          notesDigest ? `\n\n[APUNTES DEL ESTUDIANTE]\n${notesDigest}` : '',
        ]
          .filter(Boolean)
          .join('');

        const gatewaySys = [
          `Sos FABRO IA (${effectiveWorkMode}) en nivel ${profile?.educationLevel || 'universitario'}.`,
          mode === 'academico'
            ? 'Estilo académico universitario riguroso, explicativo, con autores, conceptos y aplicación práctica en español.'
            : 'Estilo didáctico claro y accesible paso a paso en español.',
          subjectContext ? `Contexto de materia: ${subjectContext.slice(0, 4000)}` : '',
          'Nunca inventes fuentes, autores ni enlaces.',
        ]
          .filter(Boolean)
          .join('\n');

        setStreamingText('');
        const gwRes =
          adminSettings.enableStreaming && useGatewayStream
            ? await sendGatewayChatStream({
                prompt: fullGatewayPrompt,
                systemInstruction: gatewaySys,
                history: messages.map((m) => ({ role: m.role, text: m.text })),
                routingMode,
                requestedProviderId: selectedProviderId,
                requestedModelId: selectedModelId || undefined,
                useWebSearch,
                attachment,
                onChunk: (delta) => setStreamingText((prev) => prev + delta),
              })
            : await sendGatewayChat({
                prompt: fullGatewayPrompt,
                systemInstruction: gatewaySys,
                history: messages.map((m) => ({ role: m.role, text: m.text })),
                routingMode,
                requestedProviderId: selectedProviderId,
                requestedModelId: selectedModelId || undefined,
                useWebSearch,
                attachment,
              });

        setStreamingText('');
        const gwSources: AIWebSource[] = (gwRes.sources || []).map((s) => ({
          title: s.title,
          url: s.url,
          domain: s.domain || '',
        }));
        const aiMsg: AIChatMessage = {
          id: `m_${Date.now()}`,
          role: 'model',
          text: gwRes.text,
          timestamp: new Date().toISOString(),
          depth: responseDepth,
          workMode: effectiveWorkMode,
          providerUsed: `${gwRes.providerName} (${gwRes.apiModelName})`,
          providerId: gwRes.providerId,
          modelUsed: gwRes.apiModelName,
          accessTier: gwRes.accessTier,
          inputTokens: gwRes.inputTokens,
          outputTokens: gwRes.outputTokens,
          estimatedCostUsd: gwRes.estimatedCostUsd,
          latencyMs: gwRes.latencyMs,
          routingReason: gwRes.routingReason,
          fallbackNotice: gwRes.fallbackNotice,
          ...(gwSources.length > 0 ? { webSources: gwSources } : {}),
        };

        const fullThreadMessages = [...nextMessages, aiMsg];
        setMessages(fullThreadMessages);
        setAttachment(null);

        void recordGatewayTurn({
          conversationId: convId,
          userPrompt: textToSend || `Adjunto: ${attachment?.name || 'Archivo'}`,
          result: gwRes,
        });

        void logStudySession({
          subjectId,
          activityType: 'tutor_ai',
          durationMinutes: 8,
          topic: convTitle,
          date: new Date().toISOString().slice(0, 10),
        });
        return;
      }

      // FABRO IA 2.0 Full Dual-Research Academic Pipeline
      const legacyProvider = selectedProviderId === 'gemini' ? 'gemini' : 'auto';

      const resp = await authFetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          mode,
          workMode: effectiveWorkMode,
          responseDepth,
          aiProvider: legacyProvider,
          useWebSearch,
          educationLevel: profile?.educationLevel || 'universitario',
          subjectContext,
          subjectName: activeSubject?.name || '',
          documentsContext,
          studyAnalysis,
          academicMemory: activeSubjectMemory
            ? {
                developedTopics: activeSubjectMemory.developedTopics,
                priorSummaries: activeSubjectMemory.priorSummaries,
                examQuestionsHistory: activeSubjectMemory.examQuestionsHistory,
                verifiedBibliography: activeSubjectMemory.verifiedBibliography,
                authorsAndTheories: activeSubjectMemory.authorsAndTheories,
                studentProgressNotes: activeSubjectMemory.studentProgressNotes,
              }
            : null,
          attachmentBase64: attachment?.base64 || '',
          attachmentMimeType: attachment?.mimeType || '',
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No se pudo obtener respuesta de FABRO IA 2.0.');
        return;
      }

      const rawSources: AIWebSource[] = Array.isArray(data.sources)
        ? data.sources
            .filter((s: unknown): s is { title?: string; url: string; domain?: string; originType?: string; readInFull?: boolean; consultedAt?: string } =>
              Boolean(s && typeof (s as { url?: unknown }).url === 'string')
            )
            .slice(0, 12)
            .map((s: { title?: string; url: string; domain?: string; originType?: string; readInFull?: boolean; consultedAt?: string }) => ({
              title: String(s.title || s.domain || 'Fuente académica'),
              url: String(s.url),
              domain: String(s.domain || ''),
              ...(s.originType ? { originType: String(s.originType) } : {}),
              ...(typeof s.readInFull === 'boolean' ? { readInFull: s.readInFull } : {}),
              ...(s.consultedAt ? { consultedAt: String(s.consultedAt) } : {}),
            }))
        : [];

      const rawQueries: string[] = Array.isArray(data.searchQueries)
        ? data.searchQueries.filter((q: unknown): q is string => typeof q === 'string').slice(0, 6)
        : [];

      const analysisMetadata = data.analysisMetadata as FabroAnalysisMetadata | undefined;
      const inTok = Math.max(1, Math.ceil((textToSend.length + subjectContext.length) / 4));
      const outTok = Math.max(1, Math.ceil(String(data.reply || '').length / 4));

      const aiMsg: AIChatMessage = {
        id: `m_${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toISOString(),
        depth: responseDepth,
        workMode: (data.workMode as FabroWorkMode) || effectiveWorkMode,
        ...(analysisMetadata ? { analysisMetadata } : {}),
        ...(typeof data.providerUsed === 'string' && data.providerUsed ? { providerUsed: data.providerUsed } : {}),
        providerId: String(data.providerUsed || '').includes('chatgpt') ? 'openai' : 'gemini',
        accessTier: String(data.providerUsed || '').includes('chatgpt') ? 'commercial' : 'free_quota',
        inputTokens: inTok,
        outputTokens: outTok,
        routingReason: 'Pipeline académico FABRO IA 2.0 (Doble investigación Documentos + Internet).',
        ...(rawSources.length > 0 ? { webSources: rawSources } : {}),
        ...(rawQueries.length > 0 ? { searchQueries: rawQueries } : {}),
      };

      const fullThreadMessages = [...nextMessages, aiMsg];
      setMessages(fullThreadMessages);
      setAttachment(null);

      const threadTitle =
        analysisMetadata?.topicTitle || fullThreadMessages[0]?.text.slice(0, 70) || 'Tutoría FABRO IA';
      const savedId = await saveAIChatThread(activeThreadId, {
        subjectId,
        title: threadTitle,
        mode,
        selectedDocIds,
        messages: fullThreadMessages,
      });
      setActiveThreadId(savedId);

      void recordGatewayTurn({
        conversationId: convId,
        userPrompt: textToSend || `Adjunto: ${attachment?.name || 'Archivo'}`,
        result: {
          text: data.reply,
          providerId: String(data.providerUsed || '').includes('chatgpt') ? 'openai' : 'gemini',
          providerName: String(data.providerUsed || '').includes('chatgpt') ? 'OpenAI' : 'Google Gemini',
          modelId: 'gemini__gemini-4-hydrogen',
          apiModelName: String(data.providerUsed || 'gemini-4-hydrogen'),
          accessTier: String(data.providerUsed || '').includes('chatgpt') ? 'commercial' : 'free_quota',
          inputTokens: inTok,
          outputTokens: outTok,
          totalTokens: inTok + outTok,
          estimatedCostUsd: 0,
          latencyMs: 0,
          routingMode: 'automatica',
          routingReason: 'Pipeline académico FABRO IA 2.0 (Documentos + Internet).',
          fallbackUsed: false,
        },
      });

      // Persist Subject Academic Memory asynchronously
      if (data.memoryUpdateSuggestion) {
        void upsertSubjectMemory(subjectId || '', {
          developedTopic: data.memoryUpdateSuggestion.developedTopic,
          summarySnippet: data.memoryUpdateSuggestion.summarySnippet,
          authorsAndTheories: data.memoryUpdateSuggestion.authorsAndTheories,
          verifiedBibliography: data.memoryUpdateSuggestion.verifiedBibliography,
          examQuestions: data.memoryUpdateSuggestion.examQuestions,
        });
      }

      void logStudySession({
        subjectId,
        activityType: 'tutor_ai',
        durationMinutes: responseDepth === 'exhaustivo' || responseDepth === 'desarrollo_completo' ? 12 : 6,
        topic: threadTitle,
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      setStreamingText('');
      setError(err instanceof Error ? err.message : 'Error de red al conectar con FABRO AI Gateway.');
    } finally {
      setSending(false);
    }
  };

  const handleCopyReply = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      window.setTimeout(() => setCopiedId((prev) => (prev === msgId ? null : prev)), 2200);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  };

  const handleSaveReplyToNotes = async (msg: AIChatMessage) => {
    try {
      const sourcesMarkdown =
        msg.webSources && msg.webSources.length > 0
          ? `\n\n## Fuentes web verificadas\n${msg.webSources
              .map((s) => `- [${s.title}](${s.url})${s.originType ? ` — ${s.originType}` : ''}${s.consultedAt ? ` (${s.consultedAt})` : ''}`)
              .join('\n')}`
          : '';
      const combinedText = `${msg.text}${sourcesMarkdown}`;
      const topicHeading = msg.analysisMetadata?.topicTitle || activeSubjectName;
      await createNote({
        subjectId,
        unit: '',
        folder: 'Desarrollos FABRO IA',
        title: `${msg.workMode || 'DESARROLLO'} · ${topicHeading}`.slice(0, 180),
        contentHtml: markdownToHtml(combinedText),
        contentText: combinedText,
        tags: ['fabro-ia-2', (msg.workMode || workMode).toLowerCase(), mode],
        attachments: [],
        offlineAvailable: true,
      });
      setSavedNotice('Desarrollo académico guardado en Apuntes con formato completo.');
      window.setTimeout(() => setSavedNotice(''), 3000);
    } catch {
      setError('No se pudo guardar el desarrollo en Apuntes.');
    }
  };

  const activeSubjectName = subjects.find((s) => s.id === subjectId)?.name || 'Consulta general';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:h-[calc(100dvh-8.5rem)]">
      {/* Left Configuration & Study Context Panel */}
      <aside
        className={`lg:col-span-4 space-y-4 lg:overflow-y-auto pr-0.5 ${
          showMobileConfig ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                FABRO IA 2.0 · Motor Académico
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Doble investigación · Documentos + Internet
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={startNewThread}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva
              </button>
              <button
                type="button"
                onClick={() => setShowMobileConfig(false)}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Cerrar configuración"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Internet Grounding Toggle */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className={`w-4 h-4 ${useWebSearch ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Motor 2: Internet + Lectura URL
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useWebSearch}
                onClick={() => setUseWebSearch((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  useWebSearch ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    useWebSearch ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {useWebSearch
                ? 'Prioriza universidades, revistas científicas y organismos oficiales; lee las URLs reales encontradas.'
                : 'Solo analiza tus documentos propios, apuntes y teoría consolidada.'}
            </p>
          </div>

          {/* Subject Selector + Persistent Academic Memory */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Materia activa y Memoria académica
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            >
              <option value="">Consulta general</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  Memoria académica activa
                </span>
                <button
                  type="button"
                  onClick={() => setShowMemoryDetails((v) => !v)}
                  className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {showMemoryDetails ? 'Ocultar' : 'Ver detalle'}
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {activeSubjectMemory
                  ? `${activeSubjectMemory.developedTopics.length} tema(s) · ${activeSubjectMemory.authorsAndTheories.length} autor(es) · ${activeSubjectMemory.verifiedBibliography.length} ref(s)`
                  : 'Se construirá automáticamente con cada desarrollo de esta materia.'}
              </p>
              {showMemoryDetails && activeSubjectMemory && (
                <div className="pt-1.5 border-t border-indigo-500/20 space-y-1 text-[10px] text-slate-600 dark:text-slate-300">
                  {activeSubjectMemory.developedTopics.length > 0 && (
                    <p>
                      <strong>Temas:</strong> {activeSubjectMemory.developedTopics.slice(-5).join(' · ')}
                    </p>
                  )}
                  {activeSubjectMemory.authorsAndTheories.length > 0 && (
                    <p>
                      <strong>Autores:</strong> {activeSubjectMemory.authorsAndTheories.slice(-6).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {subjectExamStats.completedCount > 0 && (
              <button
                type="button"
                onClick={() => setIncludeExamDiagnosis((v) => !v)}
                className={`w-full flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] cursor-pointer ${
                  includeExamDiagnosis
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {includeExamDiagnosis ? (
                  <CheckSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                )}
                <span>
                  Diagnóstico de exámenes ({subjectExamStats.completedCount} ·{' '}
                  {subjectExamStats.weakTopics.length > 0
                    ? `${subjectExamStats.weakTopics.length} tema(s) a reforzar`
                    : `promedio ${subjectExamStats.avgScore}%`}
                  )
                </span>
              </button>
            )}
          </div>

          {/* Authorized Documents with Coverage Badges */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Motor 1: Documentos de biblioteca ({selectedDocIds.length}/10)
            </label>
            {authorizedDocs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Subí archivos en Biblioteca con autorización IA para usarlos en el análisis documental.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {authorizedDocs.map((d) => {
                  const checked = selectedDocIds.includes(d.id);
                  const cov = d.coverage;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDocSelection(d.id)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs cursor-pointer ${
                        checked
                          ? 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {checked ? <CheckSquare className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                        <span className="truncate">{d.title}</span>
                      </span>
                      {cov && (
                        <span
                          className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${
                            cov.readStatus === 'completo'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {cov.processedPages}/{cov.totalPages}p
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Student Notes to Analyze */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Apuntes a analizar ({selectedNoteIds.length}/6)
              </label>
              {relevantNotes.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectRecentNotesForSubject}
                    className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Últimos 3
                  </button>
                  {selectedNoteIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedNoteIds([])}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              )}
            </div>
            {relevantNotes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Creá apuntes para contrastarlos con tus documentos y fuentes externas.
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {relevantNotes.slice(0, 15).map((note) => {
                  const checked = selectedNoteIds.includes(note.id);
                  const subjName = subjects.find((s) => s.id === note.subjectId)?.name;
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => toggleNoteSelection(note.id)}
                      className={`w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs cursor-pointer ${
                        checked
                          ? 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate flex-1">{note.title}</span>
                      {subjName && !subjectId && (
                        <span className="text-[10px] opacity-60 shrink-0 max-w-[80px] truncate">
                          {subjName}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Response Depth Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Profundidad del desarrollo
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              {(
                [
                  { id: 'desarrollo_completo', label: 'Desarrollo completo' },
                  { id: 'exhaustivo', label: 'Exhaustivo XHIGH' },
                  { id: 'profundo', label: 'Profundo' },
                  { id: 'directo', label: 'Directo' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResponseDepth(opt.id)}
                  className={`py-1.5 px-2 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                    responseDepth === opt.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Selector: Modo sencillo vs Modo académico */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Estilo pedagógico
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setMode('academico')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'academico'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Universitario
              </button>
              <button
                type="button"
                onClick={() => setMode('sencillo')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'sencillo'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Didáctico claro
              </button>
            </div>
          </div>

          {/* Smart Execution Selector: FABRO IA vs Connected Personal AIs */}
          <div className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-900 dark:text-white">
                Cuenta ejecutora (Aislamiento de costos)
              </label>
              <button
                type="button"
                onClick={() => setActiveSection('connect')}
                className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
              >
                + Conectar IA
              </button>
            </div>
            <select
              aria-label="Selector inteligente de cuenta de IA"
              value={executionTarget}
              onChange={(e) => {
                setExecutionTarget(e.target.value);
                setPendingSwitchApproval(null);
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
            >
              <option value="fabro">Usar FABRO IA (Cuota de la plataforma)</option>
              {verifiedPersonalConnections.map((conn) => (
                <option key={conn.id} value={`personal:${conn.id}`}>
                  {conn.label} · personal ({conn.selectedModel}) — 0 cuota FABRO
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-slate-400">
              <span>
                {selectedPersonalConnection
                  ? `Facturación PERSONAL (${selectedPersonalConnection.maskedKey}) · ID ${computeFabroId(user?.uid, profile?.customFabroId)}`
                  : 'Usa tus consultas disponibles del plan FABRO (sincronizado con Sector IA).'}
              </span>
              {verifiedPersonalConnections.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCompareSelectedIds(verifiedPersonalConnections.slice(0, 4).map((c) => c.id));
                    setComparePromptInput(input.trim());
                    setPersonalCompareOpen(true);
                  }}
                  className="font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer shrink-0"
                >
                  Comparar IAs conectadas
                </button>
              )}
            </div>
          </div>

          {/* FABRO AI GATEWAY + Model Router Selector */}
          <div className="space-y-2.5 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                AI Gateway · Enrutamiento
              </label>
              <button
                type="button"
                onClick={() => openPlansModal()}
                className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer"
              >
                {freemiumStatus
                  ? `Plan ${freemiumStatus.planLabel} (${freemiumStatus.usedToday}/${freemiumStatus.dailyLimit})`
                  : effectivePlanPolicy === 'plan_administrador'
                    ? 'Admin'
                    : effectivePlanPolicy === 'plan_gratuito'
                      ? 'Plan GRATIS'
                      : 'Plan PREMIUM'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setRoutingMode('automatica');
                  setSelectedProviderId('auto');
                  setSelectedModelId('');
                }}
                className={`py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  routingMode === 'automatica'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Automático
              </button>
              <button
                type="button"
                onClick={() => setRoutingMode('manual')}
                className={`py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  routingMode === 'manual'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('hub')}
                className="py-1.5 text-[11px] font-semibold rounded-md text-sky-600 dark:text-sky-400 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                Comparar
              </button>
            </div>

            {routingMode === 'manual' ? (
              <div className="space-y-2">
                <select
                  value={selectedProviderId}
                  onChange={(e) => {
                    const nextId = e.target.value as AIProviderId;
                    const prov = selectableProviders.find((p) => p.id === nextId);
                    if (
                      prov &&
                      prov.accessTier === 'commercial' &&
                      freemiumStatus &&
                      !freemiumStatus.allowPaidModels
                    ) {
                      openPlansModal(
                        `El proveedor comercial ${prov.name} requiere FABRO PREMIUM o presupuesto comercial habilitado.`
                      );
                      return;
                    }
                    setSelectedProviderId(nextId);
                    setSelectedModelId(prov?.defaultModelId || '');
                  }}
                  aria-label="Seleccionar proveedor de IA"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  {selectableProviders.map((p) => {
                    const tierLabel =
                      p.accessTier === 'open_selfhosted'
                        ? 'Autoalojado'
                        : p.accessTier === 'free_quota'
                          ? 'Cuota gratuita'
                          : freemiumStatus && !freemiumStatus.allowPaidModels
                            ? 'PREMIUM'
                            : 'Comercial';
                    const availLabel = !p.enabled
                      ? 'Desactivado'
                      : p.configuredInBackend
                        ? 'Conectado'
                        : 'Pendiente';
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} · {tierLabel} · {availLabel}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  aria-label="Seleccionar modelo"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                >
                  {modelsForSelectedProvider.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} {!m.enabled ? '(Desactivado)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                FABRO Model Router analiza complejidad, adjuntos, límite y disponibilidad para elegir el mejor motor automáticamente.
              </p>
            )}

            <label className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer pt-1 border-t border-sky-500/15">
              <span>Modo streaming rápido (Multi-IA Gateway)</span>
              <input
                type="checkbox"
                checked={useGatewayStream}
                onChange={(e) => setUseGatewayStream(e.target.checked)}
                className="rounded border-slate-300 text-sky-600"
              />
            </label>
          </div>

          {/* Visual Study Shortcuts */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                setVisualModal({
                  open: true,
                  kind: 'esquema',
                  topic: activeSubjectName !== 'Consulta general' ? activeSubjectName : '',
                  context: messages.slice(-2).map((m) => m.text).join('\n\n'),
                })
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Esquema
            </button>
            <button
              type="button"
              onClick={() =>
                setVisualModal({
                  open: true,
                  kind: 'linea_cronologica',
                  topic: activeSubjectName !== 'Consulta general' ? activeSubjectName : '',
                  context: messages.slice(-2).map((m) => m.text).join('\n\n'),
                })
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Cronología
            </button>
            <button
              type="button"
              onClick={() => setImageStudioOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Imagen IA
            </button>
            <button
              type="button"
              onClick={() => setWikiSearchOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Enciclopedia
            </button>
          </div>
        </div>

        {/* Saved Threads (Gateway + Tutor 2.0) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <h3 className="font-display text-xs font-semibold text-slate-700 dark:text-slate-300">
              Historial de conversaciones
            </h3>
            <div className="flex items-center gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setThreadListTab('gateway')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  threadListTab === 'gateway'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Gateway ({gatewayConversations.length})
              </button>
              <button
                type="button"
                onClick={() => setThreadListTab('tutor')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  threadListTab === 'tutor'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Tutor ({aiChats.length})
              </button>
            </div>
          </div>

          {threadListTab === 'gateway' ? (
            gatewayConversations.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                Tus conversaciones Multi-IA aparecerán aquí automáticamente.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                {gatewayConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                      activeGatewayConvId === conv.id ? 'bg-sky-500/10' : ''
                    }`}
                  >
                    {renamingConvId === conv.id ? (
                      <form
                        className="flex-1 flex items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void renameConversation(conv.id, renameTitleInput);
                          setRenamingConvId(null);
                        }}
                      >
                        <input
                          type="text"
                          value={renameTitleInput}
                          onChange={(e) => setRenameTitleInput(e.target.value)}
                          className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="text-[11px] font-semibold text-sky-600 cursor-pointer"
                        >
                          OK
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => loadGatewayConversation(conv.id)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {conv.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {conv.lastModelUsed || conv.routingMode} · {conv.messageCount} msj
                        </p>
                      </button>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void toggleFavoriteConversation(conv.id, !conv.favorite)}
                        aria-label="Favorito"
                        className={`p-1 cursor-pointer ${
                          conv.favorite ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${conv.favorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingConvId(conv.id);
                          setRenameTitleInput(conv.title);
                        }}
                        aria-label="Renombrar"
                        className="p-1 text-slate-400 hover:text-sky-600 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeGatewayConvId === conv.id) startNewThread();
                          void deleteConversation(conv.id);
                        }}
                        aria-label="Eliminar conversación"
                        className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : aiChats.length === 0 ? (
            <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
              Tus desarrollos académicos guardados aparecerán aquí.
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {aiChats.map((thread) => (
                <div
                  key={thread.id}
                  className={`px-4 py-2.5 flex items-center justify-between gap-2 ${
                    activeThreadId === thread.id ? 'bg-sky-500/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadThread(thread.id)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                      {thread.title}
                    </p>
                    <p className="text-[11px] text-slate-500 capitalize">{thread.mode}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAIChatThread(thread.id)}
                    className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                    aria-label="Eliminar conversación"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Viewport */}
      <section className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden h-[calc(100dvh-10rem)] lg:h-auto min-h-[480px]">
        {/* Context Header Bar */}
        <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {activeSubjectName} · <span className="text-sky-600 dark:text-sky-400">/{workMode}</span> ·{' '}
              <span>Desarrollo universitario completo</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {useWebSearch ? 'Documentos propios + Internet académico' : 'Solo documentos propios'} ·{' '}
              {selectedDocIds.length} doc(s) · {selectedNoteIds.length} apunte(s)
              {activeSubjectMemory && activeSubjectMemory.developedTopics.length > 0
                ? ` · Memoria: ${activeSubjectMemory.developedTopics.length} tema(s)`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setImageStudioOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/40 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span className="hidden sm:inline">Imagen IA</span>
            </button>
            {freemiumStatus && (
              <button
                type="button"
                onClick={() => openPlansModal()}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                  freemiumStatus.remainingToday <= 0 && freemiumStatus.extraCredits <= 0
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-sky-500/40'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-mono tabular-nums">
                  {freemiumStatus.planLabel} · {freemiumStatus.usedToday}/{freemiumStatus.dailyLimit}
                </span>
              </button>
            )}
            <div className="flex items-center gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={startNewThread}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva
              </button>
              <button
                type="button"
                onClick={() => setShowMobileConfig((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-600/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Opciones
              </button>
            </div>
          </div>
        </div>

        {/* 10 Work Modes Bar */}
        <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B111C] overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {WORK_MODE_OPTIONS.map((wm) => {
              const active = workMode === wm.id;
              return (
                <button
                  key={wm.id}
                  type="button"
                  onClick={() => setWorkMode(wm.id)}
                  title={`${wm.command} — ${wm.shortDesc}`}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-500/40'
                  }`}
                >
                  {wm.command}
                </button>
              );
            })}
          </div>
        </div>

        {!isOnline && (
          <div className="px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>FABRO IA 2.0 requiere conexión a internet. Podés revisar tus desarrollos guardados o editar Apuntes sin conexión.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5">
          {messages.length === 0 ? (
            <div className="py-6 sm:py-8 max-w-2xl mx-auto space-y-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  FABRO IA 2.0 · Investigación y Desarrollo Universitario
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Combina tus documentos propios (Motor 1) con investigación académica real en universidades y revistas científicas (Motor 2), diferenciando hechos documentales, evidencia externa, análisis propio y lo no verificado.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {QUICK_PROMPTS.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void handleSend(q)}
                    className={`rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 hover:border-sky-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                      i === QUICK_PROMPTS.length - 1 ? 'sm:col-span-2' : ''
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[96%] sm:max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-sky-600 text-white'
                      : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {msg.attachmentName && (
                    <p className="text-[11px] opacity-85 mb-1">Adjunto: {msg.attachmentName}</p>
                  )}
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  ) : (
                    <>
                      {/* Section 3 Structured Visual Result Summary Card */}
                      {msg.analysisMetadata && (
                        <div className="mb-4 rounded-xl border border-sky-500/30 bg-white dark:bg-[#0B111C] p-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="inline-flex items-center gap-1 rounded-md bg-sky-600/15 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[11px] font-bold">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Modo {msg.analysisMetadata.workMode.toLowerCase()}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {msg.analysisMetadata.topicTitle}
                              </span>
                            </div>
                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                              Referencias vinculadas · Verificadas ({msg.analysisMetadata.verifiedReferencesCount})
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5 border border-slate-200/70 dark:border-slate-800">
                              <span className="text-slate-500 dark:text-slate-400">Documentos propios:</span>{' '}
                              <strong className="text-slate-900 dark:text-white font-mono">
                                {msg.analysisMetadata.docsProcessedCount}/{msg.analysisMetadata.docsSelectedCount}
                              </strong>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5 border border-slate-200/70 dark:border-slate-800">
                              <span className="text-slate-500 dark:text-slate-400">Fuentes externas:</span>{' '}
                              <strong className="text-slate-900 dark:text-white font-mono">
                                {msg.analysisMetadata.externalSourcesCount} ({msg.analysisMetadata.urlContextReadCount} leídas URL)
                              </strong>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5 border border-slate-200/70 dark:border-slate-800">
                              <span className="text-slate-500 dark:text-slate-400">Nivel:</span>{' '}
                              <strong className="text-slate-900 dark:text-white">
                                {msg.analysisMetadata.depthLevel}
                              </strong>
                            </div>
                          </div>

                          {msg.analysisMetadata.partialDocsNames &&
                            msg.analysisMetadata.partialDocsNames.length > 0 && (
                              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                  Cobertura parcial: {msg.analysisMetadata.partialDocsNames.join('; ')}
                                </span>
                              </div>
                            )}

                          {msg.analysisMetadata.generatedSections.length > 0 && (
                            <div className="pt-1 border-t border-slate-200/80 dark:border-slate-800">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                                Contenido generado ({msg.analysisMetadata.generatedSections.length} apartados)
                              </p>
                              <div className="flex flex-wrap gap-x-3 gap-y-1">
                                {msg.analysisMetadata.generatedSections.slice(0, 10).map((sec, sIdx) => (
                                  <span
                                    key={`${sec}_${sIdx}`}
                                    className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                    {sec}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.fallbackNotice && (
                        <div className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{msg.fallbackNotice}</span>
                        </div>
                      )}

                      <div className="fabro-markdown">
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                      </div>

                      {msg.webSources && msg.webSources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            Fuentes externas verificadas ({msg.webSources.length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {msg.webSources.map((src, idx) => (
                              <a
                                key={`${src.url}_${idx}`}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {src.title || src.domain || src.url}
                                  </p>
                                  {(src.originType || src.readInFull) && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                      {src.originType || src.domain}
                                      {src.readInFull ? ' · Leída URL completa' : ''}
                                    </p>
                                  )}
                                </div>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {msg.role === 'model' && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
                    {msg.providerUsed && (
                      <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {msg.providerUsed}
                        {typeof msg.inputTokens === 'number' && typeof msg.outputTokens === 'number'
                          ? ` · ${(msg.inputTokens + msg.outputTokens).toLocaleString('es-AR')} tok`
                          : ''}
                        {typeof msg.estimatedCostUsd === 'number' && msg.estimatedCostUsd > 0
                          ? ` · ~$${msg.estimatedCostUsd.toFixed(4)}`
                          : ''}
                        {typeof msg.latencyMs === 'number' && msg.latencyMs > 0
                          ? ` · ${(msg.latencyMs / 1000).toFixed(1)}s`
                          : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSaveReplyToNotes(msg)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 font-medium cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Guardar en Apuntes
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportMarkdownToPdf({
                          title: msg.analysisMetadata?.topicTitle || `Desarrollo FABRO · ${activeSubjectName}`,
                          subjectName: activeSubjectName,
                          sourceUrls: msg.webSources,
                          markdown: msg.text,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void exportMarkdownToWord({
                          title: msg.analysisMetadata?.topicTitle || `Desarrollo FABRO · ${activeSubjectName}`,
                          subjectName: activeSubjectName,
                          sourceUrls: msg.webSources,
                          markdown: msg.text,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyReply(msg.id, msg.text)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                    <a
                      href={
                        buildWhatsAppShareHref(
                          formatForWhatsApp({
                            title: `FABRO IA 2.0 · ${activeSubjectName}`,
                            body: msg.text,
                          })
                        ).href
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setVisualModal({
                          open: true,
                          kind: 'esquema',
                          topic: msg.analysisMetadata?.topicTitle || (activeSubjectName !== 'Consulta general' ? activeSubjectName : ''),
                          context: msg.text,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      Esquema
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReadingMsg({
                          title: msg.analysisMetadata?.topicTitle || `Clase FABRO IA · ${activeSubjectName}`,
                          text: msg.text,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Lectura IA
                    </button>
                    <AudioReadAloudControl
                      compact
                      getText={() => msg.text}
                      title={`fabro-ai_${activeSubjectName}`}
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {streamingText && (
            <div className="flex flex-col items-start">
              <div className="max-w-[96%] sm:max-w-[88%] rounded-2xl px-4 py-3 text-sm border border-sky-500/30 bg-slate-50 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100">
                <div className="fabro-markdown">
                  <Markdown remarkPlugins={[remarkGfm]}>{streamingText}</Markdown>
                </div>
              </div>
            </div>
          )}

          {sending && !streamingText && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2.5">
              <span>
                Ejecutando <strong>/{workMode}</strong> ·{' '}
                {routingMode === 'manual'
                  ? `FABRO AI Gateway (${selectedProviderId})`
                  : 'FABRO Model Router + Análisis documental e investigación académica...'}
              </span>
            </div>
          )}

          {pendingSwitchApproval && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-100 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Tu conexión personal ({pendingSwitchApproval.failedLabel}) no pudo responder.
              </p>
              <p className="text-[11px] opacity-90">
                FABRO bloqueó el cambio automático para proteger tu cuota. ¿Autorizás reintentar esta consulta usando FABRO IA?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const retryPrompt = pendingSwitchApproval.promptText;
                    setPendingSwitchApproval(null);
                    setExecutionTarget('fabro');
                    setError('');
                    window.setTimeout(() => void handleSend(retryPrompt), 20);
                  }}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Autorizar y usar FABRO IA
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('connect')}
                  className="rounded-lg border border-amber-500/40 px-3 py-1.5 font-semibold cursor-pointer"
                >
                  Revisar en FABRO CONNECT
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {savedNotice && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              {savedNotice}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Composer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {attachment && (
            <div className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-900 px-3 py-1.5 text-xs">
              <span className="truncate">Archivo listo para analizar: {attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="text-red-500 hover:underline ml-2 cursor-pointer"
              >
                Quitar
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-end gap-2"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => void handleAttach(e)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Adjuntar imagen o PDF"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={`Escribí tu consulta o usá /${workMode} (también podés pegar una URL o adjuntar un PDF)...`}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={sending || !isOnline}
              className="inline-flex items-center justify-center rounded-xl bg-sky-600 p-3 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              aria-label="Enviar consulta"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      <VisualStudyStudioModal
        isOpen={visualModal.open}
        onClose={() => setVisualModal((prev) => ({ ...prev, open: false }))}
        initialKind={visualModal.kind}
        defaultTopic={visualModal.topic}
        defaultContext={visualModal.context}
        subjectId={subjectId}
        subjectName={activeSubjectName !== 'Consulta general' ? activeSubjectName : ''}
      />

      <AIReadingModeModal
        isOpen={Boolean(readingMsg)}
        onClose={() => setReadingMsg(null)}
        title={readingMsg?.title || 'Lectura FABRO IA'}
        subjectName={activeSubjectName !== 'Consulta general' ? activeSubjectName : ''}
        contentText={readingMsg?.text || ''}
      />

      <WikiImageFinderModal
        isOpen={wikiSearchOpen}
        onClose={() => setWikiSearchOpen(false)}
        initialQuery={
          input.trim() ||
          (activeSubjectName !== 'Consulta general' ? activeSubjectName : '')
        }
        canInsert={false}
      />

      <FabroAIImageStudioModal
        isOpen={imageStudioOpen}
        onClose={() => setImageStudioOpen(false)}
        subjectId={subjectId}
        subjectName={activeSubjectName !== 'Consulta general' ? activeSubjectName : ''}
        initialPrompt={input.trim()}
      />

      {personalCompareOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[88dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col gap-4 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Comparar múltiples IA personales conectadas (0 cuota FABRO)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cada proveedor responde en paralelo usando exclusivamente tus credenciales verificadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPersonalCompareOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {verifiedPersonalConnections.map((c) => {
                const picked = compareSelectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCompareSelectedIds((prev) =>
                        picked ? prev.filter((id) => id !== c.id) : [...prev, c.id].slice(0, 4)
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      picked
                        ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {c.label} ({c.selectedModel})
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={comparePromptInput}
                onChange={(e) => setComparePromptInput(e.target.value)}
                placeholder="Escribí la consigna o pregunta para comparar entre tus IAs..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
              />
              <button
                type="button"
                disabled={compareLoading || !comparePromptInput.trim() || compareSelectedIds.length === 0}
                onClick={async () => {
                  setCompareLoading(true);
                  try {
                    const out = await comparePersonalConnections({
                      connectionIds: compareSelectedIds,
                      prompt: comparePromptInput.trim(),
                    });
                    setCompareOutput(out.results);
                  } finally {
                    setCompareLoading(false);
                  }
                }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                {compareLoading ? 'Comparando...' : 'Comparar ahora'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
              {compareOutput.map((r) => (
                <div
                  key={r.connectionId}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <strong className="text-slate-900 dark:text-white">{r.label}</strong>
                    <span className="font-mono text-[10px] text-slate-500">
                      {r.modelUsed} {r.latencyMs > 0 ? `· ${(r.latencyMs / 1000).toFixed(1)}s` : ''}
                    </span>
                  </div>
                  {r.status === 'error' ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{r.error}</p>
                  ) : (
                    <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {r.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
