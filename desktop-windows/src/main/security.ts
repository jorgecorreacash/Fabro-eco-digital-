import type { WebPreferences } from 'electron';

export const DANGEROUS_DOWNLOAD_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.scr',
  '.pif',
  '.com',
  '.hta',
  '.reg',
];

const PRIVATE_HOST_REGEX =
  /^(localhost|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\])/i;

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  hostname: string;
  isHttps: boolean;
  reason?: string;
}

export function validateExternalNavigationUrl(rawUrl: string): UrlValidationResult {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, normalizedUrl: '', hostname: '', isHttps: false, reason: 'URL vacía' };
  }

  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/i.test(trimmed);
  const candidate = hasExplicitScheme ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        normalizedUrl: '',
        hostname: '',
        isHttps: false,
        reason: `Protocolo bloqueado: ${parsed.protocol}`,
      };
    }

    if (PRIVATE_HOST_REGEX.test(parsed.hostname)) {
      return {
        valid: false,
        normalizedUrl: '',
        hostname: parsed.hostname,
        isHttps: false,
        reason: 'Navegación bloqueada hacia direcciones locales o privadas.',
      };
    }

    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      hostname: parsed.hostname,
      isHttps: parsed.protocol === 'https:',
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      hostname: '',
      isHttps: false,
      reason: 'Formato de URL inválido.',
    };
  }
}

export function isDangerousDownloadFilename(filename: string): boolean {
  const lower = (filename || '').trim().toLowerCase();
  return DANGEROUS_DOWNLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function sanitizePartitionKey(profileId: string): string {
  const clean = (profileId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `persist:fabro_profile_${clean}`;
}

/**
 * Hardened WebPreferences for EVERY external portal WebContentsView.
 * Never grants Node integration, disables sandbox, or injects preloads into third-party sites.
 */
export function buildUntrustedPortalWebPreferences(partitionKey: string): WebPreferences {
  return {
    partition: partitionKey,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webgl: true,
    plugins: false,
    navigateOnDragDrop: false,
    spellcheck: true,
  };
}

/**
 * Hardened WebPreferences for the trusted FABRO UI Shell View ONLY.
 */
export function buildTrustedShellWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
  };
}

export const SUPPORTED_WEB_PERMISSIONS = new Set<string>([
  'media',
  'geolocation',
  'clipboard-read',
  'clipboard-sanitized-write',
  'fullscreen',
]);

export function evaluatePermissionRequest(
  origin: string,
  permission: string,
  allowList: Record<string, Record<string, boolean>>
): boolean {
  if (!SUPPORTED_WEB_PERMISSIONS.has(permission)) {
    return false;
  }
  const siteRules = allowList[origin];
  if (!siteRules) {
    return permission === 'fullscreen' || permission === 'clipboard-sanitized-write';
  }
  return siteRules[permission] === true;
}
