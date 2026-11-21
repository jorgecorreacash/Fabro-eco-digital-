import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useStudy2 } from '../../../context/Study2Context';
import {
  extractTextFromPdfBuffer,
  loadStudyFileBlob,
  triggerBlobDownload,
} from '../../../services/study2FileExtractor';
import {
  computeLineDiff,
  generateAcademicCitation,
} from '../../../services/study2ToolsUtils';

export type GroupBToolId =
  | 'bibliografia'
  | 'lector-pdf'
  | 'pdf-texto'
  | 'imagenes-pdf'
  | 'comparador'
  | 'pomodoro'
  | 'tareas'
  | 'cronologia'
  | 'cuadros';

export const Study2ToolsGroupB: React.FC<{ toolId: GroupBToolId }> = ({ toolId }) => {
  const {
    pomoSecondsLeft,
    pomoRunning,
    pomoPhase,
    pomoSubject,
    setPomodoroSubject,
    togglePomodoro,
    resetPomodoro,
    completePomodoroManual,
    selectPomodoroPreset,
    pomoPresetId,
  } = useEcosystem();
  const {
    ownerUid,
    snapshot,
    addBibliographyItem,
    deleteBibliographyItem,
    createTask,
    toggleTask,
    deleteTask,
    addTimelineEntry,
    deleteTimelineEntry,
    saveComparativeTable,
    deleteComparativeTable,
  } = useStudy2();

  // 10. Bibliography form
  const [bTitle, setBTitle] = useState('');
  const [bAuthor, setBAuthor] = useState('');
  const [bYear, setBYear] = useState('');
  const [bUrl, setBUrl] = useState('');
  const [bSubject, setBSubject] = useState('');

  // 11. PDF Reader
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>('');

  // 12. PDF to Text
  const [pdfTextOut, setPdfTextOut] = useState('');
  const [pdfTextNote, setPdfTextNote] = useState('');
  const [pdfTextBusy, setPdfTextBusy] = useState(false);

  // 13. Images to PDF
  const [imgFiles, setImgFiles] = useState<Array<{ id: string; name: string; dataUrl: string }>>([]);
  const [imgPdfBusy, setImgPdfBusy] = useState(false);

  // 14. Document Comparator
  const [docA, setDocA] = useState('');
  const [docB, setDocB] = useState('');

  // 16. Tasks Organizer
  const [tkTitle, setTkTitle] = useState('');
  const [tkDue, setTkDue] = useState('');
  const [tkPriority, setTkPriority] = useState<'alta' | 'media' | 'baja'>('media');
  const [tkSubject, setTkSubject] = useState('');

  // 17. Timeline
  const [tlDate, setTlDate] = useState('');
  const [tlTitle, setTlTitle] = useState('');
  const [tlDetail, setTlDetail] = useState('');

  // 18. Comparative Table
  const [tblTitle, setTblTitle] = useState('Cuadro comparativo');
  const [tblCols, setTblCols] = useState<string[]>(['Criterio', 'Concepto A', 'Concepto B']);
  const [tblRows, setTblRows] = useState<string[][]>([
    ['Definición', '', ''],
    ['Ventajas', '', ''],
    ['Ejemplo', '', ''],
  ]);

  const pdfBlobRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current);
    };
  }, []);

  const diffResult = useMemo(() => computeLineDiff(docA, docB), [docA, docB]);

  // 10. ORGANIZADOR DE BIBLIOGRAFÍA
  if (toolId === 'bibliografia') {
    return (
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!bTitle.trim()) return;
            addBibliographyItem({
              title: bTitle.trim(),
              author: bAuthor.trim() || 'Autor no especificado',
              year: bYear.trim() || 's. f.',
              url: bUrl.trim() || undefined,
              subjectId: bSubject || undefined,
              kind: 'libro',
            });
            setBTitle('');
            setBAuthor('');
            setBYear('');
            setBUrl('');
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2"
        >
          <input
            type="text"
            value={bTitle}
            onChange={(e) => setBTitle(e.target.value)}
            placeholder="Título de la fuente *"
            className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <input
            type="text"
            value={bAuthor}
            onChange={(e) => setBAuthor(e.target.value)}
            placeholder="Autor/es"
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <input
            type="text"
            value={bYear}
            onChange={(e) => setBYear(e.target.value)}
            placeholder="Año"
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <input
            type="url"
            value={bUrl}
            onChange={(e) => setBUrl(e.target.value)}
            placeholder="URL o DOI (opcional)"
            className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <select
            value={bSubject}
            onChange={(e) => setBSubject(e.target.value)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
          >
            <option value="">Todas las materias</option>
            {snapshot.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-[38px] rounded-xl bg-blue-600 text-white px-3 text-xs font-bold cursor-pointer"
          >
            + Agregar
          </button>
        </form>

        {snapshot.bibliography.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aún no guardaste referencias bibliográficas.
          </p>
        ) : (
          <div className="space-y-2">
            {snapshot.bibliography.map((item) => {
              const apa = generateAcademicCitation('apa7', {
                authors: item.author,
                year: item.year,
                title: item.title,
                publisherOrJournal: item.publisher,
                urlOrDoi: item.url || item.doi,
                kind: item.kind === 'articulo' ? 'articulo' : item.kind === 'web' ? 'web' : 'libro',
              });
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start justify-between gap-2 text-xs"
                >
                  <p className="leading-relaxed">{apa}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(apa)}
                      aria-label="Copiar referencia"
                      className="p-1.5 text-slate-500 hover:text-blue-600 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBibliographyItem(item.id)}
                      aria-label="Eliminar referencia"
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 11. LECTOR DE PDF
  if (toolId === 'lector-pdf') {
    const libraryPdfs = snapshot.libraryFiles.filter(
      (f) => f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    const openLocalPdf = (file: File) => {
      if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current);
      const url = URL.createObjectURL(file);
      pdfBlobRef.current = url;
      setPdfUrl(url);
      setPdfName(file.name);
    };

    const openFromLibrary = async (fileId: string) => {
      const loaded = await loadStudyFileBlob(ownerUid, fileId);
      if (!loaded) return;
      if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current);
      const url = URL.createObjectURL(loaded.blob);
      pdfBlobRef.current = url;
      setPdfUrl(url);
      setPdfName(loaded.name);
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-4 text-xs font-bold cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Abrir PDF del dispositivo
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) openLocalPdf(file);
                e.target.value = '';
              }}
            />
          </label>

          {libraryPdfs.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) void openFromLibrary(e.target.value);
              }}
              className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
            >
              <option value="">Abrir PDF de mi Biblioteca ({libraryPdfs.length})</option>
              {libraryPdfs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {pdfUrl ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{pdfName}</p>
            <iframe
              src={pdfUrl}
              title={pdfName}
              className="w-full h-[540px] rounded-xl border border-slate-200 dark:border-slate-800"
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-8 text-center">
            Seleccioná un archivo PDF de tu dispositivo o de tu Biblioteca para leerlo aquí.
          </p>
        )}
      </div>
    );
  }

  // 12. CONVERSOR PDF A TEXTO
  if (toolId === 'pdf-texto') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-4 text-xs font-bold cursor-pointer">
            {pdfTextBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Seleccionar PDF para extraer texto
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={pdfTextBusy}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPdfTextBusy(true);
                setPdfTextNote('');
                try {
                  const buf = await file.arrayBuffer();
                  const res = await extractTextFromPdfBuffer(buf);
                  setPdfTextOut(res.text);
                  setPdfTextNote(res.note || '');
                } finally {
                  setPdfTextBusy(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
          {pdfTextOut && (
            <>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(pdfTextOut)}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar texto
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerBlobDownload(
                    new Blob([pdfTextOut], { type: 'text/plain;charset=utf-8' }),
                    'pdf-extraido.txt'
                  )
                }
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar .txt
              </button>
            </>
          )}
        </div>
        {pdfTextNote && <p className="text-xs text-slate-500">{pdfTextNote}</p>}
        <textarea
          rows={10}
          readOnly
          value={pdfTextOut}
          placeholder="El texto real extraído del PDF aparecerá aquí..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs leading-relaxed"
        />
      </div>
    );
  }

  // 13. CONVERSOR IMÁGENES A PDF
  if (toolId === 'imagenes-pdf') {
    const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setImgFiles((prev) => [
              ...prev,
              { id: `im-${Date.now()}-${Math.random()}`, name: f.name, dataUrl: reader.result as string },
            ]);
          }
        };
        reader.readAsDataURL(f);
      });
      e.target.value = '';
    };

    const handleBuildPdf = async () => {
      if (imgFiles.length === 0) return;
      setImgPdfBusy(true);
      try {
        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const margin = 36;

        for (let i = 0; i < imgFiles.length; i += 1) {
          if (i > 0) pdf.addPage();
          const img = new Image();
          img.src = imgFiles[i].dataUrl;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
          const nw = img.naturalWidth || 800;
          const nh = img.naturalHeight || 600;
          const scale = Math.min((pw - margin * 2) / nw, (ph - margin * 2) / nh);
          const dw = nw * scale;
          const dh = nh * scale;
          const dx = (pw - dw) / 2;
          const dy = (ph - dh) / 2;
          const fmt = imgFiles[i].dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(imgFiles[i].dataUrl, fmt, dx, dy, dw, dh);
        }
        const blob = pdf.output('blob');
        triggerBlobDownload(blob, 'imagenes-fabro.pdf');
      } finally {
        setImgPdfBusy(false);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            Agregar imágenes
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddImages}
            />
          </label>
          <button
            type="button"
            disabled={imgFiles.length === 0 || imgPdfBusy}
            onClick={handleBuildPdf}
            className="min-h-[38px] rounded-xl bg-blue-600 disabled:opacity-40 text-white px-4 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {imgPdfBusy ? 'Generando PDF...' : `Generar PDF (${imgFiles.length} págs.)`}
          </button>
        </div>

        {imgFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {imgFiles.map((im, idx) => (
              <div
                key={im.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 space-y-1.5"
              >
                <img
                  src={im.dataUrl}
                  alt={im.name}
                  className="w-full h-28 object-cover rounded-lg"
                />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="truncate font-medium">Pág. {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setImgFiles((prev) => prev.filter((x) => x.id !== im.id))
                    }
                    className="text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 14. COMPARADOR DE DOCUMENTOS (REAL LCS DIFF)
  if (toolId === 'comparador') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">Documento A (Original)</span>
              {snapshot.libraryFiles.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const f = snapshot.libraryFiles.find((x) => x.id === e.target.value);
                    if (f) setDocA(f.extractedText);
                  }}
                  className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-0.5 bg-white dark:bg-slate-950"
                >
                  <option value="">Cargar de Biblioteca</option>
                  {snapshot.libraryFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <textarea
              rows={6}
              value={docA}
              onChange={(e) => setDocA(e.target.value)}
              placeholder="Pegá el texto original..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">Documento B (Comparado)</span>
              {snapshot.libraryFiles.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const f = snapshot.libraryFiles.find((x) => x.id === e.target.value);
                    if (f) setDocB(f.extractedText);
                  }}
                  className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-0.5 bg-white dark:bg-slate-950"
                >
                  <option value="">Cargar de Biblioteca</option>
                  {snapshot.libraryFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <textarea
              rows={6}
              value={docB}
              onChange={(e) => setDocB(e.target.value)}
              placeholder="Pegá la segunda versión o texto..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs font-mono"
            />
          </div>
        </div>

        {(docA || docB) && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
              <span>Similitud: <strong>{diffResult.similarityPercent}%</strong></span>
              <span className="text-emerald-600">+{diffResult.addedCount} agregadas</span>
              <span className="text-rose-600">-{diffResult.removedCount} quitadas</span>
              <span className="text-slate-500">{diffResult.unchangedCount} iguales</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto font-mono text-xs space-y-0.5">
              {diffResult.lines.map((ln, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-0.5 rounded-sm whitespace-pre-wrap ${
                    ln.type === 'added'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                      : ln.type === 'removed'
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 line-through'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {ln.type === 'added' ? '+ ' : ln.type === 'removed' ? '- ' : '  '}
                  {ln.text || ' '}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 15. TEMPORIZADOR POMODORO (CONECTADO A MI PROGRESO)
  if (toolId === 'pomodoro') {
    const mm = String(Math.floor(pomoSecondsLeft / 60)).padStart(2, '0');
    const ss = String(pomoSecondsLeft % 60).padStart(2, '0');
    return (
      <div className="max-w-md mx-auto text-center space-y-5 py-3">
        <div className="flex justify-center gap-2">
          {(
            [
              { id: '15-3', label: '15 / 3 min' },
              { id: '25-5', label: '25 / 5 min' },
              { id: '50-10', label: '50 / 10 min' },
            ] as const
          ).map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => selectPomodoroPreset(pr.id)}
              className={`min-h-[34px] px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                pomoPresetId === pr.id
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {pr.label}
            </button>
          ))}
        </div>

        <select
          value={pomoSubject}
          onChange={(e) => setPomodoroSubject(e.target.value)}
          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
        >
          <option value="Sesión de estudio">Sesión de estudio general</option>
          {snapshot.subjects.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-8 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            {pomoPhase === 'focus' ? 'Bloque de enfoque' : 'Descanso'}
          </p>
          <p className="font-mono text-6xl font-extrabold tabular-nums">
            {mm}:{ss}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={togglePomodoro}
            className="min-h-[42px] px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            {pomoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {pomoRunning ? 'Pausar' : 'Iniciar'}
          </button>
          <button
            type="button"
            onClick={resetPomodoro}
            className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar
          </button>
          <button
            type="button"
            onClick={() => completePomodoroManual(pomoSubject)}
            className="min-h-[42px] px-3.5 rounded-xl border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs font-semibold cursor-pointer"
          >
            Registrar sesión
          </button>
        </div>
      </div>
    );
  }

  // 16. ORGANIZADOR DE TAREAS
  if (toolId === 'tareas') {
    return (
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!tkTitle.trim()) return;
            createTask({
              title: tkTitle.trim(),
              dueDate: tkDue || undefined,
              priority: tkPriority,
              subjectId: tkSubject || undefined,
            });
            setTkTitle('');
            setTkDue('');
          }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2"
        >
          <input
            type="text"
            value={tkTitle}
            onChange={(e) => setTkTitle(e.target.value)}
            placeholder="Nueva tarea académica..."
            className="sm:col-span-5 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <select
            value={tkSubject}
            onChange={(e) => setTkSubject(e.target.value)}
            className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"
          >
            <option value="">Sin materia</option>
            {snapshot.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={tkDue}
            onChange={(e) => setTkDue(e.target.value)}
            className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs font-mono"
          />
          <button
            type="submit"
            className="sm:col-span-2 min-h-[38px] rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
          >
            Agregar
          </button>
        </form>

        <div className="space-y-2">
          {snapshot.tasks.length === 0 ? (
            <p className="text-xs text-slate-500">Sin tareas registradas.</p>
          ) : (
            snapshot.tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                >
                  {t.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span
                    className={`text-xs ${
                      t.completed ? 'line-through text-slate-400' : 'font-semibold'
                    }`}
                  >
                    {t.title}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {t.dueDate && (
                    <span className="text-[11px] font-mono text-slate-500">{t.dueDate}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteTask(t.id)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 17. CRONOLOGÍA HISTÓRICA
  if (toolId === 'cronologia') {
    const sorted = [...snapshot.timelineEntries].sort((a, b) =>
      a.dateLabel.localeCompare(b.dateLabel, 'es', { numeric: true })
    );
    return (
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!tlDate.trim() || !tlTitle.trim()) return;
            addTimelineEntry({
              dateLabel: tlDate.trim(),
              title: tlTitle.trim(),
              detail: tlDetail.trim(),
            });
            setTlDate('');
            setTlTitle('');
            setTlDetail('');
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2"
        >
          <input
            type="text"
            value={tlDate}
            onChange={(e) => setTlDate(e.target.value)}
            placeholder="Año o fecha (ej. 1810)"
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-mono"
          />
          <input
            type="text"
            value={tlTitle}
            onChange={(e) => setTlTitle(e.target.value)}
            placeholder="Acontecimiento o hito *"
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <input
            type="text"
            value={tlDetail}
            onChange={(e) => setTlDetail(e.target.value)}
            placeholder="Breve explicación"
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
          />
          <button
            type="submit"
            className="min-h-[38px] rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
          >
            + Agregar hito
          </button>
        </form>

        {sorted.length === 0 ? (
          <p className="text-xs text-slate-500">
            Agregá fechas e hitos para construir una línea de tiempo ordenada automáticamente.
          </p>
        ) : (
          <div className="space-y-2.5 pl-4 border-l-2 border-slate-200 dark:border-slate-800">
            {sorted.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start justify-between gap-2"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600">
                    {item.dateLabel}
                  </span>
                  <h4 className="text-sm font-bold">{item.title}</h4>
                  {item.detail && (
                    <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteTimelineEntry(item.id)}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 18. GENERADOR DE CUADROS COMPARATIVOS
  const exportTableMarkdown = () => {
    const header = `| ${tblCols.join(' | ')} |`;
    const sep = `| ${tblCols.map(() => '---').join(' | ')} |`;
    const body = tblRows.map((r) => `| ${r.join(' | ')} |`).join('\n');
    void navigator.clipboard?.writeText(`${header}\n${sep}\n${body}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={tblTitle}
          onChange={(e) => setTblTitle(e.target.value)}
          className="flex-1 min-w-[180px] min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold"
        />
        <button
          type="button"
          onClick={() => {
            setTblCols((c) => [...c, `Columna ${c.length}`]);
            setTblRows((rows) => rows.map((r) => [...r, '']));
          }}
          className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
        >
          + Columna
        </button>
        <button
          type="button"
          onClick={() =>
            setTblRows((rows) => [...rows, tblCols.map(() => '')])
          }
          className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
        >
          + Fila
        </button>
        <button
          type="button"
          onClick={() =>
            saveComparativeTable({
              id: `tbl-${Date.now()}`,
              title: tblTitle.trim() || 'Cuadro comparativo',
              columns: tblCols,
              rows: tblRows,
              updatedAt: new Date().toISOString(),
            })
          }
          className="min-h-[36px] px-3.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
        >
          Guardar cuadro
        </button>
        <button
          type="button"
          onClick={exportTableMarkdown}
          className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          Markdown
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950">
              {tblCols.map((col, cIdx) => (
                <th key={cIdx} className="border-b border-r border-slate-200 dark:border-slate-800 p-1.5">
                  <input
                    type="text"
                    value={col}
                    onChange={(e) =>
                      setTblCols((prev) =>
                        prev.map((x, idx) => (idx === cIdx ? e.target.value : x))
                      )
                    }
                    className="w-full bg-transparent font-bold px-1.5 py-1 focus:outline-none"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tblRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="border-b border-r border-slate-200 dark:border-slate-800 p-1">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) =>
                        setTblRows((prev) =>
                          prev.map((r, ri) =>
                            ri === rIdx
                              ? r.map((v, ci) => (ci === cIdx ? e.target.value : v))
                              : r
                          )
                        )
                      }
                      className="w-full bg-transparent px-2 py-1.5 focus:outline-none"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {snapshot.comparativeTables.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {snapshot.comparativeTables.map((t) => (
            <div
              key={t.id}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs"
            >
              <button
                type="button"
                onClick={() => {
                  setTblTitle(t.title);
                  setTblCols(t.columns);
                  setTblRows(t.rows);
                }}
                className="font-semibold hover:underline cursor-pointer"
              >
                {t.title}
              </button>
              <button
                type="button"
                onClick={() => deleteComparativeTable(t.id)}
                className="text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
