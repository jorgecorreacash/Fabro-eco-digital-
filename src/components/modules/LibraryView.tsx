import React, { useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookMarked,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Heart,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import { resolveLibraryDocViewUrl } from '../../lib/offlinePrecache';
import { getLocalFileBlob } from '../../lib/offlineStore';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';
import type { DocumentCoverageMetadata, LibraryDoc, LibraryDocCategory, SharedLibraryItem } from '../../types/fabro';

const CATEGORY_LABELS: Record<LibraryDocCategory, string> = {
  libro: 'Libro',
  pdf: 'Documento PDF',
  programa: 'Programa de materia',
  bibliografia: 'Bibliografía',
  foto_apunte: 'Fotografía de apunte',
  investigacion: 'Investigación',
  otro: 'Otro archivo',
};

const CONVERSION_OPTIONS = [
  { id: 'resumen_completo', label: 'Resumen completo' },
  { id: 'resumen_capitulos', label: 'Resumen por capítulos' },
  { id: 'resumen_unidades', label: 'Resumen por unidades' },
  { id: 'glosario', label: 'Glosario de términos' },
  { id: 'preguntas_respuestas', label: 'Preguntas y respuestas' },
  { id: 'opcion_multiple', label: 'Cuestionario opción múltiple' },
  { id: 'preguntas_desarrollo', label: 'Preguntas de desarrollo' },
  { id: 'simulacro', label: 'Simulacro de examen' },
  { id: 'guia_estudio', label: 'Guía de estudio' },
  { id: 'conceptos_dificiles', label: 'Explicar conceptos difíciles' },
  { id: 'fichas_memorizacion', label: 'Fichas de memorización' },
] as const;

function textToSafeHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export const LibraryView: React.FC = () => {
  const {
    libraryDocs,
    subjects,
    selectedSubjectId,
    profile,
    user,
    uploadLibraryDocument,
    updateLibraryDoc,
    deleteLibraryDoc,
    createNote,
    createDeck,
    createCard,
    setActiveSection,
    isOnline,
    recentDocIds,
    precacheState,
    markLibraryDocAccessed,
    precacheStudyDataNow,
  } = useFabro();

  const {
    sharedLibrary,
    taxonomy,
    uploadSharedLibraryItem,
    incrementSharedDownload,
    toggleSharedFavorite,
    deleteSharedLibraryItem,
    submitModerationReport,
    isAdmin,
  } = usePlatform();

  const [libraryTab, setLibraryTab] = useState<'privada' | 'colaborativa'>('privada');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubject, setFilterSubject] = useState(selectedSubjectId || '');

  // Collaborative shared library state
  const [sharedSearch, setSharedSearch] = useState('');
  const [sharedAreaFilter, setSharedAreaFilter] = useState('');
  const [sharedTypeFilter, setSharedTypeFilter] = useState('');
  const [showSharedUpload, setShowSharedUpload] = useState(false);
  const [sharedTitle, setSharedTitle] = useState('');
  const [sharedDesc, setSharedDesc] = useState('');
  const [sharedType, setSharedType] = useState<SharedLibraryItem['itemType']>('pdf');
  const [sharedArea, setSharedArea] = useState('Educación universitaria');
  const [sharedCareer, setSharedCareer] = useState('');
  const [sharedSubjectName, setSharedSubjectName] = useState('');
  const [sharedCourseName, setSharedCourseName] = useState('');
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [sharedUrl, setSharedUrl] = useState('');
  const [sharedRightsConfirmed, setSharedRightsConfirmed] = useState(false);
  const [sharedUploading, setSharedUploading] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState('');
  const sharedFileRef = useRef<HTMLInputElement | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<LibraryDocCategory>('pdf');
  const [uploadSubjectId, setUploadSubjectId] = useState(selectedSubjectId || '');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadAiAuth, setUploadAiAuth] = useState(true);
  const [extractWithAi, setExtractWithAi] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Viewer modal
  const [viewingDoc, setViewingDoc] = useState<LibraryDoc | null>(null);
  const [viewingUrl, setViewingUrl] = useState('');

  // Document-to-Study-Material Converter state
  const [converterDoc, setConverterDoc] = useState<LibraryDoc | null>(null);
  const [conversionType, setConversionType] = useState<string>('resumen_completo');
  const [conversionMode, setConversionMode] = useState<'sencillo' | 'academico'>('academico');
  const [converting, setConverting] = useState(false);
  const [convertedMarkdown, setConvertedMarkdown] = useState('');
  const [convertedCards, setConvertedCards] = useState<
    Array<{
      question: string;
      answer: string;
      cardType: 'flashcard' | 'vf' | 'opcion_multiple';
      options: string[];
      correctOptionIndex: number;
    }>
  >([]);
  const [converterFeedback, setConverterFeedback] = useState('');

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return libraryDocs.filter((d) => {
      if (filterCategory && d.category !== filterCategory) return false;
      if (filterSubject && d.subjectId !== filterSubject) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.extractedText.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [libraryDocs, search, filterCategory, filterSubject]);

  const filteredShared = useMemo(() => {
    const q = sharedSearch.trim().toLowerCase();
    return sharedLibrary.filter((item) => {
      if (sharedAreaFilter && item.area !== sharedAreaFilter) return false;
      if (sharedTypeFilter && item.itemType !== sharedTypeFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.career.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q) ||
        item.courseName.toLowerCase().includes(q) ||
        item.uploaderName.toLowerCase().includes(q)
      );
    });
  }, [sharedLibrary, sharedSearch, sharedAreaFilter, sharedTypeFilter]);

  const handleUploadShared = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharedTitle.trim() || !sharedRightsConfirmed) return;
    setSharedUploading(true);
    setSharedFeedback('');
    try {
      await uploadSharedLibraryItem({
        file: sharedFile,
        externalUrl: sharedUrl.trim(),
        title: sharedTitle.trim(),
        description: sharedDesc.trim(),
        itemType: sharedType,
        area: sharedArea,
        career: sharedCareer.trim(),
        subjectName: sharedSubjectName.trim(),
        courseName: sharedCourseName.trim(),
        authorConfirmedRights: sharedRightsConfirmed,
        visibility: 'publico',
      });
      setShowSharedUpload(false);
      setSharedTitle('');
      setSharedDesc('');
      setSharedCareer('');
      setSharedSubjectName('');
      setSharedCourseName('');
      setSharedFile(null);
      setSharedUrl('');
      setSharedRightsConfirmed(false);
      setSharedFeedback('Material publicado en la Biblioteca Colaborativa Abierta.');
    } catch (err) {
      setSharedFeedback(err instanceof Error ? err.message : 'No se pudo compartir el material.');
    } finally {
      setSharedUploading(false);
    }
  };

  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name || 'General';

  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !uploadTitle.trim()) return;
    setUploading(true);
    setUploadError('');

    try {
      let extractedText = '';
      let coverage: DocumentCoverageMetadata | undefined;
      if (uploadFile) {
        if (uploadFile.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(uploadFile.name)) {
          extractedText = (await uploadFile.text()).slice(0, 250000);
          coverage = {
            totalPages: 1,
            processedPages: extractedText.trim() ? 1 : 0,
            pendingPages: extractedText.trim() ? 0 : 1,
            readStatus: extractedText.trim() ? 'completo' : 'pendiente',
            extractionErrors: [],
            processedAt: new Date().toISOString(),
            fragmentCount: Math.max(1, Math.ceil(extractedText.length / 18000)),
            conceptIndex: [],
            authorsDetected: [],
          };
        } else if (
          extractWithAi &&
          navigator.onLine &&
          uploadFile.size <= 15 * 1024 * 1024 &&
          (uploadFile.type === 'application/pdf' || uploadFile.type.startsWith('image/'))
        ) {
          const base64 = await fileToBase64(uploadFile);
          const resp = await authFetch('/api/ai/extract-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64,
              mimeType: uploadFile.type,
              fileName: uploadFile.name,
            }),
          });
          if (resp.ok) {
            const data = (await resp.json()) as {
              extractedText?: string;
              coverage?: DocumentCoverageMetadata;
            };
            extractedText = data.extractedText || '';
            coverage = data.coverage;
          } else {
            coverage = {
              totalPages: 1,
              processedPages: 0,
              pendingPages: 1,
              readStatus: 'pendiente',
              extractionErrors: ['No se pudo completar la extracción inicial; podés reintentarla desde la biblioteca.'],
              processedAt: new Date().toISOString(),
            };
          }
        }
      }

      await uploadLibraryDocument({
        file: uploadFile || undefined,
        title: uploadTitle.trim() || uploadFile?.name || 'Documento sin título',
        category: uploadCategory,
        subjectId: uploadSubjectId,
        tags: uploadTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        aiAuthorized: uploadAiAuth,
        extractedText,
        coverage,
      });

      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadTags('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir el documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleContinueExtraction = async (docItem: LibraryDoc) => {
    if (!navigator.onLine) {
      setUploadError('Necesitás conexión a internet para continuar la lectura con FABRO IA.');
      return;
    }
    setExtractingDocId(docItem.id);
    try {
      let base64 = '';
      let mimeType = docItem.mimeType || 'application/pdf';
      const localBlob = await getLocalFileBlob(docItem.id);
      if (localBlob?.dataUrl && localBlob.dataUrl.includes(',')) {
        base64 = localBlob.dataUrl.split(',')[1];
        mimeType = localBlob.mimeType || mimeType;
      } else if (docItem.storageUrl) {
        const fetched = await fetch(docItem.storageUrl);
        if (fetched.ok) {
          const blob = await fetched.blob();
          const asFile = new File([blob], docItem.fileName, { type: blob.type || mimeType });
          base64 = await fileToBase64(asFile);
        }
      }
      if (!base64) {
        setUploadError('No se encontró el archivo binario local para continuar leyendo páginas.');
        return;
      }

      const prevProcessed = docItem.coverage?.processedPages || 0;
      const total = docItem.coverage?.totalPages || 0;
      const startPage = total > 0 && prevProcessed > 0 && prevProcessed < total ? prevProcessed + 1 : undefined;
      const endPage = startPage ? Math.min(total, startPage + 14) : undefined;

      const resp = await authFetch('/api/ai/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType,
          fileName: docItem.fileName,
          startPage,
          endPage,
          existingText: docItem.extractedText,
        }),
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        extractedText?: string;
        coverage?: DocumentCoverageMetadata;
      };
      const mergedAuthors = Array.from(
        new Set([...(docItem.coverage?.authorsDetected || []), ...(data.coverage?.authorsDetected || [])])
      );
      const mergedConcepts = Array.from(
        new Set([...(docItem.coverage?.conceptIndex || []), ...(data.coverage?.conceptIndex || [])])
      );
      await updateLibraryDoc(docItem.id, {
        extractedText: data.extractedText || docItem.extractedText,
        coverage: data.coverage
          ? {
              ...data.coverage,
              authorsDetected: mergedAuthors,
              conceptIndex: mergedConcepts,
            }
          : undefined,
      });
    } finally {
      setExtractingDocId(null);
    }
  };

  const closeViewer = () => {
    if (viewingUrl.startsWith('blob:')) {
      URL.revokeObjectURL(viewingUrl);
    }
    setViewingDoc(null);
    setViewingUrl('');
  };

  const handleOpenViewer = async (docItem: LibraryDoc) => {
    markLibraryDocAccessed(docItem.id);
    if (viewingUrl.startsWith('blob:')) {
      URL.revokeObjectURL(viewingUrl);
    }
    setViewingDoc(docItem);
    setViewingUrl(docItem.storageUrl || '');
    const resolved = await resolveLibraryDocViewUrl(docItem.id, docItem.storageUrl);
    if (resolved) {
      setViewingUrl(resolved);
    }
  };

  const handleOpenConverter = (docItem: LibraryDoc) => {
    markLibraryDocAccessed(docItem.id);
    setConverterDoc(docItem);
    setConvertedMarkdown('');
    setConvertedCards([]);
    setConverterFeedback('');
  };

  const handleRunConversion = async () => {
    if (!converterDoc) return;
    if (!navigator.onLine) {
      setConverterFeedback('El convertidor con inteligencia artificial requiere conexión a internet.');
      return;
    }
    setConverting(true);
    setConverterFeedback('');
    setConvertedMarkdown('');
    setConvertedCards([]);

    try {
      let fileBase64 = '';
      let mimeType = '';
      if (!converterDoc.extractedText) {
        const localBlob = await getLocalFileBlob(converterDoc.id);
        if (localBlob?.dataUrl && localBlob.dataUrl.includes(',')) {
          fileBase64 = localBlob.dataUrl.split(',')[1];
          mimeType = localBlob.mimeType;
        }
      }

      const resp = await authFetch('/api/ai/convert-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversionType,
          title: converterDoc.title,
          textContent: converterDoc.extractedText,
          fileBase64,
          mimeType,
          educationLevel: profile?.educationLevel || 'universitario',
          mode: conversionMode,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setConverterFeedback(data.error || 'No se pudo convertir el documento.');
        return;
      }
      setConvertedMarkdown(data.markdown || '');
      setConvertedCards(Array.isArray(data.cards) ? data.cards : []);
    } catch (err) {
      setConverterFeedback(err instanceof Error ? err.message : 'Error al procesar el documento.');
    } finally {
      setConverting(false);
    }
  };

  const handleSaveResultToNote = async () => {
    if (!converterDoc || !convertedMarkdown) return;
    const label = CONVERSION_OPTIONS.find((o) => o.id === conversionType)?.label || 'Material';
    try {
      await createNote({
        subjectId: converterDoc.subjectId,
        unit: '',
        folder: 'Material generado',
        title: `${label}: ${converterDoc.title}`,
        contentHtml: textToSafeHtml(convertedMarkdown),
        contentText: convertedMarkdown,
        tags: ['fabro-ai', conversionType],
        attachments: [],
        offlineAvailable: true,
      });
      setConverterFeedback('Guardado correctamente en tus Apuntes.');
    } catch {
      setConverterFeedback('No se pudo guardar el material en Apuntes.');
    }
  };

  const handleSaveCardsToDeck = async () => {
    if (!converterDoc || convertedCards.length === 0) return;
    try {
      const deckId = await createDeck({
        subjectId: converterDoc.subjectId,
        title: `Fichas: ${converterDoc.title}`,
        description: 'Generado automáticamente desde Biblioteca Inteligente',
      });
      const today = new Date().toISOString().slice(0, 10);
      for (const card of convertedCards) {
        await createCard(deckId, {
          question: card.question,
          answer: card.answer,
          cardType: card.cardType || 'flashcard',
          options: Array.isArray(card.options) ? card.options : [],
          correctOptionIndex: typeof card.correctOptionIndex === 'number' ? card.correctOptionIndex : -1,
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
          nextReviewDate: today,
          lastResult: 'pendiente',
        });
      }
      setConverterFeedback(`Se creó el mazo con ${convertedCards.length} fichas en Memorización.`);
    } catch {
      setConverterFeedback('No se pudieron guardar las fichas de memorización.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Biblioteca inteligente
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Almacená libros, PDFs, programas y fotos de apuntes. Autorizá qué documentos puede leer FABRO AI y convertilos en material de estudio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {libraryTab === 'privada' && libraryDocs.length > 0 && (
            <button
              type="button"
              disabled={!isOnline || precacheState.status === 'precaching'}
              onClick={() => void precacheStudyDataNow(true)}
              title="Precargar todos los documentos y archivos de la biblioteca para lectura offline"
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-70 ${
                precacheState.status === 'precaching'
                  ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                  : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15'
              }`}
            >
              {precacheState.status === 'precaching' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {precacheState.status === 'precaching'
                ? 'Precargando...'
                : isOnline
                ? `Precargar offline (${libraryDocs.length})`
                : `Lista offline (${libraryDocs.length})`}
            </button>
          )}
          {libraryTab === 'privada' ? (
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Subir documento
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSharedUpload(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Compartir material abierto
            </button>
          )}
        </div>
      </div>

      {/* Library Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setLibraryTab('privada')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            libraryTab === 'privada'
              ? 'bg-sky-600 text-white'
              : 'bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Mi Biblioteca Privada ({libraryDocs.length})
        </button>
        <button
          type="button"
          onClick={() => setLibraryTab('colaborativa')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            libraryTab === 'colaborativa'
              ? 'bg-sky-600 text-white'
              : 'bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Biblioteca Colaborativa Abierta ({sharedLibrary.length})
        </button>
      </div>

      {libraryTab === 'colaborativa' ? (
        <div className="space-y-4">
          {sharedFeedback && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
              <span>{sharedFeedback}</span>
              <button type="button" onClick={() => setSharedFeedback('')} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sharedSearch}
                onChange={(e) => setSharedSearch(e.target.value)}
                placeholder="Buscar guías, apuntes, materias o autores..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <select
              value={sharedAreaFilter}
              onChange={(e) => setSharedAreaFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-sm"
            >
              <option value="">Todas las áreas</option>
              {taxonomy.map((t) => (
                <option key={t.id} value={t.area}>
                  {t.area}
                </option>
              ))}
            </select>
            <select
              value={sharedTypeFilter}
              onChange={(e) => setSharedTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-sm"
            >
              <option value="">Todos los formatos</option>
              <option value="pdf">PDF</option>
              <option value="apunte">Apunte propio</option>
              <option value="guia">Guía de estudio</option>
              <option value="bibliografia">Bibliografía abierta</option>
              <option value="presentacion">Presentación</option>
              <option value="dominio_publico">Obra de dominio público</option>
              <option value="enlace">Enlace externo</option>
            </select>
          </div>

          {filteredShared.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1623] p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Todavía no hay materiales compartidos con este filtro
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Podés compartir apuntes propios, guías gratuitas o enlaces de dominio público respetando los derechos de autor.
              </p>
              <button
                type="button"
                onClick={() => setShowSharedUpload(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Compartir primer material
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredShared.map((item) => {
                const isFav = Boolean(user && item.favoriteUserIds.includes(user.uid));
                const canDelete = Boolean(isAdmin || (user && item.uploaderId === user.uid));
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="inline-block rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-1">
                            {item.itemType.replace('_', ' ')} · {item.area}
                          </span>
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleSharedFavorite(item)}
                          aria-label="Marcar favorito"
                          className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${
                            isFav ? 'text-rose-500 bg-rose-500/10' : 'text-slate-400 hover:text-rose-500'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Por <strong className="text-slate-700 dark:text-slate-200">{item.uploaderName}</strong>
                        {item.subjectName ? ` · ${item.subjectName}` : ''}
                        {item.career ? ` · ${item.career}` : ''}
                        {` · ${item.downloadsCount} descargas`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {item.fileUrl ? (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => void incrementSharedDownload(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                          >
                            {item.itemType === 'enlace' ? (
                              <ExternalLink className="w-3.5 h-3.5" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {item.itemType === 'enlace' ? 'Abrir recurso' : 'Descargar'}
                          </a>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400">
                            Sin archivo adjunto
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void submitModerationReport({
                              targetType: 'biblioteca',
                              targetId: item.id,
                              targetSummary: item.title,
                              reason: 'Revisión de derechos o contenido',
                              details: `Reportado desde Biblioteca Colaborativa (${item.uploaderName})`,
                            });
                            setSharedFeedback('Reporte enviado al equipo de moderación.');
                          }}
                          title="Reportar contenido"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void deleteSharedLibraryItem(item.id)}
                            title="Eliminar material"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en biblioteca y texto extraído..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-sm"
        >
          <option value="">Todas las materias</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      {filteredDocs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1623] p-12 text-center space-y-3">
          <BookMarked className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Tu biblioteca está vacía
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Subí archivos PDF, bibliografía, programas de materias o fotos de apuntes para organizarlos y convertirlos en resúmenes o simulacros.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agregar primer documento
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
          {filteredDocs.map((docItem) => (
            <div
              key={docItem.id}
              className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                    {docItem.title}
                  </h3>
                  {docItem.coverage && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                        docItem.coverage.readStatus === 'completo'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : docItem.coverage.readStatus === 'parcial'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {docItem.coverage.readStatus === 'completo'
                        ? `${docItem.coverage.processedPages}/${docItem.coverage.totalPages} págs · Completo`
                        : docItem.coverage.readStatus === 'parcial'
                          ? `Parcial: ${docItem.coverage.processedPages}/${docItem.coverage.totalPages} págs (${docItem.coverage.pendingPages} pend.)`
                          : 'Lectura pendiente'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {CATEGORY_LABELS[docItem.category]} · {getSubjectName(docItem.subjectId)} · {docItem.fileName} ·{' '}
                  <span className="font-mono tabular-nums">{Math.max(1, Math.round(docItem.sizeBytes / 1024))} KB</span>
                  {docItem.extractedText ? ' · Texto indexado' : ''}
                  {docItem.coverage?.authorsDetected && docItem.coverage.authorsDetected.length > 0
                    ? ` · Autores: ${docItem.coverage.authorsDetected.slice(0, 2).join(', ')}`
                    : ''}
                  {recentDocIds.includes(docItem.id) ? ' · Reciente offline' : ' · Precargado offline'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(docItem.coverage?.readStatus === 'parcial' ||
                  docItem.coverage?.readStatus === 'pendiente' ||
                  (!docItem.extractedText &&
                    (docItem.mimeType === 'application/pdf' || docItem.mimeType.startsWith('image/')))) && (
                  <button
                    type="button"
                    disabled={extractingDocId === docItem.id || !isOnline}
                    onClick={() => void handleContinueExtraction(docItem)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${extractingDocId === docItem.id ? 'animate-spin' : ''}`} />
                    {extractingDocId === docItem.id
                      ? 'Leyendo...'
                      : docItem.coverage?.pendingPages
                        ? `Continuar (${docItem.coverage.pendingPages} pend.)`
                        : 'Extraer texto'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void updateLibraryDoc(docItem.id, { aiAuthorized: !docItem.aiAuthorized })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                    docItem.aiAuthorized
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                  title="Controlá si FABRO AI puede consultar este archivo"
                >
                  {docItem.aiAuthorized ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {docItem.aiAuthorized ? 'IA autorizada' : 'IA bloqueada'}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenConverter(docItem)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 px-3 py-1.5 text-xs font-semibold hover:bg-sky-600/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Convertir
                </button>

                <button
                  type="button"
                  onClick={() => void handleOpenViewer(docItem)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver
                </button>

                <button
                  type="button"
                  onClick={() => void deleteLibraryDoc(docItem)}
                  aria-label={`Eliminar ${docItem.title}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Upload Collaborative Shared Material Modal */}
      {showSharedUpload && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] my-2 sm:my-6 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623]">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Compartir en Biblioteca Abierta
              </h3>
              <button type="button" onClick={() => setShowSharedUpload(false)} className="p-1.5 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadShared} className="p-4 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Título del material *
                </label>
                <input
                  type="text"
                  required
                  value={sharedTitle}
                  onChange={(e) => setSharedTitle(e.target.value)}
                  placeholder="Ej. Guía práctica de Electricidad domiciliaria"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de material
                  </label>
                  <select
                    value={sharedType}
                    onChange={(e) => setSharedType(e.target.value as SharedLibraryItem['itemType'])}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="pdf">PDF</option>
                    <option value="apunte">Apunte propio</option>
                    <option value="guia">Guía de estudio</option>
                    <option value="presentacion">Presentación</option>
                    <option value="bibliografia">Bibliografía abierta</option>
                    <option value="dominio_publico">Dominio público / Creative Commons</option>
                    <option value="enlace">Enlace externo oficial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Área temática
                  </label>
                  <select
                    value={sharedArea}
                    onChange={(e) => setSharedArea(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    {taxonomy.map((t) => (
                      <option key={t.id} value={t.area}>
                        {t.area}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={sharedCareer}
                  onChange={(e) => setSharedCareer(e.target.value)}
                  placeholder="Carrera / Nivel"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={sharedSubjectName}
                  onChange={(e) => setSharedSubjectName(e.target.value)}
                  placeholder="Materia / Oficio"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={sharedCourseName}
                  onChange={(e) => setSharedCourseName(e.target.value)}
                  placeholder="Curso asociado"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={sharedDesc}
                  onChange={(e) => setSharedDesc(e.target.value)}
                  placeholder="Contenido resumido y nivel recomendado..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <input
                  ref={sharedFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,image/*"
                  className="hidden"
                  onChange={(e) => setSharedFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => sharedFileRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-3 text-xs text-slate-600 dark:text-slate-300 hover:border-sky-500 cursor-pointer"
                >
                  {sharedFile ? `Archivo seleccionado: ${sharedFile.name}` : 'Adjuntar archivo (PDF, PPT, DOCX o imagen)'}
                </button>
                <input
                  type="url"
                  value={sharedUrl}
                  onChange={(e) => setSharedUrl(e.target.value)}
                  placeholder="O pegá un enlace directo de repositorio universitario / dominio público (https://...)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={sharedRightsConfirmed}
                  onChange={(e) => setSharedRightsConfirmed(e.target.checked)}
                  className="mt-0.5 accent-sky-600"
                />
                <span>
                  Declaro que este material es de mi autoría, de libre distribución educativa o de dominio público, y no infringe derechos de autor ni libros comerciales protegidos.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSharedUpload(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sharedUploading || !sharedRightsConfirmed}
                  className="rounded-lg bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
                >
                  {sharedUploading ? 'Publicando...' : 'Publicar gratis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] my-2 sm:my-6 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623]">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Subir documento a la biblioteca
              </h3>
              <button type="button" onClick={() => setShowUpload(false)} className="p-1.5 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">

            {uploadError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.doc,.docx,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                    if (f && !uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center hover:border-sky-500 transition-colors cursor-pointer"
                >
                  <Upload className="w-6 h-6 text-sky-600 dark:text-sky-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {uploadFile ? uploadFile.name : 'Seleccionar PDF, imagen, programa o apunte'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {uploadFile
                      ? `${Math.max(1, Math.round(uploadFile.size / 1024))} KB`
                      : 'PDF, PNG/JPG, TXT o MD'}
                  </p>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Categoría
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as LibraryDocCategory)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nombre de la materia
                  </label>
                  <select
                    value={uploadSubjectId}
                    onChange={(e) => setUploadSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="">General</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Etiquetas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="parcial, unidad 2, autores"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadAiAuth}
                    onChange={(e) => setUploadAiAuth(e.target.checked)}
                    className="accent-sky-600"
                  />
                  <span>Autorizar a FABRO AI para analizar este documento</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extractWithAi}
                    onChange={(e) => setExtractWithAi(e.target.checked)}
                    className="accent-sky-600"
                  />
                  <span>Extraer texto automáticamente (OCR / lectura PDF) para búsqueda y tutoría</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
                >
                  {uploading ? 'Procesando archivo...' : 'Guardar en biblioteca'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
          <div className="w-full max-w-3xl max-h-[92dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold truncate">{viewingDoc.title}</h3>
                <p className="text-xs text-slate-500 truncate">{viewingDoc.fileName}</p>
              </div>
              <button type="button" onClick={closeViewer} className="p-1.5 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {viewingUrl && viewingDoc.mimeType.startsWith('image/') && (
                <img
                  src={viewingUrl}
                  alt={viewingDoc.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[420px] mx-auto rounded-lg border border-slate-200 dark:border-slate-800"
                />
              )}
              {viewingUrl && viewingDoc.mimeType === 'application/pdf' && (
                <iframe
                  src={viewingUrl}
                  title={viewingDoc.title}
                  className="w-full h-[360px] sm:h-[420px] rounded-lg border border-slate-200 dark:border-slate-800"
                />
              )}
              {viewingDoc.extractedText ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Texto extraído del documento
                    </p>
                    <AudioReadAloudControl
                      getText={() => viewingDoc.extractedText}
                      title={viewingDoc.title || 'documento-fabro'}
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 text-sm whitespace-pre-wrap leading-relaxed break-words">
                    {viewingDoc.extractedText}
                  </div>
                </div>
              ) : (
                !viewingUrl && (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No hay vista previa de texto disponible para este archivo.
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document-to-Study-Material Converter Modal */}
      {converterDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
          <div className="w-full max-w-4xl max-h-[92dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  Convertidor de material de estudio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Documento fuente: {converterDoc.title}
                </p>
              </div>
              <button type="button" onClick={() => setConverterDoc(null)} className="p-1.5 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Formato a generar
                  </label>
                  <select
                    value={conversionType}
                    onChange={(e) => setConversionType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    {CONVERSION_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Enfoque
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setConversionMode('sencillo')}
                      className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                        conversionMode === 'sencillo' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Sencillo
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversionMode('academico')}
                      className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                        conversionMode === 'academico' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Académico
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => void handleRunConversion()}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {converting ? 'Generando material con Gemini...' : 'Generar material'}
                </button>

                {convertedMarkdown && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveResultToNote()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Guardar en Apuntes
                    </button>
                    {convertedCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleSaveCardsToDeck()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Guardar {convertedCards.length} fichas en Memorización
                      </button>
                    )}
                    <AudioReadAloudControl
                      getText={() => convertedMarkdown}
                      title={`${converterDoc.title}_${conversionType}`}
                    />
                  </div>
                )}
              </div>

              {converterFeedback && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {converterFeedback}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConverterDoc(null);
                      setActiveSection(convertedCards.length > 0 ? 'memorizacion' : 'apuntes');
                    }}
                    className="underline font-medium cursor-pointer"
                  >
                    Abrir sección
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!convertedMarkdown && !converting ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
                  Elegí el tipo de material que necesitás y presioná <strong>Generar material</strong>.
                </p>
              ) : (
                <div className="fabro-markdown text-sm text-slate-800 dark:text-slate-200">
                  <Markdown remarkPlugins={[remarkGfm]}>{convertedMarkdown}</Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
