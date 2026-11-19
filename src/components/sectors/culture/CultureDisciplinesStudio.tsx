import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  BookMarked,
  Compass,
  Download,
  Gamepad2,
  Leaf,
  MapPin,
  Music2,
  Play,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import type {
  CultureDisciplineId,
  CultureDisciplineMeta,
  CultureDisciplineRecord,
} from '../../../types/culture';

interface CultureDisciplinesStudioProps {
  meta: CultureDisciplineMeta;
  records: CultureDisciplineRecord[];
  onSaveRecord: (rec: CultureDisciplineRecord) => void;
  onDeleteRecord: (id: string) => void;
  onOpenDigitalLibrary?: () => void;
}

const INDIGENOUS_GLOSSARY = [
  { word: 'Pachamama', lang: 'Quechua / Aymara', meaning: 'Madre Tierra, principio de reciprocidad y cuidado de la vida.' },
  { word: 'Yvy', lang: 'Guaraní', meaning: 'Tierra, suelo fértil y territorio compartido.' },
  { word: 'Newen', lang: 'Mapudungun', meaning: 'Fuerza vital y energía espiritual de la naturaleza y las personas.' },
  { word: 'Ayni', lang: 'Quechua', meaning: 'Principio comunitario de ayuda mutua y reciprocidad: hoy por ti, mañana por mí.' },
  { word: 'Minga', lang: 'Quechua / Andino', meaning: 'Trabajo colectivo voluntario en beneficio de toda la comunidad.' },
  { word: 'Teko Porã', lang: 'Guaraní', meaning: 'El buen vivir en armonía con la comunidad y el entorno.' },
];

