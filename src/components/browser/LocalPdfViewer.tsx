import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Loader2,
  Printer,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface LocalPdfViewerProps {
  fileName: string;
  fileDataUrl?: string;
  remoteUrl?: string;
  onSendToDocuments: (extractedText: string, fileName: string) => void;
  onSaveDownload?: (filename: string, url: string) => void;
}

export const LocalPdfViewer: React.FC<LocalPdfViewerProps> = ({
  fileName,
  fileDataUrl,
  remoteUrl,
  onSendToDocuments,
  onSaveDownload,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [matchingPages, setMatchingPages] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      setLoading(true);
      setErrorMsg('');
      setPdfDoc(null);
      try {
        const source = fileDataUrl || remoteUrl;
        if (!source) throw new Error('No hay fuente PDF seleccionada.');
        const resp = await fetch(source);
        if (!resp.ok) {
          throw new Error(`El servidor respondió HTTP ${resp.status} al descargar el PDF.`);
        }
        const buffer = await resp.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNumber(1);

        // Index page text for instant in-document search and FABRO DOCUMENTS handoff
        const textMap: Record<number, string> = {};
        for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          textMap[i] = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
        }
        if (!cancelled) setPageTexts(textMap);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar este PDF directamente en el visor local (puede requerir descarga externa por CORS).'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPdf();
    return () => {
      cancelled = true;
    };
  }, [fileDataUrl, remoteUrl]);

  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, zoom]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      setMatchingPages([]);
      return;
    }
    const hits = Object.entries(pageTexts)
      .filter(([, text]) => text.toLowerCase().includes(q))
      .map(([p]) => Number(p))
      .sort((a, b) => a - b);
    setMatchingPages(hits);
    if (hits.length > 0) {
      setPageNumber(hits[0]);
    }
  };

  const handleDownloadPdf = () => {
    const href = fileDataUrl || remoteUrl;
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName || 'documento-fabro.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onSaveDownload?.(fileName || 'documento-fabro.pdf', href);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendDocs = () => {
    const fullText = Object.keys(pageTexts)
      .sort((a, b) => Number(a) - Number(b))
      .map((p) => `[Página ${p}]\n${pageTexts[Number(p)]}`)
      .join('\n\n');
    onSendToDocuments(fullText, fileName);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-100 dark:bg-[#090D16]">
      {/* PDF Viewer Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C121E] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
            {fileName}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-35 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300 px-1">
            {pageNumber} / {numPages || 1}
          </span>
          <button
            type="button"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-35 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            title="Alejar zoom"
            className="p-1 rounded border border-slate-200 dark:border-slate-700 cursor-pointer ml-1"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
            title="Acercar zoom"
            className="p-1 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar palabra..."
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-7 pr-2 py-1 text-xs text-slate-900 dark:text-white w-36"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium cursor-pointer"
          >
            Buscar
          </button>
          {matchingPages.length > 0 && (
            <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
              Págs: {matchingPages.join(', ')}
            </span>
          )}
        </form>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar</span>
          </button>
          <button
            type="button"
            onClick={handleSendDocs}
            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Enviar a FABRO DOCUMENTS</span>
          </button>
        </div>
      </div>

      {/* PDF Canvas Surface */}
      <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
            <span>Renderizando documento PDF...</span>
          </div>
        ) : errorMsg ? (
          <div className="max-w-md rounded-xl border border-amber-500/30 bg-white dark:bg-[#0F1623] p-5 text-center space-y-3 my-8">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{errorMsg}</p>
            {remoteUrl && (
              <a
                href={remoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
              >
                <span>Abrir PDF en navegador externo</span>
              </a>
            )}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="shadow-lg border border-slate-200 dark:border-slate-700 bg-white rounded"
          />
        )}
      </div>
    </div>
  );
};
