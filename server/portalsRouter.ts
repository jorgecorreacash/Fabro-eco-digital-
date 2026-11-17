import crypto from 'crypto';
import express, { type Response } from 'express';
import {
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from './authMiddleware.ts';
import {
  applyUserShortcutAction,
  deleteAdminPortal,
  deleteIncompatibleAdminPortals,
  getPortalById,
  getPortalsSnapshot,
  markPortalExternalOnlyAdmin,
  removeExternalOnlyRuleAdmin,
  reorderAdminPortal,
  saveUserPortalPreferences,
  updateAdminHomeConfig,
  updatePortalProbeResult,
  upsertAdminCategory,
  upsertAdminPortal,
  type PortalCompatibilityStatus,
  type PortalModuleId,
  type PortalOpeningMode,
} from './portalsStore.ts';

function isPublicHttpsUrl(rawUrl: string): { valid: boolean; parsed?: URL; error?: string } {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'La URL debe usar protocolo http:// o https://' };
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return { valid: false, error: 'Por seguridad no se permiten direcciones locales o privadas.' };
    }
    return { valid: true, parsed };
  } catch {
    return { valid: false, error: 'URL inválida.' };
  }
}

export interface LiveProbeOutcome {
  url: string;
  compatibilityStatus: PortalCompatibilityStatus;
  openingMode: PortalOpeningMode;
  iframeAllowed: boolean;
  requiresExternal: boolean;
  httpStatus?: number;
  xFrameOptions?: string;
  cspFrameAncestors?: string;
  authRestrictionNote?: string;
  statusMessage: string;
  lastTestedAt: string;
}

const KNOWN_AUTH_SANDBOX_DOMAINS = [
  'chatgpt.com',
  'chat.openai.com',
  'gemini.google.com',
  'accounts.google.com',
  'claude.ai',
  'chat.qwen.ai',
  'chat.deepseek.com',
  'chat.mistral.ai',
  'copilot.microsoft.com',
  'grok.com',
  'www.meta.ai',
  'meta.ai',
  'github.com',
  'www.reddit.com',
  'reddit.com',
  'www.coursera.org',
  'coursera.org',
  'www.edx.org',
  'edx.org',
];

export function evaluateFrameHeaders(params: {
  url: string;
  httpStatus: number;
  xFrameOptions: string;
  csp: string;
}): LiveProbeOutcome {
  const xfo = (params.xFrameOptions || '').trim();
  const csp = (params.csp || '').trim();
  const nowIso = new Date().toISOString();

  let frameAncestors = '';
  const faMatch = csp.match(/frame-ancestors\s+([^;,]+)/i);
  if (faMatch) {
    frameAncestors = faMatch[1].trim();
  }

  const xfoLower = xfo.toLowerCase();
  const faLower = frameAncestors.toLowerCase();

  const blockedByXfo =
    xfoLower.includes('deny') ||
    xfoLower.includes('sameorigin') ||
    xfoLower.includes('allow-from');
  const blockedByCsp =
    Boolean(faLower) &&
    !faLower.includes('*') &&
    (faLower.includes("'none'") ||
      faLower.includes("'self'") ||
      !faLower.includes('https:'));

  let hostname = '';
  try {
    hostname = new URL(params.url).hostname.toLowerCase();
  } catch {
    hostname = '';
  }

  const hasAuthCookieWarning = KNOWN_AUTH_SANDBOX_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );

  if (blockedByXfo || blockedByCsp) {
    const reasonParts: string[] = [];
    if (blockedByXfo) reasonParts.push(`X-Frame-Options: ${xfo}`);
    if (blockedByCsp) reasonParts.push(`CSP frame-ancestors: ${frameAncestors}`);

    return {
      url: params.url,
      compatibilityStatus: 'external_required',
      openingMode: 'apertura_externa',
      iframeAllowed: false,
      requiresExternal: true,
      httpStatus: params.httpStatus,
      xFrameOptions: xfo || undefined,
      cspFrameAncestors: frameAncestors || undefined,
      authRestrictionNote: hasAuthCookieWarning
        ? 'El proveedor bloquea iframes o exige inicio de sesión en ventana propia por cookies de terceros.'
        : undefined,
      statusMessage: `Bloquea iframe (${reasonParts.join(' · ')}). Requiere apertura externa.`,
      lastTestedAt: nowIso,
    };
  }

  if (params.httpStatus === 403 || params.httpStatus === 401 || params.httpStatus >= 500) {
    return {
      url: params.url,
      compatibilityStatus: hasAuthCookieWarning ? 'external_required' : 'auth_warning',
      openingMode: hasAuthCookieWarning ? 'apertura_externa' : 'iframe_integrado',
      iframeAllowed: !hasAuthCookieWarning,
      requiresExternal: hasAuthCookieWarning,
      httpStatus: params.httpStatus,
      xFrameOptions: xfo || undefined,
      cspFrameAncestors: frameAncestors || undefined,
      authRestrictionNote: `El sitio respondió HTTP ${params.httpStatus} ante verificación automatizada (puede requerir navegador completo o protección antibot).`,
      statusMessage: `HTTP ${params.httpStatus}${hasAuthCookieWarning ? ' · Recomendado abrir en pestaña externa.' : ' · Verificable en visor.'}`,
      lastTestedAt: nowIso,
    };
  }

  return {
    url: params.url,
    compatibilityStatus: hasAuthCookieWarning ? 'auth_warning' : 'iframe_compatible',
    openingMode: 'iframe_integrado',
    iframeAllowed: true,
    requiresExternal: false,
    httpStatus: params.httpStatus,
    xFrameOptions: xfo || undefined,
    cspFrameAncestors: frameAncestors || undefined,
    authRestrictionNote: hasAuthCookieWarning
      ? 'Permite cargar sin cabecera X-Frame-Options restrictiva, aunque el inicio de sesión puede requerir cookies de terceros o abrir en pestaña externa.'
      : undefined,
    statusMessage: `Compatible con iframe (HTTP ${params.httpStatus}, sin X-Frame-Options/CSP restrictivo).`,
    lastTestedAt: nowIso,
  };
}

