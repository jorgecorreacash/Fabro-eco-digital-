import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  auth,
  clearPendingGoogleRedirect,
  db,
  ensureAuthPersistence,
  googleProvider,
  handleFirestoreError,
  hasPendingGoogleRedirect,
  isEmbeddedIframe,
  isInstalledDeviceApp,
  markPendingGoogleRedirect,
  OperationType,
} from '../lib/firebase';

/**
 * Explicit Authentication State Machine required by FABRO.
 */
export type AuthMachineState =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ERROR';

export interface AuthActionResult {
  ok: boolean;
  code?: string;
  error?: string;
  redirectStarted?: boolean;
  requiresEmailVerification?: boolean;
  user?: User;
}

export interface CanonicalUserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastLoginAt: unknown;
  provider: 'google.com' | 'password' | 'firebase' | 'unknown';
  emailVerified: boolean;
  plan: 'free' | 'premium';
  planTier: 'free' | 'premium';
  storageQuota: number;
  storageUsedBytes: number;
  educationLevel: 'primaria' | 'secundaria' | 'terciario' | 'universitario' | 'posgrado' | 'autodidacta';
  weeklyGoalHours: number;
  themePreference: 'dark' | 'light' | 'system';
  username?: string;
  customFabroId?: string;
  birthDate?: string;
  isMinor?: boolean;
}

export const DEFAULT_FREE_STORAGE_QUOTA_BYTES = 104_857_600; // 100 MB (Spark free tier safe default)
export const AUTH_OPERATION_TIMEOUT_MS = 90_000;

export function detectPrimaryProvider(
  user: Pick<User, 'providerData'>
): CanonicalUserProfileRecord['provider'] {
  const providers = Array.isArray(user.providerData)
    ? user.providerData.map((p) => p?.providerId).filter(Boolean)
    : [];
  if (providers.includes('google.com')) return 'google.com';
  if (providers.includes('password')) return 'password';
  if (providers.length > 0) return 'firebase';
  return 'unknown';
}

/**
 * Determines whether a Firebase Auth user requires email verification before accessing
 * verified Firestore resources. Google accounts are pre-verified by Google.
 */
export function requiresEmailVerification(
  user: Pick<User, 'emailVerified' | 'providerData'> | null
): boolean {
  if (!user) return false;
  if (user.emailVerified) return false;
  const provider = detectPrimaryProvider(user);
  return provider === 'password';
}

/**
 * Pure state machine transition resolver from a Firebase Auth user snapshot.
 */
export function resolveAuthStateFromUser(
  user: Pick<User, 'emailVerified' | 'providerData'> | null,
  hasActiveError = false
): AuthMachineState {
  if (user) {
    return requiresEmailVerification(user)
      ? 'EMAIL_VERIFICATION_REQUIRED'
      : 'AUTHENTICATED';
  }
  return hasActiveError ? 'ERROR' : 'UNAUTHENTICATED';
}

/**
 * Pure Spanish validation for email addresses.
 */
export function validateEmailAddress(rawEmail: string): { valid: boolean; clean: string; error?: string } {
  const clean = rawEmail.trim().toLowerCase();
  if (!clean) {
    return { valid: false, clean, error: 'Ingresá tu dirección de correo electrónico.' };
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailPattern.test(clean) || clean.length > 200) {
    return { valid: false, clean, error: 'El formato del correo electrónico no es válido.' };
  }
  return { valid: true, clean };
}

/**
 * Pure Spanish validation for passwords.
 */
export function validatePasswordInput(
  password: string,
  mode: 'login' | 'register'
): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Ingresá tu contraseña.' };
  }
  if (mode === 'register' && password.length < 6) {
    return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'La contraseña no puede superar los 128 caracteres.' };
  }
  return { valid: true };
}

/**
 * Translates Firebase Auth error codes into clear, actionable Spanish messages.
 */
