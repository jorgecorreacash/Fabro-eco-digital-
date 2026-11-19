import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  Check,
  Compass,
  Dumbbell,
  ExternalLink,
  Heart,
  MessageSquare,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { COMMUNITY_DISCOVER_PROFILES } from '../../../data/communityProfilesCatalog';
import { useEcosystem } from '../../../context/EcosystemContext';
import type { CommunityProfileCard } from '../../../types/ecosystem';

type PeopleFilterMode = 'all' | 'humans' | 'mentors';
type ProfileModalTab = 'posts' | 'resources' | 'tastes';

const QUICK_INTERESTS = [
  'Todos',
  'Derecho',
  'Calistenia',
  'Investigación',
  'Estoicismo',
  'Programación',
  'Estudio Nocturno',
  'Mentor IA',
];

export const DiscoverPeoplePanel: React.FC = () => {
  const {
    profile,
    friendsList,
    toggleFollowProfile,
    addFriendDirectly,
    openDirectChatWithFriend,
    navigateTo,
  } = useEcosystem();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<PeopleFilterMode>('all');
  const [selectedInterest, setSelectedInterest] = useState('Todos');
  const [selectedProfile, setSelectedProfile] = useState<CommunityProfileCard | null>(null);
  const [modalTab, setModalTab] = useState<ProfileModalTab>('posts');
  const [feedback, setFeedback] = useState<string | null>(null);

  const followingIds = profile.followingIds ?? [];

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMUNITY_DISCOVER_PROFILES.filter((person) => {
      if (mode === 'humans' && person.isAiMentor) return false;
      if (mode === 'mentors' && !person.isAiMentor) return false;
      if (
        selectedInterest !== 'Todos' &&
        !person.interests.some((i) => i.toLowerCase() === selectedInterest.toLowerCase())
      ) {
        return false;
      }
      if (!q) return true;
      return (
        person.displayName.toLowerCase().includes(q) ||
        person.username.toLowerCase().includes(q) ||
        person.bio.toLowerCase().includes(q) ||
        person.fabroId.toLowerCase().includes(q) ||
        person.interests.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [query, mode, selectedInterest]);

  const findFriendMatch = (person: CommunityProfileCard) =>
    friendsList.find(
      (f) =>
        f.fabroId.toUpperCase() === person.fabroId.toUpperCase() ||
        f.displayName.toLowerCase() === person.displayName.toLowerCase()
    );

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const handleAddContact = (person: CommunityProfileCard) => {
    addFriendDirectly(person.fabroId, person.displayName, person.bio, person.availability);
    showToast(`${person.displayName} sumado a tus contactos FABRO.`);
  };

  const handleToggleFollow = (person: CommunityProfileCard) => {
    const wasFollowing = followingIds.includes(person.id);
    toggleFollowProfile(person.id);
    showToast(
      wasFollowing
        ? `Dejaste de seguir a ${person.displayName}.`
        : `Ahora seguís a ${person.displayName}.`
    );
  };

  const openPersonModal = (person: CommunityProfileCard) => {
    setSelectedProfile(person);
    setModalTab('posts');
  };

  return (
    <div className="space-y-4">
      {/* Header + Search + Filters */}
      <section className="rounded-2xl border fabro-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#7C3AED] dark:text-[#C4B5FD]" />
              Descubrir Personas y Mentores
            </h2>
            <p className="text-xs fabro-muted mt-0.5 leading-relaxed">
              Explorá perfiles de la comunidad FABRO, seguí personas con tus intereses o abrí guías
              de Mentores IA (100% BYOK, sin APIs de pago precargadas).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold tabular-nums fabro-muted shrink-0">
            <span>{followingIds.length} seguidos</span>
            <span aria-hidden="true">·</span>
            <span>{friendsList.length} contactos</span>
          </div>
        </div>

        {/* Search + Type Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, @usuario, FABRO ID o interés..."
              className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 py-2 text-sm fabro-input"
            />
          </div>
          <div className="md:col-span-5 grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'humans', label: 'Comunidad' },
                { id: 'mentors', label: 'Mentores IA' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`min-h-[42px] rounded-xl border px-2.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all whitespace-nowrap ${
                  mode === tab.id
                    ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                    : 'fabro-border fabro-surface-elevated hover:border-[#7C3AED]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interest Quick Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {QUICK_INTERESTS.map((topic) => {
            const active = selectedInterest === topic;
            return (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedInterest(topic)}
                className={`min-h-[36px] shrink-0 rounded-xl border px-3 py-1 text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
                  active
                    ? 'border-[#2563EB] bg-[#2563EB] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted hover:border-[#2563EB]'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {feedback}
          </div>
        )}
      </section>

      {/* Cards Grid */}
      {filteredProfiles.length === 0 ? (
        <div className="rounded-2xl border fabro-surface p-8 text-center space-y-2">
          <Users className="w-8 h-8 fabro-muted mx-auto" />
          <p className="text-sm font-bold">No encontramos perfiles con ese filtro</p>
          <p className="text-xs fabro-muted">
            Probá limpiando la búsqueda o eligiendo otro tema de interés.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setMode('all');
              setSelectedInterest('Todos');
            }}
            className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-4 py-1.5 text-xs font-bold cursor-pointer"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProfiles.map((person) => {
            const isFollowing = followingIds.includes(person.id);
            const matchedFriend = findFriendMatch(person);
            const displayFollowers = person.followersCount + (isFollowing ? 1 : 0);

            return (
              <article
                key={person.id}
                className="rounded-2xl border fabro-surface overflow-hidden flex flex-col justify-between transition-all hover:border-[#7C3AED]/60"
              >
                <div>
                  {/* Cover */}
                  <div
                    className="h-20 w-full relative"
                    style={{ background: person.coverGradient }}
                  >
                    {person.isAiMentor && (
                      <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-lg bg-slate-950/75 text-cyan-200 border border-cyan-400/40 px-2.5 py-1 text-[11px] font-bold backdrop-blur-xs">
                        <Bot className="w-3.5 h-3.5" />
                        Mentor IA · BYOK
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="px-4 pb-4 -mt-7 space-y-3">
                    <div className="flex items-end justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openPersonModal(person)}
                        className="w-14 h-14 rounded-2xl border-2 border-white dark:border-slate-900 text-white font-display font-extrabold text-base flex items-center justify-center shadow-md cursor-pointer shrink-0"
                        style={{ backgroundColor: person.avatarColor }}
                        aria-label={`Ver perfil de ${person.displayName}`}
                      >
                        {person.isAiMentor ? (
                          <Sparkles className="w-6 h-6" />
                        ) : (
                          person.avatarInitials
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openPersonModal(person)}
                        className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated hover:border-[#7C3AED] px-3 py-1 text-xs font-semibold cursor-pointer active:scale-95"
                      >
                        Ver perfil y muro
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openPersonModal(person)}
                          className="font-display text-base font-bold hover:underline text-left cursor-pointer"
                        >
                          {person.displayName}
                        </button>
                      </div>
                      <p className="text-xs fabro-muted flex items-center flex-wrap gap-x-2 gap-y-0.5">
                        <span className="font-mono font-semibold text-[#7C3AED] dark:text-[#C4B5FD]">
                          @{person.username}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{person.fabroId}</span>
                        {!person.isAiMentor && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              {person.availability === 'online' ? (
                                <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                              )}
                              {person.availability === 'online' ? 'En línea' : 'Sin conexión'}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {person.isAiMentor && (
                      <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-800 dark:text-cyan-200">
                        {person.aiRoleTag || 'Mentor IA · Requiere tu clave BYOK en Sector 4'}
                      </div>
                    )}

                    <p className="text-xs leading-relaxed fabro-muted line-clamp-3">{person.bio}</p>

                    <p className="text-[11px] font-medium fabro-muted">
                      {person.interests.join(' · ')}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] fabro-muted font-semibold tabular-nums pt-0.5">
                      <span>{displayFollowers} seguidores</span>
                      <span aria-hidden="true">·</span>
                      <span>{person.samplePosts.length} publicaciones</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {person.publicNotes.length + person.publicRoutines.length} recursos públicos
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-4 py-3 border-t fabro-border flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFollow(person)}
                    className={`flex-1 min-h-[42px] md:min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all ${
                      isFollowing
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-[#7C3AED] bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Siguiendo
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        Seguir
                      </>
                    )}
                  </button>

                  {person.isAiMentor ? (
                    <button
                      type="button"
                      onClick={() => navigateTo('ia', 'asistente-api')}
                      className="flex-1 min-h-[42px] md:min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Sector 4 (BYOK)
                    </button>
                  ) : matchedFriend ? (
                    <button
                      type="button"
                      onClick={() => openDirectChatWithFriend(matchedFriend.id)}
                      className="flex-1 min-h-[42px] md:min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated hover:border-[#7C3AED] px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#C4B5FD]" />
                      Escribir
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddContact(person)}
                      className="flex-1 min-h-[42px] md:min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated hover:border-[#EC4899] px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#EC4899]" />
                      Agregar contacto
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Community Profile Detail Modal */}
      {selectedProfile && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProfile(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${selectedProfile.displayName}`}
            className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl border fabro-surface shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
          >
            {/* Cover + Close */}
            <div
              className="h-28 sm:h-32 w-full relative shrink-0"
              style={{ background: selectedProfile.coverGradient }}
            >
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                aria-label="Cerrar perfil"
                className="absolute top-3 right-3 min-h-[40px] min-w-[40px] rounded-xl bg-slate-950/65 text-white border border-white/25 flex items-center justify-center cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
              {selectedProfile.isAiMentor && (
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-950/80 text-cyan-200 border border-cyan-400/40 px-3 py-1 text-xs font-bold">
                  <Bot className="w-3.5 h-3.5" />
                  Mentor IA · Requiere tu clave BYOK en Sector 4
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
              {/* Identity Row */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 -mt-9 mb-4">
                <div className="flex items-end gap-3">
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-4 border-white dark:border-slate-900 text-white font-display font-extrabold text-xl flex items-center justify-center shadow-lg shrink-0"
                    style={{ backgroundColor: selectedProfile.avatarColor }}
                  >
                    {selectedProfile.isAiMentor ? (
                      <Sparkles className="w-7 h-7" />
                    ) : (
                      selectedProfile.avatarInitials
                    )}
                  </div>
                  <div className="pb-0.5 min-w-0">
                    <h3 className="font-display text-lg font-extrabold leading-tight">
                      {selectedProfile.displayName}
                    </h3>
                    <p className="text-xs font-mono text-[#7C3AED] dark:text-[#C4B5FD] font-semibold">
                      @{selectedProfile.username} · {selectedProfile.fabroId}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFollow(selectedProfile)}
                    className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
                      followingIds.includes(selectedProfile.id)
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-[#7C3AED] bg-[#7C3AED] text-white'
                    }`}
                  >
                    {followingIds.includes(selectedProfile.id) ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Siguiendo
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        Seguir
                      </>
                    )}
                  </button>

                  {selectedProfile.isAiMentor ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfile(null);
                        navigateTo('ia', 'asistente-api');
                      }}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir Sector 4 (BYOK)
                    </button>
                  ) : (
                    (() => {
                      const matched = findFriendMatch(selectedProfile);
                      return matched ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProfile(null);
                            openDirectChatWithFriend(matched.id);
                          }}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#7C3AED]" />
                          Escribir mensaje
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddContact(selectedProfile)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-[#EC4899]" />
                          Agregar contacto
                        </button>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Bio & Meta */}
              <div className="space-y-2.5 mb-4">
                <p className="text-sm leading-relaxed">{selectedProfile.bio}</p>
                <p className="text-xs fabro-muted font-medium">
                  Actividad actual: <span className="font-semibold">{selectedProfile.currentActivity}</span>
                </p>
                <p className="text-xs fabro-muted">{selectedProfile.interests.join(' · ')}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums fabro-muted">
                  <span>
                    {selectedProfile.followersCount +
                      (followingIds.includes(selectedProfile.id) ? 1 : 0)}{' '}
                    seguidores
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedProfile.followingCount} seguidos</span>
                </div>
              </div>

              {/* Modal Sub-Tabs */}
              <div className="flex items-center gap-1.5 border-b fabro-border pb-2.5 mb-4 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setModalTab('posts')}
                  className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
                    modalTab === 'posts'
                      ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  Publicaciones ({selectedProfile.samplePosts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('resources')}
                  className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
                    modalTab === 'resources'
                      ? 'border-[#2563EB] bg-[#2563EB] text-white'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  Apuntes y Rutinas (
                  {selectedProfile.publicNotes.length + selectedProfile.publicRoutines.length})
                </button>
                {selectedProfile.tastes && (
                  <button
                    type="button"
                    onClick={() => setModalTab('tastes')}
                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
                      modalTab === 'tastes'
                        ? 'border-[#EC4899] bg-[#EC4899] text-white'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    Gustos
                  </button>
                )}
              </div>

              {/* Tab Content */}
              {modalTab === 'posts' && (
                <div className="space-y-3">
                  {selectedProfile.samplePosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] fabro-muted">
                        <span className="font-bold">{post.author}</span>
                        <span>{post.createdAt}</span>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed">{post.text}</p>
                      {post.sharedResource && (
                        <div className="rounded-xl border border-[#2563EB]/35 bg-[#2563EB]/8 p-3 space-y-1">
                          <p className="text-xs font-bold">{post.sharedResource.title}</p>
                          <p className="text-[11px] fabro-muted">{post.sharedResource.subtitle}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] fabro-muted tabular-nums">
                        <Heart className="w-3.5 h-3.5 text-[#EC4899]" />
                        <span>{post.likes} reacciones</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {modalTab === 'resources' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#2563EB]" />
                      Apuntes públicos ({selectedProfile.publicNotes.length})
                    </h4>
                    {selectedProfile.publicNotes.length === 0 ? (
                      <p className="text-xs fabro-muted">Sin apuntes públicos por ahora.</p>
                    ) : (
                      selectedProfile.publicNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1"
                        >
                          <p className="text-xs font-bold">{note.title}</p>
                          <p className="text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                            {note.subject}
                          </p>
                          <p className="text-xs fabro-muted">{note.summary}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold flex items-center gap-1.5">
                      <Dumbbell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Rutinas públicas ({selectedProfile.publicRoutines.length})
                    </h4>
                    {selectedProfile.publicRoutines.length === 0 ? (
                      <p className="text-xs fabro-muted">Sin rutinas públicas por ahora.</p>
                    ) : (
                      selectedProfile.publicRoutines.map((routine) => (
                        <div
                          key={routine.id}
                          className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1"
                        >
                          <p className="text-xs font-bold">{routine.title}</p>
                          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {routine.category}
                          </p>
                          <p className="text-xs fabro-muted">{routine.detail}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {modalTab === 'tastes' && selectedProfile.tastes && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                    <p className="font-bold mb-0.5">Música</p>
                    <p className="fabro-muted">{selectedProfile.tastes.music}</p>
                  </div>
                  <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                    <p className="font-bold mb-0.5">Películas</p>
                    <p className="fabro-muted">{selectedProfile.tastes.movies}</p>
                  </div>
                  <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                    <p className="font-bold mb-0.5">Libros</p>
                    <p className="fabro-muted">{selectedProfile.tastes.books}</p>
                  </div>
                  <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                    <p className="font-bold mb-0.5">Comida y bebidas</p>
                    <p className="fabro-muted">
                      {selectedProfile.tastes.food} · {selectedProfile.tastes.drinks}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
