import type { VideoProviderKind } from '../types/ecosystem';

export interface ParsedVideoLink {
  provider: VideoProviderKind;
  embedUrl: string;
  thumbnailUrl?: string;
  cleanUrl: string;
}

/**
 * Parses YouTube, Vimeo, or direct/embeddable video URLs into a safe responsive iframe embed URL.
 */
export function parseVideoEmbedUrl(rawUrl: string): ParsedVideoLink | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let urlObj: URL;
  try {
    urlObj = new URL(normalized);
  } catch {
    return null;
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return null;
  }

  const host = urlObj.hostname.toLowerCase().replace(/^www\./, '');

  // YouTube (watch, shorts, live, embed, youtu.be)
  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be'
  ) {
    let videoId = '';
    if (host === 'youtu.be') {
      videoId = urlObj.pathname.replace(/^\/+/, '').split('/')[0] || '';
    } else if (urlObj.pathname.startsWith('/watch')) {
      videoId = urlObj.searchParams.get('v') || '';
    } else if (urlObj.pathname.startsWith('/shorts/')) {
      videoId = urlObj.pathname.split('/')[2] || '';
    } else if (urlObj.pathname.startsWith('/embed/')) {
      videoId = urlObj.pathname.split('/')[2] || '';
    } else if (urlObj.pathname.startsWith('/live/')) {
      videoId = urlObj.pathname.split('/')[2] || '';
    }

    const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
    if (cleanId.length >= 6) {
      return {
        provider: 'youtube',
        embedUrl: `https://www.youtube-nocookie.com/embed/${cleanId}?rel=0`,
        thumbnailUrl: `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`,
        cleanUrl: normalized,
      };
    }
  }

  // Vimeo
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = urlObj.pathname.match(/\/(?:video\/)?(\d{5,15})/);
    if (match?.[1]) {
      return {
        provider: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${match[1]}`,
        cleanUrl: normalized,
      };
    }
  }

  // Google Drive preview link (for recorded classes)
  if (host === 'drive.google.com') {
    const driveMatch = urlObj.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch?.[1]) {
      return {
        provider: 'direct',
        embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
        cleanUrl: normalized,
      };
    }
  }

  // Direct MP4 / WebM / OGG or generic HTTPS embeddable player URL
  return {
    provider: 'direct',
    embedUrl: normalized,
    cleanUrl: normalized,
  };
}

export function isDirectHtml5VideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url.trim());
}
