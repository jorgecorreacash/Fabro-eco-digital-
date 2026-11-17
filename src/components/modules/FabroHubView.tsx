import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Edit3,
  ExternalLink,
  Filter,
  Globe,
  History,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  Power,
  Scale,
  Search,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useAIGateway, type GatewayCompareEntry } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import { HUB_CATEGORIES, INITIAL_HUB_TOOLS } from '../../data/hubToolsCatalog';
import { markdownToHtml } from '../../lib/exporters';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import type { HubCategoryId, HubTool } from '../../types/fabro';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';

type HubTab = 'directorio' | 'multi-ai' | 'comparador' | 'recomendador' | 'historial' | 'admin';

const RECOMMENDER_PRESETS = [
  'Tengo que escribir una monografía universitaria con citas verificables y buena redacción en español',
  'Necesito resolver integrales, graficar funciones y entender los pasos en matemática',
  'Quiero resumir artículos científicos en PDF en inglés y armar una presentación oral visual',
  'Estoy estudiando programación y necesito practicar algoritmos con diagramas claros',
];

function isToolFreeFriendly(tool: HubTool): boolean {
  const txt = `${tool.pricingSummary} ${tool.tags.join(' ')}`.toLowerCase();
  return txt.includes('gratuit') || txt.includes('libre') || txt.includes('abierto') || txt.includes('gratis');
}

