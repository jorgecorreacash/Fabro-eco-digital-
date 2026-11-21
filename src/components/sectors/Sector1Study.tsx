import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  Menu,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useStudy2 } from '../../context/Study2Context';
import type { Study2NavId } from '../../types/study2';
import { Study2AiStudio } from './study2/Study2AiStudio';
import { Study2EvaluationsView } from './study2/Study2EvaluationsView';
import { Study2HomeView } from './study2/Study2HomeView';
import { Study2LibraryView } from './study2/Study2LibraryView';
import { Study2NotesView } from './study2/Study2NotesView';
import { Study2ProgressView } from './study2/Study2ProgressView';
import { Study2SubjectsView } from './study2/Study2SubjectsView';
import { Study2ToolsView } from './study2/Study2ToolsView';
import { UnifiedShiftCalendar } from './study2/UnifiedShiftCalendar';

interface StudySidebarEntry {
  id: Study2NavId;
  number: number;
  label: string;
  Icon: React.FC<{ className?: string }>;
}

const STUDY2_SIDEBAR_ITEMS: StudySidebarEntry[] = [
  { id: 'inicio', number: 1, label: 'Inicio', Icon: Home },
  { id: 'mis-estudios', number: 2, label: 'Mis estudios', Icon: BookOpen },
  { id: 'fabro-ia', number: 3, label: 'FABRO IA', Icon: Sparkles },
  { id: 'mis-apuntes', number: 4, label: 'Mis apuntes', Icon: FileText },
  { id: 'biblioteca', number: 5, label: 'Biblioteca', Icon: FolderOpen },
  { id: 'calendario', number: 6, label: 'Calendario', Icon: Calendar },
  { id: 'evaluaciones', number: 7, label: 'Evaluaciones', Icon: ClipboardCheck },
  { id: 'mi-progreso', number: 8, label: 'Mi progreso', Icon: BarChart3 },
  { id: 'herramientas', number: 9, label: 'Herramientas educativas', Icon: Wrench },
];

function mapLegacySubmenuToStudy2Nav(submenu: string): Study2NavId | null {
  switch (submenu) {
    case 'calendario-pintable':
      return 'calendario';
    case 'materias-apuntes':
      return 'mis-apuntes';
    case 'biblioteca-glosario':
      return 'biblioteca';
    case 'examenes-calendario':
      return 'evaluaciones';
    case 'mapas-flashcards':
      return 'herramientas';
    case 'investigacion-fuentes':
      return 'fabro-ia';
    default:
      return null;
  }
}

export const Sector1Study: React.FC = () => {
  const { submenu } = useEcosystem();
  const { activeNav, setActiveNav, setSelectedSubjectId, snapshot, cloudSyncNote } =
    useStudy2();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sync deep links from other parts of FABRO into Study 2.0 sections
  useEffect(() => {
    const mapped = mapLegacySubmenuToStudy2Nav(submenu);
    if (mapped) {
      setActiveNav(mapped);
    }
  }, [setActiveNav, submenu]);

  const activeItem =
    STUDY2_SIDEBAR_ITEMS.find((i) => i.id === activeNav) || STUDY2_SIDEBAR_ITEMS[0];

  const selectNav = (id: Study2NavId) => {
    if (id !== 'mis-estudios') {
      setSelectedSubjectId(null);
    }
    setActiveNav(id);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getBadgeCount = (id: Study2NavId): number | null => {
    if (id === 'mis-estudios') {
      const n = snapshot.subjects.filter((s) => !s.archived).length;
      return n > 0 ? n : null;
    }
    if (id === 'biblioteca') {
      return snapshot.libraryFiles.length > 0 ? snapshot.libraryFiles.length : null;
    }
    if (id === 'evaluaciones') {
      return snapshot.evaluations.length > 0 ? snapshot.evaluations.length : null;
    }
    return null;
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-blue-700 dark:text-blue-400">
            <GraduationCap className="w-4 h-4 shrink-0" />
            FABRO Estudio
          </span>
          <span className="text-[11px] font-mono tabular-nums text-slate-400">
            9 secciones
          </span>
        </div>
        {cloudSyncNote && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {cloudSyncNote}
          </p>
        )}
      </div>

      <nav
        aria-label="Menú lateral de FABRO Estudio"
        className="flex-1 overflow-y-auto p-2.5 space-y-1"
      >
        {STUDY2_SIDEBAR_ITEMS.map((item) => {
          const Icon = item.Icon;
          const active = activeNav === item.id;
          const count = getBadgeCount(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNav(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full min-h-[42px] rounded-xl px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                active
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {count !== null && (
                <span
                  className={`font-mono text-[10px] tabular-nums shrink-0 ${
                    active ? 'text-white/85' : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeNav) {
      case 'inicio':
        return <Study2HomeView />;
      case 'mis-estudios':
        return <Study2SubjectsView />;
      case 'fabro-ia':
        return <Study2AiStudio />;
      case 'mis-apuntes':
        return <Study2NotesView />;
      case 'biblioteca':
        return <Study2LibraryView />;
      case 'calendario':
        return (
          <UnifiedShiftCalendar
            contextLabel="FABRO Estudio · Calendario Visual"
            initialDomain="todos"
          />
        );
      case 'evaluaciones':
        return <Study2EvaluationsView />;
      case 'mi-progreso':
        return <Study2ProgressView />;
      case 'herramientas':
        return <Study2ToolsView />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Mobile Header Bar (clean, single drawer trigger + current section) */}
      <div className="xl:hidden flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-3.5 text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          <Menu className="w-4 h-4" />
          <span>Menú Estudio</span>
        </button>

        <div className="min-w-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Sección activa
          </p>
          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {activeItem.label}
          </p>
        </div>
      </div>

      {/* Desktop 2-Column Layout modeled directly on FABRO CULTURA */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <aside className="hidden xl:block xl:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-[72px] max-h-[calc(100dvh-96px)] overflow-hidden">
          {renderSidebarContent()}
        </aside>

        <div className="xl:col-span-9 min-w-0">{renderActiveSection()}</div>
      </div>

      {/* Mobile Slide-Over Sidebar */}
      {mobileSidebarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú lateral de FABRO Estudio"
          className="xl:hidden fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex justify-start"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="w-[85vw] max-w-xs h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                FABRO Estudio
              </span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Cerrar menú de Estudio"
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{renderSidebarContent()}</div>
          </div>
        </div>
      )}
    </div>
  );
};
