import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentResponse } from '@google/genai';

export const MODEL_NAME = 'gemini-4-hydrogen';
export const LITE_MODEL_NAME = 'gemini-3.1-flash-lite';

export type FabroWorkMode =
  | 'DESARROLLO'
  | 'RESUMEN'
  | 'EXPLICAR'
  | 'INVESTIGAR'
  | 'COMPARAR'
  | 'EXAMEN'
  | 'BIBLIOGRAFIA'
  | 'PROGRAMA'
  | 'GLOSARIO'
  | 'REPASO';

export interface DocumentInput {
  id?: string;
  title?: string;
  content?: string;
  coverage?: {
    totalPages?: number;
    processedPages?: number;
    pendingPages?: number;
    readStatus?: string;
    extractionErrors?: string[];
    conceptIndex?: string[];
    authorsDetected?: string[];
  };
}

export interface StudentNoteInput {
  title?: string;
  unit?: string;
  content?: string;
}

export interface AcademicMemoryInput {
  developedTopics?: string[];
  priorSummaries?: string[];
  examQuestionsHistory?: string[];
  verifiedBibliography?: string[];
  authorsAndTheories?: string[];
  studentProgressNotes?: string;
}

export interface DiscoveredSource {
  title: string;
  url: string;
  domain: string;
  originType: string;
  authors?: string;
  year?: string;
  snippet?: string;
  readInFull?: boolean;
  consultedAt: string;
}

export interface Motor1Result {
  docsSelectedCount: number;
  docsProcessedCount: number;
  partialDocsNames: string[];
  fragmentsAnalyzed: number;
  coverageSummary: string;
  rawSummaryMarkdown: string;
  authorsIdentified: string[];
  conceptsDetected: string[];
  gapsNoted: string[];
}

export interface Motor2Result {
  sources: DiscoveredSource[];
  searchQueries: string[];
  urlContextReadCount: number;
  externalDigestMarkdown: string;
  unverifiedNotes: string[];
}

export interface FabroAnalysisMetadata {
  workMode: FabroWorkMode;
  topicTitle: string;
  depthLevel: string;
  docsProcessedCount: number;
  docsSelectedCount: number;
  partialDocsNames: string[];
  externalSourcesCount: number;
  urlContextReadCount: number;
  generatedSections: string[];
  epistemicCategoriesUsed: string[];
  qualityAuditPassed: boolean;
  missingInfoNotes: string;
  verifiedReferencesCount: number;
}

export interface MemoryUpdateSuggestion {
  developedTopic?: string;
  summarySnippet?: string;
  authorsAndTheories: string[];
  verifiedBibliography: string[];
  examQuestions: string[];
}

const VALID_WORK_MODES = new Set<FabroWorkMode>([
  'DESARROLLO',
  'RESUMEN',
  'EXPLICAR',
  'INVESTIGAR',
  'COMPARAR',
  'EXAMEN',
  'BIBLIOGRAFIA',
  'PROGRAMA',
  'GLOSARIO',
  'REPASO',
]);

const LOW_QUALITY_DOMAIN_PATTERNS = [
  'rincondelvago.com',
  'monografias.com',
  'buenastareas.com',
  'slideshare.net',
  'scribd.com',
  'brainly.',
  'studocu.com',
  'yahoo.com',
  'quora.com',
  'pinterest.',
  'facebook.com',
  'tiktok.com',
  'instagram.com',
];

const ACADEMIC_DOMAIN_BOOST_PATTERNS = [
  '.edu',
  '.gob.',
  '.gov',
  'scielo',
  'redalyc',
  'dialnet',
  'conicet',
  'unam.mx',
  'uba.ar',
  'unlp.edu.ar',
  'unc.edu.ar',
  'uca.edu.ar',
  'flacso',
  'clacso',
  'cepal',
  'unesco',
  'who.int',
  'ops',
  'openalex',
  'doi.org',
  'arxiv.org',
  'pubmed',
  'ncbi.nlm.nih.gov',
  'infoleg',
  'boe.es',
  'csjn.gov.ar',
  'scholar.google',
  'jstor.org',
  'springer.com',
  'sciencedirect.com',
  'cambridge.org',
  'oxford',
  'rae.es',
];

export function parseWorkModeAndQuery(
  rawMessage: string,
  explicitMode?: string
): { workMode: FabroWorkMode; cleanQuery: string } {
  const trimmed = String(rawMessage || '').trim();
  const slashMatch = trimmed.match(/^\/([a-záéíóúñ]+)\b(?:\s+([\s\S]*))?$/i);
  if (slashMatch) {
    const candidate = slashMatch[1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase() as FabroWorkMode;
    if (VALID_WORK_MODES.has(candidate)) {
      const rest = (slashMatch[2] || '').trim();
      return {
        workMode: candidate,
        cleanQuery: rest || `Ejecutá el modo /${candidate} sobre el tema y materiales activos de la materia.`,
      };
    }
  }

  const normalizedExplicit = String(explicitMode || '')
    .trim()
    .toUpperCase() as FabroWorkMode;
  if (VALID_WORK_MODES.has(normalizedExplicit)) {
    return {
      workMode: normalizedExplicit,
      cleanQuery: trimmed || `Ejecutá el modo /${normalizedExplicit} sobre la materia activa.`,
    };
  }

  return {
    workMode: 'DESARROLLO',
    cleanQuery: trimmed,
  };
}

function classifySourceOrigin(url: string, fallbackOrigin: string): {
  domain: string;
  originType: string;
  priorityScore: number;
} {
  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    domain = url.toLowerCase();
  }

  if (LOW_QUALITY_DOMAIN_PATTERNS.some((p) => domain.includes(p))) {
    return { domain, originType: 'Sitio abierto no académico (baja prioridad)', priorityScore: 1 };
  }
  if (domain.includes('.edu') || domain.includes('.ac.') || domain.includes('uba.ar') || domain.includes('unlp')) {
    return { domain, originType: 'Universidad / Repositorio universitario', priorityScore: 10 };
  }
  if (
    domain.includes('scielo') ||
    domain.includes('redalyc') ||
    domain.includes('dialnet') ||
    domain.includes('doi.org') ||
    domain.includes('openalex') ||
    domain.includes('arxiv') ||
    domain.includes('ncbi') ||
    domain.includes('jstor') ||
    domain.includes('springer') ||
    domain.includes('sciencedirect')
  ) {
    return { domain, originType: 'Revista científica / Paper indexado', priorityScore: 9 };
  }
  if (domain.includes('.gov') || domain.includes('.gob') || domain.includes('infoleg') || domain.includes('unesco') || domain.includes('cepal') || domain.includes('conicet')) {
    return { domain, originType: 'Organismo oficial / Legislación / Jurisprudencia', priorityScore: 9 };
  }
  if (ACADEMIC_DOMAIN_BOOST_PATTERNS.some((p) => domain.includes(p))) {
    return { domain, originType: 'Bibliografía / Repositorio académico', priorityScore: 8 };
  }
  return { domain, originType: fallbackOrigin || 'Fuente web verificada', priorityScore: 5 };
}

function extractInlineUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]"']+/gi) || [];
  return Array.from(new Set(matches)).slice(0, 6);
}

function chunkDocumentText(title: string, content: string, chunkSize = 18000): string[] {
  const clean = String(content || '').trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < clean.length && chunks.length < 8) {
    let end = Math.min(clean.length, cursor + chunkSize);
    if (end < clean.length) {
      const breakIdx = clean.lastIndexOf('\n', end);
      if (breakIdx > cursor + chunkSize * 0.65) {
        end = breakIdx;
      }
    }
    const slice = clean.slice(cursor, end).trim();
    if (slice) {
      chunks.push(
        `[Fragmento ${chunks.length + 1} de "${title}" (caracteres ${cursor + 1}–${end} de ${clean.length})]\n${slice}`
      );
    }
    cursor = end;
  }
  return chunks;
}

// ------------------------------------------------------------------
// MOTOR 1 — ANÁLISIS DOCUMENTAL (Cobertura real + Autores + Conceptos)
// ------------------------------------------------------------------
export async function runMotor1DocumentAnalysis(params: {
  ai: GoogleGenAI | null;
  query: string;
  documents: DocumentInput[];
  notes: StudentNoteInput[];
  subjectContext: string;
  attachmentBase64?: string;
  attachmentMimeType?: string;
}): Promise<Motor1Result> {
  const docs = Array.isArray(params.documents) ? params.documents.slice(0, 10) : [];
  const notes = Array.isArray(params.notes) ? params.notes.slice(0, 6) : [];
  const hasAttachment = Boolean(params.attachmentBase64 && params.attachmentMimeType);

  const partialDocsNames: string[] = [];
  let totalFragments = 0;
  const fragmentBlocks: string[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const title = String(doc.title || `Documento ${i + 1}`).trim();
    const content = String(doc.content || '').trim();
    const cov = doc.coverage;

    if (cov) {
      if (
        (typeof cov.pendingPages === 'number' && cov.pendingPages > 0) ||
        cov.readStatus === 'parcial' ||
        cov.readStatus === 'pendiente' ||
        cov.readStatus === 'error'
      ) {
        partialDocsNames.push(
          `${title} (${cov.processedPages ?? 0}/${cov.totalPages ?? '?'} págs. procesadas, ${cov.pendingPages ?? '?'} pendientes)`
        );
      }
    }

    const chunks = chunkDocumentText(title, content, 18000);
    totalFragments += Math.max(1, chunks.length);
    const metaLine = cov
      ? `Cobertura registrada: ${cov.processedPages ?? 0}/${cov.totalPages ?? '?'} páginas (estado: ${cov.readStatus || 'desconocido'}).${
          cov.authorsDetected?.length ? ` Autores detectados: ${cov.authorsDetected.join(', ')}.` : ''
        }${cov.conceptIndex?.length ? ` Índice de conceptos: ${cov.conceptIndex.slice(0, 18).join(', ')}.` : ''}`
      : 'Documento textual sin metadatos de páginas paginados.';

    fragmentBlocks.push(
      `=== DOCUMENTO ${i + 1}: "${title}" ===\n${metaLine}\n${chunks.join('\n\n') || '[Sin texto extraído]'}`
    );
  }

  const notesBlocks = notes.map(
    (n, idx) =>
      `=== APUNTE DEL ESTUDIANTE ${idx + 1}: "${String(n.title || 'Sin título')}"${
        n.unit ? ` (Unidad: ${n.unit})` : ''
      } ===\n${String(n.content || '').slice(0, 14000)}`
  );

  const docsSelectedCount = docs.length;
  const processedDocsCount = docs.filter((d) => String(d.content || '').trim().length > 20).length + (hasAttachment ? 1 : 0);

  if (docs.length === 0 && notes.length === 0 && !hasAttachment) {
    return {
      docsSelectedCount: 0,
      docsProcessedCount: 0,
      partialDocsNames: [],
      fragmentsAnalyzed: 0,
      coverageSummary: 'No se seleccionaron archivos propios ni apuntes para Motor 1.',
      rawSummaryMarkdown: 'El estudiante no adjuntó archivos propios ni apuntes específicos en esta consulta.',
      authorsIdentified: [],
      conceptsDetected: [],
      gapsNoted: ['Sin documentos propios adjuntos en esta consulta.'],
    };
  }

  const coverageSummary =
    partialDocsNames.length > 0
      ? `Lectura parcial detectada en: ${partialDocsNames.join('; ')}. No se afirma lectura integral donde existen páginas pendientes.`
      : `${processedDocsCount}/${docsSelectedCount + (hasAttachment ? 1 : 0)} documento(s) propios procesados (${totalFragments} fragmento(s)).`;

  if (!params.ai) {
    return {
      docsSelectedCount,
      docsProcessedCount: processedDocsCount,
      partialDocsNames,
      fragmentsAnalyzed: totalFragments,
      coverageSummary,
      rawSummaryMarkdown: [...fragmentBlocks, ...notesBlocks].join('\n\n').slice(0, 40000),
      authorsIdentified: [],
      conceptsDetected: [],
      gapsNoted: partialDocsNames,
    };
  }

  try {
    const parts: Array<Record<string, unknown>> = [];
    if (hasAttachment) {
      parts.push({
        inlineData: {
          mimeType: params.attachmentMimeType,
          data: params.attachmentBase64,
        },
      });
    }

    parts.push({
      text: `Sos el MOTOR 1 (Análisis Documental Estricto) de FABRO IA 2.0.
Analizá únicamente el material provisto por el estudiante (sin mezclar conocimiento externo de Internet).

Consulta del estudiante: "${params.query}"
Contexto de materia: ${params.subjectContext || 'No especificado'}

MATERIAL DEL ESTUDIANTE:
${fragmentBlocks.join('\n\n').slice(0, 95000)}

${notesBlocks.length > 0 ? `APUNTES PROPIOS:\n${notesBlocks.join('\n\n').slice(0, 35000)}` : ''}

Extraé con precisión textual (conservando referencias de página o capítulo cuando aparezcan y nunca inventando páginas ni autores):
1. Autores y obras citadas explícitamente en los documentos.
2. Conceptos, definiciones textuales y argumentos principales por documento/apunte.
3. Teorías, capítulos, ejemplos y bibliografía interna del archivo.
4. Vacíos de información o páginas faltantes detectadas.`,
    });

    const resp = await params.ai.models.generateContent({
      model: LITE_MODEL_NAME,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            authorsIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
            conceptsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
            gapsNoted: { type: Type.ARRAY, items: { type: Type.STRING } },
            documentalSynthesis: {
              type: Type.STRING,
              description: 'Síntesis fiel y estructurada de lo que dicen expresamente los archivos/apuntes, citando archivo y página/sección cuando exista.',
            },
          },
          required: ['authorsIdentified', 'conceptsDetected', 'gapsNoted', 'documentalSynthesis'],
        },
      },
    });

    const parsed = JSON.parse((resp.text ?? '{}').trim()) as {
      authorsIdentified?: string[];
      conceptsDetected?: string[];
      gapsNoted?: string[];
      documentalSynthesis?: string;
    };

    return {
      docsSelectedCount,
      docsProcessedCount: processedDocsCount,
      partialDocsNames,
      fragmentsAnalyzed: totalFragments,
      coverageSummary,
      rawSummaryMarkdown:
        parsed.documentalSynthesis || [...fragmentBlocks, ...notesBlocks].join('\n\n').slice(0, 30000),
      authorsIdentified: Array.isArray(parsed.authorsIdentified) ? parsed.authorsIdentified.slice(0, 25) : [],
      conceptsDetected: Array.isArray(parsed.conceptsDetected) ? parsed.conceptsDetected.slice(0, 30) : [],
      gapsNoted: Array.isArray(parsed.gapsNoted) ? parsed.gapsNoted.slice(0, 15) : [],
    };
  } catch {
    return {
      docsSelectedCount,
      docsProcessedCount: processedDocsCount,
      partialDocsNames,
      fragmentsAnalyzed: totalFragments,
      coverageSummary,
      rawSummaryMarkdown: [...fragmentBlocks, ...notesBlocks].join('\n\n').slice(0, 38000),
      authorsIdentified: [],
      conceptsDetected: [],
      gapsNoted: partialDocsNames,
    };
  }
}

