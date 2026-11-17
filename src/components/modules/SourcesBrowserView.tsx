import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  FilePlus2,
  FileText,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  Maximize2,
  Plus,
  Printer,
  RotateCw,
  Scale,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import {
  exportMarkdownToHtmlPrint,
  exportMarkdownToPdf,
  exportMarkdownToText,
  exportMarkdownToWord,
  markdownToHtml,
} from '../../lib/exporters';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';
import {
  buildEncyclopediaNoteContent,
  WikiMediaLightbox,
  type WikiMediaItem,
} from '../common/WikiMediaLightbox';
import { AIReadingModeModal } from './AIReadingModeModal';

type SearchScope = 'todo' | 'academico' | 'enciclopedico' | 'documentacion' | 'imagenes';
type SummaryStyle = 'interpretativo' | 'academico' | 'ejecutivo' | 'puntos_clave' | 'guia_estudio';
type AIProviderChoice = 'auto' | 'gemini' | 'chatgpt' | 'doble_ia';
type SearchEngineKey = 'google' | 'enciclopedia' | 'openalex' | 'crossref' | 'arxiv';
type MediaFilterKey = 'all' | 'enciclopedia' | 'commons' | 'nasa' | 'met' | 'openverse';

interface WebSourceItem {
  title: string;
  url: string;
  domain: string;
  sourceOrigin?: string;
  snippet?: string;
  authors?: string;
  year?: string;
}

interface SourceComparisonItem {
  title: string;
  url: string;
  domain: string;
  score: number;
  isRecommended: boolean;
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
  summaryPreview: string;
}

interface BrowserHistoryEntry {
  kind: 'start' | 'search' | 'source' | 'compare' | 'images';
  input: string;
  title: string;
  scope: SearchScope;
  overviewMarkdown?: string;
  secondOpinionMarkdown?: string;
  providerUsed?: string;
  secondProviderUsed?: string;
  results?: WebSourceItem[];
  activeSources?: WebSourceItem[];
  summaryMarkdown?: string;
  summaryStyle?: SummaryStyle;
  summaryMode?: 'academico' | 'sencillo';
  comparisonMarkdown?: string;
  comparisonVerdict?: string;
  comparisonItems?: SourceComparisonItem[];
  chosenSourceUrl?: string;
  mediaItems?: WikiMediaItem[];
  mediaSourceFilter?: MediaFilterKey;
  articleSummary?: { title: string; summary: string; url: string; sourceName: string } | null;
  selectedMediaItem?: WikiMediaItem | null;
  selectedMediaAiMarkdown?: string;
}

interface BrowserTab {
  id: string;
  history: BrowserHistoryEntry[];
  historyIndex: number;
}

const SCOPE_OPTIONS: Array<{ id: SearchScope; label: string }> = [
  { id: 'todo', label: 'Todo' },
  { id: 'academico', label: 'Académico' },
  { id: 'enciclopedico', label: 'Enciclopédico' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'imagenes', label: 'Imágenes y Atlas' },
];

const SEARCH_ENGINES: Array<{ id: SearchEngineKey; label: string }> = [
  { id: 'google', label: 'Google Web' },
  { id: 'enciclopedia', label: 'Enciclopedia' },
  { id: 'openalex', label: 'OpenAlex' },
  { id: 'crossref', label: 'CrossRef DOI' },
  { id: 'arxiv', label: 'arXiv' },
];

const MEDIA_FILTER_OPTIONS: Array<{ id: MediaFilterKey; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'enciclopedia', label: 'Enciclopedia' },
  { id: 'commons', label: 'Mediateca libre' },
  { id: 'nasa', label: 'NASA' },
  { id: 'met', label: 'Museo Met' },
  { id: 'openverse', label: 'Openverse CC' },
];

const SUMMARY_STYLES: Array<{ id: SummaryStyle; label: string }> = [
  { id: 'interpretativo', label: 'Interpretativo FABRO IA' },
  { id: 'academico', label: 'Análisis académico' },
  { id: 'ejecutivo', label: 'Resumen ejecutivo' },
  { id: 'puntos_clave', label: 'Puntos clave' },
  { id: 'guia_estudio', label: 'Guía de estudio' },
];

function createEmptyTab(): BrowserTab {
  return {
    id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    history: [
      {
        kind: 'start',
        input: '',
        title: 'Nueva pestaña',
        scope: 'academico',
      },
    ],
    historyIndex: 0,
  };
}

