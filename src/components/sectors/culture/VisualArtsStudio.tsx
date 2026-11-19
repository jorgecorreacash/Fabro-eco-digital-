import React, { useEffect, useRef, useState } from 'react';
import {
  Brush,
  Copy,
  Download,
  Eraser,
  FolderOpen,
  Image as ImageIcon,
  Layout,
  Palette,
  Plus,
  RotateCw,
  Save,
  Send,
  Sliders,
  Trash2,
  Trophy,
  Undo2,
} from 'lucide-react';
import type {
  CulturalExhibitionItem,
  CultureDisciplineId,
  CultureGalleryArtwork,
} from '../../../types/culture';

interface VisualArtsStudioProps {
  mode: 'visual-arts' | 'photography';
  disciplineId: CultureDisciplineId;
  gallery: CultureGalleryArtwork[];
  exhibitions: CulturalExhibitionItem[];
  onSaveArtwork: (art: CultureGalleryArtwork) => void;
  onDeleteArtwork: (id: string) => void;
  onSaveExhibition: (exh: CulturalExhibitionItem) => void;
  onPublishToWall: (title: string, imageDataUrl: string, disciplineId: CultureDisciplineId) => void;
}

type ToolTab = 'dibujo' | 'paletas' | 'fotos' | 'carteles' | 'galeria' | 'exposiciones' | 'concursos';
type DrawTool = 'brush' | 'eraser' | 'line' | 'rect' | 'circle' | 'text';

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function generateHarmony(mode: 'complementaria' | 'analoga' | 'triada' | 'monocromatica'): string[] {
  const baseH = Math.floor(Math.random() * 360);
  if (mode === 'complementaria') {
    return [
      hslToHex(baseH, 68, 28),
      hslToHex(baseH, 62, 48),
      hslToHex(baseH, 35, 86),
      hslToHex((baseH + 180) % 360, 68, 46),
      hslToHex((baseH + 180) % 360, 55, 25),
    ];
  }
  if (mode === 'analoga') {
    return [-32, -16, 0, 16, 32].map((d, i) =>
      hslToHex((baseH + d + 360) % 360, 58, 30 + i * 11)
    );
  }
  if (mode === 'triada') {
    return [
      hslToHex(baseH, 66, 36),
      hslToHex((baseH + 120) % 360, 62, 44),
      hslToHex((baseH + 240) % 360, 62, 42),
      hslToHex(baseH, 28, 88),
      hslToHex((baseH + 120) % 360, 22, 20),
    ];
  }
  return [18, 32, 48, 68, 88].map((l) => hslToHex(baseH, 48, l));
}

