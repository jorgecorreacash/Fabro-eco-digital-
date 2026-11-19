import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  BookOpen,
  CheckCircle2,
  Download,
  Feather,
  FileText,
  ListTree,
  Plus,
  SpellCheck,
  Trash2,
} from 'lucide-react';
import type { CultureBookManuscript, CultureReadingLogItem } from '../../../types/culture';

interface LiteratureStudioProps {
  manuscripts: CultureBookManuscript[];
  readingList: CultureReadingLogItem[];
  onSaveManuscript: (book: CultureBookManuscript) => void;
  onDeleteManuscript: (id: string) => void;
  onSaveReading: (item: CultureReadingLogItem) => void;
  onDeleteReading: (id: string) => void;
}

type LitTab = 'novela' | 'poesia' | 'corrector' | 'indice-pdf' | 'biblioteca';

const COMMON_SPANISH_FIXES: Record<string, string> = {
  tambien: 'también',
  mas: 'más',
  asi: 'así',
  despues: 'después',
  atras: 'atrás',
  pagina: 'página',
  musica: 'música',
  poesia: 'poesía',
  historia: 'historia',
  codigo: 'código',
  publico: 'público',
  ultimo: 'último',
  unico: 'único',
  dificil: 'difícil',
  facil: 'fácil',
  arbol: 'árbol',
  corazon: 'corazón',
  cancion: 'canción',
  accion: 'acción',
  habia: 'había',
  tenia: 'tenía',
  podia: 'podía',
  sabia: 'sabía',
  dia: 'día',
  dias: 'días',
  todavia: 'todavía',
  quiza: 'quizá',
  quizas: 'quizás',
  estaba: 'estaba',
  aver: 'a ver',
  haver: 'haber',
  echo: 'hecho',
};

function countSpanishSyllables(line: string): number {
  const cleaned = line
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/g, ' ')
    .trim();
  if (!cleaned) return 0;
  const groups = cleaned.match(/[aeiouáéíóúü]+/g);
  return groups ? groups.length : 0;
}

function getLineRhymeEnding(line: string): string {
  const words = line
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const last = words[words.length - 1] || '';
  return last.slice(-3);
}

