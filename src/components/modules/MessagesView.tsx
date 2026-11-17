import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  EyeOff,
  Flag,
  MessageCircle,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { useLastDay } from '../../context/LastDayContext';
import { usePlatform } from '../../context/PlatformContext';
import type { DirectMessage, PresenceMode, PublicUserProfile } from '../../types/fabro';

const PRESENCE_OPTIONS: Array<{ value: PresenceMode; label: string; dotClass: string }> = [
  { value: 'online', label: 'En línea', dotClass: 'bg-emerald-500' },
  { value: 'away', label: 'Ausente', dotClass: 'bg-amber-500' },
  { value: 'dnd', label: 'No molestar', dotClass: 'bg-rose-500' },
  { value: 'invisible', label: 'Invisible', dotClass: 'bg-slate-400' },
];

export const MessagesView: React.FC = () => {
  const { user, profile, setActiveSection } = useFabro();
  const {
    publicProfiles,
    directThreads,
    selectedDirectThreadId: selectedThreadId,
    setSelectedDirectThreadId: setSelectedThreadId,
    onlinePeers,
    updatePresenceMode,
    startOrGetDirectThread,
    subscribeDirectMessages,
    sendDirectMessage,
    toggleBlockDirectThread,
    markThreadRead,
    submitModerationReport,
  } = usePlatform();
  const {
    receivedContactRequests,
    sentContactRequests,
    respondContactRequest,
    deleteContactRequest,
  } = useLastDay();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isMinor = Boolean(profile?.isMinor);

  const selectedThread = useMemo(
    () => directThreads.find((t) => t.id === selectedThreadId) || null,
    [directThreads, selectedThreadId]
  );

  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }
    void markThreadRead(selectedThread);
    const unsub = subscribeDirectMessages(selectedThread.id, setMessages);
    return () => unsub();
  }, [selectedThread?.id, subscribeDirectMessages]);

  const onlineUidSet = useMemo(() => new Set(onlinePeers.map((p) => p.uid)), [onlinePeers]);

  const adultContacts = useMemo(() => {
    const q = directoryFilter.trim().toLowerCase();
    return publicProfiles.filter((p) => {
      if (p.uid === user?.uid) return false;
      if (p.isMinor || !p.searchableInDirectory) return false;
      if ((profile?.blockedUserIds || []).includes(p.uid)) return false;
      if (q) {
        const hay = `${p.displayName} ${p.username} ${p.specialty} ${p.city} ${p.institutions.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [publicProfiles, user?.uid, profile?.blockedUserIds, directoryFilter]);

  const handleStartChat = async (target: PublicUserProfile) => {
    setErrorMsg(null);
    try {
      const id = await startOrGetDirectThread(target);
      setSelectedThreadId(id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo iniciar la conversación.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !draft.trim()) return;
    setErrorMsg(null);
    const txt = draft;
    setDraft('');
    try {
      await sendDirectMessage(selectedThread, txt);
    } catch (err) {
      setDraft(txt);
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    }
  };

  const currentPresence = profile?.presenceMode || 'online';

  return (
    <div className="space-y-5">
      {/* Header + Presence Controls */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
            MENSAJERÍA Y CONEXIÓN EDUCATIVA
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Chat académico y presencia en línea
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {onlinePeers.length} usuarios adultos visibles conectados ahora · Modo invisible disponible.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void updatePresenceMode(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                currentPresence === opt.value
                  ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {/* Strict Minor Protection Screen */}
      {isMinor ? (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Protección activa para menores de edad
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                Tu perfil está configurado como cuenta menor de 18 años. Por seguridad, en PROYECTO FABRO los mensajes privados 1:1 y el directorio público abierto están estrictamente deshabilitados tanto en la interfaz como en las reglas de base de datos.
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Podés seguir participando normalmente en tus cursos de FABRO Academy y en los grupos de estudio institucionales o con moderación docente.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('comunidad')}
                  className="rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Ir a grupos educativos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('academy')}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Explorar FABRO Academy
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Conversations & Verified Adult Directory */}
          <aside className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Tus conversaciones ({directThreads.length})
              </h3>
              {directThreads.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  Todavía no iniciaste chats directos. Elegí un docente o estudiante adulto debajo para escribirle.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {directThreads.map((t) => {
                    const otherIdx = t.participantIds[0] === user?.uid ? 1 : 0;
                    const otherName = t.participantNames[otherIdx] || 'Usuario FABRO';
                    const isUnread = Boolean(user && t.unreadBy.includes(user.uid));
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedThreadId(t.id)}
                        className={`w-full text-left rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                          selectedThreadId === t.id
                            ? 'border-sky-500 bg-sky-500/10'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {otherName}
                          </span>
                          {isUnread && (
                            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                              Nuevo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {t.status === 'bloqueado'
                            ? 'Conversación bloqueada'
                            : t.lastMessagePreview || 'Sin mensajes todavía'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {(receivedContactRequests.length > 0 || sentContactRequests.length > 0) && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Solicitudes de contacto ({receivedContactRequests.length + sentContactRequests.length})
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {receivedContactRequests.map((reqItem) => {
                    const senderProf = publicProfiles.find((p) => p.uid === reqItem.fromUserId);
                    return (
                      <div
                        key={reqItem.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {reqItem.fromName}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 shrink-0">
                            {reqItem.status}
                          </span>
                        </div>
                        {reqItem.message && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {reqItem.message}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {reqItem.status === 'pendiente' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void respondContactRequest(reqItem, 'aceptada')}
                                className="min-h-[34px] rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                Aceptar
                              </button>
                              <button
                                type="button"
                                onClick={() => void respondContactRequest(reqItem, 'rechazada')}
                                className="min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {reqItem.status === 'aceptada' && (
                            <button
                              type="button"
                              onClick={() =>
                                void startOrGetDirectThread(
                                  senderProf || {
                                    uid: reqItem.fromUserId,
                                    displayName: reqItem.fromName,
                                    isMinor: false,
                                  }
                                )
                              }
                              className="min-h-[34px] rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              Abrir chat
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {sentContactRequests.map((reqItem) => {
                    const targetProf = publicProfiles.find((p) => p.uid === reqItem.toUserId);
                    return (
                      <div
                        key={reqItem.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            Para {reqItem.toName}
                          </p>
                          <p className="text-[10px] uppercase text-slate-500">{reqItem.status}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {reqItem.status === 'aceptada' && (
                            <button
                              type="button"
                              onClick={() =>
                                void startOrGetDirectThread(
                                  targetProf || {
                                    uid: reqItem.toUserId,
                                    displayName: reqItem.toName,
                                    isMinor: false,
                                  }
                                )
                              }
                              className="min-h-[34px] rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              Chatear
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void deleteContactRequest(reqItem.id)}
                            className="min-h-[34px] px-2 text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Docentes y estudiantes (+18)
                </h3>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={directoryFilter}
                  onChange={(e) => setDirectoryFilter(e.target.value)}
                  placeholder="Buscar por nombre, especialidad o ciudad..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {adultContacts.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                    No hay otros perfiles adultos disponibles aún.
                  </p>
                ) : (
                  adultContacts.map((p) => {
                    const isOnlineNow =
                      onlineUidSet.has(p.uid) || p.presenceStatus === 'online';
                    return (
                      <div key={p.uid} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isOnlineNow ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {p.displayName}
                              {p.verificationStatus === 'aprobado' ? ' ✓' : ''}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {p.sharedPhrase || (p.username ? `@${p.username}` : 'Perfil FABRO')}
                            {p.city ? ` · ${p.city}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleStartChat(p)}
                          className="rounded-lg bg-sky-600 px-2.5 py-1 font-semibold text-white hover:bg-sky-700 cursor-pointer shrink-0"
                        >
                          Mensaje
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* Right: Active Thread */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between min-h-[460px]">
            {selectedThread ? (
              <>
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {selectedThread.participantNames[
                        selectedThread.participantIds[0] === user?.uid ? 1 : 0
                      ] || 'Conversación privada'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Estado: {selectedThread.status === 'bloqueado' ? 'Bloqueado' : 'Activo · Verificado para adultos'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => void toggleBlockDirectThread(selectedThread)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {selectedThread.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void submitModerationReport({
                          targetType: 'mensaje',
                          targetId: selectedThread.id,
                          targetSummary: `Hilo con ${selectedThread.participantNames.join(' / ')}`,
                          reason: 'Conducta inapropiada en mensajería',
                          details: 'Reporte generado desde el módulo de Mensajes.',
                        }).then(() => setNotice('Reporte enviado a moderación.'))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1 text-rose-600 dark:text-rose-400 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Reportar
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-2.5 max-h-96">
                  {messages.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-12">
                      Conversación iniciada. Escribí el primer mensaje educativo.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderId === user?.uid;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs ${
                              mine
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            <p className="text-[10px] opacity-80 font-semibold mb-0.5">
                              {m.senderName}
                            </p>
                            <p className="whitespace-pre-wrap">{m.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={(e) => void handleSend(e)} className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                  <input
                    type="text"
                    disabled={selectedThread.status === 'bloqueado'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      selectedThread.status === 'bloqueado'
                        ? 'Conversación bloqueada'
                        : 'Escribí un mensaje académico...'
                    }
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={selectedThread.status === 'bloqueado' || !draft.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-500 dark:text-slate-400">
                <MessageCircle className="w-8 h-8 opacity-60" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Seleccioná una conversación o contactá a un docente
                </p>
                <p className="text-xs max-w-sm">
                  Para consultas en grupo sobre cursos o materias, también podés usar el chat interno de cada comunidad en el módulo Comunidad.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
