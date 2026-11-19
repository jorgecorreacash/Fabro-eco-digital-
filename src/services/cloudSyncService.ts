import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AdvancedNoteItem,
  AuthPresenceStatus,
  BalancedPlannerItem,
  ChatMessageItem,
  DailyReviewState,
  GlossaryTermItem,
  GuidedReflectionItem,
  InboxCaptureItem,
  LocalUserProfile,
  MoodLogItem,
  OrganizerTaskItem,
  PaintedCalendarEvent,
  StudyCommunityItem,
  TimeBlockItem,
  VideoLibraryItem,
  WallPostItem,
  WellnessDietPlanItem,
  WellnessHabitPlanItem,
  WellnessPhysicalProfile,
  WellnessStoicSessionItem,
  WellnessWorkoutPlanItem,
} from '../types/ecosystem';

export interface CloudProfilePayload {
  id: 'main';
  uid: string;
  displayName: string;
  username: string;
  fabroId: string;
  photoURL: string;
  coverPhotoURL?: string;
  bio?: string;
  interests?: string[];
  currentActivity?: string;
  publicNoteIds?: string[];
  publicRoutineIds?: string[];
  followingIds?: string[];
  birthDate: string;
  isMinor: boolean;
  presenceStatus: AuthPresenceStatus;
  dailyPhrase: string;
  icebreaker: string;
  privacyMode: 'todos' | 'grupo' | 'invisible';
  shareTastesPublicly: boolean;
  tastes: LocalUserProfile['tastes'];
  migratedGuestAt?: string;
}

export interface CloudOrganizerSnapshot {
  inboxItems: InboxCaptureItem[];
  organizerTasks: OrganizerTaskItem[];
  timeBlocks: TimeBlockItem[];
  dailyReview: DailyReviewState;
  calendarEvents?: PaintedCalendarEvent[];
}

export interface CloudWellnessSnapshot {
  moodLogs: MoodLogItem[];
  guidedReflections: GuidedReflectionItem[];
  balancedPlanner: BalancedPlannerItem[];
  glossaryTerms: GlossaryTermItem[];
  physicalProfile?: WellnessPhysicalProfile;
  aiDietPlans?: WellnessDietPlanItem[];
  aiWorkoutPlans?: WellnessWorkoutPlanItem[];
  aiHabitPlans?: WellnessHabitPlanItem[];
  aiStoicSessions?: WellnessStoicSessionItem[];
  studyVideos?: VideoLibraryItem[];
  wellnessVideos?: VideoLibraryItem[];
  studyCommunities?: StudyCommunityItem[];
}

export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 30);
}

export function computeIsMinorFromBirthDate(birthDate: string): boolean {
  if (!birthDate) return false;
  const parsed = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age < 18;
}

export async function checkUsernameAvailability(
  rawHandle: string
): Promise<'available' | 'taken' | 'invalid' | 'offline'> {
  const handle = normalizeHandle(rawHandle);
  if (handle.length < 3) return 'invalid';
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline';
  }
  try {
    const snap = await getDoc(doc(db, 'publicHandles', handle));
    return snap.exists() ? 'taken' : 'available';
  } catch {
    return 'offline';
  }
}

