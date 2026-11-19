import React, { useMemo } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Compass,
  FileText,
  Flag,
  Lightbulb,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  IDEA_CATEGORIES,
  isCulturalPostLike,
  REPORT_STATUS_LABELS,
  ROLE_META,
  type AdminNavSectionId,
} from '../../types/admin';

interface AdminDashboardAndStatsProps {
  mode: 'dashboard' | 'estadisticas';
  darkMode: boolean;
  onNavigateSection: (section: AdminNavSectionId) => void;
}

export const AdminDashboardAndStats: React.FC<AdminDashboardAndStatsProps> = ({
  mode,
  darkMode,
  onNavigateSection,
}) => {
  const { wallPosts } = useEcosystem();
  const {
    directoryUsers,
    allRestrictions,
    allReports,
    allSanctions,
    allStaff,
    allSectorRequests,
    ideaProposals,
    platformSectors,
    platformEvents,
    auditLogs,
    staffRole,
    canOpenSection,
  } = useAdmin();

  const surface = darkMode
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const subtleBg = darkMode ? 'bg-slate-800/60' : 'bg-slate-50';

  const metrics = useMemo(() => {
    const suspendedOrDisabled = allRestrictions.filter((r) =>
      ['suspendido', 'desactivado', 'eliminado'].includes(r.accountStatus)
    ).length;
    const activeUsersCount = Math.max(0, directoryUsers.length - suspendedOrDisabled);
    const pendingReports = allReports.filter(
      (r) => r.status === 'pendiente' || r.status === 'en_revision' || r.status === 'derivada_admin'
    ).length;
    const pendingAppeals = allSanctions.filter((s) => s.status === 'pendiente_apelacion').length;
    const activeSectors = platformSectors.filter((s) => s.active).length;
    const pendingSectorReqs = allSectorRequests.filter(
      (r) => r.status === 'pendiente' || r.status === 'en_evaluacion'
    ).length;
    const culturalPosts = wallPosts.filter((p) => isCulturalPostLike(p)).length;
    const hiddenPosts = wallPosts.filter(
      (p) => p.moderationStatus === 'oculta' || p.moderationStatus === 'eliminada'
    ).length;

    return {
      totalUsers: directoryUsers.length,
      activeUsersCount,
      suspendedOrDisabled,
      totalPosts: wallPosts.length,
      culturalPosts,
      hiddenPosts,
      pendingReports,
      totalReports: allReports.length,
      pendingAppeals,
      activeSectors,
      totalSectors: platformSectors.length,
      pendingSectorReqs,
      totalIdeas: ideaProposals.length,
      totalEvents: platformEvents.length,
      staffCount: allStaff.length,
    };
  }, [
    directoryUsers,
    allRestrictions,
    allReports,
    allSanctions,
    platformSectors,
    allSectorRequests,
    wallPosts,
    ideaProposals,
    platformEvents,
    allStaff,
  ]);

  const moderatorActivity = useMemo(() => {
    const byAdmin = new Map<string, { email: string; role: string; count: number; lastAt: string }>();
    auditLogs.forEach((log) => {
      const key = log.adminEmail || log.adminId;
      const prev = byAdmin.get(key);
      if (!prev) {
        byAdmin.set(key, {
          email: log.adminEmail || log.adminId,
          role: log.adminRole ? ROLE_META[log.adminRole]?.shortLabel || log.adminRole : 'Staff',
          count: 1,
          lastAt: log.createdAtIso || '',
        });
      } else {
        prev.count += 1;
        if ((log.createdAtIso || '') > prev.lastAt) {
          prev.lastAt = log.createdAtIso || '';
        }
      }
    });
    return Array.from(byAdmin.values()).sort((a, b) => b.count - a.count);
  }, [auditLogs]);

  const reportsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    allReports.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, count]) => ({
        label: REPORT_STATUS_LABELS[status as keyof typeof REPORT_STATUS_LABELS] || status,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [allReports]);

  const ideasByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    ideaProposals.forEach((idea) => {
      counts[idea.category] = (counts[idea.category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([cat, count]) => ({
        label: IDEA_CATEGORIES.find((c) => c.id === cat)?.label || cat,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [ideaProposals]);

  const postsByOrigin = useMemo(() => {
    const counts: Record<string, number> = {
      'Muro General': 0,
      'FABRO Cultura': 0,
      'Muro Estudio': 0,
      'Muro Bienestar': 0,
    };
    wallPosts.forEach((p) => {
      if (isCulturalPostLike(p)) counts['FABRO Cultura'] += 1;
      else if (p.origin === 'estudio') counts['Muro Estudio'] += 1;
      else if (p.origin === 'bienestar') counts['Muro Bienestar'] += 1;
      else counts['Muro General'] += 1;
    });
    return Object.entries(counts).filter(([, count]) => count > 0);
  }, [wallPosts]);

  const kpiCards: Array<{
    label: string;
    value: number;
    sub: string;
    icon: React.ReactNode;
    targetSection: AdminNavSectionId;
  }> = [
    {
      label: 'Usuarios registrados',
      value: metrics.totalUsers,
      sub: `${metrics.activeUsersCount} activos · ${metrics.suspendedOrDisabled} restring./susp.`,
      icon: <Users className="h-4 w-4" />,
      targetSection: 'usuarios',
    },
    {
      label: 'Denuncias pendientes',
      value: metrics.pendingReports,
      sub: `${metrics.totalReports} totales · ${metrics.pendingAppeals} apelaciones`,
      icon: <Flag className="h-4 w-4" />,
      targetSection: 'denuncias',
    },
    {
      label: 'Publicaciones en muros',
      value: metrics.totalPosts,
      sub: `${metrics.culturalPosts} en Cultura · ${metrics.hiddenPosts} moderadas`,
      icon: <FileText className="h-4 w-4" />,
      targetSection: 'publicaciones',
    },
    {
      label: 'Sectores activos',
      value: metrics.activeSectors,
      sub: `${metrics.totalSectors} configurados · ${metrics.pendingSectorReqs} solicitudes`,
      icon: <Compass className="h-4 w-4" />,
      targetSection: 'sectores_modulos',
    },
    {
      label: 'Ideas recibidas',
      value: metrics.totalIdeas,
      sub: 'Buzón comunitario activo',
      icon: <Lightbulb className="h-4 w-4" />,
      targetSection: 'ideas_propuestas',
    },
    {
      label: 'Eventos registrados',
      value: metrics.totalEvents,
      sub: `Rol actual: ${ROLE_META[staffRole].shortLabel}`,
      icon: <BarChart3 className="h-4 w-4" />,
      targetSection: 'eventos_actividades',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === 'dashboard' ? 'Resumen general de FABRO' : 'Estadísticas reales de la plataforma'}
        </h1>
        <p className={`mt-1 text-sm ${muted}`}>
          {mode === 'dashboard'
            ? 'Métricas sincronizadas en tiempo real desde Firestore Spark (sin datos simulados ni costos adicionales).'
            : 'Distribución verificable de actividad, denuncias, publicaciones y propuestas comunitarias.'}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => {
          const allowed = canOpenSection(card.targetSection);
          return (
            <button
              key={card.label}
              type="button"
              disabled={!allowed}
              onClick={() => allowed && onNavigateSection(card.targetSection)}
              className={`group rounded-xl border p-4 text-left transition ${surface} ${
                allowed
                  ? darkMode
                    ? 'hover:border-slate-600'
                    : 'hover:border-slate-400'
                  : 'cursor-default opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium uppercase tracking-wider ${muted}`}>
                  {card.label}
                </span>
                <span className={muted}>{card.icon}</span>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                {card.value}
              </p>
              <p className={`mt-1 text-xs ${muted}`}>{card.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Real Data Charts (ONLY rendered when real data exists) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Posts Distribution */}
        <section className={`rounded-xl border p-5 ${surface}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Distribución de publicaciones por espacio</h2>
            <span className={`text-xs tabular-nums ${muted}`}>{wallPosts.length} registros</span>
          </div>
          {postsByOrigin.length === 0 ? (
            <p className={`mt-6 text-center text-sm ${muted}`}>
              Aún no existen publicaciones registradas en la base de datos.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {postsByOrigin.map(([label, count]) => {
                const pct = wallPosts.length > 0 ? Math.round((count / wallPosts.length) * 100) : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{label}</span>
                      <span className={`tabular-nums ${muted}`}>
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className={`h-2 w-full overflow-hidden rounded-full ${subtleBg}`}>
                      <div
                        className={`h-full rounded-full ${
                          darkMode ? 'bg-slate-200' : 'bg-slate-900'
                        }`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Reports Distribution */}
        <section className={`rounded-xl border p-5 ${surface}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Estado de denuncias comunitarias</h2>
            <span className={`text-xs tabular-nums ${muted}`}>{allReports.length} denuncias</span>
          </div>
          {reportsByStatus.length === 0 ? (
            <p className={`mt-6 text-center text-sm ${muted}`}>
              No hay denuncias registradas actualmente.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {reportsByStatus.map((row) => {
                const pct =
                  allReports.length > 0 ? Math.round((row.count / allReports.length) * 100) : 0;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{row.label}</span>
                      <span className={`tabular-nums ${muted}`}>
                        {row.count} ({pct}%)
                      </span>
                    </div>
                    <div className={`h-2 w-full overflow-hidden rounded-full ${subtleBg}`}>
                      <div
                        className="h-full rounded-full bg-rose-600"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Stats mode extra breakdown: Ideas by category + Moderator activity */}
      {mode === 'estadisticas' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className={`rounded-xl border p-5 ${surface}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Ideas propuestas por categoría</h2>
              <span className={`text-xs tabular-nums ${muted}`}>
                {ideaProposals.length} ideas
              </span>
            </div>
            {ideasByCategory.length === 0 ? (
              <p className={`mt-6 text-center text-sm ${muted}`}>
                Sin ideas cargadas todavía en el buzón comunitario.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {ideasByCategory.map((item) => {
                  const pct =
                    ideaProposals.length > 0
                      ? Math.round((item.count / ideaProposals.length) * 100)
                      : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>{item.label}</span>
                        <span className={`tabular-nums ${muted}`}>{item.count}</span>
                      </div>
                      <div className={`h-1.5 w-full overflow-hidden rounded-full ${subtleBg}`}>
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${Math.max(6, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`rounded-xl border p-5 ${surface}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Actividad de moderadores y administradores</h2>
              <Activity className={`h-4 w-4 ${muted}`} />
            </div>
            {moderatorActivity.length === 0 ? (
              <p className={`mt-6 text-center text-sm ${muted}`}>
                Aún no se registraron acciones administrativas en el historial de auditoría.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-200/70">
                {moderatorActivity.slice(0, 8).map((row) => (
                  <div
                    key={row.email}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-medium">{row.email}</p>
                      <p className={muted}>{row.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{row.count} acciones</p>
                      <p className={muted}>
                        {row.lastAt ? new Date(row.lastAt).toLocaleDateString('es-AR') : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Recent Admin Activity */}
      <section className={`rounded-xl border p-5 ${surface}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${muted}`} />
            <h2 className="text-sm font-semibold">Actividad administrativa reciente</h2>
          </div>
          {canOpenSection('auditoria') && (
            <button
              type="button"
              onClick={() => onNavigateSection('auditoria')}
              className={`text-xs font-medium underline underline-offset-4 ${muted}`}
            >
              Ver registro completo
            </button>
          )}
        </div>
        {auditLogs.length === 0 ? (
          <div className={`mt-4 rounded-lg border border-dashed p-6 text-center text-sm ${muted}`}>
            No hay registros de auditoría aún. Cada acción administrativa quedará asentada aquí de
            forma inmutable.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} ${muted}`}>
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Responsable</th>
                  <th className="py-2 pr-3 font-medium">Acción</th>
                  <th className="py-2 pr-3 font-medium">Objetivo</th>
                  <th className="py-2 font-medium">Motivo / Detalle</th>
                </tr>
              </thead>
              <tbody className={darkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                {auditLogs.slice(0, 8).map((log) => (
                  <tr key={log.id}>
                    <td className={`whitespace-nowrap py-2.5 pr-3 tabular-nums ${muted}`}>
                      {log.createdAtIso
                        ? new Date(log.createdAtIso).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : 'Reciente'}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{log.adminEmail}</td>
                    <td className="py-2.5 pr-3">{log.action.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 pr-3">
                      {log.targetLabel || `${log.targetType} · ${log.targetId.slice(0, 10)}`}
                    </td>
                    <td className={`max-w-xs truncate py-2.5 ${muted}`}>
                      {log.reason || log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {metrics.pendingReports > 0 && canOpenSection('denuncias') && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
            darkMode
              ? 'border-amber-900/60 bg-amber-950/30 text-amber-200'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Tenés <strong className="tabular-nums">{metrics.pendingReports}</strong> denuncia(s)
              pendientes de revisión humana.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('denuncias')}
            className="min-h-[38px] rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Ir a Denuncias
          </button>
        </div>
      )}
    </div>
  );
};
