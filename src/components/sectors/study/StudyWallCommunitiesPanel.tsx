import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Film,
  GraduationCap,
  Heart,
  MessageCircle,
  Plus,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { isDirectHtml5VideoUrl } from '../../../services/videoEmbedUtils';

const COMMUNITY_COLORS = ['#2563EB', '#7C3AED', '#06B6D4', '#059669', '#D97706', '#E11D48'];

export const StudyWallCommunitiesPanel: React.FC = () => {
  const {
    profile,
    wallPosts,
    addWallPost,
    reactToWallPost,
    addWallPostComment,
    advancedNotes,
    studyVideos,
    studyCommunities,
    createStudyCommunity,
    toggleJoinStudyCommunity,
    addStudyCommunityThread,
    replyStudyCommunityThread,
    navigateTo,
  } = useEcosystem();

  const [sectionView, setSectionView] = useState<'muro' | 'comunidades'>('muro');
  const [postText, setPostText] = useState('');
  const [subjectTag, setSubjectTag] = useState('General');
  const [attachKind, setAttachKind] = useState<'none' | 'note' | 'video'>('none');
  const [selectedNoteId, setSelectedNoteId] = useState<string>(advancedNotes[0]?.id || '');
  const [selectedVideoId, setSelectedVideoId] = useState<string>(studyVideos[0]?.id || '');
  const [notice, setNotice] = useState<string | null>(null);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  // Communities state
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>(
    studyCommunities[0]?.id || ''
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommSubject, setNewCommSubject] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommColor, setNewCommColor] = useState(COMMUNITY_COLORS[0]);

  const [threadTitle, setThreadTitle] = useState('');
  const [threadBody, setThreadBody] = useState('');
  const [threadShareWall, setThreadShareWall] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const studyPosts = useMemo(
    () => wallPosts.filter((p) => p.origin === 'estudio' || p.origin === 'comunidad'),
    [wallPosts]
  );

  const activeCommunity =
    studyCommunities.find((c) => c.id === selectedCommunityId) || studyCommunities[0] || null;

  const showToast = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const handlePublishAcademicPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && attachKind === 'none') return;

    const attachedNote =
      attachKind === 'note'
        ? advancedNotes.find((n) => n.id === selectedNoteId) || advancedNotes[0]
        : undefined;
    const attachedVideo =
      attachKind === 'video'
        ? studyVideos.find((v) => v.id === selectedVideoId) || studyVideos[0]
        : undefined;

    await addWallPost({
      author: profile.displayName || 'Usuario FABRO',
      fabroId: profile.fabroId || 'FABRO',
      authorAvatar: profile.photoURL,
      text:
        postText.trim() ||
        (attachedNote
          ? `Comparto este resumen de mi Hoja Word: «${attachedNote.title}»`
          : attachedVideo
          ? `Recomiendo esta clase de ${attachedVideo.categoryOrSubject}: «${attachedVideo.title}»`
          : 'Consulta académica en FABRO'),
      origin: 'estudio',
      categoryTag:
        subjectTag.trim() ||
        attachedNote?.subject ||
        attachedVideo?.categoryOrSubject ||
        'Estudio',
      sharedResource: attachedNote
        ? {
            kind: 'note',
            refId: attachedNote.id,
            title: attachedNote.title,
            subtitle:
              attachedNote.summaryText ||
              attachedNote.mainIdea ||
              attachedNote.contentText.slice(0, 220),
            subject: attachedNote.subject,
            metricLabel: `Hoja Word · ${attachedNote.subject}`,
          }
        : undefined,
      videoEmbed: attachedVideo
        ? {
            title: attachedVideo.title,
            url: attachedVideo.url,
            embedUrl: attachedVideo.embedUrl,
            provider: attachedVideo.provider,
            categoryOrSubject: attachedVideo.categoryOrSubject,
          }
        : undefined,
    });

    setPostText('');
    setAttachKind('none');
    showToast('Publicado en el Muro de Estudio y reflejado en el Muro General (#Estudio).');
  };

  const handleCreateCommunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommName.trim()) return;
    const created = createStudyCommunity({
      name: newCommName,
      careerOrSubject: newCommSubject || newCommName,
      description: newCommDesc,
      accentColor: newCommColor,
    });
    setSelectedCommunityId(created.id);
    setNewCommName('');
    setNewCommSubject('');
    setNewCommDesc('');
    setShowCreateModal(false);
    setSectionView('comunidades');
    showToast(`Comunidad «${created.name}» creada.`);
  };

  const handleAddThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunity || !threadTitle.trim() || !threadBody.trim()) return;
    addStudyCommunityThread(activeCommunity.id, threadTitle, threadBody, threadShareWall);
    setThreadTitle('');
    setThreadBody('');
    showToast('Hilo de debate publicado en la cátedra.');
  };

  return (
    <div className="space-y-4">
      {/* Header Switcher: Muro de Estudio vs Comunidades / Cátedras */}
      <div className="rounded-2xl border-2 border-[#2563EB]/35 fabro-surface p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#2563EB] dark:text-[#60A5FA]" />
            Muro de Estudio y Comunidades por Materia
          </h2>
          <p className="text-xs fabro-muted mt-0.5">
            Espacio 100% académico conectado con el Muro General (#Estudio y #Comunidad).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border-2 fabro-border fabro-surface-elevated p-0.5">
            <button
              type="button"
              onClick={() => setSectionView('muro')}
              className={`min-h-[38px] rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                sectionView === 'muro' ? 'bg-[#2563EB] text-white' : 'fabro-muted'
              }`}
            >
              Muro Académico ({studyPosts.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionView('comunidades')}
              className={`min-h-[38px] rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                sectionView === 'comunidades' ? 'bg-[#2563EB] text-white' : 'fabro-muted'
              }`}
            >
              Comunidades ({studyCommunities.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Crear Comunidad
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {notice}
        </div>
      )}

      {/* Create Community Inline Modal */}
      {showCreateModal && (
        <form
          onSubmit={handleCreateCommunity}
          className="rounded-2xl border-2 border-[#2563EB] fabro-surface p-5 space-y-3 text-xs shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#2563EB]" />
              Nueva Comunidad / Cátedra de Estudio
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border inline-flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={newCommName}
              onChange={(e) => setNewCommName(e.target.value)}
              placeholder="Nombre (ej. Introducción al Pensamiento Científico)"
              className="min-h-[42px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
              required
            />
            <input
              type="text"
              value={newCommSubject}
              onChange={(e) => setNewCommSubject(e.target.value)}
              placeholder="Carrera / Materia (ej. Derecho, Programación)"
              className="min-h-[42px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
            />
          </div>
          <textarea
            rows={2}
            value={newCommDesc}
            onChange={(e) => setNewCommDesc(e.target.value)}
            placeholder="Descripción breve, temas del parcial o reglas del grupo..."
            className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs fabro-input"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="fabro-muted font-semibold">Color:</span>
              {COMMUNITY_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setNewCommColor(hex)}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 ${
                    newCommColor === hex ? 'border-white scale-110 ring-2 ring-[#2563EB]' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
            <button
              type="submit"
              className="min-h-[40px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-1.5 font-bold cursor-pointer active:scale-95"
            >
              Crear Comunidad
            </button>
          </div>
        </form>
      )}

      {/* VIEW A: ACADEMIC WALL */}
      {sectionView === 'muro' && (
        <div className="space-y-4">
          {/* Academic Composer */}
          <form
            onSubmit={handlePublishAcademicPost}
            className="rounded-2xl border-2 fabro-border fabro-surface p-4 space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-sm font-bold">
                Publicar consulta, resumen o videoclase en el Muro de Estudio
              </p>
              <input
                type="text"
                value={subjectTag}
                onChange={(e) => setSubjectTag(e.target.value)}
                placeholder="Materia..."
                className="min-h-[36px] w-44 rounded-xl border-2 fabro-border fabro-surface-elevated px-2.5 py-1 text-xs font-semibold fabro-input"
              />
            </div>

            <textarea
              rows={2}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Escribí una duda de parcial, compartí una conclusión o abrí un debate académico..."
              className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs fabro-input"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAttachKind(attachKind === 'note' ? 'none' : 'note')}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold cursor-pointer ${
                  attachKind === 'note'
                    ? 'border-[#2563EB] bg-[#2563EB] text-white'
                    : 'fabro-border fabro-surface-elevated'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Adjuntar Resumen (Hoja Word)
              </button>
              <button
                type="button"
                onClick={() => setAttachKind(attachKind === 'video' ? 'none' : 'video')}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold cursor-pointer ${
                  attachKind === 'video'
                    ? 'border-[#06B6D4] bg-[#06B6D4] text-slate-950'
                    : 'fabro-border fabro-surface-elevated'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Adjuntar Video de Videoteca
              </button>
              <button
                type="submit"
                className="ml-auto min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-1.5 font-bold cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                Publicar en Muro
              </button>
            </div>

            {attachKind === 'note' && (
              <div className="rounded-xl border-2 border-[#2563EB]/30 fabro-surface-elevated p-2.5">
                {advancedNotes.length === 0 ? (
                  <p className="fabro-muted">
                    Todavía no tenés apuntes guardados desde la Hoja Word.
                  </p>
                ) : (
                  <select
                    value={selectedNoteId || advancedNotes[0]?.id}
                    onChange={(e) => setSelectedNoteId(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold fabro-input"
                  >
                    {advancedNotes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title} ({n.subject})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {attachKind === 'video' && (
              <div className="rounded-xl border-2 border-[#06B6D4]/40 fabro-surface-elevated p-2.5">
                {studyVideos.length === 0 ? (
                  <p className="fabro-muted">
                    Todavía no guardaste videos en tu Videoteca Educativa.{' '}
                    <button
                      type="button"
                      onClick={() => navigateTo('estudio', 'videoteca-estudio')}
                      className="font-bold text-[#2563EB] underline cursor-pointer"
                    >
                      Ir a Videoteca →
                    </button>
                  </p>
                ) : (
                  <select
                    value={selectedVideoId || studyVideos[0]?.id}
                    onChange={(e) => setSelectedVideoId(e.target.value)}
                    className="min-h-[38px] w-full rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold fabro-input"
                  >
                    {studyVideos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.categoryOrSubject})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </form>

          {/* Study Wall Feed */}
          {studyPosts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed fabro-border p-8 text-center space-y-1.5">
              <GraduationCap className="w-7 h-7 mx-auto text-[#2563EB] opacity-75" />
              <p className="text-sm font-bold">Muro de Estudio listo para tus aportes</p>
              <p className="text-xs fabro-muted">
                Publicá una consulta, compartí un video desde tu Videoteca Educativa o subí un resumen de tu Hoja Word.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {studyPosts.map((post) => {
                const comments = post.comments || [];
                const isOpen = Boolean(openComments[post.id]);
                return (
                  <article
                    key={post.id}
                    className="rounded-2xl border-2 fabro-border fabro-surface p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm">{post.author}</p>
                        <p className="text-[11px] fabro-muted">
                          {post.fabroId} · {post.createdAt}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-lg border border-[#2563EB]/50 bg-[#2563EB]/12 px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
                          {post.origin === 'comunidad' ? '#Comunidad' : '#Estudio'}
                        </span>
                        {(post.communityName || post.categoryTag) && (
                          <span className="rounded-lg border fabro-border fabro-surface-elevated px-2 py-0.5 text-[10px] font-semibold">
                            {post.communityName || post.categoryTag}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>

                    {post.videoEmbed && (
                      <div className="rounded-xl border-2 border-[#06B6D4]/40 overflow-hidden bg-black">
                        <div className="aspect-video">
                          {isDirectHtml5VideoUrl(post.videoEmbed.embedUrl) ? (
                            <video
                              src={post.videoEmbed.embedUrl}
                              controls
                              playsInline
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <iframe
                              src={post.videoEmbed.embedUrl}
                              title={post.videoEmbed.title}
                              className="w-full h-full"
                              allowFullScreen
                            />
                          )}
                        </div>
                        <div className="px-3 py-2 fabro-surface-elevated text-[11px] font-bold flex items-center justify-between gap-2">
                          <span className="truncate">{post.videoEmbed.title}</span>
                          <span className="text-[#2563EB] dark:text-[#60A5FA] shrink-0">
                            {post.videoEmbed.categoryOrSubject}
                          </span>
                        </div>
                      </div>
                    )}

                    {post.sharedResource && (
                      <div className="rounded-xl border-2 border-[#2563EB]/35 bg-[#2563EB]/8 p-3 space-y-1">
                        <p className="text-[10px] font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
                          {post.sharedResource.metricLabel || 'Resumen Académico'}
                        </p>
                        <p className="font-display text-sm font-bold">{post.sharedResource.title}</p>
                        <p className="fabro-muted">{post.sharedResource.subtitle}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t fabro-border">
                      <button
                        type="button"
                        onClick={() => reactToWallPost(post.id, 'insightful')}
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1 font-bold cursor-pointer active:scale-95"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            post.myReaction ? 'text-rose-500 fill-current' : ''
                          }`}
                        />
                        Útil ({post.likes})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1 font-bold cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Respuestas ({comments.length})
                      </button>
                    </div>

                    {isOpen && (
                      <div className="space-y-2 pt-2">
                        {comments.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2"
                          >
                            <span className="font-bold">{c.author}: </span>
                            <span>{c.text}</span>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentDrafts[post.id] || ''}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                            }
                            placeholder="Responder o aportar un dato..."
                            className="min-h-[38px] flex-1 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 fabro-input"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const txt = (commentDrafts[post.id] || '').trim();
                              if (!txt) return;
                              addWallPostComment(post.id, txt);
                              setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                            }}
                            className="min-h-[38px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-3 py-1 font-bold cursor-pointer"
                          >
                            Enviar
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW B: COMMUNITIES / CÁTEDRAS POR MATERIA */}
      {sectionView === 'comunidades' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Communities Sidebar */}
          <div className="lg:col-span-4 space-y-2.5">
            {studyCommunities.map((comm) => {
              const selected = activeCommunity?.id === comm.id;
              return (
                <div
                  key={comm.id}
                  onClick={() => setSelectedCommunityId(comm.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedCommunityId(comm.id);
                  }}
                  className={`rounded-2xl border-2 p-3.5 space-y-2 cursor-pointer transition-all ${
                    selected
                      ? 'border-[#2563EB] bg-[#2563EB]/10 shadow-sm'
                      : 'fabro-border fabro-surface hover:border-[#2563EB]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                        style={{ backgroundColor: comm.accentColor }}
                      />
                      <span className="text-[11px] font-bold fabro-muted">
                        {comm.careerOrSubject}
                      </span>
                      <h3 className="font-display text-sm font-bold mt-0.5">{comm.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleJoinStudyCommunity(comm.id);
                      }}
                      className={`min-h-[32px] rounded-lg border px-2.5 py-0.5 text-[10px] font-bold shrink-0 cursor-pointer ${
                        comm.joined
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'border-[#2563EB] bg-[#2563EB] text-white'
                      }`}
                    >
                      {comm.joined ? 'Miembro ✓' : 'Unirme'}
                    </button>
                  </div>
                  <p className="text-[11px] fabro-muted line-clamp-2">{comm.description}</p>
                  <p className="text-[10px] font-semibold fabro-muted tabular-nums">
                    {comm.memberCount} integrantes · {comm.threads.length} hilos de debate
                  </p>
                </div>
              );
            })}
          </div>

          {/* Active Community Debate Threads */}
          <div className="lg:col-span-8 space-y-4">
            {activeCommunity && (
              <>
                <div className="rounded-2xl border-2 fabro-border fabro-surface p-4 sm:p-5 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA]">
                        {activeCommunity.careerOrSubject}
                      </span>
                      <h3 className="font-display text-base font-bold">{activeCommunity.name}</h3>
                    </div>
                    <span className="rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-semibold">
                      {activeCommunity.memberCount} estudiantes
                    </span>
                  </div>
                  <p className="fabro-muted leading-relaxed">{activeCommunity.description}</p>

                  {/* New Debate Thread Form */}
                  <form
                    onSubmit={handleAddThread}
                    className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 space-y-2.5"
                  >
                    <p className="font-bold text-xs">Abrir nuevo hilo de debate en esta cátedra</p>
                    <input
                      type="text"
                      value={threadTitle}
                      onChange={(e) => setThreadTitle(e.target.value)}
                      placeholder="Título del tema o consulta..."
                      className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-3 py-1.5 text-xs font-semibold fabro-input"
                      required
                    />
                    <textarea
                      rows={2}
                      value={threadBody}
                      onChange={(e) => setThreadBody(e.target.value)}
                      placeholder="Desarrollá tu consulta, bibliografía o aporte para la comunidad..."
                      className="w-full rounded-xl border fabro-border fabro-surface p-2.5 text-xs fabro-input"
                      required
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={threadShareWall}
                          onChange={(e) => setThreadShareWall(e.target.checked)}
                          className="w-4 h-4 accent-[#2563EB]"
                        />
                        Mostrar también en el Muro General (#Comunidad)
                      </label>
                      <button
                        type="submit"
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-3.5 py-1 text-xs font-bold cursor-pointer active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Publicar Hilo
                      </button>
                    </div>
                  </form>
                </div>

                {/* Threads List */}
                <div className="space-y-3">
                  {activeCommunity.threads.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed fabro-border p-6 text-center text-xs fabro-muted">
                      Aún no hay hilos en {activeCommunity.name}. Abrí el primer debate arriba.
                    </div>
                  ) : (
                    activeCommunity.threads.map((thr) => (
                      <article
                        key={thr.id}
                        className="rounded-2xl border-2 fabro-border fabro-surface p-4 space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-display text-sm font-bold">{thr.title}</h4>
                          <span className="text-[11px] fabro-muted shrink-0">{thr.createdAt}</span>
                        </div>
                        <p className="text-[11px] fabro-muted font-semibold">
                          Iniciado por {thr.author} ({thr.fabroId})
                        </p>
                        <p className="leading-relaxed whitespace-pre-wrap">{thr.body}</p>

                        <div className="space-y-2 pt-2 border-t fabro-border">
                          {thr.replies.map((rep) => (
                            <div
                              key={rep.id}
                              className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-bold">{rep.author}</span>
                                <span className="fabro-muted">{rep.createdAt}</span>
                              </div>
                              <p className="mt-0.5">{rep.text}</p>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyDrafts[thr.id] || ''}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({ ...prev, [thr.id]: e.target.value }))
                              }
                              placeholder="Escribir respuesta en el hilo..."
                              className="min-h-[38px] flex-1 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 fabro-input"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const txt = (replyDrafts[thr.id] || '').trim();
                                if (!txt) return;
                                replyStudyCommunityThread(activeCommunity.id, thr.id, txt);
                                setReplyDrafts((prev) => ({ ...prev, [thr.id]: '' }));
                              }}
                              className="min-h-[38px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-3 py-1 font-bold cursor-pointer"
                            >
                              Responder
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
