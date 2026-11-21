import { Router } from 'express';

export interface AcademicResearchSource {
  id: string;
  title: string;
  authors: string[];
  year: string;
  sourceName: 'OpenAlex' | 'Crossref' | 'Wikipedia ES';
  institution?: string;
  doi?: string;
  url: string;
  excerpt: string;
  kind: 'paper' | 'enciclopedia' | 'libro';
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const TTL_MS = 10 * 60 * 1000;
const researchCache = new Map<string, CacheEntry<{ sources: AcademicResearchSource[]; providers: Record<string, 'ok' | 'error'> }>>();
const dictCache = new Map<string, CacheEntry<unknown>>();

const FETCH_HEADERS = {
  'User-Agent': 'FABRO-Estudio/2.0 (Educational Research Client; mailto:contacto@fabro.app)',
  Accept: 'application/json',
};

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...FETCH_HEADERS,
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function reconstructOpenAlexAbstract(inverted?: Record<string, number[]> | null): string {
  if (!inverted || typeof inverted !== 'object') return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (pos >= 0 && pos < 180) {
        words[pos] = word;
      }
    }
  }
  return words.filter(Boolean).join(' ').slice(0, 420);
}

function stripHtmlTags(raw: string): string {
  return (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function queryOpenAlex(q: string): Promise<AcademicResearchSource[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=5&sort=relevance_score:desc`;
  const data = await fetchJsonWithTimeout<{
    results?: Array<{
      id?: string;
      display_name?: string;
      publication_year?: number;
      doi?: string;
      primary_location?: { landing_page_url?: string; source?: { display_name?: string } };
      authorships?: Array<{
        author?: { display_name?: string };
        institutions?: Array<{ display_name?: string }>;
      }>;
      abstract_inverted_index?: Record<string, number[]> | null;
    }>;
  }>(url, 8500);

  return (data.results || [])
    .filter((item) => item.display_name)
    .map((item, idx) => {
      const authors = (item.authorships || [])
        .map((a) => a.author?.display_name)
        .filter((n): n is string => Boolean(n))
        .slice(0, 4);
      const institution =
        item.authorships?.[0]?.institutions?.[0]?.display_name ||
        item.primary_location?.source?.display_name ||
        undefined;
      const cleanDoi = item.doi ? item.doi.replace(/^https?:\/\/doi\.org\//i, '') : undefined;
      const link =
        item.primary_location?.landing_page_url ||
        (cleanDoi ? `https://doi.org/${cleanDoi}` : item.id || '');
      const excerpt = reconstructOpenAlexAbstract(item.abstract_inverted_index);

      return {
        id: `oa-${idx}-${cleanDoi || item.id || idx}`,
        title: String(item.display_name),
        authors,
        year: item.publication_year ? String(item.publication_year) : 's. f.',
        sourceName: 'OpenAlex' as const,
        institution,
        doi: cleanDoi,
        url: link,
        excerpt: excerpt || 'Artículo indexado en OpenAlex. Consultá el enlace oficial para el texto completo.',
        kind: 'paper' as const,
      };
    })
    .filter((s) => /^https?:\/\//i.test(s.url));
}

async function queryCrossref(q: string): Promise<AcademicResearchSource[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=4`;
  const data = await fetchJsonWithTimeout<{
    message?: {
      items?: Array<{
        DOI?: string;
        URL?: string;
        title?: string[];
        author?: Array<{ given?: string; family?: string }>;
        publisher?: string;
        abstract?: string;
        published?: { 'date-parts'?: number[][] };
        issued?: { 'date-parts'?: number[][] };
        type?: string;
      }>;
    };
  }>(url, 8500);

  return (data.message?.items || [])
    .filter((item) => Array.isArray(item.title) && item.title[0])
    .map((item, idx) => {
      const authors = (item.author || [])
        .map((a) => [a.given, a.family].filter(Boolean).join(' ').trim())
        .filter(Boolean)
        .slice(0, 4);
      const yearNum =
        item.published?.['date-parts']?.[0]?.[0] || item.issued?.['date-parts']?.[0]?.[0];
      const doi = item.DOI;
      const link = item.URL || (doi ? `https://doi.org/${doi}` : '');
      const excerpt = item.abstract
        ? stripHtmlTags(item.abstract).slice(0, 420)
        : `Publicación registrada en Crossref${item.publisher ? ` (${item.publisher})` : ''}.`;

      return {
        id: `cr-${idx}-${doi || idx}`,
        title: stripHtmlTags(item.title![0]),
        authors,
        year: yearNum ? String(yearNum) : 's. f.',
        sourceName: 'Crossref' as const,
        institution: item.publisher,
        doi,
        url: link,
        excerpt,
        kind: (item.type?.includes('book') ? 'libro' : 'paper') as 'libro' | 'paper',
      };
    })
    .filter((s) => /^https?:\/\//i.test(s.url));
}

