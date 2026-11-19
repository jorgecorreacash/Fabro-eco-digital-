import React, { useMemo, useState } from 'react';
import {
  Check,
  Dumbbell,
  Film,
  Heart,
  MessageCircle,
  Send,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { isDirectHtml5VideoUrl } from '../../../services/videoEmbedUtils';
import type { WellnessWallCategory } from '../../../types/ecosystem';

const WELLNESS_WALL_CATEGORIES: WellnessWallCategory[] = [
  'Ejercicios',
  'Alimentación',
  'Hábitos y Descanso',
  'Videos',
];

export const WellnessWallPanel: React.FC = () => {
  const {
    profile,
    wallPosts,
    addWallPost,
    reactToWallPost,
    addWallPostComment,
    wellnessVideos,
    wellnessWorkoutPlans,
    wellnessDietPlans,
    navigateTo,
  } = useEcosystem();

  const [categoryFilter, setCategoryFilter] = useState<'Todos' | WellnessWallCategory>('Todos');
  const [composerCategory, setComposerCategory] = useState<WellnessWallCategory>('Ejercicios');
  const [postText, setPostText] = useState('');
  const [attachKind, setAttachKind] = useState<'none' | 'video' | 'workout' | 'diet'>('none');
  const [selectedVideoId, setSelectedVideoId] = useState<string>(wellnessVideos[0]?.id || '');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(
    wellnessWorkoutPlans[0]?.id || ''
  );
  const [selectedDietId, setSelectedDietId] = useState<string>(wellnessDietPlans[0]?.id || '');
  const [notice, setNotice] = useState<string | null>(null);

  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const wellnessPosts = useMemo(() => {
    const base = wallPosts.filter((p) => p.origin === 'bienestar');
    if (categoryFilter === 'Todos') return base;
    if (categoryFilter === 'Videos') {
      return base.filter((p) => Boolean(p.videoEmbed) || p.categoryTag === 'Videos');
    }
    return base.filter((p) => p.categoryTag === categoryFilter);
  }, [categoryFilter, wallPosts]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && attachKind === 'none') return;

    const vid =
      attachKind === 'video'
        ? wellnessVideos.find((v) => v.id === selectedVideoId) || wellnessVideos[0]
        : undefined;
    const workout =
      attachKind === 'workout'
        ? wellnessWorkoutPlans.find((w) => w.id === selectedWorkoutId) || wellnessWorkoutPlans[0]
        : undefined;
    const diet =
      attachKind === 'diet'
        ? wellnessDietPlans.find((d) => d.id === selectedDietId) || wellnessDietPlans[0]
        : undefined;

    await addWallPost({
      author: profile.displayName || 'Usuario FABRO',
      fabroId: profile.fabroId || 'FABRO',
      authorAvatar: profile.photoURL,
      text:
        postText.trim() ||
        (workout
          ? `Comparto mi rutina de entrenamiento: «${workout.title}» (${workout.durationLabel})`
          : diet
          ? `Comparto mi menú saludable: «${diet.title}»`
          : vid
          ? `Recomiendo este video de bienestar: «${vid.title}»`
          : 'Compartiendo progreso de bienestar en FABRO'),
      origin: 'bienestar',
      categoryTag: vid ? 'Videos' : composerCategory,
      videoEmbed: vid
        ? {
            title: vid.title,
            url: vid.url,
            embedUrl: vid.embedUrl,
            provider: vid.provider,
            categoryOrSubject: vid.categoryOrSubject,
          }
        : undefined,
      sharedResource: workout
        ? {
            kind: 'streak',
            refId: workout.id,
            title: workout.title,
            subtitle: `${workout.focusLabel} · ${workout.durationLabel} · ${workout.exercises.length} ejercicios`,
            metricLabel: 'Rutina de Entrenamiento · Sector 2',
          }
        : diet
        ? {
            kind: 'streak',
            refId: diet.id,
            title: diet.title,
            subtitle: diet.summary,
            metricLabel: 'Plan Nutricional · Sector 2',
          }
        : undefined,
    });

    setPostText('');
    setAttachKind('none');
    setNotice('Publicado en el Muro de Bienestar y reflejado en el Muro General (#Bienestar).');
    window.setTimeout(() => setNotice(null), 3200);
  };

  return (
    <div className="space-y-4">
      {/* Header + Composer */}
      <form
        onSubmit={handlePublish}
        className="rounded-2xl border-2 border-[#10B981]/40 fabro-surface p-4 sm:p-5 space-y-3.5 text-xs shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#10B981]" />
              Muro de Bienestar y Cuidado Personal
            </h2>
            <p className="text-[11px] fabro-muted mt-0.5">
              Compartí rutinas, recetas, hábitos de descanso, videos de entrenamiento y reflexiones de progreso (#Bienestar).
            </p>
          </div>
          <select
            value={composerCategory}
            onChange={(e) => setComposerCategory(e.target.value as WellnessWallCategory)}
            aria-label="Categoría de publicación de bienestar"
            className="min-h-[38px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1 text-xs font-bold fabro-input"
          >
            {WELLNESS_WALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={2}
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Contá tu entrenamiento de hoy, una receta rápida, un hábito que te dio energía o un consejo de autocuidado..."
          className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs fabro-input"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAttachKind(attachKind === 'video' ? 'none' : 'video')}
            className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold cursor-pointer ${
              attachKind === 'video'
                ? 'border-[#10B981] bg-[#10B981] text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Adjuntar Video
          </button>
          <button
            type="button"
            onClick={() => setAttachKind(attachKind === 'workout' ? 'none' : 'workout')}
            className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold cursor-pointer ${
              attachKind === 'workout'
                ? 'border-[#10B981] bg-[#10B981] text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            Adjuntar Rutina IA
          </button>
          <button
            type="button"
            onClick={() => setAttachKind(attachKind === 'diet' ? 'none' : 'diet')}
            className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold cursor-pointer ${
              attachKind === 'diet'
                ? 'border-[#F59E0B] bg-[#F59E0B] text-slate-950'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            Adjuntar Dieta IA
          </button>
          <button
            type="submit"
            className="ml-auto min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] hover:bg-[#059669] text-white px-4 py-1.5 font-bold cursor-pointer active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            Publicar
          </button>
        </div>

        {attachKind === 'video' && (
          <div className="rounded-xl border-2 border-[#10B981]/35 fabro-surface-elevated p-2.5">
            {wellnessVideos.length === 0 ? (
              <p className="fabro-muted">
                No tenés videos guardados todavía.{' '}
                <button
                  type="button"
                  onClick={() => navigateTo('bienestar', 'videoteca-bienestar')}
                  className="font-bold text-[#047857] dark:text-[#34D399] underline cursor-pointer"
                >
                  Ir a Videoteca de Bienestar →
                </button>
              </p>
            ) : (
              <select
                value={selectedVideoId || wellnessVideos[0]?.id}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold fabro-input"
              >
                {wellnessVideos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.categoryOrSubject})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {attachKind === 'workout' && (
          <div className="rounded-xl border-2 border-[#10B981]/35 fabro-surface-elevated p-2.5">
            {wellnessWorkoutPlans.length === 0 ? (
              <p className="fabro-muted">
                Generá y guardá una rutina en el Entrenador Personal IA para compartirla acá.
              </p>
            ) : (
              <select
                value={selectedWorkoutId || wellnessWorkoutPlans[0]?.id}
                onChange={(e) => setSelectedWorkoutId(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold fabro-input"
              >
                {wellnessWorkoutPlans.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title} ({w.durationLabel})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {attachKind === 'diet' && (
          <div className="rounded-xl border-2 border-[#F59E0B]/40 fabro-surface-elevated p-2.5">
            {wellnessDietPlans.length === 0 ? (
              <p className="fabro-muted">
                Guardá un menú en el Armador de Dietas IA para compartirlo con la comunidad.
              </p>
            ) : (
              <select
                value={selectedDietId || wellnessDietPlans[0]?.id}
                onChange={(e) => setSelectedDietId(e.target.value)}
                className="min-h-[38px] w-full rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold fabro-input"
              >
                {wellnessDietPlans.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {notice && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {notice}
          </p>
        )}
      </form>

      {/* Fast Category Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(['Todos', ...WELLNESS_WALL_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`min-h-[38px] rounded-xl border-2 px-3.5 py-1 text-xs font-bold shrink-0 cursor-pointer transition-colors ${
              categoryFilter === cat
                ? 'border-[#10B981] bg-[#10B981] text-white'
                : 'fabro-border fabro-surface fabro-muted hover:text-current'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Wellness Feed Cards */}
      {wellnessPosts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed fabro-border p-8 text-center space-y-1.5">
          <Heart className="w-7 h-7 mx-auto text-[#10B981] opacity-75" />
          <p className="text-sm font-bold">Muro de Bienestar listo para tu primer aporte</p>
          <p className="text-xs fabro-muted max-w-md mx-auto">
            Compartí una rutina de ejercicios, receta saludable, hábito de sueño o un video desde tu Videoteca de Bienestar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {wellnessPosts.map((post) => {
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
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-lg border border-[#10B981]/50 bg-[#10B981]/12 px-2 py-0.5 text-[10px] font-bold text-[#047857] dark:text-[#34D399]">
                      #Bienestar
                    </span>
                    {post.categoryTag && (
                      <span className="rounded-lg border fabro-border fabro-surface-elevated px-2 py-0.5 text-[10px] font-semibold">
                        {post.categoryTag}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>

                {post.videoEmbed && (
                  <div className="rounded-xl border-2 border-[#10B981]/40 overflow-hidden bg-black">
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
                      <span className="text-[#047857] dark:text-[#34D399] shrink-0">
                        {post.videoEmbed.categoryOrSubject}
                      </span>
                    </div>
                  </div>
                )}

                {post.sharedResource && (
                  <div className="rounded-xl border-2 border-[#10B981]/35 bg-[#10B981]/8 p-3 space-y-1">
                    <p className="text-[10px] font-bold text-[#047857] dark:text-[#34D399]">
                      {post.sharedResource.metricLabel || 'Plan de Bienestar'}
                    </p>
                    <p className="font-display text-sm font-bold">{post.sharedResource.title}</p>
                    <p className="fabro-muted">{post.sharedResource.subtitle}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t fabro-border">
                  <button
                    type="button"
                    onClick={() => reactToWallPost(post.id, 'strength')}
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1 font-bold cursor-pointer active:scale-95"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        post.myReaction ? 'text-rose-500 fill-current' : ''
                      }`}
                    />
                    Fuerza ({post.likes})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                    }
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1 font-bold cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Comentarios ({comments.length})
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
                        placeholder="Dejar un mensaje de apoyo o consulta..."
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
                        className="min-h-[38px] rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-3 py-1 font-bold cursor-pointer"
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
  );
};
