import type { CultureNewsArticle } from '../types/culture';
import type { NavDestination, NotificationCategory, WallPostItem } from '../types/ecosystem';
import { vaultGet, vaultSet } from './localVault';

const SEEN_CULTURE_NEWS_KEY = 'push_seen_culture_news_ids_v1';
const SEEN_COMMUNITY_POSTS_KEY = 'push_seen_community_post_ids_v1';
export const ECOSYSTEM_PUSH_CHANNEL = 'fabro_ecosystem_push_v1';

export interface CrossTabPushBroadcast {
  type: 'FABRO_ECOSYSTEM_PUSH_EVENT';
  originTabId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  target: NavDestination;
  cultureNav?: string;
  actionLabel?: string;
  tag?: string;
}

const MAX_SEEN_IDS = 260;

export async function loadSeenCultureNewsIds(): Promise<string[]> {
  const stored = await vaultGet<string[]>(SEEN_CULTURE_NEWS_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export async function saveSeenCultureNewsIds(ids: string[]): Promise<void> {
  const deduped = Array.from(new Set(ids)).slice(0, MAX_SEEN_IDS);
  await vaultSet(SEEN_CULTURE_NEWS_KEY, deduped);
}

/**
 * Compares fetched Cultura news articles against persisted seen IDs.
 * On the very first run (no seen IDs yet), silently seeds the vault so the user
 * isn't flooded with historical articles; on every subsequent check, returns only
 * genuinely newly-published articles.
 */
export async function detectFreshCultureNews(
  articles: CultureNewsArticle[]
): Promise<{ freshArticles: CultureNewsArticle[]; seeded: boolean }> {
  if (!articles.length) {
    return { freshArticles: [], seeded: false };
  }

  const seenList = await loadSeenCultureNewsIds();
  const incomingIds = articles.map((a) => a.id);

  if (seenList.length === 0) {
    await saveSeenCultureNewsIds(incomingIds);
    return { freshArticles: [], seeded: true };
  }

  const seenSet = new Set(seenList);
  const freshArticles = articles.filter((a) => !seenSet.has(a.id));

  if (freshArticles.length > 0) {
    await saveSeenCultureNewsIds([...freshArticles.map((a) => a.id), ...seenList]);
  }

  return { freshArticles, seeded: false };
}

export function formatCultureNewsPushPayload(freshArticles: CultureNewsArticle[]): {
  title: string;
  body: string;
  tag: string;
} {
  const lead = freshArticles[0];
  if (freshArticles.length === 1) {
    return {
      title: `FABRO Cultura · ${lead.categoryLabel}`,
      body: `${lead.title} (${lead.source})`,
      tag: `fabro-culture-news-${lead.id.slice(0, 24)}`,
    };
  }
  return {
    title: `${freshArticles.length} nuevas noticias en FABRO Cultura`,
    body: `${lead.title} y ${freshArticles.length - 1} novedades más en la redacción cultural.`,
    tag: `fabro-culture-news-batch-${Date.now()}`,
  };
}

export async function loadSeenCommunityPostIds(): Promise<string[]> {
  const stored = await vaultGet<string[]>(SEEN_COMMUNITY_POSTS_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export async function saveSeenCommunityPostIds(ids: string[]): Promise<void> {
  const deduped = Array.from(new Set(ids)).slice(0, MAX_SEEN_IDS);
  await vaultSet(SEEN_COMMUNITY_POSTS_KEY, deduped);
}

/**
 * Detects genuinely new community posts from other members belonging to any
 * community the user has joined (study communities, cultural wall/communities).
 */
export async function detectFreshCommunityWallPosts(params: {
  cloudPosts: WallPostItem[];
  joinedStudyCommunityIds: Set<string>;
  joinedCultureCommunityNames: Set<string>;
  myFabroId?: string;
}): Promise<{ freshPosts: WallPostItem[]; seeded: boolean }> {
  const { cloudPosts, joinedStudyCommunityIds, joinedCultureCommunityNames, myFabroId } = params;
  if (!cloudPosts.length) return { freshPosts: [], seeded: false };

  const seenList = await loadSeenCommunityPostIds();
  const incomingIds = cloudPosts.map((p) => p.id);

  if (seenList.length === 0) {
    await saveSeenCommunityPostIds(incomingIds);
    return { freshPosts: [], seeded: true };
  }

  const seenSet = new Set(seenList);
  const myIdNorm = (myFabroId || '').trim().toUpperCase();

  const freshPosts = cloudPosts.filter((post) => {
    if (seenSet.has(post.id)) return false;
    if (myIdNorm && (post.fabroId || '').trim().toUpperCase() === myIdNorm) return false;

    const inJoinedStudy = Boolean(post.communityId && joinedStudyCommunityIds.has(post.communityId));
    const inCultureSpace =
      Boolean(post.spaces?.includes('cultura')) ||
      post.communityId === 'cultura-both' ||
      Boolean(
        post.communityName &&
          joinedCultureCommunityNames.size > 0 &&
          Array.from(joinedCultureCommunityNames).some((name) =>
            post.communityName?.toLowerCase().includes(name.toLowerCase())
          )
      );
    const isCommunityOrigin = post.origin === 'comunidad' && Boolean(post.communityName);

    return inJoinedStudy || inCultureSpace || isCommunityOrigin;
  });

  // Persist all incoming IDs so already-seen posts never re-trigger
  const unseenIncoming = incomingIds.filter((id) => !seenSet.has(id));
  if (unseenIncoming.length > 0) {
    await saveSeenCommunityPostIds([...unseenIncoming, ...seenList]);
  }

  return { freshPosts, seeded: false };
}

export function broadcastEcosystemPushEvent(payload: CrossTabPushBroadcast): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    const ch = new BroadcastChannel(ECOSYSTEM_PUSH_CHANNEL);
    ch.postMessage(payload);
    ch.close();
  } catch {
    // ignore unsupported BroadcastChannel contexts
  }
}