async function queryWikipediaEs(q: string): Promise<AcademicResearchSource[]> {
  const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    q
  )}&srlimit=3&utf8=1&format=json`;
  const searchData = await fetchJsonWithTimeout<{
    query?: { search?: Array<{ pageid: number; title: string; snippet: string }> };
  }>(searchUrl, 7000);

  const hits = searchData.query?.search || [];
  if (hits.length === 0) return [];

  const pageIds = hits.map((h) => h.pageid).join('|');
  const extractUrl = `https://es.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exchars=420&pageids=${pageIds}&format=json`;
  const extractData = await fetchJsonWithTimeout<{
    query?: {
      pages?: Record<
        string,
        { pageid: number; title: string; extract?: string; fullurl?: string }
      >;
    };
  }>(extractUrl, 7000);

  const pages = extractData.query?.pages || {};
  return hits
    .map((h) => {
      const p = pages[String(h.pageid)];
      const url = p?.fullurl || `https://es.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/\s+/g, '_'))}`;
      return {
        id: `wiki-${h.pageid}`,
        title: p?.title || h.title,
        authors: ['Wikipedia en español (colaboradores)'],
        year: String(new Date().getFullYear()),
        sourceName: 'Wikipedia ES' as const,
        institution: 'Fundación Wikimedia',
        url,
        excerpt: (p?.extract || stripHtmlTags(h.snippet) || '').trim().slice(0, 420),
        kind: 'enciclopedia' as const,
      };
    })
    .filter((s) => Boolean(s.title));
}

