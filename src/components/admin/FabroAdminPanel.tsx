import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Compass,
  FileSearch,
  FileText,
  Flag,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Menu,
  Moon,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  ADMIN_NAV_SECTIONS,
  ROLE_META,
  type AdminNavSectionId,
} from '../../types/admin';
import { AdminAuditSecurityConfig } from './AdminAuditSecurityConfig';
import { AdminDashboardAndStats } from './AdminDashboardAndStats';
import { AdminReportsAndModeration } from './AdminReportsAndModeration';
import { AdminRequestsIdeasSectors } from './AdminRequestsIdeasSectors';
import { AdminUsersAndRoles } from './AdminUsersAndRoles';

const SECTION_ICONS: Record<AdminNavSectionId, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />,
  usuarios: <Users className="h-4 w-4" />,
  denuncias: <Flag className="h-4 w-4" />,
  roles_permisos: <KeyRound className="h-4 w-4" />,
  administradores_moderadores: <ShieldCheck className="h-4 w-4" />,
  solicitudes_sectores: <Send className="h-4 w-4" />,
  ideas_propuestas: <Lightbulb className="h-4 w-4" />,
  sectores_modulos: <Compass className="h-4 w-4" />,
  publicaciones: <FileText className="h-4 w-4" />,
  eventos_actividades: <Calendar className="h-4 w-4" />,
  estadisticas: <BarChart3 className="h-4 w-4" />,
  auditoria: <FileSearch className="h-4 w-4" />,
  seguridad: <Shield className="h-4 w-4" />,
  configuracion: <Settings className="h-4 w-4" />,
};

export const FabroAdminPanel: React.FC = () => {
  const { authUser, navigateTo } = useEcosystem();
  const {
    checkingAccess,
    isStaff,
    staffRole,
    canOpenSection,
    allReports,
    allSectorRequests,
  } = useAdmin();

  const [activeSection, setActiveSection] = useState<AdminNavSectionId>('dashboard');
  const [darkMode, setDarkMode] = useState(false); // White minimalist default
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pendingReportsCount = useMemo(
    () => allReports.filter((r) => r.status === 'pendiente').length,
    [allReports]
  );
  const pendingRequestsCount = useMemo(
    () => allSectorRequests.filter((r) => r.status === 'pendiente').length,
    [allSectorRequests]
  );

  // Strict server-verified access guard: regular users are completely blocked
  if (checkingAccess) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-900">
        <p className="text-sm font-medium text-slate-600">
          Verificando credenciales y permisos de FABRO ADMIN en el servidor...
        </p>
      </div>
    );
  }

  if (!authUser || !isStaff || staffRole === 'usuario') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-900 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-slate-600">
          FABRO ADMIN es un centro de control privado exclusivo para administradores y moderadores
          verificados en Firestore.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('inicio', 'dashboard')}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a FABRO
        </button>
      </div>
    );
  }

  const effectiveSection: AdminNavSectionId = canOpenSection(activeSection)
    ? activeSection
    : 'dashboard';

  const selectSection = (id: AdminNavSectionId) => {
    if (!canOpenSection(id)) return;
    setActiveSection(id);
    setMobileMenuOpen(false);
  };

  const renderSidebarNav = () => (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label="Menú FABRO ADMIN">
      {ADMIN_NAV_SECTIONS.map((item) => {
        const allowed = canOpenSection(item.id);
        if (!allowed) return null;
        const active = effectiveSection === item.id;
        const badgeCount =
          item.id === 'denuncias'
            ? pendingReportsCount
            : item.id === 'solicitudes_sectores'
            ? pendingRequestsCount
            : 0;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => selectSection(item.id)}
            className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
              active
                ? darkMode
                  ? 'bg-slate-100 text-slate-950'
                  : 'bg-slate-900 text-white'
                : darkMode
                ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0">{SECTION_ICONS[item.id]}</span>
              <span className="truncate">{item.label}</span>
            </span>
            {badgeCount > 0 && (
              <span
                className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                  active ? 'text-current' : 'text-rose-600'
                }`}
              >
                {badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-sm transition-colors ${
        darkMode
          ? 'border-slate-800 bg-slate-950 text-slate-100'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      {/* Top Bar */}
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-6 ${
          darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border lg:hidden ${
              darkMode ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'
            }`}
            aria-label="Abrir menú de administración"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-semibold tracking-tight">FABRO ADMIN</span>
            </div>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {ROLE_META[staffRole].label} · {authUser.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
              darkMode
                ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Cambiar tema del panel"
          >
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{darkMode ? 'Claro' : 'Oscuro'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('inicio', 'dashboard')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
              darkMode
                ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Salir a FABRO
          </button>
        </div>
      </header>

      {/* Main Split Layout: Exact Left Sidebar + Content Area */}
      <div className="flex min-h-[72vh]">
        {/* Desktop Left Sidebar */}
        <aside
          className={`hidden w-64 shrink-0 flex-col border-r lg:flex ${
            darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/70'
          }`}
        >
          {renderSidebarNav()}
          <div
            className={`border-t px-4 py-3 text-[11px] ${
              darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
            }`}
          >
            Plan gratuito Spark ($0) · Reglas RBAC en servidor
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[135] flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              className={`relative z-10 flex h-full w-72 max-w-[85vw] flex-col shadow-2xl ${
                darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
                <span className="text-sm font-semibold">FABRO ADMIN</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {renderSidebarNav()}
            </div>
          </div>
        )}

        {/* Active Section Workspace */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {(effectiveSection === 'dashboard' || effectiveSection === 'estadisticas') && (
            <AdminDashboardAndStats
              mode={effectiveSection}
              darkMode={darkMode}
              onNavigateSection={selectSection}
            />
          )}

          {(effectiveSection === 'usuarios' ||
            effectiveSection === 'roles_permisos' ||
            effectiveSection === 'administradores_moderadores') && (
            <AdminUsersAndRoles mode={effectiveSection} darkMode={darkMode} />
          )}

          {(effectiveSection === 'denuncias' || effectiveSection === 'publicaciones') && (
            <AdminReportsAndModeration mode={effectiveSection} darkMode={darkMode} />
          )}

          {(effectiveSection === 'solicitudes_sectores' ||
            effectiveSection === 'ideas_propuestas' ||
            effectiveSection === 'sectores_modulos' ||
            effectiveSection === 'eventos_actividades') && (
            <AdminRequestsIdeasSectors mode={effectiveSection} darkMode={darkMode} />
          )}

          {(effectiveSection === 'auditoria' ||
            effectiveSection === 'seguridad' ||
            effectiveSection === 'configuracion') && (
            <AdminAuditSecurityConfig
              mode={effectiveSection}
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode((prev) => !prev)}
            />
          )}
        </main>
      </div>
    </div>
  );
};
