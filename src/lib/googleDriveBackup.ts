import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, driveGoogleProvider } from './firebase';

export interface DriveBackupFileEntry {
  id: string;
  name: string;
  modifiedTime: string;
  sizeBytes: number;
}

// STRICT SECURITY: OAuth access token is kept ONLY in memory, never in localStorage or sessionStorage.
let memoryDriveAccessToken: string | null = null;
let memoryDriveEmail: string | null = null;
let authListenerInitialized = false;

export function initDriveAuthMemorySync(): void {
  if (authListenerInitialized) return;
  authListenerInitialized = true;
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      memoryDriveAccessToken = null;
      memoryDriveEmail = null;
    }
  });
}

export function getDriveConnectionStatus(): { connected: boolean; email: string | null } {
  initDriveAuthMemorySync();
  return {
    connected: Boolean(memoryDriveAccessToken),
    email: memoryDriveEmail,
  };
}

export function disconnectDriveMemorySession(): void {
  memoryDriveAccessToken = null;
  memoryDriveEmail = null;
}

export async function connectGoogleDriveWithPopup(): Promise<{ email: string | null }> {
  initDriveAuthMemorySync();
  const result = await signInWithPopup(auth, driveGoogleProvider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.accessToken) {
    throw new Error('Google no devolvió el token temporal de acceso a Google Drive.');
  }
  memoryDriveAccessToken = cred.accessToken;
  memoryDriveEmail = result.user?.email || null;
  return { email: memoryDriveEmail };
}

function requireToken(): string {
  if (!memoryDriveAccessToken) {
    throw new Error('Conectá primero tu cuenta de Google Drive en esta sesión.');
  }
  return memoryDriveAccessToken;
}

async function ensureFabroBackupFolder(token: string): Promise<string> {
  const q = encodeURIComponent(
    "name = 'FABRO_Respaldos' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  );
  const searchResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (searchResp.status === 401) {
    memoryDriveAccessToken = null;
    throw new Error('La sesión de Google Drive expiró. Volvé a conectar con Google.');
  }
  const searchJson = (await searchResp.json()) as { files?: Array<{ id: string; name: string }> };
  if (searchJson.files && searchJson.files.length > 0) {
    return searchJson.files[0].id;
  }

  const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'FABRO_Respaldos',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createResp.ok) {
    throw new Error('No se pudo crear la carpeta FABRO_Respaldos en Google Drive.');
  }
  const folder = (await createResp.json()) as { id: string };
  return folder.id;
}

export async function listDriveBackups(): Promise<DriveBackupFileEntry[]> {
  const token = requireToken();
  const folderId = await ensureFabroBackupFolder(token);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (resp.status === 401) {
    memoryDriveAccessToken = null;
    throw new Error('Tu token de Google Drive expiró. Volvé a conectar.');
  }
  if (!resp.ok) {
    throw new Error('No se pudieron listar los respaldos en Google Drive.');
  }
  const data = (await resp.json()) as {
    files?: Array<{ id: string; name: string; modifiedTime?: string; size?: string }>;
  };
  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime || '',
    sizeBytes: Number(f.size || 0),
  }));
}

export async function uploadDriveBackupJson(
  fileName: string,
  backupPayload: unknown
): Promise<DriveBackupFileEntry> {
  const token = requireToken();
  const folderId = await ensureFabroBackupFolder(token);
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
  };

  const boundary = `fabro_drive_${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(backupPayload, null, 2)}\r\n` +
    `--${boundary}--`;

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (resp.status === 401) {
    memoryDriveAccessToken = null;
    throw new Error('Tu token de Google Drive expiró. Reconectá Google Drive.');
  }
  if (!resp.ok) {
    throw new Error('No se pudo subir el respaldo a Google Drive.');
  }
  const created = (await resp.json()) as {
    id: string;
    name: string;
    modifiedTime?: string;
    size?: string;
  };
  return {
    id: created.id,
    name: created.name,
    modifiedTime: created.modifiedTime || new Date().toISOString(),
    sizeBytes: Number(created.size || 0),
  };
}

export async function downloadDriveBackupJson(fileId: string): Promise<Record<string, unknown>> {
  const token = requireToken();
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) {
    throw new Error('No se pudo descargar el archivo de respaldo desde Google Drive.');
  }
  return (await resp.json()) as Record<string, unknown>;
}

/** Must ONLY be called after explicit user confirmation dialog in UI. */
export async function deleteDriveBackupFile(fileId: string): Promise<void> {
  const token = requireToken();
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok && resp.status !== 204) {
    throw new Error('No se pudo eliminar el archivo en Google Drive.');
  }
}
