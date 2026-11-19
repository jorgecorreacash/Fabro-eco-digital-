import React, { useEffect, useRef, useState } from 'react';
import { Check, Inbox, Plus, Sparkles, X } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';

export const InboxQuickCaptureModal: React.FC = () => {
  const {
    quickCaptureOpen,
    setQuickCaptureOpen,
    inboxItems,
    addInboxCapture,
    navigateTo,
    setOrganizerActiveTab,
  } = useEcosystem();

  const [text, setText] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!quickCaptureOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuickCaptureOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [quickCaptureOpen, setQuickCaptureOpen]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    addInboxCapture(clean);
    setText('');
    setSavedFeedback(true);
    window.setTimeout(() => {
      setSavedFeedback(false);
      setQuickCaptureOpen(false);
    }, 520);
  };

  const openInboxView = () => {
    setQuickCaptureOpen(false);
    setOrganizerActiveTab('inbox');
    navigateTo('bienestar', 'organizador-integral');
  };

  return (
    <>
      {/* Thumb-friendly Floating + Captura Rápida Button (Mobile & Desktop) */}
      <button
        type="button"
        onClick={() => setQuickCaptureOpen(true)}
        aria-label="Abrir captura rápida mental"
        className="no-print fixed bottom-[124px] left-2.5 lg:bottom-4 lg:left-[256px] z-40 min-h-[42px] md:min-h-[38px] inline-flex items-center gap-2 rounded-xl border border-[#0EA5E9] bg-[var(--fabro-surface)] text-[#0284C7] dark:text-[#38BDF8] px-3.5 py-1.5 text-sm font-medium shadow-[0_8px_20px_-6px_rgba(14,165,233,0.42)] cursor-pointer hover:-translate-y-0.5 active:scale-95 transition-all duration-200 whitespace-nowrap"
      >
        <span className="w-6 h-6 rounded-lg bg-[#0EA5E9] text-white flex items-center justify-center shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </span>
        <span>Captura Rápida</span>
        {inboxItems.length > 0 && (
          <span className="rounded-lg border border-[#0EA5E9]/45 bg-[#0EA5E9]/12 px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
            {inboxItems.length}
          </span>
        )}
      </button>

      {/* Ultra-Fast Capture Modal (<3s capture, no folder/date required) */}
      {quickCaptureOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuickCaptureOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Captura mental rápida FABRO"
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border-2 border-[#0EA5E9] fabro-surface p-5 sm:p-6 space-y-4 shadow-2xl fabro-screen-enter"
          >
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7] dark:text-[#38BDF8] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Bandeja de Entrada Rápida
                </p>
                <h2 className="font-display text-lg font-bold">
                  Capturá una idea o pendiente en segundos
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQuickCaptureOpen(false)}
                aria-label="Cerrar captura rápida"
                className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ej: Repasar unidad 4, link de bibliografía, comprar cuaderno..."
                aria-label="Texto de captura rápida"
                className="min-h-[48px] w-full rounded-xl border-2 border-[#0EA5E9]/45 fabro-surface-elevated px-3.5 py-2.5 text-sm fabro-input"
              />

              <p className="text-[11px] fabro-muted">
                Sin carpetas ni fechas obligatorias ahora: después lo convertís en tarea, bloque horario o apunte de estudio.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={openInboxView}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
                >
                  <Inbox className="w-4 h-4 text-[#0EA5E9]" />
                  Ver Bandeja ({inboxItems.length})
                </button>

                <button
                  type="submit"
                  disabled={!text.trim() || savedFeedback}
                  className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#0EA5E9] bg-[#0EA5E9] text-white px-5 py-2 text-xs font-bold shadow-[0_8px_18px_-6px_rgba(14,165,233,0.5)] disabled:opacity-55 cursor-pointer active:scale-95"
                >
                  {savedFeedback ? (
                    <>
                      <Check className="w-4 h-4" />
                      Guardado en Inbox
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Guardar al instante
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
