import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import firebaseConfig, { firestoreDatabaseId } from '../firebaseConfig.js';

/**
 * Single-instance Firebase App initialization.
 * Prevents duplicate Firebase apps across HMR, module reloads, or dynamic imports.
 */
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let dbInstance: Firestore;
try {
  dbInstance = firestoreDatabaseId
    ? initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firestoreDatabaseId
      )
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
} catch {
  dbInstance = firestoreDatabaseId
    ? getFirestore(app, firestoreDatabaseId)
    : getFirestore(app);
}

export const db: Firestore = dbInstance;
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

// Official GoogleAuthProvider configured with account picker (no invented redirect URIs)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Dedicated Google Drive scope provider for optional user backup
export const driveGoogleProvider = new GoogleAuthProvider();
driveGoogleProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveGoogleProvider.setCustomParameters({ prompt: 'consent' });

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAIN = firebaseConfig.authDomain;

// Lightweight UX-only redirect hint (never stores credentials, tokens, or logout triggers)
const GOOGLE_REDIRECT_PENDING_KEY = 'fabro_google_redirect_hint_v2';
const GOOGLE_REDIRECT_TTL_MS = 3 * 60 * 1000;

export function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isInstalledDeviceApp(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneDisplay =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches);
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
  const androidTwa =
    typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
  const desktopWrapper =
    '__TAURI__' in window ||
    (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent));
  return standaloneDisplay || iosStandalone || androidTwa || desktopWrapper;
}

export function markPendingGoogleRedirect(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, String(Date.now()));
  } catch {
    // ignore storage restriction
  }
}

export function clearPendingGoogleRedirect(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
  } catch {
    // ignore storage restriction
  }
}

export function hasPendingGoogleRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > GOOGLE_REDIRECT_TTL_MS) {
      window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Official Firebase session persistence (browserLocalPersistence).
 * Awaited once before auth actions so sessions survive page reloads,
 * browser restarts, and cross-origin Google OAuth redirects reliably.
 */
let persistenceInitPromise: Promise<boolean> | null = null;

export function ensureAuthPersistence(): Promise<boolean> {
  if (persistenceInitPromise) return persistenceInitPromise;
  persistenceInitPromise = setPersistence(auth, browserLocalPersistence)
    .then(() => true)
    .catch((err) => {
      console.warn('[FABRO Auth] No se pudo configurar browserLocalPersistence:', err);
      return false;
    });
  return persistenceInitPromise;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnectionOnce(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
