import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import {
  lookupChordDiagrams,
  playChordVoicing,
  type ChordVoicing,
} from '../../services/musicEngine';

interface ChordDiagramSvgProps {
  chordName: string;
  instrument?: 'guitar' | 'bass';
  compact?: boolean;
  voicingOverride?: ChordVoicing;
}

export const ChordDiagramSvg: React.FC<ChordDiagramSvgProps> = ({
  chordName,
  instrument = 'guitar',
  compact = false,
  voicingOverride,
}) => {
  const voicings = React.useMemo(
    () => (voicingOverride ? [voicingOverride] : lookupChordDiagrams(chordName, instrument)),
    [chordName, instrument, voicingOverride]
  );
  const [idx, setIdx] = useState(0);

  React.useEffect(() => {
    setIdx(0);
  }, [chordName, instrument]);

  const active = voicings[idx] || voicings[0];

  if (!active) {
    return (
      <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 text-center text-xs fabro-muted">
        Acorde <span className="font-mono font-bold">{chordName}</span> sin diagrama
      </div>
    );
  }

  const numStrings = active.instrument === 'bass' ? 4 : 6;
  const numFrets = 5;
  const width = compact ? 136 : 168;
  const height = compact ? 156 : 188;
  const padX = compact ? 22 : 28;
  const padTop = compact ? 28 : 34;
  const boardW = width - padX * 2;
  const boardH = height - padTop - 16;
  const stringStep = boardW / (numStrings - 1);
  const fretStep = boardH / numFrets;

  // Determine visible starting fret
  const positiveFrets = active.frets.filter((f) => f > 0);
  const minPositive = positiveFrets.length ? Math.min(...positiveFrets) : 1;
  const maxPositive = positiveFrets.length ? Math.max(...positiveFrets) : 1;
  const startFret = maxPositive <= 5 ? 1 : Math.max(1, active.baseFret || minPositive);

  const stringNames =
    active.instrument === 'bass' ? ['E', 'A', 'D', 'G'] : ['E', 'A', 'D', 'G', 'B', 'e'];

  return (
    <div className="rounded-2xl border fabro-border fabro-surface p-3 flex flex-col items-center gap-2">
      <div className="w-full flex items-center justify-between gap-1.5">
        <div className="min-w-0">
          <p className="font-display text-sm font-extrabold truncate">{active.name}</p>
          {!compact && (
            <p className="text-[10px] fabro-muted truncate">{active.label}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => playChordVoicing(active, true)}
          title={`Escuchar ${active.name}`}
          aria-label={`Escuchar acorde ${active.name}`}
          className="h-8 w-8 rounded-lg border fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)] flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
        >
          <Volume2 className="w-3.5 h-3.5 fabro-accent-text" />
        </button>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`Diagrama de acorde ${active.name} para ${active.instrument === 'bass' ? 'bajo' : 'guitarra'}`}
        className="select-none"
      >
        {/* Nut or base fret marker */}
        {startFret === 1 ? (
          <rect
            x={padX - 1}
            y={padTop - 3}
            width={boardW + 2}
            height={5}
            rx={2}
            fill="currentColor"
            className="text-[var(--fabro-text)]"
          />
        ) : (
          <text
            x={padX - 8}
            y={padTop + fretStep * 0.65}
            textAnchor="end"
            fontSize={compact ? 9 : 10}
            fontWeight={700}
            fill="currentColor"
            className="font-mono text-[var(--fabro-accent-text)]"
          >
            {startFret}fr
          </text>
        )}

        {/* Fret horizontal lines */}
        {Array.from({ length: numFrets + 1 }).map((_, f) => (
          <line
            key={`fret-${f}`}
            x1={padX}
            y1={padTop + f * fretStep}
            x2={padX + boardW}
            y2={padTop + f * fretStep}
            stroke="currentColor"
            strokeOpacity={f === 0 ? 0.65 : 0.28}
            strokeWidth={f === 0 ? 1.5 : 1}
          />
        ))}

        {/* String vertical lines */}
        {Array.from({ length: numStrings }).map((_, s) => (
          <line
            key={`str-${s}`}
            x1={padX + s * stringStep}
            y1={padTop}
            x2={padX + s * stringStep}
            y2={padTop + boardH}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={numStrings === 4 ? 1.9 - s * 0.25 : 1.7 - s * 0.16}
          />
        ))}

        {/* Barre / Cejilla indicator */}
        {active.barre && active.barre.fret >= startFret && active.barre.fret < startFret + numFrets && (
          <rect
            x={padX + active.barre.fromString * stringStep - 7}
            y={padTop + (active.barre.fret - startFret + 0.5) * fretStep - 6.5}
            width={(active.barre.toString - active.barre.fromString) * stringStep + 14}
            height={13}
            rx={6.5}
            fill="var(--fabro-accent)"
            opacity={0.92}
          />
        )}

        {/* Open (O), Muted (X) and Fretted dots */}
        {active.frets.slice(0, numStrings).map((fret, s) => {
          const cx = padX + s * stringStep;
          if (fret < 0) {
            return (
              <text
                key={`x-${s}`}
                x={cx}
                y={padTop - 10}
                textAnchor="middle"
                fontSize={10}
                fontWeight={800}
                fill="#EF4444"
                className="font-mono"
              >
                X
              </text>
            );
          }
          if (fret === 0) {
            return (
              <circle
                key={`o-${s}`}
                cx={cx}
                cy={padTop - 13}
                r={4.2}
                fill="none"
                stroke="#10B981"
                strokeWidth={1.8}
              />
            );
          }

          const relFret = fret - startFret + 1;
          if (relFret < 1 || relFret > numFrets) return null;
          const cy = padTop + (relFret - 0.5) * fretStep;
          const finger = active.fingers[s] || 0;

          return (
            <g key={`dot-${s}`}>
              <circle
                cx={cx}
                cy={cy}
                r={compact ? 6.5 : 7.5}
                fill="var(--fabro-accent)"
                stroke="var(--fabro-surface)"
                strokeWidth={1.2}
              />
              {finger > 0 && (
                <text
                  x={cx}
                  y={cy + 3}
                  textAnchor="middle"
                  fontSize={compact ? 8 : 9}
                  fontWeight={800}
                  fill="#FFFFFF"
                  className="font-mono"
                >
                  {finger}
                </text>
              )}
            </g>
          );
        })}

        {/* String names at bottom */}
        {stringNames.map((label, s) => (
          <text
            key={`lbl-${s}`}
            x={padX + s * stringStep}
            y={height - 3}
            textAnchor="middle"
            fontSize={9}
            fill="currentColor"
            opacity={0.65}
            className="font-mono font-bold"
          >
            {label}
          </text>
        ))}
      </svg>

      {voicings.length > 1 && (
        <div className="w-full flex items-center justify-between gap-1 pt-1 border-t fabro-border text-[11px]">
          <button
            type="button"
            onClick={() => setIdx((prev) => (prev - 1 + voicings.length) % voicings.length)}
            aria-label="Posición anterior"
            className="h-7 w-7 rounded-lg border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[10px] fabro-muted tabular-nums">
            Posición {idx + 1}/{voicings.length}
          </span>
          <button
            type="button"
            onClick={() => setIdx((prev) => (prev + 1) % voicings.length)}
            aria-label="Posición siguiente"
            className="h-7 w-7 rounded-lg border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
