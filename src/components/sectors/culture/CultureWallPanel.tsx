import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  FileText,
  Film,
  Flag,
  Globe,
  Hash,
  ImagePlus,
  Layers,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  Share2,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import { CULTURE_DISCIPLINES, getDisciplineMeta } from '../../../data/cultureCatalog';
import {
  extractCultureDisciplineFromPost,
  extractHashtagsFromText,
  isPostInCultureWall,
  isPostSharedBothWalls,
} from '../../../services/cultureVault';
import {
  saveImageAttachmentToVault,
  saveVideoAttachmentToVault,
} from '../../../services/mediaVault';
import { parseVideoEmbedUrl } from '../../../services/videoEmbedUtils';
import type { CultureDisciplineId } from '../../../types/culture';
import type {
  SocialMediaAttachment,
  SocialReactionKey,
  WallPostItem,
} from '../../../types/ecosystem';
import { MediaLightboxModal, ResolvedMediaDisplay } from '../social/ResolvedMediaDisplay';

type PublishDestination = 'cultura' | 'general' | 'ambos';
type CultureFeedMode = 'todo' | 'fotos' | 'obras' | 'videos' | 'guardados';

interface PendingDraft {
  id: string;
  file: File;
  kind: 'image' | 'video';
  previewUrl: string;
}

const REACTIONS: Array<{ key: SocialReactionKey; emoji: string; label: string }> = [
  { key: 'like', emoji: '👍', label: 'Me gusta' },
  { key: 'love', emoji: '❤️', label: 'Me encanta' },
  { key: 'insightful', emoji: '💡', label: 'Aporte' },
  { key: 'strength', emoji: '👏', label: 'Bravo' },
  { key: 'inspiring', emoji: '✨', label: 'Inspirador' },
];

interface CultureWallPanelProps {
  defaultDiscipline?: CultureDisciplineId;
  onSelectDiscipline?: (id: CultureDisciplineId) => void;
}

