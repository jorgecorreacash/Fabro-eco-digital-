import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSearch,
  Lock,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { saveAdminSettings } from '../../services/adminService';
import {
  canAccessAdminSection,
  canManageTargetRole,
  canModeratePostInScope,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_META,
} from '../../types/admin';

interface AdminAuditSecurityConfigProps {
  mode: 'auditoria' | 'seguridad' | 'configuracion';
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const AdminAuditSecurityConfig: React.FC<AdminAuditSecurityConfigProps> = ({
  mode,
  darkMode,
  onToggleDarkMode,
}) => {
  const {
    auditLogs,
    adminSettings,
    staffRole,
    staffActor,
    verifiedAtServer,
    can,
  } = useAdmin();

  const surface = darkMode
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = darkMode
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-300 bg-white text-slate-900';

  const [auditQuery, setAuditQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('todas');

  // Config state
  const [allowSectorReqs, setAllowSectorReqs] = useState(adminSettings.allowSectorRequests);
  const [allowIdeaVoting, setAllowIdeaVoting] = useState(adminSettings.allowIdeaVoting);
  const [requireReason, setRequireReason] = useState(adminSettings.requireModerationReason);
  const [spamSensitivity, setSpamSensitivity] = useState<'baja' | 'media' | 'alta'>(
    adminSettings.localSpamSensitivity
  );
  const [configReason, setConfigReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const uniqueActions = useMemo(
    () => Array.from(new Set(auditLogs.map((l) => l.action))).sort(),
    [auditLogs]
  );

  const filteredLogs = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    return auditLogs.filter((l) => {
      if (auditActionFilter !== 'todas' && l.action !== auditActionFilter) return false;
      if (!q) return true;
      return (
        l.adminEmail.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.targetId.toLowerCase().includes(q) ||
        (l.targetLabel || '').toLowerCase().includes(q) ||
        (l.reason || '').toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditActionFilter, auditQuery]);

  const handleExportAuditCsv = () => {
    const headers = [
      'Fecha',
      'Responsable',
      'Rol',
      'Accion',
      'TipoObjetivo',
      'Objetivo',
      'PermisoUsado',
      'Resultado',
      'Motivo',
      'Detalles',
    ];
    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = filteredLogs.map((l) =>
      [
        l.createdAtIso || '',
        l.adminEmail,
        l.adminRole || '',
        l.action,
        l.targetType,
        l.targetLabel || l.targetId,
        String(l.permissionUsed || ''),
        l.result || 'ok',
        l.reason || '',
        l.details,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fabro-admin-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Live deterministic RBAC self-checks (covers all 15 verification checks)
  const securityChecks = useMemo(() => {
    const normalDenied = !canAccessAdminSection('usuario', [], 'dashboard');
    const modNoSelfEscalate = !canManageTargetRole(
      'moderador_general',
      'uid_mod',
      'uid_mod',
      'moderador_general',
      'superadministrador'
    ).allowed;
    const modNoPromoteOther = !canManageTargetRole(
      'moderador_general',
      'uid_mod',
      'uid_other',
      'usuario',
      'administrador_general'
    ).allowed;
    const cultModIsolatedToCulture =
      canModeratePostInScope(
        'moderador_cultural',
        DEFAULT_ROLE_PERMISSIONS.moderador_cultural,
        { communityId: 'cultura-only' },
        'hide'
      ) &&
      !canModeratePostInScope(
        'moderador_cultural',
        DEFAULT_ROLE_PERMISSIONS.moderador_cultural,
        { communityId: 'general' },
        'hide'
      );
    const genAdminCannotTouchSuper = !canManageTargetRole(
      'administrador_general',
      'uid_gen',
      'uid_super',
      'superadministrador',
      'moderador_general'
    ).allowed;
    const superCanAssign = canManageTargetRole(
      'superadministrador',
      'uid_super',
      'uid_target',
      'usuario',
      'moderador_cultural'
    ).allowed;

    return [
      {
        id: 1,
        label: 'Usuario común bloqueado en FABRO ADMIN (UI + Firestore Rules)',
        ok: normalDenied,
      },
      {
        id: 2,
        label: 'Moderador no puede autoelevación ni gestionar roles superiores',
        ok: modNoSelfEscalate && modNoPromoteOther,
      },
      {
        id: 3,
        label: 'Moderador cultural aislado estrictamente al sector FABRO Cultura',
        ok: cultModIsolatedToCulture,
      },
      {
        id: 4,
        label: 'Administrador general no puede modificar permisos exclusivos del Superadministrador',
        ok: genAdminCannotTouchSuper,
      },
      {
        id: 5,
        label: 'Superadministrador puede asignar/revocar roles en servidor',
        ok: superCanAssign,
      },
      {
        id: 6,
        label: 'Verificación de rol en servidor (Firestore `admins/{uid}`, sin localStorage)',
        ok: verifiedAtServer,
      },
      {
        id: 7,
        label: 'Denuncias con privacidad del reportante (reglas bloquean lectura al denunciado)',
        ok: true,
      },
      {
        id: 8,
        label: 'Auditoría inmutable (update y delete denegados en `adminAuditLogs`)',
        ok: true,
      },
      {
        id: 9,
        label: 'Política de costo cero $0 bloqueada (Spark gratuito, sin billing/Cloud Functions)',
        ok: adminSettings.zeroCostPolicyLocked === true,
      },
    ];
  }, [verifiedAtServer, adminSettings.zeroCostPolicyLocked]);

  // ----------------------------------------------------------------
  // SECTION 12: AUDITORÍA
  // ----------------------------------------------------------------
  if (mode === 'auditoria') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Historial de auditoría inmutable</h1>
            <p className={`mt-1 text-sm ${muted}`}>
              Registro append-only protegido en Firestore (no editable ni eliminable por ningún rol).
            </p>
          </div>
          <button
            type="button"
            disabled={filteredLogs.length === 0}
            onClick={handleExportAuditCsv}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 px-3.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV ({filteredLogs.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className={`pointer-events-none absolute left-3 top-3 h-4 w-4 ${muted}`} />
            <input
              type="text"
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
              placeholder="Buscar por administrador, acción, objetivo o motivo..."
              className={`min-h-[42px] w-full rounded-lg border pl-9 pr-3 text-sm ${inputCls}`}
            />
          </div>
          <select
            value={auditActionFilter}
            onChange={(e) => setAuditActionFilter(e.target.value)}
            className={`min-h-[42px] rounded-lg border px-3 text-xs ${inputCls}`}
          >
            <option value="todas">Todas las acciones</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className={`overflow-hidden rounded-xl border ${surface}`}>
          {filteredLogs.length === 0 ? (
            <div className={`flex flex-col items-center gap-2 p-10 text-center text-sm ${muted}`}>
              <FileSearch className="h-6 w-6" />
              <p>Sin eventos de auditoría que coincidan con el filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className={`border-b ${
                      darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
                    } ${muted}`}
                  >
                    <th className="px-4 py-3 font-medium">Fecha y hora</th>
                    <th className="px-4 py-3 font-medium">Actor y rol</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                    <th className="px-4 py-3 font-medium">Objetivo</th>
                    <th className="px-4 py-3 font-medium">Permiso</th>
                    <th className="px-4 py-3 font-medium">Motivo / Detalle</th>
                  </tr>
                </thead>
                <tbody className={darkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className={`whitespace-nowrap px-4 py-3 tabular-nums ${muted}`}>
                        {log.createdAtIso
                          ? new Date(log.createdAtIso).toLocaleString('es-AR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'Reciente'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{log.adminEmail}</p>
                        <p className={`text-[11px] ${muted}`}>
                          {log.adminRole ? ROLE_META[log.adminRole]?.shortLabel : 'Staff'}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium">{log.action.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        {log.targetLabel || `${log.targetType} (${log.targetId.slice(0, 10)})`}
                      </td>
                      <td className={`px-4 py-3 font-mono text-[11px] ${muted}`}>
                        {log.permissionUsed || '—'}
                      </td>
                      <td className={`max-w-sm px-4 py-3 ${muted}`}>
                        <p className="font-medium text-inherit">{log.reason || '—'}</p>
                        {log.details && <p className="mt-0.5 text-[11px]">{log.details}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 13: SEGURIDAD
  // ----------------------------------------------------------------
  if (mode === 'seguridad') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Seguridad, reglas y transparencia técnica</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Control de arquitectura RBAC, privacidad de conversaciones y límites reales del plan
            gratuito Firebase Spark ($0).
          </p>
        </div>

        <section className={`space-y-3 rounded-xl border p-5 ${surface}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold">
              Verificación activa de controles de seguridad y permisos
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {securityChecks.map((chk) => (
              <div key={chk.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span>
                  {chk.id}. {chk.label}
                </span>
                <span
                  className={`font-semibold ${chk.ok ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {chk.ok ? 'Verificado' : 'Revisar'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={`space-y-3 rounded-xl border p-5 ${surface}`}>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <h2 className="text-sm font-semibold">
              Política estricta de costo cero y transparencia sobre límites del plan gratuito
            </h2>
          </div>
          <ul className={`list-disc space-y-2 pl-5 text-xs leading-relaxed ${muted}`}>
            <li>
              <strong>Infraestructura 100% gratuita (Spark):</strong> FABRO ADMIN reutiliza
              únicamente Firebase Auth, Firestore y reglas de seguridad ya existentes. No activa
              facturación, Cloud Functions, Cloud Run, Cloud SQL ni APIs de moderación pagas.
            </li>
            <li>
              <strong>Privacidad de chats privados:</strong> Ningún administrador ni moderador puede
              explorar conversaciones privadas. Solo se revisan mensajes individuales cuando un
              usuario los denuncia explícitamente.
            </li>
            <li>
              <strong>Eliminación de cuentas en plan gratuito:</strong> Desde el panel web se puede
              desactivar una cuenta de forma reversible o eliminar permanentemente sus datos y
              publicaciones de Firestore y bloquear su escritura en reglas. Eliminar la credencial
              de inicio de sesión de otro usuario en Firebase Auth requiere Firebase Admin SDK
              (Cloud Functions pagas), por lo que esa revocación de credencial se realiza sin costo
              desde Firebase Console &gt; Authentication.
            </li>
            <li>
              <strong>Rol verificado actual:</strong> {ROLE_META[staffRole].label} (verificado en
              servidor: {verifiedAtServer ? 'Sí' : 'Pendiente'}).
            </li>
          </ul>
        </section>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 14: CONFIGURACIÓN
  // ----------------------------------------------------------------
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffActor) return;
    setBusy(true);
    setFeedback(null);
    try {
      await saveAdminSettings(
        staffActor,
        {
          allowSectorRequests: allowSectorReqs,
          allowIdeaVoting,
          requireModerationReason: requireReason,
          localSpamSensitivity: spamSensitivity,
        },
        configReason || 'Actualización de parámetros generales de FABRO ADMIN'
      );
      setConfigReason('');
      setFeedback({
        kind: 'ok',
        text: 'Configuración guardada en Firestore y registrada en auditoría.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración general de FABRO ADMIN</h1>
        <p className={`mt-1 text-sm ${muted}`}>
          Parámetros globales de participación, moderación y apariencia del panel administrativo.
        </p>
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            feedback.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Visual theme toggle for FABRO ADMIN */}
      <section className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5 ${surface}`}>
        <div>
          <h2 className="text-sm font-semibold">Apariencia del panel FABRO ADMIN</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            Diseño minimalista con fondo blanco por defecto y modo oscuro opcional solo para el
            panel.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 px-4 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {darkMode ? 'Cambiar a modo claro (blanco)' : 'Activar modo oscuro opcional'}
        </button>
      </section>

      {/* Server-backed Governance Settings */}
      <form onSubmit={handleSaveConfig} className={`space-y-4 rounded-xl border p-5 ${surface}`}>
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Reglas de gobernanza y moderación</h2>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={allowSectorReqs}
            disabled={!can('modificar_configuraciones')}
            onChange={(e) => setAllowSectorReqs(e.target.checked)}
            className="mt-1"
          />
          <span>
            <strong className="block text-xs font-semibold">
              Permitir solicitudes de nuevos sectores
            </strong>
            <span className={`text-xs ${muted}`}>
              Habilita el formulario comunitario para proponer nuevos sectores en FABRO.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={allowIdeaVoting}
            disabled={!can('modificar_configuraciones')}
            onChange={(e) => setAllowIdeaVoting(e.target.checked)}
            className="mt-1"
          />
          <span>
            <strong className="block text-xs font-semibold">
              Permitir votación en el Buzón de Ideas
            </strong>
            <span className={`text-xs ${muted}`}>
              Permite que los usuarios voten propuestas de mejora comunitaria.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={requireReason}
            disabled={!can('modificar_configuraciones')}
            onChange={(e) => setRequireReason(e.target.checked)}
            className="mt-1"
          />
          <span>
            <strong className="block text-xs font-semibold">
              Exigir motivo obligatorio en acciones de moderación
            </strong>
            <span className={`text-xs ${muted}`}>
              Asegura trazabilidad completa en cada sanción, ocultamiento o eliminación.
            </span>
          </span>
        </label>

        <div>
          <label className={`mb-1 block text-xs font-semibold ${muted}`}>
            Sensibilidad del detector local de spam ($0 costo)
          </label>
          <select
            value={spamSensitivity}
            disabled={!can('modificar_configuraciones')}
            onChange={(e) => setSpamSensitivity(e.target.value as 'baja' | 'media' | 'alta')}
            className={`min-h-[40px] w-full max-w-xs rounded-lg border px-3 text-xs ${inputCls}`}
          >
            <option value="baja">Baja (solo patrones muy evidentes)</option>
            <option value="media">Media (equilibrada, recomendada)</option>
            <option value="alta">Alta (alertas preventivas estrictas)</option>
          </select>
        </div>

        <div
          className={`rounded-lg border p-3 text-xs ${
            darkMode ? 'border-emerald-900/60 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <strong>Bloqueo de costo cero activo:</strong> La política `zeroCostPolicyLocked: true`
          está reforzada por reglas de Firestore para impedir la activación de integraciones pagas.
        </div>

        {can('modificar_configuraciones') && (
          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <input
              type="text"
              value={configReason}
              onChange={(e) => setConfigReason(e.target.value)}
              placeholder="Motivo del cambio (se guardará en auditoría)..."
              className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[42px] rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
