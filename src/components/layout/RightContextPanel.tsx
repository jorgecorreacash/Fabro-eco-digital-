import React, { useMemo, useState } from 'react';
import {
  CheckCheck,
  Clock,
  Mic,
  PictureInPicture2,
  Radio,
  Send,
  Shield,
  SlidersHorizontal,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { playPttTone } from '../../services/webAudioPtt';

export const RightContextPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    profile,
    updateProfile,
    navigateTo,
    network,
    friendsList,
    activeChatThreadId,
    setActiveChatThreadId,
    quickChatMessages,
    sendQuickChatMessage,
    floatingMode,
    openFloatingMiniWindow,
    openSocialProfileModal,
  } = useEcosystem();

  const [draft, setDraft] = useState('');
  const [pttTransmitting, setPttTransmitting] = useState(false);

  const selectedFriend = useMemo(
    () => friendsList.find((f) => f.id === activeChatThreadId) || null,
    [activeChatThreadId, friendsList]
  );

  const threadMessages = useMemo(
    () => quickChatMessages.filter((m) => (m.recipientId || 'general') === activeChatThreadId),
    [activeChatThreadId, quickChatMessages]
  );

  const willQueueOffline =
    !network.isOnline || (selectedFriend ? selectedFriend.availability === 'offline' : false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendQuickChatMessage(draft, { recipientId: activeChatThreadId });
    setDraft('');
  };

  const handlePttDown = () => {
    if (pttTransmitting) return;
    setPttTransmitting(true);
    playPttTone('start');
  };

  const handlePttUp = () => {
    if (!pttTransmitting) return;
    setPttTransmitting(false);
    playPttTone('end');
    sendQuickChatMessage('Nota de voz Push-to-Talk registrada (canal rápido).', {
      recipientId: activeChatThreadId,
    });
  };

  return (
    <aside
      aria-label="Panel contextual de chat rápido y perfil flotante"
      className="w-80 shrink-0 border-l fabro-border fabro-surface flex flex-col h-[calc(100dvh-3.5rem)] sticky top-14"
    >
      <div className="px-4 py-3 border-b fabro-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#7C3AED] dark:text-[#C4B5FD] truncate">
            Panel contextual
          </p>
          <p className="text-xs fabro-muted truncate">Perfil y mensajería offline</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Ocultar panel derecho"
            className="min-h-[44px] min-w-[44px] rounded-xl border fabro-border flex items-center justify-center fabro-muted hover:opacity-100 cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Persistent FABRO ID Profile */}
      <div className="p-4 border-b fabro-border space-y-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => openSocialProfileModal('publicaciones')}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
          >
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl border border-[#7C3AED]/40 object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl border border-[#7C3AED]/40 bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center shrink-0">
                <User className="w-5 h-5" strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate group-hover:text-[#7C3AED] transition-colors">
                {profile.displayName}
              </p>
              <p className="text-xs font-mono fabro-muted tabular-nums truncate">
                {profile.username ? `@${profile.username}` : profile.fabroId}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => openSocialProfileModal('publicaciones', true)}
            title="Editar Mi Perfil Social"
            aria-label="Editar Mi Perfil Social"
            className="min-h-[44px] min-w-[44px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center fabro-muted hover:opacity-100 cursor-pointer shrink-0 active:scale-95"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <p className="text-xs fabro-muted leading-relaxed line-clamp-2">
          {profile.bio || profile.dailyPhrase}
        </p>

        <button
          type="button"
          onClick={() => openSocialProfileModal('publicaciones')}
          className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#7C3AED]/45 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C4B5FD] px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all"
        >
          <User className="w-3.5 h-3.5 shrink-0" />
          Abrir Mi Perfil Social
        </button>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-medium fabro-muted">
            <Shield className="w-3 h-3" strokeWidth={1.75} />
            Visibilidad FABRO ID
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl fabro-surface-elevated border fabro-border">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'grupo', label: 'Grupo' },
                { id: 'invisible', label: 'Invisible' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateProfile({ privacyMode: opt.id })}
                className={`min-h-[36px] py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  profile.privacyMode === opt.id
                    ? 'bg-[#7C3AED] text-white'
                    : 'fabro-muted hover:opacity-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void openFloatingMiniWindow()}
          className={`w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer active:scale-95 transition-all ${
            floatingMode !== 'closed'
              ? 'border-[#2563EB] bg-[#2563EB] text-white'
              : 'border-[#7C3AED]/45 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C4B5FD]'
          }`}
        >
          <PictureInPicture2 className="w-4 h-4 shrink-0" />
          <span>Modo Flotante (Mini-Ventana)</span>
        </button>
      </div>

      {/* Quick Contextual Chat */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-2.5 border-b fabro-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold">Chat rápido</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateTo('social', 'amistades')}
                className="text-[11px] font-semibold fabro-muted hover:text-[#7C3AED] cursor-pointer inline-flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                Amistades
              </button>
              <button
                type="button"
                onClick={() => navigateTo('social', 'mensajeria')}
                className="text-xs text-[#7C3AED] dark:text-[#C4B5FD] font-bold hover:underline cursor-pointer whitespace-nowrap"
              >
                Expandir
              </button>
            </div>
          </div>

          <select
            value={activeChatThreadId}
            onChange={(e) => setActiveChatThreadId(e.target.value)}
            aria-label="Elegir conversación"
            className="min-h-[38px] w-full rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 text-xs fabro-input"
          >
            <option value="general">Muro General</option>
            {friendsList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.displayName} · {f.availability === 'offline' ? 'Sin conexión' : 'En línea'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {threadMessages.map((msg) => {
            const isQueued = msg.deliveryStatus === 'queued-offline';
            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-3 text-xs space-y-1 ${
                  msg.own
                    ? 'border-[#7C3AED]/30 bg-[#7C3AED]/10 ml-4'
                    : 'fabro-border fabro-surface-elevated mr-4'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] fabro-muted">
                  <span className="font-bold truncate text-[var(--fabro-text)]">{msg.sender}</span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0">
                    {msg.time}
                    {msg.own &&
                      (isQueued ? (
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                      ) : (
                        <CheckCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ))}
                  </span>
                </div>
                {msg.sticker ? (
                  <p className="text-2xl leading-none">{msg.sticker}</p>
                ) : (
                  <p className="leading-relaxed">{msg.text}</p>
                )}
                {msg.audioUrl && (
                  <audio controls src={msg.audioUrl} className="w-full h-8 mt-1" />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSend} className="p-3.5 border-t fabro-border space-y-2">
          {willQueueOffline && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium leading-snug">
              {selectedFriend
                ? `${selectedFriend.displayName} está sin conexión · Se guardará en cola offline.`
                : 'Sin conexión · Se guardará localmente hasta reconectar.'}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                selectedFriend
                  ? `Mensaje a ${selectedFriend.displayName}...`
                  : 'Escribir mensaje rápido...'
              }
              className="min-h-[44px] flex-1 min-w-0 rounded-xl border fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
            />
            <button
              type="submit"
              aria-label="Enviar mensaje rápido"
              className="min-h-[44px] min-w-[44px] rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
            >
              <Send className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <button
            type="button"
            onPointerDown={handlePttDown}
            onPointerUp={handlePttUp}
            onPointerLeave={() => {
              if (pttTransmitting) handlePttUp();
            }}
            className={`min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-bold cursor-pointer transition-all whitespace-nowrap active:scale-95 ${
              pttTransmitting
                ? 'border-[#EC4899] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white'
                : 'border-[#7C3AED]/40 fabro-surface-elevated'
            }`}
          >
            {pttTransmitting ? (
              <>
                <Radio className="w-4 h-4" strokeWidth={1.75} />
                Transmitiendo · Soltá para enviar
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-[#EC4899]" strokeWidth={1.75} />
                Push-to-Talk (mantener)
              </>
            )}
          </button>
        </form>
      </div>
    </aside>
  );
};
