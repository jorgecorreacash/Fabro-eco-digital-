import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CloudOff,
  Download,
  Lock,
  PhoneCall,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import {
  DEFAULT_WELLNESS_STATE,
  FIRST_AID_GUIDES,
  WELLNESS_COMMUNITY_SPACES,
} from '../../../../data/wellnessCatalog';
import {
  downloadWellnessPdfReport,
  exportWellnessBackupJson,
  parseWellnessBackupJson,
  todayIsoDate,
} from '../../../../services/wellnessVault';
import type {
  WellnessCommunitySpaceId,
  WellnessStateSnapshot,
} from '../../../../types/wellness';
import { WellnessWallPanel } from '../WellnessWallPanel';

interface WellnessSafetyCommunityConfigPanelProps {
  section: 'primeros-auxilios' | 'comunidad-bienestar' | 'configuracion-privacidad';
  state: WellnessStateSnapshot;
  onUpdateState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

export const WellnessSafetyCommunityConfigPanel: React.FC<
  WellnessSafetyCommunityConfigPanelProps
> = ({ section, state, onUpdateState }) => {
  const { profile, addWallPost, wallPosts, connectItems } = useEcosystem();

  const [activeSpace, setActiveSpace] = useState<'Todos' | WellnessCommunitySpaceId>('Todos');
  const [shareSpace, setShareSpace] = useState<WellnessCommunitySpaceId>('Hábitos saludables');
  const [shareText, setShareText] = useState('');
  const [confirmResetStep, setConfirmResetStep] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3500);
  };

  // =========================================================================
  // 16. PRIMEROS AUXILIOS
  // =========================================================================
  if (section === 'primeros-auxilios') {
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border border-red-500/40 bg-red-500/5 p-5 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
            16 · Primeros auxilios · Información educativa preventiva
          </p>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-red-600" />
            Guía de referencia rápida y señales de urgencia
          </h2>
          <p className="text-red-800 dark:text-red-300 font-medium leading-relaxed">
            AVISO IMPORTANTE: Esta sección es exclusivamente educativa y preventiva (basada en lineamientos generales de Cruz Roja y OMS). FABRO NO reemplaza servicios de emergencias ni atención médica profesional. Ante riesgo vital, llamá inmediatamente al número de emergencias de tu país (911 / 107 / 112).
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIRST_AID_GUIDES.map((guide) => (
            <article
              key={guide.id}
              className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  {guide.urgency}
                </span>
                <span className="text-[10px] fabro-muted">{guide.source}</span>
              </div>
              <h3 className="font-display text-base font-bold">{guide.title}</h3>
              <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
                {guide.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-3 text-amber-900 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Señales de alarma:</strong> {guide.redFlags}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 17. COMUNIDAD DE BIENESTAR (Integrada con la red social única de FABRO)
  // =========================================================================
  if (section === 'comunidad-bienestar') {
    const filteredSpacePosts = wallPosts.filter((p) => {
      if (p.origin !== 'bienestar') return false;
      if (activeSpace === 'Todos') return true;
      return p.categoryTag === activeSpace;
    });

    const handleQuickSpacePost = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!shareText.trim()) return;
      await addWallPost({
        author: profile.displayName || 'Usuario FABRO',
        fabroId: profile.fabroId || 'FABRO',
        authorAvatar: profile.photoURL,
        text: shareText.trim(),
        origin: 'bienestar',
        categoryTag: shareSpace,
      });
      setShareText('');
      notify(`Publicado en Comunidad de Bienestar (${shareSpace}) y vinculado al Muro General único de FABRO.`);
    };

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#10B981]">
                17 · Comunidad de bienestar · Red social única FABRO
              </p>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-[#10B981]" />
                7 espacios temáticos integrados sin duplicar red social
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 fabro-muted">
              <Lock className="w-3.5 h-3.5 text-[#10B981]" />
              Solo se publica lo que autorizás manualmente
            </span>
          </div>

          <p className="fabro-muted">
            Reutiliza la única red social, cuentas y muro general de FABRO. Tus datos de salud, emociones, sueño y nutrición permanecen privados en tu dispositivo y nunca se comparten automáticamente.
          </p>

          {/* 7 thematic space filters */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(['Todos', ...WELLNESS_COMMUNITY_SPACES] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setActiveSpace(sp)}
                className={`px-3 py-1.5 rounded-xl border font-semibold cursor-pointer ${
                  activeSpace === sp
                    ? 'border-[#10B981] bg-[#10B981] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>

          <form onSubmit={handleQuickSpacePost} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t fabro-border">
            <select
              value={shareSpace}
              onChange={(e) => setShareSpace(e.target.value as WellnessCommunitySpaceId)}
              className="sm:col-span-3 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
            >
              {WELLNESS_COMMUNITY_SPACES.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
              placeholder={`Compartir algo positivo en ${shareSpace}...`}
              className="sm:col-span-7 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="submit"
              className="sm:col-span-2 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#10B981] text-white font-semibold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Publicar
            </button>
          </form>

          {activeSpace !== 'Todos' && (
            <p className="fabro-muted font-mono">
              Publicaciones en «{activeSpace}»: {filteredSpacePosts.length}
            </p>
          )}

          {feedback && (
            <p className="font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {feedback}
            </p>
          )}
        </section>

        {/* Preserved WellnessWallPanel connected to single FABRO social network */}
        <WellnessWallPanel />
      </div>
    );
  }

  // =========================================================================
  // 18. CONFIGURACIÓN Y PRIVACIDAD (Incluye FABRO CONNECT & Modo Offline)
  // =========================================================================
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleExportJson = () => {
    const json = exportWellnessBackupJson(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabro-bienestar-respaldo-${todayIsoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onUpdateState((prev) => ({
      ...prev,
      privacySettings: {
        ...prev.privacySettings,
        lastBackupAt: new Date().toLocaleString('es-AR'),
      },
    }));
    notify('Respaldo JSON descargado correctamente.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseWellnessBackupJson(String(reader.result || ''));
      if (!parsed) {
        notify('El archivo seleccionado no corresponde a un respaldo válido de FABRO BIENESTAR.');
        return;
      }
      onUpdateState(() => parsed);
      notify('Respaldo restaurado correctamente en tu IndexedDB local.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5 text-xs">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#475569] dark:text-slate-300">
          18 · Configuración, privacidad, modo offline y FABRO CONNECT
        </p>
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Control total sobre tus datos personales ($0 costo garantizado)
        </h2>
        {feedback && (
          <p className="font-semibold text-[#047857] dark:text-[#34D399] pt-1 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {feedback}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Privacy Rules */}
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#059669]" />
            Privacidad por defecto
          </h3>
          {(
            [
              ['keepHealthPrivate', 'Mantener indicadores de salud, medicación y archivos 100% privados'],
              ['keepEmotionalPrivate', 'Mantener diario emocional y reflexiones 100% privados'],
              ['keepNutritionPrivate', 'Mantener registros de calorías y peso privados'],
              ['requireShareConfirmation', 'Exigir acción manual explícita antes de publicar cualquier avance'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={state.privacySettings[key]}
                onChange={() =>
                  onUpdateState((prev) => ({
                    ...prev,
                    privacySettings: {
                      ...prev.privacySettings,
                      [key]: !prev.privacySettings[key],
                    },
                  }))
                }
                className="accent-[#059669] mt-0.5"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* FABRO CONNECT Backup & Restore */}
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4 text-[#0284C7]" />
            Respaldo portátil e integración FABRO CONNECT
          </h3>
          <p className="fabro-muted">
            Exportá e importá tu historial completo en formato JSON o PDF sin servidores pagos ni suscripciones.
            {state.privacySettings.lastBackupAt
              ? ` Último respaldo: ${state.privacySettings.lastBackupAt}.`
              : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] text-white px-3.5 font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar respaldo JSON
            </button>
            <button
              type="button"
              onClick={() => downloadWellnessPdfReport(state, profile.displayName || 'Usuario FABRO', false)}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 font-semibold cursor-pointer"
            >
              Exportar reporte PDF
            </button>
            <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 font-semibold cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Restaurar JSON
              <input type="file" accept="application/json" onChange={handleImportJson} className="hidden" />
            </label>
          </div>
          <div className="pt-2 border-t fabro-border text-[11px] fabro-muted">
            Estado FABRO CONNECT: {connectItems.filter((c) => c.status === 'ready').length} servicios externos vinculados actualmente. Si no conectás servicios externos, FABRO BIENESTAR funciona íntegramente en almacenamiento local IndexedDB sin simular sincronizaciones.
          </div>
        </div>
      </div>

      {/* Offline Status & $0 Cost Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2.5">
          <h3 className="text-sm font-bold flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-[#059669]" />
            ) : (
              <CloudOff className="w-4 h-4 text-amber-600" />
            )}
            Modo sin internet (Estado actual: {isOnline ? 'En línea' : 'Sin conexión'})
          </h3>
          <p className="font-semibold text-[#047857] dark:text-[#34D399]">
            Disponible 100% sin internet:
          </p>
          <p className="fabro-muted">
            Mi día, diario nutricional (base local + carga manual), biblioteca de 15 disciplinas y rutinas, contador manual, diario emocional y herramientas de El Último Día de Tu Vida, sueño, hidratación, historial de salud, metas, hábitos, FABRO RESPIRA (sonidos Web Audio), Primeros auxilios, FABRO COACH local y exportación PDF/JSON/CSV.
          </p>
          <p className="font-semibold text-amber-700 dark:text-amber-400 pt-1">
            Requiere conexión a internet:
          </p>
          <p className="fabro-muted">
            Consulta de códigos de barras nuevos en Open Food Facts (API pública gratuita), reproducción de enlaces externos de YouTube/Vimeo, publicación en Comunidad sincronizada y consultas opcionales con tu clave BYOK.
          </p>
        </div>

        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            Auditoría $0 y borrado controlado de datos
          </h3>
          <p className="fabro-muted">
            FABRO BIENESTAR no activa facturación, no utiliza Firebase Blaze ni APIs pagas, y nunca solicita tarjeta de crédito.
          </p>
          <div className="pt-2 border-t fabro-border space-y-2">
            {!confirmResetStep ? (
              <button
                type="button"
                onClick={() => setConfirmResetStep(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-rose-500/50 text-rose-600 dark:text-rose-400 px-3.5 font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Restablecer registros locales de FABRO BIENESTAR
              </button>
            ) : (
              <div className="rounded-xl border border-rose-500 bg-rose-500/10 p-3 space-y-2">
                <p className="font-semibold text-rose-700 dark:text-rose-300">
                  ¿Confirmás borrar los registros locales del nuevo espacio FABRO BIENESTAR? (Te recomendamos exportar tu respaldo JSON antes).
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateState(() => DEFAULT_WELLNESS_STATE);
                      setConfirmResetStep(false);
                      notify('Registros locales de FABRO BIENESTAR restablecidos.');
                    }}
                    className="min-h-[34px] rounded-lg bg-rose-600 text-white px-3 font-semibold cursor-pointer"
                  >
                    Sí, confirmar borrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetStep(false)}
                    className="min-h-[34px] rounded-lg border fabro-border px-3 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
