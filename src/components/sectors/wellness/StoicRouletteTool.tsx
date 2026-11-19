import React, { useEffect, useState } from 'react';
import { CheckCircle2, Dices, Plus, Sparkles } from 'lucide-react';
import { vaultGet, vaultSet } from '../../../services/localVault';

interface StoicState {
  joys: string[];
  goals: string[];
  completedCount: number;
}

const DEFAULT_STOIC_STATE: StoicState = {
  joys: [
    'Caminar 15 minutos al aire libre sin mirar el celular',
    'Escuchar tu canción favorita con atención plena',
    'Tomar un café o mate tranquilo conversando con alguien querido',
    'Leer 10 páginas de filosofía estoica o literatura',
  ],
  goals: [
    'Ordenar un cajón o espacio de estudio pendiente',
    'Enviar un mensaje de gratitud genuina a un amigo o familiar',
    'Registrar 3 aprendizajes de la semana en tu diario',
  ],
  completedCount: 2,
};

export const StoicRouletteTool: React.FC = () => {
  const [data, setData] = useState<StoicState>(DEFAULT_STOIC_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [targetType, setTargetType] = useState<'joys' | 'goals'>('joys');
  const [selectedAction, setSelectedAction] = useState<{
    text: string;
    origin: string;
    done: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void vaultGet<StoicState>('stoic_roulette', DEFAULT_STOIC_STATE).then((stored) => {
      if (!active) return;
      setData(stored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void vaultSet('stoic_roulette', data);
  }, [data, hydrated]);

  const spinRoulette = () => {
    const pool = [
      ...data.joys.map((text) => ({ text, origin: 'Lista de felicidad' })),
      ...data.goals.map((text) => ({ text, origin: 'Objetivo pendiente' })),
    ];
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setSelectedAction({ ...pick, done: false });
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setData((prev) => ({
      ...prev,
      [targetType]: [...prev[targetType], newItem.trim()],
    }));
    setNewItem('');
  };

  return (
    <div className="rounded-2xl border-2 border-[#F59E0B]/40 fabro-surface p-5 space-y-4 shadow-[0_8px_24px_-12px_rgba(245,158,11,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#F59E0B]" />
            Ruleta de Micro-Acciones Estoicas y Felicidad
          </h3>
          <p className="text-xs fabro-muted">
            Combina tu lista de bienestar y sueños pendientes para sugerirte una acción concreta hoy.
          </p>
        </div>
        <span className="rounded-full border-2 border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-1 text-xs font-mono font-bold text-[#B45309] dark:text-[#FBBF24]">
          Logradas: {data.completedCount}
        </span>
      </div>

      <div className="rounded-2xl border-2 border-[#10B981]/35 bg-gradient-to-br from-[#10B981]/10 via-transparent to-[#F59E0B]/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={spinRoulette}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_18px_-6px_rgba(245,158,11,0.55)] cursor-pointer transition-transform active:scale-95"
          >
            <Dices className="w-4 h-4" />
            Girar ruleta de hoy
          </button>

          {selectedAction && !selectedAction.done && (
            <button
              type="button"
              onClick={() => {
                setSelectedAction((prev) => (prev ? { ...prev, done: true } : prev));
                setData((prev) => ({ ...prev, completedCount: prev.completedCount + 1 }));
              }}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar como realizada
            </button>
          )}
        </div>

        {selectedAction ? (
          <div className="rounded-xl border-2 fabro-border fabro-surface p-3.5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#047857] dark:text-[#34D399]">
              {selectedAction.origin}
            </span>
            <p className={`text-sm font-semibold ${selectedAction.done ? 'line-through fabro-muted' : ''}`}>
              {selectedAction.text}
            </p>
          </div>
        ) : (
          <p className="text-xs fabro-muted">
            Tocá «Girar ruleta de hoy» para recibir una micro-acción significativa ahora mismo.
          </p>
        )}
      </div>

      <form onSubmit={addItem} className="flex flex-col sm:flex-row gap-2 text-xs">
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value as 'joys' | 'goals')}
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2"
        >
          <option value="joys">Me da felicidad</option>
          <option value="goals">Objetivo pendiente</option>
        </select>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Agregá una nueva actividad o deseo..."
          className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <button
          type="submit"
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981]/10 text-[#047857] dark:text-[#34D399] px-4 py-2 font-bold cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Sumar
        </button>
      </form>
    </div>
  );
};
