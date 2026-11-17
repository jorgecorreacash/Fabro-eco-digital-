import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  FilePlus2,
  GitCompare,
  LayoutDashboard,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useAIGateway, type GatewayComparePayload } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import { exportMarkdownToPdf } from '../../lib/exporters';
import type { ModuleHomeConfig, PersonalCompareResponse, PortalCategory, PortalEntry } from '../../types/fabro';
import { FabroBrowserWorkspace } from '../browser/FabroBrowserWorkspace';
import { PortalAdminManager } from '../common/PortalAdminManager';

interface PortalsSnapshotResponse {
  categories: PortalCategory[];
  portals: PortalEntry[];
  homeConfig?: ModuleHomeConfig;
  userPrefs?: {
    customPortals: PortalEntry[];
  };
}

export const FabroAIBrowserView: React.FC = () => {
  const { user, setActiveSection, createNote, subjects, selectedSubjectId } = useFabro();
  const { isAdmin } = usePlatform();
  const { models, personalConnections, runGatewayCompare, comparePersonalConnections } =
    useAIGateway();

  const [activeTab, setActiveTab] = useState<'browser' | 'compare' | 'admin'>('browser');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [categories, setCategories] = useState<PortalCategory[]>([]);
  const [systemPortals, setSystemPortals] = useState<PortalEntry[]>([]);
  const [customPortals, setCustomPortals] = useState<PortalEntry[]>([]);
  const [homeConfig, setHomeConfig] = useState<ModuleHomeConfig | undefined>(undefined);

  // Compare Tab (Strictly authorized APIs — zero automated portal scraping)
  const [compareSource, setCompareSource] = useState<'gateway' | 'connect'>('gateway');
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareMode, setCompareMode] = useState<'interpretativo' | 'sencillo'>('interpretativo');
  const [selectedGatewayModelIds, setSelectedGatewayModelIds] = useState<string[]>([]);
  const [selectedConnectIds, setSelectedConnectIds] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [gatewayCompareResult, setGatewayCompareResult] = useState<GatewayComparePayload | null>(null);
  const [personalCompareResult, setPersonalCompareResult] = useState<PersonalCompareResponse | null>(null);
  const [compareSavedNotice, setCompareSavedNotice] = useState('');

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null,
    [subjects, selectedSubjectId]
  );

  const loadSnapshot = useCallback(async () => {
    setErrorMsg('');
    try {
      const endpoint = user
        ? `/api/portals/me/ai-browser${isAdmin ? '?includeInactive=true' : ''}`
        : '/api/portals/ai-browser';
      const resp = user ? await authFetch(endpoint) : await fetch(endpoint);
      if (!resp.ok) throw new Error('No se pudieron cargar los portales de IA.');
      const data = (await resp.json()) as PortalsSnapshotResponse;
      setCategories(data.categories || []);
      setSystemPortals(data.portals || []);
      setCustomPortals(data.userPrefs?.customPortals || []);
      setHomeConfig(data.homeConfig);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cargando portales IA.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const enabledGatewayModels = useMemo(() => models.filter((m) => m.enabled), [models]);
  const connectedPersonal = useMemo(
    () => personalConnections.filter((c) => c.status === 'connected'),
    [personalConnections]
  );

  useEffect(() => {
    if (selectedGatewayModelIds.length === 0 && enabledGatewayModels.length > 0) {
      setSelectedGatewayModelIds(enabledGatewayModels.slice(0, 2).map((m) => m.id));
    }
  }, [enabledGatewayModels, selectedGatewayModelIds.length]);

  useEffect(() => {
    if (selectedConnectIds.length === 0 && connectedPersonal.length > 0) {
      setSelectedConnectIds(connectedPersonal.slice(0, 3).map((c) => c.id));
    }
  }, [connectedPersonal, selectedConnectIds.length]);

  const allPortals = useMemo(() => {
    const activeSystem = systemPortals.filter((p) => p.active);
    return [...customPortals, ...activeSystem].sort((a, b) => a.order - b.order);
  }, [customPortals, systemPortals]);

  const handlePatchPortalProbe = useCallback((portalId: string, patch: Partial<PortalEntry>) => {
    setSystemPortals((prev) =>
      prev.map((item) => (item.id === portalId ? { ...item, ...patch } : item))
    );
    setCustomPortals((prev) =>
      prev.map((item) => (item.id === portalId ? { ...item, ...patch } : item))
    );
  }, []);

  const handleRunCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comparePrompt.trim()) return;
    setCompareLoading(true);
    setCompareError('');
    setCompareSavedNotice('');
    setGatewayCompareResult(null);
    setPersonalCompareResult(null);

    try {
      if (compareSource === 'gateway') {
        if (selectedGatewayModelIds.length < 1) {
          throw new Error('Seleccioná al menos un modelo autorizado del Gateway FABRO.');
        }
        const payload = await runGatewayCompare({
          prompt: comparePrompt.trim(),
          modelIds: selectedGatewayModelIds,
          mode: compareMode,
          subjectName: activeSubject?.name,
        });
        setGatewayCompareResult(payload);
      } else {
        if (selectedConnectIds.length < 1) {
          throw new Error('Seleccioná al menos una conexión API personal en FABRO CONNECT.');
        }
        const payload = await comparePersonalConnections({
          connectionIds: selectedConnectIds,
          prompt: comparePrompt.trim(),
          systemInstruction:
            compareMode === 'interpretativo'
              ? 'Respondé con profundidad académica universitaria, rigor conceptual, ejemplos y estructura clara en español.'
              : 'Respondé en español claro, directo y didáctico para facilitar la comprensión inicial.',
        });
        setPersonalCompareResult(payload);
      }
    } catch (err) {
      setCompareError(
        err instanceof Error ? err.message : 'No se pudo ejecutar la comparación por API.'
      );
    } finally {
      setCompareLoading(false);
    }
  };

  const handleSaveCompareToNotes = async () => {
    let md = '';
    if (gatewayCompareResult) {
      md = [
        `# Comparación Multi-IA · ${comparePrompt}`,
        '',
        ...gatewayCompareResult.results.map(
          (r) => `## ${r.label} (${r.providerName})\n${r.text || r.error}`
        ),
        '',
        '## Coincidencias',
        ...(gatewayCompareResult.agreements || []).map((a) => `- ${a}`),
        '',
        '## Diferencias',
        ...(gatewayCompareResult.differences || []).map((d) => `- ${d}`),
        '',
        '## Análisis final FABRO IA',
        gatewayCompareResult.synthesisMarkdown,
      ].join('\n');
    } else if (personalCompareResult) {
      md = [
        `# Comparación Multi-IA Personal · ${comparePrompt}`,
        '',
        ...personalCompareResult.results.map(
          (r) => `## ${r.label} (${r.modelUsed})\n${r.text || r.error}`
        ),
      ].join('\n');
    }
    if (!md) return;

    await createNote({
      subjectId: activeSubject?.id || '',
      title: `Comparación Multi-IA: ${comparePrompt.slice(0, 48)}`,
      unit: 'Comparador API',
      folder: 'Análisis Multi-IA',
      tags: ['comparar-ia', 'api'],
      attachments: [],
      offlineAvailable: true,
      contentHtml: md
        .split('\n')
        .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join(''),
      contentText: md,
    });
    setCompareSavedNotice('Comparativa guardada en Apuntes.');
  };

  const handleExportComparePdf = () => {
    if (gatewayCompareResult) {
      const md = [
        `## Pregunta consultada\n${gatewayCompareResult.prompt}`,
        ...gatewayCompareResult.results.map(
          (r) => `## ${r.label} (${r.providerName})\n${r.text || r.error}`
        ),
        gatewayCompareResult.synthesisMarkdown
          ? `## Síntesis final FABRO IA\n${gatewayCompareResult.synthesisMarkdown}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      exportMarkdownToPdf({
        title: `Comparativa Multi-IA · FABRO`,
        subjectName: activeSubject?.name,
        markdown: md,
      });
    } else if (personalCompareResult) {
      const md = [
        `## Pregunta consultada\n${personalCompareResult.prompt}`,
        ...personalCompareResult.results.map(
          (r) => `## ${r.label} (${r.modelUsed})\n${r.text || r.error}`
        ),
      ].join('\n\n');
      exportMarkdownToPdf({
        title: `Comparativa API Personal · FABRO`,
        subjectName: activeSubject?.name,
        markdown: md,
      });
    }
  };

  const modeSwitcher = (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-[#090D16]">
      <button
        type="button"
        onClick={() => setActiveTab('browser')}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
          activeTab === 'browser'
            ? 'bg-sky-600 text-white'
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        Navegador Multi-IA
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('compare')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
          activeTab === 'compare'
            ? 'bg-sky-600 text-white'
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        <GitCompare className="w-3.5 h-3.5" />
        <span>Comparar IA (Vía API)</span>
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('admin')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
          activeTab === 'admin'
            ? 'bg-sky-600 text-white'
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        <Settings className="w-3.5 h-3.5" />
        <span>{isAdmin ? 'Administrar y Pruebas' : 'Compatibilidad'}</span>
      </button>
    </div>
  );

  if (activeTab !== 'browser') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              FABRO AI BROWSER · {activeTab === 'compare' ? 'Comparador Vía API' : 'Compatibilidad de Portales'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparación autorizada vía API o diagnóstico en vivo de cabeceras CSP / X-Frame-Options.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {modeSwitcher}
            <button
              type="button"
              onClick={() => setActiveSection('apuntes')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Apuntes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('estudio-panel')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Educación</span>
            </button>
          </div>
        </div>

        {activeTab === 'admin' && (
          <PortalAdminManager
            module="ai-browser"
            portals={systemPortals}
            categories={categories}
            homeConfig={homeConfig}
            isAdmin={isAdmin}
            onRefresh={loadSnapshot}
          />
        )}

        {activeTab === 'compare' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => void handleRunCompare(e)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Comparador Multi-IA Vía API Autorizada
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ejecuta tu consulta únicamente mediante APIs configuradas en FABRO Gateway o en tu cuenta personal de FABRO CONNECT. Nunca automatiza portales web ni lee sesiones externas.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-[#090D16] text-xs">
                  <button
                    type="button"
                    onClick={() => setCompareSource('gateway')}
                    className={`rounded-md px-3 py-1 font-semibold whitespace-nowrap cursor-pointer ${
                      compareSource === 'gateway'
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Gateway FABRO ({enabledGatewayModels.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareSource('connect')}
                    className={`rounded-md px-3 py-1 font-semibold whitespace-nowrap cursor-pointer ${
                      compareSource === 'connect'
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    FABRO CONNECT Personal ({connectedPersonal.length})
                  </button>
                </div>
              </div>

              {compareSource === 'gateway' ? (
                <div className="flex flex-wrap gap-2">
                  {enabledGatewayModels.map((model) => {
                    const checked = selectedGatewayModelIds.includes(model.id);
                    return (
                      <label
                        key={model.id}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs cursor-pointer ${
                          checked
                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedGatewayModelIds((prev) =>
                              prev.includes(model.id)
                                ? prev.filter((id) => id !== model.id)
                                : [...prev, model.id].slice(0, 4)
                            )
                          }
                        />
                        <span>{model.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : connectedPersonal.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Todavía no conectaste cuentas personales con API Key en FABRO CONNECT.
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('connect')}
                    className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer whitespace-nowrap"
                  >
                    Ir a FABRO CONNECT
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connectedPersonal.map((conn) => {
                    const checked = selectedConnectIds.includes(conn.id);
                    return (
                      <label
                        key={conn.id}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs cursor-pointer ${
                          checked
                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedConnectIds((prev) =>
                              prev.includes(conn.id)
                                ? prev.filter((id) => id !== conn.id)
                                : [...prev, conn.id].slice(0, 4)
                            )
                          }
                        />
                        <span>
                          {conn.label} ({conn.selectedModel})
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <textarea
                rows={3}
                required
                value={comparePrompt}
                onChange={(e) => setComparePrompt(e.target.value)}
                placeholder="Escribí una sola pregunta académica para contrastar las respuestas de múltiples modelos..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Enfoque:</span>
                  <button
                    type="button"
                    onClick={() => setCompareMode('interpretativo')}
                    className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                      compareMode === 'interpretativo'
                        ? 'bg-sky-600/15 text-sky-700 dark:text-sky-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Interpretativo universitario
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareMode('sencillo')}
                    className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                      compareMode === 'sencillo'
                        ? 'bg-sky-600/15 text-sky-700 dark:text-sky-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Didáctico claro
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={compareLoading || !comparePrompt.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {compareLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GitCompare className="w-3.5 h-3.5" />
                  )}
                  <span>{compareLoading ? 'Comparando vía API...' : 'Comparar respuestas'}</span>
                </button>
              </div>

              {compareError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                  {compareError}
                </div>
              )}
            </form>

            {(gatewayCompareResult || personalCompareResult) && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Resultados comparados
                  </h4>
                  <div className="flex items-center gap-2">
                    {compareSavedNotice && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {compareSavedNotice}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSaveCompareToNotes()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500/50 whitespace-nowrap cursor-pointer"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      <span>Guardar en Apuntes</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportComparePdf}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar PDF</span>
                    </button>
                  </div>
                </div>

                {gatewayCompareResult && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gatewayCompareResult.results.map((r) => (
                        <div
                          key={r.modelId}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">
                                {r.label}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {r.providerName} · {r.apiModelName}
                              </p>
                            </div>
                            <span className="font-mono tabular-nums text-[11px] text-slate-500">
                              {r.latencyMs} ms
                            </span>
                          </div>
                          {r.status === 'ok' ? (
                            <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-80 overflow-y-auto">
                              {r.text}
                            </div>
                          ) : (
                            <p className="text-xs text-rose-600 dark:text-rose-400">
                              {r.error || 'Modelo no disponible.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2">
                        <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          Coincidencias
                        </h5>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {(gatewayCompareResult.agreements || []).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2">
                        <h5 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
                          Diferencias
                        </h5>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {(gatewayCompareResult.differences || []).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2">
                        <h5 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          Posibles errores o limitaciones
                        </h5>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {(gatewayCompareResult.limitations || []).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {gatewayCompareResult.synthesisMarkdown && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-2">
                        <h5 className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Análisis final de FABRO IA</span>
                        </h5>
                        <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {gatewayCompareResult.synthesisMarkdown}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {personalCompareResult && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {personalCompareResult.results.map((r) => (
                      <div
                        key={r.connectionId}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{r.label}</p>
                            <p className="text-[11px] text-slate-500">{r.modelUsed}</p>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-500">
                            {r.latencyMs} ms
                          </span>
                        </div>
                        {r.status === 'ok' ? (
                          <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-80 overflow-y-auto">
                            {r.text}
                          </div>
                        ) : (
                          <p className="text-xs text-rose-600 dark:text-rose-400">{r.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}
      <FabroBrowserWorkspace
        module="ai-browser"
        title="FABRO AI BROWSER · Navegador Multi-IA Inteligente"
        subtitle="Acceso directo con tu propia cuenta en pestañas oficiales, asistente FABRO IA voluntario y comparador API"
        categories={categories}
        portals={allPortals}
        adminHomeConfig={homeConfig}
        loadingPortals={loading}
        onRefreshPortals={loadSnapshot}
        onPatchPortalProbe={handlePatchPortalProbe}
        defaultPortalId={homeConfig?.defaultPortalId}
        headerExtraActions={modeSwitcher}
      />
    </div>
  );
};
