import React, { useEffect, useState } from 'react';
import { CheckCircle2, Flame, Plus, Trophy, Users } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { DEFAULT_STUDY_ROOMS, vaultGet, vaultSet } from '../../../services/localVault';
import type { StudyRoomItem } from '../../../types/ecosystem';

export const StudyRoomsTool: React.FC = () => {
  const { profile, setActiveQuickAction } = useEcosystem();
  const [rooms, setRooms] = useState<StudyRoomItem[]>(DEFAULT_STUDY_ROOMS);
  const [hydrated, setHydrated] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [newRoomName, setNewRoomName] = useState('');
  const [newChallenge, setNewChallenge] = useState('');

  useEffect(() => {
    let active = true;
    void vaultGet<StudyRoomItem[]>('study_rooms', DEFAULT_STUDY_ROOMS).then((stored) => {
      if (!active) return;
      setRooms(stored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void vaultSet('study_rooms', rooms);
  }, [rooms, hydrated]);

  const toggleJoin = (id: string) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, joined: !r.joined } : r))
    );
  };

  const checkInDay = (id: string) => {
    setRooms((prev) =>
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

  const addRoomNote = (id: string) => {
    const text = (noteDrafts[id] || '').trim();
    if (!text) return;
    setRooms((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              sharedNotes: [
                { id: `rn-${Date.now()}`, author: profile.fabroId, text },
                ...r.sharedNotes,
              ],
            }
          : r
      )
    );
    setNoteDrafts((prev) => ({ ...prev, [id]: '' }));
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
    setRooms((prev) => [item, ...prev]);
    setNewRoomName('');
    setNewChallenge('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-[#7C3AED]/40 bg-gradient-to-r from-[#7C3AED]/10 via-transparent to-[#EC4899]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[#7C3AED]" />
            Salas de Enfoque y Retos Públicos
          </h3>
          <p className="text-xs fabro-muted mt-0.5">
            Entrá con un clic a las 3 salas permanentes sin esperar a tener contactos ni registro previo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveQuickAction('pomodoro')}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 shrink-0"
        >
          Iniciar Pomodoro grupal
        </button>
      </div>

      <form
        onSubmit={createRoom}
        className="rounded-2xl border-2 border-[#7C3AED]/30 fabro-surface p-4 flex flex-col sm:flex-row gap-2 text-xs"
      >
        <input
          type="text"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          placeholder="Crear nueva sala o club de hábitos..."
          className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <input
          type="text"
          value={newChallenge}
          onChange={(e) => setNewChallenge(e.target.value)}
          placeholder="Reto de 7 días (ej: 30 min lectura)"
          className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <button
          type="submit"
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Crear sala
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rooms.map((room) => {
          const sorted = [...room.ranking].sort((a, b) => b.days - a.days);
          return (
            <div
              key={room.id}
              className="rounded-2xl border-2 border-[#7C3AED]/30 fabro-surface p-5 space-y-4 shadow-[0_8px_24px_-12px_rgba(124,58,237,0.2)]"
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
                  className={`min-h-[44px] rounded-xl border-2 px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 ${
                    room.joined
                      ? 'border-[#10B981] bg-[#10B981]/15 text-[#047857] dark:text-[#34D399]'
                      : 'border-[#7C3AED] bg-[#7C3AED] text-white'
                  }`}
                >
                  {room.joined ? 'Unido ✓' : 'Unirme'}
                </button>
              </div>

              <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#EC4899]" />
                  Mi racha: {room.myStreakDays}/{room.targetDays} días
                </span>
                <button
                  type="button"
                  onClick={() => checkInDay(room.id)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
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
                      <span className="font-mono font-bold text-[#7C3AED] dark:text-[#C084FC]">
                        {entry.days}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shared notes */}
              <div className="space-y-2 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Notas rápidas del grupo
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteDrafts[room.id] || ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [room.id]: e.target.value }))
                    }
                    placeholder="Compartir tip o apunte..."
                    className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 text-xs fabro-input"
                  />
                  <button
                    type="button"
                    onClick={() => addRoomNote(room.id)}
                    className="min-h-[44px] rounded-xl border-2 border-[#EC4899]/50 bg-[#EC4899]/10 text-[#BE185D] dark:text-[#F472B6] px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    Enviar
                  </button>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {room.sharedNotes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border fabro-border fabro-surface-elevated px-3 py-1.5 text-[11px]"
                    >
                      <strong className="font-mono">{n.author}:</strong> {n.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
