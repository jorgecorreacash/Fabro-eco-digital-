import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  KeyRound,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  assignOrUpdateStaffRole,
  issueUserSanctionAndRestriction,
  removeUserPlatformData,
  revokeStaffRole,
} from '../../services/adminService';
import {
  ALL_ADMIN_PERMISSIONS,
  canManageTargetRole,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_META,
  PRIMARY_SUPERADMIN_EMAIL,
  RESTRICTION_FLAGS_META,
  ROLE_META,
  SUPERADMIN_ONLY_PERMISSIONS,
  type AdminPermission,
  type AdminRole,
  type AdminStaffRecord,
  type DirectoryUserRecord,
  type StaffRole,
  type UserRestrictionFlag,
} from '../../types/admin';

interface AdminUsersAndRolesProps {
  mode: 'usuarios' | 'roles_permisos' | 'administradores_moderadores';
  darkMode: boolean;
}

const ALL_ROLES_ORDER: AdminRole[] = [
  'superadministrador',
  'administrador_general',
  'moderador_general',
  'moderador_cultural',
  'administrador_academico',
  'organizador',
  'usuario',
];

const STAFF_ROLES_ASSIGNABLE: StaffRole[] = [
  'superadministrador',
  'administrador_general',
  'moderador_general',
  'moderador_cultural',
  'administrador_academico',
  'organizador',
];

