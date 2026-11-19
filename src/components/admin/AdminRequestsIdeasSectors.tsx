import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Compass,
  Edit3,
  Lightbulb,
  Plus,
  Power,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import {
  deletePlatformEvent,
  savePlatformEvent,
  savePlatformSector,
  togglePlatformSectorActive,
  updateIdeaProposalStatus,
  updateSectorRequestStatus,
} from '../../services/adminService';
import {
  IDEA_CATEGORIES,
  IDEA_STATUS_LABELS,
  SECTOR_REQUEST_STATUS_LABELS,
  type IdeaStatus,
  type PlatformEventRecord,
  type PlatformEventStatus,
  type PlatformSectorRecord,
  type SectorRequestStatus,
} from '../../types/admin';

interface AdminRequestsIdeasSectorsProps {
  mode: 'solicitudes_sectores' | 'ideas_propuestas' | 'sectores_modulos' | 'eventos_actividades';
  darkMode: boolean;
}

const SECTOR_REQ_STATUSES: SectorRequestStatus[] = [
  'pendiente',
  'en_evaluacion',
  'requiere_modificaciones',
  'aprobada',
  'rechazada',
  'en_desarrollo',
  'publicada',
];

const IDEA_STATUSES: IdeaStatus[] = [
  'recibida',
  'en_evaluacion',
  'aprobada',
  'rechazada',
  'en_desarrollo',
  'implementada',
];

