import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { SocialProfileView } from './SocialProfileView';

export const SocialProfileModal: React.FC = () => {
  const { socialProfileModalOpen, socialProfileModalTab, closeSocialProfileModal } = useEcosystem();

  useEffect(() => {
    if (!socialProfileModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSocialProfileModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSocialProfileModal, socialProfileModalOpen]);

  if (!socialProfileModalOpen) return null;

  return (
    <div
      className="no-print fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSocialProfileModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mi Perfil Social FABRO"
        className="w-full sm:max-w-4xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border fabro-border fabro-bg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b fabro-border fabro-surface px-5 py-3 shrink-0">
          <p className="font-display text-sm font-bold">Mi Perfil Social · FABRO ID</p>
          <button
            type="button"
            onClick={closeSocialProfileModal}
            aria-label="Cerrar Mi Perfil Social"
            className="min-h-[40px] min-w-[40px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <SocialProfileView
            initialTab={socialProfileModalTab}
            inModal
            onCloseModal={closeSocialProfileModal}
          />
        </div>
      </div>
    </div>
  );
};
