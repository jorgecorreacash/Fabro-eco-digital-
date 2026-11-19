import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Calendar,
  Clapperboard,
  Clock,
  Download,
  Film,
  Play,
  Plus,
  Sparkles,
  Square,
  Subtitles,
  Theater,
  Trash2,
  Users,
} from 'lucide-react';
import type { CultureDisciplineId, CultureDisciplineRecord } from '../../../types/culture';

interface StageScreenStudioProps {
  mode: 'cinema' | 'theater' | 'dance';
  disciplineId: CultureDisciplineId;
  records: CultureDisciplineRecord[];
  onSaveRecord: (rec: CultureDisciplineRecord) => void;
  onDeleteRecord: (id: string) => void;
}

const SCENE_SEEDS = {
  locaciones: ['INT. ESTACIÓN DE TREN - NOCHE', 'EXT. PLAZA CENTRAL - ATARDECER', 'INT. TALLER DE RELOJERÍA - DÍA', 'EXT. MUELLE CON NIEBLA - AMANECER'],
  conflictos: [
    'Un personaje descubre una carta sin destinatario que cambia el rumbo del viaje.',
    'Dos viejos aliados deben cooperar pese a una promesa rota años atrás.',
    'Un objeto extraviado aparece en manos de quien menos debería tenerlo.',
    'El tiempo límite se acorta y una decisión ética divide al grupo.',
  ],
  planos: ['Plano general', 'Plano medio', 'Primer plano', 'Plano detalle', 'Travelling lateral'],
};

