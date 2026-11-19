import type { SharedResourcePayload } from '../types/ecosystem';

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeSharedResource(payload: SharedResourcePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharedResource(token: string): SharedResourcePayload | null {
  try {
    const json = fromBase64Url(token.trim());
    const parsed = JSON.parse(json) as SharedResourcePayload;
    if (!parsed || typeof parsed !== 'object' || !('kind' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildResourceShareUrl(payload: SharedResourcePayload): string {
  const encoded = encodeSharedResource(payload);
  if (typeof window === 'undefined') return `?share=${encoded}`;
  const url = new URL(window.location.href);
  url.searchParams.set('share', encoded);
  return url.toString();
}

export function getResourceKindSummary(payload: SharedResourcePayload): {
  badge: string;
  summary: string;
} {
  switch (payload.kind) {
    case 'note':
      return {
        badge: 'Apunte de Estudio',
        summary: `Materia: ${payload.subject} · Resumen estructurado listo para leer y guardar.`,
      };
    case 'flashcards':
      return {
        badge: 'Mazo de Flashcards',
        summary: `${payload.cards.length} tarjetas interactivas de ${payload.subject} para repasar sin registro.`,
      };
    case 'quiz':
      return {
        badge: 'Simulacro de Examen',
        summary: `${payload.questions.length} preguntas de ${payload.subject} con autocorrección y explicación.`,
      };
    case 'concept-map':
      return {
        badge: 'Mapa Conceptual',
        summary: `Esquema visual con ${payload.nodes.length} conceptos conectados.`,
      };
    case 'routine':
      return {
        badge: 'Rutina + Temporizador',
        summary: `${payload.rounds} rondas (${payload.workSec}s/${payload.restSec}s) · ${payload.steps.length} pasos guiados.`,
      };
    case 'stoic':
      return {
        badge: 'Reflexión Estoica',
        summary: payload.prompt,
      };
  }
}

export function buildWhatsAppShareData(payload: SharedResourcePayload): {
  shareUrl: string;
  whatsappHref: string;
  messageText: string;
} {
  const shareUrl = buildResourceShareUrl(payload);
  const { badge, summary } = getResourceKindSummary(payload);
  const messageText = `🍀 *FABRO — ${badge}*\n*${payload.title}*\n${summary}\n\nAbrilo directo sin registrarte:\n${shareUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
  return { shareUrl, whatsappHref, messageText };
}

export function readShareFromLocation(): SharedResourcePayload | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('share');
  if (!token) return null;
  return decodeSharedResource(token);
}

export function clearShareFromLocation(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('share')) return;
  url.searchParams.delete('share');
  window.history.replaceState({}, '', url.toString());
}
