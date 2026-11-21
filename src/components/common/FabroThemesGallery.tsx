import React from 'react';
import { Check, Monitor, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { FABRO_THEMES } from '../../data/ecosystemCatalog';
import type { GlowIntensity } from '../../types/ecosystem';

interface FabroThemesGalleryProps {
  compact?: boolean;
}

const GLOW_OPTIONS: Array<{ id: GlowIntensity; label: string; hint: string }> = [
  { id: 'low', label: 'Sutil', hint: 'Bordes limpios y mínimo brillo' },
  { id: 'medium', label: 'Equilibrado', hint: 'Profundidad y luz tecnológica' },
  { id: 'high', label: 'Intenso', hint: 'Destellos futuristas marcados' },
];

export const FabroThemesGallery: React.FC<FabroThemesGalleryProps> = ({ compact = false }) => {
  const {
    theme,
    setTheme,
    glowIntensity,
    setGlowIntensity,
    themeAutoSystem,
    setThemeAutoSystem,
  } = useEcosystem();

  const activeMeta = FABRO_THEMES.find((t) => t.id === theme) || FABRO_THEMES[0];

  return (
    <section
      aria-label="Galería TEMAS FABRO"
      className="rounded-2xl border fabro-futuristic-panel p-5 sm:p-6 space-y-5"
    >
      {/* Header + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl fabro-accent-bg flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-lg font-extrabold tracking-tight">
                TEMAS FABRO
              </h2>
              <p className="text-xs fabro-muted">
                10 plantillas completas que transforman botones, tarjetas, bordes, iconos y luces al instante.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setThemeAutoSystem(!themeAutoSystem)}
            aria-pressed={themeAutoSystem}
            className={`min-h-[40px] rounded-xl border px-3.5 py-2 text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all ${
              themeAutoSystem
                ? 'fabro-accent-border fabro-accent-bg'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 shrink-0" />
            <span>Automático según sistema</span>
            <span className="text-[10px] font-mono opacity-90">
              {themeAutoSystem ? 'ON' : 'OFF'}
            </span>
          </button>

          <div
            role="group"
            aria-label="Intensidad de brillo"
            className="inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated p-1"
          >
            <span className="px-2 text-[11px] font-semibold fabro-muted inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 fabro-accent-text" />
              Brillo:
            </span>
            {GLOW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.hint}
                onClick={() => setGlowIntensity(opt.id)}
                className={`min-h-[32px] rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                  glowIntensity === opt.id
                    ? 'fabro-accent-bg'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Theme Summary Bar */}
      <div className="rounded-xl border fabro-border fabro-surface-elevated px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-9 h-9 rounded-lg border border-white/20 shrink-0"
            style={{ background: activeMeta.gradientCss }}
          />
          <div className="min-w-0">
            <p className="font-bold truncate">
              Tema activo:{' '}
              <span className="fabro-accent-text">
                {themeAutoSystem ? 'Automático (Sistema)' : activeMeta.name}
              </span>
            </p>
            <p className="text-[11px] fabro-muted truncate">{activeMeta.description}</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold fabro-muted inline-flex items-center gap-1.5">
          {activeMeta.isDark ? (
            <>
              <Moon className="w-3.5 h-3.5" /> Modo oscuro
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5" /> Modo claro
            </>
          )}
        </span>
      </div>

      {/* 10 Visual Template Preview Cards */}
      <div
        className={`grid gap-3 ${
          compact
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        }`}
      >
        {FABRO_THEMES.map((item) => {
          const isSelected = !themeAutoSystem && theme === item.id;
          const [bgHex, surfaceHex, accentHex, accent2Hex] = item.swatches;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              aria-pressed={isSelected}
              className={`group rounded-2xl border p-3 text-left flex flex-col justify-between gap-2.5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-[var(--fabro-accent)] ring-2 ring-[var(--fabro-accent)]/40 fabro-surface'
                  : 'fabro-border fabro-surface hover:border-[var(--fabro-accent)]'
              }`}
            >
              {/* Mini UI Preview Canvas */}
              <div
                className="w-full h-24 rounded-xl border p-2.5 flex flex-col justify-between overflow-hidden relative"
                style={{
                  backgroundColor: bgHex,
                  borderColor: `${accentHex}55`,
                  boxShadow: isSelected ? `0 0 18px -4px ${accentHex}66` : undefined,
                }}
              >
                <div
                  className="absolute -right-6 -top-6 w-16 h-16 rounded-full opacity-35 blur-md pointer-events-none"
                  style={{ background: accentHex }}
                />
                {/* Mini top bar */}
                <div className="flex items-center justify-between gap-1.5 relative z-10">
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: accentHex }}
                    />
                    <span
                      className="w-8 h-1.5 rounded-full opacity-75"
                      style={{ backgroundColor: item.isDark ? '#E2E8F0' : '#0F172A' }}
                    />
                  </div>
                  <span
                    className="w-4 h-2 rounded-sm"
                    style={{ backgroundColor: accent2Hex }}
                  />
                </div>

                {/* Mini cards + primary button */}
                <div className="grid grid-cols-3 gap-1.5 relative z-10">
                  <div
                    className="col-span-2 h-9 rounded-lg border p-1.5 flex flex-col justify-between"
                    style={{
                      backgroundColor: surfaceHex,
                      borderColor: `${accentHex}38`,
                    }}
                  >
                    <span
                      className="w-10 h-1.5 rounded-full opacity-80"
                      style={{ backgroundColor: item.isDark ? '#F8FAFC' : '#0F172A' }}
                    />
                    <span
                      className="w-14 h-1 rounded-full opacity-45"
                      style={{ backgroundColor: item.isDark ? '#CBD5E1' : '#475569' }}
                    />
                  </div>
                  <div
                    className="h-9 rounded-lg flex items-center justify-center"
                    style={{ background: item.gradientCss }}
                  >
                    <span className="w-3 h-1.5 rounded-full bg-white/90" />
                  </div>
                </div>
              </div>

              {/* Theme Name & Swatches */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-display text-xs font-extrabold truncate">
                    {item.name}
                  </span>
                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full fabro-accent-bg flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="text-[10px] fabro-muted shrink-0">
                      {item.isDark ? 'Oscuro' : 'Claro'}
                    </span>
                  )}
                </div>
                {!compact && (
                  <p className="text-[11px] fabro-muted line-clamp-2 leading-snug">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-1 pt-0.5">
                  {item.swatches.map((hex, idx) => (
                    <span
                      key={`${item.id}-sw-${idx}`}
                      className="h-2 flex-1 rounded-full border border-white/15"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
