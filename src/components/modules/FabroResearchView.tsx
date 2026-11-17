import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookMarked,
  BookmarkPlus,
  Check,
  Columns3,
  Copy,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  Loader2,
  Scale,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import type {
  AcademicAuthorResult,
  AcademicSearchResult,
  SavedCitationRecord,
} from '../../types/fabro';
import { FabroAIActionStrip } from '../common/FabroAIActionStrip';

type ResearchCategory =
  | 'articulos'
  | 'tesis'
  | 'autores'
  | 'jurisprudencia'
  | 'legislacion'
  | 'estadisticas';

function formatCitation(
  item: { title: string; authors: string[]; year: string; venue: string; url: string; doi?: string },
  style: 'APA' | 'MLA' | 'Chicago'
): string {
  const auth = item.authors.length > 0 ? item.authors.join(', ') : 'Autor institucional';
  const yr = item.year || 's.f.';
  const doiOrUrl = item.doi ? `https://doi.org/${item.doi}` : item.url;
  if (style === 'APA') {
    return `${auth} (${yr}). ${item.title}. ${item.venue}. ${doiOrUrl}`;
  }
  if (style === 'MLA') {
    return `${auth}. "${item.title}." ${item.venue}, ${yr}, ${doiOrUrl}.`;
  }
  return `${auth}. "${item.title}." ${item.venue} (${yr}). ${doiOrUrl}.`;
}

function evaluateCredibility(item: AcademicSearchResult): {
  score: number;
  label: string;
  signals: string[];
} {
  let score = 40;
  const signals: string[] = [];
  if (item.doi) {
    score += 20;
    signals.push('DOI persistente verificado (+20)');
  }
  if (item.openAccess) {
    score += 10;
    signals.push('Repositorio / Acceso abierto transparente (+10)');
  }
  if (item.authors.length > 0) {
    score += 10;
    signals.push('Autoría identificada (+10)');
  }
  if (typeof item.citationsCount === 'number' && item.citationsCount > 0) {
    const bonus = item.citationsCount >= 20 ? 15 : 8;
    score += bonus;
    signals.push(`${item.citationsCount} citas registradas (+${bonus})`);
  }
  if (Number(item.year) >= 2015) {
    score += 5;
    signals.push('Publicación reciente (+5)');
  }
  const capped = Math.min(100, score);
  const label = capped >= 80 ? 'Alta confiabilidad académica' : capped >= 60 ? 'Confiabilidad media-alta' : 'Requiere contraste adicional';
  return { score: capped, label, signals };
}

