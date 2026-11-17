import express from 'express';

export interface NormalizedAcademicHit {
  id: string;
  source: string;
  sourceBadge: string;
  title: string;
  authors: string[];
  year: string;
  date: string;
  venue: string;
  abstract: string;
  url: string;
  pdfUrl?: string;
  doi?: string;
  openAccess: boolean;
  citationsCount?: number;
  kind?: string;
}

function stripTags(raw: string): string {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function reconstructOpenAlexAbstract(inv?: Record<string, number[]> | null): string {
  if (!inv || typeof inv !== 'object') return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (pos >= 0 && pos < 250) words[pos] = word;
    }
  }
  return words.filter(Boolean).join(' ').slice(0, 600);
}

async function queryOpenAlexWorks(q: string, extraFilter = '', limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', q);
  url.searchParams.set('per-page', String(limit));
  if (extraFilter) url.searchParams.set('filter', extraFilter);

  const resp = await fetch(url.toString(), {
    headers: { 'User-Agent': 'FABRO-Educational-Platform/1.0 (mailto:jorgecorreasp@gmail.com)' },
    signal: AbortSignal.timeout(9000),
  });
  if (!resp.ok) throw new Error(`OpenAlex HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    results?: Array<{
      id?: string;
      title?: string;
      publication_year?: number;
      publication_date?: string;
      doi?: string;
      cited_by_count?: number;
      type?: string;
      open_access?: { is_oa?: boolean; oa_url?: string };
      primary_location?: { landing_page_url?: string; pdf_url?: string; source?: { display_name?: string } };
      authorships?: Array<{ author?: { display_name?: string } }>;
      abstract_inverted_index?: Record<string, number[]>;
    }>;
  };

  return (data.results || []).map((w, idx) => ({
    id: `oa_${idx}_${(w.id || '').split('/').pop() || idx}`,
    source: 'openalex',
    sourceBadge: 'OpenAlex',
    title: stripTags(w.title || 'Sin título'),
    authors: (w.authorships || [])
      .map((a) => a.author?.display_name || '')
      .filter(Boolean)
      .slice(0, 5),
    year: w.publication_year ? String(w.publication_year) : '',
    date: w.publication_date || (w.publication_year ? String(w.publication_year) : ''),
    venue: w.primary_location?.source?.display_name || 'OpenAlex',
    abstract: reconstructOpenAlexAbstract(w.abstract_inverted_index),
    url: w.primary_location?.landing_page_url || w.doi || w.id || 'https://openalex.org',
    pdfUrl: w.open_access?.oa_url || w.primary_location?.pdf_url || undefined,
    doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, '') : undefined,
    openAccess: Boolean(w.open_access?.is_oa),
    citationsCount: typeof w.cited_by_count === 'number' ? w.cited_by_count : undefined,
    kind: w.type || 'article',
  }));
}

async function querySemanticScholar(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
  url.searchParams.set('query', q);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('fields', 'title,authors,year,publicationDate,venue,abstract,url,openAccessPdf,citationCount,externalIds');

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(9000) });
  if (!resp.ok) throw new Error(`Semantic Scholar HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    data?: Array<{
      paperId?: string;
      title?: string;
      year?: number;
      publicationDate?: string;
      venue?: string;
      abstract?: string;
      url?: string;
      citationCount?: number;
      openAccessPdf?: { url?: string };
      externalIds?: { DOI?: string };
      authors?: Array<{ name?: string }>;
    }>;
  };

  return (data.data || []).map((p, idx) => ({
    id: `s2_${idx}_${p.paperId || idx}`,
    source: 'semantic_scholar',
    sourceBadge: 'Semantic Scholar',
    title: stripTags(p.title || 'Sin título'),
    authors: (p.authors || []).map((a) => a.name || '').filter(Boolean).slice(0, 5),
    year: p.year ? String(p.year) : '',
    date: p.publicationDate || (p.year ? String(p.year) : ''),
    venue: p.venue || 'Semantic Scholar',
    abstract: stripTags(p.abstract || '').slice(0, 600),
    url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
    pdfUrl: p.openAccessPdf?.url || undefined,
    doi: p.externalIds?.DOI || undefined,
    openAccess: Boolean(p.openAccessPdf?.url),
    citationsCount: typeof p.citationCount === 'number' ? p.citationCount : undefined,
    kind: 'article',
  }));
}

