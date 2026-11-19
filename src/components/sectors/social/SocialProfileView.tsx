import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  Check,
  Coffee,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Film,
  Globe,
  Heart,
  Image as ImageIcon,
  ImagePlus,
  Lightbulb,
  Loader2,
  Lock,
  LogIn,
  MessageCircle,
  Music,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Users,
  Utensils,
} from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import { DEFAULT_MOBILITY_ROUTINE } from '../../../services/localVault';
import { processAvatarImage, processCoverImage } from '../../../services/mediaVault';
import type { LocalUserProfile, SocialMediaAttachment } from '../../../types/ecosystem';
import { MediaLightboxModal, ResolvedMediaDisplay } from './ResolvedMediaDisplay';

export type ProfileInnerTab = 'publicaciones' | 'galeria' | 'recursos' | 'sobre-mi';

interface SocialProfileViewProps {
  initialTab?: ProfileInnerTab;
  inModal?: boolean;
  onCloseModal?: () => void;
}

const PRIVACY_OPTIONS: Array<{
  id: LocalUserProfile['privacyMode'];
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'todos', label: 'Público', icon: Globe },
  { id: 'grupo', label: 'Solo contactos', icon: Users },
  { id: 'invisible', label: 'Privado', icon: Lock },
];

export const SocialProfileView: React.FC<SocialProfileViewProps> = ({
  initialTab = 'publicaciones',
  inModal = false,
  onCloseModal,
}) => {
  const {
    profile,
    authUser,
    friendsList,
    wallPosts,
    ephemeralStories,
    advancedNotes,
    balancedPlanner,
    saveFullSocialProfile,
    setEditSocialProfileOpen,
    togglePublicNote,
    togglePublicRoutine,
    deleteWallPost,
    reactToWallPost,
    navigateTo,
    openAuthModal,
    signInWithGoogle,
    signInWithGoogleRedirect,
    needsProfileSetup,
  } = useEcosystem();
  const { myRestriction, openParticipationModal } = useAdmin();

  const [activeTab, setActiveTab] = useState<ProfileInnerTab>(initialTab);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [manageResourcesOpen, setManageResourcesOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadingQuick, setUploadingQuick] = useState<'avatar' | 'cover' | null>(null);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [googleAuthCode, setGoogleAuthCode] = useState<string | null>(null);

  const handleDirectGoogleSignIn = async () => {
    setGoogleSigningIn(true);
    setGoogleAuthError(null);
    setGoogleAuthCode(null);
    const res = await signInWithGoogle();
    setGoogleSigningIn(false);
    if (!res.ok && res.error) {
      setGoogleAuthError(res.error);
      setGoogleAuthCode(res.code || null);
    }
  };

  const myHandle = profile.username || authUser?.username || profile.fabroId.toLowerCase();

  // Posts authored by the current user
  const myPosts = useMemo(() => {
    const myName = (profile.displayName || '').toLowerCase();
    const myId = (profile.fabroId || '').toUpperCase();
    return wallPosts.filter(
      (p) =>
        p.fabroId.toUpperCase() === myId ||
        p.author.toLowerCase() === myName ||
        p.fabroId === 'FBR-LOCAL-01'
    );
  }, [profile.displayName, profile.fabroId, wallPosts]);

  // All photos & videos uploaded by the user (from wall posts + stories + profile photos)
  const myGalleryItems = useMemo(() => {
    const list: SocialMediaAttachment[] = [];
    myPosts.forEach((p) => {
      if (Array.isArray(p.media)) {
        p.media.forEach((m) => list.push(m));
      }
    });
    ephemeralStories.forEach((st) => {
      if (
        st.fabroId.toUpperCase() === (profile.fabroId || '').toUpperCase() ||
        st.author.toLowerCase() === (profile.displayName || '').toLowerCase()
      ) {
        if (st.mediaKind === 'video' && st.videoMediaId) {
          list.push({
            id: `story-vid-${st.id}`,
            kind: 'video',
            mediaVaultId: st.videoMediaId,
            posterDataUrl: st.videoPosterUrl,
            caption: st.text || st.statusTag,
          });
        } else if (st.imageDataUrl) {
          list.push({
            id: `story-img-${st.id}`,
            kind: 'image',
            dataUrl: st.imageDataUrl,
            caption: st.text || st.statusTag,
          });
        }
      }
    });
    if (profile.photoURL) {
      list.push({
        id: 'profile-avatar-img',
        kind: 'image',
        dataUrl: profile.photoURL,
        caption: `Foto de perfil de ${profile.displayName}`,
      });
    }
    if (profile.coverPhotoURL) {
      list.push({
        id: 'profile-cover-img',
        kind: 'image',
        dataUrl: profile.coverPhotoURL,
        caption: `Portada de ${profile.displayName}`,
      });
    }
    return list;
  }, [ephemeralStories, myPosts, profile.coverPhotoURL, profile.displayName, profile.fabroId, profile.photoURL]);

  // Available wellness routines for public profile showcase
  const availableRoutines = useMemo(
    () => [
      {
        id: 'routine-mobility',
        title: DEFAULT_MOBILITY_ROUTINE.title,
        category: DEFAULT_MOBILITY_ROUTINE.category,
        detail: `${DEFAULT_MOBILITY_ROUTINE.rounds} rondas · ${DEFAULT_MOBILITY_ROUTINE.workSec}s trabajo / ${DEFAULT_MOBILITY_ROUTINE.restSec}s pausa`,
      },
      ...balancedPlanner.map((item) => ({
        id: `plan-${item.id}`,
        title: `${item.time} · ${item.block}`,
        category: 'Planificador Equilibrado · Sector 2',
        detail: item.activity,
      })),
    ],
    [balancedPlanner]
  );

  const publicNotes = useMemo(() => {
    const ids = new Set(profile.publicNoteIds || []);
    return advancedNotes.filter((n) => ids.has(n.id));
  }, [advancedNotes, profile.publicNoteIds]);

  const publicRoutines = useMemo(() => {
    const ids = new Set(profile.publicRoutineIds || []);
    return availableRoutines.filter((r) => ids.has(r.id));
  }, [availableRoutines, profile.publicRoutineIds]);

  const buildProfileShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?addFriendId=${encodeURIComponent(
      profile.fabroId
    )}&addFriendName=${encodeURIComponent(profile.displayName)}`;
  };

  const handleCopyProfileLink = async () => {
    const url = buildProfileShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback('Enlace de tu perfil FABRO copiado al portapapeles.');
      window.setTimeout(() => setShareFeedback(null), 2600);
    } catch {
      setShareFeedback(url);
    }
  };

  const handleShareWhatsApp = () => {
    const url = buildProfileShareUrl();
    const text = `Conectá conmigo en FABRO (${profile.displayName} · @${myHandle} · ${profile.fabroId}): ${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const handleQuickAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingQuick('avatar');
    try {
      const optimized = await processAvatarImage(file);
      await saveFullSocialProfile({ photoURL: optimized });
    } finally {
      setUploadingQuick(null);
    }
  };

  const handleQuickCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingQuick('cover');
    try {
      const optimized = await processCoverImage(file);
      await saveFullSocialProfile({ coverPhotoURL: optimized });
    } finally {
      setUploadingQuick(null);
    }
  };

  const followersCount = profile.followersCount ?? 18;
  const followingCount = (profile.followingIds || []).length;
  const contactsCount = friendsList.length;

  return (
    <div className="space-y-4">
      {/* Main Profile Header Card (Cover + Avatar + Identity + Counters + Actions) */}
      <section className="overflow-hidden rounded-2xl border fabro-border fabro-surface shadow-sm">
        {/* Cover Banner */}
        <div className="relative h-36 sm:h-48 w-full bg-gradient-to-r from-[#0F172A] via-[#1D4ED8] to-[#7C3AED]">
          {profile.coverPhotoURL && (
            <img
              src={profile.coverPhotoURL}
              alt={`Portada de ${profile.displayName}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/15 to-transparent" />
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {authUser ? (
              <label className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs cursor-pointer hover:bg-slate-900">
                <ImagePlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {uploadingQuick === 'cover' ? 'Optimizando...' : 'Cambiar portada'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQuickCoverUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('crear tu perfil en FABRO con tu cuenta de Google', 'login')}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/95 px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow-sm cursor-pointer hover:bg-white"
              >
                <LogIn className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Iniciar sesión</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Info Body */}
        <div className="px-4 sm:px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 relative z-10">
            {/* Avatar + Name */}
            <div className="flex items-end gap-3.5 min-w-0">
              <div className="relative shrink-0">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="h-24 w-24 rounded-2xl border-4 border-[var(--fabro-surface)] object-cover shadow-lg bg-slate-900"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-2xl border-4 border-[var(--fabro-surface)] bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center shadow-lg">
                    <User className="w-10 h-10" />
                  </div>
                )}
                {authUser && (
                  <label
                    title="Cambiar foto de perfil"
                    className="absolute -bottom-1.5 -right-1.5 h-8 w-8 rounded-xl border-2 border-[var(--fabro-surface)] bg-[#7C3AED] text-white flex items-center justify-center shadow-md cursor-pointer hover:brightness-110"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQuickAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pb-1 min-w-0">
                <h2 className="font-display text-lg sm:text-xl font-extrabold truncate">
                  {authUser ? profile.displayName : 'Bienvenido a FABRO'}
                </h2>
                <p className="text-xs font-mono fabro-muted truncate">
                  {authUser
                    ? `@${myHandle} · ${profile.fabroId}${needsProfileSetup ? ' · Completá tu perfil' : ' · Cuenta Google verificada'}`
                    : 'Iniciá sesión con Google para crear tu perfil en FABRO'}
                </p>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {authUser ? (
                <button
                  type="button"
                  onClick={() => setEditSocialProfileOpen(true)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] px-4 py-1.5 text-xs font-bold text-white cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  {needsProfileSetup ? (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Crear mi perfil en FABRO</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar Perfil</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={googleSigningIn}
                    onClick={() => void handleDirectGoogleSignIn()}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] hover:bg-[#6D28D9] px-4 py-2 text-xs font-bold text-white shadow-sm cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-60"
                  >
                    {googleSigningIn ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>{googleSigningIn ? 'Conectando con Google...' : 'Iniciar sesión con Google'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openAuthModal('crear tu perfil en FABRO con tu cuenta de Google', 'login')
                    }
                    className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <span>Iniciar sesión</span>
                  </button>
                </>
              )}

              {authUser && (
                <>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/50 bg-emerald-600/12 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer active:scale-95"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyProfileLink()}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Enlace
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  onCloseModal?.();
                  openParticipationModal(
                    myRestriction && myRestriction.accountStatus !== 'activo'
                      ? 'reports-appeals'
                      : 'ideas'
                  );
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {myRestriction && myRestriction.accountStatus !== 'activo'
                  ? 'Apelaciones'
                  : 'Ideas y sectores'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseModal?.();
                  navigateTo('configuracion', 'config-general');
                }}
                title="Cuenta y sincronización"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border fabro-border fabro-surface-elevated cursor-pointer"
              >
                <Settings className="w-4 h-4 fabro-muted" />
              </button>
            </div>
          </div>

          {googleAuthError && (
            <div className="mt-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-2">
              <p className="font-semibold">{googleAuthError}</p>
              {(googleAuthCode === 'auth/popup-closed-by-user' ||
                googleAuthCode === 'auth/popup-blocked' ||
                googleAuthCode === 'auth/cancelled-popup-request') && (
                <div className="flex flex-wrap items-center gap-2">
                  {typeof window !== 'undefined' && window.self !== window.top ? (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] text-white px-3 py-1.5 text-[11px] font-bold hover:bg-[#0369A1]"
                    >
                      Abrir FABRO en pestaña nueva
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void signInWithGoogleRedirect()}
                      className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] text-white px-3 py-1.5 text-[11px] font-bold hover:bg-[#0369A1] cursor-pointer"
                    >
                      Ingresar por redirección de Google
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!authUser && (
            <div className="mt-4 rounded-xl border border-[#7C3AED]/35 bg-[#7C3AED]/8 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <p className="font-bold text-sm text-[var(--fabro-text)]">
                  Creá tu perfil en FABRO con tu cuenta de Google
                </p>
                <p className="fabro-muted leading-relaxed">
                  Al iniciar sesión con Google vas a poder crear tu perfil personal en FABRO, elegir tu <strong>@usuario</strong>, subir tu foto, publicar en el muro y sincronizar tus sectores gratis.
                </p>
              </div>
              <button
                type="button"
                disabled={googleSigningIn}
                onClick={() => void handleDirectGoogleSignIn()}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2 text-xs font-bold shadow-xs hover:border-[#4285F4] cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>{googleSigningIn ? 'Entrando...' : 'Entrar con Google'}</span>
              </button>
            </div>
          )}

          {authUser && needsProfileSetup && (
            <div className="mt-4 rounded-xl border border-emerald-600/40 bg-emerald-600/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200">
                  ¡Cuenta de Google conectada! Ahora creá tu perfil en FABRO
                </p>
                <p className="fabro-muted">
                  Elegí tu nombre visible, tu <strong>@usuario</strong> único y tu biografía para activar tu identidad completa en FABRO.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditSocialProfileOpen(true)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Crear mi perfil en FABRO</span>
              </button>
            </div>
          )}

          {shareFeedback && (
            <p className="mt-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {shareFeedback}
            </p>
          )}

          {/* Current Activity + Bio + Clean Unboxed Interests */}
          <div className="mt-4 space-y-2.5">
            {profile.currentActivity && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6D28D9] dark:text-[#C4B5FD]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{profile.currentActivity}</span>
              </p>
            )}

            <p className="text-sm leading-relaxed text-[var(--fabro-text)]">
              {profile.bio || profile.dailyPhrase}
            </p>

            {profile.interests && profile.interests.length > 0 && (
              <p className="text-xs fabro-muted leading-relaxed">
                {profile.interests.map((tag, i) => (
                  <React.Fragment key={tag}>
                    {i > 0 && <span className="mx-1.5 opacity-50">·</span>}
                    <span className="font-medium text-[var(--fabro-text)]/85">#{tag}</span>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>

          {/* Counters & Privacy Selector Row */}
          <div className="mt-4 pt-4 border-t fabro-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5 text-xs">
              <div>
                <span className="font-display text-base font-extrabold tabular-nums">
                  {followersCount}
                </span>{' '}
                <span className="fabro-muted">Seguidores</span>
              </div>
              <div>
                <span className="font-display text-base font-extrabold tabular-nums">
                  {followingCount}
                </span>{' '}
                <span className="fabro-muted">Seguidos</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onCloseModal?.();
                  navigateTo('social', 'amistades');
                }}
                className="cursor-pointer hover:underline"
              >
                <span className="font-display text-base font-extrabold tabular-nums">
                  {contactsCount}
                </span>{' '}
                <span className="fabro-muted">Contactos</span>
              </button>
              <div>
                <span className="font-display text-base font-extrabold tabular-nums">
                  {myPosts.length}
                </span>{' '}
                <span className="fabro-muted">Publicaciones</span>
              </div>
            </div>

            {/* Privacy Selector */}
            <div className="flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
              {PRIVACY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = profile.privacyMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (!authUser) {
                        openAuthModal('crear tu perfil en FABRO con tu cuenta de Google', 'login');
                        return;
                      }
                      void saveFullSocialProfile({ privacyMode: opt.id });
                    }}
                    className={`min-h-[32px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-all ${
                      active
                        ? 'bg-[#7C3AED] text-white'
                        : 'fabro-muted hover:text-[var(--fabro-text)]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {authUser && (
            <div className="mt-3 text-[11px] fabro-muted">
              Sesión conectada con Google ({authUser.email || `@${myHandle}`})
            </div>
          )}
        </div>
      </section>

      {/* Profile Own 4 Tabs Navigation */}
      <div
        role="tablist"
        aria-label="Secciones de Mi Perfil Social"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {(
          [
            { id: 'publicaciones', label: `Publicaciones (${myPosts.length})` },
            { id: 'galeria', label: `Fotos y Videos (${myGalleryItems.length})` },
            {
              id: 'recursos',
              label: `Apuntes y Rutinas (${publicNotes.length + publicRoutines.length})`,
            },
            { id: 'sobre-mi', label: 'Sobre mí / Gustos' },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition-all ${
                active
                  ? 'border-[#7C3AED] bg-[#7C3AED] text-white shadow-sm'
                  : 'fabro-border fabro-surface fabro-muted hover:text-[var(--fabro-text)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PUBLICACIONES */}
      {activeTab === 'publicaciones' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs fabro-muted">
              Todo lo que compartiste en tu muro y en la comunidad FABRO.
            </p>
            <button
              type="button"
              onClick={() => {
                onCloseModal?.();
                navigateTo('social', 'fabro-id');
              }}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED]/50 bg-[#7C3AED]/10 px-3 py-1.5 text-xs font-semibold text-[#6D28D9] dark:text-[#C4B5FD] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva publicación
            </button>
          </div>

          {myPosts.length === 0 ? (
            <div className="rounded-2xl border fabro-border fabro-surface p-6 text-center space-y-2">
              <p className="text-sm font-semibold">Todavía no compartiste publicaciones propias</p>
              <p className="text-xs fabro-muted">
                Subí fotos, videos, encuestas o logros de estudio desde el Muro Social.
              </p>
            </div>
          ) : (
            myPosts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {profile.photoURL ? (
                      <img
                        src={profile.photoURL}
                        alt={post.author}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 rounded-xl object-cover border fabro-border shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-[#7C3AED]/15 text-[#7C3AED] font-bold flex items-center justify-center shrink-0">
                        {post.author.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold truncate">{post.author}</p>
                      <p className="text-[11px] fabro-muted">
                        {post.createdAt} · {post.fabroId}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteWallPost(post.id)}
                    title="Eliminar publicación"
                    className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {post.text && <p className="text-sm leading-relaxed">{post.text}</p>}

                {post.media && post.media.length > 0 && (
                  <div
                    className={`grid gap-2 ${
                      post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                  >
                    {post.media.map((m) => (
                      <ResolvedMediaDisplay
                        key={m.id}
                        item={m}
                        onOpenLightbox={() => {
                          const idx = myGalleryItems.findIndex((g) => g.id === m.id);
                          if (idx >= 0) setLightboxIndex(idx);
                        }}
                      />
                    ))}
                  </div>
                )}

                {post.sharedResource && (
                  <div className="rounded-xl border border-[#2563EB]/35 bg-[#2563EB]/8 p-3 space-y-1">
                    <p className="text-[11px] font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
                      {post.sharedResource.metricLabel || 'Recurso FABRO'}
                    </p>
                    <p className="font-bold text-sm">{post.sharedResource.title}</p>
                    <p className="fabro-muted">{post.sharedResource.subtitle}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t fabro-border fabro-muted">
                  <button
                    type="button"
                    onClick={() => reactToWallPost(post.id, 'like')}
                    className={`inline-flex items-center gap-1.5 font-semibold cursor-pointer ${
                      post.myReaction ? 'text-[#EC4899]' : 'hover:text-[var(--fabro-text)]'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{post.likes} reacciones</span>
                  </button>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {(post.comments || []).length} comentarios
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* TAB 2: FOTOS Y VIDEOS (GALERÍA) */}
      {activeTab === 'galeria' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs fabro-muted">
              Tocá cualquier foto o video para abrir el visor en pantalla completa.
            </p>
            <button
              type="button"
              onClick={() => {
                onCloseModal?.();
                navigateTo('social', 'fabro-id');
              }}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED]/50 bg-[#7C3AED]/10 px-3 py-1.5 text-xs font-semibold text-[#6D28D9] dark:text-[#C4B5FD] cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Subir foto/video
            </button>
          </div>

          {myGalleryItems.length === 0 ? (
            <div className="rounded-2xl border fabro-border fabro-surface p-8 text-center space-y-2">
              <ImageIcon className="w-8 h-8 mx-auto fabro-muted opacity-60" />
              <p className="text-sm font-semibold">Tu galería todavía está vacía</p>
              <p className="text-xs fabro-muted">
                Subí una foto de perfil, portada o publicación multimedia y aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {myGalleryItems.map((media, idx) => (
                <ResolvedMediaDisplay
                  key={media.id}
                  item={media}
                  compact
                  className="aspect-square"
                  onOpenLightbox={() => setLightboxIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: APUNTES Y RUTINAS PÚBLICAS */}
      {activeTab === 'recursos' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border fabro-border fabro-surface p-4">
            <div>
              <p className="font-bold text-sm">Recursos de Estudio y Bienestar en tu perfil</p>
              <p className="fabro-muted">
                Elegí qué apuntes (Sector 1) o rutinas (Sector 2) querés mostrar públicamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManageResourcesOpen((v) => !v)}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB]/50 bg-[#2563EB]/10 px-3 py-1.5 font-semibold text-[#1D4ED8] dark:text-[#93C5FD] cursor-pointer"
            >
              {manageResourcesOpen ? 'Listo' : 'Elegir recursos públicos'}
            </button>
          </div>

          {manageResourcesOpen && (
            <div className="rounded-2xl border border-[#2563EB]/35 fabro-surface p-4 space-y-4">
              <div className="space-y-2">
                <p className="font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
                  Apuntes de Estudio (Sector 1)
                </p>
                {advancedNotes.length === 0 ? (
                  <p className="fabro-muted">No tenés apuntes guardados aún.</p>
                ) : (
                  <div className="space-y-1.5">
                    {advancedNotes.map((note) => {
                      const isPub = (profile.publicNoteIds || []).includes(note.id);
                      return (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => togglePublicNote(note.id)}
                          className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left cursor-pointer ${
                            isPub
                              ? 'border-emerald-500/50 bg-emerald-500/10'
                              : 'fabro-border fabro-surface-elevated'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{note.title}</p>
                            <p className="text-[11px] fabro-muted truncate">{note.subject}</p>
                          </div>
                          <span className="shrink-0 font-bold">
                            {isPub ? 'Público ✓' : 'Oculto'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">
                  Rutinas de Bienestar (Sector 2)
                </p>
                <div className="space-y-1.5">
                  {availableRoutines.map((r) => {
                    const isPub = (profile.publicRoutineIds || []).includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => togglePublicRoutine(r.id)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left cursor-pointer ${
                          isPub
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'fabro-border fabro-surface-elevated'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{r.title}</p>
                          <p className="text-[11px] fabro-muted truncate">{r.detail}</p>
                        </div>
                        <span className="shrink-0 font-bold">
                          {isPub ? 'Pública ✓' : 'Oculta'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {publicNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
                    Apunte · {note.subject}
                  </span>
                  <BookOpen className="w-4 h-4 text-[#2563EB]" />
                </div>
                <p className="font-display text-sm font-bold">{note.title}</p>
                <p className="fabro-muted leading-relaxed line-clamp-3">
                  {note.mainIdea || note.summaryText || note.contentText}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onCloseModal?.();
                    navigateTo('estudio', 'materias-apuntes');
                  }}
                  className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
                >
                  Abrir en Cuaderno Digital →
                </button>
              </div>
            ))}

            {publicRoutines.map((routine) => (
              <div
                key={routine.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Rutina · {routine.category}
                  </span>
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="font-display text-sm font-bold">{routine.title}</p>
                <p className="fabro-muted leading-relaxed">{routine.detail}</p>
              </div>
            ))}
          </div>

          {publicNotes.length === 0 && publicRoutines.length === 0 && (
            <div className="rounded-2xl border fabro-border fabro-surface p-6 text-center fabro-muted">
              No marcaste apuntes ni rutinas como públicos todavía. Tocá «Elegir recursos públicos» para destacar tu material.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SOBRE MÍ / GUSTOS (VINCULADO CON SECTOR 2) */}
      {activeTab === 'sobre-mi' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b fabro-border">
            <div>
              <h3 className="font-display text-sm font-bold">
                Gustos compartidos (vinculado con Sector 2 · Bienestar)
              </h3>
              <p className="fabro-muted">
                Controlá si tus libros, música, películas y comidas favoritas son visibles en tu perfil.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void saveFullSocialProfile({
                    shareTastesPublicly: !profile.shareTastesPublicly,
                  })
                }
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-semibold cursor-pointer ${
                  profile.shareTastesPublicly
                    ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                {profile.shareTastesPublicly ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Visible en perfil
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Oculto
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseModal?.();
                  navigateTo('bienestar', 'mi-vida');
                }}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 font-semibold cursor-pointer"
              >
                Editar en Sector 2
              </button>
            </div>
          </div>

          {!profile.shareTastesPublicly ? (
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 text-center fabro-muted">
              Tus gustos del Sector 2 están ocultos en tu perfil público. Activá el interruptor superior cuando quieras mostrarlos.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-[#7C3AED] dark:text-[#C4B5FD]">
                  <Music className="w-3.5 h-3.5" /> Música favorita
                </p>
                <p className="leading-relaxed">{profile.tastes.music || 'Sin completar'}</p>
              </div>
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-[#2563EB] dark:text-[#60A5FA]">
                  <BookOpen className="w-3.5 h-3.5" /> Libros de referencia
                </p>
                <p className="leading-relaxed">{profile.tastes.books || 'Sin completar'}</p>
              </div>
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-[#EC4899] dark:text-[#F472B6]">
                  <Film className="w-3.5 h-3.5" /> Películas y series
                </p>
                <p className="leading-relaxed">{profile.tastes.movies || 'Sin completar'}</p>
              </div>
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Utensils className="w-3.5 h-3.5" /> Comidas favoritas
                </p>
                <p className="leading-relaxed">{profile.tastes.food || 'Sin completar'}</p>
              </div>
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1 sm:col-span-2">
                <p className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Coffee className="w-3.5 h-3.5" /> Bebidas de estudio o descanso
                </p>
                <p className="leading-relaxed">{profile.tastes.drinks || 'Sin completar'}</p>
              </div>
            </div>
          )}

          {profile.icebreaker && (
            <div className="rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/8 p-3.5">
              <p className="text-[11px] font-bold text-[#6D28D9] dark:text-[#C4B5FD]">
                Pregunta rompehielos
              </p>
              <p className="mt-1 text-sm font-medium">{profile.icebreaker}</p>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Lightbox for Gallery */}
      {lightboxIndex !== null && (
        <MediaLightboxModal
          items={myGalleryItems}
          initialIndex={lightboxIndex}
          title={`Galería de ${profile.displayName}`}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {inModal && <div className="h-2" />}
    </div>
  );
};