export const CultureDisciplinesStudio: React.FC<CultureDisciplinesStudioProps> = ({
  meta,
  records,
  onSaveRecord,
  onDeleteRecord,
  onOpenDigitalLibrary,
}) => {
  const [activeToolIdx, setActiveToolIdx] = useState(0);
  useEffect(() => {
    setActiveToolIdx(0);
  }, [meta.id]);

  // 1. Videojuegos — 16x16 Pixel Art Editor
  const [pixels, setPixels] = useState<string[]>(() => Array(256).fill('#FFFFFF'));
  const [pixelColor, setPixelColor] = useState('#1E3A8A');
  const [pixelErasing, setPixelErasing] = useState(false);

  const exportPixelPng = () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    pixels.forEach((hex, idx) => {
      const x = (idx % 16) * 16;
      const y = Math.floor(idx / 16) * 16;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, 16, 16);
    });
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'pixel_art_fabro.png';
    a.click();
  };

  // 2. Cultura Urbana — Beat Loop + Rhyme Notebook
  const [beatPlaying, setBeatPlaying] = useState(false);
  const [beatBpm, setBeatBpm] = useState(90);
  const [rhymeDraft, setRhymeDraft] = useState(
    'Camino el barrio con cuaderno abierto,\ncada pared dibuja un nuevo puerto...'
  );
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!beatPlaying) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') void ctx.resume();

    let step = 0;
    const interval = window.setInterval(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (step % 4 === 0) {
        // Kick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      } else if (step % 4 === 2) {
        // Snare tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      } else {
        // Hat pulse
        osc.type = 'square';
        osc.frequency.setValueAtTime(920, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
      step = (step + 1) % 8;
    }, Math.round((60 / beatBpm / 2) * 1000));
    return () => window.clearInterval(interval);
  }, [beatBpm, beatPlaying]);

  // 3. Cultura Ambiental — Ecological Footprint Calculator
  const [ecoKmWeek, setEcoKmWeek] = useState(40);
  const [ecoRecycle, setEcoRecycle] = useState(true);
  const [ecoLocalFood, setEcoLocalFood] = useState(true);
  const ecoScoreKgMonth = Math.max(
    45,
    Math.round(ecoKmWeek * 0.85 * 4 + (ecoRecycle ? 25 : 85) + (ecoLocalFood ? 40 : 105))
  );

  // 4. Generic structured organizer state (shared by all specialized discipline tools)
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [metaField, setMetaField] = useState('');
  const [dateField, setDateField] = useState('');
  const [body, setBody] = useState('');
  const [glossarySearch, setGlossarySearch] = useState('');

  const activeToolName = meta.tools[activeToolIdx] || meta.tools[0];
  const toolRecords = records.filter(
    (r) => r.disciplineId === meta.id && r.toolKey === activeToolName
  );
  const allDisciplineRecords = records.filter((r) => r.disciplineId === meta.id);

  const exportCollectingCsv = () => {
    const rows = [
      ['Pieza', 'Categoría', 'Estado / Valoración', 'Año / Fecha', 'Descripción'],
      ...allDisciplineRecords.map((r) => [
        r.title,
        r.subtitle || '',
        r.meta || '',
        r.date || '',
        r.body.replace(/\n/g, ' '),
      ]),
    ];
    const csv = rows
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inventario_coleccionismo_fabro.csv';
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Tool Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-2xl border fabro-border fabro-surface">
        <div className="flex flex-wrap items-center gap-1.5">
          {meta.tools.map((tool, idx) => (
            <button
              key={tool}
              type="button"
              onClick={() => setActiveToolIdx(idx)}
              className={`min-h-[40px] rounded-xl px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                activeToolIdx === idx
                  ? 'text-white'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
              style={activeToolIdx === idx ? { backgroundColor: meta.accentColor } : undefined}
            >
              {tool}
            </button>
          ))}
        </div>

        {meta.id === 'bibliotecas-archivos' && onOpenDigitalLibrary && (
          <button
            type="button"
            onClick={onOpenDigitalLibrary}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#14532D]/40 bg-[#14532D]/10 text-[#14532D] dark:text-emerald-300 px-3 text-xs font-bold cursor-pointer"
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>Ir a Biblioteca Digital</span>
          </button>
        )}

        {meta.id === 'coleccionismo' && (
          <button
            type="button"
            onClick={exportCollectingCsv}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border px-3 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        )}
      </div>

      {/* SPECIALIZED INTERACTIVE TOOL: PIXEL ART 16x16 (Videojuegos) */}
      {meta.id === 'videojuegos' && activeToolIdx === 0 && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-[#6D28D9]" />
                Estudio Pixel Art 16×16 (Canvas Local)
              </h3>
              <p className="text-xs fabro-muted">
                Diseñá sprites, íconos o personajes retro y descargalos como PNG sin programas pagos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="color"
                value={pixelColor}
                onChange={(e) => {
                  setPixelColor(e.target.value);
                  setPixelErasing(false);
                }}
                className="w-9 h-9 rounded-lg border fabro-border cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setPixelErasing((v) => !v)}
                className={`min-h-[36px] rounded-xl border px-3 font-semibold cursor-pointer ${
                  pixelErasing ? 'border-[#6D28D9] bg-[#6D28D9]/15' : 'fabro-border'
                }`}
              >
                {pixelErasing ? 'Borrando' : 'Borrador'}
              </button>
              <button
                type="button"
                onClick={() => setPixels(Array(256).fill('#FFFFFF'))}
                className="min-h-[36px] rounded-xl border fabro-border px-3 font-medium cursor-pointer"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={exportPixelPng}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] text-white px-3.5 font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PNG</span>
              </button>
            </div>
          </div>

          <div className="max-w-[384px] mx-auto grid grid-cols-[repeat(16,minmax(0,1fr))] border fabro-border rounded-lg overflow-hidden bg-white">
            {pixels.map((hex, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  setPixels((prev) =>
                    prev.map((c, idx) => (idx === i ? (pixelErasing ? '#FFFFFF' : pixelColor) : c))
                  )
                }
                style={{ backgroundColor: hex }}
                className="aspect-square border border-black/5 cursor-crosshair"
                aria-label={`Pixel ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* SPECIALIZED INTERACTIVE TOOL: URBAN BEAT & RHYME NOTEBOOK */}
      {meta.id === 'cultura-urbana' && activeToolIdx === 0 && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Music2 className="w-4 h-4 text-[#4338CA]" />
                Libreta de Rimas + Base Rítmica Web Audio
              </h3>
              <p className="text-xs fabro-muted">
                Practicá métrica, improvisación o letras sobre una base generada localmente.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono tabular-nums">{beatBpm} BPM</span>
              <input
                type="range"
                min={70}
                max={135}
                value={beatBpm}
                onChange={(e) => setBeatBpm(Number(e.target.value))}
                className="w-24"
              />
              <button
                type="button"
                onClick={() => setBeatPlaying((v) => !v)}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl px-4 font-bold cursor-pointer ${
                  beatPlaying ? 'bg-rose-600 text-white' : 'bg-[#4338CA] text-white'
                }`}
              >
                {beatPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{beatPlaying ? 'Detener beat' : 'Reproducir beat'}</span>
              </button>
            </div>
          </div>
          <textarea
            value={rhymeDraft}
            onChange={(e) => setRhymeDraft(e.target.value)}
            rows={7}
            className="w-full rounded-xl border fabro-border fabro-surface-elevated p-4 text-sm leading-relaxed fabro-input"
          />
          <button
            type="button"
            onClick={() => {
              if (!rhymeDraft.trim()) return;
              onSaveRecord({
                id: `urb-${Date.now()}`,
                disciplineId: meta.id,
                toolKey: activeToolName,
                title: `Letra · ${beatBpm} BPM`,
                body: rhymeDraft.trim(),
                createdAt: 'Hoy',
              });
            }}
            className="min-h-[38px] rounded-xl bg-[#4338CA] text-white px-4 text-xs font-bold cursor-pointer"
          >
            Guardar letra en mi archivo
          </button>
        </div>
      )}

      {/* SPECIALIZED INTERACTIVE TOOL: ECOLOGICAL FOOTPRINT CALCULATOR */}
      {meta.id === 'cultura-ambiental' && activeToolIdx === 0 && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Leaf className="w-4 h-4 text-[#15803D]" />
                Calculadora Orientativa de Huella Ecológica Mensual
              </h3>
              <p className="text-xs fabro-muted">
                Estimación educativa local para identificar hábitos de reducción de emisiones.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs fabro-muted">Estimación mensual</p>
              <p className="font-mono text-2xl font-extrabold tabular-nums text-[#15803D] dark:text-emerald-400">
                {ecoScoreKgMonth} kg CO₂e
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1.5">
              <span className="font-semibold">Traslados motorizados ({ecoKmWeek} km/sem)</span>
              <input
                type="range"
                min={0}
                max={300}
                value={ecoKmWeek}
                onChange={(e) => setEcoKmWeek(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <label className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ecoRecycle}
                onChange={(e) => setEcoRecycle(e.target.checked)}
              />
              <span>Separo residuos y composta en casa</span>
            </label>
            <label className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ecoLocalFood}
                onChange={(e) => setEcoLocalFood(e.target.checked)}
              />
              <span>Priorizo alimentos de estación y cercanía</span>
            </label>
          </div>
        </div>
      )}

      {/* SPECIALIZED INTERACTIVE TOOL: INDIGENOUS LANGUAGES GLOSSARY */}
      {meta.id === 'cultura-indigena' && activeToolIdx === 0 && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <input
            type="search"
            value={glossarySearch}
            onChange={(e) => setGlossarySearch(e.target.value)}
            placeholder="Buscar término en quechua, guaraní, mapudungun o aymara..."
            className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INDIGENOUS_GLOSSARY.filter((g) =>
              `${g.word} ${g.lang} ${g.meaning}`
                .toLowerCase()
                .includes(glossarySearch.trim().toLowerCase())
            ).map((entry) => (
              <div
                key={entry.word}
                className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 text-xs space-y-1"
              >
                <p className="font-semibold text-[#9A3412] dark:text-[#FDBA74]">{entry.lang}</p>
                <h4 className="text-sm font-bold">{entry.word}</h4>
                <p className="fabro-muted leading-relaxed">{entry.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STRUCTURED RECORD BUILDER & ARCHIVE FOR EVERY DISCIPLINE TOOL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() && !body.trim()) return;
            onSaveRecord({
              id: `disc-${Date.now()}`,
              disciplineId: meta.id as CultureDisciplineId,
              toolKey: activeToolName,
              title: title.trim() || `${activeToolName} · Nuevo registro`,
              subtitle: subtitle.trim() || undefined,
              meta: metaField.trim() || undefined,
              date: dateField.trim() || undefined,
              body: body.trim(),
              createdAt: 'Hoy',
            });
            setTitle('');
            setSubtitle('');
            setMetaField('');
            setDateField('');
            setBody('');
          }}
          className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
        >
          <h3 className="text-sm font-bold flex items-center gap-2">
            {meta.id === 'turismo-cultural' ? (
              <MapPin className="w-4 h-4" />
            ) : meta.id === 'bibliotecas-archivos' ? (
              <Archive className="w-4 h-4" />
            ) : (
              <Compass className="w-4 h-4" />
            )}
            <span>{activeToolName}</span>
          </h3>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del registro, pieza, ruta, sala o actividad"
            className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Categoría / Lugar / Signatura"
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="text"
              value={metaField}
              onChange={(e) => setMetaField(e.target.value)}
              placeholder="Estado / Valor / Presupuesto"
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
          </div>
          <input
            type="text"
            value={dateField}
            onChange={(e) => setDateField(e.target.value)}
            placeholder="Fecha, horario o época"
            className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={`Anotaciones, ficha técnica o detalles para ${activeToolName.toLowerCase()}...`}
            className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
          />
          <button
            type="submit"
            className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl text-white font-bold cursor-pointer"
            style={{ backgroundColor: meta.accentColor }}
          >
            <Plus className="w-4 h-4" />
            <span>Guardar en {activeToolName}</span>
          </button>
        </form>

        <div className="lg:col-span-7 space-y-3">
          {toolRecords.length === 0 ? (
            <div className="rounded-2xl border fabro-border fabro-surface p-6 text-center text-xs fabro-muted">
              Aún no hay fichas guardadas en <strong>{activeToolName}</strong>. Todo lo que registres se guarda gratis en tu dispositivo (IndexedDB).
            </div>
          ) : (
            toolRecords.map((rec) => (
              <div
                key={rec.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-bold">{rec.title}</h4>
                  {(rec.subtitle || rec.meta || rec.date) && (
                    <p className="fabro-muted">
                      {[rec.subtitle, rec.meta, rec.date].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{rec.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteRecord(rec.id)}
                  className="p-1.5 fabro-muted hover:text-rose-600 cursor-pointer shrink-0"
                  aria-label="Eliminar registro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
