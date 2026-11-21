import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cpu,
  HeartPulse,
  Inbox,
  Landmark,
  LayoutGrid,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquare,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Radio,
  Search,
  Settings,
  Shield,
  SunMoon,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useEcosystem } from '../../context/EcosystemContext';
import { useRadio } from '../../context/RadioContext';
import { CULTURE_DISCIPLINES } from '../../data/cultureCatalog';
import {
  ALL_SUBMENUS,
  FABRO_THEMES,
  SECTOR_PALETTES,
  SECTORS_CATALOG,
} from '../../data/ecosystemCatalog';
import { isInstalledDeviceApp } from '../../lib/firebase';
import type { FiveSectorId, SectorId, SubmenuId } from '../../types/ecosystem';
import { FabroBrandMark } from '../brand/FabroBrandMark';
import { ScreenIndicatorBar } from '../navigation/ScreenNavigationEffects';
import { ConnectionSpeedBadge } from './ConnectionSpeedBadge';
import { QuickActionsBar } from './QuickActionsBar';
import { RightContextPanel } from './RightContextPanel';

const SECTOR_ICONS: Record<FiveSectorId, React.FC<{ className?: string }>> = {
  estudio: BookOpen,
  bienestar: HeartPulse,
  social: MessageSquare,
  ia: Cpu,
  configuracion: Settings,
};

interface TooltipAnchor {
  label: string;
  top: number;
}

