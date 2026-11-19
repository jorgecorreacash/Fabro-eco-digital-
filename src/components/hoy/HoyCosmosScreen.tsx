import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Cloud,
  CloudRain,
  CloudSun,
  Copy,
  Droplets,
  Heart,
  MapPin,
  MessageCircleHeart,
  Moon,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Wind,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  describeWmoWeather,
  fetchLiveWeather,
  getDailyHoroscope,
  getLunarStatus,
  WEATHER_CITY_PRESETS,
  ZODIAC_SIGNS,
} from '../../services/cosmosWeatherService';
import { DEFAULT_WEATHER_SNAPSHOT, vaultGet, vaultSet } from '../../services/localVault';
import type { CachedWeatherSnapshot, QuoteCategory } from '../../types/ecosystem';

const QUOTE_CATEGORIES: QuoteCategory[] = ['Sabiduría', 'Estudio', 'Ánimo', 'Vínculos', 'Calma'];

function renderWeatherIcon(code: number, className = 'w-7 h-7') {
  if (code === 0) return <Sun className={className} />;
  if (code >= 61) return <CloudRain className={className} />;
  if (code >= 45) return <Cloud className={className} />;
  return <CloudSun className={className} />;
}

export const HoyCosmosScreen: React.FC = () => {
  const {
    profile,
    updateProfile,
    network,
    selectedZodiac,
    setSelectedZodiac,
    userQuotes,
    addUserQuote,
    likeUserQuote,
    deleteUserQuote,
  } = useEcosystem();

  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<CachedWeatherSnapshot>(DEFAULT_WEATHER_SNAPSHOT);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);

  const [quoteFilter, setQuoteFilter] = useState<'Todas' | QuoteCategory>('Todas');
  const [newQuoteText, setNewQuoteText] = useState('');
  const [newQuoteAuthor, setNewQuoteAuthor] = useState(profile.displayName || '');
  const [newQuoteCategory, setNewQuoteCategory] = useState<QuoteCategory>('Sabiduría');
  const [quoteStatus, setQuoteStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Real-time ticking clock
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Load cached weather from IndexedDB & refresh live if online
  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await vaultGet<CachedWeatherSnapshot>(
        'weather_cache',
        DEFAULT_WEATHER_SNAPSHOT
      );
      if (!active) return;
      setWeather(cached);

      if (navigator.onLine) {
        setWeatherLoading(true);
        try {
          const fresh = await fetchLiveWeather(cached.latitude, cached.longitude, cached.cityName);
          if (!active) return;
          setWeather(fresh);
          void vaultSet('weather_cache', fresh);
        } catch {
          if (active) setWeatherNotice('Mostrando último clima guardado localmente.');
        } finally {
          if (active) setWeatherLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshCityWeather = async (lat: number, lon: number, cityName: string) => {
    setWeatherLoading(true);
    setWeatherNotice(null);
    try {
      const fresh = await fetchLiveWeather(lat, lon, cityName);
      setWeather(fresh);
      void vaultSet('weather_cache', fresh);
    } catch {
      setWeatherNotice('Sin conexión o servicio ocupado; conservamos el clima en caché.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setWeatherNotice('Tu navegador no permite geolocalización; elegí una ciudad abajo.');
      return;
    }
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void refreshCityWeather(pos.coords.latitude, pos.coords.longitude, 'Tu ubicación');
      },
      () => {
        setWeatherLoading(false);
        setWeatherNotice('No se pudo obtener ubicación; podés elegir cualquier ciudad.');
      },
      { timeout: 6000 }
    );
  };

  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Hora local';
    }
  }, []);

  const formattedClock = now.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const formattedDate = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const lunar = useMemo(() => getLunarStatus(now), [now.toDateString()]);
  const horoscope = useMemo(
    () => getDailyHoroscope(selectedZodiac, now),
    [selectedZodiac, now.toDateString()]
  );
  const wmoMeta = describeWmoWeather(weather.weatherCode);

  const filteredQuotes = useMemo(
    () =>
      quoteFilter === 'Todas'
        ? userQuotes
        : userQuotes.filter((q) => q.category === quoteFilter),
    [quoteFilter, userQuotes]
  );

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteText.trim()) return;
    addUserQuote(newQuoteText, newQuoteAuthor || profile.displayName, newQuoteCategory);
    setNewQuoteText('');
    setQuoteStatus('¡Tu frase quedó publicada en el panel local de FABRO!');
    window.setTimeout(() => setQuoteStatus(null), 3000);
  };

  const handleCopyQuote = (id: string, text: string, author: string) => {
    const line = `«${text}» — ${author} (🍀 FABRO)`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(line);
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  // Visual lunar terminator offset (-100 to +100 approx for crisp SVG)
  const moonLitOffset = Math.round((lunar.cycleFraction - 0.5) * 36);

  return (
    <div className="space-y-6">
      {/* Row 1: Live Clock + Weather Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Live Time & Date Card */}
        <section className="lg:col-span-5 rounded-2xl border fabro-surface p-5 sm:p-6 flex flex-col justify-between gap-4 relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-semibold fabro-accent-text">
                <Clock className="w-4 h-4" />
                Hora y Fecha Actual
              </span>
              <span className="font-mono truncate">{timeZone}</span>
            </div>

            <p className="text-sm font-semibold">{greeting}, {profile.displayName}</p>
            <p className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums">
              {formattedClock}
            </p>
            <p className="text-xs sm:text-sm fabro-muted capitalize">{formattedDate}</p>
          </div>

          <div className="pt-4 border-t fabro-border space-y-2">
            <p className="text-[11px] font-semibold fabro-muted">Tu frase activa del día</p>
            <p className="text-xs italic leading-relaxed">«{profile.dailyPhrase}»</p>
          </div>
        </section>

        {/* Colorful Real-Time Weather & Forecast Card */}
        <section className="lg:col-span-7 rounded-2xl border fabro-surface overflow-hidden flex flex-col justify-between">
          {weatherLoading && (
            <div className="h-1 w-full fabro-colorful-loader" aria-label="Actualizando clima" />
          )}

          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${wmoMeta.tone}, #2563EB)`,
                  }}
                >
                  {renderWeatherIcon(weather.weatherCode, 'w-7 h-7')}
                </div>
                <div>
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 fabro-accent-text" />
                    {weather.cityName}
                  </p>
                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="font-mono text-3xl sm:text-4xl font-extrabold tabular-nums">
                      {weather.temperatureC}°C
                    </span>
                    <span className="text-xs font-semibold fabro-muted">
                      {wmoMeta.label} · Máx {weather.dailyMaxC}° / Mín {weather.dailyMinC}°
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <MapPin className="w-3.5 h-3.5 fabro-accent-text" />
                  Mi ubicación
                </button>
                <button
                  type="button"
                  disabled={weatherLoading}
                  onClick={() =>
                    void refreshCityWeather(weather.latitude, weather.longitude, weather.cityName)
                  }
                  aria-label="Actualizar clima"
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>
            </div>

            {weatherLoading ? (
              <div className="grid grid-cols-3 gap-2.5">
                <div className="h-16 rounded-xl fabro-colorful-shimmer" />
                <div className="h-16 rounded-xl fabro-colorful-shimmer" />
                <div className="h-16 rounded-xl fabro-colorful-shimmer" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                  <p className="fabro-muted text-[11px]">Sensación</p>
                  <p className="font-mono text-base font-bold tabular-nums mt-0.5">
                    {weather.apparentC}°C
                  </p>
                </div>
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                  <p className="fabro-muted text-[11px] flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-[#06B6D4]" />
                    Humedad
                  </p>
                  <p className="font-mono text-base font-bold tabular-nums mt-0.5">
                    {weather.humidityPct}%
                  </p>
                </div>
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                  <p className="fabro-muted text-[11px] flex items-center gap-1">
                    <Wind className="w-3 h-3 text-[#10B981]" />
                    Viento
                  </p>
                  <p className="font-mono text-base font-bold tabular-nums mt-0.5">
                    {weather.windKmh} km/h
                  </p>
                </div>
              </div>
            )}

            {/* City Presets & 3-day outlook */}
            <div className="space-y-3 pt-2 border-t fabro-border">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {WEATHER_CITY_PRESETS.map((city) => {
                  const selected = weather.cityName === city.name;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => void refreshCityWeather(city.latitude, city.longitude, city.name)}
                      className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'fabro-accent-border fabro-accent-soft fabro-accent-text'
                          : 'fabro-border fabro-surface-elevated fabro-muted'
                      }`}
                    >
                      {city.name}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {weather.forecastDays.map((day) => (
                  <div
                    key={day.dateLabel}
                    className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold capitalize truncate">{day.dateLabel}</span>
                    <span className="font-mono tabular-nums text-[11px] shrink-0">
                      {day.maxC}°/{day.minC}°
                    </span>
                  </div>
                ))}
              </div>

              {(weatherNotice || !network.isOnline) && (
                <p className="text-[11px] fabro-muted">
                  {weatherNotice || 'Modo offline: usando último pronóstico guardado localmente.'}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Moon Phase & Interactive Daily Horoscope */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Real Astronomical Lunar Phase Card */}
        <section className="lg:col-span-5 rounded-2xl border fabro-surface p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-bold flex items-center gap-1.5 text-[#7C3AED] dark:text-[#C4B5FD]">
                <Moon className="w-4 h-4" />
                Estado Lunar Astronómico
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {lunar.phaseName}
              </h2>
              <p className="text-xs font-mono tabular-nums fabro-muted">
                Iluminación {lunar.illuminationPct}% · Edad {lunar.ageDays} días
              </p>
            </div>

            {/* Crisp SVG Moon Phase Visual */}
            <div
              className="w-20 h-20 rounded-2xl bg-[#0B1120] border border-[#334155] flex items-center justify-center shrink-0 shadow-inner"
              aria-hidden="true"
            >
              <svg viewBox="0 0 64 64" className="w-14 h-14">
                <defs>
                  <clipPath id="fabro-moon-clip">
                    <circle cx="32" cy="32" r="22" />
                  </clipPath>
                </defs>
                <circle cx="32" cy="32" r="22" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
                <g clipPath="url(#fabro-moon-clip)">
                  <circle cx="32" cy="32" r="22" fill="#FDE68A" />
                  {lunar.illuminationPct < 97 && (
                    <circle
                      cx={32 + moonLitOffset}
                      cy="32"
                      r="22"
                      fill="#0F172A"
                    />
                  )}
                </g>
              </svg>
            </div>
          </div>

          <p className="text-xs fabro-muted leading-relaxed">{lunar.advice}</p>

          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t fabro-border text-xs">
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
              <p className="text-[11px] fabro-muted">Próxima Luna Llena</p>
              <p className="font-mono font-bold tabular-nums mt-0.5">
                En {lunar.daysUntilFullMoon} día{lunar.daysUntilFullMoon === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-3">
              <p className="text-[11px] fabro-muted">Próxima Luna Nueva</p>
              <p className="font-mono font-bold tabular-nums mt-0.5">
                En {lunar.daysUntilNewMoon} día{lunar.daysUntilNewMoon === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </section>

        {/* Daily Horoscope Interactive Card */}
        <section className="lg:col-span-7 rounded-2xl border fabro-surface p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold flex items-center gap-1.5 text-[#D97706] dark:text-[#FBBF24]">
                <Sparkles className="w-4 h-4" />
                Horóscopo Diario FABRO
              </p>
              <h2 className="font-display text-xl font-bold tracking-tight mt-0.5">
                {horoscope.meta.symbol} {horoscope.meta.name} · Elemento {horoscope.meta.element}
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums fabro-muted">
              {horoscope.meta.dateRange}
            </span>
          </div>

          {/* 12 Signs Swipeable / Grid Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:grid sm:grid-cols-6 sm:overflow-visible">
            {ZODIAC_SIGNS.map((sign) => {
              const active = sign.id === selectedZodiac;
              return (
                <button
                  key={sign.id}
                  type="button"
                  onClick={() => setSelectedZodiac(sign.id)}
                  className={`min-h-[40px] rounded-xl border px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 ${
                    active
                      ? 'text-white border-transparent shadow-sm'
                      : 'fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)]'
                  }`}
                  style={
                    active
                      ? { background: `linear-gradient(135deg, ${sign.accent}, #7C3AED)` }
                      : undefined
                  }
                >
                  <span>{sign.symbol}</span>
                  <span className="truncate">{sign.name}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1">
              <p className="font-bold text-[#F59E0B]">Energía del día</p>
              <p className="fabro-muted leading-relaxed">{horoscope.energy}</p>
            </div>
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1">
              <p className="font-bold text-[#2563EB] dark:text-[#60A5FA]">Estudio y enfoque</p>
              <p className="fabro-muted leading-relaxed">{horoscope.study}</p>
            </div>
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-1">
              <p className="font-bold text-[#EC4899]">Vínculos</p>
              <p className="fabro-muted leading-relaxed">{horoscope.bonds}</p>
            </div>
          </div>

          <p className="text-[11px] fabro-muted font-medium">
            Color armónico hoy: <strong className="text-[var(--fabro-text)]">{horoscope.harmonyColor}</strong>
            {' · '}
            Número guía: <strong className="font-mono tabular-nums text-[var(--fabro-text)]">{horoscope.luckyNumber}</strong>
          </p>
        </section>
      </div>

      {/* Row 3: Panel de Frases Aportadas por Usuarios */}
      <section className="rounded-2xl border fabro-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <MessageCircleHeart className="w-5 h-5 text-[#EC4899]" />
              Panel de Frases Aportadas por Usuarios
            </h2>
            <p className="text-xs fabro-muted mt-0.5">
              Compartí una frase motivadora, de estudio o serenidad; votá tus favoritas o fijala como frase del día.
            </p>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(['Todas', ...QUOTE_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setQuoteFilter(cat)}
                className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  quoteFilter === cat
                    ? 'fabro-accent-border fabro-accent-soft fabro-accent-text font-bold'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Contribute a Quote Form */}
        <form
          onSubmit={handleCreateQuote}
          className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-3 text-xs"
        >
          <textarea
            rows={2}
            value={newQuoteText}
            onChange={(e) => setNewQuoteText(e.target.value)}
            placeholder="Escribí una frase propia o de algún autor para inspirar a la comunidad FABRO..."
            className="w-full rounded-xl border fabro-border fabro-surface p-3 fabro-input"
          />
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              value={newQuoteAuthor}
              onChange={(e) => setNewQuoteAuthor(e.target.value)}
              placeholder="Tu nombre o autor"
              className="sm:col-span-4 min-h-[42px] rounded-xl border fabro-border fabro-surface px-3 py-2 fabro-input"
            />
            <select
              value={newQuoteCategory}
              onChange={(e) => setNewQuoteCategory(e.target.value as QuoteCategory)}
              aria-label="Categoría de la frase"
              className="sm:col-span-4 min-h-[42px] rounded-xl border fabro-border fabro-surface px-3 py-2 fabro-input"
            >
              {QUOTE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="sm:col-span-4 min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#EC4899] bg-[#EC4899] hover:bg-[#DB2777] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Aportar frase
            </button>
          </div>
          {quoteStatus && (
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold">{quoteStatus}</p>
          )}
        </form>

        {/* Quotes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotes.map((q) => {
            const isDaily = profile.dailyPhrase === q.text;
            const waText = encodeURIComponent(`«${q.text}» — ${q.author} · Compartido desde 🍀 FABRO`);
            return (
              <article
                key={q.id}
                className="rounded-xl border fabro-border fabro-surface-elevated p-4 flex flex-col justify-between gap-3 text-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] fabro-muted">
                    <span className="font-bold text-[var(--fabro-text)]">{q.category}</span>
                    <span>
                      {q.author} · {q.createdAt}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">«{q.text}»</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => likeUserQuote(q.id)}
                      className={`min-h-[36px] inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold cursor-pointer active:scale-95 ${
                        q.likedByMe
                          ? 'border-[#EC4899]/50 bg-[#EC4899]/10 text-[#EC4899]'
                          : 'fabro-border fabro-surface fabro-muted'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${q.likedByMe ? 'fill-current' : ''}`} />
                      <span className="font-mono tabular-nums">{q.likes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyQuote(q.id, q.text, q.author)}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface px-2.5 py-1 font-semibold cursor-pointer"
                    >
                      {copiedId === q.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedId === q.id ? 'Copiada' : 'Copiar'}
                    </button>

                    <a
                      href={`https://wa.me/?text=${waText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border fabro-border fabro-surface px-2.5 py-1 font-semibold"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#10B981]" />
                      WhatsApp
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateProfile({ dailyPhrase: q.text })}
                      className={`min-h-[36px] rounded-lg border px-2.5 py-1 font-bold cursor-pointer ${
                        isDaily
                          ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'fabro-border fabro-surface'
                      }`}
                    >
                      {isDaily ? 'Frase activa' : 'Fijar hoy'}
                    </button>
                    {q.id.startsWith('uq-') && !['uq-1', 'uq-2', 'uq-3', 'uq-4'].includes(q.id) && (
                      <button
                        type="button"
                        onClick={() => deleteUserQuote(q.id)}
                        aria-label="Eliminar frase"
                        className="min-h-[36px] min-w-[36px] rounded-lg border fabro-border fabro-surface flex items-center justify-center text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