export const CultureWallPanel: React.FC<CultureWallPanelProps> = ({
  defaultDiscipline = 'artes-visuales',
  onSelectDiscipline,
}) => {
  const {
    profile,
    authUser,
    wallPosts,
    addWallPost,
    deleteWallPost,
    reactToWallPost,
    addWallPostComment,
    toggleWallPostBookmark,
    toggleFollowProfile,
    sendQuickChatMessage,
  } = useEcosystem();
  const { isActionRestricted, openReportModal } = useAdmin();

  const [destination, setDestination] = useState<PublishDestination>('ambos');
  const [discipline, setDiscipline] = useState<CultureDisciplineId>(defaultDiscipline);
  const [postKindLabel, setPostKindLabel] = useState<'Texto' | 'Obra' | 'Proyecto' | 'Álbum'>('Obra');
  const [text, setText] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingDraft[]>([]);
  const [pendingFile, setPendingFile] = useState<{
    name: string;
    mimeType: string;
    sizeLabel: string;
    dataUrl?: string;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [filterDiscipline, setFilterDiscipline] = useState<string>('todas');
  const [filterMode, setFilterMode] = useState<CultureFeedMode>('todo');
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Post interactions
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<
    Record<string, { id: string; author: string } | null>
  >({});
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{
    items: SocialMediaAttachment[];
    index: number;
    title: string;
  } | null>(null);

  const culturePosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wallPosts.filter((p) => {
      if (!isPostInCultureWall(p)) return false;
      if (p.moderationStatus === 'oculta' || p.moderationStatus === 'eliminada') return false;
      const postDisc = extractCultureDisciplineFromPost(p);
      if (filterDiscipline !== 'todas' && postDisc !== filterDiscipline) return false;
      if (filterMode === 'fotos' && (!p.media || p.media.length === 0)) return false;
      if (filterMode === 'videos' && !p.videoEmbed && !p.media?.some((m) => m.kind === 'video')) {
        return false;
      }
      if (filterMode === 'obras' && !p.fileAttachment && !p.sharedResource && !p.media?.length) {
        return false;
      }
      if (filterMode === 'guardados' && !p.bookmarked) return false;
      if (activeHashtag) {
        const tags = [...(p.hashtags || []), ...extractHashtagsFromText(p.text)];
        if (!tags.includes(activeHashtag.toLowerCase())) return false;
      }
      if (q) {
        const haystack = `${p.author} ${p.text} ${p.communityName || ''} ${(p.hashtags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [activeHashtag, filterDiscipline, filterMode, searchQuery, wallPosts]);

  const popularHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    wallPosts.filter(isPostInCultureWall).forEach((p) => {
      const tags = [...(p.hashtags || []), ...extractHashtagsFromText(p.text)];
      tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [wallPosts]);

  const handleMediaPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const drafts: PendingDraft[] = [];
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        if (file.size > 60 * 1024 * 1024) {
          setNotice('El video supera los 60 MB del almacenamiento local. Podés pegar un enlace externo gratuito.');
          continue;
        }
        drafts.push({
          id: `cd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          file,
          kind: 'video',
          previewUrl: URL.createObjectURL(file),
        });
        break;
      }
      if (file.type.startsWith('image/')) {
        drafts.push({
          id: `cd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          file,
          kind: 'image',
          previewUrl: URL.createObjectURL(file),
        });
      }
    }
    setPendingMedia((prev) => {
      if (drafts.some((d) => d.kind === 'video')) {
        prev.forEach((d) => URL.revokeObjectURL(d.previewUrl));
        return drafts.slice(0, 1);
      }
      return [...prev.filter((d) => d.kind === 'image'), ...drafts].slice(0, 4);
    });
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice('El archivo supera 2 MB en modo local. Comprimilo o compartí un enlace externo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const kb = Math.max(1, Math.round(file.size / 1024));
      setPendingFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeLabel: kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`,
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const pubCheck = isActionRestricted('no_publicar');
    const cultCheck = isActionRestricted('no_cultura');
    if (pubCheck.blocked || cultCheck.blocked) {
      setNotice(
        pubCheck.reason ||
          cultCheck.reason ||
          'Tu cuenta tiene una restricción temporal para publicar en FABRO Cultura. Podés revisar tu estado o apelar en el aviso superior.'
      );
      return;
    }
    const cleanText = text.trim();
    if (!cleanText && pendingMedia.length === 0 && !externalVideoUrl.trim() && !pendingFile) {
      setNotice('Escribí un texto o adjuntá una fotografía, video o archivo cultural para publicar.');
      return;
    }

    setPublishing(true);
    setNotice(null);

    try {
      const savedMedia: SocialMediaAttachment[] = [];
      for (const draft of pendingMedia) {
        if (draft.kind === 'image') {
          const item = await saveImageAttachmentToVault(draft.file, {
            caption: postKindLabel,
          });
          savedMedia.push(item);
        } else {
          const item = await saveVideoAttachmentToVault(draft.file, postKindLabel);
          savedMedia.push(item);
        }
      }

      const discMeta = getDisciplineMeta(discipline);
      const rawTags = hashtagsInput
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`));
      const combinedText = [cleanText, rawTags.filter((t) => !cleanText.toLowerCase().includes(t)).join(' ')]
        .filter(Boolean)
        .join('\n');
      const allTags = Array.from(new Set([...rawTags, ...extractHashtagsFromText(combinedText)]));

      const parsedVideo = externalVideoUrl.trim()
        ? parseVideoEmbedUrl(externalVideoUrl.trim())
        : null;

      const spaces: Array<'general' | 'cultura'> =
        destination === 'cultura'
          ? ['cultura']
          : destination === 'general'
          ? ['general']
          : ['cultura', 'general'];

      const authorName =
        profile.culturalProfile?.artisticName?.trim() ||
        authUser?.displayName ||
        profile.displayName ||
        'Invitado FABRO';

      // Single-ID publication using FABRO's existing social system
      addWallPost({
        author: authorName,
        fabroId: authUser?.fabroId || profile.fabroId || 'FBR-INVITADO',
        authorAvatar: profile.photoURL || authUser?.photoURL,
        text: combinedText || `${postKindLabel} en ${discMeta?.label || 'FABRO Cultura'}`,
        origin: destination === 'cultura' ? 'comunidad' : 'general',
        communityId:
          destination === 'cultura'
            ? 'cultura-only'
            : destination === 'ambos'
            ? 'cultura-both'
            : undefined,
        communityName:
          destination === 'general'
            ? undefined
            : `FABRO Cultura · ${discMeta?.label || 'Cultura'} · ${postKindLabel}`,
        categoryTag: destination === 'general' ? undefined : `cultura:${discipline}`,
        spaces,
        cultureDiscipline: destination === 'general' ? undefined : discipline,
        hashtags: allTags,
        media: savedMedia.length > 0 ? savedMedia : undefined,
        fileAttachment: pendingFile || undefined,
        videoEmbed: parsedVideo
          ? {
              title: `${postKindLabel} · ${discMeta?.label || 'Cultura'}`,
              url: externalVideoUrl.trim(),
              embedUrl: parsedVideo.embedUrl,
              provider: parsedVideo.provider,
              categoryOrSubject: discMeta?.label || 'FABRO Cultura',
            }
          : undefined,
      });

      pendingMedia.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      setPendingMedia([]);
      setPendingFile(null);
      setText('');
      setHashtagsInput('');
      setExternalVideoUrl('');
      setNotice(
        destination === 'ambos'
          ? 'Publicado con un único identificador sincronizado en FABRO Cultura y en el Muro General.'
          : destination === 'cultura'
          ? 'Publicado exclusivamente en el Muro Cultural de FABRO.'
          : 'Publicado en el Muro General de FABRO.'
      );
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'No pudimos procesar el adjunto. Intentá de nuevo.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleSharePost = (post: WallPostItem) => {
    const discMeta = getDisciplineMeta(extractCultureDisciplineFromPost(post) || '');
    sendQuickChatMessage(
      `Compartió desde FABRO Cultura (${discMeta?.label || 'Cultura'}): "${post.text.slice(0, 120)}" — por ${post.author}`
    );
    setShareFeedback((prev) => ({
      ...prev,
      [post.id]: 'Compartido en tu chat de FABRO',
    }));
    window.setTimeout(() => {
      setShareFeedback((prev) => {
        const copy = { ...prev };
        delete copy[post.id];
        return copy;
      });
    }, 2400);
  };

  const isMyPost = (post: WallPostItem) =>
    post.fabroId === (authUser?.fabroId || profile.fabroId) ||
    post.author === (authUser?.displayName || profile.displayName);

  return (
    <div className="space-y-6">
      {/* Cultural Wall Composer */}
      <form
        onSubmit={handlePublish}
        className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b fabro-border">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">
              Publicar en el Muro Cultural
            </h2>
            <p className="text-xs fabro-muted">
              Conectado con el sistema social de FABRO: un solo identificador mantiene comentarios, reacciones y borrado sincronizados.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl border fabro-border fabro-surface-elevated self-start">
            {(['Texto', 'Obra', 'Proyecto', 'Álbum'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setPostKindLabel(kind)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                  postKindLabel === kind
                    ? 'bg-[#9A3412] text-white'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>

        {/* Discipline + Destination Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">
            <span className="font-semibold fabro-muted">Disciplina cultural</span>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value as CultureDisciplineId)}
              className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
            >
              {CULTURE_DISCIPLINES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1 text-xs">
            <span className="font-semibold fabro-muted">Dónde mostrar esta publicación</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'cultura', label: 'Solo Cultura' },
                  { id: 'general', label: 'Solo General' },
                  { id: 'ambos', label: 'Ambos muros' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDestination(opt.id)}
                  className={`min-h-[42px] rounded-xl border px-2 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    destination === opt.id
                      ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                      : 'fabro-border fabro-surface-elevated fabro-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Compartí una obra, proceso creativo, partitura, poema, fotografía, proyecto o convocatoria..."
          className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5 text-sm fabro-input resize-y"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="relative">
            <Hash className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={hashtagsInput}
              onChange={(e) => setHashtagsInput(e.target.value)}
              placeholder="Hashtags (ej: acuarela, poesia, cineindie)"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated pl-8 pr-3 text-xs fabro-input"
            />
          </div>
          <div className="relative">
            <Film className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={externalVideoUrl}
              onChange={(e) => setExternalVideoUrl(e.target.value)}
              placeholder="Enlace opcional de YouTube o Vimeo"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated pl-8 pr-3 text-xs fabro-input"
            />
          </div>
        </div>

        {/* Media Previews */}
        {pendingMedia.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {pendingMedia.map((draft) => (
              <div
                key={draft.id}
                className="relative rounded-xl overflow-hidden border fabro-border aspect-square bg-black/5"
              >
                {draft.kind === 'image' ? (
                  <img
                    src={draft.previewUrl}
                    alt="Vista previa"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <video
                    src={draft.previewUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(draft.previewUrl);
                    setPendingMedia((prev) => prev.filter((item) => item.id !== draft.id));
                  }}
                  aria-label="Quitar archivo"
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingFile && (
          <div className="flex items-center justify-between gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-2 truncate">
              <FileText className="w-4 h-4 text-[#9A3412] shrink-0" />
              <span className="font-semibold truncate">{pendingFile.name}</span>
              <span className="fabro-muted">· {pendingFile.sizeLabel} (local)</span>
            </span>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              className="p-1 fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {notice && (
          <p className="text-xs font-medium text-[#9A3412] dark:text-[#FDBA74]">{notice}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border">
          <div className="flex flex-wrap items-center gap-2">
            <label className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-medium cursor-pointer hover:border-[#9A3412]">
              <ImagePlus className="w-4 h-4 text-[#9A3412]" />
              <span>Fotos / Video</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaPick}
                className="hidden"
              />
            </label>
            <label className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-medium cursor-pointer hover:border-[#9A3412]">
              <Paperclip className="w-4 h-4 text-[#1E3A8A] dark:text-[#93C5FD]" />
              <span>Adjuntar archivo</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.srt,.json,.svg,.csv,.doc,.docx"
                onChange={handleFileAttach}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={publishing}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#9A3412] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-60"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {destination === 'ambos'
                ? 'Publicar en Cultura y General'
                : destination === 'cultura'
                ? 'Publicar en Cultura'
                : 'Publicar en Muro General'}
            </span>
          </button>
        </div>
      </form>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border fabro-border fabro-surface p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar publicaciones culturales, autores o #hashtags..."
            className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
          />
          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
            aria-label="Filtrar por disciplina"
            className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input md:w-56"
          >
            <option value="todas">Todas las disciplinas</option>
            {CULTURE_DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl border fabro-border fabro-surface-elevated">
            {(
              [
                { id: 'todo', label: 'Todo' },
                { id: 'fotos', label: 'Fotos / Álbumes' },
                { id: 'obras', label: 'Obras y archivos' },
                { id: 'videos', label: 'Videos' },
                { id: 'guardados', label: 'Favoritos' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                  filterMode === tab.id
                    ? 'bg-[#1E3A8A] text-white'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {popularHashtags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {popularHashtags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveHashtag((prev) => (prev === tag ? null : tag))}
                  className={`cursor-pointer hover:underline ${
                    activeHashtag === tag
                      ? 'font-bold text-[#9A3412] dark:text-[#FDBA74] underline'
                      : 'fabro-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cultural Feed */}
      {culturePosts.length === 0 ? (
        <div className="rounded-2xl border fabro-border fabro-surface p-8 text-center space-y-2">
          <Layers className="w-8 h-8 mx-auto fabro-muted" />
          <p className="text-sm font-semibold">Todavía no hay publicaciones con este filtro</p>
          <p className="text-xs fabro-muted max-w-md mx-auto">
            Publicá tu primera obra, texto, fotografía o proyecto cultural arriba. Podés elegir si aparece solo en Cultura o sincronizado con el Muro General.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {culturePosts.map((post) => {
            const discId = extractCultureDisciplineFromPost(post);
            const discMeta = discId ? getDisciplineMeta(discId) : undefined;
            const sharedBoth = isPostSharedBothWalls(post);
            const following = (profile.followingIds || []).includes(post.fabroId);
            const postTags = Array.from(
              new Set([...(post.hashtags || []), ...extractHashtagsFromText(post.text)])
            );
            const comments = post.comments || [];
            const topComments = comments.filter((c) => !c.parentId);
            const repliesByParent = comments.reduce<Record<string, typeof comments>>((acc, c) => {
              if (c.parentId) {
                acc[c.parentId] = [...(acc[c.parentId] || []), c];
              }
              return acc;
            }, {});

            return (
              <article
                key={post.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-3.5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {post.authorAvatar ? (
                      <img
                        src={post.authorAvatar}
                        alt={post.author}
                        className="w-10 h-10 rounded-xl object-cover border fabro-border shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#9A3412]/15 text-[#9A3412] dark:text-[#FDBA74] font-bold text-xs flex items-center justify-center shrink-0">
                        {post.author.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{post.author}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs fabro-muted">
                        <span>{post.createdAt}</span>
                        {discMeta && (
                          <>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() => onSelectDiscipline?.(discMeta.id)}
                              className="font-semibold text-[#9A3412] dark:text-[#FDBA74] hover:underline cursor-pointer"
                            >
                              {discMeta.label}
                            </button>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {sharedBoth ? 'Sincronizado en Cultura y General' : 'Solo Muro Cultural'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isMyPost(post) && (
                      <button
                        type="button"
                        onClick={() => toggleFollowProfile(post.fabroId)}
                        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold cursor-pointer ${
                          following
                            ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                            : 'fabro-border fabro-surface-elevated'
                        }`}
                      >
                        {following ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Siguiendo</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Seguir</span>
                          </>
                        )}
                      </button>
                    )}
                    {!isMyPost(post) && (
                      <button
                        type="button"
                        onClick={() =>
                          openReportModal({
                            targetType: 'contenido_cultural',
                            targetId: post.id,
                            targetAuthorUid: post.authorUid,
                            targetAuthorName: post.author,
                            targetSummary: (post.text || 'Publicación cultural').slice(0, 200),
                            sector: 'cultura',
                          })
                        }
                        title="Denunciar contenido cultural"
                        aria-label="Denunciar contenido cultural"
                        className="w-9 h-9 rounded-xl border fabro-border flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isMyPost(post) && (
                      <button
                        type="button"
                        onClick={() => deleteWallPost(post.id)}
                        title="Eliminar de todos los muros"
                        aria-label="Eliminar publicación"
                        className="w-9 h-9 rounded-xl border fabro-border flex items-center justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Body */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>

                {postTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {postTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setActiveHashtag((prev) => (prev === tag ? null : tag))}
                        className="text-[#1E3A8A] dark:text-[#93C5FD] font-medium hover:underline cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Media Grid */}
                {post.media && post.media.length > 0 && (
                  <div
                    className={`grid gap-2 ${
                      post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                  >
                    {post.media.map((item, idx) => (
                      <ResolvedMediaDisplay
                        key={item.id}
                        item={item}
                        className={post.media!.length === 1 ? 'max-h-[420px]' : 'aspect-square'}
                        onOpenLightbox={() =>
                          setLightbox({
                            items: post.media!,
                            index: idx,
                            title: `Obra de ${post.author}`,
                          })
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Embedded Video */}
                {post.videoEmbed && (
                  <div className="rounded-xl overflow-hidden border fabro-border aspect-video bg-black">
                    <iframe
                      src={post.videoEmbed.embedUrl}
                      title={post.videoEmbed.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* File Attachment */}
                {post.fileAttachment && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#9A3412] shrink-0" />
                      <span className="font-semibold truncate">{post.fileAttachment.name}</span>
                      <span className="fabro-muted shrink-0">· {post.fileAttachment.sizeLabel}</span>
                    </span>
                    {post.fileAttachment.dataUrl && (
                      <a
                        href={post.fileAttachment.dataUrl}
                        download={post.fileAttachment.name}
                        className="font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline shrink-0"
                      >
                        Descargar
                      </a>
                    )}
                  </div>
                )}

                {/* Action Bar */}
                <div className="pt-2.5 border-t fabro-border flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 relative">
                    <button
                      type="button"
                      onClick={() =>
                        setReactionPickerId((prev) => (prev === post.id ? null : post.id))
                      }
                      className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 font-semibold cursor-pointer ${
                        post.myReaction
                          ? 'border-[#9A3412] bg-[#9A3412]/10 text-[#9A3412] dark:text-[#FDBA74]'
                          : 'fabro-border fabro-surface-elevated'
                      }`}
                    >
                      <span>
                        {REACTIONS.find((r) => r.key === post.myReaction)?.emoji || '👍'}
                      </span>
                      <span className="tabular-nums">{post.likes}</span>
                    </button>

                    {reactionPickerId === post.id && (
                      <div className="absolute left-0 bottom-11 z-20 flex items-center gap-1 rounded-xl border fabro-border fabro-surface shadow-lg p-1.5">
                        {REACTIONS.map((r) => (
                          <button
                            key={r.key}
                            type="button"
                            title={r.label}
                            onClick={() => {
                              reactToWallPost(post.id, r.key);
                              setReactionPickerId(null);
                            }}
                            className="w-9 h-9 rounded-lg hover:bg-[var(--fabro-surface-2)] flex items-center justify-center text-base cursor-pointer"
                          >
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setOpenComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                      }
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 font-medium cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{comments.length} comentarios</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSharePost(post)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 font-medium cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Compartir</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleWallPostBookmark(post.id)}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 font-medium cursor-pointer ${
                      post.bookmarked
                        ? 'border-amber-600/50 bg-amber-500/12 text-amber-700 dark:text-amber-300'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{post.bookmarked ? 'Guardado' : 'Guardar'}</span>
                  </button>
                </div>

                {shareFeedback[post.id] && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {shareFeedback[post.id]}
                  </p>
                )}

                {/* Synchronized Comments & Replies */}
                {openComments[post.id] && (
                  <div className="pt-3 border-t fabro-border space-y-3">
                    {topComments.length === 0 ? (
                      <p className="text-xs fabro-muted">Sé el primero en comentar esta publicación.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {topComments.map((cmt) => (
                          <div key={cmt.id} className="space-y-1.5">
                            <div className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold">{cmt.author}</span>
                                <span className="fabro-muted text-[11px]">{cmt.createdAt}</span>
                              </div>
                              <p className="mt-1 leading-relaxed">{cmt.text}</p>
                              <div className="mt-1 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReplyTarget((prev) => ({
                                      ...prev,
                                      [post.id]: { id: cmt.id, author: cmt.author },
                                    }))
                                  }
                                  className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline cursor-pointer"
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
                                      sector: 'cultura',
                                    })
                                  }
                                  className="text-[11px] fabro-muted hover:text-rose-600 cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Flag className="w-3 h-3" />
                                  Denunciar
                                </button>
                              </div>
                            </div>
                            {(repliesByParent[cmt.id] || []).map((rep) => (
                              <div
                                key={rep.id}
                                className="ml-6 rounded-xl border fabro-border fabro-surface px-3 py-2 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold">{rep.author}</span>
                                  <span className="fabro-muted text-[11px]">{rep.createdAt}</span>
                                </div>
                                <p className="mt-1 leading-relaxed">{rep.text}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const cmtCheck = isActionRestricted('no_comentar');
                        const cultCheck = isActionRestricted('no_cultura');
                        if (cmtCheck.blocked || cultCheck.blocked) {
                          setNotice(
                            cmtCheck.reason ||
                              cultCheck.reason ||
                              'Tu cuenta tiene una restricción temporal para comentar en FABRO Cultura.'
                          );
                          return;
                        }
                        const draft = (commentDrafts[post.id] || '').trim();
                        if (!draft) return;
                        addWallPostComment(post.id, draft, replyTarget[post.id]?.id || null);
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                        setReplyTarget((prev) => ({ ...prev, [post.id]: null }));
                      }}
                      className="space-y-1.5"
                    >
                      {replyTarget[post.id] && (
                        <div className="flex items-center justify-between text-[11px] fabro-muted px-1">
                          <span>Respondiendo a {replyTarget[post.id]!.author}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setReplyTarget((prev) => ({ ...prev, [post.id]: null }))
                            }
                            className="hover:underline cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentDrafts[post.id] || ''}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder="Escribí un comentario..."
                          className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
                        />
                        <button
                          type="submit"
                          className="min-h-[40px] rounded-xl bg-[#1E3A8A] text-white px-3.5 text-xs font-semibold cursor-pointer"
                        >
                          Enviar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {lightbox && (
        <MediaLightboxModal
          items={lightbox.items}
          initialIndex={lightbox.index}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};
