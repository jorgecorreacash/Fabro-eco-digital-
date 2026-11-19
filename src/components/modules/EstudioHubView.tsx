import React, { useMemo, useState } from 'react';
import {
  Award,
  BookMarked,
  BookOpen,
  Calendar,
  Clock,
  Compass,
  Feather,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  KeyRound,
  Layers,
  Library,
  Microscope,
  Palette,
  Search,
  Sparkles,
  Wrench,
  Youtube,
  BarChart3,
  LayoutGrid,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import type { NavSectionId } from '../../types/fabro';
import { AcademyView } from './AcademyView';
import { BookWriterView } from './BookWriterView';
import { CalendarView } from './CalendarView';
import { DictionaryView } from './DictionaryView';
import { ExamsView } from './ExamsView';
import { FabroAIBrowserView } from './FabroAIBrowserView';
import { FabroAIView } from './FabroAIView';
import { FabroConnectView } from './FabroConnectView';
import { FabroDesignView } from './FabroDesignView';
import { FabroDocumentsView } from './FabroDocumentsView';
import { FabroExplorerView } from './FabroExplorerView';
import { FabroHubView } from './FabroHubView';
import { FabroKnowledgeView } from './FabroKnowledgeView';
import { FabroResearchView } from './FabroResearchView';
import { FabroStudyView } from './FabroStudyView';
import { FabroToolsView } from './FabroToolsView';
import { LibraryView } from './LibraryView';
import { MemorizationView } from './MemorizationView';
import { NotesView } from './NotesView';
import { ProfileDirectoryView } from './ProfileDirectoryView';
import { ProgressView } from './ProgressView';
import { SourcesBrowserView } from './SourcesBrowserView';
import { SubjectsView } from './SubjectsView';
import { VideoLearningView } from './VideoLearningView';

type StudyCategoryId = 'resumen' | 'organizacion' | 'clases' | 'multi_ia' | 'investigacion' | 'practica';

const STUDY_MODULES: Array<{
  id: NavSectionId;
  label: string;
  desc: string;
  group: Exclude<StudyCategoryId, 'resumen'>;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'materias', label: 'Mis Materias', desc: 'Programas, cátedras, bibliografías y progreso', group: 'organizacion', icon: BookOpen },
  { id: 'apuntes', label: 'Cuadernos y Apuntes', desc: 'Editor, resúmenes automáticos, cronologías y PDF/Word', group: 'organizacion', icon: FileText },
  { id: 'biblioteca', label: 'Biblioteca Personal', desc: 'Libros, PDF, fotos y lectura guiada', group: 'organizacion', icon: FolderKanban },
  { id: 'libros', label: 'Escribir Libros', desc: 'Capítulos y manuscrito editorial', group: 'organizacion', icon: Feather },
  { id: 'calendario', label: 'Calendario Académico', desc: 'Planificador de exámenes, entregas y cursada', group: 'organizacion', icon: Calendar },

  { id: 'academy', label: 'Cursos y Especialidades', desc: 'Cursos gratuitos o arancelados por carrera', group: 'clases', icon: Award },
  { id: 'perfil', label: 'Perfiles y Comunidad', desc: 'Fotos, frases compartidas y perfiles de la comunidad', group: 'clases', icon: GraduationCap },
  { id: 'video', label: 'Videoteca IA', desc: 'Clases grabadas de YouTube y resúmenes', group: 'clases', icon: Youtube },

  { id: 'fabro-ai', label: 'FABRO IA', desc: 'Tutor inteligente (Gemini, ChatGPT y BYOK)', group: 'multi_ia', icon: Sparkles },
  { id: 'hub', label: 'FABRO HUB', desc: 'Comparador y 40+ plataformas educativas', group: 'multi_ia', icon: Compass },
  { id: 'connect', label: 'FABRO Connect', desc: 'Conexiones personales y IA por sector', group: 'multi_ia', icon: KeyRound },
  { id: 'ai-browser', label: 'AI Browser', desc: 'Navegación paralela multi-IA', group: 'multi_ia', icon: Globe },
  { id: 'explorer', label: 'FABRO Explorer', desc: 'Portales académicos en ventana integrada', group: 'multi_ia', icon: Search },

  { id: 'fuentes', label: 'Buscador de Fuentes', desc: 'Fuentes reales de internet y enciclopedia visual', group: 'investigacion', icon: Globe },
  { id: 'research', label: 'FABRO Research', desc: 'Investigación con referencias APA/MLA/Chicago', group: 'investigacion', icon: Microscope },
  { id: 'knowledge', label: 'FABRO Knowledge', desc: 'PubMed, ERIC, SciELO y repositorios', group: 'investigacion', icon: Library },
  { id: 'diccionario', label: 'Diccionario y Glosario', desc: 'Definiciones técnicas y terminología', group: 'investigacion', icon: BookMarked },

  { id: 'examenes', label: 'Exámenes Orales y Escritos', desc: 'Simulacros, cuestionarios y corrección', group: 'practica', icon: GraduationCap },
  { id: 'memorizacion', label: 'Tarjetas de Memoria', desc: 'Repaso espaciado activo', group: 'practica', icon: Layers },
  { id: 'study', label: 'FABRO Study', desc: 'Traductor de textos, Pomodoro y dictado de voz', group: 'practica', icon: Clock },
  { id: 'documents', label: 'Documentos y Conversión', desc: 'Unir, dividir, OCR y exportar PDF', group: 'practica', icon: FileSpreadsheet },
  { id: 'design', label: 'Mapas Conceptuales y Diseño', desc: 'Esquemas visuales, infografías y diagramas', group: 'practica', icon: Palette },
  { id: 'tools', label: 'FABRO Tools', desc: 'Calculadora científica, estadística y unidades', group: 'practica', icon: Wrench },
  { id: 'progreso', label: 'Mi Progreso Académico', desc: 'Estadísticas y seguimiento semanal', group: 'practica', icon: BarChart3 },
];

