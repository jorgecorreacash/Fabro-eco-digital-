import React from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { FabroAdminPanel } from './components/admin/FabroAdminPanel';
import { CommunityParticipationModal } from './components/admin/CommunityParticipationModal';
import { ReportContentModal } from './components/admin/ReportContentModal';
import { UserRestrictionBanner } from './components/admin/UserRestrictionBanner';
import { FabroAuthModal } from './components/auth/FabroAuthModal';
import { FabroSplashScreen } from './components/brand/FabroSplashScreen';
import { CalendarAlarmBanner } from './components/common/CalendarAlarmBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PushNotificationToast } from './components/common/PushNotificationToast';
import { DashboardHome } from './components/home/DashboardHome';
import { HoyCosmosScreen } from './components/hoy/HoyCosmosScreen';
import { HybridShell } from './components/layout/HybridShell';
import { ColorfulScreenLoader } from './components/navigation/ScreenNavigationEffects';
import { InboxQuickCaptureModal } from './components/organizer/InboxQuickCaptureModal';
import { DeploymentStatusBar } from './components/pwa/DeploymentStatusBar';
import { FloatingBackgroundChat } from './components/pwa/FloatingBackgroundChat';
import { FloatingMiniWindow } from './components/pwa/FloatingMiniWindow';
import { Sector1Study } from './components/sectors/Sector1Study';
import { Sector2Wellness } from './components/sectors/Sector2Wellness';
import { Sector3Social } from './components/sectors/Sector3Social';
import { Sector4AI } from './components/sectors/Sector4AI';
import { Sector5ConnectConfig } from './components/sectors/Sector5ConnectConfig';
import { SectorCulture } from './components/sectors/culture/SectorCulture';
import { SectorSports } from './components/sectors/wellness/sports/SectorSports';
import { EditSocialProfileModal } from './components/sectors/social/EditSocialProfileModal';
import { SocialProfileModal } from './components/sectors/social/SocialProfileModal';
import { SharedResourceReader } from './components/shared/SharedResourceReader';
import { ToolsHubScreen } from './components/tools/ToolsHubScreen';
import { FabroRadioModal } from './components/radio/FabroRadioModal';
import { RadioMiniPlayer } from './components/radio/RadioMiniPlayer';
import { AdminProvider } from './context/AdminContext';
import { EcosystemProvider, useEcosystem } from './context/EcosystemContext';
import { RadioProvider } from './context/RadioContext';
import { Study2Provider } from './context/Study2Context';

const EcosystemRouter: React.FC = () => {
  const {
    sector,
    sharedViewerPayload,
    authState,
    pendingVerificationEmail,
    googleRedirectPending,
    authModalOpen,
    openAuthModal,
    cancelAuthLoading,
  } = useEcosystem();

  if (sharedViewerPayload) {
    return (
      <>
        <SharedResourceReader />
        <DeploymentStatusBar />
      </>
    );
  }

  return (
    <>
      <ColorfulScreenLoader />
      <HybridShell>
        {sector !== 'admin' && <UserRestrictionBanner />}

        {authState === 'EMAIL_VERIFICATION_REQUIRED' && !authModalOpen && (
          <div className="mb-3 rounded-2xl border-2 border-amber-500/45 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <MailCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="font-semibold">
                Verificá tu correo{' '}
                <span className="font-mono font-bold">
                  {pendingVerificationEmail || ''}
                </span>{' '}
                para activar tu sesión y sincronización en la nube.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAuthModal(undefined, 'login')}
              className="min-h-[36px] rounded-xl bg-amber-600 text-white px-3.5 py-1.5 font-bold cursor-pointer hover:bg-amber-700 shrink-0"
            >
              Verificar ahora
            </button>
          </div>
        )}

        {sector === 'inicio' && <DashboardHome />}
        {sector === 'hoy' && <HoyCosmosScreen />}
        {sector === 'herramientas' && <ToolsHubScreen />}
        {sector === 'cultura' && <SectorCulture />}
        {sector === 'deportes' && <SectorSports />}
        {sector === 'estudio' && <Sector1Study />}
        {sector === 'bienestar' && <Sector2Wellness />}
        {sector === 'social' && <Sector3Social />}
        {sector === 'ia' && <Sector4AI />}
        {sector === 'configuracion' && <Sector5ConnectConfig />}
        {sector === 'admin' &&
          (authState === 'INITIALIZING' ? (
            <div className="rounded-2xl border fabro-border fabro-surface p-8 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
              <p className="text-sm font-bold">Verificando credenciales de Firebase...</p>
              <p className="text-xs fabro-muted">
                Aguardá un instante mientras confirmamos tu sesión activa.
              </p>
            </div>
          ) : (
            <FabroAdminPanel />
          ))}
      </HybridShell>
      <InboxQuickCaptureModal />
      <FabroAuthModal />
      <SocialProfileModal />
      <EditSocialProfileModal />
      <ReportContentModal />
      <CommunityParticipationModal />
      <FloatingBackgroundChat />
      <FloatingMiniWindow />
      <RadioMiniPlayer />
      <FabroRadioModal />
      <CalendarAlarmBanner />
      <PushNotificationToast />
      {(googleRedirectPending || authState === 'AUTHENTICATING') && !authModalOpen && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="rounded-2xl border-2 border-[#7C3AED]/60 fabro-surface px-6 py-5 shadow-2xl space-y-3 max-w-sm w-full">
            <div className="flex items-center gap-3.5">
              <Loader2 className="w-5 h-5 animate-spin text-[#7C3AED] shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-bold">Conectando con Google...</p>
                <p className="text-xs fabro-muted">
                  Completando el acceso oficial mediante Firebase Authentication.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={cancelAuthLoading}
                className="text-xs font-bold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
              >
                Cancelar espera
              </button>
            </div>
          </div>
        </div>
      )}
      <DeploymentStatusBar hasMobileBottomNav />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <FabroSplashScreen durationMs={1200} />
      <EcosystemProvider>
        <AdminProvider>
          <RadioProvider>
            <Study2Provider>
              <EcosystemRouter />
            </Study2Provider>
          </RadioProvider>
        </AdminProvider>
      </EcosystemProvider>
    </ErrorBoundary>
  );
}
