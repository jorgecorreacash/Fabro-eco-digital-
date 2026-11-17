import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  BookMarked,
  Brain,
  Check,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import type { DictionaryEntry } from '../../types/fabro';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';

function normalizeTermKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 160);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const DictionaryView: React.FC = () => {
  const {
    profile,
    subjects,
    selectedSubjectId,
    dictionaryEntries,
    saveDictionaryEntry,
    updateDictionaryEntry,
    deleteDictionaryEntry,
    createNote,
    decks,
    createDeck,
    createCard,
  } = useFabro();

  const isOnline = useOnlineStatus();

  const [queryTerm, setQueryTerm] = useState('');
  const [filterText, setFilterText] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [subjectId, setSubjectId] = useState(selectedSubjectId || '');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [personalNoteDraft, setPersonalNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Quick vocabulary memory quiz state
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizRevealed, setQuizRevealed] = useState(false);

  useEffect(() => {
    if (selectedSubjectId && !subjectId) {
      setSubjectId(selectedSubjectId);
    }
  }, [selectedSubjectId, subjectId]);

  const selectedEntry: DictionaryEntry | null = useMemo(() => {
    if (selectedEntryId) {
      return dictionaryEntries.find((e) => e.id === selectedEntryId) || null;
    }
    return dictionaryEntries[0] || null;
  }, [dictionaryEntries, selectedEntryId]);

  useEffect(() => {
    setPersonalNoteDraft(selectedEntry?.personalNotes || '');
  }, [selectedEntry?.id, selectedEntry?.personalNotes]);

  const filteredEntries = useMemo(() => {
    const q = normalizeTermKey(filterText);
    return dictionaryEntries.filter((entry) => {
      if (onlyFavorites && !entry.favorite) return false;
      if (q) {
        const hay = `${entry.normalizedTerm} ${entry.category.toLowerCase()} ${entry.definition.toLowerCase()}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dictionaryEntries, filterText, onlyFavorites]);

  const totalLookups = useMemo(
    () => dictionaryEntries.reduce((acc, e) => acc + (e.lookupCount || 1), 0),
    [dictionaryEntries]
  );

  const lookupTerm = async (rawTerm: string, forceRefresh = false) => {
    const clean = rawTerm.trim();
    if (!clean) return;
    setError('');
    setStatusNotice('');

    const normalized = normalizeTermKey(clean);
    const existing = dictionaryEntries.find((e) => e.normalizedTerm === normalized);

    if (existing && !forceRefresh) {
      setSelectedEntryId(existing.id);
      setStatusNotice(`"${existing.term}" recuperado al instante desde tu memoria personal (${existing.lookupCount + 1} consultas).`);
      void updateDictionaryEntry(existing.id, {
        lookupCount: (existing.lookupCount || 1) + 1,
      });
      return;
    }

    if (!isOnline) {
      setError('Sin conexión a internet para consultar un término nuevo. Podés repasar todas tus palabras memorizadas.');
      return;
    }

    setLoading(true);
    try {
      const activeSubjectName = subjects.find((s) => s.id === subjectId)?.name || '';
      const resp = await authFetch('/api/ai/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: clean,
          subjectName: activeSubjectName,
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider: 'auto',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo consultar el término.');
      }

      const savedId = await saveDictionaryEntry({
        subjectId: subjectId || existing?.subjectId || '',
        term: data.term || clean,
        category: data.category || 'Concepto académico',
        phonetic: data.phonetic || '',
        definition: data.definition || '',
        academicDefinition: data.academicDefinition || '',
        examples: Array.isArray(data.examples) ? data.examples : [],
        synonyms: Array.isArray(data.synonyms) ? data.synonyms : [],
        etymology: data.etymology || '',
        personalNotes: existing?.personalNotes || '',
        favorite: existing?.favorite || false,
      });

      setSelectedEntryId(savedId);
      setStatusNotice(
        forceRefresh
          ? `"${data.term || clean}" actualizado y guardado en tu memoria (${data.providerUsed || 'IA'}).`
          : `"${data.term || clean}" definido y memorizado en tu diccionario personal (${data.providerUsed || 'IA'}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error consultando el diccionario.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonalNote = async () => {
    if (!selectedEntry) return;
    setSavingNote(true);
    try {
      await updateDictionaryEntry(selectedEntry.id, {
        personalNotes: personalNoteDraft,
      });
      setStatusNotice('Nota personal guardada en la memoria del término.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveEntryAsNote = async (entry: DictionaryEntry) => {
    const subjName = subjects.find((s) => s.id === (entry.subjectId || subjectId))?.name || 'General';
    const html = [
      `<h1>Diccionario FABRO: ${escapeHtml(entry.term)}</h1>`,
      entry.category ? `<p><strong>Categoría:</strong> ${escapeHtml(entry.category)}</p>` : '',
      entry.phonetic ? `<p><strong>Pronunciación:</strong> ${escapeHtml(entry.phonetic)}</p>` : '',
      `<h2>Definición clara</h2><p>${escapeHtml(entry.definition)}</p>`,
      entry.academicDefinition
        ? `<h2>Desarrollo académico</h2><p>${escapeHtml(entry.academicDefinition)}</p>`
        : '',
      entry.etymology ? `<h2>Etimología / Origen</h2><p>${escapeHtml(entry.etymology)}</p>` : '',
      entry.examples.length > 0
        ? `<h2>Ejemplos</h2><ul>${entry.examples.map((ex) => `<li>${escapeHtml(ex)}</li>`).join('')}</ul>`
        : '',
      entry.personalNotes
        ? `<h2>Mis notas de memoria</h2><p>${escapeHtml(entry.personalNotes)}</p>`
        : '',
    ]
      .filter(Boolean)
      .join('');

    const plainText = [
      entry.term,
      entry.definition,
      entry.academicDefinition,
      entry.etymology,
      ...entry.examples,
      entry.personalNotes,
    ]
      .filter(Boolean)
      .join('\n\n');

    await createNote({
      subjectId: entry.subjectId || subjectId || subjects[0]?.id || '',
      folder: 'Diccionario',
      unit: 'Vocabulario',
      title: `Definición: ${entry.term}`,
      contentHtml: html,
      contentText: plainText,
      tags: ['diccionario', subjName.toLowerCase().slice(0, 24)].filter(Boolean),
      attachments: [],
      offlineAvailable: true,
    });
    setStatusNotice(`"${entry.term}" guardado en Apuntes (disponible sin conexión).`);
  };

  const handleCreateFlashcard = async (entry: DictionaryEntry) => {
    const targetSubject = entry.subjectId || subjectId || subjects[0]?.id || '';
    let vocabDeck = decks.find((d) => d.title.toLowerCase().includes('diccionario'));
    let deckId = vocabDeck?.id;
    if (!deckId) {
      deckId = await createDeck({
        subjectId: targetSubject,
        title: 'Diccionario FABRO — Vocabulario',
        description: 'Términos clave memorizados desde el diccionario personal.',
      });
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    await createCard(deckId, {
      question: `¿Qué significa "${entry.term}"? (${entry.category})`,
      answer: `${entry.definition}${entry.academicDefinition ? `\n\nDetalle: ${entry.academicDefinition}` : ''}`,
      cardType: 'flashcard',
      options: [],
      correctOptionIndex: 0,
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 0,
      nextReviewDate: todayStr,
      lastResult: 'pendiente',
    });
    setStatusNotice(`Flashcard creada para "${entry.term}" en Memorización.`);
  };

  const activeWhatsAppText = useMemo(() => {
    if (!selectedEntry) return '';
    const parts = [
      selectedEntry.definition,
      selectedEntry.academicDefinition ? `*Enfoque académico:*\n${selectedEntry.academicDefinition}` : '',
      selectedEntry.examples.length > 0
        ? `*Ejemplos:*\n${selectedEntry.examples.map((e) => `• ${e}`).join('\n')}`
        : '',
      selectedEntry.synonyms.length > 0 ? `*Términos afines:* ${selectedEntry.synonyms.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    return formatForWhatsApp({
      title: `Diccionario: ${selectedEntry.term}`,
      subtitle: selectedEntry.category,
      body: parts,
    });
  }, [selectedEntry]);

  const activeWhatsAppHref = useMemo(
    () => buildWhatsAppShareHref(activeWhatsAppText).href,
    [activeWhatsAppText]
  );

  const handleCopyWord = async () => {
    if (!activeWhatsAppText) return;
    try {
      await navigator.clipboard.writeText(activeWhatsAppText);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const quizEntry = dictionaryEntries.length > 0 ? dictionaryEntries[quizIndex % dictionaryEntries.length] : null;

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Diccionario con memoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cada término buscado queda guardado en tu memoria académica personal y funciona incluso sin conexión.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <span>
              <strong>{dictionaryEntries.length}</strong> términos memorizados
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>
              <strong>{totalLookups}</strong> repasos
            </span>
            {dictionaryEntries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuizOpen((v) => !v);
                  setQuizRevealed(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                  quizOpen
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                Repaso rápido
              </button>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookupTerm(queryTerm, false);
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={queryTerm}
              onChange={(e) => setQueryTerm(e.target.value)}
              placeholder="Escribí una palabra o concepto técnico (ej: Epistemología, Mitosis, Plusvalía)..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Materia de contexto"
            className="sm:w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-900 dark:text-white"
          >
            <option value="">Todas / General</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !queryTerm.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Consultando...' : 'Buscar y memorizar'}
          </button>
        </form>

        {!isOnline && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Modo sin conexión: podés consultar instantáneamente todos los términos guardados en tu memoria.</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {statusNotice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {statusNotice}
          </div>
        )}
      </section>

      {/* Memory Recall Quiz Panel */}
      {quizOpen && quizEntry && (
        <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
              Autoevaluación de memoria · Término {(quizIndex % dictionaryEntries.length) + 1} de {dictionaryEntries.length}
            </p>
            <button
              type="button"
              onClick={() => setQuizOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              Cerrar repaso
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{quizEntry.category}</p>
            <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {quizEntry.term}
            </h3>
            {quizRevealed ? (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-200">
                <p>{quizEntry.definition}</p>
                {quizEntry.personalNotes && (
                  <p className="text-xs text-sky-700 dark:text-sky-300">
                    Tu nota: {quizEntry.personalNotes}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Intentá recordar su significado antes de revelar la definición.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setQuizRevealed((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {quizRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {quizRevealed ? 'Ocultar definición' : 'Mostrar definición'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuizIndex((i) => i + 1);
                  setQuizRevealed(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                Siguiente término
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Split: Saved Memory Index + Entry Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 Columns: Saved Memory List */}
        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden flex flex-col max-h-[720px]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Memoria guardada
              </h3>
              <button
                type="button"
                onClick={() => setOnlyFavorites((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium cursor-pointer ${
                  onlyFavorites
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Star className="w-3 h-3" />
                Favoritos
              </button>
            </div>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar palabras guardadas..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {filteredEntries.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                {dictionaryEntries.length === 0
                  ? 'Todavía no guardaste términos. Buscá cualquier palabra arriba para construir tu diccionario.'
                  : 'Ningún término coincide con el filtro actual.'}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isSelected = selectedEntry?.id === entry.id;
                const subjName = subjects.find((s) => s.id === entry.subjectId)?.name;
                return (
                  <div
                    key={entry.id}
                    className={`px-4 py-3 flex items-start justify-between gap-2 transition-colors ${
                      isSelected ? 'bg-sky-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedEntryId(entry.id)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        {entry.favorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {entry.term}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {entry.category}
                        {subjName ? ` · ${subjName}` : ''} · {entry.lookupCount}×
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteDictionaryEntry(entry.id)}
                      aria-label={`Eliminar ${entry.term}`}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right 8 Columns: Active Entry Card */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6">
          {!selectedEntry ? (
            <div className="py-16 text-center space-y-3 max-w-md mx-auto">
              <BookMarked className="w-10 h-10 text-sky-600/60 dark:text-sky-400/60 mx-auto" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Tu memoria léxica y conceptual
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Buscá términos técnicos, conceptos jurídicos, médicos, históricos o científicos. FABRO define cada término con precisión académica, lo guarda en tu memoria permanente y te permite escucharlo o compartirlo.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-sky-700 dark:text-sky-300">
                      {selectedEntry.category}
                    </span>
                    {selectedEntry.phonetic && (
                      <span className="font-mono">{selectedEntry.phonetic}</span>
                    )}
                    <span className="tabular-nums">· Consultado {selectedEntry.lookupCount}×</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    {selectedEntry.term}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      void updateDictionaryEntry(selectedEntry.id, { favorite: !selectedEntry.favorite })
                    }
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                      selectedEntry.favorite
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${selectedEntry.favorite ? 'fill-current' : ''}`} />
                    {selectedEntry.favorite ? 'Favorito' : 'Destacar'}
                  </button>

                  {isOnline && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void lookupTerm(selectedEntry.term, true)}
                      title="Actualizar definición con IA"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </button>
                  )}
                </div>
              </div>

              {/* Action Toolbar: Audio + Save to Notes + Flashcard + WhatsApp */}
              <div className="flex flex-wrap items-center gap-2">
                <AudioReadAloudControl
                  title={`diccionario_${selectedEntry.term}`}
                  subtitle="Diccionario FABRO"
                  getText={() =>
                    [
                      selectedEntry.term,
                      selectedEntry.definition,
                      selectedEntry.academicDefinition,
                      selectedEntry.examples.length > 0 ? `Ejemplos: ${selectedEntry.examples.join('. ')}` : '',
                    ]
                      .filter(Boolean)
                      .join('. ')
                  }
                />

                <button
                  type="button"
                  onClick={() => void handleSaveEntryAsNote(selectedEntry)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Guardar en Apuntes
                </button>

                <button
                  type="button"
                  onClick={() => void handleCreateFlashcard(selectedEntry)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Crear flashcard
                </button>

                <a
                  href={activeWhatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp
                </a>

                <button
                  type="button"
                  onClick={() => void handleCopyWord()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              {/* Definitions */}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Definición clara
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                    {selectedEntry.definition}
                  </p>
                </div>

                {selectedEntry.academicDefinition && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Desarrollo académico riguroso
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {selectedEntry.academicDefinition}
                    </p>
                  </div>
                )}

                {selectedEntry.etymology && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Etimología / Origen
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {selectedEntry.etymology}
                    </p>
                  </div>
                )}

                {selectedEntry.examples.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Ejemplos en contexto
                    </h4>
                    <ul className="space-y-1.5">
                      {selectedEntry.examples.map((ex, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
                        >
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedEntry.synonyms.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Términos afines (hacé clic para buscar)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.synonyms.map((syn, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setQueryTerm(syn);
                            void lookupTerm(syn, false);
                          }}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300 hover:border-sky-500/50 cursor-pointer"
                        >
                          {syn}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personal Memory Notes */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mis notas de memoria (regla mnemotécnica o ejemplo de clase)
                  </label>
                  <textarea
                    rows={3}
                    value={personalNoteDraft}
                    onChange={(e) => setPersonalNoteDraft(e.target.value)}
                    placeholder="Escribí cómo lo explicó tu docente o un truco para recordarlo..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={() => void handleSavePersonalNote()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                    >
                      {savingNote ? 'Guardando...' : 'Guardar nota en memoria'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