const CATEGORY_TABS: Array<{ id: StudyCategoryId; label: string }> = [
  { id: 'resumen', label: 'Mapa de Estudio' },
  { id: 'organizacion', label: 'Cuadernos, Materias y Agenda' },
  { id: 'clases', label: 'Cursos y Comunidad' },
  { id: 'multi_ia', label: 'Multi-IA y Explorer' },
  { id: 'investigacion', label: 'Investigación y Fuentes' },
  { id: 'practica', label: 'Exámenes, Docs y Mapas' },
];

export const EstudioHubView: React.FC = () => {
  const { subjects, notes, libraryDocs, exams, decks, studySessions, setActiveSection } = useFabro();
  const [catTab, setCatTab] = useState<StudyCategoryId>('resumen');
  const [embeddedTool, setEmbeddedTool] = useState<NavSectionId | null>(null);

  const visibleModules = useMemo(() => {
    if (catTab === 'resumen') return STUDY_MODULES;
    return STUDY_MODULES.filter((m) => m.group === catTab);
  }, [catTab]);

  const totalHours = useMemo(
    () => (studySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) / 60).toFixed(1),
    [studySessions]
  );

  const renderEmbedded = () => {
    switch (embeddedTool) {
      case 'materias': return <SubjectsView />;
      case 'apuntes': return <NotesView />;
      case 'biblioteca': return <LibraryView />;
      case 'libros': return <BookWriterView />;
      case 'calendario': return <CalendarView />;
      case 'perfil': return <ProfileDirectoryView />;
      case 'fabro-ai': return <FabroAIView />;
      case 'hub': return <FabroHubView />;
      case 'connect': return <FabroConnectView />;
      case 'ai-browser': return <FabroAIBrowserView />;
      case 'explorer': return <FabroExplorerView />;
      case 'fuentes': return <SourcesBrowserView />;
      case 'research': return <FabroResearchView />;
      case 'knowledge': return <FabroKnowledgeView />;
      case 'diccionario': return <DictionaryView />;
      case 'academy': return <AcademyView />;
      case 'video': return <VideoLearningView />;
      case 'examenes': return <ExamsView />;
      case 'memorizacion': return <MemorizationView />;
      case 'study': return <FabroStudyView />;
      case 'documents': return <FabroDocumentsView />;
      case 'design': return <FabroDesignView />;
      case 'tools': return <FabroToolsView />;
      case 'progreso': return <ProgressView />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <section className="rounded-2xl border border-violet-500/25 fabro-shell-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-[#E5B842]">
                Sector 01 · Estudio, Investigación y Clases
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('inicio')}
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-[#E5B842] cursor-pointer whitespace-nowrap"
              >
                ← Volver a Inicio
              </button>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#FAF6EE] [text-wrap:balance]">
              Estudio e Investigación
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Organizá tus materias y cuadernos exportables, investigá con fuentes académicas reales, participá en clases virtuales y practicá con simulacros Multi-IA.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-slate-200 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#070B17]/60 shrink-0 text-center">
            <div className="px-3 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Materias</p>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">{subjects.length}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Apuntes</p>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">{notes.length}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Biblioteca</p>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">{libraryDocs.length}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Exámenes</p>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">{exams.length}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Horas / Mazos</p>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">{totalHours}h · {decks.length}</p>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/80 dark:border-white/10">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setCatTab(t.id);
                setEmbeddedTool(null);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                catTab === t.id && !embeddedTool
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
          {embeddedTool && (
            <button
              type="button"
              onClick={() => setEmbeddedTool(null)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 cursor-pointer whitespace-nowrap"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Volver al catálogo de Estudio
            </button>
          )}
        </div>
      </section>

      {embeddedTool ? (
        <div className="space-y-4">{renderEmbedded()}</div>
      ) : (
        <div className="space-y-7">
          {(['organizacion', 'clases', 'multi_ia', 'investigacion', 'practica'] as const).map((groupKey) => {
            if (catTab !== 'resumen' && catTab !== groupKey) return null;
            const groupItems = visibleModules.filter((m) => m.group === groupKey);
            const groupTitle = CATEGORY_TABS.find((c) => c.id === groupKey)?.label || groupKey;
            return (
              <section key={groupKey} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/70 pb-1.5">
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    {groupTitle}
                  </h3>
                  <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {groupItems.length} herramientas
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {groupItems.map((mod) => {
                    const Icon = mod.icon;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setEmbeddedTool(mod.id)}
                        className="text-left rounded-xl border border-slate-200/90 dark:border-slate-800 fabro-shell-surface p-4 hover:border-sky-500/60 transition-colors cursor-pointer group flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-semibold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {mod.label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {mod.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
