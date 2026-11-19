import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCheck,
  Clock,
  Cloud,
  Flag,
  MessageSquare,
  Mic,
  RefreshCw,
  Reply,
  Search,
  Send,
  Square,
  Star,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import { sendCloudChatMessage, subscribeToCloudChat } from '../../../services/cloudSyncService';
import { activateMediaSession, stopMediaSession } from '../../../services/mediaSessionBridge';
import type { ChatMessageItem } from '../../../types/ecosystem';

const STICKERS = ['🍀', '🔥', '👏', '💡', '💜', '🎯'];

export const InteractiveChatInbox: React.FC = () => {
  const {
    profile,
    authUser,
    openAuthModal,
    network,
    friendsList,
    activeChatThreadId,
    setActiveChatThreadId,
    quickChatMessages,
    sendQuickChatMessage,
    flushQueuedMessages,
    toggleFriendAvailability,
    toggleChatStar,
    reactToChatMessage,
    navigateTo,
  } = useEcosystem();
  const { isActionRestricted, openReportModal } = useAdmin();

  const [cloudThreadMessages, setCloudThreadMessages] = useState<ChatMessageItem[]>([]);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'starred' | 'queued'>('all');
  const [chatSearch, setChatSearch] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [readReceipts, setReadReceipts] = useState(true);
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [deliveryToast, setDeliveryToast] = useState<string | null>(null);

  const startXRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);

  const [recordingVoice, setRecordingVoice] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const selectedFriend = useMemo(
    () => friendsList.find((f) => f.id === activeChatThreadId) || null,
    [activeChatThreadId, friendsList]
  );

  // Zero Firestore calls in Guest Mode
  useEffect(() => {
    if (!authUser || !network.isOnline) {
      setCloudThreadMessages([]);
      return;
    }
    const myDisplayName = (authUser.displayName || profile.displayName).toLowerCase();
    const unsub = subscribeToCloudChat(
      activeChatThreadId,
      (incoming) => {
        setCloudThreadMessages(
          incoming.map((m) => ({
            ...m,
            own: m.sender.toLowerCase() === myDisplayName,
          }))
        );
      },
      () => {
        // Silently retain local offline queue on transient listener error
      }
    );
    return () => unsub();
  }, [activeChatThreadId, authUser, network.isOnline, profile.displayName]);

  const threadMessages = useMemo(() => {
    const local = quickChatMessages.filter(
      (m) => (m.recipientId || 'general') === activeChatThreadId
    );
    if (cloudThreadMessages.length === 0) return local;
    const localSignatures = new Set(local.map((m) => `${m.sender}|${m.text}|${m.time}`));
    const remoteExtras = cloudThreadMessages.filter(
      (m) => !localSignatures.has(`${m.sender}|${m.text}|${m.time}`)
    );
    return [...local, ...remoteExtras];
  }, [activeChatThreadId, cloudThreadMessages, quickChatMessages]);

  const queuedInThread = useMemo(
    () => threadMessages.filter((m) => m.deliveryStatus === 'queued-offline').length,
    [threadMessages]
  );

  const totalQueuedAll = useMemo(
    () => quickChatMessages.filter((m) => m.deliveryStatus === 'queued-offline').length,
    [quickChatMessages]
  );

  const filteredMessages = threadMessages.filter((m) => {
    if (inboxFilter === 'starred' && !m.starred) return false;
    if (inboxFilter === 'queued' && m.deliveryStatus !== 'queued-offline') return false;
    if (!chatSearch.trim()) return true;
    return `${m.sender} ${m.text}`.toLowerCase().includes(chatSearch.trim().toLowerCase());
  });

  const starredCount = threadMessages.filter((m) => m.starred).length;
  const isRecipientOffline = selectedFriend?.availability === 'offline';
  const willQueueOffline = !network.isOnline || Boolean(isRecipientOffline);

  const syncMessageToCloudIfReady = (text: string, sticker?: string) => {
    if (!authUser || !network.isOnline || isRecipientOffline) return;
    const nowTime = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    void sendCloudChatMessage(activeChatThreadId, authUser.uid, {
      id: `chat-${Date.now()}`,
      sender: authUser.displayName || profile.displayName,
      text,
      time: nowTime,
      sticker,
      own: true,
      recipientId: activeChatThreadId,
      deliveryStatus: 'delivered-local',
    }).catch(() => {});
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const msgCheck = isActionRestricted('no_mensajes');
    if (msgCheck.blocked) {
      setDeliveryToast(
        msgCheck.reason ||
          'Tu cuenta tiene una restricción temporal para enviar mensajes. Podés revisar o apelar desde el aviso superior.'
      );
      setTimeout(() => setDeliveryToast(null), 4500);
      return;
    }
    if (!chatDraft.trim()) return;
    const cleanText = chatDraft.trim();
    sendQuickChatMessage(cleanText, {
      recipientId: activeChatThreadId,
      replyTo: replyTarget
        ? { id: replyTarget.id, sender: replyTarget.sender, text: replyTarget.text }
        : undefined,
    });
    syncMessageToCloudIfReady(cleanText);
    if (willQueueOffline) {
      setDeliveryToast(
        selectedFriend
          ? `Mensaje guardado en cola offline para ${selectedFriend.displayName}. Se entregará al volver a conectarse.`
          : 'Sin internet: mensaje guardado en tu dispositivo y en cola de entrega automática.'
      );
      setTimeout(() => setDeliveryToast(null), 4000);
    }
    setChatDraft('');
    setReplyTarget(null);
  };

  const handleQuickVoice = async () => {
    const msgCheck = isActionRestricted('no_mensajes');
    if (msgCheck.blocked) {
      setDeliveryToast(
        msgCheck.reason || 'Tu cuenta tiene una restricción temporal para enviar notas de voz.'
      );
      setTimeout(() => setDeliveryToast(null), 4000);
      return;
    }
    if (recordingVoice) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      setRecordingVoice(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      sendQuickChatMessage('Nota de voz rápida (PTT local)', {
        recipientId: activeChatThreadId,
        replyTo: replyTarget
          ? { id: replyTarget.id, sender: replyTarget.sender, text: replyTarget.text }
          : undefined,
      });
      setReplyTarget(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          sendQuickChatMessage('Nota de voz rápida', {
            recipientId: activeChatThreadId,
            audioUrl: typeof reader.result === 'string' ? reader.result : undefined,
            replyTo: replyTarget
              ? { id: replyTarget.id, sender: replyTarget.sender, text: replyTarget.text }
              : undefined,
          });
          setReplyTarget(null);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecordingVoice(true);
    } catch {
      setRecordingVoice(false);
    }
  };

  const handleDoubleTap = (id: string) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === id && now - lastTapRef.current.at < 320) {
      reactToChatMessage(id, '💜');
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id, at: now };
    }
  };

  const handleSimulateReconnectFlush = () => {
    if (selectedFriend && selectedFriend.availability === 'offline') {
      toggleFriendAvailability(selectedFriend.id);
      setDeliveryToast(
        `${selectedFriend.displayName} volvió en línea y recibió los mensajes pendientes.`
      );
      setTimeout(() => setDeliveryToast(null), 4000);
      return;
    }
    const flushed = flushQueuedMessages(activeChatThreadId);
    if (flushed > 0) {
      setDeliveryToast(`Se entregaron ${flushed} mensajes pendientes de la cola offline.`);
      setTimeout(() => setDeliveryToast(null), 4000);
    }
  };

  return (
    <div className="rounded-2xl border fabro-surface p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#7C3AED] dark:text-[#C4B5FD]" />
            Mensajería Directa y Offline-First
          </h2>
          <p className="text-xs fabro-muted">
            Escribí siempre aunque vos o la otra persona estén sin conexión · Deslizá a la derecha para responder.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo('social', 'amistades')}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 text-[#7C3AED] dark:text-[#C4B5FD]" />
            Amistades ({friendsList.length})
          </button>
          {!authUser ? (
            <button
              type="button"
              onClick={() =>
                openAuthModal(
                  'enviar mensajes sincronizados en tiempo real y respaldar tus chats entre dispositivos',
                  'register'
                )
              }
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C4B5FD] px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Cloud className="w-3.5 h-3.5" />
              Activar chat en la nube
            </button>
          ) : (
            <span className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-2 text-xs font-bold whitespace-nowrap">
              <Cloud className="w-3.5 h-3.5" />
              Nube activa · @{authUser.username}
            </span>
          )}
        </div>
      </div>

      {/* Conversation / Recipient Switcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold fabro-muted">Conversaciones y amistades</span>
          {totalQueuedAll > 0 && (
            <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold tabular-nums">
              {totalQueuedAll} en cola offline total
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setActiveChatThreadId('general')}
            className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer active:scale-95 transition-all ${
              activeChatThreadId === 'general'
                ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            Muro General
          </button>

          {friendsList.map((friend) => {
            const active = activeChatThreadId === friend.id;
            const pendingCount = quickChatMessages.filter(
              (m) => m.recipientId === friend.id && m.deliveryStatus === 'queued-offline'
            ).length;
            const offline = friend.availability === 'offline';

            return (
              <button
                key={friend.id}
                type="button"
                onClick={() => setActiveChatThreadId(friend.id)}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer active:scale-95 transition-all ${
                  active
                    ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                    : 'fabro-border fabro-surface-elevated'
                }`}
              >
                {offline ? (
                  <WifiOff className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-amber-200' : 'text-amber-600 dark:text-amber-300'}`} />
                ) : (
                  <Wifi className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`} />
                )}
                <span>{friend.displayName}</span>
                {pendingCount > 0 && (
                  <span className="font-mono text-[11px] opacity-90 tabular-nums">
                    · {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Thread Offline Context Strip */}
      <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm">
              {selectedFriend ? selectedFriend.displayName : 'Canal General FABRO'}
            </span>
            <span aria-hidden="true" className="fabro-muted">
              ·
            </span>
            <span
              className={`font-semibold ${
                willQueueOffline
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {!network.isOnline
                ? 'Tu dispositivo está sin conexión'
                : isRecipientOffline
                ? 'Contacto sin conexión (Offline)'
                : 'Disponible en línea'}
            </span>
          </div>
          <p className="fabro-muted leading-relaxed">
            {willQueueOffline
              ? 'Podés escribir normalmente: cada mensaje se guarda localmente en tu Bandeja de Salida Offline y se entregará al reconectarse.'
              : 'Mensajes sincronizados al instante en tu dispositivo.'}
          </p>
        </div>

        {(queuedInThread > 0 || isRecipientOffline) && (
          <button
            type="button"
            onClick={handleSimulateReconnectFlush}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            {isRecipientOffline
              ? 'Simular reconexión y entregar'
              : `Entregar pendientes (${queuedInThread})`}
          </button>
        )}
      </div>

      {deliveryToast && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium text-amber-800 dark:text-amber-200">
          {deliveryToast}
        </p>
      )}

      {/* Filter & Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInboxFilter('all')}
            className={`min-h-[42px] rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
              inboxFilter === 'all'
                ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            Todos ({threadMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setInboxFilter('queued')}
            className={`min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
              inboxFilter === 'queued'
                ? 'border-amber-600 bg-amber-600 text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Cola Offline ({queuedInThread})
          </button>
          <button
            type="button"
            onClick={() => setInboxFilter('starred')}
            className={`min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
              inboxFilter === 'starred'
                ? 'border-[#F59E0B] bg-[#F59E0B] text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Destacados ({starredCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Buscar en este hilo..."
              className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 py-2 text-xs fabro-input"
            />
          </div>
          <label className="min-h-[42px] inline-flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={readReceipts}
              onChange={(e) => setReadReceipts(e.target.checked)}
              className="w-4 h-4 accent-[#7C3AED]"
            />
            <span>Confirmación</span>
          </label>
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-2.5 max-h-88 overflow-y-auto pr-1">
        {filteredMessages.length === 0 ? (
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-6 text-center text-xs fabro-muted space-y-1">
            <p className="font-semibold text-[var(--fabro-text)]">
              {selectedFriend
                ? `Iniciá la conversación con ${selectedFriend.displayName}`
                : 'Sin mensajes en este filtro'}
            </p>
            <p>
              {selectedFriend?.availability === 'offline'
                ? 'Aunque no tenga conexión ahora, escribí abajo y tu mensaje quedará listo para entregarse.'
                : 'Escribí un mensaje, nota de voz o sticker abajo.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const offset = swipingId === msg.id ? swipeOffset : 0;
            const isQueued = msg.deliveryStatus === 'queued-offline';
            return (
              <div
                key={msg.id}
                onClick={() => handleDoubleTap(msg.id)}
                onPointerDown={(e) => {
                  startXRef.current = e.clientX;
                  setSwipingId(msg.id);
                }}
                onPointerMove={(e) => {
                  if (startXRef.current === null || swipingId !== msg.id) return;
                  const diff = e.clientX - startXRef.current;
                  if (diff > 0) setSwipeOffset(Math.min(64, diff));
                }}
                onPointerUp={() => {
                  if (swipingId === msg.id && swipeOffset >= 40) {
                    setReplyTarget(msg);
                  }
                  startXRef.current = null;
                  setSwipingId(null);
                  setSwipeOffset(0);
                }}
                onPointerCancel={() => {
                  startXRef.current = null;
                  setSwipingId(null);
                  setSwipeOffset(0);
                }}
                style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
                className={`rounded-2xl border p-3.5 text-xs space-y-2 transition-transform touch-pan-y select-none ${
                  msg.own
                    ? 'border-[#7C3AED]/35 bg-[#7C3AED]/10 ml-4 sm:ml-10'
                    : 'fabro-border fabro-surface-elevated mr-4 sm:mr-10'
                }`}
              >
                {msg.replyTo && (
                  <div className="rounded-lg border fabro-border fabro-surface px-3 py-1.5 text-[11px] fabro-muted">
                    <span className="font-bold text-[var(--fabro-text)]">
                      Respondiendo a {msg.replyTo.sender}:{' '}
                    </span>
                    <span className="line-clamp-1">{msg.replyTo.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-[11px] fabro-muted">
                  <span className="font-bold text-[var(--fabro-text)]">{msg.sender}</span>
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    {msg.time}
                    {msg.own && isQueued && (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-sans font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        En cola offline
                      </span>
                    )}
                    {msg.own && !isQueued && readReceipts && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-sans font-semibold">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Entregado
                      </span>
                    )}
                  </span>
                </div>

                {msg.sticker ? (
                  <p className="text-3xl leading-none">{msg.sticker}</p>
                ) : (
                  <p className="leading-relaxed">{msg.text}</p>
                )}

                {msg.audioUrl && (
                  <audio
                    controls
                    src={msg.audioUrl}
                    className="w-full h-9"
                    onPlay={(e) => {
                      const audioEl = e.currentTarget;
                      activateMediaSession({
                        title: `Nota de voz · ${msg.sender}`,
                        artist: 'Mensajería FABRO',
                        album: '🍀 FABRO · Chat y PTT',
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
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(msg.reactions || []).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          reactToChatMessage(msg.id, emoji);
                        }}
                        className="rounded-lg border fabro-border fabro-surface px-2 py-0.5 text-xs cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyTarget(msg);
                      }}
                      aria-label="Responder mensaje"
                      className="min-h-[38px] min-w-[38px] rounded-lg border fabro-border fabro-surface flex items-center justify-center fabro-muted hover:text-[#7C3AED] cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChatStar(msg.id);
                      }}
                      aria-label="Destacar mensaje"
                      className={`min-h-[38px] min-w-[38px] rounded-lg border flex items-center justify-center cursor-pointer ${
                        msg.starred
                          ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                          : 'fabro-border fabro-surface fabro-muted'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    {!msg.own && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReportModal({
                            targetType: 'mensaje',
                            targetId: msg.id,
                            targetAuthorName: msg.sender,
                            targetSummary: (msg.text || 'Mensaje de chat').slice(0, 200),
                            sector: 'social',
                          });
                        }}
                        title="Denunciar mensaje"
                        aria-label="Denunciar mensaje"
                        className="min-h-[38px] min-w-[38px] rounded-lg border fabro-border fabro-surface flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stickers bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] fabro-muted font-semibold mr-1">Stickers:</span>
        {STICKERS.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              const msgCheck = isActionRestricted('no_mensajes');
              if (msgCheck.blocked) {
                setDeliveryToast(
                  msgCheck.reason ||
                    'Tu cuenta tiene una restricción temporal para enviar mensajes.'
                );
                setTimeout(() => setDeliveryToast(null), 4000);
                return;
              }
              sendQuickChatMessage(`Sticker ${st}`, {
                sticker: st,
                recipientId: activeChatThreadId,
              });
              syncMessageToCloudIfReady(`Sticker ${st}`, st);
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl border fabro-border fabro-surface-elevated text-base hover:border-[#EC4899] cursor-pointer transition-transform active:scale-95"
          >
            {st}
          </button>
        ))}
      </div>

      {replyTarget && (
        <div className="rounded-xl border border-[#EC4899]/50 bg-[#EC4899]/10 px-3 py-2 flex items-center justify-between gap-2 text-xs">
          <span className="truncate">
            Respondiendo a <strong>{replyTarget.sender}</strong>: {replyTarget.text}
          </span>
          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            aria-label="Cancelar respuesta"
            className="p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSendText} className="flex flex-wrap sm:flex-nowrap gap-2">
        <input
          type="text"
          value={chatDraft}
          onChange={(e) => setChatDraft(e.target.value)}
          placeholder={
            selectedFriend
              ? isRecipientOffline
                ? `Dejale un mensaje offline a ${selectedFriend.displayName}...`
                : `Escribí a ${selectedFriend.displayName}...`
              : 'Escribí en el muro general (funciona sin conexión)...'
          }
          className="min-h-[44px] flex-1 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2 text-xs fabro-input"
        />
        <button
          type="button"
          onClick={() => void handleQuickVoice()}
          className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap ${
            recordingVoice
              ? 'border-red-500 bg-red-600 text-white'
              : 'border-[#EC4899]/45 bg-[#EC4899]/10 text-[#BE185D] dark:text-[#F472B6]'
          }`}
        >
          {recordingVoice ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {recordingVoice ? 'Enviar audio' : 'Voz 1 toque'}
        </button>
        <button
          type="submit"
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <Send className="w-3.5 h-3.5" />
          {willQueueOffline ? 'Guardar y enviar offline' : 'Enviar'}
        </button>
      </form>
    </div>
  );
};
