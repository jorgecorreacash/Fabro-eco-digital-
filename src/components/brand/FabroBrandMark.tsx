import React, { useId } from 'react';

interface FabroBrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showIdentity?: boolean;
  className?: string;
}

const CloverSvg: React.FC<{ px: number; uid: string; side: 'left' | 'right' }> = ({
  px,
  uid,
  side,
}) => (
  <svg
    width={px}
    height={px}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`shrink-0 transition-all duration-200 ease-out group-hover:scale-110 group-active:scale-110 ${
      side === 'left'
        ? 'group-hover:-rotate-12 group-active:-rotate-12'
        : 'group-hover:rotate-12 group-active:rotate-12'
    } group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.72)] group-active:drop-shadow-[0_0_8px_rgba(245,158,11,0.78)]`}
  >
    <defs>
      <linearGradient id={uid} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="55%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <g transform="translate(18 17)">
      <path d="M-0.7,-1 C-3.2,-10 -11.5,-9 -10,-2.4 C-12,-1.2 -8.8,3.6 -1,0.4 Z" fill={`url(#${uid})`} />
      <path d="M0.7,-1 C3.2,-10 11.5,-9 10,-2.4 C12,-1.2 8.8,3.6 1,0.4 Z" fill={`url(#${uid})`} />
      <path d="M-1,0.8 C-9.2,2 -10.8,10 -3.6,9.5 C-2,11.5 2,7.6 -0.2,1.2 Z" fill={`url(#${uid})`} />
      <path d="M1,0.8 C9.2,2 10.8,10 3.6,9.5 C2,11.5 -2,7.6 0.2,1.2 Z" fill={`url(#${uid})`} />
      <path d="M0.2,2.4 C1,8.8 3.2,12.8 6.4,15" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      <circle cx="0" cy="0.2" r="1.9" fill="#F59E0B" />
    </g>
  </svg>
);

/**
 * Logo oficial 🍀 FABRO 🍀 con degradado metálico/luminoso según el tema,
 * efecto shimmer continuo y animación interactiva en ambos tréboles de 4 hojas.
 */
export const FabroBrandMark: React.FC<FabroBrandMarkProps> = ({
  size = 'md',
  showIdentity = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const cloverPx = size === 'lg' ? 28 : size === 'sm' ? 18 : 22;
  const textClass =
    size === 'lg'
      ? 'text-2xl sm:text-3xl tracking-tight'
      : size === 'sm'
      ? 'text-base tracking-tight'
      : 'text-xl tracking-tight';

  const wordmark = (
    <span
      className={`group inline-flex items-center gap-1.5 select-none whitespace-nowrap shrink-0 transition-transform duration-200 active:scale-95 ${className}`}
      aria-label="FABRO — Ecosistema Digital"
    >
      <CloverSvg px={cloverPx} uid={`${uid}-left`} side="left" />
      <span className={`font-display font-extrabold fabro-logo-text ${textClass}`}>
        FABRO
      </span>
      <CloverSvg px={cloverPx} uid={`${uid}-right`} side="right" />
    </span>
  );

  if (!showIdentity) return wordmark;

  return (
    <span className="group inline-flex flex-col items-start gap-0.5 select-none">
      {wordmark}
      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase fabro-muted pl-1">
        Ecosistema Digital
      </span>
    </span>
  );
};
