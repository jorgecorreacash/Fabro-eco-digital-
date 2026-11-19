import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart2,
  Bookmark,
  BookOpen,
  Check,
  ExternalLink,
  Film,
  Flag,
  Forward,
  Heart,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Smile,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  PHOTO_CROP_LABELS,
  PHOTO_FILTER_CSS,
  PHOTO_FILTER_LABELS,
  saveImageAttachmentToVault,
  saveVideoAttachmentToVault,
} from '../../../services/mediaVault';
import {
  isPostCultureOnly,
  isPostInCultureWall,
} from '../../../services/cultureVault';
import { isDirectHtml5VideoUrl } from '../../../services/videoEmbedUtils';
import type {
  PhotoCropMode,
  PhotoFilterId,
  SocialMediaAttachment,
  SocialReactionKey,
  WallCommentItem,
  WallPostItem,
  WallSharedResource,
} from '../../../types/ecosystem';
import { MediaLightboxModal, ResolvedMediaDisplay } from './ResolvedMediaDisplay';

type ComposerMode = 'multimedia' | 'historia' | 'encuesta' | 'recurso';
type FeedFilter =
  | 'todo'
  | 'estudio'
  | 'bienestar'
  | 'cultura'
  | 'comunidad'
  | 'general'
  | 'multimedia'
  | 'encuestas'
  | 'recursos'
  | 'guardados';

interface PendingMediaDraft {
  id: string;
  file: File;
  kind: 'image' | 'video';
  previewUrl: string;
  caption: string;
  filter: PhotoFilterId;
  crop: PhotoCropMode;
}

const REACTIONS_META: Array<{
  key: SocialReactionKey;
  emoji: string;
  label: string;
}> = [
  { key: 'like', emoji: '👍', label: 'Me gusta' },
  { key: 'love', emoji: '❤️', label: 'Me encanta' },
  { key: 'insightful', emoji: '💡', label: 'Excelente aporte' },
  { key: 'strength', emoji: '💪', label: 'Fuerza' },
  { key: 'inspiring', emoji: '✨', label: 'Inspirador' },
];

const STORY_GRADIENTS = [
  { tag: 'Modo enfoque', gradient: 'linear-gradient(135deg, #7C3AED, #EC4899)' },
  { tag: 'Estudiando para un final', gradient: 'linear-gradient(135deg, #2563EB, #06B6D4)' },
  { tag: 'Entrenando', gradient: 'linear-gradient(135deg, #10B981, #F59E0B)' },
  { tag: 'Pausa consciente', gradient: 'linear-gradient(135deg, #0F172A, #1D4ED8)' },
];

const QUICK_COMMENT_EMOJIS = ['👏', '🔥', '💡', '💪', '🍀', '❤️'];

