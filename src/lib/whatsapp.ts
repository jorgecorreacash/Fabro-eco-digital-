export function htmlToWhatsAppText(html: string): string {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' | ');
    return (tmp.textContent || tmp.innerText || '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatForWhatsApp(params: {
  title: string;
  subtitle?: string;
  body: string;
  isHtml?: boolean;
}): string {
  const cleanBody = (params.isHtml ? htmlToWhatsAppText(params.body) : params.body)
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const headerLines = [
    `*${params.title.trim()}*`,
    params.subtitle ? `_${params.subtitle.trim()}_` : '',
  ].filter(Boolean);

  return `${headerLines.join('\n')}\n\n${cleanBody}\n\n— _Enviado desde FABRO_`;
}

export function buildWhatsAppShareHref(formattedText: string): {
  href: string;
  truncated: boolean;
} {
  const MAX_URL_TEXT = 3200;
  let payload = formattedText.trim();
  let truncated = false;

  if (payload.length > MAX_URL_TEXT) {
    payload =
      payload.slice(0, MAX_URL_TEXT).trimEnd() +
      '\n\n[...Texto extendido: usá "Copiar para WhatsApp" en FABRO para pegar el contenido completo]';
    truncated = true;
  }

  return {
    href: `https://wa.me/?text=${encodeURIComponent(payload)}`,
    truncated,
  };
}
