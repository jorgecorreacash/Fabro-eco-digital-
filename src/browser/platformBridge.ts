import type {
  BrowserPlatformCapabilities,
  BrowserSettings,
  DefaultSearchEngineId,
  SafeUrlValidation,
} from './types';

interface ElectronBridgeApi {
  platform?: 'win32' | 'darwin' | 'linux';
  openTab?: (tabId: string, url: string, partition: string) => Promise<{ ok: boolean }>;
  switchTab?: (tabId: string) => Promise<{ ok: boolean }>;
  closeTab?: (tabId: string) => Promise<{ ok: boolean }>;
  navigate?: (tabId: string, url: string) => Promise<{ ok: boolean }>;
  goBack?: (tabId: string) => Promise<{ ok: boolean }>;
  goForward?: (tabId: string) => Promise<{ ok: boolean }>;
  reload?: (tabId: string) => Promise<{ ok: boolean }>;
  openSystemBrowser?: (url: string) => Promise<{ ok: boolean }>;
  clearProfileData?: (partition: string) => Promise<{ ok: boolean }>;
}

interface AndroidBridgeApi {
  openCustomTab?: (url: string) => void;
  openInWebView?: (tabId: string, url: string, profileId: string) => void;
  clearProfileCookies?: (profileId: string) => void;
}

declare global {
  interface Window {
    fabroElectronBridge?: ElectronBridgeApi;
    FabroAndroidBridge?: AndroidBridgeApi;
  }
}

export const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.ps1',
  '.psm1',
  '.hta',
  '.apk',
  '.dll',
  '.reg',
];

export const SEARCH_ENGINE_TEMPLATES: Record<
  DefaultSearchEngineId,
  { name: string; baseUrl: string; queryPrefix: string }
> = {
  google: {
    name: 'Google',
    baseUrl: 'https://www.google.com/',
    queryPrefix: 'https://www.google.com/search?q=',
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    baseUrl: 'https://duckduckgo.com/',
    queryPrefix: 'https://duckduckgo.com/?q=',
  },
  bing: {
    name: 'Bing',
    baseUrl: 'https://www.bing.com/',
    queryPrefix: 'https://www.bing.com/search?q=',
  },
  scholar: {
    name: 'Google Académico',
    baseUrl: 'https://scholar.google.com/',
    queryPrefix: 'https://scholar.google.com/scholar?q=',
  },
};

export const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  defaultSearchEngine: 'google',
  homePageUrl: 'https://www.wikipedia.org/',
  homePageLabel: 'Wikipedia (Inicio)',
  showSidebar: true,
  enableAiAssistant: true,
  blockDangerousDownloads: true,
  blockUnauthorizedPopups: true,
  httpsOnlyWarning: true,
  discardInactiveMinutes: 30,
  syncFavoritesEnabled: true,
  preferredNativeAuthExternal: true,
};

export function detectPlatformCapabilities(): BrowserPlatformCapabilities {
  if (typeof window !== 'undefined' && window.fabroElectronBridge) {
    return {
      platform: 'electron_windows',
      engineName: 'Chromium WebContentsView (Electron)',
      supportsNativeTabs: true,
      supportsWebContentsView: true,
      supportsAndroidWebView: false,
      supportsChromeCustomTabs: false,
      supportsIsolatedSessions: true,
      supportsNativeDownloads: true,
    };
  }

  if (typeof window !== 'undefined' && window.FabroAndroidBridge) {
    return {
      platform: 'android_native',
      engineName: 'Android WebView + Chrome Custom Tabs',
      supportsNativeTabs: true,
      supportsWebContentsView: false,
      supportsAndroidWebView: true,
      supportsChromeCustomTabs: true,
      supportsIsolatedSessions: true,
      supportsNativeDownloads: true,
    };
  }

  return {
    platform: 'web',
    engineName: 'FABRO Web (Integrado selectivo + Apertura externa)',
    supportsNativeTabs: false,
    supportsWebContentsView: false,
    supportsAndroidWebView: false,
    supportsChromeCustomTabs: false,
    supportsIsolatedSessions: false,
    supportsNativeDownloads: false,
  };
}

export function validateSafeNavigationUrl(rawInput: string): SafeUrlValidation {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      hostname: '',
      isHttps: false,
      securityLabel: 'URL Inválida',
      reason: 'Ingresá una dirección web o término de búsqueda.',
    };
  }

  if (trimmed.startsWith('blob:') && trimmed.includes(window?.location?.origin || '')) {
    return {
      valid: true,
      normalizedUrl: trimmed,
      hostname: 'local-pdf',
      isHttps: true,
      securityLabel: 'Archivo Local PDF',
    };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return {
      valid: false,
      normalizedUrl: '',
      hostname: '',
      isHttps: false,
      securityLabel: 'URL Inválida',
      reason: 'Esquema bloqueado por política de seguridad.',
    };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        normalizedUrl: '',
        hostname: '',
        isHttps: false,
        securityLabel: 'URL Inválida',
        reason: 'Solo se admiten direcciones HTTP o HTTPS.',
      };
    }

    const host = parsed.hostname.toLowerCase();
    const isPrivateIp =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);

    if (isPrivateIp) {
      return {
        valid: false,
        normalizedUrl: '',
        hostname: host,
        isHttps: false,
        securityLabel: 'URL Inválida',
        reason: 'Por seguridad no se permite navegar a direcciones locales o de red privada.',
      };
    }

    const isHttps = parsed.protocol === 'https:';
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      hostname: host,
      isHttps,
      securityLabel: isHttps ? 'HTTPS Seguro' : 'HTTP Sin Cifrado',
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      hostname: '',
      isHttps: false,
      securityLabel: 'URL Inválida',
      reason: 'La dirección ingresada no tiene un formato válido.',
    };
  }
}

export function resolveOmniboxInput(
  rawInput: string,
  searchEngine: DefaultSearchEngineId
): { isSearch: boolean; validation: SafeUrlValidation } {
  const trimmed = rawInput.trim();
  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    (!/\s/.test(trimmed) && /\.[a-z]{2,}(\/|$|\?)/i.test(trimmed));

  if (looksLikeUrl) {
    return { isSearch: false, validation: validateSafeNavigationUrl(trimmed) };
  }

  const template = SEARCH_ENGINE_TEMPLATES[searchEngine] || SEARCH_ENGINE_TEMPLATES.google;
  const searchUrl = `${template.queryPrefix}${encodeURIComponent(trimmed)}`;
  return { isSearch: true, validation: validateSafeNavigationUrl(searchUrl) };
}

export function isDangerousDownloadFile(filenameOrUrl: string): boolean {
  const lower = String(filenameOrUrl || '').toLowerCase().split('?')[0].split('#')[0];
  return DANGEROUS_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isPdfResource(url: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('pdf')) return true;
  const clean = String(url || '').toLowerCase().split('?')[0].split('#')[0];
  return clean.endsWith('.pdf');
}

export function getTranslateServiceUrl(url: string, targetLang = 'es'): string {
  return `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(targetLang)}&u=${encodeURIComponent(url)}`;
}
