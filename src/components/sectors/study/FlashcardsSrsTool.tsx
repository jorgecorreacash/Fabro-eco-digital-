import React, { useEffect, useState } from 'react';
import { Layers, Plus, RotateCw } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { DEFAULT_FLASHCARDS, vaultGet, vaultSet } from '../../../services/localVault';
import type { SrsFlashcard } from '../../../types/ecosystem';
import { ShareResourceButton } from '../../common/ShareResourceButton';

export const FlashcardsSrsTool: React.FC = () => {
  const { profile } = useEcosystem();
  const [cards, setCards] = useState<SrsFlashcard[]>(DEFAULT_FLASHCARDS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [newSubject, setNewSubject] = useState('Estudio');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  useEffect(() => {
    void vaultGet<SrsFlashcard[]>('srs_flashcards', DEFAULT_FLASHCARDS).then((loaded) => {
      if (loaded.length > 0) setCards(loaded);
    });
  }, []);

  const currentCard = cards[activeIndex % cards.length];

  const handleRate = (difficulty: 'dificil' | 'regular' | 'facil') => {
    if (!currentCard) return;
    const intervalLabel =
      difficulty === 'dificil' ? 'Hoy (10 min)' : difficulty === 'regular' ? '1 día' : '4 días';

    const next = cards.map((c) =>
      c.id === currentCard.id
        ? { ...c, difficulty, intervalLabel, reviews: c.reviews + 1 }
        : c
    );
    setCards(next);
    void vaultSet('srs_flashcards', next);
    setFlipped(false);
    setActiveIndex((prev) => (prev + 1) % next.length);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    const created: SrsFlashcard = {
      id: `fc-${Date.now()}`,
      subject: newSubject.trim() || 'General',
      front: newFront.trim(),
      back: newBack.trim(),
      difficulty: 'nueva',
      intervalLabel: 'Hoy',
      reviews: 0,
    };
    const next = [created, ...cards];
    setCards(next);
    void vaultSet('srs_flashcards', next);
    setNewFront('');
    setNewBack('');
    setActiveIndex(0);
    setFlipped(false);
  };

  return (
    <div className="rounded-2xl border-2 border-[#06B6D4]/40 fabro-surface p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#06B6D4]" />
            Modo Repaso Activo (Flashcards con Repetición Espaciada)
          </h2>
          <p className="text-xs fabro-muted mt-0.5">
            Tocá la tarjeta para girarla, calificá su dificultad o compartí todo el mazo por WhatsApp.
          </p>
        </div>
        <span className="font-mono text-xs fabro-muted tabular-nums">
          Tarjeta {(activeIndex % cards.length) + 1} / {cards.length}
        </span>
      </div>

      <ShareResourceButton
        label="Compartir mazo por WhatsApp"
        payload={{
          v: 1,
          kind: 'flashcards',
          title: `Mazo de ${cards.length} Flashcards (${currentCard?.subject || 'Estudio'})`,
          subject: currentCard?.subject || 'Estudio Activo',
          cards: cards.slice(0, 12).map((c) => ({ front: c.front, back: c.back })),
          author: profile.displayName,
        }}
      />

      {currentCard && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            className="w-full min-h-[168px] rounded-2xl border-2 p-6 text-left flex flex-col justify-between gap-3 cursor-pointer active:scale-[0.98] transition-all"
            style={{
              borderColor: flipped ? '#06B6D4' : '#2563EB',
              backgroundColor: flipped ? 'rgba(6, 182, 212, 0.10)' : 'rgba(37, 99, 235, 0.08)',
              boxShadow: '0 10px 24px -10px rgba(37, 99, 235, 0.25)',
            }}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#2563EB] dark:text-[#38BDF8]">
                {currentCard.subject} · {flipped ? 'Respuesta' : 'Pregunta'}
              </span>
              <span className="inline-flex items-center gap-1 font-mono fabro-muted tabular-nums">
                <RotateCw className="w-3.5 h-3.5" />
                {currentCard.intervalLabel}
              </span>
            </div>

            <p className="text-sm sm:text-base font-bold leading-relaxed">
              {flipped ? currentCard.back : currentCard.front}
            </p>

            <span className="text-[11px] fabro-muted">
              Repasos: {currentCard.reviews} · Tocá para voltear
            </span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleRate('dificil')}
              className="fabro-btn border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            >
              Difícil (Hoy)
            </button>
            <button
              type="button"
              onClick={() => handleRate('regular')}
              className="fabro-btn border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300"
            >
              Regular (1 día)
            </button>
            <button
              type="button"
              onClick={() => handleRate('facil')}
              className="fabro-btn border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            >
              Fácil (4 días)
            </button>
          </div>
        </div>
      )}

      {/* Add Custom Flashcard */}
      <form
        onSubmit={handleAddCard}
        className="pt-4 border-t fabro-border grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs"
      >
        <input
          type="text"
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="Materia"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <input
          type="text"
          value={newFront}
          onChange={(e) => setNewFront(e.target.value)}
          placeholder="Pregunta / Frente"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <input
          type="text"
          value={newBack}
          onChange={(e) => setNewBack(e.target.value)}
          placeholder="Respuesta / Dorso"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <button type="submit" className="fabro-btn border-[#2563EB] bg-[#2563EB] text-white">
          <Plus className="w-4 h-4" />
          Crear tarjeta
        </button>
      </form>
    </div>
  );
};
