import { DEFAULT_CULTURE_STATE } from '../data/cultureCatalog';
import type { CultureStateSnapshot } from '../types/culture';
import { vaultGet, vaultSetIdbOnly } from './localVault';

const CULTURE_VAULT_KEY = 'fabro_culture_workspace_v1';

export async function loadCultureState(): Promise<CultureStateSnapshot> {
  const saved = await vaultGet<Partial<CultureStateSnapshot> | null>(CULTURE_VAULT_KEY, null);
  if (!saved || typeof saved !== 'object') {
    return DEFAULT_CULTURE_STATE;
  }
  return {
    gallery: Array.isArray(saved.gallery) ? saved.gallery : DEFAULT_CULTURE_STATE.gallery,
    exhibitions: Array.isArray(saved.exhibitions)
      ? saved.exhibitions
      : DEFAULT_CULTURE_STATE.exhibitions,
    songs: Array.isArray(saved.songs) ? saved.songs : DEFAULT_CULTURE_STATE.songs,
    manuscripts: Array.isArray(saved.manuscripts)
      ? saved.manuscripts
      : DEFAULT_CULTURE_STATE.manuscripts,
    readingList: Array.isArray(saved.readingList)
      ? saved.readingList
      : DEFAULT_CULTURE_STATE.readingList,
    timeline: Array.isArray(saved.timeline) ? saved.timeline : DEFAULT_CULTURE_STATE.timeline,
    familyTree: Array.isArray(saved.familyTree)
      ? saved.familyTree
      : DEFAULT_CULTURE_STATE.familyTree,
    recipes: Array.isArray(saved.recipes) ? saved.recipes : DEFAULT_CULTURE_STATE.recipes,
    communities: Array.isArray(saved.communities)
      ? saved.communities
      : DEFAULT_CULTURE_STATE.communities,
    courses: Array.isArray(saved.courses) ? saved.courses : DEFAULT_CULTURE_STATE.courses,
    library: Array.isArray(saved.library) ? saved.library : DEFAULT_CULTURE_STATE.library,
    events: Array.isArray(saved.events) ? saved.events : DEFAULT_CULTURE_STATE.events,
    records: Array.isArray(saved.records) ? saved.records : DEFAULT_CULTURE_STATE.records,
  };
}

export async function saveCultureState(next: CultureStateSnapshot): Promise<void> {
  await vaultSetIdbOnly(CULTURE_VAULT_KEY, next);
}

/**
 * Helper to identify if a WallPost belongs to FABRO Cultura or is Cultura-only.
 * Reuses existing single-ID wallPosts and Firestore public_posts fields (communityId / categoryTag)
 * with zero extra collections or billing.
 */
export function isPostInCultureWall(post: {
  spaces?: Array<'general' | 'cultura'>;
  communityId?: string;
  categoryTag?: string;
}): boolean {
  if (Array.isArray(post.spaces)) {
    return post.spaces.includes('cultura');
  }
  if (post.communityId === 'cultura-only' || post.communityId === 'cultura-both') {
    return true;
  }
  if (typeof post.categoryTag === 'string' && post.categoryTag.startsWith('cultura:')) {
    return true;
  }
  return false;
}

export function isPostCultureOnly(post: {
  spaces?: Array<'general' | 'cultura'>;
  communityId?: string;
}): boolean {
  if (Array.isArray(post.spaces)) {
    return post.spaces.includes('cultura') && !post.spaces.includes('general');
  }
  return post.communityId === 'cultura-only';
}

export function isPostSharedBothWalls(post: {
  spaces?: Array<'general' | 'cultura'>;
  communityId?: string;
}): boolean {
  if (Array.isArray(post.spaces)) {
    return post.spaces.includes('cultura') && post.spaces.includes('general');
  }
  return post.communityId === 'cultura-both';
}

export function extractCultureDisciplineFromPost(post: {
  cultureDiscipline?: string;
  categoryTag?: string;
}): string | null {
  if (post.cultureDiscipline) return post.cultureDiscipline;
  if (typeof post.categoryTag === 'string' && post.categoryTag.startsWith('cultura:')) {
    return post.categoryTag.replace('cultura:', '');
  }
  return null;
}

export function extractHashtagsFromText(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]{2,32}/g) || [];
  return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
}
