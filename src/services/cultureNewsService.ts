import type {
  CultureNewsArticle,
  CultureNewsCategory,
  CultureNewsFeedResult,
} from '../types/culture';
import { vaultGet, vaultSetIdbOnly } from './localVault';

const CULTURE_NEWS_CACHE_KEY = 'fabro_culture_news_cache_v1';
const CULTURE_NEWS_SAVED_KEY = 'fabro_culture_news_saved_v1';

export const CULTURE_NEWS_CATEGORIES: Array<{
  id: CultureNewsCategory;
  label: string;
}> = [
  { id: 'todas', label: 'Todas' },
  { id: 'arte-museos', label: 'Arte y Museos' },
  { id: 'cine-series', label: 'Cine y Series' },
  { id: 'musica', label: 'Música' },
  { id: 'libros-literatura', label: 'Libros y Literatura' },
  { id: 'teatro-escena', label: 'Teatro y Escena' },
  { id: 'patrimonio-sociedad', label: 'Patrimonio y Sociedad' },
];

const CATEGORY_LABELS: Record<Exclude<CultureNewsCategory, 'todas'>, string> = {
  'arte-museos': 'Arte y Museos',
  'cine-series': 'Cine y Series',
  musica: 'Música',
  'libros-literatura': 'Libros y Literatura',
  'teatro-escena': 'Teatro y Escena',
  'patrimonio-sociedad': 'Patrimonio y Sociedad',
};

const CORS_CULTURE_RSS_FEEDS = [
  {
    id: 'infobae-cultura',
    name: 'Infobae Cultura',
    url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/cultura/',
    region: 'Argentina y Mundo',
  },
  {
    id: 'clarin-cultura',
    name: 'Clarín Cultura',
    url: 'https://www.clarin.com/rss/cultura/',
    region: 'Argentina',
  },
  {
    id: 'bbc-mundo-cultura',
    name: 'BBC Mundo Cultura',
    url: 'https://feeds.bbci.co.uk/mundo/topics/c2dwq9zyv4yt/rss.xml',
    region: 'Internacional',
  },
  {
    id: 'rtve-cultura',
    name: 'RTVE Cultura',
    url: 'https://api2.rtve.es/rss/temas_cultura.xml',
    region: 'España y Mundo',
  },
];

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function stripHtml(raw: string): string {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyCultureCategory(text: string): Exclude<CultureNewsCategory, 'todas'> {
  const t = text.toLowerCase();
  if (
    /(pel[ií]cula|cine|director|actriz|actor|serie|netflix|festival de|cannes|oscar|documental|rodaje|estreno|audiovisual)/.test(
      t
    )
  ) {
    return 'cine-series';
  }
  if (
    /(m[uú]sica|cancion|canci[oó]n|[aá]lbum|disco|concierto|orquesta|banda|rock|jazz|tango|folclore|cantante|piano|guitarra|recital|opera|[oó]pera)/.test(
      t
    )
  ) {
    return 'musica';
  }
  if (
    /(libro|novela|escritor|escritora|poes[ií]a|poeta|literatura|editorial|biblioteca|lectura|feria del libro|premio cervantes|cuento|ensayo|autor)/.test(
      t
    )
  ) {
    return 'libros-literatura';
  }
  if (
    /(teatro|escena|obra teatral|dramaturg|danza|ballet|coreograf|escenario|comedia musical|tel[oó]n|col[oó]n)/.test(
      t
    )
  ) {
    return 'teatro-escena';
  }
  if (
    /(museo|exposici[oó]n|pintura|pintor|escultura|galer[ií]a|arte|artista|fotograf[ií]a|bienal|arquitectura|cuadro|muestra|ilustraci[oó]n)/.test(
      t
    )
  ) {
    return 'arte-museos';
  }
  return 'patrimonio-sociedad';
}

async function tryLocalCultureApi(forceRefresh: boolean): Promise<CultureNewsFeedResult | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    const res = await fetch(
      `/api/culture/news?refresh=${forceRefresh ? '1' : '0'}&_t=${Date.now()}`,
      { cache: 'no-store', signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      updatedAt?: string;
      sources?: string[];
      articles?: CultureNewsArticle[];
    };
    if (!data || !Array.isArray(data.articles) || data.articles.length === 0) return null;
    return {
      articles: data.articles,
      sources: Array.isArray(data.sources) ? data.sources : [],
      updatedAt: data.updatedAt || new Date().toISOString(),
      mode: 'server',
    };
  } catch {
    return null;
  }
}

