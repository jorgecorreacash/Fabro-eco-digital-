import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CloudOff,
  Clover,
  Compass,
  Dumbbell,
  Feather,
  FileSpreadsheet,
  FileText,
  Flame,
  FolderKanban,
  Globe,
  GraduationCap,
  Home,
  KeyRound,
  Layers,
  Leaf,
  Library,
  Menu,
  MessageCircle,
  MessageSquare,
  Microscope,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Sun,
  Timer,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Youtube,
} from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { useHabitTimer } from '../../context/HabitTimerContext';
import { usePlatform } from '../../context/PlatformContext';
import type { NavSectionId } from '../../types/fabro';
import { FabroLogo } from '../brand/FabroLogo';
import { GlobalAudioMiniPlayer } from '../common/GlobalAudioMiniPlayer';
import { ThemeTemplatePicker } from '../common/ThemeTemplatePicker';
import { PWAInstallButton } from '../pwa/PWAControls';
import { SocialFloatingBubble } from '../social/SocialFloatingBubble';
import { HabitTimerHeaderWidget } from '../widgets/HabitTimerHeaderWidget';
import { RemindersWidget } from '../widgets/RemindersWidget';

type NavCategoryId =
  | 'general'
  | 'estudio'
  | 'bienestar'
  | 'social'
  | 'herramientas'
  | 'administracion';

const CATEGORY_ORDER: Array<{ id: NavCategoryId; label: string }> = [
  { id: 'general', label: 'Centro de Control y 5 Sectores' },
  { id: 'estudio', label: 'Sector 1 · Estudio e Investigación' },
  { id: 'bienestar', label: 'Sector 2 · Bienestar y Salud' },
  { id: 'social', label: 'Sector 3 · Red Social FABRO' },
  { id: 'herramientas', label: 'Productividad y Utilidades' },
  { id: 'administracion', label: 'Sector 5 · Configuración y Connect' },
];

