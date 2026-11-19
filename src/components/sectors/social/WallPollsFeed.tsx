import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Cloud, Heart, Lock, Plus, Send } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  publishPublicPost,
  subscribeToPublicPosts,
  updatePublicPostLikes,
  updatePublicPostPoll,
} from '../../../services/cloudSyncService';
import { DEFAULT_WALL_POSTS, vaultGet, vaultSet } from '../../../services/localVault';
import type { WallPostItem } from '../../../types/ecosystem';

export const WallPollsFeed: React.FC = () => {
  const { profile, authUser, openAuthModal, network } = useEcosystem();
  const [posts, setPosts] = useState<WallPostItem[]>(DEFAULT_WALL_POSTS);
  const [cloudPosts, setCloudPosts] = useState<WallPostItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [postText, setPostText] = useState('');
  const [withPoll, setWithPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptsRaw, setPollOptsRaw] = useState('Opción A, Opción B');

  useEffect(() => {
    let active = true;
    void vaultGet<WallPostItem[]>('wall_posts', DEFAULT_WALL_POSTS).then((stored) => {
      if (!active) return;
      setPosts(stored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void vaultSet('wall_posts', posts);
  }, [posts, hydrated]);

  // Zero Firestore calls in Guest Mode: only subscribe when authenticated and online
  useEffect(() => {
    if (!authUser || !network.isOnline) {
      setCloudPosts([]);
      return;
    }
    const unsub = subscribeToPublicPosts(
      (incomingPosts) => {
        setCloudPosts(incomingPosts);
      },
      () => {
        // Silently keep local fallback if Firestore rules/network reject
      }
    );
    return () => unsub();
  }, [authUser, network.isOnline]);

  const mergedPosts = useMemo(() => {
    if (cloudPosts.length === 0) return posts;
    const seen = new Set(cloudPosts.map((p) => p.id));
    const localOnly = posts.filter((p) => !seen.has(p.id));
    return [...cloudPosts, ...localOnly];
  }, [cloudPosts, posts]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && !withPoll) return;
    if (!authUser) {
      openAuthModal(
        'publicar en el muro público y compartir tus ideas con la comunidad',
        'register'
      );
      return;
    }

    let poll: WallPostItem['poll'] | undefined;
    if (withPoll) {
      const options = pollOptsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      if (options.length >= 2) {
        poll = {
          question: pollQuestion.trim() || postText.trim() || 'Encuesta rápida',
          votedOptionId: null,
          options: options.map((label, idx) => ({
            id: `opt-${Date.now()}-${idx}`,
            label,
            votes: 0,
          })),
        };
      }
    }

    const newPost: WallPostItem = {
      id: `post-${Date.now()}`,
      author: authUser.displayName || profile.displayName,
      fabroId: authUser.username ? `@${authUser.username}` : profile.fabroId,
      text: postText.trim() || poll?.question || 'Nuevo debate en el muro',
      likes: 0,
      createdAt: 'Recién',
      poll,
    };

    setPublishing(true);
    setPosts((prev) => [newPost, ...prev]);
    setPostText('');
    setPollQuestion('');
    setWithPoll(false);

    if (network.isOnline) {
      try {
        await publishPublicPost(authUser.uid, newPost);
      } catch {
        // Local optimistic copy remains saved
      }
    }
    setPublishing(false);
  };

  const voteOnPoll = (postId: string, optionId: string) => {
    let updatedPoll: WallPostItem['poll'] | undefined;
    const applyVote = (list: WallPostItem[]) =>
      list.map((post) => {
        if (post.id !== postId || !post.poll) return post;
        const prevVote = post.poll.votedOptionId;
        if (prevVote === optionId) return post;
        const nextPoll = {
          ...post.poll,
          votedOptionId: optionId,
          options: post.poll.options.map((opt) => {
            if (opt.id === optionId) return { ...opt, votes: opt.votes + 1 };
            if (opt.id === prevVote) return { ...opt, votes: Math.max(0, opt.votes - 1) };
            return opt;
          }),
        };
        updatedPoll = nextPoll;
        return { ...post, poll: nextPoll };
      });

    setPosts((prev) => applyVote(prev));
    setCloudPosts((prev) => applyVote(prev));

    if (authUser && network.isOnline && updatedPoll && !postId.startsWith('seed-')) {
      void updatePublicPostPoll(postId, updatedPoll).catch(() => {});
    }
  };

  const handleLikePost = (post: WallPostItem) => {
    const nextLikes = post.likes + 1;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, likes: nextLikes } : p))
    );
    setCloudPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, likes: nextLikes } : p))
    );
    if (authUser && network.isOnline && !post.id.startsWith('seed-')) {
      void updatePublicPostLikes(post.id, nextLikes).catch(() => {});
    }
  };

  return (
    <div className="rounded-2xl border-2 border-[#7C3AED]/30 fabro-surface p-5 space-y-4 shadow-[0_8px_24px_-12px_rgba(124,58,237,0.22)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            Muro, encuestas rápidas y debates
            {authUser && network.isOnline && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <Cloud className="w-3 h-3" />
                En vivo
              </span>
            )}
          </h2>
          {!authUser && (
            <p className="text-[11px] fabro-muted flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#7C3AED]" />
              Modo lectura abierto · Iniciá sesión con tu FABRO ID para publicar en el muro público.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWithPoll((v) => !v)}
          className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
            withPoll
              ? 'border-[#EC4899] bg-[#EC4899] text-white'
              : 'border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C084FC]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {withPoll ? 'Quitar encuesta' : '+ Encuesta rápida'}
        </button>
      </div>

      <form onSubmit={(e) => void handlePublish(e)} className="space-y-2.5 text-xs">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="Compartí una idea, pregunta o reflexión..."
            className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
          />
          <button
            type="submit"
            disabled={publishing}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#7C3AED] bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)] cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {publishing ? 'Publicando...' : authUser ? 'Publicar' : 'Publicar (FABRO ID)'}
          </button>
        </div>

        {withPoll && (
          <div className="rounded-xl border-2 border-[#EC4899]/35 fabro-surface-elevated p-3 space-y-2">
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Pregunta de la encuesta..."
              className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
            />
            <label className="block space-y-1">
              <span className="text-[11px] fabro-muted flex items-center gap-1">
                <Plus className="w-3 h-3" />
                Opciones separadas por coma (2 a 4):
              </span>
              <input
                type="text"
                value={pollOptsRaw}
                onChange={(e) => setPollOptsRaw(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
              />
            </label>
          </div>
        )}
      </form>

      <div className="space-y-3">
        {mergedPosts.map((post) => {
          const totalVotes = post.poll
            ? post.poll.options.reduce((sum, o) => sum + o.votes, 0)
            : 0;
          return (
            <article
              key={post.id}
              className="rounded-xl border-2 fabro-border fabro-surface-elevated p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold">{post.author}</span>
                <span className="font-mono text-[11px] fabro-muted">
                  {post.fabroId} · {post.createdAt}
                </span>
              </div>
              <p className="text-xs leading-relaxed">{post.text}</p>

              {post.poll && (
                <div className="rounded-xl border-2 border-[#7C3AED]/25 fabro-surface p-3 space-y-2">
                  <p className="text-xs font-bold text-[#6D28D9] dark:text-[#C084FC]">
                    {post.poll.question}
                  </p>
                  <div className="space-y-1.5">
                    {post.poll.options.map((opt) => {
                      const pct =
                        totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                      const chosen = post.poll?.votedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => voteOnPoll(post.id, opt.id)}
                          className={`relative w-full min-h-[44px] rounded-xl border-2 overflow-hidden text-left px-3 py-2 text-xs cursor-pointer transition-all active:scale-95 ${
                            chosen
                              ? 'border-[#7C3AED] font-bold'
                              : 'fabro-border hover:border-[#7C3AED]/60'
                          }`}
                        >
                          <div
                            style={{ width: `${pct}%` }}
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#7C3AED]/20 to-[#EC4899]/20 transition-all"
                          />
                          <div className="relative flex items-center justify-between gap-2">
                            <span>{opt.label}</span>
                            <span className="font-mono text-[11px] font-bold tabular-nums">
                              {pct}% ({opt.votes})
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleLikePost(post)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#EC4899]/35 bg-[#EC4899]/10 px-3 py-1.5 text-xs font-mono font-bold text-[#BE185D] dark:text-[#F472B6] cursor-pointer active:scale-95 tabular-nums"
              >
                <Heart className="w-3.5 h-3.5" />
                {post.likes} Me gusta
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};
