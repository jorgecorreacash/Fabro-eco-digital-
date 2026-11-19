import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
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
import { getStorage } from 'firebase/storage';
import firebaseConfig, { firestoreDatabaseId } from '../firebaseConfig.js';

const app = initializeApp(firebaseConfig);

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
  dbInstance = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
}

export const db = dbInstance;
export const auth = getAuth(app);

export const AUTH_WEB_SESSION_KEY = 'fabro_active_web_session_v1';
let inMemoryWebSessionActive = false;

export function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function markWebSessionActive(): void {
  inMemoryWebSessionActive = true;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_WEB_SESSION_KEY, '1');
  } catch {
    // ignore partitioned/restricted storage in iframes
  }
}

export function clearWebSessionActive(): void {
  inMemoryWebSessionActive = false;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(AUTH_WEB_SESSION_KEY);
  } catch {
    // ignore storage restriction
  }
}

export function hasWebSessionActive(): boolean {
  if (inMemoryWebSessionActive) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(AUTH_WEB_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Returns true ONLY when FABRO is running as an installed app on the user's device
 * (installed PWA standalone/fullscreen/minimal-ui, iOS Home Screen, Android TWA, or desktop wrapper).
 * Regular browser tabs return false so sessions never stay open after closing the browser.
 */
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

let persistencePromise: Promise<'local' | 'session'> | null = null;

export function enforceDeviceSessionPersistence(): Promise<'local' | 'session'> {
  if (persistencePromise) return persistencePromise;
  const installed = isInstalledDeviceApp();
  persistencePromise = setPersistence(
    auth,
    installed ? browserLocalPersistence : browserSessionPersistence
  )
    .then(() => (installed ? ('local' as const) : ('session' as const)))
    .catch(() => (installed ? ('local' as const) : ('session' as const)));
  return persistencePromise;
}

void enforceDeviceSessionPersistence();

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const driveGoogleProvider = new GoogleAuthProvider();
driveGoogleProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveGoogleProvider.setCustomParameters({ prompt: 'consent' });

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

async function testConnection() {
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

onAuthStateChanged(auth, (user) => {
  if (user) {
    void testConnection();
  }
});
