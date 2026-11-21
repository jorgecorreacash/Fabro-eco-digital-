import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Copy,
  Download,
  Edit3,
  FileText,
  FolderPlus,
  Heart,
  Maximize2,
  Minimize2,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  Printer,
  Search,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { vaultGet, vaultSet } from '../../services/localVault';
import {
  DEFAULT_SONGBOOK_SONGS,
  exportSongbookCollectionToPdf,
  exportSongToPdf,
  parseSongDocument,
  transposeChord,
  transposeSongContent,
  TUNING_PRESETS,
  type SongDifficulty,
  type SongItem,
} from '../../services/musicEngine';
import { ChordDiagramSvg } from './ChordDiagramSvg';

const QUICK_CHORD_CHIPS = [
  'C', 'D', 'Dm', 'E', 'Em', 'F', 'G', 'A', 'Am', 'Bm', 'C7', 'D7', 'E7', 'G7', 'A7', 'Fmaj7', 'Asus4',
];

type CancioneroView = 'biblioteca' | 'visor' | 'editor';

export const FabroCancioneros: React.FC = () => {
  const [songs, setSongs] = useState<SongItem[]>(DEFAULT_SONGBOOK_SONGS);
  const [view, setView] = useState<CancioneroView>('biblioteca');
  const [activeSongId, setActiveSongId] = useState<string>(DEFAULT_SONGBOOK_SONGS[0].id);

  // Library filters
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('Todas');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'genre'>('title');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Viewer controls
  const [transposeSteps, setTransposeSteps] = useState(0);
  const [capoOffset, setCapoOffset] = useState(0);
  const [fontSizePx, setFontSizePx] = useState(15);
  const [readingDark, setReadingDark] = useState(false);
  const [instrument, setInstrument] = useState<'guitar' | 'bass'>('guitar');
  const [autoScrollOn, setAutoScrollOn] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2); // 1..6
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedChordPreview, setSelectedChordPreview] = useState<string | null>(null);
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);

  // Editor state
  const [draft, setDraft] = useState<SongItem | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback((cur) => (cur === msg ? null : cur)), 2800);
  };

  // Load persisted songbook
  useEffect(() => {
    let active = true;
    void vaultGet<SongItem[] | null>('fabro_songbook_songs', null).then((saved) => {
      if (active && Array.isArray(saved) && saved.length > 0) {
        setSongs(saved);
        setActiveSongId(saved[0].id);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const persistSongs = (next: SongItem[]) => {
    setSongs(next);
    void vaultSet('fabro_songbook_songs', next);
  };

  const folders = useMemo(() => {
    const set = new Set<string>(['Mis Canciones', 'Práctica']);
    songs.forEach((s) => {
      if (s.folder?.trim()) set.add(s.folder.trim());
    });
    return ['Todas', ...Array.from(set)];
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return songs
      .filter((s) => {
        if (onlyFavorites && !s.favorite) return false;
        if (selectedFolder !== 'Todas' && s.folder !== selectedFolder) return false;
        if (!q) return true;
        return (
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          s.genre.toLowerCase().includes(q) ||
          s.folder.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a[sortBy].localeCompare(b[sortBy], 'es'));
  }, [songs, search, selectedFolder, onlyFavorites, sortBy]);

  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) || songs[0] || null,
    [songs, activeSongId]
  );

  // Auto-scroll effect in Viewer
  useEffect(() => {
    if (!autoScrollOn || view !== 'visor') return;
    const id = window.setInterval(() => {
      if (viewerScrollRef.current) {
        viewerScrollRef.current.scrollTop += scrollSpeed * 0.85;
      } else {
        window.scrollBy({ top: scrollSpeed * 0.85, behavior: 'auto' });
      }
    }, 45);
    return () => window.clearInterval(id);
  }, [autoScrollOn, scrollSpeed, view]);

  const openViewer = (song: SongItem) => {
    setActiveSongId(song.id);
    setTransposeSteps(0);
    setCapoOffset(song.capo || 0);
    setAutoScrollOn(false);
    setSelectedChordPreview(null);
    setView('visor');
  };

  const openEditorForNew = () => {
    const fresh: SongItem = {
      id: `song-${Date.now()}`,
      title: '',
      artist: '',
      album: '',
      genre: 'Acústico',
      key: 'G',
      capo: 0,
      difficulty: 'Principiante',
      tuningId: 'guitar-standard',
      folder: selectedFolder !== 'Todas' ? selectedFolder : 'Mis Canciones',
      favorite: false,
      isDraft: false,
      content: `{Verso 1}\n[G]Escribí tu letra y colocá acordes entre cor[D]chetes\n[Em]así FABRO los alinea y trans[C]pone automáticamente.`,
      updatedAt: new Date().toISOString(),
    };
    setDraft(fresh);
    setView('editor');
  };

  const openEditorForExisting = (song: SongItem) => {
    setDraft({ ...song });
    setView('editor');
  };

  const handleSaveDraft = (asDraft = false) => {
    if (!draft) return;
    const clean: SongItem = {
      ...draft,
      title: draft.title.trim() || 'Canción sin título',
      artist: draft.artist.trim() || 'Autor propio',
      folder: draft.folder.trim() || 'Mis Canciones',
      isDraft: asDraft,
      updatedAt: new Date().toISOString(),
    };
    const exists = songs.some((s) => s.id === clean.id);
    const next = exists
      ? songs.map((s) => (s.id === clean.id ? clean : s))
      : [clean, ...songs];
    persistSongs(next);
    setActiveSongId(clean.id);
    setView('visor');
    notify(asDraft ? 'Borrador guardado en tu cancionero.' : 'Canción guardada en FABRO Cancioneros.');
  };

  const handleDuplicateSong = (song: SongItem) => {
    const copy: SongItem = {
      ...song,
      id: `song-${Date.now()}`,
      title: `${song.title} (Copia)`,
      updatedAt: new Date().toISOString(),
    };
    persistSongs([copy, ...songs]);
    notify(`Duplicaste «${song.title}».`);
  };

  const handleDeleteSong = (id: string) => {
    const next = songs.filter((s) => s.id !== id);
    persistSongs(next);
    if (activeSongId === id) {
      setActiveSongId(next[0]?.id || '');
      setView('biblioteca');
    }
    notify('Canción eliminada.');
  };

  const handleToggleFavorite = (id: string) => {
    const next = songs.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s));
    persistSongs(next);
  };

  const insertChordAtCursor = (chord: string) => {
    if (!draft) return;
    const el = textareaRef.current;
    const token = `[${chord}]`;
    if (!el) {
      setDraft({ ...draft, content: `${draft.content}${token}` });
      return;
    }
    const start = el.selectionStart ?? draft.content.length;
    const end = el.selectionEnd ?? draft.content.length;
    const nextContent =
      draft.content.slice(0, start) + token + draft.content.slice(end);
    setDraft({ ...draft, content: nextContent });
    window.requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // Export & Import JSON / TXT / ChordPro
  const handleExportJsonBackup = () => {
    const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FABRO_Cancioneros_Respaldo.json';
    a.click();
    URL.revokeObjectURL(url);
    notify('Respaldo JSON del cancionero descargado.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((x) => x && typeof x.content === 'string') as SongItem[];
          if (valid.length > 0) {
            const merged = [
              ...valid.map((v, i) => ({
                ...v,
                id: v.id || `imp-${Date.now()}-${i}`,
              })),
              ...songs,
            ];
            persistSongs(merged);
            notify(`Se importaron ${valid.length} canciones desde JSON.`);
            return;
          }
        }
      }
      // Import .txt or .cho as a new song
      const baseTitle = file.name.replace(/\.(txt|cho|chopro|crd)$/i, '');
      const imported: SongItem = {
        id: `song-${Date.now()}`,
        title: baseTitle || 'Canción importada',
        artist: 'Importado por usuario',
        album: '',
        genre: 'Personal',
        key: 'C',
        capo: 0,
        difficulty: 'Intermedio',
        tuningId: 'guitar-standard',
        folder: 'Importadas',
        favorite: false,
        content: text,
        updatedAt: new Date().toISOString(),
      };
      persistSongs([imported, ...songs]);
      openViewer(imported);
      notify(`Canción «${imported.title}» importada.`);
    } catch {
      notify('No pudimos leer el archivo seleccionado.');
    }
  };

  // Effective transposition in Viewer (manual transpose - capo shift)
  const effectiveSemitones = transposeSteps - (capoOffset - (activeSong?.capo || 0));

  const parsedViewer = useMemo(() => {
    if (!activeSong) return { lines: [], uniqueChords: [] };
    const shifted = transposeSongContent(activeSong.content, effectiveSemitones);
    return parseSongDocument(shifted);
  }, [activeSong, effectiveSemitones]);

  const effectiveKey = activeSong
    ? transposeChord(activeSong.key, effectiveSemitones)
    : 'C';

  const handleShareSongText = async () => {
    if (!activeSong) return;
    const text = `${activeSong.title} — ${activeSong.artist}\nTono: ${effectiveKey} | Capo: ${capoOffset}\n\n${transposeSongContent(activeSong.content, effectiveSemitones)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: activeSong.title, text });
        return;
      } catch {
        // fallback clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      notify('Letra y acordes copiados para compartir.');
    } catch {
      notify('No pudimos copiar al portapapeles.');
    }
  };

  // =========================================================================
  // VIEW 1: LIBRARY
  // =========================================================================
  if (view === 'biblioteca') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border fabro-futuristic-panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 fabro-accent-text" />
                FABRO Cancioneros
              </h2>
              <p className="text-xs fabro-muted">
                Creá, organizá, transponé y exportá tus canciones y cancioneros completos en PDF.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openEditorForNew}
                className="fabro-btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva canción</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportSongbookCollectionToPdf(
                    selectedFolder === 'Todas' ? 'Mi Cancionero Completo' : selectedFolder,
                    filteredSongs
                  )
                }
                disabled={filteredSongs.length === 0}
                className="fabro-btn-secondary"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Cancionero PDF ({filteredSongs.length})</span>
              </button>
              <label className="fabro-btn-secondary cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importar .txt/.json</span>
                <input
                  type="file"
                  accept=".txt,.cho,.chopro,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleExportJsonBackup}
                className="fabro-btn-secondary"
                title="Respaldar todo el cancionero en JSON"
              >
                <FileText className="w-4 h-4" />
                <span>Respaldo</span>
              </button>
            </div>
          </div>

          {feedback && (
            <div className="rounded-xl border fabro-accent-border fabro-accent-soft px-3.5 py-2 text-xs font-bold">
              {feedback}
            </div>
          )}

          {/* Search & Folder Filters */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, artista, género o carpeta..."
                className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 text-xs fabro-input"
              />
            </div>

            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              aria-label="Filtrar por carpeta"
              className="md:col-span-3 min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold fabro-input"
            >
              {folders.map((f) => (
                <option key={f} value={f}>
                  Carpeta: {f}
                </option>
              ))}
            </select>

            <div className="md:col-span-3 flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'title' | 'artist' | 'genre')}
                aria-label="Ordenar canciones"
                className="flex-1 min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 text-xs font-semibold fabro-input"
              >
                <option value="title">Orden: Nombre</option>
                <option value="artist">Orden: Artista</option>
                <option value="genre">Orden: Género</option>
              </select>
              <button
                type="button"
                onClick={() => setOnlyFavorites((v) => !v)}
                aria-pressed={onlyFavorites}
                title="Mostrar solo favoritas"
                className={`min-h-[42px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                  onlyFavorites
                    ? 'border-rose-500 bg-rose-500/15 text-rose-500'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                <Heart className={`w-4 h-4 ${onlyFavorites ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Song Cards Grid */}
        {filteredSongs.length === 0 ? (
          <div className="rounded-2xl border fabro-border fabro-surface p-8 text-center space-y-3">
            <Music className="w-8 h-8 mx-auto fabro-muted" />
            <p className="text-sm font-bold">No hay canciones con este filtro.</p>
            <button type="button" onClick={openEditorForNew} className="fabro-btn-primary">
              <Plus className="w-4 h-4" />
              <span>Crear primera canción</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredSongs.map((song) => {
              const parsed = parseSongDocument(song.content);
              return (
                <article
                  key={song.id}
                  className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-col justify-between gap-3 hover:border-[var(--fabro-accent)] transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openViewer(song)}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <h3 className="font-display text-base font-extrabold truncate hover:underline">
                          {song.title}
                        </h3>
                        <p className="text-xs fabro-muted truncate">
                          {song.artist} · {song.genre}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(song.id)}
                        aria-label="Marcar favorita"
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                          song.favorite ? 'text-rose-500' : 'fabro-muted hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${song.favorite ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded-md fabro-accent-soft font-bold">
                        Tono {song.key}
                      </span>
                      {song.capo > 0 && (
                        <span className="px-2 py-0.5 rounded-md fabro-surface-elevated border fabro-border">
                          Capo {song.capo}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md fabro-surface-elevated border fabro-border fabro-muted">
                        {song.folder}
                      </span>
                      {song.isDraft && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 font-bold">
                          Borrador
                        </span>
                      )}
                    </div>

                    {parsed.uniqueChords.length > 0 && (
                      <p className="text-[11px] font-mono fabro-muted truncate">
                        Acordes: {parsed.uniqueChords.slice(0, 7).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-2.5 border-t fabro-border">
                    <button
                      type="button"
                      onClick={() => openViewer(song)}
                      className="fabro-btn-primary text-xs min-h-[36px] py-1.5 px-3"
                    >
                      Abrir visor
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditorForExisting(song)}
                        title="Editar"
                        aria-label="Editar canción"
                        className="h-8 w-8 rounded-lg border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateSong(song)}
                        title="Duplicar"
                        aria-label="Duplicar canción"
                        className="h-8 w-8 rounded-lg border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportSongToPdf(song)}
                        title="Exportar PDF"
                        aria-label="Exportar PDF"
                        className="h-8 w-8 rounded-lg border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSong(song.id)}
                        title="Eliminar"
                        aria-label="Eliminar canción"
                        className="h-8 w-8 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 flex items-center justify-center cursor-pointer"
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
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SONG EDITOR
  // =========================================================================
  if (view === 'editor' && draft) {
    const previewParsed = parseSongDocument(draft.content);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border fabro-futuristic-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setView('biblioteca')}
              className="fabro-btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a biblioteca</span>
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveDraft(true)}
                className="fabro-btn-secondary"
              >
                Guardar borrador
              </button>
              <button
                type="button"
                onClick={() => handleSaveDraft(false)}
                className="fabro-btn-primary"
              >
                Guardar canción
              </button>
            </div>
          </div>

          {/* Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-bold fabro-muted">Título</span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Nombre de la canción"
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-bold fabro-muted">Artista / Banda</span>
              <input
                type="text"
                value={draft.artist}
                onChange={(e) => setDraft({ ...draft, artist: e.target.value })}
                placeholder="Autor o banda"
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-bold fabro-muted">Género</span>
              <input
                type="text"
                value={draft.genre}
                onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
                placeholder="Rock, Folk, Balada..."
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-bold fabro-muted flex items-center gap-1">
                <FolderPlus className="w-3.5 h-3.5" /> Carpeta / Cancionero
              </span>
              <input
                type="text"
                value={draft.folder}
                onChange={(e) => setDraft({ ...draft, folder: e.target.value })}
                placeholder="Mis Canciones"
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-bold fabro-muted">Tonalidad original</span>
              <input
                type="text"
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                placeholder="G, Am, C..."
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-bold fabro-muted">Capo (traste)</span>
              <input
                type="number"
                min={0}
                max={12}
                value={draft.capo}
                onChange={(e) => setDraft({ ...draft, capo: Number(e.target.value) || 0 })}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-bold fabro-muted">Dificultad</span>
              <select
                value={draft.difficulty}
                onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as SongDifficulty })}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold fabro-muted">Afinación</span>
              <select
                value={draft.tuningId}
                onChange={(e) => setDraft({ ...draft, tuningId: e.target.value })}
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                {TUNING_PRESETS.filter((t) => t.id !== 'chromatic').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Quick Chord Insertion Toolbar */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold fabro-muted">
              Insertar acorde en la posición del cursor (formato [Acorde]palabra):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CHORD_CHIPS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => insertChordAtCursor(ch)}
                  className="min-h-[32px] px-2.5 rounded-lg border fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)] font-mono text-xs font-bold cursor-pointer active:scale-95"
                >
                  [{ch}]
                </button>
              ))}
              <button
                type="button"
                onClick={() => insertChordAtCursor('Estribillo')}
                className="min-h-[32px] px-2.5 rounded-lg border fabro-accent-border fabro-accent-soft text-xs font-bold cursor-pointer"
              >
                + Sección
              </button>
            </div>
          </div>

          {/* Split Editor + Live Aligned Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-xs font-bold">Letra y acordes (Editor)</span>
              <textarea
                ref={textareaRef}
                rows={15}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3.5 font-mono text-xs leading-relaxed fabro-input"
                placeholder="{Verso 1}&#10;[G]Escribí tu letra con [D]acordes..."
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold">Vista previa alineada en vivo</span>
              <div className="h-[340px] overflow-y-auto rounded-xl border fabro-border fabro-surface p-4 space-y-2.5">
                {previewParsed.lines.map((line, i) => {
                  if (line.kind === 'empty') return <div key={i} className="h-3" />;
                  if (line.kind === 'section') {
                    return (
                      <p key={i} className="text-xs font-extrabold uppercase tracking-wider fabro-accent-text pt-1">
                        {line.sectionTitle}
                      </p>
                    );
                  }
                  return (
                    <div key={i} className="flex flex-wrap items-end leading-tight">
                      {line.segments.map((seg, j) => (
                        <span key={j} className="inline-flex flex-col mr-0.5">
                          <span className="font-mono text-xs font-extrabold fabro-accent-text min-h-[16px]">
                            {seg.chord || '\u00A0'}
                          </span>
                          <span className="text-sm whitespace-pre-wrap">{seg.lyric || ' '}</span>
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: INTERACTIVE SONG VIEWER (Chords above lyrics, Transpose, AutoScroll)
  // =========================================================================
  if (!activeSong) return null;

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto fabro-bg p-4 sm:p-6 space-y-4'
          : 'space-y-4'
      }
    >
      {/* Top Toolbar */}
      <div className="rounded-2xl border fabro-futuristic-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setFullscreen(false);
                setAutoScrollOn(false);
                setView('biblioteca');
              }}
              className="fabro-btn-secondary min-h-[38px] px-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Biblioteca</span>
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-extrabold truncate">
                {activeSong.title}
              </h2>
              <p className="text-xs fabro-muted truncate">
                {activeSong.artist} · {activeSong.genre} · {activeSong.difficulty}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleToggleFavorite(activeSong.id)}
              aria-label="Favorita"
              className={`fabro-btn-icon ${activeSong.favorite ? 'text-rose-500 border-rose-500/50' : ''}`}
            >
              <Heart className={`w-4 h-4 ${activeSong.favorite ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => openEditorForExisting(activeSong)}
              className="fabro-btn-secondary min-h-[38px] px-3 text-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={() => exportSongToPdf(activeSong, effectiveSemitones)}
              className="fabro-btn-secondary min-h-[38px] px-3 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="fabro-btn-icon"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleShareSongText()}
              className="fabro-btn-icon"
              title="Compartir"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="fabro-btn-icon"
              title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {feedback && (
          <div className="rounded-xl border fabro-accent-border fabro-accent-soft px-3.5 py-2 text-xs font-bold">
            {feedback}
          </div>
        )}

        {/* Performance Controls Bar: Transpose, Capo, Font, Auto-Scroll, Instrument, Reading Mode */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Live Transposition */}
          <div className="inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
            <span className="px-2 font-bold fabro-muted">Tono:</span>
            <button
              type="button"
              onClick={() => setTransposeSteps((s) => s - 1)}
              aria-label="Bajar medio tono"
              className="h-8 w-8 rounded-lg border fabro-border fabro-surface flex items-center justify-center cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 font-mono font-extrabold fabro-accent-text tabular-nums min-w-[42px] text-center">
              {effectiveKey}
            </span>
            <button
              type="button"
              onClick={() => setTransposeSteps((s) => s + 1)}
              aria-label="Subir medio tono"
              className="h-8 w-8 rounded-lg border fabro-border fabro-surface flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {transposeSteps !== 0 && (
              <button
                type="button"
                onClick={() => setTransposeSteps(0)}
                className="px-2 text-[10px] font-bold fabro-muted hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Capo */}
          <label className="inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-1.5">
            <span className="font-bold fabro-muted">Capo:</span>
            <select
              value={capoOffset}
              onChange={(e) => setCapoOffset(Number(e.target.value))}
              className="bg-transparent font-mono font-bold focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <option key={i} value={i} className="text-slate-900">
                  {i === 0 ? 'Sin capo' : `Traste ${i}`}
                </option>
              ))}
            </select>
          </label>

          {/* Font Size */}
          <div className="inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
            <button
              type="button"
              onClick={() => setFontSizePx((f) => Math.max(12, f - 1))}
              className="h-8 px-2 rounded-lg font-bold cursor-pointer"
            >
              A-
            </button>
            <span className="font-mono text-[11px] tabular-nums px-1">{fontSizePx}px</span>
            <button
              type="button"
              onClick={() => setFontSizePx((f) => Math.min(24, f + 1))}
              className="h-8 px-2 rounded-lg font-bold cursor-pointer"
            >
              A+
            </button>
          </div>

          {/* Auto-Scroll */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated p-1 pr-2.5">
            <button
              type="button"
              onClick={() => setAutoScrollOn((v) => !v)}
              className={`h-8 px-2.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                autoScrollOn ? 'fabro-accent-bg' : 'fabro-surface'
              }`}
            >
              {autoScrollOn ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>Auto-scroll</span>
            </button>
            <input
              type="range"
              min={1}
              max={6}
              value={scrollSpeed}
              onChange={(e) => setScrollSpeed(Number(e.target.value))}
              aria-label="Velocidad de desplazamiento automático"
              className="w-16 accent-[var(--fabro-accent)] cursor-pointer"
            />
          </div>

          {/* Instrument + Reading Contrast */}
          <div className="inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1">
            <button
              type="button"
              onClick={() => setInstrument('guitar')}
              className={`h-8 px-2.5 rounded-lg font-bold cursor-pointer ${
                instrument === 'guitar' ? 'fabro-accent-bg' : 'fabro-muted'
              }`}
            >
              Guitarra
            </button>
            <button
              type="button"
              onClick={() => setInstrument('bass')}
              className={`h-8 px-2.5 rounded-lg font-bold cursor-pointer ${
                instrument === 'bass' ? 'fabro-accent-bg' : 'fabro-muted'
              }`}
            >
              Bajo
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReadingDark((v) => !v)}
            className="fabro-btn-secondary min-h-[38px] px-3 text-xs"
          >
            {readingDark ? 'Lectura tema actual' : 'Modo escenario oscuro'}
          </button>
        </div>
      </div>

      {/* Song Body + Interactive Chord Diagrams Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main Sheet */}
        <div
          ref={viewerScrollRef}
          className={`lg:col-span-8 rounded-2xl border p-5 sm:p-7 space-y-3 overflow-y-auto ${
            fullscreen ? 'max-h-[72vh]' : 'max-h-[68vh]'
          } ${
            readingDark
              ? 'bg-[#07090F] border-slate-700 text-slate-100'
              : 'fabro-border fabro-surface'
          }`}
        >
          {parsedViewer.lines.map((line, i) => {
            if (line.kind === 'empty') {
              return <div key={i} className="h-4" />;
            }
            if (line.kind === 'section') {
              return (
                <p
                  key={i}
                  className="text-xs font-extrabold uppercase tracking-widest pt-2 fabro-accent-text"
                >
                  {line.sectionTitle}
                </p>
              );
            }
            return (
              <div
                key={i}
                className="flex flex-wrap items-end leading-snug"
                style={{ fontSize: `${fontSizePx}px` }}
              >
                {line.segments.map((seg, j) => (
                  <span key={j} className="inline-flex flex-col mr-0.5">
                    {seg.chord ? (
                      <button
                        type="button"
                        onClick={() => setSelectedChordPreview(seg.chord)}
                        title={`Ver diagrama y escuchar ${seg.chord}`}
                        className="text-left font-mono font-extrabold cursor-pointer hover:underline leading-tight pb-0.5"
                        style={{
                          fontSize: `${Math.max(12, fontSizePx - 1)}px`,
                          color: readingDark ? '#A78BFA' : 'var(--fabro-accent-text)',
                        }}
                      >
                        {seg.chord}
                      </button>
                    ) : (
                      <span
                        className="font-mono leading-tight pb-0.5 select-none"
                        style={{ fontSize: `${Math.max(12, fontSizePx - 1)}px` }}
                      >
                        &nbsp;
                      </span>
                    )}
                    <span className="whitespace-pre-wrap font-medium">
                      {seg.lyric || ' '}
                    </span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>

        {/* Right: Chord Diagrams Used in Song */}
        <aside className="lg:col-span-4 rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-extrabold">
              Acordes de la canción ({parsedViewer.uniqueChords.length})
            </h3>
            <span className="text-[11px] fabro-muted capitalize">
              {instrument === 'bass' ? 'Bajo' : 'Guitarra'}
            </span>
          </div>

          {selectedChordPreview && (
            <div className="space-y-2 pb-3 border-b fabro-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold fabro-accent-text">Acorde seleccionado</span>
                <button
                  type="button"
                  onClick={() => setSelectedChordPreview(null)}
                  className="text-[11px] fabro-muted hover:underline cursor-pointer"
                >
                  Ver todos
                </button>
              </div>
              <ChordDiagramSvg chordName={selectedChordPreview} instrument={instrument} />
            </div>
          )}

          {parsedViewer.uniqueChords.length === 0 ? (
            <p className="text-xs fabro-muted">
              Agregá acordes entre corchetes como [G], [Em] o [D] para visualizar sus diagramas.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 max-h-[54vh] overflow-y-auto pr-0.5">
              {parsedViewer.uniqueChords.map((chord) => (
                <ChordDiagramSvg
                  key={`${chord}-${instrument}`}
                  chordName={chord}
                  instrument={instrument}
                  compact
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
