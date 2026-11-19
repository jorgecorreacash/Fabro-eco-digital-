import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  MessageSquare,
  Search,
  Share2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { SUGGESTED_FRIENDS } from '../../../services/localVault';

export const FriendsNetworkPanel: React.FC = () => {
  const {
    profile,
    friendsList,
    friendRequests,
    quickChatMessages,
    addFriendDirectly,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    toggleFriendAvailability,
    toggleFriendTrustedGroup,
    openDirectChatWithFriend,
  } = useEcosystem();

  const [friendName, setFriendName] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const pendingIncoming = friendRequests.filter(
    (r) => r.direction === 'incoming' && r.status === 'pending'
  );
  const pendingOutgoing = friendRequests.filter(
    (r) => r.direction === 'outgoing' && r.status === 'pending'
  );

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friendsList;
    return friendsList.filter((f) =>
      `${f.displayName} ${f.fabroId} ${f.bio}`.toLowerCase().includes(q)
    );
  }, [friendsList, searchQuery]);

  const availableSuggestions = useMemo(() => {
    const existingIds = new Set(friendsList.map((f) => f.fabroId.toUpperCase()));
    return SUGGESTED_FRIENDS.filter((s) => !existingIds.has(s.fabroId.toUpperCase()));
  }, [friendsList]);

  const inviteUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('addFriendId', profile.fabroId);
    url.searchParams.set('addFriendName', profile.displayName);
    return url.toString();
  }, [profile.displayName, profile.fabroId]);

  const whatsappInviteHref = useMemo(() => {
    const msg = `¡Hola! Sumate como mi amistad en 🍀 FABRO 🍀 (Ecosistema Digital). Tocá este enlace para agregarme y escribirnos incluso sin conexión:\n${inviteUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }, [inviteUrl]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setFeedback('Enlace de amistad copiado. Podés enviarlo por WhatsApp o cualquier chat.');
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch {
      setFeedback(`Compartí tu código manualmente: ${profile.fabroId}`);
    }
  };

  const handleShareNative = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Agregar amistad en FABRO',
          text: `Agregame como amistad en FABRO (${profile.fabroId})`,
          url: inviteUrl,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    void handleCopyInvite();
  };

  const handleAddDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCode.trim() && !friendName.trim()) return;
    const generatedCode =
      friendCode.trim().toUpperCase() || `FBR-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanName = friendName.trim() || `Amistad ${generatedCode}`;
    const created = addFriendDirectly(
      generatedCode,
      cleanName,
      requestNote.trim() || 'Amistad agregada localmente en FABRO',
      'offline'
    );
    setFriendName('');
    setFriendCode('');
    setRequestNote('');
    setFeedback(
      `${created.displayName} (${created.fabroId}) se sumó a tus amistades. Ya podés escribirle aunque esté sin conexión.`
    );
  };

  const handleSendRequest = () => {
    if (!friendCode.trim() && !friendName.trim()) return;
    const generatedCode =
      friendCode.trim().toUpperCase() || `FBR-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanName = friendName.trim() || `Usuario ${generatedCode}`;
    sendFriendRequest(generatedCode, cleanName, requestNote);
    setFriendName('');
    setFriendCode('');
    setRequestNote('');
    setFeedback(`Solicitud enviada a ${cleanName} (${generatedCode}).`);
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-xl border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-4 py-3 text-xs font-medium flex items-center justify-between gap-3">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Cerrar aviso"
            className="p-1 fabro-muted hover:opacity-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Grid: Add Friend + Share Invite Link */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleAddDirect}
          className="lg:col-span-7 rounded-2xl border fabro-surface p-5 sm:p-6 space-y-4"
        >
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#7C3AED] dark:text-[#C4B5FD]" />
              Agregar amistad en FABRO
            </h2>
            <p className="text-xs fabro-muted leading-relaxed">
              Sumá personas por su nombre o FABRO ID. Aunque estén sin conexión, podés dejarles mensajes en su hilo directo y se entregarán al reconectarse.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1.5 block">
              <span className="font-semibold">Nombre o apodo</span>
              <input
                type="text"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                placeholder="Ej: Valentina Rojas"
                className="min-h-[44px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="font-semibold">Código FABRO ID</span>
              <input
                type="text"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                placeholder="Ej: FBR-8410 (opcional)"
                className="min-h-[44px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs font-mono uppercase fabro-input"
              />
            </label>
          </div>

          <label className="space-y-1.5 block text-xs">
            <span className="font-semibold">Nota o materia compartida (opcional)</span>
            <input
              type="text"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Ej: Grupo de estudio o reto de bienestar"
              className="min-h-[44px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#7C3AED] bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 transition-all whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4" />
              Agregar amistad ahora
            </button>
            <button
              type="button"
              onClick={handleSendRequest}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated hover:border-[#7C3AED] px-4 py-2 text-xs font-semibold cursor-pointer active:scale-95 transition-all whitespace-nowrap"
            >
              <Clock className="w-4 h-4 fabro-muted" />
              Enviar solicitud pendiente
            </button>
          </div>
        </form>

        {/* Shareable Invite Card */}
        <div className="lg:col-span-5 rounded-2xl border fabro-surface p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#EC4899]" />
                Tu enlace de amistad
              </h3>
              <span className="font-mono text-xs font-bold text-[#7C3AED] dark:text-[#C4B5FD]">
                {profile.fabroId}
              </span>
            </div>
            <p className="text-xs fabro-muted leading-relaxed">
              Compartí este enlace directo con amigos o compañeros para que te sumen en 1 toque sin registros previos.
            </p>
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 text-[11px] font-mono fabro-muted break-all line-clamp-2">
              {inviteUrl}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyInvite()}
              className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar enlace
                </>
              )}
            </button>

            <a
              href={whatsappInviteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold active:scale-95 whitespace-nowrap"
            >
              <Share2 className="w-4 h-4" />
              Enviar por WhatsApp
            </a>

            <button
              type="button"
              onClick={() => void handleShareNative()}
              aria-label="Compartir invitación"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border fabro-border fabro-surface-elevated cursor-pointer active:scale-95 shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Friend Requests Section (Incoming + Outgoing) */}
      {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
        <section className="rounded-2xl border fabro-surface p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold">Solicitudes de amistad</h3>
            <span className="text-xs fabro-muted font-mono tabular-nums">
              {pendingIncoming.length} recibidas · {pendingOutgoing.length} enviadas
            </span>
          </div>

          <div className="divide-y fabro-border">
            {pendingIncoming.map((req) => (
              <div
                key={req.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-sm">{req.displayName}</span>
                    <span aria-hidden="true" className="fabro-muted">
                      ·
                    </span>
                    <span className="font-mono fabro-muted">{req.fabroId}</span>
                    <span aria-hidden="true" className="fabro-muted">
                      ·
                    </span>
                    <span className="fabro-muted">{req.createdAt}</span>
                  </div>
                  <p className="text-xs fabro-muted leading-relaxed">{req.note}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      respondFriendRequest(req.id, 'accept');
                      setFeedback(`¡Ahora ${req.displayName} forma parte de tus amistades!`);
                    }}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 text-white px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" />
                    Aceptar
                  </button>
                  <button
                    type="button"
                    onClick={() => respondFriendRequest(req.id, 'reject')}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-semibold fabro-muted cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <X className="w-4 h-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))}

            {pendingOutgoing.map((req) => (
              <div
                key={req.id}
                className="py-3.5 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold">{req.displayName}</span>
                    <span aria-hidden="true" className="fabro-muted">
                      ·
                    </span>
                    <span className="font-mono fabro-muted">{req.fabroId}</span>
                    <span aria-hidden="true" className="fabro-muted">
                      ·
                    </span>
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      Solicitud enviada ({req.createdAt})
                    </span>
                  </div>
                  <p className="text-xs fabro-muted truncate">{req.note}</p>
                </div>
                <button
                  type="button"
                  onClick={() => respondFriendRequest(req.id, 'cancel')}
                  className="min-h-[40px] rounded-xl border fabro-border px-3 py-1.5 text-xs fabro-muted cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  Cancelar envío
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends Directory */}
      <section className="rounded-2xl border fabro-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#7C3AED] dark:text-[#C4B5FD]" />
              Mis Amistades
            </h3>
            <p className="text-xs fabro-muted">
              {friendsList.length} contactos · Podés escribirles incluso cuando figuran sin conexión
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o FABRO ID..."
              className="min-h-[44px] w-full rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 py-2 text-xs fabro-input"
            />
          </div>
        </div>

        {filteredFriends.length === 0 ? (
          <p className="text-xs fabro-muted py-6 text-center">
            No se encontraron amistades con ese criterio. Agregá una arriba o probá con otro nombre.
          </p>
        ) : (
          <div className="divide-y fabro-border">
            {filteredFriends.map((friend) => {
              const queuedCount = quickChatMessages.filter(
                (m) => m.recipientId === friend.id && m.deliveryStatus === 'queued-offline'
              ).length;
              const isOnline = friend.availability === 'online';

              return (
                <div
                  key={friend.id}
                  className="py-4 first:pt-1 last:pb-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center font-display font-bold text-sm shrink-0">
                      {friend.displayName
                        .split(' ')
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-bold text-sm text-[var(--fabro-text)]">
                          {friend.displayName}
                        </span>
                        <span aria-hidden="true" className="fabro-muted">
                          ·
                        </span>
                        <span className="font-mono fabro-muted">{friend.fabroId}</span>
                        <span aria-hidden="true" className="fabro-muted">
                          ·
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isOnline
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {isOnline ? (
                            <Wifi className="w-3.5 h-3.5" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5" />
                          )}
                          {isOnline ? 'En línea' : 'Sin conexión'}
                        </span>
                        {queuedCount > 0 && (
                          <>
                            <span aria-hidden="true" className="fabro-muted">
                              ·
                            </span>
                            <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold tabular-nums">
                              {queuedCount} en cola offline
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs fabro-muted leading-relaxed">{friend.bio}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openDirectChatWithFriend(friend.id)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {isOnline ? 'Escribir mensaje' : 'Escribir aunque esté offline'}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleFriendAvailability(friend.id)}
                      title="Simular cambio de conexión para probar entrega offline"
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs font-medium cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                      {isOnline ? (
                        <WifiOff className="w-3.5 h-3.5 fabro-muted" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      {isOnline ? 'Simular offline' : 'Simular reconexión'}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleFriendTrustedGroup(friend.id)}
                      aria-label="Alternar grupo autorizado"
                      title={
                        friend.trustedGroup
                          ? 'En grupo autorizado'
                          : 'Agregar a grupo autorizado'
                      }
                      className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border cursor-pointer active:scale-95 ${
                        friend.trustedGroup
                          ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'fabro-border fabro-surface-elevated fabro-muted'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeFriend(friend.id)}
                      aria-label={`Quitar a ${friend.displayName}`}
                      title="Quitar amistad"
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border fabro-border fabro-surface-elevated text-rose-600 dark:text-rose-400 cursor-pointer active:scale-95"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Suggested Community Members */}
      {availableSuggestions.length > 0 && (
        <section className="rounded-2xl border fabro-surface p-5 sm:p-6 space-y-4">
          <div className="space-y-0.5">
            <h3 className="font-display text-base font-bold">Personas sugeridas en comunidad</h3>
            <p className="text-xs fabro-muted">
              Sumá compañeros de salas de estudio o hábitos en 1 toque.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableSuggestions.map((sug) => (
              <div
                key={sug.fabroId}
                className="rounded-xl border fabro-border fabro-surface-elevated p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold truncate">{sug.displayName}</span>
                    <span className="font-mono text-[11px] fabro-muted shrink-0">
                      {sug.fabroId}
                    </span>
                  </div>
                  <p className="text-xs fabro-muted leading-relaxed">{sug.bio}</p>
                  <p className="text-[11px] font-medium fabro-muted">
                    {sug.availability === 'online' ? 'En línea' : 'Sin conexión (admite mensajes offline)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addFriendDirectly(sug.fabroId, sug.displayName, sug.bio, sug.availability);
                    setFeedback(`${sug.displayName} se sumó a tu lista de amistades.`);
                  }}
                  className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C4B5FD] px-3 py-2 text-xs font-bold cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  Agregar amistad
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
