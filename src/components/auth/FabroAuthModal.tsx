import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { FIREBASE_PROJECT_ID, isEmbeddedIframe, isInstalledDeviceApp } from '../../lib/firebase';
import {
  checkUsernameAvailability,
  computeIsMinorFromBirthDate,
  normalizeHandle,
} from '../../services/cloudSyncService';
import {
  validateEmailAddress,
  validatePasswordInput,
} from '../../services/firebaseAuthService';

const GoogleFourColorLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

function evaluatePasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: 'Mínimo 6 caracteres', color: '#94A3B8' };
  let score = 1;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score += 1;
  if (score <= 1) return { score: 25, label: 'Débil', color: '#EF4444' };
  if (score === 2) return { score: 50, label: 'Aceptable', color: '#F59E0B' };
  if (score === 3) return { score: 75, label: 'Fuerte', color: '#0EA5E9' };
  return { score: 100, label: 'Muy segura', color: '#10B981' };
}

export const FabroAuthModal: React.FC = () => {
  const {
    authState,
    authError,
    pendingVerificationEmail,
    authModalOpen,
    authModalReason,
    authModalDefaultTab,
    closeAuthModal,
    clearAuthError,
    cancelAuthLoading,
    googleRedirectPending,
    signInWithGoogle,
    signInWithGoogleRedirect,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    checkEmailVerificationStatus,
    sendPasswordReset,
    signOutAccount,
  } = useEcosystem();

  const [tab, setTab] = useState<'login' | 'register'>(authModalDefaultTab);
  const [resetMode, setResetMode] = useState(false);

  // Shared & Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Handle availability
  const [handleState, setHandleState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'offline'
  >('idle');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authModalOpen) {
      setTab(authModalDefaultTab);
      setResetMode(false);
      setErrorMsg(authError?.message || null);
      setErrorCode(authError?.code || null);
      setInfoMsg(null);
    }
  }, [authModalOpen, authModalDefaultTab, authError]);

  // Live @usuario availability check (debounced)
  useEffect(() => {
    if (!authModalOpen || tab !== 'register') return;
    const clean = normalizeHandle(username);
    if (!clean) {
      setHandleState('idle');
      return;
    }
    if (clean.length < 3) {
      setHandleState('invalid');
      return;
    }
    setHandleState('checking');
    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(clean).then((status) => {
        setHandleState(status);
      });
    }, 380);
    return () => window.clearTimeout(timer);
  }, [authModalOpen, tab, username]);

  if (!authModalOpen) return null;

  const strength = evaluatePasswordStrength(password);
  const isMinorPreview = computeIsMinorFromBirthDate(birthDate);
  const inIframe = isEmbeddedIframe();
  const isBusy = submitting || googleRedirectPending || authState === 'AUTHENTICATING';

  const activeErrorMsg = errorMsg || authError?.message || null;
  const activeErrorCode = errorCode || authError?.code || null;

  const isOAuthWindowOrRedirectIssue =
    activeErrorCode === 'auth/popup-closed-by-user' ||
    activeErrorCode === 'auth/popup-blocked' ||
    activeErrorCode === 'auth/cancelled-popup-request' ||
    activeErrorCode === 'auth/redirect-cancelled-by-user' ||
    activeErrorCode === 'auth/timeout';

  const handleRetryClear = () => {
    setErrorMsg(null);
    setErrorCode(null);
    setInfoMsg(null);
    clearAuthError();
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);
    setInfoMsg(null);
    clearAuthError();
    const res = await signInWithGoogle();
    if (!res.redirectStarted) {
      setSubmitting(false);
    }
    if (!res.ok) {
      setSubmitting(false);
      setErrorMsg(res.error || 'No se pudo iniciar sesión con Google.');
      setErrorCode(res.code || null);
    }
  };

  const handleGoogleRedirectExplicit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);
    setInfoMsg(null);
    clearAuthError();
    const res = await signInWithGoogleRedirect();
    if (!res.ok) {
      setSubmitting(false);
      setErrorMsg(res.error || 'No se pudo redirigir al acceso de Google.');
      setErrorCode(res.code || null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.error || 'Correo electrónico inválido.');
      return;
    }
    const pwCheck = validatePasswordInput(password, 'login');
    if (!pwCheck.valid) {
      setErrorMsg(pwCheck.error || 'Ingresá tu contraseña.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);
    setInfoMsg(null);
    clearAuthError();
    const res = await signInWithEmail(emailCheck.clean, password);
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo iniciar sesión.');
      setErrorCode(res.code || null);
    } else if (res.requiresEmailVerification) {
      setInfoMsg('Tu cuenta requiere verificación de correo antes de sincronizar tus datos.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg('Ingresá tu nombre completo o apodo visible.');
      return;
    }
    const cleanHandle = normalizeHandle(username);
    if (cleanHandle.length < 3) {
      setErrorMsg('Tu @usuario de FABRO ID debe tener al menos 3 letras o números.');
      return;
    }
    if (handleState === 'taken') {
      setErrorMsg('Ese @usuario ya está en uso. Elegí otro.');
      return;
    }
    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.error || 'Correo electrónico inválido.');
      return;
    }
    const pwCheck = validatePasswordInput(password, 'register');
    if (!pwCheck.valid) {
      setErrorMsg(pwCheck.error || 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!termsAccepted) {
      setErrorMsg('Aceptá los Términos y Política de Privacidad para crear tu FABRO ID.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);
    setInfoMsg(null);
    clearAuthError();
    const res = await signUpWithEmail({
      displayName,
      username: cleanHandle,
      email: emailCheck.clean,
      password,
      birthDate,
    });
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo crear la cuenta.');
      setErrorCode(res.code || null);
    } else if (res.requiresEmailVerification) {
      setInfoMsg(
        'Cuenta creada. Te enviamos un correo de verificación para activar tu acceso seguro.'
      );
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.error || 'Escribí un correo electrónico válido.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    const res = await sendPasswordReset(emailCheck.clean);
    setSubmitting(false);
    if (res.ok) {
      setInfoMsg(
        'Te enviamos un correo de Firebase para restablecer tu contraseña. Revisá tu bandeja de entrada o spam.'
      );
    } else {
      setErrorMsg(res.error || 'No pudimos enviar el correo de recuperación.');
    }
  };

  const handleCheckVerification = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    const res = await checkEmailVerificationStatus();
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'No pudimos verificar el estado de tu cuenta.');
    } else if (!res.verified) {
      setErrorMsg(
        res.error ||
          'Tu correo todavía no aparece verificado. Tocá el enlace del correo y volvé a presionar este botón.'
      );
    }
  };

  const handleResendVerification = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    const res = await resendVerificationEmail();
    setSubmitting(false);
    if (res.ok) {
      setInfoMsg(
        'Reenviamos el correo de verificación. Revisá tu bandeja principal y la carpeta de spam.'
      );
    } else {
      setErrorMsg(res.error || 'No se pudo reenviar el correo de verificación.');
    }
  };

  const handleSwitchAccount = async () => {
    setSubmitting(true);
    await signOutAccount();
    setSubmitting(false);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) closeAuthModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="FABRO ID · Autenticación con Firebase"
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border-2 border-[#7C3AED] fabro-surface p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto fabro-screen-enter"
      >
        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#C4B5FD] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              FABRO ID · Firebase Authentication
            </p>
            <h2 className="font-display text-lg font-bold">
              {authState === 'INITIALIZING'
                ? 'Verificando tu sesión...'
                : authState === 'EMAIL_VERIFICATION_REQUIRED'
                ? 'Verificá tu correo electrónico'
                : resetMode
                ? 'Recuperar contraseña'
                : tab === 'login'
                ? 'Iniciá sesión en FABRO'
                : 'Creá tu FABRO ID gratis'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isBusy) cancelAuthLoading();
              closeAuthModal();
            }}
            aria-label="Cerrar ventana de acceso"
            className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STATE 1: INITIALIZING */}
        {authState === 'INITIALIZING' ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#7C3AED]" />
            <p className="text-sm font-bold">Comprobando sesión existente...</p>
            <p className="text-xs fabro-muted max-w-xs">
              Firebase Authentication está recuperando tu estado de sesión de forma segura.
            </p>
            <button
              type="button"
              onClick={cancelAuthLoading}
              className="mt-1 text-xs font-bold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
            >
              Mostrar opciones de ingreso ahora
            </button>
          </div>
        ) : authState === 'EMAIL_VERIFICATION_REQUIRED' ? (
          /* STATE 5: EMAIL_VERIFICATION_REQUIRED */
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 space-y-2 text-xs">
              <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                Confirmación pendiente
              </p>
              <p className="leading-relaxed">
                Enviamos un enlace de verificación a{' '}
                <span className="font-mono font-bold">
                  {pendingVerificationEmail || email || 'tu correo registrado'}
                </span>
                . Abrí ese enlace para proteger tu cuenta y habilitar la sincronización en la nube.
              </p>
            </div>

            {activeErrorMsg && (
              <div className="rounded-xl border-2 border-rose-500/50 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{activeErrorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleCheckVerification()}
                className="w-full min-h-[46px] rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Ya verifiqué mi correo · Entrar ahora
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleResendVerification()}
                className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                Reenviar correo de verificación
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSwitchAccount()}
                className="w-full min-h-[40px] rounded-xl text-xs font-semibold fabro-muted hover:underline inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión o usar otra cuenta
              </button>
            </div>
          </div>
        ) : (
          /* STATES: UNAUTHENTICATED | AUTHENTICATING | ERROR */
          <>
            {authModalReason && (
              <div className="rounded-xl border-2 border-[#0EA5E9]/45 bg-[#0EA5E9]/10 px-3.5 py-2.5 text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8]">
                Creá o iniciá sesión con tu FABRO ID para {authModalReason}. Tus apuntes y tareas
                locales se migrarán automáticamente.
              </div>
            )}

            <div className="rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5 text-[11px] fabro-muted flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Sesión protegida exclusivamente con Firebase Authentication y persistencia oficial
                segura. Tu contraseña nunca se guarda en Firestore ni en localStorage.
              </span>
            </div>

            {/* Tabs */}
            {!resetMode && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border-2 fabro-border fabro-surface-elevated">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setTab('login');
                    handleRetryClear();
                  }}
                  className={`min-h-[42px] rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    tab === 'login'
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'fabro-muted hover:opacity-100'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setTab('register');
                    handleRetryClear();
                  }}
                  className={`min-h-[42px] rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    tab === 'register'
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'fabro-muted hover:opacity-100'
                  }`}
                >
                  Crear Cuenta Nueva
                </button>
              </div>
            )}

            {/* Primary Google Authentication Button (Redirect-first) */}
            {!resetMode && (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleGoogle()}
                  className="w-full min-h-[48px] rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-xs font-extrabold inline-flex items-center justify-center gap-3 shadow-sm hover:border-[#4285F4] cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#4285F4]" />
                  ) : (
                    <GoogleFourColorLogo />
                  )}
                  <span>
                    {isBusy
                      ? 'Conectando con Google...'
                      : 'Continuar con Google'}
                  </span>
                </button>

                {isBusy && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#7C3AED]/35 bg-[#7C3AED]/8 px-3 py-2 text-[11px]">
                    <span className="font-semibold">Autenticando con Firebase...</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitting(false);
                        cancelAuthLoading();
                      }}
                      className="font-bold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-center fabro-muted">
                  Acceso oficial con Google vía Firebase Authentication (ventana directa y respaldo automático).
                </p>

                {!inIframe && !isBusy && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => void handleGoogleRedirectExplicit()}
                      className="text-[11px] font-semibold text-[#0284C7] dark:text-[#38BDF8] hover:underline cursor-pointer"
                    >
                      {isInstalledDeviceApp()
                        ? 'En app PWA instalada: probar ingreso por redirección'
                        : '¿No se abre la ventana de Google? Ingresar por redirección'}
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] fabro-muted">
                  <div className="h-px flex-1 bg-[var(--fabro-border)]" />
                  <span>o con tu correo</span>
                  <div className="h-px flex-1 bg-[var(--fabro-border)]" />
                </div>
              </>
            )}

            {/* STATE 6: ERROR banner with clear recovery actions */}
            {activeErrorMsg && (
              <div
                role="alert"
                className="rounded-xl border-2 border-rose-500/50 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-2.5"
              >
                <p className="font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{activeErrorMsg}</span>
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleRetryClear}
                    className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 px-3 py-1 text-[11px] font-bold hover:bg-rose-500/10 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reintentar
                  </button>

                  {isOAuthWindowOrRedirectIssue && inIframe && (
                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '/'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] text-white px-3 py-1 text-[11px] font-bold hover:bg-[#0369A1]"
                    >
                      <span>Abrir FABRO en pestaña directa</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {isOAuthWindowOrRedirectIssue && !inIframe && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleGoogleRedirectExplicit()}
                      className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] text-white px-3 py-1 text-[11px] font-bold hover:bg-[#0369A1] cursor-pointer disabled:opacity-60"
                    >
                      <span>Ingresar por redirección oficial</span>
                    </button>
                  )}
                </div>

                {activeErrorCode === 'auth/unauthorized-domain' && (
                  <div className="rounded-lg border border-rose-500/35 bg-rose-500/5 p-2.5 text-[11px] space-y-2">
                    <p className="font-bold">Cómo autorizar este dominio en 10 segundos:</p>
                    <p className="leading-relaxed">
                      En Firebase Console (proyecto <strong className="font-mono">{FIREBASE_PROJECT_ID}</strong>) →{' '}
                      <strong>Authentication</strong> → <strong>Settings</strong> →{' '}
                      <strong>Authorized domains</strong> → <strong>Add domain</strong>, agregá exactamente:
                    </p>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-black/10 dark:bg-white/10 px-2.5 py-1.5 font-mono text-[11px]">
                      <span className="truncate">
                        {typeof window !== 'undefined' ? window.location.hostname : 'fabroeco.netlify.app'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const h =
                            typeof window !== 'undefined'
                              ? window.location.hostname
                              : 'fabroeco.netlify.app';
                          void navigator.clipboard?.writeText(h);
                          setInfoMsg(`Dominio «${h}» copiado al portapapeles.`);
                        }}
                        className="font-sans font-bold underline shrink-0 cursor-pointer"
                      >
                        Copiar
                      </button>
                    </div>
                    <a
                      href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold underline text-rose-800 dark:text-rose-200"
                    >
                      <span>Abrir Firebase Console → Authorized domains</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {activeErrorCode && (
                  <p className="text-[10px] font-mono opacity-80">
                    Código: {activeErrorCode} · Dominio:{' '}
                    {typeof window !== 'undefined' ? window.location.hostname : '-'}
                  </p>
                )}

                {activeErrorCode === 'auth/operation-not-allowed' && (
                  <p className="text-[11px] leading-relaxed">
                    Activá «Correo electrónico / contraseña» en Firebase Console &gt; Authentication
                    &gt; Sign-in method (gratis, sin facturación), o ingresá con Google arriba.
                  </p>
                )}
              </div>
            )}

            {infoMsg && (
              <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {resetMode ? (
              <form onSubmit={handleResetSubmit} className="space-y-3 text-xs">
                <label className="block space-y-1">
                  <span className="font-semibold">Correo electrónico registrado</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 fabro-input"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full min-h-[44px] rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enviar enlace de recuperación
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false);
                    handleRetryClear();
                  }}
                  className="w-full min-h-[40px] text-xs font-semibold fabro-muted hover:underline cursor-pointer"
                >
                  Volver a Iniciar Sesión
                </button>
              </form>
            ) : tab === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs">
                <label className="block space-y-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 fabro-muted" />
                    Correo electrónico
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 fabro-input"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 fabro-muted" />
                    Contraseña
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated pl-3.5 pr-11 py-2 fabro-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center fabro-muted cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(true);
                      handleRetryClear();
                    }}
                    className="text-[11px] font-bold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full min-h-[46px] rounded-xl border-2 border-[#7C3AED] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Entrar con mi FABRO ID
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
                <label className="block space-y-1">
                  <span className="font-semibold">Nombre completo o apodo</span>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej: Sofía Méndez"
                    className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 fabro-input"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">@usuario único (FABRO ID)</span>
                    {handleState === 'checking' && (
                      <span className="text-[11px] fabro-muted">Verificando...</span>
                    )}
                    {handleState === 'available' && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Disponible
                      </span>
                    )}
                    {handleState === 'taken' && (
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        Ya ocupado
                      </span>
                    )}
                    {handleState === 'invalid' && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        Mín. 3 caracteres
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[#7C3AED]">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(normalizeHandle(e.target.value))}
                      placeholder="sofia.fabro"
                      className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated pl-8 pr-3.5 py-2 font-mono fabro-input"
                    />
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="font-semibold">Correo electrónico</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 fabro-input"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Contraseña</span>
                    <span className="text-[11px] font-semibold" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated pl-3.5 pr-11 py-2 fabro-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center fabro-muted cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${strength.score}%`, backgroundColor: strength.color }}
                    />
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="font-semibold">Fecha de nacimiento (protección de edad)</span>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 fabro-input"
                  />
                  {isMinorPreview && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Protección automática activa: perfil oculto en directorios abiertos.
                    </p>
                  )}
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#7C3AED]"
                  />
                  <span className="text-[11px] fabro-muted leading-relaxed">
                    Acepto los Términos de uso y la Política de Privacidad. Entiendo que mis claves
                    API (BYOK) nunca se suben a la nube.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full min-h-[46px] rounded-xl border-2 border-[#7C3AED] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Crear FABRO ID y verificar correo
                </button>
              </form>
            )}

            <div className="pt-2 border-t fabro-border flex items-center justify-between gap-2 text-[11px]">
              <span className="fabro-muted">¿Preferís seguir sin cuenta?</span>
              <button
                type="button"
                onClick={() => {
                  if (isBusy) cancelAuthLoading();
                  closeAuthModal();
                }}
                className="font-bold text-[#0284C7] dark:text-[#38BDF8] hover:underline cursor-pointer"
              >
                Continuar como Invitado
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
