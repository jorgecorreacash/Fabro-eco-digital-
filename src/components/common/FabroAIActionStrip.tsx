import React from 'react';
import {
  BookOpenCheck,
  FileDown,
  HelpCircle,
  Layers,
  ListChecks,
  Save,
  Sparkles,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { exportMarkdownToPdf, markdownToHtml } from '../../lib/exporters';

export interface FabroAIActionStripProps {
  title: string;
  content: string;
  sourceUrls?: Array<{ title?: string; url: string }>;
  compact?: boolean;
  onSavedNote?: (message: string) => void;
}

export const FabroAIActionStrip: React.FC<FabroAIActionStripProps> = ({
  title,
  content,
  sourceUrls,
  compact = false,
  onSavedNote,
}) => {
  const { setAiDraftPrompt, setActiveSection, createNote, selectedSubjectId, subjects } = useFabro();

  const cleanText = (content || '').trim();
  const safeTitle = (title || 'Material de estudio FABRO').trim();
  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);

  const sendToFabroAI = (prefix: string) => {
    const body = cleanText ? `\n\n---\nTítulo: ${safeTitle}\n\n${cleanText.slice(0, 12000)}` : `\n\nTema: ${safeTitle}`;
    const refs =
      sourceUrls && sourceUrls.length > 0
        ? `\n\nFuentes:\n${sourceUrls.map((s) => `- ${s.title || s.url}: ${s.url}`).join('\n')}`
        : '';
    setAiDraftPrompt(`${prefix}${body}${refs}`);
    setActiveSection('fabro-ai');
  };

  const handleExportPdf = () => {
    exportMarkdownToPdf({
      title: safeTitle,
      subjectName: activeSubject?.name,
      sourceUrls,
      markdown: cleanText || `# ${safeTitle}\n\nSin contenido textual para exportar.`,
    });
  };

  const handleSaveNote = async () => {
    const text = cleanText || safeTitle;
    await createNote({
      subjectId: selectedSubjectId || '',
      unit: '',
      folder: 'Investigación y Recursos',
      title: safeTitle.slice(0, 180),
      contentHtml: markdownToHtml(text),
      contentText: text,
      tags: ['fabro-hub', 'estudio'],
      attachments: [],
      offlineAvailable: true,
    });
    if (onSavedNote) {
      onSavedNote('Guardado en Apuntes correctamente.');
    }
  };

  const btnCls = compact
    ? 'inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-300 transition-colors cursor-pointer'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-300 transition-colors cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Acciones FABRO IA">
      <button
        type="button"
        onClick={() =>
          sendToFabroAI(
            '/DESARROLLO ANALIZAR CON FABRO IA: Realizá un análisis crítico, conceptual y riguroso de este material:'
          )
        }
        className={`${btnCls} border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold`}
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span>ANALIZAR CON FABRO IA</span>
      </button>

      <button
        type="button"
        onClick={() =>
          sendToFabroAI(
            '/RESUMEN RESUMIR CON FABRO IA: Sintetizá las ideas principales, argumentos y conclusiones clave:'
          )
        }
        className={btnCls}
      >
        <Layers className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <span>RESUMIR CON FABRO IA</span>
      </button>

      <button
        type="button"
        onClick={() =>
          sendToFabroAI(
            '/EXPLICAR EXPLICAR CONTENIDO: Explicá de forma clara, didáctica y con ejemplos prácticos:'
          )
        }
        className={btnCls}
      >
        <BookOpenCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>EXPLICAR CONTENIDO</span>
      </button>

      <button
        type="button"
        onClick={() =>
          sendToFabroAI(
            '/PROGRAMA CREAR GUÍA DE ESTUDIO: Armá una guía estructurada con objetivos, conceptos, mapa de temas y autoevaluación:'
          )
        }
        className={btnCls}
      >
        <ListChecks className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span>CREAR GUÍA DE ESTUDIO</span>
      </button>

      <button
        type="button"
        onClick={() =>
          sendToFabroAI(
            '/EXAMEN GENERAR PREGUNTAS: Creá preguntas de examen (múltiple opción y desarrollo) con respuestas modelo:'
          )
        }
        className={btnCls}
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>GENERAR PREGUNTAS</span>
      </button>

      <button type="button" onClick={handleExportPdf} className={btnCls}>
        <FileDown className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
        <span>EXPORTAR A PDF</span>
      </button>

      {onSavedNote && (
        <button type="button" onClick={() => void handleSaveNote()} className={btnCls}>
          <Save className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span>Guardar en Apuntes</span>
        </button>
      )}
    </div>
  );
};
