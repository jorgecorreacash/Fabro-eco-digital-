import type { LibraryDoc, Note, Subject } from '../types/fabro';
import {
  cacheOfflineNotes,
  cacheSnapshotCollection,
  getAllLocalFileBlobIds,
  getLocalFileBlob,
  getPendingNoteWrites,
  getVaultMeta,
  saveLocalFileBlob,
  saveVaultMeta,
} from './offlineStore';

export const STUDY_ASSETS_CACHE_NAME = 'fabro-study-assets-v1';

export interface PrecacheStatusState {
  status: 'idle' | 'precaching' | 'ready' | 'offline';
  cachedNotesCount: number;
  recentNotesCount: number;
  cachedLibraryDocsCount: number;
  cachedFilesCount: number;
  cachedAssetsCount: number;
  pendingSyncCount: number;
  lastPrecachedAt: string | null;
}

export function extractMediaUrlsFromHtml(html: string): string[] {
  if (!html) return [];
  const urls = new Set<string>();

  // Extract src and data-full-src attributes from <img> / <source> tags
  const attrRegex = /(?:src|data-full-src)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = attrRegex.exec(html);
  while (match !== null) {
    const candidate = (match[1] || '').trim();
    if (candidate && (candidate.startsWith('https://') || candidate.startsWith('http://') || candidate.startsWith('/'))) {
      urls.add(candidate);
    }
    match = attrRegex.exec(html);
  }
  return Array.from(urls);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

async function sendUrlsToServiceWorker(urls: string[], forceRefresh = false): Promise<number> {
  if (typeof window === 'undefined' || urls.length === 0) return 0;

  // Attempt SW postMessage precaching first
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active;
      if (worker) {
        const requestId = `pre_${Date.now()}`;
        const swCount = await new Promise<number>((resolve) => {
          let settled = false;
          const timeoutId = window.setTimeout(() => {
            if (!settled) {
              settled = true;
              navigator.serviceWorker.removeEventListener('message', onMsg);
              resolve(-1);
            }
          }, 9000);

          const onMsg = (event: MessageEvent) => {
            const payload = event.data as {
              type?: string;
              requestId?: string;
              totalCachedInVault?: number;
            } | null;
            if (payload?.type === 'PRECACHE_FABRO_COMPLETE' && (!payload.requestId || payload.requestId === requestId)) {
              if (!settled) {
                settled = true;
                window.clearTimeout(timeoutId);
                navigator.serviceWorker.removeEventListener('message', onMsg);
                resolve(typeof payload.totalCachedInVault === 'number' ? payload.totalCachedInVault : 0);
              }
            }
          };

          navigator.serviceWorker.addEventListener('message', onMsg);
          worker.postMessage({
            type: 'PRECACHE_FABRO_ASSETS',
            urls,
            forceRefresh,
            requestId,
          });
        });
        if (swCount >= 0) return swCount;
      }
    } catch {
      // Fallback to direct Cache Storage below
    }
  }

  // Fallback: populate Cache Storage directly from client if SW isn't controlling yet
  if ('caches' in window) {
    try {
      const cache = await caches.open(STUDY_ASSETS_CACHE_NAME);
      for (const url of urls.slice(0, 80)) {
        if (!forceRefresh && (await cache.match(url))) continue;
        try {
          const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (resp.ok) {
            await cache.put(url, resp.clone());
            continue;
          }
        } catch {
          // Try no-cors
        }
        try {
          const opaqueResp = await fetch(url, { mode: 'no-cors', credentials: 'omit' });
          if (opaqueResp.type === 'opaque' || opaqueResp.ok) {
            await cache.put(url, opaqueResp.clone());
          }
        } catch {
          // Ignore single asset failure
        }
      }
      const keys = await cache.keys();
      return keys.length;
    } catch {
      return 0;
    }
  }

  return 0;
}

