import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Lock,
  Scale,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  deleteModeratedPublicPost,
  issueUserSanctionAndRestriction,
  moderatePublicPost,
  resolveSanctionAppeal,
  updateModerationReport,
} from '../../services/adminService';
import {
  analyzeLocalSpamRisk,
  canModeratePostInScope,
  isCulturalPostLike,
  REPORT_STATUS_LABELS,
  type ModerationReportRecord,
  type ReportStatus,
  type UserSanctionRecord,
} from '../../types/admin';

interface AdminReportsAndModerationProps {
  mode: 'denuncias' | 'publicaciones';
  darkMode: boolean;
}

export const AdminReportsAndModeration: React.FC<AdminReportsAndModerationProps> = ({
  mode,
  darkMode,
}) => {
  const { wallPosts } = useEcosystem();
  const {
    allReports,
    allSanctions,
    allRestrictions,
    staffActor,
    staffRole,
    effectivePermissions,
    adminSettings,
    can,
  } = useAdmin();

  const surface = darkMode
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = darkMode
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-300 bg-white text-slate-900';

  const [reportTab, setReportTab] = useState<'denuncias' | 'apelaciones'>('denuncias');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedReport, setSelectedReport] = useState<ModerationReportRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [appealResolutionDrafts, setAppealResolutionDrafts] = useState<Record<string, string>>({});

  // Posts moderation state
  const [postQuery, setPostQuery] = useState('');
  const [postSpaceFilter, setPostSpaceFilter] = useState<'todos' | 'general' | 'cultura' | 'ocultas' | 'spam'>('todos');
  const [modReasonDrafts, setModReasonDrafts] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const culturalOnly = staffRole === 'moderador_cultural';

  const filteredReports = useMemo(() => {
    return allReports.filter((r) => {
      if (culturalOnly && r.sector !== 'cultura') return false;
      if (statusFilter !== 'todos' && r.status !== statusFilter) return false;
      return true;
    });
  }, [allReports, culturalOnly, statusFilter]);

  const pendingAppeals = useMemo(
    () => allSanctions.filter((s) => s.status === 'pendiente_apelacion' || Boolean(s.appealText)),
    [allSanctions]
  );

  const recentPostTexts = useMemo(() => wallPosts.map((p) => p.text), [wallPosts]);

  const postsWithAnalysis = useMemo(() => {
    const q = postQuery.trim().toLowerCase();
    return wallPosts
      .filter((p) => {
        if (culturalOnly && !isCulturalPostLike(p)) return false;
        if (postSpaceFilter === 'cultura' && !isCulturalPostLike(p)) return false;
        if (postSpaceFilter === 'general' && isCulturalPostLike(p)) return false;
        if (
          postSpaceFilter === 'ocultas' &&
          p.moderationStatus !== 'oculta' &&
          p.moderationStatus !== 'eliminada'
        ) {
          return false;
        }
        if (q) {
          const match =
            p.text.toLowerCase().includes(q) ||
            p.author.toLowerCase().includes(q) ||
            (p.categoryTag || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .map((p) => ({
        post: p,
        spam: analyzeLocalSpamRisk(p.text, recentPostTexts, adminSettings.localSpamSensitivity),
      }))
      .filter((entry) =>
        postSpaceFilter === 'spam' ? entry.spam.level !== 'limpio' : true
      );
  }, [
    wallPosts,
    culturalOnly,
    postSpaceFilter,
    postQuery,
    recentPostTexts,
    adminSettings.localSpamSensitivity,
  ]);

  const handleReportDecision = async (
    report: ModerationReportRecord,
    nextStatus: ReportStatus,
    actionLabel: string,
    extraAction?: 'hide_post' | 'delete_post' | 'warn_user' | 'restrict_user' | 'suspend_user'
  ) => {
    if (!staffActor) return;
    const note = resolutionNote.trim();
    if (note.length < 4) {
      setFeedback({
        kind: 'err',
        text: 'Ingresá un motivo o nota de revisión (mínimo 4 caracteres) antes de aplicar la acción.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (extraAction === 'hide_post' && report.targetId) {
        await moderatePublicPost(staffActor, report.targetId, 'oculta', note, report.sector || 'general');
      } else if (extraAction === 'delete_post' && report.targetId) {
        await deleteModeratedPublicPost(staffActor, report.targetId, note, report.sector || 'general');
      } else if (extraAction === 'warn_user' && report.targetAuthorUid) {
        const existing = allRestrictions.find((r) => r.uid === report.targetAuthorUid) || null;
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: report.targetAuthorUid,
          targetName: report.targetAuthorName || 'Usuario reportado',
          sanctionType: 'advertencia',
          accountStatus: existing?.accountStatus === 'restringido' ? 'restringido' : 'advertido',
          restrictions: existing?.restrictions || [],
          reason: note,
          sector: report.sector || 'general',
          existingRestriction: existing,
        });
      } else if (extraAction === 'restrict_user' && report.targetAuthorUid) {
        const existing = allRestrictions.find((r) => r.uid === report.targetAuthorUid) || null;
        const flag = report.sector === 'cultura' ? 'no_cultura' : 'no_publicar';
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: report.targetAuthorUid,
          targetName: report.targetAuthorName || 'Usuario reportado',
          sanctionType: 'restriccion',
          accountStatus: 'restringido',
          restrictions: Array.from(new Set([...(existing?.restrictions || []), flag])),
          reason: note,
          sector: report.sector || 'general',
          existingRestriction: existing,
        });
      } else if (extraAction === 'suspend_user' && report.targetAuthorUid) {
        const existing = allRestrictions.find((r) => r.uid === report.targetAuthorUid) || null;
        await issueUserSanctionAndRestriction(staffActor, {
          targetUid: report.targetAuthorUid,
          targetName: report.targetAuthorName || 'Usuario reportado',
          sanctionType: 'suspension_temporal',
          accountStatus: 'suspendido',
          restrictions: ['no_publicar', 'no_comentar', 'no_mensajes', 'no_cultura', 'no_eventos'],
          expiresAtIso: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
          reason: note,
          sector: report.sector || 'general',
          existingRestriction: existing,
        });
      }

      await updateModerationReport(staffActor, report, {
        status: nextStatus,
        resolutionAction: actionLabel,
        resolutionNote: note,
        assignToSelf: true,
      });

      setFeedback({
        kind: 'ok',
        text: `Denuncia actualizada a "${REPORT_STATUS_LABELS[nextStatus]}" (${actionLabel}) y registrada en auditoría.`,
      });
      setResolutionNote('');
      setSelectedReport(null);
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo procesar la denuncia.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResolveAppeal = async (sanction: UserSanctionRecord, decision: 'aceptada' | 'rechazada') => {
    if (!staffActor) return;
    const text = (appealResolutionDrafts[sanction.id] || '').trim();
    if (text.length < 5) {
      setFeedback({ kind: 'err', text: 'Escribí el fundamento de la resolución (mínimo 5 caracteres).' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await resolveSanctionAppeal(staffActor, sanction, decision, text);
      setFeedback({
        kind: 'ok',
        text:
          decision === 'aceptada'
            ? 'Apelación aceptada: la sanción fue levantada y la cuenta reactivada.'
            : 'Apelación rechazada con fundamento registrado en auditoría.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Error al resolver apelación.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleModeratePost = async (
    postId: string,
    action: 'visible' | 'oculta' | 'delete',
    isCulture: boolean
  ) => {
    if (!staffActor) return;
    const reason = (modReasonDrafts[postId] || '').trim();
    if (reason.length < 4) {
      setFeedback({
        kind: 'err',
        text: 'Ingresá un motivo de moderación (mínimo 4 caracteres) en la tarjeta de la publicación.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (action === 'delete') {
        await deleteModeratedPublicPost(staffActor, postId, reason, isCulture ? 'cultura' : 'general');
        setFeedback({ kind: 'ok', text: 'Publicación eliminada y registrada en auditoría.' });
      } else {
        await moderatePublicPost(staffActor, postId, action, reason, isCulture ? 'cultura' : 'general');
        setFeedback({
          kind: 'ok',
          text:
            action === 'oculta'
              ? 'Publicación ocultada de los muros comunitarios en vivo.'
              : 'Publicación restaurada y visible nuevamente.',
        });
      }
      setModReasonDrafts((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo moderar la publicación.',
      });
    } finally {
      setBusy(false);
    }
  };

  // ----------------------------------------------------------------
  // SECTION 3: DENUNCIAS Y APELACIONES
  // ----------------------------------------------------------------
  if (mode === 'denuncias') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Denuncias y apelaciones</h1>
            <p className={`mt-1 text-sm ${muted}`}>
              Revisión humana obligatoria. La identidad del denunciante permanece bloqueada para la
              persona reportada mediante reglas de servidor.
              {culturalOnly ? ' · Ámbito activo: exclusivo FABRO Cultura.' : ''}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setReportTab('denuncias')}
              className={`min-h-[38px] rounded-lg px-3.5 text-xs font-medium ${
                reportTab === 'denuncias'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              Denuncias ({filteredReports.length})
            </button>
            <button
              type="button"
              onClick={() => setReportTab('apelaciones')}
              className={`min-h-[38px] rounded-lg px-3.5 text-xs font-medium ${
                reportTab === 'apelaciones'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              Apelaciones ({pendingAppeals.length})
            </button>
          </div>
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

        {reportTab === 'denuncias' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(['todos', 'pendiente', 'en_revision', 'requiere_informacion', 'derivada_admin', 'resuelta', 'desestimada'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`min-h-[34px] rounded-lg border px-3 text-xs font-medium ${
                        statusFilter === st
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : darkMode
                          ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {st === 'todos' ? 'Todas' : REPORT_STATUS_LABELS[st]}
                    </button>
                  )
                )}
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs ${muted}`}>
                <Lock className="h-3.5 w-3.5" />
                Chats privados no accesibles · Solo mensajes puntualmente denunciados
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className={`overflow-hidden rounded-xl border lg:col-span-7 ${surface}`}>
                {filteredReports.length === 0 ? (
                  <div className={`p-10 text-center text-sm ${muted}`}>
                    No hay denuncias en este filtro.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredReports.map((rep) => (
                      <button
                        key={rep.id}
                        type="button"
                        onClick={() => {
                          setSelectedReport(rep);
                          setResolutionNote(rep.resolutionNote || '');
                        }}
                        className={`block w-full p-4 text-left transition ${
                          selectedReport?.id === rep.id
                            ? darkMode
                              ? 'bg-slate-800'
                              : 'bg-slate-100'
                            : darkMode
                            ? 'hover:bg-slate-800/50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                            <Flag className="h-3.5 w-3.5 text-rose-600" />
                            {rep.reason} · {rep.targetType}
                          </span>
                          <span className={`text-xs font-medium ${muted}`}>
                            {REPORT_STATUS_LABELS[rep.status]}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs">{rep.targetSummary || rep.details}</p>
                        <p className={`mt-1.5 text-[11px] ${muted}`}>
                          Sector: {rep.sector || 'general'} · Reportante confidencial ·{' '}
                          {rep.createdAtIso
                            ? new Date(rep.createdAtIso).toLocaleString('es-AR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Reciente'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail & Moderation Actions */}
              <div className={`rounded-xl border p-5 lg:col-span-5 ${surface}`}>
                {!selectedReport ? (
                  <p className={`py-12 text-center text-sm ${muted}`}>
                    Seleccioná una denuncia de la lista para revisar el caso y decidir una acción.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>
                        Caso {selectedReport.id} · Sector {selectedReport.sector || 'general'}
                      </p>
                      <h2 className="mt-1 text-base font-semibold">
                        {selectedReport.reason} ({selectedReport.targetType})
                      </h2>
                    </div>

                    <div
                      className={`space-y-1.5 rounded-lg border p-3 text-xs ${
                        darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p>
                        <strong>Contenido / Objetivo:</strong> {selectedReport.targetSummary}
                      </p>
                      {selectedReport.targetAuthorName && (
                        <p>
                          <strong>Persona reportada:</strong> {selectedReport.targetAuthorName}
                        </p>
                      )}
                      <p>
                        <strong>Detalle del reporte:</strong> {selectedReport.details}
                      </p>
                      {selectedReport.evidenceNote && (
                        <p>
                          <strong>Referencia adicional:</strong> {selectedReport.evidenceNote}
                        </p>
                      )}
                      <p className={muted}>
                        <strong>Denunciante (solo staff):</strong> {selectedReport.reporterName}
                      </p>
                    </div>

                    <div>
                      <label className={`mb-1 block text-xs font-semibold ${muted}`}>
                        Motivo / Nota de resolución (obligatorio) *
                      </label>
                      <textarea
                        rows={3}
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Fundamentá la decisión tomada sobre esta denuncia..."
                        className={`w-full rounded-lg border p-2.5 text-xs ${inputCls}`}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleReportDecision(selectedReport, 'en_revision', 'Tomada en revisión')
                        }
                        className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
                      >
                        Marcar en revisión
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleReportDecision(
                            selectedReport,
                            'requiere_informacion',
                            'Solicitar información'
                          )
                        }
                        className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
                      >
                        Solicitar información
                      </button>
                      {can('advertir_usuarios') && selectedReport.targetAuthorUid && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleReportDecision(
                              selectedReport,
                              'resuelta',
                              'Advertir usuario',
                              'warn_user'
                            )
                          }
                          className="min-h-[38px] rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
                        >
                          Advertir usuario
                        </button>
                      )}
                      {can('ocultar_publicaciones') &&
                        (selectedReport.targetType === 'publicacion' ||
                          selectedReport.targetType === 'contenido_cultural') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              handleReportDecision(
                                selectedReport,
                                'resuelta',
                                'Ocultar publicación',
                                'hide_post'
                              )
                            }
                            className="min-h-[38px] rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
                          >
                            Ocultar publicación
                          </button>
                        )}
                      {can('eliminar_publicaciones') &&
                        (selectedReport.targetType === 'publicacion' ||
                          selectedReport.targetType === 'contenido_cultural') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              handleReportDecision(
                                selectedReport,
                                'resuelta',
                                'Eliminar contenido',
                                'delete_post'
                              )
                            }
                            className="min-h-[38px] rounded-lg border border-rose-300 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Eliminar contenido
                          </button>
                        )}
                      {can('advertir_usuarios') && selectedReport.targetAuthorUid && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleReportDecision(
                              selectedReport,
                              'resuelta',
                              'Restringir funciones',
                              'restrict_user'
                            )
                          }
                          className="min-h-[38px] rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
                        >
                          Restringir funciones
                        </button>
                      )}
                      {can('suspender_usuarios') && !culturalOnly && selectedReport.targetAuthorUid && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleReportDecision(
                              selectedReport,
                              'resuelta',
                              'Suspender temporalmente (7 días)',
                              'suspend_user'
                            )
                          }
                          className="min-h-[38px] rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700"
                        >
                          Suspender temporalmente
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleReportDecision(selectedReport, 'desestimada', 'Desestimar denuncia')
                        }
                        className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
                      >
                        Desestimar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleReportDecision(
                            selectedReport,
                            'derivada_admin',
                            'Derivar a administrador superior'
                          )
                        }
                        className="min-h-[38px] rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Derivar a administrador
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* APPEALS TAB */
          <div className="space-y-3">
            {pendingAppeals.length === 0 ? (
              <div className={`rounded-xl border border-dashed p-10 text-center text-sm ${muted}`}>
                No hay apelaciones de usuarios pendientes de revisión.
              </div>
            ) : (
              pendingAppeals.map((s) => (
                <div key={s.id} className={`space-y-3 rounded-xl border p-4 ${surface}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-slate-600" />
                      <h3 className="text-sm font-semibold">
                        {s.userName} · {s.sanctionType.replace(/_/g, ' ')}
                      </h3>
                    </div>
                    <span className={`text-xs font-medium ${muted}`}>
                      Estado: {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className={`text-xs ${muted}`}>Motivo original: {s.reason}</p>
                  <div
                    className={`rounded-lg border p-3 text-xs ${
                      darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <strong>Descargo / Apelación del usuario:</strong> {s.appealText}
                  </div>
                  {s.status === 'pendiente_apelacion' && can('reactivar_usuarios') ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={appealResolutionDrafts[s.id] || ''}
                        onChange={(e) =>
                          setAppealResolutionDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        placeholder="Escribí la respuesta formal a esta apelación..."
                        className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleResolveAppeal(s, 'aceptada')}
                          className="min-h-[38px] rounded-lg bg-emerald-700 px-3.5 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          Aceptar apelación y reactivar cuenta
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleResolveAppeal(s, 'rechazada')}
                          className="min-h-[38px] rounded-lg border border-rose-300 px-3.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Mantener sanción
                        </button>
                      </div>
                    </div>
                  ) : (
                    s.appealResolution && (
                      <p className="text-xs">
                        <strong>Resolución ({s.appealReviewedBy}):</strong> {s.appealResolution}
                      </p>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 9: PUBLICACIONES (Muro General + FABRO Cultura + Detector Spam Local)
  // ----------------------------------------------------------------
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Moderación de publicaciones (Muro General y Cultura)
          </h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Los cambios se reflejan en vivo en los muros comunitarios. Incluye detector local de
            spam y contenido repetitivo ($0 costo, sin APIs externas).
            {culturalOnly ? ' · Ámbito restringido a publicaciones de FABRO Cultura.' : ''}
          </p>
        </div>
        <span className={`text-xs tabular-nums ${muted}`}>
          {postsWithAnalysis.length} publicaciones visibles en filtro
        </span>
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

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className={`pointer-events-none absolute left-3 top-3 h-4 w-4 ${muted}`} />
          <input
            type="text"
            value={postQuery}
            onChange={(e) => setPostQuery(e.target.value)}
            placeholder="Filtrar por texto, autor o etiqueta..."
            className={`min-h-[42px] w-full rounded-lg border pl-9 pr-3 text-sm ${inputCls}`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todas' },
              ...(!culturalOnly ? [{ id: 'general', label: 'Muro General' }] : []),
              { id: 'cultura', label: 'FABRO Cultura' },
              { id: 'ocultas', label: 'Ocultas' },
              { id: 'spam', label: 'Alertas spam local' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPostSpaceFilter(tab.id as typeof postSpaceFilter)}
              className={`min-h-[40px] rounded-lg border px-3 text-xs font-medium ${
                postSpaceFilter === tab.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : darkMode
                  ? 'border-slate-700 text-slate-300'
                  : 'border-slate-300 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {postsWithAnalysis.length === 0 ? (
        <div className={`rounded-xl border border-dashed p-10 text-center text-sm ${muted}`}>
          No se encontraron publicaciones para moderar en este filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {postsWithAnalysis.map(({ post, spam }) => {
            const isCulture = isCulturalPostLike(post);
            const isHidden =
              post.moderationStatus === 'oculta' || post.moderationStatus === 'eliminada';
            const allowHide = canModeratePostInScope(staffRole, effectivePermissions, post, 'hide');
            const allowDel = canModeratePostInScope(staffRole, effectivePermissions, post, 'delete');

            return (
              <article key={post.id} className={`space-y-3 rounded-xl border p-4 ${surface}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {post.author}{' '}
                      <span className={`font-normal text-xs ${muted}`}>
                        · {post.fabroId} · {isCulture ? 'FABRO Cultura' : post.origin || 'General'} ·{' '}
                        {post.createdAt}
                      </span>
                    </p>
                    <p className={`text-xs ${muted}`}>
                      Estado:{' '}
                      <strong className={isHidden ? 'text-rose-600' : 'text-emerald-700'}>
                        {post.moderationStatus || 'visible'}
                      </strong>
                      {post.moderationReason ? ` · Motivo: ${post.moderationReason}` : ''}
                    </p>
                  </div>
                  {spam.level !== 'limpio' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                      {spam.level === 'alto_riesgo' ? (
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      Riesgo spam local: {spam.score}/100 ({spam.reasons.join(', ')})
                    </span>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.text}</p>

                {(allowHide || allowDel) && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <input
                      type="text"
                      value={modReasonDrafts[post.id] || ''}
                      onChange={(e) =>
                        setModReasonDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Motivo obligatorio para moderar esta publicación..."
                      className={`min-h-[38px] min-w-[220px] flex-1 rounded-lg border px-3 text-xs ${inputCls}`}
                    />
                    {allowHide && !isHidden && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleModeratePost(post.id, 'oculta', isCulture)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 hover:bg-amber-50"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Ocultar
                      </button>
                    )}
                    {allowHide && isHidden && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleModeratePost(post.id, 'visible', isCulture)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Restaurar
                      </button>
                    )}
                    {allowDel && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleModeratePost(post.id, 'delete', isCulture)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