function normalizeAddressInput(raw: string): { isUrl: boolean; value: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { isUrl: false, value: '' };
  if (/^https?:\/\//i.test(trimmed)) {
    return { isUrl: true, value: trimmed };
  }
  // Looks like a domain path without spaces (e.g. scielo.org/...)
  if (!/\s/.test(trimmed) && /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
    return { isUrl: true, value: `https://${trimmed}` };
  }
  return { isUrl: false, value: trimmed };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const SourcesBrowserView: React.FC = () => {
  const {
    user,
    profile,
    subjects,
    selectedSubjectId,
    createNote,
    uploadLibraryDocument,
    setActiveSection,
  } = useFabro();

  const storageKey = user ? `fabro-sources-browser-${user.uid}` : null;

  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    if (typeof window !== 'undefined' && user) {
      try {
        const raw = localStorage.getItem(`fabro-sources-browser-${user.uid}`);
        if (raw) {
          const parsed = JSON.parse(raw) as BrowserTab[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 8);
        }
      } catch {
        // Ignore corrupted cache
      }
    }
    return [createEmptyTab()];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || '');
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );
  const currentEntry: BrowserHistoryEntry =
    activeTab?.history[activeTab.historyIndex] || activeTab.history[0];

  const [addressInput, setAddressInput] = useState(currentEntry?.input || '');
  const [scope, setScope] = useState<SearchScope>(currentEntry?.scope || 'academico');
  const [aiProvider, setAiProvider] = useState<AIProviderChoice>('auto');
  const [enabledSearchEngines, setEnabledSearchEngines] = useState<SearchEngineKey[]>([
    'google',
    'enciclopedia',
    'openalex',
    'crossref',
    'arxiv',
  ]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilterKey>('all');
  const [failedMediaIds, setFailedMediaIds] = useState<Record<string, boolean>>({});
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [explainingMediaId, setExplainingMediaId] = useState<string | null>(null);
  const [savingMediaId, setSavingMediaId] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState(selectedSubjectId || subjects[0]?.id || '');
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>(
    currentEntry?.summaryStyle || 'interpretativo'
  );
  const [summaryMode, setSummaryMode] = useState<'academico' | 'sencillo'>(
    currentEntry?.summaryMode || 'academico'
  );
  const [customFocus, setCustomFocus] = useState('');

  const [selectedUrls, setSelectedUrls] = useState<WebSourceItem[]>([]);
  const [customCompareUrl, setCustomCompareUrl] = useState('');
  const [compareCriteria, setCompareCriteria] = useState('');
  const [searching, setSearching] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [choosingUrl, setChoosingUrl] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState<'note' | 'library' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mobilePane, setMobilePane] = useState<'browser' | 'summary'>('browser');
  const [readingModeOpen, setReadingModeOpen] = useState(false);

  // Sync subjectId if user navigated from a Subject Workspace
  useEffect(() => {
    if (selectedSubjectId) {
      setSubjectId(selectedSubjectId);
    } else if (!subjectId && subjects.length > 0) {
      setSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects, subjectId]);

  // Sync address bar & controls when switching tabs or navigating history
  useEffect(() => {
    if (!currentEntry) return;
    setAddressInput(currentEntry.input || '');
    setScope(currentEntry.scope || 'academico');
    if (currentEntry.summaryStyle) setSummaryStyle(currentEntry.summaryStyle);
    if (currentEntry.summaryMode) setSummaryMode(currentEntry.summaryMode);
    if (currentEntry.summaryMarkdown && window.innerWidth < 1024 && currentEntry.kind === 'source') {
      setMobilePane('summary');
    }
  }, [activeTabId, activeTab?.historyIndex]);

  // Persist browser tabs per user
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(tabs.slice(0, 8)));
    } catch {
      // Ignore storage quota issues
    }
  }, [tabs, storageKey]);

  const activeSubjectName = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.name || 'General',
    [subjects, subjectId]
  );

  const pushHistoryEntry = (tabId: string, entry: BrowserHistoryEntry) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab;
        const truncated = tab.history.slice(0, tab.historyIndex + 1);
        const nextHistory = [...truncated, entry].slice(-20);
        return {
          ...tab,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        };
      })
    );
  };

  const updateCurrentEntry = (tabId: string, patch: Partial<BrowserHistoryEntry>) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab;
        const nextHistory = tab.history.map((item, idx) =>
          idx === tab.historyIndex ? { ...item, ...patch } : item
        );
        return { ...tab, history: nextHistory };
      })
    );
  };

  const toggleSearchEngine = (engine: SearchEngineKey) => {
    setEnabledSearchEngines((prev) => {
      if (prev.includes(engine)) {
        return prev.length > 1 ? prev.filter((e) => e !== engine) : prev;
      }
      return [...prev, engine];
    });
  };

  const runImagesSearch = async (
    queryText: string,
    targetTabId: string,
    filter: MediaFilterKey = mediaFilter,
    inPlace = false
  ) => {
    const clean = queryText.trim();
    if (!clean) return;
    setSearching(true);
    setErrorMsg('');
    setFeedback('');
    try {
      const resp = await fetch(
        `/api/media/encyclopedia-images?q=${encodeURIComponent(clean)}&sources=${encodeURIComponent(filter)}&limit=24`
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudieron explorar imágenes enciclopédicas.');

      const list: WikiMediaItem[] = Array.isArray(data.images) ? data.images : [];
      const patch: BrowserHistoryEntry = {
        kind: 'images',
        input: clean,
        title: `Atlas: ${clean.slice(0, 32)}`,
        scope: 'imagenes',
        mediaItems: list,
        mediaSourceFilter: filter,
        articleSummary: data.articleSummary || null,
        selectedMediaItem: list[0] || null,
        selectedMediaAiMarkdown: '',
      };

      if (inPlace && currentEntry?.kind === 'images') {
        updateCurrentEntry(targetTabId, patch);
      } else {
        pushHistoryEntry(targetTabId, patch);
      }
      setMobilePane('browser');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error explorando imágenes enciclopédicas.');
    } finally {
      setSearching(false);
    }
  };

  const runExplainSelectedMedia = async (item: WikiMediaItem) => {
    if (!activeTab) return;
    setExplainingMediaId(item.id);
    setErrorMsg('');
    try {
      const resp = await authFetch('/api/media/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.description || '',
          extendedInfo: item.extendedInfo || '',
          author: item.author || '',
          license: item.license || '',
          sourceName: item.sourceName || '',
          sourcePageUrl: item.sourcePageUrl || '',
          subjectName: subjectId ? activeSubjectName : '',
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo generar la ficha enciclopédica.');

      updateCurrentEntry(activeTab.id, {
        selectedMediaItem: item,
        selectedMediaAiMarkdown: data.explanationMarkdown || '',
        secondOpinionMarkdown: data.secondOpinionMarkdown || undefined,
        providerUsed: data.providerUsed || '',
        secondProviderUsed: data.secondProviderUsed || undefined,
      });
      setMobilePane('summary');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error analizando imagen con IA.');
    } finally {
      setExplainingMediaId(null);
    }
  };

  const handleSaveMediaItemToNotes = async (item: WikiMediaItem, extraAiMd?: string) => {
    setSavingMediaId(item.id);
    setErrorMsg('');
    setFeedback('');
    try {
      const payload = buildEncyclopediaNoteContent(item, extraAiMd);
      await createNote({
        subjectId,
        unit: '',
        folder: 'Enciclopedia visual',
        title: payload.title,
        contentHtml: payload.contentHtml,
        contentText: payload.contentText,
        tags: payload.tags,
        attachments: [],
        offlineAvailable: true,
      });
      setFeedback(`Imagen "${item.title}" guardada con su ficha completa en Apuntes.`);
    } catch {
      setErrorMsg('No se pudo guardar la imagen en Apuntes.');
    } finally {
      setSavingMediaId(null);
    }
  };

  const runSearch = async (queryText: string, targetScope: SearchScope, targetTabId: string) => {
    if (targetScope === 'imagenes') {
      await runImagesSearch(queryText, targetTabId, mediaFilter);
      return;
    }
    setSearching(true);
    setErrorMsg('');
    setFeedback('');
    try {
      const resp = await authFetch('/api/ai/source-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          scope: targetScope,
          subjectName: subjectId ? activeSubjectName : '',
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider,
          searchSources: enabledSearchEngines,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo completar la búsqueda.');

      pushHistoryEntry(targetTabId, {
        kind: 'search',
        input: queryText,
        title: queryText.slice(0, 40),
        scope: targetScope,
        overviewMarkdown: data.overviewMarkdown || '',
        secondOpinionMarkdown: data.secondOpinionMarkdown || undefined,
        providerUsed: data.providerUsed || '',
        secondProviderUsed: data.secondProviderUsed || undefined,
        results: Array.isArray(data.sources) ? data.sources : [],
      });
      setMobilePane('browser');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al buscar fuentes web.');
    } finally {
      setSearching(false);
    }
  };

  const runSummarizeSources = async (
    sourcesList: WebSourceItem[],
    styleOverride?: SummaryStyle,
    modeOverride?: 'academico' | 'sencillo',
    inPlace = false
  ) => {
    if (sourcesList.length === 0 || !activeTab) return;
    const targetStyle = styleOverride || summaryStyle;
    const targetMode = modeOverride || summaryMode;
    setSummarizing(true);
    setErrorMsg('');
    setFeedback('');
    try {
      const resp = await authFetch('/api/ai/source-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sourcesList,
          style: targetStyle,
          mode: targetMode,
          subjectName: subjectId ? activeSubjectName : '',
          educationLevel: profile?.educationLevel || 'universitario',
          customFocus: customFocus.trim(),
          aiProvider,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo resumir la fuente.');

      const title =
        sourcesList.length === 1
          ? sourcesList[0].title || extractDomain(sourcesList[0].url)
          : `Síntesis de ${sourcesList.length} fuentes`;

      const nextPatch: BrowserHistoryEntry = {
        kind: 'source',
        input: sourcesList.length === 1 ? sourcesList[0].url : `${sourcesList.length} fuentes seleccionadas`,
        title: title.slice(0, 40),
        scope,
        activeSources: sourcesList,
        summaryMarkdown: data.summaryMarkdown || '',
        secondOpinionMarkdown: data.secondOpinionMarkdown || undefined,
        providerUsed: data.providerUsed || '',
        secondProviderUsed: data.secondProviderUsed || undefined,
        summaryStyle: targetStyle,
        summaryMode: targetMode,
      };

      if (inPlace && currentEntry?.kind === 'source') {
        updateCurrentEntry(activeTab.id, nextPatch);
      } else {
        pushHistoryEntry(activeTab.id, nextPatch);
      }
      setMobilePane('summary');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al resumir las fuentes.');
    } finally {
      setSummarizing(false);
    }
  };

  const runCompareSources = async (
    sourcesList: WebSourceItem[],
    topicHint?: string,
    inPlace = false
  ) => {
    if (!activeTab) return;
    if (sourcesList.length < 2) {
      setErrorMsg('Seleccioná al menos 2 fuentes para analizar y comparar cuál es mejor.');
      return;
    }
    setComparing(true);
    setErrorMsg('');
    setFeedback('');
    try {
      const resp = await authFetch('/api/ai/source-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sourcesList.slice(0, 8),
          topic: topicHint || (currentEntry?.kind === 'search' ? currentEntry.input : ''),
          criteria: compareCriteria.trim(),
          subjectName: subjectId ? activeSubjectName : '',
          educationLevel: profile?.educationLevel || 'universitario',
          aiProvider,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudieron comparar las fuentes.');

      const rankings: SourceComparisonItem[] = Array.isArray(data.rankings) ? data.rankings : [];
      const nextPatch: BrowserHistoryEntry = {
        kind: 'compare',
        input: `Comparativa de ${sourcesList.length} fuentes`,
        title: `Comparativa (${sourcesList.length})`,
        scope,
        activeSources: sourcesList.slice(0, 8),
        comparisonMarkdown: data.comparisonMarkdown || '',
        secondOpinionMarkdown: data.secondOpinionMarkdown || undefined,
        providerUsed: data.providerUsed || '',
        secondProviderUsed: data.secondProviderUsed || undefined,
        comparisonVerdict: data.verdictSummary || '',
        comparisonItems: rankings,
      };

      if (inPlace && currentEntry?.kind === 'compare') {
        updateCurrentEntry(activeTab.id, nextPatch);
      } else {
        pushHistoryEntry(activeTab.id, nextPatch);
      }
      setMobilePane('browser');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al comparar las fuentes.');
    } finally {
      setComparing(false);
    }
  };

  const handleChooseAndSaveAsNote = async (chosen: SourceComparisonItem) => {
    if (!activeTab || choosingUrl) return;
    setChoosingUrl(chosen.url);
    setErrorMsg('');
    setFeedback('');
    try {
      const resp = await authFetch('/api/ai/source-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [{ title: chosen.title, url: chosen.url, domain: chosen.domain }],
          style: summaryStyle,
          mode: summaryMode,
          subjectName: subjectId ? activeSubjectName : '',
          educationLevel: profile?.educationLevel || 'universitario',
          customFocus: customFocus.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo generar el resumen de la fuente elegida.');

      const summaryMd: string = data.summaryMarkdown || '';
      const esc = (val: string) =>
        val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const strengthsMd =
        chosen.strengths.length > 0
          ? `\n- **Fortalezas detectadas:** ${chosen.strengths.join(' · ')}`
          : '';
      const selectionHeaderMd = `> **Fuente seleccionada tras análisis comparativo (${chosen.score}/100${chosen.isRecommended ? ' · Mejor valorada' : ''})**\n> - **Ideal para:** ${chosen.bestFor}${strengthsMd}\n\n---\n\n`;
      const fullMarkdown = `${selectionHeaderMd}${summaryMd}`;

      const sourceLinkHtml = `<h2>Fuente elegida</h2><ul><li><a href="${esc(chosen.url)}" target="_blank" rel="noopener noreferrer">${esc(chosen.title || chosen.domain)}</a> (${esc(chosen.url)})</li></ul>`;
      const contentHtml = markdownToHtml(fullMarkdown) + sourceLinkHtml;

      await createNote({
        subjectId,
        unit: '',
        folder: 'Fuentes web',
        title: (chosen.title || chosen.domain || 'Apunte de fuente elegida').slice(0, 200),
        contentHtml,
        contentText: fullMarkdown,
        tags: ['fuente-elegida', 'comparativa', 'resumen'],
        attachments: [],
        offlineAvailable: true,
      });

      updateCurrentEntry(activeTab.id, { chosenSourceUrl: chosen.url });
      setFeedback(`Apunte creado y guardado a partir de "${chosen.title || chosen.domain}" en la carpeta "Fuentes web".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar el apunte de la fuente elegida.');
    } finally {
      setChoosingUrl(null);
    }
  };

  const handleAddCustomCompareUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalizeAddressInput(customCompareUrl);
    if (!norm.isUrl || !norm.value) {
      setErrorMsg('Ingresá una URL válida (por ejemplo https://repositorio.edu/...).');
      return;
    }
    const domain = extractDomain(norm.value);
    setSelectedUrls((prev) => {
      if (prev.some((s) => s.url === norm.value)) return prev;
      if (prev.length >= 8) {
        setErrorMsg('Podés comparar hasta 8 fuentes al mismo tiempo.');
        return prev;
      }
      return [...prev, { title: domain, url: norm.value, domain }];
    });
    setCustomCompareUrl('');
    setErrorMsg('');
  };

  const handleNavigateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab) return;
    const normalized = normalizeAddressInput(addressInput);
    if (!normalized.value) return;
    if (normalized.isUrl) {
      const domain = extractDomain(normalized.value);
      await runSummarizeSources([{ title: domain, url: normalized.value, domain }]);
    } else {
      await runSearch(normalized.value, scope, activeTab.id);
    }
  };

  const handleBack = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id ? { ...tab, historyIndex: Math.max(0, tab.historyIndex - 1) } : tab
      )
    );
  };

  const handleForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? { ...tab, historyIndex: Math.min(tab.history.length - 1, tab.historyIndex + 1) }
          : tab
      )
    );
  };

  const handleReload = () => {
    if (!activeTab || !currentEntry) return;
    if (currentEntry.kind === 'search' && currentEntry.input) {
      void runSearch(currentEntry.input, scope, activeTab.id);
    } else if (currentEntry.kind === 'images' && currentEntry.input) {
      void runImagesSearch(currentEntry.input, activeTab.id, currentEntry.mediaSourceFilter || mediaFilter, true);
    } else if (currentEntry.kind === 'source' && currentEntry.activeSources?.length) {
      void runSummarizeSources(currentEntry.activeSources, summaryStyle, summaryMode, true);
    } else if (currentEntry.kind === 'compare' && currentEntry.activeSources?.length) {
      void runCompareSources(currentEntry.activeSources, '', true);
    }
  };

  const handleAddTab = () => {
    if (tabs.length >= 8) {
      setErrorMsg('Podés tener hasta 8 pestañas abiertas al mismo tiempo.');
      return;
    }
    const newTab = createEmptyTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setMobilePane('browser');
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) {
      const reset = createEmptyTab();
      setTabs([reset]);
      setActiveTabId(reset.id);
      return;
    }
    const idx = tabs.findIndex((t) => t.id === tabId);
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      const fallback = remaining[Math.max(0, idx - 1)] || remaining[0];
      setActiveTabId(fallback.id);
    }
  };

  const toggleSourceSelection = (item: WebSourceItem) => {
    setSelectedUrls((prev) => {
      const exists = prev.some((s) => s.url === item.url);
      if (exists) return prev.filter((s) => s.url !== item.url);
      if (prev.length >= 10) {
        setErrorMsg('Podés seleccionar hasta 10 fuentes para resumir juntas.');
        return prev;
      }
      return [...prev, item];
    });
  };

  // Determine active printable document (source summary, multi-source comparison, image sheet, OR search synthesis)
  const selectedMedia = currentEntry?.kind === 'images' ? currentEntry.selectedMediaItem || null : null;

  const printableTitle =
    currentEntry?.kind === 'images'
      ? selectedMedia
        ? `Lámina enciclopédica: ${selectedMedia.title}`
        : `Atlas visual: ${currentEntry.input}`
      : currentEntry?.kind === 'source'
      ? currentEntry.activeSources?.length === 1
        ? `Resumen: ${currentEntry.activeSources[0].title || currentEntry.activeSources[0].domain}`
        : `Síntesis de ${currentEntry.activeSources?.length || 1} fuentes`
      : currentEntry?.kind === 'compare'
      ? `Análisis comparativo de ${currentEntry.activeSources?.length || 2} fuentes`
      : currentEntry?.kind === 'search'
      ? `Investigación: ${currentEntry.input}`
      : '';

  const baseMarkdown =
    currentEntry?.kind === 'images'
      ? selectedMedia
        ? [
            `# ${selectedMedia.title}`,
            selectedMedia.description || '',
            selectedMedia.extendedInfo && selectedMedia.extendedInfo !== selectedMedia.description
              ? selectedMedia.extendedInfo
              : '',
            [
              selectedMedia.sourceName ? `- **Fuente:** ${selectedMedia.sourceName}` : '',
              selectedMedia.author ? `- **Autoría / Colección:** ${selectedMedia.author}` : '',
              selectedMedia.dateCreated ? `- **Fecha:** ${selectedMedia.dateCreated}` : '',
              selectedMedia.license ? `- **Licencia:** ${selectedMedia.license}` : '',
              selectedMedia.dimensions ? `- **Resolución:** ${selectedMedia.dimensions}` : '',
              selectedMedia.sourcePageUrl ? `- **Enlace:** ${selectedMedia.sourcePageUrl}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            currentEntry.selectedMediaAiMarkdown || '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : currentEntry.articleSummary?.summary || ''
      : currentEntry?.kind === 'source'
      ? currentEntry.summaryMarkdown || ''
      : currentEntry?.kind === 'compare'
      ? currentEntry.comparisonMarkdown || ''
      : currentEntry?.kind === 'search'
      ? currentEntry.overviewMarkdown || ''
      : '';

  const printableMarkdown = currentEntry?.secondOpinionMarkdown
    ? `${baseMarkdown}\n\n---\n\n## Análisis complementario (${currentEntry.secondProviderUsed || 'Segunda IA'})\n\n${currentEntry.secondOpinionMarkdown}`
    : baseMarkdown;

  const printableSources: WebSourceItem[] =
    currentEntry?.kind === 'images' && selectedMedia?.sourcePageUrl
      ? [
          {
            title: selectedMedia.title,
            url: selectedMedia.sourcePageUrl,
            domain: selectedMedia.sourceDomain || selectedMedia.sourceName || 'Atlas',
          },
        ]
      : currentEntry?.kind === 'source' || currentEntry?.kind === 'compare'
      ? currentEntry.activeSources || []
      : currentEntry?.kind === 'search'
      ? currentEntry.results || []
      : [];

  const handlePrint = () => {
    if (!printableMarkdown) return;
    setMobilePane('summary');
    window.setTimeout(() => {
      window.print();
    }, 60);
  };

  const handleSaveToNotes = async () => {
    if (!printableMarkdown) return;
    if (currentEntry?.kind === 'images' && selectedMedia) {
      await handleSaveMediaItemToNotes(
        selectedMedia,
        [
          currentEntry.selectedMediaAiMarkdown || '',
          currentEntry.secondOpinionMarkdown
            ? `## Análisis complementario (${currentEntry.secondProviderUsed || 'Segunda IA'})\n${currentEntry.secondOpinionMarkdown}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      );
      return;
    }
    setSavingTarget('note');
    setFeedback('');
    setErrorMsg('');
    try {
      const esc = (val: string) =>
        val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const sourcesHtml =
        printableSources.length > 0
          ? `<h2>Fuentes consultadas</h2><ul>${printableSources
              .map(
                (s) =>
                  `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a> (${esc(s.url)})</li>`
              )
              .join('')}</ul>`
          : '';
      const html = markdownToHtml(printableMarkdown) + sourcesHtml;
      await createNote({
        subjectId,
        unit: '',
        folder: 'Fuentes web',
        title: printableTitle.slice(0, 200) || 'Resumen de fuente web',
        contentHtml: html,
        contentText: printableMarkdown,
        tags: ['fuente-web', 'resumen'],
        attachments: [],
        offlineAvailable: true,
      });
      setFeedback('Guardado en Apuntes (carpeta "Fuentes web").');
    } catch {
      setErrorMsg('No se pudo guardar en Apuntes.');
    } finally {
      setSavingTarget(null);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!printableMarkdown) return;
    setSavingTarget('library');
    setFeedback('');
    setErrorMsg('');
    try {
      const sourcesFooter =
        printableSources.length > 0
          ? `\n\nFUENTES CONSULTADAS:\n${printableSources.map((s) => `- ${s.title}: ${s.url}`).join('\n')}`
          : '';
      await uploadLibraryDocument({
        title: printableTitle.slice(0, 200) || 'Fuente web resumida',
        category: 'investigacion',
        subjectId,
        tags: ['navegador-web', 'resumen'],
        aiAuthorized: true,
        extractedText: `${printableMarkdown}${sourcesFooter}`,
      });
      setFeedback('Guardado en tu Biblioteca (autorizado para Tutor AI y Exámenes).');
    } catch {
      setErrorMsg('No se pudo guardar en tu Biblioteca.');
    } finally {
      setSavingTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Title & Subject Association */}
      <div className="no-print flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Buscador y Lector de Fuentes · Herramienta Principal
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Explorá fuentes reales, pedile a FABRO IA un resumen interpretativo y explicativo de las seleccionadas y guardalo directamente en tus Apuntes.
          </p>
        </div>

        <div className="w-full sm:w-64 shrink-0">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Nombre de la materia
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Nombre de la materia"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-xs text-slate-900 dark:text-white"
          >
            <option value="">General (sin materia)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Browser Window Chrome (Tabs + Address Bar + Scope Bar) */}
      <section className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
        {/* Browser Tabs Strip */}
        <div className="flex items-center gap-1 px-2 pt-2 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map((tab) => {
            const tabEntry = tab.history[tab.historyIndex] || tab.history[0];
            const isActive = tab.id === activeTab?.id;
            return (
              <div
                key={tab.id}
                className={`group flex items-center gap-2 rounded-t-lg px-3 py-2 text-xs max-w-[190px] shrink-0 border-t border-x transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-[#0F1623] text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 font-semibold'
                    : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span className="truncate">{tabEntry?.title || 'Nueva pestaña'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCloseTab(tab.id)}
                  aria-label="Cerrar pestaña"
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleAddTab}
            title="Abrir nueva pestaña"
            aria-label="Abrir nueva pestaña"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation & Omnibox Toolbar */}
        <div className="p-2.5 sm:p-3 space-y-2.5">
          <form onSubmit={(e) => void handleNavigateSubmit(e)} className="flex items-center gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleBack}
                disabled={!activeTab || activeTab.historyIndex <= 0}
                aria-label="Atrás"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-35 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleForward}
                disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1}
                aria-label="Adelante"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-35 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleReload}
                disabled={!currentEntry || currentEntry.kind === 'start' || searching || summarizing || comparing}
                aria-label="Recargar"
                className="hidden sm:inline-flex p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-35 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCw className={`w-4 h-4 ${searching || summarizing || comparing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="Buscá un tema o pegá una URL (https://...)..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={searching || summarizing || comparing || !addressInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {searching || summarizing || comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>{searching ? 'Buscando...' : summarizing ? 'Resumiendo...' : comparing ? 'Comparando...' : 'Ir'}</span>
            </button>
          </form>

          {/* Search Scope Controls, Multi-IA & Search Engine Filters */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-x-auto max-w-full">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setScope(opt.id);
                      const term = addressInput.trim() || currentEntry?.input;
                      if (opt.id === 'imagenes' && term && currentEntry?.kind !== 'images' && activeTab) {
                        void runImagesSearch(term, activeTab.id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      scope === opt.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as AIProviderChoice)}
                  aria-label="Motor de inteligencia artificial"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="auto">IA: Auto (Gemini + Respaldo)</option>
                  <option value="gemini">IA: Google Gemini</option>
                  <option value="chatgpt">IA: OpenAI ChatGPT</option>
                  <option value="doble_ia">IA: Doble IA comparada</option>
                </select>
              </div>
            </div>

            {scope !== 'imagenes' && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium mr-0.5">
                  Fuentes activas:
                </span>
                {SEARCH_ENGINES.map((eng) => {
                  const active = enabledSearchEngines.includes(eng.id);
                  return (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => toggleSearchEngine(eng.id)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium cursor-pointer transition-colors ${
                        active
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      {eng.label}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedUrls.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {selectedUrls.length >= 2 ? (
                  <button
                    type="button"
                    onClick={() => void runCompareSources(selectedUrls)}
                    disabled={comparing || summarizing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
                    {comparing ? 'Comparando...' : `Comparar mejor (${selectedUrls.length})`}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Marcá 1 fuente más para comparar
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void runSummarizeSources(selectedUrls, 'interpretativo', summaryMode)}
                  disabled={summarizing || comparing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Interpretar y resumir ({selectedUrls.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUrls([])}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="no-print rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {feedback && (
        <div className="no-print rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-2">
          <span>{feedback}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSection('apuntes')}
              className="font-semibold underline cursor-pointer"
            >
              Ver en Apuntes
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('biblioteca')}
              className="font-semibold underline cursor-pointer"
            >
              Ver en Biblioteca
            </button>
          </div>
        </div>
      )}

      {/* Mobile Pane Toggle */}
      <div className="no-print lg:hidden grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMobilePane('browser')}
          className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
            mobilePane === 'browser'
              ? 'bg-white dark:bg-[#0F1623] text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Navegador y resultados
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('summary')}
          className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
            mobilePane === 'summary'
              ? 'bg-white dark:bg-[#0F1623] text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Resumen e impresión
        </button>
      </div>

      {/* Main Split: Left Browser Content | Right Printable Summary & Multi-Format Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Browser Viewport */}
        <section
          className={`no-print lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 sm:p-5 space-y-4 ${
            mobilePane === 'browser' ? 'block' : 'hidden lg:block'
          }`}
        >
          {currentEntry.kind === 'start' && (
            <div className="py-6 sm:py-8 space-y-6">
              <div className="space-y-2 text-center max-w-md mx-auto">
                <Globe className="w-10 h-10 text-sky-600 dark:text-sky-400 mx-auto" />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Explorador académico con pestañas
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Escribí un tema para encontrar fuentes reales verificadas en la web o pegá directamente la dirección URL de un artículo para resumirlo al instante.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Búsquedas sugeridas para comenzar
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Teoría de la relatividad general fundamentos',
                    'Metodología de la investigación científica Hernández Sampieri',
                    'Ciclo de Krebs bioquímica rutas metabólicas',
                    'Principios de derecho constitucional y control de convencionalidad',
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setAddressInput(example);
                        if (activeTab) void runSearch(example, scope, activeTab.id);
                      }}
                      className="text-left rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 hover:border-sky-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direct multi-URL comparison builder */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Comparar varias URLs y elegir la mejor fuente
                  </p>
                </div>
                <form onSubmit={handleAddCustomCompareUrl} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customCompareUrl}
                    onChange={(e) => setCustomCompareUrl(e.target.value)}
                    placeholder="Pegá una URL (https://...) para sumar a la comparativa..."
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={!customCompareUrl.trim()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </form>

                {selectedUrls.length > 0 && (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      {selectedUrls.map((s) => (
                        <div
                          key={s.url}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-3 py-1.5 text-xs"
                        >
                          <span className="truncate text-slate-700 dark:text-slate-300">
                            {s.domain} · {s.url}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleSourceSelection(s)}
                            aria-label="Quitar URL"
                            className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {selectedUrls.length >= 2 && (
                      <button
                        type="button"
                        disabled={comparing}
                        onClick={() => void runCompareSources(selectedUrls)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                      >
                        {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
                        {comparing ? 'Analizando y comparando fuentes...' : `Analizar y comparar (${selectedUrls.length} fuentes)`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentEntry.kind === 'search' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Resultados encontrados ({currentEntry.results?.length || 0})
                    {currentEntry.providerUsed ? ` · ${currentEntry.providerUsed}` : ''}
                  </p>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                    {currentEntry.input}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => activeTab && void runImagesSearch(currentEntry.input, activeTab.id)}
                    disabled={searching}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Ver imágenes enciclopédicas
                  </button>
                  {currentEntry.results && currentEntry.results.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => void runCompareSources(currentEntry.results!.slice(0, 4), currentEntry.input)}
                      disabled={comparing || summarizing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
                      Comparar mejores
                    </button>
                  )}
                  {currentEntry.results && currentEntry.results.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void runSummarizeSources(
                          currentEntry.results!.slice(0, 4),
                          'interpretativo',
                          summaryMode
                        )
                      }
                      disabled={summarizing || comparing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 whitespace-nowrap cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Interpretar principales (FABRO IA)
                    </button>
                  )}
                </div>
              </div>

              {(!currentEntry.results || currentEntry.results.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No se devolvieron enlaces individuales para esta consulta, pero podés leer e imprimir el panorama generado en el panel derecho o probar con otra palabra clave.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {currentEntry.results.map((item) => {
                    const checked = selectedUrls.some((s) => s.url === item.url);
                    return (
                      <div key={item.url} className="py-3.5 first:pt-1 space-y-1.5">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleSourceSelection(item)}
                            aria-label={`Seleccionar ${item.title}`}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                              checked
                                ? 'bg-sky-600 border-sky-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </button>

                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {item.sourceOrigin || 'Fuente web'}
                              </span>
                              {' · '}
                              <span>{item.domain}</span>
                              {item.year ? ` · ${item.year}` : ''}
                              {item.authors ? ` · ${item.authors}` : ''}
                            </p>
                            <button
                              type="button"
                              onClick={() => void runSummarizeSources([item])}
                              className="text-left text-sm font-semibold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer leading-snug block"
                            >
                              {item.title}
                            </button>
                            {item.snippet && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                {item.snippet}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.url}
                            </p>
                          </div>
                        </div>

                        <div className="pl-6 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void runSummarizeSources([item])}
                            disabled={summarizing}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            Abrir y resumir
                          </button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Abrir sitio
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentEntry.kind === 'images' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Explorador enciclopédico visual · {currentEntry.mediaItems?.length || 0} resultados
                  </p>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                    {currentEntry.input}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => activeTab && void runSearch(currentEntry.input, 'academico', activeTab.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Buscar artículos sobre este tema
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {MEDIA_FILTER_OPTIONS.map((mf) => {
                  const active = (currentEntry.mediaSourceFilter || mediaFilter) === mf.id;
                  return (
                    <button
                      key={mf.id}
                      type="button"
                      onClick={() => {
                        setMediaFilter(mf.id);
                        if (activeTab) void runImagesSearch(currentEntry.input, activeTab.id, mf.id, true);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        active
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {mf.label}
                    </button>
                  );
                })}
              </div>

              {currentEntry.articleSummary && (
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                      Artículo enciclopédico: {currentEntry.articleSummary.title}
                    </span>
                    <a
                      href={currentEntry.articleSummary.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Leer fuente
                    </a>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {currentEntry.articleSummary.summary}
                  </p>
                </div>
              )}

              {!currentEntry.mediaItems || currentEntry.mediaItems.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  No se encontraron imágenes para este filtro. Probá seleccionar "Todas" o cambiar el término de búsqueda.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentEntry.mediaItems.map((media, mIdx) => {
                    const isSelected = selectedMedia?.id === media.id;
                    const broken = Boolean(failedMediaIds[media.id]);
                    return (
                      <article
                        key={media.id}
                        className={`rounded-xl border overflow-hidden flex flex-col justify-between transition-colors ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40'
                        }`}
                      >
                        <div
                          onClick={() => {
                            if (!activeTab) return;
                            updateCurrentEntry(activeTab.id, {
                              selectedMediaItem: media,
                              selectedMediaAiMarkdown: '',
                              secondOpinionMarkdown: undefined,
                            });
                            setMobilePane('summary');
                          }}
                          className="cursor-pointer"
                        >
                          <div className="relative w-full h-36 bg-slate-200 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                            {broken ? (
                              <div className="text-center text-slate-400 text-[11px] space-y-1">
                                <ImageOff className="w-5 h-5 mx-auto" />
                                <p>Vista previa no disponible</p>
                              </div>
                            ) : (
                              <img
                                src={media.thumbUrl}
                                alt={media.title}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setFailedMediaIds((prev) => ({ ...prev, [media.id]: true }))
                                }
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIdx(mIdx);
                              }}
                              className="absolute right-2 bottom-2 rounded bg-black/75 text-white px-2 py-1 text-[10px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Maximize2 className="w-3 h-3" />
                              Visor
                            </button>
                          </div>

                          <div className="p-3 space-y-1">
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 truncate">
                              {media.sourceName || 'Atlas enciclopédico'}
                              {media.dateCreated ? ` · ${media.dateCreated}` : ''}
                            </p>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                              {media.title}
                            </h4>
                            {media.description && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                {media.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="px-3 pb-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void runExplainSelectedMedia(media)}
                            disabled={explainingMediaId === media.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600/10 border border-sky-500/30 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-600/20 disabled:opacity-50 cursor-pointer"
                          >
                            {explainingMediaId === media.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            Explicar IA
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveMediaItemToNotes(media)}
                            disabled={savingMediaId === media.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            {savingMediaId === media.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <BookmarkPlus className="w-3 h-3" />
                            )}
                            Guardar Apunte
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentEntry.kind === 'source' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lector activo · {currentEntry.activeSources?.length || 1} fuente(s)
                </p>
                <div className="space-y-2">
                  {(currentEntry.activeSources || []).map((src) => {
                    const inCompare = selectedUrls.some((s) => s.url === src.url);
                    return (
                      <div
                        key={src.url}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {src.title || src.domain}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {src.url}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleSourceSelection(src)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                              inCompare
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                            }`}
                          >
                            {inCompare ? <Check className="w-3 h-3" /> : <Scale className="w-3 h-3" />}
                            {inCompare ? 'En comparativa' : 'Comparar'}
                          </button>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Original
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Regeneration Controls */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tipo de resumen
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SUMMARY_STYLES.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSummaryStyle(st.id)}
                        className={`rounded-lg border px-2.5 py-2 text-xs font-medium text-left cursor-pointer transition-colors ${
                          summaryStyle === st.id
                            ? 'border-sky-500 bg-sky-600/10 text-sky-700 dark:text-sky-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Modalidad
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setSummaryMode('academico')}
                        className={`py-1.5 rounded text-xs font-medium cursor-pointer ${
                          summaryMode === 'academico'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500'
                        }`}
                      >
                        Académico
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryMode('sencillo')}
                        className={`py-1.5 rounded text-xs font-medium cursor-pointer ${
                          summaryMode === 'sencillo'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500'
                        }`}
                      >
                        Sencillo
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Enfoque opcional
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      value={customFocus}
                      onChange={(e) => setCustomFocus(e.target.value)}
                      placeholder="Ej. Ejemplos clínicos o fórmulas"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={summarizing || !currentEntry.activeSources?.length}
                  onClick={() =>
                    void runSummarizeSources(
                      currentEntry.activeSources || [],
                      summaryStyle,
                      summaryMode,
                      true
                    )
                  }
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                >
                  {summarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {summarizing ? 'Regenerando resumen...' : 'Regenerar resumen con este formato'}
                </button>
              </div>
            </div>
          )}

          {currentEntry.kind === 'compare' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Evaluación comparativa · {currentEntry.comparisonItems?.length || 0} fuentes analizadas
                    </p>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Elegí la mejor fuente para guardar como apunte
                    </h3>
                  </div>
                </div>

                {currentEntry.comparisonVerdict && (
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    <span className="font-semibold text-sky-700 dark:text-sky-300 block mb-0.5">
                      Conclusión comparativa
                    </span>
                    {currentEntry.comparisonVerdict}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    maxLength={200}
                    value={compareCriteria}
                    onChange={(e) => setCompareCriteria(e.target.value)}
                    placeholder="Criterio prioritario (ej. rigor científico, ejemplos prácticos)..."
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={comparing || !currentEntry.activeSources?.length}
                    onClick={() => void runCompareSources(currentEntry.activeSources || [], '', true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                    Reevaluar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {(currentEntry.comparisonItems || []).map((item, idx) => {
                  const isChosen = currentEntry.chosenSourceUrl === item.url;
                  const isProcessingThis = choosingUrl === item.url;
                  return (
                    <div
                      key={item.url}
                      className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                        item.isRecommended
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-bold text-slate-500 dark:text-slate-400">
                              #{idx + 1}
                            </span>
                            <span className="font-medium text-sky-700 dark:text-sky-400 truncate">
                              {item.domain}
                            </span>
                            {item.isRecommended && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                                <Award className="w-3.5 h-3.5" />
                                Mejor fuente recomendada
                              </span>
                            )}
                          </div>
                          <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            {item.title}
                          </h4>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-display text-base font-bold tabular-nums text-slate-900 dark:text-white">
                            {item.score}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">/100</span>
                        </div>
                      </div>

                      {item.summaryPreview && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.summaryPreview}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Ideal para: </span>
                        {item.bestFor}
                      </div>

                      {(item.strengths.length > 0 || item.weaknesses.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {item.strengths.length > 0 && (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                                Fortalezas
                              </p>
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                                {item.strengths.map((st, sIdx) => (
                                  <li key={sIdx}>{st}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.weaknesses.length > 0 && (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-amber-700 dark:text-amber-400">
                                Limitaciones
                              </p>
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                                {item.weaknesses.map((wk, wIdx) => (
                                  <li key={wIdx}>{wk}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={Boolean(choosingUrl) || summarizing}
                          onClick={() => void handleChooseAndSaveAsNote(item)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 ${
                            isChosen
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : item.isRecommended
                              ? 'bg-sky-600 hover:bg-sky-700'
                              : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
                          }`}
                        >
                          {isProcessingThis ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isChosen ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <FilePlus2 className="w-3.5 h-3.5" />
                          )}
                          {isProcessingThis
                            ? 'Creando apunte...'
                            : isChosen
                            ? 'Elegida y guardada en Apuntes'
                            : 'Elegir y guardar como apunte'}
                        </button>

                        <button
                          type="button"
                          disabled={Boolean(choosingUrl) || summarizing}
                          onClick={() =>
                            void runSummarizeSources([
                              { title: item.title, url: item.url, domain: item.domain },
                            ])
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          Abrir resumen
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Sitio
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Printable Summary & Multi-Format Export Sheet */}
        <section
          className={`lg:col-span-6 space-y-3 ${
            mobilePane === 'summary' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Multi-Format Export & Print Toolbar */}
          <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Guardar e imprimir en múltiples formatos
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Materia: {activeSubjectName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={!printableMarkdown}
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>

              <button
                type="button"
                disabled={!printableMarkdown}
                onClick={() =>
                  exportMarkdownToPdf({
                    title: printableTitle,
                    subjectName: activeSubjectName,
                    sourceUrls: printableSources,
                    markdown: printableMarkdown,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>

              <button
                type="button"
                disabled={!printableMarkdown}
                onClick={() =>
                  void exportMarkdownToWord({
                    title: printableTitle,
                    subjectName: activeSubjectName,
                    sourceUrls: printableSources,
                    markdown: printableMarkdown,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                Word (.docx)
              </button>

              <button
                type="button"
                disabled={!printableMarkdown}
                onClick={() =>
                  exportMarkdownToHtmlPrint({
                    title: printableTitle,
                    subjectName: activeSubjectName,
                    sourceUrls: printableSources,
                    markdown: printableMarkdown,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                HTML imprimible
              </button>

              <button
                type="button"
                disabled={!printableMarkdown}
                onClick={() =>
                  exportMarkdownToText({
                    title: printableTitle,
                    subjectName: activeSubjectName,
                    sourceUrls: printableSources,
                    markdown: printableMarkdown,
                    format: 'md',
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                .MD
              </button>

              <button
                type="button"
                disabled={!printableMarkdown}
                onClick={() =>
                  exportMarkdownToText({
                    title: printableTitle,
                    subjectName: activeSubjectName,
                    sourceUrls: printableSources,
                    markdown: printableMarkdown,
                    format: 'txt',
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                .TXT
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={!printableMarkdown || savingTarget !== null}
                onClick={() => void handleSaveToNotes()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                {savingTarget === 'note' ? 'Guardando...' : 'Guardar en Apuntes'}
              </button>

              <button
                type="button"
                disabled={!printableMarkdown || savingTarget !== null}
                onClick={() => void handleSaveToLibrary()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {savingTarget === 'library' ? 'Guardando...' : 'Guardar en Biblioteca'}
              </button>

              {printableMarkdown && (
                <>
                  <button
                    type="button"
                    onClick={() => setReadingModeOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Modo Lectura IA
                  </button>
                  <AudioReadAloudControl
                    getText={() => printableMarkdown}
                    title={printableTitle || 'resumen-fabro'}
                  />
                  <a
                    href={
                      buildWhatsAppShareHref(
                        formatForWhatsApp({
                          title: printableTitle || 'Resumen de fuentes',
                          subtitle: activeSubjectName,
                          body: printableMarkdown,
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
          </div>

          {/* Printable Sheet */}
          <article className="fabro-print-sheet rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-7 min-h-[380px]">
            {!printableMarkdown ? (
              <div className="py-16 text-center space-y-2.5">
                <BookmarkCheck className="w-9 h-9 text-slate-400 mx-auto" />
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Hoja de resumen lista para imprimir
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Buscá un tema o abrí una URL en el navegador para ver aquí su resumen maquetado y descargarlo en PDF, Word, HTML, Markdown o TXT.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    FABRO · Materia: {activeSubjectName}
                    {currentEntry?.providerUsed ? ` · ${currentEntry.providerUsed}` : ''} ·{' '}
                    {new Date().toLocaleDateString('es-AR')}
                  </p>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    {printableTitle}
                  </h3>
                </div>

                {selectedMedia && !failedMediaIds[selectedMedia.id] && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2">
                    <img
                      src={selectedMedia.fullUrl || selectedMedia.thumbUrl}
                      alt={selectedMedia.title}
                      referrerPolicy="no-referrer"
                      className="max-h-72 w-full object-contain rounded-lg mx-auto"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        {[selectedMedia.sourceName, selectedMedia.author, selectedMedia.license]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => void runExplainSelectedMedia(selectedMedia)}
                        disabled={explainingMediaId === selectedMedia.id}
                        className="inline-flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        {currentEntry?.selectedMediaAiMarkdown
                          ? 'Regenerar análisis Multi-IA'
                          : 'Generar análisis Multi-IA'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="fabro-markdown text-sm text-slate-800 dark:text-slate-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{printableMarkdown}</ReactMarkdown>
                </div>

                {printableSources.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <h4 className="font-display text-xs font-bold text-slate-700 dark:text-slate-300">
                      Enlaces verificados
                    </h4>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {printableSources.map((s) => (
                        <li key={s.url} className="break-all">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {s.title || s.domain}:
                          </span>{' '}
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            {s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </article>
        </section>
      </div>

      <AIReadingModeModal
        isOpen={readingModeOpen}
        onClose={() => setReadingModeOpen(false)}
        title={printableTitle || 'Lectura de fuentes'}
        subjectName={activeSubjectName}
        contentText={printableMarkdown}
      />

      <WikiMediaLightbox
        isOpen={lightboxIdx !== null && Boolean(currentEntry?.mediaItems?.length)}
        items={currentEntry?.mediaItems || []}
        initialIndex={lightboxIdx ?? 0}
        onClose={() => setLightboxIdx(null)}
        defaultSubjectId={subjectId}
        defaultSubjectName={activeSubjectName}
      />
    </div>
  );
};
