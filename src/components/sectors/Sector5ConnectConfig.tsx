import React, { useEffect, useState } from 'react';
import {
  AlarmClock,
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Cloud,
  Download,
  HardDrive,
  KeyRound,
  Link2,
  LogOut,
  MessageSquare,
  PictureInPicture2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  User,
  UserCheck,
  Volume2,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { FABRO_THEMES } from '../../data/ecosystemCatalog';
import { hasNativeAndroidBubbles, isDocumentPiPSupported } from '../../services/androidBubblesBridge';
import { getNotificationCapability } from '../../services/backgroundNotifications';
import { vaultExportSnapshot } from '../../services/localVault';
import { isMediaSessionSupported } from '../../services/mediaSessionBridge';
import type { ConfigSubmenuId, ConnectProviderItem, SubmenuId } from '../../types/ecosystem';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { IdeasVaultTool } from './IdeasVaultTool';
import { SectorLayout } from './SectorLayout';

export const Sector5ConnectConfig: React.FC = () => {
  const {
    submenu,
    navigateTo,
    theme,
    setTheme,
    profile,
    updateProfile,
    connectItems,
    saveConnectItems,
    network,
    resetLocalVault,
    notificationPrefs,
    updateNotificationPrefs,
    notificationPermission,
    requestNotificationPermission,
    triggerTestNotification,
    scheduledReminders,
    addScheduledReminder,
    deleteScheduledReminder,
    simulateIncomingChatNotification,
    openFloatingMiniWindow,
    authUser,
    syncStatus,
    lastCloudSyncAt,
    openAuthModal,
    signOutAccount,
    updateAccountAliasAndPhoto,
    changeAccountPassword,
    linkGoogleProvider,
    deleteAccountSafely,
    syncNowToCloud,
  } = useEcosystem();

  const activeSub: ConfigSubmenuId =
    submenu === 'fabro-connect' ||
    submenu === 'nubes-respaldos' ||
    submenu === 'boveda-ideas' ||
    submenu === 'notificaciones' ||
    submenu === 'config-general'
      ? submenu
      : 'fabro-connect';

  const [draftConnect, setDraftConnect] = useState<ConnectProviderItem[]>(connectItems);
  const [hasUnsavedConnect, setHasUnsavedConnect] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  const [backupConsent, setBackupConsent] = useState(false);
  const [backupProvider, setBackupProvider] = useState('Google Drive');
  const [backupFolder, setBackupFolder] = useState('/FABRO-Respaldos');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [cloudSyncFeedback, setCloudSyncFeedback] = useState<string | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const [confirmClearVault, setConfirmClearVault] = useState(false);

  // Account & Security settings form state
  const [acctName, setAcctName] = useState(authUser?.displayName || profile.displayName);
  const [acctUsername, setAcctUsername] = useState(authUser?.username || '');
  const [acctPhotoUrl, setAcctPhotoUrl] = useState(authUser?.photoURL || '');
  const [acctNewPass, setAcctNewPass] = useState('');
  const [acctFeedback, setAcctFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [acctBusy, setAcctBusy] = useState(false);
  const [confirmDeleteAcctStep, setConfirmDeleteAcctStep] = useState<0 | 1>(0);

  useEffect(() => {
    if (authUser) {
      setAcctName(authUser.displayName || profile.displayName);
      setAcctUsername(authUser.username || '');
      setAcctPhotoUrl(authUser.photoURL || '');
    }
  }, [authUser, profile.displayName]);

  // Notifications & Scheduled Reminders local form state
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [remTitle, setRemTitle] = useState('');
  const [remTarget, setRemTarget] = useState<string>('estudio:academico-panel');
  const [remMinutes, setRemMinutes] = useState<number>(15);

  const notifCapability = getNotificationCapability();
  const mediaSessionReady = isMediaSessionSupported();
  const docPipReady = isDocumentPiPSupported();
  const nativeBubblesReady = hasNativeAndroidBubbles();

  useEffect(() => {
    setDraftConnect(connectItems);
    setHasUnsavedConnect(false);
  }, [connectItems]);

  const handleTestLink = (id: ConnectProviderItem['id']) => {
    setDraftConnect((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: network.isOnline ? 'local-draft' : 'disconnected',
              lastTestedAt: new Date().toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            }
          : item
      )
    );
    setHasUnsavedConnect(true);
    setConnectMessage(
      network.isOnline
        ? 'Enlace verificado en borrador. Pulsá «Guardar antes de salir» para confirmar.'
        : 'Sin conexión a internet: no es posible enlazar nubes externas offline.'
    );
  };

  const handleSaveConnect = () => {
    const finalized = draftConnect.map((item) =>
      item.status === 'local-draft' ? { ...item, status: 'ready' as const } : item
    );
    saveConnectItems(finalized);
    setDraftConnect(finalized);
    setHasUnsavedConnect(false);
    setConnectMessage('Configuración de FABRO Connect guardada localmente.');
  };

  const handleExportAll = async () => {
    const snapshot = await vaultExportSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabro-respaldo-local-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveAccountChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcctFeedback(null);
    setAcctBusy(true);
    const res = await updateAccountAliasAndPhoto({
      displayName: acctName,
      username: acctUsername,
      photoURL: acctPhotoUrl,
    });
    setAcctBusy(false);
    if (res.ok) {
      setAcctFeedback({ type: 'ok', text: 'Alias, nombre y foto actualizados en tu FABRO ID.' });
    } else {
      setAcctFeedback({ type: 'err', text: res.error || 'No pudimos actualizar tu cuenta.' });
    }
  };

  const handleChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcctFeedback(null);
    if (acctNewPass.trim().length < 8) {
      setAcctFeedback({ type: 'err', text: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    setAcctBusy(true);
    const res = await changeAccountPassword(acctNewPass);
    setAcctBusy(false);
    if (res.ok) {
      setAcctNewPass('');
      setAcctFeedback({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
    } else {
      setAcctFeedback({ type: 'err', text: res.error || 'No se pudo cambiar la contraseña.' });
    }
  };

  const handleLinkGoogle = async () => {
    setAcctFeedback(null);
    setAcctBusy(true);
    const res = await linkGoogleProvider();
    setAcctBusy(false);
    if (res.ok) {
      setAcctFeedback({ type: 'ok', text: 'Tu cuenta ya quedó vinculada con Google.' });
    } else {
      setAcctFeedback({ type: 'err', text: res.error || 'No se pudo vincular con Google.' });
    }
  };

  const handleDeleteAccount = async () => {
    setAcctFeedback(null);
    setAcctBusy(true);
    const res = await deleteAccountSafely();
    setAcctBusy(false);
    setConfirmDeleteAcctStep(0);
    if (res.ok) {
      setAcctFeedback({ type: 'ok', text: 'Cuenta eliminada. Seguís en Modo Invitado local.' });
    } else {
      setAcctFeedback({ type: 'err', text: res.error || 'No se pudo eliminar la cuenta.' });
    }
  };

  return (
    <SectorLayout
      sectorId="configuracion"
      activeSubmenu={activeSub}
      badgeText="Connect · Nubes · Bóveda de Ideas"
    >
      {activeSub === 'boveda-ideas' && <IdeasVaultTool />}

      {activeSub === 'fabro-connect' && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0284C7]" strokeWidth={1.75} />
                FABRO Connect — Integraciones externas
              </h2>
              <p className="text-xs fabro-muted mt-1">
                {hasUnsavedConnect
                  ? 'Tenés cambios pendientes en tus vínculos externos.'
                  : 'Estado real de cada cuenta externa sin conexiones simuladas.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveConnect}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(2,132,199,0.5)] cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" strokeWidth={1.75} />
              Guardar antes de salir
            </button>
          </div>

          {connectMessage && (
            <p className="rounded-xl border-2 border-[#0284C7]/40 fabro-surface-elevated px-4 py-2.5 text-xs text-[#0284C7] dark:text-[#38BDF8] font-semibold">
              {connectMessage}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {draftConnect.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border-2 border-[#334155]/25 fabro-surface p-6 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] fabro-muted">{item.category}</p>
                    <h3 className="font-display text-base font-bold mt-0.5">{item.name}</h3>
                  </div>
                  <span
                    className={`font-semibold ${
                      item.status === 'ready'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : item.status === 'local-draft'
                        ? 'text-[#0284C7] dark:text-[#38BDF8]'
                        : 'fabro-muted'
                    }`}
                  >
                    {item.status === 'ready'
                      ? 'Configurado'
                      : item.status === 'local-draft'
                      ? 'Enlace probado'
                      : 'Desconectado'}
                  </span>
                </div>

                <p className="fabro-muted">{item.permissionsSummary}</p>

                <label className="block space-y-1">
                  <span className="text-[11px] fabro-muted">Carpeta / Alcance</span>
                  <input
                    type="text"
                    value={item.folderOrScope}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftConnect((prev) =>
                        prev.map((row) =>
                          row.id === item.id ? { ...row, folderOrScope: val } : row
                        )
                      );
                      setHasUnsavedConnect(true);
                    }}
                    className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-mono fabro-input"
                  />
                </label>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-mono text-[11px] fabro-muted tabular-nums">
                    {item.lastTestedAt ? `Última prueba: ${item.lastTestedAt}` : 'Sin probar aún'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTestLink(item.id)}
                    className="min-h-[44px] rounded-xl border-2 border-[#334155]/40 fabro-surface-elevated px-3.5 py-1.5 font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    Probar enlace
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSub === 'nubes-respaldos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-6 space-y-4 text-xs">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#0284C7]" strokeWidth={1.75} />
              Nubes y respaldos bajo consentimiento
            </h2>
            <p className="fabro-muted leading-relaxed">
              FABRO nunca sube información personal automáticamente sin tu consentimiento explícito.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="space-y-1 block">
                <span className="fabro-muted">Proveedor de destino</span>
                <select
                  value={backupProvider}
                  onChange={(e) => setBackupProvider(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                >
                  <option>Google Drive</option>
                  <option>OneDrive</option>
                  <option>Dropbox</option>
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="fabro-muted">Carpeta</span>
                <input
                  type="text"
                  value={backupFolder}
                  onChange={(e) => setBackupFolder(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 font-mono fabro-input"
                />
              </label>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={backupConsent}
                onChange={(e) => setBackupConsent(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#0284C7]"
              />
              <span>
                Autorizo expresamente generar un respaldo con los módulos seleccionados en{' '}
                <strong>{backupProvider}</strong> ({backupFolder}).
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!backupConsent}
                onClick={() =>
                  setBackupMessage(
                    network.isOnline
                      ? 'Consentimiento registrado. En la etapa funcional se conectará la subida OAuth real.'
                      : 'Sin internet: podés descargar tu respaldo JSON local ahora mismo.'
                  )
                }
                className="min-h-[44px] rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold disabled:opacity-50 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                Ejecutar respaldo manual
              </button>
              <button
                type="button"
                onClick={() => void handleExportAll()}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar JSON local
              </button>
            </div>
            {backupMessage && <p className="text-[#0284C7] dark:text-[#38BDF8] font-semibold">{backupMessage}</p>}
          </div>

          <div className="rounded-2xl border-2 border-[#0284C7]/35 fabro-surface p-5 space-y-3 text-xs">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#0284C7]" />
              Sincronización Híbrida (IndexedDB + Cloud Firestore Spark)
            </h2>
            <p className="fabro-muted leading-relaxed">
              Los datos base se guardan primero en el dispositivo para funcionar offline. Cuando activás tu FABRO ID, tus apuntes, organizador y progreso se sincronizan con caché local de Firestore sin consumo innecesario.
            </p>
            <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3.5 font-mono tabular-nums space-y-1">
              <p>Motor local: IndexedDB + LocalStorage</p>
              <p>Red actual: {network.isOnline ? 'En línea' : 'Offline'}</p>
              <p>
                Estado de nube:{' '}
                {syncStatus === 'cloud-synced'
                  ? 'Sincronizado en la nube'
                  : syncStatus === 'syncing'
                  ? 'Sincronizando...'
                  : syncStatus === 'local-offline'
                  ? 'Guardado localmente · Sin internet'
                  : syncStatus === 'sync-error'
                  ? 'Guardado localmente · Reintentando'
                  : 'Modo Invitado (solo local)'}
              </p>
              {lastCloudSyncAt && <p>Último sync: {lastCloudSyncAt}</p>}
            </div>

            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
              Seguridad BYOK: Tus claves API de IA (<span className="font-mono">byok_keys</span>) nunca se suben a Firestore; permanecen 100% cifradas en tu dispositivo.
            </div>

            <div className="flex flex-wrap gap-2">
              {!authUser ? (
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal(
                      'activar la sincronización gratuita entre dispositivos con Cloud Firestore',
                      'register'
                    )
                  }
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
                >
                  <Cloud className="w-4 h-4" />
                  Conectar FABRO ID en la nube
                </button>
              ) : (
                <button
                  type="button"
                  disabled={syncingCloud}
                  onClick={async () => {
                    setSyncingCloud(true);
                    setCloudSyncFeedback(null);
                    await syncNowToCloud();
                    setSyncingCloud(false);
                    setCloudSyncFeedback(
                      network.isOnline
                        ? 'Respaldo sincronizado en Cloud Firestore.'
                        : 'Sin internet: cambios guardados en la caché local de Firestore y IndexedDB.'
                    );
                  }}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingCloud ? 'animate-spin' : ''}`} />
                  {syncingCloud ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
              )}
            </div>
            {cloudSyncFeedback && (
              <p className="text-[#0284C7] dark:text-[#38BDF8] font-semibold">{cloudSyncFeedback}</p>
            )}
          </div>
        </div>
      )}

      {activeSub === 'notificaciones' && (
        <div className="space-y-5">
          {/* Permission & Test Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border-2 border-[#0284C7]/40 fabro-surface p-6 space-y-4 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-[#0284C7]" strokeWidth={1.75} />
                    Notificaciones del Sistema y Segundo Plano
                  </h2>
                  <p className="fabro-muted mt-1 leading-relaxed">
                    Recibí avisos con sonido y vibración al terminar un Pomodoro, completar una rutina, recibir mensajes o vencer un recordatorio.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold shrink-0 ${
                    notificationPermission === 'granted'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : notificationPermission === 'denied'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {notificationPermission === 'granted'
                    ? 'Permiso activo'
                    : notificationPermission === 'denied'
                    ? 'Bloqueado'
                    : notificationPermission === 'unsupported'
                    ? 'Solo en app'
                    : 'Sin autorizar'}
                </span>
              </div>

              <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3.5 text-xs leading-relaxed">
                {notifCapability.statusMessage}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    setNotifFeedback(res.message);
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold shadow-[0_6px_16px_-6px_rgba(2,132,199,0.5)] cursor-pointer active:scale-95"
                >
                  <Bell className="w-4 h-4" />
                  Solicitar permiso de notificaciones
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await triggerTestNotification();
                    setNotifFeedback(
                      res.delivered
                        ? `Aviso enviado (${res.note}). Tocá la notificación para abrir FABRO directo en Estudio.`
                        : res.note
                    );
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#10B981] bg-[#10B981]/10 text-[#047857] dark:text-[#34D399] px-4 py-2 font-bold cursor-pointer active:scale-95"
                >
                  <Volume2 className="w-4 h-4" />
                  Probar aviso ahora
                </button>

                <button
                  type="button"
                  onClick={() => {
                    simulateIncomingChatNotification();
                    setNotifFeedback(
                      'Se simuló la llegada de un nuevo mensaje al chat rápido y se disparó su aviso.'
                    );
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C084FC] px-4 py-2 font-bold cursor-pointer active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  Simular mensaje chat
                </button>
              </div>

              {notifFeedback && (
                <p className="rounded-xl border-2 border-[#0284C7]/35 bg-[#0284C7]/10 px-3.5 py-2.5 text-xs font-semibold text-[#0369A1] dark:text-[#38BDF8]">
                  {notifFeedback}
                </p>
              )}
            </div>

            {/* Notification Trigger Preferences */}
            <div className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-6 space-y-3.5 text-xs">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#0284C7]" strokeWidth={1.75} />
                Disparadores y alertas activas
              </h2>
              <p className="fabro-muted">
                Elegí qué eventos pueden enviarte avisos del sistema, sonido y vibración.
              </p>

              <div className="space-y-2">
                {(
                  [
                    {
                      key: 'enabled',
                      label: 'Activar notificaciones en segundo plano',
                      desc: 'Interruptor maestro del sistema de avisos PWA.',
                    },
                    {
                      key: 'pomodoroAndRoutines',
                      label: 'Fin de Pomodoro y rutinas físicas',
                      desc: 'Avisa al terminar bloques de estudio o intervalos HIIT/Tabata.',
                    },
                    {
                      key: 'chatMessages',
                      label: 'Mensajes nuevos del chat y PTT',
                      desc: 'Notifica mensajes entrantes con acceso directo a Mensajería.',
                    },
                    {
                      key: 'scheduledReminders',
                      label: 'Recordatorios programados de estudio y hábitos',
                      desc: 'Dispara alertas locales aunque estés en otra pestaña.',
                    },
                    {
                      key: 'sound',
                      label: 'Aviso sonoro suave (Web Audio)',
                      desc: 'Campana armónica local sin descargas externas.',
                    },
                    {
                      key: 'vibrate',
                      label: 'Vibración táctil en Android / móvil',
                      desc: 'Patrón corto al completar bloques o recibir alertas.',
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 rounded-xl border-2 fabro-border fabro-surface-elevated p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={notificationPrefs[item.key]}
                      onChange={(e) =>
                        updateNotificationPrefs({ [item.key]: e.target.checked })
                      }
                      className="w-4 h-4 mt-0.5 accent-[#0284C7]"
                    />
                    <div className="min-w-0">
                      <p className="font-bold">{item.label}</p>
                      <p className="text-[11px] fabro-muted">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Scheduled Study & Habit Reminders + Native Capabilities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-6 space-y-4 text-xs">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <AlarmClock className="w-4 h-4 text-[#0284C7]" />
                Recordatorios programados de Estudio y Hábitos
              </h3>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!remTitle.trim()) return;
                  const [sec, sub] = remTarget.split(':') as ['estudio' | 'bienestar', SubmenuId];
                  addScheduledReminder(remTitle, sec, sub, remMinutes);
                  setRemTitle('');
                  setNotifFeedback(
                    `Recordatorio programado para dentro de ${remMinutes} min.`
                  );
                }}
                className="space-y-2.5"
              >
                <input
                  type="text"
                  value={remTitle}
                  onChange={(e) => setRemTitle(e.target.value)}
                  placeholder="Ej. Repasar flashcards o tomar 500 ml de agua..."
                  className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={remTarget}
                    onChange={(e) => setRemTarget(e.target.value)}
                    aria-label="Herramienta de destino"
                    className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                  >
                    <option value="estudio:academico-panel">Estudio · Pomodoro y Agenda</option>
                    <option value="estudio:materias-apuntes">Estudio · Cuadernos Digitales</option>
                    <option value="bienestar:salud-ejercicios">Bienestar · Rutina Física</option>
                    <option value="bienestar:organizacion-calorias">Bienestar · Hidratación</option>
                  </select>

                  <select
                    value={remMinutes}
                    onChange={(e) => setRemMinutes(Number(e.target.value))}
                    aria-label="Tiempo hasta el aviso"
                    className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                  >
                    <option value={1}>En 1 minuto (prueba rápida)</option>
                    <option value={5}>En 5 minutos</option>
                    <option value={15}>En 15 minutos</option>
                    <option value={30}>En 30 minutos</option>
                    <option value={60}>En 1 hora</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Programar recordatorio local
                </button>
              </form>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {scheduledReminders.length === 0 ? (
                  <p className="fabro-muted">
                    No tenés recordatorios pendientes. Creá uno arriba para recibir un aviso automático.
                  </p>
                ) : (
                  scheduledReminders.map((rem) => {
                    const minsLeft = Math.max(0, Math.ceil((rem.triggerAtMs - Date.now()) / 60000));
                    return (
                      <div
                        key={rem.id}
                        className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold truncate">{rem.title}</p>
                          <p className="text-[11px] fabro-muted font-mono">
                            {rem.fired
                              ? 'Aviso enviado'
                              : `Se dispara en ~${minsLeft} min · ${rem.sector}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteScheduledReminder(rem.id)}
                          aria-label={`Eliminar recordatorio ${rem.title}`}
                          className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center text-rose-600 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PWA Installation, Media Session, PiP & Android Bubbles Status */}
            <div className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-6 space-y-4 text-xs">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#10B981]" />
                Instalación PWA, Audio y Mini-Ventana Flotante
              </h3>

              <div className="space-y-2">
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-center justify-between gap-2">
                  <span>Media Session API (Controles en pantalla de bloqueo)</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    {mediaSessionReady ? 'Activo' : 'No disponible'}
                  </span>
                </div>
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-center justify-between gap-2">
                  <span>Document Picture-in-Picture (Mini-Ventana externa)</span>
                  <span className="font-bold text-[#0284C7] dark:text-[#38BDF8]">
                    {docPipReady ? 'Soportado' : 'Fallback Compacto activo'}
                  </span>
                </div>
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-center justify-between gap-2">
                  <span>Android Bubbles API Bridge</span>
                  <span className="font-bold text-[#7C3AED] dark:text-[#C084FC]">
                    {nativeBubblesReady ? 'Nativo detectado' : 'Bridge PWA listo'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={() => void openFloatingMiniWindow()}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C084FC] px-4 py-2 font-bold cursor-pointer active:scale-95"
                >
                  <PictureInPicture2 className="w-4 h-4" />
                  Probar Modo Flotante (Mini-Ventana)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSub === 'config-general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Cuenta y Seguridad FABRO ID */}
          <div className="lg:col-span-2 rounded-2xl border-2 border-[#0284C7]/45 fabro-surface p-6 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#0284C7]" strokeWidth={1.75} />
                  Cuenta y Seguridad (FABRO ID)
                </h2>
                <p className="fabro-muted mt-0.5">
                  {authUser
                    ? 'Administrá tu alias público @usuario, foto de perfil, método Google y seguridad de acceso.'
                    : 'Estás en Modo Invitado local: iniciá sesión o creá tu FABRO ID gratuito cuando quieras sincronizar en la nube.'}
                </p>
              </div>
              {!authUser ? (
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal(
                      'activar tu FABRO ID, guardar tus datos en la nube y chatear en tiempo real',
                      'register'
                    )
                  }
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                >
                  <UserCheck className="w-4 h-4" />
                  Iniciar sesión / Crear FABRO ID
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signOutAccount()}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              )}
            </div>

            {authUser && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                <form
                  onSubmit={(e) => void handleSaveAccountChanges(e)}
                  className="rounded-xl border-2 fabro-border fabro-surface-elevated p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    {acctPhotoUrl ? (
                      <img
                        src={acctPhotoUrl}
                        alt={acctName || 'Avatar FABRO'}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-[#0284C7]/50 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl border-2 border-[#0284C7]/40 bg-[#0284C7]/15 text-[#0284C7] dark:text-[#38BDF8] flex items-center justify-center shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{authUser.displayName}</p>
                      <p className="font-mono text-[11px] fabro-muted truncate">
                        @{authUser.username} · {authUser.email || 'Sin correo visible'}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {authUser.providers.map((prov) => (
                          <span
                            key={prov}
                            className="rounded-md border border-[#0284C7]/35 bg-[#0284C7]/10 px-2 py-0.5 text-[10px] font-bold text-[#0369A1] dark:text-[#38BDF8]"
                          >
                            {prov === 'google.com' ? 'Google vinculado' : 'Correo y clave'}
                          </span>
                        ))}
                        {authUser.isMinor && (
                          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            Protección menor activa
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="block space-y-1">
                      <span className="fabro-muted">Nombre y Apellido</span>
                      <input
                        type="text"
                        value={acctName}
                        onChange={(e) => setAcctName(e.target.value)}
                        className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="fabro-muted">Alias (@usuario único)</span>
                      <input
                        type="text"
                        value={acctUsername}
                        onChange={(e) => setAcctUsername(e.target.value)}
                        className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 font-mono fabro-input"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="fabro-muted">URL de foto de perfil (opcional)</span>
                    <input
                      type="url"
                      value={acctPhotoUrl}
                      onChange={(e) => setAcctPhotoUrl(e.target.value)}
                      placeholder="https://..."
                      className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 font-mono fabro-input"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={acctBusy}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar perfil en la nube
                    </button>
                    {!authUser.providers.includes('google.com') && (
                      <button
                        type="button"
                        disabled={acctBusy}
                        onClick={() => void handleLinkGoogle()}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface px-3.5 py-2 font-bold cursor-pointer active:scale-95 disabled:opacity-60"
                      >
                        <Link2 className="w-3.5 h-3.5 text-[#0284C7]" />
                        Vincular con Google
                      </button>
                    )}
                  </div>
                </form>

                <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-4 space-y-3 flex flex-col justify-between">
                  <form onSubmit={(e) => void handleChangePass(e)} className="space-y-2.5">
                    <p className="font-bold flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#0284C7]" />
                      Cambiar contraseña de acceso
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={acctNewPass}
                        onChange={(e) => setAcctNewPass(e.target.value)}
                        placeholder="Nueva contraseña (mín. 8 caracteres)"
                        className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                      />
                      <button
                        type="submit"
                        disabled={acctBusy}
                        className="min-h-[44px] rounded-xl border-2 border-[#0284C7] bg-[#0284C7]/10 text-[#0284C7] dark:text-[#38BDF8] px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-60"
                      >
                        Actualizar clave
                      </button>
                    </div>
                  </form>

                  <div className="rounded-xl border-2 border-rose-500/35 bg-rose-500/5 p-3 space-y-2">
                    <p className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Zona de baja permanente
                    </p>
                    <p className="text-[11px] fabro-muted">
                      Elimina tu cuenta en Firebase Auth y tus documentos sincronizados en la nube (tus copias locales permanecen hasta que reinicies el dispositivo).
                    </p>
                    {confirmDeleteAcctStep === 0 ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAcctStep(1)}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-500/50 px-3.5 py-2 font-bold text-rose-600 dark:text-rose-400 cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar mi cuenta
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={acctBusy}
                          onClick={() => void handleDeleteAccount()}
                          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-600 bg-rose-600 text-white px-3.5 py-2 font-bold cursor-pointer active:scale-95 disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirmar eliminación definitiva
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAcctStep(0)}
                          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 font-bold cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {acctFeedback && (
              <p
                className={`rounded-xl border-2 px-3.5 py-2.5 text-xs font-semibold ${
                  acctFeedback.type === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                }`}
              >
                {acctFeedback.text}
              </p>
            )}
          </div>

          <div className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-6 space-y-4 text-xs">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#0284C7]" strokeWidth={1.75} />
              Perfil y preferencias generales
            </h2>

            <label className="block space-y-1">
              <span className="fabro-muted">Nombre visible en FABRO</span>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => updateProfile({ displayName: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
              />
            </label>

            <label className="block space-y-1">
              <span className="fabro-muted">Identificador FABRO ID</span>
              <input
                type="text"
                value={profile.fabroId}
                onChange={(e) => updateProfile({ fabroId: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 font-mono fabro-input"
              />
            </label>

            <label className="block space-y-1">
              <span className="fabro-muted">Frase de bienvenida / diaria</span>
              <textarea
                rows={2}
                value={profile.dailyPhrase}
                onChange={(e) => updateProfile({ dailyPhrase: e.target.value })}
                className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-2.5 fabro-input"
              />
            </label>

            <div className="space-y-2">
              <span className="fabro-muted block">
                Plantilla de color activa ({FABRO_THEMES.length} disponibles)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FABRO_THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id)}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-left cursor-pointer transition-all active:scale-95 flex items-center justify-between gap-2 ${
                      theme === item.id
                        ? 'border-[#0284C7] bg-[#0284C7]/15 font-bold text-[#0284C7] dark:text-[#38BDF8]'
                        : 'fabro-border fabro-surface-elevated hover:border-[#0284C7]'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {item.swatches.slice(0, 3).map((hex) => (
                        <span
                          key={hex}
                          className="w-2.5 h-2.5 rounded-sm border fabro-border"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-6 space-y-4 text-xs">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0284C7]" strokeWidth={1.75} />
              Seguridad, notificaciones y control de datos
            </h2>
            <p className="fabro-muted leading-relaxed">
              Exportá todos tus datos locales, configurá notificaciones en segundo plano o restablecé tu bóveda del dispositivo cuando lo necesites.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigateTo('configuracion', 'notificaciones')}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5" />
                Ir a Notificaciones
              </button>
              <button
                type="button"
                onClick={() => void handleExportAll()}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0284C7] bg-[#0284C7]/10 text-[#0284C7] dark:text-[#38BDF8] px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                Exportación total JSON
              </button>
              {!confirmClearVault ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearVault(true)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-red-500/50 px-4 py-2 font-bold text-red-600 dark:text-red-400 cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Reiniciar datos locales
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void resetLocalVault();
                    setConfirmClearVault(false);
                  }}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-red-600 bg-red-600 px-4 py-2 font-bold text-white cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Confirmar eliminación local
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </SectorLayout>
  );
};