// ------------------------------------------------------------------
// Academic Keyword Extractor + Open Academic APIs (DOAJ, CrossRef, OpenAlex, arXiv)
// ------------------------------------------------------------------
const SPANISH_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
  'sin', 'sobre', 'entre', 'hacia', 'desde', 'hasta', 'que', 'cual', 'cuales', 'como', 'cuando', 'donde',
  'y', 'e', 'o', 'u', 'pero', 'sino', 'aunque', 'si', 'no', 'ni', 'mas', 'muy', 'todo', 'toda', 'todos',
  'analiza', 'analizar', 'integra', 'integrar', 'explica', 'explicar', 'desarrolla', 'desarrollar',
  'resume', 'resumir', 'compara', 'comparar', 'investiga', 'investigar', 'decime', 'dame', 'hace', 'hacer',
  'enfoques', 'tema', 'temas', 'materia', 'unidad', 'texto', 'documento', 'documentos', 'fuente', 'fuentes',
  'segun', 'según', 'analizá', 'integrá', 'explicá', 'desarrollá', 'resumí', 'compará', 'investigá',
]);

function buildAcademicSearchQuery(rawQuery: string, subjectHint: string, authorHints: string[]): string {
  const combined = `${rawQuery} ${subjectHint}`.trim();
  const tokens = combined
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !SPANISH_STOPWORDS.has(t.toLowerCase()));

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(t);
    }
    if (unique.length >= 7) break;
  }

  for (const auth of authorHints.slice(0, 2)) {
    const surname = auth.trim().split(/\s+/).pop() || '';
    if (surname.length >= 3 && !seen.has(surname.toLowerCase())) {
      seen.add(surname.toLowerCase());
      unique.push(surname);
    }
  }

  return unique.join(' ').trim() || rawQuery.slice(0, 80);
}

