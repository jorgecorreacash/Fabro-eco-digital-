import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileSearch,
  KeyRound,
  Lock,
  MessageSquare,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import type { AISubmenuId, ByokProviderKey } from '../../types/ecosystem';
import { SectorLayout } from './SectorLayout';
import { ByokDedicatedChatView } from './ai/ByokDedicatedChatView';

const BYOK_PROVIDER_PRESETS: Array<{
  id: string;
  label: string;
  endpointFormat: ByokProviderKey['endpointFormat'];
  baseUrl: string;
  modelName: string;
}> = [
  {
    id: 'openai',
    label: 'OpenAI',
    endpointFormat: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    endpointFormat: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelName: 'gemini-2.5-flash',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    endpointFormat: 'anthropic-compatible',
    baseUrl: 'https://api.anthropic.com/v1',
    modelName: 'claude-3-5-sonnet-latest',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    endpointFormat: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    endpointFormat: 'openai-compatible',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-plus',
  },
];

export const Sector4AI: React.FC = () => {
  const { submenu, byokKeys, saveByokKey, removeByokKey, navigateTo } = useEcosystem();
  const activeSub: AISubmenuId =
    submenu === 'claves-byok' ||
    submenu === 'asistente-api' ||
    submenu === 'chat-comparador' ||
    submenu === 'analisis-documentos'
      ? submenu
      : 'claves-byok';

  const [providerName, setProviderName] = useState('');
  const [endpointFormat, setEndpointFormat] =
    useState<ByokProviderKey['endpointFormat']>('openai-compatible');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [rawApiKey, setRawApiKey] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [justSavedReady, setJustSavedReady] = useState(false);

  const applyPreset = (preset: (typeof BYOK_PROVIDER_PRESETS)[number]) => {
    setProviderName(preset.label);
    setEndpointFormat(preset.endpointFormat);
    setBaseUrl(preset.baseUrl);
    setModelName(preset.modelName);
    setFeedback(null);
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = providerName.trim();
    const cleanKey = rawApiKey.trim();
    if (!cleanName || cleanKey.length < 12) {
      setFeedback('Ingresá el nombre del proveedor y una clave API válida de al menos 12 caracteres.');
      setJustSavedReady(false);
      return;
    }

    const masked = `${cleanKey.slice(0, 4)}••••${cleanKey.slice(-4)}`;
    saveByokKey(
      {
        id: `byok-${Date.now()}`,
        providerName: cleanName,
        endpointFormat,
        baseUrl: baseUrl.trim() || 'Endpoint oficial elegido por el usuario',
        modelName: modelName.trim() || 'Modelo especificado por el usuario',
        maskedKey: masked,
        storedLocally: true,
        testedStatus: 'ready',
        updatedAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      },
      cleanKey
    );

    setRawApiKey('');
    setProviderName('');
    setBaseUrl('');
    setModelName('');
    setJustSavedReady(true);
    setFeedback(
      'Clave guardada exclusivamente en la bóveda local de tu dispositivo (IndexedDB + LocalStorage).'
    );
  };

  return (
    <SectorLayout
      sectorId="ia"
      activeSubmenu={activeSub}
      badgeText="100% BYOK · Sin APIs precargadas"
    >
      {/* Mandatory Cost & API Transparency Banner */}
      <div className="rounded-2xl border border-[#4F46E5]/35 bg-gradient-to-r from-[#4F46E5]/10 via-transparent to-[#D97706]/10 p-4 sm:p-5 space-y-1.5">
        <p className="text-xs font-bold text-[#4338CA] dark:text-[#818CF8] flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#D97706]" />
          Política estricta BYOK (Bring Your Own Key) — Cero cuotas del desarrollador
        </p>
        <p className="text-xs fabro-muted leading-relaxed">
          FABRO no incluye ni precarga ninguna API de inteligencia artificial gratuita ni de
          terceros. Todas las herramientas de IA funcionan únicamente cuando vos pegás y guardás tu
          propia clave API oficial en este dispositivo.
        </p>
      </div>

      {activeSub === 'claves-byok' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form
            onSubmit={handleSaveKey}
            className="rounded-2xl border border-[#4F46E5]/35 fabro-surface p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.75} />
                Conectar tu propia clave API oficial
              </h2>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium fabro-muted">
                Plantillas rápidas de proveedor (vos aportás tu clave personal):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BYOK_PROVIDER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                      providerName === preset.label
                        ? 'border-[#4F46E5] bg-[#4F46E5]/12 text-[#4338CA] dark:text-[#A5B4FC] font-semibold'
                        : 'fabro-border fabro-surface-elevated hover:border-[#4F46E5]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="fabro-muted font-medium">Proveedor elegido por vos</span>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Ej: OpenAI, Gemini, Claude, DeepSeek, Qwen..."
                  className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                />
              </label>

              <label className="block space-y-1">
                <span className="fabro-muted font-medium">Formato compatible del endpoint</span>
                <select
                  value={endpointFormat}
                  onChange={(e) =>
                    setEndpointFormat(e.target.value as ByokProviderKey['endpointFormat'])
                  }
                  className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                >
                  <option value="openai-compatible">Estándar OpenAI-compatible (/v1/chat/completions)</option>
                  <option value="gemini">Estándar Google Gemini API</option>
                  <option value="anthropic-compatible">Estándar Anthropic Messages API</option>
                  <option value="custom">Endpoint personalizado</option>
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="block space-y-1">
                  <span className="fabro-muted font-medium">URL base oficial</span>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.tu-proveedor.com/v1"
                    className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="fabro-muted font-medium">Modelo elegido</span>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="ID del modelo oficial"
                    className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="fabro-muted font-medium">Tu clave API personal</span>
                <input
                  type="password"
                  value={rawApiKey}
                  onChange={(e) => setRawApiKey(e.target.value)}
                  placeholder="Pegá tu clave oficial (se guarda solo en tu navegador)"
                  autoComplete="off"
                  className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 font-mono fabro-input"
                />
              </label>
            </div>

            {feedback && (
              <div className="space-y-2">
                <p className="text-xs text-[#D97706] dark:text-[#FBBF24] font-semibold">
                  {feedback}
                </p>
                {justSavedReady && (
                  <button
                    type="button"
                    onClick={() => navigateTo('ia', 'chat-comparador')}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 px-3.5 py-1.5 text-sm font-medium cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Abrir pantalla limpia de Chat IA
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              className="min-h-[42px] w-full rounded-xl border border-[#4F46E5] bg-gradient-to-r from-[#4F46E5] to-[#D97706] text-white py-2 px-4 text-sm font-medium shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)] cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Guardar clave localmente (BYOK)
            </button>
          </form>

          <div className="rounded-2xl border border-[#4F46E5]/35 fabro-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">Claves guardadas en este equipo</h2>
              <span className="font-mono text-xs fabro-muted tabular-nums">
                {byokKeys.length} activas
              </span>
            </div>

            {byokKeys.length === 0 ? (
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-5 text-xs space-y-2">
                <p className="font-semibold">Sin claves conectadas (0 precargadas)</p>
                <p className="fabro-muted leading-relaxed">
                  Tu plataforma FABRO funciona por completo sin claves de IA. Cuando decidas
                  activar asistencia inteligente, pegá tu propia clave en el formulario.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {byokKeys.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                        {item.providerName}
                      </p>
                      <p className="font-mono text-[11px] fabro-muted truncate">
                        {item.maskedKey} · {item.endpointFormat} · {item.modelName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeByokKey(item.id)}
                      aria-label={`Desconectar ${item.providerName}`}
                      className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center fabro-muted hover:text-red-600 dark:hover:text-red-400 cursor-pointer shrink-0 active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => navigateTo('ia', 'chat-comparador')}
                  className="min-h-[42px] md:min-h-[38px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#4F46E5] bg-[#4F46E5] text-white px-4 py-2 text-sm font-medium cursor-pointer active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  Ir al Chat IA limpio y dedicado
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSub === 'asistente-api' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#4F46E5]/35 fabro-surface p-5 space-y-3 text-xs">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.75} />
              ¿Qué es una clave API y cómo funciona?
            </h2>
            <p className="fabro-muted leading-relaxed">
              Una clave API es una credencial personal que generás en la consola de desarrolladores
              de tu proveedor preferido para que tus solicitudes se facturen o descuenten directo
              en tu propia cuenta, sin intermediarios.
            </p>
            <ul className="space-y-1.5 fabro-muted list-disc pl-4">
              <li>Ingresá al portal oficial de desarrolladores de tu proveedor elegido.</li>
              <li>Creá una clave nueva y definí un límite mensual de gasto en su panel.</li>
              <li>Pegala en «Mis claves API (BYOK)»; nunca se sube ni se guarda en código fuente.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[#D97706]/35 fabro-surface p-5 space-y-3 text-xs">
            <h2 className="font-display text-base font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              Suscripción web vs. Acceso por API
            </h2>
            <p className="fabro-muted leading-relaxed">
              Es muy importante saber que una suscripción web mensual (como planes de chat web para
              consumidor final) <strong>no incluye acceso por API</strong>. Las claves API se
              habilitan por separado en la plataforma de API de cada proveedor.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('ia', 'claves-byok')}
              className="min-h-[42px] md:min-h-[38px] rounded-xl border border-[#4F46E5] bg-[#4F46E5] text-white px-4 py-2 text-sm font-medium cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Ir a gestionar mis claves BYOK
            </button>
          </div>
        </div>
      )}

      {activeSub === 'chat-comparador' && <ByokDedicatedChatView />}

      {activeSub === 'analisis-documentos' && (
        <div className="rounded-2xl border border-[#4F46E5]/35 fabro-surface p-5 space-y-3 text-xs">
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-[#D97706]" />
            Análisis de documentos, imágenes, resúmenes y traducción (BYOK)
          </h2>
          <p className="fabro-muted leading-relaxed">
            Desde el Chat IA BYOK ya podés adjuntar directamente cualquier apunte del Sector 1 o archivo
            de texto (`.txt`, `.md`) para resumirlo, explicarlo o convertir las respuestas en nuevos apuntes y tareas.
          </p>
          <button
            type="button"
            onClick={() => navigateTo('ia', 'chat-comparador')}
            className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-[#4F46E5] bg-[#4F46E5] text-white px-4 py-2 text-sm font-medium cursor-pointer active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            Abrir Chat IA con adjuntos de Estudio
          </button>
        </div>
      )}
    </SectorLayout>
  );
};