export async function reserveUsernameAndSaveProfile(
  uid: string,
  payload: Omit<CloudProfilePayload, 'id' | 'uid'> & { previousHandle?: string }
): Promise<void> {
  const cleanHandle = normalizeHandle(payload.username) || `fabro_${uid.slice(0, 6).toLowerCase()}`;
  const profilePath = `users/${uid}/profile/main`;
  const handlePath = `publicHandles/${cleanHandle}`;

  try {
    // Check handle ownership before writing
    const handleSnap = await getDoc(doc(db, 'publicHandles', cleanHandle));
    if (handleSnap.exists() && handleSnap.data()?.uid !== uid) {
      throw new Error('Ese @usuario de FABRO ID ya está ocupado. Elegí otro identificador.');
    }

    if (payload.previousHandle) {
      const oldHandle = normalizeHandle(payload.previousHandle);
      if (oldHandle && oldHandle !== cleanHandle) {
        try {
          const oldSnap = await getDoc(doc(db, 'publicHandles', oldHandle));
          if (oldSnap.exists() && oldSnap.data()?.uid === uid) {
            await deleteDoc(doc(db, 'publicHandles', oldHandle));
          }
        } catch {
          // Non-fatal if offline or previous handle not owned
        }
      }
    }

    await setDoc(
      doc(db, 'publicHandles', cleanHandle),
      {
        handle: cleanHandle,
        uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const safeProfileDoc = {
      id: 'main',
      uid,
      displayName: (payload.displayName || 'Usuario FABRO').slice(0, 100),
      username: cleanHandle,
      fabroId: (payload.fabroId || `FBR-${cleanHandle.slice(0, 8).toUpperCase()}`).slice(0, 40),
      photoURL: (payload.photoURL || '').slice(0, 140000),
      coverPhotoURL: (payload.coverPhotoURL || '').slice(0, 180000),
      bio: (payload.bio || '').slice(0, 600),
      interests: Array.isArray(payload.interests)
        ? payload.interests.map((x) => String(x).slice(0, 40)).slice(0, 20)
        : [],
      currentActivity: (payload.currentActivity || '').slice(0, 160),
      publicNoteIds: Array.isArray(payload.publicNoteIds)
        ? payload.publicNoteIds.map((x) => String(x).slice(0, 120)).slice(0, 50)
        : [],
      publicRoutineIds: Array.isArray(payload.publicRoutineIds)
        ? payload.publicRoutineIds.map((x) => String(x).slice(0, 120)).slice(0, 30)
        : [],
      followingIds: Array.isArray(payload.followingIds)
        ? payload.followingIds.map((x) => String(x).slice(0, 120)).slice(0, 200)
        : [],
      birthDate: (payload.birthDate || '').slice(0, 20),
      isMinor: Boolean(payload.isMinor),
      presenceStatus: payload.presenceStatus || 'online',
      dailyPhrase: (payload.dailyPhrase || '').slice(0, 400),
      icebreaker: (payload.icebreaker || '').slice(0, 300),
      privacyMode: payload.privacyMode || 'grupo',
      shareTastesPublicly: Boolean(payload.shareTastesPublicly),
      tastes: {
        music: (payload.tastes?.music || '').slice(0, 150),
        movies: (payload.tastes?.movies || '').slice(0, 150),
        books: (payload.tastes?.books || '').slice(0, 150),
        food: (payload.tastes?.food || '').slice(0, 150),
        drinks: (payload.tastes?.drinks || '').slice(0, 150),
      },
      ...(payload.migratedGuestAt ? { migratedGuestAt: payload.migratedGuestAt } : {}),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', uid, 'profile', 'main'), safeProfileDoc, { merge: true });

    // Also update PII-free public profile directory document cleanly
    try {
      await setDoc(
        doc(db, 'publicProfiles', uid),
        {
          uid,
          displayName: safeProfileDoc.displayName,
          username: cleanHandle,
          customFabroId: safeProfileDoc.fabroId,
          photoURL: safeProfileDoc.photoURL.slice(0, 1000),
          sharedPhrase: safeProfileDoc.dailyPhrase,
          favoriteBooks: safeProfileDoc.tastes.books,
          favoriteMovies: safeProfileDoc.tastes.movies,
          favoriteMusic: safeProfileDoc.tastes.music,
          country: '',
          province: '',
          city: '',
          bio: safeProfileDoc.bio || safeProfileDoc.icebreaker,
          interests: safeProfileDoc.interests,
          institutions: [],
          isStudent: true,
          isInstructor: false,
          instructorCategory: 'especialista',
          verificationStatus: 'no_solicitado',
          specialty: '',
          experienceSummary: '',
          isMinor: safeProfileDoc.isMinor,
          searchableInDirectory: !safeProfileDoc.isMinor && safeProfileDoc.privacyMode !== 'invisible',
          presenceStatus:
            safeProfileDoc.presenceStatus === 'focus'
              ? 'dnd'
              : safeProfileDoc.presenceStatus === 'invisible'
              ? 'offline'
              : 'online',
          reputationPoints: 0,
          followersCount: 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // publicProfiles update may be deferred when offline or restricted
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('ya está ocupado')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `${profilePath} | ${handlePath}`);
  }
}

export async function loadUserProfileDoc(uid: string): Promise<CloudProfilePayload | null> {
  const path = `users/${uid}/profile/main`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
    if (!snap.exists()) return null;
    return snap.data() as CloudProfilePayload;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function syncSingleNoteToCloud(uid: string, note: AdvancedNoteItem): Promise<void> {
  const safeId = note.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `users/${uid}/notes/${safeId}`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'notes', safeId),
      {
        id: safeId,
        uid,
        title: note.title.slice(0, 200),
        subject: note.subject.slice(0, 100),
        folder: note.folder.slice(0, 100),
        tags: note.tags.slice(0, 15),
        favorite: Boolean(note.favorite),
        mainIdea: (note.mainIdea || '').slice(0, 2000),
        summaryText: (note.summaryText || '').slice(0, 4000),
        contentHtml: (note.contentHtml || '').slice(0, 200000),
        contentText: (note.contentText || '').slice(0, 200000),
        createdAt: note.createdAt || 'Hoy',
        updatedAt: note.updatedAt || 'Hoy',
        syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteSingleNoteFromCloud(uid: string, noteId: string): Promise<void> {
  const safeId = noteId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `users/${uid}/notes/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'notes', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncOrganizerStateToCloud(
  uid: string,
  snapshot: CloudOrganizerSnapshot
): Promise<void> {
  const path = `users/${uid}/organizer/state`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'organizer', 'state'),
      {
        id: 'state',
        uid,
        inboxItems: snapshot.inboxItems.slice(0, 100),
        organizerTasks: snapshot.organizerTasks.slice(0, 200),
        timeBlocks: snapshot.timeBlocks.slice(0, 150),
        dailyReview: snapshot.dailyReview,
        ...(Array.isArray(snapshot.calendarEvents)
          ? { calendarEvents: snapshot.calendarEvents.slice(0, 200) }
          : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncWellnessStateToCloud(
  uid: string,
  snapshot: CloudWellnessSnapshot
): Promise<void> {
  const path = `users/${uid}/wellness/state`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'wellness', 'state'),
      {
        id: 'state',
        uid,
        moodLogs: snapshot.moodLogs.slice(0, 60),
        guidedReflections: snapshot.guidedReflections.slice(0, 20),
        balancedPlanner: snapshot.balancedPlanner.slice(0, 30),
        glossaryTerms: snapshot.glossaryTerms.slice(0, 120),
        ...(snapshot.physicalProfile ? { physicalProfile: snapshot.physicalProfile } : {}),
        ...(Array.isArray(snapshot.aiDietPlans)
          ? { aiDietPlans: snapshot.aiDietPlans.slice(0, 20) }
          : {}),
        ...(Array.isArray(snapshot.aiWorkoutPlans)
          ? { aiWorkoutPlans: snapshot.aiWorkoutPlans.slice(0, 20) }
          : {}),
        ...(Array.isArray(snapshot.aiHabitPlans)
          ? { aiHabitPlans: snapshot.aiHabitPlans.slice(0, 20) }
          : {}),
        ...(Array.isArray(snapshot.aiStoicSessions)
          ? { aiStoicSessions: snapshot.aiStoicSessions.slice(0, 30) }
          : {}),
        ...(Array.isArray(snapshot.studyVideos)
          ? { studyVideos: snapshot.studyVideos.slice(0, 100) }
          : {}),
        ...(Array.isArray(snapshot.wellnessVideos)
          ? { wellnessVideos: snapshot.wellnessVideos.slice(0, 100) }
          : {}),
        ...(Array.isArray(snapshot.studyCommunities)
          ? { studyCommunities: snapshot.studyCommunities.slice(0, 40) }
          : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Migrates guest IndexedDB/LocalStorage work into Firestore once after login/signup.
 * NEVER touches or sends BYOK API keys (`byok_keys` stays 100% local).
 */
export async function migrateGuestVaultToCloud(
  uid: string,
  guestData: {
    notes: AdvancedNoteItem[];
    organizer: CloudOrganizerSnapshot;
    wellness: CloudWellnessSnapshot;
  }
): Promise<boolean> {
  try {
    const profileSnap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
    const alreadyMigrated = Boolean(profileSnap.exists() && profileSnap.data()?.migratedGuestAt);

    if (alreadyMigrated) {
      return false;
    }

    // Upload local notes (cap to reasonable batch to respect Spark quota)
    const notesToSync = guestData.notes.slice(0, 40);
    await Promise.all(notesToSync.map((n) => syncSingleNoteToCloud(uid, n)));
    await Promise.all([
      syncOrganizerStateToCloud(uid, guestData.organizer),
      syncWellnessStateToCloud(uid, guestData.wellness),
    ]);

    await setDoc(
      doc(db, 'users', uid, 'profile', 'main'),
      {
        id: 'main',
        uid,
        migratedGuestAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/migration`);
  }
}

export function subscribeToUserCloudWorkspace(
  uid: string,
  handlers: {
    onProfile?: (profile: CloudProfilePayload) => void;
    onNotes?: (notes: AdvancedNoteItem[]) => void;
    onOrganizer?: (organizer: CloudOrganizerSnapshot) => void;
    onWellness?: (wellness: CloudWellnessSnapshot) => void;
    onError?: (err: unknown) => void;
  }
): Unsubscribe {
  const unsubProfile = onSnapshot(
    doc(db, 'users', uid, 'profile', 'main'),
    (snap) => {
      if (snap.exists() && handlers.onProfile) {
        handlers.onProfile(snap.data() as CloudProfilePayload);
      }
    },
    (err) => handlers.onError?.(err)
  );

  const notesQuery = query(collection(db, 'users', uid, 'notes'), limit(50));
  const unsubNotes = onSnapshot(
    notesQuery,
    (snap) => {
      if (!handlers.onNotes) return;
      const items: AdvancedNoteItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          title: String(data.title || 'Apunte'),
          subject: String(data.subject || 'General'),
          folder: String(data.folder || 'General'),
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          favorite: Boolean(data.favorite),
          mainIdea: String(data.mainIdea || ''),
          summaryText: String(data.summaryText || ''),
          contentHtml: String(data.contentHtml || ''),
          contentText: String(data.contentText || ''),
          audioClips: [],
          createdAt: String(data.createdAt || 'Hoy'),
          updatedAt: String(data.updatedAt || 'Hoy'),
        };
      });
      if (items.length > 0) {
        handlers.onNotes(items);
      }
    },
    (err) => handlers.onError?.(err)
  );

  const unsubOrganizer = onSnapshot(
    doc(db, 'users', uid, 'organizer', 'state'),
    (snap) => {
      if (snap.exists() && handlers.onOrganizer) {
        const data = snap.data();
        handlers.onOrganizer({
          inboxItems: Array.isArray(data.inboxItems) ? data.inboxItems : [],
          organizerTasks: Array.isArray(data.organizerTasks) ? data.organizerTasks : [],
          timeBlocks: Array.isArray(data.timeBlocks) ? data.timeBlocks : [],
          dailyReview: data.dailyReview,
          calendarEvents: Array.isArray(data.calendarEvents) ? data.calendarEvents : undefined,
        });
      }
    },
    (err) => handlers.onError?.(err)
  );

  const unsubWellness = onSnapshot(
    doc(db, 'users', uid, 'wellness', 'state'),
    (snap) => {
      if (snap.exists() && handlers.onWellness) {
        const data = snap.data();
        handlers.onWellness({
          moodLogs: Array.isArray(data.moodLogs) ? data.moodLogs : [],
          guidedReflections: Array.isArray(data.guidedReflections) ? data.guidedReflections : [],
          balancedPlanner: Array.isArray(data.balancedPlanner) ? data.balancedPlanner : [],
          glossaryTerms: Array.isArray(data.glossaryTerms) ? data.glossaryTerms : [],
          physicalProfile:
            data.physicalProfile && typeof data.physicalProfile === 'object'
              ? (data.physicalProfile as WellnessPhysicalProfile)
              : undefined,
          aiDietPlans: Array.isArray(data.aiDietPlans) ? data.aiDietPlans : undefined,
          aiWorkoutPlans: Array.isArray(data.aiWorkoutPlans) ? data.aiWorkoutPlans : undefined,
          aiHabitPlans: Array.isArray(data.aiHabitPlans) ? data.aiHabitPlans : undefined,
          aiStoicSessions: Array.isArray(data.aiStoicSessions) ? data.aiStoicSessions : undefined,
          studyVideos: Array.isArray(data.studyVideos) ? data.studyVideos : undefined,
          wellnessVideos: Array.isArray(data.wellnessVideos) ? data.wellnessVideos : undefined,
          studyCommunities: Array.isArray(data.studyCommunities) ? data.studyCommunities : undefined,
        });
      }
    },
    (err) => handlers.onError?.(err)
  );

  return () => {
    unsubProfile();
    unsubNotes();
    unsubOrganizer();
    unsubWellness();
  };
}

export function subscribeToPublicPosts(
  onPosts: (posts: WallPostItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'public_posts'), orderBy('createdAtMs', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const posts: WallPostItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          author: String(data.author || 'Usuario FABRO'),
          authorAvatar: typeof data.authorAvatar === 'string' ? data.authorAvatar : undefined,
          fabroId: String(data.fabroId || 'FABRO'),
          text: String(data.text || ''),
          likes: typeof data.likes === 'number' ? data.likes : 0,
          origin:
            data.origin === 'estudio' ||
            data.origin === 'bienestar' ||
            data.origin === 'comunidad' ||
            data.origin === 'general'
              ? data.origin
              : 'general',
          categoryTag: typeof data.categoryTag === 'string' ? data.categoryTag : undefined,
          communityId: typeof data.communityId === 'string' ? data.communityId : undefined,
          communityName: typeof data.communityName === 'string' ? data.communityName : undefined,
          videoEmbed:
            data.videoEmbed && typeof data.videoEmbed === 'object' ? data.videoEmbed : undefined,
          reactions: data.reactions && typeof data.reactions === 'object' ? data.reactions : undefined,
          comments: Array.isArray(data.comments) ? data.comments : [],
          media: Array.isArray(data.media) ? data.media : undefined,
          sharedResource:
            data.sharedResource && typeof data.sharedResource === 'object'
              ? data.sharedResource
              : undefined,
          createdAt: String(data.createdAtLabel || 'Recién'),
          poll: data.poll || undefined,
        };
      });
      onPosts(posts);
    },
    (err) => onError?.(err)
  );
}