export const FabroResearchView: React.FC = () => {
  const { user } = useFabro();
  const storageKey = `fabro_bib_${user?.uid || 'anon'}`;

  const [category, setCategory] = useState<ResearchCategory>('articulos');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<AcademicSearchResult[]>([]);
  const [authors, setAuthors] = useState<AcademicAuthorResult[]>([]);
  const [portals, setPortals] = useState<Array<{ name: string; url: string }>>([]);
  const [statSeries, setStatSeries] = useState<
    Array<{ country?: { value?: string }; date?: string; value?: number | null; indicator?: { value?: string } }>
  >([]);

  // Bibliographic Manager + Citation Style + Comparator
  const [savedBib, setSavedBib] = useState<SavedCitationRecord[]>([]);
  const [citationStyle, setCitationStyle] = useState<'APA' | 'MLA' | 'Chicago'>('APA');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSavedBib(JSON.parse(raw) as SavedCitationRecord[]);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const persistBib = (next: SavedCitationRecord[]) => {
    setSavedBib(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 120)));
    } catch {
      // ignore
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, query: query.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error consultando fuentes.');
      setResults(Array.isArray(data.results) ? data.results : []);
      setAuthors(Array.isArray(data.authors) ? data.authors : []);
      setPortals(Array.isArray(data.portals) ? data.portals : []);
      setStatSeries(Array.isArray(data.series) ? data.series : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red en investigación.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToBib = (item: AcademicSearchResult) => {
    if (savedBib.some((b) => b.url === item.url)) return;
    const next: SavedCitationRecord[] = [
      {
        id: item.id,
        title: item.title,
        authors: item.authors,
        year: item.year,
        venue: item.venue,
        url: item.url,
        doi: item.doi,
        sourceBadge: item.sourceBadge,
        savedAt: new Date().toISOString(),
      },
      ...savedBib,
    ];
    persistBib(next);
  };

  const compareItems = useMemo(
    () => results.filter((r) => compareIds.includes(r.id)).slice(0, 3),
    [results, compareIds]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4" />
            FABRO RESEARCH · INVESTIGACIÓN, CITAS Y CONFIABILIDAD DOCUMENTAL
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            Tesis, artículos, autores, jurisprudencia, legislación, estadísticas y gestor bibliográfico
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'articulos', label: 'Artículos científicos', icon: BookMarked },
              { id: 'tesis', label: 'Tesis', icon: FileCheck2 },
              { id: 'autores', label: 'Autores (h-index)', icon: Users },
              { id: 'jurisprudencia', label: 'Jurisprudencia', icon: Scale },
              { id: 'legislacion', label: 'Legislación', icon: Scale },
              { id: 'estadisticas', label: 'Estadísticas (Banco Mundial)', icon: BarChart3 },
            ] as const
          ).map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  category === c.id
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {c.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={(e) => void handleSearch(e)} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar en ${category}...`}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-4 py-2.5 text-sm text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Investigar
          </button>
        </form>
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Portals (Legal / Theses / Stats) */}
      {portals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {portals.map((p) => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-3 text-xs font-semibold text-slate-900 dark:text-white hover:border-sky-500/50 flex items-center justify-between gap-2"
            >
              <span className="truncate">{p.name}</span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* World Bank Statistics Series */}
      {statSeries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 overflow-x-auto">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Serie oficial Banco Mundial: {statSeries[0]?.indicator?.value || query}
          </h3>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 pr-3">País / Región</th>
                <th className="py-2 pr-3">Año</th>
                <th className="py-2">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {statSeries.slice(0, 20).map((row, idx) => (
                <tr key={idx}>
                  <td className="py-1.5 pr-3 font-medium">{row.country?.value}</td>
                  <td className="py-1.5 pr-3 font-mono">{row.date}</td>
                  <td className="py-1.5 font-mono tabular-nums">
                    {typeof row.value === 'number' ? row.value.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <FabroAIActionStrip
            title={`Datos estadísticos Banco Mundial: ${statSeries[0]?.indicator?.value || query}`}
            content={statSeries
              .slice(0, 15)
              .map((s) => `${s.country?.value} (${s.date}): ${s.value}`)
              .join('\n')}
          />
        </section>
      )}

      {/* Authors Output */}
      {authors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {authors.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">{a.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {a.institution} {a.country ? `(${a.country})` : ''}
                  </p>
                </div>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sky-600 text-xs hover:underline">
                  Perfil
                </a>
              </div>
              <p className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
                Obras: {a.worksCount} · Citas: {a.citedByCount.toLocaleString('es-AR')} · h-index: {a.hIndex}
              </p>
              {a.topics.length > 0 && (
                <p className="text-[11px] text-slate-500">Áreas: {a.topics.join(' · ')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Side-by-side Source Comparator */}
      {compareItems.length >= 2 && (
        <section className="rounded-2xl border border-sky-500/35 bg-sky-500/5 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Columns3 className="w-4 h-4 text-sky-600" />
              Comparador de fuentes seleccionadas ({compareItems.length}/3)
            </h3>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-slate-500 hover:underline cursor-pointer"
            >
              Limpiar comparador
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {compareItems.map((item) => {
              const cred = evaluateCredibility(item);
              return (
                <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-3.5 space-y-1.5 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white line-clamp-2">{item.title}</p>
                  <p className="text-slate-500">Año: {item.year || 's/f'} · {item.sourceBadge}</p>
                  <p className="font-mono text-emerald-600 dark:text-emerald-400">
                    Confiabilidad: {cred.score}/100 ({cred.label})
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 line-clamp-4">{item.abstract || 'Sin resumen'}</p>
                </div>
              );
            })}
          </div>
          <FabroAIActionStrip
            title={`Comparación de fuentes sobre ${query}`}
            content={compareItems
              .map((c) => `Fuente: ${c.title} (${c.year})\nAutores: ${c.authors.join(', ')}\nResumen: ${c.abstract}`)
              .join('\n\n---\n\n')}
            sourceUrls={compareItems.map((c) => ({ title: c.title, url: c.url }))}
          />
        </section>
      )}

      {/* Results with Credibility Analyzer */}
      <div className="space-y-3">
        {results.map((item) => {
          const cred = evaluateCredibility(item);
          const inCompare = compareIds.includes(item.id);
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                    {item.sourceBadge} · {item.year || 's/f'} · Confiabilidad {cred.score}/100 ({cred.label})
                  </p>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.authors.join(', ') || 'Autoría no listada'} · {item.venue}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Señales verificadas: {cred.signals.join(' · ')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setCompareIds((prev) =>
                        inCompare ? prev.filter((x) => x !== item.id) : [...prev, item.id].slice(0, 3)
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                      inCompare
                        ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {inCompare ? 'En comparador' : 'Comparar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveToBib(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-sky-600" />
                    Citar / Guardar
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Abrir
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
              {item.abstract && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.abstract}</p>
              )}
              <FabroAIActionStrip
                compact
                title={item.title}
                content={`${item.title}\nAutores: ${item.authors.join(', ')}\n${item.abstract}`}
                sourceUrls={[{ title: item.title, url: item.url }]}
              />
            </article>
          );
        })}
      </div>

      {/* Bibliographic Manager + APA / MLA / Chicago Generator */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Gestor Bibliográfico & Generador de Citas ({savedBib.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Guardá fuentes investigadas y copiá referencias formateadas en APA 7, MLA 9 o Chicago.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {(['APA', 'MLA', 'Chicago'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setCitationStyle(st)}
                className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                  citationStyle === st
                    ? 'bg-sky-600 text-white'
                    : 'border border-slate-200 dark:border-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {savedBib.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hacé clic en &ldquo;Citar / Guardar&rdquo; en cualquier resultado para armar tu bibliografía.
          </p>
        ) : (
          <div className="space-y-2">
            {savedBib.map((entry) => {
              const formatted = formatCitation(entry, citationStyle);
              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3 flex items-start justify-between gap-3 text-xs"
                >
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{formatted}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(formatted);
                        setCopiedId(entry.id);
                        window.setTimeout(() => setCopiedId(null), 1800);
                      }}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                      aria-label="Copiar cita"
                    >
                      {copiedId === entry.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => persistBib(savedBib.filter((b) => b.id !== entry.id))}
                      className="p-1.5 rounded border border-red-500/30 text-red-600 cursor-pointer"
                      aria-label="Eliminar referencia"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
