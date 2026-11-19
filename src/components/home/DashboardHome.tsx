import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  BookOpen,
  Calculator,
  CheckCircle2,
  Circle,
  Clock,
  Cloud,
  CloudOff,
  Cpu,
  Droplets,
  HeartPulse,
  Inbox,
  LayoutGrid,
  Maximize2,
  MessageCircleHeart,
  MessageSquare,
  Minimize2,
  Moon,
  Pause,
  Pin,
  PinOff,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  SunMoon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { POMODORO_PRESETS, useEcosystem } from '../../context/EcosystemContext';
import {
  ALL_SUBMENUS,
  FABRO_THEMES,
  SECTOR_PALETTES,
  SECTORS_CATALOG,
} from '../../data/ecosystemCatalog';
import { getLunarStatus, ZODIAC_SIGNS } from '../../services/cosmosWeatherService';
import { DEFAULT_HYDRATION_SLEEP, vaultGet, vaultSet } from '../../services/localVault';
import type { FiveSectorId, HydrationSleepState, PinnedToolEntry } from '../../types/ecosystem';
import { FabroBrandMark } from '../brand/FabroBrandMark';
import {
  SwipeableWidgetRail,
  type WidgetLauncherItem,
} from '../navigation/ScreenNavigationEffects';
import { OrganizerHub } from '../organizer/OrganizerHub';

const SECTOR_ICONS: Record<
  FiveSectorId,
  React.FC<{ className?: string; strokeWidth?: number }>
> = {
  estudio: BookOpen,
  bienestar: HeartPulse,
  social: MessageSquare,
  ia: Cpu,
  configuracion: Settings,
};

