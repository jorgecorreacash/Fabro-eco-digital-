import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Copy,
  FilePlus2,
  GitBranch,
  History,
  Loader2,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';

export type VisualStudyKind = 'esquema' | 'linea_cronologica';

interface SchemaBranch {
  label: string;
  summary: string;
  subitems: string[];
  example: string;
}

interface SchemaDiagramData {
  title: string;
  subtitle: string;
  rootConcept: string;
  branches: SchemaBranch[];
  connections: string[];
}

interface TimelineEventItem {
  date: string;
  title: string;
  description: string;
  protagonists: string;
  significance: string;
}

interface TimelinePeriodBand {
  periodName: string;
  dateRange: string;
  focus: string;
  events: TimelineEventItem[];
}

interface TimelineDiagramData {
  title: string;
  subtitle: string;
  timeSpan: string;
  periods: TimelinePeriodBand[];
}

interface VisualStudyStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialKind?: VisualStudyKind;
  defaultTopic?: string;
  defaultContext?: string;
  subjectId?: string;
  subjectName?: string;
  canInsertIntoCurrentNote?: boolean;
  onInsertHtml?: (html: string, plainTitle: string) => void;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSchemaHtml(data: SchemaDiagramData): string {
  const branchesHtml = (data.branches || [])
    .map(
      (b) => `
      <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#f8fafc;">
        <h3 style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">${escapeHtml(b.label)}</h3>
        <p style="margin:0 0 8px 0;font-size:13px;color:#334155;">${escapeHtml(b.summary)}</p>
        ${
          Array.isArray(b.subitems) && b.subitems.length > 0
            ? `<ul style="margin:0 0 8px 18px;padding:0;font-size:13px;color:#1e293b;">${b.subitems
                .map((s) => `<li style="margin-bottom:3px;">${escapeHtml(s)}</li>`)
                .join('')}</ul>`
            : ''
        }
        ${
          b.example
            ? `<p style="margin:0;font-size:12px;color:#0369a1;"><strong>Ejemplo:</strong> ${escapeHtml(b.example)}</p>`
            : ''
        }
      </div>`
    )
    .join('');

  const connectionsHtml =
    Array.isArray(data.connections) && data.connections.length > 0
      ? `<h3>Relaciones entre conceptos</h3><ul>${data.connections
          .map((c) => `<li>${escapeHtml(c)}</li>`)
          .join('')}</ul>`
      : '';

  return `
    <div data-fabro-visual="esquema">
      <h2>Esquema conceptual: ${escapeHtml(data.title)}</h2>
      ${data.subtitle ? `<p><em>${escapeHtml(data.subtitle)}</em></p>` : ''}
      <p><strong>Núcleo central:</strong> ${escapeHtml(data.rootConcept)}</p>
      ${branchesHtml}
      ${connectionsHtml}
    </div>
  `.trim();
}

