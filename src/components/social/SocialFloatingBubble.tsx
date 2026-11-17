import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  MessageCircle,
  Send,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import type { CommunityGroup, DirectMessage, DirectThread, GroupChatMessage } from '../../types/fabro';

type MiniRoom =
  | { kind: 'dm'; thread: DirectThread }
  | { kind: 'group'; group: CommunityGroup };

interface SocialFloatingBubbleProps {
  open: boolean;
  onToggle: () => void;
  onOpenFullSocial: () => void;
}

/**
 * Globo flotante persistente de Red Social FABRO:
 * Permite ver contactos conectados y chatear en paralelo mientras el usuario
 * estudia, redacta apuntes o utiliza herramientas en otros sectores.
 */
export const SocialFloatingBubble: React.FC<SocialFloatingBubbleProps> = ({
  open,
  onToggle,
  onOpenFullSocial,
}) => {
  const { user, profile, activeSection } = useFabro();
  const {
    directThreads,
    groups,
    onlinePeers,
    subscribeDirectMessages,
    subscribeGroupMessages,
    sendDirectMessage,
    sendGroupChatMessage,
    markThreadRead,
  } = usePlatform();
  const { activeTrackId, notice, error } = useAudioPlayer();

  const isMinor = Boolean(profile?.isMinor);
  const [selectedRoom, setSelectedRoom] = useState<MiniRoom | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Pick initial room cleanly
  useEffect(() => {
    if (selectedRoom) return;
    if (!isMinor && directThreads.length > 0) {
      setSelectedRoom({ kind: 'dm', thread: directThreads[0] });
    } else if (groups.length > 0) {
      setSelectedRoom({ kind: 'group', group: groups[0] });
    }
  }, [selectedRoom, isMinor, directThreads, groups]);

  // Subscribe only when bubble drawer is open
  useEffect(() => {
    if (!open || !selectedRoom) return;
    if (selectedRoom.kind === 'dm') {
      void markThreadRead(selectedRoom.thread);
      return subscribeDirectMessages(selectedRoom.thread.id, setDmMessages);
    }
    return subscribeGroupMessages(selectedRoom.group.id, setGroupMessages);
  }, [open, selectedRoom, subscribeDirectMessages, subscribeGroupMessages, markThreadRead]);

  const activeMessages = useMemo(() => {
    const raw = selectedRoom?.kind === 'dm' ? dmMessages : groupMessages;
    const getMs = (val: unknown): number => {
      if (!val) return Date.now();
      if (typeof val === 'string') return new Date(val).getTime() || 0;
      const maybeTs = val as { toMillis?: () => number };
      return typeof maybeTs.toMillis === 'function' ? maybeTs.toMillis() : 0;
    };
    return [...raw].sort((a, b) => getMs(a.createdAt) - getMs(b.createdAt)).slice(-30);
  }, [selectedRoom?.kind, dmMessages, groupMessages]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [open, activeMessages.length]);

  const unreadDmCount = useMemo(
    () => (user && !isMinor ? directThreads.filter((t) => t.unreadBy.includes(user.uid)).length : 0),
    [directThreads, user, isMinor]
  );

  // Hide inside main social views so it never overlaps the full chat workspace
  if (activeSection === 'social-panel' || activeSection === 'mensajes' || activeSection === 'comunidad') {
    return null;
  }

  const audioBarVisible = Boolean(activeTrackId || notice || error);
  const displayName = profile?.displayName || user?.displayName || 'Usuario';
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const getRoomLabel = (room: MiniRoom): string => {
    if (room.kind === 'group') return room.group.name;
    const otherIndex = room.thread.participantIds.findIndex((id) => id !== user?.uid);
    return (otherIndex >= 0 ? room.thread.participantNames[otherIndex] : room.thread.participantNames[0]) || 'Chat 1:1';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !draft.trim() || sending) return;
    setSending(true);
    setSendError(null);
    const text = draft.trim();
    setDraft('');
    try {
      if (selectedRoom.kind === 'dm') {
        await sendDirectMessage(selectedRoom.thread, text);
      } else {
        await sendGroupChatMessage(selectedRoom.group.id, text);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`no-print fixed right-3 sm:right-5 z-40 flex flex-col items-end gap-2.5 ${
        audioBarVisible ? 'bottom-[190px] lg:bottom-[142px]' : 'bottom-[68px] lg:bottom-5'
      }`}
    >
      {open && (
        <section
          aria-label="Globo de chat rápido FABRO"
          className="w-[calc(100vw-1.5rem)] sm:w-[360px] rounded-2xl border fabro-glass shadow-2xl overflow-hidden flex flex-col max-h-[470px]"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2 bg-gradient-to-r from-[#0D1426] to-[#1B1740] text-[#FAF6EE]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/50 text-[#F7D97E] text-[11px] font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs font-bold truncate">Globo Social FABRO</p>
                <p className="text-[10px] text-slate-300 tabular-nums truncate">
                  {onlinePeers.length} en línea · chat en paralelo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onToggle();
                  onOpenFullSocial();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-semibold text-[#FAF6EE] cursor-pointer whitespace-nowrap"
                title="Abrir Red Social completa"
              >
                <span>Abrir todo</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Cerrar globo social"
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isMinor && (
            <div className="px-3 py-2 bg-amber-500/12 border-b border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Modo seguro (-18): solo grupos educativos moderados.</span>
            </div>
          )}

          {/* Room Selector Strip */}
          <div className="px-2.5 py-2 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
            {!isMinor &&
              directThreads.slice(0, 4).map((t) => {
                const room: MiniRoom = { kind: 'dm', thread: t };
                const active = selectedRoom?.kind === 'dm' && selectedRoom.thread.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedRoom(room)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-violet-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {getRoomLabel(room)}
                  </button>
                );
              })}
            {groups.slice(0, 4).map((g) => {
              const room: MiniRoom = { kind: 'group', group: g };
              const active = selectedRoom?.kind === 'group' && selectedRoom.group.id === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedRoom(room)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3 h-3 shrink-0" />
                  <span>{g.name}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Viewport */}
          <div className="flex-1 min-h-[200px] max-h-[250px] overflow-y-auto fabro-chat-canvas p-3 space-y-2">
            {!selectedRoom ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aún no tenés salas activas seleccionadas.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onToggle();
                    onOpenFullSocial();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                >
                  Ir a Red Social FABRO
                </button>
              </div>
            ) : activeMessages.length === 0 ? (
              <p className="text-xs text-center text-slate-500 dark:text-slate-400 py-8">
                Sin mensajes recientes en {getRoomLabel(selectedRoom)}.
              </p>
            ) : (
              activeMessages.map((msg) => {
                const mine = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[85%] px-3 py-1.5 text-xs shadow-xs ${
                        mine ? 'fabro-bubble-out' : 'fabro-bubble-in'
                      }`}
                    >
                      {!mine && (
                        <p className="text-[10px] font-semibold opacity-75 mb-0.5">{msg.senderName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-snug">{msg.text}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {sendError && (
            <p className="px-3 py-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10">
              {sendError}
            </p>
          )}

          {/* Quick Composer */}
          {selectedRoom && (
            <form
              onSubmit={(e) => void handleSend(e)}
              className="p-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2 bg-white/90 dark:bg-[#0D1426]"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Mensaje rápido a ${getRoomLabel(selectedRoom)}...`}
                className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070B17] px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Enviar mensaje rápido"
                className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </section>
      )}

      {/* Floating Persistent Bubble Button */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Minimizar globo social' : 'Abrir globo social para chatear'}
        title="Globo Social FABRO · Chatear mientras estudiás o usás herramientas"
        className="relative group inline-flex items-center gap-2 rounded-full border fabro-gold-border bg-gradient-to-br from-[#0D1426] via-[#1B1740] to-[#0D1426] text-[#FAF6EE] pl-2.5 pr-3.5 py-2 shadow-xl hover:scale-[1.03] transition-transform cursor-pointer"
      >
        <div className="relative w-8 h-8 rounded-full bg-violet-500/25 border border-amber-400/60 flex items-center justify-center shrink-0">
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <MessageCircle className="w-4 h-4 text-[#F7D97E]" />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0D1426]" />
        </div>
        <div className="text-left hidden sm:block">
          <p className="font-display text-[11px] font-bold leading-none text-[#FAF6EE]">
            Globo Social
          </p>
          <p className="text-[10px] text-amber-300/90 tabular-nums mt-0.5 leading-none">
            {onlinePeers.length} en línea
          </p>
        </div>
        {unreadDmCount > 0 && (
          <span className="rounded-full bg-amber-400 text-[#070B17] px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
            {unreadDmCount}
          </span>
        )}
      </button>
    </div>
  );
};
