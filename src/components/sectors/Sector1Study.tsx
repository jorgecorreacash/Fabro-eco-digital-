import React, { useState } from 'react';
import {
  BookMarked,
  Calendar,
  CheckSquare,
  FileText,
  GitBranch,
  GraduationCap,
  MessageSquare,
  Microscope,
  Share2,
  Square,
  Trash2,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import type { StudySubmenuId } from '../../types/ecosystem';
import { ShareResourceButton } from '../common/ShareResourceButton';
import { SectorLayout } from './SectorLayout';
import { AdvancedNotebooksStudio } from './study/AdvancedNotebooksStudio';
import { ConceptMapTool } from './study/ConceptMapTool';
import { FlashcardsSrsTool } from './study/FlashcardsSrsTool';
import { GradeCalculatorTool } from './study/GradeCalculatorTool';
import { PomodoroTool } from './study/PomodoroTool';
import { QuizSimulatorTool } from './study/QuizSimulatorTool';
import { VoiceNotesTool } from './study/VoiceNotesTool';

export const Sector1Study: React.FC = () => {
  const {
    submenu,
    navigateTo,
    sendQuickChatMessage,
    setRightPanelOpen,
    quickNotes,
    advancedNotes,
    glossaryTerms,
    agendaTasks,
    toggleAgendaTask,
    pomodoroLogs,
    profile,
    examplesCleared,
    clearSeedExamples,
  } = useEcosystem();

  const activeSub: StudySubmenuId =
    submenu === 'academico-panel' ||
    submenu === 'materias-apuntes' ||
    submenu === 'biblioteca-glosario' ||
    submenu === 'mapas-flashcards' ||
    submenu === 'examenes-calendario' ||
    submenu === 'investigacion-fuentes'
      ? submenu
      : 'academico-panel';

  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const featuredNote = advancedNotes[0];

  const handleShareFabro = () => {
    sendQuickChatMessage(
      `Apunte compartido desde Sector 1: "${featuredNote?.title || 'Cuaderno de estudio'}"`
    );
    setRightPanelOpen(true);
    setShareFeedback('Enviado al chat interno rápido de FABRO.');
  };

  return (
    <SectorLayout
      sectorId="estudio"
      activeSubmenu={activeSub}
      badgeText="Azul cobalto & Cian · Entorno Académico e Investigación"
    >
      {activeSub === 'academico-panel' && (
        <div className="space-y-6">
          {/* Swipeable Mobile Stat Strip */}
          <div className="flex sm:grid sm:grid-cols-4 gap-3 overflow-x-auto no-scrollbar snap-x pb-1 sm:overflow-visible">
            {[
              { label: 'Apuntes guardados', value: String(advancedNotes.length) },
              { label: 'Sesiones Pomodoro', value: String(pomodoroLogs.length) },
              { label: 'Notas rápidas', value: String(quickNotes.length) },
              { label: 'Tareas en agenda', value: String(agendaTasks.length) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="min-w-[44vw] sm:min-w-0 snap-start rounded-2xl border-2 border-[#2563EB]/30 fabro-surface p-4 space-y-1"
              >
                <p className="text-xs fabro-muted font-medium">{stat.label}</p>
                <p className="font-mono text-2xl font-extrabold tabular-nums text-[#2563EB] dark:text-[#38BDF8]">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <PomodoroTool />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-2xl border-2 fabro-surface p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Mapa del Entorno Académico</h2>
                <span className="text-xs fabro-muted">Almacenamiento local IndexedDB</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    sub: 'materias-apuntes' as const,
                    icon: FileText,
                    title: 'Cuadernos Digitales y Apuntes PDF',
                    desc: 'Editor enriquecido con resaltador, glosario lateral, audio y exportación PDF.',
                  },
                  {
                    sub: 'mapas-flashcards' as const,
                    icon: GitBranch,
                    title: 'Mapas y Flashcards SRS',
                    desc: 'Esquemas visuales exportables y tarjetas giratorias con repetición espaciada.',
                  },
                  {
                    sub: 'examenes-calendario' as const,
                    icon: GraduationCap,
                    title: 'Promedios y Agenda Académica',
                    desc: 'Calculadora de promoción, simulacros y calendario vinculado.',
                  },
                  {
                    sub: 'biblioteca-glosario' as const,
                    icon: BookMarked,
                    title: 'Biblioteca y Glosario',
                    desc: 'Documentos guardados offline y terminología por disciplina.',
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.sub}
                      type="button"
                      onClick={() => navigateTo('estudio', card.sub)}
                      className="min-h-[88px] text-left rounded-2xl border-2 border-[#06B6D4]/30 fabro-surface-elevated p-4 space-y-1.5 hover:border-[#2563EB] transition-all cursor-pointer active:scale-95"
                    >
                      <Icon className="w-5 h-5 text-[#2563EB] dark:text-[#38BDF8]" />
                      <p className="text-sm font-bold">{card.title}</p>
                      <p className="text-xs fabro-muted leading-relaxed">{card.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border-2 fabro-surface p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#06B6D4]" />
                Compartir estudio sin registro
              </h2>
              <p className="text-xs fabro-muted leading-relaxed">
                Mandá tus apuntes, simulacros o flashcards por WhatsApp: quien abra el link entra
                directo a leer o practicar sin crear cuenta.
              </p>
              <div className="space-y-2.5">
                {featuredNote ? (
                  <ShareResourceButton
                    payload={{
                      v: 1,
                      kind: 'note',
                      title: featuredNote.title,
                      subject: featuredNote.subject,
                      body: featuredNote.contentText,
                      mainIdea: featuredNote.mainIdea || undefined,
                      summaryText: featuredNote.summaryText || undefined,
                      tags: featuredNote.tags,
                      author: profile.displayName,
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateTo('estudio', 'materias-apuntes')}
                    className="w-full fabro-btn border-[#2563EB] bg-[#2563EB] text-white"
                  >
                    <FileText className="w-4 h-4" />
                    Abrir Cuadernos Digitales
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShareFabro}
                  className="w-full fabro-btn border-[#2563EB] bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#60A5FA]"
                >
                  <MessageSquare className="w-4 h-4" />
                  Enviar también al chat FABRO
                </button>
              </div>
              {shareFeedback && <p className="text-xs fabro-gold-text font-semibold">{shareFeedback}</p>}

              {!examplesCleared && (
                <div className="pt-2 border-t fabro-border flex items-center justify-between gap-2 text-[11px] fabro-muted">
                  <span>Plantillas iniciales cargadas</span>
                  <button
                    type="button"
                    onClick={() => void clearSeedExamples()}
                    className="inline-flex items-center gap-1 hover:text-rose-600 cursor-pointer underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    Borrar ejemplos
                  </button>
                </div>
              )}
            </div>
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
