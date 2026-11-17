import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  BookmarkPlus,
  ExternalLink,
  FileText,
  Library,
  Loader2,
  Search,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { markdownToHtml } from '../../lib/exporters';
import type { AcademicSearchResult } from '../../types/fabro';
import { FabroAIActionStrip } from '../common/FabroAIActionStrip';

const KNOWLEDGE_REPOS = [
  { id: 'pubmed', label: 'PubMed (Biomedicina / Salud)' },
  { id: 'eric', label: 'ERIC (Educación y Pedagogía)' },
  { id: 'zenodo', label: 'Zenodo (Ciencia Abierta / Datasets)' },
  { id: 'internet_archive', label: 'Internet Archive (Textos y Libros)' },
  { id: 'gutenberg', label: 'Project Gutenberg (Dominio Público)' },
  { id: 'scielo_redalyc_repos', label: 'SciELO / Redalyc / Repositorios OA' },
];

export const FabroKnowledgeView: React.FC = () => {
  const { createNote, selectedSubjectId } = useFabro();

  const [query, setQuery] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<string[]>(KNOWLEDGE_REPOS.map((r) => r.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [results, setResults] = useState<AcademicSearchResult[]>([]);
  const [statusByRepo, setStatusByRepo] = useState<
    Record<string, { ok: boolean; count: number; error?: string }>
  >({});
  const [directPortals, setDirectPortals] = useState<
    Array<{ id: string; name: string; url: string; description: string }>
  >([]);
  const [activeRepoFilter, setActiveRepoFilter] = useState('all');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          repos: selectedRepos.length > 0 ? selectedRepos : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error consultando bibliotecas digitales.');
      setResults(Array.isArray(data.results) ? data.results : []);
      setStatusByRepo(data.statusByRepo || {});
      setDirectPortals(Array.isArray(data.directPortals) ? data.directPortals : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error consultando repositorios.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (activeRepoFilter === 'all') return results;
    return results.filter((r) => r.source === activeRepoFilter);
  }, [results, activeRepoFilter]);

  const handleSaveNote = async (item: AcademicSearchResult) => {
    const md = `# ${item.title}\n\n- **Repositorio:** ${item.sourceBadge}\n- **Autores:** ${item.authors.join(', ') || 'No especificados'}\n- **Año:** ${item.year || 's/f'}\n- **Enlace oficial:** ${item.url}\n${item.pdfUrl ? `- **Descarga / Lectura:** ${item.pdfUrl}\n` : ''}\n## Descripción\n${item.abstract}`;
    await createNote({
      subjectId: selectedSubjectId || '',
      unit: '',
      folder: 'FABRO Knowledge',
      title: item.title.slice(0, 180),
      contentHtml: markdownToHtml(md),
      contentText: md,
      tags: ['knowledge', item.source],
      attachments: [],
      offlineAvailable: true,
    });
    setNotice(`"${item.title.slice(0, 60)}" guardado en Apuntes.`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
            <Library className="w-4 h-4" />
            FABRO KNOWLEDGE · BIBLIOTECAS DIGITALES Y REPOSITORIOS ABIERTOS
          </p>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            Acceso integrado a PubMed, ERIC, Zenodo, Internet Archive, Project Gutenberg, SciELO y Redalyc
          </h2>
        </div>

        <form onSubmit={(e) => void handleSearch(e)} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej.: pedagogía crítica, fisiología cardíaca, Platón, derecho laboral, física cuántica..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            Consultar bibliotecas
          </button>
        </form>

        <div className="flex flex-wrap gap-2 text-xs">
          {KNOWLEDGE_REPOS.map((repo) => {
            const active = selectedRepos.includes(repo.id);
            const st = statusByRepo[repo.id];
            return (
              <button
                key={repo.id}
                type="button"
                onClick={() =>
                  setSelectedRepos((prev) =>
                    prev.includes(repo.id) ? prev.filter((r) => r !== repo.id) : [...prev, repo.id]
                  )
                }
                className={`rounded-lg border px-2.5 py-1 font-medium cursor-pointer ${
                  active
                    ? 'border-sky-500/45 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {repo.label}
                {st ? ` (${st.ok ? st.count : 'err'})` : ''}
              </button>
            );
          })}
        </div>
      </section>

      {directPortals.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {directPortals.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 hover:border-sky-500/45 transition-colors flex flex-col justify-between gap-1"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <span>{p.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.description}</p>
            </a>
          ))}
        </section>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveRepoFilter('all')}
            className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
              activeRepoFilter === 'all'
                ? 'bg-sky-600 text-white'
                : 'bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800'
            }`}
          >
            Todos ({results.length})
          </button>
          {Array.from(new Set(results.map((r) => r.source))).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveRepoFilter(src)}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                activeRepoFilter === src
                  ? 'bg-sky-600 text-white'
                  : 'bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800'
              }`}
            >
              {results.find((r) => r.source === src)?.sourceBadge} (
              {results.filter((r) => r.source === src).length})
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  {item.sourceBadge} · {item.year || 'Acceso abierto'}
                </p>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.authors.join(', ') || 'Autoría institucional / no listada'} · {item.venue}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleSaveNote(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  Guardar en Apuntes
                </button>
                {item.pdfUrl && (
                  <a
                    href={item.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Leer / Descargar
                  </a>
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  Abrir ficha
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {item.abstract && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.abstract}
              </p>
            )}

            <FabroAIActionStrip
              compact
              title={item.title}
              content={`${item.title}\nAutores: ${item.authors.join(', ')}\nRepositorio: ${item.sourceBadge}\n\n${item.abstract}`}
              sourceUrls={[{ title: item.title, url: item.url }]}
            />
          </article>
        ))}
      </div>
    </div>
  );
};