function formatSeconds(sec: number): string {
  const safe = Math.max(0, sec);
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export const DashboardHome: React.FC = () => {
  const {
    theme,
    setTheme,
    profile,
    navigateTo,
    pinnedTools,
    workspaceColumns,
    setWorkspaceColumns,
    isToolPinned,
    togglePinTool,
    movePinnedTool,
    setPinnedToolSize,
    applyWorkspacePreset,
    resetPinnedTools,
    recents,
    notifications,
    unreadNotifications,
    markNotificationRead,
    network,
    measureNetwork,
    byokKeys,
    importNotice,
    dismissImportNotice,
    examplesCleared,
    clearSeedExamples,
    // Live workspace data
    pomoPresetId,
    pomoPhase,
    pomoSubject,
    pomoSecondsLeft,
    pomoRunning,
    selectPomodoroPreset,
    togglePomodoro,
    resetPomodoro,
    advancedNotes,
    agendaTasks,
    toggleAgendaTask,
    quickChatMessages,
    activeChatThreadId,
    friendsList,
    openDirectChatWithFriend,
    moodLogs,
    userQuotes,
    selectedZodiac,
    setFloatingChatOpen,
    inboxItems,
    organizerTasks,
    toggleOrganizerTask,
    dailyReview,
    setOrganizerActiveTab,
    authUser,
    syncStatus,
    openAuthModal,
    syncNowToCloud,
  } = useEcosystem();

  const [configOpen, setConfigOpen] = useState(false);
  const [hydration, setHydration] = useState<HydrationSleepState>(DEFAULT_HYDRATION_SLEEP);

  useEffect(() => {
    let active = true;
    void vaultGet<HydrationSleepState>('hydration_sleep', DEFAULT_HYDRATION_SLEEP).then((val) => {
      if (active) setHydration(val);
    });
    return () => {
      active = false;
    };
  }, []);

  const addWaterFromWorkspace = (ml: number) => {
    setHydration((prev) => {
      const next: HydrationSleepState = {
        ...prev,
        waterMl: Math.min(5000, prev.waterMl + ml),
      };
      void vaultSet('hydration_sleep', next);
      return next;
    });
  };

  const syncLabel =
    syncStatus === 'cloud-synced'
      ? 'Sincronizado en la nube'
      : syncStatus === 'syncing'
      ? 'Sincronizando con la nube...'
      : syncStatus === 'local-offline'
      ? 'Guardado localmente • Sin internet'
      : syncStatus === 'sync-error'
      ? 'Guardado local • Reintentar nube'
      : 'Modo Invitado (solo este dispositivo)';

  const top3Tasks = organizerTasks.filter((t) => t.isTop3Priority).slice(0, 3);

  const queuedOfflineCount = quickChatMessages.filter(
    (m) => m.deliveryStatus === 'queued-offline'
  ).length;

  const lunarNow = getLunarStatus();
  const zodiacMeta = ZODIAC_SIGNS.find((z) => z.id === selectedZodiac) || ZODIAC_SIGNS[0];
  const currentTimeStr = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const widgetItems: WidgetLauncherItem[] = [
    {
      id: 'w-herramientas-calc',
      title: 'Panel Multiuso',
      metric: 'Calc +',
      subtitle: 'Calculadora y suite total',
      sector: 'herramientas',
      submenu: 'centro-herramientas',
      gradientCss: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
      icon: Calculator,
    },
    {
      id: 'w-hoy-clima',
      title: 'Hora y Clima',
      metric: currentTimeStr,
      subtitle: 'Hoy y Cosmos',
      sector: 'hoy',
      submenu: 'hoy-cosmos',
      gradientCss: 'linear-gradient(135deg, #06B6D4, #2563EB)',
      icon: SunMoon,
    },
    {
      id: 'w-luna-horoscopo',
      title: `${zodiacMeta.symbol} ${zodiacMeta.name}`,
      metric: `${lunarNow.illuminationPct}%`,
      subtitle: lunarNow.phaseName,
      sector: 'hoy',
      submenu: 'hoy-cosmos',
      gradientCss: 'linear-gradient(135deg, #7C3AED, #F59E0B)',
      icon: Moon,
    },
    {
      id: 'w-frases',
      title: 'Frases Usuarios',
      metric: `${userQuotes.length}`,
      subtitle: 'Aportes locales',
      sector: 'hoy',
      submenu: 'hoy-cosmos',
      gradientCss: 'linear-gradient(135deg, #EC4899, #F59E0B)',
      icon: MessageCircleHeart,
    },
    {
      id: 'w-pomodoro',
      title: 'Pomodoro',
      metric: formatSeconds(pomoSecondsLeft),
      subtitle: pomoRunning ? 'En marcha' : pomoSubject,
      sector: 'estudio',
      submenu: 'academico-panel',
      gradientCss: SECTOR_PALETTES.estudio.gradientCss,
      icon: Clock,
    },
    {
      id: 'w-apuntes',
      title: 'Cuadernos PDF',
      metric: `${advancedNotes.length}`,
      subtitle: 'Apuntes enriquecidos',
      sector: 'estudio',
      submenu: 'materias-apuntes',
      gradientCss: 'linear-gradient(135deg, #1D4ED8, #06B6D4)',
      icon: BookOpen,
    },
    {
      id: 'w-agua',
      title: 'Hidratación',
      metric: `${hydration.waterMl} ml`,
      subtitle: `Meta ${hydration.waterGoalMl} ml`,
      sector: 'bienestar',
      submenu: 'organizacion-calorias',
      gradientCss: SECTOR_PALETTES.bienestar.gradientCss,
      icon: Droplets,
    },
    {
      id: 'w-chat',
      title: 'Chat Offline',
      metric: `${quickChatMessages.length}`,
      subtitle: queuedOfflineCount > 0 ? `${queuedOfflineCount} en cola` : 'Conectado',
      sector: 'social',
      submenu: 'mensajeria',
      gradientCss: SECTOR_PALETTES.social.gradientCss,
      icon: MessageSquare,
    },
    {
      id: 'w-byok',
      title: 'Claves BYOK',
      metric: `${byokKeys.length}`,
      subtitle: 'Sin APIs pagas',
      sector: 'ia',
      submenu: 'claves-byok',
      gradientCss: SECTOR_PALETTES.ia.gradientCss,
      icon: Cpu,
    },
  ];

  const renderPinnedToolBody = (entry: PinnedToolEntry) => {
    const subMeta = ALL_SUBMENUS.find(
      (item) => item.sector === entry.sector && item.id === entry.submenu
    );

    if (entry.key === 'estudio:academico-panel') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border fabro-border fabro-surface-elevated p-3">
            <div>
              <p className="text-[11px] font-semibold fabro-muted">
                {pomoPhase === 'focus' ? 'Enfoque activo' : 'Descanso'} · {pomoSubject}
              </p>
              <p className="font-mono text-2xl font-extrabold tabular-nums tracking-tight">
                {formatSeconds(pomoSecondsLeft)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePomodoro}
                className="min-h-[42px] md:min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB] bg-[#2563EB] text-white px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
              >
                {pomoRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {pomoRunning ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                type="button"
                onClick={resetPomodoro}
                aria-label="Reiniciar Pomodoro"
                className="min-h-[42px] min-w-[42px] md:min-h-[36px] md:min-w-[36px] inline-flex items-center justify-center rounded-xl border fabro-border fabro-surface cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {POMODORO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPomodoroPreset(preset.id)}
                className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                  pomoPresetId === preset.id
                    ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA]'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (entry.key === 'estudio:materias-apuntes') {
      return (
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2 fabro-muted">
            <span>{advancedNotes.length} cuadernos guardados localmente</span>
            <span className="font-mono tabular-nums">Offline-First</span>
          </div>
          {advancedNotes.slice(0, 2).map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => navigateTo('estudio', 'materias-apuntes')}
              className="w-full text-left rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 hover:border-[#2563EB] transition-colors cursor-pointer"
            >
              <p className="font-bold truncate">{note.title}</p>
              <p className="text-[11px] fabro-muted truncate">
                {note.subject} · {note.folder}
              </p>
            </button>
          ))}
        </div>
      );
    }

    if (entry.key === 'estudio:examenes-calendario') {
      const pending = agendaTasks.filter((t) => !t.done);
      return (
        <div className="space-y-2 text-xs">
          <p className="fabro-muted text-[11px]">
            {pending.length} pendiente{pending.length === 1 ? '' : 's'} de {agendaTasks.length} tareas
          </p>
          <div className="space-y-1.5">
            {agendaTasks.slice(0, 3).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleAgendaTask(task.id)}
                className="w-full min-h-[38px] text-left rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 flex items-center gap-2 cursor-pointer"
              >
                {task.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 fabro-muted shrink-0" />
                )}
                <span className={`truncate flex-1 ${task.done ? 'line-through fabro-muted' : 'font-semibold'}`}>
                  {task.task}
                </span>
                <span className="text-[10px] font-mono fabro-muted shrink-0">{task.date}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (entry.key === 'social:mensajeria') {
      const threadMsgs = quickChatMessages.filter(
        (m) => (m.recipientId || 'general') === activeChatThreadId
      );
      const latest = (threadMsgs.length > 0 ? threadMsgs : quickChatMessages).slice(-2);
      return (
        <div className="space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="fabro-muted">
              {queuedOfflineCount > 0
                ? `${queuedOfflineCount} mensaje(s) esperando reconexión`
                : 'Todos los mensajes guardados localmente'}
            </span>
            <button
              type="button"
              onClick={() => navigateTo('social', 'mensajeria')}
              className="font-bold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline cursor-pointer"
            >
              Abrir chat directo
            </button>
          </div>
          <div className="space-y-1.5">
            {latest.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold truncate">{m.sender}</p>
                  <p className="text-[11px] fabro-muted truncate">{m.text}</p>
                </div>
                <span className="text-[10px] font-mono fabro-muted shrink-0">{m.time}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (entry.key === 'social:amistades') {
      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] fabro-muted">
            <span>{friendsList.length} amistades guardadas</span>
            <span>Cola offline activa</span>
          </div>
          <div className="divide-y fabro-border">
            {friendsList.slice(0, 3).map((fr) => (
              <div
                key={fr.id}
                className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold truncate">{fr.displayName}</p>
                  <p className="text-[11px] fabro-muted truncate">
                    {fr.availability === 'online' ? 'En línea' : 'Sin conexión (cola lista)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openDirectChatWithFriend(fr.id)}
                  className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated hover:border-[#7C3AED] px-2.5 py-1 text-[11px] font-bold cursor-pointer shrink-0"
                >
                  Escribir
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (entry.key === 'bienestar:organizacion-calorias') {
      const pct = Math.min(100, Math.round((hydration.waterMl / hydration.waterGoalMl) * 100));
      return (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold">
              <Droplets className="w-4 h-4 text-[#10B981]" />
              Hidratación de hoy
            </span>
            <span className="font-mono font-bold tabular-nums">
              {hydration.waterMl} / {hydration.waterGoalMl} ml ({pct}%)
            </span>
          </div>
          <div className="h-2 rounded-full fabro-surface-elevated overflow-hidden border fabro-border">
            <div
              className="h-full bg-[#10B981] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addWaterFromWorkspace(250)}
              className="min-h-[38px] flex-1 rounded-xl border border-[#10B981]/50 bg-[#10B981]/10 text-[#047857] dark:text-[#34D399] font-bold cursor-pointer active:scale-95"
            >
              +250 ml
            </button>
            <button
              type="button"
              onClick={() => addWaterFromWorkspace(500)}
              className="min-h-[38px] flex-1 rounded-xl border fabro-border fabro-surface-elevated font-semibold cursor-pointer active:scale-95"
            >
              +500 ml
            </button>
          </div>
        </div>
      );
    }

    if (entry.key === 'bienestar:mi-vida') {
      const lastMood = moodLogs[0];
      return (
        <div className="space-y-2.5 text-xs">
          <p className="italic fabro-muted leading-relaxed line-clamp-2">
            «{profile.dailyPhrase}»
          </p>
          <p className="text-[11px] font-semibold">
            {lastMood
              ? `Último ánimo: ${lastMood.score}/10 · ${lastMood.emotion}`
              : 'Abrí Mi Vida para girar la Ruleta Estoica o registrar tu ánimo.'}
          </p>
        </div>
      );
    }

    if (entry.key === 'ia:claves-byok') {
      return (
        <div className="space-y-2 text-xs">
          <p className="font-semibold">
            {byokKeys.length === 0
              ? '0 claves guardadas · Modelo BYOK estricto ($0)'
              : `${byokKeys.length} clave(s) oficial(es) guardada(s) en este dispositivo`}
          </p>
          <p className="text-[11px] fabro-muted leading-relaxed">
            Ninguna API paga precargada. Pegás y probás tu propia clave oficial cuando la necesites.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2 text-xs">
        <p className="text-[11px] font-semibold fabro-muted">{subMeta?.groupLabel}</p>
        <p className="fabro-muted leading-relaxed">{subMeta?.description}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {importNotice && (
        <div className="rounded-2xl border border-[#10B981] bg-[#10B981]/10 px-4 py-3 flex items-center justify-between gap-3 text-xs font-bold text-[#047857] dark:text-[#34D399]">
          <span>{importNotice}</span>
          <button
            type="button"
            onClick={dismissImportNotice}
            className="min-h-[36px] rounded-xl border border-[#10B981]/45 px-3.5 py-1.5 text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Workspace Header & Configurator Bar */}
      <section className="rounded-2xl border fabro-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2.5 min-w-0">
            <FabroBrandMark size="lg" showIdentity />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                Espacio de Trabajo Configurable
              </h1>
              <p className="text-xs sm:text-sm fabro-muted mt-1 leading-relaxed">
                Hola, {profile.displayName}. Fijá tus herramientas favoritas de cualquier sector, ordenalas y ajustá cuántas columnas ver.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfigOpen((v) => !v)}
              aria-expanded={configOpen}
              className={`min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 transition-all whitespace-nowrap ${
                configOpen
                  ? 'fabro-accent-border bg-[var(--fabro-accent)] text-white'
                  : 'fabro-accent-border fabro-accent-soft fabro-accent-text'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {configOpen ? 'Cerrar configurador' : `Configurar herramientas (${pinnedTools.length})`}
            </button>

            <button
              type="button"
              onClick={() => navigateTo('herramientas', 'centro-herramientas')}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-[#0EA5E9]/45 bg-[#0EA5E9]/10 text-[#0284C7] dark:text-[#38BDF8] px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Calculator className="w-4 h-4" />
              Panel Multiuso
            </button>

            <button
              type="button"
              onClick={() => setFloatingChatOpen(true)}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-[#7C3AED]/45 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C4B5FD] px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              Chat Flotante
            </button>

            <div
              role="group"
              aria-label="Columnas del espacio de trabajo"
              className="hidden md:inline-flex rounded-xl border fabro-border fabro-surface-elevated p-0.5 gap-0.5"
            >
              <button
                type="button"
                onClick={() => setWorkspaceColumns(2)}
                className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  workspaceColumns === 2 ? 'fabro-surface font-bold shadow-xs' : 'fabro-muted'
                }`}
              >
                2 col
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceColumns(3)}
                className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  workspaceColumns === 3 ? 'fabro-surface font-bold shadow-xs' : 'fabro-muted'
                }`}
              >
                3 col
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigateTo('social', 'fabro-id')}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4 text-[#7C3AED]" />
              Red Social
            </button>
          </div>
        </div>

        {/* Collapsible Tool Picker & Presets */}
        {configOpen && (
          <div className="pt-5 border-t fabro-border space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 fabro-gold-text" />
                  Elegí qué herramientas fijar en tus paneles principales
                </h2>
                <p className="text-[11px] fabro-muted">
                  Tocá cualquier módulo para fijarlo o quitarlo. Se guarda automáticamente en este dispositivo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyWorkspacePreset('estudio')}
                  className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 text-[11px] font-semibold cursor-pointer hover:border-[#2563EB]"
                >
                  Modo Estudio
                </button>
                <button
                  type="button"
                  onClick={() => applyWorkspacePreset('social')}
                  className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 text-[11px] font-semibold cursor-pointer hover:border-[#7C3AED]"
                >
                  Modo Social
                </button>
                <button
                  type="button"
                  onClick={() => applyWorkspacePreset('equilibrio')}
                  className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-1 text-[11px] font-semibold cursor-pointer hover:border-[#10B981]"
                >
                  Equilibrio Diario
                </button>
                <button
                  type="button"
                  onClick={resetPinnedTools}
                  className="min-h-[36px] rounded-xl border fabro-border px-3 py-1 text-[11px] fabro-muted hover:opacity-100 cursor-pointer"
                >
                  Restaurar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {SECTORS_CATALOG.map((sec) => {
                const Icon = SECTOR_ICONS[sec.id];
                return (
                  <div
                    key={sec.id}
                    className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ background: sec.palette.gradientCss }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <p className="text-xs font-bold truncate">
                        {sec.number}. {sec.shortTitle}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {sec.submenus.map((sub) => {
                        const pinned = isToolPinned(sec.id, sub.id);
                        return (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => togglePinTool(sec.id, sub.id)}
                              className={`flex-1 min-h-[36px] rounded-lg border px-2.5 py-1 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                                pinned
                                  ? 'fabro-accent-border fabro-accent-soft font-bold'
                                  : 'fabro-border fabro-surface hover:border-[var(--fabro-accent)]'
                              }`}
                            >
                              <span className="truncate">{sub.shortLabel}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] shrink-0">
                                <Pin className={`w-3 h-3 ${pinned ? 'fill-current' : ''}`} />
                                {pinned ? 'Fijada' : 'Fijar'}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!examplesCleared && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs fabro-muted pt-3 border-t fabro-border">
            <span>
              Acceso directo sin registro: tus apuntes, flashcards, simulacro y salas activas ya están disponibles.
            </span>
            <button
              type="button"
              onClick={() => void clearSeedExamples()}
              className="underline hover:text-rose-600 cursor-pointer shrink-0"
            >
              Borrar ejemplos iniciales
            </button>
          </div>
        )}
      </section>

      {/* Top-3 Daily Priorities & Cloud Sync Banner */}
      <section className="rounded-2xl border border-[#F59E0B]/45 fabro-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#F59E0B]/45 bg-[#F59E0B]/12 px-2.5 py-1 text-[11px] font-bold text-[#B45309] dark:text-[#FBBF24]">
                <Star className="w-3.5 h-3.5 fill-current" />
                Prioridades Máximas del Día (Top 3)
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                  syncStatus === 'cloud-synced'
                    ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : authUser
                    ? 'border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                {syncStatus === 'cloud-synced' ? (
                  <Cloud className="w-3.5 h-3.5" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5" />
                )}
                {syncLabel}
              </span>
            </div>
            {dailyReview.morningIntention && (
              <p className="text-xs italic fabro-muted mt-1">
                Intención: «{dailyReview.morningIntention}»
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setOrganizerActiveTab('inbox');
                navigateTo('bienestar', 'organizador-integral');
              }}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#0EA5E9]/45 bg-[#0EA5E9]/10 text-[#0284C7] dark:text-[#38BDF8] px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Inbox className="w-4 h-4" />
              Bandeja ({inboxItems.length})
            </button>
            {!authUser ? (
              <button
                type="button"
                onClick={() => openAuthModal('activar la sincronización en la nube entre dispositivos', 'register')}
                className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED] text-white px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Cloud className="w-4 h-4" />
                Activar sincronización en nube
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void syncNowToCloud()}
                className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
            )}
          </div>
        </div>

        {top3Tasks.length === 0 ? (
          <div className="rounded-xl border fabro-border fabro-surface-elevated px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="fabro-muted">
              Aún no fijaste tus 3 prioridades de hoy en la Revisión Mañana.
            </span>
            <button
              type="button"
              onClick={() => {
                setOrganizerActiveTab('revision');
                navigateTo('bienestar', 'organizador-integral');
              }}
              className="font-bold text-[#B45309] dark:text-[#FBBF24] hover:underline cursor-pointer"
            >
              Elegir Top 3 ahora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top3Tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleOrganizerTask(task.id)}
                className="min-h-[48px] text-left rounded-xl border border-[#F59E0B]/35 fabro-surface-elevated px-3.5 py-2.5 flex items-center gap-2.5 text-xs cursor-pointer active:scale-[0.99]"
              >
                {task.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-bold truncate ${task.done ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </p>
                  <p className="text-[11px] fabro-muted truncate">{task.subject}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Swipeable Widget Icons Launcher */}
      <SwipeableWidgetRail title="Widgets y Pantallas Deslizables" items={widgetItems} />

      {/* Embedded Unified Organizer Quick Center */}
      <OrganizerHub compact />

      {/* Pinned Tools Configurable Board */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 fabro-accent-text" />
            Paneles Fijados ({pinnedTools.length})
          </h2>
          <span className="text-xs fabro-muted">
            Ordená, cambiá ancho o desfijá en 1 toque
          </span>
        </div>

        {pinnedTools.length === 0 ? (
          <div className="rounded-2xl border fabro-surface p-8 text-center space-y-3">
            <p className="text-sm font-bold">Tu Espacio de Trabajo está vacío</p>
            <p className="text-xs fabro-muted max-w-md mx-auto">
              Elegí las herramientas de Estudio, Bienestar, Social, IA BYOK o Configuración que querés tener siempre a mano.
            </p>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="fabro-btn fabro-accent-border bg-[var(--fabro-accent)] text-white"
            >
              <Pin className="w-4 h-4" />
              Elegir herramientas para fijar
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 ${
              workspaceColumns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'
            } gap-4`}
          >
            {pinnedTools.map((entry, index) => {
              const secMeta = SECTORS_CATALOG.find((s) => s.id === entry.sector);
              const subMeta = ALL_SUBMENUS.find(
                (s) => s.sector === entry.sector && s.id === entry.submenu
              );
              if (!secMeta || !subMeta) return null;
              const Icon = SECTOR_ICONS[entry.sector];
              const palette = SECTOR_PALETTES[entry.sector];
              const spanClass = entry.size === 'wide' ? 'md:col-span-2' : '';

              return (
                <article
                  key={entry.key}
                  className={`rounded-2xl border fabro-surface p-4 sm:p-5 flex flex-col justify-between gap-4 ${spanClass}`}
                  style={{ borderColor: `${palette.primary}45` }}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: palette.gradientCss }}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p
                            className="text-[11px] font-bold uppercase tracking-wider truncate"
                            style={{ color: palette.primary }}
                          >
                            {secMeta.shortTitle}
                          </p>
                          <h3 className="font-display text-sm font-bold truncate">
                            {subMeta.label}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => movePinnedTool(entry.key, 'up')}
                          aria-label="Mover arriba"
                          title="Mover antes"
                          className="w-8 h-8 rounded-lg border fabro-border fabro-surface-elevated flex items-center justify-center disabled:opacity-35 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === pinnedTools.length - 1}
                          onClick={() => movePinnedTool(entry.key, 'down')}
                          aria-label="Mover abajo"
                          title="Mover después"
                          className="w-8 h-8 rounded-lg border fabro-border fabro-surface-elevated flex items-center justify-center disabled:opacity-35 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPinnedToolSize(
                              entry.key,
                              entry.size === 'wide' ? 'compact' : 'wide'
                            )
                          }
                          aria-label={entry.size === 'wide' ? 'Hacer compacto' : 'Expandir ancho'}
                          title={entry.size === 'wide' ? 'Tamaño compacto' : 'Ancho doble'}
                          className="hidden md:flex w-8 h-8 rounded-lg border fabro-border fabro-surface-elevated items-center justify-center cursor-pointer"
                        >
                          {entry.size === 'wide' ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                          ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePinTool(entry.sector, entry.submenu)}
                          aria-label={`Desfijar ${subMeta.label}`}
                          title="Quitar del espacio"
                          className="w-8 h-8 rounded-lg border fabro-border fabro-surface-elevated hover:text-rose-600 flex items-center justify-center cursor-pointer"
                        >
                          <PinOff className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {renderPinnedToolBody(entry)}
                  </div>

                  <div className="pt-3 border-t fabro-border flex items-center justify-between gap-2">
                    <span className="text-[11px] fabro-muted truncate">{subMeta.groupLabel}</span>
                    <button
                      type="button"
                      onClick={() => navigateTo(entry.sector, entry.submenu)}
                      className="min-h-[42px] md:min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)] px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                    >
                      Abrir
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Network Status & 12 Color Templates Panel */}
      <section className="rounded-2xl border fabro-surface p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 flex flex-col justify-between gap-4 rounded-xl border fabro-border fabro-surface-elevated p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl border fabro-border fabro-surface flex items-center justify-center shrink-0">
              {network.isOnline ? (
                <Wifi className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold">
                {network.isOnline ? 'En línea' : 'Sin conexión (Offline)'} · {syncLabel}
              </p>
              <p className="text-xs font-mono tabular-nums fabro-muted">
                {network.downlinkMbps !== null
                  ? `${network.downlinkMbps.toFixed(1)} Mbps`
                  : 'Midiendo...'}
                {' · '}
                {network.latencyMs !== null ? `${network.latencyMs} ms` : 'Caché local'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={network.measuring}
            onClick={() => void measureNetwork()}
            className="min-h-[42px] md:min-h-[38px] inline-flex items-center justify-center gap-2 rounded-xl border fabro-border fabro-surface px-3.5 py-1.5 text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${network.measuring ? 'animate-spin' : ''}`} />
            Medir red ahora
          </button>
        </div>

        <div className="xl:col-span-7 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold">Plantillas de color ({FABRO_THEMES.length})</span>
            <span className="fabro-muted font-medium">
              {FABRO_THEMES.find((t) => t.id === theme)?.name}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {FABRO_THEMES.map((item) => {
              const active = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id)}
                  className={`min-h-[42px] rounded-xl border px-2.5 py-1.5 text-left text-[11px] transition-all cursor-pointer active:scale-95 ${
                    active
                      ? 'fabro-accent-border fabro-accent-soft font-bold'
                      : 'fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate">{item.name}</span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      {item.swatches.slice(0, 3).map((hex) => (
                        <span
                          key={hex}
                          className="w-2.5 h-2.5 rounded-sm border fabro-border"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Secondary Panels: Recent Activity & Notifications */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border fabro-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 fabro-accent-text" />
              Actividad reciente
            </h3>
            <span className="text-xs font-mono fabro-muted tabular-nums">{recents.length}</span>
          </div>

          {recents.length === 0 ? (
            <p className="text-xs fabro-muted py-3">
              Todavía no abriste submódulos en esta sesión.
            </p>
          ) : (
            <div className="divide-y fabro-border">
              {recents.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.sector, item.submenu)}
                  className="w-full min-h-[42px] py-2 flex items-center justify-between gap-2 text-left text-xs cursor-pointer hover:opacity-80"
                >
                  <span className="font-semibold truncate">{item.label}</span>
                  <span className="font-mono text-[11px] fabro-muted tabular-nums shrink-0">
                    {item.timestamp}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border fabro-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 fabro-accent-text" />
              Notificaciones
            </h3>
            <span className="text-xs font-mono fabro-muted tabular-nums">
              {unreadNotifications} sin leer
            </span>
          </div>

          <div className="space-y-2">
            {notifications.slice(0, 4).map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  markNotificationRead(notif.id);
                  navigateTo(notif.target.sector, notif.target.submenu);
                }}
                className={`w-full min-h-[42px] text-left rounded-xl border fabro-border p-3 text-xs cursor-pointer transition-transform active:scale-[0.99] ${
                  !notif.read ? 'fabro-accent-soft' : 'fabro-surface-elevated'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold truncate">{notif.title}</span>
                  <Activity className="w-3.5 h-3.5 fabro-muted shrink-0" />
                </div>
                <p className="text-[11px] fabro-muted mt-0.5 leading-relaxed">{notif.detail}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