export function mapFirebaseAuthError(err: unknown): { code: string; message: string } {
  const code = (err as { code?: string })?.code || '';
  const rawMessage = err instanceof Error ? err.message : '';

  if (
    code === 'auth/network-request-failed' ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return {
      code: code || 'auth/network-request-failed',
      message: 'Sin conexión a internet. Verificá tu red y volvé a intentarlo.',
    };
  }

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        code,
        message: 'Correo electrónico o contraseña incorrectos. Verificá tus datos e intentá nuevamente.',
      };
    case 'auth/email-already-in-use':
      return {
        code,
        message: 'Ya existe una cuenta registrada con ese correo. Probá iniciar sesión o recuperar tu contraseña.',
      };
    case 'auth/weak-password':
      return {
        code,
        message: 'La contraseña es demasiado débil. Usá al menos 6 caracteres combinando letras y números.',
      };
    case 'auth/invalid-email':
      return {
        code,
        message: 'El formato del correo electrónico no es válido.',
      };
    case 'auth/user-disabled':
      return {
        code,
        message: 'Esta cuenta se encuentra deshabilitada. Contactá al soporte de FABRO.',
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        message: 'Se canceló o cerró la ventana de acceso de Google antes de completar el ingreso.',
      };
    case 'auth/popup-blocked':
      return {
        code,
        message: 'El navegador bloqueó la ventana emergente de Google. Usá el acceso por redirección directa.',
      };
    case 'auth/redirect-cancelled-by-user':
    case 'auth/redirect-operation-pending':
      return {
        code,
        message: 'El inicio de sesión con Google fue cancelado o quedó pendiente. Podés reintentar ahora.',
      };
    case 'auth/unauthorized-domain': {
      const host =
        typeof window !== 'undefined' && window.location?.hostname
          ? window.location.hostname
          : 'este dominio';
      return {
        code,
        message: `El dominio «${host}» todavía no está autorizado en Firebase Console (Authentication > Settings > Authorized domains). Agregalo allí para habilitar el inicio de sesión.`,
      };
    }
    case 'auth/operation-not-allowed':
      return {
        code,
        message:
          'Este método de acceso todavía no está activado en Firebase Console (Authentication > Sign-in method).',
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Demasiados intentos en poco tiempo. Esperá unos minutos y volvé a intentarlo.',
      };
    case 'auth/requires-recent-login':
      return {
        code,
        message: 'Por seguridad, volvé a iniciar sesión antes de realizar esta acción.',
      };
    case 'auth/internal-error':
      return {
        code,
        message:
          'Error interno al conectar con Firebase Authentication. Verificá tu conexión o intentá en una pestaña directa.',
      };
    case 'auth/timeout':
      return {
        code,
        message:
          'La autenticación tardó demasiado en responder. Verificá tu conexión y tocá «Reintentar».',
      };
    default:
      return {
        code: code || 'auth/unknown',
        message: rawMessage || 'No se pudo completar la autenticación. Intentá nuevamente.',
      };
  }
}

/**
 * Pure non-destructive profile builder for Firestore `users/{uid}`.
 * - On FIRST login (existingData == null): creates complete canonical document.
 * - On SUBSEQUENT logins (existingData != null): NEVER overwrites existing personal fields
 *   (displayName, photoURL, createdAt, plan, planTier, storageQuota, etc.). Only refreshes
 *   login metadata (lastLoginAt, provider, emailVerified, updatedAt) and backfills missing fields.
 */