export const NAV_ITEMS: Array<{
  id: NavSectionId;
  label: string;
  shortLabel: string;
  category: NavCategoryId;
  keywords?: string;
  icon: React.FC<{ className?: string }>;
  adminOnly?: boolean;
}> = [
  { id: 'inicio', label: 'Inicio · Centro de Control', shortLabel: 'Inicio', category: 'general', keywords: 'inicio home centro control sectores resumen agenda favoritos', icon: Home },
  { id: 'estudio-panel', label: '1. Estudio e Investigación', shortLabel: 'Estudio', category: 'general', keywords: 'estudio educacion apuntes materias ia fuentes academia examenes investigacion', icon: GraduationCap },
  { id: 'bienestar-panel', label: '2. Bienestar y Salud', shortLabel: 'Bienestar', category: 'general', keywords: 'bienestar salud natural ultimo dia habitos ejercicios calorias horoscopo suerte', icon: Leaf },
  { id: 'social-panel', label: '3. Red Social FABRO', shortLabel: 'Social', category: 'general', keywords: 'red social globo whatsapp telegram ptt qr fabro id mensajes grupos muro', icon: MessageSquare },
  { id: 'ia-panel', label: '4. Inteligencia Artificial', shortLabel: 'IA', category: 'general', keywords: 'ia inteligencia artificial openai chatgpt gemini claude deepseek qwen multimodelo', icon: Sparkles },
  { id: 'herramientas-panel', label: 'Herramientas Personales', shortLabel: 'Herram.', category: 'general', keywords: 'herramientas utilidades pdf calculadora diseno calendario', icon: Wrench },

  { id: 'fabro-ai', label: 'FABRO IA Multimodelo', shortLabel: 'FABRO IA', category: 'estudio', keywords: 'tutor chat modelos ia gemini chatgpt claude deepseek qwen', icon: Sparkles },
  { id: 'ai-browser', label: 'AI Browser Paralelo', shortLabel: 'AI Browser', category: 'estudio', keywords: 'navegador multi ia portales chatgpt gemini comparar', icon: Globe },
  { id: 'hub', label: 'FABRO HUB (Comparador)', shortLabel: 'HUB', category: 'estudio', keywords: 'directorio comparador multi ia herramientas', icon: Compass },
  { id: 'explorer', label: 'FABRO EXPLORER', shortLabel: 'Explorer', category: 'estudio', keywords: 'navegador portales externos google scholar scielo redalyc', icon: Search },
  { id: 'fuentes', label: 'Buscador de fuentes', shortLabel: 'Fuentes', category: 'estudio', keywords: 'lector web fuentes url enciclopedia visual', icon: Globe },
  { id: 'research', label: 'FABRO RESEARCH', shortLabel: 'Research', category: 'estudio', keywords: 'tesis articulos citas apa mla chicago', icon: Microscope },
  { id: 'knowledge', label: 'FABRO KNOWLEDGE', shortLabel: 'Knowledge', category: 'estudio', keywords: 'pubmed eric zenodo gutenberg scielo', icon: Library },
  { id: 'diccionario', label: 'Diccionario y Glosario', shortLabel: 'Diccionario', category: 'estudio', keywords: 'glosario terminologia definiciones', icon: BookMarked },
  { id: 'apuntes', label: 'Cuadernos y Apuntes', shortLabel: 'Apuntes', category: 'estudio', keywords: 'notas linea de tiempo checklist pdf word', icon: FileText },
  { id: 'materias', label: 'Mis materias', shortLabel: 'Materias', category: 'estudio', keywords: 'programas catedras unidades', icon: BookOpen },
  { id: 'biblioteca', label: 'Biblioteca documental', shortLabel: 'Biblioteca', category: 'estudio', keywords: 'archivos pdf libros subidos', icon: FolderKanban },
  { id: 'libros', label: 'Escribir libros', shortLabel: 'Libros', category: 'estudio', keywords: 'capitulos manuscrito editorial', icon: Feather },
  { id: 'academy', label: 'FABRO Academy', shortLabel: 'Academy', category: 'estudio', keywords: 'cursos gratuitos certificados', icon: Award },
  { id: 'video', label: 'Videoteca IA', shortLabel: 'Videos', category: 'estudio', keywords: 'clases grabadas youtube transcripcion', icon: Youtube },
  { id: 'examenes', label: 'Exámenes', shortLabel: 'Exámenes', category: 'estudio', keywords: 'simulacro preguntas evaluacion oral escrito', icon: GraduationCap },
  { id: 'memorizacion', label: 'Fichas de memoria', shortLabel: 'Repaso', category: 'estudio', keywords: 'flashcards repaso espaciado', icon: Layers },
  { id: 'study', label: 'FABRO STUDY', shortLabel: 'Study', category: 'estudio', keywords: 'pomodoro traductor voz dictado', icon: Clock },
  { id: 'progreso', label: 'Mi progreso', shortLabel: 'Progreso', category: 'estudio', keywords: 'estadisticas horas estudio', icon: BarChart3 },

  { id: 'ultimo-dia', label: 'El Último Día de Tu Vida', shortLabel: 'Último Día', category: 'bienestar', keywords: 'ultimo dia vida reflexion diario emociones felicidad suenos legado recuerdos', icon: Sun },
  { id: 'calorias', label: 'Contador de Calorías', shortLabel: 'Calorías', category: 'bienestar', keywords: 'calorias kcal dieta comida balance macros quemadas', icon: Flame },
  { id: 'habitos', label: 'Organización y Hábitos IA', shortLabel: 'Hábitos', category: 'bienestar', keywords: 'temporizador habitos rutinas dieta nutricion salud ia', icon: Timer },
  { id: 'ejercicios', label: 'Salud y Ejercicios', shortLabel: 'Ejercicios', category: 'bienestar', keywords: 'ejercicios niveles videos estiramientos respiracion meditacion', icon: Dumbbell },
  { id: 'horoscopo', label: 'Horóscopos', shortLabel: 'Horóscopos', category: 'bienestar', keywords: 'horoscopo signos zodiaco astrologia afinidad lectura diaria', icon: Star },
  { id: 'suerte', label: 'Números de la Suerte 🍀', shortLabel: 'Suerte 🍀', category: 'bienestar', keywords: 'numeros suerte trebol cuatro hojas numerologia sorteo', icon: Clover },

  { id: 'comunidad', label: 'Muro, Grupos y Comunidades', shortLabel: 'Comunidad', category: 'social', keywords: 'muro publicaciones reacciones grupos debates encuestas', icon: Users },
  { id: 'mensajes', label: 'Mensajería Privada 1:1', shortLabel: 'Mensajes', category: 'social', keywords: 'chat privado adultos audios archivos', icon: MessageSquare },
  { id: 'perfil', label: 'Mi Perfil, Fotos y Comunidad', shortLabel: 'Perfil', category: 'social', keywords: 'perfil publico privado fotos frase comunidad compartir', icon: UserCheck },

  { id: 'tools', label: 'FABRO TOOLS', shortLabel: 'Tools', category: 'herramientas', keywords: 'calculadora cientifica estadistica unidades monedas qr corrector', icon: Wrench },
  { id: 'documents', label: 'FABRO DOCUMENTS', shortLabel: 'Docs PDF', category: 'herramientas', keywords: 'unir dividir comprimir pdf ocr imagen docx', icon: FileSpreadsheet },
  { id: 'design', label: 'FABRO DESIGN', shortLabel: 'Design', category: 'herramientas', keywords: 'afiches portadas infografias mapas conceptuales diagramas', icon: Palette },
  { id: 'calendario', label: 'Calendario', shortLabel: 'Calendario', category: 'herramientas', keywords: 'agenda fechas parciales entregas', icon: Calendar },

  { id: 'connect', label: 'FABRO CONNECT (Drive y BYOK)', shortLabel: 'Connect', category: 'administracion', keywords: 'google drive onedrive dropbox api key respaldos', icon: KeyRound },
  { id: 'configuracion', label: '5. Configuración y Plantillas', shortLabel: 'Ajustes', category: 'administracion', keywords: 'cuenta tema plantilla ecologico gotico aura floral metal oro offline accesibilidad', icon: Settings },
  { id: 'admin', label: 'Administración', shortLabel: 'Admin', category: 'administracion', keywords: 'superadmin costos freemium moderacion', icon: Shield, adminOnly: true },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    profile,
    user,
    activeSection,
    setActiveSection,
    theme,
    toggleTheme,
    actionError,
    clearActionError,
    isOnline,
    precacheState,
    precacheStudyDataNow,
    syncPendingOfflineChanges,
  } = useFabro();

  const {
    isAdmin,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = usePlatform();

  const { freemiumStatus, openPlansModal } = useAIGateway();
  const { completedAlert, dismissCompletedAlert, startHabit } = useHabitTimer();

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fabro_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [socialBubbleOpen, setSocialBubbleOpen] = useState(false);
  const [navHistory, setNavHistory] = useState<NavSectionId[]>([]);

  const [offlinePopoverOpen, setOfflinePopoverOpen] = useState(false);
  const [speedPopoverOpen, setSpeedPopoverOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [palettePopoverOpen, setPalettePopoverOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<NavSectionId[]>([]);
  const [recents, setRecents] = useState<NavSectionId[]>([]);
  const offlinePopoverRef = useRef<HTMLDivElement | null>(null);
  const speedPopoverRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const palettePopoverRef = useRef<HTMLDivElement | null>(null);

  const favStorageKey = user?.uid ? `fabro_nav_favorites_${user.uid}` : 'fabro_nav_favorites_anon';
  const recStorageKey = user?.uid ? `fabro_nav_recents_${user.uid}` : 'fabro_nav_recents_anon';

  useEffect(() => {
    try {
      localStorage.setItem('fabro_sidebar_collapsed', String(sidebarCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      const rawFav = localStorage.getItem(favStorageKey);
      const rawRec = localStorage.getItem(recStorageKey);
      setFavorites(
        rawFav
          ? (JSON.parse(rawFav) as NavSectionId[])
          : ['estudio-panel', 'bienestar-panel', 'social-panel', 'ia-panel', 'connect']
      );
      setRecents(rawRec ? (JSON.parse(rawRec) as NavSectionId[]) : []);
    } catch {
      setFavorites(['estudio-panel', 'bienestar-panel', 'social-panel']);
      setRecents([]);
    }
  }, [favStorageKey, recStorageKey]);

  useEffect(() => {
    if (activeSection === 'inicio') return;
    setRecents((prev) => {
      const next = [activeSection, ...prev.filter((s) => s !== activeSection && s !== 'inicio')].slice(0, 6);
      try {
        localStorage.setItem(recStorageKey, JSON.stringify(next));
        window.dispatchEvent(new Event('fabro:nav-prefs-updated'));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [activeSection, recStorageKey]);

  const toggleFavorite = (id: NavSectionId) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 8);
      try {
        localStorage.setItem(favStorageKey, JSON.stringify(next));
        window.dispatchEvent(new Event('fabro:nav-prefs-updated'));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const filteredNavItems = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return visibleNavItems;
    return visibleNavItems.filter((item) =>
      `${item.label} ${item.shortLabel} ${item.keywords || ''}`.toLowerCase().includes(q)
    );
  }, [navQuery, visibleNavItems]);

  useEffect(() => {
    if (!offlinePopoverOpen && !speedPopoverOpen && !notificationsOpen && !palettePopoverOpen) return;
    const onDown = (e: MouseEvent) => {
      if (offlinePopoverRef.current && !offlinePopoverRef.current.contains(e.target as Node)) {
        setOfflinePopoverOpen(false);
      }
      if (speedPopoverRef.current && !speedPopoverRef.current.contains(e.target as Node)) {
        setSpeedPopoverOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (palettePopoverRef.current && !palettePopoverRef.current.contains(e.target as Node)) {
        setPalettePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [offlinePopoverOpen, speedPopoverOpen, notificationsOpen, palettePopoverOpen]);

  // Real connection speed & health latency status (Network Information API + /api/health RTT probe)
  const [netMetrics, setNetMetrics] = useState<{
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  }>(() => {
    const navConn = (navigator as unknown as {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number };
    }).connection;
    return {
      effectiveType: navConn?.effectiveType,
      downlink: typeof navConn?.downlink === 'number' ? navConn.downlink : undefined,
      rtt: typeof navConn?.rtt === 'number' ? navConn.rtt : undefined,
    };
  });
  const [measuredLatencyMs, setMeasuredLatencyMs] = useState<number | null>(null);
  const [measuringSpeed, setMeasuringSpeed] = useState(false);
  const [lastMeasuredAt, setLastMeasuredAt] = useState<string | null>(null);

  const measureConnectionNow = React.useCallback(async () => {
    const navConn = (navigator as unknown as {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number };
    }).connection;
    if (navConn) {
      setNetMetrics({
        effectiveType: navConn.effectiveType,
        downlink: typeof navConn.downlink === 'number' ? navConn.downlink : undefined,
        rtt: typeof navConn.rtt === 'number' ? navConn.rtt : undefined,
      });
    }
    if (!navigator.onLine) {
      setMeasuredLatencyMs(null);
      return;
    }
    setMeasuringSpeed(true);
    const start = performance.now();
    try {
      const resp = await fetch(`/api/health?probe=${Date.now()}`, { cache: 'no-store' });
      const elapsed = Math.max(1, Math.round(performance.now() - start));
      if (resp.ok) {
        setMeasuredLatencyMs(elapsed);
        setLastMeasuredAt(
          new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      }
    } catch {
      setMeasuredLatencyMs(null);
    } finally {
      setMeasuringSpeed(false);
    }
  }, []);

  useEffect(() => {
    const navConn = (navigator as unknown as {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        addEventListener?: (type: string, cb: () => void) => void;
        removeEventListener?: (type: string, cb: () => void) => void;
      };
    }).connection;

    const handleConnChange = () => {
      if (!navConn) return;
      setNetMetrics({
        effectiveType: navConn.effectiveType,
        downlink: typeof navConn.downlink === 'number' ? navConn.downlink : undefined,
        rtt: typeof navConn.rtt === 'number' ? navConn.rtt : undefined,
      });
    };

    navConn?.addEventListener?.('change', handleConnChange);
    void measureConnectionNow();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void measureConnectionNow();
      }
    }, 45000);

    return () => {
      navConn?.removeEventListener?.('change', handleConnChange);
      window.clearInterval(interval);
    };
  }, [isOnline, measureConnectionNow]);

  const effectiveLatency = measuredLatencyMs ?? netMetrics.rtt ?? null;
  const connectionQuality: 'Sin conexión' | 'Lenta' | 'Estable' | 'Óptima' = !isOnline
    ? 'Sin conexión'
    : (effectiveLatency !== null && effectiveLatency > 500) ||
      (typeof netMetrics.downlink === 'number' && netMetrics.downlink < 1.2)
    ? 'Lenta'
    : (effectiveLatency === null || effectiveLatency <= 160) &&
      (typeof netMetrics.downlink !== 'number' || netMetrics.downlink >= 5)
    ? 'Óptima'
    : 'Estable';

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];
  const displayName = profile?.displayName || user?.displayName || 'Usuario FABRO';
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSelectSection = (id: NavSectionId) => {
    if (id !== activeSection) {
      setNavHistory((prev) => [...prev.slice(-9), activeSection]);
    }
    setActiveSection(id);
    setMobileMenuOpen(false);
  };

  const handleGoBack = () => {
    if (navHistory.length > 0) {
      const target = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      setActiveSection(target);
      return;
    }
    setActiveSection('inicio');
  };

  const isDrawerSection = !['inicio', 'estudio-panel', 'bienestar-panel', 'social-panel'].includes(activeSection);

  const renderNavRow = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = activeSection === item.id;
    const isFav = favorites.includes(item.id);
    return (
      <div key={item.id} className="group flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleSelectSection(item.id)}
          title={item.label}
          className={`flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
            active
              ? 'fabro-accent-pill font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#FAF6EE]'
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </button>
        <button
          type="button"
          onClick={() => toggleFavorite(item.id)}
          aria-label={isFav ? `Quitar ${item.label} de favoritos` : `Fijar ${item.label} en favoritos`}
          className={`p-1 rounded transition-opacity cursor-pointer ${
            isFav
              ? 'text-amber-500 opacity-100'
              : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-500' : ''}`} />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] fabro-shell-bg text-slate-900 dark:text-[#FAF6EE] flex overflow-x-hidden">
      {/* Desktop Collapsible Hybrid Left Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:shrink-0 border-r fabro-shell-surface-2 transition-[width] duration-200 ${
          sidebarCollapsed ? 'lg:w-[74px]' : 'lg:w-68'
        }`}
      >
        <div
          className={`h-14 flex items-center border-b border-slate-200/80 dark:border-white/10 ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => handleSelectSection('inicio')}
              aria-label="Ir al Centro de Control"
              className="cursor-pointer focus:outline-none min-w-0 text-left"
            >
              <span className="font-display text-xs font-bold uppercase tracking-[0.14em] fabro-gold-accent block truncate">
                Sectores FABRO
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                Menú de navegación
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            title={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/5 cursor-pointer shrink-0"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {sidebarCollapsed ? (
          /* Collapsed Icon Rail (5 Sectors + Inicio + Settings) */
          <div className="flex-1 overflow-y-auto py-3 flex flex-col items-center gap-1.5">
            {(
              [
                'inicio',
                'estudio-panel',
                'bienestar-panel',
                'social-panel',
                'ia-panel',
                'connect',
                'configuracion',
                'herramientas-panel',
              ] as NavSectionId[]
            ).map((id) => {
              const item = visibleNavItems.find((i) => i.id === id);
              if (!item) return null;
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                    active
                      ? 'fabro-accent-pill'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#FAF6EE]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* Quick 5-Sector Segmented Grid */}
            <div className="px-3 pt-3 grid grid-cols-5 gap-1">
              {(
                [
                  { id: 'estudio-panel', label: '1', title: '1. Estudio', icon: GraduationCap },
                  { id: 'bienestar-panel', label: '2', title: '2. Bienestar y Salud', icon: Leaf },
                  { id: 'social-panel', label: '3', title: '3. Red Social', icon: MessageSquare },
                  { id: 'ia-panel', label: '4', title: '4. Inteligencia Artificial', icon: Sparkles },
                  { id: 'configuracion', label: '5', title: '5. Configuración y Connect', icon: Settings },
                ] as const
              ).map((sector) => {
                const Icon = sector.icon;
                const active = activeSection === sector.id || (sector.id === 'configuracion' && activeSection === 'connect');
                return (
                  <button
                    key={sector.id}
                    type="button"
                    title={sector.title}
                    onClick={() => handleSelectSection(sector.id)}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border py-1.5 px-1 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'border-violet-500/60 fabro-accent-pill'
                        : 'border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-[#FAF6EE]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono tabular-nums">{sector.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-3 pt-2.5 pb-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  placeholder="Buscar módulo o herramienta..."
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/25 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-[#FAF6EE] focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-3" aria-label="Navegación principal">
              {!navQuery.trim() && favorites.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-[#E5B842]">
                    Favoritos
                  </p>
                  <div className="flex flex-wrap gap-1 px-1">
                    {favorites.map((favId) => {
                      const nav = visibleNavItems.find((i) => i.id === favId);
                      if (!nav) return null;
                      const active = activeSection === nav.id;
                      return (
                        <button
                          key={nav.id}
                          type="button"
                          onClick={() => handleSelectSection(nav.id)}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                            active
                              ? 'border-violet-500 fabro-accent-pill'
                              : 'border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] text-slate-700 dark:text-slate-300 hover:border-violet-500/40'
                          }`}
                        >
                          {nav.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!navQuery.trim() && recents.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Recientes
                  </p>
                  <div className="flex flex-wrap gap-1 px-1">
                    {recents.slice(0, 4).map((recId) => {
                      const nav = visibleNavItems.find((i) => i.id === recId);
                      if (!nav) return null;
                      return (
                        <button
                          key={nav.id}
                          type="button"
                          onClick={() => handleSelectSection(nav.id)}
                          className="rounded-md px-2 py-0.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-[#E5B842] cursor-pointer whitespace-nowrap"
                        >
                          {nav.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {navQuery.trim() ? (
                <div className="space-y-0.5">
                  {filteredNavItems.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-slate-500">Sin módulos coincidentes.</p>
                  ) : (
                    filteredNavItems.map(renderNavRow)
                  )}
                </div>
              ) : (
                CATEGORY_ORDER.map((cat) => {
                  const items = visibleNavItems.filter((i) => i.category === cat.id);
                  if (items.length === 0) return null;
                  const isCollapsed = Boolean(collapsedCategories[cat.id]);
                  return (
                    <div key={cat.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-[#FAF6EE] cursor-pointer"
                      >
                        <span className="truncate">{cat.label}</span>
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                      {!isCollapsed && <div className="space-y-0.5">{items.map(renderNavRow)}</div>}
                    </div>
                  );
                })
              )}
            </nav>
          </>
        )}

        <div
          className={`p-3 border-t border-slate-200/80 dark:border-white/10 space-y-2.5 ${
            sidebarCollapsed ? 'flex flex-col items-center' : ''
          }`}
        >
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'flex-col' : 'justify-between px-2 py-1'}`}>
            <button
              type="button"
              onClick={() => handleSelectSection('configuracion')}
              title={`${displayName} · Ir a Configuración`}
              className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
            >
              {profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/15"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-violet-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-[#FAF6EE] truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {profile?.sharedPhrase || (profile?.username ? `@${profile.username}` : 'Perfil FABRO')}
                  </p>
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              title="Cambiar tema claro u oscuro"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#FAF6EE] cursor-pointer shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          {!sidebarCollapsed && freemiumStatus && (
            <button
              type="button"
              onClick={() => openPlansModal()}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] px-2.5 py-2 text-left hover:border-violet-500/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-800 dark:text-[#FAF6EE]">
                  Plan {freemiumStatus.planLabel}
                </span>
                <span className="font-mono tabular-nums text-violet-600 dark:text-[#E5B842] font-semibold">
                  {freemiumStatus.usedToday}/{freemiumStatus.dailyLimit} hoy
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                Restan {freemiumStatus.remainingToday}
                {freemiumStatus.extraCredits > 0 ? ` (+${freemiumStatus.extraCredits})` : ''}
              </p>
            </button>
          )}
          {!sidebarCollapsed && (
            <div className="px-2">
              <PWAInstallButton />
            </div>
          )}
          {!sidebarCollapsed && (
            <p className="px-2 pt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              FABRO 2.0 ·{' '}
              <span className="font-semibold text-slate-700 dark:text-[#FAF6EE]">Jorge Luis Correa</span>
            </p>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 sticky top-0 z-30 border-b fabro-glass px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden shrink-0 cursor-pointer p-1.5 rounded-lg border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200"
              aria-label="Abrir menú de sectores a la izquierda"
            >
              <Menu className="w-4 h-4" />
            </button>
            {activeSection !== 'inicio' && (
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Volver"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Volver</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-sm min-w-0">
              <button
                type="button"
                onClick={() => handleSelectSection('inicio')}
                className="hidden sm:inline text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-[#E5B842] font-medium cursor-pointer whitespace-nowrap"
              >
                FABRO 2.0
              </button>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">/</span>
              <h1 className="font-display text-sm sm:text-sm font-semibold text-slate-900 dark:text-[#FAF6EE] truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Visual Connectivity & Offline Precache Indicator in Status Bar */}
            <div ref={offlinePopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setOfflinePopoverOpen((v) => !v)}
                aria-label={isOnline ? 'Estado de sincronización offline' : 'Sin conexión a internet'}
                title={
                  isOnline
                    ? 'Modo offline listo: biblioteca y apuntes recientes precargados'
                    : 'Sin conexión · Leyendo y editando desde caché local'
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isOnline
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                    : precacheState.status === 'precaching'
                    ? 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15'
                }`}
              >
                {!isOnline ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 shrink-0" />
                    <span>Sin conexión</span>
                  </>
                ) : precacheState.status === 'precaching' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="hidden md:inline">Precargando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:inline">Offline listo</span>
                  </>
                )}
              </button>

              {offlinePopoverOpen && (
                <div
                  role="dialog"
                  aria-label="Estado de modo sin conexión"
                  className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl border fabro-shell-surface p-4 shadow-xl z-50 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!isOnline ? (
                        <CloudOff className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-[#FAF6EE]">
                          {!isOnline ? 'Sin conexión a internet' : 'Conectado · Bóveda offline lista'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {!isOnline
                            ? 'Podés leer biblioteca y editar apuntes normalmente; se sincronizarán al reconectar.'
                            : 'El Service Worker mantiene precargados tu biblioteca y apuntes recientes.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOfflinePopoverOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Apuntes precargados</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-[#FAF6EE] mt-0.5 tabular-nums">
                        {precacheState.cachedNotesCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Docs biblioteca</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-[#FAF6EE] mt-0.5 tabular-nums">
                        {precacheState.cachedLibraryDocsCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Archivos e imágenes</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-[#FAF6EE] mt-0.5 tabular-nums">
                        {precacheState.cachedFilesCount + precacheState.cachedAssetsCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Pendientes de sync</p>
                      <p
                        className={`font-mono font-bold mt-0.5 tabular-nums ${
                          precacheState.pendingSyncCount > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-[#FAF6EE]'
                        }`}
                      >
                        {precacheState.pendingSyncCount}
                      </p>
                    </div>
                  </div>

                  {isOnline && (
                    <button
                      type="button"
                      disabled={precacheState.status === 'precaching'}
                      onClick={() => {
                        void syncPendingOfflineChanges().then(() => precacheStudyDataNow(true));
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          precacheState.status === 'precaching' ? 'animate-spin' : ''
                        }`}
                      />
                      {precacheState.status === 'precaching'
                        ? 'Precargando recursos...'
                        : 'Precargar biblioteca y apuntes ahora'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                aria-label="Notificaciones"
                className="relative inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/15 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="ml-1 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  role="dialog"
                  aria-label="Centro de notificaciones"
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border fabro-shell-surface p-4 shadow-xl z-50 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-[#FAF6EE]">
                      Notificaciones ({unreadNotificationsCount} sin leer)
                    </p>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        className="text-[11px] font-medium text-violet-600 dark:text-[#E5B842] hover:underline cursor-pointer"
                      >
                        Marcar todas leídas
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                      No tenés notificaciones nuevas.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
                      {notifications.slice(0, 15).map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => {
                            void markNotificationRead(notif.id);
                            setNotificationsOpen(false);
                            handleSelectSection(notif.linkSection || 'inicio');
                          }}
                          className={`w-full py-2.5 px-2 text-left hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer ${
                            !notif.read ? 'bg-violet-500/5' : ''
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-900 dark:text-[#FAF6EE]">
                            {notif.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {notif.body}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <HabitTimerHeaderWidget />

            <RemindersWidget variant="header" />

            <div ref={speedPopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setSpeedPopoverOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isOnline
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : connectionQuality === 'Lenta'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15'
                }`}
                aria-label="Velocidad de conexión y estado"
                title="Ver velocidad de conexión y estado en tiempo real"
              >
                {!isOnline ? (
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="font-mono tabular-nums">
                  {!isOnline
                    ? 'Sin conexión'
                    : typeof netMetrics.downlink === 'number'
                    ? `${connectionQuality} · ${netMetrics.downlink.toFixed(1)} Mbps`
                    : effectiveLatency !== null
                    ? `${connectionQuality} · ${effectiveLatency} ms`
                    : connectionQuality}
                </span>
              </button>

              {speedPopoverOpen && (
                <div
                  role="dialog"
                  aria-label="Velocidad de conexión y estado"
                  className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl border fabro-shell-surface p-4 shadow-xl z-50 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-[#FAF6EE]">
                        Velocidad de conexión y estado
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {isOnline
                          ? `Estado: ${connectionQuality} · Servidor sincronizado`
                          : 'Sin red disponible · Modo offline activo'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSpeedPopoverOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      aria-label="Cerrar panel de velocidad"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Bajada estimada</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-[#FAF6EE] mt-0.5 tabular-nums">
                        {!isOnline
                          ? '0 Mbps'
                          : typeof netMetrics.downlink === 'number'
                          ? `${netMetrics.downlink.toFixed(1)} Mbps`
                          : 'No expuesta'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Latencia real</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-[#FAF6EE] mt-0.5 tabular-nums">
                        {!isOnline
                          ? '—'
                          : effectiveLatency !== null
                          ? `${effectiveLatency} ms`
                          : 'Midiendo...'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Red detectada</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-[#FAF6EE] mt-0.5 uppercase">
                        {isOnline ? netMetrics.effectiveType || 'En línea' : 'Offline'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 p-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Estado global</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-[#FAF6EE] mt-0.5">
                        {connectionQuality}
                      </p>
                    </div>
                  </div>

                  {lastMeasuredAt && (
                    <p className="text-[10px] font-mono tabular-nums text-slate-400">
                      Última medición al servidor: {lastMeasuredAt}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={!isOnline || measuringSpeed}
                    onClick={() => void measureConnectionNow()}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${measuringSpeed ? 'animate-spin' : ''}`} />
                    {measuringSpeed ? 'Midiendo velocidad...' : 'Medir velocidad y latencia ahora'}
                  </button>
                </div>
              )}
            </div>

            <div ref={palettePopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setPalettePopoverOpen((v) => !v)}
                aria-label="Cambiar plantilla de colores"
                title="Plantillas de color: Noche y Oro, Ecológico, Gótico, Aura, Floral, Metal, Oro"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/15 p-1.5 sm:px-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap"
              >
                <Palette className="w-4 h-4" />
                <span className="hidden xl:inline">Plantilla</span>
              </button>
              {palettePopoverOpen && (
                <div
                  role="dialog"
                  aria-label="Selector rápido de plantillas visuales"
                  className="absolute right-0 mt-2 w-64 rounded-xl border fabro-shell-surface p-3.5 shadow-xl z-50"
                >
                  <ThemeTemplatePicker
                    compact
                    onSelect={() => setPalettePopoverOpen(false)}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {activeSection !== 'social-panel' && activeSection !== 'mensajes' && activeSection !== 'comunidad' && (
              <button
                type="button"
                onClick={() => setSocialBubbleOpen((v) => !v)}
                title="Abrir Globo Social FABRO en paralelo"
                className={`hidden md:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  socialBubbleOpen
                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Globo Social</span>
              </button>
            )}

            {activeSection !== 'ia-panel' && (
              <button
                type="button"
                onClick={() => handleSelectSection('ia-panel')}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sector IA</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelectSection('inicio')}
              aria-label="FABRO Trébol · Ir a Inicio"
              title="Ir a Inicio"
              className="ml-0.5 pl-1.5 border-l border-slate-200/80 dark:border-white/10 shrink-0 cursor-pointer focus:outline-none"
            >
              <FabroLogo size={28} />
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Viewport */}
        <main className="flex-1 w-full max-w-[1340px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-10 min-w-0">
          {completedAlert && (
            <div
              role="status"
              className="no-print mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold">
                    Hábito completado: {completedAlert.habit.name}
                  </p>
                  <p className="text-[11px] opacity-85 font-mono tabular-nums">
                    Bloque de {completedAlert.habit.durationMinutes} min finalizado
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startHabit(completedAlert.habit.id)}
                  className="rounded-lg border border-emerald-600/30 bg-white dark:bg-[#070B17] px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:border-emerald-500 cursor-pointer whitespace-nowrap"
                >
                  Repetir bloque
                </button>
                <button
                  type="button"
                  onClick={dismissCompletedAlert}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                >
                  Aceptar y silenciar
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <div className="no-print mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="break-words">{actionError}</span>
              </div>
              <button
                type="button"
                onClick={clearActionError}
                className="p-1 text-red-600 dark:text-red-300 hover:opacity-75 cursor-pointer shrink-0"
                aria-label="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {children}
          <footer className="no-print mt-10 pt-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => handleSelectSection('inicio')}
              aria-label="FABRO Trébol · Volver arriba e Inicio"
              className="shrink-0 cursor-pointer focus:outline-none"
            >
              <FabroLogo size={28} />
            </button>
            <p className="text-left sm:text-right">
              FABRO 2.0 — Estudio, Bienestar y Salud, Red Social, Inteligencia Artificial y Conectividad · Aportada por{' '}
              <strong className="text-slate-700 dark:text-[#FAF6EE]">Jorge Luis Correa</strong>
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Thumb Navigation (Safe Area Aware) */}
      <nav
        aria-label="Navegación móvil"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t fabro-glass grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
      >
        {(['inicio', 'estudio-panel', 'bienestar-panel', 'social-panel'] as NavSectionId[]).map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectSection(id)}
              className={`min-h-[54px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer ${
                active ? 'text-violet-600 dark:text-[#E5B842] font-semibold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[64px]">{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`min-h-[54px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer ${
            mobileMenuOpen || isDrawerSection ? 'text-violet-600 dark:text-[#E5B842] font-semibold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Menu className="w-4 h-4" />
          <span>Sectores</span>
        </button>
      </nav>

      {/* Mobile Full Ecosystem Drawer (Left-Anchored Sectors Menu) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-start bg-black/60">
          <div className="w-76 max-w-[85vw] h-full fabro-shell-surface border-r p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <span className="font-display text-xs font-bold uppercase tracking-[0.14em] fabro-gold-accent">
                Sectores FABRO
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="pt-3 pb-2">
              <input
                type="search"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Buscar módulo..."
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-1.5 text-xs text-slate-900 dark:text-[#FAF6EE]"
              />
            </div>
            <div className="flex-1 overflow-y-auto py-2 space-y-3">
              {CATEGORY_ORDER.map((cat) => {
                const items = filteredNavItems.filter((i) => i.category === cat.id);
                if (items.length === 0) return null;
                return (
                  <div key={cat.id} className="space-y-1">
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {cat.label}
                    </p>
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectSection(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                            active
                              ? 'fabro-accent-pill font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-white/10">
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}

      <div className="no-print">
        <SocialFloatingBubble
          open={socialBubbleOpen}
          onToggle={() => setSocialBubbleOpen((v) => !v)}
          onOpenFullSocial={() => {
            setSocialBubbleOpen(false);
            handleSelectSection('social-panel');
          }}
        />
        <GlobalAudioMiniPlayer />
      </div>
    </div>
  );
};
