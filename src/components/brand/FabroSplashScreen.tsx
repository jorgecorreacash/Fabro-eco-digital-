import React, { useEffect, useState } from 'react';
import { FabroBrandMark } from './FabroBrandMark';

interface FabroSplashScreenProps {
  durationMs?: number;
}

export const FabroSplashScreen: React.FC<FabroSplashScreenProps> = ({
  durationMs = 1200,
}) => {
  const [phase, setPhase] = useState<'visible' | 'exiting' | 'done'>('visible');

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const holdMs = prefersReduced ? 350 : durationMs;

    const exitTimer = window.setTimeout(() => {
      setPhase('exiting');
    }, holdMs);

    const removeTimer = window.setTimeout(() => {
      setPhase('done');
    }, holdMs + 280);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, [durationMs]);

  if (phase === 'done') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Iniciando FABRO — Ecosistema Digital"
      onClick={() => setPhase('exiting')}
      className={`fixed inset-0 z-[100] flex items-center justify-center px-6 transition-opacity duration-300 ${
        phase === 'exiting' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(circle at 50% 38%, #162447 0%, #0B1120 55%, #060913 100%)',
      }}
    >
      {/* Subtle gold & emerald ambient halos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-72 h-72 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(245,158,11,0.45) 0%, rgba(16,185,129,0.22) 55%, transparent 75%)',
        }}
      />

      <div className="relative w-full max-w-sm rounded-3xl border border-[#D4AF37]/35 bg-[#0F172A]/80 backdrop-blur-xl px-7 py-9 text-center space-y-6 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)]">
        {/* Centered official animated 🍀 FABRO 🍀 mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="fabro-splash-clovers">
            <FabroBrandMark size="lg" />
          </div>
          <p className="text-[11px] font-semibold tracking-[0.26em] uppercase text-slate-300">
            Ecosistema Digital
          </p>
        </div>

        {/* Minimalist animated loading bar */}
        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden border border-[#D4AF37]/25">
            <div
              className="h-full rounded-full fabro-splash-bar"
              style={{
                background:
                  'linear-gradient(90deg, #10B981 0%, #FDE047 50%, #38BDF8 100%)',
                animationDuration: `${durationMs}ms`,
              }}
            />
          </div>
          <p className="text-[11px] font-medium text-slate-400">
            Inicializando bóveda local y módulos...
          </p>
        </div>
      </div>
    </div>
  );
};
