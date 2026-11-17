import type { PortalModuleId } from '../types/fabro';

export type BrowserRuntimePlatform = 'web' | 'electron_windows' | 'android_native';

export type TabModality = 'integrado' | 'externo' | 'externo_abierto' | 'pdf_local';

export interface BrowserPlatformCapabilities {
  platform: BrowserRuntimePlatform;
  engineName: string;
  supportsNativeTabs: boolean;
  supportsWebContentsView: boolean;
  supportsAndroidWebView: boolean;
  supportsChromeCustomTabs: boolean;
  supportsIsolatedSessions: boolean;
  supportsNativeDownloads: boolean;
}

export interface BrowserProfile {
  id: string;
  name: string;
  partitionKey: string;
  accentColor: string;
  createdAt: string;
}

export interface BrowserTab {
  id: string;
  portalId: string;
  title: string;
  url: string;
  iconName: string;
  isLoading: boolean;
  errorMessage: string;
  modality: TabModality;
  openedExternallyAt?: string;
  profileId: string;
  historyStack: string[];
  historyIndex: number;
  zoomPercent: number;
  readerMode: boolean;
  pdfDataUrl?: string;
  pdfFileName?: string;
  iframeAllowed: boolean | null;
  requiresExternal: boolean;
  statusMessage?: string;
}

export interface BrowserFavoriteFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface BrowserFavoriteEntry {
  id: string;
  portalId?: string;
  title: string;
  url: string;
  folderId: string;
  categoryName: string;
  iconName: string;
  createdAt: string;
}

export interface BrowserHistoryEntry {
  id: string;
  portalId?: string;
  title: string;
  url: string;
  module: PortalModuleId;
  modality: TabModality;
  visitedAt: string;
}

export type DownloadStatus = 'completed' | 'in_progress' | 'paused' | 'cancelled' | 'blocked';

export interface BrowserDownloadItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  status: DownloadStatus;
  progressPercent: number;
  bytesReceived: number;
  totalBytes: number;
  startedAt: string;
  safetyNote?: string;
  localObjectUrl?: string;
}

export type DefaultSearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'scholar';

export interface SitePermissionRecord {
  origin: string;
  camera: 'ask' | 'allow' | 'deny';
  microphone: 'ask' | 'allow' | 'deny';
  geolocation: 'ask' | 'allow' | 'deny';
  popups: 'block' | 'allow';
  downloads: 'ask' | 'allow' | 'deny';
}

export interface BrowserSettings {
  defaultSearchEngine: DefaultSearchEngineId;
  homePageUrl: string;
  homePageLabel: string;
  showSidebar: boolean;
  enableAiAssistant: boolean;
  blockDangerousDownloads: boolean;
  blockUnauthorizedPopups: boolean;
  httpsOnlyWarning: boolean;
  discardInactiveMinutes: number;
  syncFavoritesEnabled: boolean;
  preferredNativeAuthExternal: boolean;
}

export interface SafeUrlValidation {
  valid: boolean;
  normalizedUrl: string;
  hostname: string;
  isHttps: boolean;
  securityLabel: 'HTTPS Seguro' | 'HTTP Sin Cifrado' | 'Archivo Local PDF' | 'URL Inválida';
  reason?: string;
}
