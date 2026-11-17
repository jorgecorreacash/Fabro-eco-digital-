import { openDB, type IDBPDatabase } from 'idb';
import type { CalendarEvent, DictionaryEntry, LibraryDoc, Note, Subject } from '../types/fabro';

const DB_NAME = 'fabro-offline-vault';
const DB_VERSION = 4;

export interface OfflineFileRecord {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  savedAt: string;
}

export interface RecentAccessRecord {
  key: string; // 'note:<id>' | 'doc:<id>'
  itemType: 'note' | 'doc';
  itemId: string;
  title?: string;
  accessedAt: number;
}

export interface PendingNoteWrite {
  key: string; // 'note:<id>'
  action: 'upsert' | 'delete';
  id: string;
  payload?: Partial<Note> & { id: string };
  updatedAt: number;
}

export interface VaultPrecacheSummary {
  key: 'precache_summary';
  lastPrecachedAt: string;
  cachedNotesCount: number;
  cachedLibraryDocsCount: number;
  cachedFilesCount: number;
  cachedAssetsCount: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function sanitizeValueForIdb(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof val === 'function' || typeof val === 'symbol') return undefined;
  if (val instanceof Date) return val.toISOString();
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeValueForIdb(item)).filter((item) => item !== undefined);
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const cleaned = sanitizeValueForIdb(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return undefined;
}

