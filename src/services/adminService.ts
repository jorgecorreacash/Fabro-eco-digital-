import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  ALL_ADMIN_PERMISSIONS,
  canManageTargetRole,
  computeEffectivePermissions,
  PRIMARY_SUPERADMIN_EMAIL,
  type AdminAuditLogRecord,
  type AdminPermission,
  type AdminRole,
  type AdminSettingsRecord,
  type AdminStaffRecord,
  type DirectoryUserRecord,
  type IdeaCategoryId,
  type IdeaCommentItem,
  type IdeaProposalRecord,
  type IdeaStatus,
  type ModerationReportRecord,
  type PlatformEventRecord,
  type PlatformEventStatus,
  type PlatformSectorRecord,
  type ReportStatus,
  type ReportTargetType,
  type SanctionType,
  type SectorRequestRecord,
  type SectorRequestStatus,
  type StaffRole,
  type UserAccountStatus,
  type UserRestrictionFlag,
  type UserRestrictionRecord,
  type UserSanctionRecord,
} from '../types/admin';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function toIsoString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    try {
      return (val as Timestamp).toDate().toISOString();
    } catch {
      return '';
    }
  }
  return '';
}

export interface StaffActor {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

export interface VerifiedAdminAccess {
  isStaff: boolean;
  role: AdminRole;
  permissions: AdminPermission[];
  allowedSectors: string[];
  staffRecord: AdminStaffRecord | null;
  verifiedAtServer: boolean;
}

/**
 * Verifies administrative privileges STRICTLY against Firebase Auth + Firestore `admins/{uid}`.
 * NEVER reads or trusts localStorage.
 */
export async function fetchServerAdminAccess(user: {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
} | null): Promise<VerifiedAdminAccess> {
  if (!user || !user.uid || !user.emailVerified) {
    return {
      isStaff: false,
      role: 'usuario',
      permissions: [],
      allowedSectors: [],
      staffRecord: null,
      verifiedAtServer: false,
    };
  }

  const emailLower = (user.email || '').trim().toLowerCase();
  if (emailLower === PRIMARY_SUPERADMIN_EMAIL) {
    return {
      isStaff: true,
      role: 'superadministrador',
      permissions: [...ALL_ADMIN_PERMISSIONS],
      allowedSectors: ['*'],
      staffRecord: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Superadministrador FABRO',
        role: 'superadministrador',
        customPermissions: [...ALL_ADMIN_PERMISSIONS],
        allowedSectors: ['*'],
        active: true,
        assignedByUid: user.uid,
        assignedByEmail: user.email,
        notes: 'Cuenta titular Superadministrador verificada en reglas de servidor.',
      },
      verifiedAtServer: true,
    };
  }

  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'admins', user.uid));
    } catch {
      snap = await getDoc(doc(db, 'admins', user.uid));
    }
    if (!snap.exists()) {
      return {
        isStaff: false,
        role: 'usuario',
        permissions: [],
        allowedSectors: [],
        staffRecord: null,
        verifiedAtServer: true,
      };
    }
    const data = snap.data();
    const active = data.active === true;
    const role = (data.role as StaffRole) || 'moderador_general';
    if (!active) {
      return {
        isStaff: false,
        role: 'usuario',
        permissions: [],
        allowedSectors: [],
        staffRecord: null,
        verifiedAtServer: true,
      };
    }

    const rawPerms = Array.isArray(data.customPermissions)
      ? (data.customPermissions.map(String) as AdminPermission[])
      : [];
    const effective = computeEffectivePermissions(role, rawPerms);
    const allowedSectors = Array.isArray(data.allowedSectors)
      ? data.allowedSectors.map(String)
      : role === 'moderador_cultural'
      ? ['cultura']
      : ['*'];

    const record: AdminStaffRecord = {
      uid: String(data.uid || user.uid),
      email: String(data.email || user.email),
      displayName: String(data.displayName || user.displayName || 'Staff FABRO'),
      role,
      customPermissions: effective,
      allowedSectors,
      active: true,
      assignedByUid: String(data.assignedByUid || ''),
      assignedByEmail: String(data.assignedByEmail || ''),
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      createdAtIso: toIsoString(data.createdAt),
      updatedAtIso: toIsoString(data.updatedAt),
    };

    return {
      isStaff: true,
      role,
      permissions: effective,
      allowedSectors,
      staffRecord: record,
      verifiedAtServer: true,
    };
  } catch {
    return {
      isStaff: false,
      role: 'usuario',
      permissions: [],
      allowedSectors: [],
      staffRecord: null,
      verifiedAtServer: false,
    };
  }
}

export async function writeAuditLog(
  actor: StaffActor,
  entry: {
    action: string;
    targetType: string;
    targetId: string;
    targetLabel?: string;
    reason?: string;
    result?: 'ok' | 'denegado' | 'error';
    permissionUsed?: AdminPermission | string;
    sector?: string;
    details: string;
  }
): Promise<void> {
  const id = makeSafeId('audit');
  await setDoc(doc(db, 'adminAuditLogs', id), {
    id,
    adminId: actor.uid,
    adminEmail: (actor.email || 'staff@fabro.app').slice(0, 200),
    adminRole: actor.role,
    action: entry.action.slice(0, 160),
    targetType: entry.targetType.slice(0, 60),
    targetId: sanitizeId(entry.targetId || 'system'),
    ...(entry.targetLabel ? { targetLabel: entry.targetLabel.slice(0, 160) } : {}),
    ...(entry.reason ? { reason: entry.reason.slice(0, 1000) } : {}),
    result: entry.result || 'ok',
    ...(entry.permissionUsed ? { permissionUsed: String(entry.permissionUsed).slice(0, 80) } : {}),
    ...(entry.sector ? { sector: entry.sector.slice(0, 60) } : {}),
    details: (entry.details || '').slice(0, 2000),
    createdAt: serverTimestamp(),
  });
}

