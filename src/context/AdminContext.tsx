import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useEcosystem } from './EcosystemContext';
import {
  fetchServerAdminAccess,
  subscribeToAdminSettings,
  subscribeToAdminStaffList,
  subscribeToAllRestrictions,
  subscribeToAllSectorRequests,
  subscribeToAuditLogs,
  subscribeToDirectoryUsers,
  subscribeToIdeaProposals,
  subscribeToModerationReports,
  subscribeToMyReports,
  subscribeToMyRestriction,
  subscribeToMySanctions,
  subscribeToMySectorRequests,
  subscribeToPlatformEvents,
  subscribeToPlatformSectors,
  subscribeToUserSanctions,
  type StaffActor,
} from '../services/adminService';
import {
  canAccessAdminSection,
  CORE_FABRO_SECTORS_CATALOG,
  hasEffectivePermission,
  type AdminAuditLogRecord,
  type AdminNavSectionId,
  type AdminPermission,
  type AdminRole,
  type AdminSettingsRecord,
  type AdminStaffRecord,
  type DirectoryUserRecord,
  type IdeaProposalRecord,
  type ModerationReportRecord,
  type PlatformEventRecord,
  type PlatformSectorRecord,
  type ReportModalPayload,
  type SectorRequestRecord,
  type UserRestrictionFlag,
  type UserRestrictionRecord,
  type UserSanctionRecord,
} from '../types/admin';

export type ParticipationModalTab = 'sector-request' | 'ideas' | 'reports-appeals';

interface AdminContextValue {
  // Server-verified RBAC state
  checkingAccess: boolean;
  isStaff: boolean;
  staffRole: AdminRole;
  effectivePermissions: AdminPermission[];
  allowedSectors: string[];
  staffRecord: AdminStaffRecord | null;
  verifiedAtServer: boolean;
  staffActor: StaffActor | null;
  can: (perm: AdminPermission) => boolean;
  canOpenSection: (section: AdminNavSectionId) => boolean;
  refreshAdminAccess: () => Promise<void>;

  // Current user governance state
  myRestriction: UserRestrictionRecord | null;
  mySanctions: UserSanctionRecord[];
  myReports: ModerationReportRecord[];
  mySectorRequests: SectorRequestRecord[];
  isActionRestricted: (flag: UserRestrictionFlag) => { blocked: boolean; reason?: string };

  // Community / Platform shared collections
  ideaProposals: IdeaProposalRecord[];
  platformSectors: PlatformSectorRecord[];
  platformEvents: PlatformEventRecord[];
  isSectorDisabledByAdmin: (sectorId: string) => boolean;

  // Staff-only live collections (empty for regular users)
  directoryUsers: DirectoryUserRecord[];
  allRestrictions: UserRestrictionRecord[];
  allReports: ModerationReportRecord[];
  allSanctions: UserSanctionRecord[];
  allStaff: AdminStaffRecord[];
  allSectorRequests: SectorRequestRecord[];
  auditLogs: AdminAuditLogRecord[];
  adminSettings: AdminSettingsRecord;

  // Interactive modals (user-facing)
  reportModalPayload: ReportModalPayload | null;
  openReportModal: (payload: ReportModalPayload) => void;
  closeReportModal: () => void;

  participationModalOpen: boolean;
  participationTab: ParticipationModalTab;
  openParticipationModal: (tab?: ParticipationModalTab) => void;
  closeParticipationModal: () => void;
}

const DEFAULT_ADMIN_SETTINGS: AdminSettingsRecord = {
  id: 'global',
  allowSectorRequests: true,
  allowIdeaVoting: true,
  requireModerationReason: true,
  localSpamSensitivity: 'media',
  zeroCostPolicyLocked: true,
};

