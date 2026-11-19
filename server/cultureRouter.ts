import crypto from 'crypto';
import express from 'express';

export type CultureNewsCategoryId =
  | 'todas'
  | 'arte-museos'
  | 'cine-series'
  | 'musica'
  | 'libros-literatura'
  | 'teatro-escena'
  | 'patrimonio-sociedad';

export interface ServerCultureNewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  image?: string;
  publishedAt: string;
  source: string;
  sourceId: string;
  category: Exclude<CultureNewsCategoryId, 'todas'>;
  categoryLabel: string;
  region: string;
}

interface CultureFeedConfig {
  id: string;
  name: string;
  url: string;
  region: string;
}

const CULTURE_FEEDS: CultureFeedConfig[] = [
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
    id: 'lanacion-cultura',
    name: 'La Nación Cultura',
    url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/cultura/',
    region: 'Argentina',
  },
  {
    id: 'elpais-cultura',
    name: 'El País Cultura',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada',
    region: 'Iberoamérica',
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

const CATEGORY_LABELS: Record<Exclude<CultureNewsCategoryId, 'todas'>, string> = {
  'arte-museos': 'Arte y Museos',
  'cine-series': 'Cine y Series',
  musica: 'Música',
  'libros-literatura': 'Libros y Literatura',
  'teatro-escena': 'Teatro y Escena',
  'patrimonio-sociedad': 'Patrimonio y Sociedad',
};

const NEWS_TTL_MS = 180_000; // 3 minutes cache
let cachedBundle: {
  fetchedAt: number;
  articles: ServerCultureNewsArticle[];
  activeSources: string[];
} | null = null;

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyCultureCategory(text: string): Exclude<CultureNewsCategoryId, 'todas'> {
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

function extractImageFromItem(block: string): string | undefined {
  const mediaMatch =
    block.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
    block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
    block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i) ||
    block.match(/<enclosure[^>]+type=["']image[^>]*url=["']([^"']+)["']/i) ||
    block.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  const candidate = mediaMatch?.[1]?.trim();
  if (!candidate || !candidate.startsWith('http')) return undefined;
  return candidate.replace(/&amp;/g, '&');
}

function parseRssXml(xml: string, feed: CultureFeedConfig): ServerCultureNewsArticle[] {
  const items: ServerCultureNewsArticle[] = [];
  const matches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (const block of matches.slice(0, 22)) {
    const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
    const rawGuid = (block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || '';
    const rawDesc =
      (block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] ||
      (block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) || [])[1] ||
      '';
    const rawDate =
      (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] ||
      (block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i) || [])[1] ||
      '';

    const title = decodeHtmlEntities(rawTitle);
    const url = decodeHtmlEntities(rawLink || rawGuid);
    if (!title || !url || !url.startsWith('http')) continue;

    const summary = decodeHtmlEntities(rawDesc).slice(0, 280);
    const parsedTime = rawDate ? Date.parse(decodeHtmlEntities(rawDate)) : NaN;
    const publishedAt = Number.isFinite(parsedTime)
      ? new Date(parsedTime).toISOString()
      : new Date().toISOString();

    const category = classifyCultureCategory(`${title} ${summary}`);
    const hash = crypto
      .createHash('sha1')
      .update(`${feed.id}:${url}:${title}`)
      .digest('hex')
      .slice(0, 16);

    items.push({
      id: `cult-${feed.id}-${hash}`,
      title,
      summary: summary || `Cobertura cultural publicada por ${feed.name}.`,
      url,
      image: extractImageFromItem(block),
      publishedAt,
      source: feed.name,
      sourceId: feed.id,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      region: feed.region,
    });
  }

  return items;
}

async function fetchFeedArticles(feed: CultureFeedConfig): Promise<ServerCultureNewsArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FABRO-Cultura/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, feed);
  } catch {
    return [];
  }
}

async function loadAllCultureNews(forceRefresh = false): Promise<{
  fetchedAt: number;
  articles: ServerCultureNewsArticle[];
  activeSources: string[];
}> {
  if (!forceRefresh && cachedBundle && Date.now() - cachedBundle.fetchedAt < NEWS_TTL_MS) {
    return cachedBundle;
  }

  const results = await Promise.allSettled(CULTURE_FEEDS.map((f) => fetchFeedArticles(f)));
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const merged: ServerCultureNewsArticle[] = [];
  const activeSources: string[] = [];

  results.forEach((result, idx) => {
    if (result.status !== 'fulfilled' || result.value.length === 0) return;
    activeSources.push(CULTURE_FEEDS[idx].name);
    for (const art of result.value) {
      const urlKey = art.url.trim().toLowerCase().replace(/\/$/, '');
      const titleKey = art.title.trim().toLowerCase().slice(0, 65);
      if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
      seenUrls.add(urlKey);
      seenTitles.add(titleKey);
      merged.push(art);
    }
  });

  merged.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  if (merged.length > 0) {
    cachedBundle = {
      fetchedAt: Date.now(),
      articles: merged.slice(0, 90),
      activeSources,
    };
    return cachedBundle;
  }

  return (
    cachedBundle || {
      fetchedAt: Date.now(),
      articles: [],
      activeSources: [],
    }
  );
}

export function createCultureRouter() {
  const router = express.Router();

  router.get('/news', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const category = String(req.query.category || 'todas').trim();
      const source = String(req.query.source || 'todas').trim();
      const q = String(req.query.q || '').trim().toLowerCase();
      const force = req.query.refresh === '1' || req.query.refresh === 'true';

      const bundle = await loadAllCultureNews(force);
      let list = bundle.articles;

      if (category && category !== 'todas') {
        list = list.filter((a) => a.category === category);
      }
      if (source && source !== 'todas') {
        list = list.filter((a) => a.sourceId === source || a.source === source);
      }
      if (q) {
        list = list.filter((a) =>
          `${a.title} ${a.summary} ${a.source} ${a.categoryLabel}`.toLowerCase().includes(q)
        );
      }

      res.json({
        ok: true,
        updatedAt: new Date(bundle.fetchedAt).toISOString(),
        total: list.length,
        sources: bundle.activeSources,
        articles: list,
      });
    } catch {
      res.status(200).json({
        ok: false,
        updatedAt: new Date().toISOString(),
        total: 0,
        sources: [],
        articles: [],
      });
    }
  });

  return router;
}
