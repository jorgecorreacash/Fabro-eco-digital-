import React, { useMemo, useState } from 'react';
import {
  Clock,
  Globe,
  Heart,
  Loader2,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { useRadio } from '../../context/RadioContext';
import {
  AM_GENRE_PRESETS,
  AM_MAX,
  AM_MIN,
  AM_STEP,
  FM_GENRE_PRESETS,
  FM_MAX,
  FM_MIN,
  FM_STEP,
  formatFrequency,
  isValidStreamUrl,
  RADIO_COUNTRIES,
} from '../../services/radioService';
import type { RadioBand, SleepTimerMinutes } from '../../types/radio';

type RadioPanelTab = 'emisoras' | 'favoritas' | 'manual';

const FM_SCALE_MARKS = [88, 92, 96, 100, 104, 108];
const AM_SCALE_MARKS = [550, 750, 950, 1150, 1350, 1550, 1700];
const SLEEP_OPTIONS: SleepTimerMinutes[] = [0, 15, 30, 60];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const FabroRadioModal: React.FC = () => {
  const {
    radioModalOpen,
    closeRadioModal,
    band,
    setBand,
    dialFrequency,
    tuneDialTo,
    stepDial,
    countryCode,
    setCountryCode,
    activeGenreId,
    selectGenrePreset,
    searchQuery,
    setSearchQuery,
    runStationSearch,
    stations,
    loadingStations,
    searchError,
    currentStation,
    status,
    playbackError,
    playStation,
    togglePlayPause,
    stopRadio,
    nextStation,
    prevStation,
    volume,
    setVolume,
    muted,
    toggleMute,
    staticEffectEnabled,
    setStaticEffectEnabled,
    favorites,
    isFavorite,
    toggleFavorite,
    addCustomStation,
    removeCustomStation,
    sleepTimerMinutes,
    sleepSecondsLeft,
    setSleepTimer,
  } = useRadio();

  const [activeTab, setActiveTab] = useState<RadioPanelTab>('emisoras');

  // Manual frequency form state
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualBand, setManualBand] = useState<RadioBand>('FM');
  const [manualFreq, setManualFreq] = useState('95.5');
  const [manualCity, setManualCity] = useState('Argentina');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);

  const presets = band === 'FM' ? FM_GENRE_PRESETS : AM_GENRE_PRESETS;
  const minFreq = band === 'FM' ? FM_MIN : AM_MIN;
  const maxFreq = band === 'FM' ? FM_MAX : AM_MAX;
  const stepFreq = band === 'FM' ? FM_STEP : AM_STEP;

  const needlePct = useMemo(() => {
    const ratio = (dialFrequency - minFreq) / (maxFreq - minFreq);
    return Math.min(100, Math.max(0, ratio * 100));
  }, [dialFrequency, minFreq, maxFreq]);

  // Nearest station to current dial frequency for display
  const nearestStation = useMemo(() => {
    if (stations.length === 0) return null;
    const tol = band === 'FM' ? 0.45 : 35;
    let best = null;
    let minD = Infinity;
    for (const s of stations) {
      const d = Math.abs(s.frequency - dialFrequency);
      if (d < minD) {
        minD = d;
        best = s;
      }
    }
    return best && minD <= tol ? best : null;
  }, [stations, dialFrequency, band]);

  if (!radioModalOpen) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveTab('emisoras');
    void runStationSearch({ query: searchQuery });
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualSuccess(null);

    if (!manualName.trim()) {
      setManualError('Ingresá un nombre para la emisora.');
      return;
    }
    if (!isValidStreamUrl(manualUrl)) {
      setManualError('Ingresá una URL de transmisión válida (https://... .mp3 / .aac / .m3u8).');
      return;
    }
    const parsedFreq = Number(manualFreq.replace(',', '.'));
    if (!Number.isFinite(parsedFreq)) {
      setManualError('Ingresá un número de frecuencia válido.');
      return;
    }

    const created = addCustomStation({
      name: manualName,
      streamUrl: manualUrl,
      band: manualBand,
      frequency: parsedFreq,
      country: manualCity || 'Frecuencia manual',
    });

    setManualName('');
    setManualUrl('');
    setManualSuccess(
      `Guardada «${created.name}» en ${created.band} ${formatFrequency(created.frequency, created.band)}.`
    );
    playStation(created);
    setActiveTab('emisoras');
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="FABRO Radio Digital AM y FM"
    >
      {/* Backdrop click to close while keeping audio playing in background */}
      <button
        type="button"
        aria-label="Cerrar sintonizador y mantener radio en segundo plano"
        onClick={closeRadioModal}
        className="fixed inset-0 cursor-default"
      />

      <div className="relative z-10 w-full max-w-3xl max-h-[92dvh] flex flex-col rounded-2xl border fabro-border fabro-surface shadow-2xl overflow-hidden">
        {/* Top Receiver Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b fabro-border flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2 truncate">
              <Radio className="w-4 h-4 text-[#0284C7] shrink-0" />
              <span>Radio Digital AM / FM</span>
            </h2>
            <p className="text-[11px] fabro-muted truncate">
              Streaming en vivo por internet · Radio Browser API (100% gratuito) · Segundo plano activo
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Band Switcher */}
            <div
              role="group"
              aria-label="Selector de banda"
              className="inline-flex items-center p-0.5 rounded-lg border fabro-border fabro-surface-elevated"
            >
              {(['FM', 'AM'] as RadioBand[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBand(b)}
                  className={`min-h-[32px] px-3 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    band === b
                      ? b === 'FM'
                        ? 'bg-[#0284C7] text-white'
                        : 'bg-[#D97706] text-white'
                      : 'fabro-muted hover:text-[var(--fabro-text)]'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={closeRadioModal}
              aria-label="Minimizar sintonizador"
              title="Minimizar (la radio sigue sonando)"
              className="min-h-[36px] min-w-[36px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer hover:border-[var(--fabro-accent)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* 1. HI-FI INSTRUMENT DIAL PANEL */}
          <section className="rounded-xl border border-slate-800 bg-[#0B1120] text-slate-100 p-4 sm:p-5 space-y-4">
            {/* Digital Frequency Readout + Active Station */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span className={band === 'FM' ? 'text-sky-400 font-bold' : 'text-amber-400 font-bold'}>
                    {band === 'FM' ? 'BANDA FM ESTÉREO' : 'BANDA AM CLÁSICA'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {status === 'playing'
                      ? 'En el aire'
                      : status === 'loading'
                      ? 'Sintonizando...'
                      : status === 'paused'
                      ? 'En pausa'
                      : status === 'error'
                      ? 'Sin señal'
                      : 'Listo para sintonizar'}
                  </span>
                  {sleepSecondsLeft > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300 tabular-nums">
                        Apagado en {formatCountdown(sleepSecondsLeft)}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-white">
                    {band === 'FM' ? dialFrequency.toFixed(1) : Math.round(dialFrequency)}
                  </span>
                  <span
                    className={`font-mono text-sm font-semibold ${
                      band === 'FM' ? 'text-sky-400' : 'text-amber-400'
                    }`}
                  >
                    {band === 'FM' ? 'MHz' : 'kHz'}
                  </span>
                </div>
              </div>

              {/* Active Station Display & Heart */}
              <div className="min-w-0 sm:text-right space-y-1">
                <p className="text-sm font-semibold text-white truncate max-w-xs sm:ml-auto">
                  {currentStation
                    ? currentStation.name
                    : nearestStation
                    ? `Cerca en el dial: ${nearestStation.name}`
                    : 'Elegí una emisora o deslizá el dial'}
                </p>
                <p className="text-[11px] font-mono text-slate-400 truncate">
                  {currentStation
                    ? `${currentStation.country}${
                        currentStation.codec ? ` · ${currentStation.codec}` : ''
                      }${currentStation.bitrate > 0 ? ` ${currentStation.bitrate} kbps` : ''}`
                    : `${stations.length} emisoras cargadas en banda ${band}`}
                </p>
              </div>
            </div>

            {/* Interactive Visual Dial Scale with Luminous Needle */}
            <div className="space-y-2">
              <div className="relative h-16 rounded-lg border border-slate-700/80 bg-[#060A14] px-3 flex flex-col justify-between py-2 select-none overflow-hidden">
                {/* Numeric Scale Labels */}
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400 pointer-events-none">
                  {(band === 'FM' ? FM_SCALE_MARKS : AM_SCALE_MARKS).map((mark) => (
                    <span key={mark}>{mark}</span>
                  ))}
                </div>

                {/* Tick Marks & Station Dots */}
                <div className="relative h-6 flex items-center">
                  {/* Fine graduation ticks */}
                  <div className="w-full h-3 flex items-end justify-between pointer-events-none opacity-40">
                    {Array.from({ length: 41 }).map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-px ${idx % 5 === 0 ? 'h-3 bg-slate-300' : 'h-1.5 bg-slate-500'}`}
                      />
                    ))}
                  </div>

                  {/* Clickable real station markers along the dial */}
                  {stations.map((st) => {
                    const leftPct = ((st.frequency - minFreq) / (maxFreq - minFreq)) * 100;
                    const isCurrent = currentStation?.id === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => playStation(st)}
                        title={`${st.name} (${formatFrequency(st.frequency, st.band)})`}
                        style={{ left: `${Math.min(99, Math.max(1, leftPct))}%` }}
                        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform cursor-pointer z-10 ${
                          isCurrent
                            ? 'w-2.5 h-2.5 bg-emerald-400 ring-2 ring-emerald-400/40 scale-125'
                            : band === 'FM'
                            ? 'w-1.5 h-1.5 bg-sky-400/70 hover:bg-sky-300 hover:scale-150'
                            : 'w-1.5 h-1.5 bg-amber-400/70 hover:bg-amber-300 hover:scale-150'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Luminous Tuning Needle */}
                <div
                  aria-hidden="true"
                  style={{ left: `${needlePct}%` }}
                  className="pointer-events-none absolute inset-y-1 w-0.5 -translate-x-1/2 z-20 transition-[left] duration-150"
                >
                  <div
                    className={`w-full h-full ${
                      band === 'FM'
                        ? 'bg-sky-400 shadow-[0_0_10px_2px_rgba(56,189,248,0.85)]'
                        : 'bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.85)]'
                    }`}
                  />
                </div>
              </div>

              {/* Tactile Range Slider + Fine Tuning Controls */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => stepDial(-1)}
                  className="min-h-[36px] px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {band === 'FM' ? '−0.1 MHz' : '−10 kHz'}
                </button>

                <input
                  type="range"
                  aria-label={`Sintonizador de frecuencia ${band}`}
                  min={minFreq}
                  max={maxFreq}
                  step={stepFreq}
                  value={dialFrequency}
                  onChange={(e) => tuneDialTo(Number(e.target.value), false)}
                  onMouseUp={() => tuneDialTo(dialFrequency, true)}
                  onTouchEnd={() => tuneDialTo(dialFrequency, true)}
                  className={`flex-1 h-2 rounded-lg cursor-pointer ${
                    band === 'FM' ? 'accent-sky-400' : 'accent-amber-400'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => stepDial(1)}
                  className="min-h-[36px] px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {band === 'FM' ? '+0.1 MHz' : '+10 kHz'}
                </button>
              </div>
            </div>

            {/* Playback Transport + Volume + Static + Sleep Timer */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Transport Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevStation}
                  aria-label="Emisora anterior"
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-200 cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={status === 'playing' ? 'Pausar radio' : 'Reproducir radio'}
                  className={`min-h-[40px] px-4 rounded-lg font-semibold text-xs inline-flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    band === 'FM'
                      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {status === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : status === 'playing' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>{status === 'playing' ? 'Pausar' : 'Escuchar'}</span>
                </button>
                <button
                  type="button"
                  onClick={nextStation}
                  aria-label="Siguiente emisora"
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-200 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                {currentStation && (
                  <button
                    type="button"
                    onClick={() => toggleFavorite(currentStation)}
                    aria-label={
                      isFavorite(currentStation.id)
                        ? 'Quitar de emisoras favoritas'
                        : 'Guardar en emisoras favoritas'
                    }
                    className={`min-h-[40px] min-w-[40px] rounded-lg border flex items-center justify-center cursor-pointer ${
                      isFavorite(currentStation.id)
                        ? 'border-rose-500/60 bg-rose-500/20 text-rose-400'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-rose-400'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${isFavorite(currentStation.id) ? 'fill-current' : ''}`}
                    />
                  </button>
                )}

                {currentStation && (
                  <button
                    type="button"
                    onClick={stopRadio}
                    className="min-h-[40px] px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-medium text-slate-300 cursor-pointer whitespace-nowrap"
                  >
                    Apagar
                  </button>
                )}
              </div>

              {/* Volume & Static Effect */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                    className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-300 cursor-pointer"
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    aria-label="Volumen de la radio"
                    min={0}
                    max={1}
                    step={0.02}
                    value={muted ? 0 : volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 sm:w-24 accent-sky-400 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setStaticEffectEnabled(!staticEffectEnabled)}
                  title="Efecto sutil de estática al cambiar de frecuencia"
                  className={`min-h-[34px] px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    staticEffectEnabled
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  <Waves className="w-3.5 h-3.5" />
                  <span>Estática: {staticEffectEnabled ? 'Sí' : 'No'}</span>
                </button>
              </div>
            </div>

            {/* Sleep Timer Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                Temporizador de apagado automático:
              </span>
              <div className="flex items-center gap-1">
                {SLEEP_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSleepTimer(mins)}
                    className={`min-h-[30px] px-2.5 rounded-md font-mono font-semibold cursor-pointer transition-colors ${
                      sleepTimerMinutes === mins
                        ? 'bg-slate-200 text-slate-950'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {mins === 0 ? 'Off' : `${mins} min`}
                  </button>
                ))}
              </div>
            </div>

            {playbackError && (
              <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-lg px-3 py-2">
                {playbackError}
              </p>
            )}
          </section>

          {/* 2. SECTION TABS: EMISORAS / FAVORITAS / MANUAL */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b fabro-border pb-2.5">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl border fabro-border fabro-surface-elevated">
              <button
                type="button"
                onClick={() => setActiveTab('emisoras')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  activeTab === 'emisoras'
                    ? 'bg-[#0284C7] text-white'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                Emisoras {band} ({stations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('favoritas')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  activeTab === 'favoritas'
                    ? 'bg-[#0284C7] text-white'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                Favoritas ({favorites.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors ${
                  activeTab === 'manual'
                    ? 'bg-[#0284C7] text-white'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar frecuencia manual
              </button>
            </div>

            {activeTab === 'emisoras' && (
              <button
                type="button"
                onClick={() => void runStationSearch()}
                disabled={loadingStations}
                className="min-h-[34px] px-3 rounded-lg border fabro-border fabro-surface-elevated text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStations ? 'animate-spin' : ''}`} />
                Actualizar lista
              </button>
            )}
          </div>

          {/* TAB 1: LIVE STATION BROWSER */}
          {activeTab === 'emisoras' && (
            <div className="space-y-3.5">
              {/* Country + Search Bar */}
              <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <label className="sm:col-span-4 relative flex items-center">
                  <Globe className="w-3.5 h-3.5 fabro-muted absolute left-3 pointer-events-none" />
                  <select
                    aria-label="País de emisoras"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated pl-8 pr-3 text-xs fabro-input cursor-pointer"
                  >
                    {RADIO_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="sm:col-span-6 relative">
                  <Search className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar emisora, ciudad o nombre (ej. Mitre, Aspen, Córdoba, Lo-Fi)..."
                    className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated pl-8 pr-3 text-xs fabro-input"
                  />
                </div>

                <button
                  type="submit"
                  className="sm:col-span-2 min-h-[38px] rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold px-3 cursor-pointer whitespace-nowrap"
                >
                  Buscar
                </button>
              </form>

              {/* Genre Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((p) => {
                  const active = activeGenreId === p.id && !searchQuery.trim();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectGenrePreset(p.id)}
                      className={`min-h-[32px] px-3 rounded-lg border text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                        active
                          ? 'border-[#0284C7] bg-[#0284C7]/12 text-[#0284C7] dark:text-[#38BDF8] font-semibold'
                          : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Station Directory List */}
              {loadingStations ? (
                <div className="py-10 text-center text-xs fabro-muted flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0284C7]" />
                  <span>Consultando emisoras activas en Radio Browser API...</span>
                </div>
              ) : searchError && stations.length === 0 ? (
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 text-xs space-y-2">
                  <p className="font-semibold">No se pudieron cargar emisoras ahora</p>
                  <p className="fabro-muted">{searchError}</p>
                  <button
                    type="button"
                    onClick={() => void runStationSearch()}
                    className="min-h-[34px] px-3 rounded-lg bg-[#0284C7] text-white font-semibold cursor-pointer"
                  >
                    Reintentar conexión
                  </button>
                </div>
              ) : stations.length === 0 ? (
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-5 text-center text-xs space-y-2">
                  <p className="font-semibold">Sin emisoras compatibles para ese filtro</p>
                  <p className="fabro-muted">
                    Probá cambiar de país a «Todo el mundo», limpiar la búsqueda o sumar tu radio local con «Agregar frecuencia manual».
                  </p>
                </div>
              ) : (
                <div className="divide-y fabro-border border fabro-border rounded-xl overflow-hidden">
                  {stations.map((st) => {
                    const isCurrent = currentStation?.id === st.id;
                    const fav = isFavorite(st.id);
                    return (
                      <div
                        key={st.id}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                          isCurrent
                            ? 'bg-[#0284C7]/10'
                            : 'hover:bg-[var(--fabro-surface-2)]/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            isCurrent && status === 'playing' ? togglePlayPause() : playStation(st)
                          }
                          className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                        >
                          <span
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                              isCurrent && status === 'playing'
                                ? 'border-[#0284C7] bg-[#0284C7] text-white'
                                : 'fabro-border fabro-surface-elevated fabro-muted'
                            }`}
                          >
                            {isCurrent && status === 'loading' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isCurrent && status === 'playing' ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{st.name}</p>
                            <div className="flex items-center gap-1.5 text-[11px] fabro-muted truncate">
                              <span className="font-mono tabular-nums font-semibold text-[var(--fabro-text)]">
                                {st.band} {formatFrequency(st.frequency, st.band)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">
                                {st.state ? `${st.state}, ${st.country}` : st.country}
                              </span>
                              {st.codec && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {st.codec}
                                    {st.bitrate > 0 ? ` ${st.bitrate}k` : ''}
                                  </span>
                                </>
                              )}
                              {st.isCustom && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Manual</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(st)}
                            aria-label={fav ? 'Quitar de favoritas' : 'Agregar a favoritas'}
                            className={`min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center cursor-pointer ${
                              fav
                                ? 'text-rose-500'
                                : 'fabro-muted hover:text-rose-500'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
                          </button>
                          {st.isCustom && (
                            <button
                              type="button"
                              onClick={() => removeCustomStation(st.id)}
                              aria-label="Eliminar frecuencia manual"
                              className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center fabro-muted hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FAVORITES (LocalStorage) */}
          {activeTab === 'favoritas' && (
            <div className="space-y-3">
              {favorites.length === 0 ? (
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-6 text-center text-xs space-y-2">
                  <Heart className="w-5 h-5 mx-auto fabro-muted" />
                  <p className="font-semibold">Todavía no guardaste frecuencias favoritas</p>
                  <p className="fabro-muted">
                    Tocá el corazón en cualquier emisora AM o FM para tenerla siempre a mano en este dispositivo.
                  </p>
                </div>
              ) : (
                <div className="divide-y fabro-border border fabro-border rounded-xl overflow-hidden">
                  {favorites.map((st) => {
                    const isCurrent = currentStation?.id === st.id;
                    return (
                      <div
                        key={st.id}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                          isCurrent ? 'bg-[#0284C7]/10' : 'hover:bg-[var(--fabro-surface-2)]/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            isCurrent && status === 'playing' ? togglePlayPause() : playStation(st)
                          }
                          className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                        >
                          <span
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                              isCurrent && status === 'playing'
                                ? 'border-[#0284C7] bg-[#0284C7] text-white'
                                : 'fabro-border fabro-surface-elevated fabro-muted'
                            }`}
                          >
                            {isCurrent && status === 'playing' ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{st.name}</p>
                            <p className="text-[11px] fabro-muted font-mono tabular-nums truncate">
                              {st.band} {formatFrequency(st.frequency, st.band)} · {st.country}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(st)}
                          aria-label="Quitar de favoritas"
                          className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-rose-500 cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADD MANUAL STREAM FREQUENCY */}
          {activeTab === 'manual' && (
            <form onSubmit={handleAddManual} className="space-y-3.5 text-xs">
              <p className="fabro-muted leading-relaxed">
                Pegá el enlace de streaming directo (<span className="font-mono">.mp3</span>,{' '}
                <span className="font-mono">.aac</span> o <span className="font-mono">.m3u8</span>) de tu radio local o comunitaria y asignale su número en el dial AM o FM. Se guarda en tu navegador.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="font-semibold">Nombre de la emisora</span>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Ej. FM Local 95.5"
                    className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                  />
                </label>

                <label className="space-y-1">
                  <span className="font-semibold">Ciudad / País (opcional)</span>
                  <input
                    type="text"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    placeholder="Ej. Rosario, Argentina"
                    className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="font-semibold">Enlace streaming (.mp3 / .aac / .m3u8)</span>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://servidor-radio.ejemplo/stream.mp3"
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono text-xs fabro-input"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="font-semibold">Banda</span>
                  <select
                    value={manualBand}
                    onChange={(e) => {
                      const next = e.target.value as RadioBand;
                      setManualBand(next);
                      setManualFreq(next === 'FM' ? '95.5' : '790');
                    }}
                    className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                  >
                    <option value="FM">FM (87.5 – 108.0 MHz)</option>
                    <option value="AM">AM (530 – 1700 kHz)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-semibold">
                    Frecuencia ({manualBand === 'FM' ? 'MHz' : 'kHz'})
                  </span>
                  <input
                    type="number"
                    step={manualBand === 'FM' ? '0.1' : '10'}
                    min={manualBand === 'FM' ? FM_MIN : AM_MIN}
                    max={manualBand === 'FM' ? FM_MAX : AM_MAX}
                    value={manualFreq}
                    onChange={(e) => setManualFreq(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono tabular-nums fabro-input"
                  />
                </label>
              </div>

              {manualError && <p className="text-rose-600 dark:text-rose-400 font-medium">{manualError}</p>}
              {manualSuccess && <p className="text-emerald-600 dark:text-emerald-400 font-medium">{manualSuccess}</p>}

              <button
                type="submit"
                className="min-h-[40px] px-4 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Guardar y sintonizar ahora
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
