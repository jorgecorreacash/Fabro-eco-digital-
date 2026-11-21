import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Award,
  BookOpen,
  Drum,
  Guitar,
  Sliders,
} from 'lucide-react';
import { DigitalTunerPro } from './DigitalTunerPro';
import { FabroCancioneros } from './FabroCancioneros';
import {
  ChordLibraryTool,
  MetronomeRhythmTool,
  MusicalTrainerTool,
  TransposerKeyTool,
} from './MusicSuiteTools';

export type MusicToolId =
  | 'afinador'
  | 'cancioneros'
  | 'metronomo'
  | 'acordes'
  | 'transpositor'
  | 'entrenador';

export interface MusicToolCardMeta {
  id: MusicToolId;
  title: string;
  subtitle: string;
  gradientCss: string;
  icon: React.FC<{ className?: string }>;
}

export const MUSIC_TOOLS_CARDS: MusicToolCardMeta[] = [
  {
    id: 'afinador',
    title: 'Afinador Digital',
    subtitle: 'Micrófono real, precisión ±2 cents, guitarra, bajo, abiertas y cromático.',
    gradientCss: 'linear-gradient(135deg, #10B981, #0EA5E9)',
    icon: Sliders,
  },
  {
    id: 'cancioneros',
    title: 'FABRO Cancioneros',
    subtitle: 'Letras con acordes, transposición en vivo, auto-scroll y exportación a PDF.',
    gradientCss: 'linear-gradient(135deg, #7C3AED, #EC4899)',
    icon: BookOpen,
  },
  {
    id: 'metronomo',
    title: 'Metrónomo',
    subtitle: 'BPM 30–240, Tap Tempo, compases y generador de patrones rítmicos.',
    gradientCss: 'linear-gradient(135deg, #F59E0B, #EA580C)',
    icon: Drum,
  },
  {
    id: 'acordes',
    title: 'Biblioteca de Acordes',
    subtitle: 'Diagramas SVG de guitarra y bajo con dedos, cejillas y sonido real.',
    gradientCss: 'linear-gradient(135deg, #2563EB, #6366F1)',
    icon: Guitar,
  },
  {
    id: 'transpositor',
    title: 'Transpositor',
    subtitle: 'Cambiá de tonalidad al instante, acordes diatónicos y progresiones.',
    gradientCss: 'linear-gradient(135deg, #06B6D4, #3B82F6)',
    icon: ArrowLeftRight,
  },
  {
    id: 'entrenador',
    title: 'Entrenador Musical',
    subtitle: 'Escalas en diapasón interactivo, entrenamiento visual y oído musical.',
    gradientCss: 'linear-gradient(135deg, #EC4899, #8B5CF6)',
    icon: Award,
  },
];

interface MusicHubModuleProps {
  initialTool?: MusicToolId | null;
  onBackToTools?: () => void;
}

export const MusicHubModule: React.FC<MusicHubModuleProps> = ({
  initialTool = null,
  onBackToTools,
}) => {
  const [activeTool, setActiveTool] = useState<MusicToolId | null>(initialTool);

  React.useEffect(() => {
    if (initialTool !== undefined) {
      setActiveTool(initialTool);
    }
  }, [initialTool]);

  if (activeTool) {
    const meta = MUSIC_TOOLS_CARDS.find((c) => c.id === activeTool)!;
    return (
      <div className="space-y-4">
        {/* Compact Music Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border fabro-border fabro-surface px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTool(null)}
            className="fabro-btn-secondary min-h-[36px] px-3 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Categoría Música</span>
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {MUSIC_TOOLS_CARDS.map((tool) => {
              const Icon = tool.icon;
              const isCurrent = tool.id === activeTool;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isCurrent
                      ? 'fabro-accent-border fabro-accent-bg'
                      : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tool.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div aria-label={meta.title}>
          {activeTool === 'afinador' && <DigitalTunerPro />}
          {activeTool === 'cancioneros' && <FabroCancioneros />}
          {activeTool === 'metronomo' && <MetronomeRhythmTool />}
          {activeTool === 'acordes' && <ChordLibraryTool />}
          {activeTool === 'transpositor' && <TransposerKeyTool />}
          {activeTool === 'entrenador' && <MusicalTrainerTool />}
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Herramientas Musicales FABRO" className="space-y-4">
      <div className="rounded-2xl border fabro-futuristic-panel p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
            MÚSICA · Estudio Instrumental FABRO
          </h2>
          <p className="text-xs fabro-muted mt-1">
            Afinador digital real con micrófono, creador de cancioneros con PDF, metrónomo, acordes y entrenamiento musical.
          </p>
        </div>
        {onBackToTools && (
          <button
            type="button"
            onClick={onBackToTools}
            className="fabro-btn-secondary shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Todas las herramientas</span>
          </button>
        )}
      </div>

      {/* 6 Visual Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MUSIC_TOOLS_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveTool(card.id)}
              className="group rounded-2xl border fabro-border fabro-surface p-5 text-left flex flex-col justify-between gap-4 hover:border-[var(--fabro-accent)] transition-all cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
                  style={{ background: card.gradientCss }}
                >
                  <Icon className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-bold fabro-accent-text opacity-85 group-hover:opacity-100">
                  Abrir →
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-extrabold">{card.title}</h3>
                <p className="text-xs fabro-muted leading-relaxed">{card.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
