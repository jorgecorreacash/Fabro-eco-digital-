import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  CalendarClock,
  Check,
  CheckSquare,
  Copy,
  Edit3,
  FilePlus2,
  FileText,
  KeyRound,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  sendByokChatCompletion,
  type ByokPromptAttachment,
} from '../../../services/byokChatClient';
import { vaultGet, vaultSet } from '../../../services/localVault';
import type {
  ByokConversationMessage,
  ByokConversationThread,
} from '../../../types/ecosystem';

const QUICK_SUGGESTIONS: Array<{
  id: string;
  sectorLabel: string;
  title: string;
  description: string;
  prompt: string;
  needsNotePicker?: boolean;
  icon: React.FC<{ className?: string }>;
  accentClass: string;
}> = [
  {
    id: 'sug-resumir',
    sectorLabel: 'Sector 1 · Estudio',
    title: 'Resumir apunte',
    description: 'Síntesis estructurada con idea principal y puntos clave para repasar.',
    prompt:
      'Resumí de forma clara y estructurada el material adjunto en: 1) Idea principal, 2) Conceptos clave con definiciones breves y 3) 3 preguntas tipo examen para autoevaluarme.',
    needsNotePicker: true,
    icon: BookOpen,
    accentClass: 'text-blue-500',
  },
  {
    id: 'sug-plan',
    sectorLabel: 'Estudio + Organizador',
    title: 'Armar plan de estudio',
    description: 'Bloques horarios con Pomodoro y prioridades para rendir sin agotarte.',
    prompt:
      'Armame un plan de estudio realista para los próximos 5 días usando bloques Pomodoro de 25/5 y descanso activo. Preguntame o proponeme horarios equilibrados.',
    icon: CalendarClock,
    accentClass: 'text-sky-500',
  },
  {
    id: 'sug-estoica',
    sectorLabel: 'Sector 2 · Bienestar',
    title: 'Reflexión estoica',
    description: 'Perspectiva serena para enfocar la atención en lo que sí controlás hoy.',
    prompt:
      'Compartime una reflexión estoica práctica para hoy, separando qué depende de mí y qué no, con 2 preguntas breves para escribir en mi diario personal.',
    icon: Sparkles,
    accentClass: 'text-emerald-500',
  },
  {
    id: 'sug-informe',
    sectorLabel: 'Investigación',
    title: 'Redactar informe',
    description: 'Borrador profesional con introducción, desarrollo y conclusiones.',
    prompt:
      'Ayudame a redactar un informe claro y formal. Proponeme primero una estructura de secciones y luego pedime el tema o los puntos que quiero desarrollar.',
    icon: FileText,
    accentClass: 'text-violet-500',
  },
];

function groupLabelByDate(tsMs: number): 'Hoy' | 'Ayer' | 'Anteriores' {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  if (tsMs >= startOfToday) return 'Hoy';
  if (tsMs >= startOfYesterday) return 'Ayer';
  return 'Anteriores';
}