async function fetchOpenAcademicAPIs(academicQuery: string): Promise<DiscoveredSource[]> {
  const consultedAt = new Date().toISOString().slice(0, 10);
  const headers = {
    'User-Agent': 'FABRO-IA-2/2.0 (mailto:soporte@fabro.edu.ar)',
    Accept: 'application/json',
  };

  // 1. DOAJ — Directory of Open Access Journals (direct peer-reviewed full-text links)
  const doajTask = fetch(
    `https://doaj.org/api/search/articles/${encodeURIComponent(academicQuery)}?pageSize=4`,
    { headers, signal: AbortSignal.timeout(7000) }
  )
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .then((data: {
      results?: Array<{
        bibjson?: {
          title?: string;
          year?: string;
          journal?: { title?: string };
          author?: Array<{ name?: string }>;
          link?: Array<{ url?: string; type?: string }>;
          abstract?: string;
        };
      }>;
    }) =>
      (data.results || [])
        .map((item): DiscoveredSource | null => {
          const bib = item.bibjson;
          const url = bib?.link?.find((l) => l.type === 'fulltext' && l.url)?.url || bib?.link?.[0]?.url;
          if (!bib?.title || !url || !/^https?:\/\//i.test(url)) return null;
          const cls = classifySourceOrigin(url, 'DOAJ (Revista científica open access)');
          const authors = (bib.author || [])
            .slice(0, 3)
            .map((a) => a.name)
            .filter(Boolean)
            .join(', ');
          return {
            title: String(bib.title).trim().slice(0, 200),
            url,
            domain: cls.domain,
            originType: cls.originType === 'Fuente web verificada' ? 'DOAJ (Revista científica revisada por pares)' : cls.originType,
            authors: authors || undefined,
            year: bib.year ? String(bib.year) : undefined,
            snippet: bib.journal?.title
              ? `Publicado en ${bib.journal.title}${bib.abstract ? ` — ${bib.abstract.slice(0, 180)}...` : ''}`
              : bib.abstract?.slice(0, 200),
            readInFull: false,
            consultedAt,
          };
        })
        .filter((x): x is DiscoveredSource => Boolean(x))
    )
    .catch(() => [] as DiscoveredSource[]);

  // 2. CrossRef — Indexed scholarly works & DOIs
  const crossRefTask = fetch(
    `https://api.crossref.org/works?query=${encodeURIComponent(academicQuery)}&rows=4&select=DOI,title,author,published,container-title,URL`,
    { headers, signal: AbortSignal.timeout(8500) }
  )
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: {
      message?: {
        items?: Array<{
          DOI?: string;
          URL?: string;
          title?: string[];
          'container-title'?: string[];
          author?: Array<{ given?: string; family?: string }>;
          published?: { 'date-parts'?: number[][] };
        }>;
      };
    }) =>
      (data?.message?.items || [])
        .map((item): DiscoveredSource | null => {
          const title = item.title?.[0];
          const url = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : '');
          if (!title || !url || !/^https?:\/\//i.test(url)) return null;
          const cls = classifySourceOrigin(url, 'CrossRef DOI');
          const authors = (item.author || [])
            .slice(0, 3)
            .map((a) => [a.given, a.family].filter(Boolean).join(' '))
            .filter(Boolean)
            .join(', ');
          const year = item.published?.['date-parts']?.[0]?.[0];
          return {
            title: String(title).replace(/<[^>]+>/g, '').trim().slice(0, 200),
            url,
            domain: cls.domain,
            originType: cls.originType,
            authors: authors || undefined,
            year: year ? String(year) : undefined,
            snippet: item['container-title']?.[0] ? `Fuente: ${item['container-title'][0]}` : 'Referencia DOI verificada',
            readInFull: false,
            consultedAt,
          };
        })
        .filter((x): x is DiscoveredSource => Boolean(x))
    )
    .catch(() => [] as DiscoveredSource[]);

  // 3. OpenAlex — Best-effort scholarly index
  const openAlexTask = fetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(academicQuery)}&per-page=3&select=id,doi,title,publication_year,authorships,primary_location,open_access`,
    { headers, signal: AbortSignal.timeout(5000) }
  )
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .then((data: {
      results?: Array<{
        id?: string;
        doi?: string;
        title?: string;
        publication_year?: number;
        authorships?: Array<{ author?: { display_name?: string } }>;
        primary_location?: { landing_page_url?: string; pdf_url?: string; source?: { display_name?: string } };
        open_access?: { oa_url?: string };
      }>;
    }) =>
      (data.results || [])
        .map((w): DiscoveredSource | null => {
          const url = w.open_access?.oa_url || w.primary_location?.landing_page_url || w.doi || w.id;
          if (!url || !/^https?:\/\//i.test(url) || !w.title) return null;
          const cls = classifySourceOrigin(url, 'OpenAlex (Paper académico)');
          const authors = (w.authorships || [])
            .slice(0, 3)
            .map((a) => a.author?.display_name)
            .filter(Boolean)
            .join(', ');
          return {
            title: String(w.title).trim().slice(0, 200),
            url,
            domain: cls.domain,
            originType: cls.originType,
            authors: authors || undefined,
            year: w.publication_year ? String(w.publication_year) : undefined,
            snippet: w.primary_location?.source?.display_name
              ? `Publicado en ${w.primary_location.source.display_name}`
              : 'Trabajo indexado en OpenAlex',
            readInFull: false,
            consultedAt,
          };
        })
        .filter((x): x is DiscoveredSource => Boolean(x))
    )
    .catch(() => [] as DiscoveredSource[]);

  const [doaj, cr, oa] = await Promise.all([doajTask, crossRefTask, openAlexTask]);
  return [...doaj, ...cr, ...oa];
}

// ------------------------------------------------------------------
// MOTOR 2 — INVESTIGACIÓN EXTERNA ACADÉMICA (Google Search + URL Context)
// ------------------------------------------------------------------
export async function runMotor2ExternalResearch(params: {
  ai: GoogleGenAI | null;
  query: string;
  subjectNameHint: string;
  userPastedUrls: string[];
  motor1Authors: string[];
  motor1Concepts: string[];
  useWebSearch: boolean;
}): Promise<Motor2Result> {
  const consultedAt = new Date().toISOString().slice(0, 10);
  if (!params.useWebSearch && params.userPastedUrls.length === 0) {
    return {
      sources: [],
      searchQueries: [],
      urlContextReadCount: 0,
      externalDigestMarkdown: 'Búsqueda externa en Internet desactivada para esta consulta por el estudiante.',
      unverifiedNotes: [],
    };
  }

  if (!params.ai) {
    return {
      sources: [],
      searchQueries: [],
      urlContextReadCount: 0,
      externalDigestMarkdown: 'Motor Gemini no disponible para ejecutar búsqueda en tiempo real.',
      unverifiedNotes: ['No se pudo ejecutar la investigación externa en vivo.'],
    };
  }

  const discoveredSources: DiscoveredSource[] = [];
  const seenUrls = new Set<string>();
  const searchQueries: string[] = [];
  const unverifiedNotes: string[] = [];
  let discoveryNotes = '';

  for (const pastedUrl of params.userPastedUrls) {
    if (!seenUrls.has(pastedUrl)) {
      seenUrls.add(pastedUrl);
      const cls = classifySourceOrigin(pastedUrl, 'URL indicada por el estudiante');
      discoveredSources.push({
        title: `Enlace provisto (${cls.domain})`,
        url: pastedUrl,
        domain: cls.domain,
        originType: cls.originType,
        readInFull: false,
        consultedAt,
      });
    }
  }

  // Phase 2A: Discovery via Gemini Google Search + OpenAlex/CrossRef in parallel
  const searchPrompt = `Realizá una investigación académica inicial en Internet sobre:
Tema/Consulta: "${params.query}"
${params.subjectNameHint ? `Materia / Cátedra: ${params.subjectNameHint}` : ''}
${params.motor1Authors.length > 0 ? `Autores presentes en la bibliografía del estudiante: ${params.motor1Authors.slice(0, 8).join(', ')}` : ''}
${params.motor1Concepts.length > 0 ? `Conceptos clave a profundizar: ${params.motor1Concepts.slice(0, 10).join(', ')}` : ''}

CRITERIOS DE PRIORIZACIÓN OBLIGATORIOS:
1. Universidades nacionales y extranjeras (repositorios, cátedras, programas oficiales, UNLP, UBA, UNAM, etc.).
2. Revistas científicas y repositorios académicos (SciELO, Redalyc, Dialnet, CONICET, OpenAlex, Google Scholar).
3. Organismos oficiales, legislación y jurisprudencia cuando corresponda.
4. Libros y bibliografía académica identificable.
EVITÁ blogs sin respaldo, sitios de resúmenes estudiantiles sin autoría ni páginas superficiales.
Reportá brevemente las fuentes académicas encontradas y sus autores/instituciones reales.`;

  const academicKeywords = buildAcademicSearchQuery(
    params.query,
    params.subjectNameHint,
    params.motor1Authors
  );

  const runGoogleSearchWithFallback = async (): Promise<GenerateContentResponse> => {
    try {
      return await params.ai!.models.generateContent({
        model: MODEL_NAME,
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      });
    } catch {
      return await params.ai!.models.generateContent({
        model: LITE_MODEL_NAME,
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      });
    }
  };

  const [googleSearchSettled, openApisSettled] = await Promise.allSettled([
    runGoogleSearchWithFallback(),
    fetchOpenAcademicAPIs(academicKeywords),
  ]);

  if (googleSearchSettled.status === 'fulfilled') {
    const gResp = googleSearchSettled.value;
    discoveryNotes = (gResp.text ?? '').trim();
    const meta = gResp.candidates?.[0]?.groundingMetadata;
    if (Array.isArray(meta?.webSearchQueries)) {
      searchQueries.push(
        ...meta.webSearchQueries.filter((q): q is string => typeof q === 'string').slice(0, 6)
      );
    }
    const rawChunks = Array.isArray(meta?.groundingChunks) ? meta.groundingChunks : [];
    for (const ch of rawChunks) {
      const uri = ch?.web?.uri;
      if (!uri || typeof uri !== 'string' || seenUrls.has(uri)) continue;
      const cls = classifySourceOrigin(uri, 'Google Search Académico');
      seenUrls.add(uri);
      discoveredSources.push({
        title: String(ch?.web?.title || cls.domain || 'Fuente académica').trim().slice(0, 200),
        url: uri,
        domain: cls.domain,
        originType: cls.originType,
        readInFull: false,
        consultedAt,
      });
    }
  } else {
    unverifiedNotes.push('La búsqueda web con Google Search tuvo una restricción temporal en este turno; se utilizaron repositorios académicos abiertos (DOAJ/CrossRef).');
  }

  if (openApisSettled.status === 'fulfilled') {
    for (const s of openApisSettled.value) {
      if (!seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        discoveredSources.push(s);
      }
    }
  }

  // Sort by academic priority (never prioritize low-quality sites when academic ones exist)
  const prioritized = [...discoveredSources]
    .sort((a, b) => {
      const sa = classifySourceOrigin(a.url, a.originType).priorityScore;
      const sb = classifySourceOrigin(b.url, b.originType).priorityScore;
      return sb - sa;
    })
    .slice(0, 12);

  // Phase 2B: Deep URL Context Reading (actually reading pages instead of relying on snippets)
  const urlsToRead = prioritized
    .filter((s) => !s.url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect'))
    .slice(0, 5);
  const fallbackReadCandidates = urlsToRead.length > 0 ? urlsToRead : prioritized.slice(0, 4);

  let deepReadReport = '';
  let urlContextReadCount = 0;

  if (fallbackReadCandidates.length > 0) {
    const urlListBlock = fallbackReadCandidates
      .map((s, idx) => `${idx + 1}. ${s.title} — ${s.url}`)
      .join('\n');

    const urlPrompt = `Usá la herramienta de lectura de URL (urlContext) para EXAMINAR EN PROFUNDIDAD el contenido real de las siguientes fuentes descubiertas sobre "${params.query}":
