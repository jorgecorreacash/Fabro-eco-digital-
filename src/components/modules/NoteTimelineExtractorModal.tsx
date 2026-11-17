import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CalendarClock,
  Check,
  Columns3,
  FilePlus2,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';

export interface ExtractedTimelineEvent {
  id: string;
  dateLabel: string;
  sortYear: number;
  period: string;
  title: string;
  description: string;
  significance: string;
}

interface NoteTimelineExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  fullNoteText: string;
  noteTitle: string;
  subjectId: string;
  subjectName: string;
  canInsertIntoCurrentNote: boolean;
  onInsertHtml: (html: string) => void;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildExtractedTimelineHtml(params: {
  timelineTitle: string;
  timeSpan: string;
  summary: string;
  events: ExtractedTimelineEvent[];
}): string {
  const rows = params.events
    .map(
      (ev) => `
      <tr>
        <td style="padding:7px 9px;border:1px solid #cbd5e1;font-weight:700;color:#0369a1;white-space:nowrap;">${escapeHtml(ev.dateLabel)}</td>
        <td style="padding:7px 9px;border:1px solid #cbd5e1;color:#334155;">${escapeHtml(ev.period || 'Etapa')}</td>
        <td style="padding:7px 9px;border:1px solid #cbd5e1;">
          <strong>${escapeHtml(ev.title)}</strong><br/>
          <span style="color:#334155;">${escapeHtml(ev.description)}</span>
          ${ev.significance ? `<br/><em style="color:#0369a1;">Relevancia: ${escapeHtml(ev.significance)}</em>` : ''}
        </td>
      </tr>`
    )
    .join('');

  return `
    <div data-fabro-visual="cronologia-extraida" style="border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;margin:12px 0;background:#f8fafc;">
      <h2 style="margin:0 0 4px 0;font-size:17px;color:#0f172a;">Línea cronológica: ${escapeHtml(params.timelineTitle)}</h2>
      ${params.timeSpan ? `<p style="margin:0 0 6px 0;font-size:12px;color:#0369a1;"><strong>Período:</strong> ${escapeHtml(params.timeSpan)}</p>` : ''}
      ${params.summary ? `<p style="margin:0 0 10px 0;font-size:13px;color:#334155;">${escapeHtml(params.summary)}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;">
        <thead>
          <tr style="background:#e2e8f0;text-align:left;">
            <th style="padding:7px 9px;border:1px solid #cbd5e1;">Fecha</th>
            <th style="padding:7px 9px;border:1px solid #cbd5e1;">Etapa</th>
            <th style="padding:7px 9px;border:1px solid #cbd5e1;">Acontecimiento e interpretación</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `.trim();
}

export const NoteTimelineExtractorModal: React.FC<NoteTimelineExtractorModalProps> = ({
  isOpen,
  onClose,
  selectedText,
  fullNoteText,
  noteTitle,
  subjectId,
  subjectName,
  canInsertIntoCurrentNote,
  onInsertHtml,
}) => {
  const { profile, createNote } = useFabro();

  const hasSelection = selectedText.trim().length >= 15;
  const [sourceScope, setSourceScope] = useState<'selected' | 'full'>(hasSelection ? 'selected' : 'full');
  const [sourceTextDraft, setSourceTextDraft] = useState('');
  const [viewMode, setViewMode] = useState<'horizontal' | 'vertical'>('horizontal');

  const [timelineTitle, setTimelineTitle] = useState('');
  const [timeSpan, setTimeSpan] = useState('');
  const [summary, setSummary] = useState('');
  const [events, setEvents] = useState<ExtractedTimelineEvent[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [editingEvents, setEditingEvents] = useState(false);

  const [providerUsed, setProviderUsed] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const runExtract = useCallback(
    async (textToAnalyze: string) => {
      const clean = textToAnalyze.trim();
      if (clean.length < 15) {
        setError('Seleccioná o escribí un texto de al menos 15 caracteres para extraer fechas clave.');
        return;
      }
      setLoading(true);
      setError('');
      setNotice('');
      try {
        const resp = await authFetch('/api/ai/timeline-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedText: clean,
            noteTitle: noteTitle || 'Apunte de estudio',
            subjectName,
            educationLevel: profile?.educationLevel || 'universitario',
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || 'No se pudieron extraer las fechas clave del texto.');
        }

        const list: ExtractedTimelineEvent[] = Array.isArray(data.events) ? data.events : [];
        setTimelineTitle(String(data.timelineTitle || `Cronología: ${noteTitle || 'Apunte'}`));
        setTimeSpan(String(data.timeSpan || ''));
        setSummary(String(data.summary || ''));
        setEvents(list);
        setActiveEventId(list[0]?.id || null);
        setProviderUsed(String(data.providerUsed || ''));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al generar la línea de tiempo.');
      } finally {
        setLoading(false);
      }
    },
    [noteTitle, subjectName, profile?.educationLevel]
  );

  useEffect(() => {
    if (!isOpen) return;
    const initialScope = selectedText.trim().length >= 15 ? 'selected' : 'full';
    const seed = initialScope === 'selected' ? selectedText.trim() : fullNoteText.trim();
    setSourceScope(initialScope);
    setSourceTextDraft(seed);
    setError('');
    setNotice('');
    setEditingEvents(false);
    if (seed.length >= 15) {
      void runExtract(seed);
    } else {
      setTimelineTitle(`Línea cronológica: ${noteTitle || 'Apunte'}`);
      setTimeSpan('');
      setSummary('');
      setEvents([]);
    }
  }, [isOpen, selectedText, fullNoteText, noteTitle, runExtract]);

  const handleSwitchScope = (next: 'selected' | 'full') => {
    setSourceScope(next);
    const seed = next === 'selected' ? selectedText.trim() : fullNoteText.trim();
    setSourceTextDraft(seed);
    if (seed.length >= 15) {
      void runExtract(seed);
    }
  };

  const handleSortChronological = () => {
    setEvents((prev) => [...prev].sort((a, b) => a.sortYear - b.sortYear));
  };

  const handleAddManualEvent = () => {
    const newId = `ev_${Date.now().toString(36)}`;
    const nextYear = events.length > 0 ? events[events.length - 1].sortYear + 1 : 2000;
    const item: ExtractedTimelineEvent = {
      id: newId,
      dateLabel: String(nextYear),
      sortYear: nextYear,
      period: 'Etapa',
      title: 'Nuevo hito histórico',
      description: 'Descripción del acontecimiento.',
      significance: '',
    };
    setEvents((prev) => [...prev, item]);
    setActiveEventId(newId);
    setEditingEvents(true);
  };

  const handleUpdateEvent = (id: string, patch: Partial<ExtractedTimelineEvent>) => {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)));
  };

  const handleRemoveEvent = (id: string) => {
    setEvents((prev) => {
      const next = prev.filter((ev) => ev.id !== id);
      if (activeEventId === id) {
        setActiveEventId(next[0]?.id || null);
      }
      return next;
    });
  };

  const plainTimelineText = useMemo(() => {
    const lines = [
      timelineTitle || 'Línea cronológica',
      timeSpan ? `Período: ${timeSpan}` : '',
      summary || '',
      '',
      ...events.map(
        (ev) =>
          `• ${ev.dateLabel}${ev.period ? ` (${ev.period})` : ''} — ${ev.title}: ${ev.description}${
            ev.significance ? ` [Relevancia: ${ev.significance}]` : ''
          }`
      ),
    ];
    return lines.filter(Boolean).join('\n');
  }, [timelineTitle, timeSpan, summary, events]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeEventId) || events[0] || null,
    [events, activeEventId]
  );

  const handleInsertIntoNote = () => {
    if (events.length === 0) return;
    const html = buildExtractedTimelineHtml({
      timelineTitle: timelineTitle || 'Línea cronológica',
      timeSpan,
      summary,
      events,
    });
    onInsertHtml(html);
  };

  const handleSaveAsNewNote = async () => {
    if (events.length === 0 || savingNote) return;
    setSavingNote(true);
    setError('');
    try {
      const html = buildExtractedTimelineHtml({
        timelineTitle: timelineTitle || 'Línea cronológica',
        timeSpan,
        summary,
        events,
      });
      await createNote({
        subjectId,
        unit: '',
        folder: 'Líneas cronológicas',
        title: (timelineTitle || `Cronología: ${noteTitle || 'Apunte'}`).slice(0, 200),
        contentHtml: html,
        contentText: plainTimelineText,
        tags: ['cronologia', 'fechas-clave', 'linea-de-tiempo'],
        attachments: [],
        offlineAvailable: true,
      });
      setNotice('Línea cronológica guardada como un nuevo apunte en la carpeta "Líneas cronológicas".');
    } catch {
      setError('No se pudo guardar la línea cronológica como apunte nuevo.');
    } finally {
      setSavingNote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div
        role="dialog"
        aria-label="Extractor de fechas clave y línea de tiempo"
        className="w-full max-w-5xl max-h-[92dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-600/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold truncate">
                Extractor de Fechas Clave y Línea Cronológica
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {subjectName ? `${subjectName} · ` : ''}
                {hasSelection
                  ? 'Analizando el texto seleccionado en el editor'
                  : 'Analizando el contenido del apunte'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar extractor cronológico"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Source text selector & re-extract bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80">
                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={() => handleSwitchScope('selected')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                    sourceScope === 'selected'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Texto seleccionado
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchScope('full')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    sourceScope === 'full'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Apunte completo
                </button>
              </div>

              <div className="flex items-center gap-2">
                {providerUsed && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Motor: {providerUsed}
                  </span>
                )}
                <button
                  type="button"
                  disabled={loading || sourceTextDraft.trim().length < 15}
                  onClick={() => void runExtract(sourceTextDraft)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {loading ? 'Extrayendo...' : 'Extraer fechas'}
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={sourceTextDraft}
              onChange={(e) => setSourceTextDraft(e.target.value)}
              placeholder="Pegá o editá aquí el texto histórico o cronológico del cual extraer fechas clave..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
              <p className="text-sm font-medium">Identificando fechas clave, períodos y secuencia histórica...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <History className="w-8 h-8 mx-auto opacity-60" />
              <p>Todavía no hay hitos en la línea de tiempo. Podés extraer fechas de un texto o agregar un hito manual.</p>
              <button
                type="button"
                onClick={handleAddManualEvent}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar hito manual
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Timeline Title & Interpretive Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Título de la línea temporal
                  </label>
                  <input
                    type="text"
                    value={timelineTitle}
                    onChange={(e) => setTimelineTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Rango temporal
                  </label>
                  <input
                    type="text"
                    value={timeSpan}
                    onChange={(e) => setTimeSpan(e.target.value)}
                    placeholder="Ej. 1810 – 1880"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono text-sky-600 dark:text-sky-400"
                  />
                </div>
              </div>

              {summary && (
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong className="text-sky-700 dark:text-sky-300 block text-xs mb-1">
                    Síntesis interpretativa del proceso
                  </strong>
                  {summary}
                </div>
              )}

              {/* Visual Mode & Edit Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setViewMode('horizontal')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                      viewMode === 'horizontal'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    Vista horizontal
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('vertical')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                      viewMode === 'vertical'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Vista vertical
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSortChronological}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Ordenar años
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualEvent}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar hito
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingEvents((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      editingEvents
                        ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {editingEvents ? 'Listo de editar' : 'Editar hitos'}
                  </button>
                </div>
              </div>

              {/* Visual Timeline Track */}
              {viewMode === 'horizontal' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 overflow-x-auto">
                    <div className="relative min-w-max flex items-start gap-4 pt-2 pb-1">
                      <div className="absolute left-4 right-4 top-7 h-0.5 bg-gradient-to-r from-sky-500/40 via-cyan-500/70 to-blue-600/40 pointer-events-none" />
                      {events.map((ev, idx) => {
                        const isSelected = activeEvent?.id === ev.id;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => setActiveEventId(ev.id)}
                            className={`relative z-10 w-52 shrink-0 text-left rounded-xl border p-3 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-sky-500 bg-white dark:bg-[#0F182A] shadow-md -translate-y-0.5'
                                : 'border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0E1525] hover:border-sky-400/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="font-mono text-xs font-bold tabular-nums text-sky-700 dark:text-cyan-300">
                                {ev.dateLabel}
                              </span>
                              <span className="text-[10px] text-slate-400 tabular-nums">#{idx + 1}</span>
                            </div>
                            <div className="w-3 h-3 rounded-full bg-sky-500 ring-4 ring-sky-500/20 mb-2" />
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                              {ev.period}
                            </p>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                              {ev.title}
                            </h4>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeEvent && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1627] p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-sky-700 dark:text-cyan-300">
                            {activeEvent.dateLabel}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {activeEvent.period}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEvent(activeEvent.id)}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Quitar hito
                        </button>
                      </div>
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {activeEvent.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {activeEvent.description}
                      </p>
                      {activeEvent.significance && (
                        <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
                          <strong>Relevancia histórica/conceptual:</strong> {activeEvent.significance}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-sky-500/40">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-1"
                    >
                      <span className="absolute -left-[22px] top-4 w-3 h-3 rounded-full bg-sky-500 ring-4 ring-white dark:ring-[#0B1220]" />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold tabular-nums text-sky-700 dark:text-cyan-300">
                            {ev.dateLabel}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 dark:text-slate-400">{ev.period}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEvent(ev.id)}
                          aria-label="Eliminar hito"
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        {ev.title}
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {ev.description}
                      </p>
                      {ev.significance && (
                        <p className="text-xs text-sky-700 dark:text-sky-300">
                          <strong>Relevancia:</strong> {ev.significance}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Editable Table for Fine-Tuning Dates & Descriptions */}
              {editingEvents && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Edición directa de hitos cronológicos ({events.length})
                  </p>
                  <div className="space-y-2.5">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 grid grid-cols-1 sm:grid-cols-12 gap-2"
                      >
                        <input
                          type="text"
                          value={ev.dateLabel}
                          onChange={(e) => handleUpdateEvent(ev.id, { dateLabel: e.target.value })}
                          placeholder="Fecha"
                          className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
                        />
                        <input
                          type="number"
                          value={ev.sortYear}
                          onChange={(e) =>
                            handleUpdateEvent(ev.id, { sortYear: Number(e.target.value) || 0 })
                          }
                          placeholder="Año orden"
                          title="Año numérico para ordenar"
                          className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={ev.period}
                          onChange={(e) => handleUpdateEvent(ev.id, { period: e.target.value })}
                          placeholder="Etapa / Período"
                          className="sm:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={ev.title}
                          onChange={(e) => handleUpdateEvent(ev.id, { title: e.target.value })}
                          placeholder="Título del hito"
                          className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold"
                        />
                        <input
                          type="text"
                          value={ev.description}
                          onChange={(e) => handleUpdateEvent(ev.id, { description: e.target.value })}
                          placeholder="Descripción del acontecimiento"
                          className="sm:col-span-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={ev.significance}
                          onChange={(e) => handleUpdateEvent(ev.id, { significance: e.target.value })}
                          placeholder="Relevancia o consecuencia"
                          className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {events.length > 0 && (
              <>
                <AudioReadAloudControl
                  compact
                  getText={() => plainTimelineText}
                  title={timelineTitle || 'cronologia-fabro'}
                />
                <a
                  href={
                    buildWhatsAppShareHref(
                      formatForWhatsApp({
                        title: timelineTitle || 'Línea cronológica FABRO',
                        subtitle: [subjectName, timeSpan].filter(Boolean).join(' · '),
                        body: plainTimelineText,
                      })
                    ).href
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={events.length === 0 || savingNote}
              onClick={() => void handleSaveAsNewNote()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
              Guardar como apunte nuevo
            </button>

            {canInsertIntoCurrentNote && (
              <button
                type="button"
                disabled={events.length === 0}
                onClick={handleInsertIntoNote}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Insertar en este apunte
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
