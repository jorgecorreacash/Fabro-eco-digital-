import React from 'react';
import { AuthScreen } from './components/auth/AuthScreen';
import { FabroLogo } from './components/brand/FabroLogo';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { AcademyView } from './components/modules/AcademyView';
import { AdminPanelView } from './components/modules/AdminPanelView';
import { BienestarNaturalView } from './components/modules/BienestarNaturalView';
import { BookWriterView } from './components/modules/BookWriterView';
import { CalendarView } from './components/modules/CalendarView';
import { CalorieCounterView } from './components/modules/CalorieCounterView';
import { CommunityView } from './components/modules/CommunityView';
import { ControlCenterView } from './components/modules/ControlCenterView';
import { DictionaryView } from './components/modules/DictionaryView';
import { EstudioHubView } from './components/modules/EstudioHubView';
import { ExamsView } from './components/modules/ExamsView';
import { ExercisesLevelsView } from './components/modules/ExercisesLevelsView';
import { FabroAIView } from './components/modules/FabroAIView';
import { FabroAIBrowserView } from './components/modules/FabroAIBrowserView';
import { FabroConnectView } from './components/modules/FabroConnectView';
import { FabroDesignView } from './components/modules/FabroDesignView';
import { FabroDocumentsView } from './components/modules/FabroDocumentsView';
import { FabroExplorerView } from './components/modules/FabroExplorerView';
import { FabroHubView } from './components/modules/FabroHubView';
import { FabroKnowledgeView } from './components/modules/FabroKnowledgeView';
import { FabroResearchView } from './components/modules/FabroResearchView';
import { FabroStudyView } from './components/modules/FabroStudyView';
import { FabroToolsView } from './components/modules/FabroToolsView';
import { HabitWellnessView } from './components/modules/HabitWellnessView';
import { HerramientasHubView } from './components/modules/HerramientasHubView';
import { HoroscopeView } from './components/modules/HoroscopeView';
import { IAHubView } from './components/modules/IAHubView';
import { LastDayView } from './components/modules/LastDayView';
import { LibraryView } from './components/modules/LibraryView';
import { LuckyNumbersView } from './components/modules/LuckyNumbersView';
import { MemorizationView } from './components/modules/MemorizationView';
import { MessagesView } from './components/modules/MessagesView';
import { NotesView } from './components/modules/NotesView';
import { ProfileDirectoryView } from './components/modules/ProfileDirectoryView';
import { ProgressView } from './components/modules/ProgressView';
import { SettingsView } from './components/modules/SettingsView';
import { SocialHubView } from './components/modules/SocialHubView';
import { SourcesBrowserView } from './components/modules/SourcesBrowserView';
import { SubjectsView } from './components/modules/SubjectsView';
import { VideoLearningView } from './components/modules/VideoLearningView';
import { VirtualClassroomView } from './components/modules/VirtualClassroomView';
import { PlansModal } from './components/modals/PlansModal';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { AIGatewayProvider, useAIGateway } from './context/AIGatewayContext';
import { FabroProvider, useFabro } from './context/FabroContext';
import { HabitTimerProvider } from './context/HabitTimerContext';
import { LastDayProvider } from './context/LastDayContext';
import { PlatformProvider } from './context/PlatformContext';

const FabroRouter: React.FC = () => {
  const { user, authReady, activeSection, theme, toggleTheme, refreshUserVerification } = useFabro();
  const { freemiumStatus, plansModalOpen, plansLimitMessage, closePlansModal } = useAIGateway();

  if (!authReady) {
    return (
      <div className="min-h-screen fabro-shell-bg flex flex-col items-center justify-center gap-4">
        <FabroLogo size={48} />
        <p className="text-xs text-slate-500 dark:text-slate-300">Cargando ecosistema FABRO 2.0...</p>
      </div>
    );
  }

  if (!user || !user.emailVerified) {
    return (
      <AuthScreen
        unverifiedUser={user && !user.emailVerified ? user : null}
        theme={theme}
        onToggleTheme={toggleTheme}
        onVerifiedRefresh={refreshUserVerification}
      />
    );
  }

  return (
    <>
      <AppShell>
        {activeSection === 'inicio' && <ControlCenterView />}
        {activeSection === 'estudio-panel' && <EstudioHubView />}
        {activeSection === 'bienestar-panel' && <BienestarNaturalView />}
        {activeSection === 'social-panel' && <SocialHubView />}
        {activeSection === 'ia-panel' && <IAHubView />}
        {activeSection === 'herramientas-panel' && <HerramientasHubView />}
        {activeSection === 'ejercicios' && <ExercisesLevelsView />}
        {activeSection === 'horoscopo' && <HoroscopeView />}
        {activeSection === 'suerte' && <LuckyNumbersView />}
        {activeSection === 'academy' && <AcademyView />}
        {activeSection === 'comunidad' && <CommunityView />}
        {activeSection === 'video' && <VideoLearningView />}
        {activeSection === 'aula' && <VirtualClassroomView />}
        {activeSection === 'mensajes' && <MessagesView />}
        {activeSection === 'perfil' && <ProfileDirectoryView />}
        {activeSection === 'admin' && <AdminPanelView />}
        {activeSection === 'materias' && <SubjectsView />}
        {activeSection === 'apuntes' && <NotesView />}
        {activeSection === 'libros' && <BookWriterView />}
        {activeSection === 'biblioteca' && <LibraryView />}
        {activeSection === 'fuentes' && <SourcesBrowserView />}
        {activeSection === 'hub' && <FabroHubView />}
        {activeSection === 'connect' && <FabroConnectView />}
        {activeSection === 'ai-browser' && <FabroAIBrowserView />}
        {activeSection === 'explorer' && <FabroExplorerView />}
        {activeSection === 'knowledge' && <FabroKnowledgeView />}
        {activeSection === 'documents' && <FabroDocumentsView />}
        {activeSection === 'research' && <FabroResearchView />}
        {activeSection === 'design' && <FabroDesignView />}
        {activeSection === 'study' && <FabroStudyView />}
        {activeSection === 'habitos' && <HabitWellnessView />}
        {activeSection === 'calorias' && <CalorieCounterView />}
        {activeSection === 'ultimo-dia' && <LastDayView />}
        {activeSection === 'tools' && <FabroToolsView />}
        {activeSection === 'diccionario' && <DictionaryView />}
        {activeSection === 'fabro-ai' && <FabroAIView />}
        {activeSection === 'examenes' && <ExamsView />}
        {activeSection === 'calendario' && <CalendarView />}
        {activeSection === 'memorizacion' && <MemorizationView />}
        {activeSection === 'progreso' && <ProgressView />}
        {activeSection === 'configuracion' && <SettingsView />}
      </AppShell>
      <PlansModal
        isOpen={plansModalOpen}
        onClose={closePlansModal}
        freemiumStatus={freemiumStatus}
        limitMessage={plansLimitMessage}
      />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <FabroProvider>
        <PlatformProvider>
          <AIGatewayProvider>
            <AudioPlayerProvider>
              <HabitTimerProvider>
                <LastDayProvider>
                  <FabroRouter />
                </LastDayProvider>
              </HabitTimerProvider>
            </AudioPlayerProvider>
          </AIGatewayProvider>
        </PlatformProvider>
      </FabroProvider>
    </ErrorBoundary>
  );
}