${urlListBlock}

REGLAS OBLIGATORIAS:
- No consideres que un fragmento de búsqueda equivale a haber leído el documento completo: leé las URLs que sean accesibles.
- Para cada URL examinada indicá: autor/institución real, fecha o año si figura, tesis/conceptos principales, argumentos clave y secciones relevantes.
- Si alguna URL bloquea acceso, da error o solo ofrece metadatos parciales, aclaralo explícitamente sin inventar datos.`;

    const runUrlRead = async () => {
      try {
        return await params.ai!.models.generateContent({
          model: MODEL_NAME,
          contents: urlPrompt,
          config: {
            tools: [{ urlContext: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        });
      } catch {
        return await params.ai!.models.generateContent({
          model: LITE_MODEL_NAME,
          contents: urlPrompt,
          config: {
            tools: [{ urlContext: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        });
      }
    };

    try {
      const urlReadResp = await runUrlRead();
      deepReadReport = (urlReadResp.text ?? '').trim();
      const urlContextMeta = (urlReadResp.candidates?.[0] as unknown as {
        urlContextMetadata?: { urlMetadata?: Array<{ retrievedUrl?: string; urlRetrievalStatus?: string }> };
      })?.urlContextMetadata;

      if (Array.isArray(urlContextMeta?.urlMetadata)) {
        for (const item of urlContextMeta.urlMetadata) {
          if (item?.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS' && item.retrievedUrl) {
            urlContextReadCount++;
            const match = prioritized.find((s) => s.url === item.retrievedUrl);
            if (match) match.readInFull = true;
          }
        }
      } else if (deepReadReport.length > 120) {
        urlContextReadCount = fallbackReadCandidates.length;
        for (const c of fallbackReadCandidates) {
          c.readInFull = true;
        }
      }
    } catch {
      unverifiedNotes.push('No se pudo completar la lectura profunda de todas las URLs externas; se conserva trazabilidad de lo efectivamente verificado.');
    }
  }

  const sourcesSummaryLines = prioritized.map(
    (s, idx) =>
      `${idx + 1}. [${s.originType}] ${s.title}${s.authors ? ` · Autor(es): ${s.authors}` : ''}${s.year ? ` (${s.year})` : ''} — ${s.url} (Lectura web: ${s.readInFull ? 'examinada por urlContext' : 'referencia indexada/metadatos'}, consultada el ${s.consultedAt})${s.snippet ? `\n   Nota: ${s.snippet}` : ''}`
  );

  const externalDigestMarkdown = [
    sourcesSummaryLines.length > 0
      ? `### Fuentes externas encontradas (${prioritized.length})\n${sourcesSummaryLines.join('\n')}`
      : 'No se encontraron fuentes externas académicas verificables para esta consulta.',
    deepReadReport
      ? `### Lectura profunda mediante URL Context (${urlContextReadCount} fuente(s) examinada(s))\n${deepReadReport.slice(0, 18000)}`
      : discoveryNotes
        ? `### Síntesis de búsqueda académica (Google Search)\n${discoveryNotes.slice(0, 12000)}`
        : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    sources: prioritized,
    searchQueries,
    urlContextReadCount,
    externalDigestMarkdown,
    unverifiedNotes,
  };
}

