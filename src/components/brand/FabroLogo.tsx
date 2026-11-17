import React, { useId } from 'react';
import { useFabro } from '../../context/FabroContext';
import { THEME_TEMPLATES } from '../../types/fabro';

interface FabroLogoProps {
  size?: number;
  showWordmark?: boolean;
  variant?: 'auto' | 'dark' | 'light';
  className?: string;
}

/**
 * Logo principal de FABRO con el trébol de cuatro hojas (🍀) integrado
 * junto a la tipografía geométrica 3D FABRO, adaptable a las plantillas visuales.
 */
export const FabroLogo: React.FC<FabroLogoProps> = ({
  size = 36,
  showWordmark = true,
  variant = 'auto',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  let templateAccent = '#8B5CF6';
  let templateSecondary = '#E5B842';
  try {
    // Safe read when rendered inside FabroProvider
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useFabro();
    const meta = THEME_TEMPLATES.find((t) => t.id === ctx.colorTemplate);
    if (meta) {
      templateAccent = meta.accentHex;
      templateSecondary = meta.secondaryHex;
    }
  } catch {
    // fallback if rendered outside provider
  }

  const height = Math.max(24, Math.round(size * 0.96));
  const width = showWordmark ? Math.round(height * 4.35) : height;

  const depthFill =
    variant === 'dark'
      ? '#0E3A66'
      : variant === 'light'
      ? '#BAE6FD'
      : undefined;

  const outlineStroke =
    variant === 'dark'
      ? 'rgba(226, 232, 240, 0.35)'
      : variant === 'light'
      ? 'rgba(15, 23, 42, 0.22)'
      : 'rgba(148, 163, 184, 0.35)';

  if (!showWordmark) {
    return (
      <div className={`inline-flex items-center select-none shrink-0 ${className}`}>
        <svg
          width={height}
          height={height}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Trébol FABRO"
          className="shrink-0"
        >
          <defs>
            <linearGradient id={`${uid}-clv`} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="65%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="22" fill={templateAccent} fillOpacity="0.14" stroke={templateSecondary} strokeOpacity="0.45" strokeWidth="1.5" />
          <g transform="translate(24 22.5)">
            <path d="M-1,-2 C-9,-14 -16,-7 -11,-1 C-16,-1 -14,10 -2,3 Z" fill={`url(#${uid}-clv)`} />
            <path d="M1,-2 C9,-14 16,-7 11,-1 C16,-1 14,10 2,3 Z" fill={`url(#${uid}-clv)`} />
            <path d="M-1,2 C-12,5 -9,16 -1,12 C-4,18 6,16 1,3 Z" fill={`url(#${uid}-clv)`} />
            <path d="M1,2 C12,5 9,16 1,12 C4,18 -6,16 -1,3 Z" fill={`url(#${uid}-clv)`} />
            <path d="M0,4 C1,12 4,17 7,20" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <circle cx="0" cy="0.5" r="2" fill="#FDE68A" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center select-none shrink-0 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 222 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="FABRO Trébol de cuatro hojas"
        className="shrink-0 drop-shadow-[0_3px_10px_rgba(16,185,129,0.18)]"
      >
        <defs>
          <linearGradient id={`${uid}-clover-main`} x1="4" y1="6" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={`${uid}-clover-gold`} x1="10" y1="8" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id={`${uid}-face`} x1="44" y1="6" x2="214" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={templateSecondary} />
            <stop offset="52%" stopColor={templateAccent} />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id={`${uid}-shine`} x1="46" y1="6" x2="214" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="55%" stopColor={templateSecondary} stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={`${uid}-bar`} x1="44" y1="44" x2="214" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor={templateSecondary} />
            <stop offset="100%" stopColor={templateAccent} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Four-leaf Clover Emblem */}
        <g transform="translate(21 23)">
          {/* Soft halo */}
          <circle cx="0" cy="0" r="18.5" fill={templateAccent} fillOpacity="0.12" stroke="#10B981" strokeOpacity="0.35" strokeWidth="1" />
          {/* Top-Left Leaf */}
          <path
            d="M-0.8,-1.2 C-4,-13 -14.5,-11.5 -12.5,-3 C-15,-1.5 -11,4.5 -1.2,0.5 Z"
            fill={`url(#${uid}-clover-main)`}
            stroke="#ECFDF5"
            strokeOpacity="0.45"
            strokeWidth="0.6"
          />
          {/* Top-Right Leaf */}
          <path
            d="M0.8,-1.2 C4,-13 14.5,-11.5 12.5,-3 C15,-1.5 11,4.5 1.2,0.5 Z"
            fill={`url(#${uid}-clover-main)`}
            stroke="#ECFDF5"
            strokeOpacity="0.45"
            strokeWidth="0.6"
          />
          {/* Bottom-Left Leaf */}
          <path
            d="M-1.2,1 C-11.5,2.5 -13.5,12.5 -4.5,12 C-2.5,14.5 2.5,9.5 -0.2,1.5 Z"
            fill={`url(#${uid}-clover-main)`}
            stroke="#ECFDF5"
            strokeOpacity="0.45"
            strokeWidth="0.6"
          />
          {/* Bottom-Right Leaf */}
          <path
            d="M1.2,1 C11.5,2.5 13.5,12.5 4.5,12 C2.5,14.5 -2.5,9.5 0.2,1.5 Z"
            fill={`url(#${uid}-clover-main)`}
            stroke="#ECFDF5"
            strokeOpacity="0.45"
            strokeWidth="0.6"
          />
          {/* Stem */}
          <path
            d="M0.2,3 C1.2,11 4.2,16.2 8.2,19.2"
            stroke="#10B981"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          {/* Lucky Golden Center Dewdrop */}
          <circle cx="0" cy="0.2" r="2.2" fill={`url(#${uid}-clover-gold)`} />
        </g>

        {/* 3D Extruded Depth Layer */}
        <text
          x="47.5"
          y="36"
          fill={depthFill || 'currentColor'}
          className={depthFill ? '' : 'text-slate-300 dark:text-[#0B2239]'}
          fontFamily="Outfit, 'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize="35"
          fontWeight="800"
          letterSpacing="3.2"
        >
          FABRO
        </text>

        {/* Front Luminous Gradient Wordmark */}
        <text
          x="45"
          y="33.5"
          fill={`url(#${uid}-face)`}
          stroke={outlineStroke}
          strokeWidth="0.7"
          fontFamily="Outfit, 'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize="35"
          fontWeight="800"
          letterSpacing="3.2"
        >
          FABRO
        </text>

        {/* Subtle Specular Edge Highlight */}
        <text
          x="45"
          y="33.5"
          fill="none"
          stroke={`url(#${uid}-shine)`}
          strokeWidth="0.55"
          fontFamily="Outfit, 'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize="35"
          fontWeight="800"
          letterSpacing="3.2"
        >
          FABRO
        </text>

        {/* Precision Geometric Accent Bar */}
        <rect x="46" y="42.5" width="166" height="2.6" rx="1.3" fill={`url(#${uid}-bar)`} />
      </svg>
    </div>
  );
};