export function buildUserProfileWritePayload(
  existingData: Record<string, unknown> | null,
  fbUser: Pick<User, 'uid' | 'displayName' | 'email' | 'photoURL' | 'emailVerified' | 'providerData'>,
  overrides?: {
    displayName?: string;
    username?: string;
    customFabroId?: string;
    birthDate?: string;
    isMinor?: boolean;
  },
  timestampFactory: () => unknown = () => serverTimestamp()
): { mode: 'create' | 'update'; payload: Record<string, unknown> } {
  const provider = detectPrimaryProvider(fbUser);
  const nowTs = timestampFactory();
  const safeEmail = (fbUser.email || '').trim().slice(0, 200);
  const fallbackName =
    (overrides?.displayName || fbUser.displayName || safeEmail.split('@')[0] || 'Usuario FABRO')
      .trim()
      .slice(0, 100) || 'Usuario FABRO';

  if (!existingData) {
    const createDoc: Record<string, unknown> = {
      uid: fbUser.uid,
      displayName: fallbackName,
      email: safeEmail || `${fbUser.uid}@fabro.local`,
      photoURL: (fbUser.photoURL || '').slice(0, 1000),
      createdAt: nowTs,
      updatedAt: nowTs,
      lastLoginAt: nowTs,
      provider,
      emailVerified: Boolean(fbUser.emailVerified),
      plan: 'free',
      planTier: 'free',
      storageQuota: DEFAULT_FREE_STORAGE_QUOTA_BYTES,
      storageUsedBytes: 0,
      educationLevel: 'universitario',
      weeklyGoalHours: 10,
      themePreference: 'system',
      ...(overrides?.username ? { username: overrides.username.slice(0, 50) } : {}),
      ...(overrides?.customFabroId ? { customFabroId: overrides.customFabroId.slice(0, 40) } : {}),
      ...(overrides?.birthDate ? { birthDate: overrides.birthDate.slice(0, 20) } : {}),
      ...(typeof overrides?.isMinor === 'boolean' ? { isMinor: overrides.isMinor } : {}),
    };
    return { mode: 'create', payload: createDoc };
  }

  // Subsequent login: NEVER overwrite existing personal data or createdAt/plan/quota.
  const patch: Record<string, unknown> = {
    lastLoginAt: nowTs,
    updatedAt: nowTs,
    provider,
    emailVerified: Boolean(fbUser.emailVerified),
  };

  // Only backfill strictly missing personal fields (never overwrite user edits)
  if (!existingData.displayName && fallbackName) {
    patch.displayName = fallbackName;
  }
  if (!existingData.photoURL && fbUser.photoURL) {
    patch.photoURL = fbUser.photoURL.slice(0, 1000);
  }
  if (!existingData.username && overrides?.username) {
    patch.username = overrides.username.slice(0, 50);
  }
  if (!existingData.customFabroId && overrides?.customFabroId) {
    patch.customFabroId = overrides.customFabroId.slice(0, 40);
  }

  return { mode: 'update', payload: patch };
}

/**
 * Creates or safely updates `users/{uid}` ONLY after verified identity confirmation.
 * Preserves existing user documents without overwriting personal data.
 */
