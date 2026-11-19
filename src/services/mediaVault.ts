import { openDB, type IDBPDatabase } from 'idb';
import type { PhotoCropMode, PhotoFilterId, SocialMediaAttachment } from '../types/ecosystem';

const MEDIA_DB_NAME = 'fabro-media-vault';
const MEDIA_DB_VERSION = 1;
const BLOB_STORE = 'blobs';

export interface StoredMediaRecord {
  id: string;
  kind: 'image' | 'video';
  mimeType: string;
  blob: Blob;
  posterDataUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  createdAtMs: number;
}

let mediaDbPromise: Promise<IDBPDatabase> | null = null;
const objectUrlCache = new Map<string, string>();

function getMediaDb(): Promise<IDBPDatabase> | null {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }
  if (!mediaDbPromise) {
    mediaDbPromise = openDB(MEDIA_DB_NAME, MEDIA_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(BLOB_STORE)) {
          db.createObjectStore(BLOB_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return mediaDbPromise;
}

export const PHOTO_FILTER_CSS: Record<PhotoFilterId, string> = {
  none: 'none',
  warm: 'sepia(24%) saturate(122%) brightness(104%)',
  vivid: 'contrast(114%) saturate(132%) brightness(102%)',
  bw: 'grayscale(100%) contrast(112%)',
  vintage: 'sepia(42%) contrast(106%) brightness(96%) saturate(88%)',
};

export const PHOTO_FILTER_LABELS: Array<{ id: PhotoFilterId; label: string }> = [
  { id: 'none', label: 'Original' },
  { id: 'vivid', label: 'Nítido' },
  { id: 'warm', label: 'Cálido' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'bw', label: 'B&N' },
];

export const PHOTO_CROP_LABELS: Array<{ id: PhotoCropMode; label: string }> = [
  { id: 'original', label: 'Original' },
  { id: 'square', label: 'Cuadrado 1:1' },
  { id: 'wide', label: 'Panorámico 16:9' },
];

function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };
    img.src = url;
  });
}

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  cropMode?: PhotoCropMode;
  filter?: PhotoFilterId;
}

export async function compressImageOnCanvas(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<{
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
}> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.82,
    cropMode = 'original',
    filter = 'none',
  } = options;

  const img = await loadImageFromFile(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (cropMode === 'square') {
    const side = Math.min(srcW, srcH);
    sx = Math.floor((srcW - side) / 2);
    sy = Math.floor((srcH - side) / 2);
    sw = side;
    sh = side;
  } else if (cropMode === 'wide') {
    const targetRatio = 16 / 9;
    const currentRatio = srcW / srcH;
    if (currentRatio > targetRatio) {
      sw = Math.floor(srcH * targetRatio);
      sx = Math.floor((srcW - sw) / 2);
    } else {
      sh = Math.floor(srcW / targetRatio);
      sy = Math.floor((srcH - sh) / 2);
    }
  }

  let targetW = sw;
  let targetH = sh;
  const scale = Math.min(1, maxWidth / targetW, maxHeight / targetH);
  targetW = Math.max(1, Math.round(targetW * scale));
  targetH = Math.max(1, Math.round(targetH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Tu navegador no pudo inicializar el lienzo de compresión.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (filter !== 'none' && 'filter' in ctx) {
    ctx.filter = PHOTO_FILTER_CSS[filter];
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else {
          // Fallback from dataUrl
          const parts = dataUrl.split(',');
          const bin = atob(parts[1] || '');
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: mimeType }));
        }
      },
      mimeType,
      quality
    );
  });

  return { blob, dataUrl, width: targetW, height: targetH, mimeType };
}

/**
 * Resizes avatar to 320x320 square JPEG (~25-45KB) — lightweight for both IndexedDB & Firestore.
 */
export async function processAvatarImage(file: File): Promise<string> {
  const result = await compressImageOnCanvas(file, {
    maxWidth: 320,
    maxHeight: 320,
    quality: 0.82,
    cropMode: 'square',
  });
  return result.dataUrl;
}

/**
 * Resizes cover photo to 1200x420 wide JPEG (~60-110KB) — saved in IndexedDB & safe for Firestore.
 */
export async function processCoverImage(file: File): Promise<string> {
  const result = await compressImageOnCanvas(file, {
    maxWidth: 1120,
    maxHeight: 420,
    quality: 0.78,
    cropMode: 'wide',
  });
  return result.dataUrl;
}

