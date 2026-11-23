import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  localGetDownloadURL as getDownloadURL,
  localStorageRef as storageRef,
  localUploadBytes as uploadBytes,
  storage,
} from '../lib/firebase';
import { useFabro } from './FabroContext';
import { useRealtimeHub, type ClassroomSyncPayload, type OnlinePeerInfo } from '../hooks/useRealtimeHub';
import {
  DEFAULT_ACADEMY_TAXONOMY,
  type AcademyTaxonomyGroup,
  type AccountStatus,
  type AdminAuditLog,
  type AdminRoleRecord,
  type ClassroomQuizItem,
  type CommunityGroup,
  type Course,
  type CourseEnrollment,
  type CourseLesson,
  type DirectMessage,
  type DirectThread,
  type GroupChatMessage,
  type GroupMember,
  type GroupPost,
  type GroupPostType,
  type InstitutionRecord,
  type InstructorCategory,
  type InstructorVerificationRequest,
  type ModerationReport,
  type NavSectionId,
  type PlatformCategoryRecord,
  type PlatformNotification,
  type PresenceMode,
  type PublicUserProfile,
  type SavedVideoResource,
  type SharedLibraryItem,
  type StudentProfile,
  type UserSanction,
  type VerificationStatus,
  type VirtualClassroom,
} from '../types/fabro';

export const SUPERADMIN_EMAIL = 'jorgecorreasp@gmail.com';

function makeSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, 120);
}