const AdminContext = createContext<AdminContextValue | null>(null);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, pushInAppNotification } = useEcosystem();

  const [checkingAccess, setCheckingAccess] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [staffRole, setStaffRole] = useState<AdminRole>('usuario');
  const [effectivePermissions, setEffectivePermissions] = useState<AdminPermission[]>([]);
  const [allowedSectors, setAllowedSectors] = useState<string[]>([]);
  const [staffRecord, setStaffRecord] = useState<AdminStaffRecord | null>(null);
  const [verifiedAtServer, setVerifiedAtServer] = useState(false);

  // User-level state
  const [myRestriction, setMyRestriction] = useState<UserRestrictionRecord | null>(null);
  const [mySanctions, setMySanctions] = useState<UserSanctionRecord[]>([]);
  const [myReports, setMyReports] = useState<ModerationReportRecord[]>([]);
  const [mySectorRequests, setMySectorRequests] = useState<SectorRequestRecord[]>([]);

  // Shared platform state
  const [ideaProposals, setIdeaProposals] = useState<IdeaProposalRecord[]>([]);
  const [firestoreSectors, setFirestoreSectors] = useState<PlatformSectorRecord[]>([]);
  const [platformEvents, setPlatformEvents] = useState<PlatformEventRecord[]>([]);

  // Staff-only state
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUserRecord[]>([]);
  const [allRestrictions, setAllRestrictions] = useState<UserRestrictionRecord[]>([]);
  const [allReports, setAllReports] = useState<ModerationReportRecord[]>([]);
  const [allSanctions, setAllSanctions] = useState<UserSanctionRecord[]>([]);
  const [allStaff, setAllStaff] = useState<AdminStaffRecord[]>([]);
  const [allSectorRequests, setAllSectorRequests] = useState<SectorRequestRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettingsRecord>(DEFAULT_ADMIN_SETTINGS);

  // User-facing modals
  const [reportModalPayload, setReportModalPayload] = useState<ReportModalPayload | null>(null);
  const [participationModalOpen, setParticipationModalOpen] = useState(false);
  const [participationTab, setParticipationTab] = useState<ParticipationModalTab>('ideas');

  // Notification dedup refs for real-time staff alerts
  const seenPendingReportCountRef = useRef<number | null>(null);
  const seenPendingRequestCountRef = useRef<number | null>(null);
  const seenPendingAppealCountRef = useRef<number | null>(null);

  const refreshAdminAccess = useCallback(async () => {
    if (!authUser) {
      setIsStaff(false);
      setStaffRole('usuario');
      setEffectivePermissions([]);
      setAllowedSectors([]);
      setStaffRecord(null);
      setVerifiedAtServer(false);
      setCheckingAccess(false);
      return;
    }
    setCheckingAccess(true);
    const result = await fetchServerAdminAccess({
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName,
      emailVerified: authUser.emailVerified,
    });
    setIsStaff(result.isStaff);
    setStaffRole(result.role);
    setEffectivePermissions(result.permissions);
    setAllowedSectors(result.allowedSectors);
    setStaffRecord(result.staffRecord);
    setVerifiedAtServer(result.verifiedAtServer);
    setCheckingAccess(false);
  }, [authUser]);

  useEffect(() => {
    void refreshAdminAccess();
  }, [refreshAdminAccess]);

  // Subscribe to current user's own restriction, sanctions, reports, requests & shared ideas/sectors/events
  useEffect(() => {
    if (!authUser?.uid) {
      setMyRestriction(null);
      setMySanctions([]);
      setMyReports([]);
      setMySectorRequests([]);
      setIdeaProposals([]);
      setFirestoreSectors([]);
      setPlatformEvents([]);
      return;
    }

    const unsubs = [
      subscribeToMyRestriction(authUser.uid, setMyRestriction),
      subscribeToMySanctions(authUser.uid, setMySanctions),
      subscribeToMyReports(authUser.uid, setMyReports),
      subscribeToMySectorRequests(authUser.uid, setMySectorRequests),
      subscribeToIdeaProposals(setIdeaProposals),
      subscribeToPlatformSectors(setFirestoreSectors),
      subscribeToPlatformEvents(setPlatformEvents),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authUser?.uid]);

  const can = useCallback(
    (perm: AdminPermission) => hasEffectivePermission(staffRole, effectivePermissions, perm),
    [staffRole, effectivePermissions]
  );

  const canOpenSection = useCallback(
    (section: AdminNavSectionId) => canAccessAdminSection(staffRole, effectivePermissions, section),
    [staffRole, effectivePermissions]
  );

  // Subscribe to staff-only Firestore collections ONLY when verified as staff
  useEffect(() => {
    if (!authUser?.uid || !isStaff) {
      setDirectoryUsers([]);
      setAllRestrictions([]);
      setAllReports([]);
      setAllSanctions([]);
      setAllStaff([]);
      setAllSectorRequests([]);
      setAuditLogs([]);
      setAdminSettings(DEFAULT_ADMIN_SETTINGS);
      seenPendingReportCountRef.current = null;
      seenPendingRequestCountRef.current = null;
      seenPendingAppealCountRef.current = null;
      return;
    }

    const unsubs: Array<() => void> = [];
    const culturalOnly = staffRole === 'moderador_cultural';

    if (can('consultar_usuarios')) {
      unsubs.push(subscribeToDirectoryUsers(setDirectoryUsers));
    }
    if (can('consultar_usuarios') || can('revisar_denuncias')) {
      unsubs.push(subscribeToAllRestrictions(setAllRestrictions));
    }
    if (can('revisar_denuncias')) {
      unsubs.push(
        subscribeToModerationReports(culturalOnly, (items) => {
          setAllReports(items);
          const pending = items.filter((r) => r.status === 'pendiente').length;
          if (seenPendingReportCountRef.current !== null && pending > seenPendingReportCountRef.current) {
            pushInAppNotification(
              'Nueva denuncia recibida en FABRO ADMIN',
              `Hay ${pending} denuncia(s) pendientes de revisión.`,
              { sector: 'admin', submenu: 'admin-dashboard' }
            );
          }
          seenPendingReportCountRef.current = pending;
        })
      );
    }
    if (can('consultar_usuarios') || culturalOnly) {
      unsubs.push(
        subscribeToUserSanctions(culturalOnly, (items) => {
          setAllSanctions(items);
          const pendingAppeals = items.filter((s) => s.status === 'pendiente_apelacion').length;
          if (
            seenPendingAppealCountRef.current !== null &&
            pendingAppeals > seenPendingAppealCountRef.current
          ) {
            pushInAppNotification(
              'Nueva apelación de usuario',
              `Hay ${pendingAppeals} apelación(es) aguardando revisión administrativa.`,
              { sector: 'admin', submenu: 'admin-dashboard' }
            );
          }
          seenPendingAppealCountRef.current = pendingAppeals;
        })
      );
    }
    if (can('nombrar_moderadores') || can('asignar_roles')) {
      unsubs.push(subscribeToAdminStaffList(setAllStaff));
    }
    if (can('editar_sectores')) {
      unsubs.push(
        subscribeToAllSectorRequests((items) => {
          setAllSectorRequests(items);
          const pending = items.filter((r) => r.status === 'pendiente').length;
          if (
            seenPendingRequestCountRef.current !== null &&
            pending > seenPendingRequestCountRef.current
          ) {
            pushInAppNotification(
              'Nueva solicitud de sector comunitario',
              `Hay ${pending} solicitud(es) de sectores pendientes de evaluación.`,
              { sector: 'admin', submenu: 'admin-dashboard' }
            );
          }
          seenPendingRequestCountRef.current = pending;
        })
      );
    }
    if (can('consultar_auditorias')) {
      unsubs.push(subscribeToAuditLogs(setAuditLogs));
    }
    unsubs.push(
      subscribeToAdminSettings((cfg) => {
        if (cfg) setAdminSettings(cfg);
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authUser?.uid, isStaff, staffRole, can, pushInAppNotification]);

  // Merge core sectors with any admin-saved overrides/custom sectors in Firestore
  const platformSectors = useMemo<PlatformSectorRecord[]>(() => {
    const byId = new Map<string, PlatformSectorRecord>();
    CORE_FABRO_SECTORS_CATALOG.forEach((core) => {
      byId.set(core.id, { ...core });
    });
    firestoreSectors.forEach((saved) => {
      byId.set(saved.id, saved);
    });
    return Array.from(byId.values());
  }, [firestoreSectors]);

  const isSectorDisabledByAdmin = useCallback(
    (sectorId: string) => {
      const found = platformSectors.find((s) => s.id === sectorId);
      return found ? found.active === false : false;
    },
    [platformSectors]
  );

  const isActionRestricted = useCallback(
    (flag: UserRestrictionFlag): { blocked: boolean; reason?: string } => {
      if (!myRestriction) return { blocked: false };
      if (
        myRestriction.accountStatus === 'suspendido' ||
        myRestriction.accountStatus === 'desactivado' ||
        myRestriction.accountStatus === 'eliminado'
      ) {
        if (myRestriction.expiresAtIso) {
          const expMs = new Date(myRestriction.expiresAtIso).getTime();
          if (!Number.isNaN(expMs) && expMs < Date.now() && myRestriction.accountStatus === 'suspendido') {
            return { blocked: false };
          }
        }
        return {
          blocked: true,
          reason:
            myRestriction.reason ||
            `Tu cuenta se encuentra actualmente en estado "${myRestriction.accountStatus}".`,
        };
      }
      if (myRestriction.restrictions.includes(flag)) {
        return {
          blocked: true,
          reason: myRestriction.reason || 'Esta función está temporalmente restringida en tu cuenta.',
        };
      }
      return { blocked: false };
    },
    [myRestriction]
  );

  const staffActor = useMemo<StaffActor | null>(() => {
    if (!authUser || !isStaff) return null;
    return {
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName || authUser.email,
      role: staffRole,
    };
  }, [authUser, isStaff, staffRole]);

  const openReportModal = useCallback((payload: ReportModalPayload) => {
    setReportModalPayload(payload);
  }, []);

  const closeReportModal = useCallback(() => {
    setReportModalPayload(null);
  }, []);

  const openParticipationModal = useCallback((tab: ParticipationModalTab = 'ideas') => {
    setParticipationTab(tab);
    setParticipationModalOpen(true);
  }, []);

  const closeParticipationModal = useCallback(() => {
    setParticipationModalOpen(false);
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({
      checkingAccess,
      isStaff,
      staffRole,
      effectivePermissions,
      allowedSectors,
      staffRecord,
      verifiedAtServer,
      staffActor,
      can,
      canOpenSection,
      refreshAdminAccess,
      myRestriction,
      mySanctions,
      myReports,
      mySectorRequests,
      isActionRestricted,
      ideaProposals,
      platformSectors,
      platformEvents,
      isSectorDisabledByAdmin,
      directoryUsers,
      allRestrictions,
      allReports,
      allSanctions,
      allStaff,
      allSectorRequests,
      auditLogs,
      adminSettings,
      reportModalPayload,
      openReportModal,
      closeReportModal,
      participationModalOpen,
      participationTab,
      openParticipationModal,
      closeParticipationModal,
    }),
    [
      checkingAccess,
      isStaff,
      staffRole,
      effectivePermissions,
      allowedSectors,
      staffRecord,
      verifiedAtServer,
      staffActor,
      can,
      canOpenSection,
      refreshAdminAccess,
      myRestriction,
      mySanctions,
      myReports,
      mySectorRequests,
      isActionRestricted,
      ideaProposals,
      platformSectors,
      platformEvents,
      isSectorDisabledByAdmin,
      directoryUsers,
      allRestrictions,
      allReports,
      allSanctions,
      allStaff,
      allSectorRequests,
      auditLogs,
      adminSettings,
      reportModalPayload,
      openReportModal,
      closeReportModal,
      participationModalOpen,
      participationTab,
      openParticipationModal,
      closeParticipationModal,
    ]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin debe usarse dentro de AdminProvider');
  }
  return ctx;
}
