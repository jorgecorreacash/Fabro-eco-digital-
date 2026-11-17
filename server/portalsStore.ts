import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type PortalModuleId = 'explorer' | 'ai-browser';

export type PortalCompatibilityStatus =
  | 'untested'
  | 'iframe_compatible'
  | 'external_required'
  | 'auth_warning'
  | 'unreachable';

export type PortalOpeningMode = 'iframe_integrado' | 'apertura_externa';

export interface PortalCategoryRecord {
  id: string;
  module: PortalModuleId;
  name: string;
  order: number;
}

export interface PortalEntryRecord {
  id: string;
  module: PortalModuleId;
  name: string;
  url: string;
  categoryId: string;
  categoryName: string;
  iconName: string;
  description: string;
  order: number;
  active: boolean;
  isSystem: boolean;
  // Real live compatibility telemetry (never pre-marked integrated without probe)
  compatibilityStatus: PortalCompatibilityStatus;
  openingMode: PortalOpeningMode;
  iframeAllowed: boolean | null;
  requiresExternal: boolean;
  httpStatus?: number;
  xFrameOptions?: string;
  cspFrameAncestors?: string;
  authRestrictionNote?: string;
  statusMessage: string;
  lastTestedAt: string;
}

export interface ExternalOnlyRule {
  module: PortalModuleId;
  portalId?: string;
  name: string;
  url: string;
  hostname: string;
  reason: string;
  markedAt: string;
}

export interface UserPortalPreferences {
  favoritePortalIds: string[];
  customPortals: PortalEntryRecord[];
  history: Array<{
    portalId: string;
    name: string;
    url: string;
    module: PortalModuleId;
    visitedAt: string;
  }>;
  hiddenPortalIds: string[];
  externalOnlyPortalIds: string[];
  externalOnlyRules: ExternalOnlyRule[];
}

export interface ModuleStartPage {
  title: string;
  url: string;
  portalId?: string;
}

export interface ModuleHomeConfig {
  homeUrl: string;
  homeTitle: string;
  defaultPortalId?: string;
  startPages: ModuleStartPage[];
  updatedAt: string;
}

interface PersistedPortalsStore {
  categories: PortalCategoryRecord[];
  portals: PortalEntryRecord[];
  userPrefs: Record<string, UserPortalPreferences>;
  homeConfigs: Record<PortalModuleId, ModuleHomeConfig>;
  externalOnlyRules: ExternalOnlyRule[];
}

const DEFAULT_EXPLORER_CATEGORIES: PortalCategoryRecord[] = [
  { id: 'exp_cat_ia', module: 'explorer', name: 'Inteligencia Artificial', order: 1 },
  { id: 'exp_cat_search', module: 'explorer', name: 'Buscadores', order: 2 },
  { id: 'exp_cat_academic', module: 'explorer', name: 'Investigación Académica', order: 3 },
  { id: 'exp_cat_edu', module: 'explorer', name: 'Educación y Conocimiento', order: 4 },
  { id: 'exp_cat_comm', module: 'explorer', name: 'Comunidades y Recursos', order: 5 },
  { id: 'exp_cat_arg', module: 'explorer', name: 'Argentina', order: 6 },
];

const DEFAULT_AI_CATEGORIES: PortalCategoryRecord[] = [
  { id: 'ai_cat_general', module: 'ai-browser', name: 'Inteligencias Artificiales', order: 1 },
];

function makePortal(
  id: string,
  module: PortalModuleId,
  name: string,
  url: string,
  categoryId: string,
  categoryName: string,
  iconName: string,
  description: string,
  order: number
): PortalEntryRecord {
  return {
    id,
    module,
    name,
    url,
    categoryId,
    categoryName,
    iconName,
    description,
    order,
    active: true,
    isSystem: true,
    compatibilityStatus: 'untested',
    openingMode: 'iframe_integrado',
    iframeAllowed: null,
    requiresExternal: false,
    statusMessage: 'Pendiente de verificación de compatibilidad iframe.',
    lastTestedAt: '',
  };
}

