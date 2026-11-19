import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cloud,
  Cpu,
  CreditCard,
  Download,
  ExternalLink,
  HardDrive,
  KeyRound,
  Link2,
  Loader2,
  Monitor,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unplug,
  Upload,
  X,
} from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import {
  connectGoogleDriveWithPopup,
  deleteDriveBackupFile,
  disconnectDriveMemorySession,
  downloadDriveBackupJson,
  getDriveConnectionStatus,
  listDriveBackups,
  uploadDriveBackupJson,
  type DriveBackupFileEntry,
} from '../../lib/googleDriveBackup';
import {
  getSectorAiPreferences,
  updateSectorAiPreference,
} from '../../lib/fabroId';
import type {
  ConnectProviderCatalogEntry,
  ConnectProviderId,
  FabroSectorId,
  PersonalConnectionDTO,
  SectorAiPreferencesMap,
} from '../../types/fabro';

const PROVIDER_VISUALS: Record<
  ConnectProviderId,
  { badge: string; accent: string; ring: string }
> = {
  openai: { badge: 'GPT', accent: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-500/30 bg-emerald-500/10' },
  gemini: { badge: 'GEM', accent: 'text-sky-600 dark:text-sky-400', ring: 'border-sky-500/30 bg-sky-500/10' },
  claude: { badge: 'CLD', accent: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-500/30 bg-amber-500/10' },
  deepseek: { badge: 'DSK', accent: 'text-indigo-600 dark:text-indigo-400', ring: 'border-indigo-500/30 bg-indigo-500/10' },
  qwen: { badge: 'QWN', accent: 'text-violet-600 dark:text-violet-400', ring: 'border-violet-500/30 bg-violet-500/10' },
  mistral: { badge: 'MST', accent: 'text-orange-600 dark:text-orange-400', ring: 'border-orange-500/30 bg-orange-500/10' },
  grok: { badge: 'GRK', accent: 'text-slate-700 dark:text-slate-200', ring: 'border-slate-500/30 bg-slate-500/10' },
};

const SECTOR_LABELS: Array<{ id: FabroSectorId; name: string; desc: string }> = [
  { id: 'estudio', name: '1. Estudio', desc: 'Apuntes, resúmenes, exámenes e investigación' },
  { id: 'bienestar', name: '2. Bienestar y Salud', desc: 'Consejero personal, nutrición diaria, rutinas y reflexión' },
  { id: 'social', name: '3. Red Social FABRO', desc: 'Borradores, traducción de mensajes y moderación asistida' },
  { id: 'configuracion', name: '5. Configuración y Connect', desc: 'Diagnóstico técnico, respaldos y ayuda contextual' },
];

export const FabroConnectView: React.FC = () => {
  const {
    user,
    profile,
    subjects,
    notes,
    calendarEvents,
    decks,
    setActiveSection,
  } = useFabro();
  const {
    connectCatalog,
    chatgptOAuthConfigured,
    personalConnections,
    personalUsage,
    fabroBillingSummary,
    connectLoading,
    refreshConnectState,
    testPersonalConnection,
    savePersonalConnection,
    updatePersonalConnection,
    disconnectPersonalConnection,
    deletePersonalConnection,
    startChatGptOAuth,
  } = useAIGateway();

  const [activeTab, setActiveTab] = useState<'providers' | 'connections' | 'clouds' | 'guide'>('providers');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Per-sector AI defaults
  const [sectorPrefs, setSectorPrefs] = useState<SectorAiPreferencesMap>(() =>
    getSectorAiPreferences(user?.uid)
  );
  useEffect(() => {
    setSectorPrefs(getSectorAiPreferences(user?.uid));
  }, [user?.uid]);

  // Google Drive Backup State
  const [driveStatus, setDriveStatus] = useState(() => getDriveConnectionStatus());
  const [driveFiles, setDriveFiles] = useState<DriveBackupFileEntry[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [pendingDeleteDriveFile, setPendingDeleteDriveFile] = useState<DriveBackupFileEntry | null>(null);
  const [downloadedRestorePreview, setDownloadedRestorePreview] = useState<{
    fileName: string;
    summary: string;
    jsonText: string;
  } | null>(null);

  // Connect Modal State
  const [connectModalProvider, setConnectModalProvider] = useState<ConnectProviderCatalogEntry | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formRegionId, setFormRegionId] = useState('');
  const [formEndpointUrl, setFormEndpointUrl] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formDailyLimit, setFormDailyLimit] = useState<string>('0');
  const [formBudgetAlert, setFormBudgetAlert] = useState<string>('0');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [savingConnect, setSavingConnect] = useState(false);
  const [modalTestMessage, setModalTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [modalTesting, setModalTesting] = useState(false);

  // Web Viewer Modal State
  const [webViewerProvider, setWebViewerProvider] = useState<ConnectProviderCatalogEntry | null>(null);
  const [pendingOAuthUrl, setPendingOAuthUrl] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (evt: MessageEvent) => {
      if (evt.data && evt.data.type === 'fabro:oauth-connected') {
        setNotice({ kind: 'ok', text: 'Cuenta personal autorizada mediante OAuth 2.0 + PKCE.' });
        void refreshConnectState();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshConnectState]);

  const connectionsByProvider = useMemo(() => {
    const map = new Map<ConnectProviderId, PersonalConnectionDTO[]>();
    for (const c of personalConnections) {
      const list = map.get(c.providerId) || [];
      list.push(c);
      map.set(c.providerId, list);
    }
    return map;
  }, [personalConnections]);

  const openConnectModal = (provider: ConnectProviderCatalogEntry, existing?: PersonalConnectionDTO) => {
    setConnectModalProvider(provider);
    setEditingConnectionId(existing?.id || null);
    setFormLabel(existing?.label || `${provider.shortName} Personal`);
    setFormApiKey('');
    setFormRegionId(existing?.regionId || provider.regionalEndpoints?.[0]?.id || '');
    setFormEndpointUrl(existing?.endpointUrl || provider.defaultEndpoint || '');
    setFormModel(existing?.selectedModel || provider.defaultModel || '');
    setFormDailyLimit(String(existing?.dailyRequestLimit ?? 0));
    setFormBudgetAlert(String(existing?.monthlyBudgetAlertUsd ?? 0));
    setFormIsDefault(existing ? existing.isDefault : personalConnections.length === 0);
    setModalTestMessage(null);
  };

  const handleModalLiveTest = async () => {
    if (!connectModalProvider) return;
    setModalTesting(true);
    setModalTestMessage(null);
    try {
      const res = await testPersonalConnection({
        connectionId: editingConnectionId && !formApiKey.trim() ? editingConnectionId : undefined,
        providerId: connectModalProvider.id,
        apiKey: formApiKey.trim() || undefined,
        endpointUrl: formEndpointUrl.trim() || undefined,
        selectedModel: formModel.trim() || undefined,
      });
      setModalTestMessage({
        ok: res.ok && res.verified,
        text: res.ok
          ? res.message || 'Conexión verificada en vivo correctamente.'
          : res.error || 'La credencial no superó la verificación real.',
      });
    } catch (err) {
      setModalTestMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Error al probar conexión.',
      });
    } finally {
      setModalTesting(false);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectModalProvider) return;
    setSavingConnect(true);
    setModalTestMessage(null);
    try {
      await savePersonalConnection({
        id: editingConnectionId || undefined,
        providerId: connectModalProvider.id,
        label: formLabel.trim() || `${connectModalProvider.shortName} Personal`,
        apiKey: formApiKey.trim() || undefined,
        endpointUrl: formEndpointUrl.trim() || undefined,
        regionId: formRegionId || undefined,
        selectedModel: formModel.trim() || connectModalProvider.defaultModel,
        isDefault: formIsDefault,
        dailyRequestLimit: Math.max(0, Number(formDailyLimit) || 0),
        monthlyBudgetAlertUsd: Math.max(0, Number(formBudgetAlert) || 0),
      });
      setNotice({
        kind: 'ok',
        text: `${connectModalProvider.name} verificada, cifrada y conectada con éxito. Sin costo para la cuota FABRO.`,
      });
      setConnectModalProvider(null);
    } catch (err) {
      setModalTestMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'No se pudo conectar la cuenta.',
      });
    } finally {
      setSavingConnect(false);
    }
  };

  const handleTestExisting = async (conn: PersonalConnectionDTO) => {
    setTestingId(conn.id);
    setNotice(null);
    try {
      const res = await testPersonalConnection({ connectionId: conn.id });
      setNotice({
        kind: res.ok ? 'ok' : 'err',
        text: res.ok
          ? res.message || `Conexión ${conn.label} verificada.`
          : res.error || `Falló la verificación de ${conn.label}.`,
      });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Error al probar conexión.' });
    } finally {
      setTestingId(null);
    }
  };

  const handleDisconnect = async (conn: PersonalConnectionDTO) => {
    setBusyId(conn.id);
    setNotice(null);
    try {
      await disconnectPersonalConnection(conn.id);
      setNotice({ kind: 'ok', text: `Conexión "${conn.label}" desconectada.` });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'No se pudo desconectar.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (conn: PersonalConnectionDTO) => {
    setBusyId(conn.id);
    setNotice(null);
    try {
      await deletePersonalConnection(conn.id);
      setNotice({ kind: 'ok', text: `Credencial "${conn.label}" eliminada definitivamente del servidor.` });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'No se pudo eliminar.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleTriggerOAuthChatGpt = async () => {
    setNotice(null);
    setPendingOAuthUrl(null);
    try {
      const res = await startChatGptOAuth();
      if (!res.oauthConfigured || !res.authorizeUrl) {
        setNotice({
          kind: 'err',
          text:
            res.error ||
            'Sign in with ChatGPT requiere aprobación/Client ID de OpenAI. Podés conectar ya mismo tu API Key personal (BYOK) o usar el Visor Web.',
        });
        return;
      }
      setPendingOAuthUrl(res.authorizeUrl);
      setNotice({
        kind: 'ok',
        text: 'Enlace de autorización OAuth PKCE listo. Abrilo en una pestaña externa para vincular tu cuenta.',
      });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Error iniciando OAuth PKCE.' });
    }
  };

  const activeConnectedCount = personalConnections.filter(
    (c) => c.status === 'connected' && c.lastTestStatus === 'verified'
  ).length;

  const refreshDriveFiles = async () => {
    setDriveBusy(true);
    try {
      const files = await listDriveBackups();
      setDriveFiles(files);
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Error leyendo Google Drive.' });
    } finally {
      setDriveBusy(false);
    }
  };

  const handleConnectDrive = async () => {
    setDriveBusy(true);
    setNotice(null);
    try {
      const res = await connectGoogleDriveWithPopup();
      setDriveStatus(getDriveConnectionStatus());
      await refreshDriveFiles();
      setNotice({
        kind: 'ok',
        text: `Google Drive conectado${res.email ? ` (${res.email})` : ''}. Solo accede a respaldos creados por FABRO.`,
      });
    } catch (err) {
      setNotice({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo completar la conexión con Google Drive.',
      });
    } finally {
      setDriveBusy(false);
    }
  };

  const handleUploadDriveBackup = async () => {
    setDriveBusy(true);
    setNotice(null);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        platform: 'FABRO',
        uid: user?.uid || '',
        profile,
        subjects,
        notes,
        calendarEvents,
        decks,
      };
      const fileName = `fabro-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      await uploadDriveBackupJson(fileName, payload);
      await refreshDriveFiles();
      setNotice({ kind: 'ok', text: `Respaldo "${fileName}" guardado en la carpeta FABRO_Respaldos de Google Drive.` });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Error subiendo respaldo a Drive.' });
    } finally {
      setDriveBusy(false);
    }
  };

  const handleInspectDriveBackup = async (file: DriveBackupFileEntry) => {
    setDriveBusy(true);
    try {
      const data = await downloadDriveBackupJson(file.id);
      const sCount = Array.isArray(data.subjects) ? data.subjects.length : 0;
      const nCount = Array.isArray(data.notes) ? data.notes.length : 0;
      const cCount = Array.isArray(data.calendarEvents) ? data.calendarEvents.length : 0;
      setDownloadedRestorePreview({
        fileName: file.name,
        summary: `${sCount} materias · ${nCount} apuntes · ${cCount} eventos de calendario`,
        jsonText: JSON.stringify(data, null, 2),
      });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'No se pudo descargar el respaldo.' });
    } finally {
      setDriveBusy(false);
    }
  };

  const handleConfirmDeleteDriveBackup = async () => {
    if (!pendingDeleteDriveFile) return;
    setDriveBusy(true);
    try {
      await deleteDriveBackupFile(pendingDeleteDriveFile.id);
      setNotice({ kind: 'ok', text: `Respaldo "${pendingDeleteDriveFile.name}" eliminado de Google Drive.` });
      setPendingDeleteDriveFile(null);
      await refreshDriveFiles();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'No se pudo eliminar el respaldo.' });
    } finally {
      setDriveBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Strict Billing Separation Banner */}
      <section className="rounded-2xl border border-amber-500/25 fabro-shell-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-[#E5B842]">
              <span className="inline-flex items-center gap-1.5">
                <PlugZap className="w-4 h-4" />
                Sector 05 · FABRO Connect, Nube y BYOK
              </span>
              <button
                type="button"
                onClick={() => setActiveSection('inicio')}
                className="text-[11px] font-semibold normal-case tracking-normal text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-[#E5B842] cursor-pointer whitespace-nowrap"
              >
                ← Volver a Inicio
              </button>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#FAF6EE]">
              Conectá Google Drive, tus cuentas de IA (BYOK) y endpoints personales
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              Usá tus propios recursos y suscripciones sin consumir las 5 consultas gratuitas diarias de FABRO ni facturar al administrador.
              Tus credenciales se cifran con AES-256-GCM en el servidor y nunca vuelven sin enmascarar al navegador.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('configuracion')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/15 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap"
            >
              Configuración General
            </button>
            <button
              type="button"
              onClick={() => void refreshConnectState()}
              disabled={connectLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/15 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connectLoading ? 'animate-spin' : ''}`} />
              Actualizar estado
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('fabro-ai')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ir a FABRO IA
            </button>
          </div>
        </div>

        {/* Separated Billing Overview Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
              Consumo Personal (Tus Cuentas)
            </p>
            <p className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
              {activeConnectedCount} conectada(s) · {personalUsage?.queriesToday ?? 0} hoy
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Facturación directa de tu proveedor · 0 cuota FABRO consumida
            </p>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5">
            <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">
              Consumo FABRO (Cuota Plataforma)
            </p>
            <p className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
              {fabroBillingSummary
                ? `Plan ${fabroBillingSummary.planLabel} · ${fabroBillingSummary.usedToday}/${fabroBillingSummary.dailyLimit}`
                : 'Plan GRATIS · 0/5'}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Solo aplica cuando elegís &ldquo;Usar FABRO IA&rdquo;; nunca en consultas personales.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5">
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              Aislamiento de Credenciales
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              Sin fallback silencioso a clave general
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Si tu clave falla, FABRO te consulta antes de usar tu cuota institucional.
            </p>
          </div>
        </div>
      </section>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-3 ${
            notice.kind === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200'
          }`}
        >
          <span>{notice.text}</span>
          <div className="flex items-center gap-2">
            {pendingOAuthUrl && (
              <a
                href={pendingOAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
              >
                <ExternalLink className="w-3 h-3" />
                Autorizar en pestaña externa
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setPendingOAuthUrl(null);
              }}
              className="p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'providers', label: `Proveedores IA (${connectCatalog.length})` },
          { id: 'connections', label: `Conexiones y IA por Sector (${personalConnections.length})` },
          { id: 'clouds', label: 'Nubes y Respaldos (Google Drive)' },
          { id: 'guide', label: 'Guía API vs Suscripción y Costos' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === t.id
                ? 'bg-sky-600 text-white'
                : 'bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PROVIDER CARDS */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connectCatalog.map((prov) => {
            const visual = PROVIDER_VISUALS[prov.id] || PROVIDER_VISUALS.openai;
            const conns = connectionsByProvider.get(prov.id) || [];
            const activeConn = conns.find((c) => c.status === 'connected' && c.lastTestStatus === 'verified') || conns[0];
            const isVerifiedConnected = Boolean(
              activeConn && activeConn.status === 'connected' && activeConn.lastTestStatus === 'verified'
            );

            return (
              <article
                key={prov.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center font-mono text-xs font-bold shrink-0 ${visual.ring} ${visual.accent}`}
                      >
                        {visual.badge}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                          {prov.name}
                        </h3>
                        <p className="text-[11px] font-medium mt-0.5 flex items-center gap-1.5">
                          {isVerifiedConnected ? (
                            <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Conectada y verificada
                            </span>
                          ) : activeConn?.status === 'error' ? (
                            <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              Error de verificación
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">Desconectada</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {prov.description}
                  </p>

                  {/* Auth Methods & Availability */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3 space-y-1.5 text-[11px]">
                    <p className="text-slate-700 dark:text-slate-200">
                      <strong>Autenticación disponible:</strong>{' '}
                      {prov.authMethods
                        .map((m) =>
                          m === 'byok'
                            ? 'API Key personal (BYOK)'
                            : m === 'oauth_pkce'
                              ? chatgptOAuthConfigured && prov.id === 'openai'
                                ? 'OAuth 2.0 PKCE activo'
                                : 'OAuth PKCE (requiere aprobación OpenAI)'
                              : 'Visor web oficial'
                        )
                        .join(' · ')}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      <strong>Disponibilidad:</strong> {prov.oauthStatusNote}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 flex items-start gap-1">
                      <CreditCard className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                      <span>{prov.billingNote}</span>
                    </p>
                    {activeConn && (
                      <p className="font-mono text-[11px] text-sky-700 dark:text-sky-300 pt-1 border-t border-slate-200 dark:border-slate-800">
                        Credencial: {activeConn.maskedKey} · Modelo: {activeConn.selectedModel}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openConnectModal(prov, activeConn)}
                      className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      {activeConn ? 'ACTUALIZAR / CONECTAR' : 'CONECTAR'}
                    </button>

                    {activeConn && (
                      <button
                        type="button"
                        disabled={testingId === activeConn.id}
                        onClick={() => void handleTestExisting(activeConn)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500/40 cursor-pointer disabled:opacity-50"
                      >
                        {testingId === activeConn.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        PROBAR CONEXIÓN
                      </button>
                    )}

                    {activeConn && activeConn.status === 'connected' && (
                      <button
                        type="button"
                        disabled={busyId === activeConn.id}
                        onClick={() => void handleDisconnect(activeConn)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/15 cursor-pointer disabled:opacity-50"
                      >
                        <Unplug className="w-3.5 h-3.5" />
                        DESCONECTAR
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    {prov.id === 'openai' && (
                      <button
                        type="button"
                        onClick={() => void handleTriggerOAuthChatGpt()}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        <Link2 className="w-3 h-3" />
                        Sign in with ChatGPT (OAuth)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setWebViewerProvider(prov)}
                      className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer ml-auto"
                    >
                      <Monitor className="w-3 h-3" />
                      Visor Web oficial
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 2: PANEL MIS CONEXIONES & IA POR SECTOR */}
      {activeTab === 'connections' && (
        <div className="space-y-5">
          {/* Per-Sector AI Selector */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <Cpu className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  IA preferida por sector (Transversal)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Elegí qué proveedor o conexión personal actúa por defecto dentro de cada sector de FABRO.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SECTOR_LABELS.map((sec) => {
                const pref = sectorPrefs[sec.id];
                const selectVal =
                  pref.providerMode === 'personal' && pref.personalConnectionId
                    ? `personal:${pref.personalConnectionId}`
                    : pref.providerMode;
                return (
                  <div
                    key={sec.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-3.5 space-y-2"
                  >
                    <div>
                      <p className="font-display text-xs font-bold text-slate-900 dark:text-white">
                        {sec.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{sec.desc}</p>
                    </div>
                    <select
                      value={selectVal}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.startsWith('personal:')) {
                          const connId = v.slice('personal:'.length);
                          setSectorPrefs(
                            updateSectorAiPreference(user?.uid, sec.id, {
                              providerMode: 'personal',
                              personalConnectionId: connId,
                            })
                          );
                        } else {
                          setSectorPrefs(
                            updateSectorAiPreference(user?.uid, sec.id, {
                              providerMode: v as 'auto' | 'fabro_gemini' | 'fabro_openai',
                              personalConnectionId: undefined,
                            })
                          );
                        }
                        setNotice({ kind: 'ok', text: `IA predeterminada actualizada para ${sec.name}.` });
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="auto">Automático FABRO (Balanceo inteligente)</option>
                      <option value="fabro_gemini">FABRO Gateway · Google Gemini</option>
                      <option value="fabro_openai">FABRO Gateway · ChatGPT (OpenAI)</option>
                      {personalConnections
                        .filter((c) => c.status === 'connected')
                        .map((c) => (
                          <option key={c.id} value={`personal:${c.id}`}>
                            Personal · {c.label} ({c.providerName} · {c.selectedModel})
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Panel Mis Conexiones Personales (BYOK cifrado)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Administrá tus cuentas verificadas, modelos activos, límites diarios personales o revocá tus claves.
                </p>
              </div>
            </div>

            {personalConnections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Todavía no conectaste ninguna IA personal
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Andá a la pestaña Proveedores IA para vincular tu API Key personal de ChatGPT, Gemini, Claude, DeepSeek, Qwen, Mistral o Grok.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('providers')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Explorar proveedores
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {personalConnections.map((conn) => {
                  const catalogEntry = connectCatalog.find((p) => p.id === conn.providerId);
                  return (
                    <div
                      key={conn.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#090D16] p-4 space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                              {conn.label}
                            </h4>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              · {conn.providerName} · {conn.maskedKey}
                            </span>
                            {conn.isDefault && (
                              <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                                · Predeterminada
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                            Estado:{' '}
                            <strong
                              className={
                                conn.status === 'connected' && conn.lastTestStatus === 'verified'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {conn.status === 'connected' && conn.lastTestStatus === 'verified'
                                ? 'Conectada y verificada'
                                : conn.status === 'disconnected'
                                  ? 'Desconectada'
                                  : 'Error'}
                            </strong>{' '}
                            · Modelo: {conn.selectedModel} · Uso hoy: {conn.usedToday}
                            {conn.dailyRequestLimit > 0 ? `/${conn.dailyRequestLimit}` : ''} · Mes:{' '}
                            {conn.usedThisMonth} ({conn.tokensThisMonth.toLocaleString('es-AR')} tok)
                          </p>
                          {conn.lastError && (
                            <p className="text-[11px] text-red-600 dark:text-red-400">{conn.lastError}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {!conn.isDefault && conn.status === 'connected' && (
                            <button
                              type="button"
                              onClick={() => void updatePersonalConnection(conn.id, { isDefault: true })}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:border-sky-500/40 cursor-pointer"
                            >
                              Marcar predeterminada
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={testingId === conn.id}
                            onClick={() => void handleTestExisting(conn)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:border-sky-500/40 cursor-pointer"
                          >
                            {testingId === conn.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Probar
                          </button>
                          {catalogEntry && (
                            <button
                              type="button"
                              onClick={() => openConnectModal(catalogEntry, conn)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:border-sky-500/40 cursor-pointer"
                            >
                              Configurar
                            </button>
                          )}
                          {conn.status === 'connected' && (
                            <button
                              type="button"
                              onClick={() => void handleDisconnect(conn)}
                              className="rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 cursor-pointer"
                            >
                              Desconectar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDelete(conn)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: NUBES PERSONALES Y COPIAS DE SEGURIDAD */}
      {activeTab === 'clouds' && (
        <section className="space-y-5">
          {/* Google Drive Official OAuth Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Google Drive · Copias de Seguridad Personales
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Alcance mínimo (<code>drive.file</code>): FABRO solo accede a los respaldos JSON que creás en la carpeta <strong>FABRO_Respaldos</strong>. El token vive solo en memoria de sesión.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!driveStatus.connected ? (
                  <button
                    type="button"
                    disabled={driveBusy}
                    onClick={() => void handleConnectDrive()}
                    className="inline-flex items-center gap-2 rounded-lg bg-white text-slate-900 border border-slate-300 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 shadow-xs cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    {driveBusy ? 'Conectando...' : 'Conectar Google Drive'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={driveBusy}
                      onClick={() => void handleUploadDriveBackup()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Guardar respaldo ahora
                    </button>
                    <button
                      type="button"
                      disabled={driveBusy}
                      onClick={() => void refreshDriveFiles()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${driveBusy ? 'animate-spin' : ''}`} />
                      Listar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        disconnectDriveMemorySession();
                        setDriveStatus(getDriveConnectionStatus());
                        setDriveFiles([]);
                      }}
                      className="rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 cursor-pointer"
                    >
                      Desconectar sesión
                    </button>
                  </>
                )}
              </div>
            </div>

            {driveStatus.connected && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Conectado como {driveStatus.email || 'Cuenta Google verificada'} · {driveFiles.length} respaldo(s) en Drive
                </p>
                {driveFiles.length > 0 && (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                    {driveFiles.map((f) => (
                      <div key={f.id} className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{f.name}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {f.modifiedTime ? new Date(f.modifiedTime).toLocaleString('es-AR') : ''} · {(f.sizeBytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleInspectDriveBackup(f)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            Ver / Descargar
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteDriveFile(f)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Honest status for other clouds & local vault */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <HardDrive className="w-4 h-4 text-emerald-500" />
                <span>Bóveda Local FABRO (Offline First)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                IndexedDB + Service Worker activos. {subjects.length} materias, {notes.length} apuntes y {calendarEvents.length} eventos disponibles sin conexión.
              </p>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify({ exportedAt: new Date().toISOString(), profile, subjects, notes, calendarEvents, decks }, null, 2)],
                    { type: 'application/json' }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `fabro-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar copia JSON
              </button>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Microsoft OneDrive</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Estado honesto: Requiere App Registration Client ID de Microsoft Entra para sincronización automática directa.
              </p>
              <p className="text-[11px] text-slate-500">
                Podés descargar tu respaldo JSON local y subirlo a tu carpeta de OneDrive sin pérdida de datos.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Dropbox Personal</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Estado honesto: Requiere App Key de Dropbox para OAuth PKCE automático.
              </p>
              <p className="text-[11px] text-slate-500">
                Exportá tu copia JSON portable desde Bóveda Local para resguardarla en Dropbox cuando quieras.
              </p>
            </article>
          </div>
        </section>
      )}

      {/* TAB 4: GUÍA EDUCATIVA API KEY VS SUSCRIPCIÓN + CONSUMO */}
      {activeTab === 'guide' && (
        <section className="space-y-5">
          {/* Educational Guide Card */}
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Guía clara: ¿Qué es una API Key y en qué se diferencia de tu suscripción web?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong>Importante:</strong> pagar una suscripción web (como <em>ChatGPT Plus</em>, <em>Gemini Advanced</em> o <em>Claude Pro</em>) <strong>no incluye saldo de API para aplicaciones externas</strong>. Las APIs tienen su propia consola y facturación por uso (tokens), aunque muchos proveedores ofrecen créditos iniciales o niveles gratuitos (como Google AI Studio).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">1. Creá tu clave oficial</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Entrá al portal de desarrolladores del proveedor (en cada tarjeta tenés el botón &ldquo;Obtener API Key&rdquo;) y generá una clave secreta nueva.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">2. Cargá límites y presupuesto</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  En la consola de tu proveedor podés fijar tope mensual en USD, y dentro de FABRO podés sumar un límite diario de consultas personales.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">3. Seguridad y rotación</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  FABRO cifra tu clave en el servidor con AES-256-GCM, jamás la expone en el código del navegador y podés desconectarla o eliminarla con un clic.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                CONSUMO PERSONAL HOY
              </p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {personalUsage?.queriesToday ?? 0}
              </p>
              <p className="text-[11px] text-slate-500">0 consultas descontadas de FABRO</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                CONSUMO PERSONAL MES
              </p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {personalUsage?.queriesThisMonth ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {(personalUsage?.tokensThisMonth ?? 0).toLocaleString('es-AR')} tokens
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                COSTO ESTIMADO EN TU CUENTA
              </p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                ${(personalUsage?.estimatedPersonalUsdThisMonth ?? 0).toFixed(4)}
              </p>
              <p className="text-[11px] text-slate-500">Facturación directa de tus proveedores</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                CONSUMO FABRO (CUOTA PLAN)
              </p>
              <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-sky-600 dark:text-sky-400">
                {fabroBillingSummary ? `${fabroBillingSummary.usedToday}/${fabroBillingSummary.dailyLimit}` : '0/5'}
              </p>
              <p className="text-[11px] text-slate-500">
                Plan {fabroBillingSummary?.planLabel || 'GRATIS'} · {fabroBillingSummary?.remainingToday ?? 5} disponibles
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 overflow-x-auto">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white mb-3">
              Registro de operaciones personales (Facturación: Personal)
            </h3>
            {!personalUsage?.recentLogs.length ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aún no ejecutaste consultas con tus IAs personales.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Conexión</th>
                    <th className="py-2 pr-3">Modelo</th>
                    <th className="py-2 pr-3">Tokens</th>
                    <th className="py-2 pr-3">Facturación</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {personalUsage.recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 pr-3 font-mono tabular-nums text-[11px]">
                        {new Date(log.timestamp).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">
                        {log.connectionLabel}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px]">{log.modelId}</td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-[11px]">
                        {(log.inputTokens + log.outputTokens).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        CONSUMO PERSONAL
                      </td>
                      <td className="py-2 text-[11px]">
                        {log.status === 'success' ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Completada</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">{log.errorMessage || log.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* CONNECT / BYOK CONFIGURATION MODAL */}
      {connectModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Conectar {connectModalProvider.name} (BYOK cifrado)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Solo se guardará como &ldquo;Conectada&rdquo; tras superar una verificación en vivo real.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConnectModalProvider(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveModal(e)} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Nombre de esta conexión
                </label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-200">
                    API Key personal {editingConnectionId ? '(dejar vacío para conservar actual)' : ''}
                  </label>
                  <a
                    href={connectModalProvider.docsKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Obtener API Key
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  autoComplete="off"
                  required={!editingConnectionId}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="sk-... / AIza... (se cifra con AES-256-GCM en servidor)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Modelo preferido
                  </label>
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                  >
                    {connectModalProvider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Límite diario personal (0 = sin límite FABRO)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={formDailyLimit}
                    onChange={(e) => setFormDailyLimit(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Usar como IA personal predeterminada en FABRO IA
                </span>
              </label>

              {modalTestMessage && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    modalTestMessage.ok
                      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : 'border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200'
                  }`}
                >
                  {modalTestMessage.text}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={modalTesting}
                  onClick={() => void handleModalLiveTest()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500/40 cursor-pointer"
                >
                  {modalTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Probar antes de guardar
                </button>
                <button
                  type="submit"
                  disabled={savingConnect}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
                >
                  {savingConnect ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Verificar y Conectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEB VIEWER MODAL (Zero credential/cookie extraction, honest disclaimer) */}
      {webViewerProvider && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[85dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                  Visor Web Oficial · {webViewerProvider.name}
                </h3>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Aviso transparente: La sesión web no equivale a una API ni transfiere cookies a FABRO. Si el sitio bloquea carga embebida, abrilo en pestaña oficial.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={webViewerProvider.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  Abrir {webViewerProvider.shortName} en nueva pestaña
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setWebViewerProvider(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 relative bg-slate-100 dark:bg-[#090D16]">
              <iframe
                title={`Visor web ${webViewerProvider.name}`}
                src={webViewerProvider.officialUrl}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Explicit User Confirmation Dialog for Deleting a Google Drive Backup (Mandatory Workspace Guard) */}
      {pendingDeleteDriveFile && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              ¿Eliminar copia de seguridad en Google Drive?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Esta acción moverá a la papelera o eliminará el archivo <strong>{pendingDeleteDriveFile.name}</strong> de tu carpeta <strong>FABRO_Respaldos</strong> en Google Drive. Tu cuenta local de FABRO no se verá afectada.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteDriveFile(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={driveBusy}
                onClick={() => void handleConfirmDeleteDriveBackup()}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
              >
                Confirmar eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downloaded Google Drive Backup Preview / Export Modal */}
      {downloadedRestorePreview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Respaldo en Drive: {downloadedRestorePreview.fileName}
                </h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {downloadedRestorePreview.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDownloadedRestorePreview(null)}
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3 text-[11px] font-mono text-slate-700 dark:text-slate-300">
              {downloadedRestorePreview.jsonText.slice(0, 6000)}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([downloadedRestorePreview.jsonText], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = downloadedRestorePreview.fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar archivo completo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
