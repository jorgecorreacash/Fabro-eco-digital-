import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  checkUsernameAvailability,
  computeIsMinorFromBirthDate,
  normalizeHandle,
} from '../../services/cloudSyncService';

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
    authModalOpen,
    authModalReason,
    authModalDefaultTab,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
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
      setErrorMsg(null);
      setErrorCode(null);
      setInfoMsg(null);
    }
  }, [authModalOpen, authModalDefaultTab]);

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

  const handleGoogle = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);
    const res = await signInWithGoogle();
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo iniciar sesión con Google.');
      setErrorCode(res.code || null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Completá tu correo y contraseña.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);
    const res = await signInWithEmail(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo iniciar sesión.');
      setErrorCode(res.code || null);
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
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!termsAccepted) {
      setErrorMsg('Aceptá los Términos y Política de Privacidad para crear tu FABRO ID.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);
    const res = await signUpWithEmail({
      displayName,
      username: cleanHandle,
      email,
      password,
      birthDate,
    });
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo crear la cuenta.');
      setErrorCode(res.code || null);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Escribí el correo de tu cuenta para enviarte el enlace.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    const res = await sendPasswordReset(email);
    setSubmitting(false);
    if (res.ok) {
      setInfoMsg('Te enviamos un correo para restablecer tu contraseña. Revisá tu bandeja o spam.');
    } else {
      setErrorMsg(res.error || 'No pudimos enviar el correo de recuperación.');
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="FABRO ID · Iniciar sesión o crear cuenta"
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border-2 border-[#7C3AED] fabro-surface p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92dvh] overflow-y-auto fabro-screen-enter"
      >
        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#C4B5FD] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              FABRO ID · Sincronización Gratuita
            </p>
            <h2 className="font-display text-lg font-bold">
              {resetMode
                ? 'Recuperar contraseña'
                : tab === 'login'
                ? 'Iniciá sesión en FABRO'
                : 'Creá tu FABRO ID gratis'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Cerrar ventana de acceso"
            className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {authModalReason && (
          <div className="rounded-xl border-2 border-[#0EA5E9]/45 bg-[#0EA5E9]/10 px-3.5 py-2.5 text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8]">
            Creá o iniciá sesión con tu FABRO ID para {authModalReason}. Tus apuntes y tareas locales se migrarán automáticamente.
          </div>
        )}

        {/* Tabs */}
        {!resetMode && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border-2 fabro-border fabro-surface-elevated">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMsg(null);
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
              onClick={() => {
                setTab('register');
                setErrorMsg(null);
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

        {/* Prominent Google Sign-In Button */}
        {!resetMode && (
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleGoogle()}
              className="w-full min-h-[48px] rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-xs font-extrabold inline-flex items-center justify-center gap-3 shadow-sm hover:border-[#4285F4] cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              <GoogleFourColorLogo />
              <span>Continuar con Google (1 clic)</span>
            </button>

            <div className="flex items-center gap-2 text-[11px] fabro-muted">
              <div className="h-px flex-1 bg-[var(--fabro-border)]" />
              <span>o con tu correo</span>
              <div className="h-px flex-1 bg-[var(--fabro-border)]" />
            </div>
          </>
        )}

        {errorMsg && (
          <div className="rounded-xl border-2 border-rose-500/50 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-2">
            <p className="font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </p>
            {errorCode === 'auth/operation-not-allowed' && (
              <p className="text-[11px] leading-relaxed">
                Tip técnico: En Firebase Console &gt; Authentication &gt; Sign-in method activá el proveedor «Correo electrónico/contraseña», o usá «Continuar con Google» arriba.
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
              disabled={submitting}
              className="w-full min-h-[44px] rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar enlace de recuperación
            </button>
            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setErrorMsg(null);
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
                  setErrorMsg(null);
                }}
                className="text-[11px] font-bold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl border-2 border-[#7C3AED] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
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
                Acepto los Términos de uso y la Política de Privacidad. Entiendo que mis claves API (BYOK) nunca se suben a la nube.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl border-2 border-[#7C3AED] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Crear FABRO ID y sincronizar
            </button>
          </form>
        )}

        <div className="pt-2 border-t fabro-border flex items-center justify-between gap-2 text-[11px]">
          <span className="fabro-muted">¿Preferís seguir sin cuenta?</span>
          <button
            type="button"
            onClick={closeAuthModal}
            className="font-bold text-[#0284C7] dark:text-[#38BDF8] hover:underline cursor-pointer"
          >
            Continuar como Invitado
          </button>
        </div>
      </div>
    </div>
  );
};
