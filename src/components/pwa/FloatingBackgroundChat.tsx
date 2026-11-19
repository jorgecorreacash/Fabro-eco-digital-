import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCheck,
  Clock3,
  MessageSquare,
  Minimize2,
  PictureInPicture2,
  Radio,
  Send,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { playPttTone } from '../../services/webAudioPtt';

export const FloatingBackgroundChat: React.FC = () => {
  const {
    floatingChatOpen,
    setFloatingChatOpen,
    floatingMode,
    openFloatingMiniWindow,
    friendsList,
    activeChatThreadId,
    setActiveChatThreadId,
    quickChatMessages,
    sendQuickChatMessage,
    flushQueuedMessages,
    network,
    navigateTo,
  } = useEcosystem();

  const [draft, setDraft] = useState('');
  const [pttHolding, setPttHolding] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const threadMessages = quickChatMessages.filter(
    (m) => (m.recipientId || 'general') === activeChatThreadId
  );
  const queuedTotal = quickChatMessages.filter(
    (m) => m.deliveryStatus === 'queued-offline'
  ).length;
  const activeFriend = friendsList.find((f) => f.id === activeChatThreadId);

  useEffect(() => {
    if (floatingChatOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [floatingChatOpen, threadMessages.length]);

  // If external Document PiP is active, avoid duplicate floating card
  if (floatingMode === 'document-pip') return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendQuickChatMessage(draft, { recipientId: activeChatThreadId });
    setDraft('');
  };

  const startQuickPtt = () => {
    if (pttHolding) return;
    setPttHolding(true);
    playPttTone('start');
  };

  const endQuickPtt = () => {
    if (!pttHolding) return;
    setPttHolding(false);
    playPttTone('end');
    sendQuickChatMessage('Audio Push-to-Talk desde Chat Flotante.', {
      recipientId: activeChatThreadId,
    });
  };

  if (!floatingChatOpen) {
    return (
      <button
        type="button"
        onClick={() => setFloatingChatOpen(true)}
        aria-label="Abrir chat flotante para segundo plano"
        title="Chat flotante de segundo plano"
        className="no-print fixed bottom-[72px] right-3 lg:bottom-5 lg:right-5 z-40 h-12 px-4 rounded-2xl text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer active:scale-95 transition-transform shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
          boxShadow: '0 10px 26px -6px rgba(124, 58, 237, 0.55)',
        }}
      >
        <MessageSquare className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Chat Flotante</span>
        {queuedTotal > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-white/25 font-mono text-[10px] tabular-nums">
            {queuedTotal}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-label="Chat flotante para segundo plano"
      className="no-print fixed bottom-[68px] right-2.5 lg:bottom-5 lg:right-6 z-50 w-[340px] max-w-[calc(100vw-1.25rem)] rounded-2xl border-2 border-[#7C3AED] fabro-surface shadow-2xl overflow-hidden text-xs fabro-screen-enter"
    >
      {/* Colorful Header */}
      <div
        className="px-3.5 py-2.5 text-white flex items-center justify-between gap-2"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}
      >
        <div className="min-w-0">
          <p className="font-display text-xs font-extrabold truncate flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            Chat Flotante · Segundo Plano
          </p>
          <p className="text-[10px] opacity-90 truncate">
            {activeFriend
              ? `${activeFriend.displayName} (${
                  activeFriend.availability === 'offline' ? 'Sin conexión · cola lista' : 'En línea'
                })`
              : 'Canal General · Offline-First'}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void openFloatingMiniWindow()}
            title="Separar en Mini-Ventana externa (Segundo plano)"
            aria-label="Separar en ventana flotante externa"
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center cursor-pointer"
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFloatingChatOpen(false)}
            title="Minimizar burbuja"
            aria-label="Minimizar chat flotante"
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFloatingChatOpen(false)}
            aria-label="Cerrar chat flotante"
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Thread Switcher Strip */}
      <div className="px-3 py-2 border-b fabro-border fabro-surface-elevated flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveChatThreadId('general')}
          className={`min-h-[30px] rounded-lg border px-2.5 py-1 text-[11px] font-bold shrink-0 cursor-pointer ${
            activeChatThreadId === 'general'
              ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
              : 'fabro-border fabro-surface fabro-muted'
          }`}
        >
          General
        </button>
        {friendsList.map((fr) => {
          const selected = activeChatThreadId === fr.id;
          return (
            <button
              key={fr.id}
              type="button"
              onClick={() => setActiveChatThreadId(fr.id)}
              className={`min-h-[30px] rounded-lg border px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                selected
                  ? 'border-[#7C3AED] bg-[#7C3AED] text-white font-bold'
                  : 'fabro-border fabro-surface'
              }`}
            >
              {fr.availability === 'offline' ? (
                <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />
              ) : (
                <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
              )}
              <span className="truncate max-w-[92px]">{fr.displayName.split(' ')[0]}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setFloatingChatOpen(false);
            navigateTo('social', 'amistades');
          }}
          title="Agregar amistad"
          className="min-h-[30px] rounded-lg border fabro-border fabro-surface px-2 py-1 text-[11px] font-bold shrink-0 cursor-pointer"
        >
          <UserPlus className="w-3 h-3" />
        </button>
      </div>

      {/* Messages Feed */}
      <div ref={listRef} className="p-3 space-y-2 max-h-56 overflow-y-auto">
        {threadMessages.length === 0 ? (
          <p className="text-[11px] fabro-muted py-4 text-center">
            Escribí aquí: si tu contacto está sin conexión, el mensaje se guarda y se entrega automáticamente al reconectarse.
          </p>
        ) : (
          threadMessages.slice(-10).map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl border px-3 py-2 text-[11px] ${
                msg.own
                  ? 'border-[#7C3AED]/35 bg-[#7C3AED]/10 ml-5'
                  : 'fabro-border fabro-surface-elevated mr-5'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] fabro-muted">
                <span className="font-bold text-[var(--fabro-text)] truncate">{msg.sender}</span>
                <span className="font-mono flex items-center gap-1 shrink-0">
                  {msg.time}
                  {msg.own &&
                    (msg.deliveryStatus === 'queued-offline' ? (
                      <Clock3
                        className="w-3 h-3 text-amber-600 dark:text-amber-400"
                        aria-label="En cola offline"
                      />
                    ) : (
                      <CheckCheck
                        className="w-3 h-3 text-emerald-600 dark:text-emerald-400"
                        aria-label="Entregado"
                      />
                    ))}
                </span>
              </div>
              <p className="mt-0.5 leading-snug">{msg.sticker || msg.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Offline Queue Banner & Input */}
      <div className="p-3 border-t fabro-border space-y-2">
        {queuedTotal > 0 && (
          <div className="flex items-center justify-between gap-2 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
            <span>{queuedTotal} mensaje(s) esperando conexión</span>
            {network.isOnline && (
              <button
                type="button"
                onClick={() => flushQueuedMessages(activeChatThreadId)}
                className="underline cursor-pointer"
              >
                Entregar ahora
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={startQuickPtt}
            onPointerUp={endQuickPtt}
            onPointerLeave={() => {
              if (pttHolding) endQuickPtt();
            }}
            aria-label="Mantener para enviar nota rápida PTT"
            title="Mantener para hablar (PTT)"
            className={`min-h-[38px] min-w-[38px] rounded-xl border flex items-center justify-center cursor-pointer select-none shrink-0 ${
              pttHolding
                ? 'border-[#EC4899] bg-[#EC4899] text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Radio className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              activeFriend?.availability === 'offline'
                ? 'Escribí (se entrega al volver)...'
                : 'Escribir mensaje...'
            }
            className="min-h-[38px] flex-1 min-w-0 rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1 text-xs fabro-input"
          />

          <button
            type="submit"
            aria-label="Enviar mensaje"
            className="min-h-[38px] min-w-[38px] rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
