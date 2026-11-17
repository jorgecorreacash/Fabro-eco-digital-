import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Globe,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  Vote,
} from 'lucide-react';
import communityImg from '../../assets/images/fabro_community_groups_1794596246725.jpg';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import type {
  CommunityGroup,
  GroupChatMessage,
  GroupMember,
  GroupPost,
  GroupPostType,
} from '../../types/fabro';

const GROUP_TYPE_LABELS: Record<CommunityGroup['groupType'], string> = {
  universitario: 'Universitario / Facultad',
  escolar: 'Escolar / Secundaria',
  instituto: 'Instituto / Terciario',
  idiomas: 'Idiomas',
  oficios: 'Oficios y Talleres',
  laboral: 'Formación laboral',
  examenes: 'Preparación de exámenes',
  docentes: 'Comunidad docente',
  investigacion: 'Investigación',
  libre: 'Aprendizaje abierto',
};

export const CommunityView: React.FC = () => {
  const { user, profile, setAiDraftPrompt, setActiveSection } = useFabro();
  const {
    groups,
    createGroup,
    joinGroup,
    leaveGroup,
    updateGroupMemberStatus,
    subscribeGroupMembers,
    subscribeGroupPosts,
    subscribeGroupMessages,
    createGroupPost,
    addGroupPostComment,
    voteGroupPoll,
    sendGroupChatMessage,
    submitModerationReport,
  } = usePlatform();

  // Geo & Institutional Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterInstitution, setFilterInstitution] = useState('');
  const [filterType, setFilterType] = useState('todos');

  const [selectedGroup, setSelectedGroup] = useState<CommunityGroup | null>(null);
  const [groupTab, setGroupTab] = useState<'muro' | 'chat' | 'miembros'>('muro');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [chatMsgs, setChatMsgs] = useState<GroupChatMessage[]>([]);

  // Create Group Modal/Panel
  const [showCreate, setShowCreate] = useState(false);
  const [gName, setGName] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gType, setGType] = useState<CommunityGroup['groupType']>('universitario');
  const [gVis, setGVis] = useState<CommunityGroup['visibility']>('publico');
  const [gCountry, setGCountry] = useState(profile?.country || 'Argentina');
  const [gProvince, setGProvince] = useState(profile?.province || '');
  const [gCity, setGCity] = useState(profile?.city || '');
  const [gInst, setGInst] = useState(profile?.institution || '');
  const [gCareer, setGCareer] = useState(profile?.career || '');
  const [gCourse, setGCourse] = useState('');
  const [gSubject, setGSubject] = useState('');
  const [gSpecialty, setGSpecialty] = useState('');
  const [gAllowMinors, setGAllowMinors] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Post Composer
  const [postType, setPostType] = useState<GroupPostType>('publicacion');
  const [biblioPreset, setBiblioPreset] = useState(false);
  const [onlyBiblioFilter, setOnlyBiblioFilter] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [chatDraft, setChatDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGroup) {
      setMembers([]);
      setPosts([]);
      setChatMsgs([]);
      return;
    }
    const u1 = subscribeGroupMembers(selectedGroup.id, setMembers);
    const u2 = subscribeGroupPosts(selectedGroup.id, (list) =>
      setPosts([...list].reverse())
    );
    const u3 = subscribeGroupMessages(selectedGroup.id, setChatMsgs);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [selectedGroup, subscribeGroupMembers, subscribeGroupPosts, subscribeGroupMessages]);

  const filteredGroups = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return groups.filter((g) => {
      if (filterType !== 'todos' && g.groupType !== filterType) return false;
      if (filterCountry && !g.country.toLowerCase().includes(filterCountry.toLowerCase())) return false;
      if (filterProvince && !g.province.toLowerCase().includes(filterProvince.toLowerCase())) return false;
      if (filterCity && !g.city.toLowerCase().includes(filterCity.toLowerCase())) return false;
      if (filterInstitution && !g.institutionName.toLowerCase().includes(filterInstitution.toLowerCase())) {
        return false;
      }
      if (q) {
        const hay = `${g.name} ${g.description} ${g.institutionName} ${g.career} ${g.courseName} ${g.subjectName} ${g.specialty} ${g.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, filterType, filterCountry, filterProvince, filterCity, filterInstitution, searchQ]);

  const myMemberRecord = useMemo(
    () => members.find((m) => m.userId === user?.uid) || null,
    [members, user?.uid]
  );

  const isGroupManager = Boolean(
    selectedGroup &&
      (selectedGroup.creatorId === user?.uid ||
        myMemberRecord?.role === 'admin' ||
        myMemberRecord?.role === 'docente')
  );

  const isActiveMember = Boolean(
    selectedGroup &&
      (selectedGroup.creatorId === user?.uid || myMemberRecord?.status === 'activo')
  );

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gName.trim()) return;
    setCreatingGroup(true);
    try {
      const id = await createGroup({
        name: gName,
        description: gDesc,
        groupType: gType,
        visibility: gVis,
        country: gCountry,
        province: gProvince,
        city: gCity,
        institutionName: gInst,
        career: gCareer,
        courseName: gCourse,
        subjectName: gSubject,
        specialty: gSpecialty,
        allowMinors: gAllowMinors,
      });
      setShowCreate(false);
      setGName('');
      setGDesc('');
      const created = groups.find((g) => g.id === id);
      if (created) setSelectedGroup(created);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !postContent.trim()) return;
    const pollLabels =
      postType === 'encuesta'
        ? pollOptionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const finalType: GroupPostType = biblioPreset ? 'material' : postType;
    const finalTitle = biblioPreset
      ? `[Bibliografía recomendada] ${postTitle.trim() || 'Recurso sugerido'}`
      : postTitle;
    await createGroupPost(selectedGroup.id, {
      postType: finalType,
      title: finalTitle,
      content: postContent,
      pollLabels,
    });
    setPostTitle('');
    setPostContent('');
    setPollOptionsText('');
    setBiblioPreset(false);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !chatDraft.trim()) return;
    const msg = chatDraft;
    setChatDraft('');
    await sendGroupChatMessage(selectedGroup.id, msg);
  };

  if (selectedGroup) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedGroup(null);
              setNotice(null);
            }}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
          >
            ← Volver al directorio de comunidades y grupos
          </button>

          <div className="flex items-center gap-2">
            {selectedGroup.creatorId !== user?.uid && (
              isActiveMember ? (
                <button
                  type="button"
                  onClick={() => void leaveGroup(selectedGroup.id)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Salir del grupo
                </button>
              ) : myMemberRecord?.status === 'pendiente' ? (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                  Solicitud pendiente de aprobación
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void joinGroup(selectedGroup).then((status) => {
                      setNotice(
                        status === 'pendiente'
                          ? 'Solicitud enviada al administrador/docente del grupo.'
                          : '¡Te uniste al grupo exitosamente!'
                      );
                    });
                  }}
                  className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  {selectedGroup.visibility === 'publico' || selectedGroup.visibility === 'institucional'
                    ? 'Unirse al grupo'
                    : 'Solicitar ingreso'}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() =>
                void submitModerationReport({
                  targetType: 'grupo',
                  targetId: selectedGroup.id,
                  targetSummary: selectedGroup.name,
                  reason: 'Moderación de comunidad',
                  details: `Reporte sobre el grupo ${selectedGroup.name}`,
                }).then(() => setNotice('Reporte enviado a moderación.'))
              }
              className="text-xs text-slate-500 hover:text-rose-500 cursor-pointer px-2 py-1"
            >
              Reportar
            </button>
          </div>
        </div>

        {notice && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-800 dark:text-sky-200">
            {notice}
          </div>
        )}

        {/* Group Banner */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400">
                {GROUP_TYPE_LABELS[selectedGroup.groupType]} · Visibilidad: {selectedGroup.visibility}
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedGroup.name}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {selectedGroup.description}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedGroup.memberCount} participantes
              </p>
              <p>
                {[selectedGroup.city, selectedGroup.province, selectedGroup.country]
                  .filter(Boolean)
                  .join(', ') || 'Alcance global'}
              </p>
              {selectedGroup.institutionName && <p>{selectedGroup.institutionName}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            {[
              { id: 'muro', label: `Muro de debates (${posts.length})` },
              { id: 'chat', label: `Chat grupal (${chatMsgs.length})` },
              { id: 'miembros', label: `Miembros (${members.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setGroupTab(t.id as typeof groupTab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  groupTab === t.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {!isActiveMember ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-2">
            <Lock className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Unite al grupo para publicar en el muro y participar del chat grupal
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {selectedGroup.visibility === 'privado' || selectedGroup.visibility === 'aprobado_docente'
                ? 'Este grupo requiere aprobación del creador o docente.'
                : 'Hacé clic en "Unirse al grupo" arriba para acceder al instante.'}
            </p>
          </div>
        ) : groupTab === 'muro' ? (
          <div className="space-y-4">
            <form
              onSubmit={(e) => void handlePublishPost(e)}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={biblioPreset ? 'bibliografia' : postType}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'bibliografia') {
                      setBiblioPreset(true);
                      setPostType('material');
                    } else {
                      setBiblioPreset(false);
                      setPostType(val as GroupPostType);
                    }
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="publicacion">Publicación general</option>
                  <option value="pregunta">Pregunta de estudio</option>
                  <option value="encuesta">Encuesta</option>
                  <option value="actividad">Actividad / Consigna</option>
                  <option value="material">Material compartido</option>
                  <option value="bibliografia">Recomendación bibliográfica</option>
                  <option value="anuncio">Anuncio</option>
                </select>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder={
                    biblioPreset
                      ? 'Autor, título del libro/paper o fuente *'
                      : 'Título breve (opcional)'
                  }
                  className="flex-1 min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 text-slate-900 dark:text-white"
                />
              </div>
              <textarea
                rows={3}
                required
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder={
                  biblioPreset
                    ? 'Indicá edición, DOI/enlace oficial y por qué recomendás esta bibliografía para la materia...'
                    : 'Compartí una duda, resumen, actividad o debate con el grupo...'
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
              {postType === 'encuesta' && (
                <textarea
                  rows={2}
                  value={pollOptionsText}
                  onChange={(e) => setPollOptionsText(e.target.value)}
                  placeholder="Opciones de encuesta (1 por línea, ej.: Sábado 10:00 hs)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyBiblioFilter((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold cursor-pointer ${
                    onlyBiblioFilter
                      ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {onlyBiblioFilter ? 'Mostrando solo bibliografía recomendada' : 'Filtrar recomendaciones bibliográficas'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-4 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Publicar en el muro
                </button>
              </div>
            </form>

            {posts
              .filter((p) =>
                onlyBiblioFilter
                  ? p.postType === 'material' ||
                    (p.title || '').toLowerCase().includes('bibliograf')
                  : true
              )
              .map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {p.authorName}
                    {p.authorVerified ? ' · Verificado ✓' : ''}
                    <span className="font-normal text-sky-600 dark:text-sky-400 ml-2">
                      · {(p.title || '').startsWith('[Bibliografía recomendada]') ? 'bibliografía recomendada' : p.postType}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiDraftPrompt(
                        `/ANALISIS Analizá críticamente este aporte compartido en comunidad (${p.title || p.postType}):\n\n${p.content}`
                      );
                      setActiveSection('fabro-ai');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:border-sky-500/50 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Analizar con FABRO IA
                  </button>
                </div>
                {p.title && (
                  <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {p.title}
                  </h4>
                )}
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {p.content}
                </p>

                {p.pollOptions.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Vote className="w-3.5 h-3.5" />
                      Votación del grupo:
                    </p>
                    {p.pollOptions.map((opt) => {
                      const voted = Boolean(user && opt.voterIds.includes(user.uid));
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => void voteGroupPoll(selectedGroup.id, p, opt.id)}
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                            voted
                              ? 'border-sky-500 bg-sky-500/10 font-semibold text-sky-700 dark:text-sky-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className="font-mono">{opt.voterIds.length} votos</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Comments */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {p.comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {c.authorName}:{' '}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">{c.text}</span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentDrafts[p.id] || ''}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      placeholder="Escribí un comentario..."
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const txt = commentDrafts[p.id] || '';
                        if (!txt.trim()) return;
                        setCommentDrafts((prev) => ({ ...prev, [p.id]: '' }));
                        void addGroupPostComment(selectedGroup.id, p, txt);
                      }}
                      className="rounded-lg bg-slate-800 dark:bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Responder
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : groupTab === 'chat' ? (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-4">
            <div className="h-80 overflow-y-auto space-y-2.5 pr-1">
              {chatMsgs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-12">
                  Todavía no hay mensajes en este chat grupal. ¡Iniciá la conversación!
                </p>
              ) : (
                chatMsgs.map((m) => {
                  const mine = m.senderId === user?.uid;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs ${
                          mine
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <p className="font-semibold text-[10px] opacity-80 mb-0.5">
                          {m.senderName}
                        </p>
                        <p className="whitespace-pre-wrap">{m.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form onSubmit={(e) => void handleSendChat(e)} className="flex gap-2">
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Enviar mensaje al grupo..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Participantes y solicitudes ({members.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{m.displayName}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rol: {m.role} · Estado: {m.status}
                    </p>
                  </div>
                  {isGroupManager && m.status === 'pendiente' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void updateGroupMemberStatus(selectedGroup.id, m.userId, 'activo')
                        }
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white font-semibold cursor-pointer"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void updateGroupMemberStatus(selectedGroup.id, m.userId, 'rechazado')
                        }
                        className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-rose-600 font-semibold cursor-pointer"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
              COMUNIDAD EDUCATIVA Y GRUPOS ABIERTOS
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Conectá por ciudad, institución, carrera, oficio o interés de estudio
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Creá y unite a grupos universitarios, escolares, de institutos, idiomas, oficios o preparación de exámenes con muro de debates, encuestas y chat grupal en tiempo real.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {showCreate ? 'Cerrar formulario' : 'Crear nuevo grupo o comunidad'}
            </button>
          </div>
        </div>
        <div className="lg:col-span-5 min-h-[180px] bg-slate-900">
          <img
            src={communityImg}
            alt="Comunidad educativa FABRO"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Create Group Form */}
      {showCreate && (
        <form
          onSubmit={(e) => void handleCreateGroupSubmit(e)}
          className="rounded-2xl border border-sky-500/30 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4 text-xs"
        >
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Nueva comunidad educativa
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={gName}
              onChange={(e) => setGName(e.target.value)}
              placeholder="Nombre del grupo *"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <select
              value={gType}
              onChange={(e) => setGType(e.target.value as CommunityGroup['groupType'])}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            >
              {Object.entries(GROUP_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={gVis}
              onChange={(e) => setGVis(e.target.value as CommunityGroup['visibility'])}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="publico">Público abierto</option>
              <option value="institucional">Institucional (por escuela/universidad)</option>
              <option value="aprobado_docente">Con aprobación del docente/creador</option>
              <option value="privado">Privado por solicitud</option>
            </select>
            <input
              type="text"
              value={gCountry}
              onChange={(e) => setGCountry(e.target.value)}
              placeholder="País (ej.: Argentina)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={gProvince}
              onChange={(e) => setGProvince(e.target.value)}
              placeholder="Provincia / Estado"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={gCity}
              onChange={(e) => setGCity(e.target.value)}
              placeholder="Ciudad / Localidad"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={gInst}
              onChange={(e) => setGInst(e.target.value)}
              placeholder="Institución (escuela, instituto, universidad)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={gCareer}
              onChange={(e) => setGCareer(e.target.value)}
              placeholder="Carrera / Orientación / Oficio"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={gSubject}
              onChange={(e) => setGSubject(e.target.value)}
              placeholder="Materia / Curso / Especialidad"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <textarea
            rows={2}
            value={gDesc}
            onChange={(e) => setGDesc(e.target.value)}
            placeholder="Propósito, reglas de convivencia y temas del grupo..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={gAllowMinors}
                onChange={(e) => setGAllowMinors(e.target.checked)}
              />
              <span>Grupo apto para estudiantes escolares (con supervisión educativa grupal)</span>
            </label>
            <button
              type="submit"
              disabled={creatingGroup}
              className="rounded-lg bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              {creatingGroup ? 'Creando...' : 'Publicar grupo'}
            </button>
          </div>
        </form>
      )}

      {/* Geographic & Institutional Hierarchical Explorer */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-3 text-xs">
        <p className="font-semibold text-slate-900 dark:text-white">
          Explorar por ubicación, institución, carrera o temática
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Buscar grupo, materia o especialidad..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-8 pr-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
          >
            <option value="todos">Todos los tipos</option>
            {Object.entries(GROUP_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            placeholder="País..."
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            placeholder="Ciudad / Provincia..."
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={filterInstitution}
            onChange={(e) => setFilterInstitution(e.target.value)}
            placeholder="Institución / Escuela..."
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </section>

      {/* Group Cards */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No se encontraron grupos con ese criterio
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Creá el primer grupo para tu escuela, facultad, taller u oficio y sumá compañeros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGroups.map((g) => (
            <article
              key={g.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between gap-4 hover:border-sky-500/40 transition-colors"
            >
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400 truncate">
                  {GROUP_TYPE_LABELS[g.groupType]} · {g.visibility}
                </p>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {g.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                  {g.description || 'Comunidad de aprendizaje colaborativo.'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  {[g.institutionName, g.career, g.city, g.country].filter(Boolean).join(' · ') ||
                    'Comunidad abierta'}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {g.memberCount} participantes
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className="rounded-lg bg-sky-600 px-3.5 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Abrir comunidad
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