export const WallPollsFeed: React.FC = () => {
  const {
    profile,
    authUser,
    network,
    wallPosts,
    addWallPost,
    deleteWallPost,
    reactToWallPost,
    addWallPostComment,
    voteOnWallPoll,
    toggleWallPostBookmark,
    addEphemeralStory,
    advancedNotes,
    pomodoroLogs,
    moodLogs,
    friendsList,
    studyRooms,
    sendQuickChatMessage,
    addStudyRoomPost,
    navigateTo,
    openSocialProfileModal,
  } = useEcosystem();
  const { isActionRestricted, openReportModal } = useAdmin();

  const [composerMode, setComposerMode] = useState<ComposerMode>('multimedia');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('todo');
  const [postText, setPostText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingMediaDraft[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);

  // Story composer fields
  const [storyStyleIdx, setStoryStyleIdx] = useState(0);

  // Poll composer fields
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '', '']);

  // Shared FABRO Resource composer fields
  const [resourceKind, setResourceKind] = useState<'note' | 'flashcards' | 'streak'>('note');
  const [selectedNoteId, setSelectedNoteId] = useState<string>(advancedNotes[0]?.id || '');

  // Post interactive popovers/states
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
  const [openCommentsPostIds, setOpenCommentsPostIds] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<
    Record<string, { id: string; author: string } | null>
  >({});
  const [shareMenuPostId, setShareMenuPostId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<Record<string, string>>({});
  const [lightboxState, setLightboxState] = useState<{
    items: SocialMediaAttachment[];
    index: number;
    title: string;
  } | null>(null);

  const generalVisiblePosts = useMemo(
    () =>
      wallPosts.filter(
        (p) =>
          !isPostCultureOnly(p) &&
          p.moderationStatus !== 'oculta' &&
          p.moderationStatus !== 'eliminada'
      ),
    [wallPosts]
  );

  const filteredPosts = useMemo(() => {
    return generalVisiblePosts.filter((p) => {
      if (feedFilter === 'estudio') return p.origin === 'estudio';
      if (feedFilter === 'bienestar') return p.origin === 'bienestar';
      if (feedFilter === 'cultura') return isPostInCultureWall(p);
      if (feedFilter === 'comunidad') return p.origin === 'comunidad';
      if (feedFilter === 'general') return !p.origin || p.origin === 'general';
      if (feedFilter === 'multimedia') {
        return Boolean((p.media && p.media.length > 0) || p.videoEmbed);
      }
      if (feedFilter === 'encuestas') return Boolean(p.poll);
      if (feedFilter === 'recursos') return Boolean(p.sharedResource);
      if (feedFilter === 'guardados') return Boolean(p.bookmarked);
      return true;
    });
  }, [feedFilter, generalVisiblePosts]);

  const handleMediaPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const nextDrafts: PendingMediaDraft[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isVideo && !isImage) continue;

      if (isVideo) {
        if (file.size > 60 * 1024 * 1024) {
          setComposerNotice('El video supera los 60 MB permitidos en almacenamiento local.');
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        nextDrafts.push({
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          file,
          kind: 'video',
          previewUrl,
          caption: '',
          filter: 'none',
          crop: 'original',
        });
        break; // 1 video per post/story
      } else {
        const previewUrl = URL.createObjectURL(file);
        nextDrafts.push({
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          file,
          kind: 'image',
          previewUrl,
          caption: '',
          filter: 'none',
          crop: 'original',
        });
      }
    }

    setPendingMedia((prev) => {
      // If picking a video or in story mode, replace existing drafts cleanly
      if (composerMode === 'historia' || nextDrafts.some((d) => d.kind === 'video')) {
        prev.forEach((d) => URL.revokeObjectURL(d.previewUrl));
        return nextDrafts.slice(0, 1);
      }
      const imagesOnly = prev.filter((d) => d.kind === 'image');
      return [...imagesOnly, ...nextDrafts].slice(0, 4);
    });
    setComposerNotice(null);
  };

  const removeDraftMedia = (id: string) => {
    setPendingMedia((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.id !== id);
    });
  };

  const updateDraftMedia = (id: string, patch: Partial<PendingMediaDraft>) => {
    setPendingMedia((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const buildSelectedResource = (): WallSharedResource | undefined => {
    if (resourceKind === 'note') {
      const note = advancedNotes.find((n) => n.id === selectedNoteId) || advancedNotes[0];
      if (!note) return undefined;
      return {
        kind: 'note',
        refId: note.id,
        title: note.title,
        subtitle: note.mainIdea || note.summaryText || note.contentText.slice(0, 160),
        subject: note.subject,
        metricLabel: `Apunte · ${note.subject}`,
      };
    }
    if (resourceKind === 'flashcards') {
      return {
        kind: 'flashcards',
        title: 'Mazo de Repetición Espaciada (Flashcards SRS)',
        subtitle: 'Tarjetas activas de Recuerdo Activo y Técnica Feynman listas para repasar offline.',
        subject: 'Estudio Activo',
        metricLabel: 'Flashcards SRS · Sector 1',
      };
    }
    return {
      kind: 'streak',
      title: `Racha FABRO: ${pomodoroLogs.length} Pomodoros y ${moodLogs.length} registros de bienestar`,
      subtitle: profile.currentActivity || 'Constancia diaria equilibrando estudio y descanso.',
      metricLabel: 'Logro de Constancia · FABRO',
    };
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposerNotice(null);

    const pubRestriction = isActionRestricted('no_publicar');
    if (pubRestriction.blocked) {
      setComposerNotice(
        pubRestriction.reason ||
          'Tu cuenta tiene una restricción temporal para publicar. Podés revisar el motivo o apelar desde el aviso superior.'
      );
      return;
    }

    if (composerMode === 'historia') {
      if (!postText.trim() && pendingMedia.length === 0) {
        setComposerNotice('Escribí un estado o adjuntá una foto/video para tu Historia 24h.');
        return;
      }
      setPublishing(true);
      try {
        const style = STORY_GRADIENTS[storyStyleIdx] || STORY_GRADIENTS[0];
        let imageDataUrl: string | undefined;
        let videoMediaId: string | undefined;
        let videoPosterUrl: string | undefined;
        let mediaKind: 'text' | 'image' | 'video' = 'text';

        if (pendingMedia[0]) {
          const item = pendingMedia[0];
          if (item.kind === 'image') {
            const saved = await saveImageAttachmentToVault(item.file, {
              filter: item.filter,
              cropMode: item.crop,
              caption: item.caption,
            });
            imageDataUrl = saved.dataUrl;
            mediaKind = 'image';
          } else {
            const saved = await saveVideoAttachmentToVault(item.file, item.caption);
            videoMediaId = saved.mediaVaultId;
            videoPosterUrl = saved.posterDataUrl;
            mediaKind = 'video';
          }
        }

        addEphemeralStory({
          author: profile.displayName || 'Invitado FABRO',
          fabroId: profile.fabroId || 'FBR-INVITADO',
          authorAvatar: profile.photoURL,
          statusTag: style.tag,
          text: postText.trim() || style.tag,
          imageDataUrl,
          videoMediaId,
          videoPosterUrl,
          mediaKind,
          ringGradient: style.gradient,
        });

        pendingMedia.forEach((d) => URL.revokeObjectURL(d.previewUrl));
        setPendingMedia([]);
        setPostText('');
        setComposerNotice('Historia 24h publicada en la barra superior de Estados.');
        window.setTimeout(() => setComposerNotice(null), 3200);
      } catch (err) {
        setComposerNotice(
          err instanceof Error ? err.message : 'No pudimos procesar el archivo multimedia.'
        );
      } finally {
        setPublishing(false);
      }
      return;
    }

    if (composerMode === 'encuesta') {
      const cleanOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (!pollQuestion.trim() || cleanOpts.length < 2) {
        setComposerNotice('Escribí la pregunta y al menos 2 opciones para la encuesta.');
        return;
      }
      setPublishing(true);
      try {
        await addWallPost({
          author: profile.displayName || 'Invitado FABRO',
          authorAvatar: profile.photoURL,
          fabroId: profile.fabroId || 'FBR-INVITADO',
          origin: 'general',
          text: postText.trim() || pollQuestion.trim(),
          poll: {
            question: pollQuestion.trim(),
            votedOptionId: null,
            options: cleanOpts.slice(0, 4).map((label, idx) => ({
              id: `opt-${Date.now()}-${idx}`,
              label,
              votes: 0,
            })),
          },
        });
        setPostText('');
        setPollQuestion('');
        setPollOptions(['', '', '']);
        setComposerNotice('Encuesta publicada en el muro.');
        window.setTimeout(() => setComposerNotice(null), 2600);
      } finally {
        setPublishing(false);
      }
      return;
    }

    if (composerMode === 'recurso') {
      const sharedResource = buildSelectedResource();
      if (!sharedResource) {
        setComposerNotice('Elegí un apunte, mazo o logro disponible para compartir.');
        return;
      }
      setPublishing(true);
      try {
        await addWallPost({
          author: profile.displayName || 'Invitado FABRO',
          authorAvatar: profile.photoURL,
          fabroId: profile.fabroId || 'FBR-INVITADO',
          origin: 'general',
          text: postText.trim() || `Comparto este recurso desde mi ecosistema FABRO: ${sharedResource.title}`,
          sharedResource,
        });
        setPostText('');
        setComposerNotice('Logro / recurso publicado con tarjeta interactiva.');
        window.setTimeout(() => setComposerNotice(null), 2600);
      } finally {
        setPublishing(false);
      }
      return;
    }

    // Default: Publicación Multimedia (texto + fotos/video)
    if (!postText.trim() && pendingMedia.length === 0) {
      setComposerNotice('Escribí un mensaje o adjuntá fotos/video desde tu dispositivo.');
      return;
    }

    setPublishing(true);
    try {
      const savedMedia: SocialMediaAttachment[] = [];
      for (const draft of pendingMedia) {
        if (draft.kind === 'image') {
          const saved = await saveImageAttachmentToVault(draft.file, {
            filter: draft.filter,
            cropMode: draft.crop,
            caption: draft.caption,
          });
          savedMedia.push(saved);
        } else {
          const saved = await saveVideoAttachmentToVault(draft.file, draft.caption);
          savedMedia.push(saved);
        }
      }

      await addWallPost({
        author: profile.displayName || 'Invitado FABRO',
        authorAvatar: profile.photoURL,
        fabroId: profile.fabroId || 'FBR-INVITADO',
        origin: 'general',
        text: postText.trim(),
        media: savedMedia.length > 0 ? savedMedia : undefined,
      });

      pendingMedia.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      setPendingMedia([]);
      setPostText('');
      setComposerNotice(
        authUser && network.isOnline
          ? 'Publicación multimedia guardada en IndexedDB y sincronizada en el muro.'
          : 'Publicación guardada localmente en IndexedDB (Modo Invitado).'
      );
      window.setTimeout(() => setComposerNotice(null), 3000);
    } catch (err) {
      setComposerNotice(
        err instanceof Error ? err.message : 'Error procesando el archivo multimedia.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleSubmitComment = (postId: string) => {
    const commentRestriction = isActionRestricted('no_comentar');
    if (commentRestriction.blocked) {
      setComposerNotice(
        commentRestriction.reason ||
          'Tu cuenta tiene una restricción temporal para comentar. Revisá tu estado en el panel de apelaciones.'
      );
      return;
    }
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    const replyTarget = replyingTo[postId];
    addWallPostComment(postId, text, replyTarget?.id || null);
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    setReplyingTo((prev) => ({ ...prev, [postId]: null }));
  };

  const handleForwardToChat = (post: WallPostItem, targetId: string, targetLabel: string) => {
    const snippet = post.text ? post.text.slice(0, 140) : 'Publicación multimedia en FABRO';
    sendQuickChatMessage(`Compartido del Muro (${post.author}): «${snippet}»`, {
      recipientId: targetId,
    });
    setShareFeedback((prev) => ({ ...prev, [post.id]: `Reenviado a ${targetLabel}.` }));
    setShareMenuPostId(null);
    window.setTimeout(() => {
      setShareFeedback((prev) => {
        const copy = { ...prev };
        delete copy[post.id];
        return copy;
      });
    }, 2500);
  };

  const handleForwardToGroup = (post: WallPostItem, roomId: string, roomName: string) => {
    const snippet = post.text ? post.text.slice(0, 180) : 'Publicación multimedia compartida';
    addStudyRoomPost(roomId, `Del Muro (${post.author}): ${snippet}`, post.media?.[0]);
    setShareFeedback((prev) => ({ ...prev, [post.id]: `Enviado al grupo ${roomName}.` }));
    setShareMenuPostId(null);
    window.setTimeout(() => {
      setShareFeedback((prev) => {
        const copy = { ...prev };
        delete copy[post.id];
        return copy;
      });
    }, 2500);
  };

  const handleCopyPostLink = async (post: WallPostItem) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?sector=social&submenu=fabro-id#post-${post.id}`
        : '';
    try {
      await navigator.clipboard.writeText(`${post.author} en FABRO: ${post.text.slice(0, 140)} ${url}`);
      setShareFeedback((prev) => ({ ...prev, [post.id]: 'Enlace directo copiado.' }));
    } catch {
      setShareFeedback((prev) => ({ ...prev, [post.id]: 'Enlace listo para compartir.' }));
    }
    setShareMenuPostId(null);
    window.setTimeout(() => {
      setShareFeedback((prev) => {
        const copy = { ...prev };
        delete copy[post.id];
        return copy;
      });
    }, 2400);
  };

  const handleShareWhatsApp = (post: WallPostItem) => {
    const text = `Mirá esta publicación de ${post.author} en FABRO:\n«${post.text.slice(0, 240)}»`;
    const link = document.createElement('a');
    link.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
    setShareMenuPostId(null);
  };

  const isOwnPost = (post: WallPostItem) =>
    post.fabroId.toUpperCase() === (profile.fabroId || '').toUpperCase() ||
    post.author.toLowerCase() === (profile.displayName || '').toLowerCase();

  return (
    <div className="space-y-4">
      {/* FULL MULTIMEDIA COMPOSER */}
      <form
        onSubmit={handlePublish}
        className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3.5 text-xs shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => openSocialProfileModal('publicaciones')}
              className="shrink-0 cursor-pointer"
              title="Abrir Mi Perfil Social"
            >
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-xl object-cover border fabro-border"
                />
              ) : (
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white font-bold flex items-center justify-center">
                  {(profile.displayName || 'FA').slice(0, 2).toUpperCase()}
                </div>
              )}
            </button>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold truncate">
                Compartí en el Muro Social
              </p>
              <p className="text-[11px] fabro-muted truncate">
                {authUser && network.isOnline
                  ? `Publicando como ${profile.displayName} · Sincronizado`
                  : `Publicando como ${profile.displayName} · IndexedDB Offline-First`}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Composer Modes Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(
            [
              { id: 'multimedia', label: 'Foto / Video', icon: ImagePlus },
              { id: 'historia', label: 'Historia 24h', icon: Sparkles },
              { id: 'encuesta', label: 'Encuesta', icon: BarChart2 },
              { id: 'recurso', label: 'Recurso FABRO', icon: Award },
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const active = composerMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setComposerMode(mode.id);
                  setComposerNotice(null);
                }}
                className={`min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                  active
                    ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Textarea */}
        <textarea
          rows={2}
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder={
            composerMode === 'historia'
              ? 'Escribí el texto de tu Historia 24h (o acompañalo con foto/video)...'
              : composerMode === 'encuesta'
              ? 'Contexto opcional para tu encuesta...'
              : composerMode === 'recurso'
              ? 'Contá por qué recomendás este apunte, mazo o logro...'
              : '¿Qué querés compartir hoy? Subí fotos, un video corto o un avance de estudio...'
          }
          className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3 text-xs fabro-input"
        />

        {/* Story Style Selector */}
        {composerMode === 'historia' && (
          <div className="flex flex-wrap gap-1.5">
            {STORY_GRADIENTS.map((st, idx) => (
              <button
                key={st.tag}
                type="button"
                onClick={() => setStoryStyleIdx(idx)}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                  storyStyleIdx === idx
                    ? 'border-[#EC4899] bg-[#EC4899]/12 text-[#BE185D] dark:text-[#F472B6]'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ background: st.gradient }}
                />
                {st.tag}
              </button>
            ))}
          </div>
        )}

        {/* Poll Editor */}
        {composerMode === 'encuesta' && (
          <div className="rounded-xl border border-[#7C3AED]/30 fabro-surface-elevated p-3 space-y-2">
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Pregunta de la encuesta interactiva..."
              className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-3 py-1.5 font-semibold fabro-input"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) =>
                      setPollOptions((prev) =>
                        prev.map((item, i) => (i === idx ? e.target.value : item))
                      )
                    }
                    placeholder={`Opción ${idx + 1}`}
                    className="min-h-[38px] flex-1 rounded-xl border fabro-border fabro-surface px-3 py-1.5 fabro-input"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPollOptions((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Quitar opción"
                      className="min-h-[38px] min-w-[34px] rounded-lg border fabro-border flex items-center justify-center fabro-muted"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 4 && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="text-[11px] font-bold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
              >
                + Agregar opción (máx. 4)
              </button>
            )}
          </div>
        )}

        {/* Shared FABRO Resource Selector */}
        {composerMode === 'recurso' && (
          <div className="rounded-xl border border-[#2563EB]/35 fabro-surface-elevated p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'note', label: 'Apunte (Sector 1)', icon: BookOpen },
                  { id: 'flashcards', label: 'Mazo Flashcards SRS', icon: Layers },
                  { id: 'streak', label: 'Racha / Logro', icon: Award },
                ] as const
              ).map((rk) => {
                const Icon = rk.icon;
                return (
                  <button
                    key={rk.id}
                    type="button"
                    onClick={() => setResourceKind(rk.id)}
                    className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      resourceKind === rk.id
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : 'fabro-border fabro-surface fabro-muted'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {rk.label}
                  </button>
                );
              })}
            </div>

            {resourceKind === 'note' && advancedNotes.length > 0 && (
              <select
                value={selectedNoteId || advancedNotes[0].id}
                onChange={(e) => setSelectedNoteId(e.target.value)}
                className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-3 py-1.5 text-xs fabro-input"
              >
                {advancedNotes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title} ({n.subject})
                  </option>
                ))}
              </select>
            )}

            {buildSelectedResource() && (
              <div className="rounded-xl border border-[#2563EB]/30 bg-[#2563EB]/8 p-2.5 space-y-0.5">
                <p className="text-[10px] font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
                  Vista previa · {buildSelectedResource()?.metricLabel}
                </p>
                <p className="font-bold">{buildSelectedResource()?.title}</p>
                <p className="text-[11px] fabro-muted line-clamp-2">
                  {buildSelectedResource()?.subtitle}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pre-Publish Media Previews (Filters, Crop & Caption) */}
        {(composerMode === 'multimedia' || composerMode === 'historia') &&
          pendingMedia.length > 0 && (
            <div className="space-y-2.5">
              {pendingMedia.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2.5"
                >
                  <div className="relative overflow-hidden rounded-xl bg-slate-950">
                    {draft.kind === 'video' ? (
                      <video
                        src={draft.previewUrl}
                        controls
                        playsInline
                        className="max-h-64 w-full object-contain"
                      />
                    ) : (
                      <img
                        src={draft.previewUrl}
                        alt="Vista previa antes de publicar"
                        style={{
                          filter: PHOTO_FILTER_CSS[draft.filter],
                          aspectRatio:
                            draft.crop === 'square'
                              ? '1 / 1'
                              : draft.crop === 'wide'
                              ? '16 / 9'
                              : undefined,
                        }}
                        className="max-h-72 w-full object-cover transition-all"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeDraftMedia(draft.id)}
                      aria-label="Quitar archivo"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-slate-950/80 text-white flex items-center justify-center cursor-pointer hover:bg-rose-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Image Filters & Crop Controls */}
                  {draft.kind === 'image' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold fabro-muted mr-1">Filtro:</span>
                        {PHOTO_FILTER_LABELS.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => updateDraftMedia(draft.id, { filter: f.id })}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-medium cursor-pointer ${
                              draft.filter === f.id
                                ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                                : 'fabro-border fabro-surface fabro-muted'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold fabro-muted mr-1">Recorte:</span>
                        {PHOTO_CROP_LABELS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => updateDraftMedia(draft.id, { crop: c.id })}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-medium cursor-pointer ${
                              draft.crop === c.id
                                ? 'border-[#2563EB] bg-[#2563EB] text-white'
                                : 'fabro-border fabro-surface fabro-muted'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Caption Input */}
                  <input
                    type="text"
                    value={draft.caption}
                    onChange={(e) => updateDraftMedia(draft.id, { caption: e.target.value })}
                    placeholder="Agregar pie de foto o descripción opcional..."
                    className="min-h-[38px] w-full rounded-xl border fabro-border fabro-surface px-3 py-1.5 text-xs fabro-input"
                  />
                </div>
              ))}
            </div>
          )}

        {composerNotice && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {composerNotice}
          </p>
        )}

        {/* Composer Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {(composerMode === 'multimedia' || composerMode === 'historia') ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 font-semibold cursor-pointer hover:border-[#7C3AED]">
                <ImageIcon className="w-4 h-4 text-[#7C3AED]" />
                <span>Fotos / Video</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple={composerMode === 'multimedia'}
                  onChange={handleMediaPick}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] fabro-muted hidden sm:inline">
                Compresión Canvas + IndexedDB
              </span>
            </div>
          ) : (
            <span className="text-[11px] fabro-muted">
              {composerMode === 'encuesta'
                ? 'Votación en tiempo real para la comunidad'
                : 'Tarjeta interactiva vinculada a tu ecosistema'}
            </span>
          )}

          <button
            type="submit"
            disabled={publishing}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] px-4 py-1.5 font-bold text-white cursor-pointer active:scale-95 disabled:opacity-60"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {composerMode === 'historia'
                ? 'Publicar Historia 24h'
                : composerMode === 'encuesta'
                ? 'Publicar Encuesta'
                : composerMode === 'recurso'
                ? 'Compartir Recurso'
                : 'Publicar'}
            </span>
          </button>
        </div>
      </form>

      {/* UNIFIED WALL ORIGIN & CONTENT FILTER STRIP */}
      <div className="rounded-2xl border-2 fabro-border fabro-surface p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-bold">Muro General Unificado · Filtrar por origen o formato</span>
          <span className="fabro-muted">
            Converge #Estudio, #Bienestar, #Cultura, #Comunidad y #General
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {(
            [
              {
                id: 'todo',
                label: `Todos (${generalVisiblePosts.length})`,
                activeCls: 'border-[#7C3AED] bg-[#7C3AED] text-white',
              },
              {
                id: 'estudio',
                label: `#Estudio (${generalVisiblePosts.filter((p) => p.origin === 'estudio').length})`,
                activeCls: 'border-[#2563EB] bg-[#2563EB] text-white',
              },
              {
                id: 'bienestar',
                label: `#Bienestar (${generalVisiblePosts.filter((p) => p.origin === 'bienestar').length})`,
                activeCls: 'border-[#10B981] bg-[#10B981] text-white',
              },
              {
                id: 'cultura',
                label: `#Cultura (${generalVisiblePosts.filter((p) => isPostInCultureWall(p)).length})`,
                activeCls: 'border-[#9A3412] bg-[#9A3412] text-white',
              },
              {
                id: 'comunidad',
                label: `#Comunidad (${generalVisiblePosts.filter((p) => p.origin === 'comunidad').length})`,
                activeCls: 'border-[#4F46E5] bg-[#4F46E5] text-white',
              },
              {
                id: 'general',
                label: `#General (${generalVisiblePosts.filter((p) => !p.origin || p.origin === 'general').length})`,
                activeCls: 'border-[#7C3AED] bg-[#7C3AED] text-white',
              },
              {
                id: 'multimedia',
                label: `Videos y Fotos (${generalVisiblePosts.filter((p) => (p.media && p.media.length > 0) || p.videoEmbed).length})`,
                activeCls: 'border-[#EC4899] bg-[#EC4899] text-white',
              },
              {
                id: 'encuestas',
                label: `Encuestas (${generalVisiblePosts.filter((p) => p.poll).length})`,
                activeCls: 'border-[#7C3AED] bg-[#7C3AED] text-white',
              },
              {
                id: 'recursos',
                label: `Recursos (${generalVisiblePosts.filter((p) => p.sharedResource).length})`,
                activeCls: 'border-[#2563EB] bg-[#2563EB] text-white',
              },
              {
                id: 'guardados',
                label: `Guardados (${generalVisiblePosts.filter((p) => p.bookmarked).length})`,
                activeCls: 'border-[#F59E0B] bg-[#F59E0B] text-white',
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFeedFilter(tab.id)}
              className={`min-h-[38px] rounded-xl border-2 px-3 py-1 text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                feedFilter === tab.id
                  ? tab.activeCls
                  : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* WALL FEED CARDS */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border fabro-border fabro-surface p-8 text-center space-y-1.5">
          <p className="text-sm font-bold">No hay publicaciones en este filtro</p>
          <p className="text-xs fabro-muted">
            {feedFilter === 'guardados'
              ? 'Tocá el ícono de marcador en cualquier publicación para guardarla en tus favoritos.'
              : 'Sé el primero en publicar una foto, video, encuesta o logro arriba.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPosts.map((post) => {
            const totalPollVotes = post.poll
              ? post.poll.options.reduce((acc, opt) => acc + opt.votes, 0)
              : 0;
            const comments = post.comments || [];
            const rootComments = comments.filter((c) => !c.parentId);
            const repliesByParent = comments.reduce<Record<string, WallCommentItem[]>>(
              (acc, c) => {
                if (c.parentId) {
                  acc[c.parentId] = [...(acc[c.parentId] || []), c];
                }
                return acc;
              },
              {}
            );
            const activeReactionMeta = post.myReaction
              ? REACTIONS_META.find((r) => r.key === post.myReaction)
              : null;
            const reactionSummary = REACTIONS_META.filter(
              (r) => (post.reactions?.[r.key] || 0) > 0
            );
            const commentsOpen = Boolean(openCommentsPostIds[post.id]);

            return (
              <article
                key={post.id}
                id={`post-${post.id}`}
                className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs shadow-sm"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {post.authorAvatar ? (
                      <img
                        src={post.authorAvatar}
                        alt={post.author}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 rounded-xl object-cover border fabro-border shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#C4B5FD] font-bold flex items-center justify-center shrink-0">
                        {post.author.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold text-sm truncate">{post.author}</p>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                            isPostInCultureWall(post)
                              ? 'border-[#9A3412]/45 bg-[#9A3412]/12 text-[#9A3412] dark:text-amber-300'
                              : post.origin === 'estudio'
                              ? 'border-[#2563EB]/45 bg-[#2563EB]/12 text-[#1D4ED8] dark:text-[#93C5FD]'
                              : post.origin === 'bienestar'
                              ? 'border-[#10B981]/45 bg-[#10B981]/12 text-[#047857] dark:text-[#6EE7B7]'
                              : post.origin === 'comunidad'
                              ? 'border-[#4F46E5]/45 bg-[#4F46E5]/12 text-[#4338CA] dark:text-[#A5B4FC]'
                              : 'border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#DDD6FE]'
                          }`}
                        >
                          {isPostInCultureWall(post)
                            ? '#Cultura'
                            : post.origin === 'estudio'
                            ? '#Estudio'
                            : post.origin === 'bienestar'
                            ? '#Bienestar'
                            : post.origin === 'comunidad'
                            ? '#Comunidad'
                            : '#General'}
                        </span>
                        {post.communityName && (
                          <span className="rounded-md border fabro-border fabro-surface-elevated px-2 py-0.5 text-[10px] font-semibold">
                            {post.communityName}
                          </span>
                        )}
                        {post.categoryTag && !post.communityName && !isPostInCultureWall(post) && (
                          <span className="rounded-md border fabro-border fabro-surface-elevated px-2 py-0.5 text-[10px] font-semibold">
                            {post.categoryTag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] fabro-muted truncate">
                        {post.fabroId} · {post.createdAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleWallPostBookmark(post.id)}
                      title={post.bookmarked ? 'Quitar de guardados' : 'Guardar en favoritos'}
                      aria-label={post.bookmarked ? 'Quitar de guardados' : 'Guardar en favoritos'}
                      className={`min-h-[34px] min-w-[34px] rounded-xl border flex items-center justify-center cursor-pointer ${
                        post.bookmarked
                          ? 'border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                          : 'fabro-border fabro-surface-elevated fabro-muted'
                      }`}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${post.bookmarked ? 'fill-current' : ''}`}
                      />
                    </button>
                    {!isOwnPost(post) && (
                      <button
                        type="button"
                        onClick={() =>
                          openReportModal({
                            targetType: 'publicacion',
                            targetId: post.id,
                            targetAuthorUid: post.authorUid,
                            targetAuthorName: post.author,
                            targetSummary: (post.text || 'Publicación multimedia').slice(0, 200),
                            sector: isPostInCultureWall(post) ? 'cultura' : 'general',
                          })
                        }
                        title="Denunciar publicación"
                        aria-label="Denunciar publicación"
                        className="min-h-[34px] min-w-[34px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isOwnPost(post) && (
                      <button
                        type="button"
                        onClick={() => deleteWallPost(post.id)}
                        title="Eliminar publicación"
                        aria-label="Eliminar publicación"
                        className="min-h-[34px] min-w-[34px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Body Text */}
                {post.text && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>
                )}

                {/* Shared Videoteca Embedded Video Player */}
                {post.videoEmbed && (
                  <div className="rounded-xl border-2 fabro-border overflow-hidden bg-slate-950">
                    <div className="px-3 py-2 bg-slate-900/95 text-white flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold truncate inline-flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                        {post.videoEmbed.title}
                      </span>
                      <a
                        href={post.videoEmbed.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#93C5FD] hover:underline shrink-0"
                      >
                        {post.videoEmbed.provider}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative w-full aspect-video bg-black">
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
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Post Media Grid (Photos + Native Video Player) */}
                {post.media && post.media.length > 0 && (
                  <div
                    className={`grid gap-2 ${
                      post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                  >
                    {post.media.map((m, idx) => (
                      <ResolvedMediaDisplay
                        key={m.id}
                        item={m}
                        onOpenLightbox={() =>
                          setLightboxState({
                            items: post.media || [],
                            index: idx,
                            title: `Multimedia de ${post.author}`,
                          })
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Embedded Shared FABRO Resource Card */}
                {post.sharedResource && (
                  <div className="rounded-xl border border-[#2563EB]/35 bg-[#2563EB]/8 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#1D4ED8] dark:text-[#93C5FD]">
                        {post.sharedResource.metricLabel || 'Recurso FABRO'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(
                            post.sharedResource?.kind === 'streak' ? 'bienestar' : 'estudio',
                            post.sharedResource?.kind === 'flashcards'
                              ? 'mapas-flashcards'
                              : post.sharedResource?.kind === 'streak'
                              ? 'bienestar-emocional'
                              : 'materias-apuntes'
                          )
                        }
                        className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
                      >
                        Abrir módulo →
                      </button>
                    </div>
                    <p className="font-display text-sm font-bold">{post.sharedResource.title}</p>
                    <p className="fabro-muted leading-relaxed">{post.sharedResource.subtitle}</p>
                  </div>
                )}

                {/* Interactive Poll Card */}
                {post.poll && (
                  <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-2">
                    <p className="font-bold text-sm">{post.poll.question}</p>
                    <div className="space-y-1.5">
                      {post.poll.options.map((opt) => {
                        const pct =
                          totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                        const votedThis = post.poll?.votedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={Boolean(post.poll?.votedOptionId)}
                            onClick={() => voteOnWallPoll(post.id, opt.id)}
                            className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition-all ${
                              votedThis
                                ? 'border-[#7C3AED] bg-[#7C3AED]/10 font-bold'
                                : 'fabro-border fabro-surface hover:border-[#7C3AED]'
                            } ${post.poll?.votedOptionId ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            {post.poll?.votedOptionId && (
                              <span
                                className="absolute inset-y-0 left-0 bg-[#7C3AED]/15 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            )}
                            <span className="relative z-10 flex items-center justify-between gap-2">
                              <span>
                                {votedThis && <Check className="w-3.5 h-3.5 inline mr-1 text-[#7C3AED]" />}
                                {opt.label}
                              </span>
                              {post.poll?.votedOptionId && (
                                <span className="font-mono font-bold tabular-nums">{pct}%</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] fabro-muted tabular-nums">
                      {totalPollVotes} voto{totalPollVotes === 1 ? '' : 's'} totales
                    </p>
                  </div>
                )}

                {/* Reaction Summary Strip */}
                {(reactionSummary.length > 0 || comments.length > 0) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] fabro-muted">
                    <div className="flex flex-wrap items-center gap-2 tabular-nums">
                      {reactionSummary.map((rm) => (
                        <span key={rm.key} className="inline-flex items-center gap-0.5">
                          <span>{rm.emoji}</span>
                          <span className="font-semibold">{post.reactions?.[rm.key]}</span>
                        </span>
                      ))}
                      {reactionSummary.length === 0 && post.likes > 0 && (
                        <span>👍 {post.likes}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCommentsPostIds((prev) => ({
                          ...prev,
                          [post.id]: !prev[post.id],
                        }))
                      }
                      className="hover:underline cursor-pointer tabular-nums"
                    >
                      {comments.length} comentario{comments.length === 1 ? '' : 's'}
                    </button>
                  </div>
                )}

                {/* Action Bar: Multi-Reaction + Comment + Share/Forward */}
                <div className="relative flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t fabro-border">
                  {/* Multi-reaction Picker Popover */}
                  {reactionPickerPostId === post.id && (
                    <div className="absolute left-0 -top-12 z-20 flex items-center gap-1 rounded-2xl border fabro-border fabro-surface p-1.5 shadow-xl">
                      {REACTIONS_META.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => {
                            reactToWallPost(post.id, r.key);
                            setReactionPickerPostId(null);
                          }}
                          title={r.label}
                          className={`min-h-[34px] rounded-xl px-2 py-1 text-xs inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-110 ${
                            post.myReaction === r.key
                              ? 'bg-[#7C3AED]/15 font-bold'
                              : 'hover:bg-[var(--fabro-surface-2)]'
                          }`}
                        >
                          <span className="text-base leading-none">{r.emoji}</span>
                          <span className="hidden sm:inline text-[11px]">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => reactToWallPost(post.id, post.myReaction || 'like')}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 font-semibold cursor-pointer ${
                        activeReactionMeta
                          ? 'border-[#EC4899]/50 bg-[#EC4899]/12 text-[#BE185D] dark:text-[#F472B6]'
                          : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
                      }`}
                    >
                      {activeReactionMeta ? (
                        <span>{activeReactionMeta.emoji}</span>
                      ) : (
                        <Heart className="w-3.5 h-3.5" />
                      )}
                      <span>{activeReactionMeta ? activeReactionMeta.label : 'Me gusta'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setReactionPickerPostId((cur) => (cur === post.id ? null : post.id))
                      }
                      title="Más reacciones"
                      aria-label="Elegir reacción"
                      className="min-h-[36px] min-w-[34px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setOpenCommentsPostIds((prev) => ({
                        ...prev,
                        [post.id]: !prev[post.id],
                      }))
                    }
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 font-semibold fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Comentar</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setShareMenuPostId((cur) => (cur === post.id ? null : post.id))
                      }
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 font-semibold fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Compartir</span>
                    </button>

                    {shareMenuPostId === post.id && (
                      <div className="absolute right-0 bottom-11 z-30 w-64 rounded-2xl border fabro-border fabro-surface p-2.5 shadow-xl space-y-2 text-xs">
                        <p className="px-1.5 text-[11px] font-bold fabro-muted">
                          Reenviar a Chat FABRO
                        </p>
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => handleForwardToChat(post, 'general', 'Canal General')}
                            className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-[var(--fabro-surface-2)] flex items-center gap-1.5 cursor-pointer"
                          >
                            <Forward className="w-3.5 h-3.5 text-[#7C3AED]" />
                            Chat General FABRO
                          </button>
                          {friendsList.slice(0, 4).map((fr) => (
                            <button
                              key={fr.id}
                              type="button"
                              onClick={() => handleForwardToChat(post, fr.id, fr.displayName)}
                              className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-[var(--fabro-surface-2)] flex items-center gap-1.5 cursor-pointer truncate"
                            >
                              <Forward className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{fr.displayName}</span>
                            </button>
                          ))}
                        </div>

                        {studyRooms.length > 0 && (
                          <>
                            <p className="px-1.5 pt-1 border-t fabro-border text-[11px] font-bold fabro-muted">
                              Enviar a Grupo / Sala
                            </p>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {studyRooms.slice(0, 3).map((room) => (
                                <button
                                  key={room.id}
                                  type="button"
                                  onClick={() => handleForwardToGroup(post, room.id, room.name)}
                                  className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-[var(--fabro-surface-2)] truncate cursor-pointer"
                                >
                                  📌 {room.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        <div className="pt-1 border-t fabro-border flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleCopyPostLink(post)}
                            className="flex-1 rounded-lg border fabro-border fabro-surface-elevated py-1.5 font-semibold cursor-pointer"
                          >
                            Copiar enlace
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(post)}
                            className="flex-1 rounded-lg border border-emerald-500/50 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 py-1.5 font-semibold cursor-pointer"
                          >
                            WhatsApp
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {shareFeedback[post.id] && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {shareFeedback[post.id]}
                  </p>
                )}

                {/* NESTED COMMENTS SECTION */}
                {commentsOpen && (
                  <div className="pt-2 border-t fabro-border space-y-2.5">
                    {rootComments.length === 0 ? (
                      <p className="text-[11px] fabro-muted">
                        Todavía no hay comentarios. Iniciá la conversación abajo.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {rootComments.map((cmt) => {
                          const childReplies = repliesByParent[cmt.id] || [];
                          return (
                            <div key={cmt.id} className="space-y-1.5">
                              <div className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold">{cmt.author}</span>
                                  <span className="text-[10px] fabro-muted">{cmt.createdAt}</span>
                                </div>
                                <p className="mt-0.5 leading-relaxed">{cmt.text}</p>
                                <div className="mt-1 flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReplyingTo((prev) => ({
                                        ...prev,
                                        [post.id]: { id: cmt.id, author: cmt.author },
                                      }))
                                    }
                                    className="text-[11px] font-semibold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
                                  >
                                    Responder
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openReportModal({
                                        targetType: 'comentario',
                                        targetId: `${post.id}::${cmt.id}`,
                                        targetAuthorName: cmt.author,
                                        targetSummary: cmt.text.slice(0, 200),
                                        sector: isPostInCultureWall(post) ? 'cultura' : 'general',
                                      })
                                    }
                                    className="text-[11px] fabro-muted hover:text-rose-600 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Flag className="w-3 h-3" />
                                    Denunciar
                                  </button>
                                </div>
                              </div>

                              {childReplies.length > 0 && (
                                <div className="ml-5 pl-2.5 border-l-2 border-[#7C3AED]/35 space-y-1.5">
                                  {childReplies.map((rep) => (
                                    <div
                                      key={rep.id}
                                      className="rounded-xl border fabro-border fabro-surface px-3 py-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold">{rep.author}</span>
                                        <span className="text-[10px] fabro-muted">
                                          {rep.createdAt}
                                        </span>
                                      </div>
                                      <p className="mt-0.5 leading-relaxed">{rep.text}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reply Target Banner */}
                    {replyingTo[post.id] && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-[#7C3AED]/10 px-2.5 py-1 text-[11px]">
                        <span>
                          Respondiendo a <strong>{replyingTo[post.id]?.author}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setReplyingTo((prev) => ({ ...prev, [post.id]: null }))
                          }
                          className="cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Quick Emojis + Comment Input */}
                    <div className="flex items-center gap-1">
                      {QUICK_COMMENT_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [post.id]: `${prev[post.id] || ''}${em} `,
                            }))
                          }
                          className="h-7 w-7 rounded-lg border fabro-border fabro-surface-elevated text-sm flex items-center justify-center cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSubmitComment(post.id);
                          }
                        }}
                        placeholder={
                          replyingTo[post.id]
                            ? `Responder a ${replyingTo[post.id]?.author}...`
                            : 'Escribí un comentario o nota rápida...'
                        }
                        className="min-h-[38px] flex-1 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs fabro-input"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitComment(post.id)}
                        aria-label="Publicar comentario"
                        className="min-h-[38px] min-w-[38px] rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {lightboxState && (
        <MediaLightboxModal
          items={lightboxState.items}
          initialIndex={lightboxState.index}
          title={lightboxState.title}
          onClose={() => setLightboxState(null)}
        />
      )}
    </div>
  );
};