async function queryCrossref(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query', q);
  url.searchParams.set('rows', String(limit));

  const resp = await fetch(url.toString(), {
    headers: { 'User-Agent': 'FABRO-Educational-Platform/1.0 (mailto:jorgecorreasp@gmail.com)' },
    signal: AbortSignal.timeout(9000),
  });
  if (!resp.ok) throw new Error(`Crossref HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    message?: {
      items?: Array<{
        DOI?: string;
        URL?: string;
        title?: string[];
        abstract?: string;
        'container-title'?: string[];
        'is-referenced-by-count'?: number;
        type?: string;
        published?: { 'date-parts'?: number[][] };
        author?: Array<{ given?: string; family?: string }>;
        link?: Array<{ URL?: string; 'content-type'?: string }>;
      }>;
    };
  };

  return (data.message?.items || []).map((item, idx) => {
    const parts = item.published?.['date-parts']?.[0] || [];
    const year = parts[0] ? String(parts[0]) : '';
    const date = parts.length ? parts.map((n) => String(n).padStart(2, '0')).join('-') : '';
    const pdf = item.link?.find((l) => l['content-type']?.includes('pdf'))?.URL;
    return {
      id: `cr_${idx}_${(item.DOI || String(idx)).replace(/[^a-zA-Z0-9]/g, '_')}`,
      source: 'crossref',
      sourceBadge: 'Crossref',
      title: stripTags(item.title?.[0] || 'Sin título'),
      authors: (item.author || [])
        .map((a) => `${a.given || ''} ${a.family || ''}`.trim())
        .filter(Boolean)
        .slice(0, 5),
      year,
      date,
      venue: item['container-title']?.[0] || 'Crossref DOI',
      abstract: stripTags(item.abstract || '').slice(0, 600),
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : 'https://search.crossref.org/'),
      pdfUrl: pdf || undefined,
      doi: item.DOI || undefined,
      openAccess: Boolean(pdf),
      citationsCount: typeof item['is-referenced-by-count'] === 'number' ? item['is-referenced-by-count'] : undefined,
      kind: item.type || 'article',
    };
  });
}

async function queryArxiv(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=${limit}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!resp.ok) throw new Error(`arXiv HTTP ${resp.status}`);
  const xml = await resp.text();
  const entries = xml.split('<entry>').slice(1);
  return entries.map((entry, idx) => {
    const getTag = (tag: string) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? stripTags(m[1]) : '';
    };
    const authors = Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi))
      .map((m) => stripTags(m[1]))
      .slice(0, 5);
    const idUrl = getTag('id');
    const published = getTag('published');
    const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i);
    return {
      id: `ax_${idx}`,
      source: 'arxiv',
      sourceBadge: 'arXiv',
      title: getTag('title') || 'Preprint arXiv',
      authors,
      year: published ? published.slice(0, 4) : '',
      date: published ? published.slice(0, 10) : '',
      venue: 'arXiv Preprint',
      abstract: getTag('summary').slice(0, 600),
      url: idUrl || 'https://arxiv.org/',
      pdfUrl: pdfMatch?.[1] || (idUrl ? idUrl.replace('/abs/', '/pdf/') : undefined),
      openAccess: true,
      kind: 'preprint',
    };
  });
}

async function queryDoaj(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(q)}?pageSize=${limit}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!resp.ok) throw new Error(`DOAJ HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    results?: Array<{
      id?: string;
      bibjson?: {
        title?: string;
        abstract?: string;
        year?: string;
        journal?: { title?: string };
        author?: Array<{ name?: string }>;
        identifier?: Array<{ type?: string; id?: string }>;
        link?: Array<{ url?: string; type?: string }>;
      };
    }>;
  };
  return (data.results || []).map((r, idx) => {
    const b = r.bibjson || {};
    const doi = b.identifier?.find((i) => i.type?.toLowerCase() === 'doi')?.id;
    const link = b.link?.find((l) => l.url)?.url;
    return {
      id: `doaj_${idx}_${r.id || idx}`,
      source: 'doaj',
      sourceBadge: 'DOAJ',
      title: stripTags(b.title || 'Artículo DOAJ'),
      authors: (b.author || []).map((a) => a.name || '').filter(Boolean).slice(0, 5),
      year: b.year || '',
      date: b.year || '',
      venue: b.journal?.title || 'DOAJ Open Access',
      abstract: stripTags(b.abstract || '').slice(0, 600),
      url: link || (doi ? `https://doi.org/${doi}` : `https://doaj.org/article/${r.id}`),
      doi,
      openAccess: true,
      kind: 'article',
    };
  });
}