export async function putMediaRecord(record: StoredMediaRecord): Promise<void> {
  const db = getMediaDb();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put(BLOB_STORE, record);
    if (objectUrlCache.has(record.id)) {
      URL.revokeObjectURL(objectUrlCache.get(record.id)!);
      objectUrlCache.delete(record.id);
    }
  } catch {
    // Non-fatal in private browsing without IndexedDB
  }
}

export async function getMediaObjectUrl(mediaId: string): Promise<string | null> {
  if (!mediaId) return null;
  if (objectUrlCache.has(mediaId)) {
    return objectUrlCache.get(mediaId)!;
  }
  const db = getMediaDb();
  if (!db) return null;
  try {
    const instance = await db;
    const rec = (await instance.get(BLOB_STORE, mediaId)) as StoredMediaRecord | undefined;
    if (!rec?.blob) return null;
    const url = URL.createObjectURL(rec.blob);
    objectUrlCache.set(mediaId, url);
    return url;
  } catch {
    return null;
  }
}

export async function saveImageAttachmentToVault(
  file: File,
  options: {
    caption?: string;
    filter?: PhotoFilterId;
    cropMode?: PhotoCropMode;
  } = {}
): Promise<SocialMediaAttachment> {
  const filter = options.filter || 'none';
  const cropMode = options.cropMode || 'original';

  // Full quality compressed version for IndexedDB blob store
  const full = await compressImageOnCanvas(file, {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.82,
    cropMode,
    filter,
  });

  // Compact preview thumbnail (~25-45KB) for fast rendering & optional Firestore sync
  const thumb = await compressImageOnCanvas(file, {
    maxWidth: 540,
    maxHeight: 540,
    quality: 0.72,
    cropMode,
    filter,
  });

  const id = `med-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await putMediaRecord({
    id,
    kind: 'image',
    mimeType: full.mimeType,
    blob: full.blob,
    posterDataUrl: thumb.dataUrl,
    width: full.width,
    height: full.height,
    createdAtMs: Date.now(),
  });

  const cachedUrl = URL.createObjectURL(full.blob);
  objectUrlCache.set(id, cachedUrl);

  return {
    id,
    kind: 'image',
    mediaVaultId: id,
    dataUrl: thumb.dataUrl,
    caption: options.caption?.trim() || undefined,
    filter,
    mimeType: full.mimeType,
  };
}

function extractVideoPoster(file: File): Promise<{ posterDataUrl?: string; durationSec?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let finished = false;
    const finish = (posterDataUrl?: string, durationSec?: number) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      resolve({ posterDataUrl, durationSec });
    };

    const timeout = window.setTimeout(() => finish(undefined, undefined), 4500);

    video.onloadedmetadata = () => {
      const dur = Number.isFinite(video.duration) ? Math.round(video.duration) : undefined;
      try {
        video.currentTime = Math.min(0.6, (video.duration || 1) * 0.15);
      } catch {
        window.clearTimeout(timeout);
        finish(undefined, dur);
      }
    };

    video.onseeked = () => {
      window.clearTimeout(timeout);
      const dur = Number.isFinite(video.duration) ? Math.round(video.duration) : undefined;
      try {
        const vw = video.videoWidth || 480;
        const vh = video.videoHeight || 270;
        const scale = Math.min(1, 520 / vw, 520 / vh);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(vw * scale));
        canvas.height = Math.max(1, Math.round(vh * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL('image/jpeg', 0.72), dur);
          return;
        }
      } catch {
        // ignore canvas errors
      }
      finish(undefined, dur);
    };

    video.onerror = () => {
      window.clearTimeout(timeout);
      finish(undefined, undefined);
    };

    video.src = url;
  });
}

export async function saveVideoAttachmentToVault(
  file: File,
  caption?: string
): Promise<SocialMediaAttachment> {
  const maxBytes = 60 * 1024 * 1024; // 60 MB safe IndexedDB cap
  if (file.size > maxBytes) {
    throw new Error('El video supera los 60 MB. Elegí un clip más corto para mantener la app ágil.');
  }

  const { posterDataUrl, durationSec } = await extractVideoPoster(file);
  const id = `med-vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await putMediaRecord({
    id,
    kind: 'video',
    mimeType: file.type || 'video/mp4',
    blob: file,
    posterDataUrl,
    durationSec,
    createdAtMs: Date.now(),
  });

  const cachedUrl = URL.createObjectURL(file);
  objectUrlCache.set(id, cachedUrl);

  return {
    id,
    kind: 'video',
    mediaVaultId: id,
    posterDataUrl,
    caption: caption?.trim() || undefined,
    mimeType: file.type || 'video/mp4',
    durationSec,
  };
}
