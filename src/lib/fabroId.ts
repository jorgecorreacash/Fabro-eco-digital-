import type { FabroSectorId, SectorAiPreferencesMap } from '../types/fabro';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function hash32(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Normalizes a custom user-configured FABRO ID (uppercase alphanumeric + hyphens, 3-32 chars).
 * Returns empty string if input does not contain at least 3 alphanumeric characters.
 */
export function normalizeCustomFabroId(raw?: string | null): string {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const alnumCount = cleaned.replace(/-/g, '').length;
  return alnumCount >= 3 ? cleaned : '';
}

/**
 * Returns the user's configured custom FABRO ID if valid, or generates a permanent,
 * deterministic, collision-resistant FABRO ID from a Firebase UID (Format: FBR-XXXX-XXXX).
 */
export function computeFabroId(uid?: string | null, customFabroId?: string | null): string {
  const normalizedCustom = normalizeCustomFabroId(customFabroId);
  if (normalizedCustom) return normalizedCustom;
  const clean = (uid || '').trim();
  if (!clean) return 'FBR-INVITADO';
  const h1 = hash32(clean, 2166136261);
  const h2 = hash32(`fabro:${clean}:id`, 374761393);
  const encode4 = (num: number): string => {
    let n = num >>> 0;
    let out = '';
    for (let i = 0; i < 4; i += 1) {
      out += ALPHABET[n % ALPHABET.length];
      n = Math.floor(n / ALPHABET.length);
    }
    return out;
  };
  return `FBR-${encode4(h1)}-${encode4(h2)}`;
}

export const DEFAULT_SECTOR_AI_PREFERENCES: SectorAiPreferencesMap = {
  estudio: { sector: 'estudio', providerMode: 'auto' },
  bienestar: { sector: 'bienestar', providerMode: 'auto' },
  social: { sector: 'social', providerMode: 'auto' },
  ia: { sector: 'ia', providerMode: 'auto' },
  configuracion: { sector: 'configuracion', providerMode: 'auto' },
};

const STORAGE_PREFIX = 'fabro_sector_ai_prefs_';

export function getSectorAiPreferences(uid?: string): SectorAiPreferencesMap {
  const key = `${STORAGE_PREFIX}${uid || 'anon'}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_SECTOR_AI_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<SectorAiPreferencesMap>;
    return {
      estudio: { ...DEFAULT_SECTOR_AI_PREFERENCES.estudio, ...(parsed.estudio || {}) },
      bienestar: { ...DEFAULT_SECTOR_AI_PREFERENCES.bienestar, ...(parsed.bienestar || {}) },
      social: { ...DEFAULT_SECTOR_AI_PREFERENCES.social, ...(parsed.social || {}) },
      ia: { ...DEFAULT_SECTOR_AI_PREFERENCES.ia, ...(parsed.ia || {}) },
      configuracion: { ...DEFAULT_SECTOR_AI_PREFERENCES.configuracion, ...(parsed.configuracion || {}) },
    };
  } catch {
    return { ...DEFAULT_SECTOR_AI_PREFERENCES };
  }
}

export function saveSectorAiPreferences(
  uid: string | undefined,
  next: SectorAiPreferencesMap
): SectorAiPreferencesMap {
  const key = `${STORAGE_PREFIX}${uid || 'anon'}`;
  try {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('fabro-sector-ai-updated', { detail: next }));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function updateSectorAiPreference(
  uid: string | undefined,
  sector: FabroSectorId,
  patch: Partial<SectorAiPreferencesMap[FabroSectorId]>
): SectorAiPreferencesMap {
  const current = getSectorAiPreferences(uid);
  const updated: SectorAiPreferencesMap = {
    ...current,
    [sector]: {
      ...current[sector],
      ...patch,
      sector,
    },
  };
  return saveSectorAiPreferences(uid, updated);
}
