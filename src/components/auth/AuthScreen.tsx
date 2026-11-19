import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck, Sun, Moon } from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import { FabroLogo } from '../brand/FabroLogo';
import { PWAInstallButton } from '../pwa/PWAControls';

interface AuthScreenProps {
  unverifiedUser: User | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onVerifiedRefresh: () => Promise<void>;
}

type AuthMode = 'login' | 'register' | 'reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  unverifiedUser,
  theme,
  onToggleTheme,
  onVerifiedRefresh,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const mapFirebaseAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    switch (code) {
      case 'auth/operation-not-allowed':
        return 'El acceso con correo y contraseña aún no está habilitado en tu consola de Firebase. Para activarlo: Firebase Console > Authentication > Sign-in method > Email/Password > Habilitar. Mientras tanto, podés ingresar directamente con Google.';
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta registrada con este correo electrónico.';
      case 'auth/invalid-email':
        return 'El formato del correo electrónico no es válido.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Correo o contraseña incorrectos.';
      case 'auth/popup-closed-by-user':
        return 'Se cerró la ventana de inicio de sesión antes de completar el acceso.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos seguidos. Esperá unos minutos antes de reintentar.';
      default:
        return err instanceof Error ? err.message : 'No se pudo completar la autenticación.';
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        await sendEmailVerification(cred.user);
        setNotice('Te enviamos un enlace de verificación a tu correo para proteger tu cuenta.');
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('Enviamos un correo para restablecer tu contraseña. Revisá tu bandeja de entrada.');
      }
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setNotice('Reenviamos el correo de verificación. Revisá también la carpeta de spam.');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] fabro-shell-bg fabro-hero-ambient text-slate-900 dark:text-[#FAF6EE] flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-4 border-b border-slate-200/70 dark:border-white/10">
        <FabroLogo size={36} />
        <div className="flex items-center gap-2.5">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Cambiar tema claro u oscuro"
            className="p-2 rounded-lg border border-slate-200 dark:border-white/10 fabro-shell-surface text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Split Entrance */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: FABRO 2.0 5-Sector Architecture Positioning */}
        <section className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-[#E5B842]">
              FABRO 2.0 · Ecosistema Digital Integral
            </p>
            <h1 className="font-display text-[clamp(2rem,3.8vw,3.2rem)] font-bold tracking-tight text-slate-900 dark:text-[#FAF6EE] leading-[1.06] max-w-xl [text-wrap:balance]">
              Todo lo que necesitás, en un solo ecosistema.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Estudio e investigación, bienestar personal y salud, red social con globo flotante, inteligencia artificial multimodelo y conectividad en la nube sin conexión.
            </p>
          </div>

          {/* Numbered 5-Sector Overview */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 fabro-shell-surface divide-y divide-slate-200/80 dark:divide-white/10 max-w-2xl">
            <div className="p-3.5 sm:px-5 sm:py-4 flex items-start gap-4">
              <span className="font-mono text-xs font-bold tabular-nums text-violet-600 dark:text-[#E5B842] pt-0.5 shrink-0">
                01
              </span>
              <div className="space-y-0.5 min-w-0">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Estudio e Investigación
                </h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Materias, apuntes digitales exportables a PDF/Word, biblioteca, investigación con fuentes reales, exámenes y fichas.
                </p>
              </div>
            </div>

            <div className="p-3.5 sm:px-5 sm:py-4 flex items-start gap-4">
              <span className="font-mono text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400 pt-0.5 shrink-0">
                02
              </span>
              <div className="space-y-0.5 min-w-0">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Bienestar y Salud · El Último Día de Tu Vida
                </h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Reflexión estoica cotidiana, diario emocional, legado privado, organización personal, calorías, hábitos y ejercicios por niveles con guías visuales.
                </p>
              </div>
            </div>

            <div className="p-3.5 sm:px-5 sm:py-4 flex items-start gap-4">
              <span className="font-mono text-xs font-bold tabular-nums text-sky-600 dark:text-sky-400 pt-0.5 shrink-0">
                03
              </span>
              <div className="space-y-0.5 min-w-0">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Red Social FABRO y Globo Flotante
                </h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Chateá mientras estudiás sin cambiar de módulo, publicá en el muro, creá grupos, enviá notas Push-to-Talk y gestioná tu FABRO ID con QR.
                </p>
              </div>
            </div>

            <div className="p-3.5 sm:px-5 sm:py-4 flex items-start gap-4">
              <span className="font-mono text-xs font-bold tabular-nums text-violet-600 dark:text-violet-400 pt-0.5 shrink-0">
                04
              </span>
              <div className="space-y-0.5 min-w-0">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Inteligencia Artificial Multimodelo
                </h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  OpenAI, Gemini, Claude, DeepSeek y Qwen en un único tablero comparativo, con cuota gratuita o tus propias credenciales BYOK cifradas.
                </p>
              </div>
            </div>

            <div className="p-3.5 sm:px-5 sm:py-4 flex items-start gap-4">
              <span className="font-mono text-xs font-bold tabular-nums text-amber-600 dark:text-[#E5B842] pt-0.5 shrink-0">
                05
              </span>
              <div className="space-y-0.5 min-w-0">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Configuración, FABRO Connect y Modo Offline
                </h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Respaldos en Google Drive, 7 plantillas visuales intercambiables, bóveda sin conexión en IndexedDB, accesibilidad y privacidad estricta.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-w-xl">
            Acceso gratuito, multiplataforma y sin conexión · Aportada por{' '}
            <strong className="font-semibold text-slate-800 dark:text-[#FAF6EE]">Jorge Luis Correa</strong>.
          </p>
        </section>

        {/* Right Column: Auth Card */}
        <section className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 fabro-shell-surface p-6 sm:p-8 shadow-sm">
            {unverifiedUser ? (
              <div className="space-y-5">
                <div className="w-11 h-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#FAF6EE]">
                    Verificá tu correo electrónico
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Para proteger tu cuenta, necesitás confirmar tu dirección{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-200">{unverifiedUser.email}</span>{' '}
                    antes de ingresar a tus módulos privados.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
                {notice && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                    {notice}
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={onVerifiedRefresh}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Ya verifiqué mi correo
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleResendVerification}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reenviar enlace de verificación
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut(auth)}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Usar otra cuenta
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-[#FAF6EE]">
                    {mode === 'login' && 'Ingresá a FABRO 2.0'}
                    {mode === 'register' && 'Creá tu cuenta personal'}
                    {mode === 'reset' && 'Recuperar contraseña'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Acceso directo a tu Centro de Control y los 5 sectores del ecosistema
                  </p>
                </div>

                {/* Segmented mode tabs */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#070B17]">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setNotice(''); }}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      mode === 'login'
                        ? 'bg-white dark:bg-[#131C33] text-slate-900 dark:text-[#FAF6EE] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); setNotice(''); }}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      mode === 'register'
                        ? 'bg-white dark:bg-[#131C33] text-slate-900 dark:text-[#FAF6EE] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Registrarse
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(''); setNotice(''); }}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      mode === 'reset'
                        ? 'bg-white dark:bg-[#131C33] text-slate-900 dark:text-[#FAF6EE] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Recuperar
                  </button>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 leading-relaxed">
                    {error}
                  </div>
                )}
                {notice && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    {notice}
                  </div>
                )}

                {mode !== 'reset' && (
                  <>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleGoogleLogin}
                      className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#131C33] px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-[#FAF6EE] hover:bg-slate-50 dark:hover:bg-[#192440] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                      Continuar con Google
                    </button>

                    <div className="relative flex items-center py-1">
                      <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
                      <span className="shrink-0 mx-3 text-[11px] text-slate-400">o con correo electrónico</span>
                      <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
                    </div>
                  </>
                )}

                <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                  {mode === 'register' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej. Valentina Gómez"
                        className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B17] px-3.5 py-2 text-sm text-slate-900 dark:text-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={200}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@correo.com"
                      className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B17] px-3.5 py-2 text-sm text-slate-900 dark:text-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  {mode !== 'reset' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070B17] px-3.5 py-2 text-sm text-slate-900 dark:text-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {mode === 'reset' ? <KeyRound className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    {loading
                      ? 'Procesando...'
                      : mode === 'login'
                      ? 'Ingresar a FABRO 2.0'
                      : mode === 'register'
                      ? 'Crear cuenta'
                      : 'Enviar enlace de recuperación'}
                  </button>
                </form>

                <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-violet-600 dark:text-[#E5B842] mt-0.5" />
                  <span>
                    Privacidad estricta: tus apuntes, tu diario personal y tus chats privados permanecen protegidos bajo tu cuenta.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200/80 dark:border-white/10 px-6 py-3.5 text-center text-xs text-slate-500 dark:text-slate-400">
        FABRO 2.0 · Todo lo que necesitás, en un solo ecosistema · Aportada por{' '}
        <span className="font-semibold text-slate-800 dark:text-[#FAF6EE]">Jorge Luis Correa</span>
      </footer>
    </div>
  );
};