export const VisualArtsStudio: React.FC<VisualArtsStudioProps> = ({
  mode,
  disciplineId,
  gallery,
  exhibitions,
  onSaveArtwork,
  onDeleteArtwork,
  onSaveExhibition,
  onPublishToWall,
}) => {
  const [activeTab, setActiveTab] = useState<ToolTab>(mode === 'photography' ? 'fotos' : 'dibujo');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // 1. Canvas Drawing & Graphic Editor
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>('brush');
  const [strokeColor, setStrokeColor] = useState('#1E3A8A');
  const [bgColor, setBgColor] = useState('#FBF9F5');
  const [brushSize, setBrushSize] = useState(5);
  const [textStamp, setTextStamp] = useState('FABRO Cultura');
  const [artworkTitle, setArtworkTitle] = useState('Estudio de composición');
  const [artworkAlbum, setArtworkAlbum] = useState('Cuaderno General');
  const drawingRef = useRef<{ active: boolean; startX: number; startY: number; snapshot?: ImageData }>({
    active: false,
    startX: 0,
    startY: 0,
  });
  const undoStackRef = useRef<string[]>([]);

  useEffect(() => {
    if (activeTab !== 'dibujo') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (undoStackRef.current.length === 0) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      undoStackRef.current = [canvas.toDataURL('image/png')];
    }
  }, [activeTab, bgColor]);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasPos(e);

    if (drawTool === 'text') {
      ctx.fillStyle = strokeColor;
      ctx.font = `600 ${Math.max(18, brushSize * 4)}px Georgia, serif`;
      ctx.fillText(textStamp || 'FABRO', x, y);
      undoStackRef.current = [...undoStackRef.current.slice(-15), canvas.toDataURL('image/png')];
      return;
    }

    drawingRef.current = {
      active: true,
      startX: x,
      startY: y,
      snapshot: ctx.getImageData(0, 0, canvas.width, canvas.height),
    };

    if (drawTool === 'brush' || drawTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = drawTool === 'eraser' ? bgColor : strokeColor;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCanvasPos(e);

    if (drawTool === 'brush' || drawTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }

    if (drawingRef.current.snapshot) {
      ctx.putImageData(drawingRef.current.snapshot, 0, 0);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    const { startX, startY } = drawingRef.current;

    ctx.beginPath();
    if (drawTool === 'line') {
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (drawTool === 'rect') {
      ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (drawTool === 'circle') {
      const r = Math.hypot(x - startX, y - startY);
      ctx.arc(startX, startY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!drawingRef.current.active) return;
    drawingRef.current.active = false;
    const canvas = canvasRef.current;
    if (canvas) {
      undoStackRef.current = [...undoStackRef.current.slice(-15), canvas.toDataURL('image/png')];
    }
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || undoStackRef.current.length <= 1) return;
    undoStackRef.current.pop();
    const prevUrl = undoStackRef.current[undoStackRef.current.length - 1];
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = prevUrl;
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [canvas.toDataURL('image/png')];
  };

  const saveCanvasToGallery = (publishAlso = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const title = artworkTitle.trim() || 'Obra sin título';
    onSaveArtwork({
      id: `art-${Date.now()}`,
      title,
      disciplineId,
      medium: 'Lienzo digital HTML5',
      album: artworkAlbum.trim() || 'Cuaderno General',
      year: String(new Date().getFullYear()),
      notes: 'Creada en el estudio gráfico de FABRO Cultura.',
      imageDataUrl: dataUrl,
      createdAt: 'Hoy',
    });
    if (publishAlso) {
      onPublishToWall(title, dataUrl, disciplineId);
      setStatusMsg('Obra guardada en tu galería local y publicada en el Muro Cultural.');
    } else {
      setStatusMsg('Obra guardada en tu galería local.');
    }
  };

  // 2. Color Palette Generator
  const [harmonyMode, setHarmonyMode] = useState<
    'complementaria' | 'analoga' | 'triada' | 'monocromatica'
  >('complementaria');
  const [palette, setPalette] = useState<string[]>([
    '#1E3A8A',
    '#9A3412',
    '#FBF9F5',
    '#78350F',
    '#14532D',
  ]);
  const [lockedSwatches, setLockedSwatches] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

  const regeneratePalette = () => {
    const fresh = generateHarmony(harmonyMode);
    setPalette((prev) => prev.map((c, idx) => (lockedSwatches[idx] ? c : fresh[idx])));
  };

  // 3. Photo Editor
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoTitle, setPhotoTitle] = useState('Fotografía revelada');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [sepia, setSepia] = useState(0);
  const [grayscale, setGrayscale] = useState(0);
  const [rotation, setRotation] = useState(0);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoSrc(reader.result);
        setPhotoTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const renderEditedPhotoDataUrl = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!photoSrc) return resolve(null);
      const img = new Image();
      img.onload = () => {
        const maxSide = 1100;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const swapped = rotation % 180 !== 0;
        const c = document.createElement('canvas');
        c.width = swapped ? h : w;
        c.height = swapped ? w : h;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) grayscale(${grayscale}%)`;
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      img.src = photoSrc;
    });
  };

  // 4. Poster Creator
  const posterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [posterTitle, setPosterTitle] = useState('Muestra de Otoño');
  const [posterSubtitle, setPosterSubtitle] = useState('Ciclo de Artes Visuales y Memoria');
  const [posterDate, setPosterDate] = useState('Sábado 24 · 18:00 hs · Entrada Libre');
  const [posterTheme, setPosterTheme] = useState<'museo' | 'lapis' | 'terracota' | 'grafito'>('museo');

  useEffect(() => {
    if (activeTab !== 'carteles') return;
    const canvas = posterCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const palettes = {
      museo: { bg: '#F7F4EE', fg: '#1C1917', accent: '#9A3412', border: '#D6CEBE' },
      lapis: { bg: '#0F172A', fg: '#F8FAFC', accent: '#60A5FA', border: '#334155' },
      terracota: { bg: '#431407', fg: '#FFF7ED', accent: '#FDBA74', border: '#9A3412' },
      grafito: { bg: '#18181B', fg: '#FAFAFA', accent: '#E5B842', border: '#3F3F46' },
    }[posterTheme];

    ctx.fillStyle = palettes.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = palettes.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

    // Geometric curatorial composition
    ctx.fillStyle = palettes.accent;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.72, canvas.height * 0.34, 92, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palettes.fg;
    ctx.globalAlpha = 0.14;
    ctx.fillRect(58, 120, 220, 220);
    ctx.globalAlpha = 1;

    ctx.fillStyle = palettes.accent;
    ctx.font = '700 14px sans-serif';
    ctx.fillText('FABRO CULTURA · CONVOCATORIA ABIERTA', 58, 86);

    ctx.fillStyle = palettes.fg;
    ctx.font = '700 44px Georgia, serif';
    const words = posterTitle.split(' ');
    let line = '';
    let y = 430;
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > canvas.width - 116) {
        ctx.fillText(line, 58, y);
        line = word;
        y += 52;
      } else {
        line = test;
      }
    });
    if (line) ctx.fillText(line, 58, y);

    ctx.fillStyle = palettes.fg;
    ctx.globalAlpha = 0.85;
    ctx.font = '400 20px sans-serif';
    ctx.fillText(posterSubtitle.slice(0, 52), 58, y + 48);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = palettes.border;
    ctx.beginPath();
    ctx.moveTo(58, canvas.height - 110);
    ctx.lineTo(canvas.width - 58, canvas.height - 110);
    ctx.stroke();

    ctx.fillStyle = palettes.accent;
    ctx.font = '600 16px monospace';
    ctx.fillText(posterDate.slice(0, 58), 58, canvas.height - 72);
  }, [activeTab, posterDate, posterSubtitle, posterTheme, posterTitle]);

  // 5. Gallery & Exhibitions
  const [albumFilter, setAlbumFilter] = useState('Todos');
  const [newExhTitle, setNewExhTitle] = useState('');
  const [newExhNote, setNewExhNote] = useState('');
  const [selectedExhId, setSelectedExhId] = useState<string>(exhibitions[0]?.id || '');

  const albums = Array.from(new Set(['Todos', ...gallery.map((g) => g.album || 'General')]));
  const filteredGallery = gallery.filter(
    (g) => albumFilter === 'Todos' || (g.album || 'General') === albumFilter
  );

  const tabs: Array<{ id: ToolTab; label: string; icon: React.FC<{ className?: string }> }> =
    mode === 'photography'
      ? [
          { id: 'fotos', label: 'Editor básico', icon: Sliders },
          { id: 'galeria', label: 'Galería y álbumes', icon: FolderOpen },
          { id: 'exposiciones', label: 'Exposiciones', icon: Layout },
          { id: 'concursos', label: 'Concursos', icon: Trophy },
          { id: 'paletas', label: 'Paletas', icon: Palette },
        ]
      : [
          { id: 'dibujo', label: 'Dibujo y editor gráfico', icon: Brush },
          { id: 'paletas', label: 'Paletas de color', icon: Palette },
          { id: 'fotos', label: 'Editor de fotos', icon: Sliders },
          { id: 'carteles', label: 'Creador de carteles', icon: Layout },
          { id: 'galeria', label: 'Galería personal', icon: FolderOpen },
          { id: 'exposiciones', label: 'Exposiciones virtuales', icon: ImageIcon },
        ];

  return (
    <div className="space-y-5">
      {/* Tool Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border fabro-border fabro-surface">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setStatusMsg(null);
              }}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#9A3412] text-white'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}

      {/* 1. DRAWING & GRAPHIC EDITOR */}
      {activeTab === 'dibujo' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'brush', label: 'Pincel' },
                  { id: 'line', label: 'Línea' },
                  { id: 'rect', label: 'Rectángulo' },
                  { id: 'circle', label: 'Círculo' },
                  { id: 'text', label: 'Texto' },
                  { id: 'eraser', label: 'Borrador' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDrawTool(t.id)}
                  className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold cursor-pointer ${
                    drawTool === t.id
                      ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <span className="fabro-muted">Trazo</span>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border fabro-border"
                />
              </label>
              <label className="inline-flex items-center gap-1.5">
                <span className="fabro-muted">Fondo</span>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border fabro-border"
                />
              </label>
              <label className="inline-flex items-center gap-1.5">
                <span className="fabro-muted">Grosor ({brushSize}px)</span>
                <input
                  type="range"
                  min={1}
                  max={32}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-24"
                />
              </label>
              <button
                type="button"
                onClick={handleUndo}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border fabro-border px-2.5 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Deshacer</span>
              </button>
              <button
                type="button"
                onClick={handleClearCanvas}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border fabro-border px-2.5 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            </div>
          </div>

          {drawTool === 'text' && (
            <input
              type="text"
              value={textStamp}
              onChange={(e) => setTextStamp(e.target.value)}
              placeholder="Texto a estampar al tocar el lienzo..."
              className="w-full sm:w-80 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
            />
          )}

          <div className="rounded-xl overflow-hidden border fabro-border bg-white">
            <canvas
              ref={canvasRef}
              width={900}
              height={500}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-auto touch-none cursor-crosshair block"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t fabro-border">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <input
                type="text"
                value={artworkTitle}
                onChange={(e) => setArtworkTitle(e.target.value)}
                placeholder="Título de la obra"
                className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
              />
              <input
                type="text"
                value={artworkAlbum}
                onChange={(e) => setArtworkAlbum(e.target.value)}
                placeholder="Álbum"
                className="w-40 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = canvasRef.current?.toDataURL('image/png') || '';
                  a.download = `${artworkTitle.replace(/\s+/g, '_').toLowerCase() || 'obra'}.png`;
                  a.click();
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PNG</span>
              </button>
              <button
                type="button"
                onClick={() => saveCanvasToGallery(false)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#1E3A8A]/50 bg-[#1E3A8A]/10 text-[#1E3A8A] dark:text-[#93C5FD] px-3 text-xs font-semibold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar en Galería</span>
              </button>
              <button
                type="button"
                onClick={() => saveCanvasToGallery(true)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#9A3412] text-white px-3.5 text-xs font-bold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publicar en Muro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. COLOR PALETTE GENERATOR */}
      {activeTab === 'paletas' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['complementaria', 'analoga', 'triada', 'monocromatica'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHarmonyMode(m)}
                  className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold capitalize cursor-pointer ${
                    harmonyMode === m
                      ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={regeneratePalette}
                className="min-h-[40px] rounded-xl bg-[#9A3412] text-white px-4 text-xs font-bold cursor-pointer"
              >
                Generar armonía
              </button>
              <button
                type="button"
                onClick={() => {
                  const css = palette.map((c, i) => `--cultura-color-${i + 1}: ${c};`).join('\n');
                  void navigator.clipboard?.writeText(css);
                  setStatusMsg('Variables CSS copiadas al portapapeles.');
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border px-3 text-xs font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar CSS</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {palette.map((hex, i) => (
              <div
                key={i}
                className="rounded-xl border fabro-border overflow-hidden fabro-surface-elevated"
              >
                <div className="h-32 w-full" style={{ backgroundColor: hex }} />
                <div className="p-3 space-y-2 text-xs">
                  <p className="font-mono font-bold">{hex}</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(hex);
                        setStrokeColor(hex);
                        setStatusMsg(`Color ${hex} copiado y aplicado al pincel.`);
                      }}
                      className="flex-1 py-1.5 rounded-lg border fabro-border font-medium cursor-pointer"
                    >
                      Usar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLockedSwatches((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
                      }
                      className={`px-2 py-1.5 rounded-lg border font-medium cursor-pointer ${
                        lockedSwatches[i]
                          ? 'border-[#1E3A8A] bg-[#1E3A8A]/12 text-[#1E3A8A] dark:text-[#93C5FD]'
                          : 'fabro-border fabro-muted'
                      }`}
                    >
                      {lockedSwatches[i] ? 'Fijo' : 'Libre'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PHOTO EDITOR */}
      {activeTab === 'fotos' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Editor Fotográfico Local (Canvas HTML5)</h3>
              <p className="text-xs fabro-muted">
                Procesamiento 100% en tu dispositivo sin subir archivos a servidores pagos.
              </p>
            </div>
            <label className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#9A3412] text-white px-4 text-xs font-bold cursor-pointer">
              <ImageIcon className="w-4 h-4" />
              <span>Cargar fotografía</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 rounded-xl border fabro-border fabro-surface-elevated min-h-[280px] flex items-center justify-center overflow-hidden p-4">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt={photoTitle}
                  referrerPolicy="no-referrer"
                  className="max-h-[420px] w-auto object-contain transition-transform"
                  style={{
                    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) grayscale(${grayscale}%)`,
                    transform: `rotate(${rotation}deg)`,
                  }}
                />
              ) : (
                <p className="text-xs fabro-muted text-center max-w-xs">
                  Elegí una foto de tu galería para ajustar exposición, contraste, saturación, blanco y negro o rotación.
                </p>
              )}
            </div>

            <div className="lg:col-span-5 space-y-3 text-xs">
              <input
                type="text"
                value={photoTitle}
                onChange={(e) => setPhotoTitle(e.target.value)}
                placeholder="Título de la fotografía"
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              {[
                { label: 'Brillo', val: brightness, set: setBrightness, min: 40, max: 180 },
                { label: 'Contraste', val: contrast, set: setContrast, min: 40, max: 180 },
                { label: 'Saturación', val: saturate, set: setSaturate, min: 0, max: 200 },
                { label: 'Sepia', val: sepia, set: setSepia, min: 0, max: 100 },
                { label: 'Blanco y negro', val: grayscale, set: setGrayscale, min: 0, max: 100 },
              ].map((ctrl) => (
                <label key={ctrl.label} className="block space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{ctrl.label}</span>
                    <span className="font-mono tabular-nums fabro-muted">{ctrl.val}%</span>
                  </div>
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    value={ctrl.val}
                    onChange={(e) => ctrl.set(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              ))}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border px-3 font-semibold cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotar 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrightness(100);
                    setContrast(100);
                    setSaturate(100);
                    setSepia(0);
                    setGrayscale(0);
                    setRotation(0);
                  }}
                  className="min-h-[38px] rounded-xl border fabro-border px-3 font-medium cursor-pointer"
                >
                  Restablecer
                </button>
              </div>

              {photoSrc && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t fabro-border">
                  <button
                    type="button"
                    onClick={async () => {
                      const out = await renderEditedPhotoDataUrl();
                      if (!out) return;
                      const a = document.createElement('a');
                      a.href = out;
                      a.download = `${photoTitle.replace(/\s+/g, '_').toLowerCase()}.jpg`;
                      a.click();
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border px-3 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const out = await renderEditedPhotoDataUrl();
                      if (!out) return;
                      onSaveArtwork({
                        id: `photo-${Date.now()}`,
                        title: photoTitle.trim() || 'Fotografía',
                        disciplineId,
                        medium: 'Fotografía digital revelada',
                        album: 'Fotografía',
                        year: String(new Date().getFullYear()),
                        notes: `Brillo ${brightness}% · Contraste ${contrast}% · Saturación ${saturate}%`,
                        imageDataUrl: out,
                        createdAt: 'Hoy',
                      });
                      setStatusMsg('Fotografía guardada en tu álbum local.');
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] text-white px-3.5 font-bold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar en Álbum</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. POSTER CREATOR */}
      {activeTab === 'carteles' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-3 text-xs">
            <h3 className="text-sm font-bold">Creador de Carteles Culturales</h3>
            <label className="block space-y-1">
              <span className="font-semibold fabro-muted">Título principal</span>
              <input
                type="text"
                value={posterTitle}
                onChange={(e) => setPosterTitle(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold fabro-muted">Subtítulo</span>
              <input
                type="text"
                value={posterSubtitle}
                onChange={(e) => setPosterSubtitle(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold fabro-muted">Fecha, horario y sede</span>
              <input
                type="text"
                value={posterDate}
                onChange={(e) => setPosterDate(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <div className="space-y-1">
              <span className="font-semibold fabro-muted">Estilo editorial</span>
              <div className="grid grid-cols-2 gap-2">
                {(['museo', 'lapis', 'terracota', 'grafito'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPosterTheme(t)}
                    className={`min-h-[38px] rounded-xl border capitalize font-semibold cursor-pointer ${
                      posterTheme === t
                        ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const url = posterCanvasRef.current?.toDataURL('image/png');
                  if (!url) return;
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `cartel_${posterTitle.replace(/\s+/g, '_').toLowerCase()}.png`;
                  a.click();
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border px-3.5 font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PNG</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = posterCanvasRef.current?.toDataURL('image/jpeg', 0.9);
                  if (!url) return;
                  onSaveArtwork({
                    id: `poster-${Date.now()}`,
                    title: posterTitle,
                    disciplineId,
                    medium: 'Cartel editorial',
                    album: 'Carteles',
                    year: String(new Date().getFullYear()),
                    notes: `${posterSubtitle} · ${posterDate}`,
                    imageDataUrl: url,
                    createdAt: 'Hoy',
                  });
                  setStatusMsg('Cartel guardado en tu galería personal.');
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#9A3412] text-white px-3.5 font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar cartel</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 flex justify-center">
            <canvas
              ref={posterCanvasRef}
              width={540}
              height={720}
              className="w-full max-w-[380px] rounded-xl border fabro-border shadow-md"
            />
          </div>
        </div>
      )}

      {/* 5. PERSONAL GALLERY & ALBUMS */}
      {activeTab === 'galeria' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Galería Personal y Álbumes (Almacenamiento local)</h3>
              <p className="text-xs fabro-muted">
                Tus obras y fotografías se guardan en IndexedDB del dispositivo y podés descargarlas o compartirlas en el Muro Cultural.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {albums.map((alb) => (
                <button
                  key={alb}
                  type="button"
                  onClick={() => setAlbumFilter(alb)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    albumFilter === alb
                      ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  {alb}
                </button>
              ))}
            </div>
          </div>

          {filteredGallery.length === 0 ? (
            <p className="text-xs fabro-muted py-8 text-center">
              Todavía no guardaste piezas en esta colección. Creá un dibujo, editá una foto o diseñá un cartel para sumarlo aquí.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGallery.map((art) => (
                <div
                  key={art.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated overflow-hidden flex flex-col"
                >
                  <img
                    src={art.imageDataUrl}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover bg-black/5"
                  />
                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-bold truncate">{art.title}</p>
                      <p className="text-xs fabro-muted">
                        {art.medium} · {art.album} · {art.year}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t fabro-border text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onPublishToWall(art.title, art.imageDataUrl, art.disciplineId);
                          setStatusMsg(`"${art.title}" publicada en el Muro Cultural.`);
                        }}
                        className="font-semibold text-[#9A3412] dark:text-[#FDBA74] hover:underline cursor-pointer"
                      >
                        Publicar en Muro
                      </button>
                      <div className="flex items-center gap-2">
                        <a
                          href={art.imageDataUrl}
                          download={`${art.title.replace(/\s+/g, '_')}.jpg`}
                          className="fabro-muted hover:text-[var(--fabro-text)]"
                          title="Descargar"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => onDeleteArtwork(art.id)}
                          className="fabro-muted hover:text-rose-600 cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. VIRTUAL EXHIBITIONS */}
      {activeTab === 'exposiciones' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-sm font-bold">Crear sala de exposición virtual</h3>
              <input
                type="text"
                value={newExhTitle}
                onChange={(e) => setNewExhTitle(e.target.value)}
                placeholder="Nombre de la exposición"
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
              />
              <textarea
                value={newExhNote}
                onChange={(e) => setNewExhNote(e.target.value)}
                rows={3}
                placeholder="Texto curatorial o concepto de la muestra..."
                className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newExhTitle.trim()) return;
                  const created: CulturalExhibitionItem = {
                    id: `exh-${Date.now()}`,
                    title: newExhTitle.trim(),
                    venue: 'Museo Virtual FABRO Cultura',
                    date: new Date().toLocaleDateString('es-AR'),
                    curatorialNote:
                      newExhNote.trim() || 'Selección curatorial creada desde el estudio personal.',
                    workIds: gallery.slice(0, 6).map((g) => g.id),
                  };
                  onSaveExhibition(created);
                  setSelectedExhId(created.id);
                  setNewExhTitle('');
                  setNewExhNote('');
                  setStatusMsg('Exposición virtual creada.');
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] text-white px-4 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Inaugurar sala virtual</span>
              </button>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap gap-2">
                {exhibitions.map((exh) => (
                  <button
                    key={exh.id}
                    type="button"
                    onClick={() => setSelectedExhId(exh.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                      selectedExhId === exh.id
                        ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    {exh.title}
                  </button>
                ))}
              </div>
              {(() => {
                const current = exhibitions.find((e) => e.id === selectedExhId) || exhibitions[0];
                if (!current) return null;
                const works = gallery.filter(
                  (g) => current.workIds.length === 0 || current.workIds.includes(g.id)
                );
                return (
                  <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider fabro-muted">
                        {current.venue} · {current.date}
                      </p>
                      <h4 className="font-display text-lg font-bold mt-0.5">{current.title}</h4>
                      <p className="text-xs fabro-muted mt-1 leading-relaxed">
                        {current.curatorialNote}
                      </p>
                    </div>
                    {works.length === 0 ? (
                      <p className="text-xs fabro-muted italic">
                        Guardá obras en tu Galería Personal para verlas montadas en esta sala museográfica.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {works.map((w, idx) => (
                          <figure
                            key={w.id}
                            className="rounded-xl border fabro-border fabro-surface p-2.5 space-y-1.5"
                          >
                            <img
                              src={w.imageDataUrl}
                              alt={w.title}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-[4/3] object-cover rounded-lg"
                            />
                            <figcaption className="text-xs">
                              <span className="font-semibold">
                                Fig. {idx + 1} · {w.title}
                              </span>
                              <span className="block fabro-muted text-[11px]">
                                {w.medium} ({w.year})
                              </span>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 7. PHOTOGRAPHY CONTESTS */}
      {activeTab === 'concursos' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold">Convocatorias y Concursos Abiertos de Fotografía</h3>
            <p className="text-xs fabro-muted">
              Participación 100% gratuita compartiendo tus fotografías desde la Galería hacia el Muro Cultural con el hashtag de cada convocatoria.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {[
              {
                title: 'Luz y Arquitectura Cotidiana',
                tag: '#luzcotidiana',
                deadline: 'Abierto todo el mes',
                desc: 'Sombras, geometrías urbanas y detalles patrimoniales con luz natural.',
              },
              {
                title: 'Retratos de Oficios y Tradición',
                tag: '#oficiosvivos',
                deadline: 'Convocatoria bimestral',
                desc: 'Documentá manos, talleres, mercados y trabajo artesanal en tu comunidad.',
              },
              {
                title: 'Naturaleza y Paisaje Local',
                tag: '#paisajefabro',
                deadline: 'Selección permanente',
                desc: 'Flora, cielos, ríos y conservación ambiental en fotografía libre.',
              },
            ].map((contest) => (
              <div
                key={contest.title}
                className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-2"
              >
                <p className="text-xs font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                  {contest.deadline}
                </p>
                <h4 className="text-sm font-bold">{contest.title}</h4>
                <p className="text-xs fabro-muted leading-relaxed">{contest.desc}</p>
                <p className="text-xs font-mono text-[#1E3A8A] dark:text-[#93C5FD]">{contest.tag}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
