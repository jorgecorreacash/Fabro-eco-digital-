import React from 'react';
import {
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  BrainCircuit,
  Code2,
  Compass,
  Cpu,
  Database,
  FileText,
  Globe,
  GraduationCap,
  HelpCircle,
  Image,
  Landmark,
  Layers,
  Library,
  MessageSquare,
  Microscope,
  Scale,
  Search,
  Shield,
  Sparkles,
  Star,
  Terminal,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import type { PortalCompatibilityStatus, PortalOpeningMode } from '../types/fabro';

export const PORTAL_ICON_OPTIONS = [
  'Globe',
  'Bot',
  'Sparkles',
  'BrainCircuit',
  'Cpu',
  'Compass',
  'Zap',
  'Layers',
  'Search',
  'Shield',
  'GraduationCap',
  'Microscope',
  'Database',
  'BookOpen',
  'Library',
  'BookMarked',
  'FileText',
  'Video',
  'Award',
  'MessageSquare',
  'Code2',
  'Users',
  'HelpCircle',
  'Image',
  'Landmark',
  'Scale',
  'BarChart3',
  'Terminal',
  'Star',
] as const;

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  BrainCircuit,
  Code2,
  Compass,
  Cpu,
  Database,
  FileText,
  Globe,
  GraduationCap,
  HelpCircle,
  Image,
  Landmark,
  Layers,
  Library,
  MessageSquare,
  Microscope,
  Scale,
  Search,
  Shield,
  Sparkles,
  Star,
  Terminal,
  Users,
  Video,
  Zap,
};

export function resolvePortalIcon(iconName?: string): React.FC<{ className?: string }> {
  if (!iconName) return Globe;
  return ICON_MAP[iconName] || Globe;
}

export function getCompatibilityMeta(
  status: PortalCompatibilityStatus,
  openingMode: PortalOpeningMode
): {
  label: string;
  shortLabel: string;
  modeLabel: string;
  textClass: string;
  dotClass: string;
} {
  const modeLabel = openingMode === 'apertura_externa' ? 'Apertura externa' : 'Iframe integrado';

  switch (status) {
    case 'iframe_compatible':
      return {
        label: 'Compatible con navegador integrado',
        shortLabel: 'Integrado',
        modeLabel,
        textClass: 'text-emerald-600 dark:text-emerald-400',
        dotClass: 'bg-emerald-500',
      };
    case 'external_required':
      return {
        label: 'Requiere apertura externa',
        shortLabel: 'Solo externo',
        modeLabel: 'Apertura externa',
        textClass: 'text-amber-600 dark:text-amber-400',
        dotClass: 'bg-amber-500',
      };
    case 'auth_warning':
      return {
        label: 'Integrable con aviso de sesión/cookies',
        shortLabel: 'Con aviso auth',
        modeLabel,
        textClass: 'text-sky-600 dark:text-sky-400',
        dotClass: 'bg-sky-500',
      };
    case 'unreachable':
      return {
        label: 'No verificable en vivo / Recomendado externo',
        shortLabel: 'No verificable',
        modeLabel: 'Apertura externa',
        textClass: 'text-rose-600 dark:text-rose-400',
        dotClass: 'bg-rose-500',
      };
    case 'untested':
    default:
      return {
        label: 'Pendiente de verificación',
        shortLabel: 'Sin verificar',
        modeLabel,
        textClass: 'text-slate-500 dark:text-slate-400',
        dotClass: 'bg-slate-400',
      };
  }
}

export function formatProbeDate(iso?: string): string {
  if (!iso) return 'Sin probar';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Sin probar';
  return new Date(ts).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
