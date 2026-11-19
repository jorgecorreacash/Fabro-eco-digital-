import React from 'react';

export interface SimpleBarDatum {
  label: string;
  value: number;
  unit?: string;
  secondary?: string;
}

interface WellnessBarChartProps {
  title: string;
  subtitle?: string;
  data: SimpleBarDatum[];
  accentColor?: string;
  unit?: string;
  emptyMessage?: string;
  goalValue?: number;
}

export const WellnessBarChart: React.FC<WellnessBarChartProps> = ({
  title,
  subtitle,
  data,
  accentColor = '#059669',
  unit = '',
  emptyMessage = 'Aún no hay registros suficientes para graficar en este período.',
  goalValue,
}) => {
  const hasAnyPositive = data.some((d) => d.value > 0);
  const maxVal = Math.max(
    1,
    goalValue || 0,
    ...data.map((d) => d.value)
  );

  return (
    <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {subtitle && <p className="text-xs fabro-muted">{subtitle}</p>}
        </div>
        {goalValue && goalValue > 0 && (
          <span className="text-[11px] font-mono tabular-nums fabro-muted">
            Meta: {goalValue}
            {unit ? ` ${unit}` : ''}
          </span>
        )}
      </div>

      {!hasAnyPositive ? (
        <div className="rounded-xl border border-dashed fabro-border py-8 px-4 text-center text-xs fabro-muted">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-2 items-end h-36 pt-4" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
            {data.map((d) => {
              const heightPct = Math.max(4, Math.round((d.value / maxVal) * 100));
              return (
                <div key={d.label} className="flex flex-col items-center justify-end h-full gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono tabular-nums fabro-muted truncate max-w-full">
                    {d.value > 0 ? `${d.value}${unit ? '' : ''}` : '0'}
                  </span>
                  <div className="w-full max-w-[32px] flex-1 flex items-end justify-center">
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${d.value > 0 ? heightPct : 3}%`,
                        backgroundColor: d.value > 0 ? accentColor : 'var(--fabro-border)',
                        opacity: d.value > 0 ? 0.9 : 0.45,
                      }}
                      title={`${d.label}: ${d.value}${unit ? ` ${unit}` : ''}${d.secondary ? ` (${d.secondary})` : ''}`}
                    />
                  </div>
                  <span className="text-[10px] fabro-muted truncate max-w-full">{d.label}</span>
                </div>
              );
            })}
          </div>
          {unit && (
            <p className="text-[11px] font-mono tabular-nums fabro-muted text-right">
              Unidad: {unit} · Datos reales registrados
            </p>
          )}
        </div>
      )}
    </div>
  );
};

interface WellnessLineChartProps {
  title: string;
  subtitle?: string;
  points: Array<{ label: string; value: number }>;
  accentColor?: string;
  unit?: string;
  emptyMessage?: string;
}

export const WellnessLineChart: React.FC<WellnessLineChartProps> = ({
  title,
  subtitle,
  points,
  accentColor = '#0284C7',
  unit = '',
  emptyMessage = 'Cargá al menos 2 registros para visualizar tu evolución.',
}) => {
  if (points.length < 2) {
    return (
      <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {subtitle && <p className="text-xs fabro-muted">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-dashed fabro-border py-7 px-4 text-center text-xs fabro-muted">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const vals = points.map((p) => p.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const span = Math.max(0.1, maxVal - minVal);
  const width = 420;
  const height = 128;
  const padX = 24;
  const padY = 18;

  const coords = points.map((p, idx) => {
    const x = padX + (idx / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((p.value - minVal) / span) * (height - padY * 2);
    return { x, y, ...p };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {subtitle && <p className="text-xs fabro-muted">{subtitle}</p>}
        </div>
        <span className="text-[11px] font-mono tabular-nums fabro-muted">
          Min {minVal}
          {unit} · Max {maxVal}
          {unit}
        </span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="currentColor"
            strokeOpacity={0.14}
            strokeWidth={1}
          />
          <polyline
            fill="none"
            stroke={accentColor}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />
          {coords.map((c) => (
            <g key={`${c.label}-${c.x}`}>
              <circle cx={c.x} cy={c.y} r={3.5} fill={accentColor} />
            </g>
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums fabro-muted">
        <span>{points[0].label}</span>
        <span>
          Último: {points[points.length - 1].value}
          {unit ? ` ${unit}` : ''}
        </span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
};