export async function runFullStudyPrecache(params: {
  notes: Note[];
  libraryDocs: LibraryDoc[];
  subjects: Subject[];
  recentNoteIds: string[];
  recentDocIds: string[];
  forceRefresh?: boolean;
}): Promise<PrecacheStatusState> {
  const { notes, libraryDocs, subjects, recentNoteIds, recentDocIds, forceRefresh = false } = params;

  const recentNoteSet = new Set(recentNoteIds.slice(0, 35));
  const targetNotes = notes.filter((n) => n.offlineAvailable || recentNoteSet.has(n.id));
  // Ensure at least top 25 notes are counted if user hasn't clicked many yet
  const fallbackNotes =
    targetNotes.length >= Math.min(notes.length, 25)
      ? targetNotes
      : [
          ...targetNotes,
          ...notes.filter((n) => !targetNotes.some((t) => t.id === n.id)).slice(0, 25 - targetNotes.length),
        ];

  // 1. Persist IDB collections synchronously/reliably
  await Promise.all([
    cacheOfflineNotes(notes, recentNoteIds),
    cacheSnapshotCollection('libraryDocs', libraryDocs),
    cacheSnapshotCollection('subjects', subjects),
  ]);

  // 2. Collect remote URLs from ALL library docs (prioritizing recent docs), subjects syllabi, and recent/offline notes
  const prioritizedDocs = [...libraryDocs].sort((a, b) => {
    const idxA = recentDocIds.indexOf(a.id);
    const idxB = recentDocIds.indexOf(b.id);
    if (idxA !== -1 || idxB !== -1) {
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    }
    return 0;
  });

  const remoteUrls = new Set<string>();
  for (const docItem of prioritizedDocs) {
    if (docItem.storageUrl && /^https?:\/\//i.test(docItem.storageUrl)) {
      remoteUrls.add(docItem.storageUrl);
    }
  }

  for (const subj of subjects) {
    if (subj.syllabusFileUrl && /^https?:\/\//i.test(subj.syllabusFileUrl)) {
      remoteUrls.add(subj.syllabusFileUrl);
    }
  }

  for (const note of fallbackNotes) {
    for (const imgUrl of extractMediaUrlsFromHtml(note.contentHtml || '')) {
      remoteUrls.add(imgUrl);
    }
    for (const att of note.attachments || []) {
      if (att.url && /^https?:\/\//i.test(att.url)) {
        remoteUrls.add(att.url);
      }
    }
  }

  // 3. Also ensure remote library PDFs/images (<= 8MB) are mirrored into IndexedDB fileBlobs if missing locally
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const existingBlobIds = new Set(await getAllLocalFileBlobIds());
    const docsNeedingBlob = prioritizedDocs
      .filter((d) => d.storageUrl && !existingBlobIds.has(d.id) && d.sizeBytes <= 8 * 1024 * 1024)
      .slice(0, 12);

    for (const docItem of docsNeedingBlob) {
      try {
        const resp = await fetch(docItem.storageUrl, { mode: 'cors', credentials: 'omit' });
        if (resp.ok) {
          const blob = await resp.blob();
          const dataUrl = await blobToDataUrl(blob);
          if (dataUrl) {
            await saveLocalFileBlob({
              id: docItem.id,
              fileName: docItem.fileName,
              mimeType: docItem.mimeType || blob.type || 'application/octet-stream',
              dataUrl,
              savedAt: new Date().toISOString(),
            });
          }
        }
      } catch {
        // Cross-origin without CORS still gets cached by SW Cache Storage below
      }
    }
  }

  let cachedAssetsCount = 0;
  if (typeof navigator !== 'undefined' && navigator.onLine && remoteUrls.size > 0) {
    cachedAssetsCount = await sendUrlsToServiceWorker(Array.from(remoteUrls), forceRefresh);
  } else if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(STUDY_ASSETS_CACHE_NAME);
      cachedAssetsCount = (await cache.keys()).length;
    } catch {
      cachedAssetsCount = 0;
    }
  }

  const blobIds = await getAllLocalFileBlobIds();
  const pendingWrites = await getPendingNoteWrites();
  const nowIso = new Date().toISOString();

  await saveVaultMeta({
    key: 'precache_summary',
    lastPrecachedAt: nowIso,
    cachedNotesCount: fallbackNotes.length,
    cachedLibraryDocsCount: libraryDocs.length,
    cachedFilesCount: blobIds.length,
    cachedAssetsCount,
  });

  return {
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'ready',
    cachedNotesCount: fallbackNotes.length,
    recentNotesCount: recentNoteIds.length,
    cachedLibraryDocsCount: libraryDocs.length,
    cachedFilesCount: blobIds.length,
    cachedAssetsCount,
    pendingSyncCount: pendingWrites.length,
    lastPrecachedAt: nowIso,
  };
}

export async function readOfflinePrecacheSnapshot(
  notes: Note[],
  libraryDocs: LibraryDoc[],
  recentNoteIds: string[]
): Promise<PrecacheStatusState> {
  const [blobIds, pendingWrites, meta] = await Promise.all([
    getAllLocalFileBlobIds(),
    getPendingNoteWrites(),
    getVaultMeta(),
  ]);

  let cachedAssetsCount = meta?.cachedAssetsCount || 0;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(STUDY_ASSETS_CACHE_NAME);
      cachedAssetsCount = (await cache.keys()).length;
    } catch {
      // Keep previous
    }
  }

  const recentSet = new Set(recentNoteIds);
  const cachedNotesCount =
    notes.length > 0
      ? Math.max(
          notes.filter((n) => n.offlineAvailable || recentSet.has(n.id)).length,
          Math.min(notes.length, 25)
        )
      : meta?.cachedNotesCount || 0;

  return {
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'ready',
    cachedNotesCount,
    recentNotesCount: recentNoteIds.length,
    cachedLibraryDocsCount: libraryDocs.length || meta?.cachedLibraryDocsCount || 0,
    cachedFilesCount: blobIds.length,
    cachedAssetsCount,
    pendingSyncCount: pendingWrites.length,
    lastPrecachedAt: meta?.lastPrecachedAt || null,
  };
}

/**
 * Resolves a viewable URL for a Library document offline or online:
 * 1) Local IndexedDB blob dataUrl if available
 * 2) Cached response from SW Cache Storage converted to ObjectURL
 * 3) Original storageUrl
 */
export async function resolveLibraryDocViewUrl(docId: string, storageUrl?: string): Promise<string> {
  const localBlob = await getLocalFileBlob(docId);
  if (localBlob?.dataUrl) {
    return localBlob.dataUrl;
  }

  if (storageUrl && typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cachedResp = await caches.match(storageUrl);
      if (cachedResp && cachedResp.type !== 'opaque') {
        const blob = await cachedResp.blob();
        return URL.createObjectURL(blob);
      }
    } catch {
      // Fall through to storageUrl
    }
  }

  return storageUrl || '';
}
