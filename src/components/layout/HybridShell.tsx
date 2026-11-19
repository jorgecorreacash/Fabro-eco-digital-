import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Cpu,
  HeartPulse,
  Inbox,
  LayoutGrid,
  Menu,
  MessageSquare,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Search,
  Settings,
  SlidersHorizontal,
  SunMoon,
  User,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  ALL_SUBMENUS,
  FABRO_THEMES,
  SECTOR_PALETTES,
  SECTORS_CATALOG,
} from '../../data/ecosystemCatalog';
import type { FiveSectorId, SectorId, SubmenuId } from '../../types/ecosystem';
import { FabroBrandMark } from '../brand/FabroBrandMark';
import { ScreenIndicatorBar } from '../navigation/ScreenNavigationEffects';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
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
    network,
    measureNetwork,
    rightPanelOpen,
    setRightPanelOpen,
    swipeNextScreen,
    swipePrevScreen,
    screenTransitionTick,
    authUser,
    syncStatus,
    openAuthModal,
    updatePresenceStatus,
    inboxItems,
    setOrganizerActiveTab,
  } = useEcosystem();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState<TooltipAnchor | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSector, setMobileExpandedSector] = useState<FiveSectorId>(
    sector === 'inicio' || sector === 'hoy' || sector === 'herramientas' ? 'social' : sector
  );
  const [globalSearch, setGlobalSearch] = useState('');
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);

  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const headerSearchRef = useRef<HTMLDivElement | null>(null);
  const touchSwipeRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);

  React.useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (headerSearchRef.current && !headerSearchRef.current.contains(e.target as Node)) {
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
    return results.slice(0, 8);
  }, [globalSearch]);

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
        node.dataset.noSwipe === 'true' ||
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

  const speedText = !network.isOnline
    ? 'Offline · 0.0M'
    : network.downlinkMbps !== null
    ? `${network.downlinkMbps.toFixed(1)} Mbps`
    : 'Online';

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
            onClick={() => navigateTo('social', 'fabro-id')}
            onMouseEnter={(e) => showCollapsedTip('FABRO · Ecosistema Digital', e.currentTarget)}
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
          {/* Category 1: Inicio y Agenda */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider uppercase fabro-muted/90">
                Inicio y Agenda
              </p>
            )}
            <button
              type="button"
              onClick={() => navigateTo('inicio', 'dashboard')}
              onMouseEnter={(e) => showCollapsedTip('Espacio de Trabajo', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Espacio de Trabajo"
              className={navItemClass(sector === 'inicio')}
            >
              {sector === 'inicio' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{ backgroundColor: activeSectorAccent }}
                />
              )}
              <LayoutGrid
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  sector === 'inicio' ? 'translate-x-0.5' : ''
                }`}
              />
              {!sidebarCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Espacio de Trabajo</span>
                  <span className="text-[10px] font-mono tabular-nums opacity-75">
                    {pinnedTools.length}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setOrganizerActiveTab('inbox');
                navigateTo('bienestar', 'organizador-integral');
              }}
              onMouseEnter={(e) => showCollapsedTip('Organizador Integral', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Organizador Integral"
              className={navItemClass(
                sector === 'bienestar' && submenu === 'organizador-integral'
              )}
            >
              {sector === 'bienestar' && submenu === 'organizador-integral' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{ backgroundColor: SECTOR_PALETTES.bienestar.primary }}
                />
              )}
              <Inbox
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  sector === 'bienestar' && submenu === 'organizador-integral'
                    ? 'translate-x-0.5'
                    : ''
                }`}
              />
              {!sidebarCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Organizador Integral</span>
                  {inboxItems.length > 0 && (
                    <span className="text-[10px] font-mono tabular-nums text-[#0EA5E9] font-bold">
                      {inboxItems.length}
                    </span>
                  )}
                </>
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
              {sector === 'hoy' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-[#06B6D4]"
                />
              )}
              <SunMoon
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  sector === 'hoy' ? 'translate-x-0.5' : ''
                }`}
              />
              {!sidebarCollapsed && <span className="truncate">Hoy y Cosmos</span>}
            </button>
          </div>

          {/* Category 2: Ecosistema FABRO */}
          <div className="space-y-1 pt-2.5 border-t fabro-border/75">
            {!sidebarCollapsed && (
              <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-wider uppercase fabro-muted/90">
                Ecosistema FABRO
              </p>
            )}

            <button
              type="button"
              onClick={() => navigateTo('herramientas', 'centro-herramientas')}
              onMouseEnter={(e) => showCollapsedTip('Herramientas Multiuso', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Panel de Herramientas"
              className={navItemClass(sector === 'herramientas')}
            >
              {sector === 'herramientas' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-[#0EA5E9]"
                />
              )}
              <Calculator
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  sector === 'herramientas' ? 'translate-x-0.5' : ''
                }`}
              />
              {!sidebarCollapsed && <span className="truncate">Herramientas</span>}
            </button>

            {SECTORS_CATALOG.map((sec) => {
              const Icon = SECTOR_ICONS[sec.id];
              const isSelected = sector === sec.id;
              return (
                <div key={sec.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => navigateTo(sec.id, sec.defaultSubmenu)}
                    onMouseEnter={(e) =>
                      showCollapsedTip(`${sec.number}. ${sec.shortTitle}`, e.currentTarget)
                    }
                    onMouseLeave={hideCollapsedTip}
                    aria-label={`${sec.number}. ${sec.title}`}
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
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isSelected ? 'translate-x-0.5' : ''
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">
                          {sec.number}. {sec.shortTitle}
                        </span>
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
                        const pinned = isToolPinned(sec.id, sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => navigateTo(sec.id, sub.id)}
                            className={`relative w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                              subActive
                                ? 'fabro-accent-soft font-semibold'
                                : 'fabro-muted hover:text-[var(--fabro-text)]'
                            }`}
                          >
                            <span className="truncate">{sub.shortLabel}</span>
                            {pinned && (
                              <Pin
                                className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400"
                                aria-label="Fijado en tu espacio"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Category 3: Sistema */}
          <div className="pt-2.5 space-y-1 border-t fabro-border/75">
            {!sidebarCollapsed && (
              <div className="px-2.5 flex items-center justify-between gap-2 pb-0.5">
                <p className="text-[10px] font-bold tracking-wider uppercase fabro-muted/90">
                  Sistema
                </p>
                <button
                  type="button"
                  onClick={() => navigateTo('inicio', 'dashboard')}
                  className="text-[10px] font-semibold fabro-accent-text hover:underline cursor-pointer"
                >
                  Fijadas ({pinnedTools.length})
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigateTo('configuracion', 'notificaciones')}
              onMouseEnter={(e) => showCollapsedTip('Notificaciones y PWA', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Notificaciones y PWA"
              className={navItemClass(
                sector === 'configuracion' && submenu === 'notificaciones'
              )}
            >
              {sector === 'configuracion' && submenu === 'notificaciones' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{ backgroundColor: SECTOR_PALETTES.configuracion.primary }}
                />
              )}
              <BellRing className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Notificaciones y PWA</span>}
            </button>

            <button
              type="button"
              onClick={() => navigateTo('configuracion', 'nubes-respaldos')}
              onMouseEnter={(e) => showCollapsedTip('Nube Spark y Respaldos', e.currentTarget)}
              onMouseLeave={hideCollapsedTip}
              aria-label="Nube Spark y Respaldos"
              className={navItemClass(
                sector === 'configuracion' && submenu === 'nubes-respaldos'
              )}
            >
              {sector === 'configuracion' && submenu === 'nubes-respaldos' && (
                <span
                  aria-hidden="true"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{ backgroundColor: SECTOR_PALETTES.configuracion.primary }}
                />
              )}
              <Cloud className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Nube y Respaldos</span>}
            </button>

            {!sidebarCollapsed && pinnedTools.length > 0 && (
              <div className="pt-1.5 space-y-0.5">
                {pinnedTools.slice(0, 4).map((entry) => {
                  const subMeta = ALL_SUBMENUS.find(
                    (item) => item.sector === entry.sector && item.id === entry.submenu
                  );
                  if (!subMeta) return null;
                  const active = sector === entry.sector && submenu === entry.submenu;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => navigateTo(entry.sector, entry.submenu)}
                      className={`w-full text-left px-2.5 py-1 rounded-lg text-[11px] cursor-pointer truncate flex items-center justify-between gap-2 ${
                        active
                          ? 'fabro-surface-elevated font-semibold'
                          : 'fabro-muted hover:text-[var(--fabro-text)]'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <Pin className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                        {subMeta.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Sidebar Account Footer */}
        <div className="p-2.5 border-t fabro-border space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => navigateTo('configuracion', 'config-general')}
            onMouseEnter={(e) =>
              showCollapsedTip(
                authUser ? `${authUser.displayName} (@${authUser.username})` : profile.displayName,
                e.currentTarget
              )
            }
            onMouseLeave={hideCollapsedTip}
            className={`w-full flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-[var(--fabro-surface-2)]/70 transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            {authUser?.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={authUser.displayName}
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
                  {authUser ? `@${authUser.username}` : 'Modo Invitado'}
                </p>
              </div>
            )}
          </button>
          {!sidebarCollapsed && !authUser && (
            <button
              type="button"
              onClick={() => openAuthModal('sincronizar tus datos en la nube', 'register')}
              className="w-full min-h-[36px] rounded-xl border border-[#7C3AED]/50 bg-[#7C3AED]/12 text-[#6D28D9] dark:text-[#C4B5FD] px-2.5 py-1.5 text-xs font-medium cursor-pointer active:scale-95 transition-all duration-200"
            >
              Iniciar sesión / Registrarme
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
        {/* Compact 56px (h-14) Translucent Sticky Top Bar */}
        <header className="h-14 sticky top-0 z-30 border-b fabro-glass px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left Zone: Menu Button + Optional Back + Animated Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú completo"
              className="lg:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border fabro-border fabro-surface cursor-pointer active:scale-95"
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
              className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-xl border fabro-border fabro-surface cursor-pointer active:scale-95"
            >
              <Menu className="w-4 h-4" />
            </button>

            {canGoBack && (
              <button
                type="button"
                onClick={goBack}
                aria-label="Volver al módulo anterior"
                className="min-h-[40px] lg:min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Volver</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateTo('social', 'fabro-id')}
              className="cursor-pointer shrink-0 px-1 py-0.5 rounded-lg"
              aria-label="Ir a Social FABRO"
            >
              <FabroBrandMark size="sm" />
            </button>

            {activeSectorMeta && (
              <span className="hidden 2xl:inline-flex items-center gap-1.5 text-xs fabro-muted truncate max-w-[200px]">
                <span aria-hidden="true">/</span>
                <span className="font-medium text-[var(--fabro-text)] truncate">
                  {activeSubmenuMeta ? activeSubmenuMeta.shortLabel : activeSectorMeta.shortTitle}
                </span>
              </span>
            )}
          </div>

          {/* Center Zone: Compact Global Search */}
          <div ref={headerSearchRef} className="relative flex-1 max-w-md hidden sm:block min-w-0">
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

          {/* Right Zone: Digital Network/Sync Indicator + Theme Selector + Notifications + Profile */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton compact />

            {/* Digital Network & Cloud Sync Indicator */}
            <button
              type="button"
              onClick={() => void measureNetwork()}
              title="Medir velocidad de red y estado de sincronización"
              className="h-9 inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-2.5 text-xs font-mono tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
            >
              {network.isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={1.75} />
              )}
              <span className="hidden xl:inline text-[11px]">{speedText}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  syncStatus === 'cloud-synced'
                    ? 'bg-emerald-500'
                    : syncStatus === 'syncing'
                    ? 'bg-sky-500 animate-pulse'
                    : 'bg-amber-500'
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Theme Quick Switcher */}
            <div ref={themeMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((v) => !v)}
                aria-label="Cambiar plantilla de tema"
                className="h-9 inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-2.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Temas</span>
              </button>

              {themeMenuOpen && (
                <div
                  role="dialog"
                  aria-label="Selector de temas"
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] max-h-[75dvh] overflow-y-auto rounded-xl border fabro-surface p-3.5 shadow-lg z-50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold fabro-accent-text">
                      Plantillas de color ({FABRO_THEMES.length})
                    </p>
                    <span className="text-[11px] fabro-muted">
                      {FABRO_THEMES.find((t) => t.id === theme)?.isDark ? 'Oscuro' : 'Claro'}
                    </span>
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
                            {item.swatches.map((hex) => (
                              <span
                                key={hex}
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
                className="h-9 inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
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
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border fabro-surface p-3.5 shadow-lg z-50 space-y-2.5"
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

            {/* User Profile / FABRO ID */}
            {authUser ? (
              <div className="h-9 inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-2 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => navigateTo('configuracion', 'config-general')}
                  title={`Cuenta FABRO ID (@${authUser.username})`}
                  className="inline-flex items-center gap-1.5 cursor-pointer min-w-0"
                >
                  {authUser.photoURL ? (
                    <img
                      src={authUser.photoURL}
                      alt={authUser.displayName}
                      className="w-6 h-6 rounded-md object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-md bg-[#7C3AED] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {authUser.displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden md:inline font-mono font-semibold text-[11px] text-[#6D28D9] dark:text-[#C4B5FD] max-w-[92px] truncate">
                    @{authUser.username}
                  </span>
                </button>
                <select
                  value={authUser.presenceStatus}
                  onChange={(e) =>
                    void updatePresenceStatus(
                      e.target.value as 'online' | 'focus' | 'invisible'
                    )
                  }
                  aria-label="Estado de presencia"
                  className="hidden xl:inline rounded-md border fabro-border fabro-surface-elevated px-1.5 py-0.5 text-[11px] font-medium cursor-pointer fabro-input"
                >
                  <option value="online">En línea</option>
                  <option value="focus">Enfoque</option>
                  <option value="invisible">Invisible</option>
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('sincronizar tus datos en la nube', 'login')}
                className="h-9 inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-3 text-xs font-medium cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Entrar</span>
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
                {children}
              </div>

              {/* Footer with Functional General Search (Mobile + Quick Bottom Discovery) */}
              <footer className="no-print mt-10 pt-6 border-t fabro-border space-y-4">
                <div className="rounded-2xl border fabro-surface p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold fabro-accent-text">
                        Buscador general del ecosistema
                      </p>
                      <p className="text-xs fabro-muted">
                        Encontrá cualquier sector, herramienta o pantalla (clima, luna, horóscopo, apuntes, BYOK...).
                      </p>
                    </div>
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                      <input
                        type="search"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        placeholder="Buscar clima, luna, apuntes, BYOK..."
                        aria-label="Buscador general inferior de FABRO"
                        className="w-full h-9 rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-8 text-xs fabro-input"
                      />
                      {globalSearch && (
                        <button
                          type="button"
                          onClick={() => setGlobalSearch('')}
                          aria-label="Limpiar búsqueda"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 fabro-muted cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  </div>

                  {globalSearch.trim() !== '' && (
                    <div className="pt-2 border-t fabro-border">
                      {searchResults.length === 0 ? (
                        <p className="text-xs fabro-muted">
                          No se encontraron herramientas para «{globalSearch}».
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {searchResults.map((res) => (
                            <button
                              key={res.id}
                              type="button"
                              onClick={() => {
                                navigateTo(res.sector, res.submenu);
                                setGlobalSearch('');
                              }}
                              className="text-left rounded-xl border fabro-border fabro-surface-elevated p-3 hover:border-[var(--fabro-accent)] transition-colors cursor-pointer"
                            >
                              <p className="text-xs font-semibold">{res.label}</p>
                              <p className="text-[11px] fabro-muted mt-0.5 truncate">
                                {res.groupLabel} · {res.description}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs fabro-muted">
                  <button
                    type="button"
                    onClick={() => navigateTo('social', 'fabro-id')}
                    className="cursor-pointer text-left"
                    aria-label="FABRO — Ecosistema Digital"
                  >
                    <FabroBrandMark size="sm" showIdentity />
                  </button>
                  <p>
                    FABRO es tu Ecosistema Digital Offline-First · Espacio configurable, mensajería sin conexión y BYOK
                  </p>
                </div>
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

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Mobile Quick Global Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Buscar herramienta..."
                  className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 text-xs fabro-input"
                />
              </div>

              {/* Primary Panels */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('social', 'fabro-id');
                    setMobileMenuOpen(false);
                  }}
                  className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                    sector === 'social' && submenu === 'fabro-id'
                      ? 'border-[#7C3AED] bg-[#7C3AED]/12 text-[#6D28D9] dark:text-[#C4B5FD]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  Red Social
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('inicio', 'dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                    sector === 'inicio'
                      ? 'fabro-accent-border fabro-accent-soft fabro-accent-text'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 shrink-0" />
                  Mi Espacio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('hoy', 'hoy-cosmos');
                    setMobileMenuOpen(false);
                  }}
                  className={`col-span-2 min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                    sector === 'hoy'
                      ? 'border-[#06B6D4] bg-[#06B6D4]/12 text-[#0284C7] dark:text-[#38BDF8]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <SunMoon className="w-4 h-4 shrink-0" />
                    Hoy y Cosmos · Hora, Clima, Luna y Frases
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('herramientas', 'centro-herramientas');
                    setMobileMenuOpen(false);
                  }}
                  className={`col-span-2 min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                    sector === 'herramientas'
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/12 text-[#0284C7] dark:text-[#38BDF8]'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 shrink-0" />
                    Herramientas · Calculadora y Suite Multiuso
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              {/* Pinned Shortcuts */}
              {pinnedTools.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider fabro-gold-text flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5" />
                    Fijadas en tu Espacio
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pinnedTools.map((entry) => {
                      const subMeta = ALL_SUBMENUS.find(
                        (m) => m.sector === entry.sector && m.id === entry.submenu
                      );
                      if (!subMeta) return null;
                      return (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => {
                            navigateTo(entry.sector, entry.submenu);
                            setMobileMenuOpen(false);
                          }}
                          className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-medium cursor-pointer"
                        >
                          {subMeta.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All 5 Sectors + Expandable Submenus */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider fabro-muted">
                  Menú de Sectores y Submenús
                </p>
                {SECTORS_CATALOG.map((sec) => {
                  const Icon = SECTOR_ICONS[sec.id];
                  const expanded = mobileExpandedSector === sec.id;
                  return (
                    <div
                      key={sec.id}
                      className="rounded-xl border fabro-border fabro-surface-elevated overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setMobileExpandedSector(sec.id)}
                        className="w-full min-h-[42px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ background: sec.palette.gradientCss }}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="truncate">
                            {sec.number}. {sec.title}
                          </span>
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            expanded ? 'rotate-90' : ''
                          }`}
                        />
                      </button>

                      {expanded && (
                        <div className="px-3 pb-3 pt-1 border-t fabro-border space-y-1">
                          {sec.submenus.map((sub) => {
                            const active = sector === sec.id && submenu === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  navigateTo(sec.id, sub.id);
                                  setMobileMenuOpen(false);
                                }}
                                className={`w-full min-h-[38px] rounded-lg px-2.5 py-1.5 text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                                  active
                                    ? 'fabro-accent-soft font-semibold'
                                    : 'fabro-muted hover:opacity-100'
                                }`}
                              >
                                <span className="truncate">{sub.label}</span>
                                {isToolPinned(sec.id, sub.id) && (
                                  <Pin className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Color Templates Quick Selector */}
              <div className="space-y-2 pt-2 border-t fabro-border">
                <p className="text-[11px] font-bold uppercase tracking-wider fabro-muted">
                  Plantillas de color ({FABRO_THEMES.length})
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {FABRO_THEMES.map((item) => {
                    const active = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={`min-h-[38px] rounded-lg border px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-1 cursor-pointer ${
                          active
                            ? 'fabro-accent-border fabro-accent-soft font-semibold'
                            : 'fabro-border fabro-surface-elevated'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          {item.swatches.slice(0, 2).map((hex) => (
                            <span
                              key={hex}
                              className="w-2.5 h-2.5 rounded-sm border fabro-border"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
              id: 'social',
              label: 'Social',
              icon: MessageSquare,
              active: sector === 'social',
              color: SECTOR_PALETTES.social.primary,
              soft: SECTOR_PALETTES.social.softBgCss,
              onClick: () => navigateTo('social', 'fabro-id'),
            },
            {
              id: 'inicio',
              label: 'Espacio',
              icon: LayoutGrid,
              active: sector === 'inicio',
              color: 'var(--fabro-accent)',
              soft: 'var(--fabro-accent-soft)',
              onClick: () => navigateTo('inicio', 'dashboard'),
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
              id: 'bienestar',
              label: 'Bienestar',
              icon: HeartPulse,
              active: sector === 'bienestar',
              color: SECTOR_PALETTES.bienestar.primary,
              soft: SECTOR_PALETTES.bienestar.softBgCss,
              onClick: () => navigateTo('bienestar', 'mi-vida'),
            },
            {
              id: 'menu',
              label: 'Menú',
              icon: Menu,
              active: mobileMenuOpen || sector === 'ia' || sector === 'configuracion',
              color: SECTOR_PALETTES.ia.primary,
              soft: SECTOR_PALETTES.ia.softBgCss,
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