function sanitizeForIdb<T>(obj: T): T {
  return sanitizeValueForIdb(obj) as T;
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('calendarEvents')) {
          db.createObjectStore('calendarEvents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('libraryDocs')) {
          db.createObjectStore('libraryDocs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('dictionaryEntries')) {
          db.createObjectStore('dictionaryEntries', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fileBlobs')) {
          db.createObjectStore('fileBlobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recentAccess')) {
          db.createObjectStore('recentAccess', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('pendingWrites')) {
          db.createObjectStore('pendingWrites', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('vaultMeta')) {
          db.createObjectStore('vaultMeta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('lastDayCache')) {
          db.createObjectStore('lastDayCache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('exerciseCache')) {
          db.createObjectStore('exerciseCache', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Caches notes marked offlineAvailable AND recently accessed notes (up to 35 most recent)
 * while preserving any unsynced local pending offline edits.
 */
export async function cacheOfflineNotes(notes: Note[], recentNoteIds: string[] = []) {
  try {
    const idb = await getDb();
    const pendingList = (await idb.getAll('pendingWrites')) as PendingNoteWrite[];
    const pendingById = new Map<string, PendingNoteWrite>();
    for (const p of pendingList) {
      pendingById.set(p.id, p);
    }

    const recentSet = new Set(recentNoteIds.slice(0, 35));
    const notesToStore = new Map<string, Note>();

    // Always store explicitly offlineAvailable + recently accessed notes
    for (const note of notes) {
      if (note.offlineAvailable || recentSet.has(note.id)) {
        notesToStore.set(note.id, sanitizeForIdb(note));
      }
    }

    // Ensure at least the 25 most recent notes overall are also precached even before manual toggles
    const sortedFallback = [...notes]
      .sort((a, b) => {
        const idxA = recentNoteIds.indexOf(a.id);
        const idxB = recentNoteIds.indexOf(b.id);
        if (idxA !== -1 || idxB !== -1) {
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        }
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      })
      .slice(0, 25);

    for (const note of sortedFallback) {
      if (!notesToStore.has(note.id)) {
        notesToStore.set(note.id, sanitizeForIdb(note));
      }
    }

    // Apply pending offline mutations on top so unsynced drafts survive reload
    for (const [noteId, pending] of pendingById.entries()) {
      if (pending.action === 'delete') {
        notesToStore.delete(noteId);
      } else if (pending.action === 'upsert' && pending.payload) {
        const existing = notesToStore.get(noteId) || ({} as Note);
        notesToStore.set(noteId, sanitizeForIdb({ ...existing, ...pending.payload } as Note));
      }
    }

    const tx = idb.transaction('notes', 'readwrite');
    await tx.store.clear();
    for (const note of notesToStore.values()) {
      await tx.store.put(note);
    }
    await tx.done;
  } catch {
    // IndexedDB unavailable in private mode
  }
}

export async function upsertCachedNote(note: Note) {
  try {
    const idb = await getDb();
    await idb.put('notes', sanitizeForIdb(note));
  } catch {
    // Ignore
  }
}

export async function deleteCachedNote(id: string) {
  try {
    const idb = await getDb();
    await idb.delete('notes', id);
  } catch {
    // Ignore
  }
}

export async function getCachedOfflineNotes(): Promise<Note[]> {
  try {
    const idb = await getDb();
    return (await idb.getAll('notes')) as Note[];
  } catch {
    return [];
  }
}

export type OfflineCollectionStoreName =
  | 'subjects'
  | 'calendarEvents'
  | 'libraryDocs'
  | 'dictionaryEntries'
  | 'lastDayCache'
  | 'exerciseCache';

export async function cacheSnapshotCollection<T extends { id: string }>(
  storeName: OfflineCollectionStoreName,
  items: T[]
) {
  try {
    const idb = await getDb();
    const tx = idb.transaction(storeName, 'readwrite');
    await tx.store.clear();
    for (const item of items) {
      await tx.store.put(sanitizeForIdb(item));
    }
    await tx.done;
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export async function getCachedCollection(
  storeName: OfflineCollectionStoreName
): Promise<Subject[] | CalendarEvent[] | LibraryDoc[] | DictionaryEntry[] | Array<{ id: string; kind?: string; data?: unknown }>> {
  try {
    const idb = await getDb();
    return await idb.getAll(storeName);
  } catch {
    return [];
  }
}

export async function saveLocalFileBlob(record: OfflineFileRecord) {
  try {
    const idb = await getDb();
    await idb.put('fileBlobs', record);
  } catch {
    // Ignore quota errors
  }
}

export async function getLocalFileBlob(id: string): Promise<OfflineFileRecord | undefined> {
  try {
    const idb = await getDb();
    return (await idb.get('fileBlobs', id)) as OfflineFileRecord | undefined;
  } catch {
    return undefined;
  }
}

export async function getAllLocalFileBlobIds(): Promise<string[]> {
  try {
    const idb = await getDb();
    const keys = await idb.getAllKeys('fileBlobs');
    return keys.map((k) => String(k));
  } catch {
    return [];
  }
}

export async function deleteLocalFileBlob(id: string) {
  try {
    const idb = await getDb();
    await idb.delete('fileBlobs', id);
  } catch {
    // Ignore
  }
}

export async function recordRecentAccess(itemType: 'note' | 'doc', itemId: string, title?: string) {
  if (!itemId) return;
  try {
    const idb = await getDb();
    const record: RecentAccessRecord = {
      key: `${itemType}:${itemId}`,
      itemType,
      itemId,
      title: title ? title.slice(0, 160) : undefined,
      accessedAt: Date.now(),
    };
    await idb.put('recentAccess', record);
  } catch {
    // Ignore
  }
}

export async function getRecentAccessIds(itemType: 'note' | 'doc', limit = 30): Promise<string[]> {
  try {
    const idb = await getDb();
    const all = (await idb.getAll('recentAccess')) as RecentAccessRecord[];
    return all
      .filter((r) => r.itemType === itemType)
      .sort((a, b) => b.accessedAt - a.accessedAt)
      .slice(0, limit)
      .map((r) => r.itemId);
  } catch {
    return [];
  }
}

export async function enqueuePendingNoteWrite(
  action: 'upsert' | 'delete',
  id: string,
  payload?: Partial<Note>
) {
  try {
    const idb = await getDb();
    const existing = (await idb.get('pendingWrites', `note:${id}`)) as PendingNoteWrite | undefined;
    const mergedPayload =
      action === 'upsert'
        ? sanitizeForIdb({
            ...(existing?.payload || {}),
            ...(payload || {}),
            id,
          })
        : undefined;

    const record: PendingNoteWrite = {
      key: `note:${id}`,
      action,
      id,
      payload: mergedPayload,
      updatedAt: Date.now(),
    };
    await idb.put('pendingWrites', record);
  } catch {
    // Ignore
  }
}

export async function getPendingNoteWrites(): Promise<PendingNoteWrite[]> {
  try {
    const idb = await getDb();
    const all = (await idb.getAll('pendingWrites')) as PendingNoteWrite[];
    return all.sort((a, b) => a.updatedAt - b.updatedAt);
  } catch {
    return [];
  }
}

export async function clearPendingNoteWrite(id: string) {
  try {
    const idb = await getDb();
    await idb.delete('pendingWrites', `note:${id}`);
  } catch {
    // Ignore
  }
}

export async function saveVaultMeta(summary: VaultPrecacheSummary) {
  try {
    const idb = await getDb();
    await idb.put('vaultMeta', summary);
  } catch {
    // Ignore
  }
}

export async function getVaultMeta(): Promise<VaultPrecacheSummary | undefined> {
  try {
    const idb = await getDb();
    return (await idb.get('vaultMeta', 'precache_summary')) as VaultPrecacheSummary | undefined;
  } catch {
    return undefined;
  }
}
