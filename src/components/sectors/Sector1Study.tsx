import React, { useState } from 'react';
import {
  Calendar,
  CalendarDays,
  CheckSquare,
  FileText,
  Film,
  GraduationCap,
  MessageSquareText,
  Microscope,
  Square,
  Trash2,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import type { StudySubmenuId } from '../../types/ecosystem';
import { SectorLayout } from './SectorLayout';
import { AdvancedNotebooksStudio } from './study/AdvancedNotebooksStudio';
import { ConceptMapTool } from './study/ConceptMapTool';
import { FlashcardsSrsTool } from './study/FlashcardsSrsTool';
import { GradeCalculatorTool } from './study/GradeCalculatorTool';
import { PaintableCalendarPanel } from './study/PaintableCalendarPanel';
import { PomodoroTool } from './study/PomodoroTool';
import { QuizSimulatorTool } from './study/QuizSimulatorTool';
import { StudyVideoLibraryPanel } from './study/StudyVideoLibraryPanel';
import { StudyWallCommunitiesPanel } from './study/StudyWallCommunitiesPanel';
import { VoiceNotesTool } from './study/VoiceNotesTool';
import { WordStudyWorkspace } from './study/WordStudyWorkspace';

export const Sector1Study: React.FC = () => {
  const {
    submenu,
    navigateTo,
    glossaryTerms,
    agendaTasks,
    toggleAgendaTask,
    pomodoroLogs,
    studyVideos,
    paintedCalendarEvents,
    wallPosts,
    studyCommunities,
    examplesCleared,
    clearSeedExamples,
  } = useEcosystem();

  const activeSub: StudySubmenuId =
    submenu === 'academico-panel' ||
    submenu === 'videoteca-estudio' ||
    submenu === 'calendario-pintable' ||
    submenu === 'muro-estudio' ||
    submenu === 'materias-apuntes' ||
    submenu === 'biblioteca-glosario' ||
    submenu === 'mapas-flashcards' ||
    submenu === 'examenes-calendario' ||
    submenu === 'investigacion-fuentes'
      ? submenu
      : 'academico-panel';

  const [showPomodoroPanel, setShowPomodoroPanel] = useState(false);

  const studyWallCount = wallPosts.filter(
    (p) => p.origin === 'estudio' || p.origin === 'comunidad'
  ).length;

  const primaryStudyTabs: Array<{
    id: StudySubmenuId;
    label: string;
    shortLabel: string;
    count?: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'academico-panel',
      label: 'Hoja de Estudio (Word)',
      shortLabel: 'Hoja Word',
      icon: FileText,
    },
    {
      id: 'videoteca-estudio',
      label: 'Videoteca Educativa',
      shortLabel: 'Videoteca',
      count: studyVideos.length,
      icon: Film,
    },
    {
      id: 'calendario-pintable',
      label: 'Calendario y Agenda',
      shortLabel: 'Calendario',
      count: paintedCalendarEvents.length,
      icon: CalendarDays,
    },
    {
      id: 'muro-estudio',
      label: 'Muro de Estudio',
      shortLabel: 'Muro Estudio',
      count: studyWallCount + studyCommunities.length,
      icon: MessageSquareText,
    },
  ];

  return (
    <SectorLayout
      sectorId="estudio"
      activeSubmenu={activeSub}
      badgeText="Hoja Word · Videoteca · Calendario Pintable · Muro Académico"
    >
      {/* Compact Primary Study Tabs */}
      <nav
        aria-label="Pestañas principales de Estudio"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2"
      >
        {primaryStudyTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSub === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo('estudio', tab.id)}
              className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                isActive
                  ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.8)]'
                  : 'fabro-border fabro-surface hover:border-[#2563EB]'
              }`}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-[#2563EB] dark:text-[#60A5FA]'
                  }`}
                />
                <span className="truncate hidden sm:inline">{tab.label}</span>
                <span className="truncate sm:hidden">{tab.shortLabel}</span>
              </span>
              {typeof tab.count === 'number' && (
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-mono tabular-nums shrink-0 ${
                    isActive
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'fabro-border fabro-surface-elevated fabro-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {activeSub === 'videoteca-estudio' && <StudyVideoLibraryPanel />}

      {activeSub === 'calendario-pintable' && <PaintableCalendarPanel />}

      {activeSub === 'muro-estudio' && <StudyWallCommunitiesPanel />}

      {activeSub === 'academico-panel' && (
        <div className="space-y-4">
          <WordStudyWorkspace />

          {/* Discreet expandable Pomodoro focus strip without cluttering the document flow */}
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs fabro-muted px-1">
              <button
                type="button"
                onClick={() => setShowPomodoroPanel((v) => !v)}
                className="min-h-[38px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface px-3.5 py-1.5 text-xs font-semibold cursor-pointer hover:border-[#2563EB]"
              >
                <GraduationCap className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
                {showPomodoroPanel
                  ? 'Ocultar temporizador Pomodoro'
                  : `Temporizador Pomodoro (${pomodoroLogs.length} sesiones)`}
              </button>

              {!examplesCleared && (
                <button
                  type="button"
                  onClick={() => void clearSeedExamples()}
                  className="inline-flex items-center gap-1 hover:text-rose-600 cursor-pointer underline"
                >
                  <Trash2 className="w-3 h-3" />
                  Borrar plantillas de ejemplo
                </button>
              )}
            </div>

            {showPomodoroPanel && (
              <div className="mt-3">
                <PomodoroTool />
              </div>
            )}
          </div>
        </div>
      )}

      {activeSub === 'materias-apuntes' && (
        <div className="space-y-6">
          <AdvancedNotebooksStudio />
          <VoiceNotesTool />
        </div>
      )}

      {activeSub === 'biblioteca-glosario' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border-2 fabro-surface p-6 space-y-3">
            <h2 className="font-display text-base font-bold">Biblioteca documental offline</h2>
            <p className="text-xs fabro-muted">
              Manuales, artículos y bibliografía indexados localmente para lectura sin internet.
            </p>
            <div className="divide-y fabro-border text-xs">
              {[
                { doc: 'Compendio de Metodología.pdf', meta: 'PDF · 42 páginas · Caché local' },
                { doc: 'Guía de Citas Académicas.docx', meta: 'Documento · 18 páginas · Listo' },
                { doc: 'Lecturas de Filosofía Práctica.epub', meta: 'Libro · Disponible offline' },
              ].map((d) => (
                <div key={d.doc} className="py-3 flex items-center justify-between gap-2">
                  <span className="font-bold truncate">{d.doc}</span>
                  <span className="fabro-muted shrink-0">{d.meta}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-2 fabro-surface p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">Glosario y diccionario académico</h2>
              <button
                type="button"
                onClick={() => navigateTo('estudio', 'materias-apuntes')}
                className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] cursor-pointer"
              >
                Editar en Apuntes →
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              {glossaryTerms.map((term) => (
                <div key={term.id} className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{term.term}</p>
                    <span className="text-[11px] fabro-muted">{term.subject}</span>
                  </div>
                  <p className="fabro-muted mt-1">{term.definition}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSub === 'mapas-flashcards' && (
        <div className="space-y-6">
          <FlashcardsSrsTool />
          <ConceptMapTool />
        </div>
      )}

      {activeSub === 'examenes-calendario' && (
        <div className="space-y-6">
          <QuizSimulatorTool />

          <GradeCalculatorTool />

          <div className="rounded-2xl border-2 fabro-surface p-6 space-y-3">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#06B6D4]" />
              Calendario académico y bloques Pomodoro
            </h2>
            <div className="space-y-2 text-xs">
              {agendaTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleAgendaTask(t.id)}
                  className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated p-3 flex items-center justify-between gap-2 text-left cursor-pointer active:scale-[0.99]"
                >
                  <span className={`flex items-center gap-2 font-semibold ${t.done ? 'line-through opacity-60' : ''}`}>
                    {t.done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-[#2563EB] shrink-0" />
                    )}
                    {t.task}
                  </span>
                  <span className="font-mono text-[11px] fabro-muted tabular-nums shrink-0">
                    {t.date}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSub === 'investigacion-fuentes' && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 fabro-surface p-6 space-y-3">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Microscope className="w-5 h-5 text-[#2563EB] dark:text-[#38BDF8]" />
              B. Investigación, Comparación de Fuentes y Citaciones
            </h2>
            <p className="text-xs fabro-muted leading-relaxed">
              Transparencia académica obligatoria: todo análisis asistido cuando conectes tu propia
              clave BYOK en el Sector 4 diferencia explícitamente qué es un hecho verificado, qué es
              interpretación y qué fragmento es texto generado.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="rounded-xl border-2 border-emerald-500/40 fabro-surface-elevated p-4 space-y-1">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">
                  Hecho verificado
                </p>
                <p className="fabro-muted">
                  Cita textual o dato verificable directamente en el documento o fuente primaria.
                </p>
              </div>
              <div className="rounded-xl border-2 border-amber-500/40 fabro-surface-elevated p-4 space-y-1">
                <p className="font-bold fabro-gold-text">Interpretación</p>
                <p className="fabro-muted">
                  Relación conceptual o contraste metodológico inferido entre dos fuentes.
                </p>
              </div>
              <div className="rounded-xl border-2 border-[#2563EB]/40 fabro-surface-elevated p-4 space-y-1">
                <p className="font-bold text-[#2563EB] dark:text-[#60A5FA]">Texto generado (BYOK)</p>
                <p className="fabro-muted">
                  Síntesis redactada con tu clave API personal, sujeta a revisión humana.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </SectorLayout>
  );
};
