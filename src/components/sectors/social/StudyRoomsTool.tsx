import React, { useState } from 'react';
import {
  CheckCircle2,
  Flame,
  ImagePlus,
  Loader2,
  Plus,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  saveImageAttachmentToVault,
  saveVideoAttachmentToVault,
} from '../../../services/mediaVault';
import type { SocialMediaAttachment, StudyRoomItem } from '../../../types/ecosystem';
import { MediaLightboxModal, ResolvedMediaDisplay } from './ResolvedMediaDisplay';

export const StudyRoomsTool: React.FC = () => {
  const {
    profile,
    setActiveQuickAction,
    studyRooms,
    setStudyRoomsState,
    addStudyRoomPost,
  } = useEcosystem();

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, SocialMediaAttachment | null>>({});
  const [uploadingRoomId, setUploadingRoomId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newChallenge, setNewChallenge] = useState('');
  const [lightboxMedia, setLightboxMedia] = useState<{
    items: SocialMediaAttachment[];
    title: string;
  } | null>(null);

  const toggleJoin = (id: string) => {
    setStudyRoomsState((prev) =>
      prev.map((r) => (r.id === id ? { ...r, joined: !r.joined } : r))
    );
  };

  const checkInDay = (id: string) => {
    setStudyRoomsState((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const nextDays = Math.min(r.targetDays, r.myStreakDays + 1);
        const updatedRanking = r.ranking.map((entry) =>
          entry.name === profile.displayName || entry.name === 'Invitado FABRO'
            ? { ...entry, name: profile.displayName, days: nextDays }
            : entry
        );
        return { ...r, myStreakDays: nextDays, ranking: updatedRanking };
      })
    );
  };

  const handleRoomMediaPick = async (
    roomId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingRoomId(roomId);
    try {
      const saved = file.type.startsWith('video/')
        ? await saveVideoAttachmentToVault(file)
        : await saveImageAttachmentToVault(file);
      setMediaDrafts((prev) => ({ ...prev, [roomId]: saved }));
    } finally {
      setUploadingRoomId(null);
    }
  };

  const handleSendRoomPost = (roomId: string) => {
    const text = (noteDrafts[roomId] || '').trim();
    const media = mediaDrafts[roomId] || undefined;
    if (!text && !media) return;
    addStudyRoomPost(roomId, text, media);
    setNoteDrafts((prev) => ({ ...prev, [roomId]: '' }));
    setMediaDrafts((prev) => ({ ...prev, [roomId]: null }));
  };

  const createRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const item: StudyRoomItem = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      category: 'Grupo personalizado',
      challengeTitle: newChallenge.trim() || 'Reto 7 días de constancia',
      targetDays: 7,
      myStreakDays: 1,
      joined: true,
      sharedNotes: [],
      ranking: [{ name: profile.displayName, days: 1 }],
    };
    setStudyRoomsState((prev) => [item, ...prev]);
    setNewRoomName('');
    setNewChallenge('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#7C3AED]/40 bg-gradient-to-r from-[#7C3AED]/10 via-transparent to-[#EC4899]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[#7C3AED]" />
            Salas de Enfoque, Grupos y Retos Públicos
          </h3>
          <p className="text-xs fabro-muted mt-0.5">
            Compartí apuntes, fotos y videos cortos directamente en cada grupo sin necesidad de registro previo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveQuickAction('pomodoro')}
          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 shrink-0"
        >
          Iniciar Pomodoro grupal
        </button>
      </div>

      <form
        onSubmit={createRoom}
        className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-col sm:flex-row gap-2 text-xs"
      >
        <input
          type="text"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          placeholder="Crear nueva sala o club de hábitos..."
          className="min-h-[42px] flex-1 rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <input
          type="text"
          value={newChallenge}
          onChange={(e) => setNewChallenge(e.target.value)}
          placeholder="Reto de 7 días (ej: 30 min lectura)"
          className="min-h-[42px] flex-1 rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <button
          type="submit"
          className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Crear sala
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {studyRooms.map((room) => {
          const sorted = [...room.ranking].sort((a, b) => b.days - a.days);
          const draftMedia = mediaDrafts[room.id];
          return (
            <div
              key={room.id}
              className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-[#EC4899]">{room.category}</span>
                  <h3 className="font-display text-base font-bold">{room.name}</h3>
                  <p className="text-xs fabro-muted">{room.challengeTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleJoin(room.id)}
                  className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
                    room.joined
                      ? 'border-[#10B981] bg-[#10B981]/15 text-[#047857] dark:text-[#34D399]'
                      : 'border-[#7C3AED] bg-[#7C3AED] text-white'
                  }`}
                >
                  {room.joined ? 'Unido ✓' : 'Unirme'}
                </button>
              </div>

              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold flex items-center gap-1.5 tabular-nums">
                  <Flame className="w-4 h-4 text-[#EC4899]" />
                  Mi racha: {room.myStreakDays}/{room.targetDays} días
                </span>
                <button
                  type="button"
                  onClick={() => checkInDay(room.id)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Registrar día +1
                </button>
              </div>

              {/* Friendly Ranking */}
              <div className="space-y-1.5 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Ranking amistoso de constancia
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {sorted.slice(0, 3).map((entry, idx) => (
                    <div
                      key={`${entry.name}-${idx}`}
                      className="rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-2 flex items-center justify-between gap-1 text-[11px]"
                    >
                      <span className="truncate font-semibold">
                        #{idx + 1} {entry.name}
                      </span>
                      <span className="font-mono font-bold tabular-nums text-[#7C3AED] dark:text-[#C4B5FD]">
                        {entry.days}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multimedia Group Feed */}
              <div className="space-y-2 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Muro multimedia del grupo
                </p>

                {draftMedia && (
                  <div className="relative rounded-xl border fabro-border p-1.5 fabro-surface-elevated">
                    <ResolvedMediaDisplay item={draftMedia} compact className="h-28" />
                    <button
                      type="button"
                      onClick={() => setMediaDrafts((prev) => ({ ...prev, [room.id]: null }))}
                      aria-label="Quitar adjunto"
                      className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-slate-950/80 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex gap-1.5">
                  <label
                    title="Adjuntar foto o video al grupo"
                    className="min-h-[40px] min-w-[40px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer shrink-0 hover:border-[#7C3AED]"
                  >
                    {uploadingRoomId === room.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />
                    ) : (
                      <ImagePlus className="w-4 h-4 text-[#7C3AED]" />
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => void handleRoomMediaPick(room.id, e)}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={noteDrafts[room.id] || ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [room.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendRoomPost(room.id);
                      }
                    }}
                    placeholder="Compartir apunte, foto o video..."
                    className="min-h-[40px] flex-1 min-w-0 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs fabro-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendRoomPost(room.id)}
                    className="min-h-[40px] rounded-xl border border-[#EC4899]/50 bg-[#EC4899]/10 text-[#BE185D] dark:text-[#F472B6] px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95 shrink-0"
                  >
                    Enviar
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {room.sharedNotes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border fabro-border fabro-surface-elevated p-2.5 text-[11px] space-y-1.5"
                    >
                      <p>
                        <strong className="font-mono">{n.author}:</strong> {n.text}
                      </p>
                      {n.media && (
                        <ResolvedMediaDisplay
                          item={n.media}
                          compact
                          className="h-36"
                          onOpenLightbox={() =>
                            setLightboxMedia({ items: [n.media!], title: room.name })
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lightboxMedia && (
        <MediaLightboxModal
          items={lightboxMedia.items}
          initialIndex={0}
          title={lightboxMedia.title}
          onClose={() => setLightboxMedia(null)}
        />
      )}
    </div>
  );
};