export async function sendFirestoreUserNotification(payload: {
  userId: string;
  title: string;
  body: string;
  linkSection: string;
}): Promise<void> {
  try {
    const id = makeSafeId('notif');
    await setDoc(doc(db, 'notifications', id), {
      id,
      userId: sanitizeId(payload.userId),
      title: payload.title.slice(0, 160),
      body: payload.body.slice(0, 600),
      linkSection: payload.linkSection.slice(0, 40),
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal: e.g. if sender is unverified or offline
  }
}

// ------------------------------------------------------------------
// User-Facing Subscriptions (Restrictions, Sanctions, Reports, Ideas, Requests)
// ------------------------------------------------------------------

export function subscribeToMyRestriction(
  uid: string,
  onUpdate: (restriction: UserRestrictionRecord | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'userRestrictions', uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const d = snap.data();
      onUpdate({
        uid: String(d.uid || uid),
        displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
        email: typeof d.email === 'string' ? d.email : undefined,
        accountStatus: (d.accountStatus as UserAccountStatus) || 'activo',
        restrictions: Array.isArray(d.restrictions) ? (d.restrictions as UserRestrictionFlag[]) : [],
        reason: String(d.reason || ''),
        expiresAtIso: typeof d.expiresAtIso === 'string' ? d.expiresAtIso : undefined,
        warningsCount: typeof d.warningsCount === 'number' ? d.warningsCount : 0,
        sanctionsCount: typeof d.sanctionsCount === 'number' ? d.sanctionsCount : 0,
        updatedByUid: String(d.updatedByUid || ''),
        updatedByEmail: String(d.updatedByEmail || ''),
        updatedAtIso: toIsoString(d.updatedAt),
      });
    },
    () => onUpdate(null)
  );
}

export function subscribeToMySanctions(
  uid: string,
  onUpdate: (items: UserSanctionRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'userSanctions'), where('userId', '==', uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const list: UserSanctionRecord[] = snap.docs
        .map((docSnap) => mapSanctionDoc(docSnap.id, docSnap.data()))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export function subscribeToMyReports(
  uid: string,
  onUpdate: (items: ModerationReportRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'moderationReports'), where('reporterId', '==', uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const list: ModerationReportRecord[] = snap.docs
        .map((docSnap) => mapReportDoc(docSnap.id, docSnap.data()))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export function subscribeToMySectorRequests(
  uid: string,
  onUpdate: (items: SectorRequestRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'sectorRequests'), where('requesterUid', '==', uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const list: SectorRequestRecord[] = snap.docs
        .map((docSnap) => mapSectorRequestDoc(docSnap.id, docSnap.data()))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export function subscribeToIdeaProposals(
  onUpdate: (items: IdeaProposalRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'ideaProposals'), where('votesCount', '>=', 0), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list: IdeaProposalRecord[] = snap.docs
        .map((docSnap) => mapIdeaDoc(docSnap.id, docSnap.data()))
        .sort((a, b) => b.votesCount - a.votesCount || b.createdAtIso.localeCompare(a.createdAtIso));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export function subscribeToPlatformSectors(
  onUpdate: (items: PlatformSectorRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'platformSectors'), where('name', '>=', ''), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapSectorDoc(d.id, d.data()));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export function subscribeToPlatformEvents(
  onUpdate: (items: PlatformEventRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'platformEvents'), where('title', '>=', ''), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapEventDoc(d.id, d.data()))
        .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

// ------------------------------------------------------------------
// Staff-Only Subscriptions (Strictly gated by role & permissions)
// ------------------------------------------------------------------

export function subscribeToAdminStaffList(
  onUpdate: (items: AdminStaffRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'admins'), limit(100)),
    (snap) => {
      const list: AdminStaffRecord[] = snap.docs.map((d) => {
        const data = d.data();
        const role = (data.role as StaffRole) || 'moderador_general';
        return {
          uid: String(data.uid || d.id),
          email: String(data.email || ''),
          displayName: String(data.displayName || 'Staff'),
          role,
          customPermissions: Array.isArray(data.customPermissions)
            ? (data.customPermissions.map(String) as AdminPermission[])
            : [],
          allowedSectors: Array.isArray(data.allowedSectors)
            ? data.allowedSectors.map(String)
            : [],
          active: data.active === true,
          assignedByUid: String(data.assignedByUid || ''),
          assignedByEmail: String(data.assignedByEmail || ''),
          notes: typeof data.notes === 'string' ? data.notes : undefined,
          createdAtIso: toIsoString(data.createdAt),
          updatedAtIso: toIsoString(data.updatedAt),
        };
      });
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeToDirectoryUsers(
  onUpdate: (items: DirectoryUserRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'publicProfiles'), limit(200)),
    (snap) => {
      const list: DirectoryUserRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Usuario FABRO'),
          username: String(data.username || ''),
          customFabroId: typeof data.customFabroId === 'string' ? data.customFabroId : undefined,
          photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
          bio: typeof data.bio === 'string' ? data.bio : undefined,
          country: typeof data.country === 'string' ? data.country : undefined,
          city: typeof data.city === 'string' ? data.city : undefined,
          isStudent: Boolean(data.isStudent),
          isInstructor: Boolean(data.isInstructor),
          isMinor: Boolean(data.isMinor),
          presenceStatus: typeof data.presenceStatus === 'string' ? data.presenceStatus : 'offline',
          verificationStatus:
            typeof data.verificationStatus === 'string' ? data.verificationStatus : 'no_solicitado',
          updatedAtIso: toIsoString(data.updatedAt),
        };
      });
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeToAllRestrictions(
  onUpdate: (items: UserRestrictionRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'userRestrictions'), limit(200)),
    (snap) => {
      const list: UserRestrictionRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: String(d.uid || docSnap.id),
          displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
          email: typeof d.email === 'string' ? d.email : undefined,
          accountStatus: (d.accountStatus as UserAccountStatus) || 'activo',
          restrictions: Array.isArray(d.restrictions) ? (d.restrictions as UserRestrictionFlag[]) : [],
          reason: String(d.reason || ''),
          expiresAtIso: typeof d.expiresAtIso === 'string' ? d.expiresAtIso : undefined,
          warningsCount: typeof d.warningsCount === 'number' ? d.warningsCount : 0,
          sanctionsCount: typeof d.sanctionsCount === 'number' ? d.sanctionsCount : 0,
          updatedByUid: String(d.updatedByUid || ''),
          updatedByEmail: String(d.updatedByEmail || ''),
          updatedAtIso: toIsoString(d.updatedAt),
        };
      });
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeToModerationReports(
  culturalOnly: boolean,
  onUpdate: (items: ModerationReportRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = culturalOnly
    ? query(collection(db, 'moderationReports'), where('sector', '==', 'cultura'), limit(150))
    : query(collection(db, 'moderationReports'), limit(150));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapReportDoc(d.id, d.data()))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeToUserSanctions(
  culturalOnly: boolean,
  onUpdate: (items: UserSanctionRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = culturalOnly
    ? query(collection(db, 'userSanctions'), where('sector', '==', 'cultura'), limit(150))
    : query(collection(db, 'userSanctions'), limit(150));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapSanctionDoc(d.id, d.data()))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeToAllSectorRequests(
  onUpdate: (items: SectorRequestRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'sectorRequests'), limit(150)),
    (snap) => {
      const list = snap.docs
        .map((d) => mapSectorRequestDoc(d.id, d.data()))
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeToAuditLogs(
  onUpdate: (items: AdminAuditLogRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const list: AdminAuditLogRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          adminId: String(data.adminId || ''),
          adminEmail: String(data.adminEmail || ''),
          adminRole: typeof data.adminRole === 'string' ? (data.adminRole as AdminRole) : undefined,
          action: String(data.action || ''),
          targetType: String(data.targetType || ''),
          targetId: String(data.targetId || ''),
          targetLabel: typeof data.targetLabel === 'string' ? data.targetLabel : undefined,
          reason: typeof data.reason === 'string' ? data.reason : undefined,
          result:
            data.result === 'ok' || data.result === 'denegado' || data.result === 'error'
              ? data.result
              : 'ok',
          permissionUsed:
            typeof data.permissionUsed === 'string' ? data.permissionUsed : undefined,
          sector: typeof data.sector === 'string' ? data.sector : undefined,
          details: String(data.details || ''),
          createdAtIso: toIsoString(data.createdAt),
        };
      });
      onUpdate(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeToAdminSettings(
  onUpdate: (settings: AdminSettingsRecord | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'adminSettings', 'global'),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const d = snap.data();
      onUpdate({
        id: String(d.id || 'global'),
        allowSectorRequests: d.allowSectorRequests !== false,
        allowIdeaVoting: d.allowIdeaVoting !== false,
        requireModerationReason: d.requireModerationReason !== false,
        localSpamSensitivity:
          d.localSpamSensitivity === 'baja' ||
          d.localSpamSensitivity === 'alta' ||
          d.localSpamSensitivity === 'media'
            ? d.localSpamSensitivity
            : 'media',
        zeroCostPolicyLocked: true,
        updatedByEmail: typeof d.updatedByEmail === 'string' ? d.updatedByEmail : undefined,
        updatedAtIso: toIsoString(d.updatedAt),
      });
    },
    () => onUpdate(null)
  );
}

// ------------------------------------------------------------------
// User Submissions (Reports, Appeals, Sector Requests, Ideas)
// ------------------------------------------------------------------

export async function submitModerationReport(params: {
  reporterUid: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  targetAuthorUid?: string;
  targetAuthorName?: string;
  targetSummary: string;
  sector?: string;
  reason: string;
  details: string;
  evidenceNote?: string;
}): Promise<string> {
  const id = makeSafeId('rep');
  await setDoc(doc(db, 'moderationReports', id), {
    id,
    reporterId: params.reporterUid,
    reporterName: (params.reporterName || 'Usuario FABRO').slice(0, 120),
    targetType: params.targetType,
    targetId: sanitizeId(params.targetId || 'unknown'),
    ...(params.targetAuthorUid ? { targetAuthorUid: params.targetAuthorUid.slice(0, 128) } : {}),
    ...(params.targetAuthorName ? { targetAuthorName: params.targetAuthorName.slice(0, 120) } : {}),
    targetSummary: (params.targetSummary || '').slice(0, 400),
    sector: (params.sector || 'general').slice(0, 60),
    reason: params.reason.slice(0, 160),
    details: (params.details || '').slice(0, 3000),
    ...(params.evidenceNote ? { evidenceNote: params.evidenceNote.slice(0, 1500) } : {}),
    status: 'pendiente',
    resolutionNote: '',
    reviewedBy: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function submitSanctionAppeal(sanctionId: string, appealText: string): Promise<void> {
  const clean = appealText.trim();
  if (clean.length < 10) {
    throw new Error('Explicá tu apelación con al menos 10 caracteres.');
  }
  await updateDoc(doc(db, 'userSanctions', sanitizeId(sanctionId)), {
    appealText: clean.slice(0, 3000),
    appealStatus: 'pendiente',
    status: 'pendiente_apelacion',
    updatedAt: serverTimestamp(),
  });
}

export async function submitSectorRequest(params: {
  requesterUid: string;
  requesterName: string;
  name: string;
  description: string;
  objective: string;
  targetAudience: string;
  proposedTools: string;
  justification: string;
}): Promise<string> {
  const id = makeSafeId('secreq');
  const createdAtIso = new Date().toISOString();
  await setDoc(doc(db, 'sectorRequests', id), {
    id,
    name: params.name.trim().slice(0, 120),
    description: params.description.trim().slice(0, 2000),
    objective: params.objective.trim().slice(0, 1200),
    targetAudience: params.targetAudience.trim().slice(0, 400),
    proposedTools: params.proposedTools.trim().slice(0, 1500),
    justification: params.justification.trim().slice(0, 2000),
    requesterUid: params.requesterUid,
    requesterName: (params.requesterName || 'Usuario FABRO').slice(0, 120),
    status: 'pendiente',
    createdAtIso,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function submitIdeaProposal(params: {
  authorUid: string;
  authorName: string;
  title: string;
  category: IdeaCategoryId;
  explanation: string;
}): Promise<string> {
  const id = makeSafeId('idea');
  const createdAtIso = new Date().toISOString();
  await setDoc(doc(db, 'ideaProposals', id), {
    id,
    title: params.title.trim().slice(0, 160),
    category: params.category,
    explanation: params.explanation.trim().slice(0, 3000),
    authorUid: params.authorUid,
    authorName: (params.authorName || 'Usuario FABRO').slice(0, 120),
    status: 'recibida',
    voterUids: [params.authorUid],
    votesCount: 1,
    comments: [],
    createdAtIso,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function toggleIdeaVote(idea: IdeaProposalRecord, voterUid: string): Promise<void> {
  const exists = idea.voterUids.includes(voterUid);
  const nextVoters = exists
    ? idea.voterUids.filter((u) => u !== voterUid)
    : [...idea.voterUids, voterUid].slice(0, 500);
  await updateDoc(doc(db, 'ideaProposals', sanitizeId(idea.id)), {
    voterUids: nextVoters,
    votesCount: nextVoters.length,
    updatedAt: serverTimestamp(),
  });
}

export async function addIdeaComment(
  idea: IdeaProposalRecord,
  comment: { authorUid: string; authorName: string; text: string }
): Promise<void> {
  const clean = comment.text.trim();
  if (!clean) return;
  const nextItem: IdeaCommentItem = {
    id: makeSafeId('icmt'),
    authorUid: comment.authorUid,
    authorName: comment.authorName.slice(0, 100),
    text: clean.slice(0, 600),
    createdAtIso: new Date().toISOString(),
  };
  await updateDoc(doc(db, 'ideaProposals', sanitizeId(idea.id)), {
    comments: [...idea.comments, nextItem].slice(-100),
    updatedAt: serverTimestamp(),
  });
}

// ------------------------------------------------------------------
// Administrative Actions (All emit immutable audit logs)
// ------------------------------------------------------------------

export async function updateModerationReport(
  actor: StaffActor,
  report: ModerationReportRecord,
  updates: {
    status: ReportStatus;
    resolutionAction?: string;
    resolutionNote: string;
    assignToSelf?: boolean;
  }
): Promise<void> {
  const cleanNote = updates.resolutionNote.trim();
  if (cleanNote.length < 3) {
    throw new Error('Ingresá un motivo o nota de revisión (mínimo 3 caracteres).');
  }
  await updateDoc(doc(db, 'moderationReports', sanitizeId(report.id)), {
    status: updates.status,
    ...(updates.assignToSelf
      ? { assignedModeratorUid: actor.uid, assignedModeratorEmail: actor.email }
      : {}),
    ...(updates.resolutionAction ? { resolutionAction: updates.resolutionAction.slice(0, 120) } : {}),
    resolutionNote: cleanNote.slice(0, 2000),
    reviewedBy: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: `denuncia_${updates.status}`,
    targetType: report.targetType,
    targetId: report.targetId,
    targetLabel: report.targetSummary || report.id,
    reason: cleanNote,
    result: 'ok',
    permissionUsed: 'revisar_denuncias',
    sector: report.sector || 'general',
    details: `Denuncia ${report.id} actualizada a "${updates.status}"${
      updates.resolutionAction ? ` (${updates.resolutionAction})` : ''
    }.`,
  });

  // Notify reporter of progress without exposing sensitive moderation internals
  if (report.reporterId && report.reporterId !== actor.uid) {
    await sendFirestoreUserNotification({
      userId: report.reporterId,
      title: 'Actualización de tu denuncia en FABRO',
      body: `Tu reporte pasó al estado "${updates.status.replace(/_/g, ' ')}". Gracias por cuidar la comunidad.`,
      linkSection: 'social',
    });
  }
}

export async function issueUserSanctionAndRestriction(
  actor: StaffActor,
  params: {
    targetUid: string;
    targetName: string;
    targetEmail?: string;
    sanctionType: SanctionType;
    accountStatus: UserAccountStatus;
    restrictions: UserRestrictionFlag[];
    reason: string;
    expiresAtIso?: string;
    sector?: string;
    existingRestriction?: UserRestrictionRecord | null;
  }
): Promise<void> {
  if (params.targetUid === actor.uid) {
    throw new Error('No podés aplicarte sanciones ni restricciones a tu propia cuenta.');
  }
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 5) {
    throw new Error('Debés registrar un motivo claro (mínimo 5 caracteres).');
  }

  const sanctionId = makeSafeId('sanc');
  const isReactivation = params.sanctionType === 'reactivacion';
  const permUsed: AdminPermission = isReactivation
    ? 'reactivar_usuarios'
    : params.sanctionType === 'advertencia' || params.sanctionType === 'restriccion'
    ? 'advertir_usuarios'
    : 'suspender_usuarios';

  await setDoc(doc(db, 'userSanctions', sanctionId), {
    id: sanctionId,
    userId: sanitizeId(params.targetUid),
    userName: (params.targetName || 'Usuario FABRO').slice(0, 120),
    sanctionType: params.sanctionType,
    sector: (params.sector || 'general').slice(0, 60),
    restrictions: params.restrictions.slice(0, 10),
    ...(params.expiresAtIso ? { expiresAtIso: params.expiresAtIso.slice(0, 40) } : {}),
    reason: cleanReason.slice(0, 2000),
    status: isReactivation ? 'levantada' : 'activa',
    appealText: '',
    appealStatus: 'sin_apelacion',
    issuedByUid: actor.uid,
    issuedBy: actor.email.slice(0, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const prevWarnings = params.existingRestriction?.warningsCount ?? 0;
  const prevSanctions = params.existingRestriction?.sanctionsCount ?? 0;

  await setDoc(doc(db, 'userRestrictions', sanitizeId(params.targetUid)), {
    uid: sanitizeId(params.targetUid),
    ...(params.targetName ? { displayName: params.targetName.slice(0, 120) } : {}),
    ...(params.targetEmail ? { email: params.targetEmail.slice(0, 200) } : {}),
    accountStatus: params.accountStatus,
    restrictions: params.restrictions.slice(0, 10),
    reason: cleanReason.slice(0, 2000),
    ...(params.expiresAtIso ? { expiresAtIso: params.expiresAtIso.slice(0, 40) } : {}),
    warningsCount: params.sanctionType === 'advertencia' ? prevWarnings + 1 : prevWarnings,
    sanctionsCount: isReactivation ? prevSanctions : prevSanctions + 1,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: `usuario_${params.sanctionType}`,
    targetType: 'usuario',
    targetId: params.targetUid,
    targetLabel: params.targetName,
    reason: cleanReason,
    result: 'ok',
    permissionUsed: permUsed,
    sector: params.sector || 'general',
    details: `Estado de cuenta: ${params.accountStatus}. Restricciones activas: ${
      params.restrictions.length > 0 ? params.restrictions.join(', ') : 'ninguna'
    }.${params.expiresAtIso ? ` Vence: ${params.expiresAtIso}.` : ''}`,
  });

  await sendFirestoreUserNotification({
    userId: params.targetUid,
    title: isReactivation ? 'Tu cuenta de FABRO fue reactivada' : 'Aviso de moderación en FABRO',
    body: isReactivation
      ? `Se levantaron las restricciones sobre tu cuenta. Motivo: ${cleanReason}`
      : `Medida aplicada (${params.sanctionType.replace(/_/g, ' ')}): ${cleanReason}. Podés solicitar revisión desde tu perfil.`,
    linkSection: 'social',
  });
}

export async function removeUserPlatformData(
  actor: StaffActor,
  params: {
    targetUid: string;
    targetName: string;
    targetUsername?: string;
    reason: string;
    existingRestriction?: UserRestrictionRecord | null;
  }
): Promise<{ deletedPostsCount: number }> {
  if (params.targetUid === actor.uid) {
    throw new Error('No podés eliminar tus propios datos desde el panel.');
  }
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 8) {
    throw new Error('Para eliminación definitiva de datos se exige un motivo detallado (mínimo 8 caracteres).');
  }

  // Mark restriction state as permanently removed on platform
  await issueUserSanctionAndRestriction(actor, {
    targetUid: params.targetUid,
    targetName: params.targetName,
    sanctionType: 'eliminacion_datos',
    accountStatus: 'eliminado',
    restrictions: ['no_publicar', 'no_comentar', 'no_mensajes', 'no_cultura', 'no_eventos'],
    reason: cleanReason,
    existingRestriction: params.existingRestriction,
  });

  // Delete public profile & public posts authored by user
  let deletedPostsCount = 0;
  try {
    await deleteDoc(doc(db, 'publicProfiles', sanitizeId(params.targetUid)));
  } catch {
    // May not exist
  }

  try {
    const postsSnap = await getDocs(
      query(collection(db, 'public_posts'), where('authorUid', '==', params.targetUid), limit(50))
    );
    for (const postDoc of postsSnap.docs) {
      await deleteDoc(postDoc.ref);
      deletedPostsCount += 1;
    }
  } catch {
    // Non-fatal
  }

  await writeAuditLog(actor, {
    action: 'usuario_eliminacion_datos_plataforma',
    targetType: 'usuario',
    targetId: params.targetUid,
    targetLabel: params.targetName,
    reason: cleanReason,
    result: 'ok',
    permissionUsed: 'suspender_usuarios',
    details: `Perfil público y ${deletedPostsCount} publicaciones eliminadas de Firestore. Nota plan Spark gratuito: las credenciales de Firebase Auth requieren revocación desde Firebase Console > Authentication.`,
  });

  return { deletedPostsCount };
}

export async function resolveSanctionAppeal(
  actor: StaffActor,
  sanction: UserSanctionRecord,
  decision: 'aceptada' | 'rechazada',
  resolutionText: string
): Promise<void> {
  const cleanRes = resolutionText.trim();
  if (cleanRes.length < 5) {
    throw new Error('Ingresá la resolución de la apelación (mínimo 5 caracteres).');
  }
  const nextStatus = decision === 'aceptada' ? 'apelacion_aceptada' : 'apelacion_rechazada';
  await updateDoc(doc(db, 'userSanctions', sanitizeId(sanction.id)), {
    status: nextStatus,
    appealStatus: decision,
    appealResolution: cleanRes.slice(0, 2000),
    appealReviewedBy: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  if (decision === 'aceptada') {
    await setDoc(doc(db, 'userRestrictions', sanitizeId(sanction.userId)), {
      uid: sanitizeId(sanction.userId),
      displayName: sanction.userName.slice(0, 120),
      accountStatus: 'activo',
      restrictions: [],
      reason: `Apelación aceptada: ${cleanRes}`.slice(0, 2000),
      warningsCount: 0,
      sanctionsCount: 0,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email.slice(0, 200),
      updatedAt: serverTimestamp(),
    });
  }

  await writeAuditLog(actor, {
    action: `apelacion_${decision}`,
    targetType: 'sancion',
    targetId: sanction.id,
    targetLabel: sanction.userName,
    reason: cleanRes,
    result: 'ok',
    permissionUsed: 'reactivar_usuarios',
    sector: sanction.sector || 'general',
    details: `Apelación sobre sanción ${sanction.id} marcada como "${decision}".`,
  });

  await sendFirestoreUserNotification({
    userId: sanction.userId,
    title: decision === 'aceptada' ? 'Tu apelación fue aceptada' : 'Resolución de tu apelación',
    body: cleanRes,
    linkSection: 'social',
  });
}

export async function assignOrUpdateStaffRole(
  actor: StaffActor,
  params: {
    targetUid: string;
    targetEmail: string;
    targetDisplayName: string;
    currentTargetRole: AdminRole;
    nextRole: StaffRole;
    customPermissions: AdminPermission[];
    allowedSectors: string[];
    notes?: string;
    reason: string;
  }
): Promise<void> {
  const check = canManageTargetRole(
    actor.role,
    actor.uid,
    params.targetUid,
    params.currentTargetRole,
    params.nextRole
  );
  if (!check.allowed) {
    throw new Error(check.reason || 'Operación no autorizada.');
  }
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 4) {
    throw new Error('Indicá el motivo de la asignación o cambio de rol.');
  }

  const effectivePerms = computeEffectivePermissions(params.nextRole, params.customPermissions);
  const safeUid = sanitizeId(params.targetUid);
  const ref = doc(db, 'admins', safeUid);
  const existing = await getDoc(ref);

  const normalizedSectors =
    params.nextRole === 'moderador_cultural'
      ? ['cultura']
      : params.allowedSectors.length > 0
      ? params.allowedSectors.slice(0, 25)
      : ['*'];

  if (existing.exists()) {
    await updateDoc(ref, {
      uid: safeUid,
      email: params.targetEmail.trim().slice(0, 200),
      displayName: params.targetDisplayName.trim().slice(0, 120),
      role: params.nextRole,
      customPermissions: effectivePerms.slice(0, 25),
      allowedSectors: normalizedSectors,
      active: true,
      assignedByUid: actor.uid,
      assignedByEmail: actor.email.slice(0, 200),
      notes: (params.notes || '').slice(0, 600),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      uid: safeUid,
      email: params.targetEmail.trim().slice(0, 200),
      displayName: params.targetDisplayName.trim().slice(0, 120),
      role: params.nextRole,
      customPermissions: effectivePerms.slice(0, 25),
      allowedSectors: normalizedSectors,
      active: true,
      assignedByUid: actor.uid,
      assignedByEmail: actor.email.slice(0, 200),
      notes: (params.notes || '').slice(0, 600),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await writeAuditLog(actor, {
    action: existing.exists() ? 'rol_actualizado' : 'rol_asignado',
    targetType: 'staff',
    targetId: safeUid,
    targetLabel: `${params.targetDisplayName} (${params.nextRole})`,
    reason: cleanReason,
    result: 'ok',
    permissionUsed: actor.role === 'superadministrador' ? 'asignar_roles' : 'nombrar_moderadores',
    details: `Rol asignado: ${params.nextRole}. Permisos efectivos (${effectivePerms.length}): ${effectivePerms.join(', ')}.`,
  });

  await sendFirestoreUserNotification({
    userId: safeUid,
    title: 'Se actualizaron tus permisos en FABRO',
    body: `Ahora contás con el rol "${params.nextRole.replace(/_/g, ' ')}" en FABRO ADMIN.`,
    linkSection: 'admin',
  });
}

export async function revokeStaffRole(
  actor: StaffActor,
  target: AdminStaffRecord,
  reason: string
): Promise<void> {
  if (target.uid === actor.uid) {
    throw new Error('No podés revocar tu propio rol desde el panel.');
  }
  if (
    actor.role !== 'superadministrador' &&
    (target.role === 'superadministrador' || target.role === 'administrador_general')
  ) {
    throw new Error('Solo un Superadministrador puede revocar a un Administrador general o Superadministrador.');
  }
  const cleanReason = reason.trim();
  if (cleanReason.length < 4) {
    throw new Error('Indicá el motivo de la revocación.');
  }

  await deleteDoc(doc(db, 'admins', sanitizeId(target.uid)));

  await writeAuditLog(actor, {
    action: 'rol_revocado',
    targetType: 'staff',
    targetId: target.uid,
    targetLabel: `${target.displayName} (${target.role})`,
    reason: cleanReason,
    result: 'ok',
    permissionUsed: actor.role === 'superadministrador' ? 'asignar_roles' : 'nombrar_moderadores',
    details: `Acceso administrativo revocado de forma inmediata para ${target.email}.`,
  });
}

export async function moderatePublicPost(
  actor: StaffActor,
  postId: string,
  nextStatus: 'visible' | 'oculta' | 'eliminada',
  reason: string,
  sectorLabel = 'general'
): Promise<void> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 4) {
    throw new Error('Debés indicar un motivo de moderación (mínimo 4 caracteres).');
  }
  const safeId = sanitizeId(postId);
  await updateDoc(doc(db, 'public_posts', safeId), {
    moderationStatus: nextStatus,
    moderationReason: cleanReason.slice(0, 600),
    moderatedBy: actor.email.slice(0, 200),
    moderatedAtMs: Date.now(),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: `publicacion_${nextStatus}`,
    targetType: 'publicacion',
    targetId: safeId,
    reason: cleanReason,
    result: 'ok',
    permissionUsed: 'ocultar_publicaciones',
    sector: sectorLabel,
    details: `Publicación ${safeId} marcada como "${nextStatus}".`,
  });
}

export async function deleteModeratedPublicPost(
  actor: StaffActor,
  postId: string,
  reason: string,
  sectorLabel = 'general'
): Promise<void> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 4) {
    throw new Error('Debés indicar un motivo para eliminar la publicación.');
  }
  const safeId = sanitizeId(postId);
  await deleteDoc(doc(db, 'public_posts', safeId));

  await writeAuditLog(actor, {
    action: 'publicacion_eliminada_definitiva',
    targetType: 'publicacion',
    targetId: safeId,
    reason: cleanReason,
    result: 'ok',
    permissionUsed: 'eliminar_publicaciones',
    sector: sectorLabel,
    details: `Publicación ${safeId} eliminada permanentemente de public_posts.`,
  });
}

export async function updateSectorRequestStatus(
  actor: StaffActor,
  request: SectorRequestRecord,
  status: SectorRequestStatus,
  adminComment: string
): Promise<void> {
  const cleanComment = adminComment.trim();
  if (cleanComment.length < 3) {
    throw new Error('Agregá un comentario de respuesta para la solicitud.');
  }
  await updateDoc(doc(db, 'sectorRequests', sanitizeId(request.id)), {
    status,
    adminComment: cleanComment.slice(0, 2000),
    reviewedBy: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: `solicitud_sector_${status}`,
    targetType: 'solicitud_sector',
    targetId: request.id,
    targetLabel: request.name,
    reason: cleanComment,
    result: 'ok',
    permissionUsed: 'editar_sectores',
    details: `Solicitud de sector "${request.name}" actualizada a "${status}".`,
  });

  if (request.requesterUid && request.requesterUid !== actor.uid) {
    await sendFirestoreUserNotification({
      userId: request.requesterUid,
      title: `Solicitud de sector "${request.name}"`,
      body: `Estado actualizado a "${status.replace(/_/g, ' ')}": ${cleanComment}`,
      linkSection: 'inicio',
    });
  }
}

export async function updateIdeaProposalStatus(
  actor: StaffActor,
  idea: IdeaProposalRecord,
  status: IdeaStatus,
  adminResponse: string
): Promise<void> {
  const cleanResp = adminResponse.trim();
  if (cleanResp.length < 3) {
    throw new Error('Escribí una respuesta oficial para la idea.');
  }
  await updateDoc(doc(db, 'ideaProposals', sanitizeId(idea.id)), {
    status,
    adminResponse: cleanResp.slice(0, 2000),
    adminResponderEmail: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: `idea_${status}`,
    targetType: 'idea',
    targetId: idea.id,
    targetLabel: idea.title,
    reason: cleanResp,
    result: 'ok',
    permissionUsed: 'editar_sectores',
    details: `Propuesta "${idea.title}" actualizada a "${status}".`,
  });

  if (idea.authorUid && idea.authorUid !== actor.uid) {
    await sendFirestoreUserNotification({
      userId: idea.authorUid,
      title: `Respuesta sobre tu idea "${idea.title}"`,
      body: `Estado: ${status.replace(/_/g, ' ')} — ${cleanResp}`,
      linkSection: 'inicio',
    });
  }
}

export async function savePlatformSector(
  actor: StaffActor,
  sector: Omit<PlatformSectorRecord, 'updatedAtIso'>,
  reason: string,
  isNew: boolean
): Promise<void> {
  const safeId = sanitizeId(sector.id || sector.name.toLowerCase().replace(/\s+/g, '-'));
  await setDoc(doc(db, 'platformSectors', safeId), {
    id: safeId,
    name: sector.name.trim().slice(0, 120),
    description: sector.description.trim().slice(0, 1500),
    categories: sector.categories.map((c) => c.trim().slice(0, 80)).filter(Boolean).slice(0, 30),
    subcategories: sector.subcategories.map((c) => c.trim().slice(0, 80)).filter(Boolean).slice(0, 50),
    active: Boolean(sector.active),
    isCore: Boolean(sector.isCore),
    adminUids: sector.adminUids.slice(0, 20),
    moderatorUids: sector.moderatorUids.slice(0, 40),
    permissionsNote: (sector.permissionsNote || '').slice(0, 500),
    updatedByEmail: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: isNew ? 'sector_creado' : 'sector_actualizado',
    targetType: 'sector',
    targetId: safeId,
    targetLabel: sector.name,
    reason: reason.trim() || 'Actualización administrativa de sector',
    result: 'ok',
    permissionUsed: isNew ? 'crear_sectores' : 'editar_sectores',
    sector: safeId,
    details: `Sector "${sector.name}" (${sector.active ? 'activo' : 'desactivado sin pérdida de datos'}).`,
  });
}

export async function togglePlatformSectorActive(
  actor: StaffActor,
  sector: PlatformSectorRecord,
  nextActive: boolean,
  reason: string
): Promise<void> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 4) {
    throw new Error('Indicá el motivo para activar o desactivar el sector.');
  }
  await setDoc(doc(db, 'platformSectors', sanitizeId(sector.id)), {
    id: sanitizeId(sector.id),
    name: sector.name.slice(0, 120),
    description: sector.description.slice(0, 1500),
    categories: sector.categories.slice(0, 30),
    subcategories: sector.subcategories.slice(0, 50),
    active: nextActive,
    isCore: Boolean(sector.isCore),
    adminUids: sector.adminUids.slice(0, 20),
    moderatorUids: sector.moderatorUids.slice(0, 40),
    permissionsNote: (sector.permissionsNote || '').slice(0, 500),
    updatedByEmail: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: nextActive ? 'sector_activado' : 'sector_desactivado',
    targetType: 'sector',
    targetId: sector.id,
    targetLabel: sector.name,
    reason: cleanReason,
    result: 'ok',
    permissionUsed: 'desactivar_sectores',
    sector: sector.id,
    details: nextActive
      ? `Sector "${sector.name}" reactivado.`
      : `Sector "${sector.name}" desactivado de forma no destructiva (publicaciones, usuarios y archivos preservados).`,
  });
}

export async function savePlatformEvent(
  actor: StaffActor,
  eventData: {
    id?: string;
    title: string;
    sector: string;
    category?: string;
    dateIso: string;
    location: string;
    description: string;
    status: PlatformEventStatus;
  }
): Promise<string> {
  const isNew = !eventData.id;
  const safeId = eventData.id ? sanitizeId(eventData.id) : makeSafeId('evt');
  const ref = doc(db, 'platformEvents', safeId);

  if (isNew) {
    await setDoc(ref, {
      id: safeId,
      title: eventData.title.trim().slice(0, 160),
      sector: eventData.sector.trim().slice(0, 60),
      ...(eventData.category ? { category: eventData.category.trim().slice(0, 80) } : {}),
      dateIso: eventData.dateIso.trim().slice(0, 40),
      location: eventData.location.trim().slice(0, 200),
      description: eventData.description.trim().slice(0, 2000),
      status: eventData.status,
      organizerUid: actor.uid,
      organizerName: (actor.displayName || actor.email).slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      title: eventData.title.trim().slice(0, 160),
      sector: eventData.sector.trim().slice(0, 60),
      ...(eventData.category ? { category: eventData.category.trim().slice(0, 80) } : {}),
      dateIso: eventData.dateIso.trim().slice(0, 40),
      location: eventData.location.trim().slice(0, 200),
      description: eventData.description.trim().slice(0, 2000),
      status: eventData.status,
      updatedAt: serverTimestamp(),
    });
  }

  await writeAuditLog(actor, {
    action: isNew ? 'evento_creado' : 'evento_actualizado',
    targetType: 'evento',
    targetId: safeId,
    targetLabel: eventData.title,
    reason: `Gestión de evento (${eventData.status})`,
    result: 'ok',
    permissionUsed: 'gestionar_eventos',
    sector: eventData.sector,
    details: `Evento "${eventData.title}" (${eventData.dateIso}) guardado con estado ${eventData.status}.`,
  });

  return safeId;
}

export async function deletePlatformEvent(
  actor: StaffActor,
  event: PlatformEventRecord,
  reason: string
): Promise<void> {
  await deleteDoc(doc(db, 'platformEvents', sanitizeId(event.id)));
  await writeAuditLog(actor, {
    action: 'evento_eliminado',
    targetType: 'evento',
    targetId: event.id,
    targetLabel: event.title,
    reason: reason.trim() || 'Eliminación de evento',
    result: 'ok',
    permissionUsed: 'gestionar_eventos',
    sector: event.sector,
    details: `Evento "${event.title}" eliminado.`,
  });
}

export async function saveAdminSettings(
  actor: StaffActor,
  settings: Omit<AdminSettingsRecord, 'id' | 'updatedAtIso' | 'updatedByEmail' | 'zeroCostPolicyLocked'>,
  reason: string
): Promise<void> {
  await setDoc(doc(db, 'adminSettings', 'global'), {
    id: 'global',
    allowSectorRequests: Boolean(settings.allowSectorRequests),
    allowIdeaVoting: Boolean(settings.allowIdeaVoting),
    requireModerationReason: Boolean(settings.requireModerationReason),
    localSpamSensitivity: settings.localSpamSensitivity,
    zeroCostPolicyLocked: true,
    updatedByEmail: actor.email.slice(0, 200),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(actor, {
    action: 'configuracion_actualizada',
    targetType: 'configuracion',
    targetId: 'global',
    reason: reason.trim() || 'Actualización de configuración administrativa',
    result: 'ok',
    permissionUsed: 'modificar_configuraciones',
    details: `Sensibilidad antispam local: ${settings.localSpamSensitivity}, solicitudes de sectores: ${settings.allowSectorRequests}, votación de ideas: ${settings.allowIdeaVoting}. Política costo cero bloqueada: true.`,
  });
}

// ------------------------------------------------------------------
// Mappers
// ------------------------------------------------------------------

function mapReportDoc(id: string, d: Record<string, unknown>): ModerationReportRecord {
  return {
    id: String(d.id || id),
    reporterId: String(d.reporterId || ''),
    reporterName: String(d.reporterName || 'Usuario'),
    targetType: (d.targetType as ReportTargetType) || 'publicacion',
    targetId: String(d.targetId || ''),
    targetAuthorUid: typeof d.targetAuthorUid === 'string' ? d.targetAuthorUid : undefined,
    targetAuthorName: typeof d.targetAuthorName === 'string' ? d.targetAuthorName : undefined,
    targetSummary: String(d.targetSummary || ''),
    sector: typeof d.sector === 'string' ? d.sector : 'general',
    reason: String(d.reason || 'otros'),
    details: String(d.details || ''),
    evidenceNote: typeof d.evidenceNote === 'string' ? d.evidenceNote : undefined,
    status: (d.status as ReportStatus) || 'pendiente',
    assignedModeratorUid:
      typeof d.assignedModeratorUid === 'string' ? d.assignedModeratorUid : undefined,
    assignedModeratorEmail:
      typeof d.assignedModeratorEmail === 'string' ? d.assignedModeratorEmail : undefined,
    resolutionAction: typeof d.resolutionAction === 'string' ? d.resolutionAction : undefined,
    resolutionNote: String(d.resolutionNote || ''),
    reviewedBy: String(d.reviewedBy || ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function mapSanctionDoc(id: string, d: Record<string, unknown>): UserSanctionRecord {
  return {
    id: String(d.id || id),
    userId: String(d.userId || ''),
    userName: String(d.userName || 'Usuario'),
    sanctionType: (d.sanctionType as SanctionType) || 'advertencia',
    sector: typeof d.sector === 'string' ? d.sector : 'general',
    restrictions: Array.isArray(d.restrictions) ? (d.restrictions as UserRestrictionFlag[]) : [],
    expiresAtIso: typeof d.expiresAtIso === 'string' ? d.expiresAtIso : undefined,
    reason: String(d.reason || ''),
    status: (d.status as UserSanctionRecord['status']) || 'activa',
    appealText: String(d.appealText || ''),
    appealStatus: (d.appealStatus as UserSanctionRecord['appealStatus']) || 'sin_apelacion',
    appealResolution: typeof d.appealResolution === 'string' ? d.appealResolution : undefined,
    appealReviewedBy: typeof d.appealReviewedBy === 'string' ? d.appealReviewedBy : undefined,
    issuedByUid: typeof d.issuedByUid === 'string' ? d.issuedByUid : undefined,
    issuedBy: String(d.issuedBy || ''),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function mapSectorRequestDoc(id: string, d: Record<string, unknown>): SectorRequestRecord {
  return {
    id: String(d.id || id),
    name: String(d.name || ''),
    description: String(d.description || ''),
    objective: String(d.objective || ''),
    targetAudience: String(d.targetAudience || ''),
    proposedTools: String(d.proposedTools || ''),
    justification: String(d.justification || ''),
    requesterUid: String(d.requesterUid || ''),
    requesterName: String(d.requesterName || 'Usuario'),
    status: (d.status as SectorRequestStatus) || 'pendiente',
    adminComment: typeof d.adminComment === 'string' ? d.adminComment : undefined,
    reviewedBy: typeof d.reviewedBy === 'string' ? d.reviewedBy : undefined,
    createdAtIso: String(d.createdAtIso || toIsoString(d.createdAt) || ''),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function mapIdeaDoc(id: string, d: Record<string, unknown>): IdeaProposalRecord {
  return {
    id: String(d.id || id),
    title: String(d.title || ''),
    category: (d.category as IdeaCategoryId) || 'otras',
    explanation: String(d.explanation || ''),
    authorUid: String(d.authorUid || ''),
    authorName: String(d.authorName || 'Usuario'),
    status: (d.status as IdeaStatus) || 'recibida',
    voterUids: Array.isArray(d.voterUids) ? d.voterUids.map(String) : [],
    votesCount: typeof d.votesCount === 'number' ? d.votesCount : 0,
    comments: Array.isArray(d.comments) ? (d.comments as IdeaCommentItem[]) : [],
    adminResponse: typeof d.adminResponse === 'string' ? d.adminResponse : undefined,
    adminResponderEmail:
      typeof d.adminResponderEmail === 'string' ? d.adminResponderEmail : undefined,
    createdAtIso: String(d.createdAtIso || toIsoString(d.createdAt) || ''),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function mapSectorDoc(id: string, d: Record<string, unknown>): PlatformSectorRecord {
  return {
    id: String(d.id || id),
    name: String(d.name || id),
    description: String(d.description || ''),
    categories: Array.isArray(d.categories) ? d.categories.map(String) : [],
    subcategories: Array.isArray(d.subcategories) ? d.subcategories.map(String) : [],
    active: d.active !== false,
    isCore: Boolean(d.isCore),
    adminUids: Array.isArray(d.adminUids) ? d.adminUids.map(String) : [],
    moderatorUids: Array.isArray(d.moderatorUids) ? d.moderatorUids.map(String) : [],
    permissionsNote: typeof d.permissionsNote === 'string' ? d.permissionsNote : undefined,
    updatedByEmail: typeof d.updatedByEmail === 'string' ? d.updatedByEmail : undefined,
    updatedAtIso: toIsoString(d.updatedAt),
  };
}

function mapEventDoc(id: string, d: Record<string, unknown>): PlatformEventRecord {
  return {
    id: String(d.id || id),
    title: String(d.title || ''),
    sector: String(d.sector || 'general'),
    category: typeof d.category === 'string' ? d.category : undefined,
    dateIso: String(d.dateIso || ''),
    location: String(d.location || ''),
    description: String(d.description || ''),
    status: (d.status as PlatformEventStatus) || 'borrador',
    organizerUid: String(d.organizerUid || ''),
    organizerName: String(d.organizerName || 'Organizador'),
    createdAtIso: toIsoString(d.createdAt),
    updatedAtIso: toIsoString(d.updatedAt),
  };
}
