import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  Cpu,
  DollarSign,
  FolderKanban,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { SUPERADMIN_EMAIL, usePlatform } from '../../context/PlatformContext';
import {
  INSTRUCTOR_CATEGORY_LABELS,
  type AIBudgetConfig,
  type AIPlanPolicy,
  type AIProviderId,
} from '../../types/fabro';
import { FreemiumAdminControlPanel } from './FreemiumAdminControlPanel';

export const AdminPanelView: React.FC = () => {
  const { user, setActiveSection } = useFabro();
  const {
    isSuperAdmin,
    isAdmin,
    adminRole,
    courses,
    groups,
    sharedLibrary,
    youtubeVideos,
    institutions,
    taxonomy,
    categoryRecords,
    allVerifications,
    allReports,
    allSanctions,
    auditLogs,
    adminRecords,
    allUsersList,
    reviewInstructorVerification,
    updateInstitutionAdmin,
    savePlatformCategory,
    deletePlatformCategory,
    resolveModerationReport,
    issueUserSanction,
    resolveSanctionAppeal,
    assignAdminRole,
    revokeAdminRole,
  } = usePlatform();

  const {
    providers,
    models,
    providerStatuses,
    budgetConfig,
    adminSettings,
    requestsHistory,
    usageRecords,
    runtimeUsage,
    testingProviderId,
    seedDefaultGatewayConfig,
    toggleProviderEnabled,
    updateProviderDefaultModel,
    toggleModelEnabled,
    runProviderConnectionTest,
    saveBudgetConfig,
    saveAdminSettings,
    refreshRuntimeCatalog,
  } = useAIGateway();

  const [tab, setTab] = useState<
    | 'resumen'
    | 'ia_costos'
    | 'proveedores_ia'
    | 'presupuestos_ia'
    | 'verificaciones'
    | 'reportes'
    | 'sanciones'
    | 'categorias'
    | 'instituciones'
    | 'roles'
    | 'auditoria'
  >('resumen');

  const [budgetDraft, setBudgetDraft] = useState<AIBudgetConfig>(budgetConfig);
  const [budgetNotice, setBudgetNotice] = useState('');
  const [providerSyncNotice, setProviderSyncNotice] = useState('');

  useEffect(() => {
    setBudgetDraft(budgetConfig);
  }, [budgetConfig]);

  const [verNotes, setVerNotes] = useState<Record<string, string>>({});
  const [repNotes, setRepNotes] = useState<Record<string, string>>({});
  const [sanctionUid, setSanctionUid] = useState('');
  const [sanctionType, setSanctionType] = useState<'advertencia' | 'suspension' | 'revocacion_docente' | 'reactivacion'>('advertencia');
  const [sanctionReason, setSanctionReason] = useState('');

  const [newCatArea, setNewCatArea] = useState('');
  const [newCatSubs, setNewCatSubs] = useState('');

  const [roleUid, setRoleUid] = useState('');
  const [roleEmail, setRoleEmail] = useState('');
  const [roleLevel, setRoleLevel] = useState<'administrador' | 'moderador'>('moderador');

  const pendingVerifications = useMemo(
    () => allVerifications.filter((v) => v.status === 'pendiente' || v.status === 'requiere_documentacion'),
    [allVerifications]
  );
  const pendingReports = useMemo(
    () => allReports.filter((r) => r.status === 'pendiente' || r.status === 'en_revision'),
    [allReports]
  );

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Acceso restringido a administración
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Esta sección es exclusiva para el Administrador Principal ({SUPERADMIN_EMAIL}) y administradores/moderadores designados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
              GOBERNANZA Y MODERACIÓN · PROYECTO FABRO
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Panel Administrativo Universal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sesión: {user?.email} · Rol: <strong className="text-sky-600 dark:text-sky-400">{adminRole}</strong>
            </p>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {pendingVerifications.length} verificaciones pendientes · {pendingReports.length} reportes abiertos
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'resumen', label: 'Estadísticas' },
            { id: 'ia_costos', label: 'Control de IA y Costos' },
            { id: 'proveedores_ia', label: `Proveedores de IA (${providers.length})` },
            { id: 'presupuestos_ia', label: 'Presupuestos Gateway' },
            { id: 'verificaciones', label: `Verificaciones (${allVerifications.length})` },
            { id: 'reportes', label: `Reportes (${allReports.length})` },
            { id: 'sanciones', label: `Sanciones y Apelaciones (${allSanctions.length})` },
            { id: 'categorias', label: 'Categorías Academy' },
            { id: 'instituciones', label: `Instituciones (${institutions.length})` },
            ...(isSuperAdmin ? [{ id: 'roles', label: 'Roles Admin' }] : []),
            { id: 'auditoria', label: `Auditoría (${auditLogs.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveSection('explorer')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 cursor-pointer whitespace-nowrap"
          >
            Portales Explorer
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('ai-browser')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 cursor-pointer whitespace-nowrap"
          >
            Portales AI Browser
          </button>
        </div>
      </section>

      {tab === 'resumen' && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Usuarios registrados', value: allUsersList.length },
            { label: 'Cursos gratuitos activos', value: courses.length },
            { label: 'Comunidades y grupos', value: groups.length },
            { label: 'Biblioteca colaborativa', value: sharedLibrary.length },
            { label: 'Videos educativos', value: youtubeVideos.length },
            { label: 'Proveedores IA configurados', value: providers.filter((p) => p.configuredInBackend).length },
            { label: 'Acreditaciones por revisar', value: pendingVerifications.length },
            { label: 'Reportes pendientes', value: pendingReports.length },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {card.value}
              </p>
            </div>
          ))}
        </section>
      )}

      {tab === 'ia_costos' && <FreemiumAdminControlPanel />}

      {tab === 'proveedores_ia' && (
        <section className="space-y-4 text-xs">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>FABRO AI GATEWAY · Proveedores y Modelos Centralizados</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Las credenciales privadas residen exclusivamente en las variables Secrets del servidor. Desde aquí activás o desactivás proveedores, elegís el modelo predeterminado, probás conectividad real y gestionás la política de respaldo automático.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await refreshRuntimeCatalog();
                  await seedDefaultGatewayConfig();
                  setProviderSyncNotice('Catálogo y estado real sincronizados con Firestore y backend.');
                  window.setTimeout(() => setProviderSyncNotice(''), 3000);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sincronizar catálogo
              </button>
            </div>
          </div>

          {providerSyncNotice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-emerald-700 dark:text-emerald-300">
              {providerSyncNotice}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {providers.map((prov) => {
              const st = providerStatuses[prov.id];
              const provModels = models.filter((m) => m.providerId === prov.id);
              const isTesting = testingProviderId === prov.id;
              const tierLabel =
                prov.accessTier === 'open_selfhosted'
                  ? 'Abierto autoalojado'
                  : prov.accessTier === 'free_quota'
                    ? 'Cuota gratuita'
                    : 'Comercial API';
              const statusLabel =
                st?.status === 'activo'
                  ? 'Activo'
                  : st?.status === 'pendiente_configuracion'
                    ? 'Pendiente en Secrets'
                    : st?.status === 'desactivado'
                      ? 'Desactivado'
                      : 'Error';
              const statusTone =
                st?.status === 'activo'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : st?.status === 'pendiente_configuracion'
                    ? 'text-amber-600 dark:text-amber-300'
                    : st?.status === 'desactivado'
                      ? 'text-slate-500 dark:text-slate-400'
                      : 'text-rose-600 dark:text-rose-400';

              return (
                <article
                  key={prov.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        {prov.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tierLabel} · Variable backend:{' '}
                        <code className="font-mono text-slate-700 dark:text-slate-200">{prov.envVarName}</code>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${statusTone}`}>{statusLabel}</p>
                      {st && st.lastLatencyMs > 0 && (
                        <p className="text-[10px] font-mono tabular-nums text-slate-500">
                          {st.lastLatencyMs} ms
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300">{prov.pricingNote}</p>

                  {st?.lastError && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
                      {st.lastError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">
                        Modelo predeterminado
                      </label>
                      <select
                        value={prov.defaultModelId}
                        onChange={(e) => void updateProviderDefaultModel(prov.id as AIProviderId, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      >
                        {provModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleProviderEnabled(prov.id as AIProviderId, !prov.enabled)}
                        className={`flex-1 rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                          prov.enabled
                            ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {prov.enabled ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        disabled={isTesting}
                        onClick={() => void runProviderConnectionTest(prov.id as AIProviderId)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                      >
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Probar
                      </button>
                    </div>
                  </div>

                  {/* Model-level toggles */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Modelos disponibles ({provModels.length})
                    </p>
                    <div className="space-y-1">
                      {provModels.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5 text-[11px]"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {m.label}
                            </p>
                            <p className="text-[10px] font-mono tabular-nums text-slate-500">
                              ${m.inputCostPer1MUsd}/1M in · ${m.outputCostPer1MUsd}/1M out ·{' '}
                              {Math.round(m.maxContextTokens / 1000)}k ctx
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleModelEnabled(m.id, !m.enabled)}
                            className={`px-2 py-0.5 rounded font-semibold cursor-pointer shrink-0 ${
                              m.enabled
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {m.enabled ? 'Habilitado' : 'Oculto'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'presupuestos_ia' && (
        <section className="space-y-5 text-xs">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-slate-500 dark:text-slate-400">Gasto estimado hoy</p>
              <p className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white mt-1">
                ${(runtimeUsage?.dailyGlobalUsd || 0).toFixed(4)}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500">
                Tope diario: ${budgetConfig.dailyGlobalLimitUsd.toFixed(2)} USD
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-slate-500 dark:text-slate-400">Gasto estimado mes</p>
              <p className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white mt-1">
                ${(runtimeUsage?.monthlyGlobalUsd || 0).toFixed(4)}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500">
                Tope mensual: ${budgetConfig.monthlyGlobalLimitUsd.toFixed(2)} USD
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-slate-500 dark:text-slate-400">Consultas hoy (Gateway)</p>
              <p className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white mt-1">
                {runtimeUsage?.dailyGlobalRequests || 0}
              </p>
              <p className="text-[11px] text-slate-500">
                Límite por usuario: {budgetConfig.perUserDailyRequestLimit}/día
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
              <p className="text-slate-500 dark:text-slate-400">Registros en auditoría</p>
              <p className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white mt-1">
                {requestsHistory.length}
              </p>
              <p className="text-[11px] text-slate-500">
                Respaldo si excede: {budgetConfig.onBudgetExceeded === 'fallback_free' ? 'Pasar a gratuito' : 'Bloquear'}
              </p>
            </div>
          </div>

          {/* Budget & Policy Editor */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <DollarSign className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Límites globales, cuotas por estudiante y políticas de acceso</span>
            </div>

            {budgetNotice && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
                {budgetNotice}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Tope global diario (USD)</label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={budgetDraft.dailyGlobalLimitUsd}
                  onChange={(e) =>
                    setBudgetDraft((prev) => ({ ...prev, dailyGlobalLimitUsd: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Tope global mensual (USD)</label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  value={budgetDraft.monthlyGlobalLimitUsd}
                  onChange={(e) =>
                    setBudgetDraft((prev) => ({ ...prev, monthlyGlobalLimitUsd: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Consultas/día por usuario</label>
                <input
                  type="number"
                  min={1}
                  value={budgetDraft.perUserDailyRequestLimit}
                  onChange={(e) =>
                    setBudgetDraft((prev) => ({ ...prev, perUserDailyRequestLimit: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Tokens/día por usuario</label>
                <input
                  type="number"
                  step="10000"
                  min={1000}
                  value={budgetDraft.perUserDailyTokenLimit}
                  onChange={(e) =>
                    setBudgetDraft((prev) => ({ ...prev, perUserDailyTokenLimit: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Acción al agotar presupuesto</label>
                <select
                  value={budgetDraft.onBudgetExceeded}
                  onChange={(e) =>
                    setBudgetDraft((prev) => ({
                      ...prev,
                      onBudgetExceeded: e.target.value as 'fallback_free' | 'block',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5"
                >
                  <option value="fallback_free">Cambiar a modelos gratuitos/autoalojados</option>
                  <option value="block">Bloquear nuevas solicitudes</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Plan interno predeterminado</label>
                <select
                  value={budgetDraft.activePlanDefault}
                  onChange={(e) =>
                    setBudgetDraft((prev) => ({
                      ...prev,
                      activePlanDefault: e.target.value as AIPlanPolicy,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5"
                >
                  <option value="plan_gratuito">Plan Gratuito (solo gratuitos/abiertos)</option>
                  <option value="plan_educativo">Plan Educativo (router híbrido controlado)</option>
                  <option value="plan_administrador">Plan Administrador (acceso total)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Alerta preventiva (%)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={budgetDraft.alertThresholdPercent}
                  onChange={(e) =>
                    setBudgetDraft((prev) => ({ ...prev, alertThresholdPercent: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    await saveBudgetConfig(budgetDraft);
                    setBudgetNotice('Presupuestos y políticas actualizados en Firestore.');
                    window.setTimeout(() => setBudgetNotice(''), 3000);
                  }}
                  className="w-full rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Guardar límites
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              {[
                { key: 'allowAutomaticFallback' as const, label: 'Respaldo automático ante fallos' },
                { key: 'blockPaidModelsForFreePlan' as const, label: 'Bloquear APIs pagas en Plan Gratuito' },
                { key: 'minorStrictSafeRouting' as const, label: 'Filtro estricto para menores' },
                { key: 'enableStreaming' as const, label: 'Permitir streaming SSE' },
              ].map((pol) => (
                <label
                  key={pol.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 cursor-pointer"
                >
                  <span className="text-[11px] text-slate-700 dark:text-slate-300">{pol.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(adminSettings[pol.key])}
                    onChange={(e) => void saveAdminSettings({ [pol.key]: e.target.checked })}
                    className="rounded border-slate-300 text-sky-600"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Consumption by Provider */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Consumo por proveedor (hoy en servidor)
              </h3>
              {!runtimeUsage || Object.keys(runtimeUsage.byProvider).length === 0 ? (
                <p className="text-slate-500">Sin solicitudes registradas hoy aún.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-1.5">Proveedor</th>
                        <th className="py-1.5">Consultas</th>
                        <th className="py-1.5">Tokens</th>
                        <th className="py-1.5 text-right">USD Est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                      {Object.entries(runtimeUsage.byProvider).map(([pid, stats]) => (
                        <tr key={pid}>
                          <td className="py-1.5 font-sans font-semibold text-slate-900 dark:text-white">{pid}</td>
                          <td className="py-1.5">{stats.requests}</td>
                          <td className="py-1.5">{stats.tokens.toLocaleString('es-AR')}</td>
                          <td className="py-1.5 text-right">${stats.usd.toFixed(5)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Auditoría de solicitudes recientes ({requestsHistory.length})
              </h3>
              {requestsHistory.length === 0 ? (
                <p className="text-slate-500">Sin registros en AIRequests todavía.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {requestsHistory.slice(0, 25).map((req) => (
                    <div key={req.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {req.providerId} · {req.modelId}
                          {req.fallbackUsed ? ' (Respaldo)' : ''}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {req.userEmail || req.userId} · {req.routingMode}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums text-[10px] text-slate-600 dark:text-slate-300 shrink-0">
                        <p>{req.totalTokens.toLocaleString('es-AR')} tok</p>
                        <p>${req.estimatedCostUsd.toFixed(5)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {usageRecords.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Consolidado persistido en Firestore (`AIUsage`)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-1.5">Ámbito</th>
                      <th className="py-1.5">Fecha</th>
                      <th className="py-1.5">Gratis / Pagas</th>
                      <th className="py-1.5">Tokens</th>
                      <th className="py-1.5 text-right">USD Est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                    {usageRecords.slice(0, 20).map((u) => (
                      <tr key={u.id}>
                        <td className="py-1.5 font-sans">
                          {u.scope}: {u.scopeKey}
                        </td>
                        <td className="py-1.5">{u.dateKey}</td>
                        <td className="py-1.5">
                          {u.freeRequestsCount} / {u.paidRequestsCount}
                        </td>
                        <td className="py-1.5">{(u.inputTokens + u.outputTokens).toLocaleString('es-AR')}</td>
                        <td className="py-1.5 text-right">${u.estimatedCostUsd.toFixed(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'verificaciones' && (
        <section className="space-y-3">
          {allVerifications.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No hay solicitudes de acreditación registradas.
            </p>
          ) : (
            allVerifications.map((v) => (
              <div
                key={v.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {v.applicantName} · {v.specialty}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {INSTRUCTOR_CATEGORY_LABELS[v.category]?.label || v.category} ·{' '}
                      {v.institution || 'Independiente'} · {[v.city, v.country].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sky-600 dark:text-sky-400 font-semibold mt-0.5">
                      Estado actual: {v.status} · Contacto: {v.contactInfo || 'No informado'}
                    </p>
                  </div>
                </div>
                {v.experienceDetails && (
                  <p className="text-slate-700 dark:text-slate-300">{v.experienceDetails}</p>
                )}
                {v.evidenceSummary && (
                  <p className="text-slate-600 dark:text-slate-400">
                    Evidencia: {v.evidenceSummary}
                  </p>
                )}
                {v.evidenceFileUrl && (
                  <a
                    href={v.evidenceFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-sky-600 dark:text-sky-400 underline"
                  >
                    Ver comprobante adjunto ({v.evidenceFileName || 'archivo'})
                  </a>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={verNotes[v.id] ?? v.adminNote}
                    onChange={(e) => setVerNotes((prev) => ({ ...prev, [v.id]: e.target.value }))}
                    placeholder="Observación o motivo para el postulante..."
                    className="flex-1 min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void reviewInstructorVerification({
                        verification: v,
                        nextStatus: 'aprobado',
                        adminNote: verNotes[v.id] || 'Acreditación aprobada',
                      })
                    }
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void reviewInstructorVerification({
                        verification: v,
                        nextStatus: 'requiere_documentacion',
                        adminNote: verNotes[v.id] || 'Adjuntar más respaldo o portafolio.',
                      })
                    }
                    className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    Pedir documentación
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void reviewInstructorVerification({
                        verification: v,
                        nextStatus: 'rechazado',
                        adminNote: verNotes[v.id] || 'No cumple los requisitos de verificación.',
                      })
                    }
                    className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'reportes' && (
        <section className="space-y-3">
          {allReports.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No hay reportes registrados.</p>
          ) : (
            allReports.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-2.5 text-xs"
              >
                <p className="font-bold text-slate-900 dark:text-white">
                  [{r.targetType.toUpperCase()}] {r.targetSummary || r.targetId} · Estado: {r.status}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Reportado por {r.reporterName} · Motivo: {r.reason}
                </p>
                {r.details && <p className="text-slate-500 dark:text-slate-400">{r.details}</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <input
                    type="text"
                    value={repNotes[r.id] ?? r.resolutionNote}
                    onChange={(e) => setRepNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Resolución de moderación..."
                    className="flex-1 min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void resolveModerationReport(r.id, 'resuelta', repNotes[r.id] || 'Caso resuelto')
                    }
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    Marcar resuelto
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void resolveModerationReport(r.id, 'desestimada', repNotes[r.id] || 'Desestimado')
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Desestimar
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'sanciones' && (
        <section className="space-y-4 text-xs">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Aplicar medida disciplinaria o reactivación
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={sanctionUid}
                onChange={(e) => setSanctionUid(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="">Seleccionar usuario...</option>
                {allUsersList.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.email}) · {u.accountStatus || 'activo'}
                  </option>
                ))}
              </select>
              <select
                value={sanctionType}
                onChange={(e) => setSanctionType(e.target.value as typeof sanctionType)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="advertencia">Advertencia formal</option>
                <option value="suspension">Suspensión de cuenta</option>
                <option value="revocacion_docente">Revocación de acreditación docente</option>
                <option value="reactivacion">Reactivación de cuenta</option>
              </select>
              <input
                type="text"
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                placeholder="Motivo documentado *"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              disabled={!sanctionUid || !sanctionReason.trim()}
              onClick={() => {
                const target = allUsersList.find((u) => u.uid === sanctionUid);
                if (!target) return;
                void issueUserSanction({
                  userId: target.uid,
                  userName: target.displayName,
                  sanctionType,
                  reason: sanctionReason,
                });
                setSanctionReason('');
              }}
              className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              Registrar resolución
            </button>
          </div>

          <div className="space-y-2.5">
            {allSanctions.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {s.userName} · {s.sanctionType} · {s.status}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">{s.reason}</p>
                  {s.appealText && (
                    <p className="text-amber-600 dark:text-amber-300 mt-1">
                      Apelación del usuario: {s.appealText}
                    </p>
                  )}
                </div>
                {s.status === 'pendiente_apelacion' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void resolveSanctionAppeal(s, true)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                    >
                      Aceptar apelación
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolveSanctionAppeal(s, false)}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                    >
                      Mantener sanción
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'categorias' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Taxonomía dinámica de FABRO Academy ({taxonomy.length} áreas activas)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newCatArea}
              onChange={(e) => setNewCatArea(e.target.value)}
              placeholder="Área (nueva o existente, ej.: Ciencias Agrarias)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={newCatSubs}
              onChange={(e) => setNewCatSubs(e.target.value)}
              placeholder="Subcategorías separadas por coma"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            disabled={!newCatArea.trim()}
            onClick={() => {
              void savePlatformCategory({
                area: newCatArea,
                subcategories: newCatSubs
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                active: true,
              });
              setNewCatArea('');
              setNewCatSubs('');
            }}
            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
          >
            Agregar / ampliar categoría
          </button>

          {categoryRecords.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-500 dark:text-slate-400">Categorías personalizadas:</p>
              {categoryRecords.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>
                    <strong>{c.area}</strong>: {c.subcategories.join(', ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deletePlatformCategory(c.id)}
                    className="text-rose-500 hover:underline cursor-pointer"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'instituciones' && (
        <section className="space-y-2.5 text-xs">
          {institutions.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">No hay instituciones registradas aún.</p>
          ) : (
            institutions.map((inst) => (
              <div
                key={inst.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {inst.name} ({inst.institutionType})
                    {inst.verified ? ' · Verificada ✓' : ''}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {[inst.city, inst.province, inst.country].filter(Boolean).join(', ')} · Estado: {inst.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void updateInstitutionAdmin(inst.id, { verified: !inst.verified })}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    {inst.verified ? 'Quitar verificación' : 'Verificar'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void updateInstitutionAdmin(inst.id, {
                        status: inst.status === 'activa' ? 'suspendida' : 'activa',
                      })
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {inst.status === 'activa' ? 'Suspender' : 'Reactivar'}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'roles' && isSuperAdmin && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Delegar Administradores y Moderadores (exclusivo Superadministrador)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={roleUid}
              onChange={(e) => {
                const uid = e.target.value;
                setRoleUid(uid);
                const found = allUsersList.find((u) => u.uid === uid);
                if (found) setRoleEmail(found.email);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="">Seleccionar usuario...</option>
              {allUsersList
                .filter((u) => u.email !== SUPERADMIN_EMAIL)
                .map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
            </select>
            <select
              value={roleLevel}
              onChange={(e) => setRoleLevel(e.target.value as 'administrador' | 'moderador')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="moderador">Moderador</option>
              <option value="administrador">Administrador</option>
            </select>
            <button
              type="button"
              disabled={!roleUid || !roleEmail}
              onClick={() => {
                void assignAdminRole(roleUid, roleEmail, roleLevel);
                setRoleUid('');
                setRoleEmail('');
              }}
              className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              Asignar rol
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {adminRecords.map((rec) => (
              <div key={rec.uid} className="flex items-center justify-between py-1.5">
                <span>
                  <strong>{rec.email}</strong> · {rec.role}
                </span>
                <button
                  type="button"
                  onClick={() => void revokeAdminRole(rec.uid)}
                  className="text-rose-500 hover:underline cursor-pointer"
                >
                  Revocar rol
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'auditoria' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-2.5 text-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Registro inmutable de acciones administrativas
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">Sin acciones registradas aún.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {log.action} · [{log.targetType}: {log.targetId}]
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Por {log.adminEmail} · {log.details}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
