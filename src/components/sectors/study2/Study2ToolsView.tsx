import React, { useState } from 'react';
import {
  BookA,
  BookMarked,
  Calculator,
  CheckSquare,
  FileDiff,
  FileImage,
  FileText,
  GitBranch,
  HelpCircle,
  History,
  Languages,
  Layers,
  Quote,
  Ruler,
  SpellCheck,
  Table2,
  Timer,
} from 'lucide-react';
import { Study2ToolsGroupA, type GroupAToolId } from './Study2ToolsGroupA';
import { Study2ToolsGroupB, type GroupBToolId } from './Study2ToolsGroupB';

type AllToolId = GroupAToolId | GroupBToolId;

interface ToolMeta {
  id: AllToolId;
  group: 'A' | 'B';
  label: string;
  subtitle: string;
  Icon: React.FC<{ className?: string }>;
}

const EDUCATIONAL_TOOLS: ToolMeta[] = [
  { id: 'calculadora', group: 'A', label: 'Calculadora científica', subtitle: 'Operaciones y trigonometría', Icon: Calculator },
  { id: 'conversor', group: 'A', label: 'Conversor de unidades', subtitle: 'Longitud, masa, datos y más', Icon: Ruler },
  { id: 'mapas', group: 'A', label: 'Mapas conceptuales', subtitle: 'Diagramas jerárquicos SVG', Icon: GitBranch },
  { id: 'cuestionarios', group: 'A', label: 'Cuestionarios', subtitle: 'Práctica y corrección real', Icon: HelpCircle },
  { id: 'flashcards', group: 'A', label: 'Tarjetas de memoria', subtitle: 'Repaso espaciado Leitner', Icon: Layers },
  { id: 'diccionario', group: 'A', label: 'Diccionario académico', subtitle: 'Wikcionario y Wikipedia ES', Icon: BookA },
  { id: 'traductor', group: 'A', label: 'Traductor', subtitle: 'Traducción multilingüe', Icon: Languages },
  { id: 'corrector', group: 'A', label: 'Corrector ortográfico', subtitle: 'Gramática vía LanguageTool', Icon: SpellCheck },
  { id: 'citas', group: 'A', label: 'Generador de citas', subtitle: 'APA 7, MLA, Chicago, IEEE, ISO', Icon: Quote },
  { id: 'bibliografia', group: 'B', label: 'Organizador de bibliografía', subtitle: 'Referencias por materia', Icon: BookMarked },
  { id: 'lector-pdf', group: 'B', label: 'Lector de PDF', subtitle: 'Lectura directa de documentos', Icon: FileText },
  { id: 'pdf-texto', group: 'B', label: 'PDF a texto', subtitle: 'Extracción real con PDF.js', Icon: FileText },
  { id: 'imagenes-pdf', group: 'B', label: 'Imágenes a PDF', subtitle: 'Compilador multipágina', Icon: FileImage },
  { id: 'comparador', group: 'B', label: 'Comparador de documentos', subtitle: 'Diferencias línea a línea', Icon: FileDiff },
  { id: 'pomodoro', group: 'B', label: 'Temporizador Pomodoro', subtitle: 'Conectado a Mi progreso', Icon: Timer },
  { id: 'tareas', group: 'B', label: 'Organizador de tareas', subtitle: 'Entregas y pendientes', Icon: CheckSquare },
  { id: 'cronologia', group: 'B', label: 'Cronología histórica', subtitle: 'Línea de tiempo ordenada', Icon: History },
  { id: 'cuadros', group: 'B', label: 'Cuadros comparativos', subtitle: 'Tablas editables y Markdown', Icon: Table2 },
];

export const Study2ToolsView: React.FC = () => {
  const [activeToolId, setActiveToolId] = useState<AllToolId>('calculadora');
  const activeTool =
    EDUCATIONAL_TOOLS.find((t) => t.id === activeToolId) || EDUCATIONAL_TOOLS[0];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Herramientas educativas
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          18 instrumentos académicos reales listos para usar de forma independiente o integrados con tus materias.
        </p>
      </section>

      {/* Clean Tool Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {EDUCATIONAL_TOOLS.map((tool) => {
          const Icon = tool.Icon;
          const selected = tool.id === activeToolId;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveToolId(tool.id)}
              className={`min-h-[68px] rounded-xl border p-2.5 text-left flex flex-col justify-between gap-1.5 transition-colors cursor-pointer ${
                selected
                  ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-bold leading-tight line-clamp-2">
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tool Workspace */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {activeTool.label}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeTool.subtitle}
          </p>
        </div>

        {activeTool.group === 'A' ? (
          <Study2ToolsGroupA toolId={activeTool.id as GroupAToolId} />
        ) : (
          <Study2ToolsGroupB toolId={activeTool.id as GroupBToolId} />
        )}
      </section>
    </div>
  );
};