export const AdminUsersAndRoles: React.FC<AdminUsersAndRolesProps> = ({ mode, darkMode }) => {
  const { wallPosts } = useEcosystem();
  const {
    directoryUsers,
    allRestrictions,
    allSanctions,
    allStaff,
    staffRole,
    staffActor,
    can,
  } = useAdmin();

  const surface = darkMode
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = darkMode
    ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedUser, setSelectedUser] = useState<DirectoryUserRecord | null>(null);

  // Action modal state for user moderation
  const [actionModal, setActionModal] = useState<{
    user: DirectoryUserRecord;
    kind: 'advertir' | 'restringir' | 'suspender' | 'reactivar' | 'desactivar' | 'eliminar_datos';
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionDays, setActionDays] = useState(7);
  const [actionRestrictions, setActionRestrictions] = useState<UserRestrictionFlag[]>([]);
  const [confirmDangerText, setConfirmDangerText] = useState('');

  // Staff assignment state
  const [staffUid, setStaffUid] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffNextRole, setStaffNextRole] = useState<StaffRole>('moderador_general');
  const [staffCustomPerms, setStaffCustomPerms] = useState<AdminPermission[]>(
    DEFAULT_ROLE_PERMISSIONS.moderador_general
  );
  const [staffSectors, setStaffSectors] = useState<string>('*');
  const [staffReason, setStaffReason] = useState('');
  const [staffNotes, setStaffNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const restrictionByUid = useMemo(() => {
    const map = new Map<string, (typeof allRestrictions)[number]>();
    allRestrictions.forEach((r) => map.set(r.uid, r));
    return map;
  }, [allRestrictions]);

  const staffByUid = useMemo(() => {
    const map = new Map<string, AdminStaffRecord>();
    allStaff.forEach((s) => map.set(s.uid, s));
    return map;
  }, [allStaff]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return directoryUsers.filter((u) => {
      const rest = restrictionByUid.get(u.uid);
      const st = rest?.accountStatus || 'activo';
      if (statusFilter !== 'todos' && st !== statusFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        (u.customFabroId || '').toLowerCase().includes(q) ||
        (rest?.email || '').toLowerCase().includes(q)
      );
    });
  }, [directoryUsers, restrictionByUid, searchQuery, statusFilter]);

  const openAction = (
    user: DirectoryUserRecord,
    kind: NonNullable<typeof actionModal>['kind']
  ) => {
    const existing = restrictionByUid.get(user.uid);
    setActionModal({ user, kind });
    setActionReason('');
    setConfirmDangerText('');
    setActionDays(7);
    setActionRestrictions(existing?.restrictions || []);
    setFeedback(null);
  };

  const handleConfirmUserAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal || !staffActor) return;
    if (actionReason.trim().length < 5) {
      setFeedback({ kind: 'err', text: 'Registrá un motivo claro (mínimo 5 caracteres).' });
      return;
    }
    if (
      actionModal.kind === 'eliminar_datos' &&
      confirmDangerText.trim().toUpperCase() !== 'ELIMINAR'
    ) {
      setFeedback({
        kind: 'err',
        text: 'Escribí ELIMINAR para confirmar la eliminación definitiva de datos de plataforma.',
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    const existing = restrictionByUid.get(actionModal.user.uid) || null;
    try {
      if (actionModal.kind === 'eliminar_datos') {
        const res = await removeUserPlatformData(staffActor, {
          targetUid: actionModal.user.uid,
          targetName: actionModal.user.displayName,
          targetUsername: actionModal.user.username,
          reason: actionReason,
          existingRestriction: existing,
        });
        setFeedback({
          kind: 'ok',
          text: `Datos públicos y ${res.deletedPostsCount} publicaciones eliminados de Firestore. Recordatorio Spark gratuito: revocá el acceso de inicio de sesión desde Firebase Console > Authentication.`,
        });
      } else if (actionModal.kind === 'advertir') {
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: actionModal.user.uid,
          targetName: actionModal.user.displayName,
          sanctionType: 'advertencia',
          accountStatus: existing?.accountStatus === 'restringido' ? 'restringido' : 'advertido',
          restrictions: existing?.restrictions || [],
          reason: actionReason,
          existingRestriction: existing,
        });
        setFeedback({ kind: 'ok', text: `Advertencia registrada para ${actionModal.user.displayName}.` });
      } else if (actionModal.kind === 'restringir') {
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: actionModal.user.uid,
          targetName: actionModal.user.displayName,
          sanctionType: 'restriccion',
          accountStatus: actionRestrictions.length > 0 ? 'restringido' : 'activo',
          restrictions: actionRestrictions,
          reason: actionReason,
          existingRestriction: existing,
        });
        setFeedback({
          kind: 'ok',
          text: `Restricciones actualizadas para ${actionModal.user.displayName}.`,
        });
      } else if (actionModal.kind === 'suspender') {
        const expiresAtIso = new Date(Date.now() + actionDays * 86400 * 1000).toISOString();
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: actionModal.user.uid,
          targetName: actionModal.user.displayName,
          sanctionType: 'suspension_temporal',
          accountStatus: 'suspendido',
          restrictions: ['no_publicar', 'no_comentar', 'no_mensajes', 'no_cultura', 'no_eventos'],
          expiresAtIso,
          reason: actionReason,
          existingRestriction: existing,
        });
        setFeedback({
          kind: 'ok',
          text: `Cuenta suspendida temporalmente por ${actionDays} día(s).`,
        });
      } else if (actionModal.kind === 'desactivar') {
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: actionModal.user.uid,
          targetName: actionModal.user.displayName,
          sanctionType: 'desactivacion',
          accountStatus: 'desactivado',
          restrictions: ['no_publicar', 'no_comentar', 'no_mensajes', 'no_cultura', 'no_eventos'],
          reason: actionReason,
          existingRestriction: existing,
        });
        setFeedback({
          kind: 'ok',
          text: 'Cuenta desactivada de forma reversible (los datos del usuario se preservan).',
        });
      } else if (actionModal.kind === 'reactivar') {
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: actionModal.user.uid,
          targetName: actionModal.user.displayName,
          sanctionType: 'reactivacion',
          accountStatus: 'activo',
          restrictions: [],
          reason: actionReason,
          existingRestriction: existing,
        });
        setFeedback({ kind: 'ok', text: `Cuenta reactivada para ${actionModal.user.displayName}.` });
      }
      setActionModal(null);
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo completar la acción.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSelectRolePreset = (nextRole: StaffRole) => {
    setStaffNextRole(nextRole);
    setStaffCustomPerms([...DEFAULT_ROLE_PERMISSIONS[nextRole]]);
    setStaffSectors(nextRole === 'moderador_cultural' ? 'cultura' : '*');
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffActor) return;
    setBusy(true);
    setFeedback(null);
    try {
      const existing = staffByUid.get(staffUid.trim());
      await assignOrUpdateStaffRole(staffActor, {
        targetUid: staffUid.trim(),
        targetEmail: staffEmail.trim(),
        targetDisplayName: staffName.trim() || staffEmail.trim(),
        currentTargetRole: existing?.role || 'usuario',
        nextRole: staffNextRole,
        customPermissions: staffCustomPerms,
        allowedSectors: staffSectors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: staffNotes,
        reason: staffReason,
      });
      setFeedback({
        kind: 'ok',
        text: `Rol "${ROLE_META[staffNextRole].label}" guardado y verificado en Firestore.`,
      });
      setStaffUid('');
      setStaffEmail('');
      setStaffName('');
      setStaffReason('');
      setStaffNotes('');
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Error al asignar rol.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeStaff = async (member: AdminStaffRecord) => {
    if (!staffActor) return;
    const reason = staffReason.trim() || `Revocación de rol ${member.role} desde panel administrativo`;
    setBusy(true);
    setFeedback(null);
    try {
      await revokeStaffRole(staffActor, member, reason);
      setFeedback({
        kind: 'ok',
        text: `Acceso administrativo revocado inmediatamente para ${member.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo revocar el acceso.',
      });
    } finally {
      setBusy(false);
    }
  };

  const renderFeedback = () =>
    feedback && (
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
    );

  // ----------------------------------------------------------------
  // SECTION 2: USUARIOS
  // ----------------------------------------------------------------
  if (mode === 'usuarios') {
    const selectedUserPosts = selectedUser
      ? wallPosts.filter(
          (p) => p.authorUid === selectedUser.uid || p.fabroId === selectedUser.customFabroId
        )
      : [];
    const selectedUserSanctions = selectedUser
      ? allSanctions.filter((s) => s.userId === selectedUser.uid)
      : [];

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Administración de usuarios</h1>
            <p className={`mt-1 text-sm ${muted}`}>
              Consulta perfiles públicos, historial de sanciones y aplica medidas con motivo
              obligatorio. Ninguna cuenta es sancionada automáticamente por acumular denuncias.
            </p>
          </div>
          <span className={`text-xs font-medium tabular-nums ${muted}`}>
            {filteredUsers.length} de {directoryUsers.length} usuarios
          </span>
        </div>

        {renderFeedback()}

        {/* Search + Filter */}
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className={`pointer-events-none absolute left-3 top-3 h-4 w-4 ${muted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, @usuario, FABRO ID o UID..."
              className={`min-h-[42px] w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none ${inputCls}`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`min-h-[42px] rounded-lg border px-3 text-sm ${inputCls}`}
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="advertido">Advertidos</option>
            <option value="restringido">Restringidos</option>
            <option value="suspendido">Suspendidos</option>
            <option value="desactivado">Desactivados</option>
            <option value="eliminado">Datos eliminados</option>
          </select>
        </div>

        {/* Users Table */}
        <div className={`overflow-hidden rounded-xl border ${surface}`}>
          {filteredUsers.length === 0 ? (
            <div className={`p-10 text-center text-sm ${muted}`}>
              No se encontraron usuarios con los criterios aplicados.
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
                    <th className="px-4 py-3 font-medium">Usuario</th>
                    <th className="px-4 py-3 font-medium">Rol / Estado</th>
                    <th className="px-4 py-3 font-medium">Historial</th>
                    <th className="px-4 py-3 font-medium">Última actividad</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className={darkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                  {filteredUsers.map((u) => {
                    const rest = restrictionByUid.get(u.uid);
                    const staff = staffByUid.get(u.uid);
                    const accStatus = rest?.accountStatus || 'activo';
                    const isSelf = staffActor?.uid === u.uid;
                    return (
                      <tr key={u.uid}>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{u.displayName}</p>
                          <p className={`text-[11px] ${muted}`}>
                            @{u.username || 'sin-handle'} · UID {u.uid.slice(0, 10)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {staff ? ROLE_META[staff.role].shortLabel : 'Usuario'} ·{' '}
                            <span
                              className={
                                accStatus === 'activo'
                                  ? 'text-emerald-700'
                                  : accStatus === 'advertido' || accStatus === 'restringido'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }
                            >
                              {accStatus}
                            </span>
                          </p>
                          {rest && rest.restrictions.length > 0 && (
                            <p className={`text-[11px] ${muted}`}>
                              {rest.restrictions.join(', ')}
                            </p>
                          )}
                        </td>
                        <td className={`px-4 py-3 tabular-nums ${muted}`}>
                          {rest?.warningsCount ?? 0} adv. · {rest?.sanctionsCount ?? 0} sanc.
                        </td>
                        <td className={`px-4 py-3 tabular-nums ${muted}`}>
                          {u.updatedAtIso
                            ? new Date(u.updatedAtIso).toLocaleDateString('es-AR')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-slate-300 px-2.5 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Perfil
                            </button>
                            {!isSelf && can('advertir_usuarios') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openAction(u, 'advertir')}
                                  className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-amber-300 px-2.5 text-[11px] font-medium text-amber-800 hover:bg-amber-50"
                                >
                                  Advertir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAction(u, 'restringir')}
                                  className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-slate-300 px-2.5 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700"
                                >
                                  Restringir
                                </button>
                              </>
                            )}
                            {!isSelf && can('suspender_usuarios') && accStatus !== 'suspendido' && (
                              <button
                                type="button"
                                onClick={() => openAction(u, 'suspender')}
                                className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-rose-300 px-2.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                                Suspender
                              </button>
                            )}
                            {!isSelf && can('reactivar_usuarios') && accStatus !== 'activo' && (
                              <button
                                type="button"
                                onClick={() => openAction(u, 'reactivar')}
                                className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-emerald-300 px-2.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Reactivar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected User Drawer/Panel */}
        {selectedUser && (
          <section className={`space-y-4 rounded-xl border p-5 ${surface}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{selectedUser.displayName}</h2>
                <p className={`text-xs ${muted}`}>
                  @{selectedUser.username || 'sin-handle'} · UID: {selectedUser.uid} ·{' '}
                  {selectedUser.isMinor ? 'Menor de edad (protección reforzada)' : 'Adulto'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedUser.bio && <p className="text-sm">{selectedUser.bio}</p>}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  Publicaciones públicas ({selectedUserPosts.length})
                </h3>
                {selectedUserPosts.length === 0 ? (
                  <p className={`text-xs ${muted}`}>Sin publicaciones registradas en muros.</p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {selectedUserPosts.map((p) => (
                      <div
                        key={p.id}
                        className={`rounded-lg border p-2.5 text-xs ${
                          darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <p className="line-clamp-2">{p.text}</p>
                        <p className={`mt-1 text-[11px] ${muted}`}>
                          {p.createdAt} · Estado: {p.moderationStatus || 'visible'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  Historial de advertencias y sanciones ({selectedUserSanctions.length})
                </h3>
                {selectedUserSanctions.length === 0 ? (
                  <p className={`text-xs ${muted}`}>Sin sanciones ni advertencias.</p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {selectedUserSanctions.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded-lg border p-2.5 text-xs ${
                          darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <p className="font-semibold">
                          {s.sanctionType.replace(/_/g, ' ')} · {s.status.replace(/_/g, ' ')}
                        </p>
                        <p className={`mt-0.5 ${muted}`}>{s.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {staffActor?.uid !== selectedUser.uid && can('suspender_usuarios') && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className={`text-xs ${muted}`}>
                  Diferencia clave: <strong>Desactivar</strong> es reversible y preserva datos.{' '}
                  <strong>Eliminar datos</strong> borra perfil público y publicaciones en Firestore
                  (las credenciales de Firebase Auth requieren revocación en Firebase Console bajo
                  plan Spark gratuito).
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openAction(selectedUser, 'desactivar')}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Desactivar cuenta (reversible)
                  </button>
                  <button
                    type="button"
                    onClick={() => openAction(selectedUser, 'eliminar_datos')}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar datos de plataforma
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Confirmation Modal for Sensitive User Action */}
        {actionModal && (
          <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={handleConfirmUserAction}
              className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">
                    Confirmar acción: {actionModal.kind.replace(/_/g, ' ')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Usuario: {actionModal.user.displayName} (UID {actionModal.user.uid.slice(0, 12)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {actionModal.kind === 'restringir' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Restricciones específicas
                  </p>
                  {(Object.keys(RESTRICTION_FLAGS_META) as UserRestrictionFlag[]).map((flag) => {
                    const checked = actionRestrictions.includes(flag);
                    return (
                      <label
                        key={flag}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setActionRestrictions((prev) =>
                              checked ? prev.filter((x) => x !== flag) : [...prev, flag]
                            )
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <strong className="block text-slate-900">
                            {RESTRICTION_FLAGS_META[flag].label}
                          </strong>
                          <span className="text-slate-500">
                            {RESTRICTION_FLAGS_META[flag].description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {actionModal.kind === 'suspender' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Duración de la suspensión temporal (días)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={actionDays}
                    onChange={(e) => setActionDays(Math.max(1, Number(e.target.value) || 1))}
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>
              )}

              {actionModal.kind === 'eliminar_datos' && (
                <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
                    <p>
                      Esta acción elimina el perfil público y las publicaciones del usuario en
                      Firestore y bloquea su actividad en FABRO. Sin Cloud Functions (plan Spark
                      $0), la eliminación de la credencial en Firebase Auth se realiza desde Firebase
                      Console.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={confirmDangerText}
                    onChange={(e) => setConfirmDangerText(e.target.value)}
                    placeholder="Escribí ELIMINAR para confirmar"
                    className="min-h-[40px] w-full rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Motivo obligatorio (quedará en auditoría) *
                </label>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Indicá la causa verificada de esta medida..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="min-h-[42px] rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className={`min-h-[42px] rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50 ${
                    actionModal.kind === 'eliminar_datos' || actionModal.kind === 'suspender'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {busy ? 'Aplicando...' : 'Confirmar acción'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 4: ROLES Y PERMISOS (Full 7x18 RBAC Matrix)
  // ----------------------------------------------------------------
  if (mode === 'roles_permisos') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Roles y matriz de permisos</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Jerarquía verificada en servidor mediante Firestore Security Rules (principio de mínimo
            privilegio, sin autoelevación y con aislamiento estricto para Moderador cultural).
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ALL_ROLES_ORDER.map((r) => (
            <div key={r} className={`rounded-xl border p-4 ${surface}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{ROLE_META[r].label}</h2>
                <span className={`text-[11px] font-medium tabular-nums ${muted}`}>
                  {DEFAULT_ROLE_PERMISSIONS[r].length} permisos
                </span>
              </div>
              <p className={`mt-1.5 text-xs leading-relaxed ${muted}`}>{ROLE_META[r].description}</p>
              <p className="mt-2 text-[11px] font-medium">Alcance: {ROLE_META[r].scopeNote}</p>
            </div>
          ))}
        </div>

        {/* 18-Permission Matrix Table */}
        <div className={`overflow-hidden rounded-xl border ${surface}`}>
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold">
              Matriz de 18 permisos granulares por rol
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr
                  className={`border-b ${
                    darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
                  } ${muted}`}
                >
                  <th className="px-4 py-2.5 font-medium">Permiso</th>
                  {ALL_ROLES_ORDER.map((r) => (
                    <th key={r} className="px-2.5 py-2.5 text-center font-medium">
                      {ROLE_META[r].shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={darkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                {ALL_ADMIN_PERMISSIONS.map((perm) => (
                  <tr key={perm}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{PERMISSION_META[perm].label}</span>
                      <span className={`ml-2 text-[11px] ${muted}`}>
                        {PERMISSION_META[perm].group}
                      </span>
                    </td>
                    {ALL_ROLES_ORDER.map((r) => {
                      const has = DEFAULT_ROLE_PERMISSIONS[r].includes(perm);
                      return (
                        <td key={r} className="px-2.5 py-2.5 text-center">
                          {has ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-600" />
                          ) : (
                            <span className={muted}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 5: ADMINISTRADORES Y MODERADORES
  // ----------------------------------------------------------------
  const allowedRolesForActor: StaffRole[] =
    staffRole === 'superadministrador'
      ? STAFF_ROLES_ASSIGNABLE
      : ['moderador_general', 'moderador_cultural', 'administrador_academico', 'organizador'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Administradores y moderadores</h1>
        <p className={`mt-1 text-sm ${muted}`}>
          Designación y revocación inmediata en Firestore. Ningún usuario puede modificar sus propios
          permisos; solo un Superadministrador puede asignar roles de Superadministrador o
          Administrador general.
        </p>
      </div>

      {renderFeedback()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Assignment Form */}
        <form onSubmit={handleSaveStaff} className={`space-y-4 rounded-xl border p-5 lg:col-span-5 ${surface}`}>
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Asignar o actualizar rol administrativo</h2>
          </div>

          {directoryUsers.length > 0 && (
            <div>
              <label className={`mb-1 block text-xs font-medium ${muted}`}>
                Seleccionar usuario del directorio (opcional)
              </label>
              <select
                value=""
                onChange={(e) => {
                  const chosen = directoryUsers.find((u) => u.uid === e.target.value);
                  if (!chosen) return;
                  setStaffUid(chosen.uid);
                  setStaffName(chosen.displayName);
                  const existing = staffByUid.get(chosen.uid);
                  if (existing) {
                    setStaffEmail(existing.email);
                    setStaffNextRole(existing.role);
                    setStaffCustomPerms(existing.customPermissions);
                    setStaffSectors(existing.allowedSectors.join(', '));
                  }
                }}
                className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
              >
                <option value="">Elegir usuario registrado...</option>
                {directoryUsers
                  .filter((u) => u.uid !== staffActor?.uid)
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} (@{u.username || u.uid.slice(0, 8)})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={`mb-1 block text-xs font-medium ${muted}`}>UID de Firebase *</label>
              <input
                type="text"
                value={staffUid}
                onChange={(e) => setStaffUid(e.target.value)}
                placeholder="UID exacto del usuario"
                className={`min-h-[40px] w-full rounded-lg border px-3 text-xs font-mono ${inputCls}`}
                required
              />
            </div>
            <div>
              <label className={`mb-1 block text-xs font-medium ${muted}`}>Nombre visible *</label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Nombre completo"
                className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={`mb-1 block text-xs font-medium ${muted}`}>Correo verificado *</label>
              <input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="usuario@correo.com"
                className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                required
              />
            </div>
            <div>
              <label className={`mb-1 block text-xs font-medium ${muted}`}>Rol a asignar *</label>
              <select
                value={staffNextRole}
                onChange={(e) => handleSelectRolePreset(e.target.value as StaffRole)}
                className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
              >
                {allowedRolesForActor.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_META[r].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`mb-1 block text-xs font-medium ${muted}`}>
              Sectores habilitados (separados por coma o * para todos)
            </label>
            <input
              type="text"
              value={staffNextRole === 'moderador_cultural' ? 'cultura' : staffSectors}
              disabled={staffNextRole === 'moderador_cultural'}
              onChange={(e) => setStaffSectors(e.target.value)}
              className={`min-h-[40px] w-full rounded-lg border px-3 text-xs disabled:opacity-60 ${inputCls}`}
            />
          </div>

          <div>
            <p className={`mb-1.5 text-xs font-medium ${muted}`}>
              Permisos efectivos asignados ({staffCustomPerms.length})
            </p>
            <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5 dark:border-slate-800 sm:grid-cols-2">
              {ALL_ADMIN_PERMISSIONS.map((perm) => {
                const restrictedToSuper =
                  staffRole !== 'superadministrador' &&
                  SUPERADMIN_ONLY_PERMISSIONS.includes(perm);
                const checked =
                  staffNextRole === 'superadministrador' || staffCustomPerms.includes(perm);
                return (
                  <label
                    key={perm}
                    className={`flex items-center gap-2 text-[11px] ${
                      restrictedToSuper ? 'opacity-40' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={restrictedToSuper || staffNextRole === 'superadministrador'}
                      checked={checked}
                      onChange={() =>
                        setStaffCustomPerms((prev) =>
                          prev.includes(perm)
                            ? prev.filter((p) => p !== perm)
                            : [...prev, perm]
                        )
                      }
                    />
                    <span>{PERMISSION_META[perm].label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className={`mb-1 block text-xs font-medium ${muted}`}>
              Motivo del nombramiento o cambio *
            </label>
            <input
              type="text"
              value={staffReason}
              onChange={(e) => setStaffReason(e.target.value)}
              placeholder="Ej. Designación para moderación del Muro Cultural"
              className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {busy ? 'Guardando...' : 'Guardar rol y permisos'}
          </button>
        </form>

        {/* Active Staff List */}
        <section className={`space-y-4 rounded-xl border p-5 lg:col-span-7 ${surface}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <h2 className="text-sm font-semibold">
                Equipo activo con acceso a FABRO ADMIN ({allStaff.length + 1})
              </h2>
            </div>
          </div>

          {/* Primary Superadmin row */}
          <div
            className={`rounded-xl border p-4 ${
              darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Superadministrador principal (regla raíz)</p>
                <p className={`text-xs ${muted}`}>{PRIMARY_SUPERADMIN_EMAIL}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <Shield className="h-3.5 w-3.5" />
                Protegido en servidor
              </span>
            </div>
          </div>

          {allStaff.length === 0 ? (
            <div className={`rounded-xl border border-dashed p-8 text-center text-sm ${muted}`}>
              No hay administradores ni moderadores delegados todavía. Usá el formulario de la
              izquierda para nombrar integrantes del equipo.
            </div>
          ) : (
            <div className="space-y-3">
              {allStaff.map((member) => {
                const canModify = staffActor
                  ? canManageTargetRole(
                      staffRole,
                      staffActor.uid,
                      member.uid,
                      member.role,
                      member.role
                    ).allowed
                  : false;
                return (
                  <div
                    key={member.uid}
                    className={`space-y-2 rounded-xl border p-4 ${
                      darkMode ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{member.displayName}</p>
                        <p className={`text-xs ${muted}`}>
                          {member.email} · {ROLE_META[member.role].label} · Sectores:{' '}
                          {member.allowedSectors.join(', ') || '*'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setStaffUid(member.uid);
                                setStaffEmail(member.email);
                                setStaffName(member.displayName);
                                setStaffNextRole(member.role);
                                setStaffCustomPerms(member.customPermissions);
                                setStaffSectors(member.allowedSectors.join(', '));
                                setStaffNotes(member.notes || '');
                              }}
                              className="min-h-[34px] rounded-md border border-slate-300 px-3 text-xs font-medium hover:bg-slate-100 dark:border-slate-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRevokeStaff(member)}
                              className="min-h-[34px] rounded-md border border-rose-300 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              Revocar acceso
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className={`text-[11px] ${muted}`}>
                      Permisos ({member.customPermissions.length}):{' '}
                      {member.customPermissions
                        .map((p) => PERMISSION_META[p]?.label || p)
                        .join(' · ')}
                    </p>
                    <p className={`text-[11px] ${muted}`}>
                      Designado por {member.assignedByEmail || 'Superadministrador'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