async function queryCore(q: string, limit = 6): Promise<{ items: NormalizedAcademicHit[]; note?: string }> {
  const apiKey = (process.env.CORE_API_KEY || '').trim();
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(q)}&limit=${limit}`;
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(9000) });
  if (!resp.ok) {
    throw new Error(
      resp.status === 401 || resp.status === 429
        ? 'CORE API v3 requiere CORE_API_KEY o superó su cuota pública anónima'
        : `CORE HTTP ${resp.status}`
    );
  }
  const data = (await resp.json()) as {
    results?: Array<{
      id?: number | string;
      title?: string;
      yearPublished?: number;
      abstract?: string;
      downloadUrl?: string;
      doi?: string;
      publisher?: string;
      authors?: Array<{ name?: string }>;
      links?: Array<{ type?: string; url?: string }>;
    }>;
  };
  const items: NormalizedAcademicHit[] = (data.results || []).map((c, idx) => ({
    id: `core_${idx}_${c.id || idx}`,
    source: 'core',
    sourceBadge: 'CORE',
    title: stripTags(c.title || 'Documento CORE'),
    authors: (c.authors || []).map((a) => a.name || '').filter(Boolean).slice(0, 5),
    year: c.yearPublished ? String(c.yearPublished) : '',
    date: c.yearPublished ? String(c.yearPublished) : '',
    venue: c.publisher || 'CORE Open Repository',
    abstract: stripTags(c.abstract || '').slice(0, 600),
    url: c.links?.[0]?.url || c.downloadUrl || `https://core.ac.uk/works/${c.id}`,
    pdfUrl: c.downloadUrl || undefined,
    doi: c.doi || undefined,
    openAccess: true,
    kind: 'repository',
  }));
  return { items };
}

async function queryPubMed(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const esearch = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&term=${encodeURIComponent(q)}`;
  const r1 = await fetch(esearch, { signal: AbortSignal.timeout(9000) });
  if (!r1.ok) throw new Error(`PubMed HTTP ${r1.status}`);
  const j1 = (await r1.json()) as { esearchresult?: { idlist?: string[] } };
  const ids = j1.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const esummary = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`;
  const r2 = await fetch(esummary, { signal: AbortSignal.timeout(9000) });
  if (!r2.ok) throw new Error(`PubMed Summary HTTP ${r2.status}`);
  const j2 = (await r2.json()) as {
    result?: Record<
      string,
      {
        uid?: string;
        title?: string;
        pubdate?: string;
        source?: string;
        authors?: Array<{ name?: string }>;
        elocationid?: string;
      }
    >;
  };

  return ids
    .map((id) => j2.result?.[id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.title))
    .map((item) => {
      const doiMatch = item.elocationid?.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
      return {
        id: `pm_${item.uid}`,
        source: 'pubmed',
        sourceBadge: 'PubMed',
        title: stripTags(item.title || ''),
        authors: (item.authors || []).map((a) => a.name || '').filter(Boolean).slice(0, 5),
        year: (item.pubdate || '').slice(0, 4),
        date: item.pubdate || '',
        venue: item.source || 'PubMed / NCBI',
        abstract: 'Registro indexado en PubMed (National Library of Medicine).',
        url: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}/`,
        doi: doiMatch?.[0],
        openAccess: true,
        kind: 'biomedical',
      };
    });
}

async function queryEric(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = `https://api.ies.ed.gov/eric/?search=${encodeURIComponent(q)}&rows=${limit}&format=json`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!resp.ok) throw new Error(`ERIC HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    response?: {
      docs?: Array<{
        id?: string;
        title?: string;
        author?: string[];
        publicationdateyear?: number;
        source?: string;
        description?: string;
        url?: string;
      }>;
    };
  };
  return (data.response?.docs || []).map((d, idx) => ({
    id: `eric_${idx}_${d.id || idx}`,
    source: 'eric',
    sourceBadge: 'ERIC',
    title: stripTags(d.title || 'Documento ERIC'),
    authors: (d.author || []).slice(0, 5),
    year: d.publicationdateyear ? String(d.publicationdateyear) : '',
    date: d.publicationdateyear ? String(d.publicationdateyear) : '',
    venue: d.source || 'ERIC Education Resources',
    abstract: stripTags(d.description || '').slice(0, 600),
    url: d.url || `https://eric.ed.gov/?id=${d.id}`,
    openAccess: true,
    kind: 'education',
  }));
}

