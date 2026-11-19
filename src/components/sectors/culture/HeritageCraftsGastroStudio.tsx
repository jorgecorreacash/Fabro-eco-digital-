import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Compass,
  GitBranch,
  History,
  Landmark,
  Plus,
  Scale,
  Trash2,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import type {
  CultureDisciplineId,
  CultureDisciplineRecord,
  CultureFamilyMember,
  CultureRecipeItem,
  CultureTimelineItem,
} from '../../../types/culture';

interface HeritageCraftsGastroStudioProps {
  mode: 'history' | 'genealogy' | 'crafts' | 'gastronomy' | 'philosophy-science';
  disciplineId: CultureDisciplineId;
  timeline: CultureTimelineItem[];
  familyTree: CultureFamilyMember[];
  recipes: CultureRecipeItem[];
  records: CultureDisciplineRecord[];
  onSaveTimeline: (item: CultureTimelineItem) => void;
  onDeleteTimeline: (id: string) => void;
  onSaveFamily: (member: CultureFamilyMember) => void;
  onDeleteFamily: (id: string) => void;
  onSaveRecipe: (recipe: CultureRecipeItem) => void;
  onDeleteRecipe: (id: string) => void;
  onSaveRecord: (rec: CultureDisciplineRecord) => void;
  onDeleteRecord: (id: string) => void;
}

const ENCYCLOPEDIA_SEEDS = [
  {
    term: 'Estoicismo',
    area: 'Filosofía',
    summary: 'Escuela filosófica fundada por Zenón de Citio que distingue entre lo que depende de nosotros y lo que no.',
  },
  {
    term: 'Método Científico',
    area: 'Ciencia',
    summary: 'Proceso sistemático de observación, formulación de hipótesis, experimentación replicable y revisión crítica.',
  },
  {
    term: 'Fenomenología',
    area: 'Filosofía',
    summary: 'Corriente impulsada por Edmund Husserl centrada en el estudio riguroso de la experiencia consciente.',
  },
  {
    term: 'Biodiversidad y Ecosistemas',
    area: 'Ciencia',
    summary: 'Variabilidad de organismos vivos e interacciones ecológicas que sostienen los ciclos del agua, suelo y clima.',
  },
  {
    term: 'Epistemología',
    area: 'Filosofía',
    summary: 'Rama de la filosofía que investiga los fundamentos, límites y validez del conocimiento humano.',
  },
  {
    term: 'Relatividad y Cosmología',
    area: 'Ciencia',
    summary: 'Marco físico que describe la gravitación como curvatura del espacio-tiempo y la evolución del universo.',
  },
];

const CRAFT_TECHNIQUES = [
  { name: 'Cerámica en pellizco y plancha', material: 'Arcilla roja o gres', level: 'Inicial', tip: 'Secar lentamente cubierto con tela para evitar grietas.' },
  { name: 'Encuadernación japonesa y copta', material: 'Papel algodón, cartón gris, hilo encerado', level: 'Inicial', tip: 'Respetar la dirección de fibra del papel paralelo al lomo.' },
  { name: 'Telar de bastidor', material: 'Lana hilada, algodón y peine de madera', level: 'Intermedio', tip: 'Mantener tensión uniforme en la urdimbre antes de tramar.' },
  { name: 'Carpintería con ensambles sin tornillos', material: 'Madera estacionada y formón', level: 'Avanzado', tip: 'Marcar las líneas de corte con cuchillo de trazado antes de serruchar.' },
];

