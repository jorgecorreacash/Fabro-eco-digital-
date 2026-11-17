import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowLeft, Check, Layers, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import type { FlashcardDeck, FlashcardItem } from '../../types/fabro';

/**
 * SM-2 Spaced Repetition calculation
 */
function calculateSM2(
  card: FlashcardItem,
  quality: 'dificil' | 'bien' | 'facil'
): Pick<FlashcardItem, 'easeFactor' | 'intervalDays' | 'repetitions' | 'nextReviewDate' | 'lastResult'> {
  const q = quality === 'dificil' ? 2 : quality === 'bien' ? 4 : 5;
  let ef = card.easeFactor || 2.5;
  let reps = card.repetitions || 0;
  let interval = card.intervalDays || 0;

  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps += 1;
  }

  ef = Math.max(1.3, Math.min(5.0, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  const next = new Date();
  next.setDate(next.getDate() + interval);

  return {
    easeFactor: Number(ef.toFixed(2)),
    intervalDays: interval,
    repetitions: reps,
    nextReviewDate: next.toISOString().slice(0, 10),
    lastResult: quality,
  };
}

export const MemorizationView: React.FC = () => {
  const {
    user,
    decks,
    subjects,
    selectedSubjectId,
    createDeck,
    deleteDeck,
    createCard,
    updateCardReview,
    deleteCard,
    logStudySession,
  } = useFabro();

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [mobileShowDeck, setMobileShowDeck] = useState(false);
  const [cards, setCards] = useState<FlashcardItem[]>([]);

  // Deck / Card modal state
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckSubjectId, setDeckSubjectId] = useState(selectedSubjectId || '');
  const [deckDesc, setDeckDesc] = useState('');

  const [showCardForm, setShowCardForm] = useState(false);
  const [cardType, setCardType] = useState<FlashcardItem['cardType']>('flashcard');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [optionsText, setOptionsText] = useState('Opción A\nOpción B\nOpción C');
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);

  // Study Session state
  const [studying, setStudying] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedMcq, setSelectedMcq] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedDeckId && decks.length > 0) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  const selectedDeck: FlashcardDeck | null = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) || null,
    [decks, selectedDeckId]
  );

  // Subscribe to cards inside selectedDeck
  useEffect(() => {
    if (!user || !selectedDeckId) {
      setCards([]);
      return;
    }
    const path = `flashcardDecks/${selectedDeckId}/cards`;
    const q = query(collection(db, 'flashcardDecks', selectedDeckId, 'cards'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCards(snap.docs.map((d) => d.data() as FlashcardItem));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [user, selectedDeckId]);

  const today = new Date().toISOString().slice(0, 10);
  const dueCards = useMemo(
    () => cards.filter((c) => c.nextReviewDate <= today),
    [cards, today]
  );

  const masteredCount = useMemo(
    () => cards.filter((c) => c.repetitions >= 2 && c.intervalDays >= 6).length,
    [cards]
  );

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckTitle.trim()) return;
    const id = await createDeck({
      subjectId: deckSubjectId,
      title: deckTitle,
      description: deckDesc,
    });
    setSelectedDeckId(id);
    setMobileShowDeck(true);
    setShowDeckForm(false);
    setDeckTitle('');
    setDeckDesc('');
  };

  const parsedMcqOptions = useMemo(
    () =>
      optionsText
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean)
        .slice(0, 6),
    [optionsText]
  );

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeck || !question.trim()) return;
    const opts =
      cardType === 'vf'
        ? ['Verdadero', 'Falso']
        : cardType === 'opcion_multiple'
        ? parsedMcqOptions
        : [];

    const clampedIdx =
      cardType === 'flashcard'
        ? -1
        : Math.max(0, Math.min(Math.max(0, opts.length - 1), correctOptionIndex));

    const finalAnswer =
      cardType === 'vf' || cardType === 'opcion_multiple'
        ? opts[clampedIdx] || answer.trim() || 'Ver opción correcta'
        : answer.trim();

    await createCard(selectedDeck.id, {
      question,
      answer: finalAnswer,
      cardType,
      options: opts,
      correctOptionIndex: clampedIdx,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewDate: today,
      lastResult: 'pendiente',
    });

    setShowCardForm(false);
    setQuestion('');
    setAnswer('');
  };

  const studyQueue = dueCards.length > 0 ? dueCards : cards;
  const currentCard = studyQueue[studyIndex] || null;

  const handleRateCard = async (rating: 'dificil' | 'bien' | 'facil') => {
    if (!selectedDeck || !currentCard) return;
    const patch = calculateSM2(currentCard, rating);
    await updateCardReview(selectedDeck.id, currentCard.id, patch);

    if (studyIndex + 1 < studyQueue.length) {
      setStudyIndex((i) => i + 1);
      setRevealed(false);
      setSelectedMcq(null);
    } else {
      setStudying(false);
      setStudyIndex(0);
      setRevealed(false);
      setSelectedMcq(null);
      void logStudySession({
        subjectId: selectedDeck.subjectId,
        activityType: 'memorizacion',
        durationMinutes: Math.max(3, studyQueue.length * 2),
        topic: `Repaso: ${selectedDeck.title}`,
        date: today,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Sistema de memorización
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tarjetas de estudio, verdadero o falso, opción múltiple y repetición espaciada SM-2.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeckForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          Nuevo mazo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Decks List (Master view on mobile) */}
        <aside
          className={`lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden ${
            mobileShowDeck ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-sm font-bold">Mazos de estudio ({decks.length})</h3>
          </div>
          {decks.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Creá tu primer mazo o generá fichas desde la Biblioteca Inteligente.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {decks.map((d) => (
                <div
                  key={d.id}
                  className={`px-4 py-3 flex items-center justify-between gap-2 ${
                    selectedDeckId === d.id ? 'bg-sky-500/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDeckId(d.id);
                      setStudying(false);
                      setMobileShowDeck(true);
                    }}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{d.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {subjects.find((s) => s.id === d.subjectId)?.name || 'General'} · <span className="font-mono tabular-nums">{d.cardCount}</span> tarjetas
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void deleteDeck(d.id);
                      if (selectedDeckId === d.id) {
                        setSelectedDeckId(null);
                        setMobileShowDeck(false);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                    aria-label="Eliminar mazo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Active Deck Workspace (Detail view on mobile) */}
        <section
          className={`lg:col-span-8 space-y-5 ${
            mobileShowDeck ? 'block' : 'hidden lg:block'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setMobileShowDeck(false);
              setStudying(false);
            }}
            className="lg:hidden inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a todos los mazos
          </button>
          {!selectedDeck ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1623] p-12 text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-500">Seleccioná o creá un mazo para practicar.</p>
            </div>
          ) : studying && currentCard ? (
            /* Active Study Runner */
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Tarjeta <strong className="font-mono tabular-nums">{studyIndex + 1}</strong> de{' '}
                  <strong className="font-mono tabular-nums">{studyQueue.length}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStudying(false)}
                  className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Salir del repaso
                </button>
              </div>

              <div className="min-h-[160px] flex flex-col justify-center space-y-4">
                <p className="font-display text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  {currentCard.question}
                </p>

                {currentCard.cardType !== 'flashcard' && currentCard.options.length > 0 && (
                  <div className="space-y-2">
                    {currentCard.options.map((opt, idx) => {
                      const isCorrect = idx === currentCard.correctOptionIndex;
                      const isChosen = selectedMcq === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedMcq(idx);
                            setRevealed(true);
                          }}
                          className={`w-full text-left rounded-xl border px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                            revealed
                              ? isCorrect
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : isChosen
                                ? 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300'
                                : 'border-slate-200 dark:border-slate-800'
                              : 'border-slate-200 dark:border-slate-800 hover:border-sky-500/50'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {revealed && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4 space-y-1">
                    <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">Respuesta</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                      {currentCard.answer}
                    </p>
                  </div>
                )}
              </div>

              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Mostrar respuesta
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRateCard('dificil')}
                    className="rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/20 cursor-pointer"
                  >
                    Difícil (1 día)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRateCard('bien')}
                    className="rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                  >
                    Bien
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRateCard('facil')}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                  >
                    Fácil
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Deck Summary & Cards List */
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {selectedDeck.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {cards.length} tarjetas · {dueCards.length} pendientes hoy · {masteredCount} dominadas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCardForm(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar tarjeta
                  </button>
                  {cards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudyIndex(0);
                        setRevealed(false);
                        setSelectedMcq(null);
                        setStudying(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                    >
                      {dueCards.length > 0 ? <Play className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {dueCards.length > 0 ? `Repasar (${dueCards.length})` : 'Practicar todo'}
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] divide-y divide-slate-200 dark:divide-slate-800">
                {cards.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-500">
                    Este mazo todavía no tiene tarjetas.
                  </p>
                ) : (
                  cards.map((c) => (
                    <div key={c.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{c.question}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {c.answer} · Próximo repaso: <span className="font-mono tabular-nums">{c.nextReviewDate}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteCard(selectedDeck.id, c.id, cards.length)}
                        className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Create Deck Modal */}
      {showDeckForm && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] my-2 sm:my-6 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623]">
              <h3 className="font-display text-lg font-bold">Nuevo mazo de estudio</h3>
              <button type="button" onClick={() => setShowDeckForm(false)} className="p-1.5 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateDeck} className="p-4 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nombre del mazo *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={200}
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  placeholder="Ej. Definiciones de Derecho Constitucional"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nombre de la materia
                </label>
                <select
                  value={deckSubjectId}
                  onChange={(e) => setDeckSubjectId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  <option value="">General</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={deckDesc}
                  onChange={(e) => setDeckDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDeckForm(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer">
                  Crear mazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Card Modal */}
      {showCardForm && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] my-2 sm:my-6 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623]">
              <h3 className="font-display text-lg font-bold">Nueva tarjeta</h3>
              <button type="button" onClick={() => setShowCardForm(false)} className="p-1.5 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCard} className="p-4 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tipo de tarjeta
                </label>
                <select
                  value={cardType}
                  onChange={(e) => {
                    setCardType(e.target.value as FlashcardItem['cardType']);
                    setCorrectOptionIndex(0);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  <option value="flashcard">Tarjeta (Pregunta / Respuesta)</option>
                  <option value="vf">Verdadero o Falso</option>
                  <option value="opcion_multiple">Opción múltiple</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Pregunta / Consigna *
                </label>
                <textarea
                  rows={2}
                  required
                  autoFocus
                  maxLength={1500}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              {cardType === 'flashcard' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Respuesta *
                  </label>
                  <textarea
                    rows={3}
                    required
                    maxLength={2000}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {cardType === 'vf' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Respuesta correcta
                  </label>
                  <select
                    value={correctOptionIndex}
                    onChange={(e) => setCorrectOptionIndex(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value={0}>Verdadero</option>
                    <option value={1}>Falso</option>
                  </select>
                </div>
              )}

              {cardType === 'opcion_multiple' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Opciones (una por línea)
                    </label>
                    <textarea
                      rows={3}
                      value={optionsText}
                      onChange={(e) => setOptionsText(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Respuesta correcta
                    </label>
                    <select
                      value={Math.min(correctOptionIndex, Math.max(0, parsedMcqOptions.length - 1))}
                      onChange={(e) => setCorrectOptionIndex(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                    >
                      {parsedMcqOptions.map((opt, idx) => (
                        <option key={idx} value={idx}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCardForm(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer">
                  <Check className="w-4 h-4" />
                  Guardar tarjeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