export const HybridShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    theme,
    setTheme,
    sector,
    submenu,
    navigateTo,
    goBack,
    canGoBack,
    profile,
    pinnedTools,
    isToolPinned,
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    rightPanelOpen,
    setRightPanelOpen,
    swipeNextScreen,
    swipePrevScreen,
    screenTransitionTick,
    authUser,
    openAuthModal,
    signOutAccount,
    inboxItems,
    setOrganizerActiveTab,
    openSocialProfileModal,
  } = useEcosystem();

  const {
    isStaff,
    allReports,
    openParticipationModal,
    isSectorDisabledByAdmin,
  } = useAdmin();

  const {
    openRadioModal,
    currentStation: activeRadioStation,
    status: radioStatus,
  } = useRadio();

  const pendingReportsBadge = useMemo(
    () =>
      isStaff
        ? allReports.filter((r) => r.status === 'pendiente' || r.status === 'en_revision').length
        : 0,
    [isStaff, allReports]
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState<TooltipAnchor | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSector, setMobileExpandedSector] = useState<FiveSectorId>(
    sector === 'inicio' ||
      sector === 'hoy' ||
      sector === 'herramientas' ||
      sector === 'cultura' ||
      sector === 'deportes' ||
      sector === 'admin'
      ? 'social'
      : sector
  );
  const [globalSearch, setGlobalSearch] = useState('');
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);

  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileThemeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const headerSearchRef = useRef<HTMLDivElement | null>(null);
  const touchSwipeRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);

  React.useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const targetNode = e.target as Node;
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(targetNode) &&
        !(mobileThemeTriggerRef.current && mobileThemeTriggerRef.current.contains(targetNode))
      ) {
        setThemeMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(targetNode)) {
        setNotifOpen(false);
      }
      if (headerSearchRef.current && !headerSearchRef.current.contains(targetNode)) {
        setHeaderSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const activeSectorMeta = SECTORS_CATALOG.find((s) => s.id === sector);
  const activeSubmenuMeta = ALL_SUBMENUS.find((s) => s.id === submenu);

  const activeSectorAccent = useMemo(() => {
    if (sector === 'hoy') return '#06B6D4';
    if (sector === 'herramientas') return '#0EA5E9';
    if (sector === 'cultura') return '#9A3412';
    if (sector === 'deportes') return '#059669';
    if (sector === 'admin') return '#0F172A';
    if (sector === 'inicio') return 'var(--fabro-accent)';
    return SECTOR_PALETTES[sector]?.primary || 'var(--fabro-accent)';
  }, [sector]);

  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{
      id: string;
      sector: SectorId;
      submenu: SubmenuId;
      label: string;
      groupLabel: string;
      description: string;
    }> = [];
    if (
      'musica música afinador digital cromatico cromático guitarra bajo cancionero cancioneros acordes metronomo metrónomo transpositor escalas oido pdf'.includes(q) ||
      q.includes('afin') ||
      q.includes('cancion') ||
      q.includes('acord') ||
      q.includes('metron') ||
      q.includes('music') ||
      q.includes('músic')
    ) {
      results.push({
        id: 'music-suite-direct',
        sector: 'herramientas',
        submenu: 'centro-herramientas',
        label: 'MÚSICA · Afinador Digital y FABRO Cancioneros',
        groupLabel: '5. Herramientas · Música',
        description: 'Afinador con micrófono real, cancioneros con PDF, metrónomo, acordes y entrenador.',
      });
    }
    if ('deportes futbol fútbol liga partidos fixture tabla noticias seleccion'.includes(q) || q.includes('deport')) {
      results.push({
        id: 'deportes-direct',
        sector: 'deportes',
        submenu: 'deportes-panel',
        label: '3. Deportes · FABRO DEPORTES',
        groupLabel: 'Sector principal',
        description: 'Fútbol, ligas, fixtures, tablas y noticias deportivas actualizadas.',
      });
    }
    if ('temas colores apariencia midnight purple cyber blue neon green galaxy obsidian arctic minimal white sunset emerald gold brillo'.includes(q) || q.includes('tema')) {
      results.push({
        id: 'temas-fabro-direct',
        sector: 'configuracion',
        submenu: 'config-general',
        label: 'TEMAS FABRO · Galería de 10 plantillas y brillo',
        groupLabel: '6. Configuración',
        description: 'Personalización completa de colores, tema del sistema e intensidad de brillo.',
      });
    }
    if (
      'hoy y cosmos hora reloj clima tiempo temperatura luna lunar horoscopo horóscopo signo zodiaco frases comunidad aportes'
        .includes(q)
    ) {
      results.push({
        id: 'hoy-cosmos',
        sector: 'hoy',
        submenu: 'hoy-cosmos',
        label: 'Hoy y Cosmos · Hora, Clima, Luna, Horóscopo y Frases',
        groupLabel: 'Pantalla informativa',
        description: 'Reloj en vivo, clima Open-Meteo, fase lunar, signos y panel comunitario de frases.',
      });
    }
    if (
      'herramientas panel multiuso calculadora cientifica porcentajes regla de tres conversor unidades cronometro regresiva gastos propina contrasenas claves texto'
        .includes(q)
    ) {
      results.push({
        id: 'centro-herramientas',
        sector: 'herramientas',
        submenu: 'centro-herramientas',
        label: 'Panel de Herramientas · Calculadora, Conversor y Suite Multiuso',
        groupLabel: 'Centro unificado',
        description: 'Calculadora científica, conversor universal, cronómetro, divisor de gastos, claves y todas las utilidades.',
      });
    }
    if (
      'fabro deportes futbol liga profesional copa argentina libertadores champions premier nba tenis formula 1 rugby resultados partidos en vivo tablas posiciones noticias deportivas equipos jugadores'
        .includes(q)
    ) {
      results.push({
        id: 'fabro-deportes-direct',
        sector: 'bienestar',
        submenu: 'fabro-deportes',
        label: 'FABRO DEPORTES · Partidos, Tablas, Noticias y Herramientas',
        groupLabel: 'Centro Deportivo',
        description: 'Fútbol argentino e internacional, NBA, Tenis, F1, resultados, posiciones y noticias deportivas en vivo.',
      });
    }
    if (
      'fabro cultura noticias culturales actualidad cultural arte musica literatura cine teatro danza fotografia historia museos bibliotecas artesanias gastronomia folclore turismo filosofia ciencia indigena urbana videojuegos ambiental ciudadana genealogia coleccionismo festivales muro cultural academia'
        .includes(q)
    ) {
      results.push({
        id: 'cultura-inicio',
        sector: 'cultura',
        submenu: 'cultura-inicio',
        label: 'FABRO Cultura · Noticias Culturales, Disciplinas y Muro',
        groupLabel: 'Sector cultural',
        description: 'Noticias culturales en actualización, 24 disciplinas artísticas, talleres gratuitos, biblioteca abierta y muro cultural.',
      });
    }
    for (const disc of CULTURE_DISCIPLINES) {
      if (
        `${disc.label} ${disc.tagline} ${disc.category} ${disc.tools.join(' ')}`
          .toLowerCase()
          .includes(q)
      ) {
        results.push({
          id: `cultura-${disc.id}`,
          sector: 'cultura',
          submenu: 'cultura-inicio',
          label: `${disc.label} · FABRO Cultura`,
          groupLabel: `Cultura · ${disc.category}`,
          description: disc.tagline,
        });
      }
    }
    for (const item of ALL_SUBMENUS) {
      if (
        `${item.label} ${item.description} ${item.groupLabel} ${item.keywords}`
          .toLowerCase()
          .includes(q)
      ) {
        results.push({
          id: item.id,
          sector: item.sector,
          submenu: item.id,
          label: item.label,
          groupLabel: item.groupLabel,
          description: item.description,
        });
      }
    }
    if (
      isStaff &&
      'fabro admin administracion moderacion denuncias roles permisos auditoria seguridad sectores solicitudes'
        .includes(q)
    ) {
      results.push({
        id: 'admin-dashboard',
        sector: 'admin',
        submenu: 'admin-dashboard',
        label: 'FABRO ADMIN · Panel de Administración y Moderación',
        groupLabel: 'Centro privado de control',
        description: 'Gestión de usuarios, denuncias, roles, sectores, ideas, auditoría y seguridad.',
      });
    }
    return results.slice(0, 8);
  }, [globalSearch, isStaff]);

  const handleMainTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    let node = e.target as HTMLElement | null;
    let ignore = false;
    while (node && node !== e.currentTarget) {
      const tag = node.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        node.isContentEditable ||
        node.dataset.noSwipe === 'true' ||
        node.dataset.swipeGallery === 'true' ||
        node.scrollWidth > node.clientWidth + 6
      ) {
        ignore = true;
        break;
      }
      node = node.parentElement;
    }
    touchSwipeRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      ignore,
    };
  };

  const handleMainTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const start = touchSwipeRef.current;
    touchSwipeRef.current = null;
    if (!start || start.ignore || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 85 && Math.abs(dy) < 48) {
      if (dx < 0) swipeNextScreen();
      else swipePrevScreen();
    }
  };

  const installedDevice = isInstalledDeviceApp();

  const showCollapsedTip = (label: string, el: HTMLElement) => {
    if (!sidebarCollapsed) return;
    const rect = el.getBoundingClientRect();
    setSidebarTooltip({ label, top: rect.top + rect.height / 2 });
  };

  const hideCollapsedTip = () => {
    setSidebarTooltip(null);
  };

  const navItemClass = (isActive: boolean) =>
    `group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
      sidebarCollapsed ? 'justify-center px-0' : ''
    } ${
      isActive
        ? 'font-semibold text-[var(--fabro-text)] bg-[color-mix(in_srgb,var(--fabro-sector-accent)_14%,transparent)] border-[color-mix(in_srgb,var(--fabro-sector-accent)_55%,transparent)] shadow-[0_4px_14px_-6px_color-mix(in_srgb,var(--fabro-sector-accent)_45%,transparent)]'
        : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
    }`;

  return (
    <div
      className="min-h-[100dvh] fabro-bg flex overflow-x-hidden"
      style={{ '--fabro-sector-accent': activeSectorAccent } as React.CSSProperties}
    >
      {/* Desktop Collapsible Left Sidebar — 240px Expanded / 72px Compact */}
      <aside
        aria-label="Menú principal del ecosistema FABRO"
        className={`hidden lg:flex lg:flex-col lg:shrink-0 border-r fabro-border fabro-surface transition-[width] duration-200 sticky top-0 h-[100dvh] z-20 ${
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'
        }`}
      >
        {/* Discreet Circular Collapse Toggle Button on Sidebar Border */}
        <button
          type="button"
          onClick={() => {
            setSidebarCollapsed((v) => !v);
            setSidebarTooltip(null);
          }}
          aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          title={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          className="absolute -right-3.5 top-3.5 z-30 w-7 h-7 rounded-full border fabro-border fabro-surface shadow-sm flex items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Top Sidebar Brand / Compact Anchor */}
        <div
          className={`h-14 border-b fabro-border flex items-center shrink-0 ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => navigateTo('social', 'perfil-social')}
            onMouseEnter={(e) => showCollapsedTip('FABRO · Mi Perfil (Inicio)', e.currentTarget)}
            onMouseLeave={hideCollapsedTip}
            className="cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-[var(--fabro-accent)]"
          >
            {sidebarCollapsed ? (
              <span className="w-9 h-9 rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center font-display font-extrabold text-sm fabro-logo-text">
                F
              </span>
            ) : (
              <FabroBrandMark size="sm" showIdentity />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5 space-y-3.5">
          {/* Inicio principal: Mi Perfil */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider uppercase fabro-muted/90">
                Inicio principal
              </p>
            )}
            <button
              type="button"
              onClick={() => navigateTo('social', 'perfil-social')}
              onMouseEnter={(e) => showCollapsedTip('Mi Perfil (Inicio)', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Mi Perfil — Inicio principal"
              className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              } ${
                sector === 'social'
                  ? 'font-semibold text-[var(--fabro-text)]'
                  : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
              }`}
              style={
                sector === 'social'
                  ? {
                      backgroundColor: `${SECTOR_PALETTES.social.primary}1F`,
                      borderColor: `${SECTOR_PALETTES.social.primary}66`,
                      boxShadow: `0 4px 14px -6px ${SECTOR_PALETTES.social.shadowRgba}`,
                    }
                  : undefined
              }
            >
              {sector === 'social' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{ backgroundColor: SECTOR_PALETTES.social.primary }}
                />
              )}
              <User
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  sector === 'social' ? 'translate-x-0.5 text-[#7C3AED] dark:text-[#C4B5FD]' : ''
                }`}
              />
              {!sidebarCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Mi Perfil</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                      sector === 'social' ? 'rotate-90' : ''
                    }`}
                  />
                </>
              )}
            </button>

            {!sidebarCollapsed && sector === 'social' && (
              <div className="ml-4 pl-2.5 border-l fabro-border/80 py-0.5 space-y-0.5">
                {(SECTORS_CATALOG.find((s) => s.id === 'social')?.submenus || []).map((sub) => {
                  const subActive = submenu === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => navigateTo('social', sub.id)}
                      className={`relative w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                        subActive
                          ? 'fabro-accent-soft font-semibold'
                          : 'fabro-muted hover:text-[var(--fabro-text)]'
                      }`}
                    >
                      <span className="truncate">{sub.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sectores principales: 1- Estudio, 2- Cultura, 3- Bienestar, 4- Configuración */}
          <div className="space-y-1 pt-2.5 border-t fabro-border/75">
            {!sidebarCollapsed && (
              <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider uppercase fabro-muted/90">
                Sectores
              </p>
            )}

            {/* 1. Estudio */}
            {(() => {
              const sec = SECTORS_CATALOG.find((s) => s.id === 'estudio')!;
              const isSelected = sector === 'estudio';
              return (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => navigateTo('estudio', sec.defaultSubmenu)}
                    onMouseEnter={(e) => showCollapsedTip('1. Estudio', e.currentTarget)}
                    onMouseLeave={hideCollapsedTip}
                    aria-label="1. Estudio"
                    className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                      sidebarCollapsed ? 'justify-center px-0' : ''
                    } ${
                      isSelected
                        ? 'font-semibold text-[var(--fabro-text)]'
                        : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${sec.palette.primary}1F`,
                            borderColor: `${sec.palette.primary}66`,
                            boxShadow: `0 4px 14px -6px ${sec.palette.shadowRgba}`,
                          }
                        : undefined
                    }
                  >
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                        style={{ backgroundColor: sec.palette.primary }}
                      />
                    )}
                    <BookOpen
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isSelected ? 'translate-x-0.5' : ''
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">1. Estudio</span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                            isSelected ? 'rotate-90' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>
                  {!sidebarCollapsed && isSelected && (
                    <div className="ml-4 pl-2.5 border-l fabro-border/80 py-0.5 space-y-0.5">
                      {sec.submenus.map((sub) => {
                        const subActive = submenu === sub.id;
                        const pinned = isToolPinned('estudio', sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => navigateTo('estudio', sub.id)}
                            className={`relative w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                              subActive
                                ? 'fabro-accent-soft font-semibold'
                                : 'fabro-muted hover:text-[var(--fabro-text)]'
                            }`}
                          >
                            <span className="truncate">{sub.shortLabel}</span>
                            {pinned && (
                              <Pin className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. Cultura */}
            <button
              type="button"
              onClick={() => navigateTo('cultura', 'cultura-inicio')}
              onMouseEnter={(e) => showCollapsedTip('2. Cultura', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="2. Cultura"
              className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              } ${
                sector === 'cultura'
                  ? 'font-semibold text-[var(--fabro-text)]'
                  : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
              }`}
              style={
                sector === 'cultura'
                  ? {
                      backgroundColor: 'rgba(154, 52, 18, 0.14)',
                      borderColor: 'rgba(154, 52, 18, 0.55)',
                      boxShadow: '0 4px 14px -6px rgba(154, 52, 18, 0.35)',
                    }
                  : undefined
              }
            >
              {sector === 'cultura' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-[#9A3412]"
                />
              )}
              <Landmark
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  sector === 'cultura' ? 'translate-x-0.5 text-[#9A3412] dark:text-amber-400' : ''
                }`}
              />
              {!sidebarCollapsed && <span className="truncate flex-1 text-left">2. Cultura</span>}
            </button>

            {/* 3. Deportes (Sector principal dedicado) */}
            {(() => {
              const isSportsActive = sector === 'deportes';
              return (
                <button
                  type="button"
                  onClick={() => navigateTo('deportes', 'deportes-panel')}
                  onMouseEnter={(e) => showCollapsedTip('3. Deportes', e.currentTarget)}
                  onMouseLeave={hideCollapsedTip}
                  aria-label="3. Deportes"
                  className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                    sidebarCollapsed ? 'justify-center px-0' : ''
                  } ${
                    isSportsActive
                      ? 'font-semibold text-[var(--fabro-text)]'
                      : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
                  }`}
                  style={
                    isSportsActive
                      ? {
                          backgroundColor: 'rgba(5, 150, 105, 0.14)',
                          borderColor: 'rgba(5, 150, 105, 0.55)',
                          boxShadow: '0 4px 14px -6px rgba(5, 150, 105, 0.35)',
                        }
                      : undefined
                  }
                >
                  {isSportsActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-[#059669]"
                    />
                  )}
                  <Trophy
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      isSportsActive
                        ? 'translate-x-0.5 text-[#059669] dark:text-[#34D399]'
                        : 'text-[#059669] dark:text-[#34D399]'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1 text-left">3. Deportes</span>
                  )}
                </button>
              );
            })()}

            {/* 4. Bienestar */}
            {(() => {
              const sec = SECTORS_CATALOG.find((s) => s.id === 'bienestar')!;
              const isSelected = sector === 'bienestar';
              return (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => navigateTo('bienestar', sec.defaultSubmenu)}
                    onMouseEnter={(e) => showCollapsedTip('4. Bienestar', e.currentTarget)}
                    onMouseLeave={hideCollapsedTip}
                    aria-label="4. Bienestar"
                    className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                      sidebarCollapsed ? 'justify-center px-0' : ''
                    } ${
                      isSelected
                        ? 'font-semibold text-[var(--fabro-text)]'
                        : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${sec.palette.primary}1F`,
                            borderColor: `${sec.palette.primary}66`,
                            boxShadow: `0 4px 14px -6px ${sec.palette.shadowRgba}`,
                          }
                        : undefined
                    }
                  >
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                        style={{ backgroundColor: sec.palette.primary }}
                      />
                    )}
                    <HeartPulse
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isSelected ? 'translate-x-0.5' : ''
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">4. Bienestar</span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                            isSelected ? 'rotate-90' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>
                  {!sidebarCollapsed && isSelected && (
                    <div className="ml-4 pl-2.5 border-l fabro-border/80 py-0.5 space-y-0.5">
                      {sec.submenus
                        .filter((sub) => sub.id !== 'fabro-deportes')
                        .map((sub) => {
                          const subActive = submenu === sub.id;
                          const pinned = isToolPinned('bienestar', sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => navigateTo('bienestar', sub.id)}
                              className={`relative w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                                subActive
                                  ? 'fabro-accent-soft font-semibold'
                                  : 'fabro-muted hover:text-[var(--fabro-text)]'
                              }`}
                            >
                              <span className="truncate">{sub.shortLabel}</span>
                              {pinned && (
                                <Pin className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 5. Herramientas (Música: Afinador + Cancioneros, Calculadora, Calendario Visual) */}
            <button
              type="button"
              onClick={() => navigateTo('herramientas', 'centro-herramientas')}
              onMouseEnter={(e) => showCollapsedTip('5. Herramientas · Música y Utilidades', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="5. Herramientas"
              className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              } ${
                sector === 'herramientas'
                  ? 'font-semibold text-[var(--fabro-text)]'
                  : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
              }`}
              style={
                sector === 'herramientas'
                  ? {
                      backgroundColor: 'rgba(14, 165, 233, 0.14)',
                      borderColor: 'rgba(14, 165, 233, 0.55)',
                      boxShadow: '0 4px 14px -6px rgba(14, 165, 233, 0.35)',
                    }
                  : undefined
              }
            >
              {sector === 'herramientas' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-[#0EA5E9]"
                />
              )}
              <Calculator
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  sector === 'herramientas' ? 'translate-x-0.5 text-[#0EA5E9]' : ''
                }`}
              />
              {!sidebarCollapsed && (
                <span className="truncate flex-1 text-left">5. Herramientas</span>
              )}
            </button>

            {/* 6. Configuración (TEMAS FABRO, IA BYOK, Seguridad, Notificaciones) */}
            {(() => {
              const sec = SECTORS_CATALOG.find((s) => s.id === 'configuracion')!;
              const isSelected = sector === 'configuracion' || sector === 'ia';
              return (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => navigateTo('configuracion', sec.defaultSubmenu)}
                    onMouseEnter={(e) => showCollapsedTip('6. Configuración · TEMAS FABRO', e.currentTarget)}
                    onMouseLeave={hideCollapsedTip}
                    aria-label="6. Configuración"
                    className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                      sidebarCollapsed ? 'justify-center px-0' : ''
                    } ${
                      isSelected
                        ? 'font-semibold text-[var(--fabro-text)]'
                        : 'border-transparent fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]/70'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${sec.palette.primary}1F`,
                            borderColor: `${sec.palette.primary}66`,
                            boxShadow: `0 4px 14px -6px ${sec.palette.shadowRgba}`,
                          }
                        : undefined
                    }
                  >
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                        style={{ backgroundColor: sec.palette.primary }}
                      />
                    )}
                    <Settings
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isSelected ? 'translate-x-0.5' : ''
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">6. Configuración</span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                            isSelected ? 'rotate-90' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>

                  {!sidebarCollapsed && isSelected && (
                    <div className="ml-4 pl-2.5 border-l fabro-border/80 py-0.5 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => navigateTo('ia', 'claves-byok')}
                        className={`relative w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center gap-2 ${
                          sector === 'ia'
                            ? 'fabro-accent-soft font-semibold'
                            : 'fabro-muted hover:text-[var(--fabro-text)]'
                        }`}
                      >
                        <Cpu className="w-3.5 h-3.5 shrink-0 text-[#4F46E5] dark:text-[#A5B4FC]" />
                        <span className="truncate">IA BYOK</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openParticipationModal('ideas')}
                        className="relative w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center gap-2 fabro-muted hover:text-[var(--fabro-text)]"
                      >
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="truncate">Ideas nuevos sectores</span>
                      </button>

                      {sec.submenus.map((sub) => {
                        const subActive = sector === 'configuracion' && submenu === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => navigateTo('configuracion', sub.id)}
                            className={`relative w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                              subActive
                                ? 'fabro-accent-soft font-semibold'
                                : 'fabro-muted hover:text-[var(--fabro-text)]'
                            }`}
                          >
                            <span className="truncate">{sub.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Accesos rápidos */}
          <div className="space-y-1 pt-2.5 border-t fabro-border/75">
            {!sidebarCollapsed && (
              <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider uppercase fabro-muted/90">
                Accesos rápidos
              </p>
            )}
            <button
              type="button"
              onClick={() => openRadioModal()}
              onMouseEnter={(e) => showCollapsedTip('Radio Digital FABRO', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Radio Digital FABRO"
              className={navItemClass(radioStatus === 'playing')}
            >
              <Radio className="w-4 h-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
              {!sidebarCollapsed && (
                <span className="truncate flex-1 text-left">Radio Digital FABRO</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigateTo('hoy', 'hoy-cosmos')}
              onMouseEnter={(e) => showCollapsedTip('Hoy y Cosmos', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Hoy y Cosmos"
              className={navItemClass(sector === 'hoy')}
            >
              <SunMoon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Hoy y Cosmos</span>}
            </button>

            <button
              type="button"
              onClick={() => navigateTo('inicio', 'dashboard')}
              onMouseEnter={(e) => showCollapsedTip('Espacio de Widgets', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Espacio de Widgets"
              className={navItemClass(sector === 'inicio')}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Espacio Widgets</span>
                  <span className="text-[10px] font-mono tabular-nums opacity-75">
                    {pinnedTools.length}
                  </span>
                </>
              )}
            </button>

            {/* FABRO ADMIN: estrictamente oculto para usuarios comunes */}
            {isStaff && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigateTo('admin', 'admin-dashboard')}
                  onMouseEnter={(e) => showCollapsedTip('FABRO ADMIN', e.currentTarget)}
                  onMouseLeave={hideCollapsedTip}
                  aria-label="FABRO ADMIN"
                  className={`group relative w-full min-h-[38px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
                    sidebarCollapsed ? 'justify-center px-0' : ''
                  } ${
                    sector === 'admin'
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-300/80 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/60 text-[var(--fabro-text)] hover:border-slate-500'
                  }`}
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1 text-left">FABRO ADMIN</span>
                  )}
                  {!sidebarCollapsed && pendingReportsBadge > 0 && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white tabular-nums">
                      {pendingReportsBadge}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Sidebar Account Footer with Visible Sign Out */}
        <div className="p-2.5 border-t fabro-border space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => openSocialProfileModal('publicaciones')}
            onMouseEnter={(e) =>
              showCollapsedTip(
                `Mi Perfil Social · ${authUser ? authUser.displayName : profile.displayName}`,
                e.currentTarget
              )
            }
            onMouseLeave={hideCollapsedTip}
            className={`w-full flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-[var(--fabro-surface-2)]/70 transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            {profile.photoURL || authUser?.photoURL ? (
              <img
                src={profile.photoURL || authUser?.photoURL}
                alt={profile.displayName}
                className="w-8 h-8 rounded-lg object-cover border fabro-border shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg fabro-accent-soft flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold truncate">
                  {authUser ? authUser.displayName : profile.displayName}
                </p>
                <p className="text-[11px] font-mono fabro-muted truncate">
                  {authUser
                    ? `@${authUser.username}`
                    : profile.username
                    ? `@${profile.username}`
                    : 'Modo Invitado'}
                </p>
              </div>
            )}
          </button>
          {authUser && (
            <button
              type="button"
              onClick={() => void signOutAccount()}
              onMouseEnter={(e) => showCollapsedTip('Cerrar sesión', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Cerrar sesión"
              className={`w-full min-h-[38px] rounded-xl border border-rose-500/45 bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1.5 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all duration-200 ${
                sidebarCollapsed ? 'px-0' : ''
              }`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span>Cerrar sesión</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Elegant Floating Tooltip for Collapsed Sidebar (72px mode) */}
      {sidebarCollapsed && sidebarTooltip && (
        <div
          role="tooltip"
          style={{ top: sidebarTooltip.top }}
          className="hidden lg:flex fixed left-[82px] -translate-y-1/2 z-50 pointer-events-none items-center rounded-xl border fabro-border fabro-glass px-3 py-1.5 text-xs font-semibold shadow-lg whitespace-nowrap"
        >
          {sidebarTooltip.label}
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact 56px (h-14) Translucent Sticky Top Bar — Zero Horizontal Overflow on Mobile */}
        <header className="h-14 sticky top-0 z-30 border-b fabro-glass px-2 sm:px-5 flex items-center justify-between gap-1.5 sm:gap-3 w-full max-w-full">
          {/* Left Zone: Menu Button + Optional Back + Animated Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú completo"
              className="lg:hidden h-9 w-9 sm:min-h-[40px] sm:min-w-[40px] inline-flex items-center justify-center rounded-xl border fabro-border fabro-surface cursor-pointer active:scale-95 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSidebarCollapsed((v) => !v);
                setSidebarTooltip(null);
              }}
              aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
              className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border fabro-border fabro-surface cursor-pointer active:scale-95 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            {canGoBack && (
              <button
                type="button"
                onClick={goBack}
                aria-label="Volver al módulo anterior"
                className="hidden md:inline-flex min-h-[36px] items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateTo('social', 'perfil-social')}
              className="cursor-pointer shrink-0 px-0.5 sm:px-1 py-0.5 rounded-lg"
              aria-label="Ir a Mi Perfil FABRO"
            >
              <FabroBrandMark size="sm" />
            </button>

            {activeSectorMeta && (
              <span className="hidden 2xl:inline-flex items-center gap-1.5 text-xs fabro-muted truncate max-w-[180px]">
                <span aria-hidden="true">/</span>
                <span className="font-medium text-[var(--fabro-text)] truncate">
                  {activeSubmenuMeta ? activeSubmenuMeta.shortLabel : activeSectorMeta.shortTitle}
                </span>
              </span>
            )}
          </div>

          {/* Center Zone: Compact Global Search */}
          <div ref={headerSearchRef} className="relative flex-1 max-w-sm xl:max-w-md hidden md:block min-w-0">
            <Search
              className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={globalSearch}
              onFocus={() => setHeaderSearchOpen(true)}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setHeaderSearchOpen(true);
              }}
              placeholder="Buscar apuntes, organizador, calculadora, clima..."
              aria-label="Buscador global de FABRO"
              className="h-9 w-full rounded-xl border fabro-border fabro-surface-elevated pl-8 pr-8 text-xs fabro-input"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => {
                  setGlobalSearch('');
                  setHeaderSearchOpen(false);
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {headerSearchOpen && globalSearch.trim() !== '' && (
              <div
                role="listbox"
                aria-label="Resultados de búsqueda global"
                className="absolute left-0 right-0 mt-1.5 rounded-xl border fabro-border fabro-surface shadow-xl z-50 p-2 max-h-80 overflow-y-auto space-y-1"
              >
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs fabro-muted">
                    Sin resultados para «{globalSearch}».
                  </p>
                ) : (
                  searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => {
                        navigateTo(res.sector, res.submenu);
                        setGlobalSearch('');
                        setHeaderSearchOpen(false);
                      }}
                      className="w-full text-left rounded-lg px-3 py-2 hover:bg-[var(--fabro-surface-2)] transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-semibold truncate">{res.label}</p>
                      <p className="text-[11px] fabro-muted truncate">
                        {res.groupLabel} · {res.description}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Zone: Connection Speed + Radio Digital FABRO + Theme Selector + Notifications + Profile & Sign Out */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Real-time Connection Speed Monitor (Mbps & Ping) */}
            <ConnectionSpeedBadge />

            {/* Radio Digital FABRO Button (Tablet & Desktop Header; full-width mobile bar sits directly below) */}
            <button
              type="button"
              onClick={() => openRadioModal()}
              aria-label="Abrir Radio Digital FABRO en vivo"
              title={
                activeRadioStation
                  ? `Radio Digital FABRO · ${activeRadioStation.name} (${activeRadioStation.band} ${activeRadioStation.frequency})`
                  : 'Radio Digital FABRO en vivo'
              }
              className={`hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                radioStatus === 'playing'
                  ? 'border-[#0284C7] bg-[#0284C7]/12 text-[#0284C7] dark:text-[#38BDF8]'
                  : 'fabro-border fabro-surface hover:border-[#0284C7]'
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
              <span>Radio Digital FABRO</span>
              {activeRadioStation && radioStatus === 'playing' && (
                <span className="hidden xl:inline font-mono tabular-nums text-[11px] opacity-85">
                  · {activeRadioStation.band}{' '}
                  {activeRadioStation.band === 'FM'
                    ? activeRadioStation.frequency.toFixed(1)
                    : Math.round(activeRadioStation.frequency)}
                </span>
              )}
            </button>

            {/* Theme Quick Switcher (Desktop/Tablet button + shared viewport-safe popover for Mobile too) */}
            <div ref={themeMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((v) => !v)}
                aria-label="Cambiar plantilla de tema"
                className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-2.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Temas</span>
              </button>

              {themeMenuOpen && (
                <div
                  role="dialog"
                  aria-label="Selector de temas"
                  className="fixed sm:absolute right-2.5 sm:right-0 top-[104px] sm:top-auto sm:mt-2 w-80 max-w-[calc(100vw-1.25rem)] max-h-[70dvh] overflow-y-auto rounded-xl border fabro-border fabro-surface p-3.5 shadow-lg z-50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 pb-1 border-b fabro-border">
                    <p className="text-xs font-extrabold fabro-accent-text tracking-tight">
                      TEMAS FABRO ({FABRO_THEMES.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMenuOpen(false);
                        navigateTo('configuracion', 'config-general');
                      }}
                      className="text-[11px] font-bold fabro-accent-text hover:underline cursor-pointer"
                    >
                      Brillo y galería →
                    </button>
                  </div>
                  {FABRO_THEMES.map((item) => {
                    const active = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setTheme(item.id);
                          setThemeMenuOpen(false);
                        }}
                        className={`w-full text-left rounded-lg border p-2.5 text-xs transition-colors cursor-pointer ${
                          active
                            ? 'fabro-accent-border fabro-accent-soft'
                            : 'fabro-border hover:border-[var(--fabro-accent)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{item.name}</span>
                          <span className="flex items-center gap-1">
                            {item.swatches.map((hex, i) => (
                              <span
                                key={`${item.id}-${i}`}
                                className="w-3 h-3 rounded-sm border fabro-border"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </span>
                        </div>
                        <p className="text-[11px] fabro-muted mt-1">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div ref={notifMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notificaciones"
                className="h-9 inline-flex items-center justify-center gap-1 rounded-xl border fabro-border fabro-surface px-2 sm:px-2.5 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                <Bell className="w-3.5 h-3.5" strokeWidth={1.75} />
                {unreadNotifications > 0 && (
                  <span className="font-mono tabular-nums text-[11px] fabro-gold-text font-bold">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Notificaciones"
                  className="fixed sm:absolute right-2.5 sm:right-0 top-14 sm:top-auto sm:mt-2 w-80 max-w-[calc(100vw-1.25rem)] rounded-xl border fabro-border fabro-surface p-3.5 shadow-lg z-50 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Notificaciones</p>
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] fabro-accent-text font-medium hover:underline cursor-pointer"
                      >
                        Marcar leídas
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          navigateTo(n.target.sector, n.target.submenu);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left rounded-lg border fabro-border p-2.5 text-xs cursor-pointer ${
                          !n.read ? 'fabro-accent-soft' : 'fabro-surface-elevated'
                        }`}
                      >
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-[11px] fabro-muted mt-0.5">{n.detail}</p>
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t fabro-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigateTo('configuracion', 'notificaciones');
                        setNotifOpen(false);
                      }}
                      className="text-[11px] font-bold text-[#0284C7] dark:text-[#38BDF8] hover:underline cursor-pointer"
                    >
                      Configurar avisos y segundo plano
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile + 1-Tap Sign Out (Mobile & Desktop — Compact to Guarantee Zero Overflow) */}
            {authUser ? (
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openSocialProfileModal('publicaciones')}
                  title={`Abrir Mi Perfil Social (@${authUser.username})`}
                  aria-label="Abrir Mi Perfil Social"
                  className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-1.5 sm:px-2 text-xs cursor-pointer active:scale-95 shrink-0"
                >
                  {profile.photoURL || authUser.photoURL ? (
                    <img
                      src={profile.photoURL || authUser.photoURL}
                      alt={authUser.displayName}
                      className="w-6 h-6 rounded-md object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-md bg-[#7C3AED] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {authUser.displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden lg:inline font-mono font-semibold text-[11px] text-[#6D28D9] dark:text-[#C4B5FD] max-w-[88px] truncate">
                    @{authUser.username}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void signOutAccount()}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="h-9 inline-flex items-center justify-center gap-1 rounded-xl border border-rose-500/55 bg-rose-500/12 text-rose-600 dark:text-rose-400 px-2 sm:px-2.5 text-[11px] sm:text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Salir</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('sincronizar tus datos en la nube', 'login')}
                className="h-9 inline-flex items-center gap-1 rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-2.5 sm:px-3 text-xs font-semibold cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>Entrar</span>
              </button>
            )}

            {/* Right Contextual Panel Toggle (Desktop) */}
            <button
              type="button"
              onClick={() => setRightPanelOpen((v) => !v)}
              aria-label={rightPanelOpen ? 'Ocultar chat y perfil rápido' : 'Mostrar chat y perfil rápido'}
              title={rightPanelOpen ? 'Ocultar panel contextual' : 'Mostrar panel contextual'}
              className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border fabro-border fabro-surface cursor-pointer shrink-0"
            >
              {rightPanelOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Full-Width Radio Digital FABRO & Theme Strip (Guarantees Zero Header Overflow on Small Phones) */}
        <div className="sm:hidden border-b fabro-border fabro-surface px-2.5 py-2 flex items-center gap-2 w-full max-w-full">
          <button
            type="button"
            onClick={() => openRadioModal()}
            aria-label="Abrir Radio Digital FABRO en vivo"
            className={`flex-1 min-w-0 min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold cursor-pointer active:scale-[0.99] transition-colors ${
              radioStatus === 'playing'
                ? 'border-[#0284C7] bg-[#0284C7]/12 text-[#0284C7] dark:text-[#38BDF8]'
                : 'fabro-border fabro-surface-elevated hover:border-[#0284C7]'
            }`}
          >
            <Radio className="w-4 h-4 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" />
            <span className="truncate">
              {activeRadioStation && radioStatus === 'playing'
                ? `Radio Digital FABRO · ${activeRadioStation.band} ${
                    activeRadioStation.band === 'FM'
                      ? activeRadioStation.frequency.toFixed(1)
                      : Math.round(activeRadioStation.frequency)
                  }`
                : 'Radio Digital FABRO'}
            </span>
          </button>

          <button
            ref={mobileThemeTriggerRef}
            type="button"
            onClick={() => setThemeMenuOpen((v) => !v)}
            aria-label="Cambiar plantilla de tema"
            className="min-h-[40px] shrink-0 inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <span>Temas</span>
          </button>
        </div>

        {/* Workspace + Optional Desktop Right Contextual Panel */}
        <div className="flex-1 flex min-w-0">
          <main
            onTouchStart={handleMainTouchStart}
            onTouchEnd={handleMainTouchEnd}
            className="flex-1 min-w-0 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-5 pb-36 lg:pb-24"
          >
            <div className="max-w-[1180px] mx-auto space-y-5">
              <ScreenIndicatorBar />

              <div key={screenTransitionTick} className="fabro-screen-enter space-y-5">
                {sector !== 'admin' && isSectorDisabledByAdmin(sector) && (
                  <section className="rounded-2xl border border-amber-500/50 bg-amber-50/90 dark:bg-amber-950/30 p-5 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        Este sector está temporalmente pausado por administración
                      </p>
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => navigateTo('admin', 'admin-dashboard')}
                          className="rounded-lg bg-slate-900 text-white px-3 py-1.5 font-semibold cursor-pointer"
                        >
                          Gestionar en FABRO ADMIN
                        </button>
                      )}
                    </div>
                    <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                      Todos tus datos, publicaciones, archivos y usuarios permanecen intactos. Mientras el sector está en mantenimiento o pausa administrativa, podés navegar por el resto de FABRO.
                    </p>
                  </section>
                )}
                {(sector === 'admin' || !isSectorDisabledByAdmin(sector) || isStaff) && children}
              </div>

              {/* Clean Minimal Brand Footer */}
              <footer className="no-print mt-10 pt-5 border-t fabro-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs fabro-muted">
                <button
                  type="button"
                  onClick={() => navigateTo('social', 'fabro-id')}
                  className="cursor-pointer text-left"
                  aria-label="FABRO — Ecosistema Digital"
                >
                  <FabroBrandMark size="sm" showIdentity />
                </button>
                <p>Ecosistema Digital Offline-First · Privacidad local y BYOK</p>
              </footer>
            </div>
          </main>

          {rightPanelOpen && (
            <div className="hidden lg:block shrink-0">
              <RightContextPanel onClose={() => setRightPanelOpen(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer: Full Structured Menu, Submenus, Pinned Tools & Themes */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú completo de sectores y submenús"
          className="lg:hidden fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[88vw] max-w-sm h-full fabro-surface border-l fabro-border flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 border-b fabro-border flex items-center justify-between gap-2">
              <FabroBrandMark size="sm" showIdentity />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar menú"
                className="w-10 h-10 rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Mobile Quick Global Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Buscar herramienta..."
                  className="min-h-[44px] w-full rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 text-xs fabro-input"
                />
              </div>

              {globalSearch.trim() !== '' && (
                <div className="space-y-1.5">
                  {searchResults.length === 0 ? (
                    <p className="text-xs fabro-muted px-1">Sin resultados para «{globalSearch}».</p>
                  ) : (
                    searchResults.slice(0, 5).map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => {
                          navigateTo(res.sector, res.submenu);
                          setGlobalSearch('');
                          setMobileMenuOpen(false);
                        }}
                        className="w-full min-h-[44px] text-left rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs cursor-pointer"
                      >
                        <p className="font-semibold truncate">{res.label}</p>
                        <p className="text-[11px] fabro-muted truncate">{res.groupLabel}</p>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Inicio Principal: Mi Perfil */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold tracking-wider uppercase fabro-muted">
                  Inicio principal
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('social', 'perfil-social');
                      setMobileMenuOpen(false);
                    }}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                      sector === 'social' && submenu === 'perfil-social'
                        ? 'border-[#7C3AED] bg-[#7C3AED]/12 text-[#6D28D9] dark:text-[#C4B5FD]'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span className="truncate">Mi Perfil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('social', 'fabro-id');
                      setMobileMenuOpen(false);
                    }}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                      sector === 'social' && submenu !== 'perfil-social'
                        ? 'border-[#7C3AED] bg-[#7C3AED]/12 text-[#6D28D9] dark:text-[#C4B5FD]'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate">Muro Social</span>
                  </button>
                </div>
              </div>

              {/* Sectores: 1. Estudio, 2. Cultura, 3. Bienestar, 4. Configuración */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold tracking-wider uppercase fabro-muted">
                  Sectores
                </p>

                {/* 1. Estudio */}
                {(() => {
                  const sec = SECTORS_CATALOG.find((s) => s.id === 'estudio')!;
                  const expanded = mobileExpandedSector === 'estudio';
                  return (
                    <div className="rounded-xl border fabro-border fabro-surface-elevated overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setMobileExpandedSector('estudio')}
                        className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ background: sec.palette.gradientCss }}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </span>
                          <span className="truncate">1. Estudio</span>
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            expanded ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                      {expanded && (
                        <div className="px-3 pb-2.5 pt-1 border-t fabro-border space-y-1">
                          {sec.submenus.map((sub) => {
                            const active = sector === 'estudio' && submenu === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  navigateTo('estudio', sub.id);
                                  setMobileMenuOpen(false);
                                }}
                                className={`w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                                  active
                                    ? 'fabro-accent-soft font-semibold'
                                    : 'fabro-muted hover:opacity-100'
                                }`}
                              >
                                <span className="truncate">{sub.shortLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 2. Cultura */}
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('cultura', 'cultura-inicio');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                    sector === 'cultura'
                      ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-amber-300'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #9A3412, #1E3A8A)' }}
                    >
                      <Landmark className="w-3.5 h-3.5" />
                    </span>
                    <span>2. Cultura</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>

                {/* 3. Deportes (Sector principal dedicado) */}
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('deportes', 'deportes-panel');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                    sector === 'deportes'
                      ? 'border-[#059669] bg-[#059669]/12 text-[#059669] dark:text-[#34D399]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #059669, #0EA5E9)' }}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                    </span>
                    <span>3. Deportes</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>

                {/* 4. Bienestar */}
                {(() => {
                  const sec = SECTORS_CATALOG.find((s) => s.id === 'bienestar')!;
                  const expanded = mobileExpandedSector === 'bienestar';
                  return (
                    <div className="rounded-xl border fabro-border fabro-surface-elevated overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setMobileExpandedSector('bienestar')}
                        className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ background: sec.palette.gradientCss }}
                          >
                            <HeartPulse className="w-3.5 h-3.5" />
                          </span>
                          <span className="truncate">4. Bienestar</span>
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            expanded ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                      {expanded && (
                        <div className="px-3 pb-2.5 pt-1 border-t fabro-border space-y-1">
                          {sec.submenus
                            .filter((sub) => sub.id !== 'fabro-deportes')
                            .map((sub) => {
                              const active = sector === 'bienestar' && submenu === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => {
                                    navigateTo('bienestar', sub.id);
                                    setMobileMenuOpen(false);
                                  }}
                                  className={`w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                                    active
                                      ? 'fabro-accent-soft font-semibold'
                                      : 'fabro-muted hover:opacity-100'
                                  }`}
                                >
                                  <span className="truncate">{sub.shortLabel}</span>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 5. Herramientas (Música: Afinador, Cancioneros, Calculadora, Calendario) */}
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('herramientas', 'centro-herramientas');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                    sector === 'herramientas'
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/12 text-[#0284C7] dark:text-[#38BDF8]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0EA5E9, #6366F1)' }}
                    >
                      <Calculator className="w-3.5 h-3.5" />
                    </span>
                    <span>5. Herramientas y Música</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>

                {/* 6. Configuración (TEMAS FABRO + IA BYOK + Seguridad) */}
                {(() => {
                  const sec = SECTORS_CATALOG.find((s) => s.id === 'configuracion')!;
                  const expanded = mobileExpandedSector === 'configuracion' || sector === 'configuracion' || sector === 'ia';
                  return (
                    <div className="rounded-xl border fabro-border fabro-surface-elevated overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setMobileExpandedSector('configuracion')}
                        className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ background: sec.palette.gradientCss }}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </span>
                          <span className="truncate">6. Configuración</span>
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            expanded ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                      {expanded && (
                        <div className="px-3 pb-2.5 pt-1 border-t fabro-border space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigateTo('ia', 'claves-byok');
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-left text-xs flex items-center gap-2 cursor-pointer ${
                              sector === 'ia'
                                ? 'fabro-accent-soft font-semibold'
                                : 'fabro-muted hover:opacity-100'
                            }`}
                          >
                            <Cpu className="w-3.5 h-3.5 shrink-0 text-[#4F46E5] dark:text-[#A5B4FC]" />
                            <span className="truncate">IA BYOK</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              openParticipationModal('ideas');
                            }}
                            className="w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-left text-xs flex items-center gap-2 fabro-muted hover:opacity-100 cursor-pointer"
                          >
                            <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span className="truncate">Ideas nuevos sectores</span>
                          </button>

                          {sec.submenus.map((sub) => {
                            const active = sector === 'configuracion' && submenu === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  navigateTo('configuracion', sub.id);
                                  setMobileMenuOpen(false);
                                }}
                                className={`w-full min-h-[40px] rounded-lg px-2.5 py-1.5 text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                                  active
                                    ? 'fabro-accent-soft font-semibold'
                                    : 'fabro-muted hover:opacity-100'
                                }`}
                              >
                                <span className="truncate">{sub.shortLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Accesos rápidos */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold tracking-wider uppercase fabro-muted">
                  Accesos rápidos
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openRadioModal();
                  }}
                  className={`w-full min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${
                    radioStatus === 'playing'
                      ? 'border-[#0284C7] bg-[#0284C7]/12 text-[#0284C7] dark:text-[#38BDF8]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}
                    >
                      <Radio className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">Radio Digital FABRO</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('hoy', 'hoy-cosmos');
                      setMobileMenuOpen(false);
                    }}
                    className="min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <SunMoon className="w-4 h-4 shrink-0" />
                    <span className="truncate">Hoy y Cosmos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('inicio', 'dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className="min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    <span className="truncate">Widgets</span>
                  </button>
                </div>

                {isStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('admin', 'admin-dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${
                      sector === 'admin'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-400/70 bg-slate-100/80 dark:bg-slate-800/70 text-[var(--fabro-text)]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4 shrink-0" />
                      FABRO ADMIN · Panel privado
                    </span>
                    {pendingReportsBadge > 0 ? (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white tabular-nums">
                        {pendingReportsBadge}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Pinned Mobile Drawer Account & Sign-Out Footer (Always Visible in Thumb Zone) */}
            <div className="p-3.5 border-t fabro-border fabro-surface-elevated space-y-2.5 shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openSocialProfileModal('publicaciones');
                }}
                className="w-full min-h-[44px] flex items-center gap-2.5 rounded-xl border fabro-border fabro-surface px-3 py-2 text-left cursor-pointer active:scale-[0.99]"
              >
                {profile.photoURL || authUser?.photoURL ? (
                  <img
                    src={profile.photoURL || authUser?.photoURL}
                    alt={profile.displayName}
                    className="w-8 h-8 rounded-lg object-cover border fabro-border shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg fabro-accent-soft flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">
                    {authUser ? authUser.displayName : profile.displayName}
                  </p>
                  <p className="text-[11px] fabro-muted truncate">
                    {authUser
                      ? `@${authUser.username} · ${
                          installedDevice ? 'App instalada' : 'Sesión temporal web'
                        }`
                      : 'Modo Invitado · Abrir perfil'}
                  </p>
                </div>
              </button>

              {authUser ? (
                <button
                  type="button"
                  onClick={() => {
                    void signOutAccount();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[46px] rounded-xl border-2 border-rose-500/60 bg-rose-500/12 text-rose-600 dark:text-rose-400 px-4 py-2 text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Cerrar sesión</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuthModal('sincronizar tus datos en la nube', 'login');
                  }}
                  className="w-full min-h-[46px] rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-4 py-2 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>Iniciar sesión / Crear FABRO ID</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegación móvil principal"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t fabro-glass grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
      >
        {(
          [
            {
              id: 'perfil',
              label: 'Perfil',
              icon: User,
              active: sector === 'social',
              color: SECTOR_PALETTES.social.primary,
              soft: SECTOR_PALETTES.social.softBgCss,
              onClick: () => navigateTo('social', 'perfil-social'),
            },
            {
              id: 'estudio',
              label: 'Estudio',
              icon: BookOpen,
              active: sector === 'estudio',
              color: SECTOR_PALETTES.estudio.primary,
              soft: SECTOR_PALETTES.estudio.softBgCss,
              onClick: () => navigateTo('estudio', 'academico-panel'),
            },
            {
              id: 'cultura',
              label: 'Cultura',
              icon: Landmark,
              active: sector === 'cultura',
              color: '#9A3412',
              soft: 'rgba(154, 52, 18, 0.14)',
              onClick: () => navigateTo('cultura', 'cultura-inicio'),
            },
            {
              id: 'deportes',
              label: 'Deportes',
              icon: Trophy,
              active: sector === 'deportes',
              color: '#059669',
              soft: 'rgba(5, 150, 105, 0.14)',
              onClick: () => navigateTo('deportes', 'deportes-panel'),
            },
            {
              id: 'menu',
              label: 'Más',
              icon: Menu,
              active:
                mobileMenuOpen ||
                sector === 'bienestar' ||
                sector === 'herramientas' ||
                sector === 'configuracion' ||
                sector === 'ia' ||
                sector === 'admin',
              color: SECTOR_PALETTES.configuracion.primary,
              soft: SECTOR_PALETTES.configuracion.softBgCss,
              onClick: () => setMobileMenuOpen(true),
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`min-h-[54px] flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold cursor-pointer transition-all active:scale-95 ${
                item.active ? '' : 'fabro-muted'
              }`}
              style={item.active ? { color: item.color } : undefined}
            >
              <span
                className="w-8 h-6 rounded-lg flex items-center justify-center"
                style={item.active ? { backgroundColor: item.soft } : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
              </span>
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <QuickActionsBar />
    </div>
  );
};