export const HeritageCraftsGastroStudio: React.FC<HeritageCraftsGastroStudioProps> = ({
  mode,
  disciplineId,
  timeline,
  familyTree,
  recipes,
  records,
  onSaveTimeline,
  onDeleteTimeline,
  onSaveFamily,
  onDeleteFamily,
  onSaveRecipe,
  onDeleteRecipe,
  onSaveRecord,
  onDeleteRecord,
}) => {
  const getInitialTab = () => {
    if (mode === 'genealogy') return 'arbol';
    if (mode === 'history') return 'linea-tiempo';
    if (mode === 'crafts') return 'calculadora-materiales';
    if (mode === 'gastronomy') return 'recetario';
    return 'enciclopedia';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [mode]);

  // Timeline form
  const [tlYear, setTlYear] = useState('');
  const [tlTitle, setTlTitle] = useState('');
  const [tlRegion, setTlRegion] = useState('');
  const [tlDesc, setTlDesc] = useState('');

  // Family tree form
  const [famName, setFamName] = useState('');
  const [famRelation, setFamRelation] = useState('Abuelo / Abuela');
  const [famGen, setFamGen] = useState<1 | 2 | 3 | 4>(1);
  const [famYear, setFamYear] = useState('');
  const [famPlace, setFamPlace] = useState('');
  const [famNotes, setFamNotes] = useState('');

  // Crafts Material Calculator
  const [craftMaterials, setCraftMaterials] = useState([
    { id: 'cm-1', name: 'Arcilla / Madera / Tela base', qty: 2, unitPrice: 3500 },
    { id: 'cm-2', name: 'Pigmentos / Barniz / Hilo', qty: 1, unitPrice: 1800 },
  ]);
  const [wastePct, setWastePct] = useState(10);
  const [hoursEst, setHoursEst] = useState(4);
  const [newMatName, setNewMatName] = useState('');
  const [newMatQty, setNewMatQty] = useState(1);
  const [newMatPrice, setNewMatPrice] = useState(1000);

  // Gastronomy Recipe + Portion Scaler + Unit Converter
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id || '');
  const [targetServings, setTargetServings] = useState<number>(recipes[0]?.baseServings || 4);
  const [newRecTitle, setNewRecTitle] = useState('');
  const [newRecRegion, setNewRecRegion] = useState('');
  const [newRecServings, setNewRecServings] = useState(4);
  const [newRecIngs, setNewRecIngs] = useState('Harina, 250, g\nAgua, 160, ml');
  const [newRecSteps, setNewRecSteps] = useState('');
  const [convVal, setConvVal] = useState(1);
  const [convType, setConvType] = useState<'taza-ml' | 'cda-ml' | 'oz-g' | 'c-f'>('taza-ml');

  // Encyclopedia / Notes
  const [encQuery, setEncQuery] = useState('');
  const [recTitle, setRecTitle] = useState('');
  const [recSub, setRecSub] = useState('');
  const [recBody, setRecBody] = useState('');

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) || recipes[0] || null;
  const craftSubtotal = craftMaterials.reduce((s, m) => s + m.qty * m.unitPrice, 0);
  const craftTotal = Math.round(craftSubtotal * (1 + wastePct / 100));

  const convertedOutput = (() => {
    if (convType === 'taza-ml') return `${(convVal * 240).toFixed(0)} ml (${(convVal * 120).toFixed(0)} g harina)`;
    if (convType === 'cda-ml') return `${(convVal * 15).toFixed(1)} ml`;
    if (convType === 'oz-g') return `${(convVal * 28.35).toFixed(1)} gramos`;
    return `${((convVal * 9) / 5 + 32).toFixed(1)} °F`;
  })();

  const tabs =
    mode === 'history' || mode === 'genealogy'
      ? [
          { id: 'linea-tiempo', label: 'Línea de tiempo', icon: History },
          { id: 'arbol', label: 'Árbol genealógico', icon: GitBranch },
          { id: 'archivo-hist', label: 'Archivo histórico', icon: Landmark },
          { id: 'mapas-hist', label: 'Mapas históricos', icon: Compass },
        ]
      : mode === 'crafts'
      ? [
          { id: 'calculadora-materiales', label: 'Calculadora de materiales', icon: Calculator },
          { id: 'tecnicas', label: 'Catálogo de técnicas', icon: Wrench },
          { id: 'proyectos-art', label: 'Proyectos y tutoriales', icon: BookOpen },
        ]
      : mode === 'gastronomy'
      ? [
          { id: 'recetario', label: 'Recetario y porciones', icon: UtensilsCrossed },
          { id: 'conversor', label: 'Conversor de medidas', icon: Scale },
          { id: 'nueva-receta', label: 'Agregar receta', icon: Plus },
        ]
      : [
          { id: 'enciclopedia', label: 'Enciclopedia y biografías', icon: BookOpen },
          { id: 'linea-tiempo', label: 'Línea de tiempo', icon: History },
          { id: 'investigaciones', label: 'Investigaciones y cuadernos', icon: Landmark },
        ];

  const tabRecords = records.filter(
    (r) => r.disciplineId === disciplineId && r.toolKey === activeTab
  );

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
                  ? 'bg-[#854D0E] text-white'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TIMELINE */}
      {activeTab === 'linea-tiempo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!tlYear.trim() || !tlTitle.trim()) return;
              onSaveTimeline({
                id: `tl-${Date.now()}`,
                year: tlYear.trim(),
                title: tlTitle.trim(),
                region: tlRegion.trim() || 'Global',
                category: mode === 'philosophy-science' ? 'Pensamiento / Ciencia' : 'Patrimonio',
                description: tlDesc.trim(),
              });
              setTlYear('');
              setTlTitle('');
              setTlRegion('');
              setTlDesc('');
            }}
            className="lg:col-span-4 rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">Añadir hito cronológico</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={tlYear}
                onChange={(e) => setTlYear(e.target.value)}
                placeholder="Año (ej: 1810)"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
              <input
                type="text"
                value={tlRegion}
                onChange={(e) => setTlRegion(e.target.value)}
                placeholder="Región / Lugar"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </div>
            <input
              type="text"
              value={tlTitle}
              onChange={(e) => setTlTitle(e.target.value)}
              placeholder="Acontecimiento o descubrimiento"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <textarea
              value={tlDesc}
              onChange={(e) => setTlDesc(e.target.value)}
              rows={3}
              placeholder="Contexto histórico y fuentes..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
            <button
              type="submit"
              className="w-full min-h-[40px] rounded-xl bg-[#854D0E] text-white font-bold cursor-pointer"
            >
              Agregar a línea de tiempo
            </button>
          </form>

          <div className="lg:col-span-8 space-y-3">
            {[...timeline]
              .sort((a, b) => a.year.localeCompare(b.year, undefined, { numeric: true }))
              .map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border fabro-border fabro-surface p-4 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 text-xs">
                    <p className="font-mono font-bold text-[#854D0E] dark:text-[#FCD34D]">
                      {item.year} · {item.region} · {item.category}
                    </p>
                    <h4 className="text-sm font-bold">{item.title}</h4>
                    <p className="fabro-muted leading-relaxed">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteTimeline(item.id)}
                    className="fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* FAMILY TREE CONSTRUCTOR */}
      {activeTab === 'arbol' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!famName.trim()) return;
              onSaveFamily({
                id: `fam-${Date.now()}`,
                name: famName.trim(),
                relation: famRelation.trim() || 'Familiar',
                generation: famGen,
                birthYear: famYear.trim() || '—',
                place: famPlace.trim() || '—',
                notes: famNotes.trim(),
              });
              setFamName('');
              setFamYear('');
              setFamPlace('');
              setFamNotes('');
            }}
            className="lg:col-span-4 rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">Añadir integrante familiar</h3>
            <input
              type="text"
              value={famName}
              onChange={(e) => setFamName(e.target.value)}
              placeholder="Nombre y apellido"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={famRelation}
                onChange={(e) => setFamRelation(e.target.value)}
                placeholder="Parentesco"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <select
                value={famGen}
                onChange={(e) => setFamGen(Number(e.target.value) as 1 | 2 | 3 | 4)}
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                <option value={1}>Gen. 1 (Bisabuelos/Abuelos)</option>
                <option value={2}>Gen. 2 (Padres/Tíos)</option>
                <option value={3}>Gen. 3 (Propia/Hermanos)</option>
                <option value={4}>Gen. 4 (Hijos/Nietos)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={famYear}
                onChange={(e) => setFamYear(e.target.value)}
                placeholder="Año nacimiento"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="text"
                value={famPlace}
                onChange={(e) => setFamPlace(e.target.value)}
                placeholder="Lugar de origen"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </div>
            <textarea
              value={famNotes}
              onChange={(e) => setFamNotes(e.target.value)}
              rows={2}
              placeholder="Oficio, anécdota o recuerdo familiar..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
            <button
              type="submit"
              className="w-full min-h-[40px] rounded-xl bg-[#854D0E] text-white font-bold cursor-pointer"
            >
              Sumar al árbol genealógico
            </button>
          </form>

          <div className="lg:col-span-8 space-y-4">
            {([1, 2, 3, 4] as const).map((gen) => {
              const members = familyTree.filter((m) => m.generation === gen);
              if (members.length === 0) return null;
              return (
                <div key={gen} className="space-y-2">
                  <p className="text-xs font-bold fabro-muted">Generación {gen}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-xl border fabro-border fabro-surface p-3.5 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm">{m.name}</p>
                          <p className="fabro-muted">
                            {m.relation} · {m.birthYear} · {m.place}
                          </p>
                          {m.notes && <p className="mt-1 leading-relaxed">{m.notes}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteFamily(m.id)}
                          className="fabro-muted hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CRAFTS MATERIAL CALCULATOR */}
      {activeTab === 'calculadora-materiales' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Calculadora de Materiales, Merma y Costos</h3>
              <p className="text-xs fabro-muted">
                Calculá el costo real de tus piezas artesanales incluyendo merma y horas de taller.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs fabro-muted">Total estimado (+{wastePct}% merma)</p>
              <p className="font-mono text-2xl font-extrabold tabular-nums">
                ${craftTotal.toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-semibold fabro-muted">Margen de merma ({wastePct}%)</span>
              <input
                type="range"
                min={0}
                max={35}
                value={wastePct}
                onChange={(e) => setWastePct(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold fabro-muted">Horas estimadas de oficio ({hoursEst} h)</span>
              <input
                type="number"
                min={1}
                value={hoursEst}
                onChange={(e) => setHoursEst(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
          </div>

          <div className="space-y-2">
            {craftMaterials.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <span className="font-semibold">{m.name}</span>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span>
                    {m.qty} × ${m.unitPrice.toLocaleString('es-AR')} = $
                    {(m.qty * m.unitPrice).toLocaleString('es-AR')}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCraftMaterials((prev) => prev.filter((item) => item.id !== m.id))
                    }
                    className="fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs pt-2 border-t fabro-border">
            <input
              type="text"
              value={newMatName}
              onChange={(e) => setNewMatName(e.target.value)}
              placeholder="Nuevo insumo o material"
              className="sm:col-span-6 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="number"
              min={1}
              value={newMatQty}
              onChange={(e) => setNewMatQty(Number(e.target.value) || 1)}
              className="sm:col-span-2 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="number"
              min={0}
              value={newMatPrice}
              onChange={(e) => setNewMatPrice(Number(e.target.value) || 0)}
              className="sm:col-span-2 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="button"
              onClick={() => {
                if (!newMatName.trim()) return;
                setCraftMaterials((prev) => [
                  ...prev,
                  {
                    id: `cm-${Date.now()}`,
                    name: newMatName.trim(),
                    qty: newMatQty,
                    unitPrice: newMatPrice,
                  },
                ]);
                setNewMatName('');
              }}
              className="sm:col-span-2 min-h-[40px] rounded-xl bg-[#854D0E] text-white font-bold cursor-pointer"
            >
              Sumar
            </button>
          </div>
        </div>
      )}

      {/* CRAFTS TECHNIQUES CATALOG */}
      {activeTab === 'tecnicas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CRAFT_TECHNIQUES.map((tech) => (
            <div
              key={tech.name}
              className="rounded-2xl border fabro-border fabro-surface p-4 space-y-1.5 text-xs"
            >
              <p className="font-semibold text-[#854D0E] dark:text-[#FCD34D]">{tech.level}</p>
              <h4 className="text-sm font-bold">{tech.name}</h4>
              <p className="fabro-muted">Materiales: {tech.material}</p>
              <p className="leading-relaxed pt-1">{tech.tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* GASTRONOMY RECETARIO & PORTION SCALER */}
      {activeTab === 'recetario' && selectedRecipe && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-2">
            {recipes.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl border p-3 text-xs flex items-center justify-between gap-2 ${
                  selectedRecipe.id === r.id
                    ? 'border-[#C2410C] bg-[#C2410C]/10'
                    : 'fabro-border fabro-surface'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecipeId(r.id);
                    setTargetServings(r.baseServings);
                  }}
                  className="text-left flex-1 cursor-pointer"
                >
                  <p className="font-bold">{r.title}</p>
                  <p className="fabro-muted">
                    {r.region} · {r.prepMinutes} min
                  </p>
                </button>
                {recipes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteRecipe(r.id)}
                    className="fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="lg:col-span-8 rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b fabro-border">
              <div>
                <h3 className="font-display text-lg font-bold">{selectedRecipe.title}</h3>
                <p className="text-xs fabro-muted">
                  {selectedRecipe.region} · Base {selectedRecipe.baseServings} porciones ·{' '}
                  {selectedRecipe.prepMinutes} min
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold fabro-muted">Escalar a:</span>
                <button
                  type="button"
                  onClick={() => setTargetServings((s) => Math.max(1, s - 1))}
                  className="w-8 h-8 rounded-lg border fabro-border font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="font-mono font-bold tabular-nums w-16 text-center">
                  {targetServings} porc.
                </span>
                <button
                  type="button"
                  onClick={() => setTargetServings((s) => s + 1)}
                  className="w-8 h-8 rounded-lg border fabro-border font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <p className="font-bold">Ingredientes recalculados</p>
                <ul className="space-y-1.5">
                  {selectedRecipe.ingredients.map((ing, i) => {
                    const scaled =
                      Math.round(((ing.amount * targetServings) / selectedRecipe.baseServings) * 10) /
                      10;
                    return (
                      <li
                        key={i}
                        className="rounded-lg border fabro-border fabro-surface-elevated px-3 py-2 flex justify-between gap-2"
                      >
                        <span>{ing.name}</span>
                        <span className="font-mono font-bold tabular-nums">
                          {scaled} {ing.unit}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="font-bold">Preparación</p>
                <p className="whitespace-pre-wrap leading-relaxed rounded-xl border fabro-border fabro-surface-elevated p-3.5">
                  {selectedRecipe.steps}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GASTRONOMY CONVERTER */}
      {activeTab === 'conversor' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <h3 className="text-sm font-bold">Conversor Rápido de Medidas Culinarias</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
            <label className="space-y-1">
              <span className="font-semibold fabro-muted">Cantidad</span>
              <input
                type="number"
                step="0.5"
                value={convVal}
                onChange={(e) => setConvVal(Number(e.target.value) || 0)}
                className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold fabro-muted">Conversión</span>
              <select
                value={convType}
                onChange={(e) => setConvType(e.target.value as typeof convType)}
                className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                <option value="taza-ml">Tazas → Mililitros / Gramos</option>
                <option value="cda-ml">Cucharadas → Mililitros</option>
                <option value="oz-g">Onzas → Gramos</option>
                <option value="c-f">Grados °C → °F (Horno)</option>
              </select>
            </label>
            <div className="min-h-[42px] rounded-xl border border-[#C2410C]/40 bg-[#C2410C]/10 px-4 flex items-center font-mono font-bold text-sm">
              = {convertedOutput}
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW RECIPE */}
      {activeTab === 'nueva-receta' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newRecTitle.trim()) return;
            const parsedIngs = newRecIngs
              .split('\n')
              .map((line) => line.split(',').map((x) => x.trim()))
              .filter((parts) => parts[0])
              .map((parts) => ({
                name: parts[0],
                amount: Number(parts[1]) || 1,
                unit: parts[2] || 'u',
              }));
            const created: CultureRecipeItem = {
              id: `rec-${Date.now()}`,
              title: newRecTitle.trim(),
              region: newRecRegion.trim() || 'Cocina Regional',
              baseServings: newRecServings,
              prepMinutes: 40,
              ingredients: parsedIngs,
              steps: newRecSteps.trim() || 'Seguir pasos tradicionales.',
            };
            onSaveRecipe(created);
            setSelectedRecipeId(created.id);
            setTargetServings(created.baseServings);
            setNewRecTitle('');
            setNewRecRegion('');
            setNewRecSteps('');
            setActiveTab('recetario');
          }}
          className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3 text-xs"
        >
          <h3 className="text-sm font-bold">Registrar receta en el recetario regional</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={newRecTitle}
              onChange={(e) => setNewRecTitle(e.target.value)}
              placeholder="Nombre del plato"
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="text"
              value={newRecRegion}
              onChange={(e) => setNewRecRegion(e.target.value)}
              placeholder="Región / Tradición"
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="number"
              min={1}
              value={newRecServings}
              onChange={(e) => setNewRecServings(Number(e.target.value) || 4)}
              placeholder="Porciones base"
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
          </div>
          <textarea
            value={newRecIngs}
            onChange={(e) => setNewRecIngs(e.target.value)}
            rows={4}
            placeholder="Un ingrediente por línea: Nombre, cantidad, unidad"
            className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 font-mono fabro-input"
          />
          <textarea
            value={newRecSteps}
            onChange={(e) => setNewRecSteps(e.target.value)}
            rows={3}
            placeholder="Pasos de preparación..."
            className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
          />
          <button
            type="submit"
            className="min-h-[40px] rounded-xl bg-[#C2410C] text-white px-5 font-bold cursor-pointer"
          >
            Guardar receta
          </button>
        </form>
      )}

      {/* PHILOSOPHY & SCIENCE ENCYCLOPEDIA */}
      {activeTab === 'enciclopedia' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <input
            type="search"
            value={encQuery}
            onChange={(e) => setEncQuery(e.target.value)}
            placeholder="Buscar concepto filosófico, científico o biografía..."
            className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3.5 text-xs fabro-input"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {ENCYCLOPEDIA_SEEDS.filter((e) =>
              `${e.term} ${e.area} ${e.summary}`.toLowerCase().includes(encQuery.trim().toLowerCase())
            ).map((entry) => (
              <div
                key={entry.term}
                className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-1 text-xs"
              >
                <p className="font-semibold text-[#1E3A8A] dark:text-[#93C5FD]">{entry.area}</p>
                <h4 className="text-sm font-bold">{entry.term}</h4>
                <p className="fabro-muted leading-relaxed">{entry.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARCHIVE / MAPS / RESEARCH / CRAFT PROJECTS */}
      {['archivo-hist', 'mapas-hist', 'proyectos-art', 'investigaciones'].includes(activeTab) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!recTitle.trim()) return;
              onSaveRecord({
                id: `hcg-${Date.now()}`,
                disciplineId,
                toolKey: activeTab,
                title: recTitle.trim(),
                subtitle: recSub.trim() || undefined,
                body: recBody.trim(),
                createdAt: 'Hoy',
              });
              setRecTitle('');
              setRecSub('');
              setRecBody('');
            }}
            className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">
              Nuevo registro · {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
            <input
              type="text"
              value={recTitle}
              onChange={(e) => setRecTitle(e.target.value)}
              placeholder="Título del documento, lugar o investigación"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="text"
              value={recSub}
              onChange={(e) => setRecSub(e.target.value)}
              placeholder="Referencia, coordenadas, cita APA o técnica"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <textarea
              value={recBody}
              onChange={(e) => setRecBody(e.target.value)}
              rows={4}
              placeholder="Desarrollo, fuentes verificadas o cuaderno de notas..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
            <button
              type="submit"
              className="w-full min-h-[40px] rounded-xl bg-[#854D0E] text-white font-bold cursor-pointer"
            >
              Guardar ficha local
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {tabRecords.length === 0 ? (
              <div className="rounded-2xl border fabro-border fabro-surface p-6 text-center text-xs fabro-muted">
                Sin fichas todavía. Guardá tus documentos, mapas históricos, proyectos artesanales o notas de investigación aquí.
              </div>
            ) : (
              tabRecords.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border fabro-border fabro-surface p-4 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold">{r.title}</h4>
                    {r.subtitle && <p className="fabro-muted font-mono">{r.subtitle}</p>}
                    <p className="whitespace-pre-wrap leading-relaxed">{r.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRecord(r.id)}
                    className="fabro-muted hover:text-rose-600 cursor-pointer"
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