export async function ensureCanonicalUserProfile(
  fbUser: User,
  overrides?: {
    displayName?: string;
    username?: string;
    customFabroId?: string;
    birthDate?: string;
    isMinor?: boolean;
  }
): Promise<void> {
  if (!fbUser?.uid || requiresEmailVerification(fbUser)) {
    return;
  }

  const userDocRef = doc(db, 'users', fbUser.uid);
  const path = `users/${fbUser.uid}`;

  try {
    const snap = await getDoc(userDocRef);
    const existingData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
    const { mode, payload } = buildUserProfileWritePayload(existingData, fbUser, overrides);

    if (mode === 'create') {
      await setDoc(userDocRef, payload);
    } else {
      await setDoc(userDocRef, payload, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Single-execution guard for `getRedirectResult(auth)`.
 * Guarantees `getRedirectResult()` is invoked at most ONCE per page load,
 * preventing duplicate calls, swallowed errors, and redirect loops.
 */
export interface RedirectResolutionResult {
  credential: UserCredential | null;
  error?: { code: string; message: string };
}

let redirectResultPromise: Promise<RedirectResolutionResult> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeoutValue: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(onTimeoutValue), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function resolveGoogleRedirectOnce(): Promise<RedirectResolutionResult> {
  if (redirectResultPromise) return redirectResultPromise;

  const expectingRedirect = hasPendingGoogleRedirect();
  // Give a genuine redirect return up to 10s on mobile networks, while normal loads finish in <=2.5s.
  const timeoutMs = expectingRedirect ? 10_000 : 2500;

  redirectResultPromise = (async () => {
    try {
      const credential = await withTimeout<UserCredential | null>(
        getRedirectResult(auth, browserPopupRedirectResolver),
        timeoutMs,
        null
      );
      clearPendingGoogleRedirect();
      return { credential };
    } catch (err) {
      clearPendingGoogleRedirect();
      const mapped = mapFirebaseAuthError(err);
      return { credential: null, error: mapped };
    }
  })();

  return redirectResultPromise;
}

/**
 * Reset helper strictly for automated tests (never called in production runtime).
 */
export function __resetRedirectGuardForTests(): void {
  redirectResultPromise = null;
}

/**
 * Initiates Google Authentication via Firebase.
 * CRITICAL: Calls `signInWithPopup()` SYNCHRONOUSLY (zero `await` before it!) so Chrome,
 * Safari, Edge, and mobile browsers preserve transient user activation for `window.open()`.
 * Persistence is already configured at startup in `initializeAuth()`.
 * Automatically falls back to `signInWithRedirect()` in standalone PWAs or when the browser
 * blocks/instantly closes the popup (< 1.8s).
 */
export async function startGoogleSignIn(options?: {
  forcePopupInIframe?: boolean;
}): Promise<AuthActionResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      code: 'auth/network-request-failed',
      error: 'Sin conexión a internet. Conectate a una red para iniciar sesión con Google.',
    };
  }

  const inIframe = isEmbeddedIframe();
  const inStandalonePwa = isInstalledDeviceApp();

  // Installed standalone PWAs on Android/iOS isolate popups into external Custom Tabs / Safari sheets
  // which immediately trigger `auth/popup-closed-by-user`. Use official redirect directly in standalone PWA.
  if (inStandalonePwa && !inIframe && !options?.forcePopupInIframe) {
    try {
      markPendingGoogleRedirect();
      await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
      return { ok: true, redirectStarted: true };
    } catch (err) {
      clearPendingGoogleRedirect();
      const mapped = mapFirebaseAuthError(err);
      return { ok: false, code: mapped.code, error: mapped.message };
    }
  }

  const popupStartedAt = Date.now();
  try {
    // MUST be the first async call (no preceding `await`) to preserve browser user-gesture activation!
    const cred = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    clearPendingGoogleRedirect();
    return { ok: true, user: cred.user };
  } catch (popupErr) {
    const elapsedMs = Date.now() - popupStartedAt;
    const mapped = mapFirebaseAuthError(popupErr);

    // If the browser/OS/COOP blocked or instantaneously killed the popup (< 1.8s),
    // fall back seamlessly to redirect on top-level windows.
    const instantAutoClosed = mapped.code === 'auth/popup-closed-by-user' && elapsedMs < 1800;
    const shouldFallbackToRedirect =
      !inIframe &&
      !options?.forcePopupInIframe &&
      (mapped.code === 'auth/popup-blocked' ||
        mapped.code === 'auth/operation-not-supported-in-this-environment' ||
        mapped.code === 'auth/web-storage-unsupported' ||
        instantAutoClosed);

    if (shouldFallbackToRedirect) {
      try {
        markPendingGoogleRedirect();
        await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
        return { ok: true, redirectStarted: true };
      } catch (redirErr) {
        clearPendingGoogleRedirect();
        const redirMapped = mapFirebaseAuthError(redirErr);
        return { ok: false, code: redirMapped.code, error: redirMapped.message };
      }
    }

    if (
      inIframe &&
      (mapped.code === 'auth/popup-closed-by-user' || mapped.code === 'auth/popup-blocked')
    ) {
      return {
        ok: false,
        code: mapped.code,
        error:
          'Estás dentro de una vista embebida donde Google bloquea ventanas emergentes. Tocá «Abrir FABRO en pestaña directa» para ingresar con Google sin restricciones.',
      };
    }

    clearPendingGoogleRedirect();
    return { ok: false, code: mapped.code, error: mapped.message };
  }
}

/**
 * Explicit official redirect trigger (always calls signInWithRedirect directly without preceding await).
 */
export async function startGoogleRedirectSignIn(): Promise<AuthActionResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      code: 'auth/network-request-failed',
      error: 'Sin conexión a internet. Conectate a una red para iniciar sesión con Google.',
    };
  }
  try {
    markPendingGoogleRedirect();
    await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
    return { ok: true, redirectStarted: true };
  } catch (err) {
    clearPendingGoogleRedirect();
    const mapped = mapFirebaseAuthError(err);
    return { ok: false, code: mapped.code, error: mapped.message };
  }
}

/**
 * Registers a new user with Firebase Email/Password and sends official verification email.
 * Passwords are NEVER saved to Firestore or localStorage.
 */
