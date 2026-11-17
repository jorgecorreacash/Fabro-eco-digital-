import {
  BaseWindow,
  WebContentsView,
  dialog,
  session,
  shell,
  type DownloadItem,
  type Rectangle,
} from 'electron';
import {
  buildUntrustedPortalWebPreferences,
  evaluatePermissionRequest,
  isDangerousDownloadFilename,
  sanitizePartitionKey,
  validateExternalNavigationUrl,
} from './security';

interface ManagedPortalTab {
  tabId: string;
  partitionKey: string;
  view: WebContentsView;
}

export class FabroTabManager {
  private readonly hostWindow: BaseWindow;
  private readonly shellView: WebContentsView;
  private readonly tabs = new Map<string, ManagedPortalTab>();
  private readonly configuredPartitions = new Set<string>();
  private readonly sitePermissions: Record<string, Record<string, boolean>> = {};
  private activeTabId: string | null = null;
  private viewportBounds: Rectangle = { x: 260, y: 120, width: 1020, height: 680 };

  constructor(hostWindow: BaseWindow, shellView: WebContentsView) {
    this.hostWindow = hostWindow;
    this.shellView = shellView;
  }

  public setViewportBounds(bounds: Rectangle): void {
    this.viewportBounds = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(200, Math.round(bounds.width)),
      height: Math.max(200, Math.round(bounds.height)),
    };
    if (this.activeTabId) {
      const current = this.tabs.get(this.activeTabId);
      current?.view.setBounds(this.viewportBounds);
    }
  }

  private ensureSessionConfigured(partitionKey: string): Electron.Session {
    const cleanPartition = partitionKey.startsWith('persist:')
      ? partitionKey
      : sanitizePartitionKey(partitionKey);
    const ses = session.fromPartition(cleanPartition);

    if (this.configuredPartitions.has(cleanPartition)) {
      return ses;
    }
    this.configuredPartitions.add(cleanPartition);

    // Granular per-origin permission handling (camera, mic, geolocation)
    ses.setPermissionRequestHandler(async (webContents, permission, callback) => {
      let origin = 'unknown';
      try {
        origin = new URL(webContents.getURL()).origin;
      } catch {
        callback(false);
        return;
      }

      if (evaluatePermissionRequest(origin, permission, this.sitePermissions)) {
        callback(true);
        return;
      }

      if (permission === 'media' || permission === 'geolocation' || permission === 'clipboard-read') {
        const res = await dialog.showMessageBox(this.hostWindow, {
          type: 'question',
          buttons: ['Bloquear', 'Permitir una vez', 'Permitir siempre para este sitio'],
          defaultId: 0,
          cancelId: 0,
          title: 'Permiso del sitio en FABRO Browser',
          message: `El sitio ${origin} solicita acceso a: ${permission}`,
        });
        if (res.response === 2) {
          this.sitePermissions[origin] = {
            ...(this.sitePermissions[origin] || {}),
            [permission]: true,
          };
          callback(true);
          return;
        }
        callback(res.response === 1);
        return;
      }

      callback(false);
    });

    // Safe Download Manager with dangerous executable blocking
    ses.on('will-download', (_event, item: DownloadItem) => {
      const filename = item.getFilename();
      const url = item.getURL();
      const dlId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      if (isDangerousDownloadFilename(filename)) {
        item.cancel();
        this.emitToShell('fabro:download-updated', {
          id: dlId,
          filename,
          url,
          status: 'blocked',
          receivedBytes: 0,
          totalBytes: item.getTotalBytes(),
          safetyNote: 'Bloqueado por seguridad: archivo ejecutable potencialmente peligroso.',
        });
        return;
      }

      item.on('updated', () => {
        this.emitToShell('fabro:download-updated', {
          id: dlId,
          filename,
          url,
          status: 'in_progress',
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
        });
      });

      item.once('done', (_e, state) => {
        this.emitToShell('fabro:download-updated', {
          id: dlId,
          filename,
          url,
          status: state === 'completed' ? 'completed' : 'cancelled',
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
        });
      });
    });

    return ses;
  }

  public async openTab(tabId: string, rawUrl: string, partitionKey: string): Promise<boolean> {
    const check = validateExternalNavigationUrl(rawUrl);
    if (!check.valid) return false;

    const cleanPartition = partitionKey.startsWith('persist:')
      ? partitionKey
      : sanitizePartitionKey(partitionKey);
    this.ensureSessionConfigured(cleanPartition);

    if (this.tabs.has(tabId)) {
      this.switchTab(tabId);
      return this.navigate(tabId, check.normalizedUrl);
    }

    const portalView = new WebContentsView({
      webPreferences: buildUntrustedPortalWebPreferences(cleanPartition),
    });

    const wc = portalView.webContents;

    // Prevent malicious popups; open legitimate user-triggered target=_blank links inside safe flow or system browser
    wc.setWindowOpenHandler(({ url }) => {
      const targetCheck = validateExternalNavigationUrl(url);
      if (!targetCheck.valid) return { action: 'deny' };
      void shell.openExternal(targetCheck.normalizedUrl);
      return { action: 'deny' };
    });

    // Reject invalid TLS certificates explicitly instead of bypassing security
    wc.on('certificate-error', (event, url, error, _cert, callback) => {
      event.preventDefault();
      callback(false);
      this.emitToShell('fabro:tab-updated', {
        tabId,
        url,
        isLoading: false,
        tlsError: `Certificado TLS inválido (${error}). Conexión bloqueada por seguridad.`,
      });
    });

    const syncState = (isLoading?: boolean) => {
      this.emitToShell('fabro:tab-updated', {
        tabId,
        url: wc.getURL(),
        title: wc.getTitle(),
        isLoading: typeof isLoading === 'boolean' ? isLoading : wc.isLoading(),
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      });
    };

    wc.on('did-start-loading', () => syncState(true));
    wc.on('did-stop-loading', () => syncState(false));
    wc.on('page-title-updated', () => syncState());
    wc.on('did-navigate', () => syncState());
    wc.on('did-navigate-in-page', () => syncState());

    this.tabs.set(tabId, { tabId, partitionKey: cleanPartition, view: portalView });
    this.switchTab(tabId);
    await wc.loadURL(check.normalizedUrl);
    return true;
  }

  public switchTab(tabId: string): void {
    if (this.activeTabId && this.activeTabId !== tabId) {
      const prev = this.tabs.get(this.activeTabId);
      if (prev) {
        this.hostWindow.contentView.removeChildView(prev.view);
      }
    }
    this.activeTabId = tabId;
    const next = this.tabs.get(tabId);
    if (next) {
      this.hostWindow.contentView.addChildView(next.view);
      next.view.setBounds(this.viewportBounds);
    }
  }

  public closeTab(tabId: string): void {
    const entry = this.tabs.get(tabId);
    if (!entry) return;
    if (this.activeTabId === tabId) {
      this.hostWindow.contentView.removeChildView(entry.view);
      this.activeTabId = null;
    }
    entry.view.webContents.close();
    this.tabs.delete(tabId);
  }

  public async navigate(tabId: string, rawUrl: string): Promise<boolean> {
    const check = validateExternalNavigationUrl(rawUrl);
    const entry = this.tabs.get(tabId);
    if (!check.valid || !entry) return false;
    await entry.view.webContents.loadURL(check.normalizedUrl);
    return true;
  }

  public goBack(tabId: string): void {
    const wc = this.tabs.get(tabId)?.view.webContents;
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  }

  public goForward(tabId: string): void {
    const wc = this.tabs.get(tabId)?.view.webContents;
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  }

  public reload(tabId: string): void {
    this.tabs.get(tabId)?.view.webContents.reload();
  }

  public setZoom(tabId: string, zoomPercent: number): void {
    const wc = this.tabs.get(tabId)?.view.webContents;
    if (!wc) return;
    const clamped = Math.max(0.5, Math.min(2.0, zoomPercent / 100));
    wc.setZoomFactor(clamped);
  }

  public findInPage(tabId: string, query: string): void {
    const wc = this.tabs.get(tabId)?.view.webContents;
    if (!wc) return;
    if (!query.trim()) wc.stopFindInPage('clearSelection');
    else wc.findInPage(query.trim());
  }

  public printTab(tabId: string): void {
    const wc = this.tabs.get(tabId)?.view.webContents;
    wc?.print({ silent: false, printBackground: true });
  }

  public async clearProfileData(partitionKey: string): Promise<void> {
    const clean = partitionKey.startsWith('persist:')
      ? partitionKey
      : sanitizePartitionKey(partitionKey);
    const ses = session.fromPartition(clean);
    await ses.clearStorageData();
    await ses.clearCache();
  }

  private emitToShell(channel: string, payload: unknown): void {
    if (!this.shellView.webContents.isDestroyed()) {
      this.shellView.webContents.send(channel, payload);
    }
  }
}
