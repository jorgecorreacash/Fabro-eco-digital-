import type {
  RadioBand,
  RadioCountryOption,
  RadioGenrePreset,
  RadioPreferences,
  RadioStation,
} from '../types/radio';

// Public, free Radio Browser API mirrors (zero API keys, zero billing)
const RADIO_BROWSER_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

const LS_FAVORITES_KEY = 'fabro_radio_favorites_v1';
const LS_CUSTOM_KEY = 'fabro_radio_custom_v1';
const LS_PREFS_KEY = 'fabro_radio_prefs_v1';

export const FM_MIN = 87.5;
export const FM_MAX = 108.0;
export const FM_STEP = 0.1;

export const AM_MIN = 530;
export const AM_MAX = 1700;
export const AM_STEP = 10;

export const RADIO_COUNTRIES: RadioCountryOption[] = [
  { code: 'AR', label: 'Argentina' },
  { code: 'UY', label: 'Uruguay' },
  { code: 'CL', label: 'Chile' },
  { code: 'ES', label: 'España' },
  { code: 'MX', label: 'México' },
  { code: 'CO', label: 'Colombia' },
  { code: 'PE', label: 'Perú' },
  { code: 'BR', label: 'Brasil' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'FR', label: 'Francia' },
  { code: 'IT', label: 'Italia' },
  { code: 'DE', label: 'Alemania' },
  { code: 'JP', label: 'Japón' },
  { code: 'ALL', label: 'Todo el mundo' },
];

export const FM_GENRE_PRESETS: RadioGenrePreset[] = [
  { id: 'fm-top', label: 'Populares', band: 'FM', tag: '' },
  { id: 'fm-news', label: 'Noticias', band: 'FM', tag: 'news' },
  { id: 'fm-lofi', label: 'Estudiar / Lo-Fi', band: 'FM', tag: 'lofi', globalSearch: true },
  { id: 'fm-rock-pop', label: 'Rock / Pop', band: 'FM', tag: 'rock' },
  { id: 'fm-classical', label: 'Clásica', band: 'FM', tag: 'classical', globalSearch: true },
  { id: 'fm-folklore', label: 'Folklore', band: 'FM', tag: 'folklore' },
];

export const AM_GENRE_PRESETS: RadioGenrePreset[] = [
  { id: 'am-all', label: 'Dial AM', band: 'AM', tag: '', query: 'AM' },
  { id: 'am-news', label: 'Informativas', band: 'AM', tag: 'news' },
  { id: 'am-talk', label: 'Culturales y Talk', band: 'AM', tag: 'talk' },
  { id: 'am-sports', label: 'Deportes', band: 'AM', tag: 'sport' },
  { id: 'am-tango', label: 'Tango y Folklore', band: 'AM', tag: 'tango' },
];

export const DEFAULT_RADIO_PREFS: RadioPreferences = {
  band: 'FM',
  countryCode: 'AR',
  volume: 0.78,
  staticEffectEnabled: true,
};

