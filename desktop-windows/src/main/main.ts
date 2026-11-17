import path from 'node:path';
import { app, BaseWindow, WebContentsView, ipcMain, shell } from 'electron';
import {
  buildTrustedShellWebPreferences,
  validateExternalNavigationUrl,
} from './security';
import { FabroTabManager } from './tabManager';

const FABRO_SHELL_URL = process.env.FABRO_APP_URL || 'http://localhost:3000';

let mainWindow: BaseWindow | null = null;
let tabManager: FabroTabManager | null = null;

function createMainWindow(): void {
  mainWindow = new BaseWindow({
    width: 1400,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: 'FABRO Browser · Escritorio Windows',
    backgroundColor: '#090D16',
  });

  const preloadPath = path.join(__dirname, 'preload.js');
  const shellView = new WebContentsView({
    webPreferences: buildTrustedShellWebPreferences(preloadPath),
  });

  mainWindow.contentView.addChildView(shellView);

  const resizeShell = () => {
    if (!mainWindow) return;
    const [w, h] = mainWindow.getContentSize();
    shellView.setBounds({ x: 0, y: 0, width: w, height: h });
  };
  resizeShell();
  mainWindow.on('resize', resizeShell);

  tabManager = new FabroTabManager(mainWindow, shellView);

  // Security: restrict navigation inside the trusted FABRO shell itself
  shellView.webContents.setWindowOpenHandler(({ url }) => {
    const check = validateExternalNavigationUrl(url);
    if (check.valid) void shell.openExternal(check.normalizedUrl);
    return { action: 'deny' };
  });

  void shellView.webContents.loadURL(FABRO_SHELL_URL);
}

function registerIpcHandlers(): void {
  ipcMain.handle('fabro:open-tab', (_e, args: { tabId: string; url: string; partitionKey: string }) =>
    tabManager?.openTab(args.tabId, args.url, args.partitionKey)
  );
  ipcMain.handle('fabro:switch-tab', (_e, args: { tabId: string }) =>
    tabManager?.switchTab(args.tabId)
  );
  ipcMain.handle('fabro:close-tab', (_e, args: { tabId: string }) =>
    tabManager?.closeTab(args.tabId)
  );
  ipcMain.handle('fabro:navigate', (_e, args: { tabId: string; url: string }) =>
    tabManager?.navigate(args.tabId, args.url)
  );
  ipcMain.handle('fabro:back', (_e, args: { tabId: string }) =>
    tabManager?.goBack(args.tabId)
  );
  ipcMain.handle('fabro:forward', (_e, args: { tabId: string }) =>
    tabManager?.goForward(args.tabId)
  );
  ipcMain.handle('fabro:reload', (_e, args: { tabId: string }) =>
    tabManager?.reload(args.tabId)
  );
  ipcMain.handle('fabro:zoom', (_e, args: { tabId: string; zoomPercent: number }) =>
    tabManager?.setZoom(args.tabId, args.zoomPercent)
  );
  ipcMain.handle('fabro:find', (_e, args: { tabId: string; query: string }) =>
    tabManager?.findInPage(args.tabId, args.query)
  );
  ipcMain.handle('fabro:print', (_e, args: { tabId: string }) =>
    tabManager?.printTab(args.tabId)
  );
  ipcMain.handle('fabro:clear-profile', (_e, args: { partitionKey: string }) =>
    tabManager?.clearProfileData(args.partitionKey)
  );
  ipcMain.handle('fabro:set-viewport-bounds', (_e, bounds) =>
    tabManager?.setViewportBounds(bounds)
  );
  ipcMain.handle('fabro:open-system-browser', async (_e, args: { url: string }) => {
    const check = validateExternalNavigationUrl(args.url);
    if (!check.valid) return false;
    await shell.openExternal(check.normalizedUrl);
    return true;
  });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.whenReady().then(() => {
    registerIpcHandlers();
    createMainWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
