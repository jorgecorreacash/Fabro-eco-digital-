import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Mic,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RotateCcw,
  Send,
  Smartphone,
  Timer,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  emitAndroidBubbleEvent,
  hasNativeAndroidBubbles,
} from '../../services/androidBubblesBridge';
import { playPttTone } from '../../services/webAudioPtt';

export const FloatingMiniWindow: React.FC = () => {
  const {
    profile,
    pomoPhase,
    pomoSubject,
    pomoSecondsLeft,
    pomoRunning,
    togglePomodoro,
    resetPomodoro,
    friendsList,
    activeChatThreadId,
    quickChatMessages,
    sendQuickChatMessage,
    unreadNotifications,
    floatingMode,
    floatingNotice,
    pipContainer,
    closeFloatingMiniWindow,
    dismissFloatingNotice,
    navigateTo,
  } = useEcosystem();

  const [draft, setDraft] = useState('');
  const [pttActive, setPttActive] = useState(false);

  if (floatingMode === 'closed') return null;

  const mm = String(Math.floor(pomoSecondsLeft / 60)).padStart(2, '0');
  const ss = String(pomoSecondsLeft % 60).padStart(2, '0');
  const timerLabel = `${mm}:${ss}`;
  const threadMessages = quickChatMessages.filter(
    (m) => (m.recipientId || 'general') === activeChatThreadId
  );
  const latestMessages = threadMessages.slice(-3);
  const activeFriend = friendsList.find((f) => f.id === activeChatThreadId);
  const nativeBubbles = hasNativeAndroidBubbles();

  const snapshot = {
    fabroId: profile.fabroId,
    displayName: profile.displayName,
    privacyMode: profile.privacyMode,
    timerLabel,
    timerRunning: pomoRunning,
    unreadCount: unreadNotifications,
    lastMessage: latestMessages[latestMessages.length - 1]?.text || 'Sin mensajes',
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendQuickChatMessage(draft, { recipientId: activeChatThreadId });
    emitAndroidBubbleEvent('bubble-chat-send', snapshot, { text: draft.trim() });
    setDraft('');
  };

  const startPtt = () => {
    if (pttActive) return;
    setPttActive(true);
    playPttTone('start');
    emitAndroidBubbleEvent('bubble-ptt-start', snapshot);
  };

  const endPtt = () => {
    if (!pttActive) return;
    setPttActive(false);
    playPttTone('end');
    sendQuickChatMessage('Audio Push-to-Talk desde Mini-Ventana Flotante.', {
      recipientId: activeChatThreadId,
    });
    emitAndroidBubbleEvent('bubble-ptt-end', snapshot);
  };

  const cardBody = (
    <div className="rounded-2xl border-2 border-[#7C3AED] fabro-surface shadow-2xl overflow-hidden text-xs">
      {/* Mini-Window Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#EC4899] text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PictureInPicture2 className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-xs font-extrabold truncate">
              🍀 FABRO · Mini-Ventana
            </p>
            <p className="text-[10px] font-mono opacity-90 truncate">
              {profile.fabroId} · {floatingMode === 'document-pip' ? 'PiP Nativo' : 'Modo Compacto'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeFloatingMiniWindow}
          aria-label="Cerrar mini-ventana flotante"
          className="min-h-[34px] min-w-[34px] rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Notice if browser / iOS fell back from Document PiP */}
        {floatingNotice && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-start justify-between gap-2">
            <span className="leading-snug">{floatingNotice}</span>
            <button
              type="button"
              onClick={dismissFloatingNotice}
              aria-label="Ocultar aviso"
              className="p-0.5 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Pomodoro Timer */}
        <div className="rounded-xl border-2 border-[#2563EB]/40 bg-[#2563EB]/5 p-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-[#2563EB] dark:text-[#60A5FA] flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {pomoPhase === 'focus' ? 'Enfoque' : 'Descanso'} · {pomoSubject}
            </p>
            <p className="font-mono text-2xl font-extrabold tabular-nums leading-tight">
              {timerLabel}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                togglePomodoro();
                emitAndroidBubbleEvent('bubble-timer-toggle', snapshot);
              }}
              aria-label={pomoRunning ? 'Pausar Pomodoro' : 'Iniciar Pomodoro'}
              className="min-h-[40px] min-w-[40px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white flex items-center justify-center cursor-pointer active:scale-95"
            >
              {pomoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={resetPomodoro}
              aria-label="Reiniciar Pomodoro"
              className="min-h-[40px] min-w-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Push-to-Talk */}
        <button
          type="button"
          onPointerDown={startPtt}
          onPointerUp={endPtt}
          onPointerLeave={() => {
            if (pttActive) endPtt();
          }}
          className={`w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 font-bold cursor-pointer select-none active:scale-95 transition-all ${
            pttActive
              ? 'border-[#EC4899] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white'
              : 'border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C084FC]'
          }`}
        >
          {pttActive ? <Radio className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{pttActive ? 'Transmitiendo · Soltá' : 'Push-to-Talk rápido (mantener)'}</span>
        </button>

        {/* Latest Chat Messages + Quick Send */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold flex items-center gap-1 truncate">
              <MessageSquare className="w-3.5 h-3.5 text-[#EC4899] shrink-0" />
              <span className="truncate">
                {activeFriend ? `${activeFriend.displayName}` : 'Canal General'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => navigateTo('social', 'mensajeria')}
              className="text-[11px] font-bold text-[#7C3AED] dark:text-[#C084FC] hover:underline cursor-pointer shrink-0"
            >
              Abrir chat
            </button>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
            {latestMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  msg.own
                    ? 'border-[#7C3AED]/30 bg-[#7C3AED]/10 ml-3'
                    : 'fabro-border fabro-surface-elevated mr-3'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] fabro-muted">
                  <span className="font-bold truncate text-[var(--fabro-text)]">{msg.sender}</span>
                  <span className="font-mono">{msg.time}</span>
                </div>
                <p className="leading-snug line-clamp-2">{msg.sticker || msg.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-1.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Responder rápido..."
              className="min-h-[38px] flex-1 min-w-0 rounded-xl border-2 fabro-border fabro-surface-elevated px-2.5 py-1 text-xs fabro-input"
            />
            <button
              type="submit"
              aria-label="Enviar respuesta rápida"
              className="min-h-[38px] min-w-[38px] rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Android Bubbles Bridge readiness line */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t fabro-border text-[10px] fabro-muted">
          <span className="inline-flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-[#10B981]" />
            {nativeBubbles
              ? 'Android Bubbles Nativo conectado'
              : 'Puente Android Bubbles listo'}
          </span>
          <button
            type="button"
            onClick={() => navigateTo('estudio', 'academico-panel')}
            className="font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
          >
            Ir a Estudio
          </button>
        </div>
      </div>
    </div>
  );

  if (floatingMode === 'document-pip' && pipContainer) {
    return createPortal(cardBody, pipContainer);
  }

  return (
    <div
      role="dialog"
      aria-label="Mini-Ventana Flotante FABRO"
      className="no-print fixed bottom-[124px] lg:bottom-20 right-3 lg:right-6 z-50 w-80 max-w-[calc(100vw-1.5rem)]"
    >
      {cardBody}
    </div>
  );
};