// ---------------------------------------------------------------------------
// LocalStorage Persistence (Favorites, Custom Frequencies, Preferences)
// ---------------------------------------------------------------------------
export function loadRadioFavorites(): RadioStation[] {
  try {
    const raw = localStorage.getItem(LS_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRadioFavorites(items: RadioStation[]): void {
  try {
    localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

export function loadCustomStations(): RadioStation[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomStations(items: RadioStation[]): void {
  try {
    localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

export function loadRadioPreferences(): RadioPreferences {
  try {
    const raw = localStorage.getItem(LS_PREFS_KEY);
    if (!raw) return DEFAULT_RADIO_PREFS;
    const parsed = JSON.parse(raw) as Partial<RadioPreferences>;
    return {
      ...DEFAULT_RADIO_PREFS,
      ...parsed,
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULT_RADIO_PREFS.volume,
    };
  } catch {
    return DEFAULT_RADIO_PREFS;
  }
}

export function saveRadioPreferences(prefs: RadioPreferences): void {
  try {
    localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Dial Frequency Formatting & Extraction
// ---------------------------------------------------------------------------
export function formatFrequency(freq: number, band: RadioBand): string {
  if (band === 'FM') {
    return `${freq.toFixed(1)} MHz`;
  }
  return `${Math.round(freq)} kHz`;
}

export function clampFrequency(freq: number, band: RadioBand): number {
  if (band === 'FM') {
    const clamped = Math.min(FM_MAX, Math.max(FM_MIN, freq));
    return Number(clamped.toFixed(1));
  }
  const clamped = Math.min(AM_MAX, Math.max(AM_MIN, freq));
  return Math.round(clamped / 10) * 10;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Extracts a real FM (87.5-108.0) or AM (530-1700) dial frequency from station name/tags
 * when present (e.g. "La 100 - 99.9 FM" -> 99.9, "Radio Mitre AM 790" -> 790).
 * Otherwise assigns a stable deterministic slot on the dial so tuning feels natural.
 */
export function inferDialFrequency(
  name: string,
  tags: string,
  band: RadioBand,
  seedId: string
): number {
  const text = `${name} ${tags}`;
  if (band === 'FM') {
    const fmMatch = text.match(/\b(8[7-9]|9\d|10[0-8])([.,](\d))\b/);
    if (fmMatch) {
      const val = Number(`${fmMatch[1]}.${fmMatch[3]}`);
      if (val >= FM_MIN && val <= FM_MAX) return Number(val.toFixed(1));
    }
    const fmIntMatch = text.match(/\bFM\s*(8[8-9]|9\d|10[0-7])\b/i);
    if (fmIntMatch) {
      const val = Number(fmIntMatch[1]);
      if (val >= FM_MIN && val <= FM_MAX) return Number(val.toFixed(1));
    }
    const slots = Math.round((FM_MAX - FM_MIN) / 0.2);
    const offset = (hashString(seedId) % slots) * 0.2;
    return Number((FM_MIN + offset).toFixed(1));
  }

  // AM mode (530 - 1700 kHz)
  const amMatch =
    text.match(/\bAM\s*[-]?\s*(5[3-9]\d|[6-9]\d{2}|1[0-6]\d{2}|1700)\b/i) ||
    text.match(/\b(5[3-9]0|[6-9]\d0|1[0-6]\d0|1700)\s*(?:kHz|AM)\b/i);
  if (amMatch) {
    const val = Number(amMatch[1]);
    if (val >= AM_MIN && val <= AM_MAX) return Math.round(val / 10) * 10;
  }
  const slots = Math.round((AM_MAX - AM_MIN) / 10);
  const offset = (hashString(seedId) % slots) * 10;
  return AM_MIN + offset;
}

// ---------------------------------------------------------------------------
// Radio Browser API Search (Zero API Key, HTML5-Audio Compatible Filter)
// ---------------------------------------------------------------------------
interface RawRadioBrowserStation {
  stationuuid?: string;
  name?: string;
  url?: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  codec?: string;
  bitrate?: number;
  hls?: number;
  lastcheckok?: number;
  votes?: number;
}

function isHtml5PlayableStream(raw: RawRadioBrowserStation): boolean {
  const url = String(raw.url_resolved || raw.url || '').trim();
  if (!url) return false;
  // Prefer HTTPS to avoid Mixed Content blocking on HTTPS preview/production origins
  if (!url.startsWith('https://')) return false;
  if (raw.lastcheckok === 0) return false;

  const codec = String(raw.codec || '').toUpperCase();
  const lowerUrl = url.toLowerCase();
  // Exclude proprietary/playlist-only formats that HTML5 <audio> cannot decode directly
  if (
    lowerUrl.endsWith('.pls') ||
    lowerUrl.endsWith('.asx') ||
    lowerUrl.endsWith('.ram') ||
    codec === 'WMA' ||
    codec === 'UNKNOWN'
  ) {
    return false;
  }
  // Prefer MP3, AAC, AAC+, OGG, OPUS, FLAC; allow HLS only when not blocking standard streams
  if (raw.hls === 1 && !lowerUrl.includes('.m3u8')) return false;
  return (
    codec.includes('MP3') ||
    codec.includes('AAC') ||
    codec.includes('OGG') ||
    codec.includes('OPUS') ||
    lowerUrl.includes('.mp3') ||
    lowerUrl.includes('.aac') ||
    lowerUrl.includes('stream') ||
    lowerUrl.includes('icecast') ||
    lowerUrl.includes('radio')
  );
}

export interface RadioSearchParams {
  band: RadioBand;
  countryCode: string;
  query?: string;
  tag?: string;
  globalSearch?: boolean;
  limit?: number;
}

export async function searchRadioBrowserStations(
  params: RadioSearchParams
): Promise<{ stations: RadioStation[]; mirrorUsed: string; error?: string }> {
  const { band, countryCode, query = '', tag = '', globalSearch = false, limit = 40 } = params;

  const sp = new URLSearchParams();
  sp.set('hidebroken', 'true');
  sp.set('order', 'clickcount');
  sp.set('reverse', 'true');
  sp.set('limit', String(Math.min(80, Math.max(20, limit * 2))));

  const effectiveCountry = !globalSearch && countryCode && countryCode !== 'ALL' ? countryCode : '';
  if (effectiveCountry) {
    sp.set('countrycode', effectiveCountry);
  }
  if (tag.trim()) {
    sp.set('tag', tag.trim().toLowerCase());
  }
  const cleanQuery = query.trim();
  if (cleanQuery) {
    sp.set('name', cleanQuery);
  }

  let lastError = 'No se pudo conectar con Radio Browser API.';

  for (const mirror of RADIO_BROWSER_MIRRORS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7500);
    try {
      const url = `${mirror}/json/stations/search?${sp.toString()}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      window.clearTimeout(timeoutId);
      if (!res.ok) {
        lastError = `HTTP ${res.status} desde ${mirror}`;
        continue;
      }
      const rawList = (await res.json()) as RawRadioBrowserStation[];
      if (!Array.isArray(rawList)) continue;

      const seenUrls = new Set<string>();
      const usedFreqs = new Set<number>();
      const mapped: RadioStation[] = [];

      for (const raw of rawList) {
        if (!isHtml5PlayableStream(raw)) continue;
        // Skip HLS streams in default browser search so Chrome/Firefox/Android all play reliably
        if (raw.hls === 1) continue;

        const streamUrl = String(raw.url_resolved || raw.url || '').trim();
        if (seenUrls.has(streamUrl)) continue;
        seenUrls.add(streamUrl);

        const name = String(raw.name || '').trim().replace(/\s+/g, ' ');
        if (!name) continue;
        const id = String(raw.stationuuid || `rb-${hashString(streamUrl)}`);
        const rawTags = String(raw.tags || '');
        const tagsArr = rawTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 5);

        let freq = inferDialFrequency(name, rawTags, band, id);
        // Prevent duplicate dial frequencies so sliding lands on distinct stations
        let safety = 0;
        while (usedFreqs.has(freq) && safety < 40) {
          freq = clampFrequency(freq + (band === 'FM' ? 0.2 : 10), band);
          if (band === 'FM' && freq >= FM_MAX) freq = FM_MIN;
          if (band === 'AM' && freq >= AM_MAX) freq = AM_MIN;
          safety += 1;
        }
        usedFreqs.add(freq);

        mapped.push({
          id,
          name,
          streamUrl,
          homepage: raw.homepage || undefined,
          favicon:
            raw.favicon && raw.favicon.startsWith('https://') ? raw.favicon : undefined,
          country: raw.country || (effectiveCountry === 'AR' ? 'Argentina' : 'Internacional'),
          countryCode: raw.countrycode || effectiveCountry || 'INT',
          state: raw.state || undefined,
          tags: tagsArr,
          codec: String(raw.codec || 'MP3').toUpperCase(),
          bitrate: Number(raw.bitrate || 0),
          band,
          frequency: freq,
          votes: Number(raw.votes || 0),
        });

        if (mapped.length >= limit) break;
      }

      // Sort nicely along the dial
      mapped.sort((a, b) => a.frequency - b.frequency);
      return { stations: mapped, mirrorUsed: mirror };
    } catch (err) {
      window.clearTimeout(timeoutId);
      lastError = err instanceof Error ? err.message : 'Error de red';
    }
  }

  return { stations: [], mirrorUsed: '', error: lastError };
}

// ---------------------------------------------------------------------------
// Subtle Radio Static Sound Effect via Web Audio API (100% Offline, Optional)
// ---------------------------------------------------------------------------
let sharedStaticCtx: AudioContext | null = null;

export function playRadioStaticBurst(band: RadioBand, volume = 0.25): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedStaticCtx) {
      sharedStaticCtx = new AudioCtx();
    }
    if (sharedStaticCtx.state === 'suspended') {
      void sharedStaticCtx.resume();
    }

    const ctx = sharedStaticCtx;
    const durationSec = band === 'AM' ? 0.14 : 0.095;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < frameCount; i += 1) {
      const white = Math.random() * 2 - 1;
      // Soft pink-ish filter for AM warmth vs airy FM hiss
      lastOut = band === 'AM' ? (lastOut + 0.09 * white) / 1.09 : (lastOut + 0.22 * white) / 1.22;
      data[i] = lastOut * (band === 'AM' ? 2.1 : 1.4);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = band === 'AM' ? 1550 : 3200;
    filter.Q.value = band === 'AM' ? 1.8 : 0.9;

    const gain = ctx.createGain();
    const peak = Math.max(0.015, Math.min(0.11, volume * 0.11));
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + durationSec + 0.01);
  } catch {
    // Ignore autoplay restrictions before user gesture
  }
}

export function isValidStreamUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
