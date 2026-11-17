import React from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { THEME_TEMPLATES, type ThemeTemplateId } from '../../types/fabro';

interface ThemeTemplatePickerProps {
  compact?: boolean;
  onSelect?: (id: ThemeTemplateId) => void;
}

export const ThemeTemplatePicker: React.FC<ThemeTemplatePickerProps> = ({
  compact = false,
  onSelect,
}) => {
  const { colorTemplate, setColorTemplate, theme, setThemeMode } = useFabro();

  const handleChoose = (id: ThemeTemplateId, recommendedMode?: 'dark' | 'light') => {
    setColorTemplate(id);
    if (recommendedMode && id !== 'estandar') {
      setThemeMode(recommendedMode);
    }
    onSelect?.(id);
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
            <Palette className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Plantilla visual</span>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer ${
                theme === 'light'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Sun className="w-3 h-3" />
              Claro
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer ${
                theme === 'dark'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Moon className="w-3 h-3" />
              Oscuro
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {THEME_TEMPLATES.map((tpl) => {
            const active = colorTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleChoose(tpl.id)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                  active
                    ? 'border-sky-500 bg-sky-500/10 text-slate-900 dark:text-white font-semibold'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/40"
                      style={{ backgroundColor: tpl.accentHex }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/40 -ml-1.5"
                      style={{ backgroundColor: theme === 'dark' ? tpl.darkBgHex : tpl.lightBgHex }}
                    />
                  </span>
                  <span className="truncate">{tpl.label}</span>
                </span>
                {active && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Plantillas de colores profesionales
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Elegí entre Ecológico, Gótico, Aura, Floral, Metal, Oro o Estándar, combinable con modo claro u oscuro.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={() => setThemeMode('light')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
              theme === 'light'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            Claro
          </button>
          <button
            type="button"
            onClick={() => setThemeMode('dark')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
              theme === 'dark'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            Oscuro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {THEME_TEMPLATES.map((tpl) => {
          const active = colorTemplate === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleChoose(tpl.id)}
              className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                active
                  ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-500/5'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span
                    className="w-5 h-5 rounded-md border border-black/10 dark:border-white/15"
                    style={{ backgroundColor: tpl.darkBgHex }}
                  />
                  <span
                    className="w-5 h-5 rounded-md border border-black/10 dark:border-white/15"
                    style={{ backgroundColor: tpl.accentHex }}
                  />
                  <span
                    className="w-5 h-5 rounded-md border border-black/10 dark:border-white/15"
                    style={{ backgroundColor: tpl.secondaryHex }}
                  />
                </div>
                {active && (
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div>
                <p className="font-display text-xs font-bold text-slate-900 dark:text-white">
                  {tpl.label}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                  {tpl.tagline}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
