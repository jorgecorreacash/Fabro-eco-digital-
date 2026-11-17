import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

interface SwWindowClient {
  id: string;
  postMessage: (message: unknown) => void;
}

interface SwClients {
  claim: () => Promise<void>;
  matchAll: (options?: { type?: string; includeUncontrolled?: boolean }) => Promise<SwWindowClient[]>;
}

interface SwExtendableEvent extends Event {
  waitUntil: (promise: Promise<unknown>) => void;
}

interface SwMessageEvent extends SwExtendableEvent {
  data: unknown;
  source?: { postMessage?: (message: unknown) => void } | null;
}

interface SwGlobalScope {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
  location: Location;
  skipWaiting: () => Promise<void>;
  clients: SwClients;
  addEventListener: (
    type: string,
    listener: (event: SwExtendableEvent & SwMessageEvent) => void
  ) => void;
}

declare const self: SwGlobalScope;

const STUDY_ASSETS_CACHE = 'fabro-study-assets-v1';
const APP_PAGES_CACHE = 'fabro-pages-cache-v1';
const STATIC_CHUNKS_CACHE = 'fabro-static-runtime-v1';

// Take control immediately on install/update
void self.skipWaiting();
clientsClaim();

// Precache static build assets injected by VitePWA (literal self.__WB_MANIFEST required by workbox-build)
const manifestEntries = self.__WB_MANIFEST;
precacheAndRoute(manifestEntries);
cleanupOutdatedCaches();

// SPA Navigation fallback (handles both production precached index.html and dev server cleanly)
const hasIndexInManifest = manifestEntries.some((entry) => {
  const url = typeof entry === 'string' ? entry : entry.url;
  return url === '/index.html' || url === 'index.html' || url.endsWith('/index.html');
});

const navigationHandler = hasIndexInManifest
  ? createHandlerBoundToURL('/index.html')
  : new NetworkFirst({
      cacheName: APP_PAGES_CACHE,
      networkTimeoutSeconds: 4,
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    });

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//, /^\/__/],
  })
);

// Google Fonts caching
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 15, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 15, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Same-origin static modules/assets (important for dev mode & dynamic imports offline)
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/api/') &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font' ||
      request.destination === 'image' ||
      request.destination === 'manifest'),
  new StaleWhileRevalidate({
    cacheName: STATIC_CHUNKS_CACHE,
    plugins: [
      new ExpirationPlugin({ maxEntries: 180, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Library attachments, Firebase Storage documents, encyclopedic & museum archive images inside notes & /api/media
const isStudyAssetUrl = (url: URL) =>
  url.hostname.includes('firebasestorage.googleapis.com') ||
  url.hostname.includes('storage.googleapis.com') ||
  url.hostname.endsWith('wikimedia.org') ||
  url.hostname.endsWith('wikipedia.org') ||
  url.hostname.endsWith('nasa.gov') ||
  url.hostname.endsWith('openverse.org') ||
  url.hostname.endsWith('metmuseum.org') ||
  url.hostname.endsWith('staticflickr.com') ||
  (url.origin === self.location.origin && url.pathname.startsWith('/api/media/'));

registerRoute(
  ({ url }) => isStudyAssetUrl(url),
  new CacheFirst({
    cacheName: STUDY_ASSETS_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

interface PrecacheAssetMessage {
  type: 'PRECACHE_FABRO_ASSETS';
  urls?: string[];
  forceRefresh?: boolean;
  requestId?: string;
}

async function precacheStudyUrls(urls: string[], forceRefresh = false) {
  const uniqueUrls = Array.from(
    new Set(
      urls
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter((u) => u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/'))
    )
  ).slice(0, 160);

  const cache = await caches.open(STUDY_ASSETS_CACHE);
  let cachedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const url of uniqueUrls) {
    try {
      if (!forceRefresh) {
        const existing = await cache.match(url);
        if (existing) {
          skippedCount += 1;
          continue;
        }
      }

      let response: Response | null = null;
      try {
        response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      } catch {
        response = null;
      }

      if (!response || (!response.ok && response.type !== 'opaque')) {
        // Fallback to no-cors so Wikimedia / external CDN images cache as opaque responses for <img> offline rendering
        try {
          response = await fetch(url, { mode: 'no-cors', credentials: 'omit' });
        } catch {
          response = null;
        }
      }

      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(url, response.clone());
        cachedCount += 1;
      } else {
        failedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  const keys = await cache.keys();
  return {
    totalRequested: uniqueUrls.length,
    cachedCount,
    skippedCount,
    failedCount,
    totalCachedInVault: keys.length,
  };
}

self.addEventListener('message', (event) => {
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }

  if (data.type === 'PRECACHE_FABRO_ASSETS') {
    const msg = data as unknown as PrecacheAssetMessage;
    const urls = Array.isArray(msg.urls) ? msg.urls : [];
    const forceRefresh = Boolean(msg.forceRefresh);
    const requestId = msg.requestId;

    event.waitUntil(
      precacheStudyUrls(urls, forceRefresh).then(async (summary) => {
        const reply = {
          type: 'PRECACHE_FABRO_COMPLETE',
          requestId,
          ...summary,
        };
        if (event.source?.postMessage) {
          event.source.postMessage(reply);
        } else {
          const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of allClients) {
            client.postMessage(reply);
          }
        }
      })
    );
    return;
  }

  if (data.type === 'GET_FABRO_CACHE_STATS') {
    event.waitUntil(
      caches.open(STUDY_ASSETS_CACHE).then(async (cache) => {
        const keys = await cache.keys();
        const reply = {
          type: 'FABRO_CACHE_STATS',
          totalCachedInVault: keys.length,
        };
        if (event.source?.postMessage) {
          event.source.postMessage(reply);
        }
      })
    );
  }
});