// ------------------------------------------------------------------
// Mode Prompts & 16-Section University Development Generator (D, E, F, G, I)
// ------------------------------------------------------------------
function getWorkModeDirective(mode: FabroWorkMode): string {
  switch (mode) {
    case 'RESUMEN':
      return `COMANDO ACTIVO: /RESUMEN (Síntesis Académica Rigurosa)
Generá una síntesis completa pero concentrada, con separación estricta entre información documental, información externa, análisis propio y lo no verificado. Incluí autores centrales, conceptos nucleares (definición + explicación clara + ejemplo), relaciones entre enfoques y bibliografía verificada.`;
    case 'EXPLICAR':
      return `COMANDO ACTIVO: /EXPLICAR (Explicación Didáctica Universitaria Paso a Paso)
Aplicá explícitamente para CADA concepto técnico importante la secuencia pedagógica completa de 8 pasos (1. Concepto técnico, 2. Definición precisa, 3. Explicación clara y comprensible, 4. Qué significa en términos académicos, 5. Ejemplo concreto, 6. Importancia dentro del tema/materia, 7. Relación con otros conceptos, 8. Errores frecuentes de comprensión).`;
    case 'INVESTIGAR':
      return `COMANDO ACTIVO: /INVESTIGAR (Investigación Externa Profunda y Estado del Arte)
Priorizá hallazgos de universidades, revistas científicas, repositorios y organismos oficiales obtenidos en Motor 2. Contrastá el estado del arte externo con lo que contienen los documentos propios del estudiante. Citá todas las fuentes con autor/institución, título, fecha, URL y fecha de consulta.`;
    case 'COMPARAR':
      return `COMANDO ACTIVO: /COMPARAR (Contraste Crítico entre Autores, Teorías y Fuentes)
Construí un análisis comparativo riguroso (incluyendo tabla Markdown comparativa) identificando: coincidencias entre autores, diferencias doctrinarias, contradicciones, conceptos complementarios, vacíos de información, evolución histórica y contraste entre documentos propios y fuentes externas.`;
    case 'EXAMEN':
      return `COMANDO ACTIVO: /EXAMEN (Evaluación Universitaria Integral)
Diseñá un examen exigente de nivel universitario basado en los documentos propios, el programa de la materia y la bibliografía externa: 5 preguntas de desarrollo argumentativo con criterios esperados de respuesta, 3 análisis de casos/problemas reales, 5 preguntas de opción múltiple con clave fundamentada y 3 preguntas orales integradoras con repreguntas.`;
    case 'BIBLIOGRAFIA':
      return `COMANDO ACTIVO: /BIBLIOGRAFIA (Relevamiento Bibliográfico Trazable)
Relevá y ordená las referencias detectadas en los documentos propios y las fuentes académicas reales encontradas en Internet. Para cada obra/fuente detallá: autor, título, institución/editorial, fecha, URL si es web, fecha de consulta, relevancia para la materia y aclaración honesta de si falta algún dato no confirmable.`;
    case 'PROGRAMA':
      return `COMANDO ACTIVO: /PROGRAMA (Análisis Estructural del Programa de Estudio)
Analizá el programa y la bibliografía cargada de la materia: desglosá ejes temáticos, secuencia lógica entre unidades, autores obligatorios por unidad, conceptos bisagra, vacíos detectados entre los documentos disponibles y una ruta recomendada de estudio unidad por unidad.`;
    case 'GLOSARIO':
      return `COMANDO ACTIVO: /GLOSARIO (Glosario Técnico Académico)
Elaborá un glosario exhaustivo del tema siguiendo para cada término clave: término técnico, definición académica rigurosa, explicación comprensible, autor/fuente de origen (documental o externa), ejemplo aplicado y confusiones frecuentes.`;
    case 'REPASO':
      return `COMANDO ACTIVO: /REPASO (Sesión de Repaso Activo Integrador)
Conectá los temas ya desarrollados en la memoria académica de la materia y los puntos débiles detectados en exámenes con una guía de consolidación: mapa de conceptos integrador, errores frecuentes a evitar, preguntas rápidas de autoevaluación con verificación inmediata y plan de cierre.`;
    case 'DESARROLLO':
    default:
      return `COMANDO ACTIVO: /DESARROLLO (GENERADOR DE DESARROLLO UNIVERSITARIO COMPLETO — PREDETERMINADO)
Producí un material de estudio extenso, riguroso y didáctico utilizando la estructura adaptable de hasta 16 secciones universitarias (omití únicamente un apartado si genuinamente no corresponde al tema, evitando títulos vacíos o mecánicos, y desarrollá cada sección con contenido sustancial):
## 1. Título del tema
## 2. Introducción general
## 3. Contexto histórico y disciplinar
## 4. Desarrollo conceptual
## 5. Definiciones fundamentales
## 6. Autores y corrientes teóricas
## 7. Explicación de cada autor
## 8. Relaciones entre autores
## 9. Ejemplos explicativos
## 10. Aplicaciones prácticas
## 11. Debates y críticas
## 12. Relación con otros temas
## 13. Conclusiones
## 14. Glosario
## 15. Preguntas para examen
## 16. Bibliografía y fuentes`;
  }
}

function extractMarkdownHeadings(markdown: string): string[] {
  const matches = markdown.match(/^#{1,3}\s+(.+)$/gm) || [];
  return matches
    .map((m) => m.replace(/^#{1,3}\s+/, '').trim())
    .filter((h) => h.length > 0 && h.length <= 120)
    .slice(0, 24);
}

// ------------------------------------------------------------------
// STEP 3 — SÍNTESIS INTEGRADA + REGLAS B, D, E, F, G + MEMORIA H
// ------------------------------------------------------------------
export async function runFabroIA2Pipeline(params: {
  ai: GoogleGenAI | null;
  preferredProvider: 'auto' | 'gemini' | 'chatgpt';
  callOpenAI?: (opts: {
    systemInstruction: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    preferHeavyModel?: boolean;
  }) => Promise<{ text: string; modelUsed: string }>;
  hasOpenAI: boolean;
  isGoogleLimitError: (err: unknown) => boolean;
  rawMessage: string;
  explicitWorkMode?: string;
  mode: 'sencillo' | 'academico';
  responseDepth: string;
  educationLevelLabel: string;
  useWebSearch: boolean;
  subjectContext: string;
  subjectNameHint: string;
  documentsContext: DocumentInput[];
  notes: StudentNoteInput[];
  weakTopics: string[];
  recentExamsSummary: string;
  activeBooks: string;
  academicMemory?: AcademicMemoryInput | null;
  history: Array<{ role: string; text: string }>;
  attachmentBase64?: string;
  attachmentMimeType?: string;
}): Promise<{
  reply: string;
  sources: DiscoveredSource[];
  searchQueries: string[];
  workMode: FabroWorkMode;
  analysisMetadata: FabroAnalysisMetadata;
  memoryUpdateSuggestion: MemoryUpdateSuggestion;
  providerUsed: string;
  webFallbackUsed: boolean;
}> {
  const { workMode, cleanQuery } = parseWorkModeAndQuery(params.rawMessage, params.explicitWorkMode);
  const userPastedUrls = extractInlineUrls(cleanQuery);
  const consultedAt = new Date().toISOString().slice(0, 10);

  const hintAuthors = Array.from(
    new Set(
      (params.documentsContext || [])
        .flatMap((d) => d.coverage?.authorsDetected || [])
        .filter((a) => typeof a === 'string' && a.trim().length > 0)
    )
  ).slice(0, 8);
  const hintConcepts = Array.from(
    new Set(
      (params.documentsContext || [])
        .flatMap((d) => d.coverage?.conceptIndex || [])
        .filter((c) => typeof c === 'string' && c.trim().length > 0)
    )
  ).slice(0, 10);

  // Run Motor 1 (Documental) + Motor 2 (External Search + URL Context) in parallel!
  const [motor1, motor2] = await Promise.all([
    runMotor1DocumentAnalysis({
      ai: params.ai,
      query: cleanQuery,
      documents: params.documentsContext,
      notes: params.notes,
      subjectContext: params.subjectContext,
      attachmentBase64: params.attachmentBase64,
      attachmentMimeType: params.attachmentMimeType,
    }),
    runMotor2ExternalResearch({
      ai: params.ai,
      query: cleanQuery,
      subjectNameHint: params.subjectNameHint,
      userPastedUrls,
      motor1Authors: hintAuthors,
      motor1Concepts: hintConcepts,
      useWebSearch: Boolean(params.useWebSearch),
    }),
  ]);

  const mem = params.academicMemory;
  const memoryBlock = mem
    ? [
        mem.developedTopics?.length ? `- Temas ya desarrollados en esta materia: ${mem.developedTopics.slice(-15).join(' | ')}` : '',
        mem.authorsAndTheories?.length ? `- Autores y teorías registradas: ${mem.authorsAndTheories.slice(-15).join(' | ')}` : '',
        mem.verifiedBibliography?.length ? `- Bibliografía verificada acumulada:\n  ${mem.verifiedBibliography.slice(-10).join('\n  ')}` : '',
        mem.priorSummaries?.length ? `- Síntesis previas de la materia:\n  ${mem.priorSummaries.slice(-4).join('\n  ')}` : '',
        mem.studentProgressNotes ? `- Notas de progreso del estudiante: ${mem.studentProgressNotes.slice(0, 1200)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'Sin historial previo acumulado aún para esta materia.';

  const modeToneInstruction =
    params.mode === 'sencillo'
      ? 'Estilo pedagógico: MODO SENCILLO — mantené el rigor académico universitario en las definiciones, autores y fuentes, pero redactá con máxima claridad progresiva, puentes intuitivos y ejemplos muy comprensibles.'
      : 'Estilo pedagógico: MODO ACADÉMICO UNIVERSITARIO — terminología técnica precisa, rigor doctrinario/científico, análisis crítico profundo y redacción propia de un manual o clase magistral universitaria.';

  const synthesisSystemInstruction = `Sos FABRO IA 2.0 — Motor de Comprensión, Investigación y Producción Académica Universitaria.
Idioma obligatorio: ESPAÑOL.
Perfil del estudiante: ${params.educationLevelLabel}.
${modeToneInstruction}
Profundidad predeterminada: DESARROLLO COMPLETO DE NIVEL UNIVERSITARIO (extenso, claro, didáctico y sustancial; prohibido producir respuestas telegráficas o resúmenes superficiales).

${getWorkModeDirective(workMode)}

=== REGLAS ARQUITECTÓNICAS OBLIGATORIAS (A–G) ===

1. SEPARACIÓN EPISTÉMICA OBLIGATORIA (REGLA B):
No confundas un resumen de documentos con una investigación académica externa ni con tu interpretación. En tu desarrollo (o mediante rótulos explícitos e inequívocos como **[Información documental]**, **[Información externa]**, **[Análisis propio — FABRO IA]** y **[Información no verificada]** y una matriz/sección integradora de síntesis), identificá siempre de dónde procede cada afirmación y contrastá:
- Coincidencias entre autores y fuentes.
- Diferencias doctrinarias o enfoques divergentes.
- Contradicciones o tensiones teóricas.
- Conceptos complementarios.
- Vacíos de información y actualizaciones relevantes.
NUNCA presentes una interpretación de FABRO como si fuera una cita textual del autor.

2. CONTROL DE COBERTURA DOCUMENTAL (REGLA C):
- Documentos propios seleccionados: ${motor1.docsSelectedCount} · Procesados: ${motor1.docsProcessedCount}.
- Estado de cobertura real: ${motor1.coverageSummary}
${
  motor1.partialDocsNames.length > 0
    ? `- ATENCIÓN CRÍTICA: Los siguientes documentos tienen lectura PARCIAL o páginas pendientes: ${motor1.partialDocsNames.join(', ')}. PROHIBIDO afirmar que fueron leídos en su totalidad; aclará qué páginas/fragmentos sí se procesaron y cuáles quedaron pendientes.`
    : ''
}

3. SECUENCIA DIDÁCTICA DE 8 PASOS POR CONCEPTO CLAVE (REGLA E):
Para cada concepto técnico central que desarrolles, aplicá de manera fluida y completa esta secuencia docente universitaria:
1) Concepto técnico · 2) Definición precisa · 3) Explicación clara y comprensible · 4) Qué significa en términos académicos · 5) Ejemplo concreto · 6) Importancia dentro del tema/materia · 7) Relación con otros conceptos · 8) Errores frecuentes de comprensión.