async function queryZenodo(q: string, limit = 8, typeFilter = ''): Promise<NormalizedAcademicHit[]> {
  const url = new URL('https://zenodo.org/api/records');
  url.searchParams.set('q', q);
  url.searchParams.set('size', String(limit));
  if (typeFilter) url.searchParams.set('type', typeFilter);

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(9000) });
  if (!resp.ok) throw new Error(`Zenodo HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    hits?: {
      hits?: Array<{
        id?: number;
        doi?: string;
        links?: { self_html?: string };
        files?: Array<{ links?: { self?: string }; type?: string }>;
        metadata?: {
          title?: string;
          publication_date?: string;
          description?: string;
          creators?: Array<{ name?: string }>;
          access_right?: string;
          resource_type?: { title?: string };
        };
      }>;
    };
  };
  return (data.hits?.hits || []).map((h, idx) => {
    const m = h.metadata || {};
    const pdf = h.files?.find((f) => f.type === 'pdf')?.links?.self;
    return {
      id: `zen_${idx}_${h.id || idx}`,
      source: 'zenodo',
      sourceBadge: 'Zenodo',
      title: stripTags(m.title || 'Registro Zenodo'),
      authors: (m.creators || []).map((c) => c.name || '').filter(Boolean).slice(0, 5),
      year: (m.publication_date || '').slice(0, 4),
      date: m.publication_date || '',
      venue: m.resource_type?.title || 'Zenodo Open Science',
      abstract: stripTags(m.description || '').slice(0, 600),
      url: h.links?.self_html || `https://zenodo.org/records/${h.id}`,
      pdfUrl: pdf || undefined,
      doi: h.doi,
      openAccess: m.access_right === 'open',
      kind: m.resource_type?.title || 'dataset',
    };
  });
}

async function queryInternetArchive(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`(${q}) AND mediatype:(texts)`)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=description&rows=${limit}&page=1&output=json`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!resp.ok) throw new Error(`Internet Archive HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    response?: {
      docs?: Array<{
        identifier?: string;
        title?: string;
        creator?: string | string[];
        year?: string | number;
        description?: string | string[];
      }>;
    };
  };
  return (data.response?.docs || []).map((d, idx) => {
    const authors = Array.isArray(d.creator) ? d.creator : d.creator ? [d.creator] : [];
    const desc = Array.isArray(d.description) ? d.description.join(' ') : d.description || '';
    return {
      id: `ia_${idx}_${d.identifier || idx}`,
      source: 'internet_archive',
      sourceBadge: 'Internet Archive',
      title: stripTags(d.title || 'Texto Internet Archive'),
      authors: authors.slice(0, 4),
      year: d.year ? String(d.year) : '',
      date: d.year ? String(d.year) : '',
      venue: 'Internet Archive Texts',
      abstract: stripTags(desc).slice(0, 600),
      url: `https://archive.org/details/${d.identifier}`,
      openAccess: true,
      kind: 'book',
    };
  });
}

async function queryGutenberg(q: string, limit = 8): Promise<NormalizedAcademicHit[]> {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(q)}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!resp.ok) throw new Error(`Project Gutenberg HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    results?: Array<{
      id?: number;
      title?: string;
      authors?: Array<{ name?: string; birth_year?: number; death_year?: number }>;
      subjects?: string[];
      formats?: Record<string, string>;
      download_count?: number;
    }>;
  };
  return (data.results || []).slice(0, limit).map((b, idx) => ({
    id: `pg_${idx}_${b.id || idx}`,
    source: 'gutenberg',
    sourceBadge: 'Project Gutenberg',
    title: stripTags(b.title || 'Obra clásica'),
    authors: (b.authors || []).map((a) => a.name || '').filter(Boolean).slice(0, 4),
    year: b.authors?.[0]?.death_year ? `dom. púb. (${b.authors[0].death_year})` : 'Dominio público',
    date: '',
    venue: 'Project Gutenberg · Dominio Público',
    abstract: (b.subjects || []).slice(0, 4).join(' · ') || 'Libro completo de acceso abierto.',
    url: `https://www.gutenberg.org/ebooks/${b.id}`,
    pdfUrl: b.formats?.['text/html'] || b.formats?.['application/epub+zip'] || undefined,
    openAccess: true,
    citationsCount: b.download_count,
    kind: 'book',
  }));
}

