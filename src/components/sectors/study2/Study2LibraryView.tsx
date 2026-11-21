import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useStudy2 } from '../../../context/Study2Context';
import {
  formatBytesCompact,
  loadStudyFileBlob,
  triggerBlobDownload,
} from '../../../services/study2FileExtractor';
import type { StudyLibraryFileMeta } from '../../../types/study2';

export const Study2LibraryView: React.FC = () => {
  const {
    ownerUid,
    snapshot,
    createLibraryFolder,
    deleteLibraryFolder,
    uploadLibraryFile,
    updateLibraryFileMeta,
    deleteLibraryFile,
    sendToFabroAi,
  } = useStudy2();

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Preview Modal state
  const [previewFile, setPreviewFile] = useState<StudyLibraryFileMeta | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const subjectMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.id, s])),
    [snapshot.subjects]
  );

  const childFolders = useMemo(
    () => snapshot.libraryFolders.filter((f) => f.parentId === activeFolderId),
    [activeFolderId, snapshot.libraryFolders]
  );

  const breadcrumbFolders = useMemo(() => {
    const chain: Array<{ id: string | null; name: string }> = [
      { id: null, name: 'Mi Biblioteca' },
    ];
    let curId = activeFolderId;
    const guard = new Set<string>();
    const stack: Array<{ id: string; name: string }> = [];
    while (curId && !guard.has(curId)) {
      guard.add(curId);
      const found = snapshot.libraryFolders.find((f) => f.id === curId);
      if (!found) break;
      stack.unshift({ id: found.id, name: found.name });
      curId = found.parentId;
    }
    return [...chain, ...stack];
  }, [activeFolderId, snapshot.libraryFolders]);

  const visibleFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshot.libraryFiles.filter((file) => {
      if (!q && file.folderId !== activeFolderId) return false;
      if (subjectFilter && file.subjectId !== subjectFilter) return false;
      if (onlyFavorites && !file.favorite) return false;
      if (!q) return true;
      return (
        file.name.toLowerCase().includes(q) ||
        file.tags.some((t) => t.toLowerCase().includes(q)) ||
        file.extractedText.toLowerCase().includes(q)
      );
    });
  }, [activeFolderId, onlyFavorites, searchQuery, snapshot.libraryFiles, subjectFilter]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      for (const file of files) {
        await uploadLibraryFile(file, {
          folderId: activeFolderId,
          subjectId: subjectFilter || undefined,
        });
      }
      setUploadStatus(
        `${files.length} ${
          files.length === 1 ? 'archivo guardado' : 'archivos guardados'
        } con contenido real en tu biblioteca.`
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleOpenPreview = async (file: StudyLibraryFileMeta) => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewFile(file);
    const loaded = await loadStudyFileBlob(ownerUid, file.id);
    if (loaded) {
      setPreviewBlobUrl(URL.createObjectURL(loaded.blob));
    }
  };

  const handleClosePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewFile(null);
  };

  const handleDownloadFile = async (file: StudyLibraryFileMeta) => {
    const loaded = await loadStudyFileBlob(ownerUid, file.id);
    if (loaded) {
      triggerBlobDownload(loaded.blob, loaded.name);
      return;
    }
    if (file.extractedText) {
      const fallback = new Blob([file.extractedText], { type: 'text/plain;charset=utf-8' });
      triggerBlobDownload(fallback, `${file.name}.txt`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Biblioteca
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Almacená archivos reales (PDF, Word, texto e imágenes) con extracción de contenido, carpetas, etiquetas y vista previa local.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv,.json,image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{uploading ? 'Procesando...' : 'Subir archivos'}</span>
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, etiqueta o texto interno..."
              className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 text-xs"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          >
            <option value="">Todas las materias</option>
            {snapshot.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
              onlyFavorites
                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Favoritos
          </button>
        </div>

        {uploadStatus && (
          <p className="text-xs font-semibold text-emerald-600">{uploadStatus}</p>
        )}
      </section>

      {/* Breadcrumbs + New Folder */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Carpetas" className="flex flex-wrap items-center gap-1 text-xs">
          {breadcrumbFolders.map((crumb, idx) => (
            <React.Fragment key={crumb.id || 'root'}>
              {idx > 0 && <span className="text-slate-400">/</span>}
              <button
                type="button"
                onClick={() => setActiveFolderId(crumb.id)}
                className={`px-2 py-1 rounded-lg font-semibold cursor-pointer ${
                  idx === breadcrumbFolders.length - 1
                    ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </nav>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newFolderName.trim()) return;
            createLibraryFolder(newFolderName, activeFolderId, subjectFilter || undefined);
            setNewFolderName('');
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nueva carpeta..."
            className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
          />
          <button
            type="submit"
            className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Crear
          </button>
        </form>
      </div>

      {/* Subfolders Grid */}
      {!searchQuery && childFolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {childFolders.map((folder) => (
            <div
              key={folder.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center justify-between gap-2 hover:border-slate-400 transition-colors"
            >
              <button
                type="button"
                onClick={() => setActiveFolderId(folder.id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
              >
                <Folder className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold truncate">{folder.name}</span>
              </button>
              <button
                type="button"
                onClick={() => deleteLibraryFolder(folder.id)}
                aria-label={`Eliminar carpeta ${folder.name}`}
                className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Files List */}
      {visibleFiles.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Tu biblioteca está vacía en esta ubicación
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Subí archivos reales PDF, Word (.docx), texto o imágenes. Se guarda el archivo íntegro en tu dispositivo y se extrae el texto para consultarlo con FABRO IA.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleFiles.map((file) => {
            const sub = file.subjectId ? subjectMap.get(file.subjectId) : undefined;
            const isImage = file.mimeType.startsWith('image/');
            return (
              <article
                key={file.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      {isImage ? (
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-600" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {formatBytesCompact(file.sizeBytes)}
                        {file.pageCount ? ` · ${file.pageCount} págs.` : ''}
                        {sub ? ` · ${sub.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateLibraryFileMeta(file.id, { favorite: !file.favorite })
                    }
                    aria-label="Favorito"
                    className="p-1.5 cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        file.favorite ? 'text-amber-500 fill-amber-500' : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>

                {file.extractionNote && (
                  <p className="text-[11px] text-slate-500">{file.extractionNote}</p>
                )}

                {file.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                    {file.tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-0.5">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleOpenPreview(file)}
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadFile(file)}
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        sendToFabroAi({
                          subjectId: file.subjectId,
                          fileIds: [file.id],
                          mode: 'analizar_documento',
                          prompt: `Analizá el documento "${file.name}".`,
                        })
                      }
                      className="min-h-[32px] px-2.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      FABRO IA
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteLibraryFile(file.id)}
                      aria-label="Eliminar archivo"
                      className="min-h-[32px] min-w-[32px] rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Real Document Preview & Metadata Modal */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${previewFile.name}`}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={handleClosePreview}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{previewFile.name}</h3>
                <p className="text-[11px] text-slate-500">
                  {formatBytesCompact(previewFile.sizeBytes)} · {previewFile.extractionNote}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePreview}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Subject & Tag Assignment */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={previewFile.subjectId || ''}
                  onChange={(e) => {
                    const nextSub = e.target.value || undefined;
                    updateLibraryFileMeta(previewFile.id, { subjectId: nextSub });
                    setPreviewFile({ ...previewFile, subjectId: nextSub });
                  }}
                  className="min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs"
                >
                  <option value="">Sin materia asociada</option>
                  {snapshot.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const clean = tagInput.trim().replace(/^#/, '');
                    if (!clean || previewFile.tags.includes(clean)) return;
                    const nextTags = [...previewFile.tags, clean];
                    updateLibraryFileMeta(previewFile.id, { tags: nextTags });
                    setPreviewFile({ ...previewFile, tags: nextTags });
                    setTagInput('');
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Agregar etiqueta..."
                    className="min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    +
                  </button>
                </form>
              </div>

              {/* Actual Visual Preview */}
              {previewBlobUrl && previewFile.mimeType.startsWith('image/') && (
                <img
                  src={previewBlobUrl}
                  alt={previewFile.name}
                  className="max-h-[420px] mx-auto rounded-xl border border-slate-200 dark:border-slate-800 object-contain"
                />
              )}

              {previewBlobUrl && previewFile.mimeType === 'application/pdf' && (
                <iframe
                  src={previewBlobUrl}
                  title={previewFile.name}
                  className="w-full h-[380px] rounded-xl border border-slate-200 dark:border-slate-800"
                />
              )}

              {/* Extracted Text Preview */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Texto extraído del documento
                </p>
                {previewFile.extractedText ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 max-h-[280px] overflow-y-auto">
                    {previewFile.extractedText}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-500">
                    Este archivo no contiene texto extraído (podés descargarlo o visualizarlo directamente arriba).
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
