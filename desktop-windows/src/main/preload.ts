import { contextBridge, ipcRenderer } from 'electron';

export interface NativeTabStateEvent {
  tabId: string;
  url?: string;
  title?: string;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  tlsError?: string;
}

export interface NativeDownloadEvent {
  id: string;
  filename: string;
  url: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'blocked';
  receivedBytes: number;
  totalBytes: number;
  safetyNote?: string;
}

contextBridge.exposeInMainWorld('fabroElectronBridge', {
  platform: 'electron_windows' as const,
  openTab: (tabId: string, url: string, partitionKey: string) =>
    ipcRenderer.invoke('fabro:open-tab', { tabId, url, partitionKey }),
  switchTab: (tabId: string) => ipcRenderer.invoke('fabro:switch-tab', { tabId }),
  closeTab: (tabId: string) => ipcRenderer.invoke('fabro:close-tab', { tabId }),
  navigate: (tabId: string, url: string) =>
    ipcRenderer.invoke('fabro:navigate', { tabId, url }),
  goBack: (tabId: string) => ipcRenderer.invoke('fabro:back', { tabId }),
  goForward: (tabId: string) => ipcRenderer.invoke('fabro:forward', { tabId }),
  reload: (tabId: string) => ipcRenderer.invoke('fabro:reload', { tabId }),
  setZoom: (tabId: string, zoomPercent: number) =>
    ipcRenderer.invoke('fabro:zoom', { tabId, zoomPercent }),
  findInPage: (tabId: string, query: string) =>
    ipcRenderer.invoke('fabro:find', { tabId, query }),
  printTab: (tabId: string) => ipcRenderer.invoke('fabro:print', { tabId }),
  clearProfileData: (partitionKey: string) =>
    ipcRenderer.invoke('fabro:clear-profile', { partitionKey }),
  openSystemBrowser: (url: string) =>
    ipcRenderer.invoke('fabro:open-system-browser', { url }),
  setViewportBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('fabro:set-viewport-bounds', bounds),
  onTabUpdated: (cb: (event: NativeTabStateEvent) => void) => {
    const listener = (_: unknown, payload: NativeTabStateEvent) => cb(payload);
    ipcRenderer.on('fabro:tab-updated', listener);
    return () => ipcRenderer.removeListener('fabro:tab-updated', listener);
  },
  onDownloadUpdated: (cb: (event: NativeDownloadEvent) => void) => {
    const listener = (_: unknown, payload: NativeDownloadEvent) => cb(payload);
    ipcRenderer.on('fabro:download-updated', listener);
    return () => ipcRenderer.removeListener('fabro:download-updated', listener);
  },
});
