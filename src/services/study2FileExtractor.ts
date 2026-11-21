import { openDB, type IDBPDatabase } from 'idb';

const BLOB_DB_NAME = 'fabro-study2-blobs-v1';
const BLOB_STORE = 'files';

interface StoredStudyBlobRecord {
  key: string; // `${uid}::${fileId}`
  uid: string;
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  data: ArrayBuffer;
  savedAt: string;
}

let blobDbPromise: Promise<IDBPDatabase> | null = null;

function getBlobDb(): Promise<IDBPDatabase> {
  if (!blobDbPromise) {
    blobDbPromise = openDB(BLOB_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(BLOB_STORE)) {
          const store = db.createObjectStore(BLOB_STORE, { keyPath: 'key' });
          store.createIndex('by_uid', 'uid');
        }
      },
    });
  }
  return blobDbPromise;
}

function makeBlobKey(uid: string, fileId: string): string {
  return `${uid || 'guest'}::${fileId}`;
}

export async function saveStudyFileBlob(
  uid: string,
  fileId: string,
  file: File | Blob,
  meta: { name: string; mimeType: string }
): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  try {
    const db = await getBlobDb();
    const buffer = await file.arrayBuffer();
    const record: StoredStudyBlobRecord = {
      key: makeBlobKey(uid, fileId),
      uid: uid || 'guest',
      fileId,
      name: meta.name,
      mimeType: meta.mimeType || file.type || 'application/octet-stream',
      sizeBytes: buffer.byteLength,
      data: buffer,
      savedAt: new Date().toISOString(),
    };
    await db.put(BLOB_STORE, record);
    return true;
  } catch (err) {
    console.warn('[Study2BlobVault] No se pudo guardar el archivo binario en IndexedDB:', err);
    return false;
  }
}

export async function loadStudyFileBlob(
  uid: string,
  fileId: string
): Promise<{ blob: Blob; name: string; mimeType: string } | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await getBlobDb();
    const rec = (await db.get(BLOB_STORE, makeBlobKey(uid, fileId))) as
      | StoredStudyBlobRecord
      | undefined;
    if (!rec || !rec.data) return null;
    return {
      blob: new Blob([rec.data], { type: rec.mimeType || 'application/octet-stream' }),
      name: rec.name,
      mimeType: rec.mimeType,
    };
  } catch {
    return null;
  }
}

export async function deleteStudyFileBlob(uid: string, fileId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await getBlobDb();
    await db.delete(BLOB_STORE, makeBlobKey(uid, fileId));
  } catch {
    // non-fatal
  }
}

export interface FileExtractionResult {
  text: string;
  pageCount?: number;
  status: 'ok' | 'parcial' | 'sin_texto' | 'error';
  note?: string;
}

export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<FileExtractionResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Configure worker using Vite-compatible URL fallback so it runs cleanly offline & in production
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
    }
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const maxPagesToRead = Math.min(totalPages, 120);
    const pagesText: string[] = [];

    for (let p = 1; p <= maxPagesToRead; p += 1) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageStr = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageStr) {
        pagesText.push(`--- Página ${p} ---\n${pageStr}`);
      }
    }

    const joined = pagesText.join('\n\n').trim();
    if (!joined) {
      return {
        text: '',
        pageCount: totalPages,
        status: 'sin_texto',
        note: `PDF de ${totalPages} páginas sin capa de texto seleccionable (puede ser un documento escaneado).`,
      };
    }

    return {
      text: joined,
      pageCount: totalPages,
      status: totalPages > maxPagesToRead ? 'parcial' : 'ok',
      note:
        totalPages > maxPagesToRead
          ? `Se extrajeron ${maxPagesToRead} de ${totalPages} páginas para mantener fluidez en el navegador.`
          : `Texto extraído de ${totalPages} ${totalPages === 1 ? 'página' : 'páginas'}.`,
    };
  } catch (err) {
    return {
      text: '',
      status: 'error',
      note: `No se pudo leer el PDF: ${err instanceof Error ? err.message : 'formato protegido o dañado'}.`,
    };
  }
}

export async function extractTextFromStudyFile(
  file: File,
  options?: { runImageOcr?: boolean }
): Promise<FileExtractionResult> {
  const lowerName = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  try {
    // 1. PDF
    if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
      const buffer = await file.arrayBuffer();
      return await extractTextFromPdfBuffer(buffer);
    }

    // 2. Word .docx via mammoth
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.docx')
    ) {
      const mammoth = await import('mammoth');
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      const text = (result.value || '').trim();
      return {
        text,
        status: text ? 'ok' : 'sin_texto',
        note: text
          ? `Documento Word procesado (${text.length.toLocaleString('es-AR')} caracteres).`
          : 'El documento Word no contiene texto legible.',
      };
    }

    // 3. Plain text, Markdown, CSV, JSON, HTML, RTF
    if (
      mime.startsWith('text/') ||
      /\.(txt|md|markdown|csv|json|xml|html|htm|rtf)$/i.test(lowerName)
    ) {
      const text = (await file.text()).trim();
      return {
        text,
        status: text ? 'ok' : 'sin_texto',
        note: text ? 'Texto plano leído correctamente.' : 'Archivo de texto vacío.',
      };
    }

    // 4. Images (optional real OCR with tesseract.js)
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(lowerName)) {
      if (options?.runImageOcr) {
        const Tesseract = await import('tesseract.js');
        const ocr = await Tesseract.recognize(file, 'spa+eng');
        const text = (ocr.data?.text || '').trim();
        return {
          text,
          status: text ? 'ok' : 'sin_texto',
          note: text
            ? 'Texto reconocido mediante OCR local (Tesseract).'
            : 'No se detectó texto legible en la imagen.',
        };
      }
      return {
        text: '',
        status: 'sin_texto',
        note: 'Imagen guardada íntegramente. Podés ejecutar OCR para extraer su texto cuando lo necesites.',
      };
    }

    return {
      text: '',
      status: 'sin_texto',
      note: 'Archivo guardado en la biblioteca. Este formato binario no tiene extracción automática de texto.',
    };
  } catch (err) {
    return {
      text: '',
      status: 'error',
      note: `Error al procesar el archivo: ${err instanceof Error ? err.message : 'desconocido'}.`,
    };
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