export const StageScreenStudio: React.FC<StageScreenStudioProps> = ({
  mode,
  disciplineId,
  records,
  onSaveRecord,
  onDeleteRecord,
}) => {
  const defaultTab =
    mode === 'cinema' ? 'guion' : mode === 'theater' ? 'obra' : 'coreografias';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  useEffect(() => {
    setActiveTab(mode === 'cinema' ? 'guion' : mode === 'theater' ? 'obra' : 'coreografias');
  }, [mode]);

  // Cinema & Theater script editor
  const [scriptTitle, setScriptTitle] = useState(
    mode === 'theater' ? 'Acto I · La Casa de las Ventanas' : 'Cortometraje · Último Tren'
  );
  const [scriptBody, setScriptBody] = useState(
    mode === 'theater'
      ? 'ACTO I - ESCENA 1\n(Una sala iluminada por una sola lámpara. CLARA ordena viejas fotografías.)\n\nCLARA: Pensé que nadie recordaba esta fecha.\n\nMATEO: (Entrando desde el pasillo) Algunas fechas no se olvidan, solo esperan.'
      : 'ESCENA 1\nINT. ESTACIÓN ANTIGUA - NOCHE\n\nLluvia fina contra los vitrales. SOFÍA sostiene un boleto sin perforar.\n\nSOFÍA\nSi no subimos ahora, el reloj vuelve a empezar.\n\nCORTE A:'
  );

  // Storyboard / SRT subtitles
  const [shotLabel, setShotLabel] = useState('Plano medio · Cámara fija');
  const [shotAction, setShotAction] = useState('');
  const [subStart, setSubStart] = useState('00:00:01,000');
  const [subEnd, setSubEnd] = useState('00:00:04,500');
  const [subText, setSubText] = useState('');
  const [generatedScene, setGeneratedScene] = useState<string | null>(null);

  // Generic item form for Characters / Cast / Rehearsals / Choreography / Classes
  const [itemTitle, setItemTitle] = useState('');
  const [itemSub, setItemSub] = useState('');
  const [itemDate, setItemDate] = useState('');
  const [itemBody, setItemBody] = useState('');

  // Dance practice timer
  const [practiceRunning, setPracticeRunning] = useState(false);
  const [practiceSeconds, setPracticeSeconds] = useState(0);
  useEffect(() => {
    if (!practiceRunning) return;
    const t = window.setInterval(() => setPracticeSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [practiceRunning]);

  const tabRecords = records.filter(
    (r) => r.disciplineId === disciplineId && r.toolKey === activeTab
  );

  const exportScriptPdf = () => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(16);
    pdf.text(scriptTitle, 56, 68);
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(scriptBody, 480) as string[];
    let y = 104;
    lines.forEach((line) => {
      if (y > 760) {
        pdf.addPage();
        y = 64;
      }
      pdf.text(line, 56, y);
      y += 16;
    });
    pdf.save(`${scriptTitle.replace(/\s+/g, '_').toLowerCase()}.pdf`);
  };

  const exportSrtFile = () => {
    const srtItems = records.filter(
      (r) => r.disciplineId === disciplineId && r.toolKey === 'subtitulos'
    );
    const content = srtItems
      .map((s, idx) => `${idx + 1}\n${s.meta || '00:00:01,000 --> 00:00:04,000'}\n${s.body}\n`)
      .join('\n');
    const blob = new Blob([content || '1\n00:00:01,000 --> 00:00:04,000\nSubtítulo de ejemplo\n'], {
      type: 'text/plain;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'subtitulos_fabro.srt';
    a.click();
  };

  const tabs =
    mode === 'cinema'
      ? [
          { id: 'guion', label: 'Editor de guiones', icon: Clapperboard },
          { id: 'storyboards', label: 'Storyboards', icon: Film },
          { id: 'escenas', label: 'Generador de escenas', icon: Sparkles },
          { id: 'producciones', label: 'Producciones', icon: Users },
          { id: 'subtitulos', label: 'Editor de subtítulos SRT', icon: Subtitles },
          { id: 'biblioteca-av', label: 'Biblioteca audiovisual', icon: Play },
        ]
      : mode === 'theater'
      ? [
          { id: 'obra', label: 'Escritor de obras', icon: Theater },
          { id: 'personajes', label: 'Creador de personajes', icon: Users },
          { id: 'elencos', label: 'Organizador de elencos', icon: Users },
          { id: 'guiones-teatro', label: 'Biblioteca de guiones', icon: Clapperboard },
          { id: 'ensayos', label: 'Agenda de ensayos', icon: Calendar },
        ]
      : [
          { id: 'coreografias', label: 'Biblioteca de coreografías', icon: Play },
          { id: 'clases', label: 'Organizador de clases', icon: Calendar },
          { id: 'presentaciones', label: 'Agenda de presentaciones', icon: Theater },
          { id: 'practicas', label: 'Registro de prácticas', icon: Clock },
        ];

  const handleSaveSimpleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() && !itemBody.trim()) return;
    onSaveRecord({
      id: `rec-${Date.now()}`,
      disciplineId,
      toolKey: activeTab,
      title: itemTitle.trim() || 'Registro sin título',
      subtitle: itemSub.trim() || undefined,
      date: itemDate.trim() || undefined,
      body: itemBody.trim(),
      createdAt: 'Hoy',
    });
    setItemTitle('');
    setItemSub('');
    setItemDate('');
    setItemBody('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border fabro-border fabro-surface">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#0F766E] text-white'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SCRIPT / PLAY EDITOR */}
      {(activeTab === 'guion' || activeTab === 'obra') && (
        <div className="rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
              className="flex-1 min-w-[220px] min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-sm font-bold fabro-input"
            />
            <div className="flex flex-wrap gap-1.5">
              {(mode === 'cinema'
                ? ['INT. LOCACIÓN - DÍA', 'EXT. CALLE - NOCHE', 'PERSONAJE\n(acotación)\nDiálogo...', 'CORTE A:']
                : ['ACTO II - ESCENA 1', '(Acotación escénica)', 'PERSONAJE: Diálogo...', 'TELÓN']
              ).map((snippet) => (
                <button
                  key={snippet}
                  type="button"
                  onClick={() => setScriptBody((prev) => `${prev}\n\n${snippet}`)}
                  className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 text-[11px] font-mono cursor-pointer"
                >
                  + {snippet.split('\n')[0].slice(0, 18)}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={scriptBody}
            onChange={(e) => setScriptBody(e.target.value)}
            rows={14}
            className="w-full rounded-xl border fabro-border fabro-surface-elevated p-4 font-mono text-xs leading-relaxed fabro-input"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border text-xs">
            <button
              type="button"
              onClick={() =>
                onSaveRecord({
                  id: `scr-${Date.now()}`,
                  disciplineId,
                  toolKey: mode === 'theater' ? 'guiones-teatro' : 'biblioteca-av',
                  title: scriptTitle,
                  body: scriptBody,
                  createdAt: 'Hoy',
                })
              }
              className="min-h-[38px] rounded-xl border fabro-border px-3.5 font-semibold cursor-pointer"
            >
              Guardar copia en biblioteca
            </button>
            <button
              type="button"
              onClick={exportScriptPdf}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#0F766E] text-white px-4 font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar guion PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* STORYBOARDS */}
      {activeTab === 'storyboards' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!shotAction.trim()) return;
              onSaveRecord({
                id: `sb-${Date.now()}`,
                disciplineId,
                toolKey: 'storyboards',
                title: `Plano #${tabRecords.length + 1} · ${shotLabel}`,
                body: shotAction.trim(),
                createdAt: 'Hoy',
              });
              setShotAction('');
            }}
            className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-col sm:flex-row gap-2.5 text-xs"
          >
            <select
              value={shotLabel}
              onChange={(e) => setShotLabel(e.target.value)}
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input sm:w-52"
            >
              {SCENE_SEEDS.planos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={shotAction}
              onChange={(e) => setShotAction(e.target.value)}
              placeholder="Descripción visual del encuadre, movimiento de cámara y audio..."
              className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="submit"
              className="min-h-[40px] rounded-xl bg-[#0F766E] text-white px-4 font-bold cursor-pointer whitespace-nowrap"
            >
              + Agregar plano
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tabRecords.map((card, i) => (
              <div
                key={card.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5"
              >
                <div className="aspect-video rounded-xl border border-dashed fabro-border fabro-surface-elevated flex items-center justify-center text-xs font-mono fabro-muted">
                  CUADRO {String(i + 1).padStart(2, '0')} · 16:9
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold">{card.title}</p>
                    <p className="text-xs fabro-muted mt-1 leading-relaxed">{card.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRecord(card.id)}
                    className="fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCENE GENERATOR */}
      {activeTab === 'escenas' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Generador Estructurado de Escenas (Gratuito y Local)</h3>
              <p className="text-xs fabro-muted">
                Combina locación, conflicto dramático y encuadre inicial para desbloquear ideas de rodaje sin APIs pagas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const loc =
                  SCENE_SEEDS.locaciones[Math.floor(Math.random() * SCENE_SEEDS.locaciones.length)];
                const conf =
                  SCENE_SEEDS.conflictos[Math.floor(Math.random() * SCENE_SEEDS.conflictos.length)];
                const plano =
                  SCENE_SEEDS.planos[Math.floor(Math.random() * SCENE_SEEDS.planos.length)];
                setGeneratedScene(`${loc}\nEncuadre sugerido: ${plano}\n\nConflicto: ${conf}`);
              }}
              className="min-h-[40px] rounded-xl bg-[#0F766E] text-white px-4 text-xs font-bold cursor-pointer"
            >
              Generar escena
            </button>
          </div>
          {generatedScene && (
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-3">
              <pre className="text-xs font-mono whitespace-pre-wrap">{generatedScene}</pre>
              <button
                type="button"
                onClick={() => {
                  setScriptBody((prev) => `${prev}\n\n${generatedScene}`);
                  setActiveTab('guion');
                }}
                className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
              >
                Insertar en el Editor de Guiones →
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUBTITLES SRT EDITOR */}
      {activeTab === 'subtitulos' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Editor Básico de Subtítulos (.SRT)</h3>
              <p className="text-xs fabro-muted">Creá bloques con tiempo de entrada/salida y descargá tu archivo .SRT estándar.</p>
            </div>
            <button
              type="button"
              onClick={exportSrtFile}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#0F766E] text-white px-4 text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar .SRT</span>
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!subText.trim()) return;
              onSaveRecord({
                id: `srt-${Date.now()}`,
                disciplineId,
                toolKey: 'subtitulos',
                title: `Subtítulo #${tabRecords.length + 1}`,
                meta: `${subStart} --> ${subEnd}`,
                body: subText.trim(),
                createdAt: 'Hoy',
              });
              setSubText('');
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs"
          >
            <input
              type="text"
              value={subStart}
              onChange={(e) => setSubStart(e.target.value)}
              className="sm:col-span-3 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
            />
            <input
              type="text"
              value={subEnd}
              onChange={(e) => setSubEnd(e.target.value)}
              className="sm:col-span-3 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
            />
            <input
              type="text"
              value={subText}
              onChange={(e) => setSubText(e.target.value)}
              placeholder="Texto del subtítulo..."
              className="sm:col-span-4 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="submit"
              className="sm:col-span-2 min-h-[40px] rounded-xl bg-[#1E3A8A] text-white font-bold cursor-pointer"
            >
              Añadir
            </button>
          </form>

          <div className="space-y-2">
            {tabRecords.map((s, idx) => (
              <div
                key={s.id}
                className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-mono text-[11px] fabro-muted">
                    #{idx + 1} · {s.meta}
                  </p>
                  <p className="font-medium mt-0.5">{s.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteRecord(s.id)}
                  className="fabro-muted hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DANCE PRACTICE TIMER + LOG */}
      {activeTab === 'practicas' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Cronómetro y Registro de Prácticas de Danza</h3>
              <p className="font-mono text-2xl font-extrabold tabular-nums mt-1">
                {String(Math.floor(practiceSeconds / 60)).padStart(2, '0')}:
                {String(practiceSeconds % 60).padStart(2, '0')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPracticeRunning((v) => !v)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold cursor-pointer ${
                  practiceRunning ? 'bg-rose-600 text-white' : 'bg-[#0F766E] text-white'
                }`}
              >
                {practiceRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{practiceRunning ? 'Pausar' : 'Iniciar ensayo'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (practiceSeconds === 0) return;
                  onSaveRecord({
                    id: `pr-${Date.now()}`,
                    disciplineId,
                    toolKey: 'practicas',
                    title: `Sesión de práctica (${Math.max(1, Math.round(practiceSeconds / 60))} min)`,
                    body: 'Ensayo técnico y repaso coreográfico registrado desde FABRO Danza.',
                    date: new Date().toLocaleDateString('es-AR'),
                    createdAt: 'Hoy',
                  });
                  setPracticeRunning(false);
                  setPracticeSeconds(0);
                }}
                className="min-h-[40px] rounded-xl border fabro-border px-3.5 text-xs font-semibold cursor-pointer"
              >
                Guardar sesión
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {tabRecords.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold">{r.title}</p>
                  <p className="fabro-muted">{r.date || r.createdAt} · {r.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteRecord(r.id)}
                  className="fabro-muted hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STRUCTURED ORGANIZER FOR REMAINING STAGE/SCREEN TABS */}
      {![
        'guion',
        'obra',
        'storyboards',
        'escenas',
        'subtitulos',
        'practicas',
      ].includes(activeTab) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleSaveSimpleRecord}
            className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">
              Nuevo registro · {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
            <input
              type="text"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder="Título o nombre"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={itemSub}
                onChange={(e) => setItemSub(e.target.value)}
                placeholder="Rol / Estilo / Enlace"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="text"
                value={itemDate}
                onChange={(e) => setItemDate(e.target.value)}
                placeholder="Fecha / Horario"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </div>
            <textarea
              value={itemBody}
              onChange={(e) => setItemBody(e.target.value)}
              rows={4}
              placeholder="Notas técnicas, tiempos de 8, vestuario, conflicto o link audiovisual..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
            <button
              type="submit"
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F766E] text-white font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar en {tabs.find((t) => t.id === activeTab)?.label}</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {tabRecords.length === 0 ? (
              <div className="rounded-2xl border fabro-border fabro-surface p-6 text-center text-xs fabro-muted">
                Todavía no agregaste elementos en esta herramienta. Usá el formulario de la izquierda para comenzar.
              </div>
            ) : (
              tabRecords.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border fabro-border fabro-surface p-4 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 text-xs min-w-0">
                    <h4 className="text-sm font-bold">{r.title}</h4>
                    {(r.subtitle || r.date) && (
                      <p className="fabro-muted">
                        {[r.subtitle, r.date].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{r.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRecord(r.id)}
                    className="p-1.5 fabro-muted hover:text-rose-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