export function createStudyResearchRouter(): Router {
  const router = Router();

  // 1. Free real academic web research (OpenAlex + Crossref + Wikipedia ES)
  router.get('/research', async (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (rawQ.length < 2 || rawQ.length > 220) {
      res.status(400).json({ ok: false, error: 'Ingresá un tema de búsqueda válido (2 a 220 caracteres).' });
      return;
    }

    const cacheKey = rawQ.toLowerCase();
    const cached = researchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ ok: true, query: rawQ, cached: true, ...cached.data });
      return;
    }

    const [oaRes, crRes, wikiRes] = await Promise.allSettled([
      queryOpenAlex(rawQ),
      queryCrossref(rawQ),
      queryWikipediaEs(rawQ),
    ]);

    const providers: Record<string, 'ok' | 'error'> = {
      OpenAlex: oaRes.status === 'fulfilled' ? 'ok' : 'error',
      Crossref: crRes.status === 'fulfilled' ? 'ok' : 'error',
      'Wikipedia ES': wikiRes.status === 'fulfilled' ? 'ok' : 'error',
    };

    const combined: AcademicResearchSource[] = [
      ...(oaRes.status === 'fulfilled' ? oaRes.value : []),
      ...(crRes.status === 'fulfilled' ? crRes.value : []),
      ...(wikiRes.status === 'fulfilled' ? wikiRes.value : []),
    ];

    // Deduplicate by normalized title or DOI
    const seen = new Set<string>();
    const sources = combined.filter((item) => {
      const key = (item.doi || item.title).toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const payload = { sources, providers };
    if (sources.length > 0) {
      researchCache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data: payload });
    }

    res.json({
      ok: true,
      query: rawQ,
      cached: false,
      fetchedAt: new Date().toISOString(),
      ...payload,
    });
  });

  // 2. Free Academic & Lexical Dictionary lookup (Wikipedia ES + Wiktionary ES + DictionaryAPI)
  router.get('/dictionary', async (req, res) => {
    const rawWord = typeof req.query.word === 'string' ? req.query.word.trim() : '';
    if (rawWord.length < 1 || rawWord.length > 120) {
      res.status(400).json({ ok: false, error: 'Ingresá un término válido para consultar.' });
      return;
    }

    const cacheKey = rawWord.toLowerCase();
    const cached = dictCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    const [wikiRes, wiktRes] = await Promise.allSettled([
      fetchJsonWithTimeout<{
        title?: string;
        description?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      }>(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(rawWord)}`, 6500),
      fetchJsonWithTimeout<{
        query?: {
          pages?: Record<string, { title?: string; extract?: string; fullurl?: string }>;
        };
      }>(
        `https://es.wiktionary.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&exchars=750&titles=${encodeURIComponent(
          rawWord.toLowerCase()
        )}&format=json`,
        6500
      ),
    ]);

    let definition = '';
    let summary = '';
    let sourceLabel = '';
    let sourceUrl = '';

    if (wiktRes.status === 'fulfilled') {
      const pages = Object.values(wiktRes.value.query?.pages || {});
      const valid = pages.find((p) => p.extract && p.extract.trim().length > 20);
      if (valid && valid.extract) {
        definition = valid.extract.trim().slice(0, 750);
        sourceLabel = 'Wikcionario en español';
        sourceUrl = valid.fullurl || `https://es.wiktionary.org/wiki/${encodeURIComponent(rawWord.toLowerCase())}`;
      }
    }

    if (wikiRes.status === 'fulfilled' && wikiRes.value.extract) {
      summary = wikiRes.value.extract.trim();
      if (!sourceUrl) {
        sourceLabel = 'Wikipedia en español';
        sourceUrl =
          wikiRes.value.content_urls?.desktop?.page ||
          `https://es.wikipedia.org/wiki/${encodeURIComponent(rawWord)}`;
      }
    }

    if (!definition && !summary) {
      // Fallback to search on Wikipedia ES to find close academic term
      try {
        const hits = await queryWikipediaEs(rawWord);
        if (hits.length > 0) {
          summary = hits[0].excerpt;
          sourceLabel = `Wikipedia ES (${hits[0].title})`;
          sourceUrl = hits[0].url;
        }
      } catch {
        // handled below
      }
    }

    const result = {
      ok: Boolean(definition || summary),
      term: rawWord,
      definition: definition || summary || '',
      academicContext: summary && definition ? summary : '',
      sourceLabel: sourceLabel || 'Sin coincidencia directa',
      sourceUrl,
      error: !definition && !summary ? 'No se encontró una definición verificada en fuentes públicas para este término.' : undefined,
    };

    if (result.ok) {
      dictCache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data: result });
    }
    res.json(result);
  });

  // 3. Free Translator proxy (MyMemory public endpoint, $0 cost, transparent errors)
  router.post('/translate', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const from = typeof req.body?.from === 'string' ? req.body.from.trim() : 'es';
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : 'en';

    if (!text || text.length > 3500) {
      res.status(400).json({ ok: false, error: 'Ingresá un texto de hasta 3.500 caracteres para traducir.' });
      return;
    }
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(from) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(to)) {
      res.status(400).json({ ok: false, error: 'Código de idioma no válido.' });
      return;
    }
    if (from === to) {
      res.json({ ok: true, translatedText: text, provider: 'Sin cambios (mismo idioma)' });
      return;
    }

    try {
      // Split into chunks <= 450 chars because MyMemory free GET endpoint enforces 500 bytes per query
      const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
      const chunks: string[] = [];
      let buf = '';
      for (const s of sentences) {
        if ((buf + s).length > 420 && buf.trim()) {
          chunks.push(buf.trim());
          buf = s;
        } else {
          buf += s;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());

      const translatedParts: string[] = [];
      for (const chunk of chunks.slice(0, 8)) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          chunk
        )}&langpair=${encodeURIComponent(`${from}|${to}`)}`;
        const data = await fetchJsonWithTimeout<{
          responseStatus?: number;
          responseData?: { translatedText?: string };
          responseDetails?: string;
        }>(url, 8000);
        if (data.responseStatus && data.responseStatus !== 200) {
          throw new Error(data.responseDetails || `Estado ${data.responseStatus}`);
        }
        translatedParts.push(data.responseData?.translatedText || chunk);
      }

      res.json({
        ok: true,
        translatedText: translatedParts.join(' '),
        provider: 'MyMemory API (gratuito)',
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error:
          'El servicio gratuito de traducción externa no está disponible en este momento o superó el límite público temporal.',
        detail: err instanceof Error ? err.message : 'Error de red',
      });
    }
  });

  // 4. Free Spanish Spell & Grammar Checker (LanguageTool public API, $0 cost)
  router.post('/spellcheck', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const language = typeof req.body?.language === 'string' ? req.body.language.trim() : 'es';

    if (!text || text.length > 8000) {
      res.status(400).json({ ok: false, error: 'Ingresá un texto de hasta 8.000 caracteres para revisar.' });
      return;
    }

    try {
      const formBody = new URLSearchParams();
      formBody.set('text', text);
      formBody.set('language', /^[a-z]{2}(-[A-Z]{2})?$/.test(language) ? language : 'es');

      const data = await fetchJsonWithTimeout<{
        matches?: Array<{
          message: string;
          shortMessage?: string;
          offset: number;
          length: number;
          replacements?: Array<{ value: string }>;
          rule?: { id?: string; description?: string; issueType?: string; category?: { name?: string } };
        }>;
      }>('https://api.languagetool.org/v2/check', 9000, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formBody.toString(),
      });

      const matches = (data.matches || []).map((m, idx) => ({
        id: `lt-${idx}-${m.offset}`,
        message: m.message,
        shortMessage: m.shortMessage || m.rule?.category?.name || 'Sugerencia',
        offset: m.offset,
        length: m.length,
        excerpt: text.slice(m.offset, m.offset + m.length),
        replacements: (m.replacements || []).slice(0, 5).map((r) => r.value),
        category: m.rule?.category?.name || 'Gramática y ortografía',
      }));

      res.json({
        ok: true,
        provider: 'LanguageTool API (gratuito)',
        matches,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error:
          'No se pudo conectar con el servicio gratuito de corrección ortográfica (LanguageTool). Verificá tu conexión o intentá más tarde.',
        detail: err instanceof Error ? err.message : 'Error de red',
      });
    }
  });

  return router;
}
