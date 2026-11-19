import React, { useState } from 'react';
import {
  Award,
  LayoutGrid,
  Lock,
  MessageSquare,
  Mic,
  Radio,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { playPttTone } from '../../services/webAudioPtt';
import type { SocialSubmenuId } from '../../types/ecosystem';
import { FabroBrandMark } from '../brand/FabroBrandMark';
import { SectorLayout } from './SectorLayout';
import { EphemeralStoriesBar } from './social/EphemeralStoriesBar';
import { FriendsNetworkPanel } from './social/FriendsNetworkPanel';
import { InteractiveChatInbox } from './social/InteractiveChatInbox';
import { StudyRoomsTool } from './social/StudyRoomsTool';
import { WallPollsFeed } from './social/WallPollsFeed';

export const Sector3Social: React.FC = () => {
  const {
    submenu,
    navigateTo,
    profile,
    updateProfile,
    network,
    friendsList,
    friendRequests,
    quickChatMessages,
    sendQuickChatMessage,
    openDirectChatWithFriend,
    pomodoroLogs,
    moodLogs,
  } = useEcosystem();

  const activeSub: SocialSubmenuId =
    submenu === 'fabro-id' ||
    submenu === 'amistades' ||
    submenu === 'mensajeria' ||
    submenu === 'push-to-talk' ||
    submenu === 'comunidades-seguridad'
      ? submenu
      : 'fabro-id';

  const [pttActive, setPttActive] = useState(false);
  const [pttCancelled, setPttCancelled] = useState(false);
  const [pttSoundsEnabled, setPttSoundsEnabled] = useState(true);
  const [pttStickerBurst, setPttStickerBurst] = useState<string | null>(null);

  const pendingReqCount = friendRequests.filter(
    (r) => r.direction === 'incoming' && r.status === 'pending'
  ).length;
  const queuedOfflineCount = quickChatMessages.filter(
    (m) => m.deliveryStatus === 'queued-offline'
  ).length;

  const handlePttStart = () => {
    setPttCancelled(false);
    setPttActive(true);
    if (pttSoundsEnabled) playPttTone('start');
  };

  const handlePttSend = () => {
    if (!pttActive) return;
    setPttActive(false);
    if (pttCancelled) return;
    if (pttSoundsEnabled) playPttTone('end');
    sendQuickChatMessage('Audio Push-to-Talk enviado por canal social.');
  };

  const handlePttCancel = () => {
    setPttCancelled(true);
    setPttActive(false);
  };

  const triggerPttSticker = (emoji: string) => {
    setPttStickerBurst(emoji);
    sendQuickChatMessage(`Reacción Walkie-Talkie ${emoji}`, { sticker: emoji });
    setTimeout(() => setPttStickerBurst(null), 1200);
  };

  return (
    <SectorLayout
      sectorId="social"
      activeSubmenu={activeSub}
      badgeText="Página Principal · Amistades y Mensajería Offline"
    >
      {/* Orderly Social Principal Panel */}
      {activeSub === 'fabro-id' && (
        <section className="rounded-2xl border fabro-surface p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2.5 min-w-0">
            <FabroBrandMark size="lg" showIdentity />
            <div className="space-y-1">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                Hola, {profile.displayName}
              </h2>
              <p className="text-xs sm:text-sm fabro-muted leading-relaxed max-w-2xl">
                Conectá con tus amistades, compartí estados 24h y dejá mensajes que se guardan y entregan aunque estén sin conexión.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs fabro-muted font-medium tabular-nums">
              <span>{friendsList.length} amistades</span>
              <span aria-hidden="true">·</span>
              <span>{pendingReqCount} solicitudes</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  queuedOfflineCount > 0
                    ? 'text-amber-700 dark:text-amber-300 font-semibold'
                    : ''
                }
              >
                {queuedOfflineCount} mensajes en cola offline
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  network.isOnline
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-amber-700 dark:text-amber-300 font-semibold'
                }
              >
                {network.isOnline ? 'En línea' : 'Modo Offline-First'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('social', 'mensajeria')}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-[#7C3AED] bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-3.5 py-1.5 md:py-2 text-sm font-medium cursor-pointer active:scale-95 transition-all duration-200 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              Mensajes Offline ({queuedOfflineCount})
            </button>
            <button
              type="button"
              onClick={() => navigateTo('social', 'amistades')}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-[#EC4899]/50 bg-[#EC4899]/10 text-[#BE185D] dark:text-[#F472B6] px-3.5 py-1.5 md:py-2 text-sm font-medium cursor-pointer active:scale-95 transition-all duration-200 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Agregar amistad
            </button>
            <button
              type="button"
              onClick={() => navigateTo('inicio', 'dashboard')}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-1.5 md:py-2 text-sm font-medium cursor-pointer active:scale-95 transition-all duration-200 whitespace-nowrap"
            >
              <LayoutGrid className="w-4 h-4 fabro-accent-text" />
              Espacio Configurable
            </button>
          </div>
        </section>
      )}

      {/* Always visible 24h Ephemeral Stories Bar in Social sector */}
      <EphemeralStoriesBar />

      {activeSub === 'fabro-id' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Quick Friends Offline Access + FABRO ID */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border fabro-surface p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#7C3AED] dark:text-[#C4B5FD]" />
                    Amistades rápidas
                  </h3>
                  <p className="text-[11px] fabro-muted">
                    Escribí directo aunque estén sin conexión
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('social', 'amistades')}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C4B5FD] px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>

              <div className="divide-y fabro-border">
                {friendsList.slice(0, 4).map((friend) => {
                  const offline = friend.availability === 'offline';
                  return (
                    <div
                      key={friend.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold truncate">{friend.displayName}</p>
                        <p className="text-[11px] fabro-muted flex items-center gap-1.5">
                          {offline ? (
                            <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-300 shrink-0" />
                          ) : (
                            <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                          <span className="truncate">
                            {offline ? 'Sin conexión (cola lista)' : 'En línea'} · {friend.fabroId}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openDirectChatWithFriend(friend.id)}
                        className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated hover:border-[#7C3AED] px-3 py-1.5 text-[11px] font-bold cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                      >
                        Escribir
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border fabro-surface p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl border border-[#7C3AED]/40 bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold truncate">
                    {profile.displayName}
                  </h2>
                  <p className="text-xs font-mono font-bold text-[#7C3AED] dark:text-[#C4B5FD] tabular-nums">
                    {profile.fabroId}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#EC4899]" />
                  Progreso verificado localmente
                </p>
                <p className="fabro-muted tabular-nums">
                  {pomodoroLogs.length} Pomodoros · {moodLogs.length} registros de ánimo · Privacidad Local-First
                </p>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
                  Rompehielos para conversar conmigo
                </span>
                <input
                  type="text"
                  value={profile.icebreaker || ''}
                  onChange={(e) => updateProfile({ icebreaker: e.target.value })}
                  placeholder="Ej: Preguntame sobre libros, rutinas o proyectos..."
                  className="min-h-[44px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
                />
              </label>

              {profile.shareTastesPublicly && (
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 text-[11px] space-y-1">
                  <p className="font-bold">Gustos visibles en tarjeta</p>
                  <p className="fabro-muted truncate">Música: {profile.tastes.music}</p>
                  <p className="fabro-muted truncate">Libros: {profile.tastes.books}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Control estricto de privacidad
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'todos', label: 'Todos' },
                      { id: 'grupo', label: 'Grupo' },
                      { id: 'invisible', label: 'Invisible' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updateProfile({ privacyMode: mode.id })}
                      className={`min-h-[42px] rounded-xl border px-2 py-1.5 text-xs font-bold cursor-pointer transition-all active:scale-95 ${
                        profile.privacyMode === mode.id
                          ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                          : 'fabro-border fabro-surface-elevated hover:border-[#7C3AED]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <WallPollsFeed />
          </div>
        </div>
      )}

      {activeSub === 'amistades' && <FriendsNetworkPanel />}

      {activeSub === 'mensajeria' && <InteractiveChatInbox />}

      {activeSub === 'push-to-talk' && (
        <div className="rounded-2xl border fabro-surface p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#EC4899]" />
                Comunicación Push-to-Talk (Walkie-Talkie)
              </h2>
              <p className="text-xs fabro-muted mt-1">
                Tonos originales sintetizados por código con Web Audio API y reacciones instantáneas.
              </p>
            </div>
            <label className="min-h-[44px] inline-flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={pttSoundsEnabled}
                onChange={(e) => setPttSoundsEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#7C3AED]"
              />
              <Volume2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Tonos de radio activos</span>
            </label>
          </div>

          <div className="relative flex flex-col items-center justify-center gap-4 py-6 rounded-2xl border fabro-border fabro-surface-elevated">
            {pttStickerBurst && (
              <div className="absolute top-3 right-4 text-4xl animate-bounce select-none">
                {pttStickerBurst}
              </div>
            )}

            <button
              type="button"
              onPointerDown={handlePttStart}
              onPointerUp={handlePttSend}
              onPointerLeave={() => {
                if (pttActive) handlePttSend();
              }}
              className={`w-44 h-44 rounded-full border-4 flex flex-col items-center justify-center gap-2 text-xs font-bold cursor-pointer select-none transition-transform active:scale-95 ${
                pttActive
                  ? 'border-[#EC4899] bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white shadow-[0_12px_30px_-6px_rgba(236,72,153,0.65)]'
                  : 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#6D28D9] dark:text-[#C4B5FD]'
              }`}
            >
              <Mic className="w-9 h-9" strokeWidth={1.75} />
              <span>{pttActive ? 'Transmitiendo...' : 'Mantener para hablar'}</span>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {pttActive && (
                <button
                  type="button"
                  onClick={handlePttCancel}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-red-500 px-3.5 py-2 text-xs font-bold text-red-600 cursor-pointer active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Cancelar envío
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (pttSoundsEnabled) playPttTone('receive');
                }}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-4 py-2 text-xs font-semibold cursor-pointer active:scale-95"
              >
                <Volume2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                Probar tono de recepción
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="text-[11px] fabro-muted font-semibold">Reacción al canal:</span>
              {['🔥', '👏', '🍀', '💜'].map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => triggerPttSticker(emo)}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-[#EC4899]/35 fabro-surface text-base hover:border-[#EC4899] cursor-pointer active:scale-95"
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSub === 'comunidades-seguridad' && (
        <div className="space-y-5">
          <StudyRoomsTool />

          <div className="rounded-2xl border border-emerald-500/40 fabro-surface p-5 space-y-2">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <ShieldCheck
                className="w-4 h-4 text-emerald-700 dark:text-emerald-400"
                strokeWidth={1.75}
              />
              Moderación y protección de menores
            </h2>
            <p className="text-xs fabro-muted leading-relaxed">
              Política estricta integrada: las cuentas declaradas de menores quedan aisladas de
              contacto directo con adultos desconocidos, sin exposición en directorios abiertos ni
              habilitación de mensajería no autorizada.
            </p>
          </div>
        </div>
      )}
    </SectorLayout>
  );
};