export const FabroHubView: React.FC = () => {
  const {
    profile,
    subjects,
    selectedSubjectId,
    hubState,
    toggleHubFavorite,
    logHubHistory,
    clearHubHistory,
    upsertCustomHubTool,
    deleteCustomHubTool,
    toggleHubToolActive,
    createNote,
    setActiveSection,
    isOnline,
  } = useFabro();

  const {
    providers: gatewayProviders,
    models: gatewayModels,
    runGatewayCompare,
  } = useAIGateway();

  const [activeTab, setActiveTab] = useState<HubTab>('directorio');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HubCategoryId | 'Todas'>('Todas');
  const [quickFilter, setQuickFilter] = useState<'todas' | 'favoritas' | 'api_real' | 'gratuitas'>('todas');

  // Comparator state
  const [compareIds, setCompareIds] = useState<string[]>(['hub_gemini', 'hub_chatgpt']);
  const [compareAddId, setCompareAddId] = useState('');

  // Multi-AI state (Gateway ChatGPT & Gemini, max 4 parallel)
  const [multiPrompt, setMultiPrompt] = useState('');
  const [multiMode, setMultiMode] = useState<'interpretativo' | 'sencillo'>('interpretativo');
  const [multiSubjectId, setMultiSubjectId] = useState(selectedSubjectId || '');
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'gemini__gemini-4-hydrogen',
    'gemini__gemini-3.1-flash-lite',
    'openai__gpt-4o-mini',
    'openai__gpt-4o',
  ]);
  const [multiRunning, setMultiRunning] = useState(false);
  const [multiResults, setMultiResults] = useState<GatewayCompareEntry[]>([]);
  const [multiSynthesis, setMultiSynthesis] = useState('');
  const [multiAgreements, setMultiAgreements] = useState<string[]>([]);
  const [multiDifferences, setMultiDifferences] = useState<string[]>([]);
  const [multiLimitations, setMultiLimitations] = useState<string[]>([]);
  const [multiTotalCostUsd, setMultiTotalCostUsd] = useState<number>(0);
  const [multiLastPrompt, setMultiLastPrompt] = useState('');
  const [multiError, setMultiError] = useState('');
  const [multiSavedNote, setMultiSavedNote] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Recommender state
  const [recNeed, setRecNeed] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [recSummary, setRecSummary] = useState('');
  const [recToolIds, setRecToolIds] = useState<string[]>([]);
  const [recSteps, setRecSteps] = useState<string[]>([]);
  const [recProvider, setRecProvider] = useState('');

  // Admin state
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminCategory, setAdminCategory] = useState<HubCategoryId>('Inteligencia artificial conversacional');
  const [adminUrl, setAdminUrl] = useState('https://');
  const [adminServiceType, setAdminServiceType] = useState('Plataforma web educativa');
  const [adminPricing, setAdminPricing] = useState('Acceso web gratuito según condiciones del sitio oficial.');
  const [adminDesc, setAdminDesc] = useState('');
  const [adminEduUse, setAdminEduUse] = useState('');
  const [adminCapabilities, setAdminCapabilities] = useState('');
  const [adminTags, setAdminTags] = useState('');
  const [adminAccent, setAdminAccent] = useState('#06B6D4');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminNotice, setAdminNotice] = useState('');
  const [adminSearch, setAdminSearch] = useState('');

  // Merge catalog + custom tools + disabled overrides
  const allCatalogTools: HubTool[] = useMemo(() => {
    const disabledSet = new Set(hubState.disabledToolIds || []);
    const customMap = new Map<string, HubTool>();
    for (const c of hubState.customTools || []) {
      customMap.set(c.id, { ...c, isCustom: true });
    }
    const baseMerged = INITIAL_HUB_TOOLS.map((t) => {
      const override = customMap.get(t.id);
      const base = override ? { ...t, ...override, isCustom: false } : t;
      return {
        ...base,
        active: !disabledSet.has(base.id) && base.active !== false,
      };
    });
    const extraCustom = (hubState.customTools || [])
      .filter((c) => !INITIAL_HUB_TOOLS.some((b) => b.id === c.id))
      .map((c) => ({
        ...c,
        isCustom: true,
        active: !disabledSet.has(c.id) && c.active !== false,
      }));
    return [...extraCustom, ...baseMerged];
  }, [hubState.customTools, hubState.disabledToolIds]);

  const activeTools = useMemo(() => allCatalogTools.filter((t) => t.active), [allCatalogTools]);

  const providerMap = useMemo(
    () => new Map(gatewayProviders.map((p) => [p.id, p])),
    [gatewayProviders]
  );

  const resolveLiveApiState = (tool: HubTool): 'connected' | 'configurable' | 'link_only' => {
    if (tool.apiStatus === 'api_real') {
      if (tool.apiProviderKey === 'gemini') {
        const gp = providerMap.get('gemini');
        return gp?.configuredInBackend && gp?.enabled ? 'connected' : 'configurable';
      }
      return 'connected';
    }
    if (tool.apiStatus === 'api_configurable' && tool.apiProviderKey) {
      const gp = providerMap.get(tool.apiProviderKey);
      return gp?.configuredInBackend && gp?.enabled ? 'connected' : 'configurable';
    }
    return 'link_only';
  };

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const favSet = new Set(hubState.favorites || []);
    return activeTools.filter((tool) => {
      if (selectedCategory !== 'Todas' && tool.category !== selectedCategory) return false;
      if (quickFilter === 'favoritas' && !favSet.has(tool.id)) return false;
      if (quickFilter === 'api_real' && resolveLiveApiState(tool) !== 'connected') return false;
      if (quickFilter === 'gratuitas' && !isToolFreeFriendly(tool)) return false;
      if (!q) return true;
      const haystack = [
        tool.name,
        tool.category,
        tool.serviceType,
        tool.description,
        tool.educationalUse,
        tool.capabilities.join(' '),
        tool.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeTools, searchQuery, selectedCategory, quickFilter, hubState.favorites, providerMap]);

  const compareTools = useMemo(() => {
    return compareIds
      .map((id) => activeTools.find((t) => t.id === id))
      .filter((t): t is HubTool => Boolean(t));
  }, [compareIds, activeTools]);

  const handleToggleCompare = (tool: HubTool) => {
    setCompareIds((prev) => {
      if (prev.includes(tool.id)) {
        return prev.filter((id) => id !== tool.id);
      }
      void logHubHistory({
        toolId: tool.id,
        toolName: tool.name,
        category: tool.category,
        officialUrl: tool.officialUrl,
        action: 'compared',
      });
      return [...prev.slice(-3), tool.id];
    });
  };

  const handleOpenTool = (tool: HubTool) => {
    void logHubHistory({
      toolId: tool.id,
      toolName: tool.name,
      category: tool.category,
      officialUrl: tool.officialUrl,
      action: 'opened',
    });
  };

  const handleRunMultiAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = multiPrompt.trim();
    if (!clean || selectedModels.length === 0 || multiRunning) return;
    setMultiRunning(true);
    setMultiError('');
    setMultiSavedNote('');
    setMultiLastPrompt(clean);
    try {
      const subjectName = subjects.find((s) => s.id === multiSubjectId)?.name || '';
      const data = await runGatewayCompare({
        prompt: clean,
        modelIds: selectedModels.slice(0, 4),
        mode: multiMode,
        subjectName,
      });
      setMultiResults(Array.isArray(data.results) ? data.results : []);
      setMultiSynthesis(String(data.synthesisMarkdown || ''));
      setMultiAgreements(Array.isArray(data.agreements) ? data.agreements : []);
      setMultiDifferences(Array.isArray(data.differences) ? data.differences : []);
      setMultiLimitations(Array.isArray(data.limitations) ? data.limitations : []);
      setMultiTotalCostUsd(Number(data.totalEstimatedCostUsd || 0));
      void logHubHistory({
        toolId: 'hub_multi_ai',
        toolName: `Multi-IA Gateway (${selectedModels.length} modelos)`,
        category: 'Inteligencia artificial conversacional',
        officialUrl: 'https://gemini.google.com/',
        action: 'multi_ai',
      });
    } catch (err) {
      setMultiError(err instanceof Error ? err.message : 'Error consultando Multi-IA Gateway.');
    } finally {
      setMultiRunning(false);
    }
  };

  const handleSaveMultiToNotes = async () => {
    const successful = multiResults.filter((r) => r.status === 'ok' && r.text);
    if (successful.length === 0 && !multiSynthesis) return;
    const sections = [
      `# Comparativa Multi-IA · FABRO AI GATEWAY`,
      `**Consulta:** ${multiLastPrompt}`,
      '',
      ...(multiAgreements.length > 0
        ? ['## Coincidencias clave', ...multiAgreements.map((a) => `- ${a}`), '']
        : []),
      ...(multiDifferences.length > 0
        ? ['## Diferencias y matices', ...multiDifferences.map((d) => `- ${d}`), '']
        : []),
      ...(multiSynthesis ? ['## Síntesis Interpretativa Comparada (FABRO IA)', multiSynthesis, '---', ''] : []),
      ...successful.map((r) => `## ${r.label} (${r.providerName} · ${r.apiModelName})\n\n${r.text}`),
    ];
    const md = sections.join('\n');
    try {
      await createNote({
        subjectId: multiSubjectId,
        unit: '',
        folder: 'FABRO HUB · Multi-IA',
        title: `Multi-IA: ${multiLastPrompt.slice(0, 80)}`,
        contentHtml: markdownToHtml(md),
        contentText: md,
        tags: ['fabro-hub', 'multi-ia', 'gateway'],
        attachments: [],
        offlineAvailable: true,
      });
      setMultiSavedNote('Comparativa interpretativa guardada en Apuntes (carpeta "FABRO HUB · Multi-IA").');
    } catch {
      setMultiError('No se pudo guardar la comparativa en Apuntes.');
    }
  };

  const handleRunRecommender = async (overrideNeed?: string) => {
    const query = (overrideNeed ?? recNeed).trim();
    if (!query || recLoading) return;
    if (overrideNeed) setRecNeed(overrideNeed);
    setRecLoading(true);
    setRecError('');
    try {
      const resp = await authFetch('/api/ai/hub-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          need: query,
          catalog: activeTools.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
            description: t.description,
            educationalUse: t.educationalUse,
            tags: t.tags,
          })),
          educationLevel: profile?.educationLevel || 'universitario',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudieron generar recomendaciones.');
      }
      const ids: string[] = Array.isArray(data.recommendedToolIds) ? data.recommendedToolIds : [];
      setRecSummary(String(data.summaryMarkdown || ''));
      setRecToolIds(ids);
      setRecSteps(Array.isArray(data.workflowSteps) ? data.workflowSteps : []);
      setRecProvider(String(data.providerUsed || ''));
      if (ids[0]) {
        const firstTool = activeTools.find((t) => t.id === ids[0]);
        if (firstTool) {
          void logHubHistory({
            toolId: firstTool.id,
            toolName: firstTool.name,
            category: firstTool.category,
            officialUrl: firstTool.officialUrl,
            action: 'recommended',
          });
        }
      }
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Error generando recomendación.');
    } finally {
      setRecLoading(false);
    }
  };

  const resetAdminForm = () => {
    setEditingToolId(null);
    setAdminName('');
    setAdminCategory('Inteligencia artificial conversacional');
    setAdminUrl('https://');
    setAdminServiceType('Plataforma web educativa');
    setAdminPricing('Acceso web gratuito según condiciones del sitio oficial.');
    setAdminDesc('');
    setAdminEduUse('');
    setAdminCapabilities('');
    setAdminTags('');
    setAdminAccent('#06B6D4');
  };

  const handleEditToolInAdmin = (tool: HubTool) => {
    setEditingToolId(tool.id);
    setAdminName(tool.name);
    setAdminCategory(tool.category);
    setAdminUrl(tool.officialUrl);
    setAdminServiceType(tool.serviceType);
    setAdminPricing(tool.pricingSummary);
    setAdminDesc(tool.description);
    setAdminEduUse(tool.educationalUse);
    setAdminCapabilities(tool.capabilities.join(', '));
    setAdminTags(tool.tags.join(', '));
    setAdminAccent(tool.accentColor || '#06B6D4');
    setAdminNotice('');
  };

  const handleSaveAdminTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !/^https?:\/\//i.test(adminUrl.trim()) || adminSaving) return;
    setAdminSaving(true);
    setAdminNotice('');
    try {
      const existing = editingToolId ? allCatalogTools.find((t) => t.id === editingToolId) : null;
      const id = editingToolId || `hub_custom_${Date.now().toString(36)}`;
      const words = adminName.trim().split(/\s+/);
      const shortCode =
        existing?.shortCode ||
        (words.length >= 2
          ? `${words[0][0]}${words[1][0]}`.toUpperCase()
          : adminName.trim().slice(0, 2).toUpperCase());

      await upsertCustomHubTool({
        id,
        name: adminName.trim().slice(0, 80),
        shortCode,
        accentColor: adminAccent,
        description: adminDesc.trim() || 'Herramienta educativa añadida desde FABRO HUB.',
        category: adminCategory,
        officialUrl: adminUrl.trim(),
        serviceType: adminServiceType.trim() || 'Herramienta web',
        pricingSummary: adminPricing.trim() || 'Consultar condiciones en el sitio oficial.',
        apiStatus: existing?.apiStatus || 'official_link',
        apiProviderKey: existing?.apiProviderKey,
        capabilities: adminCapabilities
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
        educationalUse: adminEduUse.trim() || 'Recurso de apoyo académico.',
        tags: adminTags
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 10),
        active: existing?.active ?? true,
        isCustom: true,
      });
      setAdminNotice(editingToolId ? 'Herramienta actualizada en tu directorio.' : 'Nueva herramienta agregada al directorio.');
      resetAdminForm();
    } finally {
      setAdminSaving(false);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    });
  };

  const favSet = useMemo(() => new Set(hubState.favorites || []), [hubState.favorites]);

  const recommendedTools = useMemo(
    () =>
      recToolIds
        .map((id) => activeTools.find((t) => t.id === id))
        .filter((t): t is HubTool => Boolean(t)),
    [recToolIds, activeTools]
  );

  const adminFilteredTools = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return allCatalogTools;
    return allCatalogTools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [allCatalogTools, adminSearch]);

  const hasCommercialSelected = useMemo(
    () =>
      selectedModels.some((id) => {
        const m = gatewayModels.find((item) => item.id === id);
        return m?.accessTier === 'commercial' && providerMap.get(m.providerId)?.configuredInBackend;
      }),
    [selectedModels, gatewayModels, providerMap]
  );

  const renderToolCard = (tool: HubTool) => {
    const isFav = favSet.has(tool.id);
    const inCompare = compareIds.includes(tool.id);
    const apiState = resolveLiveApiState(tool);

    return (
      <article
        key={tool.id}
        className="group relative rounded-2xl border border-cyan-500/20 bg-[#0B152A]/85 p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-cyan-400/55 hover:shadow-[0_0_28px_-8px_rgba(34,211,238,0.4)] hover:-translate-y-0.5 transition-all duration-200"
      >
        <div className="space-y-3">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-xs tracking-wider text-white shrink-0 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${tool.accentColor}, #0891B2)`,
                  boxShadow: `0 6px 20px -6px ${tool.accentColor}88`,
                }}
              >
                {tool.shortCode}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                  {tool.name}
                </h3>
                <p className="text-[11px] text-cyan-200/75 truncate">
                  {tool.category} · {tool.serviceType}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void toggleHubFavorite(tool.id)}
              aria-label={isFav ? `Quitar ${tool.name} de favoritos` : `Agregar ${tool.name} a favoritos`}
              title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              className={`p-2 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                isFav
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                  : 'border-slate-700/80 text-slate-400 hover:text-amber-300 hover:border-amber-400/40'
              }`}
            >
              <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Description & Educational Utility */}
          <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
            {tool.description}
          </p>

          <div className="text-[11px] text-slate-300/90 space-y-1 pt-2 border-t border-cyan-500/15">
            <p className="leading-relaxed">
              <span className="font-semibold text-cyan-300">Uso educativo:</span> {tool.educationalUse}
            </p>
            <p className="leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-200">Acceso verificado:</span> {tool.pricingSummary}
            </p>
          </div>
        </div>

        {/* Honest Connection Indicator + Action Row */}
        <div className="pt-3 border-t border-cyan-500/15 space-y-3">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            {apiState === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                API real conectada
              </span>
            ) : apiState === 'configurable' ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-sky-300">
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                API configurable (Secrets)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                Acceso vía enlace oficial
              </span>
            )}

            {tool.capabilities.length > 0 && (
              <span className="text-slate-400 truncate max-w-[150px]" title={tool.capabilities.join(' · ')}>
                {tool.capabilities[0]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={tool.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleOpenTool(tool)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3.5 py-2 text-xs font-semibold text-white hover:from-blue-500 hover:to-cyan-400 transition-all shadow-[0_6px_20px_-6px_rgba(6,182,212,0.65)] whitespace-nowrap"
            >
              <span>Abrir</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={() => handleToggleCompare(tool)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                inCompare
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 text-slate-300 hover:border-cyan-400/40 hover:text-white'
              }`}
            >
              {inCompare ? <Check className="w-3.5 h-3.5" /> : <Scale className="w-3.5 h-3.5" />}
              <span>{inCompare ? 'Comparando' : 'Comparar'}</span>
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-[#050A17] via-[#091634] to-[#041E33] text-slate-100 shadow-[0_24px_80px_-24px_rgba(6,182,212,0.35)] overflow-hidden">
      {/* Top Hero & Universal Search */}
      <section className="relative p-5 sm:p-7 border-b border-cyan-500/20 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(37,99,235,0.2),transparent_55%)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Compass className="w-4 h-4" />
              <span>FABRO HUB · Navegador Multi-IA y Directorio Inteligente</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Todas las plataformas de estudio e IA en un solo lugar
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Explorá {activeTools.length} herramientas verificadas en 15 categorías, compará modelos de IA en paralelo con conexiones API reales y guardá tus favoritas. Herramienta educativa gratuita aportada por <strong className="text-white">Jorge Luis Correa</strong>.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="rounded-xl border border-cyan-500/20 bg-[#091327]/80 px-3.5 py-2.5 text-center">
              <p className="font-mono text-lg font-bold tabular-nums text-cyan-300">{activeTools.length}</p>
              <p className="text-[11px] text-slate-400">Herramientas</p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-[#091327]/80 px-3.5 py-2.5 text-center">
              <p className="font-mono text-lg font-bold tabular-nums text-blue-300">{hubState.favorites.length}</p>
              <p className="text-[11px] text-slate-400">Favoritas</p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-[#091327]/80 px-3.5 py-2.5 text-center">
              <p className="font-mono text-lg font-bold tabular-nums text-emerald-300">
                {activeTools.filter((t) => resolveLiveApiState(t) === 'connected').length}
              </p>
              <p className="text-[11px] text-slate-400">APIs activas</p>
            </div>
          </div>
        </div>

        {/* A. Prominent Universal Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyan-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'directorio') setActiveTab('directorio');
              }}
              placeholder="Buscador universal: nombre, categoría, función o qué necesitás estudiar (ej. GeoGebra, PDF, citas, traductor)..."
              className="w-full rounded-xl border border-cyan-400/30 bg-[#070E1E]/90 pl-11 pr-10 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchQuery.trim() && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRecNeed(searchQuery.trim());
                  setActiveTab('recomendador');
                  void handleRunRecommender(searchQuery.trim());
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer whitespace-nowrap"
              >
                <Wand2 className="w-4 h-4" />
                Recomendar con IA
              </button>
              <button
                type="button"
                onClick={() => {
                  setMultiPrompt(searchQuery.trim());
                  setActiveTab('multi-ai');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3.5 py-2.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-cyan-400 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                Consultar Multi-IA
              </button>
            </div>
          )}
        </div>

        {/* Hub Sub-Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'directorio' as const, label: 'Directorio (15 categorías)', icon: Layers },
            { id: 'multi-ai' as const, label: 'Multi-IA en paralelo', icon: Sparkles },
            { id: 'comparador' as const, label: `Comparador (${compareTools.length})`, icon: Scale },
            { id: 'recomendador' as const, label: 'Recomendador IA', icon: Wand2 },
            { id: 'historial' as const, label: `Historial (${hubState.history.length})`, icon: History },
            { id: 'admin' as const, label: 'Administrar', icon: Settings2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_6px_20px_-6px_rgba(34,211,238,0.6)]'
                    : 'border border-cyan-500/20 bg-[#081226]/70 text-slate-300 hover:text-white hover:border-cyan-400/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Hub Tab Viewport */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* TAB 1: DIRECTORIO INTELIGENTE + FAVORITOS */}
        {activeTab === 'directorio' && (
          <div className="space-y-5">
            {/* Quick Filters & Compare Launch Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'todas' as const, label: 'Todas las activas' },
                  { id: 'favoritas' as const, label: `Favoritas (${hubState.favorites.length})` },
                  { id: 'api_real' as const, label: 'Con API real en FABRO' },
                  { id: 'gratuitas' as const, label: 'Con acceso gratuito' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setQuickFilter(f.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      quickFilter === f.id
                        ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200'
                        : 'border border-slate-700/80 bg-[#081124] text-slate-300 hover:text-white'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    {f.label}
                  </button>
                ))}
              </div>

              {compareTools.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('comparador')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5" />
                  Abrir comparativa ({compareTools.length})
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 15 Category Selector Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('Todas')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  selectedCategory === 'Todas'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#091328] border border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-white'
                }`}
              >
                Todas ({activeTools.length})
              </button>
              {HUB_CATEGORIES.map((cat) => {
                const count = activeTools.filter((t) => t.category === cat).length;
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#091328] border border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-white'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {filteredTools.length === 0 ? (
              <div className="rounded-2xl border border-cyan-500/20 bg-[#081124]/80 p-10 text-center space-y-3">
                <Search className="w-8 h-8 text-cyan-400 mx-auto opacity-75" />
                <p className="text-sm font-semibold text-white">
                  No encontramos herramientas con ese criterio en esta vista.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('Todas');
                      setQuickFilter('todas');
                    }}
                    className="rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/15 cursor-pointer"
                  >
                    Ver todo el directorio
                  </button>
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => void handleRunRecommender(searchQuery.trim())}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
                    >
                      Pedir recomendación inteligente
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTools.map((tool) => renderToolCard(tool))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MULTI-IA EN PARALELO (GATEWAY CHATGPT Y GEMINI · MAX 4 MODELOS) */}
        {activeTab === 'multi-ai' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-cyan-500/25 bg-[#081226]/90 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Comparador Multi-IA Gateway (Máx. 4 modelos · {selectedModels.length}/4)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Contrastá respuestas simultáneas entre modelos gratuitos, autoalojados y comerciales conectados al Gateway central. Los no configurados o desactivados se informan con transparencia sin simular texto.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-lg bg-[#050B18] border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMultiMode('interpretativo')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                      multiMode === 'interpretativo'
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Interpretativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiMode('sencillo')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                      multiMode === 'sencillo'
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sencillo
                  </button>
                </div>
              </div>

              {/* All Gateway Models across 8 Adapters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {gatewayModels.map((m) => {
                  const prov = providerMap.get(m.providerId);
                  const selected = selectedModels.includes(m.id);
                  const enabled = Boolean(prov?.enabled && m.enabled);
                  const configured = Boolean(prov?.configuredInBackend);
                  const tierLabel =
                    m.accessTier === 'open_selfhosted'
                      ? 'Autoalojado'
                      : m.accessTier === 'free_quota'
                        ? 'Cuota gratuita'
                        : 'Comercial API';
                  const statusText = !enabled
                    ? 'Desactivado en Admin'
                    : configured
                      ? `Conectado · ${tierLabel}`
                      : `Pendiente ${prov?.envVarName || 'Secrets'} · ${tierLabel}`;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setSelectedModels((prev) => {
                          if (prev.includes(m.id)) return prev.filter((x) => x !== m.id);
                          if (prev.length >= 4) return [...prev.slice(1), m.id];
                          return [...prev, m.id];
                        })
                      }
                      className={`rounded-xl border px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        selected
                          ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
                          : 'border-slate-800 bg-[#060C1A] text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{m.label}</p>
                        <p
                          className={`text-[10px] truncate ${
                            !enabled
                              ? 'text-slate-500'
                              : configured
                                ? 'text-emerald-300'
                                : 'text-amber-300/90'
                          }`}
                        >
                          {statusText}
                        </p>
                      </div>
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {hasCommercialSelected && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-[11px] text-amber-200">
                  Aviso de consumo: seleccionaste modelos de pago por API además de cuotas gratuitas. El Gateway contabilizará los tokens y el costo estimado USD en tu límite diario.
                </div>
              )}

              <form onSubmit={(e) => void handleRunMultiAi(e)} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <select
                    value={multiSubjectId}
                    onChange={(e) => setMultiSubjectId(e.target.value)}
                    aria-label="Materia opcional para Multi-IA"
                    className="sm:col-span-1 rounded-xl border border-cyan-500/25 bg-[#060C1A] px-3 py-2.5 text-xs text-slate-100"
                  >
                    <option value="">Consulta general</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        Materia: {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="sm:col-span-3 flex gap-2">
                    <input
                      type="text"
                      value={multiPrompt}
                      onChange={(e) => setMultiPrompt(e.target.value)}
                      placeholder="Escribí una pregunta o concepto para comparar interpretaciones en paralelo..."
                      className="flex-1 min-w-0 rounded-xl border border-cyan-500/30 bg-[#060C1A] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    />
                    <button
                      type="submit"
                      disabled={multiRunning || !multiPrompt.trim() || selectedModels.length === 0 || !isOnline}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {multiRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span>{multiRunning ? 'Consultando...' : `Comparar (${selectedModels.length})`}</span>
                    </button>
                  </div>
                </div>
              </form>

              {multiError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
                  {multiError}
                </div>
              )}

              {multiSavedNote && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between gap-2">
                  <span>{multiSavedNote}</span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('apuntes')}
                    className="font-semibold underline cursor-pointer"
                  >
                    Ir a Apuntes
                  </button>
                </div>
              )}
            </div>

            {/* Parallel Synthesis + Structured Insights Card */}
            {(multiSynthesis || multiAgreements.length > 0 || multiDifferences.length > 0) && (
              <div className="rounded-2xl border border-cyan-400/40 bg-gradient-to-r from-blue-950/70 to-cyan-950/50 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-cyan-300 font-display text-base font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Síntesis Interpretativa Comparada · FABRO AI GATEWAY</span>
                    </div>
                    <p className="text-[11px] font-mono tabular-nums text-cyan-100/75">
                      Costo estimado total de esta comparativa: ${multiTotalCostUsd.toFixed(5)} USD
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveMultiToNotes()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    Guardar comparativa en Apuntes
                  </button>
                </div>

                {(multiAgreements.length > 0 || multiDifferences.length > 0 || multiLimitations.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl border border-emerald-400/25 bg-[#061124]/80 p-3 space-y-1.5">
                      <p className="font-semibold text-emerald-300">Coincidencias clave</p>
                      <ul className="space-y-1 text-slate-300 list-disc pl-4">
                        {multiAgreements.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-cyan-400/25 bg-[#061124]/80 p-3 space-y-1.5">
                      <p className="font-semibold text-cyan-300">Diferencias de enfoque</p>
                      <ul className="space-y-1 text-slate-300 list-disc pl-4">
                        {multiDifferences.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-amber-400/25 bg-[#061124]/80 p-3 space-y-1.5">
                      <p className="font-semibold text-amber-300">Limitaciones detectadas</p>
                      <ul className="space-y-1 text-slate-300 list-disc pl-4">
                        {multiLimitations.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {multiSynthesis && (
                  <div className="fabro-markdown text-xs sm:text-sm text-slate-200">
                    <Markdown remarkPlugins={[remarkGfm]}>{multiSynthesis}</Markdown>
                  </div>
                )}
              </div>
            )}

            {/* Parallel Responses Grid */}
            {multiResults.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {multiResults.map((res) => (
                  <article
                    key={res.modelId}
                    className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3 ${
                      res.status === 'ok'
                        ? 'border-cyan-500/30 bg-[#0A1429]/90'
                        : 'border-slate-800 bg-[#070E1E]/85'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                        <div>
                          <h4 className="font-display text-sm font-bold text-white">{res.label}</h4>
                          <p className="text-[11px] font-mono tabular-nums text-slate-400">
                            {res.providerName} · {res.apiModelName}
                            {res.latencyMs ? ` · ${(res.latencyMs / 1000).toFixed(1)}s` : ''}
                            {res.status === 'ok'
                              ? ` · ${(res.inputTokens + res.outputTokens).toLocaleString('es-AR')} tok · $${res.estimatedCostUsd.toFixed(5)}`
                              : ''}
                          </p>
                        </div>
                        <a
                          href={res.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:border-cyan-400/50 shrink-0"
                        >
                          Web oficial
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {res.status === 'ok' && res.text ? (
                        <div className="fabro-markdown text-xs sm:text-sm text-slate-200 max-h-[380px] overflow-y-auto pr-1">
                          <Markdown remarkPlugins={[remarkGfm]}>{res.text}</Markdown>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 space-y-2 text-xs text-amber-200">
                          <p className="font-semibold">
                            {res.status === 'not_configured'
                              ? 'Credencial pendiente en Secrets'
                              : res.status === 'disabled'
                                ? 'Desactivado en Panel Admin'
                                : 'Error de consulta'}
                          </p>
                          <p className="text-amber-100/85 leading-relaxed">{res.error}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <a
                              href={res.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/30"
                            >
                              Abrir {res.providerName} en su web oficial
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyText(`q_${res.modelId}`, multiLastPrompt)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:text-white cursor-pointer"
                            >
                              {copiedKey === `q_${res.modelId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              Copiar pregunta
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {res.status === 'ok' && res.text && (
                      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-3 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleCopyText(res.modelId, res.text || '')}
                          className="inline-flex items-center gap-1 text-slate-300 hover:text-cyan-300 cursor-pointer"
                        >
                          {copiedKey === res.modelId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === res.modelId ? 'Copiado' : 'Copiar'}
                        </button>
                        <a
                          href={
                            buildWhatsAppShareHref(
                              formatForWhatsApp({
                                title: `${res.label} · ${multiLastPrompt.slice(0, 60)}`,
                                body: res.text,
                              })
                            ).href
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                        <AudioReadAloudControl
                          compact
                          getText={() => res.text || ''}
                          title={`multi-ia-${res.modelId}`}
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMPARADOR DE HERRAMIENTAS */}
        {activeTab === 'comparador' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-[#081226]/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Comparador de Plataformas ({compareTools.length}/4)
                </h3>
                <p className="text-xs text-slate-400">
                  Contrastá capacidades, estado de integración en FABRO, condiciones verificadas y utilidad educativa lado a lado.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={compareAddId}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    if (!compareIds.includes(id)) {
                      setCompareIds((prev) => [...prev.slice(-3), id]);
                    }
                    setCompareAddId('');
                  }}
                  aria-label="Agregar herramienta al comparador"
                  className="rounded-xl border border-cyan-500/30 bg-[#060C1A] px-3 py-2 text-xs text-white"
                >
                  <option value="">+ Agregar herramienta...</option>
                  {activeTools
                    .filter((t) => !compareIds.includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {compareTools.length === 0 ? (
              <div className="rounded-2xl border border-cyan-500/20 bg-[#081124]/80 p-10 text-center text-xs text-slate-400">
                Seleccioná al menos 2 herramientas desde el selector superior o desde el Directorio para compararlas aquí.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-cyan-500/20 bg-[#081226]/90">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b border-cyan-500/20 bg-[#060E1F]">
                      <th className="p-4 text-xs font-semibold text-cyan-300 w-44">Criterio</th>
                      {compareTools.map((tool) => (
                        <th key={tool.id} className="p-4 align-top">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ backgroundColor: tool.accentColor }}
                              >
                                {tool.shortCode}
                              </span>
                              <span className="font-display text-sm font-bold text-white truncate">
                                {tool.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleCompare(tool)}
                              aria-label={`Quitar ${tool.name}`}
                              className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    <tr>
                      <td className="p-4 font-semibold text-slate-300">Categoría</td>
                      {compareTools.map((t) => (
                        <td key={t.id} className="p-4 text-cyan-200">{t.category}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-slate-300">Tipo de servicio</td>
                      {compareTools.map((t) => (
                        <td key={t.id} className="p-4 text-slate-300">{t.serviceType}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-slate-300">Integración FABRO</td>
                      {compareTools.map((t) => {
                        const st = resolveLiveApiState(t);
                        return (
                          <td key={t.id} className="p-4">
                            {st === 'connected' ? (
                              <span className="text-emerald-300 font-semibold">API real conectada</span>
                            ) : st === 'configurable' ? (
                              <span className="text-sky-300">API configurable (Secrets)</span>
                            ) : (
                              <span className="text-slate-400">Acceso vía enlace oficial</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-slate-300">Acceso y precio verificado</td>
                      {compareTools.map((t) => (
                        <td key={t.id} className="p-4 text-slate-300 leading-relaxed">{t.pricingSummary}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-slate-300">Capacidades clave</td>
                      {compareTools.map((t) => (
                        <td key={t.id} className="p-4 text-slate-300">
                          <ul className="list-disc pl-4 space-y-1">
                            {t.capabilities.map((c, idx) => (
                              <li key={idx}>{c}</li>
                            ))}
                          </ul>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-slate-300">Utilidad educativa</td>
                      {compareTools.map((t) => (
                        <td key={t.id} className="p-4 text-slate-300 leading-relaxed">{t.educationalUse}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-semibold text-slate-300">Acceso oficial</td>
                      {compareTools.map((t) => (
                        <td key={t.id} className="p-4">
                          <a
                            href={t.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleOpenTool(t)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Abrir sitio
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RECOMENDADOR INTELIGENTE */}
        {activeTab === 'recomendador' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-cyan-500/25 bg-[#081226]/90 p-5 space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Recomendador Inteligente de Estudio
                </h3>
                <p className="text-xs text-slate-300">
                  Contale a FABRO qué tarea académica querés resolver y te arma la combinación exacta de plataformas y pasos de trabajo.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {RECOMMENDER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => void handleRunRecommender(preset)}
                    className="text-left rounded-lg border border-cyan-500/25 bg-[#060E1F] px-3 py-1.5 text-[11px] text-cyan-200 hover:border-cyan-400/60 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleRunRecommender();
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <input
                  type="text"
                  value={recNeed}
                  onChange={(e) => setRecNeed(e.target.value)}
                  placeholder="Ej. Tengo que exponer sobre anatomía cardiovascular y necesito gráficos, citas y diapositivas..."
                  className="flex-1 rounded-xl border border-cyan-500/30 bg-[#060C1A] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                />
                <button
                  type="submit"
                  disabled={recLoading || !recNeed.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {recLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {recLoading ? 'Analizando...' : 'Recomendar herramientas'}
                </button>
              </form>

              {recError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
                  {recError}
                </div>
              )}
            </div>

            {recSummary && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-cyan-400/35 bg-[#08162E]/90 p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-cyan-300">
                      Recomendación interpretativa · FABRO HUB
                    </span>
                    {recProvider && (
                      <span className="text-[11px] font-mono text-slate-400">{recProvider}</span>
                    )}
                  </div>
                  <div className="fabro-markdown text-xs sm:text-sm text-slate-200">
                    <Markdown remarkPlugins={[remarkGfm]}>{recSummary}</Markdown>
                  </div>
                  {recSteps.length > 0 && (
                    <div className="pt-3 border-t border-cyan-500/20 space-y-1.5">
                      <p className="text-xs font-semibold text-white">Flujo de trabajo sugerido:</p>
                      <ul className="space-y-1 text-xs text-cyan-100/90">
                        {recSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {recommendedTools.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {recommendedTools.map((tool) => renderToolCard(tool))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: HISTORIAL DE HERRAMIENTAS */}
        {activeTab === 'historial' && (
          <div className="rounded-2xl border border-cyan-500/20 bg-[#081226]/90 overflow-hidden">
            <div className="px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Historial reciente en FABRO HUB ({hubState.history.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Accesos sincronizados en tu cuenta para retomar rápidamente tus plataformas de estudio.
                </p>
              </div>
              {hubState.history.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearHubHistory()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar historial
                </button>
              )}
            </div>

            {hubState.history.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                Todavía no abriste herramientas en FABRO HUB. Cuando explores plataformas desde el Directorio o Comparador, quedarán registradas aquí.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {hubState.history.map((item) => (
                  <div
                    key={item.id}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.toolName}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.category} ·{' '}
                        {item.action === 'multi_ai'
                          ? 'Consulta Multi-IA'
                          : item.action === 'compared'
                          ? 'Comparada'
                          : item.action === 'recommended'
                          ? 'Recomendada'
                          : 'Abierta'}{' '}
                        · {new Date(item.visitedAt).toLocaleString('es-AR')}
                      </p>
                    </div>
                    <a
                      href={item.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 shrink-0"
                    >
                      Volver a abrir
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: ADMINISTRACIÓN DINÁMICA DEL CATÁLOGO */}
        {activeTab === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Form Add / Edit Tool */}
            <form
              onSubmit={(e) => void handleSaveAdminTool(e)}
              className="lg:col-span-5 rounded-2xl border border-cyan-500/25 bg-[#081226]/90 p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-white">
                  {editingToolId ? 'Editar herramienta' : 'Agregar nueva herramienta'}
                </h3>
                {editingToolId && (
                  <button
                    type="button"
                    onClick={resetAdminForm}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>

              {adminNotice && (
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {adminNotice}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Nombre *</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Ej. Elicit"
                  className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Categoría *</label>
                <select
                  value={adminCategory}
                  onChange={(e) => setAdminCategory(e.target.value as HubCategoryId)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                >
                  {HUB_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Enlace oficial (URL) *</label>
                  <input
                    type="url"
                    required
                    value={adminUrl}
                    onChange={(e) => setAdminUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Color icono</label>
                  <input
                    type="color"
                    value={adminAccent}
                    onChange={(e) => setAdminAccent(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-700 bg-[#060C1A] px-1 py-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Tipo de servicio</label>
                <input
                  type="text"
                  value={adminServiceType}
                  onChange={(e) => setAdminServiceType(e.target.value)}
                  placeholder="Ej. Asistente de revisión bibliográfica"
                  className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Acceso gratuito / pago verificado</label>
                <input
                  type="text"
                  value={adminPricing}
                  onChange={(e) => setAdminPricing(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Descripción breve</label>
                <textarea
                  rows={2}
                  value={adminDesc}
                  onChange={(e) => setAdminDesc(e.target.value)}
                  placeholder="Qué hace y para qué sirve..."
                  className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Utilidad educativa</label>
                <input
                  type="text"
                  value={adminEduUse}
                  onChange={(e) => setAdminEduUse(e.target.value)}
                  placeholder="Cómo ayuda a un estudiante..."
                  className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Capacidades (coma)</label>
                  <input
                    type="text"
                    value={adminCapabilities}
                    onChange={(e) => setAdminCapabilities(e.target.value)}
                    placeholder="Síntesis, Citas, PDF"
                    className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Etiquetas (coma)</label>
                  <input
                    type="text"
                    value={adminTags}
                    onChange={(e) => setAdminTags(e.target.value)}
                    placeholder="tesis, papers"
                    className="w-full rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={adminSaving || !adminName.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-2.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {adminSaving
                  ? 'Guardando en Firebase...'
                  : editingToolId
                  ? 'Guardar cambios'
                  : 'Agregar al catálogo'}
              </button>
            </form>

            {/* Manage All Tools List */}
            <div className="lg:col-span-7 rounded-2xl border border-cyan-500/20 bg-[#081226]/90 overflow-hidden">
              <div className="p-4 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-white">
                  Catálogo ({allCatalogTools.length} plataformas)
                </h3>
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Filtrar herramientas..."
                  className="rounded-lg border border-slate-700 bg-[#060C1A] px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-800/80">
                {adminFilteredTools.map((tool) => {
                  const isCustomOnly = (hubState.customTools || []).some(
                    (c) => c.id === tool.id && !INITIAL_HUB_TOOLS.some((b) => b.id === tool.id)
                  );
                  return (
                    <div
                      key={tool.id}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: tool.accentColor, opacity: tool.active ? 1 : 0.4 }}
                        >
                          {tool.shortCode}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold truncate ${
                              tool.active ? 'text-white' : 'text-slate-500 line-through'
                            }`}
                          >
                            {tool.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {tool.category} · {tool.active ? 'Activa' : 'Desactivada'}
                            {isCustomOnly ? ' · Personalizada' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditToolInAdmin(tool)}
                          title="Editar clasificación y datos"
                          className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-cyan-300 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleHubToolActive(tool.id, !tool.active)}
                          title={tool.active ? 'Desactivar del directorio' : 'Reactivar en directorio'}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                            tool.active
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {tool.active ? 'Activa' : 'Inactiva'}
                        </button>
                        {isCustomOnly && (
                          <button
                            type="button"
                            onClick={() => void deleteCustomHubTool(tool.id)}
                            title="Eliminar herramienta personalizada"
                            className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
