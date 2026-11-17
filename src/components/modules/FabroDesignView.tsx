import React, { useCallback, useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  GitBranch,
  Image as ImageIcon,
  Layout,
  Palette,
  Plus,
  Presentation,
  Save,
  Trash2,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { markdownToHtml } from '../../lib/exporters';
import { FabroAIActionStrip } from '../common/FabroAIActionStrip';

type DesignTemplateId =
  | 'afiche'
  | 'portada'
  | 'presentacion'
  | 'infografia'
  | 'mapa_conceptual'
  | 'linea_tiempo'
  | 'diagrama';

interface DesignItem {
  id: string;
  heading: string;
  detail: string;
  tag: string;
}

const TEMPLATE_META: Array<{
  id: DesignTemplateId;
  label: string;
  subtitle: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultItems: DesignItem[];
}> = [
  {
    id: 'afiche',
    label: 'Afiches / Pósters',
    subtitle: 'Afiche académico o divulgativo con bloque visual y puntos clave',
    defaultTitle: 'Jornada de Investigación y Conocimiento',
    defaultSubtitle: 'Síntesis visual de conceptos centrales, objetivos y conclusiones',
    defaultItems: [
      { id: '1', heading: 'Objetivo central', detail: 'Presentar hipótesis, metodología y hallazgos verificables.', tag: '01' },
      { id: '2', heading: 'Eje teórico', detail: 'Articulación entre autores clásicos, evidencia empírica y normativa.', tag: '02' },
      { id: '3', heading: 'Aplicación práctica', detail: 'Impacto en el estudio de caso y líneas futuras de trabajo.', tag: '03' },
    ],
  },
  {
    id: 'portada',
    label: 'Portadas Académicas',
    subtitle: 'Carátula formal para monografías, trabajos prácticos y tesis',
    defaultTitle: 'Análisis Crítico del Marco Conceptual y Evidencia Empírica',
    defaultSubtitle: 'Trabajo Práctico Integrador · Cátedra de Metodología',
    defaultItems: [
      { id: '1', heading: 'Institución', detail: 'Facultad / Instituto de Formación Superior', tag: 'INST' },
      { id: '2', heading: 'Docente a cargo', detail: 'Prof. Titular / Equipo de Cátedra', tag: 'DOC' },
      { id: '3', heading: 'Fecha de entrega', detail: new Date().toLocaleDateString('es-AR'), tag: 'FECHA' },
    ],
  },
  {
    id: 'presentacion',
    label: 'Presentaciones (Slides)',
    subtitle: 'Diapositivas navegables de exposición listas para exportar a PDF o PNG',
    defaultTitle: 'Exposición Académica Estructurada',
    defaultSubtitle: 'Presentación por bloques temáticos con cierre de síntesis',
    defaultItems: [
      { id: '1', heading: 'Introducción y Problema', detail: 'Contexto del tema, pregunta de investigación y relevancia actual.', tag: 'Slide 1' },
      { id: '2', heading: 'Desarrollo y Argumentos', detail: 'Comparación de enfoques, variables clave y evidencia documental.', tag: 'Slide 2' },
      { id: '3', heading: 'Conclusiones y Debate', detail: 'Síntesis final, limitaciones observadas y preguntas disparadoras.', tag: 'Slide 3' },
    ],
  },
  {
    id: 'infografia',
    label: 'Infografías',
    subtitle: 'Bloques comparativos y métricas visuales para lectura rápida',
    defaultTitle: 'Infografía de Estudio Comparado',
    defaultSubtitle: 'Datos estructurados, pilares y relaciones fundamentales',
    defaultItems: [
      { id: '1', heading: 'Pilar A · Fundamentos', detail: 'Definición operativa y antecedentes históricos verificados.', tag: '35%' },
      { id: '2', heading: 'Pilar B · Mecanismos', detail: 'Procesos intervinientes y criterios de clasificación.', tag: '40%' },
      { id: '3', heading: 'Pilar C · Casos', detail: 'Ejemplos reales de aplicación y evaluación.', tag: '25%' },
    ],
  },
  {
    id: 'mapa_conceptual',
    label: 'Mapas Conceptuales',
    subtitle: 'Nodo raíz conectado a ramas jerárquicas y definiciones',
    defaultTitle: 'Concepto Central',
    defaultSubtitle: 'Red semántica de relaciones y subconceptos',
    defaultItems: [
      { id: '1', heading: 'Causa / Origen', detail: 'Condiciones iniciales que explican el fenómeno.', tag: 'origina' },
      { id: '2', heading: 'Componentes', detail: 'Elementos estructurales y categorías principales.', tag: 'integra' },
      { id: '3', heading: 'Consecuencias', detail: 'Efectos medibles en el contexto de estudio.', tag: 'produce' },
      { id: '4', heading: 'Excepciones', detail: 'Límites teóricos y casos especiales.', tag: 'delimita' },
    ],
  },
  {
    id: 'linea_tiempo',
    label: 'Líneas de Tiempo',
    subtitle: 'Secuencia cronológica de hitos históricos o etapas de un proceso',
    defaultTitle: 'Evolución Cronológica del Tema',
    defaultSubtitle: 'Hitos principales ordenados por período',
    defaultItems: [
      { id: '1', heading: 'Antecedentes iniciales', detail: 'Primeras formulaciones teóricas y contexto fundacional.', tag: 'Etapa 1' },
      { id: '2', heading: 'Consolidación', detail: 'Reformas clave, publicaciones centrales y expansión.', tag: 'Etapa 2' },
      { id: '3', heading: 'Debates contemporáneos', detail: 'Actualización metodológica y desafíos vigentes.', tag: 'Etapa 3' },
    ],
  },
  {
    id: 'diagrama',
    label: 'Diagramas de Flujo',
    subtitle: 'Secuencia lógica paso a paso con entradas, proceso y salida',
    defaultTitle: 'Diagrama de Proceso y Decisión',
    defaultSubtitle: 'Flujo operativo desde la entrada hasta la validación',
    defaultItems: [
      { id: '1', heading: 'Entrada de datos', detail: 'Recolección de fuentes y verificación de requisitos.', tag: 'Paso 1' },
      { id: '2', heading: 'Procesamiento', detail: 'Análisis comparativo, contraste y depuración.', tag: 'Paso 2' },
      { id: '3', heading: 'Validación', detail: 'Control de coherencia lógica y citas verificables.', tag: 'Paso 3' },
      { id: '4', heading: 'Resultado final', detail: 'Informe, síntesis o entregable académico.', tag: 'Salida' },
    ],
  },
];

const ACCENT_THEMES = [
  { id: 'sky', name: 'Azul FABRO', primary: '#0284C7', secondary: '#06B6D4', bg: '#0A1222' },
  { id: 'indigo', name: 'Índigo Editorial', primary: '#4F46E5', secondary: '#818CF8', bg: '#0E1229' },
  { id: 'emerald', name: 'Esmeralda Ciencia', primary: '#059669', secondary: '#34D399', bg: '#081C18' },
  { id: 'amber', name: 'Ámbar Humanidades', primary: '#D97706', secondary: '#FBBF24', bg: '#1D1409' },
  { id: 'rose', name: 'Carmesí Jurídico', primary: '#E11D48', secondary: '#FB7185', bg: '#1F0B14' },
];

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export const FabroDesignView: React.FC = () => {
  const { createNote, selectedSubjectId, subjects, profile } = useFabro();

  const [template, setTemplate] = useState<DesignTemplateId>('afiche');
  const [themeId, setThemeId] = useState<string>('sky');
  const [title, setTitle] = useState(TEMPLATE_META[0].defaultTitle);
  const [subtitle, setSubtitle] = useState(TEMPLATE_META[0].defaultSubtitle);
  const [author, setAuthor] = useState(profile?.displayName || 'Estudiante FABRO');
  const [items, setItems] = useState<DesignItem[]>(TEMPLATE_META[0].defaultItems);
  const [slideIdx, setSlideIdx] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const theme = ACCENT_THEMES.find((t) => t.id === themeId) || ACCENT_THEMES[0];
  const currentMeta = TEMPLATE_META.find((t) => t.id === template) || TEMPLATE_META[0];

  const switchTemplate = (nextId: DesignTemplateId) => {
    const meta = TEMPLATE_META.find((t) => t.id === nextId) || TEMPLATE_META[0];
    setTemplate(nextId);
    setTitle(meta.defaultTitle);
    setSubtitle(meta.defaultSubtitle);
    setItems(meta.defaultItems.map((i) => ({ ...i })));
    setSlideIdx(0);
    setNotice(null);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1280;
    const H = template === 'portada' || template === 'afiche' ? 900 : 760;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, theme.bg);
    grad.addColorStop(1, '#090D16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle geometric accent bar
    ctx.fillStyle = theme.primary;
    ctx.fillRect(0, 0, 16, H);
    ctx.fillStyle = theme.secondary;
    ctx.fillRect(56, 48, 96, 5);

    // Header badge text
    ctx.fillStyle = theme.secondary;
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`FABRO DESIGN · ${currentMeta.label.toUpperCase()}`, 56, 82);

    if (template === 'presentacion') {
      const safeSlide = Math.min(Math.max(0, slideIdx), Math.max(0, items.length - 1));
      const slide = items[safeSlide] || { heading: title, detail: subtitle, tag: 'Slide' };

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`${slide.tag || `Slide ${safeSlide + 1}`} · ${safeSlide + 1}/${Math.max(1, items.length)}`, W - 260, 82);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
      const titleLines = wrapText(ctx, title, W - 140, 2);
      titleLines.forEach((l, i) => ctx.fillText(l, 56, 154 + i * 56));

      ctx.fillStyle = '#94A3B8';
      ctx.font = '22px system-ui, -apple-system, sans-serif';
      ctx.fillText(subtitle, 56, 276);

      // Active Slide Card
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(56, 320, W - 112, 330, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.secondary;
      ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
      ctx.fillText(slide.heading || 'Bloque temático', 92, 390);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '26px system-ui, -apple-system, sans-serif';
      const detailLines = wrapText(ctx, slide.detail, W - 184, 5);
      detailLines.forEach((l, i) => ctx.fillText(l, 92, 446 + i * 38));
    } else if (template === 'portada') {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
      const titleLines = wrapText(ctx, title, W - 140, 4);
      titleLines.forEach((l, i) => ctx.fillText(l, 72, 230 + i * 64));

      ctx.fillStyle = theme.secondary;
      ctx.font = '26px system-ui, -apple-system, sans-serif';
      const subLines = wrapText(ctx, subtitle, W - 140, 3);
      subLines.forEach((l, i) => ctx.fillText(l, 72, 500 + i * 36));

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(72, 620, W - 144, 190, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Autor/a: ${author || 'Estudiante FABRO'}`, 104, 672);

      items.slice(0, 3).forEach((it, idx) => {
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '20px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${it.heading}: ${it.detail}`, 104, 714 + idx * 30);
      });
    } else if (template === 'mapa_conceptual') {
      // Central root node
      const cx = W / 2;
      const cy = 220;
      ctx.fillStyle = theme.primary;
      ctx.beginPath();
      ctx.roundRect(cx - 210, cy - 52, 420, 104, 20);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.fillText(title.slice(0, 36), cx, cy + 8);
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#E0F2FE';
      ctx.fillText(subtitle.slice(0, 62), cx, cy + 36);

      const branchList = items.slice(0, 4);
      const count = Math.max(1, branchList.length);
      const cardW = Math.min(280, (W - 140) / count - 20);
      const startX = (W - (cardW * count + 20 * (count - 1))) / 2;

      branchList.forEach((it, idx) => {
        const bx = startX + idx * (cardW + 20);
        const by = 430;
        const bMidX = bx + cardW / 2;

        // Connector line
        ctx.strokeStyle = theme.secondary;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 52);
        ctx.lineTo(bMidX, by);
        ctx.stroke();

        // Connector label
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(bMidX - 54, 345, 108, 28, 8);
        ctx.fill();
        ctx.fillStyle = theme.secondary;
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((it.tag || 'relaciona').slice(0, 14), bMidX, 364);

        // Child card
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, cardW, 210, 16);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        const hLines = wrapText(ctx, it.heading, cardW - 28, 2);
        hLines.forEach((l, li) => ctx.fillText(l, bx + 14, by + 40 + li * 26));

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '16px system-ui, -apple-system, sans-serif';
        const dLines = wrapText(ctx, it.detail, cardW - 28, 4);
        dLines.forEach((l, li) => ctx.fillText(l, bx + 14, by + 104 + li * 23));
      });
      ctx.textAlign = 'left';
    } else if (template === 'linea_tiempo' || template === 'diagrama') {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
      ctx.fillText(title.slice(0, 56), 56, 142);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '20px system-ui, -apple-system, sans-serif';
      ctx.fillText(subtitle.slice(0, 90), 56, 180);

      const list = items.slice(0, 4);
      const n = Math.max(1, list.length);
      const cardW = (W - 112 - (n - 1) * 28) / n;
      const lineY = 300;

      ctx.strokeStyle = theme.secondary;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(80, lineY);
      ctx.lineTo(W - 80, lineY);
      ctx.stroke();

      list.forEach((it, idx) => {
        const x = 56 + idx * (cardW + 28);
        const midX = x + cardW / 2;

        ctx.fillStyle = theme.primary;
        ctx.beginPath();
        ctx.arc(midX, lineY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = theme.secondary;
        ctx.textAlign = 'center';
        ctx.font = 'bold 15px monospace';
        ctx.fillText((it.tag || `${idx + 1}`).slice(0, 14), midX, lineY - 32);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, 350, cardW, 280, 16);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
        const hLines = wrapText(ctx, it.heading, cardW - 28, 2);
        hLines.forEach((l, li) => ctx.fillText(l, x + 16, 392 + li * 26));

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '17px system-ui, -apple-system, sans-serif';
        const dLines = wrapText(ctx, it.detail, cardW - 28, 5);
        dLines.forEach((l, li) => ctx.fillText(l, x + 16, 464 + li * 24));
      });
      ctx.textAlign = 'left';
    } else {
      // Afiche / Infografía grid
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
      const titleLines = wrapText(ctx, title, W - 120, 2);
      titleLines.forEach((l, i) => ctx.fillText(l, 56, 144 + i * 52));

      ctx.fillStyle = '#94A3B8';
      ctx.font = '22px system-ui, -apple-system, sans-serif';
      ctx.fillText(subtitle.slice(0, 96), 56, 256);

      const list = items.slice(0, 4);
      const cols = list.length <= 2 ? list.length : 2;
      const rows = Math.ceil(list.length / cols);
      const cardW = (W - 112 - (cols - 1) * 24) / Math.max(1, cols);
      const availH = H - 370;
      const cardH = Math.min(240, (availH - (rows - 1) * 20) / Math.max(1, rows));

      list.forEach((it, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = 56 + col * (cardW + 24);
        const y = 300 + row * (cardH + 20);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.secondary;
        ctx.font = 'bold 20px monospace';
        ctx.fillText(it.tag || `0${idx + 1}`, x + 22, y + 38);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
        ctx.fillText(it.heading.slice(0, 38), x + 22, y + 76);

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '18px system-ui, -apple-system, sans-serif';
        const dLines = wrapText(ctx, it.detail, cardW - 44, 4);
        dLines.forEach((l, li) => ctx.fillText(l, x + 22, y + 114 + li * 26));
      });
    }

    // Footer signature
    ctx.fillStyle = '#64748B';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Autor: ${author || 'Estudiante FABRO'} · Generado en FABRO DESIGN`, 56, H - 32);
  }, [author, currentMeta.label, items, slideIdx, subtitle, template, theme.bg, theme.primary, theme.secondary, title]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabro_${template}_${Date.now()}.png`;
    a.click();
    setNotice('Diseño exportado en formato PNG.');
  };

  const handleExportPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const landscape = canvas.width >= canvas.height;
    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    if (template === 'presentacion' && items.length > 1) {
      const original = slideIdx;
      items.forEach((_, idx) => {
        if (idx > 0) pdf.addPage();
        // Draw each slide synchronously onto offscreen render by reading after state-independent draw
        const margin = 24;
        const maxW = pw - margin * 2;
        const ratio = Math.min(maxW / canvas.width, (ph - margin * 2) / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Diapositiva ${idx + 1} · FABRO DESIGN`, margin, ph - 12);
      });
      setSlideIdx(original);
    } else {
      const margin = 20;
      const maxW = pw - margin * 2;
      const ratio = Math.min(maxW / canvas.width, (ph - margin * 2) / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
    }

    pdf.save(`fabro_${template}_${Date.now()}.pdf`);
    setNotice('Diseño exportado en PDF.');
  };

  const buildStructuredMarkdown = () => {
    const lines = [
      `# ${title}`,
      subtitle ? `> ${subtitle}` : '',
      `**Tipo de recurso:** ${currentMeta.label}`,
      `**Autor:** ${author || 'Estudiante FABRO'}`,
      '',
      ...items.map((it, idx) => `### ${idx + 1}. ${it.heading} (${it.tag})\n${it.detail}`),
    ];
    return lines.filter(Boolean).join('\n\n');
  };

  const handleSaveToNotes = async () => {
    const md = buildStructuredMarkdown();
    await createNote({
      subjectId: selectedSubjectId || subjects[0]?.id || '',
      unit: '',
      folder: 'FABRO DESIGN',
      title: `${currentMeta.label}: ${title}`.slice(0, 180),
      contentHtml: markdownToHtml(md),
      contentText: md,
      tags: ['fabro-design', template],
      attachments: [],
      offlineAvailable: true,
    });
    setNotice('Estructura visual guardada en Apuntes.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              FABRO DESIGN · ESTUDIO VISUAL ACADÉMICO
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Afiches, Portadas, Presentaciones, Infografías y Mapas
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl">
              Editá en tiempo real tu diseño gráfico académico sobre lienzo vectorizado de alta resolución y exportalo directo a PNG, PDF o Apuntes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportPng}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-sky-500/50 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-sky-500" />
              Exportar PNG
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => void handleSaveToNotes()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Guardar en Apuntes
            </button>
          </div>
        </div>

        {/* Template Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
          {TEMPLATE_META.map((t) => {
            const active = template === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTemplate(t.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {t.id === 'presentacion' ? (
                    <Presentation className="w-3.5 h-3.5 shrink-0" />
                  ) : t.id === 'mapa_conceptual' || t.id === 'diagrama' ? (
                    <GitBranch className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Layout className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{t.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Workspace Split: Editor + Live Canvas Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Controls */}
        <section className="xl:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título principal
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subtítulo / Bajada
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Autor / Estudiante
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <Palette className="w-3.5 h-3.5 text-sky-500" />
                  Paleta editorial
                </label>
                <select
                  value={themeId}
                  onChange={(e) => setThemeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                >
                  {ACCENT_THEMES.map((th) => (
                    <option key={th.id} value={th.id}>
                      {th.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Bloques / Nodos ({items.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      id: String(Date.now()),
                      heading: `Bloque ${prev.length + 1}`,
                      detail: 'Desarrollo de concepto o dato clave.',
                      tag: `${prev.length + 1}`,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar bloque
              </button>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className={`rounded-xl border p-3 space-y-2 text-xs ${
                    template === 'presentacion' && idx === slideIdx
                      ? 'border-sky-500 bg-sky-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={it.tag}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row) => (row.id === it.id ? { ...row, tag: e.target.value } : row))
                        )
                      }
                      placeholder="Etiqueta / Conector"
                      className="w-24 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-900 dark:text-white"
                    />
                    <div className="flex items-center gap-1.5">
                      {template === 'presentacion' && (
                        <button
                          type="button"
                          onClick={() => setSlideIdx(idx)}
                          className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
                        >
                          Ver slide
                        </button>
                      )}
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setItems((prev) => prev.filter((row) => row.id !== it.id));
                            setSlideIdx(0);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          aria-label="Eliminar bloque"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={it.heading}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row) => (row.id === it.id ? { ...row, heading: e.target.value } : row))
                      )
                    }
                    placeholder="Encabezado"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-semibold text-slate-900 dark:text-white"
                  />
                  <textarea
                    rows={2}
                    value={it.detail}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row) => (row.id === it.id ? { ...row, detail: e.target.value } : row))
                      )
                    }
                    placeholder="Contenido"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Canvas */}
        <section className="xl:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Vista previa de exportación · {currentMeta.subtitle}
            </p>
            {template === 'presentacion' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                  disabled={slideIdx <= 0}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  {slideIdx + 1} / {items.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSlideIdx((i) => Math.min(items.length - 1, i + 1))}
                  disabled={slideIdx >= items.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#090D16]">
            <canvas ref={canvasRef} className="w-full h-auto block" />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportPng}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar imagen en alta resolución (PNG)
            </button>
            <span className="text-[11px] font-mono text-slate-500">1280px</span>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Potenciar diseño con FABRO IA
            </p>
            <FabroAIActionStrip
              title={`${currentMeta.label}: ${title}`}
              content={buildStructuredMarkdown()}
              onSavedNote={(msg) => setNotice(msg)}
            />
          </div>
        </section>
      </div>
    </div>
  );
};