export async function probeExternalPortalHeaders(url: string): Promise<LiveProbeOutcome> {
  const check = isPublicHttpsUrl(url);
  if (!check.valid) {
    return {
      url,
      compatibilityStatus: 'unreachable',
      openingMode: 'apertura_externa',
      iframeAllowed: false,
      requiresExternal: true,
      statusMessage: check.error || 'URL inválida.',
      lastTestedAt: new Date().toISOString(),
    };
  }

  const doFetch = async (method: 'HEAD' | 'GET') =>
    fetch(url, {
      method,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FABRO-Educational-Verifier/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(7000),
    });

  try {
    let resp = await doFetch('HEAD');
    if (resp.status === 405 || resp.status === 501) {
      resp = await doFetch('GET');
    }
    const xfo = resp.headers.get('x-frame-options') || '';
    const csp = resp.headers.get('content-security-policy') || '';
    // Cancel body stream immediately so we never proxy/consume remote content
    try {
      await resp.body?.cancel();
    } catch {
      // ignore cancel errors
    }

    return evaluateFrameHeaders({
      url,
      httpStatus: resp.status,
      xFrameOptions: xfo,
      csp,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red o tiempo de espera agotado';
    return {
      url,
      compatibilityStatus: 'unreachable',
      openingMode: 'apertura_externa',
      iframeAllowed: false,
      requiresExternal: true,
      statusMessage: `No se pudo verificar cabecera en tiempo real (${msg}). Probá apertura externa.`,
      lastTestedAt: new Date().toISOString(),
    };
  }
}

export function createPortalsRouter(): express.Router {
  const router = express.Router();

  // List portals for Explorer or AI Browser (optional auth adds user preferences)
  router.get('/:module(explorer|ai-browser)', (req: AuthenticatedRequest, res: Response) => {
    const module = req.params.module as PortalModuleId;
    const includeInactive = req.query.includeInactive === 'true';
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim() : undefined;
    res.json(getPortalsSnapshot(module, uid, includeInactive));
  });

  // Authenticated snapshot with full per-user preferences
  router.get('/me/:module(explorer|ai-browser)', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const module = req.params.module as PortalModuleId;
    const includeInactive = Boolean(req.authUser?.isAdmin) && req.query.includeInactive === 'true';
    res.json(getPortalsSnapshot(module, req.authUser!.uid, includeInactive));
  });

  // Real HTTP header probe for a single portal (NEVER proxies or strips headers)
  router.post('/probe', async (req, res: Response) => {
    const { portalId, url } = req.body ?? {};
    let targetUrl = typeof url === 'string' ? url.trim() : '';
    let existingPortal = null;

    if (typeof portalId === 'string' && portalId.trim()) {
      existingPortal = getPortalById(portalId.trim());
      if (existingPortal) {
        targetUrl = existingPortal.url;
      }
    }

    if (!targetUrl) {
      res.status(400).json({ error: 'Indicá un portalId o URL válida para verificar.' });
      return;
    }

    const outcome = await probeExternalPortalHeaders(targetUrl);
    if (existingPortal) {
      await updatePortalProbeResult(existingPortal.id, outcome);
    }
    res.json({ probe: outcome, portalId: existingPortal?.id || null });
  });

  // Batch probe all portals of a module (Admin only)
  router.post('/admin/probe-all', requireAuth, requireAdmin, async (req, res: Response) => {
    const module = (req.body?.module === 'ai-browser' ? 'ai-browser' : 'explorer') as PortalModuleId;
    const snap = getPortalsSnapshot(module, undefined, true);
    const queue = [...snap.portals];
    const results: Array<{ id: string; name: string; outcome: LiveProbeOutcome }> = [];

    const concurrency = 6;
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const outcome = await probeExternalPortalHeaders(item.url);
        await updatePortalProbeResult(item.id, outcome);
        results.push({ id: item.id, name: item.name, outcome });
      }
    });
    await Promise.all(workers);

    res.json({
      module,
      testedCount: results.length,
      snapshot: getPortalsSnapshot(module, undefined, true),
      results,
    });
  });

  // Admin: Create or rename category
  router.post('/admin/categories', requireAuth, requireAdmin, async (req, res: Response) => {
    const { id, module, name, order } = req.body ?? {};
    if ((module !== 'explorer' && module !== 'ai-browser') || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Indicá módulo válido y nombre de categoría.' });
      return;
    }
    const category = await upsertAdminCategory({
      id: typeof id === 'string' ? id : undefined,
      module,
      name,
      order: typeof order === 'number' ? order : undefined,
    });
    res.json({ category });
  });

  // Admin: Create or edit portal
  router.post('/admin/items', requireAuth, requireAdmin, async (req, res: Response) => {
    const { id, module, name, url, categoryId, iconName, description, active, order } = req.body ?? {};
    if ((module !== 'explorer' && module !== 'ai-browser') || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Indicá módulo y nombre válido para el portal.' });
      return;
    }
    const check = isPublicHttpsUrl(String(url || ''));
    if (!check.valid) {
      res.status(400).json({ error: check.error || 'URL de portal inválida.' });
      return;
    }
    const portal = await upsertAdminPortal({
      id: typeof id === 'string' ? id : undefined,
      module,
      name,
      url: String(url),
      categoryId: typeof categoryId === 'string' ? categoryId : '',
      iconName: typeof iconName === 'string' ? iconName : undefined,
      description: typeof description === 'string' ? description : undefined,
      active: typeof active === 'boolean' ? active : undefined,
      order: typeof order === 'number' ? order : undefined,
    });
    res.json({ portal });
  });

  // Admin: Reorder portal
  router.patch('/admin/items/reorder', requireAuth, requireAdmin, async (req, res: Response) => {
    const { module, id, direction } = req.body ?? {};
    if (
      (module !== 'explorer' && module !== 'ai-browser') ||
      typeof id !== 'string' ||
      (direction !== 'up' && direction !== 'down')
    ) {
      res.status(400).json({ error: 'Parámetros inválidos para reordenar.' });
      return;
    }
    const portals = await reorderAdminPortal(module, id, direction);
    res.json({ portals });
  });

  // Admin: Delete portal
  router.delete('/admin/items/:module/:id', requireAuth, requireAdmin, async (req, res: Response) => {
    const module = req.params.module === 'ai-browser' ? 'ai-browser' : 'explorer';
    const ok = await deleteAdminPortal(module, String(req.params.id || ''));
    if (!ok) {
      res.status(404).json({ error: 'Portal no encontrado.' });
      return;
    }
    res.json({ ok: true });
  });

  // Admin: Bulk delete portals that cannot open in the same web app window (iframe blocked / unreachable)
  router.delete('/admin/incompatible/:module', requireAuth, requireAdmin, async (req, res: Response) => {
    const module: PortalModuleId = req.params.module === 'ai-browser' ? 'ai-browser' : 'explorer';
    const result = await deleteIncompatibleAdminPortals(module);
    res.json({ ok: true, ...result });
  });

  // Admin: Mark a portal for exclusive external opening and optionally remove its shortcut
  router.patch('/admin/items/:module/:id/external-only', requireAuth, requireAdmin, async (req, res: Response) => {
    const module: PortalModuleId = req.params.module === 'ai-browser' ? 'ai-browser' : 'explorer';
    const id = String(req.params.id || '').trim();
    const removeShortcut = Boolean(req.body?.removeShortcut);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const result = await markPortalExternalOnlyAdmin(module, id, { removeShortcut, reason });
    if (!result.portal) {
      res.status(404).json({ error: 'Portal no encontrado.' });
      return;
    }
    res.json({ ok: true, ...result });
  });

  // Admin: Remove a recorded external-only domain rule
  router.delete('/admin/external-rules/:module', requireAuth, requireAdmin, async (req, res: Response) => {
    const module: PortalModuleId = req.params.module === 'ai-browser' ? 'ai-browser' : 'explorer';
    const url = typeof req.body?.url === 'string' ? req.body.url : typeof req.query.url === 'string' ? req.query.url : undefined;
    const portalId = typeof req.body?.portalId === 'string' ? req.body.portalId : typeof req.query.portalId === 'string' ? req.query.portalId : undefined;
    const rules = await removeExternalOnlyRuleAdmin(module, { url, portalId });
    res.json({ ok: true, externalOnlyRules: rules });
  });

  // Admin: Configure module home page & start pages
  router.post('/admin/home-config', requireAuth, requireAdmin, async (req, res: Response) => {
    const { module, homeUrl, homeTitle, defaultPortalId, startPages } = req.body ?? {};
    if (module !== 'explorer' && module !== 'ai-browser') {
      res.status(400).json({ error: 'Módulo inválido.' });
      return;
    }
    const homeCheck = isPublicHttpsUrl(String(homeUrl || ''));
    if (!homeCheck.valid) {
      res.status(400).json({ error: homeCheck.error || 'URL de página de inicio inválida.' });
      return;
    }
    const validPages: Array<{ title: string; url: string; portalId?: string }> = [];
    if (Array.isArray(startPages)) {
      for (const sp of startPages.slice(0, 8)) {
        const spCheck = isPublicHttpsUrl(String(sp?.url || ''));
        if (!spCheck.valid) {
          res.status(400).json({ error: spCheck.error || `URL inválida en página inicial: ${sp?.url}` });
          return;
        }
        validPages.push({
          title: String(sp?.title || spCheck.parsed?.hostname || 'Inicio').trim(),
          url: String(sp.url).trim(),
          portalId: typeof sp?.portalId === 'string' && sp.portalId.trim() ? sp.portalId.trim() : undefined,
        });
      }
    }
    const homeConfig = await updateAdminHomeConfig(module, {
      homeUrl: String(homeUrl),
      homeTitle: typeof homeTitle === 'string' ? homeTitle : homeCheck.parsed?.hostname || 'Inicio',
      defaultPortalId: typeof defaultPortalId === 'string' ? defaultPortalId : undefined,
      startPages: validPages,
    });
    res.json({ homeConfig });
  });

  // Student personal favorites, custom links & history
  router.post('/me/favorites', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const portalId = String(req.body?.portalId || '').trim();
    if (!portalId) {
      res.status(400).json({ error: 'Falta portalId.' });
      return;
    }
    const prefs = await saveUserPortalPreferences(req.authUser!.uid, (prev) => {
      const exists = prev.favoritePortalIds.includes(portalId);
      return {
        ...prev,
        favoritePortalIds: exists
          ? prev.favoritePortalIds.filter((x) => x !== portalId)
          : [portalId, ...prev.favoritePortalIds],
      };
    });
    res.json({ favoritePortalIds: prefs.favoritePortalIds });
  });

  router.post('/me/custom', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { module, name, url, description } = req.body ?? {};
    if ((module !== 'explorer' && module !== 'ai-browser') || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Indicá módulo y nombre.' });
      return;
    }
    const check = isPublicHttpsUrl(String(url || ''));
    if (!check.valid) {
      res.status(400).json({ error: check.error || 'URL inválida.' });
      return;
    }
    const entryId = `my_${crypto.randomBytes(5).toString('hex')}`;
    const prefs = await saveUserPortalPreferences(req.authUser!.uid, (prev) => ({
      ...prev,
      favoritePortalIds: [entryId, ...prev.favoritePortalIds],
      customPortals: [
        {
          id: entryId,
          module,
          name: name.trim().slice(0, 70),
          url: String(url).trim().slice(0, 500),
          categoryId: 'mis_favoritos',
          categoryName: 'Mis portales propios',
          iconName: 'Star',
          description: (description || 'Portal agregado por el estudiante').toString().slice(0, 180),
          order: 999,
          active: true,
          isSystem: false,
          compatibilityStatus: 'untested',
          openingMode: 'iframe_integrado',
          iframeAllowed: null,
          requiresExternal: false,
          statusMessage: 'Agregado por vos · verificable al abrir.',
          lastTestedAt: '',
        },
        ...prev.customPortals,
      ],
    }));
    res.json({ userPrefs: prefs });
  });

  router.delete('/me/custom/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const targetId = String(req.params.id || '');
    const prefs = await saveUserPortalPreferences(req.authUser!.uid, (prev) => ({
      ...prev,
      favoritePortalIds: prev.favoritePortalIds.filter((f) => f !== targetId),
      customPortals: prev.customPortals.filter((p) => p.id !== targetId),
    }));
    res.json({ userPrefs: prefs });
  });

  // User Shortcut Administration: remove broken-iframe shortcuts & mark for exclusive external opening
  router.post('/me/shortcuts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { action, module, portalId, url, name, reason, clearExternalOnly } = req.body ?? {};
    const validActions = new Set([
      'mark_external_only',
      'remove_shortcut_external',
      'remove_incompatible_shortcuts',
      'restore_shortcut',
      'unmark_external_only',
    ]);
    if (
      (module !== 'explorer' && module !== 'ai-browser') ||
      typeof action !== 'string' ||
      !validActions.has(action)
    ) {
      res.status(400).json({ error: 'Acción o módulo inválido.' });
      return;
    }
    if (typeof url === 'string' && url.trim()) {
      const check = isPublicHttpsUrl(url);
      if (!check.valid) {
        res.status(400).json({ error: check.error || 'URL inválida.' });
        return;
      }
    }
    const userPrefs = await applyUserShortcutAction(req.authUser!.uid, {
      action: action as
        | 'mark_external_only'
        | 'remove_shortcut_external'
        | 'remove_incompatible_shortcuts'
        | 'restore_shortcut'
        | 'unmark_external_only',
      module,
      portalId: typeof portalId === 'string' ? portalId.trim() : undefined,
      url: typeof url === 'string' ? url.trim() : undefined,
      name: typeof name === 'string' ? name.trim() : undefined,
      reason: typeof reason === 'string' ? reason.trim() : undefined,
      clearExternalOnly: Boolean(clearExternalOnly),
    });
    res.json({ ok: true, userPrefs });
  });

  router.post('/me/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { portalId, name, url, module } = req.body ?? {};
    if (!portalId || !url || (module !== 'explorer' && module !== 'ai-browser')) {
      res.status(400).json({ error: 'Datos de historial inválidos.' });
      return;
    }
    const prefs = await saveUserPortalPreferences(req.authUser!.uid, (prev) => ({
      ...prev,
      history: [
        {
          portalId: String(portalId),
          name: String(name || url).slice(0, 80),
          url: String(url).slice(0, 500),
          module,
          visitedAt: new Date().toISOString(),
        },
        ...prev.history.filter((h) => h.portalId !== portalId || h.module !== module),
      ].slice(0, 50),
    }));
    res.json({ history: prefs.history });
  });

  return router;
}