export const INITIAL_EXPLORER_PORTALS: PortalEntryRecord[] = [
  // INTELIGENCIA ARTIFICIAL
  makePortal('exp_chatgpt', 'explorer', 'ChatGPT', 'https://chatgpt.com/', 'exp_cat_ia', 'Inteligencia Artificial', 'Bot', 'Portal oficial de OpenAI ChatGPT.', 1),
  makePortal('exp_gemini', 'explorer', 'Gemini', 'https://gemini.google.com/', 'exp_cat_ia', 'Inteligencia Artificial', 'Sparkles', 'Asistente de IA oficial de Google.', 2),

  // BUSCADORES
  makePortal('exp_google', 'explorer', 'Google', 'https://www.google.com/', 'exp_cat_search', 'Buscadores', 'Globe', 'Buscador web general Google.', 3),
  makePortal('exp_bing', 'explorer', 'Bing', 'https://www.bing.com/', 'exp_cat_search', 'Buscadores', 'Search', 'Buscador web de Microsoft Bing.', 4),
  makePortal('exp_duckduckgo', 'explorer', 'DuckDuckGo', 'https://duckduckgo.com/', 'exp_cat_search', 'Buscadores', 'Shield', 'Buscador web enfocado en privacidad.', 5),
  makePortal('exp_brave', 'explorer', 'Brave Search', 'https://search.brave.com/', 'exp_cat_search', 'Buscadores', 'Compass', 'Motor de búsqueda independiente Brave Search.', 6),

  // INVESTIGACIÓN ACADÉMICA
  makePortal('exp_scholar', 'explorer', 'Google Académico', 'https://scholar.google.com/', 'exp_cat_academic', 'Investigación Académica', 'GraduationCap', 'Buscador de literatura científica y académica.', 7),
  makePortal('exp_semantic', 'explorer', 'Semantic Scholar', 'https://www.semanticscholar.org/', 'exp_cat_academic', 'Investigación Académica', 'Microscope', 'Buscador científico semántico de AllenAI.', 8),
  makePortal('exp_core', 'explorer', 'CORE', 'https://core.ac.uk/', 'exp_cat_academic', 'Investigación Académica', 'Database', 'Agregador mundial de artículos en acceso abierto.', 9),
  makePortal('exp_base', 'explorer', 'BASE', 'https://www.base-search.net/', 'exp_cat_academic', 'Investigación Académica', 'BookOpen', 'Bielefeld Academic Search Engine.', 10),
  makePortal('exp_openalex', 'explorer', 'OpenAlex', 'https://openalex.org/', 'exp_cat_academic', 'Investigación Académica', 'Library', 'Catálogo abierto de trabajos académicos y autores.', 11),
  makePortal('exp_scielo', 'explorer', 'SciELO', 'https://scielo.org/', 'exp_cat_academic', 'Investigación Académica', 'BookMarked', 'Biblioteca científica electrónica en línea.', 12),
  makePortal('exp_redalyc', 'explorer', 'Redalyc', 'https://www.redalyc.org/', 'exp_cat_academic', 'Investigación Académica', 'FileText', 'Red de revistas científicas de acceso abierto.', 13),
  makePortal('exp_doaj', 'explorer', 'DOAJ', 'https://doaj.org/', 'exp_cat_academic', 'Investigación Académica', 'BookOpen', 'Directory of Open Access Journals.', 14),
  makePortal('exp_pubmed', 'explorer', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/', 'exp_cat_academic', 'Investigación Académica', 'Microscope', 'Base biomédica y de ciencias de la salud NIH.', 15),
  makePortal('exp_arxiv', 'explorer', 'arXiv', 'https://arxiv.org/', 'exp_cat_academic', 'Investigación Académica', 'FileText', 'Archivo de preprints científicos Cornell.', 16),

  // EDUCACIÓN Y CONOCIMIENTO
  makePortal('exp_wikipedia', 'explorer', 'Wikipedia', 'https://www.wikipedia.org/', 'exp_cat_edu', 'Educación y Conocimiento', 'BookOpen', 'Enciclopedia libre multilingüe.', 17),
  makePortal('exp_archive', 'explorer', 'Internet Archive', 'https://archive.org/', 'exp_cat_edu', 'Educación y Conocimiento', 'Library', 'Biblioteca digital histórica y libros libres.', 18),
  makePortal('exp_gutenberg', 'explorer', 'Project Gutenberg', 'https://www.gutenberg.org/', 'exp_cat_edu', 'Educación y Conocimiento', 'BookMarked', 'Colección de libros electrónicos de dominio público.', 19),
  makePortal('exp_ted', 'explorer', 'TED', 'https://www.ted.com/', 'exp_cat_edu', 'Educación y Conocimiento', 'Video', 'Charlas educativas y divulgación científica.', 20),
  makePortal('exp_coursera', 'explorer', 'Coursera', 'https://www.coursera.org/', 'exp_cat_edu', 'Educación y Conocimiento', 'Award', 'Plataforma de cursos universitarios en línea.', 21),
  makePortal('exp_edx', 'explorer', 'edX', 'https://www.edx.org/', 'exp_cat_edu', 'Educación y Conocimiento', 'GraduationCap', 'Cursos abiertos universitarios edX.', 22),
  makePortal('exp_khan', 'explorer', 'Khan Academy', 'https://www.khanacademy.org/', 'exp_cat_edu', 'Educación y Conocimiento', 'Award', 'Educación gratuita en matemática, ciencias y humanidades.', 23),

  // COMUNIDADES Y RECURSOS
  makePortal('exp_reddit', 'explorer', 'Reddit', 'https://www.reddit.com/', 'exp_cat_comm', 'Comunidades y Recursos', 'MessageSquare', 'Foros y comunidades temáticas globales.', 24),
  makePortal('exp_stackoverflow', 'explorer', 'Stack Overflow', 'https://stackoverflow.com/', 'exp_cat_comm', 'Comunidades y Recursos', 'Code2', 'Comunidad técnica de preguntas y respuestas de programación.', 25),
  makePortal('exp_stackexchange', 'explorer', 'Stack Exchange', 'https://stackexchange.com/', 'exp_cat_comm', 'Comunidades y Recursos', 'Users', 'Red de comunidades académicas y técnicas Q&A.', 26),
  makePortal('exp_quora', 'explorer', 'Quora', 'https://www.quora.com/', 'exp_cat_comm', 'Comunidades y Recursos', 'HelpCircle', 'Plataforma de preguntas y respuestas.', 27),
  makePortal('exp_pinterest', 'explorer', 'Pinterest', 'https://www.pinterest.com/', 'exp_cat_comm', 'Comunidades y Recursos', 'Image', 'Tableros visuales, infografías y diseño.', 28),
  makePortal('exp_github', 'explorer', 'GitHub', 'https://github.com/', 'exp_cat_comm', 'Comunidades y Recursos', 'Code2', 'Repositorios de código abierto y documentación.', 29),

  // ARGENTINA
  makePortal('exp_arg_gob', 'explorer', 'Argentina.gob.ar', 'https://www.argentina.gob.ar/', 'exp_cat_arg', 'Argentina', 'Landmark', 'Portal oficial del Estado Nacional Argentino.', 30),
  makePortal('exp_infoleg', 'explorer', 'Infoleg', 'https://www.argentina.gob.ar/normativa', 'exp_cat_arg', 'Argentina', 'Scale', 'Información legislativa y normativa argentina.', 31),
  makePortal('exp_saij', 'explorer', 'SAIJ', 'https://www.saij.gob.ar/', 'exp_cat_arg', 'Argentina', 'Scale', 'Sistema Argentino de Información Jurídica.', 32),
  makePortal('exp_boletin', 'explorer', 'Boletín Oficial', 'https://www.boletinoficial.gob.ar/', 'exp_cat_arg', 'Argentina', 'FileText', 'Boletín Oficial de la República Argentina.', 33),
  makePortal('exp_indec', 'explorer', 'INDEC', 'https://www.indec.gob.ar/', 'exp_cat_arg', 'Argentina', 'BarChart3', 'Instituto Nacional de Estadística y Censos.', 34),
  makePortal('exp_conicet', 'explorer', 'CONICET', 'https://www.conicet.gob.ar/', 'exp_cat_arg', 'Argentina', 'Microscope', 'Consejo Nacional de Investigaciones Científicas y Técnicas.', 35),
  makePortal('exp_sedici', 'explorer', 'SEDICI UNLP', 'https://sedici.unlp.edu.ar/', 'exp_cat_arg', 'Argentina', 'Library', 'Repositorio institucional de la Universidad Nacional de La Plata.', 36),
];

export const INITIAL_AI_BROWSER_PORTALS: PortalEntryRecord[] = [
  makePortal('ai_chatgpt', 'ai-browser', 'ChatGPT', 'https://chatgpt.com/', 'ai_cat_general', 'Inteligencias Artificiales', 'Bot', 'Portal web oficial de OpenAI ChatGPT.', 1),
  makePortal('ai_gemini', 'ai-browser', 'Gemini', 'https://gemini.google.com/', 'ai_cat_general', 'Inteligencias Artificiales', 'Sparkles', 'Portal web oficial de Google Gemini.', 2),
];

let storePath = path.join(process.cwd(), 'server', 'data', 'portals-store.json');
let cachedStore: PersistedPortalsStore | null = null;
let writeChain: Promise<void> = Promise.resolve();

function buildDefaultHomeConfigs(): Record<PortalModuleId, ModuleHomeConfig> {
  return {
    explorer: {
      homeUrl: 'https://www.wikipedia.org/',
      homeTitle: 'Wikipedia',
      defaultPortalId: 'exp_wikipedia',
      startPages: [
        {
          title: 'Wikipedia',
          url: 'https://www.wikipedia.org/',
          portalId: 'exp_wikipedia',
        },
      ],
      updatedAt: '',
    },
    'ai-browser': {
      homeUrl: 'https://chatgpt.com/',
      homeTitle: 'ChatGPT',
      defaultPortalId: 'ai_chatgpt',
      startPages: [],
      updatedAt: '',
    },
  };
}

function buildDefaultStore(): PersistedPortalsStore {
  return {
    categories: [...DEFAULT_EXPLORER_CATEGORIES, ...DEFAULT_AI_CATEGORIES],
    portals: [...INITIAL_EXPLORER_PORTALS, ...INITIAL_AI_BROWSER_PORTALS],
    userPrefs: {},
    homeConfigs: buildDefaultHomeConfigs(),
    externalOnlyRules: [],
  };
}

function normalizeUserPrefs(raw?: Partial<UserPortalPreferences>): UserPortalPreferences {
  return {
    favoritePortalIds: Array.isArray(raw?.favoritePortalIds) ? raw.favoritePortalIds : [],
    customPortals: Array.isArray(raw?.customPortals) ? raw.customPortals : [],
    history: Array.isArray(raw?.history) ? raw.history : [],
    hiddenPortalIds: Array.isArray(raw?.hiddenPortalIds) ? raw.hiddenPortalIds : [],
    externalOnlyPortalIds: Array.isArray(raw?.externalOnlyPortalIds) ? raw.externalOnlyPortalIds : [],
    externalOnlyRules: Array.isArray(raw?.externalOnlyRules) ? raw.externalOnlyRules : [],
  };
}

function loadPortalsStore(): PersistedPortalsStore {
  if (cachedStore) return cachedStore;
  const defaults = buildDefaultHomeConfigs();
  try {
    if (fs.existsSync(storePath)) {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as Partial<PersistedPortalsStore>;
      if (Array.isArray(parsed.portals) && parsed.portals.length > 0) {
        const normalizedUserPrefs: Record<string, UserPortalPreferences> = {};
        if (parsed.userPrefs && typeof parsed.userPrefs === 'object') {
          for (const [uid, pref] of Object.entries(parsed.userPrefs)) {
            normalizedUserPrefs[uid] = normalizeUserPrefs(pref);
          }
        }
        cachedStore = {
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories
            : [...DEFAULT_EXPLORER_CATEGORIES, ...DEFAULT_AI_CATEGORIES],
          portals: parsed.portals,
          userPrefs: normalizedUserPrefs,
          homeConfigs: {
            explorer: parsed.homeConfigs?.explorer || defaults.explorer,
            'ai-browser': parsed.homeConfigs?.['ai-browser'] || defaults['ai-browser'],
          },
          externalOnlyRules: Array.isArray(parsed.externalOnlyRules) ? parsed.externalOnlyRules : [],
        };
        return cachedStore;
      }
    }
  } catch {
    // ignore corrupt disk read
  }
  cachedStore = buildDefaultStore();
  return cachedStore;
}

async function persistPortalsStore(): Promise<void> {
  const store = loadPortalsStore();
  const snapshot = JSON.stringify(store, null, 2);
  writeChain = writeChain.then(async () => {
    try {
      await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
      await fs.promises.writeFile(storePath, snapshot, { encoding: 'utf8' });
    } catch {
      // keep in memory
    }
  });
  await writeChain;
}

export function getPortalsSnapshot(module: PortalModuleId, uid?: string, includeInactive = false): {
  categories: PortalCategoryRecord[];
  portals: PortalEntryRecord[];
  homeConfig: ModuleHomeConfig;
  externalOnlyRules: ExternalOnlyRule[];
  userPrefs: UserPortalPreferences;
} {
  const store = loadPortalsStore();
  const categories = store.categories
    .filter((c) => c.module === module)
    .sort((a, b) => a.order - b.order);
  const portals = store.portals
    .filter((p) => p.module === module && (includeInactive || p.active))
    .sort((a, b) => a.order - b.order);
  const prefs = normalizeUserPrefs(uid ? store.userPrefs[uid] : undefined);
  const defaults = buildDefaultHomeConfigs();
  return {
    categories,
    portals,
    homeConfig: store.homeConfigs?.[module] || defaults[module],
    externalOnlyRules: (store.externalOnlyRules || []).filter((r) => r.module === module),
    userPrefs: {
      favoritePortalIds: prefs.favoritePortalIds,
      customPortals: prefs.customPortals.filter((p) => p.module === module),
      history: prefs.history.filter((h) => h.module === module),
      hiddenPortalIds: prefs.hiddenPortalIds,
      externalOnlyPortalIds: prefs.externalOnlyPortalIds,
      externalOnlyRules: prefs.externalOnlyRules.filter((r) => r.module === module),
    },
  };
}

export function getPortalById(id: string): PortalEntryRecord | null {
  const store = loadPortalsStore();
  return store.portals.find((p) => p.id === id) || null;
}

export async function updatePortalProbeResult(
  id: string,
  probe: {
    compatibilityStatus: PortalCompatibilityStatus;
    openingMode: PortalOpeningMode;
    iframeAllowed: boolean | null;
    requiresExternal: boolean;
    httpStatus?: number;
    xFrameOptions?: string;
    cspFrameAncestors?: string;
    authRestrictionNote?: string;
    statusMessage: string;
    lastTestedAt: string;
  }
): Promise<PortalEntryRecord | null> {
  const store = loadPortalsStore();
  const target = store.portals.find((p) => p.id === id);
  if (!target) return null;
  Object.assign(target, probe);
  await persistPortalsStore();
  return target;
}

export async function upsertAdminCategory(input: {
  id?: string;
  module: PortalModuleId;
  name: string;
  order?: number;
}): Promise<PortalCategoryRecord> {
  const store = loadPortalsStore();
  const cleanName = input.name.trim().slice(0, 60);
  if (input.id) {
    const existing = store.categories.find((c) => c.id === input.id && c.module === input.module);
    if (existing) {
      existing.name = cleanName;
      if (typeof input.order === 'number') existing.order = input.order;
      for (const p of store.portals) {
        if (p.categoryId === existing.id) p.categoryName = cleanName;
      }
      await persistPortalsStore();
      return existing;
    }
  }
  const maxOrder = store.categories
    .filter((c) => c.module === input.module)
    .reduce((m, c) => Math.max(m, c.order), 0);
  const created: PortalCategoryRecord = {
    id: `cat_${crypto.randomBytes(5).toString('hex')}`,
    module: input.module,
    name: cleanName,
    order: typeof input.order === 'number' ? input.order : maxOrder + 1,
  };
  store.categories.push(created);
  await persistPortalsStore();
  return created;
}

export async function upsertAdminPortal(input: {
  id?: string;
  module: PortalModuleId;
  name: string;
  url: string;
  categoryId: string;
  iconName?: string;
  description?: string;
  active?: boolean;
  order?: number;
}): Promise<PortalEntryRecord> {
  const store = loadPortalsStore();
  const cat =
    store.categories.find((c) => c.id === input.categoryId && c.module === input.module) ||
    store.categories.find((c) => c.module === input.module);
  const cleanName = input.name.trim().slice(0, 80);
  const cleanUrl = input.url.trim().slice(0, 500);
  const cleanDesc = (input.description || '').trim().slice(0, 240);
  const cleanIcon = (input.iconName || 'Globe').trim().slice(0, 40);

  if (input.id) {
    const existing = store.portals.find((p) => p.id === input.id && p.module === input.module);
    if (existing) {
      const urlChanged = existing.url !== cleanUrl;
      existing.name = cleanName;
      existing.url = cleanUrl;
      if (cat) {
        existing.categoryId = cat.id;
        existing.categoryName = cat.name;
      }
      existing.iconName = cleanIcon;
      existing.description = cleanDesc;
      if (typeof input.active === 'boolean') existing.active = input.active;
      if (typeof input.order === 'number') existing.order = input.order;
      if (urlChanged) {
        // Never mark a changed URL as verified until probed again!
        existing.compatibilityStatus = 'untested';
        existing.iframeAllowed = null;
        existing.requiresExternal = false;
        existing.lastTestedAt = '';
        existing.statusMessage = 'URL modificada: pendiente de verificación real.';
      }
      await persistPortalsStore();
      return existing;
    }
  }

  const maxOrder = store.portals
    .filter((p) => p.module === input.module)
    .reduce((m, p) => Math.max(m, p.order), 0);
  const created: PortalEntryRecord = {
    id: `prt_${crypto.randomBytes(6).toString('hex')}`,
    module: input.module,
    name: cleanName,
    url: cleanUrl,
    categoryId: cat?.id || `${input.module}_cat`,
    categoryName: cat?.name || 'General',
    iconName: cleanIcon,
    description: cleanDesc || `Portal ${cleanName}`,
    order: typeof input.order === 'number' ? input.order : maxOrder + 1,
    active: input.active !== false,
    isSystem: false,
    compatibilityStatus: 'untested',
    openingMode: 'iframe_integrado',
    iframeAllowed: null,
    requiresExternal: false,
    statusMessage: 'Portal agregado: pendiente de prueba real de compatibilidad.',
    lastTestedAt: '',
  };
  store.portals.push(created);
  await persistPortalsStore();
  return created;
}

export async function reorderAdminPortal(module: PortalModuleId, id: string, direction: 'up' | 'down'): Promise<PortalEntryRecord[]> {
  const store = loadPortalsStore();
  const list = store.portals
    .filter((p) => p.module === module)
    .sort((a, b) => a.order - b.order);
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return list;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return list;
  const tmpOrder = list[idx].order;
  list[idx].order = list[swapIdx].order;
  list[swapIdx].order = tmpOrder;
  await persistPortalsStore();
  return list.sort((a, b) => a.order - b.order);
}

export async function deleteAdminPortal(module: PortalModuleId, id: string): Promise<boolean> {
  const store = loadPortalsStore();
  const before = store.portals.length;
  store.portals = store.portals.filter((p) => !(p.module === module && p.id === id));
  if (store.portals.length === before) return false;
  const hc = store.homeConfigs?.[module];
  if (hc) {
    hc.startPages = hc.startPages.filter((sp) => sp.portalId !== id);
    if (hc.defaultPortalId === id) {
      hc.defaultPortalId = undefined;
    }
  }
  await persistPortalsStore();
  return true;
}

function extractHostnameSafe(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function upsertRuleList(list: ExternalOnlyRule[], rule: ExternalOnlyRule): ExternalOnlyRule[] {
  const filtered = list.filter(
    (r) =>
      !(
        r.module === rule.module &&
        ((rule.portalId && r.portalId === rule.portalId) ||
          r.url === rule.url ||
          (rule.hostname && r.hostname === rule.hostname))
      )
  );
  return [rule, ...filtered].slice(0, 120);
}

export async function markPortalExternalOnlyAdmin(
  module: PortalModuleId,
  id: string,
  options?: { removeShortcut?: boolean; reason?: string }
): Promise<{ portal: PortalEntryRecord | null; removed: boolean; externalOnlyRules: ExternalOnlyRule[] }> {
  const store = loadPortalsStore();
  const target = store.portals.find((p) => p.module === module && p.id === id) || null;
  if (!target) {
    return { portal: null, removed: false, externalOnlyRules: store.externalOnlyRules || [] };
  }

  const nowIso = new Date().toISOString();
  const reason =
    (options?.reason || '').trim() ||
    'Marcado para apertura externa exclusiva (no carga correctamente mediante iframe).';

  target.compatibilityStatus = 'external_required';
  target.openingMode = 'apertura_externa';
  target.iframeAllowed = false;
  target.requiresExternal = true;
  target.statusMessage = reason;
  target.lastTestedAt = nowIso;

  if (!store.externalOnlyRules) store.externalOnlyRules = [];
  store.externalOnlyRules = upsertRuleList(store.externalOnlyRules, {
    module,
    portalId: target.id,
    name: target.name,
    url: target.url,
    hostname: extractHostnameSafe(target.url),
    reason,
    markedAt: nowIso,
  });

  let removed = false;
  if (options?.removeShortcut) {
    store.portals = store.portals.filter((p) => !(p.module === module && p.id === id));
    const hc = store.homeConfigs?.[module];
    if (hc) {
      hc.startPages = hc.startPages.filter((sp) => sp.portalId !== id);
      if (hc.defaultPortalId === id) {
        const remaining = store.portals.find((p) => p.module === module && p.active);
        hc.defaultPortalId = remaining?.id;
        if (remaining) {
          hc.homeUrl = remaining.url;
          hc.homeTitle = remaining.name;
        }
      }
    }
    removed = true;
  }

  await persistPortalsStore();
  return {
    portal: target,
    removed,
    externalOnlyRules: store.externalOnlyRules.filter((r) => r.module === module),
  };
}

export async function removeExternalOnlyRuleAdmin(
  module: PortalModuleId,
  criteria: { url?: string; portalId?: string; hostname?: string }
): Promise<ExternalOnlyRule[]> {
  const store = loadPortalsStore();
  const targetHost = criteria.hostname || (criteria.url ? extractHostnameSafe(criteria.url) : '');
  store.externalOnlyRules = (store.externalOnlyRules || []).filter((r) => {
    if (r.module !== module) return true;
    if (criteria.portalId && r.portalId === criteria.portalId) return false;
    if (criteria.url && r.url === criteria.url) return false;
    if (targetHost && r.hostname === targetHost) return false;
    return true;
  });
  await persistPortalsStore();
  return store.externalOnlyRules.filter((r) => r.module === module);
}

export async function deleteIncompatibleAdminPortals(module: PortalModuleId): Promise<{
  deletedCount: number;
  deletedNames: string[];
}> {
  const store = loadPortalsStore();
  const toDelete = store.portals.filter(
    (p) =>
      p.module === module &&
      (p.iframeAllowed === false ||
        p.requiresExternal === true ||
        p.compatibilityStatus === 'external_required' ||
        p.compatibilityStatus === 'unreachable')
  );
  if (toDelete.length === 0) {
    return { deletedCount: 0, deletedNames: [] };
  }
  const nowIso = new Date().toISOString();
  if (!store.externalOnlyRules) store.externalOnlyRules = [];
  for (const p of toDelete) {
    store.externalOnlyRules = upsertRuleList(store.externalOnlyRules, {
      module,
      portalId: p.id,
      name: p.name,
      url: p.url,
      hostname: extractHostnameSafe(p.url),
      reason: p.statusMessage || 'Eliminado por no cargar mediante iframe · apertura externa exclusiva.',
      markedAt: nowIso,
    });
  }
  const deleteIds = new Set(toDelete.map((p) => p.id));
  store.portals = store.portals.filter((p) => !deleteIds.has(p.id));
  const hc = store.homeConfigs?.[module];
  if (hc) {
    hc.startPages = hc.startPages.filter((sp) => !sp.portalId || !deleteIds.has(sp.portalId));
    if (hc.defaultPortalId && deleteIds.has(hc.defaultPortalId)) {
      const remaining = store.portals.find((p) => p.module === module && p.active);
      hc.defaultPortalId = remaining?.id;
      if (remaining) {
        hc.homeUrl = remaining.url;
        hc.homeTitle = remaining.name;
      }
    }
  }
  await persistPortalsStore();
  return { deletedCount: toDelete.length, deletedNames: toDelete.map((p) => p.name) };
}

export async function updateAdminHomeConfig(
  module: PortalModuleId,
  input: {
    homeUrl: string;
    homeTitle: string;
    defaultPortalId?: string;
    startPages?: ModuleStartPage[];
  }
): Promise<ModuleHomeConfig> {
  const store = loadPortalsStore();
  const defaults = buildDefaultHomeConfigs();
  if (!store.homeConfigs) {
    store.homeConfigs = defaults;
  }
  const cleanPages = (input.startPages || [])
    .filter((sp) => typeof sp.url === 'string' && sp.url.trim())
    .slice(0, 8)
    .map((sp) => ({
      title: (sp.title || sp.url).trim().slice(0, 80),
      url: sp.url.trim().slice(0, 500),
      portalId: sp.portalId ? String(sp.portalId).trim() : undefined,
    }));

  const updated: ModuleHomeConfig = {
    homeUrl: input.homeUrl.trim().slice(0, 500),
    homeTitle: (input.homeTitle || 'Inicio').trim().slice(0, 80),
    defaultPortalId: input.defaultPortalId ? String(input.defaultPortalId).trim() : undefined,
    startPages: cleanPages,
    updatedAt: new Date().toISOString(),
  };
  store.homeConfigs[module] = updated;
  await persistPortalsStore();
  return updated;
}

export async function saveUserPortalPreferences(
  uid: string,
  updater: (prev: UserPortalPreferences) => UserPortalPreferences
): Promise<UserPortalPreferences> {
  const store = loadPortalsStore();
  const current = normalizeUserPrefs(store.userPrefs[uid]);
  const next = updater(current);
  store.userPrefs[uid] = {
    favoritePortalIds: Array.from(new Set(next.favoritePortalIds || [])).slice(0, 100),
    customPortals: (next.customPortals || []).slice(0, 40),
    history: (next.history || []).slice(0, 80),
    hiddenPortalIds: Array.from(new Set(next.hiddenPortalIds || [])).slice(0, 200),
    externalOnlyPortalIds: Array.from(new Set(next.externalOnlyPortalIds || [])).slice(0, 200),
    externalOnlyRules: (next.externalOnlyRules || []).slice(0, 120),
  };
  await persistPortalsStore();
  return store.userPrefs[uid];
}

export async function applyUserShortcutAction(
  uid: string,
  input: {
    action:
      | 'mark_external_only'
      | 'remove_shortcut_external'
      | 'remove_incompatible_shortcuts'
      | 'restore_shortcut'
      | 'unmark_external_only';
    module: PortalModuleId;
    portalId?: string;
    url?: string;
    name?: string;
    reason?: string;
    clearExternalOnly?: boolean;
  }
): Promise<UserPortalPreferences> {
  const store = loadPortalsStore();
  const nowIso = new Date().toISOString();

  return saveUserPortalPreferences(uid, (prev) => {
    const portalObj = input.portalId
      ? store.portals.find((p) => p.id === input.portalId) ||
        prev.customPortals.find((p) => p.id === input.portalId)
      : undefined;
    const effectiveUrl = (input.url || portalObj?.url || '').trim();
    const effectiveName = (input.name || portalObj?.name || effectiveUrl || 'Portal').trim();
    const effectiveHost = effectiveUrl ? extractHostnameSafe(effectiveUrl) : '';

    if (input.action === 'mark_external_only') {
      const nextRules = effectiveUrl
        ? upsertRuleList(prev.externalOnlyRules, {
            module: input.module,
            portalId: input.portalId,
            name: effectiveName,
            url: effectiveUrl,
            hostname: effectiveHost,
            reason:
              input.reason ||
              'Marcado para apertura externa exclusiva (no carga correctamente mediante iframe).',
            markedAt: nowIso,
          })
        : prev.externalOnlyRules;
      return {
        ...prev,
        externalOnlyPortalIds: input.portalId
          ? [...prev.externalOnlyPortalIds, input.portalId]
          : prev.externalOnlyPortalIds,
        customPortals: prev.customPortals.map((cp) =>
          cp.id === input.portalId
            ? {
                ...cp,
                compatibilityStatus: 'external_required',
                openingMode: 'apertura_externa',
                iframeAllowed: false,
                requiresExternal: true,
                statusMessage: 'Marcado para apertura externa exclusiva.',
                lastTestedAt: nowIso,
              }
            : cp
        ),
        externalOnlyRules: nextRules,
      };
    }

    if (input.action === 'remove_shortcut_external') {
      const nextRules = effectiveUrl
        ? upsertRuleList(prev.externalOnlyRules, {
            module: input.module,
            portalId: input.portalId,
            name: effectiveName,
            url: effectiveUrl,
            hostname: effectiveHost,
            reason:
              input.reason ||
              'Acceso directo eliminado · apertura externa exclusiva por fallo en iframe.',
            markedAt: nowIso,
          })
        : prev.externalOnlyRules;
      const isCustom = Boolean(input.portalId && prev.customPortals.some((c) => c.id === input.portalId));
      return {
        ...prev,
        hiddenPortalIds:
          input.portalId && !isCustom
            ? [...prev.hiddenPortalIds, input.portalId]
            : prev.hiddenPortalIds,
        externalOnlyPortalIds: input.portalId
          ? [...prev.externalOnlyPortalIds, input.portalId]
          : prev.externalOnlyPortalIds,
        customPortals: isCustom
          ? prev.customPortals.filter((c) => c.id !== input.portalId)
          : prev.customPortals,
        favoritePortalIds: isCustom
          ? prev.favoritePortalIds.filter((f) => f !== input.portalId)
          : prev.favoritePortalIds,
        externalOnlyRules: nextRules,
      };
    }

    if (input.action === 'remove_incompatible_shortcuts') {
      const modulePortals = [
        ...store.portals.filter((p) => p.module === input.module && p.active),
        ...prev.customPortals.filter((p) => p.module === input.module),
      ];
      const incompatible = modulePortals.filter(
        (p) =>
          p.iframeAllowed === false ||
          p.requiresExternal === true ||
          p.compatibilityStatus === 'external_required' ||
          p.compatibilityStatus === 'unreachable'
      );
      let nextRules = [...prev.externalOnlyRules];
      const addedHidden: string[] = [];
      const addedExternalIds: string[] = [];
      const removeCustomIds = new Set<string>();
      for (const p of incompatible) {
        addedExternalIds.push(p.id);
        if (p.isSystem) {
          addedHidden.push(p.id);
        } else {
          removeCustomIds.add(p.id);
        }
        nextRules = upsertRuleList(nextRules, {
          module: input.module,
          portalId: p.id,
          name: p.name,
          url: p.url,
          hostname: extractHostnameSafe(p.url),
          reason: p.statusMessage || 'No carga en iframe · apertura externa exclusiva.',
          markedAt: nowIso,
        });
      }
      return {
        ...prev,
        hiddenPortalIds: [...prev.hiddenPortalIds, ...addedHidden],
        externalOnlyPortalIds: [...prev.externalOnlyPortalIds, ...addedExternalIds],
        customPortals: prev.customPortals.filter((c) => !removeCustomIds.has(c.id)),
        externalOnlyRules: nextRules,
      };
    }

    if (input.action === 'restore_shortcut') {
      return {
        ...prev,
        hiddenPortalIds: prev.hiddenPortalIds.filter((id) => id !== input.portalId),
        externalOnlyPortalIds: input.clearExternalOnly
          ? prev.externalOnlyPortalIds.filter((id) => id !== input.portalId)
          : prev.externalOnlyPortalIds,
        externalOnlyRules: input.clearExternalOnly
          ? prev.externalOnlyRules.filter(
              (r) =>
                !(
                  r.module === input.module &&
                  ((input.portalId && r.portalId === input.portalId) ||
                    (effectiveUrl && r.url === effectiveUrl))
                )
            )
          : prev.externalOnlyRules,
      };
    }

    // unmark_external_only
    return {
      ...prev,
      externalOnlyPortalIds: prev.externalOnlyPortalIds.filter((id) => id !== input.portalId),
      externalOnlyRules: prev.externalOnlyRules.filter(
        (r) =>
          !(
            r.module === input.module &&
            ((input.portalId && r.portalId === input.portalId) ||
              (effectiveUrl && r.url === effectiveUrl) ||
              (effectiveHost && r.hostname === effectiveHost))
          )
      ),
    };
  });
}

export function resetPortalsStoreForTests(customPath?: string) {
  if (customPath) {
    storePath = customPath;
  }
  cachedStore = buildDefaultStore();
}