export async function publishPublicPost(uid: string, post: WallPostItem): Promise<void> {
  const safeId = post.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `public_posts/${safeId}`;
  // Keep Firestore media entries compact (thumbnails/posters only, never raw video blobs)
  const cloudMedia = Array.isArray(post.media)
    ? post.media.slice(0, 4).map((m) => ({
        id: m.id,
        kind: m.kind,
        ...(m.mediaVaultId ? { mediaVaultId: m.mediaVaultId } : {}),
        ...(m.kind === 'image' && m.dataUrl && m.dataUrl.length <= 150000
          ? { dataUrl: m.dataUrl }
          : {}),
        ...(m.posterDataUrl && m.posterDataUrl.length <= 120000
          ? { posterDataUrl: m.posterDataUrl }
          : {}),
        ...(m.caption ? { caption: m.caption.slice(0, 240) } : {}),
        ...(m.filter ? { filter: m.filter } : {}),
        ...(typeof m.durationSec === 'number' ? { durationSec: m.durationSec } : {}),
      }))
    : undefined;

  try {
    await setDoc(doc(db, 'public_posts', safeId), {
      id: safeId,
      authorUid: uid,
      author: post.author.slice(0, 100),
      ...(post.authorAvatar && post.authorAvatar.length <= 140000
        ? { authorAvatar: post.authorAvatar }
        : {}),
      fabroId: post.fabroId.slice(0, 50),
      text: (post.text.trim() || 'Publicación multimedia en FABRO').slice(0, 2000),
      likes: 0,
      ...(post.origin ? { origin: post.origin } : { origin: 'general' }),
      ...(post.categoryTag ? { categoryTag: post.categoryTag.slice(0, 80) } : {}),
      ...(post.communityId ? { communityId: post.communityId.slice(0, 128) } : {}),
      ...(post.communityName ? { communityName: post.communityName.slice(0, 120) } : {}),
      ...(post.videoEmbed ? { videoEmbed: post.videoEmbed } : {}),
      ...(post.reactions ? { reactions: post.reactions } : {}),
      ...(post.comments && post.comments.length > 0 ? { comments: post.comments.slice(0, 50) } : {}),
      ...(cloudMedia && cloudMedia.length > 0 ? { media: cloudMedia } : {}),
      ...(post.sharedResource ? { sharedResource: post.sharedResource } : {}),
      createdAtLabel: post.createdAt || 'Recién',
      createdAtMs: Date.now(),
      ...(post.poll ? { poll: post.poll } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updatePublicPostLikes(postId: string, nextLikes: number): Promise<void> {
  const safeId = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `public_posts/${safeId}`;
  try {
    await updateDoc(doc(db, 'public_posts', safeId), {
      likes: Math.max(0, nextLikes),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePublicPostReactions(
  postId: string,
  nextLikes: number,
  reactions: NonNullable<WallPostItem['reactions']>
): Promise<void> {
  const safeId = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `public_posts/${safeId}`;
  try {
    await updateDoc(doc(db, 'public_posts', safeId), {
      likes: Math.max(0, nextLikes),
      reactions,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePublicPostComments(
  postId: string,
  comments: NonNullable<WallPostItem['comments']>
): Promise<void> {
  const safeId = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `public_posts/${safeId}`;
  try {
    await updateDoc(doc(db, 'public_posts', safeId), {
      comments: comments.slice(-100),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePublicPostPoll(
  postId: string,
  poll: NonNullable<WallPostItem['poll']>
): Promise<void> {
  const safeId = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `public_posts/${safeId}`;
  try {
    await updateDoc(doc(db, 'public_posts', safeId), {
      poll,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeToCloudChat(
  chatId: string,
  onMessages: (messages: ChatMessageItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const safeChatId = chatId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const q = query(
    collection(db, 'chats', safeChatId, 'messages'),
    orderBy('createdAtMs', 'asc'),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatMessageItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          sender: String(data.sender || 'Usuario'),
          text: String(data.text || ''),
          time: String(data.time || ''),
          sticker: data.sticker ? String(data.sticker) : undefined,
          recipientId: safeChatId,
          deliveryStatus: 'delivered-local',
        };
      });
      onMessages(list);
    },
    (err) => onError?.(err)
  );
}

export async function sendCloudChatMessage(
  chatId: string,
  uid: string,
  msg: ChatMessageItem
): Promise<void> {
  const safeChatId = chatId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const safeMsgId = msg.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `chats/${safeChatId}/messages/${safeMsgId}`;
  try {
    await setDoc(
      doc(db, 'chats', safeChatId),
      {
        id: safeChatId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(doc(db, 'chats', safeChatId, 'messages', safeMsgId), {
      id: safeMsgId,
      chatId: safeChatId,
      senderUid: uid,
      sender: msg.sender.slice(0, 100),
      text: msg.text.slice(0, 4000),
      time: msg.time.slice(0, 20),
      ...(msg.sticker ? { sticker: msg.sticker.slice(0, 16) } : {}),
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteUserCloudAccountData(uid: string, username?: string): Promise<void> {
  try {
    const notesSnap = await getDocs(query(collection(db, 'users', uid, 'notes'), limit(50)));
    await Promise.all(notesSnap.docs.map((d) => deleteDoc(d.ref)));
    await Promise.allSettled([
      deleteDoc(doc(db, 'users', uid, 'profile', 'main')),
      deleteDoc(doc(db, 'users', uid, 'organizer', 'state')),
      deleteDoc(doc(db, 'users', uid, 'wellness', 'state')),
      deleteDoc(doc(db, 'publicProfiles', uid)),
      username ? deleteDoc(doc(db, 'publicHandles', normalizeHandle(username))) : Promise.resolve(),
    ]);
  } catch {
    // Proceed even if some docs didn't exist
  }
}