export const AdminRequestsIdeasSectors: React.FC<AdminRequestsIdeasSectorsProps> = ({
  mode,
  darkMode,
}) => {
  const {
    allSectorRequests,
    ideaProposals,
    platformSectors,
    platformEvents,
    allStaff,
    staffActor,
    staffRole,
    can,
  } = useAdmin();

  const surface = darkMode
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = darkMode
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-300 bg-white text-slate-900';

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Sector Requests drafts
  const [reqStatusDrafts, setReqStatusDrafts] = useState<Record<string, SectorRequestStatus>>({});
  const [reqCommentDrafts, setReqCommentDrafts] = useState<Record<string, string>>({});

  // Ideas drafts
  const [ideaCatFilter, setIdeaCatFilter] = useState<string>('todas');
  const [ideaStatusDrafts, setIdeaStatusDrafts] = useState<Record<string, IdeaStatus>>({});
  const [ideaRespDrafts, setIdeaRespDrafts] = useState<Record<string, string>>({});

  // Sector editor
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [secId, setSecId] = useState('');
  const [secName, setSecName] = useState('');
  const [secDesc, setSecDesc] = useState('');
  const [secCats, setSecCats] = useState('');
  const [secSubcats, setSecSubcats] = useState('');
  const [secNote, setSecNote] = useState('');
  const [secToggleReasons, setSecToggleReasons] = useState<Record<string, string>>({});

  // Event editor
  const [evtEditId, setEvtEditId] = useState<string | undefined>(undefined);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtSector, setEvtSector] = useState(
    staffRole === 'moderador_cultural' ? 'cultura' : 'general'
  );
  const [evtCategory, setEvtCategory] = useState('');
  const [evtDateIso, setEvtDateIso] = useState(new Date().toISOString().slice(0, 10));
  const [evtLocation, setEvtLocation] = useState('');
  const [evtDesc, setEvtDesc] = useState('');
  const [evtStatus, setEvtStatus] = useState<PlatformEventStatus>('publicado');

  const culturalOnly = staffRole === 'moderador_cultural';

  const visibleEvents = useMemo(
    () => (culturalOnly ? platformEvents.filter((e) => e.sector === 'cultura') : platformEvents),
    [platformEvents, culturalOnly]
  );

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
  // SECTION 6: SOLICITUDES DE SECTORES
  // ----------------------------------------------------------------
  if (mode === 'solicitudes_sectores') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Solicitudes de nuevos sectores</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Propuestas enviadas por la comunidad para abrir nuevos espacios dentro de FABRO. Cada
            cambio de estado notifica al solicitante y queda registrado en auditoría.
          </p>
        </div>

        {renderFeedback()}

        {allSectorRequests.length === 0 ? (
          <div className={`rounded-xl border border-dashed p-10 text-center text-sm ${muted}`}>
            Todavía no hay solicitudes de sectores enviadas por usuarios.
          </div>
        ) : (
          <div className="space-y-4">
            {allSectorRequests.map((req) => {
              const draftStatus = reqStatusDrafts[req.id] || req.status;
              const draftComment = reqCommentDrafts[req.id] ?? req.adminComment ?? '';
              return (
                <article key={req.id} className={`space-y-3 rounded-xl border p-5 ${surface}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold">{req.name}</h2>
                      <p className={`text-xs ${muted}`}>
                        Solicitado por {req.requesterName} ·{' '}
                        {req.createdAtIso
                          ? new Date(req.createdAtIso).toLocaleDateString('es-AR')
                          : 'Reciente'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold">
                      {SECTOR_REQUEST_STATUS_LABELS[req.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                    <div>
                      <p className={`font-semibold ${muted}`}>Descripción</p>
                      <p className="mt-0.5">{req.description}</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${muted}`}>Objetivo y público</p>
                      <p className="mt-0.5">
                        {req.objective} · Público: {req.targetAudience}
                      </p>
                    </div>
                    <div>
                      <p className={`font-semibold ${muted}`}>Herramientas propuestas</p>
                      <p className="mt-0.5">{req.proposedTools}</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${muted}`}>Justificación</p>
                      <p className="mt-0.5">{req.justification}</p>
                    </div>
                  </div>

                  {can('editar_sectores') && staffActor && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <select
                        value={draftStatus}
                        onChange={(e) =>
                          setReqStatusDrafts((prev) => ({
                            ...prev,
                            [req.id]: e.target.value as SectorRequestStatus,
                          }))
                        }
                        className={`min-h-[38px] rounded-lg border px-2.5 text-xs ${inputCls}`}
                      >
                        {SECTOR_REQ_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {SECTOR_REQUEST_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={draftComment}
                        onChange={(e) =>
                          setReqCommentDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="Comentario oficial de evaluación..."
                        className={`min-h-[38px] min-w-[220px] flex-1 rounded-lg border px-3 text-xs ${inputCls}`}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setFeedback(null);
                          try {
                            await updateSectorRequestStatus(
                              staffActor,
                              req,
                              draftStatus,
                              draftComment
                            );
                            setFeedback({
                              kind: 'ok',
                              text: `Solicitud "${req.name}" actualizada a ${SECTOR_REQUEST_STATUS_LABELS[draftStatus]}.`,
                            });
                          } catch (err) {
                            setFeedback({
                              kind: 'err',
                              text: err instanceof Error ? err.message : 'Error al actualizar.',
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="min-h-[38px] rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Guardar evaluación
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 7: IDEAS Y PROPUESTAS
  // ----------------------------------------------------------------
  if (mode === 'ideas_propuestas') {
    const filtered =
      ideaCatFilter === 'todas'
        ? ideaProposals
        : ideaProposals.filter((i) => i.category === ideaCatFilter);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Ideas y propuestas comunitarias</h1>
            <p className={`mt-1 text-sm ${muted}`}>
              Revisá las propuestas votadas por los usuarios en las 11 categorías y publicá una
              respuesta oficial.
            </p>
          </div>
          <select
            value={ideaCatFilter}
            onChange={(e) => setIdeaCatFilter(e.target.value)}
            className={`min-h-[38px] rounded-lg border px-3 text-xs ${inputCls}`}
          >
            <option value="todas">Todas las categorías ({ideaProposals.length})</option>
            {IDEA_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {renderFeedback()}

        {filtered.length === 0 ? (
          <div className={`rounded-xl border border-dashed p-10 text-center text-sm ${muted}`}>
            No hay ideas cargadas en esta categoría.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((idea) => {
              const catLabel =
                IDEA_CATEGORIES.find((c) => c.id === idea.category)?.label || idea.category;
              const draftSt = ideaStatusDrafts[idea.id] || idea.status;
              const draftResp = ideaRespDrafts[idea.id] ?? idea.adminResponse ?? '';
              return (
                <article key={idea.id} className={`space-y-3 rounded-xl border p-4 ${surface}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                        {idea.title}
                      </h2>
                      <p className={`mt-0.5 text-xs ${muted}`}>
                        {catLabel} · Por {idea.authorName} · Estado actual:{' '}
                        <strong>{IDEA_STATUS_LABELS[idea.status]}</strong> · {idea.comments.length}{' '}
                        comentarios
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {idea.votesCount} votos
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed">{idea.explanation}</p>

                  {can('editar_sectores') && staffActor && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <select
                        value={draftSt}
                        onChange={(e) =>
                          setIdeaStatusDrafts((prev) => ({
                            ...prev,
                            [idea.id]: e.target.value as IdeaStatus,
                          }))
                        }
                        className={`min-h-[38px] rounded-lg border px-2.5 text-xs ${inputCls}`}
                      >
                        {IDEA_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {IDEA_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={draftResp}
                        onChange={(e) =>
                          setIdeaRespDrafts((prev) => ({ ...prev, [idea.id]: e.target.value }))
                        }
                        placeholder="Respuesta oficial para la comunidad..."
                        className={`min-h-[38px] min-w-[220px] flex-1 rounded-lg border px-3 text-xs ${inputCls}`}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setFeedback(null);
                          try {
                            await updateIdeaProposalStatus(staffActor, idea, draftSt, draftResp);
                            setFeedback({
                              kind: 'ok',
                              text: `Idea "${idea.title}" actualizada a "${IDEA_STATUS_LABELS[draftSt]}".`,
                            });
                          } catch (err) {
                            setFeedback({
                              kind: 'err',
                              text: err instanceof Error ? err.message : 'No se pudo actualizar.',
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="min-h-[38px] rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Publicar respuesta
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 8: SECTORES Y MÓDULOS
  // ----------------------------------------------------------------
  if (mode === 'sectores_modulos') {
    const loadSectorIntoForm = (s: PlatformSectorRecord) => {
      setEditingSectorId(s.id);
      setSecId(s.id);
      setSecName(s.name);
      setSecDesc(s.description);
      setSecCats(s.categories.join(', '));
      setSecSubcats(s.subcategories.join(', '));
      setSecNote(s.permissionsNote || '');
    };

    const handleSaveSectorForm = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!staffActor) return;
      const existing = platformSectors.find((s) => s.id === (editingSectorId || secId));
      setBusy(true);
      setFeedback(null);
      try {
        await savePlatformSector(
          staffActor,
          {
            id: (editingSectorId || secId || secName).toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
            name: secName,
            description: secDesc,
            categories: secCats.split(',').map((c) => c.trim()).filter(Boolean),
            subcategories: secSubcats.split(',').map((c) => c.trim()).filter(Boolean),
            active: existing ? existing.active : true,
            isCore: existing ? existing.isCore : false,
            adminUids: existing?.adminUids || [],
            moderatorUids: existing?.moderatorUids || [],
            permissionsNote: secNote,
          },
          editingSectorId ? `Edición del sector ${secName}` : `Creación del sector ${secName}`,
          !editingSectorId
        );
        setFeedback({ kind: 'ok', text: `Sector "${secName}" guardado correctamente.` });
        setEditingSectorId(null);
        setSecId('');
        setSecName('');
        setSecDesc('');
        setSecCats('');
        setSecSubcats('');
        setSecNote('');
      } catch (err) {
        setFeedback({
          kind: 'err',
          text: err instanceof Error ? err.message : 'Error al guardar sector.',
        });
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sectores y módulos de FABRO</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Administrá los sectores existentes, sus categorías, subcategorías y disponibilidad.
            Desactivar un sector lo pausa temporalmente sin borrar publicaciones, usuarios ni
            archivos.
          </p>
        </div>

        {renderFeedback()}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sectors List */}
          <div className="space-y-3 lg:col-span-7">
            {platformSectors.map((sector) => {
              const assignedMods = allStaff.filter(
                (st) =>
                  st.allowedSectors.includes('*') || st.allowedSectors.includes(sector.id)
              );
              return (
                <article key={sector.id} className={`space-y-3 rounded-xl border p-4 ${surface}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <Compass className="h-4 w-4" />
                        {sector.name}
                      </h2>
                      <p className={`mt-0.5 text-xs ${muted}`}>
                        ID: {sector.id} · {sector.isCore ? 'Sector núcleo' : 'Sector personalizado'}{' '}
                        · Estado:{' '}
                        <strong className={sector.active ? 'text-emerald-700' : 'text-amber-700'}>
                          {sector.active ? 'Activo' : 'Pausado (datos intactos)'}
                        </strong>
                      </p>
                    </div>
                    {can('editar_sectores') && (
                      <button
                        type="button"
                        onClick={() => loadSectorIntoForm(sector)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed">{sector.description}</p>
                  <p className={`text-[11px] ${muted}`}>
                    Categorías: {sector.categories.join(', ') || '—'} · Subcategorías:{' '}
                    {sector.subcategories.join(', ') || '—'}
                  </p>
                  <p className={`text-[11px] ${muted}`}>
                    Equipo con cobertura: {assignedMods.length + 1} integrante(s)
                    {sector.permissionsNote ? ` · ${sector.permissionsNote}` : ''}
                  </p>

                  {can('desactivar_sectores') && staffActor && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <input
                        type="text"
                        value={secToggleReasons[sector.id] || ''}
                        onChange={(e) =>
                          setSecToggleReasons((prev) => ({ ...prev, [sector.id]: e.target.value }))
                        }
                        placeholder="Motivo para pausar o reactivar el sector..."
                        className={`min-h-[36px] flex-1 rounded-lg border px-3 text-xs ${inputCls}`}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setFeedback(null);
                          try {
                            await togglePlatformSectorActive(
                              staffActor,
                              sector,
                              !sector.active,
                              secToggleReasons[sector.id] || ''
                            );
                            setSecToggleReasons((prev) => ({ ...prev, [sector.id]: '' }));
                            setFeedback({
                              kind: 'ok',
                              text: sector.active
                                ? `Sector "${sector.name}" pausado sin pérdida de datos.`
                                : `Sector "${sector.name}" reactivado.`,
                            });
                          } catch (err) {
                            setFeedback({
                              kind: 'err',
                              text: err instanceof Error ? err.message : 'Error al cambiar estado.',
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
                          sector.active
                            ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                            : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {sector.active ? 'Desactivar sin borrar datos' : 'Reactivar sector'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Create / Edit Form */}
          {(can('crear_sectores') || can('editar_sectores')) && (
            <form
              onSubmit={handleSaveSectorForm}
              className={`h-fit space-y-3 rounded-xl border p-5 lg:col-span-5 ${surface}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {editingSectorId ? `Editando sector: ${editingSectorId}` : 'Crear nuevo sector'}
                </h2>
                {editingSectorId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSectorId(null);
                      setSecId('');
                      setSecName('');
                      setSecDesc('');
                      setSecCats('');
                      setSecSubcats('');
                      setSecNote('');
                    }}
                    className={`text-xs underline ${muted}`}
                  >
                    Nuevo
                  </button>
                )}
              </div>

              {!editingSectorId && (
                <div>
                  <label className={`mb-1 block text-xs font-medium ${muted}`}>
                    Identificador técnico (slug) *
                  </label>
                  <input
                    type="text"
                    value={secId}
                    onChange={(e) => setSecId(e.target.value)}
                    placeholder="ej. idiomas"
                    className={`min-h-[40px] w-full rounded-lg border px-3 text-xs font-mono ${inputCls}`}
                    required
                  />
                </div>
              )}

              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>Nombre *</label>
                <input
                  type="text"
                  value={secName}
                  onChange={(e) => setSecName(e.target.value)}
                  placeholder="Ej. FABRO Idiomas"
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                  required
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>Descripción *</label>
                <textarea
                  rows={3}
                  value={secDesc}
                  onChange={(e) => setSecDesc(e.target.value)}
                  className={`w-full rounded-lg border p-2.5 text-xs ${inputCls}`}
                  required
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>
                  Categorías (separadas por coma)
                </label>
                <input
                  type="text"
                  value={secCats}
                  onChange={(e) => setSecCats(e.target.value)}
                  placeholder="Práctica, Recursos, Talleres"
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>
                  Subcategorías (separadas por coma)
                </label>
                <input
                  type="text"
                  value={secSubcats}
                  onChange={(e) => setSecSubcats(e.target.value)}
                  placeholder="Audio, Glosario, Clubes"
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>
                  Nota de permisos y gobernanza
                </label>
                <input
                  type="text"
                  value={secNote}
                  onChange={(e) => setSecNote(e.target.value)}
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                />
              </div>

              <button
                type="submit"
                disabled={busy || (!editingSectorId && !can('crear_sectores'))}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {editingSectorId ? 'Guardar cambios del sector' : 'Crear sector'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // SECTION 10: EVENTOS Y ACTIVIDADES
  // ----------------------------------------------------------------
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffActor) return;
    setBusy(true);
    setFeedback(null);
    try {
      await savePlatformEvent(staffActor, {
        id: evtEditId,
        title: evtTitle,
        sector: culturalOnly ? 'cultura' : evtSector,
        category: evtCategory,
        dateIso: evtDateIso,
        location: evtLocation,
        description: evtDesc,
        status: evtStatus,
      });
      setFeedback({
        kind: 'ok',
        text: evtEditId ? 'Evento actualizado.' : 'Evento creado correctamente.',
      });
      setEvtEditId(undefined);
      setEvtTitle('');
      setEvtCategory('');
      setEvtLocation('');
      setEvtDesc('');
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Error al guardar evento.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLoadEvent = (ev: PlatformEventRecord) => {
    setEvtEditId(ev.id);
    setEvtTitle(ev.title);
    setEvtSector(ev.sector);
    setEvtCategory(ev.category || '');
    setEvtDateIso(ev.dateIso);
    setEvtLocation(ev.location);
    setEvtDesc(ev.description);
    setEvtStatus(ev.status);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Eventos y actividades de la plataforma</h1>
        <p className={`mt-1 text-sm ${muted}`}>
          Programá talleres, encuentros culturales, jornadas de estudio y actividades comunitarias.
          {culturalOnly ? ' · Ámbito activo: eventos de FABRO Cultura.' : ''}
        </p>
      </div>

      {renderFeedback()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {can('gestionar_eventos') && (
          <form onSubmit={handleSaveEvent} className={`h-fit space-y-3 rounded-xl border p-5 lg:col-span-5 ${surface}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {evtEditId ? 'Editar evento' : 'Crear nuevo evento'}
              </h2>
              {evtEditId && (
                <button
                  type="button"
                  onClick={() => {
                    setEvtEditId(undefined);
                    setEvtTitle('');
                    setEvtDesc('');
                  }}
                  className={`text-xs underline ${muted}`}
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div>
              <label className={`mb-1 block text-xs font-medium ${muted}`}>Título *</label>
              <input
                type="text"
                value={evtTitle}
                onChange={(e) => setEvtTitle(e.target.value)}
                placeholder="Ej. Taller abierto de escritura creativa"
                className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>Sector</label>
                <select
                  value={culturalOnly ? 'cultura' : evtSector}
                  disabled={culturalOnly}
                  onChange={(e) => setEvtSector(e.target.value)}
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                >
                  <option value="general">General</option>
                  <option value="cultura">FABRO Cultura</option>
                  <option value="estudio">FABRO Estudio</option>
                  <option value="bienestar">FABRO Bienestar</option>
                  <option value="social">Red Social</option>
                </select>
              </div>
              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>Fecha *</label>
                <input
                  type="date"
                  value={evtDateIso}
                  onChange={(e) => setEvtDateIso(e.target.value)}
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>Modalidad / Lugar</label>
                <input
                  type="text"
                  value={evtLocation}
                  onChange={(e) => setEvtLocation(e.target.value)}
                  placeholder="Online / Presencial"
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-medium ${muted}`}>Estado</label>
                <select
                  value={evtStatus}
                  onChange={(e) => setEvtStatus(e.target.value as PlatformEventStatus)}
                  className={`min-h-[40px] w-full rounded-lg border px-3 text-xs ${inputCls}`}
                >
                  <option value="borrador">Borrador</option>
                  <option value="publicado">Publicado</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
            </div>

            <div>
              <label className={`mb-1 block text-xs font-medium ${muted}`}>Descripción</label>
              <textarea
                rows={3}
                value={evtDesc}
                onChange={(e) => setEvtDesc(e.target.value)}
                className={`w-full rounded-lg border p-2.5 text-xs ${inputCls}`}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Calendar className="h-4 w-4" />
              {evtEditId ? 'Guardar cambios' : 'Publicar evento'}
            </button>
          </form>
        )}

        <div className={`space-y-3 ${can('gestionar_eventos') ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {visibleEvents.length === 0 ? (
            <div className={`rounded-xl border border-dashed p-10 text-center text-sm ${muted}`}>
              No hay eventos registrados aún.
            </div>
          ) : (
            visibleEvents.map((ev) => (
              <article key={ev.id} className={`space-y-2 rounded-xl border p-4 ${surface}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{ev.title}</h3>
                    <p className={`text-xs ${muted}`}>
                      {ev.dateIso} · Sector {ev.sector} · {ev.location || 'Virtual'} · Estado:{' '}
                      <strong>{ev.status}</strong>
                    </p>
                  </div>
                  {can('gestionar_eventos') && staffActor && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLoadEvent(ev)}
                        className="min-h-[34px] rounded-md border border-slate-300 px-2.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await deletePlatformEvent(staffActor, ev, 'Eliminado desde gestión de eventos');
                            setFeedback({ kind: 'ok', text: `Evento "${ev.title}" eliminado.` });
                          } catch (err) {
                            setFeedback({
                              kind: 'err',
                              text: err instanceof Error ? err.message : 'No se pudo eliminar.',
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-rose-300 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {ev.description && <p className="text-xs leading-relaxed">{ev.description}</p>}
                <p className={`text-[11px] ${muted}`}>Organizador: {ev.organizerName}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
