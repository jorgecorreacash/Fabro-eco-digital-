import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';

function resolveFirebaseProjectId(): string {
  const fromEnv = (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
      if (parsed.projectId && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
    // fallback below
  }
  return 'gen-lang-client-0243900704';
}

export const FIREBASE_PROJECT_ID = resolveFirebaseProjectId();
const SECURE_TOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
export const SUPERADMIN_EMAIL = 'jorgecorreasp@gmail.com';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let certCache: CertCache | null = null;
let certFetchPromise: Promise<Record<string, string>> | null = null;

// Admin checker callback injected from freemiumStore to break circular imports cleanly
let adminEmailOrUidResolver: ((uid: string, email: string) => boolean) | null = null;
export function registerAdminResolver(fn: (uid: string, email: string) => boolean) {
  adminEmailOrUidResolver = fn;
}

// Optional in-memory verifier used exclusively by automated tests
type TestTokenVerifier = (token: string) => Promise<AuthenticatedUser | null>;
let testTokenVerifier: TestTokenVerifier | null = null;
export function setTestTokenVerifierForTests(verifier: TestTokenVerifier | null) {
  testTokenVerifier = verifier;
}

function base64UrlToBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.expiresAtMs > now) {
    return certCache.certs;
  }
  if (certFetchPromise) {
    return certFetchPromise;
  }

  certFetchPromise = (async () => {
    try {
      const resp = await fetch(SECURE_TOKEN_CERTS_URL, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        if (certCache) return certCache.certs;
        throw new Error(`No se pudieron obtener certificados públicos de Firebase (${resp.status})`);
      }
      const cacheControl = resp.headers.get('cache-control') || '';
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
      const maxAgeSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 3600;
      const certs = (await resp.json()) as Record<string, string>;
      certCache = {
        certs,
        expiresAtMs: Date.now() + maxAgeSec * 1000,
      };
      return certs;
    } finally {
      certFetchPromise = null;
    }
  })();

  return certFetchPromise;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<AuthenticatedUser> {
  const cleanToken = String(idToken || '').trim();
  if (!cleanToken) {
    throw new Error('TOKEN_MISSING');
  }

  if (testTokenVerifier) {
    const mocked = await testTokenVerifier(cleanToken);
    if (mocked) return mocked;
    throw new Error('TOKEN_INVALID');
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    throw new Error('TOKEN_MALFORMED');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    user_id?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
  };

  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf8'));
  } catch {
    throw new Error('TOKEN_PARSE_ERROR');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('TOKEN_ALG_INVALID');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('TOKEN_EXPIRED');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('TOKEN_IAT_INVALID');
  }
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error('TOKEN_AUD_INVALID');
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error('TOKEN_ISS_INVALID');
  }

  const uid = String(payload.sub || payload.user_id || '').trim();
  if (!uid || uid.length > 128) {
    throw new Error('TOKEN_SUB_INVALID');
  }

  const certs = await fetchGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    // Force refresh once in case Google rotated keys
    certCache = null;
    const refreshed = await fetchGooglePublicCerts();
    if (!refreshed[header.kid]) {
      throw new Error('TOKEN_KID_UNKNOWN');
    }
    const ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      refreshed[header.kid],
      base64UrlToBuffer(signatureB64)
    );
    if (!ok) throw new Error('TOKEN_SIGNATURE_INVALID');
  } else {
    const ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      certPem,
      base64UrlToBuffer(signatureB64)
    );
    if (!ok) throw new Error('TOKEN_SIGNATURE_INVALID');
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const emailVerified = Boolean(payload.email_verified);
  const isSuperAdmin = email === SUPERADMIN_EMAIL && emailVerified;
  const isDelegatedAdmin = emailVerified && Boolean(adminEmailOrUidResolver?.(uid, email));

  return {
    uid,
    email,
    displayName: String(payload.name || email.split('@')[0] || 'Estudiante').slice(0, 120),
    emailVerified,
    isSuperAdmin,
    isAdmin: isSuperAdmin || isDelegatedAdmin,
  };
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Se requiere iniciar sesión con una cuenta verificada para usar las herramientas de IA de FABRO.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }
    const user = await verifyFirebaseIdToken(token);
    if (!user.emailVerified) {
      res.status(403).json({
        error: 'Verificá tu correo electrónico antes de realizar consultas con IA.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }
    req.authUser = user;
    next();
  } catch (err) {
    const code = err instanceof Error ? err.message : 'TOKEN_INVALID';
    res.status(401).json({
      error:
        code === 'TOKEN_EXPIRED'
          ? 'Tu sesión expiró. Recargá o volvé a iniciar sesión para continuar.'
          : 'Credencial de sesión inválida. Iniciá sesión nuevamente en FABRO.',
      code,
    });
  }
}

export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (token) {
      const user = await verifyFirebaseIdToken(token);
      if (user.emailVerified) {
        req.authUser = user;
      }
    }
  } catch {
    // Optional auth proceeds anonymously
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Sesión administrativa requerida.', code: 'AUTH_REQUIRED' });
    return;
  }
  if (!req.authUser.isAdmin) {
    res.status(403).json({
      error: 'Acceso restringido al equipo de administración de FABRO.',
      code: 'ADMIN_REQUIRED',
    });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Sliding-window Anti-Spam Protection (per-user & per-IP)
// ---------------------------------------------------------------------------
const slidingWindows = new Map<string, number[]>();

export function checkAntiSpamWindow(key: string, maxPerMinute: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowStart = now - 60_000;
  const current = (slidingWindows.get(key) || []).filter((ts) => ts > windowStart);
  if (current.length >= Math.max(1, maxPerMinute)) {
    const oldest = current[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
    slidingWindows.set(key, current);
    return { allowed: false, retryAfterSec };
  }
  current.push(now);
  slidingWindows.set(key, current);
  return { allowed: true, retryAfterSec: 0 };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function resetAntiSpamWindowsForTests() {
  slidingWindows.clear();
}