async function fetchDirectCorsRssFeed(
  feed: (typeof CORS_CULTURE_RSS_FEEDS)[number]
): Promise<CultureNewsArticle[]> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7500);
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`,
      { cache: 'no-store', signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!res.ok) return [];
    const payload = (await res.json()) as {
      status?: string;
      items?: Array<{
        title?: string;
        link?: string;
        guid?: string;
        pubDate?: string;
        description?: string;
        thumbnail?: string;
        enclosure?: { link?: string; thumbnail?: string };
      }>;
    };
    if (payload.status !== 'ok' || !Array.isArray(payload.items)) return [];

    const list: CultureNewsArticle[] = [];
    for (const item of payload.items) {
      const title = stripHtml(item.title || '');
      const url = (item.link || item.guid || '').trim();
      if (!title || !url || !url.startsWith('http')) continue;
      const summary = stripHtml(item.description || '').slice(0, 260);
      const parsedMs = item.pubDate ? Date.parse(item.pubDate.replace(' ', 'T')) : NaN;
      const publishedAt = Number.isFinite(parsedMs)
        ? new Date(parsedMs).toISOString()
        : new Date().toISOString();
      const imageCandidate = item.thumbnail || item.enclosure?.link || item.enclosure?.thumbnail;
      const image =
        imageCandidate && imageCandidate.startsWith('http') ? imageCandidate : undefined;
      const category = classifyCultureCategory(`${title} ${summary}`);

      list.push({
        id: `cors-${feed.id}-${stableHash(`${url}|${title}`)}`,
        title,
        summary: summary || `Nota cultural publicada por ${feed.name}.`,
        url,
        image,
        publishedAt,
        source: feed.name,
        sourceId: feed.id,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        region: feed.region,
      });
    }
    return list;
  } catch {
    return [];
  }
}

async function fetchWikipediaCultureHighlights(): Promise<CultureNewsArticle[]> {
  try {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6500);
    const res = await fetch(
      `https://es.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`,
      { cache: 'no-store', signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      tfa?: {
        titles?: { normalized?: string };
        extract?: string;
        thumbnail?: { source?: string };
        content_urls?: { desktop?: { page?: string } };
      };
      onthisday?: Array<{
        text?: string;
        year?: number;
        pages?: Array<{
          titles?: { normalized?: string };
          extract?: string;
          thumbnail?: { source?: string };
          content_urls?: { desktop?: { page?: string } };
        }>;
      }>;
    };

    const out: CultureNewsArticle[] = [];
    if (data.tfa?.titles?.normalized && data.tfa.content_urls?.desktop?.page) {
      const title = `Artículo cultural destacado: ${data.tfa.titles.normalized}`;
      const url = data.tfa.content_urls.desktop.page;
      const summary = (data.tfa.extract || '').slice(0, 260);
      const category = classifyCultureCategory(`${title} ${summary}`);
      out.push({
        id: `cors-wiki-tfa-${stableHash(url)}`,
        title,
        summary,
        url,
        image: data.tfa.thumbnail?.source,
        publishedAt: new Date().toISOString(),
        source: 'Wikipedia Cultura ES',
        sourceId: 'wikipedia-es',
        category,
        categoryLabel: CATEGORY_LABELS[category],
        region: 'Efemérides y Enciclopedia',
      });
    }

    for (const ev of (data.onthisday || []).slice(0, 4)) {
      const page = ev.pages?.[0];
      const url = page?.content_urls?.desktop?.page;
      if (!ev.text || !url) continue;
      const title = `Efeméride (${ev.year || ''}): ${ev.text.slice(0, 110)}`;
      const summary = (page?.extract || ev.text).slice(0, 240);
      out.push({
        id: `cors-wiki-otd-${stableHash(`${ev.year}-${url}`)}`,
        title,
        summary,
        url,
        image: page?.thumbnail?.source,
        publishedAt: new Date().toISOString(),
        source: 'Efemérides Culturales',
        sourceId: 'wikipedia-es',
        category: 'patrimonio-sociedad',
        categoryLabel: CATEGORY_LABELS['patrimonio-sociedad'],
        region: 'Historia y Patrimonio',
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchDirectCorsCultureNews(): Promise<CultureNewsFeedResult> {
  const settled = await Promise.allSettled([
    ...CORS_CULTURE_RSS_FEEDS.map((f) => fetchDirectCorsRssFeed(f)),
    fetchWikipediaCultureHighlights(),
  ]);

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const merged: CultureNewsArticle[] = [];
  const sourcesSet = new Set<string>();

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue;
    for (const art of res.value) {
      const urlKey = art.url.trim().toLowerCase().replace(/\/$/, '');
      const titleKey = art.title.trim().toLowerCase().slice(0, 65);
      if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
      seenUrls.add(urlKey);
      seenTitles.add(titleKey);
      sourcesSet.add(art.source);
      merged.push(art);
    }
  }

  merged.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  return {
    articles: merged.slice(0, 75),
    sources: Array.from(sourcesSet),
    updatedAt: new Date().toISOString(),
    mode: 'cors-direct',
  };
}

export async function fetchCultureNews(forceRefresh = false): Promise<CultureNewsFeedResult> {
  const fromServer = await tryLocalCultureApi(forceRefresh);
  if (fromServer && fromServer.articles.length > 0) {
    void vaultSetIdbOnly(CULTURE_NEWS_CACHE_KEY, fromServer);
    return fromServer;
  }

  const fromCors = await fetchDirectCorsCultureNews();
  if (fromCors.articles.length > 0) {
    void vaultSetIdbOnly(CULTURE_NEWS_CACHE_KEY, fromCors);
    return fromCors;
  }

  const cached = await vaultGet<CultureNewsFeedResult | null>(CULTURE_NEWS_CACHE_KEY, null);
  if (cached && Array.isArray(cached.articles) && cached.articles.length > 0) {
    return { ...cached, mode: 'cache' };
  }

  return {
    articles: [],
    sources: [],
    updatedAt: new Date().toISOString(),
    mode: 'cors-direct',
  };
}

export async function loadSavedCultureNews(): Promise<CultureNewsArticle[]> {
  const saved = await vaultGet<CultureNewsArticle[]>(CULTURE_NEWS_SAVED_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

export async function saveCultureNewsBookmarks(items: CultureNewsArticle[]): Promise<void> {
  await vaultSetIdbOnly(CULTURE_NEWS_SAVED_KEY, items);
}

export function formatRelativeCultureDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'Reciente';
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'Hace instantes';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Hace ${diffHrs} h`;
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleDateString('es-AR');
  }
}
