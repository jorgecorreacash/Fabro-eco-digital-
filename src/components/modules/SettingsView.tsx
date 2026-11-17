import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { deleteUser, sendPasswordResetEmail } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  HardDrive,
  KeyRound,
  LogOut,
  QrCode,
  ShieldCheck,
  Smartphone,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { computeFabroId } from '../../lib/fabroId';
import { auth } from '../../lib/firebase';
import { getCachedOfflineNotes, getVaultMeta, type VaultPrecacheSummary } from '../../lib/offlineStore';
import { EDUCATION_LEVEL_OPTIONS, type EducationLevel } from '../../types/fabro';
import { FreemiumStatusCard } from '../common/FreemiumStatusCard';
import { ThemeTemplatePicker } from '../common/ThemeTemplatePicker';
import { PWAInstallButton } from '../pwa/PWAControls';

type FontScaleId = 'normal' | 'grande' | 'extra';

function applyAccessibilityDom(scale: FontScaleId, highContrast: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize =
    scale === 'extra' ? '19px' : scale === 'grande' ? '17.5px' : '16px';
  document.documentElement.classList.toggle('contrast-125', highContrast);
}

export const SettingsView: React.FC = () => {
  const {
    user,
    profile,
    subjects,
    notes,
    calendarEvents,
    decks,
    theme,
    setThemeMode,
    updateStudentProfile,
    setActiveSection,
    logout,
  } = useFabro();

  const { isAdmin } = usePlatform();
  const { providers, budgetConfig, effectivePlanPolicy, runtimeUsage, personalConnections } = useAIGateway();

  const todayUserStats = user?.uid ? runtimeUsage?.byUser?.[user.uid] : undefined;
  const activeProvidersCount = providers.filter((p) => p.enabled && p.configuredInBackend).length;
  const myFabroId = useMemo(
    () => computeFabroId(user?.uid, profile?.customFabroId),
    [user?.uid, profile?.customFabroId]
  );

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>(profile?.educationLevel || 'universitario');
  const [institution, setInstitution] = useState(profile?.institution || '');
  const [career, setCareer] = useState(profile?.career || '');
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(profile?.weeklyGoalHours || 15);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // QR Card & Offline Vault Telemetry
  const [qrUrl, setQrUrl] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [vaultSummary, setVaultSummary] = useState<VaultPrecacheSummary | undefined>(undefined);
  const [cachedNotesCount, setCachedNotesCount] = useState(0);

  // Accessibility & Sound Preferences
  const [fontScale, setFontScale] = useState<FontScaleId>(() => {
    try {
      const saved = localStorage.getItem('fabro_font_scale');
      if (saved === 'grande' || saved === 'extra') return saved;
    } catch {
      // ignore
    }
    return 'normal';
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fabro_high_contrast') === 'true';
    } catch {
      return false;
    }
  });
  const [soundsEnabled, setSoundsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fabro_sounds_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Account Deletion / Local Vault Wipe Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deletingAction, setDeletingAction] = useState(false);

  useEffect(() => {
    applyAccessibilityDom(fontScale, highContrast);
    try {
      localStorage.setItem('fabro_font_scale', fontScale);
      localStorage.setItem('fabro_high_contrast', String(highContrast));
      localStorage.setItem('fabro_sounds_enabled', String(soundsEnabled));
    } catch {
      // ignore
    }
  }, [fontScale, highContrast, soundsEnabled]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setEducationLevel(profile.educationLevel || 'universitario');
    setInstitution(profile.institution || '');
    setCareer(profile.career || '');
    setWeeklyGoalHours(profile.weeklyGoalHours || 15);
  }, [profile]);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(
      `FABRO-ID:${myFabroId}|UID:${user?.uid || ''}|NOMBRE:${profile?.displayName || ''}`,
      { width: 160, margin: 1 }
    )
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl('');
      });
    void getVaultMeta().then((meta) => {
      if (active) setVaultSummary(meta);
    });
    void getCachedOfflineNotes().then((list) => {
      if (active) setCachedNotesCount(list.length);
    });
    return () => {
      active = false;
    };
  }, [myFabroId, user?.uid, profile?.displayName]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    setErrorMsg('');
    try {
      await updateStudentProfile({
        displayName,
        educationLevel,
        institution,
        career,
        weeklyGoalHours,
        themePreference: theme,
      });
      setFeedback('Perfil actualizado y sincronizado en la nube.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      platform: 'FABRO',
      fabroId: myFabroId,
      profile,
      subjects,
      notes,
      calendarEvents,
      decks,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabro-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setErrorMsg('');
    try {
      await sendPasswordResetEmail(auth, user.email);
      setFeedback(`Enviamos un correo para cambiar la contraseña a ${user.email}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar el correo de cambio de contraseña.');
    }
  };

  const handleWipeLocalVault = async () => {
    setDeletingAction(true);
    setErrorMsg('');
    try {
      if (typeof indexedDB !== 'undefined') {
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase('fabro-offline-vault');
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      }
      localStorage.removeItem('fabro_social_autoplay_ptt');
      setVaultSummary(undefined);
      setCachedNotesCount(0);
      setDeleteModalOpen(false);
      setConfirmDeleteText('');
      setFeedback('Bóveda offline local limpiada. Los datos en la nube permanecen intactos.');
    } finally {
      setDeletingAction(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmDeleteText.trim().toUpperCase() !== 'ELIMINAR') return;
    if (!auth.currentUser) return;
    setDeletingAction(true);
    setErrorMsg('');
    try {
      await deleteUser(auth.currentUser);
      await handleWipeLocalVault();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      setDeleteModalOpen(false);
      setErrorMsg(
        code === 'auth/requires-recent-login'
          ? 'Por seguridad Firebase requiere un inicio de sesión reciente para eliminar tu cuenta. Cerrá sesión, volvé a ingresar y repetí el paso.'
          : err instanceof Error
            ? err.message
            : 'No se pudo eliminar la cuenta.'
      );
    } finally {
      setDeletingAction(false);
    }
  };

  const copyId = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(myFabroId).then(() => {
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1800);
    });
  };

  const storageMB = ((profile?.storageUsedBytes || 0) / (1024 * 1024)).toFixed(2);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-2xl border border-amber-500/25 fabro-shell-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-[#E5B842]">
              Sector 05 · Configuración y Conectividad
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('inicio')}
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-[#E5B842] cursor-pointer whitespace-nowrap"
            >
              ← Volver a Inicio
            </button>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-[#FAF6EE]">
            Configuración General, Privacidad y Offline
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Administrá tu perfil, FABRO ID y QR, plantillas visuales, accesibilidad, copias en Google Drive, bóveda sin conexión y seguridad.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveSection('connect')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Cloud className="w-3.5 h-3.5" />
          Ir a FABRO Connect
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Identidad FABRO ID & Código QR */}
      <section className="rounded-xl border border-sky-500/30 fabro-shell-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            <QrCode className="w-4 h-4" />
            <span>Identidad Única FABRO ID</span>
          </div>
          <p className="font-mono text-xl font-bold tracking-wider text-slate-900 dark:text-white tabular-nums">
            {myFabroId}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
            Código único permanente vinculado a tu cuenta. Compartilo para que otros usuarios adultos verifiquen tu identidad o te encuentren rápidamente en Red Social.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyId}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId ? 'ID copiado' : 'Copiar FABRO ID'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('perfil')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 cursor-pointer"
            >
              Personalizar FABRO ID y Perfil
            </button>
          </div>
        </div>

        {qrUrl && (
          <div className="shrink-0 rounded-xl bg-white p-2.5 border border-slate-200 self-start sm:self-center">
            <img src={qrUrl} alt={`Código QR ${myFabroId}`} className="w-32 h-32" />
          </div>
        )}
      </section>

      {/* Profile Form */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 space-y-4">
        <h3 className="font-display text-base font-bold">Perfil general y objetivos</h3>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Etapa o formación (opcional)
              </label>
              <select
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Organización o centro (opcional)
              </label>
              <input
                type="text"
                maxLength={150}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ej. Universidad Nacional"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Actividad u orientación
              </label>
              <input
                type="text"
                maxLength={150}
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                placeholder="Ej. Medicina / Sistemas / Diseño"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Objetivo semanal de dedicación (horas)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={weeklyGoalHours}
                onChange={(e) => setWeeklyGoalHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Apariencia visual
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                    theme === 'dark'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Modo oscuro
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                    theme === 'light'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Modo claro
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar preferencias'}
            </button>
          </div>
        </form>
      </section>

      {/* Theme Template Switcher (7 plantillas) */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-6">
        <ThemeTemplatePicker />
      </section>

      {/* Accessibility & Sounds */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Accesibilidad, Lectura y Sonidos
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <span className="font-medium text-slate-600 dark:text-slate-400 block">Tamaño de texto base</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'normal', label: 'Normal' },
                  { id: 'grande', label: 'Grande' },
                  { id: 'extra', label: 'XL' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFontScale(opt.id)}
                  className={`py-2 rounded-lg border font-semibold cursor-pointer ${
                    fontScale === opt.id
                      ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="font-medium text-slate-600 dark:text-slate-400 block">Contraste visual</span>
            <button
              type="button"
              onClick={() => setHighContrast((v) => !v)}
              className={`w-full py-2 px-3 rounded-lg border font-semibold cursor-pointer ${
                highContrast
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {highContrast ? 'Alto contraste activado' : 'Contraste estándar'}
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="font-medium text-slate-600 dark:text-slate-400 block">Alertas y tonos Push-to-Talk</span>
            <button
              type="button"
              onClick={() => setSoundsEnabled((v) => !v)}
              className={`w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-semibold cursor-pointer ${
                soundsEnabled
                  ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              {soundsEnabled ? 'Sonidos activados' : 'Sonidos silenciados'}
            </button>
          </div>
        </div>
      </section>

      {/* Storage, Cloud Drive, Offline Vault & PWA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-display text-base font-bold">Bóveda Offline, Respaldo y Nube</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed tabular-nums">
            Almacenamiento registrado: <strong>{storageMB} MB</strong> · Notas en bóveda IndexedDB:{' '}
            <strong>{cachedNotesCount}</strong>
            {vaultSummary?.lastPrecachedAt
              ? ` · Última sincronización local: ${new Date(vaultSummary.lastPrecachedAt).toLocaleDateString('es-AR')}`
              : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar JSON local
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('connect')}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              Google Drive y APIs ({personalConnections.filter((c) => c.status === 'connected').length})
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-display text-base font-bold">App instalable (PWA / Android)</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Instalá FABRO en tu celular Android, tablet o computadora para usar apuntes, materias, bienestar y rutinas incluso sin conexión a internet.
          </p>
          <PWAInstallButton />
        </section>
      </div>

      {/* Centro Multi-IA Gateway & Plan Freemium */}
      <FreemiumStatusCard />

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Proveedores de IA y Política de Uso
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('ia-panel')}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
            >
              Configurar Sector IA
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveSection('admin')}
                className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                Administrar IA y Costos
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          FABRO gestiona todas las conexiones de inteligencia artificial de forma centralizada y también admite tus propias credenciales desde FABRO CONNECT.{' '}
          Motores configurados ahora: <span className="font-mono tabular-nums">{activeProvidersCount}/{providers.length}</span>.
          {' '}Política de acceso base:{' '}
          <strong className="text-slate-900 dark:text-white">
            {effectivePlanPolicy === 'plan_administrador'
              ? 'Administrador'
              : effectivePlanPolicy === 'plan_gratuito'
                ? 'Plan Gratuito (modelos abiertos/cuota gratis)'
                : 'Plan Educativo (enrutamiento híbrido)'}
          </strong>.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          <span>
            Consultas Gateway hoy: {todayUserStats?.requests || 0} / {budgetConfig.perUserDailyRequestLimit}
          </span>
          <span>
            Tokens hoy: {(todayUserStats?.tokens || 0).toLocaleString('es-AR')} / {budgetConfig.perUserDailyTokenLimit.toLocaleString('es-AR')}
          </span>
        </div>
      </section>

      {/* Free Tool Attribution */}
      <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-1.5">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
          Acerca de FABRO · Acceso educativo gratuito
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          FABRO es una plataforma integral gratuita creada para facilitar el conocimiento y acompañar el desarrollo educativo y personal, aportada por{' '}
          <strong className="text-slate-900 dark:text-white">Jorge Luis Correa</strong>.
        </p>
      </section>

      {/* Security, Vault Wipe & Account Deletion */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Seguridad, privacidad y ciclo de cuenta
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sesión iniciada como <span className="font-medium">{user?.email}</span>. Tus datos están aislados por usuario mediante reglas Zero-Trust.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handlePasswordReset()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Cambiar contraseña
          </button>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            Limpiar bóveda / Cuenta
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/20 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </section>

      {/* Modal: Limpiar bóveda local o eliminar cuenta */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-display font-bold text-base">
                <Trash2 className="w-4 h-4" />
                <span>Gestión de datos y cuenta</span>
              </div>
              <button type="button" onClick={() => setDeleteModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white">1. Limpiar solo caché sin conexión (IndexedDB)</p>
              <p className="text-slate-500 dark:text-slate-400">
                Borra únicamente la copia offline guardada en este navegador. Tu cuenta y documentos en la nube siguen disponibles.
              </p>
              <button
                type="button"
                disabled={deletingAction}
                onClick={() => void handleWipeLocalVault()}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-800 dark:text-amber-300 cursor-pointer"
              >
                Limpiar bóveda local ahora
              </button>
            </div>

            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2 text-xs">
              <p className="font-semibold text-rose-700 dark:text-rose-300">2. Eliminar acceso de cuenta Firebase</p>
              <p className="text-slate-600 dark:text-slate-300">
                Escribí <strong>ELIMINAR</strong> para confirmar el cierre permanente de tu usuario en autenticación.
              </p>
              <input
                type="text"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder="Escribí ELIMINAR"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={deletingAction || confirmDeleteText.trim().toUpperCase() !== 'ELIMINAR'}
                onClick={() => void handleDeleteAccount()}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 font-semibold text-white disabled:opacity-40 cursor-pointer"
              >
                Confirmar eliminación de cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
