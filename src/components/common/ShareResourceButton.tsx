import React, { useMemo, useState } from 'react';
import { Check, Copy, Eye, MessageCircle } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { buildWhatsAppShareData } from '../../services/shareCodec';
import type { SharedResourcePayload } from '../../types/ecosystem';

interface ShareResourceButtonProps {
  payload: SharedResourcePayload;
  compact?: boolean;
  label?: string;
}

export const ShareResourceButton: React.FC<ShareResourceButtonProps> = ({
  payload,
  compact = false,
  label = 'Compartir por WhatsApp',
}) => {
  const { openSharedPreview } = useEcosystem();
  const [copied, setCopied] = useState(false);

  const { shareUrl, whatsappHref } = useMemo(
    () => buildWhatsAppShareData(payload),
    [payload]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(16,185,129,0.55)] cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
      >
        <MessageCircle className="w-4 h-4" />
        <span>{label}</span>
      </a>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#06B6D4] bg-[#06B6D4]/10 text-[#0E7490] dark:text-[#22D3EE] px-3.5 py-2 text-xs font-bold cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        <span>{copied ? 'Enlace copiado' : compact ? 'Copiar' : 'Copiar enlace'}</span>
      </button>

      {!compact && (
        <button
          type="button"
          onClick={() => openSharedPreview(payload)}
          title="Abrir vista de invitado exactamente como lo verá quien reciba el enlace"
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-semibold cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
        >
          <Eye className="w-4 h-4 text-[#2563EB] dark:text-[#38BDF8]" />
          <span>Vista invitado</span>
        </button>
      )}
    </div>
  );
};
