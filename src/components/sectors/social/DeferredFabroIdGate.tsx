import React, { useState } from 'react';
import { Sparkles, UserCheck } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';

interface DeferredFabroIdGateProps {
  actionLabel: string;
  onUnlocked?: () => void;
}

export const DeferredFabroIdGate: React.FC<DeferredFabroIdGateProps> = ({
  actionLabel,
  onUnlocked,
}) => {
  const { profile, updateProfile } = useEcosystem();
  const [nameDraft, setNameDraft] = useState(
    profile.displayName === 'Invitado FABRO' ? '' : profile.displayName
  );
  const [idDraft, setIdDraft] = useState(
    profile.fabroId === 'FBR-INVITADO'
      ? `FBR-${Math.floor(1000 + Math.random() * 9000)}`
      : profile.fabroId
  );

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameDraft.trim() || 'Estudiante FABRO';
    const cleanId = idDraft.trim().toUpperCase() || `FBR-${Math.floor(1000 + Math.random() * 9000)}`;
    updateProfile({
      displayName: cleanName,
      fabroId: cleanId,
      fabroIdConfigured: true,
    });
    onUnlocked?.();
  };

  return (
    <form
      onSubmit={handleConfirm}
      className="rounded-2xl border-2 border-[#7C3AED] bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 p-4 space-y-3 text-xs"
    >
      <div className="flex items-start gap-2.5">
        <UserCheck className="w-5 h-5 text-[#7C3AED] shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm">Activá tu FABRO ID en 10 segundos</p>
          <p className="fabro-muted mt-0.5 leading-relaxed">
            Usaste FABRO sin registro hasta acá. Para <strong>{actionLabel}</strong>, elegí cómo querés figurar:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="Tu nombre o apodo..."
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
        />
        <input
          type="text"
          value={idDraft}
          onChange={(e) => setIdDraft(e.target.value)}
          placeholder="FABRO ID (ej: FBR-2048)"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs font-mono fabro-input"
        />
      </div>

      <button
        type="submit"
        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
      >
        <Sparkles className="w-4 h-4" />
        Crear mi FABRO ID y continuar
      </button>
    </form>
  );
};
