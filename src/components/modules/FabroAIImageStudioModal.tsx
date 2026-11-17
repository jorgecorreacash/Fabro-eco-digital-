import React, { useRef, useState } from 'react';
import {
  BookmarkPlus,
  Crown,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { authFetch } from '../../lib/apiClient';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';

interface FabroAIImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  subjectName: string;
  initialPrompt?: string;
}

type ImageRatio = '1:1' | '4:3' | '16:9' | '3:4' | '9:16';

const ASPECT_RATIOS: Array<{ value: ImageRatio; label: string }> = [
  { value: '1:1', label: '1:1 Cuadrado' },
  { value: '4:3', label: '4:3 Lámina' },
  { value: '16:9', label: '16:9 Panorámica' },
  { value: '3:4', label: '3:4 Vertical' },
  { value: '9:16', label: '9:16 Historia' },
];

function readImageAsBase64(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve({
        base64,
        mimeType: file.type || 'image/png',
        previewUrl: dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });
}

export const FabroAIImageStudioModal: React.FC<FabroAIImageStudioModalProps> = ({
  isOpen,
  onClose,
  subjectId,
  subjectName,
  initialPrompt = '',
}) => {
  const { freemiumStatus, openPlansModal } = useAIGateway();
  const { createNote } = useFabro();

  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState<ImageRatio>('1:1');
  const [useNanoBanana21, setUseNanoBanana21] = useState(false);

  const [sourceImage, setSourceImage] = useState<{
    name: string;
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [result, setResult] = useState<{
    imageDataUrl: string;
    mimeType: string;
    description: string;
    modelUsed: string;
    inputTokens: number;
    outputTokens: number;
  } | null>(null);

  const uploadRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const canUsePaid = Boolean(freemiumStatus?.allowPaidModels);

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen base no puede superar 10 MB.');
      e.target.value = '';
      return;
    }
    setError('');
    try {
      const parsed = await readImageAsBase64(file);
      setSourceImage({
        name: file.name,
        base64: parsed.base64,
        mimeType: parsed.mimeType,
        previewUrl: parsed.previewUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la imagen.');
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setError('Describí qué imagen querés crear o qué cambios querés aplicar.');
      return;
    }
    if (mode === 'edit' && !sourceImage?.base64) {
      setError('Cargá una imagen base para poder editarla con IA.');
      return;
    }

    setError('');
    setSavedMessage('');
    setGenerating(true);

    try {
      const resp = await authFetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: cleanPrompt,
          imageBase64: mode === 'edit' ? sourceImage?.base64 || '' : '',
          imageMimeType: mode === 'edit' ? sourceImage?.mimeType || 'image/png' : 'image/png',
          aspectRatio,
          useNanoBanana21: canUsePaid ? useNanoBanana21 : false,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || 'No se pudo generar la imagen.');
        return;
      }

      setResult({
        imageDataUrl: data.imageDataUrl,
        mimeType: data.mimeType || 'image/png',
        description: data.description || '',
        modelUsed: data.modelUsed || 'gemini-3.1-flash-lite-image',
        inputTokens: Number(data.inputTokens || 0),
        outputTokens: Number(data.outputTokens || 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red al generar la imagen.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUseResultForEdit = () => {
    if (!result?.imageDataUrl) return;
    const commaIdx = result.imageDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? result.imageDataUrl.slice(commaIdx + 1) : '';
    if (!base64) return;
    setSourceImage({
      name: `edicion-${Date.now()}.png`,
      base64,
      mimeType: result.mimeType || 'image/png',
      previewUrl: result.imageDataUrl,
    });
    setMode('edit');
    setPrompt('');
    setSavedMessage('');
  };

  const handleDownload = () => {
    if (!result?.imageDataUrl) return;
    const link = document.createElement('a');
    link.href = result.imageDataUrl;
    link.download = `fabro-imagen-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToNotes = async () => {
    if (!result?.imageDataUrl) return;
    try {
      const safeTitle = `Imagen IA · ${prompt.trim().slice(0, 70) || subjectName || 'Estudio visual'}`;
      const descHtml = result.description
        ? `<p>${result.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
        : '';
      const contentHtml = `
        <p><strong>Prompt:</strong> ${prompt.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        ${descHtml}
        <p><img src="${result.imageDataUrl}" alt="Imagen generada con FABRO IA" style="max-width:100%;border-radius:10px;" /></p>
      `.trim();
      const contentText = `Prompt: ${prompt.trim()}\n${result.description ? `\n${result.description}` : ''}`;

      await createNote({
        subjectId,
        unit: '',
        folder: 'Estudio Visual FABRO IA',
        title: safeTitle.slice(0, 180),
        contentHtml,
        contentText,
        tags: ['fabro-ia-imagen', mode],
        attachments: [],
        offlineAvailable: true,
      });
      setSavedMessage('Imagen guardada correctamente en tus Apuntes.');
    } catch {
      setError('No se pudo guardar la imagen en Apuntes.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Estudio de Imágenes FABRO IA"
    >
      <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                Estudio de Imágenes FABRO IA
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Creá diagramas, láminas educativas o editá tus propias imágenes con IA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar estudio de imágenes"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column */}
          <form onSubmit={handleGenerate} className="lg:col-span-5 space-y-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setMode('create');
                  setError('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'create'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Crear imagen
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('edit');
                  setError('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'edit'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Editar imagen
              </button>
            </div>

            {mode === 'edit' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Imagen base a editar
                </label>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleSelectFile(e)}
                />
                {sourceImage ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 space-y-2 bg-slate-50 dark:bg-slate-900/50">
                    <img
                      src={sourceImage.previewUrl}
                      alt="Imagen base"
                      className="w-full max-h-40 object-contain rounded-lg bg-slate-900/5 dark:bg-slate-950"
                    />
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-600 dark:text-slate-300">{sourceImage.name}</span>
                      <button
                        type="button"
                        onClick={() => uploadRef.current?.click()}
                        className="text-sky-600 dark:text-sky-400 font-semibold hover:underline shrink-0 cursor-pointer"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => uploadRef.current?.click()}
                    className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-5 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-sky-500/60 hover:bg-sky-500/5 cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Subir imagen para editar
                    </span>
                    <span className="text-[11px]">PNG, JPG o WebP (hasta 10 MB)</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {mode === 'create' ? 'Descripción de la imagen' : 'Instrucciones de edición'}
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === 'create'
                    ? 'Ej.: Lámina educativa clara sobre el sistema solar con órbitas definidas y estilo editorial limpio...'
                    : 'Ej.: Añadí etiquetas en español señalando los componentes principales y aclarando el fondo...'
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Relación de aspecto
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as ImageRatio)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs text-slate-900 dark:text-white"
                >
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motor visual
                </label>
                <select
                  value={useNanoBanana21 && canUsePaid ? 'nano21' : 'flashlite'}
                  onChange={(e) => {
                    if (e.target.value === 'nano21' && !canUsePaid) {
                      openPlansModal('El modelo Nano Banana 2.1 de alta fidelidad está disponible en FABRO PREMIUM.');
                      return;
                    }
                    setUseNanoBanana21(e.target.value === 'nano21');
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="flashlite">Gemini Image Lite (Gratis/Estándar)</option>
                  <option value="nano21">
                    Nano Banana 2.1 {canUsePaid ? '(PREMIUM)' : '(Requiere PREMIUM)'}
                  </option>
                </select>
              </div>
            </div>

            {!canUsePaid && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-amber-800 dark:text-amber-200">
                <span>Usás el motor visual gratuito incluido en tu cuenta.</span>
                <button
                  type="button"
                  onClick={() => openPlansModal()}
                  className="inline-flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-100 hover:underline shrink-0 cursor-pointer"
                >
                  <Crown className="w-3 h-3" />
                  PREMIUM
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'create' ? 'Generando imagen...' : 'Aplicando edición...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {mode === 'create' ? 'Generar imagen IA' : 'Aplicar edición IA'}
                </>
              )}
            </button>
          </form>

          {/* Preview Column */}
          <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-hidden min-h-[320px]">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Vista previa del resultado
              </span>
              {result && (
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {result.modelUsed} · {(result.inputTokens + result.outputTokens).toLocaleString('es-AR')} tok
                </span>
              )}
            </div>

            <div className="flex-1 p-4 flex items-center justify-center">
              {generating ? (
                <div className="text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-sky-600 dark:text-sky-400" />
                  <p>Procesando síntesis visual en el servidor FABRO...</p>
                </div>
              ) : result?.imageDataUrl ? (
                <div className="w-full space-y-3">
                  <img
                    src={result.imageDataUrl}
                    alt="Imagen generada por FABRO IA"
                    className="w-full max-h-[380px] object-contain rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mx-auto"
                  />
                  {result.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {result.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-2 max-w-xs text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto opacity-50" />
                  <p className="text-xs">
                    Describí un gráfico, diagrama o ilustración educativa para generarla y guardarla en tus apuntes.
                  </p>
                </div>
              )}
            </div>

            {result?.imageDataUrl && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar PNG
                  </button>
                  <button
                    type="button"
                    onClick={handleUseResultForEdit}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Editar esta imagen
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveToNotes()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Guardar en Apuntes
                </button>
              </div>
            )}

            {savedMessage && (
              <div className="px-4 py-2 bg-emerald-500/15 border-t border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
                {savedMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
