import React, { useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Flag,
  Lightbulb,
  MessageSquare,
  Scale,
  Send,
  ThumbsUp,
  X,
} from 'lucide-react';
import { useAdmin, type ParticipationModalTab } from '../../context/AdminContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  addIdeaComment,
  submitIdeaProposal,
  submitSanctionAppeal,
  submitSectorRequest,
  toggleIdeaVote,
} from '../../services/adminService';
import {
  IDEA_CATEGORIES,
  IDEA_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  SECTOR_REQUEST_STATUS_LABELS,
  type IdeaCategoryId,
} from '../../types/admin';

export const CommunityParticipationModal: React.FC = () => {
  const { authUser, openAuthModal } = useEcosystem();
  const {
    participationModalOpen,
    participationTab,
    openParticipationModal,
    closeParticipationModal,
    ideaProposals,
    mySectorRequests,
    myReports,
    mySanctions,
    adminSettings,
  } = useAdmin();

  // Idea form state
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaCategory, setIdeaCategory] = useState<IdeaCategoryId>('nuevas_herramientas');
  const [ideaExplanation, setIdeaExplanation] = useState('');
  const [ideaFilterCat, setIdeaFilterCat] = useState<string>('todas');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  // Sector request form state
  const [secName, setSecName] = useState('');
  const [secDescription, setSecDescription] = useState('');
  const [secObjective, setSecObjective] = useState('');
  const [secAudience, setSecAudience] = useState('');
  const [secTools, setSecTools] = useState('');
  const [secJustification, setSecJustification] = useState('');

  // Appeal draft per sanction
  const [appealDrafts, setAppealDrafts] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  if (!participationModalOpen) return null;

  const activeTab: ParticipationModalTab = participationTab;

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      openAuthModal('login');
      return;
    }
    if (ideaTitle.trim().length < 3 || ideaExplanation.trim().length < 5) {
      setFeedback({ kind: 'err', text: 'Completá título y explicación de la propuesta.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await submitIdeaProposal({
        authorUid: authUser.uid,
        authorName: authUser.displayName || authUser.username || 'Usuario FABRO',
        title: ideaTitle,
        category: ideaCategory,
        explanation: ideaExplanation,
      });
      setIdeaTitle('');
      setIdeaExplanation('');
      setFeedback({ kind: 'ok', text: 'Idea publicada en el Buzón de Propuestas de FABRO.' });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo enviar la idea.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleVote = async (ideaId: string) => {
    if (!authUser) {
      openAuthModal('login');
      return;
    }
    if (!adminSettings.allowIdeaVoting) {
      setFeedback({ kind: 'err', text: 'La votación de ideas está pausada temporalmente.' });
      return;
    }
    const target = ideaProposals.find((i) => i.id === ideaId);
    if (!target) return;
    try {
      await toggleIdeaVote(target, authUser.uid);
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo registrar tu voto.',
      });
    }
  };

  const handleCommentIdea = async (ideaId: string) => {
    if (!authUser) {
      openAuthModal('login');
      return;
    }
    const text = (commentDrafts[ideaId] || '').trim();
    if (!text) return;
    const target = ideaProposals.find((i) => i.id === ideaId);
    if (!target) return;
    try {
      await addIdeaComment(target, {
        authorUid: authUser.uid,
        authorName: authUser.displayName || authUser.username || 'Usuario FABRO',
        text,
      });
      setCommentDrafts((prev) => ({ ...prev, [ideaId]: '' }));
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo publicar el comentario.',
      });
    }
  };

  const handleSubmitSectorRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      openAuthModal('login');
      return;
    }
    if (!adminSettings.allowSectorRequests) {
      setFeedback({
        kind: 'err',
        text: 'Las solicitudes de nuevos sectores están pausadas temporalmente por administración.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await submitSectorRequest({
        requesterUid: authUser.uid,
        requesterName: authUser.displayName || authUser.username || 'Usuario FABRO',
        name: secName,
        description: secDescription,
        objective: secObjective,
        targetAudience: secAudience,
        proposedTools: secTools,
        justification: secJustification,
      });
      setSecName('');
      setSecDescription('');
      setSecObjective('');
      setSecAudience('');
      setSecTools('');
      setSecJustification('');
      setFeedback({
        kind: 'ok',
        text: 'Solicitud enviada. El equipo de FABRO ADMIN la revisará y te notificará cada avance.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo enviar la solicitud.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendAppeal = async (sanctionId: string) => {
    const text = (appealDrafts[sanctionId] || '').trim();
    if (text.length < 10) {
      setFeedback({ kind: 'err', text: 'Escribí tu descargo o apelación (mínimo 10 caracteres).' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await submitSanctionAppeal(sanctionId, text);
      setAppealDrafts((prev) => ({ ...prev, [sanctionId]: '' }));
      setFeedback({
        kind: 'ok',
        text: 'Apelación enviada. Un administrador revisará tu solicitud.',
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'No se pudo registrar tu apelación.',
      });
    } finally {
      setBusy(false);
    }
  };

  const filteredIdeas =
    ideaFilterCat === 'todas'
      ? ideaProposals
      : ideaProposals.filter((i) => i.category === ideaFilterCat);

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Participación y Comunidad FABRO"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Participación Comunitaria y Transparencia FABRO
            </h2>
            <p className="text-xs text-slate-500">
              Proponé mejoras, solicitá nuevos sectores o consultá tus denuncias y apelaciones
            </p>
          </div>
          <button
            type="button"
            onClick={closeParticipationModal}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-5 py-2">
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              openParticipationModal('ideas');
            }}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition ${
              activeTab === 'ideas'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Buzón de ideas ({ideaProposals.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              openParticipationModal('sector-request');
            }}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition ${
              activeTab === 'sector-request'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Compass className="h-4 w-4" />
            Solicitar sector ({mySectorRequests.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              openParticipationModal('reports-appeals');
            }}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition ${
              activeTab === 'reports-appeals'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Scale className="h-4 w-4" />
            Mis denuncias y apelaciones ({myReports.length + mySanctions.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                feedback.kind === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          )}

          {!authUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                Iniciá sesión con tu cuenta FABRO para enviar ideas, votar, solicitar sectores o gestionar apelaciones.
              </p>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                Iniciar sesión
              </button>
            </div>
          )}

          {/* TAB 1: IDEAS */}
          {activeTab === 'ideas' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleSubmitIdea}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-5"
              >
                <h3 className="text-sm font-semibold text-slate-900">Proponer una nueva idea</h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Título *</label>
                  <input
                    type="text"
                    value={ideaTitle}
                    onChange={(e) => setIdeaTitle(e.target.value)}
                    placeholder="Ej. Modo lectura en voz alta en Estudio"
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Categoría</label>
                  <select
                    value={ideaCategory}
                    onChange={(e) => setIdeaCategory(e.target.value as IdeaCategoryId)}
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none"
                  >
                    {IDEA_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Explicación detallada *
                  </label>
                  <textarea
                    rows={4}
                    value={ideaExplanation}
                    onChange={(e) => setIdeaExplanation(e.target.value)}
                    placeholder="Contanos qué problema resuelve y cómo beneficiaría a la comunidad..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-slate-900 focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !authUser}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {busy ? 'Publicando...' : 'Publicar idea'}
                </button>
              </form>

              <div className="space-y-3 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Ideas de la comunidad ({filteredIdeas.length})
                  </h3>
                  <select
                    value={ideaFilterCat}
                    onChange={(e) => setIdeaFilterCat(e.target.value)}
                    className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700"
                  >
                    <option value="todas">Todas las categorías</option>
                    {IDEA_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredIdeas.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    Aún no hay propuestas publicadas en esta categoría. Sé la primera persona en compartir una idea.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredIdeas.map((idea) => {
                      const voted = Boolean(authUser && idea.voterUids.includes(authUser.uid));
                      const catLabel =
                        IDEA_CATEGORIES.find((c) => c.id === idea.category)?.label || idea.category;
                      return (
                        <article
                          key={idea.id}
                          className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-900">{idea.title}</h4>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {catLabel} · Por {idea.authorName} · Estado:{' '}
                                <span className="font-medium text-slate-800">
                                  {IDEA_STATUS_LABELS[idea.status]}
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleVote(idea.id)}
                              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold tabular-nums transition ${
                                voted
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              {idea.votesCount}
                            </button>
                          </div>

                          <p className="text-sm leading-relaxed text-slate-700">{idea.explanation}</p>

                          {idea.adminResponse && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                              <span className="font-semibold text-slate-900">
                                Respuesta del equipo FABRO:
                              </span>{' '}
                              {idea.adminResponse}
                            </div>
                          )}

                          {/* Comments */}
                          <div className="space-y-2 border-t border-slate-100 pt-2.5">
                            {idea.comments.length > 0 && (
                              <div className="space-y-1.5">
                                {idea.comments.map((c) => (
                                  <div key={c.id} className="text-xs text-slate-600">
                                    <span className="font-semibold text-slate-800">
                                      {c.authorName}:
                                    </span>{' '}
                                    {c.text}
                                  </div>
                                ))}
                              </div>
                            )}
                            {authUser && (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={commentDrafts[idea.id] || ''}
                                  onChange={(e) =>
                                    setCommentDrafts((prev) => ({
                                      ...prev,
                                      [idea.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Sumar un comentario constructivo..."
                                  className="min-h-[36px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs focus:border-slate-900 focus:bg-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCommentIdea(idea.id)}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Comentar
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SECTOR REQUESTS */}
          {activeTab === 'sector-request' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleSubmitSectorRequest}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-6"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  Solicitar creación de un nuevo sector en FABRO
                </h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Nombre del sector propuesto *
                  </label>
                  <input
                    type="text"
                    value={secName}
                    onChange={(e) => setSecName(e.target.value)}
                    placeholder="Ej. FABRO Ciencia Abierta / FABRO Idiomas"
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Descripción general *
                  </label>
                  <textarea
                    rows={2}
                    value={secDescription}
                    onChange={(e) => setSecDescription(e.target.value)}
                    placeholder="¿De qué trataría este sector dentro del ecosistema FABRO?"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Objetivo principal *
                    </label>
                    <input
                      type="text"
                      value={secObjective}
                      onChange={(e) => setSecObjective(e.target.value)}
                      placeholder="Meta concreta del espacio"
                      className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Público destinatario *
                    </label>
                    <input
                      type="text"
                      value={secAudience}
                      onChange={(e) => setSecAudience(e.target.value)}
                      placeholder="Ej. Estudiantes, docentes, artistas"
                      className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Herramientas propuestas *
                  </label>
                  <textarea
                    rows={2}
                    value={secTools}
                    onChange={(e) => setSecTools(e.target.value)}
                    placeholder="Ej. Glosario colaborativo, ejercicios prácticos, muro temático..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Justificación *
                  </label>
                  <textarea
                    rows={2}
                    value={secJustification}
                    onChange={(e) => setSecJustification(e.target.value)}
                    placeholder="¿Por qué aporta valor sostenible y gratuito a FABRO?"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !authUser}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Compass className="h-4 w-4" />
                  {busy ? 'Enviando solicitud...' : 'Enviar solicitud de sector'}
                </button>
              </form>

              <div className="space-y-3 lg:col-span-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Mis solicitudes enviadas ({mySectorRequests.length})
                </h3>
                {mySectorRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    Todavía no enviaste solicitudes de sectores.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mySectorRequests.map((req) => (
                      <div
                        key={req.id}
                        className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">{req.name}</h4>
                          <span className="text-xs font-medium text-slate-700">
                            {SECTOR_REQUEST_STATUS_LABELS[req.status]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{req.description}</p>
                        <p className="text-[11px] text-slate-500">
                          Objetivo: {req.objective} · Público: {req.targetAudience}
                        </p>
                        {req.adminComment && (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
                            <span className="font-semibold text-slate-900">
                              Evaluación de administración:
                            </span>{' '}
                            {req.adminComment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MY REPORTS & APPEALS */}
          {activeTab === 'reports-appeals' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Mis denuncias enviadas ({myReports.length})
                  </h3>
                </div>
                {myReports.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No registraste denuncias hasta el momento.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="space-y-1 rounded-xl border border-slate-200 bg-white p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900">{rep.reason}</span>
                          <span className="text-xs text-slate-600">
                            {REPORT_STATUS_LABELS[rep.status]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{rep.targetSummary}</p>
                        {rep.resolutionNote && (
                          <p className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-700">
                            Resolución: {rep.resolutionNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Historial de medidas y apelaciones ({mySanctions.length})
                  </h3>
                </div>
                {mySanctions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Tu cuenta no tiene advertencias ni sanciones registradas.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mySanctions.map((s) => {
                      const canAppeal =
                        s.status === 'activa' &&
                        (!s.appealStatus || s.appealStatus === 'sin_apelacion');
                      return (
                        <div
                          key={s.id}
                          className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-900">
                              {s.sanctionType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-medium text-slate-600">
                              Estado: {s.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700">Motivo: {s.reason}</p>
                          {s.expiresAtIso && (
                            <p className="text-[11px] text-slate-500">
                              Vigencia hasta: {new Date(s.expiresAtIso).toLocaleString('es-AR')}
                            </p>
                          )}
                          {s.appealText && (
                            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                              <span className="font-semibold">Tu apelación:</span> {s.appealText}
                            </div>
                          )}
                          {s.appealResolution && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800">
                              <span className="font-semibold">Respuesta administrativa:</span>{' '}
                              {s.appealResolution}
                            </div>
                          )}
                          {canAppeal && (
                            <div className="space-y-2 pt-1">
                              <textarea
                                rows={2}
                                value={appealDrafts[s.id] || ''}
                                onChange={(e) =>
                                  setAppealDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                                placeholder="Solicitá una revisión explicando tus argumentos..."
                                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleSendAppeal(s.id)}
                                className="min-h-[38px] rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                              >
                                Enviar apelación formal
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