export function createPlatformResearchRouter(): express.Router {
  const router = express.Router();

  // -------------------------------------------------------------------------
  // 1. FABRO EXPLORER — Multi-source simultaneous academic search
  // -------------------------------------------------------------------------
  router.post('/explorer/search', async (req, res) => {
    const query = String(req.body?.query || '').trim().slice(0, 300);
    const sources: string[] = Array.isArray(req.body?.sources) && req.body.sources.length > 0
      ? req.body.sources.map(String)
      : ['openalex', 'semantic_scholar', 'crossref', 'arxiv', 'doaj', 'core'];

    if (!query) {
      res.status(400).json({ error: 'Ingresá palabras clave para buscar en los buscadores académicos.' });
      return;
    }

    const perSourceStatus: Record<string, { ok: boolean; count: number; error?: string }> = {};
    const allResults: NormalizedAcademicHit[] = [];

    const tasks: Array<Promise<void>> = [];

    if (sources.includes('openalex')) {
      tasks.push(
        queryOpenAlexWorks(query, '', 8)
          .then((items) => {
            allResults.push(...items);
            perSourceStatus.openalex = { ok: true, count: items.length };
          })
          .catch((e) => {
            perSourceStatus.openalex = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (sources.includes('semantic_scholar')) {
      tasks.push(
        querySemanticScholar(query, 8)
          .then((items) => {
            allResults.push(...items);
            perSourceStatus.semantic_scholar = { ok: true, count: items.length };
          })
          .catch((e) => {
            perSourceStatus.semantic_scholar = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (sources.includes('crossref')) {
      tasks.push(
        queryCrossref(query, 8)
          .then((items) => {
            allResults.push(...items);
            perSourceStatus.crossref = { ok: true, count: items.length };
          })
          .catch((e) => {
            perSourceStatus.crossref = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (sources.includes('arxiv')) {
      tasks.push(
        queryArxiv(query, 8)
          .then((items) => {
            allResults.push(...items);
            perSourceStatus.arxiv = { ok: true, count: items.length };
          })
          .catch((e) => {
            perSourceStatus.arxiv = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (sources.includes('doaj')) {
      tasks.push(
        queryDoaj(query, 8)
          .then((items) => {
            allResults.push(...items);
            perSourceStatus.doaj = { ok: true, count: items.length };
          })
          .catch((e) => {
            perSourceStatus.doaj = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (sources.includes('core')) {
      tasks.push(
        queryCore(query, 6)
          .then(({ items }) => {
            allResults.push(...items);
            perSourceStatus.core = { ok: true, count: items.length };
          })
          .catch((e) => {
            perSourceStatus.core = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }

    await Promise.all(tasks);

    // Direct official portals where no free unauthenticated public REST search API exists (honest disclosure, no scraping)
    const externalPortals = [
      {
        id: 'google',
        name: 'Google',
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        note: 'Búsqueda web general oficial en navegador.',
      },
      {
        id: 'bing',
        name: 'Bing',
        url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        note: 'Búsqueda web Bing oficial.',
      },
      {
        id: 'google_scholar',
        name: 'Google Scholar',
        url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
        note: 'Google Scholar no expone API pública oficial sin scraping; apertura directa autorizada.',
      },
      {
        id: 'pinterest',
        name: 'Pinterest',
        url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
        note: 'Pinterest no habilita búsqueda pública abierta sin token empresarial; apertura directa oficial.',
      },
    ];

    res.json({
      query,
      total: allResults.length,
      perSourceStatus,
      results: allResults,
      externalPortals,
    });
  });

  // -------------------------------------------------------------------------
  // 2. FABRO KNOWLEDGE — Open Repositories & Digital Academic Libraries
  // -------------------------------------------------------------------------
  router.post('/knowledge/search', async (req, res) => {
    const query = String(req.body?.query || '').trim().slice(0, 300);
    const repos: string[] = Array.isArray(req.body?.repos) && req.body.repos.length > 0
      ? req.body.repos.map(String)
      : ['pubmed', 'eric', 'zenodo', 'internet_archive', 'gutenberg', 'scielo_redalyc_repos'];

    if (!query) {
      res.status(400).json({ error: 'Escribí un tema, autor o título para consultar en las bibliotecas.' });
      return;
    }

    const statusByRepo: Record<string, { ok: boolean; count: number; error?: string }> = {};
    const items: NormalizedAcademicHit[] = [];
    const tasks: Array<Promise<void>> = [];

    if (repos.includes('pubmed')) {
      tasks.push(
        queryPubMed(query, 8)
          .then((r) => {
            items.push(...r);
            statusByRepo.pubmed = { ok: true, count: r.length };
          })
          .catch((e) => {
            statusByRepo.pubmed = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (repos.includes('eric')) {
      tasks.push(
        queryEric(query, 8)
          .then((r) => {
            items.push(...r);
            statusByRepo.eric = { ok: true, count: r.length };
          })
          .catch((e) => {
            statusByRepo.eric = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (repos.includes('zenodo')) {
      tasks.push(
        queryZenodo(query, 8)
          .then((r) => {
            items.push(...r);
            statusByRepo.zenodo = { ok: true, count: r.length };
          })
          .catch((e) => {
            statusByRepo.zenodo = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (repos.includes('internet_archive')) {
      tasks.push(
        queryInternetArchive(query, 8)
          .then((r) => {
            items.push(...r);
            statusByRepo.internet_archive = { ok: true, count: r.length };
          })
          .catch((e) => {
            statusByRepo.internet_archive = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (repos.includes('gutenberg')) {
      tasks.push(
        queryGutenberg(query, 8)
          .then((r) => {
            items.push(...r);
            statusByRepo.gutenberg = { ok: true, count: r.length };
          })
          .catch((e) => {
            statusByRepo.gutenberg = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }
    if (repos.includes('scielo_redalyc_repos')) {
      // Query OpenAlex open-access institutional repositories + Hispanic open science works
      tasks.push(
        queryOpenAlexWorks(query, 'is_oa:true', 8)
          .then((r) => {
            const tagged = r.map((x) => ({
              ...x,
              source: 'repositorios_oa',
              sourceBadge: x.venue.toLowerCase().includes('scielo')
                ? 'SciELO (OA)'
                : x.venue.toLowerCase().includes('redalyc')
                  ? 'Redalyc (OA)'
                  : 'Repositorio Universitario',
            }));
            items.push(...tagged);
            statusByRepo.scielo_redalyc_repos = { ok: true, count: tagged.length };
          })
          .catch((e) => {
            statusByRepo.scielo_redalyc_repos = { ok: false, count: 0, error: e instanceof Error ? e.message : 'Error' };
          })
      );
    }

    await Promise.all(tasks);

    const directPortals = [
      {
        id: 'scielo',
        name: 'SciELO',
        url: `https://search.scielo.org/?q=${encodeURIComponent(query)}&lang=es`,
        description: 'Red iberoamericana de revistas científicas de acceso abierto.',
      },
      {
        id: 'redalyc',
        name: 'Redalyc',
        url: `https://www.redalyc.org/busquedaArticuloFiltros.oa?q=${encodeURIComponent(query)}`,
        description: 'Sistema de Información Científica Redalyc (UAEMex).',
      },
      {
        id: 'lareferencia',
        name: 'LA Referencia (Tesis y Repositorios)',
        url: `https://www.lareferencia.info/vufind/Search/Results?lookfor=${encodeURIComponent(query)}`,
        description: 'Red federada de repositorios universitarios de América Latina.',
      },
    ];

    res.json({
      query,
      total: items.length,
      statusByRepo,
      results: items,
      directPortals,
    });
  });

  // -------------------------------------------------------------------------
  // 3. FABRO RESEARCH — Theses, Authors, Legal Portals & World Bank Stats
  // -------------------------------------------------------------------------
  router.post('/research/search', async (req, res) => {
    const query = String(req.body?.query || '').trim().slice(0, 300);
    const category = String(req.body?.category || 'articulos');

    if (!query) {
      res.status(400).json({ error: 'Escribí un término de investigación para consultar.' });
      return;
    }

    try {
      if (category === 'tesis') {
        const [oaTheses, zenTheses] = await Promise.allSettled([
          queryOpenAlexWorks(query, 'type:dissertation', 10),
          queryZenodo(query, 6, 'publication'),
        ]);
        const results: NormalizedAcademicHit[] = [];
        if (oaTheses.status === 'fulfilled') results.push(...oaTheses.value.map((x) => ({ ...x, sourceBadge: 'Tesis · OpenAlex' })));
        if (zenTheses.status === 'fulfilled') results.push(...zenTheses.value);
        res.json({
          category,
          results,
          portals: [
            { name: 'OATD (Open Access Theses & Dissertations)', url: `https://oatd.org/oatd/search?q=${encodeURIComponent(query)}` },
            { name: 'NDLTD Global ETD Search', url: `https://search.ndltd.org/search.php?q=${encodeURIComponent(query)}` },
            { name: 'SNRD Argentina (Repositorios Nacionales)', url: `https://repositoriosdigitales.mincyt.gob.ar/vufind/Search/Results?lookfor=${encodeURIComponent(query)}` },
          ],
        });
        return;
      }

      if (category === 'autores') {
        const url = new URL('https://api.openalex.org/authors');
        url.searchParams.set('search', query);
        url.searchParams.set('per-page', '12');
        const resp = await fetch(url.toString(), {
          headers: { 'User-Agent': 'FABRO-Educational-Platform/1.0 (mailto:jorgecorreasp@gmail.com)' },
          signal: AbortSignal.timeout(9000),
        });
        if (!resp.ok) throw new Error(`OpenAlex Authors HTTP ${resp.status}`);
        const data = (await resp.json()) as {
          results?: Array<{
            id?: string;
            display_name?: string;
            orcid?: string;
            works_count?: number;
            cited_by_count?: number;
            summary_stats?: { h_index?: number };
            last_known_institutions?: Array<{ display_name?: string; country_code?: string }>;
            x_concepts?: Array<{ display_name?: string }>;
          }>;
        };
        const authors = (data.results || []).map((a) => ({
          id: a.id || '',
          name: a.display_name || 'Investigador',
          orcid: a.orcid || '',
          institution: a.last_known_institutions?.[0]?.display_name || 'Afiliación no informada',
          country: a.last_known_institutions?.[0]?.country_code || '',
          worksCount: a.works_count || 0,
          citedByCount: a.cited_by_count || 0,
          hIndex: a.summary_stats?.h_index || 0,
          topics: (a.x_concepts || []).slice(0, 4).map((c) => c.display_name || '').filter(Boolean),
          url: a.id || 'https://openalex.org/authors',
        }));
        res.json({ category, authors, results: [] });
        return;
      }

      if (category === 'estadisticas') {
        // Real World Bank Indicators API v2 search + country data series
        const indResp = await fetch(
          `https://api.worldbank.org/v2/indicator?format=json&per_page=100`,
          { signal: AbortSignal.timeout(9000) }
        );
        const rawInd = indResp.ok ? ((await indResp.json()) as [unknown, Array<{ id?: string; name?: string; sourceNote?: string; source?: { value?: string } }>]) : null;
        const list = Array.isArray(rawInd?.[1]) ? rawInd[1] : [];
        const qLower = query.toLowerCase();
        const matched = list
          .filter((i) => `${i.name || ''} ${i.sourceNote || ''}`.toLowerCase().includes(qLower))
          .slice(0, 8);

        // Also map well-known topic keywords to reliable World Bank indicator codes if text match is small
        const curatedCodes: Array<{ code: string; label: string }> = [
          { code: 'NY.GDP.MKTP.CD', label: 'PIB (USD actuales)' },
          { code: 'SP.POP.TOTL', label: 'Población total' },
          { code: 'FP.CPI.TOTL.ZG', label: 'Inflación anual (%)' },
          { code: 'SE.XPD.TOTL.GD.ZS', label: 'Gasto público en educación (% del PIB)' },
          { code: 'SL.UEM.TOTL.ZS', label: 'Desempleo total (%)' },
        ];
        const targetCode = matched[0]?.id || curatedCodes[0].code;
        const seriesResp = await fetch(
          `https://api.worldbank.org/v2/country/ARG;BRA;MEX;ESP;USA;WLD/indicator/${encodeURIComponent(targetCode)}?format=json&mrv=5`,
          { signal: AbortSignal.timeout(9000) }
        );
        const seriesJson = seriesResp.ok
          ? ((await seriesResp.json()) as [unknown, Array<{ country?: { value?: string }; date?: string; value?: number | null; indicator?: { value?: string } }>])
          : null;

        res.json({
          category,
          indicators: matched.length > 0 ? matched : curatedCodes.map((c) => ({ id: c.code, name: c.label, sourceNote: 'Banco Mundial Open Data' })),
          series: Array.isArray(seriesJson?.[1]) ? seriesJson[1].filter((s) => s.value !== null) : [],
          portals: [
            { name: 'Banco Mundial Open Data', url: `https://data.worldbank.org/search?q=${encodeURIComponent(query)}` },
            { name: 'INDEC Argentina', url: 'https://www.indec.gob.ar/' },
            { name: 'UNESCO Institute for Statistics', url: 'https://uis.unesco.org/' },
            { name: 'CEPALSTAT', url: 'https://statistics.cepal.org/' },
          ],
        });
        return;
      }

      if (category === 'jurisprudencia' || category === 'legislacion') {
        const legalFilter = category === 'jurisprudencia' ? `${query} jurisprudence OR court OR sentencia` : `${query} legislation OR statute OR ley`;
        const scholarship = await queryOpenAlexWorks(legalFilter, '', 8).catch(() => []);
        res.json({
          category,
          results: scholarship,
          portals:
            category === 'jurisprudencia'
              ? [
                  { name: 'SAIJ (Sistema Argentino de Información Jurídica)', url: `https://www.saij.gob.ar/buscador/jurisprudencia?q=${encodeURIComponent(query)}` },
                  { name: 'Corte Suprema (CSJN Argentina)', url: `https://sjconsulta.csjn.gov.ar/sjconsulta/` },
                  { name: 'CourtListener (EE. UU. Jurisprudencia abierta)', url: `https://www.courtlistener.com/?q=${encodeURIComponent(query)}` },
                  { name: 'EUR-Lex Case Law', url: `https://eur-lex.europa.eu/search.html?text=${encodeURIComponent(query)}` },
                ]
              : [
                  { name: 'InfoLEG (Legislación Argentina Oficial)', url: `https://www.argentina.gob.ar/normativa/buscar?texto=${encodeURIComponent(query)}` },
                  { name: 'Boletín Oficial de la República Argentina', url: 'https://www.boletinoficial.gob.ar/' },
                  { name: 'EUR-Lex Legislación Europea', url: `https://eur-lex.europa.eu/search.html?text=${encodeURIComponent(query)}` },
                  { name: 'N-Lex / Biblioteca del Congreso', url: `https://www.bcn.cl/leychile/` },
                ],
        });
        return;
      }

      // Default: 'articulos'
      const [oa, cr, s2] = await Promise.allSettled([
        queryOpenAlexWorks(query, '', 6),
        queryCrossref(query, 6),
        querySemanticScholar(query, 6),
      ]);
      const combined: NormalizedAcademicHit[] = [];
      if (oa.status === 'fulfilled') combined.push(...oa.value);
      if (cr.status === 'fulfilled') combined.push(...cr.value);
      if (s2.status === 'fulfilled') combined.push(...s2.value);
      res.json({ category: 'articulos', results: combined });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Error consultando fuentes de investigación.',
      });
    }
  });

  // -------------------------------------------------------------------------
  // 4. FABRO TOOLS — Real Open Currency Exchange Rates (Frankfurter ECB)
  // -------------------------------------------------------------------------
  router.get('/tools/fx-rates', async (req, res) => {
    const base = String(req.query.base || 'USD').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'USD';
    try {
      const resp = await fetch(`https://api.frankfurter.app/latest?from=${base}`, {
        signal: AbortSignal.timeout(7000),
      });
      if (!resp.ok) throw new Error(`Frankfurter HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        amount: number;
        base: string;
        date: string;
        rates: Record<string, number>;
      };
      res.json({
        ok: true,
        source: 'Frankfurter / Banco Central Europeo',
        base: data.base,
        date: data.date,
        rates: { [data.base]: 1, ...data.rates },
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'No se pudieron obtener cotizaciones en tiempo real.',
      });
    }
  });

  return router;
}