function buildTimelineHtml(data: TimelineDiagramData): string {
  const periodsHtml = (data.periods || [])
    .map(
      (p) => `
      <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;margin-bottom:12px;background:#f8fafc;">
        <h3 style="margin:0 0 4px 0;font-size:15px;color:#0f172a;">${escapeHtml(p.periodName)} (${escapeHtml(p.dateRange)})</h3>
        <p style="margin:0 0 10px 0;font-size:13px;color:#334155;"><em>${escapeHtml(p.focus)}</em></p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#e2e8f0;text-align:left;">
              <th style="padding:6px 8px;border:1px solid #cbd5e1;">Fecha / Año</th>
              <th style="padding:6px 8px;border:1px solid #cbd5e1;">Hito</th>
              <th style="padding:6px 8px;border:1px solid #cbd5e1;">Protagonistas e importancia</th>
            </tr>
          </thead>
          <tbody>
            ${(p.events || [])
              .map(
                (ev) => `
              <tr>
                <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:bold;white-space:nowrap;">${escapeHtml(ev.date)}</td>
                <td style="padding:6px 8px;border:1px solid #cbd5e1;"><strong>${escapeHtml(ev.title)}</strong><br/>${escapeHtml(ev.description)}</td>
                <td style="padding:6px 8px;border:1px solid #cbd5e1;"><strong>Actores:</strong> ${escapeHtml(ev.protagonists)}<br/><strong>Impacto:</strong> ${escapeHtml(ev.significance)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    )
    .join('');

  return `
    <div data-fabro-visual="linea_cronologica">
      <h2>Línea periódica histórica cronológica: ${escapeHtml(data.title)}</h2>
      <p><strong>Período abarcado:</strong> ${escapeHtml(data.timeSpan)}${data.subtitle ? ` · ${escapeHtml(data.subtitle)}` : ''}</p>
      ${periodsHtml}
    </div>
  `.trim();
}

export const VisualStudyStudioModal: React.FC<VisualStudyStudioModalProps> = ({
  isOpen,
  onClose,
  initialKind = 'esquema',
  defaultTopic = '',
  defaultContext = '',
  subjectId = '',
  subjectName = '',
  canInsertIntoCurrentNote = false,
  onInsertHtml,
}) => {
  const { profile, subjects, createNote } = useFabro();

  const [kind, setKind] = useState<VisualStudyKind>(initialKind);
  const [topic, setTopic] = useState(defaultTopic);
  const [contextText, setContextText] = useState(defaultContext);
  const [activeSubjectId, setActiveSubjectId] = useState(subjectId);
  const [aiProvider, setAiProvider] = useState<'auto' | 'gemini' | 'chatgpt'>('auto');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [providerUsed, setProviderUsed] = useState('');
  const [schemaData, setSchemaData] = useState<SchemaDiagramData | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineDiagramData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setKind(initialKind);
    setTopic(defaultTopic);
    setContextText(defaultContext);
    setActiveSubjectId(subjectId);
    setError('');
    setNotice('');
  }, [isOpen, initialKind, defaultTopic, defaultContext, subjectId]);

  const resolvedSubjectName = useMemo(
    () => subjects.find((s) => s.id === activeSubjectId)?.name || subjectName || '',
    [subjects, activeSubjectId, subjectName]
  );

  const generatedPlainText = useMemo(() => {
    if (kind === 'esquema' && schemaData) {
      const branchesTxt = (schemaData.branches || [])
        .map(
          (b) =>
            `*${b.label}*\n${b.summary}\n${(b.subitems || []).map((s) => `  • ${s}`).join('\n')}${
              b.example ? `\n  Ejemplo: ${b.example}` : ''
            }`
        )
        .join('\n\n');
      const connTxt =
        (schemaData.connections || []).length > 0
          ? `\n\n*Relaciones clave:*\n${schemaData.connections.map((c) => `• ${c}`).join('\n')}`
          : '';
      return `${schemaData.subtitle ? `${schemaData.subtitle}\n` : ''}Núcleo: ${schemaData.rootConcept}\n\n${branchesTxt}${connTxt}`;
    }

    if (kind === 'linea_cronologica' && timelineData) {
      const periodsTxt = (timelineData.periods || [])
        .map(
          (p) =>
            `*${p.periodName} (${p.dateRange})*\n${p.focus}\n` +
            (p.events || [])
              .map((ev) => `• *${ev.date} — ${ev.title}*: ${ev.description} (${ev.significance})`)
              .join('\n')
        )
        .join('\n\n');
      return `Alcance temporal: ${timelineData.timeSpan}\n${timelineData.subtitle}\n\n${periodsTxt}`;
    }
    return '';
  }, [kind, schemaData, timelineData]);

  const generatedTitle =
    kind === 'esquema'
      ? schemaData?.title || `Esquema: ${topic || resolvedSubjectName}`
      : timelineData?.title || `Línea cronológica: ${topic || resolvedSubjectName}`;

  const whatsappText = useMemo(() => {
    if (!generatedPlainText) return '';
    return formatForWhatsApp({
      title: generatedTitle,
      subtitle: resolvedSubjectName || (kind === 'esquema' ? 'Esquema conceptual' : 'Línea periódica histórica'),
      body: generatedPlainText,
    });
  }, [generatedTitle, generatedPlainText, resolvedSubjectName, kind]);

  const whatsappHref = useMemo(() => buildWhatsAppShareHref(whatsappText).href, [whatsappText]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && !contextText.trim()) {
      setError('Escribí un tema o pegá texto para construir el recurso visual.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await authFetch('/api/ai/visual-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          topic: topic.trim(),
          contextText: contextText.trim(),
          subjectName: resolvedSubjectName,
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo generar el esquema o línea cronológica.');
      }
      setProviderUsed(data.providerUsed || '');
      if (data.kind === 'linea_cronologica' && data.timelineData) {
        setTimelineData(data.timelineData);
      } else if (data.schemaData) {
        setSchemaData(data.schemaData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando el recurso visual.');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentHtml = (): string => {
    if (kind === 'esquema' && schemaData) return buildSchemaHtml(schemaData);
    if (kind === 'linea_cronologica' && timelineData) return buildTimelineHtml(timelineData);
    return '';
  };

  const handleInsertIntoNote = () => {
    const html = getCurrentHtml();
    if (!html || !onInsertHtml) return;
    onInsertHtml(html, generatedTitle);
    setNotice('Insertado en el apunte abierto.');
  };

  const handleSaveAsNewNote = async () => {
    const html = getCurrentHtml();
    if (!html) return;
    await createNote({
      subjectId: activeSubjectId || subjects[0]?.id || '',
      folder: kind === 'esquema' ? 'Esquemas' : 'Líneas cronológicas',
      unit: 'Síntesis visual',
      title: generatedTitle,
      contentHtml: html,
      contentText: generatedPlainText,
      tags: [kind === 'esquema' ? 'esquema' : 'cronologia'],
      attachments: [],
      offlineAvailable: true,
    });
    setNotice('Guardado como apunte independiente (disponible sin conexión).');
  };

  const handleCopyWhatsApp = async () => {
    if (!whatsappText) return;
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const hasResult = (kind === 'esquema' && Boolean(schemaData)) || (kind === 'linea_cronologica' && Boolean(timelineData));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5">
      <div className="w-full max-w-4xl max-h-[92dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {kind === 'esquema' ? (
                <GitBranch className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              ) : (
                <History className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              )}
              Estudio visual: Esquemas y Línea cronológica
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generá cuadros sinópticos jerárquicos o líneas periódicas históricas cronológicas listas para imprimir o guardar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Cerrar estudio visual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Controls Form */}
          <form onSubmit={(e) => void handleGenerate(e)} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('esquema')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                  kind === 'esquema'
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                Esquema / Cuadro sinóptico
              </button>
              <button
                type="button"
                onClick={() => setKind('linea_cronologica')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                  kind === 'linea_cronologica'
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                Línea periódica histórica cronológica
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  kind === 'esquema'
                    ? 'Tema del esquema (ej: Clasificación de los contratos civiles)'
                    : 'Período o proceso histórico (ej: Historia Constitucional Argentina 1810–1994)'
                }
                className="sm:col-span-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <select
                value={activeSubjectId}
                onChange={(e) => setActiveSubjectId(e.target.value)}
                className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="">Materia general</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as 'auto' | 'gemini' | 'chatgpt')}
                className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="auto">Motor: Auto (Gemini + ChatGPT)</option>
                <option value="gemini">Google Gemini</option>
                <option value="chatgpt">ChatGPT (OpenAI)</option>
              </select>
            </div>

            <textarea
              rows={2}
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Opcional: pegá apuntes o el temario de la unidad para basar el esquema o la cronología en tu material..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {providerUsed ? `Generado con: ${providerUsed}` : 'Incluye fechas, etapas, ramas y relaciones conceptuales.'}
              </span>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading
                  ? 'Construyendo...'
                  : kind === 'esquema'
                  ? 'Generar esquema'
                  : 'Generar línea cronológica'}
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              {notice}
            </div>
          )}

          {/* Export / Reuse Action Bar */}
          {hasResult && (
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              {canInsertIntoCurrentNote && onInsertHtml && (
                <button
                  type="button"
                  onClick={handleInsertIntoNote}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  Insertar en el apunte actual
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleSaveAsNewNote()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Guardar como apunte nuevo
              </button>

              <AudioReadAloudControl
                title={`visual_${generatedTitle}`}
                subtitle="FABRO Estudio Visual"
                getText={() => `${generatedTitle}. ${generatedPlainText}`}
              />

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp
              </a>

              <button
                type="button"
                onClick={() => void handleCopyWhatsApp()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
          )}

          {/* Render Schema Diagram */}
          {kind === 'esquema' && schemaData && (
            <div className="space-y-5">
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-center space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  Núcleo conceptual
                </p>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {schemaData.title}
                </h3>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {schemaData.rootConcept}
                </p>
                {schemaData.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{schemaData.subtitle}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(schemaData.branches || []).map((branch, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-4 space-y-2.5"
                  >
                    <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {branch.label}
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {branch.summary}
                    </p>
                    {branch.subitems && branch.subitems.length > 0 && (
                      <ul className="space-y-1 pl-4 list-disc text-xs text-slate-700 dark:text-slate-200">
                        {branch.subitems.map((item, sIdx) => (
                          <li key={sIdx}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {branch.example && (
                      <p className="text-[11px] rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-sky-700 dark:text-sky-300">
                        <strong>Ejemplo:</strong> {branch.example}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {schemaData.connections && schemaData.connections.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Relaciones transversales clave
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
                    {schemaData.connections.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Render Chronological Periodic Historical Timeline */}
          {kind === 'linea_cronologica' && timelineData && (
            <div className="space-y-6">
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {timelineData.title}
                  </h3>
                  <span className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                    {timelineData.timeSpan}
                  </span>
                </div>
                {timelineData.subtitle && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">{timelineData.subtitle}</p>
                )}
              </div>

              <div className="space-y-5">
                {(timelineData.periods || []).map((period, pIdx) => (
                  <div
                    key={pIdx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          {period.periodName}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{period.focus}</p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-300 tabular-nums shrink-0">
                        {period.dateRange}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(period.events || []).map((ev, eIdx) => (
                        <div key={eIdx} className="p-4 flex flex-col sm:flex-row gap-3">
                          <div className="sm:w-32 shrink-0">
                            <span className="inline-block font-mono text-xs font-bold text-sky-700 dark:text-sky-300 tabular-nums">
                              {ev.date}
                            </span>
                          </div>
                          <div className="flex-1 space-y-1">
                            <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {ev.title}
                            </h5>
                            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                              {ev.description}
                            </p>
                            <div className="pt-1 flex flex-col sm:flex-row sm:gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                              {ev.protagonists && (
                                <span>
                                  <strong>Actores:</strong> {ev.protagonists}
                                </span>
                              )}
                              {ev.significance && (
                                <span>
                                  <strong>Impacto:</strong> {ev.significance}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
