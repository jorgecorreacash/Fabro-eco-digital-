import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import {
  Combine,
  Crop,
  Download,
  FileImage,
  FileText,
  FolderCog,
  Image as ImageIcon,
  Loader2,
  Minimize2,
  ScanText,
  Scissors,
  ShieldCheck,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { markdownToHtml } from '../../lib/exporters';
import { FabroAIActionStrip } from '../common/FabroAIActionStrip';

// Configure local Vite worker for pdfjs-dist so PDF rendering runs 100% locally offline
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type DocToolId =
  | 'img2pdf'
  | 'pdf2img'
  | 'merge'
  | 'split'
  | 'compress'
  | 'office2pdf'
  | 'extract'
  | 'ocr'
  | 'imagedit';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parsePageRanges(spec: string, maxPages: number): number[] {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const clean = part.trim();
    if (!clean) continue;
    const range = clean.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Math.max(1, Math.min(maxPages, Number(range[1])));
      const b = Math.max(1, Math.min(maxPages, Number(range[2])));
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i - 1);
    } else if (/^\d+$/.test(clean)) {
      const n = Number(clean);
      if (n >= 1 && n <= maxPages) out.add(n - 1);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

export const FabroDocumentsView: React.FC = () => {
  const { createNote, selectedSubjectId } = useFabro();

  const [activeTool, setActiveTool] = useState<DocToolId>('img2pdf');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Outputs
  const [extractedText, setExtractedText] = useState('');
  const [extractedTitle, setExtractedTitle] = useState('Texto procesado en FABRO Documents');
  const [renderedImages, setRenderedImages] = useState<Array<{ name: string; dataUrl: string }>>([]);

  // Specific parameters
  const [splitRange, setSplitRange] = useState('1-2');
  const [compressQuality, setCompressQuality] = useState(0.65);
  const [ocrLang, setOcrLang] = useState<'spa' | 'eng'>('spa');
  const [ocrProgress, setOcrProgress] = useState(0);

  // Image Editor state
  const [editImgSrc, setEditImgSrc] = useState('');
  const [editOrigW, setEditOrigW] = useState(0);
  const [editOrigH, setEditOrigH] = useState(0);
  const [targetW, setTargetW] = useState(1200);
  const [targetH, setTargetH] = useState(800);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(100);
  const [cropH, setCropH] = useState(100);
  const [imgOutFormat, setImgOutFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/jpeg');
  const [imgQuality, setImgQuality] = useState(0.82);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('fabro_documents_handoff');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { fileName?: string; extractedText?: string };
      sessionStorage.removeItem('fabro_documents_handoff');
      if (parsed.extractedText?.trim()) {
        setActiveTool('extract');
        setExtractedTitle(parsed.fileName || 'PDF recibido desde FABRO Browser');
        setExtractedText(parsed.extractedText);
        setStatusMsg('Texto del PDF recibido desde el Visor integrado de FABRO Browser.');
      }
    } catch {
      // ignore invalid session payload
    }
  }, []);

  const resetFeedback = () => {
    setErrorMsg('');
    setStatusMsg('');
  };

  // 1. Images -> PDF
  const handleImagesToPdf = async (files: FileList) => {
    resetFeedback();
    setBusy(true);
    try {
      const pdfDoc = await PDFDocument.create();
      for (const file of Array.from(files)) {
        const bytes = await file.arrayBuffer();
        const isPng = file.type.includes('png') || file.name.toLowerCase().endsWith('.png');
        const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const outBytes = await pdfDoc.save();
      downloadBlob(new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }), 'fabro_imagenes_unidas.pdf');
      setStatusMsg(`PDF generado localmente con ${files.length} imagen(es).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error convirtiendo imágenes a PDF (usá JPG o PNG).');
    } finally {
      setBusy(false);
    }
  };

  // 2. PDF -> Images
  const handlePdfToImages = async (file: File) => {
    resetFeedback();
    setBusy(true);
    setRenderedImages([]);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const imgs: Array<{ name: string; dataUrl: string }> = [];
      const total = Math.min(pdf.numPages, 25);
      for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        imgs.push({
          name: `${file.name.replace(/\.pdf$/i, '')}_p${i}.png`,
          dataUrl: canvas.toDataURL('image/png'),
        });
      }
      setRenderedImages(imgs);
      setStatusMsg(`${imgs.length} página(s) convertidas a PNG localmente.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo convertir el PDF a imágenes.');
    } finally {
      setBusy(false);
    }
  };

  // 3. Merge PDFs
  const handleMergePdfs = async (files: FileList) => {
    resetFeedback();
    setBusy(true);
    try {
      const merged = await PDFDocument.create();
      for (const file of Array.from(files)) {
        const bytes = await file.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
      }
      const out = await merged.save();
      downloadBlob(new Blob([new Uint8Array(out)], { type: 'application/pdf' }), 'fabro_pdf_unido.pdf');
      setStatusMsg(`${files.length} archivos PDF unidos en un único documento.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al unir los archivos PDF.');
    } finally {
      setBusy(false);
    }
  };

  // 4. Split PDF
  const handleSplitPdf = async (file: File) => {
    resetFeedback();
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const indices = parsePageRanges(splitRange, src.getPageCount());
      if (indices.length === 0) {
        throw new Error(`Indicá páginas válidas entre 1 y ${src.getPageCount()} (ej. 1-3,5).`);
      }
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(src, indices);
      copied.forEach((p) => outDoc.addPage(p));
      const out = await outDoc.save();
      downloadBlob(
        new Blob([new Uint8Array(out)], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}_recorte.pdf`
      );
      setStatusMsg(`Se extrajeron ${indices.length} página(s) del PDF.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al dividir el PDF.');
    } finally {
      setBusy(false);
    }
  };

  // 5. Compress PDF (local page re-encoding into compact JPEG PDF)
  const handleCompressPdf = async (file: File) => {
    resetFeedback();
    setBusy(true);
    try {
      const origSizeKb = Math.round(file.size / 1024);
      const buf = await file.arrayBuffer();
      const srcPdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const outPdf = await PDFDocument.create();
      const total = Math.min(srcPdf.numPages, 40);
      for (let i = 1; i <= total; i++) {
        const page = await srcPdf.getPage(i);
        const vp = page.getViewport({ scale: 1.25 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        const jpgDataUrl = canvas.toDataURL('image/jpeg', compressQuality);
        const jpgBytes = await fetch(jpgDataUrl).then((r) => r.arrayBuffer());
        const jpgImg = await outPdf.embedJpg(jpgBytes);
        const newPage = outPdf.addPage([vp.width, vp.height]);
        newPage.drawImage(jpgImg, { x: 0, y: 0, width: vp.width, height: vp.height });
      }
      const outBytes = await outPdf.save();
      const newSizeKb = Math.round(outBytes.byteLength / 1024);
      downloadBlob(
        new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}_comprimido.pdf`
      );
      setStatusMsg(`PDF optimizado localmente: ${origSizeKb} KB -> ${newSizeKb} KB (${total} págs).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error comprimiendo el PDF.');
    } finally {
      setBusy(false);
    }
  };

  // 6. DOCX / TXT -> PDF
  const handleOfficeToPdf = async (file: File) => {
    resetFeedback();
    setBusy(true);
    try {
      let plain = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        plain = res.value;
      } else {
        plain = await file.text();
      }
      setExtractedTitle(file.name.replace(/\.(docx|txt)$/i, ''));
      setExtractedText(plain);

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const maxW = pdf.internal.pageSize.getWidth() - 96;
      const maxH = pdf.internal.pageSize.getHeight() - 56;
      let y = 56;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(file.name, 48, y);
      y += 24;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10.5);
      for (const para of plain.split(/\r?\n/)) {
        const lines = pdf.splitTextToSize(para || ' ', maxW) as string[];
        for (const l of lines) {
          if (y > maxH) {
            pdf.addPage();
            y = 56;
          }
          pdf.text(l, 48, y);
          y += 15;
        }
      }
      pdf.save(`${file.name.replace(/\.(docx|txt)$/i, '')}.pdf`);
      setStatusMsg(`"${file.name}" convertido a PDF localmente y texto listo para analizar.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo convertir el archivo DOCX/TXT.');
    } finally {
      setBusy(false);
    }
  };

  // 7. Extract text from PDF
  const handleExtractPdfText = async (file: File) => {
    resetFeedback();
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const chunks: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const line = tc.items
          .map((it) => ('str' in it ? it.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (line) chunks.push(`--- Página ${i} ---\n${line}`);
      }
      const full = chunks.join('\n\n');
      setExtractedTitle(file.name.replace(/\.pdf$/i, ''));
      setExtractedText(full || 'Este PDF parece ser escaneado sin capa de texto. Usá la herramienta OCR local.');
      setStatusMsg(`Texto extraído de ${pdf.numPages} página(s) en el navegador.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo extraer texto del PDF.');
    } finally {
      setBusy(false);
    }
  };

  // 8. Local OCR (Image or Scanned PDF)
  const handleRunOcr = async (file: File) => {
    resetFeedback();
    setBusy(true);
    setOcrProgress(0);
    try {
      let textOut = '';
      if (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const maxPages = Math.min(pdf.numPages, 6);
        const pageTexts: string[] = [];
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1.8 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          const res = await Tesseract.recognize(canvas, ocrLang, {
            logger: (m) => {
              if (typeof m.progress === 'number') {
                setOcrProgress(Math.round(((i - 1 + m.progress) / maxPages) * 100));
              }
            },
          });
          pageTexts.push(`--- Página ${i} (OCR) ---\n${res.data.text.trim()}`);
        }
        textOut = pageTexts.join('\n\n');
      } else {
        const res = await Tesseract.recognize(file, ocrLang, {
          logger: (m) => {
            if (typeof m.progress === 'number') setOcrProgress(Math.round(m.progress * 100));
          },
        });
        textOut = res.data.text.trim();
      }
      setExtractedTitle(`OCR · ${file.name}`);
      setExtractedText(textOut || 'No se detectó texto legible.');
      setStatusMsg('OCR ejecutado 100% localmente en tu navegador.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error ejecutando OCR local.');
    } finally {
      setBusy(false);
    }
  };

  // 9. Image Editor Load & Export
  const handleLoadImageForEdit = (file: File) => {
    resetFeedback();
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onload = () => {
        setEditImgSrc(src);
        setEditOrigW(img.naturalWidth);
        setEditOrigH(img.naturalHeight);
        setTargetW(img.naturalWidth);
        setTargetH(img.naturalHeight);
        setCropX(0);
        setCropY(0);
        setCropW(100);
        setCropH(100);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleExportEditedImage = () => {
    if (!editImgSrc) return;
    const img = new Image();
    img.onload = () => {
      const sx = (cropX / 100) * img.naturalWidth;
      const sy = (cropY / 100) * img.naturalHeight;
      const sw = Math.max(1, (cropW / 100) * img.naturalWidth);
      const sh = Math.max(1, (cropH / 100) * img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, targetW);
      canvas.height = Math.max(1, targetH);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const ext = imgOutFormat === 'image/png' ? 'png' : imgOutFormat === 'image/webp' ? 'webp' : 'jpg';
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          downloadBlob(blob, `fabro_imagen_editada.${ext}`);
          setStatusMsg(`Imagen exportada en ${ext.toUpperCase()} (${canvas.width}x${canvas.height}px, ${Math.round(blob.size / 1024)} KB).`);
        },
        imgOutFormat,
        imgQuality
      );
    };
    img.src = editImgSrc;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (activeTool === 'img2pdf') void handleImagesToPdf(files);
    else if (activeTool === 'pdf2img') void handlePdfToImages(files[0]);
    else if (activeTool === 'merge') void handleMergePdfs(files);
    else if (activeTool === 'split') void handleSplitPdf(files[0]);
    else if (activeTool === 'compress') void handleCompressPdf(files[0]);
    else if (activeTool === 'office2pdf') void handleOfficeToPdf(files[0]);
    else if (activeTool === 'extract') void handleExtractPdfText(files[0]);
    else if (activeTool === 'ocr') void handleRunOcr(files[0]);
    else if (activeTool === 'imagedit') handleLoadImageForEdit(files[0]);
    e.target.value = '';
  };

  const TOOL_TABS: Array<{ id: DocToolId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'img2pdf', label: 'Imágenes -> PDF', icon: FileImage },
    { id: 'pdf2img', label: 'PDF -> Imágenes', icon: ImageIcon },
    { id: 'merge', label: 'Unir PDF', icon: Combine },
    { id: 'split', label: 'Dividir PDF', icon: Scissors },
    { id: 'compress', label: 'Comprimir PDF', icon: Minimize2 },
    { id: 'office2pdf', label: 'DOCX / TXT -> PDF', icon: FileText },
    { id: 'extract', label: 'Extraer texto PDF', icon: FolderCog },
    { id: 'ocr', label: 'OCR Local', icon: ScanText },
    { id: 'imagedit', label: 'Editar / Convertir Imagen', icon: Crop },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              FABRO DOCUMENTS · PROCESAMIENTO 100% LOCAL EN TU NAVEGADOR
            </p>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              Conversor PDF, OCR, Compresor y Editor de Imágenes sin costo de servidor
            </h2>
          </div>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            0 consultas IA consumidas · Privacidad local
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TOOL_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTool(t.id);
                  resetFeedback();
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  active
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Options specific to tool */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-4 space-y-3 text-xs">
          {activeTool === 'split' && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-semibold text-slate-700 dark:text-slate-200">
                Rango de páginas a extraer:
              </label>
              <input
                type="text"
                value={splitRange}
                onChange={(e) => setSplitRange(e.target.value)}
                placeholder="1-3,5"
                className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono"
              />
            </div>
          )}

          {activeTool === 'compress' && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-semibold text-slate-700 dark:text-slate-200">
                Calidad de compresión JPEG ({Math.round(compressQuality * 100)}%):
              </label>
              <input
                type="range"
                min={0.25}
                max={0.9}
                step={0.05}
                value={compressQuality}
                onChange={(e) => setCompressQuality(Number(e.target.value))}
              />
            </div>
          )}

          {activeTool === 'ocr' && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Idioma OCR:</label>
              <select
                value={ocrLang}
                onChange={(e) => setOcrLang(e.target.value as 'spa' | 'eng')}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5"
              >
                <option value="spa">Español (spa)</option>
                <option value="eng">Inglés (eng)</option>
              </select>
              {busy && ocrProgress > 0 && (
                <span className="font-mono text-sky-600 dark:text-sky-400">
                  Reconociendo texto... {ocrProgress}%
                </span>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple={activeTool === 'img2pdf' || activeTool === 'merge'}
            accept={
              activeTool === 'img2pdf' || activeTool === 'imagedit'
                ? 'image/png,image/jpeg,image/webp'
                : activeTool === 'office2pdf'
                  ? '.docx,.txt'
                  : activeTool === 'ocr'
                    ? 'image/*,.pdf'
                    : '.pdf'
            }
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {activeTool === 'img2pdf'
              ? 'Seleccionar imágenes (JPG/PNG) y generar PDF'
              : activeTool === 'merge'
                ? 'Seleccionar 2 o más PDFs para unir'
                : activeTool === 'office2pdf'
                  ? 'Seleccionar archivo DOCX o TXT'
                  : activeTool === 'imagedit'
                    ? 'Cargar imagen para recortar / redimensionar / convertir'
                    : 'Seleccionar archivo'}
          </button>
        </div>

        {statusMsg && (
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}
      </section>

      {/* Image Editor Panel */}
      {activeTool === 'imagedit' && editImgSrc && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Editor local de imagen (Original: {editOrigW} × {editOrigH} px)
            </h3>
            <button
              type="button"
              onClick={handleExportEditedImage}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar imagen procesada
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <label className="space-y-1">
              <span>Ancho (px)</span>
              <input
                type="number"
                min={16}
                max={5000}
                value={targetW}
                onChange={(e) => setTargetW(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 font-mono"
              />
            </label>
            <label className="space-y-1">
              <span>Alto (px)</span>
              <input
                type="number"
                min={16}
                max={5000}
                value={targetH}
                onChange={(e) => setTargetH(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 font-mono"
              />
            </label>
            <label className="space-y-1">
              <span>Recorte X (%)</span>
              <input
                type="number"
                min={0}
                max={90}
                value={cropX}
                onChange={(e) => setCropX(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 font-mono"
              />
            </label>
            <label className="space-y-1">
              <span>Recorte W (%)</span>
              <input
                type="number"
                min={10}
                max={100}
                value={cropW}
                onChange={(e) => setCropW(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 font-mono"
              />
            </label>
            <label className="space-y-1">
              <span>Formato salida</span>
              <select
                value={imgOutFormat}
                onChange={(e) => setImgOutFormat(e.target.value as typeof imgOutFormat)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5"
              >
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
              </select>
            </label>
            <label className="space-y-1">
              <span>Calidad ({Math.round(imgQuality * 100)}%)</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={imgQuality}
                onChange={(e) => setImgQuality(Number(e.target.value))}
                className="w-full mt-2"
              />
            </label>
          </div>
          <img
            src={editImgSrc}
            alt="Vista previa local"
            className="max-h-72 rounded-xl border border-slate-200 dark:border-slate-800 object-contain"
          />
        </section>
      )}

      {/* Rendered PDF Pages Output */}
      {renderedImages.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Páginas convertidas a imagen ({renderedImages.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderedImages.map((img) => (
              <div
                key={img.name}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3 space-y-2"
              >
                <img src={img.dataUrl} alt={img.name} className="w-full h-48 object-contain rounded-lg bg-white" />
                <a
                  href={img.dataUrl}
                  download={img.name}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar {img.name}
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Extracted / OCR Text Output + Full FABRO IA Strip */}
      {extractedText && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Texto obtenido: {extractedTitle}
            </h3>
            <span className="font-mono text-xs text-slate-500">
              {extractedText.length.toLocaleString('es-AR')} caracteres
            </span>
          </div>
          <textarea
            rows={8}
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3 text-xs font-mono text-slate-900 dark:text-slate-100"
          />
          <FabroAIActionStrip
            title={extractedTitle}
            content={extractedText}
            onSavedNote={async (msg) => {
              await createNote({
                subjectId: selectedSubjectId || '',
                unit: '',
                folder: 'FABRO Documents',
                title: extractedTitle.slice(0, 180),
                contentHtml: markdownToHtml(extractedText),
                contentText: extractedText,
                tags: ['documents', activeTool],
                attachments: [],
                offlineAvailable: true,
              });
              setStatusMsg(msg);
            }}
          />
        </section>
      )}
    </div>
  );
};