export async function registerWithEmailPassword(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthActionResult> {
  const emailCheck = validateEmailAddress(params.email);
  if (!emailCheck.valid) {
    return { ok: false, code: 'auth/invalid-email', error: emailCheck.error };
  }
  const pwCheck = validatePasswordInput(params.password, 'register');
  if (!pwCheck.valid) {
    return { ok: false, code: 'auth/weak-password', error: pwCheck.error };
  }
  const cleanName = params.displayName.trim().slice(0, 100);
  if (!cleanName) {
    return { ok: false, code: 'auth/missing-name', error: 'Ingresá tu nombre o apodo visible.' };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      code: 'auth/network-request-failed',
      error: 'Sin conexión a internet. Conectate a una red para crear tu cuenta.',
    };
  }

  try {
    await ensureAuthPersistence();
    const cred = await createUserWithEmailAndPassword(auth, emailCheck.clean, params.password);
    await updateProfile(cred.user, { displayName: cleanName });
    try {
      await sendEmailVerification(cred.user);
    } catch (verErr) {
      console.warn('[FABRO Auth] No se pudo enviar el correo de verificación inicial:', verErr);
    }
    return {
      ok: true,
      user: cred.user,
      requiresEmailVerification: !cred.user.emailVerified,
    };
  } catch (err) {
    const mapped = mapFirebaseAuthError(err);
    return { ok: false, code: mapped.code, error: mapped.message };
  }
}

/**
 * Signs in an existing user with Firebase Email/Password.
 */
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<AuthActionResult> {
  const emailCheck = validateEmailAddress(email);
  if (!emailCheck.valid) {
    return { ok: false, code: 'auth/invalid-email', error: emailCheck.error };
  }
  const pwCheck = validatePasswordInput(password, 'login');
  if (!pwCheck.valid) {
    return { ok: false, code: 'auth/missing-password', error: pwCheck.error };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      code: 'auth/network-request-failed',
      error: 'Sin conexión a internet. Conectate a una red para iniciar sesión.',
    };
  }

  try {
    await ensureAuthPersistence();
    const cred = await signInWithEmailAndPassword(auth, emailCheck.clean, password);
    return {
      ok: true,
      user: cred.user,
      requiresEmailVerification: requiresEmailVerification(cred.user),
    };
  } catch (err) {
    const mapped = mapFirebaseAuthError(err);
    return { ok: false, code: mapped.code, error: mapped.message };
  }
}

/**
 * Sends a Firebase password reset email.
 */
export async function sendFirebasePasswordReset(email: string): Promise<AuthActionResult> {
  const emailCheck = validateEmailAddress(email);
  if (!emailCheck.valid) {
    return { ok: false, code: 'auth/invalid-email', error: emailCheck.error };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      code: 'auth/network-request-failed',
      error: 'Sin conexión a internet. Conectate a una red para restablecer tu contraseña.',
    };
  }
  try {
    await sendPasswordResetEmail(auth, emailCheck.clean);
    return { ok: true };
  } catch (err) {
    const mapped = mapFirebaseAuthError(err);
    return { ok: false, code: mapped.code, error: mapped.message };
  }
}

/**
 * Re-sends email verification link for the currently signed-in unverified user.
 */
export async function resendVerificationEmailForCurrentUser(): Promise<AuthActionResult> {
  const current = auth.currentUser;
  if (!current) {
    return {
      ok: false,
      code: 'auth/no-current-user',
      error: 'No hay una sesión pendiente de verificación activa.',
    };
  }
  if (current.emailVerified) {
    return { ok: true, user: current, requiresEmailVerification: false };
  }
  try {
    await sendEmailVerification(current);
    return { ok: true, user: current, requiresEmailVerification: true };
  } catch (err) {
    const mapped = mapFirebaseAuthError(err);
    return { ok: false, code: mapped.code, error: mapped.message };
  }
}

/**
 * Reloads the current Firebase user and refreshes ID token claims to detect
 * email verification completion immediately.
 */
export async function reloadCurrentUserVerificationStatus(): Promise<{
  ok: boolean;
  verified: boolean;
  user: User | null;
  error?: string;
}> {
  const current = auth.currentUser;
  if (!current) {
    return { ok: false, verified: false, user: null, error: 'No hay sesión activa.' };
  }
  try {
    await current.reload();
    await current.getIdToken(true);
    return { ok: true, verified: Boolean(current.emailVerified), user: current };
  } catch (err) {
    const mapped = mapFirebaseAuthError(err);
    return { ok: false, verified: false, user: current, error: mapped.message };
  }
}

/**
 * Cleanly signs out of Firebase Authentication and clears any transient redirect hint.
 */
export async function signOutFirebaseSession(): Promise<void> {
  clearPendingGoogleRedirect();
  await signOut(auth);
}
