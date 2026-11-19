import React, { useMemo, useState } from 'react';
import {
  Download,
  Lightbulb,
  Plus,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import type { IdeaVaultItem } from '../../types/ecosystem';

const SECTOR_LABELS: Record<IdeaVaultItem['sector'], string> = {
  estudio: 'Estudio e Investigación',
  bienestar: 'Bienestar y Salud',
  social: 'Red Social FABRO',
  ia: 'Centro de IA (BYOK)',
  configuracion: 'Connect y Configuración',
  general: 'Ecosistema General',
};

const PRIORITY_STYLES: Record<IdeaVaultItem['priority'], { label: string; cls: string }> = {
  esencial: {
    label: 'Esencial',
    cls: 'border-[#EC4899]/50 bg-[#EC4899]/10 text-[#BE185D] dark:text-[#F472B6]',
  },
  'muy-util': {
    label: 'Muy útil',
    cls: 'border-[#2563EB]/50 bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#60A5FA]',
  },
  experimento: {
    label: 'Experimento',
    cls: 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#B45309] dark:text-[#FBBF24]',
  },
};

export const IdeasVaultTool: React.FC = () => {
  const { ideasVault, addIdeaVaultItem, toggleIdeaVote, updateIdeaStatus } = useEcosystem();

  const [title, setTitle] = useState('');
  const [sectorFilter, setSectorFilter] = useState<IdeaVaultItem['sector'] | 'todas'>('todas');
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes');
  const [formSector, setFormSector] = useState<IdeaVaultItem['sector']>('estudio');
  const [priority, setPriority] = useState<IdeaVaultItem['priority']>('muy-util');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    addIdeaVaultItem(title.trim(), formSector, description.trim(), priority);
    setTitle('');
    setDescription('');
  };

  const filtered = useMemo(() => {
    const base =
      sectorFilter === 'todas'
        ? ideasVault
        : ideasVault.filter((item) => item.sector === sectorFilter);
    if (sortBy === 'votes') {
      return [...base].sort((a, b) => b.votes - a.votes);
    }
    return base;
  }, [ideasVault, sectorFilter, sortBy]);

  const handleExportMarkdown = () => {
    const md = [
      '# Bóveda de Ideas FABRO',
      '',
      ...filtered.map(
        (i) =>
          `## ${i.title} (${i.votes} votos)\n- Sector: ${SECTOR_LABELS[i.sector]}\n- Prioridad: ${i.priority} | Estado: ${i.status}\n- Autor: ${i.author}\n\n${i.description}\n`
      ),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabro-boveda-ideas-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="rounded-2xl border-2 border-[#0284C7]/40 bg-gradient-to-r from-[#334155]/10 via-transparent to-[#0284C7]/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#F59E0B]" />
            Bóveda de Ideas de la Comunidad
          </h2>
          <p className="text-xs fabro-muted">
            Proponé nuevas herramientas o mejoras para FABRO, votá las más útiles y exportalas sin costo.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportMarkdown}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0284C7] bg-[#0284C7] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(2,132,199,0.5)] cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Exportar ideas (.md)
        </button>
      </div>

      {/* Submit form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border-2 border-[#334155]/30 fabro-surface p-5 space-y-3.5 text-xs shadow-[0_8px_24px_-12px_rgba(51,65,85,0.22)]"
      >
        <p className="font-display text-sm font-bold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#0284C7]" />
          Proponer nueva herramienta para FABRO
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de la herramienta o mejora..."
            className="min-h-[44px] sm:col-span-2 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
          />
          <select
            value={formSector}
            onChange={(e) => setFormSector(e.target.value as IdeaVaultItem['sector'])}
            className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs"
          >
            {(Object.keys(SECTOR_LABELS) as IdeaVaultItem['sector'][]).map((k) => (
              <option key={k} value={k}>
                {SECTOR_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="¿Cómo facilitaría tu estudio, bienestar o trabajo diario?"
          className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed fabro-input"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="fabro-muted font-semibold">Impacto:</span>
            {(Object.keys(PRIORITY_STYLES) as IdeaVaultItem['priority'][]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
                  priority === p ? PRIORITY_STYLES[p].cls : 'fabro-border fabro-surface-elevated'
                }`}
              >
                {PRIORITY_STYLES[p].label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#334155] bg-[#334155] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(51,65,85,0.5)] cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Guardar en la bóveda
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSectorFilter('todas')}
            className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 font-bold cursor-pointer active:scale-95 ${
              sectorFilter === 'todas'
                ? 'border-[#0284C7] bg-[#0284C7] text-white'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            Todas ({ideasVault.length})
          </button>
          {(Object.keys(SECTOR_LABELS) as IdeaVaultItem['sector'][]).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSectorFilter(sec)}
              className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 font-semibold cursor-pointer active:scale-95 ${
                sectorFilter === sec
                  ? 'border-[#0284C7] bg-[#0284C7] text-white'
                  : 'fabro-border fabro-surface-elevated'
              }`}
            >
              {SECTOR_LABELS[sec].split(' ')[0]}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'votes' | 'recent')}
          aria-label="Ordenar ideas"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs font-semibold"
        >
          <option value="votes">Más votadas</option>
          <option value="recent">Más recientes</option>
        </select>
      </div>

      {/* Idea cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((idea) => (
          <article
            key={idea.id}
            className="rounded-2xl border-2 border-[#334155]/25 fabro-surface p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-[#0284C7] dark:text-[#38BDF8]">
                  {SECTOR_LABELS[idea.sector]}
                </span>
                <span
                  className={`rounded-lg border px-2 py-0.5 font-bold ${PRIORITY_STYLES[idea.priority].cls}`}
                >
                  {PRIORITY_STYLES[idea.priority].label}
                </span>
              </div>
              <h3 className="font-display text-sm font-bold">{idea.title}</h3>
              <p className="text-xs fabro-muted leading-relaxed">{idea.description}</p>
            </div>

            <div className="pt-2 border-t fabro-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleIdeaVote(idea.id)}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-1.5 font-mono font-bold cursor-pointer transition-transform active:scale-95 ${
                    idea.votedByMe
                      ? 'border-[#0284C7] bg-[#0284C7] text-white'
                      : 'border-[#0284C7]/40 bg-[#0284C7]/10 text-[#0284C7] dark:text-[#38BDF8]'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {idea.votes}
                </button>
                <span className="text-[11px] fabro-muted">{idea.author}</span>
              </div>

              <select
                value={idea.status}
                onChange={(e) =>
                  updateIdeaStatus(idea.id, e.target.value as IdeaVaultItem['status'])
                }
                aria-label={`Estado de ${idea.title}`}
                className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-semibold"
              >
                <option value="propuesta">Propuesta</option>
                <option value="en-evaluacion">En evaluación</option>
                <option value="favorita">Favorita</option>
              </select>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