4. CITAS Y REFERENCIAS TRAZABLES (REGLA F):
Fecha de consulta actual: ${consultedAt}.
Cuando cites una fuente, incluí según disponibilidad real: Autor(es), Título, Institución o Editorial, Fecha, URL exacta (solo URLs realmente presentes en el material de Motor 2 o documentos del estudiante), Fecha de consulta y Página o Sección si figura en el documento.
Diferenciá explícitamente entre cita textual (entre comillas con página/sección) y paráfrasis o síntesis propia.
PROHIBICIÓN ABSOLUTA: Nunca inventes números de página, autores, DOIs, títulos ni URLs. Si un dato no puede confirmarse en los documentos ni en las fuentes examinadas, declaralo honestamente en **[Información no verificada]**.

5. CONTROL DE CALIDAD PREVIO A LA ENTREGA (REGLA G):
Antes de emitir tu respuesta final, verificá internamente que:
- Los documentos seleccionados se analizaron y su cobertura real se respetó.
- Se identificaron los autores y corrientes presentes.
- Se explicaron los conceptos en secuencia didáctica completa.
- Se integraron fuentes externas verificadas (cuando Internet estuvo activo).
- Se diferenció claramente información documental, externa, análisis propio y no verificada.
- No hay contradicciones sin resolver, párrafos repetidos ni secciones vacías.
Cerrá con una subsección breve **"## Control de calidad y cobertura"** detallando las fuentes documentales usadas, cuántas fuentes externas fueron examinadas y cualquier límite o dato pendiente de verificación.`;

  const synthesisUserPrompt = `CONSULTA DEL ESTUDIANTE:
"${cleanQuery}"

CONTEXTO DE LA MATERIA ACTIVA:
${params.subjectContext || 'Consulta general interdisciplinaria.'}

MEMORIA ACADÉMICA PREVIA DE LA MATERIA:
${memoryBlock}

TEMAS DÉBILES / EXÁMENES PREVIOS:
- Temas a reforzar: ${params.weakTopics.length > 0 ? params.weakTopics.join(', ') : 'Sin temas débiles previos registrados.'}
${params.recentExamsSummary ? `- Historial de exámenes: ${params.recentExamsSummary}` : ''}
${params.activeBooks ? `- Libros/Manuscritos vinculados:\n${params.activeBooks}` : ''}

==================================================
RESULTADOS DEL MOTOR 1 — ANÁLISIS DOCUMENTAL PROPIO
==================================================
Cobertura documental: ${motor1.coverageSummary}
${motor1.authorsIdentified.length > 0 ? `Autores detectados en documentos: ${motor1.authorsIdentified.join(', ')}` : ''}
${motor1.conceptsDetected.length > 0 ? `Conceptos detectados en documentos: ${motor1.conceptsDetected.join(', ')}` : ''}
${motor1.gapsNoted.length > 0 ? `Vacíos o límites documentales: ${motor1.gapsNoted.join('; ')}` : ''}

Contenido documental extraído y analizado:
${motor1.rawSummaryMarkdown.slice(0, 60000)}

==================================================
RESULTADOS DEL MOTOR 2 — INVESTIGACIÓN EXTERNA VERIFICADA
==================================================
${motor2.externalDigestMarkdown.slice(0, 32000)}
${motor2.unverifiedNotes.length > 0 ? `\nObservaciones de verificación externa: ${motor2.unverifiedNotes.join(' ')}` : ''}

