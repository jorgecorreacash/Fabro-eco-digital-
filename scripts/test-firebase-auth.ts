import assert from 'node:assert/strict';
import { getApps } from 'firebase/app';
import { app, auth, db, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID } from '../src/lib/firebase';
import {
  buildUserProfileWritePayload,
  DEFAULT_FREE_STORAGE_QUOTA_BYTES,
  detectPrimaryProvider,
  mapFirebaseAuthError,
  requiresEmailVerification,
  resolveAuthStateFromUser,
  validateEmailAddress,
  validatePasswordInput,
} from '../src/services/firebaseAuthService';

function runTests() {
  console.log('1. Verifying single-instance Firebase initialization...');
  assert.equal(getApps().length, 1, 'Expected exactly 1 Firebase App instance');
  assert.ok(app && auth && db, 'Firebase app, auth, and db must be initialized');
  assert.equal(FIREBASE_PROJECT_ID, 'gen-lang-client-0243900704');
  assert.equal(FIREBASE_AUTH_DOMAIN, 'gen-lang-client-0243900704.firebaseapp.com');

  console.log('2. Verifying 6-state Auth Machine transitions...');
  assert.equal(resolveAuthStateFromUser(null, false), 'UNAUTHENTICATED');
  assert.equal(resolveAuthStateFromUser(null, true), 'ERROR');
  assert.equal(
    resolveAuthStateFromUser(
      { emailVerified: false, providerData: [{ providerId: 'password' } as never] },
      false
    ),
    'EMAIL_VERIFICATION_REQUIRED'
  );
  assert.equal(
    resolveAuthStateFromUser(
      { emailVerified: true, providerData: [{ providerId: 'password' } as never] },
      false
    ),
    'AUTHENTICATED'
  );
  assert.equal(
    resolveAuthStateFromUser(
      { emailVerified: true, providerData: [{ providerId: 'google.com' } as never] },
      false
    ),
    'AUTHENTICATED'
  );

  console.log('3. Verifying provider detection & email verification rules...');
  assert.equal(
    detectPrimaryProvider({ providerData: [{ providerId: 'google.com' } as never] }),
    'google.com'
  );
  assert.equal(
    detectPrimaryProvider({ providerData: [{ providerId: 'password' } as never] }),
    'password'
  );
  assert.equal(
    requiresEmailVerification({
      emailVerified: false,
      providerData: [{ providerId: 'password' } as never],
    }),
    true
  );
  assert.equal(
    requiresEmailVerification({
      emailVerified: true,
      providerData: [{ providerId: 'google.com' } as never],
    }),
    false
  );

  console.log('4. Verifying Spanish email & password validations...');
  assert.equal(validateEmailAddress('').valid, false);
  assert.equal(validateEmailAddress('correo-invalido').valid, false);
  const okEmail = validateEmailAddress('  Sofi@Fabro.App  ');
  assert.equal(okEmail.valid, true);
  assert.equal(okEmail.clean, 'sofi@fabro.app');

  assert.equal(validatePasswordInput('', 'login').valid, false);
  assert.equal(validatePasswordInput('12345', 'register').valid, false);
  assert.equal(validatePasswordInput('ClaveSegura123', 'register').valid, true);

  console.log('5. Verifying Spanish Firebase Auth error mapping...');
  const codes = [
    'auth/invalid-credential',
    'auth/email-already-in-use',
    'auth/weak-password',
    'auth/popup-closed-by-user',
    'auth/popup-blocked',
    'auth/redirect-cancelled-by-user',
    'auth/unauthorized-domain',
    'auth/operation-not-allowed',
    'auth/network-request-failed',
    'auth/too-many-requests',
    'auth/timeout',
  ];
  for (const code of codes) {
    const mapped = mapFirebaseAuthError({ code });
    assert.equal(mapped.code, code);
    assert.ok(mapped.message.length > 15, `Expected clear Spanish message for ${code}`);
  }

  console.log('6. Verifying non-destructive Firestore users/{uid} profile creation & merge...');
  const fakeTs = () => 'SERVER_TS';
  const mockGoogleUser = {
    uid: 'user_abc_123',
    displayName: 'Sofía Google',
    email: 'sofia@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/photo.jpg',
    emailVerified: true,
    providerData: [{ providerId: 'google.com' } as never],
  };

  // First login -> CREATE with all canonical fields
  const created = buildUserProfileWritePayload(null, mockGoogleUser, undefined, fakeTs);
  assert.equal(created.mode, 'create');
  assert.equal(created.payload.uid, 'user_abc_123');
  assert.equal(created.payload.displayName, 'Sofía Google');
  assert.equal(created.payload.email, 'sofia@gmail.com');
  assert.equal(created.payload.photoURL, 'https://lh3.googleusercontent.com/photo.jpg');
  assert.equal(created.payload.createdAt, 'SERVER_TS');
  assert.equal(created.payload.lastLoginAt, 'SERVER_TS');
  assert.equal(created.payload.provider, 'google.com');
  assert.equal(created.payload.emailVerified, true);
  assert.equal(created.payload.plan, 'free');
  assert.equal(created.payload.planTier, 'free');
  assert.equal(created.payload.storageQuota, DEFAULT_FREE_STORAGE_QUOTA_BYTES);
  assert.equal('password' in created.payload, false, 'Password must NEVER be stored in Firestore');

  // Subsequent login -> UPDATE must NEVER overwrite existing personal data
  const existingUserDoc = {
    uid: 'user_abc_123',
    displayName: 'Sofía Personalizada',
    email: 'sofia@gmail.com',
    photoURL: 'https://custom.avatar/sofia.png',
    createdAt: 'ORIGINAL_CREATED_TS',
    plan: 'free',
    planTier: 'free',
    storageQuota: DEFAULT_FREE_STORAGE_QUOTA_BYTES,
  };
  const updated = buildUserProfileWritePayload(existingUserDoc, mockGoogleUser, undefined, fakeTs);
  assert.equal(updated.mode, 'update');
  assert.equal('displayName' in updated.payload, false, 'Must NOT overwrite custom displayName');
  assert.equal('photoURL' in updated.payload, false, 'Must NOT overwrite custom photoURL');
  assert.equal('createdAt' in updated.payload, false, 'Must NOT overwrite original createdAt');
  assert.equal('plan' in updated.payload, false, 'Must NOT overwrite existing plan');
  assert.equal('storageQuota' in updated.payload, false, 'Must NOT overwrite existing storageQuota');
  assert.equal(updated.payload.lastLoginAt, 'SERVER_TS');
  assert.equal(updated.payload.updatedAt, 'SERVER_TS');
  assert.equal(updated.payload.provider, 'google.com');
  assert.equal(updated.payload.emailVerified, true);

  console.log('ALL FIREBASE AUTH UNIT TESTS PASSED (6/6 suites).');
}

runTests();
