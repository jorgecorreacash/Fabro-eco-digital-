import React, { useState } from 'react';
import {
  Calendar,
  Clover,
  Dumbbell,
  FileSpreadsheet,
  LayoutGrid,
  Palette,
  Star,
  Timer,
  Wrench,
} from 'lucide-react';
import type { NavSectionId } from '../../types/fabro';
import { CalendarView } from './CalendarView';
import { ExercisesLevelsView } from './ExercisesLevelsView';
import { FabroDesignView } from './FabroDesignView';
import { FabroDocumentsView } from './FabroDocumentsView';
import { FabroToolsView } from './FabroToolsView';
import { HabitWellnessView } from './HabitWellnessView';
import { HoroscopeView } from './HoroscopeView';
import { LuckyNumbersView } from './LuckyNumbersView';

const TOOLS_CATALOG: Array<{
  id: NavSectionId;
  title: string;
  desc: string;
  category: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'tools', title: 'FABRO Tools', desc: 'Calculadora científica, estadística, unidades, monedas, códigos QR y corrector', category: 'Cálculo y Utilidades', icon: Wrench },
  { id: 'documents', title: 'FABRO Documents', desc: 'Unir, dividir, comprimir PDF, extraer texto OCR y convertir Word/Imagen', category: 'Documentos', icon: FileSpreadsheet },
  { id: 'design', title: 'FABRO Design', desc: 'Portadas, infografías, mapas conceptuales y diagramas', category: 'Diseño Visual', icon: Palette },
  { id: 'calendario', title: 'Calendario Personal', desc: 'Fechas de entregas, parciales, objetivos y metas diarias', category: 'Agenda', icon: Calendar },
  { id: 'habitos', title: 'Temporizador de Hábitos', desc: 'Rutinas con alertas sonoras, dieta nutricional y cuidado mental/físico IA', category: 'Bienestar y Tiempo', icon: Timer },
  { id: 'ejercicios', title: 'Ejercicios con Niveles', desc: 'Entrenamiento progresivo desde Inicial hasta Maestro con intervalos', category: 'Movimiento', icon: Dumbbell },
  { id: 'horoscopo', title: 'Horóscopos', desc: 'Pronóstico diario de los 12 signos y afinidad entre signos', category: 'Inspiración Diaria', icon: Star },
  { id: 'suerte', title: 'Números de la Suerte 🍀', desc: 'Combinación diaria, generador trébol y cálculo numerológico', category: 'Trébol de 4 Hojas', icon: Clover },
];

export const HerramientasHubView: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<NavSectionId | null>(null);

  const renderTool = () => {
    switch (selectedTool) {
      case 'tools': return <FabroToolsView />;
      case 'documents': return <FabroDocumentsView />;
      case 'design': return <FabroDesignView />;
      case 'calendario': return <CalendarView />;
      case 'habitos': return <HabitWellnessView />;
      case 'ejercicios': return <ExercisesLevelsView />;
      case 'horoscopo': return <HoroscopeView />;
      case 'suerte': return <LuckyNumbersView />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            <Wrench className="w-4 h-4" />
            <span>Panel General de Herramientas · Productividad y Vida Diaria</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Todas las Herramientas FABRO
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Acceso centralizado a calculadoras científicas, edición PDF/OCR, diseño visual, agenda, temporizador de hábitos, ejercicios con niveles, horóscopos y números de la suerte 🍀.
          </p>
        </div>

        {selectedTool && (
          <button
            type="button"
            onClick={() => setSelectedTool(null)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Ver las {TOOLS_CATALOG.length} herramientas
          </button>
        )}
      </section>

      {selectedTool ? (
        <div>{renderTool()}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOLS_CATALOG.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedTool(item.id)}
                className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 hover:border-sky-500/50 transition-all cursor-pointer group flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-sky-600/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.category}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.desc}
                  </p>
                </div>
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  Abrir herramienta →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