Generá ahora la producción académica universitaria completa solicitada por el comando /${workMode}.`;

  const contents: Array<Record<string, unknown>> = [];
  for (const item of params.history.slice(-8)) {
    if (item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string') {
      contents.push({
        role: item.role,
        parts: [{ text: item.text.slice(0, 12000) }],
      });
    }
  }
  const finalUserParts: Array<Record<string, unknown>> = [];
  if (params.attachmentBase64 && params.attachmentMimeType) {
    finalUserParts.push({
      inlineData: {
        mimeType: params.attachmentMimeType,
        data: params.attachmentBase64,
      },
    });
  }
  finalUserParts.push({ text: synthesisUserPrompt });
  contents.push({ role: 'user', parts: finalUserParts });

  const heavyModes = new Set<FabroWorkMode>(['DESARROLLO', 'INVESTIGAR', 'COMPARAR', 'EXAMEN', 'PROGRAMA']);
  const thinkingLevel =
    params.responseDepth === 'directo'
      ? ThinkingLevel.MEDIUM
      : heavyModes.has(workMode) || params.responseDepth === 'exhaustivo' || params.responseDepth === 'desarrollo_completo'
        ? ThinkingLevel.XHIGH
        : ThinkingLevel.HIGH;

  let replyText = '';
  let providerUsed = 'gemini';
  let webFallbackUsed = false;

  const openAIMessages = (): Array<{ role: 'user' | 'assistant'; content: string }> => {
    const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = params.history
      .slice(-8)
      .filter((h) => (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
      .map((h) => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text.slice(0, 8000),
      }));
    msgs.push({ role: 'user', content: synthesisUserPrompt.slice(0, 48000) });
    return msgs;
  };

  if (params.preferredProvider === 'chatgpt' && params.callOpenAI) {
    const gpt = await params.callOpenAI({
      systemInstruction: synthesisSystemInstruction,
      messages: openAIMessages(),
      preferHeavyModel: true,
    });
    replyText = gpt.text;
    providerUsed = `chatgpt (${gpt.modelUsed})`;
  } else if (params.ai) {
    try {
      const resp: GenerateContentResponse = await params.ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction: synthesisSystemInstruction,
          thinkingConfig: { thinkingLevel },
        },
      });
      replyText = resp.text ?? '';
      providerUsed = `gemini (${MODEL_NAME})`;
    } catch (err) {
      if (params.preferredProvider === 'auto' && params.isGoogleLimitError(err)) {
        if (params.hasOpenAI && params.callOpenAI) {
          const gpt = await params.callOpenAI({
            systemInstruction: synthesisSystemInstruction,
            messages: openAIMessages(),
            preferHeavyModel: true,
          });
          replyText = gpt.text;
          providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
        } else {
          const liteResp = await params.ai.models.generateContent({
            model: LITE_MODEL_NAME,
            contents,
            config: {
              systemInstruction: synthesisSystemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            },
          });
          replyText = liteResp.text ?? '';
          providerUsed = `gemini-lite-respaldo (${LITE_MODEL_NAME})`;
          webFallbackUsed = true;
        }
      } else {
        throw err;
      }
    }
  } else {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  if (!replyText.trim()) {
    replyText = 'No se pudo generar la respuesta académica en este momento.';
  }

  // Extract metadata & memory updates cleanly (using LITE model or deterministic fallback)
  let memorySuggestion: MemoryUpdateSuggestion = {
    developedTopic: cleanQuery.slice(0, 140),
    summarySnippet: replyText.replace(/[#*_`>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 320),
    authorsAndTheories: motor1.authorsIdentified.slice(0, 8),
    verifiedBibliography: motor2.sources
      .slice(0, 6)
      .map((s) => `${s.authors ? `${s.authors} ` : ''}${s.year ? `(${s.year}). ` : ''}${s.title} — ${s.url} [Consultado: ${s.consultedAt}]`),
    examQuestions: [],
  };

  if (params.ai && replyText.length > 200) {
    try {
      const memResp = await params.ai.models.generateContent({
        model: LITE_MODEL_NAME,
        contents: `Del siguiente desarrollo académico generado sobre "${cleanQuery}", extraé en JSON conciso los datos reales para actualizar la memoria de la materia (NO inventes nada que no figure en el texto):
${replyText.slice(0, 18000)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              developedTopic: { type: Type.STRING },
              summarySnippet: { type: Type.STRING },
              authorsAndTheories: { type: Type.ARRAY, items: { type: Type.STRING } },
              verifiedBibliography: { type: Type.ARRAY, items: { type: Type.STRING } },
              examQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['developedTopic', 'summarySnippet', 'authorsAndTheories', 'verifiedBibliography', 'examQuestions'],
          },
        },
      });
      const parsedMem = JSON.parse((memResp.text ?? '{}').trim()) as Partial<MemoryUpdateSuggestion>;
      memorySuggestion = {
        developedTopic: String(parsedMem.developedTopic || cleanQuery).slice(0, 180),
        summarySnippet: String(parsedMem.summarySnippet || memorySuggestion.summarySnippet).slice(0, 600),
        authorsAndTheories: Array.isArray(parsedMem.authorsAndTheories)
          ? parsedMem.authorsAndTheories.slice(0, 12).map((x) => String(x).slice(0, 260))
          : memorySuggestion.authorsAndTheories,
        verifiedBibliography:
          Array.isArray(parsedMem.verifiedBibliography) && parsedMem.verifiedBibliography.length > 0
            ? parsedMem.verifiedBibliography.slice(0, 10).map((x) => String(x).slice(0, 450))
            : memorySuggestion.verifiedBibliography,
        examQuestions: Array.isArray(parsedMem.examQuestions)
          ? parsedMem.examQuestions.slice(0, 8).map((x) => String(x).slice(0, 450))
          : [],
      };
    } catch {
      // keep deterministic memorySuggestion
    }
  }

  const generatedSections = extractMarkdownHeadings(replyText);
  const analysisMetadata: FabroAnalysisMetadata = {
    workMode,
    topicTitle: memorySuggestion.developedTopic || cleanQuery.slice(0, 140),
    depthLevel:
      workMode === 'DESARROLLO'
        ? 'Desarrollo universitario completo'
        : params.responseDepth === 'directo'
          ? 'Directo'
          : 'Universitario riguroso',
    docsProcessedCount: motor1.docsProcessedCount,
    docsSelectedCount: motor1.docsSelectedCount,
    partialDocsNames: motor1.partialDocsNames,
    externalSourcesCount: motor2.sources.length,
    urlContextReadCount: motor2.urlContextReadCount,
    generatedSections,
    epistemicCategoriesUsed: [
      'Información documental',
      'Información externa',
      'Análisis propio',
      'Información no verificada',
    ],
    qualityAuditPassed: replyText.length > 300 && generatedSections.length >= 2,
    missingInfoNotes:
      motor1.partialDocsNames.length > 0
        ? `Cobertura parcial en: ${motor1.partialDocsNames.join('; ')}`
        : motor2.unverifiedNotes.join(' ') || '',
    verifiedReferencesCount: motor2.sources.length,
  };

  return {
    reply: replyText,
    sources: motor2.sources,
    searchQueries: motor2.searchQueries,
    workMode,
    analysisMetadata,
    memoryUpdateSuggestion: memorySuggestion,
    providerUsed,
    webFallbackUsed,
  };
}
