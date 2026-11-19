import React from 'react';
import { FabroAdminPanel } from './components/admin/FabroAdminPanel';
import { CommunityParticipationModal } from './components/admin/CommunityParticipationModal';
import { ReportContentModal } from './components/admin/ReportContentModal';
import { UserRestrictionBanner } from './components/admin/UserRestrictionBanner';
import { FabroAuthModal } from './components/auth/FabroAuthModal';
import { FabroSplashScreen } from './components/brand/FabroSplashScreen';
import { CalendarAlarmBanner } from './components/common/CalendarAlarmBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
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
import { EditSocialProfileModal } from './components/sectors/social/EditSocialProfileModal';
import { SocialProfileModal } from './components/sectors/social/SocialProfileModal';
import { SharedResourceReader } from './components/shared/SharedResourceReader';
import { ToolsHubScreen } from './components/tools/ToolsHubScreen';
import { FabroRadioModal } from './components/radio/FabroRadioModal';
import { RadioMiniPlayer } from './components/radio/RadioMiniPlayer';
import { AdminProvider } from './context/AdminContext';
import { EcosystemProvider, useEcosystem } from './context/EcosystemContext';
import { RadioProvider } from './context/RadioContext';

const EcosystemRouter: React.FC = () => {
  const { sector, sharedViewerPayload } = useEcosystem();

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
        {sector === 'inicio' && <DashboardHome />}
        {sector === 'hoy' && <HoyCosmosScreen />}
        {sector === 'herramientas' && <ToolsHubScreen />}
        {sector === 'cultura' && <SectorCulture />}
        {sector === 'estudio' && <Sector1Study />}
        {sector === 'bienestar' && <Sector2Wellness />}
        {sector === 'social' && <Sector3Social />}
        {sector === 'ia' && <Sector4AI />}
        {sector === 'configuracion' && <Sector5ConnectConfig />}
        {sector === 'admin' && <FabroAdminPanel />}
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
            <EcosystemRouter />
          </RadioProvider>
        </AdminProvider>
      </EcosystemProvider>
    </ErrorBoundary>
  );
}