interface PlatformContextValue {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  adminRole: AdminRoleRecord['role'] | null;
  // Data
  publicProfiles: PublicUserProfile[];
  courses: Course[];
  enrollments: CourseEnrollment[];
  groups: CommunityGroup[];
  classrooms: VirtualClassroom[];
  directThreads: DirectThread[];
  youtubeVideos: SavedVideoResource[];
  sharedLibrary: SharedLibraryItem[];
  taxonomy: AcademyTaxonomyGroup[];
  categoryRecords: PlatformCategoryRecord[];
  institutions: InstitutionRecord[];
  notifications: PlatformNotification[];
  unreadNotificationsCount: number;
  myVerifications: InstructorVerificationRequest[];
  allVerifications: InstructorVerificationRequest[];
  myReports: ModerationReport[];
  allReports: ModerationReport[];
  mySanctions: UserSanction[];
  allSanctions: UserSanction[];
  auditLogs: AdminAuditLog[];
  adminRecords: AdminRoleRecord[];
  allUsersList: StudentProfile[];
  // Realtime WS
  wsConnected: boolean;
  onlinePeers: OnlinePeerInfo[];
  classroomPeersCount: number;
  activeClassroomRoomId: string | null;
  setActiveClassroomRoomId: (id: string | null) => void;
  lastClassroomSync: ClassroomSyncPayload | null;
  sendClassroomSync: (payload: ClassroomSyncPayload) => void;
  // Profile & Social Actions
  updatePresenceMode: (mode: PresenceMode) => Promise<void>;
  toggleFollowInstructor: (instructorId: string) => Promise<void>;
  toggleBlockUser: (targetUid: string) => Promise<void>;
  submitInstructorVerification: (input: {
    applicantName: string;
    contactInfo: string;
    country: string;
    province: string;
    city: string;
    specialty: string;
    category: InstructorCategory;
    experienceDetails: string;
    institution: string;
    evidenceSummary: string;
    evidenceFile?: File | null;
  }) => Promise<string>;
  reviewInstructorVerification: (params: {
    verification: InstructorVerificationRequest;
    nextStatus: VerificationStatus;
    adminNote: string;
  }) => Promise<void>;
  // Courses & Academy
  createCourse: (input: {
    title: string;
    description: string;
    area: string;
    category: string;
    level: Course['level'];
    objectives: string;
    syllabus: string;
    estimatedHours: number;
    visibility: Course['visibility'];
    institution: string;
    certificateEnabled: boolean;
    bibliography: string;
    createLinkedGroup: boolean;
  }) => Promise<string>;
  updateCourse: (courseId: string, patch: Partial<Course>) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  subscribeCourseLessons: (courseId: string, cb: (lessons: CourseLesson[]) => void) => () => void;
  addCourseLesson: (
    courseId: string,
    input: {
      title: string;
      description: string;
      videoUrl: string;
      youtubeVideoId: string;
      materialPdfFile?: File | null;
      materialPdfUrl?: string;
      materialPdfName?: string;
      activityPrompt: string;
      quizQuestions: CourseLesson['quizQuestions'];
      durationMinutes: number;
      orderIndex: number;
    }
  ) => Promise<string>;
  deleteCourseLesson: (courseId: string, lessonId: string, currentCount: number) => Promise<void>;
  enrollInCourse: (course: Course) => Promise<void>;
  unenrollFromCourse: (enrollmentId: string, courseId: string) => Promise<void>;
  toggleCourseFavorite: (enrollmentId: string, currentFavorite: boolean) => Promise<void>;
  markLessonCompleted: (params: {
    enrollment: CourseEnrollment;
    lessonId: string;
    totalLessons: number;
    quizScore?: number;
  }) => Promise<void>;
  rateCourse: (enrollment: CourseEnrollment, course: Course, rating: number) => Promise<void>;
  // Community & Groups
  createGroup: (input: {
    name: string;
    description: string;
    groupType: CommunityGroup['groupType'];
    visibility: CommunityGroup['visibility'];
    country: string;
    province: string;
    city: string;
    institutionName: string;
    career: string;
    courseName: string;
    subjectName: string;
    specialty: string;
    linkedCourseId?: string;
    allowMinors: boolean;
  }) => Promise<string>;
  joinGroup: (group: CommunityGroup) => Promise<'activo' | 'pendiente'>;
  leaveGroup: (groupId: string) => Promise<void>;
  updateGroupMemberStatus: (
    groupId: string,
    memberId: string,
    status: GroupMember['status'],
    role?: GroupMember['role']
  ) => Promise<void>;
  subscribeGroupMembers: (groupId: string, cb: (members: GroupMember[]) => void) => () => void;
  subscribeGroupPosts: (groupId: string, cb: (posts: GroupPost[]) => void) => () => void;
  subscribeGroupMessages: (groupId: string, cb: (msgs: GroupChatMessage[]) => void) => () => void;
  createGroupPost: (
    groupId: string,
    input: {
      postType: GroupPostType;
      title: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      youtubeVideoId?: string;
      pollLabels?: string[];
    }
  ) => Promise<string>;
  addGroupPostComment: (groupId: string, post: GroupPost, text: string) => Promise<void>;
  voteGroupPoll: (groupId: string, post: GroupPost, optionId: string) => Promise<void>;
  sendGroupChatMessage: (
    groupId: string,
    text: string,
    attachment?: { url: string; name: string }
  ) => Promise<void>;
  // Virtual Classrooms
  createClassroom: (input: {
    courseId: string;
    title: string;
    description: string;
    scheduledAt: string;
    visibility: VirtualClassroom['visibility'];
    youtubeVideoId: string;
    videoTitle: string;
    presentationNotes: string;
  }) => Promise<string>;
  updateClassroomPlayback: (
    classroomId: string,
    patch: {
      youtubeVideoId?: string;
      videoTitle?: string;
      playbackState: 'playing' | 'paused';
      playbackSeconds: number;
    }
  ) => Promise<void>;
  updateClassroomMaterials: (
    classroomId: string,
    patch: {
      presentationNotes?: string;
      sharedLinks?: Array<{ title: string; url: string }>;
      sharedDocTitles?: string[];
      activeQuiz?: ClassroomQuizItem | null;
    }
  ) => Promise<void>;
  answerClassroomQuiz: (classroom: VirtualClassroom, optionIndex: number) => Promise<void>;
  deleteClassroom: (classroomId: string) => Promise<void>;
  myPublicProfile: PublicUserProfile | null;
  selectedDirectThreadId: string | null;
  setSelectedDirectThreadId: (id: string | null) => void;
  // Direct Messaging (Strict Minor Guard)
  startOrGetDirectThread: (
    targetProfile: Pick<PublicUserProfile, 'uid' | 'displayName'> & { isMinor?: boolean }
  ) => Promise<string>;
  subscribeDirectMessages: (threadId: string, cb: (msgs: DirectMessage[]) => void) => () => void;
  sendDirectMessage: (
    thread: DirectThread,
    text: string,
    attachment?: { url: string; name: string }
  ) => Promise<void>;
  toggleBlockDirectThread: (thread: DirectThread) => Promise<void>;
  markThreadRead: (thread: DirectThread) => Promise<void>;
  // Video Learning
  saveVideoResource: (input: {
    youtubeVideoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    youtubeUrl: string;
    area: string;
    subjectTag: string;
    keywords: string[];
    transcriptAvailable: boolean;
    transcriptText: string;
    aiSummaryMarkdown: string;
    isPublic: boolean;
  }) => Promise<string>;
  deleteVideoResource: (id: string) => Promise<void>;
  // Collaborative Shared Library
  uploadSharedLibraryItem: (input: {
    file?: File | null;
    externalUrl?: string;
    title: string;
    description: string;
    itemType: SharedLibraryItem['itemType'];
    area: string;
    career: string;
    subjectName: string;
    courseName: string;
    authorConfirmedRights: boolean;
    visibility: SharedLibraryItem['visibility'];
  }) => Promise<string>;
  incrementSharedDownload: (item: SharedLibraryItem) => Promise<void>;
  toggleSharedFavorite: (item: SharedLibraryItem) => Promise<void>;
  deleteSharedLibraryItem: (id: string) => Promise<void>;
  // Institutions & Admin Governance
  createInstitution: (input: {
    name: string;
    institutionType: InstitutionRecord['institutionType'];
    country: string;
    province: string;
    city: string;
  }) => Promise<string>;
  updateInstitutionAdmin: (instId: string, patch: { verified?: boolean; status?: InstitutionRecord['status'] }) => Promise<void>;
  savePlatformCategory: (cat: { id?: string; area: string; subcategories: string[]; active: boolean }) => Promise<void>;
  deletePlatformCategory: (catId: string) => Promise<void>;
  submitModerationReport: (input: {
    targetType: ModerationReport['targetType'];
    targetId: string;
    targetSummary: string;
    reason: string;
    details: string;
  }) => Promise<string>;
  resolveModerationReport: (reportId: string, status: ModerationReport['status'], resolutionNote: string) => Promise<void>;
  issueUserSanction: (input: {
    userId: string;
    userName: string;
    sanctionType: UserSanction['sanctionType'];
    reason: string;
  }) => Promise<void>;
  submitSanctionAppeal: (sanctionId: string, appealText: string) => Promise<void>;
  resolveSanctionAppeal: (sanction: UserSanction, accept: boolean) => Promise<void>;
  assignAdminRole: (uid: string, email: string, role: AdminRoleRecord['role']) => Promise<void>;
  revokeAdminRole: (uid: string) => Promise<void>;
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  sendUserNotification: (
    targetUserId: string,
    title: string,
    body: string,
    linkSection: NavSectionId
  ) => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady, profile } = useFabro();

  const [publicProfiles, setPublicProfiles] = useState<PublicUserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [classrooms, setClassrooms] = useState<VirtualClassroom[]>([]);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<SavedVideoResource[]>([]);
  const [sharedLibrary, setSharedLibrary] = useState<SharedLibraryItem[]>([]);
  const [categoryRecords, setCategoryRecords] = useState<PlatformCategoryRecord[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionRecord[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);

  const [myVerifications, setMyVerifications] = useState<InstructorVerificationRequest[]>([]);
  const [allVerifications, setAllVerifications] = useState<InstructorVerificationRequest[]>([]);
  const [myReports, setMyReports] = useState<ModerationReport[]>([]);
  const [allReports, setAllReports] = useState<ModerationReport[]>([]);
  const [mySanctions, setMySanctions] = useState<UserSanction[]>([]);
  const [allSanctions, setAllSanctions] = useState<UserSanction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [adminRecords, setAdminRecords] = useState<AdminRoleRecord[]>([]);
  const [myAdminDoc, setMyAdminDoc] = useState<AdminRoleRecord | null>(null);
  const [allUsersList, setAllUsersList] = useState<StudentProfile[]>([]);

  const [myPublicProfile, setMyPublicProfile] = useState<PublicUserProfile | null>(null);
  const [selectedDirectThreadId, setSelectedDirectThreadId] = useState<string | null>(null);
  const [activeClassroomRoomId, setActiveClassroomRoomId] = useState<string | null>(null);
  const [lastClassroomSync, setLastClassroomSync] = useState<ClassroomSyncPayload | null>(null);

  const isSuperAdmin = useMemo(
    () =>
      Boolean(
        user?.emailVerified &&
          (user.email || '').toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
      ),
    [user?.email, user?.emailVerified]
  );

  const adminRole: AdminRoleRecord['role'] | null = useMemo(() => {
    if (isSuperAdmin) return 'superadmin';
    return myAdminDoc?.role || null;
  }, [isSuperAdmin, myAdminDoc]);

  const isAdmin = Boolean(isSuperAdmin || myAdminDoc);

  const { wsConnected, onlinePeers, classroomPeersCount, sendClassroomSync } = useRealtimeHub({
    uid: user?.emailVerified ? user.uid : null,
    displayName: profile?.displayName || user?.displayName || 'Usuario FABRO',
    presenceMode: profile?.presenceMode || 'online',
    activeClassroomId: activeClassroomRoomId,
    onClassroomSync: (payload) => setLastClassroomSync(payload),
  });

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !profile) return;
    const pubRef = doc(db, 'publicProfiles', user.uid);
    void getDoc(pubRef).then((snap) => {
      if (snap.exists()) return;
      const isMinorFlag = Boolean(profile.isMinor);
      void setDoc(pubRef, {
        uid: user.uid,
        displayName: (profile.displayName || user.displayName || 'Usuario FABRO').slice(0, 100),
        username: (profile.username || '').slice(0, 50),
        customFabroId: (profile.customFabroId || '').slice(0, 32),
        photoURL: (profile.photoURL || '').slice(0, 135000),
        galleryPhotos: (profile.galleryPhotos || []).slice(0, 6),
        sharedPhrase: (profile.sharedPhrase || '').slice(0, 400),
        favoriteBooks: (profile.favoriteBooks || '').slice(0, 300),
        favoriteMovies: (profile.favoriteMovies || '').slice(0, 300),
        favoriteMusic: (profile.favoriteMusic || '').slice(0, 300),
        country: (profile.country || '').slice(0, 100),
        province: (profile.province || '').slice(0, 100),
        city: (profile.city || '').slice(0, 100),
        bio: (profile.bio || '').slice(0, 1000),
        interests: (profile.interests || []).slice(0, 25),
        institutions: (profile.institutions || (profile.institution ? [profile.institution] : [])).slice(0, 15),
        isStudent: profile.isStudent ?? false,
        isInstructor: profile.isInstructor ?? false,
        instructorCategory: profile.instructorCategory || 'instructor_independiente',
        verificationStatus: profile.verificationStatus || 'no_solicitado',
        specialty: (profile.specialty || '').slice(0, 150),
        experienceSummary: (profile.experienceSummary || '').slice(0, 1500),
        isMinor: isMinorFlag,
        searchableInDirectory: !isMinorFlag,
        presenceStatus: profile.presenceMode === 'invisible' ? 'offline' : profile.presenceMode || 'online',
        reputationPoints: profile.reputationPoints || 0,
        followersCount: 0,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    });
  }, [authReady, user, profile]);

  // Core Universal Subscriptions
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setMyPublicProfile(null);
      setSelectedDirectThreadId(null);
      setPublicProfiles([]);
      setCourses([]);
      setEnrollments([]);
      setGroups([]);
      setClassrooms([]);
      setDirectThreads([]);
      setYoutubeVideos([]);
      setSharedLibrary([]);
      setCategoryRecords([]);
      setInstitutions([]);
      setNotifications([]);
      setMyVerifications([]);
      setAllVerifications([]);
      setMyReports([]);
      setAllReports([]);
      setMySanctions([]);
      setAllSanctions([]);
      setAuditLogs([]);
      setAdminRecords([]);
      setMyAdminDoc(null);
      setAllUsersList([]);
      return;
    }

    const unsubs: Array<() => void> = [];

    // Current user's own public profile (always readable even when searchableInDirectory == false)
    unsubs.push(
      onSnapshot(
        doc(db, 'publicProfiles', user.uid),
        (snap) => setMyPublicProfile(snap.exists() ? (snap.data() as PublicUserProfile) : null),
        () => {}
      )
    );

    // Public directory strictly filtered to adults (isMinor == false && searchableInDirectory == true)
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'publicProfiles'),
          where('isMinor', '==', false),
          where('searchableInDirectory', '==', true)
        ),
        (snap) => setPublicProfiles(snap.docs.map((d) => d.data() as PublicUserProfile)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'courses'), where('status', '==', 'activo')),
        (snap) => setCourses(snap.docs.map((d) => d.data() as Course)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'courseEnrollments'), where('userId', '==', user.uid)),
        (snap) => setEnrollments(snap.docs.map((d) => d.data() as CourseEnrollment)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'groups'),
        (snap) => setGroups(snap.docs.map((d) => d.data() as CommunityGroup)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'classrooms'),
        (snap) => setClassrooms(snap.docs.map((d) => d.data() as VirtualClassroom)),
        () => {}
      )
    );

    // Minor protection: never query 1:1 threads if user is minor
    if (!profile?.isMinor) {
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'directThreads'),
            where('participantIds', 'array-contains', user.uid),
            where('hasMinorParticipant', '==', false)
          ),
          (snap) => setDirectThreads(snap.docs.map((d) => d.data() as DirectThread)),
          () => {}
        )
      );
    } else {
      setDirectThreads([]);
    }

    unsubs.push(
      onSnapshot(
        query(collection(db, 'youtubeVideos'), where('isPublic', '==', true)),
        (snap) => {
          const pubList = snap.docs.map((d) => d.data() as SavedVideoResource);
          setYoutubeVideos((prev) => {
            const byId = new Map(prev.filter((v) => v.addedBy === user.uid).map((v) => [v.id, v]));
            for (const item of pubList) byId.set(item.id, item);
            return Array.from(byId.values());
          });
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'youtubeVideos'), where('addedBy', '==', user.uid)),
        (snap) => {
          const mine = snap.docs.map((d) => d.data() as SavedVideoResource);
          setYoutubeVideos((prev) => {
            const byId = new Map(prev.filter((v) => v.isPublic).map((v) => [v.id, v]));
            for (const item of mine) byId.set(item.id, item);
            return Array.from(byId.values());
          });
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'sharedLibrary'), where('visibility', '==', 'publico')),
        (snap) => setSharedLibrary(snap.docs.map((d) => d.data() as SharedLibraryItem)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'platformCategories'),
        (snap) => setCategoryRecords(snap.docs.map((d) => d.data() as PlatformCategoryRecord)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'institutions'),
        (snap) => setInstitutions(snap.docs.map((d) => d.data() as InstitutionRecord)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('userId', '==', user.uid)),
        (snap) => setNotifications(snap.docs.map((d) => d.data() as PlatformNotification)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'instructorVerifications'), where('userId', '==', user.uid)),
        (snap) => setMyVerifications(snap.docs.map((d) => d.data() as InstructorVerificationRequest)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'moderationReports'), where('reporterId', '==', user.uid)),
        (snap) => setMyReports(snap.docs.map((d) => d.data() as ModerationReport)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'userSanctions'), where('userId', '==', user.uid)),
        (snap) => setMySanctions(snap.docs.map((d) => d.data() as UserSanction)),
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'admins', user.uid),
        (snap) => setMyAdminDoc(snap.exists() ? (snap.data() as AdminRoleRecord) : null),
        () => setMyAdminDoc(null)
      )
    );

    // Superadmin bootstrap governance subscriptions
    if (isSuperAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'instructorVerifications'),
          (snap) => setAllVerifications(snap.docs.map((d) => d.data() as InstructorVerificationRequest)),
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'moderationReports'),
          (snap) => setAllReports(snap.docs.map((d) => d.data() as ModerationReport)),
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'userSanctions'),
          (snap) => setAllSanctions(snap.docs.map((d) => d.data() as UserSanction)),
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'adminAuditLogs'),
          (snap) => setAuditLogs(snap.docs.map((d) => d.data() as AdminAuditLog)),
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'admins'),
          (snap) => setAdminRecords(snap.docs.map((d) => d.data() as AdminRoleRecord)),
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => setAllUsersList(snap.docs.map((d) => d.data() as StudentProfile)),
          () => {}
        )
      );
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [authReady, user, profile?.isMinor, isSuperAdmin]);

  // Dynamic Academy Taxonomy (Default 7 areas + Admin custom additions)
  const taxonomy: AcademyTaxonomyGroup[] = useMemo(() => {
    const byArea = new Map<string, AcademyTaxonomyGroup>();
    for (const base of DEFAULT_ACADEMY_TAXONOMY) {
      byArea.set(base.area.toLowerCase(), {
        id: base.id,
        area: base.area,
        subcategories: [...base.subcategories],
      });
    }
    for (const rec of categoryRecords) {
      if (!rec.active) continue;
      const key = rec.area.toLowerCase();
      const existing = byArea.get(key);
      if (existing) {
        const merged = Array.from(new Set([...existing.subcategories, ...rec.subcategories]));
        byArea.set(key, { ...existing, subcategories: merged });
      } else {
        byArea.set(key, {
          id: rec.id,
          area: rec.area,
          subcategories: [...rec.subcategories],
        });
      }
    }
    return Array.from(byArea.values());
  }, [categoryRecords]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Helper: write immutable audit log entry
  const writeAuditLog = useCallback(
    async (action: string, targetType: string, targetId: string, details: string) => {
      if (!user || !isAdmin) return;
      const id = makeSafeId('log');
      await setDoc(doc(db, 'adminAuditLogs', id), {
        id,
        adminId: user.uid,
        adminEmail: (user.email || 'admin@fabro.app').slice(0, 200),
        action: action.slice(0, 160),
        targetType: targetType.slice(0, 60),
        targetId: targetId.slice(0, 128),
        details: details.slice(0, 2000),
        createdAt: serverTimestamp(),
      });
    },
    [isAdmin, user]
  );

  const sendUserNotification: PlatformContextValue['sendUserNotification'] = useCallback(
    async (targetUserId, title, body, linkSection) => {
      if (!user || !targetUserId) return;
      const id = makeSafeId('notif');
      try {
        await setDoc(doc(db, 'notifications', id), {
          id,
          userId: targetUserId,
          title: title.slice(0, 160),
          body: body.slice(0, 600),
          linkSection,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch {
        // non-blocking notification delivery
      }
    },
    [user]
  );

  const updatePresenceMode: PlatformContextValue['updatePresenceMode'] = async (mode) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      presenceMode: mode,
      updatedAt: serverTimestamp(),
    });
    const publicStatus = mode === 'invisible' ? 'offline' : mode;
    await updateDoc(doc(db, 'publicProfiles', user.uid), {
      presenceStatus: publicStatus,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  };

  const toggleFollowInstructor: PlatformContextValue['toggleFollowInstructor'] = async (instructorId) => {
    if (!user || !profile || instructorId === user.uid) return;
    const current = profile.followedInstructorIds || [];
    const already = current.includes(instructorId);
    const next = already ? current.filter((id) => id !== instructorId) : [...current, instructorId].slice(0, 200);
    await updateDoc(doc(db, 'users', user.uid), {
      followedInstructorIds: next,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'publicProfiles', instructorId), {
      followersCount: increment(already ? -1 : 1),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  };

  const toggleBlockUser: PlatformContextValue['toggleBlockUser'] = async (targetUid) => {
    if (!user || !profile || targetUid === user.uid) return;
    const current = profile.blockedUserIds || [];
    const already = current.includes(targetUid);
    const next = already ? current.filter((id) => id !== targetUid) : [...current, targetUid].slice(0, 200);
    await updateDoc(doc(db, 'users', user.uid), {
      blockedUserIds: next,
      updatedAt: serverTimestamp(),
    });
  };

  const submitInstructorVerification: PlatformContextValue['submitInstructorVerification'] = async (input) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('verif');
    let evidenceFileUrl = '';
    let evidenceFileName = '';
    if (input.evidenceFile) {
      evidenceFileName = input.evidenceFile.name.slice(0, 255);
      try {
        const sPath = `users/${user.uid}/verifications/${id}_${evidenceFileName}`;
        const ref = storageRef(storage, sPath);
        await uploadBytes(ref, input.evidenceFile);
        evidenceFileUrl = (await getDownloadURL(ref)).slice(0, 2000);
      } catch {
        evidenceFileUrl = '';
      }
    }

    await setDoc(doc(db, 'instructorVerifications', id), {
      id,
      userId: user.uid,
      applicantName: input.applicantName.trim().slice(0, 120) || profile?.displayName || 'Postulante',
      contactInfo: input.contactInfo.trim().slice(0, 200),
      country: input.country.trim().slice(0, 100),
      province: input.province.trim().slice(0, 100),
      city: input.city.trim().slice(0, 100),
      specialty: input.specialty.trim().slice(0, 150) || 'Educación general',
      category: input.category,
      experienceDetails: input.experienceDetails.trim().slice(0, 4000),
      institution: input.institution.trim().slice(0, 150),
      evidenceSummary: input.evidenceSummary.trim().slice(0, 2000),
      evidenceFileUrl,
      evidenceFileName,
      status: 'pendiente',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'users', user.uid), {
      isInstructor: true,
      instructorCategory: input.category,
      specialty: input.specialty.trim().slice(0, 150),
      experienceSummary: input.experienceDetails.trim().slice(0, 1500),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    return id;
  };

  const reviewInstructorVerification: PlatformContextValue['reviewInstructorVerification'] = async ({
    verification,
    nextStatus,
    adminNote,
  }) => {
    if (!user || !isAdmin) throw new Error('Se requieren permisos de administración');
    await updateDoc(doc(db, 'instructorVerifications', verification.id), {
      status: nextStatus,
      adminNote: adminNote.trim().slice(0, 1000),
      reviewedBy: (user.email || user.uid).slice(0, 200),
      updatedAt: serverTimestamp(),
    });

    const userApproved = nextStatus === 'aprobado';
    await updateDoc(doc(db, 'users', verification.userId), {
      verificationStatus: nextStatus,
      isInstructor: userApproved || nextStatus === 'pendiente' || nextStatus === 'requiere_documentacion',
      instructorCategory: verification.category,
      reputationPoints: increment(userApproved ? 50 : 0),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    await updateDoc(doc(db, 'publicProfiles', verification.userId), {
      verificationStatus: nextStatus,
      reputationPoints: increment(userApproved ? 50 : 0),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    await writeAuditLog(
      `Verificación docente -> ${nextStatus}`,
      'instructorVerification',
      verification.id,
      `Usuario: ${verification.applicantName} · Nota: ${adminNote}`
    );

    await sendUserNotification(
      verification.userId,
      userApproved ? '¡Acreditación de instructor aprobada!' : `Actualización de solicitud docente: ${nextStatus}`,
      adminNote || (userApproved ? 'Ya podés publicar cursos con insignia verificada en FABRO Academy.' : 'Revisá los detalles en tu perfil.'),
      'perfil'
    );
  };

  // Courses & Academy
  const createCourse: PlatformContextValue['createCourse'] = async (input) => {
    if (!user) throw new Error('No autenticado');
    const courseId = makeSafeId('crs');
    const isVerifiedInstructor = profile?.verificationStatus === 'aprobado';
    let linkedGroupId = '';

    if (input.createLinkedGroup) {
      linkedGroupId = makeSafeId('grp');
      const groupName = `Comunidad · ${input.title.trim().slice(0, 120)}`;
      await setDoc(doc(db, 'groups', linkedGroupId), {
        id: linkedGroupId,
        creatorId: user.uid,
        creatorName: (profile?.displayName || user.displayName || 'Docente').slice(0, 120),
        name: groupName,
        description: `Espacio de intercambio y consultas del curso gratuito "${input.title.trim()}".`.slice(0, 3000),
        groupType: input.area === 'Oficios' ? 'oficios' : input.area === 'Idiomas' ? 'idiomas' : 'libre',
        visibility: input.visibility === 'institucional' ? 'institucional' : 'publico',
        country: profile?.country || '',
        province: profile?.province || '',
        city: profile?.city || '',
        institutionName: input.institution.trim().slice(0, 150),
        career: input.category.trim().slice(0, 150),
        courseName: input.title.trim().slice(0, 150),
        subjectName: input.category.trim().slice(0, 150),
        specialty: input.area.trim().slice(0, 150),
        linkedCourseId: courseId,
        allowMinors: true,
        memberCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'groups', linkedGroupId, 'members', user.uid), {
        userId: user.uid,
        groupId: linkedGroupId,
        displayName: (profile?.displayName || user.displayName || 'Docente').slice(0, 120),
        role: 'docente',
        status: 'activo',
        isMinor: Boolean(profile?.isMinor),
        joinedAt: serverTimestamp(),
      });
    }

    await setDoc(doc(db, 'courses', courseId), {
      id: courseId,
      instructorId: user.uid,
      instructorName: (profile?.displayName || user.displayName || 'Instructor').slice(0, 120),
      instructorVerified: isVerifiedInstructor,
      instructorCategory: profile?.instructorCategory || 'instructor_independiente',
      title: input.title.trim().slice(0, 160),
      description: input.description.trim().slice(0, 4000),
      area: input.area.trim().slice(0, 100),
      category: input.category.trim().slice(0, 100),
      level: input.level,
      objectives: input.objectives.trim().slice(0, 3000),
      syllabus: input.syllabus.trim().slice(0, 15000),
      estimatedHours: Math.max(1, Math.min(2000, Number(input.estimatedHours) || 4)),
      lessonsCount: 0,
      visibility: input.visibility,
      institution: input.institution.trim().slice(0, 150),
      isFree: true,
      certificateEnabled: Boolean(input.certificateEnabled),
      linkedGroupId,
      bibliography: input.bibliography.trim().slice(0, 8000),
      enrolledCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      status: 'activo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return courseId;
  };

  const updateCourse: PlatformContextValue['updateCourse'] = async (courseId, patch) => {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.title !== undefined) clean.title = patch.title.trim().slice(0, 160);
    if (patch.description !== undefined) clean.description = patch.description.trim().slice(0, 4000);
    if (patch.area !== undefined) clean.area = patch.area.trim().slice(0, 100);
    if (patch.category !== undefined) clean.category = patch.category.trim().slice(0, 100);
    if (patch.level !== undefined) clean.level = patch.level;
    if (patch.objectives !== undefined) clean.objectives = patch.objectives.trim().slice(0, 3000);
    if (patch.syllabus !== undefined) clean.syllabus = patch.syllabus.trim().slice(0, 15000);
    if (patch.visibility !== undefined) clean.visibility = patch.visibility;
    if (patch.status !== undefined) clean.status = patch.status;
    if (patch.bibliography !== undefined) clean.bibliography = patch.bibliography.trim().slice(0, 8000);
    await updateDoc(doc(db, 'courses', courseId), clean);
  };

  const deleteCourse: PlatformContextValue['deleteCourse'] = async (courseId) => {
    await deleteDoc(doc(db, 'courses', courseId));
  };

  const subscribeCourseLessons: PlatformContextValue['subscribeCourseLessons'] = useCallback(
    (courseId, cb) => {
      return onSnapshot(
        collection(db, 'courses', courseId, 'lessons'),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as CourseLesson)
            .sort((a, b) => a.orderIndex - b.orderIndex);
          cb(list);
        },
        () => cb([])
      );
    },
    []
  );

  const addCourseLesson: PlatformContextValue['addCourseLesson'] = async (courseId, input) => {
    if (!user) throw new Error('No autenticado');
    const lessonId = makeSafeId('les');
    let materialPdfUrl = (input.materialPdfUrl || '').trim().slice(0, 2000);
    let materialPdfName = (input.materialPdfName || '').trim().slice(0, 255);

    if (input.materialPdfFile) {
      materialPdfName = input.materialPdfFile.name.slice(0, 255);
      try {
        const ref = storageRef(storage, `users/${user.uid}/courses/${courseId}/${lessonId}_${materialPdfName}`);
        await uploadBytes(ref, input.materialPdfFile);
        materialPdfUrl = (await getDownloadURL(ref)).slice(0, 2000);
      } catch {
        materialPdfUrl = '';
      }
    }

    await setDoc(doc(db, 'courses', courseId, 'lessons', lessonId), {
      id: lessonId,
      courseId,
      instructorId: user.uid,
      orderIndex: Math.max(0, Math.min(500, Math.round(input.orderIndex))),
      title: input.title.trim().slice(0, 180),
      description: input.description.trim().slice(0, 8000),
      videoUrl: input.videoUrl.trim().slice(0, 1000),
      youtubeVideoId: input.youtubeVideoId.trim().slice(0, 40),
      materialPdfUrl,
      materialPdfName,
      activityPrompt: input.activityPrompt.trim().slice(0, 5000),
      quizQuestions: input.quizQuestions.slice(0, 40),
      durationMinutes: Math.max(0, Math.min(1000, Math.round(input.durationMinutes || 15))),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'courses', courseId), {
      lessonsCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    return lessonId;
  };

  const deleteCourseLesson: PlatformContextValue['deleteCourseLesson'] = async (
    courseId,
    lessonId,
    currentCount
  ) => {
    await deleteDoc(doc(db, 'courses', courseId, 'lessons', lessonId));
    await updateDoc(doc(db, 'courses', courseId), {
      lessonsCount: Math.max(0, currentCount - 1),
      updatedAt: serverTimestamp(),
    });
  };

  const enrollInCourse: PlatformContextValue['enrollInCourse'] = async (course) => {
    if (!user) return;
    const existing = enrollments.find((e) => e.courseId === course.id);
    if (existing) return;
    const id = makeSafeId('enr');
    await setDoc(doc(db, 'courseEnrollments', id), {
      id,
      userId: user.uid,
      courseId: course.id,
      instructorId: course.instructorId,
      status: 'activo',
      completedLessonIds: [],
      quizScores: {},
      progressPercent: 0,
      favorite: false,
      studentRating: 0,
      certificateIssued: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'courses', course.id), {
      enrolledCount: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    // Automatically add student to linked course group if public
    if (course.linkedGroupId) {
      await setDoc(doc(db, 'groups', course.linkedGroupId, 'members', user.uid), {
        userId: user.uid,
        groupId: course.linkedGroupId,
        displayName: (profile?.displayName || user.displayName || 'Usuario FABRO').slice(0, 120),
        role: 'miembro',
        status: 'activo',
        isMinor: Boolean(profile?.isMinor),
        joinedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const unenrollFromCourse: PlatformContextValue['unenrollFromCourse'] = async (enrollmentId, courseId) => {
    await deleteDoc(doc(db, 'courseEnrollments', enrollmentId));
    await updateDoc(doc(db, 'courses', courseId), {
      enrolledCount: increment(-1),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  };

  const toggleCourseFavorite: PlatformContextValue['toggleCourseFavorite'] = async (
    enrollmentId,
    currentFavorite
  ) => {
    await updateDoc(doc(db, 'courseEnrollments', enrollmentId), {
      favorite: !currentFavorite,
      updatedAt: serverTimestamp(),
    });
  };

  const markLessonCompleted: PlatformContextValue['markLessonCompleted'] = async ({
    enrollment,
    lessonId,
    totalLessons,
    quizScore,
  }) => {
    const completed = Array.from(new Set([...enrollment.completedLessonIds, lessonId])).slice(0, 500);
    const nextScores = { ...enrollment.quizScores };
    if (typeof quizScore === 'number') {
      nextScores[lessonId] = quizScore;
    }
    const denom = Math.max(1, totalLessons);
    const progressPercent = Math.min(100, Math.round((completed.length / denom) * 100));
    const isCompleted = progressPercent >= 100;
    await updateDoc(doc(db, 'courseEnrollments', enrollment.id), {
      completedLessonIds: completed,
      quizScores: nextScores,
      progressPercent,
      status: isCompleted ? 'completado' : 'activo',
      certificateIssued: isCompleted ? true : enrollment.certificateIssued,
      updatedAt: serverTimestamp(),
    });
  };

  const rateCourse: PlatformContextValue['rateCourse'] = async (enrollment, course, rating) => {
    const cleanRating = Math.max(1, Math.min(5, Math.round(rating)));
    const prevRating = enrollment.studentRating || 0;
    await updateDoc(doc(db, 'courseEnrollments', enrollment.id), {
      studentRating: cleanRating,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'courses', course.id), {
      ratingSum: Math.max(0, (course.ratingSum || 0) - prevRating + cleanRating),
      ratingCount: prevRating > 0 ? course.ratingCount : (course.ratingCount || 0) + 1,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  };

  // Groups & Communities
  const createGroup: PlatformContextValue['createGroup'] = async (input) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('grp');
    const creatorName = (profile?.displayName || user.displayName || 'Usuario FABRO').slice(0, 120);
    await setDoc(doc(db, 'groups', id), {
      id,
      creatorId: user.uid,
      creatorName,
      name: input.name.trim().slice(0, 160),
      description: input.description.trim().slice(0, 3000),
      groupType: input.groupType,
      visibility: input.visibility,
      country: input.country.trim().slice(0, 100),
      province: input.province.trim().slice(0, 100),
      city: input.city.trim().slice(0, 100),
      institutionName: input.institutionName.trim().slice(0, 150),
      career: input.career.trim().slice(0, 150),
      courseName: input.courseName.trim().slice(0, 150),
      subjectName: input.subjectName.trim().slice(0, 150),
      specialty: input.specialty.trim().slice(0, 150),
      linkedCourseId: (input.linkedCourseId || '').slice(0, 128),
      allowMinors: Boolean(input.allowMinors),
      memberCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'groups', id, 'members', user.uid), {
      userId: user.uid,
      groupId: id,
      displayName: creatorName,
      role: 'admin',
      status: 'activo',
      isMinor: Boolean(profile?.isMinor),
      joinedAt: serverTimestamp(),
    });

    return id;
  };

  const joinGroup: PlatformContextValue['joinGroup'] = async (group) => {
    if (!user) throw new Error('No autenticado');
    const needsApproval =
      group.visibility === 'privado' || group.visibility === 'aprobado_docente';
    const nextStatus: GroupMember['status'] = needsApproval ? 'pendiente' : 'activo';
    await setDoc(doc(db, 'groups', group.id, 'members', user.uid), {
      userId: user.uid,
      groupId: group.id,
      displayName: (profile?.displayName || user.displayName || 'Usuario FABRO').slice(0, 120),
      role: 'miembro',
      status: nextStatus,
      isMinor: Boolean(profile?.isMinor),
      joinedAt: serverTimestamp(),
    });
    if (nextStatus === 'activo') {
      await updateDoc(doc(db, 'groups', group.id), {
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    } else {
      await sendUserNotification(
        group.creatorId,
        'Nueva solicitud de ingreso a grupo',
        `${profile?.displayName || 'Un usuario'} solicitó unirse a "${group.name}".`,
        'comunidad'
      );
    }
    return nextStatus;
  };

  const leaveGroup: PlatformContextValue['leaveGroup'] = async (groupId) => {
    if (!user) return;
    await deleteDoc(doc(db, 'groups', groupId, 'members', user.uid));
    await updateDoc(doc(db, 'groups', groupId), {
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  };

  const updateGroupMemberStatus: PlatformContextValue['updateGroupMemberStatus'] = async (
    groupId,
    memberId,
    status,
    role
  ) => {
    const memberRef = doc(db, 'groups', groupId, 'members', memberId);
    const snap = await getDoc(memberRef);
    const prevStatus = snap.exists() ? (snap.data() as GroupMember).status : 'pendiente';
    const patch: Record<string, unknown> = { status };
    if (role) patch.role = role;
    await updateDoc(memberRef, patch);
    if (prevStatus !== 'activo' && status === 'activo') {
      await updateDoc(doc(db, 'groups', groupId), {
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      await sendUserNotification(
        memberId,
        'Ingreso aprobado al grupo',
        'Tu solicitud de ingreso fue aceptada. Ya podés participar del muro y el chat.',
        'comunidad'
      );
    }
  };

  const subscribeGroupMembers: PlatformContextValue['subscribeGroupMembers'] = useCallback(
    (groupId, cb) =>
      onSnapshot(
        collection(db, 'groups', groupId, 'members'),
        (snap) => cb(snap.docs.map((d) => d.data() as GroupMember)),
        () => cb([])
      ),
    []
  );

  const subscribeGroupPosts: PlatformContextValue['subscribeGroupPosts'] = useCallback(
    (groupId, cb) =>
      onSnapshot(
        collection(db, 'groups', groupId, 'posts'),
        (snap) => cb(snap.docs.map((d) => d.data() as GroupPost)),
        () => cb([])
      ),
    []
  );

  const subscribeGroupMessages: PlatformContextValue['subscribeGroupMessages'] = useCallback(
    (groupId, cb) =>
      onSnapshot(
        collection(db, 'groups', groupId, 'messages'),
        (snap) => cb(snap.docs.map((d) => d.data() as GroupChatMessage)),
        () => cb([])
      ),
    []
  );

  const createGroupPost: PlatformContextValue['createGroupPost'] = async (groupId, input) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('post');
    const pollOptions = (input.pollLabels || [])
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 15)
      .map((label, idx) => ({
        id: `opt_${idx + 1}`,
        label: label.slice(0, 120),
        voterIds: [],
      }));

    await setDoc(doc(db, 'groups', groupId, 'posts', id), {
      id,
      groupId,
      authorId: user.uid,
      authorName: (profile?.displayName || user.displayName || 'Miembro').slice(0, 120),
      authorVerified: profile?.verificationStatus === 'aprobado',
      postType: input.postType,
      title: input.title.trim().slice(0, 200),
      content: input.content.trim().slice(0, 12000),
      attachmentUrl: (input.attachmentUrl || '').slice(0, 2000),
      attachmentName: (input.attachmentName || '').slice(0, 255),
      youtubeVideoId: (input.youtubeVideoId || '').slice(0, 40),
      pollOptions,
      comments: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  };

  const addGroupPostComment: PlatformContextValue['addGroupPostComment'] = async (
    groupId,
    post,
    text
  ) => {
    if (!user || !text.trim()) return;
    const nextComments = [
      ...post.comments,
      {
        id: makeSafeId('cmt'),
        authorId: user.uid,
        authorName: (profile?.displayName || user.displayName || 'Miembro').slice(0, 120),
        text: text.trim().slice(0, 1200),
        createdAt: new Date().toISOString(),
      },
    ].slice(-300);
    await updateDoc(doc(db, 'groups', groupId, 'posts', post.id), {
      comments: nextComments,
      updatedAt: serverTimestamp(),
    });
  };

  const voteGroupPoll: PlatformContextValue['voteGroupPoll'] = async (
    groupId,
    post,
    optionId
  ) => {
    if (!user) return;
    const nextOptions = post.pollOptions.map((opt) => {
      const cleaned = opt.voterIds.filter((v) => v !== user.uid);
      return opt.id === optionId ? { ...opt, voterIds: [...cleaned, user.uid] } : { ...opt, voterIds: cleaned };
    });
    await updateDoc(doc(db, 'groups', groupId, 'posts', post.id), {
      pollOptions: nextOptions,
      updatedAt: serverTimestamp(),
    });
  };

  const sendGroupChatMessage: PlatformContextValue['sendGroupChatMessage'] = async (
    groupId,
    text,
    attachment
  ) => {
    if (!user || !text.trim()) return;
    const id = makeSafeId('gmsg');
    await setDoc(doc(db, 'groups', groupId, 'messages', id), {
      id,
      groupId,
      senderId: user.uid,
      senderName: (profile?.displayName || user.displayName || 'Miembro').slice(0, 120),
      text: text.trim().slice(0, 5000),
      ...(attachment?.url ? { attachmentUrl: attachment.url.slice(0, 2000) } : {}),
      ...(attachment?.name ? { attachmentName: attachment.name.slice(0, 255) } : {}),
      createdAt: serverTimestamp(),
    });
  };

  // Virtual Classrooms
  const createClassroom: PlatformContextValue['createClassroom'] = async (input) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('aula');
    await setDoc(doc(db, 'classrooms', id), {
      id,
      instructorId: user.uid,
      instructorName: (profile?.displayName || user.displayName || 'Docente').slice(0, 120),
      courseId: input.courseId.slice(0, 128),
      title: input.title.trim().slice(0, 180),
      description: input.description.trim().slice(0, 4000),
      scheduledAt: input.scheduledAt.trim().slice(0, 60),
      visibility: input.visibility,
      allowedStudentIds: [],
      youtubeVideoId: input.youtubeVideoId.trim().slice(0, 40),
      videoTitle: input.videoTitle.trim().slice(0, 250),
      playbackState: 'paused',
      playbackSeconds: 0,
      playbackUpdatedAt: new Date().toISOString(),
      presentationNotes: input.presentationNotes.trim().slice(0, 20000),
      sharedLinks: [],
      sharedDocTitles: [],
      activeQuiz: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  };

  const updateClassroomPlayback: PlatformContextValue['updateClassroomPlayback'] = async (
    classroomId,
    patch
  ) => {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'classrooms', classroomId), {
      ...(patch.youtubeVideoId !== undefined ? { youtubeVideoId: patch.youtubeVideoId.slice(0, 40) } : {}),
      ...(patch.videoTitle !== undefined ? { videoTitle: patch.videoTitle.slice(0, 250) } : {}),
      playbackState: patch.playbackState,
      playbackSeconds: Math.max(0, Math.round(patch.playbackSeconds)),
      playbackUpdatedAt: nowIso,
      updatedAt: serverTimestamp(),
    });
    sendClassroomSync({
      classroomId,
      youtubeVideoId: patch.youtubeVideoId,
      playbackState: patch.playbackState,
      playbackSeconds: Math.max(0, Math.round(patch.playbackSeconds)),
      updatedAt: nowIso,
    });
  };

  const updateClassroomMaterials: PlatformContextValue['updateClassroomMaterials'] = async (
    classroomId,
    patch
  ) => {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.presentationNotes !== undefined) clean.presentationNotes = patch.presentationNotes.slice(0, 20000);
    if (patch.sharedLinks !== undefined) clean.sharedLinks = patch.sharedLinks.slice(0, 30);
    if (patch.sharedDocTitles !== undefined) clean.sharedDocTitles = patch.sharedDocTitles.slice(0, 30);
    if (patch.activeQuiz !== undefined) clean.activeQuiz = patch.activeQuiz;
    await updateDoc(doc(db, 'classrooms', classroomId), clean);
    sendClassroomSync({
      classroomId,
      presentationNotes: patch.presentationNotes,
      activeQuiz: patch.activeQuiz,
      updatedAt: new Date().toISOString(),
    });
  };

  const answerClassroomQuiz: PlatformContextValue['answerClassroomQuiz'] = async (
    classroom,
    optionIndex
  ) => {
    if (!user || !classroom.activeQuiz) return;
    const nextQuiz: ClassroomQuizItem = {
      ...classroom.activeQuiz,
      responses: {
        ...(classroom.activeQuiz.responses || {}),
        [user.uid]: optionIndex,
      },
    };
    await updateDoc(doc(db, 'classrooms', classroom.id), {
      activeQuiz: nextQuiz,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteClassroom: PlatformContextValue['deleteClassroom'] = async (classroomId) => {
    await deleteDoc(doc(db, 'classrooms', classroomId));
  };

  // Direct Messaging with Strict Minor Safeguards
  const startOrGetDirectThread: PlatformContextValue['startOrGetDirectThread'] = async (
    targetProfile
  ) => {
    if (!user || !profile) throw new Error('No autenticado');
    if (profile.isMinor) {
      throw new Error('Protección de menores activa: los mensajes privados 1:1 están deshabilitados para cuentas menores de 18 años.');
    }
    if (targetProfile.isMinor) {
      throw new Error('Protección de menores activa: no es posible iniciar mensajes privados 1:1 con estudiantes menores de edad.');
    }
    if ((profile.blockedUserIds || []).includes(targetProfile.uid)) {
      throw new Error('Desbloqueá primero a este usuario para enviarle mensajes.');
    }

    const pair = [user.uid, targetProfile.uid].sort();
    const existing = directThreads.find(
      (t) => t.participantIds.includes(pair[0]) && t.participantIds.includes(pair[1])
    );
    if (existing) {
      setSelectedDirectThreadId(existing.id);
      return existing.id;
    }

    const id = `dm_${pair[0].slice(0, 20)}_${pair[1].slice(0, 20)}`.slice(0, 120);
    const snap = await getDoc(doc(db, 'directThreads', id));
    if (snap.exists()) {
      setSelectedDirectThreadId(id);
      return id;
    }

    await setDoc(doc(db, 'directThreads', id), {
      id,
      participantIds: pair,
      participantNames:
        pair[0] === user.uid
          ? [profile.displayName, targetProfile.displayName]
          : [targetProfile.displayName, profile.displayName],
      hasMinorParticipant: false,
      status: 'activo',
      blockedBy: '',
      lastMessagePreview: '',
      unreadBy: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setSelectedDirectThreadId(id);
    return id;
  };

  const subscribeDirectMessages: PlatformContextValue['subscribeDirectMessages'] = useCallback(
    (threadId, cb) =>
      onSnapshot(
        collection(db, 'directThreads', threadId, 'messages'),
        (snap) => cb(snap.docs.map((d) => d.data() as DirectMessage)),
        () => cb([])
      ),
    []
  );

  const sendDirectMessage: PlatformContextValue['sendDirectMessage'] = async (
    thread,
    text,
    attachment
  ) => {
    if (!user || !text.trim()) return;
    if (profile?.isMinor || thread.hasMinorParticipant) {
      throw new Error('Mensajería privada bloqueada por protección de menores.');
    }
    if (thread.status === 'bloqueado') {
      throw new Error('Esta conversación está bloqueada.');
    }
    const id = makeSafeId('dmsg');
    const cleanText = text.trim().slice(0, 5000);
    const recipientIds = thread.participantIds.filter((pid) => pid !== user.uid);

    await setDoc(doc(db, 'directThreads', thread.id, 'messages', id), {
      id,
      threadId: thread.id,
      senderId: user.uid,
      senderName: (profile?.displayName || user.displayName || 'Usuario').slice(0, 120),
      text: cleanText,
      ...(attachment?.url ? { attachmentUrl: attachment.url.slice(0, 2000) } : {}),
      ...(attachment?.name ? { attachmentName: attachment.name.slice(0, 255) } : {}),
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'directThreads', thread.id), {
      lastMessagePreview: cleanText.slice(0, 200),
      unreadBy: recipientIds,
      updatedAt: serverTimestamp(),
    });
  };

  const toggleBlockDirectThread: PlatformContextValue['toggleBlockDirectThread'] = async (thread) => {
    if (!user) return;
    const isBlocked = thread.status === 'bloqueado';
    await updateDoc(doc(db, 'directThreads', thread.id), {
      status: isBlocked ? 'activo' : 'bloqueado',
      blockedBy: isBlocked ? '' : user.uid,
      updatedAt: serverTimestamp(),
    });
  };

  const markThreadRead: PlatformContextValue['markThreadRead'] = async (thread) => {
    if (!user || !thread.unreadBy.includes(user.uid)) return;
    await updateDoc(doc(db, 'directThreads', thread.id), {
      unreadBy: thread.unreadBy.filter((uid) => uid !== user.uid),
      updatedAt: serverTimestamp(),
    });
  };

  // Video Learning
  const saveVideoResource: PlatformContextValue['saveVideoResource'] = async (input) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('vid');
    await setDoc(doc(db, 'youtubeVideos', id), {
      id,
      addedBy: user.uid,
      addedByName: (profile?.displayName || user.displayName || 'Usuario FABRO').slice(0, 120),
      youtubeVideoId: input.youtubeVideoId.slice(0, 40),
      title: input.title.trim().slice(0, 250),
      channelTitle: input.channelTitle.trim().slice(0, 150),
      thumbnailUrl: input.thumbnailUrl.trim().slice(0, 1000),
      youtubeUrl: input.youtubeUrl.trim().slice(0, 1000),
      area: input.area.trim().slice(0, 100),
      subjectTag: input.subjectTag.trim().slice(0, 150),
      keywords: input.keywords.slice(0, 20).map((k) => k.trim().slice(0, 60)).filter(Boolean),
      transcriptAvailable: Boolean(input.transcriptAvailable),
      transcriptText: input.transcriptText.slice(0, 200000),
      aiSummaryMarkdown: input.aiSummaryMarkdown.slice(0, 100000),
      isPublic: Boolean(input.isPublic),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  };

  const deleteVideoResource: PlatformContextValue['deleteVideoResource'] = async (id) => {
    await deleteDoc(doc(db, 'youtubeVideos', id));
  };

  // Shared Library
  const uploadSharedLibraryItem: PlatformContextValue['uploadSharedLibraryItem'] = async (input) => {
    if (!user) throw new Error('No autenticado');
    if (!input.authorConfirmedRights) {
      throw new Error('Debés confirmar que tenés derechos o que el material es de dominio público/autorizado.');
    }
    const id = makeSafeId('slib');
    let fileUrl = (input.externalUrl || '').trim().slice(0, 2000);
    let fileName = input.file?.name.slice(0, 255) || `${input.title.trim().slice(0, 80)}.url`;

    if (input.file) {
      try {
        const ref = storageRef(storage, `sharedLibrary/${user.uid}/${id}_${fileName}`);
        await uploadBytes(ref, input.file);
        fileUrl = (await getDownloadURL(ref)).slice(0, 2000);
      } catch {
        if (!fileUrl) {
          throw new Error('No se pudo subir el archivo a Firebase Storage. Verificá que Storage esté habilitado o adjuntá un enlace directo.');
        }
      }
    }

    if (!fileUrl) {
      throw new Error('Adjuntá un archivo o ingresá un enlace oficial válido.');
    }

    await setDoc(doc(db, 'sharedLibrary', id), {
      id,
      uploaderId: user.uid,
      uploaderName: (profile?.displayName || user.displayName || 'Colaborador').slice(0, 120),
      title: input.title.trim().slice(0, 200),
      description: input.description.trim().slice(0, 3000),
      itemType: input.itemType,
      area: input.area.trim().slice(0, 100) || 'Educación general',
      career: input.career.trim().slice(0, 150),
      subjectName: input.subjectName.trim().slice(0, 150),
      courseName: input.courseName.trim().slice(0, 150),
      fileUrl,
      fileName,
      authorConfirmedRights: true,
      visibility: input.visibility,
      downloadsCount: 0,
      favoriteUserIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  };

  const incrementSharedDownload: PlatformContextValue['incrementSharedDownload'] = async (item) => {
    await updateDoc(doc(db, 'sharedLibrary', item.id), {
      downloadsCount: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  };

  const toggleSharedFavorite: PlatformContextValue['toggleSharedFavorite'] = async (item) => {
    if (!user) return;
    const exists = item.favoriteUserIds.includes(user.uid);
    const next = exists
      ? item.favoriteUserIds.filter((uid) => uid !== user.uid)
      : [...item.favoriteUserIds, user.uid];
    await updateDoc(doc(db, 'sharedLibrary', item.id), {
      favoriteUserIds: next,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteSharedLibraryItem: PlatformContextValue['deleteSharedLibraryItem'] = async (id) => {
    await deleteDoc(doc(db, 'sharedLibrary', id));
  };

  // Institutions & Governance
  const createInstitution: PlatformContextValue['createInstitution'] = async (input) => {
    const id = makeSafeId('inst');
    await setDoc(doc(db, 'institutions', id), {
      id,
      name: input.name.trim().slice(0, 180),
      institutionType: input.institutionType,
      country: input.country.trim().slice(0, 100),
      province: input.province.trim().slice(0, 100),
      city: input.city.trim().slice(0, 100),
      verified: false,
      status: 'activa',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  };

  const updateInstitutionAdmin: PlatformContextValue['updateInstitutionAdmin'] = async (
    instId,
    patch
  ) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'institutions', instId), {
      ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog('Actualización de institución', 'institution', instId, JSON.stringify(patch));
  };

  const savePlatformCategory: PlatformContextValue['savePlatformCategory'] = async (cat) => {
    if (!user || !isAdmin) return;
    const id = cat.id || makeSafeId('cat');
    await setDoc(doc(db, 'platformCategories', id), {
      id,
      area: cat.area.trim().slice(0, 100),
      subcategories: cat.subcategories.slice(0, 60).map((s) => s.trim().slice(0, 100)).filter(Boolean),
      active: Boolean(cat.active),
      createdBy: (user.email || user.uid).slice(0, 200),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog('Actualización de categoría Academy', 'platformCategory', id, cat.area);
  };

  const deletePlatformCategory: PlatformContextValue['deletePlatformCategory'] = async (catId) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, 'platformCategories', catId));
    await writeAuditLog('Eliminación de categoría Academy', 'platformCategory', catId, 'Eliminada');
  };

  const submitModerationReport: PlatformContextValue['submitModerationReport'] = async (input) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('rep');
    await setDoc(doc(db, 'moderationReports', id), {
      id,
      reporterId: user.uid,
      reporterName: (profile?.displayName || user.displayName || 'Usuario').slice(0, 120),
      targetType: input.targetType,
      targetId: input.targetId.slice(0, 128),
      targetSummary: input.targetSummary.trim().slice(0, 300),
      reason: input.reason.trim().slice(0, 160),
      details: input.details.trim().slice(0, 3000),
      status: 'pendiente',
      resolutionNote: '',
      reviewedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  };

  const resolveModerationReport: PlatformContextValue['resolveModerationReport'] = async (
    reportId,
    status,
    resolutionNote
  ) => {
    if (!user || !isAdmin) return;
    await updateDoc(doc(db, 'moderationReports', reportId), {
      status,
      resolutionNote: resolutionNote.trim().slice(0, 2000),
      reviewedBy: (user.email || user.uid).slice(0, 200),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(`Reporte -> ${status}`, 'moderationReport', reportId, resolutionNote);
  };

  const issueUserSanction: PlatformContextValue['issueUserSanction'] = async (input) => {
    if (!user || !isAdmin) return;
    const id = makeSafeId('sanc');
    await setDoc(doc(db, 'userSanctions', id), {
      id,
      userId: input.userId,
      userName: input.userName.slice(0, 120),
      sanctionType: input.sanctionType,
      reason: input.reason.trim().slice(0, 2000),
      status: input.sanctionType === 'reactivacion' ? 'levantada' : 'activa',
      appealText: '',
      issuedBy: (user.email || user.uid).slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const nextAccountStatus: AccountStatus =
      input.sanctionType === 'suspension'
        ? 'suspendido'
        : input.sanctionType === 'advertencia'
          ? 'advertido'
          : 'activo';

    const userPatch: Record<string, unknown> = {
      accountStatus: nextAccountStatus,
      updatedAt: serverTimestamp(),
    };
    if (input.sanctionType === 'revocacion_docente') {
      userPatch.verificationStatus = 'revocado';
      await updateDoc(doc(db, 'publicProfiles', input.userId), {
        verificationStatus: 'revocado',
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    await updateDoc(doc(db, 'users', input.userId), userPatch).catch(() => {});
    await writeAuditLog(`Sanción: ${input.sanctionType}`, 'user', input.userId, input.reason);
    await sendUserNotification(
      input.userId,
      `Aviso de moderación: ${input.sanctionType}`,
      input.reason,
      'perfil'
    );
  };

  const submitSanctionAppeal: PlatformContextValue['submitSanctionAppeal'] = async (
    sanctionId,
    appealText
  ) => {
    await updateDoc(doc(db, 'userSanctions', sanctionId), {
      appealText: appealText.trim().slice(0, 3000),
      status: 'pendiente_apelacion',
      updatedAt: serverTimestamp(),
    });
  };

  const resolveSanctionAppeal: PlatformContextValue['resolveSanctionAppeal'] = async (
    sanction,
    accept
  ) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'userSanctions', sanction.id), {
      status: accept ? 'apelacion_aceptada' : 'activa',
      updatedAt: serverTimestamp(),
    });
    if (accept) {
      await updateDoc(doc(db, 'users', sanction.userId), {
        accountStatus: 'activo',
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    await writeAuditLog(
      accept ? 'Apelación aceptada' : 'Apelación rechazada',
      'userSanction',
      sanction.id,
      sanction.userName
    );
  };

  const assignAdminRole: PlatformContextValue['assignAdminRole'] = async (uid, email, role) => {
    if (!user || !isSuperAdmin) return;
    await setDoc(doc(db, 'admins', uid), {
      uid,
      email: email.trim().slice(0, 200),
      role,
      grantedBy: (user.email || user.uid).slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(`Asignación rol ${role}`, 'admin', uid, email);
  };

  const revokeAdminRole: PlatformContextValue['revokeAdminRole'] = async (uid) => {
    if (!isSuperAdmin) return;
    await deleteDoc(doc(db, 'admins', uid));
    await writeAuditLog('Revocación rol administrador', 'admin', uid, 'Rol removido');
  };

  const markNotificationRead: PlatformContextValue['markNotificationRead'] = async (notifId) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  };

  const markAllNotificationsRead: PlatformContextValue['markAllNotificationsRead'] = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true })));
  };

  return (
    <PlatformContext.Provider
      value={{
        isSuperAdmin,
        isAdmin,
        adminRole,
        publicProfiles,
        courses,
        enrollments,
        groups,
        classrooms,
        directThreads,
        youtubeVideos,
        sharedLibrary,
        taxonomy,
        categoryRecords,
        institutions,
        notifications,
        unreadNotificationsCount,
        myVerifications,
        allVerifications,
        myReports,
        allReports,
        mySanctions,
        allSanctions,
        auditLogs,
        adminRecords,
        allUsersList,
        wsConnected,
        onlinePeers,
        classroomPeersCount,
        activeClassroomRoomId,
        setActiveClassroomRoomId,
        lastClassroomSync,
        sendClassroomSync,
        myPublicProfile,
        selectedDirectThreadId,
        setSelectedDirectThreadId,
        updatePresenceMode,
        toggleFollowInstructor,
        toggleBlockUser,
        submitInstructorVerification,
        reviewInstructorVerification,
        createCourse,
        updateCourse,
        deleteCourse,
        subscribeCourseLessons,
        addCourseLesson,
        deleteCourseLesson,
        enrollInCourse,
        unenrollFromCourse,
        toggleCourseFavorite,
        markLessonCompleted,
        rateCourse,
        createGroup,
        joinGroup,
        leaveGroup,
        updateGroupMemberStatus,
        subscribeGroupMembers,
        subscribeGroupPosts,
        subscribeGroupMessages,
        createGroupPost,
        addGroupPostComment,
        voteGroupPoll,
        sendGroupChatMessage,
        createClassroom,
        updateClassroomPlayback,
        updateClassroomMaterials,
        answerClassroomQuiz,
        deleteClassroom,
        startOrGetDirectThread,
        subscribeDirectMessages,
        sendDirectMessage,
        toggleBlockDirectThread,
        markThreadRead,
        saveVideoResource,
        deleteVideoResource,
        uploadSharedLibraryItem,
        incrementSharedDownload,
        toggleSharedFavorite,
        deleteSharedLibraryItem,
        createInstitution,
        updateInstitutionAdmin,
        savePlatformCategory,
        deletePlatformCategory,
        submitModerationReport,
        resolveModerationReport,
        issueUserSanction,
        submitSanctionAppeal,
        resolveSanctionAppeal,
        assignAdminRole,
        revokeAdminRole,
        markNotificationRead,
        markAllNotificationsRead,
        sendUserNotification,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform debe usarse dentro de PlatformProvider');
  return ctx;
}