export const LiteratureStudio: React.FC<LiteratureStudioProps> = ({
  manuscripts,
  readingList,
  onSaveManuscript,
  onDeleteManuscript,
  onSaveReading,
  onDeleteReading,
}) => {
  const [activeTab, setActiveTab] = useState<LitTab>('novela');
  const [selectedBookId, setSelectedBookId] = useState<string>(manuscripts[0]?.id || '');
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    manuscripts[0]?.chapters[0]?.id || ''
  );
  const [notice, setNotice] = useState<string | null>(null);

  const currentBook =
    manuscripts.find((b) => b.id === selectedBookId) || manuscripts[0] || null;
  const currentChapter =
    currentBook?.chapters.find((c) => c.id === selectedChapterId) ||
    currentBook?.chapters[0] ||
    null;

  // Poetry state
  const [poemTitle, setPoemTitle] = useState('Nocturno de papel');
  const [poemText, setPoemText] = useState(
    'Sobre la mesa duerme la memoria,\nen cada tinta tiembla una mañana,\ny el viento lento escribe su historia\ndetrás de la quietud de la ventana.'
  );

  // Reading list form
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookStatus, setBookStatus] = useState<CultureReadingLogItem['status']>('Leyendo');
  const [bookNotes, setBookNotes] = useState('');

  const fullText = currentChapter?.content || '';

  const textStats = useMemo(() => {
    const words = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
    const chars = fullText.length;
    const paragraphs = fullText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean).length;
    const readingMin = Math.max(1, Math.ceil(words / 200));
    return { words, chars, paragraphs, readingMin };
  }, [fullText]);

  const localSpellIssues = useMemo(() => {
    const issues: Array<{ original: string; suggestion: string; reason: string }> = [];
    if (!fullText.trim()) return issues;

    if (/\s{2,}/.test(fullText)) {
      issues.push({
        original: '  ',
        suggestion: ' ',
        reason: 'Espacios dobles detectados en el texto.',
      });
    }

    const repeatMatch = fullText.match(/\b([a-záéíóúñ]{2,})\s+\1\b/gi);
    if (repeatMatch) {
      repeatMatch.slice(0, 5).forEach((dup) => {
        const single = dup.split(/\s+/)[0];
        issues.push({
          original: dup,
          suggestion: single,
          reason: `Palabra repetida consecutivamente: "${dup}".`,
        });
      });
    }

    const tokens = fullText.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]+/g) || [];
    const seen = new Set<string>();
    tokens.forEach((tok) => {
      const lower = tok.toLowerCase();
      if (lower in COMMON_SPANISH_FIXES && COMMON_SPANISH_FIXES[lower] !== lower && !seen.has(lower)) {
        seen.add(lower);
        issues.push({
          original: tok,
          suggestion: COMMON_SPANISH_FIXES[lower],
          reason: `Posible acentuación o grafía: "${tok}" → "${COMMON_SPANISH_FIXES[lower]}".`,
        });
      }
    });
    return issues;
  }, [fullText]);

  const updateChapterContent = (nextContent: string) => {
    if (!currentBook || !currentChapter) return;
    onSaveManuscript({
      ...currentBook,
      updatedAt: 'Hoy',
      chapters: currentBook.chapters.map((c) =>
        c.id === currentChapter.id ? { ...c, content: nextContent } : c
      ),
    });
  };

  const handleExportPdf = () => {
    if (!currentBook) return;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 52;
    const maxWidth = 490;
    let y = 72;

    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    pdf.text(currentBook.title, margin, y);
    y += 24;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Género: ${currentBook.genre} · Exportado desde FABRO Cultura`, margin, y);
    y += 28;

    // Index
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.text('Índice', margin, y);
    y += 18;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    currentBook.chapters.forEach((ch, idx) => {
      pdf.text(`${idx + 1}. ${ch.title}`, margin + 10, y);
      y += 16;
    });

    currentBook.chapters.forEach((ch) => {
      pdf.addPage();
      y = 68;
      pdf.setFont('times', 'bold');
      pdf.setFontSize(16);
      pdf.text(ch.title, margin, y);
      y += 26;
      pdf.setFont('times', 'normal');
      pdf.setFontSize(12);
      const wrapped = pdf.splitTextToSize(ch.content || '(Capítulo vacío)', maxWidth) as string[];
      wrapped.forEach((line) => {
        if (y > 760) {
          pdf.addPage();
          y = 64;
        }
        pdf.text(line, margin, y);
        y += 18;
      });
    });

    pdf.save(`${currentBook.title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    setNotice('Manuscrito con índice exportado a PDF en tu dispositivo.');
  };

  const poetryLines = useMemo(() => {
    return poemText.split('\n').map((line, i) => ({
      index: i + 1,
      text: line,
      syllables: countSpanishSyllables(line),
      ending: getLineRhymeEnding(line),
    }));
  }, [poemText]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border fabro-border fabro-surface">
        {(
          [
            { id: 'novela', label: 'Editor y novelas', icon: FileText },
            { id: 'poesia', label: 'Taller de poesía', icon: Feather },
            { id: 'corrector', label: 'Corrector local', icon: SpellCheck },
            { id: 'indice-pdf', label: 'Índices y PDF', icon: ListTree },
            { id: 'biblioteca', label: 'Biblioteca y libros', icon: BookOpen },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setNotice(null);
              }}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#78350F] text-white'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {/* 1. TEXT & NOVEL WRITER */}
      {activeTab === 'novela' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 rounded-2xl border fabro-border fabro-surface p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Tus obras y manuscritos</h3>
              <button
                type="button"
                onClick={() => {
                  const fresh: CultureBookManuscript = {
                    id: `ms-${Date.now()}`,
                    title: `Nueva obra ${manuscripts.length + 1}`,
                    genre: 'Novela',
                    synopsis: '',
                    chapters: [{ id: `ch-${Date.now()}`, title: 'Capítulo 1', content: '' }],
                    updatedAt: 'Hoy',
                  };
                  onSaveManuscript(fresh);
                  setSelectedBookId(fresh.id);
                  setSelectedChapterId(fresh.chapters[0].id);
                }}
                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-[#78350F] text-white px-2.5 text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva obra</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {manuscripts.map((book) => (
                <div
                  key={book.id}
                  className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                    currentBook?.id === book.id
                      ? 'border-[#78350F] bg-[#78350F]/10 font-semibold'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setSelectedChapterId(book.chapters[0]?.id || '');
                    }}
                    className="text-left flex-1 truncate cursor-pointer"
                  >
                    {book.title}
                  </button>
                  {manuscripts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteManuscript(book.id)}
                      className="fabro-muted hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {currentBook && (
              <div className="pt-3 border-t fabro-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold fabro-muted">Capítulos</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newCh = {
                        id: `ch-${Date.now()}`,
                        title: `Capítulo ${currentBook.chapters.length + 1}`,
                        content: '',
                      };
                      onSaveManuscript({
                        ...currentBook,
                        chapters: [...currentBook.chapters, newCh],
                      });
                      setSelectedChapterId(newCh.id);
                    }}
                    className="text-xs font-semibold text-[#78350F] dark:text-[#FDBA74] hover:underline cursor-pointer"
                  >
                    + Agregar capítulo
                  </button>
                </div>
                <div className="space-y-1">
                  {currentBook.chapters.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChapterId(ch.id)}
                      className={`w-full text-left rounded-lg px-2.5 py-2 text-xs cursor-pointer truncate ${
                        currentChapter?.id === ch.id
                          ? 'bg-[#78350F]/15 font-semibold'
                          : 'fabro-muted hover:bg-[var(--fabro-surface-2)]'
                      }`}
                    >
                      {ch.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-3">
            {currentBook && currentChapter && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={currentBook.title}
                    onChange={(e) =>
                      onSaveManuscript({ ...currentBook, title: e.target.value, updatedAt: 'Hoy' })
                    }
                    placeholder="Título del libro"
                    className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-sm font-bold fabro-input"
                  />
                  <input
                    type="text"
                    value={currentChapter.title}
                    onChange={(e) =>
                      onSaveManuscript({
                        ...currentBook,
                        chapters: currentBook.chapters.map((c) =>
                          c.id === currentChapter.id ? { ...c, title: e.target.value } : c
                        ),
                      })
                    }
                    placeholder="Título del capítulo"
                    className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold fabro-input"
                  />
                </div>

                <textarea
                  value={currentChapter.content}
                  onChange={(e) => updateChapterContent(e.target.value)}
                  rows={14}
                  placeholder="Comenzá a escribir tu relato, ensayo o capítulo..."
                  className="w-full rounded-xl border fabro-border fabro-surface-elevated p-4 text-sm font-serif leading-relaxed fabro-input resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border text-xs fabro-muted tabular-nums">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>{textStats.words} palabras</span>
                    <span>·</span>
                    <span>{textStats.chars} caracteres</span>
                    <span>·</span>
                    <span>{textStats.paragraphs} párrafos</span>
                    <span>·</span>
                    <span>~{textStats.readingMin} min lectura</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#78350F] text-white px-3.5 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar PDF</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. POETRY WORKSHOP */}
      {activeTab === 'poesia' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-3">
            <input
              type="text"
              value={poemTitle}
              onChange={(e) => setPoemTitle(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-sm font-bold fabro-input"
            />
            <textarea
              value={poemText}
              onChange={(e) => setPoemText(e.target.value)}
              rows={10}
              className="w-full rounded-xl border fabro-border fabro-surface-elevated p-4 text-sm font-serif leading-loose fabro-input"
            />
          </div>
          <div className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-bold">Métrica y terminación de rima</h3>
            <p className="text-xs fabro-muted">
              Conteo silábico aproximado y terminación fonética por verso (100% local).
            </p>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {poetryLines
                .filter((l) => l.text.trim())
                .map((l) => (
                  <div
                    key={l.index}
                    className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs flex items-center justify-between gap-2"
                  >
                    <span className="truncate flex-1 font-serif">
                      {l.index}. {l.text}
                    </span>
                    <span className="font-mono tabular-nums shrink-0 fabro-muted">
                      {l.syllables} síl · -{l.ending}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. LOCAL SPELLCHECKER */}
      {activeTab === 'corrector' && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold">Corrector Ortográfico y de Estilo Local (Sin API paga)</h3>
            <p className="text-xs fabro-muted">
              Analiza el capítulo activo buscando tildes omitidas frecuentes, palabras duplicadas y espacios dobles.
            </p>
          </div>
          {localSpellIssues.length === 0 ? (
            <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 p-4 flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>No se encontraron observaciones en el capítulo activo.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {localSpellIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <span>{issue.reason}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = fullText.replace(issue.original, issue.suggestion);
                      updateChapterContent(next);
                      setNotice(`Corrección aplicada: "${issue.suggestion}".`);
                    }}
                    className="min-h-[34px] rounded-lg bg-[#78350F] text-white px-3 font-semibold cursor-pointer"
                  >
                    Aplicar "{issue.suggestion}"
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. INDEX & PDF GENERATOR */}
      {activeTab === 'indice-pdf' && currentBook && (
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Índice Automático y Exportación a PDF</h3>
              <p className="text-xs fabro-muted">
                Obra seleccionada: {currentBook.title} ({currentBook.chapters.length} capítulos)
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#78350F] text-white px-4 text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Generar y descargar PDF</span>
            </button>
          </div>
          <ol className="space-y-2 text-xs">
            {currentBook.chapters.map((ch, idx) => {
              const wc = ch.content.trim() ? ch.content.trim().split(/\s+/).length : 0;
              return (
                <li
                  key={ch.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated px-4 py-2.5 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold">
                    {idx + 1}. {ch.title}
                  </span>
                  <span className="font-mono tabular-nums fabro-muted">{wc} palabras</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* 5. PERSONAL BOOK LIBRARY */}
      {activeTab === 'biblioteca' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!bookTitle.trim()) return;
              onSaveReading({
                id: `read-${Date.now()}`,
                title: bookTitle.trim(),
                author: bookAuthor.trim() || 'Autor desconocido',
                status: bookStatus,
                rating: 5,
                notes: bookNotes.trim(),
              });
              setBookTitle('');
              setBookAuthor('');
              setBookNotes('');
            }}
            className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">Organizador de libros personales</h3>
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="Título del libro"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="text"
              value={bookAuthor}
              onChange={(e) => setBookAuthor(e.target.value)}
              placeholder="Autor / Autora"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <select
              value={bookStatus}
              onChange={(e) => setBookStatus(e.target.value as CultureReadingLogItem['status'])}
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            >
              <option value="Por leer">Por leer</option>
              <option value="Leyendo">Leyendo</option>
              <option value="Terminado">Terminado</option>
            </select>
            <textarea
              value={bookNotes}
              onChange={(e) => setBookNotes(e.target.value)}
              rows={3}
              placeholder="Citas favoritas o reseña breve..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
            <button
              type="submit"
              className="w-full min-h-[40px] rounded-xl bg-[#78350F] text-white font-bold cursor-pointer"
            >
              Guardar libro
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {readingList.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border fabro-border fabro-surface p-4 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <h4 className="text-sm font-bold">{item.title}</h4>
                  <p className="fabro-muted">
                    {item.author} · {item.status}
                  </p>
                  {item.notes && <p className="leading-relaxed">{item.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteReading(item.id)}
                  className="p-1.5 fabro-muted hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