function escapeHtmlBasic(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownToSimpleHtml(md: string): string {
  return md
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtmlBasic(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

const CodeBlockWithCopy: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({ className, children }) => {
  const [copied, setCopied] = useState(false);
  const rawCode = String(children ?? '').replace(/\n$/, '');
  const isInline = !className && !rawCode.includes('\n');

  if (isInline) {
    return (
      <code className="rounded-md border fabro-border fabro-surface-elevated px-1.5 py-0.5 font-mono text-[12px]">
        {children}
      </code>
    );
  }

  const lang = className?.replace('language-', '') || 'código';

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(rawCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="my-2.5 rounded-xl border fabro-border overflow-hidden bg-[#0B1120] text-slate-100">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-800 bg-slate-900/90 text-[11px] text-slate-300">
        <span className="font-mono uppercase tracking-wider">{lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-0.5 text-[11px] font-medium hover:bg-slate-800 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copiar código
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{rawCode}</code>
      </pre>
    </div>
  );
};

export const ByokDedicatedChatView: React.FC = () => {
  const {
    byokKeys,
    getByokSecret,
    navigateTo,
    advancedNotes,
    createAdvancedNote,
    updateAdvancedNote,
    addOrganizerTask,
  } = useEcosystem();

  const [threads, setThreads] = useState<ByokConversationThread[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(byokKeys[0]?.id || '');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [promptInput, setPromptInput] = useState('');
  const [attachedDocs, setAttachedDocs] = useState<ByokPromptAttachment[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate saved AI threads locally
  useEffect(() => {
    let active = true;
    void vaultGet<ByokConversationThread[]>('byok_conversations', []).then((saved) => {
      if (!active) return;
      const list = Array.isArray(saved) ? saved : [];
      setThreads(list);
      if (list.length > 0) {
        setActiveThreadId(list[0].id);
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Keep selectedProviderId aligned with available BYOK keys
  useEffect(() => {
    if (byokKeys.length === 0) {
      setSelectedProviderId('');
      return;
    }
    if (!selectedProviderId || !byokKeys.some((k) => k.id === selectedProviderId)) {
      setSelectedProviderId(byokKeys[0].id);
    }
  }, [byokKeys, selectedProviderId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  // Sync provider dropdown when switching threads if that key still exists
  useEffect(() => {
    if (
      activeThread?.providerKeyId &&
      byokKeys.some((k) => k.id === activeThread.providerKeyId)
    ) {
      setSelectedProviderId(activeThread.providerKeyId);
    }
  }, [activeThread?.id, activeThread?.providerKeyId, byokKeys]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.messages.length, sending]);

  const persistThreads = (next: ByokConversationThread[]) => {
    setThreads(next);
    void vaultSet('byok_conversations', next);
  };

  const showToast = (msg: string) => {
    setActionToast(msg);
    window.setTimeout(() => setActionToast(null), 2800);
  };

  const activeProvider = useMemo(
    () => byokKeys.find((k) => k.id === selectedProviderId) || byokKeys[0] || null,
    [byokKeys, selectedProviderId]
  );

  const hasReadySecret = activeProvider ? Boolean(getByokSecret(activeProvider.id)) : false;

  const groupedThreads = useMemo(() => {
    const groups: Record<'Hoy' | 'Ayer' | 'Anteriores', ByokConversationThread[]> = {
      Hoy: [],
      Ayer: [],
      Anteriores: [],
    };
    const sorted = [...threads].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    for (const t of sorted) {
      groups[groupLabelByDate(t.updatedAtMs)].push(t);
    }
    return groups;
  }, [threads]);

  const handleNewConversation = () => {
    const now = Date.now();
    const fresh: ByokConversationThread = {
      id: `ai-thread-${now}`,
      title: 'Nueva conversación',
      providerKeyId: activeProvider?.id || '',
      createdAtMs: now,
      updatedAtMs: now,
      messages: [],
    };
    persistThreads([fresh, ...threads]);
    setActiveThreadId(fresh.id);
    setMobileDrawerOpen(false);
    setAttachedDocs([]);
  };

  const handleDeleteThread = (id: string) => {
    const next = threads.filter((t) => t.id !== id);
    persistThreads(next);
    if (activeThreadId === id) {
      setActiveThreadId(next[0]?.id || null);
    }
  };

  const handleStartRename = (t: ByokConversationThread) => {
    setRenamingId(t.id);
    setRenameDraft(t.title);
  };

  const handleCommitRename = (id: string) => {
    const clean = renameDraft.trim();
    if (clean) {
      persistThreads(threads.map((t) => (t.id === id ? { ...t, title: clean } : t)));
    }
    setRenamingId(null);
  };

  const handleAttachStudyNote = (noteId: string) => {
    const note = advancedNotes.find((n) => n.id === noteId);
    if (!note) return;
    if (attachedDocs.some((d) => d.id === note.id)) {
      setAttachMenuOpen(false);
      return;
    }
    const body = [
      note.mainIdea ? `Idea principal: ${note.mainIdea}` : '',
      note.summaryText ? `Resumen: ${note.summaryText}` : '',
      note.contentText || '',
    ]
      .filter(Boolean)
      .join('\n\n');

    setAttachedDocs((prev) => [
      ...prev,
      {
        id: note.id,
        title: note.title,
        subject: note.subject,
        contentText: body || note.title,
      },
    ]);
    setAttachMenuOpen(false);
  };

  const handleAttachLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setAttachedDocs((prev) => [
        ...prev,
        {
          id: `file-${Date.now()}`,
          title: file.name,
          subject: 'Archivo local',
          contentText: text.slice(0, 10000),
        },
      ]);
      setAttachMenuOpen(false);
    } catch {
      showToast('No se pudo leer el archivo como texto plano.');
    }
    e.target.value = '';
  };

  const handleSendMessage = async (overridePrompt?: string) => {
    const cleanPrompt = (overridePrompt ?? promptInput).trim();
    if (!cleanPrompt || sending || !activeProvider) return;

    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Ensure thread exists
    let targetThread = activeThread;
    let currentThreads = threads;
    if (!targetThread) {
      targetThread = {
        id: `ai-thread-${now}`,
        title: cleanPrompt.slice(0, 42) + (cleanPrompt.length > 42 ? '…' : ''),
        providerKeyId: activeProvider.id,
        createdAtMs: now,
        updatedAtMs: now,
        messages: [],
      };
      currentThreads = [targetThread, ...threads];
      setActiveThreadId(targetThread.id);
    } else if (
      targetThread.messages.length === 0 &&
      targetThread.title === 'Nueva conversación'
    ) {
      const autoTitle = cleanPrompt.slice(0, 42) + (cleanPrompt.length > 42 ? '…' : '');
      targetThread = { ...targetThread, title: autoTitle };
      currentThreads = currentThreads.map((t) =>
        t.id === targetThread!.id ? targetThread! : t
      );
    }

    const userMsg: ByokConversationMessage = {
      id: `msg-u-${now}`,
      role: 'user',
      content: cleanPrompt,
      createdAt: timeStr,
      attachedNoteTitles: attachedDocs.map((d) => d.title),
    };

    const withUserMessages = [...targetThread.messages, userMsg];
    const updatedAfterUser: ByokConversationThread = {
      ...targetThread,
      providerKeyId: activeProvider.id,
      updatedAtMs: now,
      messages: withUserMessages,
    };

    currentThreads = currentThreads.map((t) =>
      t.id === updatedAfterUser.id ? updatedAfterUser : t
    );
    persistThreads(currentThreads);

    if (!overridePrompt) setPromptInput('');
    const docsSnapshot = [...attachedDocs];
    setAttachedDocs([]);
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const result = await sendByokChatCompletion({
      keyMeta: activeProvider,
      rawApiKey: getByokSecret(activeProvider.id),
      history: targetThread.messages,
      userText: cleanPrompt,
      attachments: docsSnapshot,
      signal: controller.signal,
    });

    abortRef.current = null;
    setSending(false);

    const replyNow = Date.now();
    const replyMsg: ByokConversationMessage = {
      id: `msg-a-${replyNow}`,
      role: 'assistant',
      content: result.ok
        ? result.content
        : result.error || 'No se pudo completar la respuesta.',
      createdAt: new Date(replyNow).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      providerKeyId: activeProvider.id,
      providerLabel: activeProvider.providerName,
      modelName: activeProvider.modelName,
      error: !result.ok,
    };

    setThreads((prev) => {
      const finalThreads = prev.map((t) =>
        t.id === updatedAfterUser.id
          ? {
              ...t,
              updatedAtMs: replyNow,
              messages: [...t.messages, replyMsg],
            }
          : t
      );
      void vaultSet('byok_conversations', finalThreads);
      return finalThreads;
    });
  };

  const handleSaveAsStudyNote = (msg: ByokConversationMessage) => {
    const firstLine = msg.content.split('\n').find((l) => l.trim()) || 'Apunte desde IA BYOK';
    const cleanTitle = firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '').slice(0, 60);
    const created = createAdvancedNote({
      title: cleanTitle || 'Síntesis IA BYOK',
      subject: 'Asistencia IA (BYOK)',
      folder: 'Resúmenes IA',
    });
    updateAdvancedNote(created.id, {
      mainIdea: `Generado con ${msg.providerLabel || 'IA BYOK'} (${msg.modelName || 'modelo propio'})`,
      summaryText: msg.content.slice(0, 260),
      contentText: msg.content,
      contentHtml: markdownToSimpleHtml(msg.content),
      tags: ['IA-BYOK', msg.providerLabel || 'BYOK'],
    });
    showToast('Guardado en Cuadernos Digitales (Sector 1 · Estudio).');
  };

  const handleSaveAsOrganizerTask = (msg: ByokConversationMessage) => {
    const firstLine = msg.content.split('\n').find((l) => l.trim()) || 'Revisar respuesta IA';
    const cleanTitle = firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '').slice(0, 80);
    addOrganizerTask(cleanTitle, 'planificar', 'IA BYOK', 'estudio');
    showToast('Guardado como tarea en Organizador Integral.');
  };

  const handleCopyFullMessage = (msg: ByokConversationMessage) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(msg.content);
      setCopiedMsgId(msg.id);
      window.setTimeout(() => setCopiedMsgId(null), 1600);
    }
  };

  const renderSidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b fabro-border">
        <button
          type="button"
          onClick={handleNewConversation}
          className="w-full min-h-[42px] md:min-h-[38px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#4F46E5] bg-[#4F46E5] text-white px-3.5 py-2 text-sm font-medium cursor-pointer active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 shrink-0" />
          Nueva conversación
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {!hydrated ? (
          <p className="text-xs fabro-muted px-2 py-3">Cargando historial local...</p>
        ) : threads.length === 0 ? (
          <div className="px-2 py-6 text-center space-y-1.5">
            <MessageSquare className="w-5 h-5 fabro-muted mx-auto opacity-70" />
            <p className="text-xs font-semibold">Sin conversaciones guardadas</p>
            <p className="text-[11px] fabro-muted">
              Tus hilos con tu propia clave BYOK se guardan localmente acá.
            </p>
          </div>
        ) : (
          (['Hoy', 'Ayer', 'Anteriores'] as const).map((groupName) => {
            const list = groupedThreads[groupName];
            if (list.length === 0) return null;
            return (
              <div key={groupName} className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider fabro-muted">
                  {groupName}
                </p>
                {list.map((thread) => {
                  const isActive = thread.id === activeThread?.id;
                  const isEditing = renamingId === thread.id;
                  return (
                    <div
                      key={thread.id}
                      className={`group rounded-xl border px-2.5 py-2 transition-colors ${
                        isActive
                          ? 'border-[#4F46E5]/55 bg-[#4F46E5]/10'
                          : 'border-transparent hover:bg-[var(--fabro-surface-2)]/70'
                      }`}
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleCommitRename(thread.id);
                          }}
                          className="flex items-center gap-1"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => handleCommitRename(thread.id)}
                            className="flex-1 min-w-0 rounded-lg border fabro-border fabro-surface px-2 py-1 text-xs fabro-input"
                          />
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveThreadId(thread.id);
                              setMobileDrawerOpen(false);
                            }}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <p className="text-xs font-semibold truncate">{thread.title}</p>
                            <p className="text-[10px] fabro-muted truncate">
                              {thread.messages.length} mensajes
                            </p>
                          </button>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleStartRename(thread)}
                              aria-label="Renombrar conversación"
                              title="Renombrar"
                              className="w-7 h-7 rounded-lg flex items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteThread(thread.id)}
                              aria-label="Eliminar conversación"
                              title="Eliminar"
                              className="w-7 h-7 rounded-lg flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // If user has no BYOK keys or missing local secret on selected key -> Friendly onboarding card
  if (byokKeys.length === 0) {
    return (
      <section className="rounded-2xl border fabro-border fabro-surface p-6 sm:p-10 text-center max-w-2xl mx-auto space-y-5">
        <div className="w-12 h-12 rounded-2xl border border-[#4F46E5]/35 bg-[#4F46E5]/10 text-[#4F46E5] dark:text-[#A5B4FC] flex items-center justify-center mx-auto">
          <KeyRound className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
            Conectá tu propia clave API para abrir el Chat IA
          </h2>
          <p className="text-xs sm:text-sm fabro-muted leading-relaxed max-w-lg mx-auto">
            FABRO mantiene $0 en APIs de terceros precargadas. En cuanto cargues tu clave personal de
            OpenAI, Gemini, Claude, DeepSeek o Qwen, se activará esta interfaz limpia de conversación.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => navigateTo('ia', 'claves-byok')}
            className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-[#4F46E5] bg-[#4F46E5] text-white px-4 py-2 text-sm font-medium cursor-pointer active:scale-95"
          >
            <KeyRound className="w-4 h-4" />
            Ir al asistente de configuración BYOK
          </button>
          <button
            type="button"
            onClick={() => navigateTo('ia', 'asistente-api')}
            className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-4 py-2 text-sm font-medium cursor-pointer active:scale-95"
          >
            Ver guía de claves API
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Espacio limpio de conversación IA BYOK"
      className="rounded-2xl border fabro-border fabro-surface overflow-hidden flex min-h-[640px] max-h-[82vh] relative"
    >
      {/* Collapsible Desktop Sidebar for AI Conversations */}
      {!sidebarCollapsed && (
        <aside className="hidden md:flex w-[264px] shrink-0 border-r fabro-border fabro-surface-elevated flex-col">
          {renderSidebarContent()}
        </aside>
      )}

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <aside
            className="w-[82vw] max-w-[300px] h-full fabro-surface border-r fabro-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 px-3 border-b fabro-border flex items-center justify-between">
              <span className="text-xs font-bold">Historial IA local</span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Cerrar historial"
                className="w-9 h-9 rounded-lg border fabro-border flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{renderSidebarContent()}</div>
          </aside>
        </div>
      )}

      {/* Clean Main Chat Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Minimalist Top Bar inside AI Chat */}
        <header className="px-3.5 sm:px-4 py-2.5 border-b fabro-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Abrir conversaciones"
              className="md:hidden min-h-[38px] min-w-[38px] rounded-xl border fabro-border fabro-surface-elevated inline-flex items-center justify-center cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? 'Mostrar historial lateral' : 'Ocultar historial lateral'}
              title={sidebarCollapsed ? 'Mostrar historial' : 'Contraer historial'}
              className="hidden md:inline-flex h-9 w-9 rounded-xl border fabro-border fabro-surface-elevated items-center justify-center cursor-pointer"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            {/* Quick BYOK Provider Switcher */}
            <div className="flex items-center gap-1.5 min-w-0">
              <label htmlFor="byok-provider-select" className="sr-only">
                Elegir IA configurada
              </label>
              <select
                id="byok-provider-select"
                value={activeProvider?.id || ''}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="h-9 max-w-[230px] sm:max-w-xs rounded-xl border fabro-border fabro-surface-elevated px-2.5 text-xs font-semibold fabro-input cursor-pointer"
              >
                {byokKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.providerName} · {k.modelName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleNewConversation}
              className="md:hidden min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1 text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
            <button
              type="button"
              onClick={() => navigateTo('ia', 'claves-byok')}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 text-xs font-medium cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span className="hidden sm:inline">Claves BYOK</span>
            </button>
          </div>
        </header>

        {/* Feedback Toast */}
        {actionToast && (
          <div className="mx-4 mt-3 rounded-xl border border-emerald-500/45 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {actionToast}
          </div>
        )}

        {/* Missing raw key reminder for legacy keys saved before raw-secret support */}
        {!hasReadySecret && activeProvider && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-amber-800 dark:text-amber-300 font-medium">
              La clave <strong>{activeProvider.providerName}</strong> no tiene el secreto cargado en este dispositivo. Volvé a pegarla para enviar consultas reales.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('ia', 'claves-byok')}
              className="min-h-[34px] rounded-xl border border-amber-500/50 bg-amber-500 text-white px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Asistente BYOK
            </button>
          </div>
        )}

        {/* Central Conversation Stream / Empty Welcome State */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {(!activeThread || activeThread.messages.length === 0) ? (
            <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#A5B4FC]">
                  {activeProvider?.providerName} · {activeProvider?.modelName}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  ¿En qué trabajamos hoy?
                </h2>
                <p className="text-xs sm:text-sm fabro-muted max-w-md mx-auto leading-relaxed">
                  Conversación privada directa con tu API configurada. Podés adjuntar apuntes del Sector 1 y guardar cualquier respuesta como apunte o tarea.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUICK_SUGGESTIONS.map((sug) => {
                  const Icon = sug.icon;
                  return (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => {
                        if (sug.needsNotePicker && advancedNotes.length > 0) {
                          setPromptInput(sug.prompt);
                          setAttachMenuOpen(true);
                        } else {
                          void handleSendMessage(sug.prompt);
                        }
                      }}
                      className="text-left rounded-2xl border fabro-border fabro-surface-elevated p-4 space-y-2 hover:border-[#4F46E5]/60 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold fabro-muted">
                          {sug.sectorLabel}
                        </span>
                        <Icon className={`w-4 h-4 shrink-0 ${sug.accentClass}`} />
                      </div>
                      <p className="font-display text-sm font-bold">{sug.title}</p>
                      <p className="text-xs fabro-muted leading-relaxed">{sug.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {activeThread.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl border px-4 py-3 text-sm space-y-2 ${
                        isUser
                          ? 'border-[#4F46E5]/50 bg-[#4F46E5]/12'
                          : msg.error
                          ? 'border-rose-500/45 bg-rose-500/10'
                          : 'fabro-border fabro-surface-elevated'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[11px] fabro-muted">
                        <span className="font-semibold">
                          {isUser
                            ? 'Vos'
                            : `${msg.providerLabel || 'Asistente IA'} · ${msg.modelName || ''}`}
                        </span>
                        <span className="font-mono tabular-nums">{msg.createdAt}</span>
                      </div>

                      {msg.attachedNoteTitles && msg.attachedNoteTitles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {msg.attachedNoteTitles.map((title) => (
                            <span
                              key={title}
                              className="inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface px-2 py-0.5 font-medium"
                            >
                              <Paperclip className="w-3 h-3" />
                              {title}
                            </span>
                          ))}
                        </div>
                      )}

                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                          {msg.content}
                        </p>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed break-words space-y-2">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: ({ className, children }) => (
                                <CodeBlockWithCopy className={className}>
                                  {children}
                                </CodeBlockWithCopy>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {!isUser && !msg.error && (
                        <div className="pt-2 border-t fabro-border flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveAsStudyNote(msg)}
                            className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-[11px] font-medium hover:border-[#2563EB] cursor-pointer"
                          >
                            <FilePlus2 className="w-3.5 h-3.5 text-[#2563EB]" />
                            Guardar como Apunte
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveAsOrganizerTask(msg)}
                            className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-[11px] font-medium hover:border-[#10B981] cursor-pointer"
                          >
                            <CheckSquare className="w-3.5 h-3.5 text-[#10B981]" />
                            Guardar como Tarea
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyFullMessage(msg)}
                            className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                          >
                            {copiedMsgId === msg.id ? (
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex items-start">
                  <div className="rounded-2xl border fabro-border fabro-surface-elevated px-4 py-3 text-xs fabro-muted flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-ping" />
                    Consultando a {activeProvider?.providerName}...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Clean Composer Dock */}
        <div className="border-t fabro-border p-3 sm:p-4 space-y-2.5 relative">
          {/* Attachment Picker Popover (Sector 1 Notes + Local Files) */}
          {attachMenuOpen && (
            <div className="rounded-2xl border fabro-border fabro-surface-elevated p-3 space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold">Adjuntar apunte o documento de Estudio</span>
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen(false)}
                  aria-label="Cerrar adjuntos"
                  className="w-7 h-7 rounded-lg border fabro-border flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                {advancedNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => handleAttachStudyNote(note.id)}
                    className="text-left rounded-xl border fabro-border fabro-surface px-3 py-2 text-xs hover:border-[#2563EB] cursor-pointer"
                  >
                    <p className="font-semibold truncate">{note.title}</p>
                    <p className="text-[11px] fabro-muted truncate">{note.subject}</p>
                  </button>
                ))}
              </div>
              <div className="pt-1 border-t fabro-border flex items-center justify-between gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  onChange={(e) => void handleAttachLocalFile(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-3 py-1 text-xs font-medium cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Subir archivo de texto (.txt, .md)
                </button>
              </div>
            </div>
          )}

          {/* Attached Docs Pills */}
          {attachedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB]/45 bg-[#2563EB]/10 px-2.5 py-1 text-xs font-medium"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span className="truncate max-w-[180px]">{doc.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedDocs((prev) => prev.filter((d) => d.id !== doc.id))
                    }
                    aria-label={`Quitar ${doc.title}`}
                    className="cursor-pointer hover:text-rose-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setAttachMenuOpen((v) => !v)}
              aria-label="Adjuntar apunte o documento"
              title="Adjuntar apunte de Sector 1 o archivo"
              className="min-h-[42px] min-w-[42px] rounded-xl border fabro-border fabro-surface-elevated inline-flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              rows={1}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendMessage();
                }
              }}
              placeholder={`Escribí tu consulta para ${activeProvider?.providerName || 'tu IA BYOK'}...`}
              className="flex-1 min-h-[42px] max-h-36 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5 text-sm fabro-input resize-y"
            />

            {sending ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Detener generación"
                className="min-h-[42px] px-3.5 rounded-xl border border-rose-500 bg-rose-500 text-white inline-flex items-center gap-1.5 text-sm font-medium cursor-pointer shrink-0 active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Detener
              </button>
            ) : (
              <button
                type="button"
                disabled={!promptInput.trim()}
                onClick={() => void handleSendMessage()}
                aria-label="Enviar consulta"
                className="min-h-[42px] px-3.5 rounded-xl border border-[#4F46E5] bg-[#4F46E5] text-white inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-45 cursor-pointer shrink-0 active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
