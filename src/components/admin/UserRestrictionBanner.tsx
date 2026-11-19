import React from 'react';
import { AlertTriangle, Scale } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { RESTRICTION_FLAGS_META } from '../../types/admin';

export const UserRestrictionBanner: React.FC = () => {
  const { myRestriction, openParticipationModal } = useAdmin();

  if (!myRestriction) return null;
  if (myRestriction.accountStatus === 'activo' && myRestriction.restrictions.length === 0) {
    return null;
  }

  const isSevere =
    myRestriction.accountStatus === 'suspendido' ||
    myRestriction.accountStatus === 'desactivado' ||
    myRestriction.accountStatus === 'eliminado';

  return (
    <div
      className={`border-b px-4 py-3 text-sm ${
        isSevere
          ? 'border-rose-300 bg-rose-50 text-rose-950'
          : 'border-amber-300 bg-amber-50 text-amber-950'
      }`}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle
            className={`mt-0.5 h-4 w-4 shrink-0 ${isSevere ? 'text-rose-700' : 'text-amber-700'}`}
          />
          <div className="space-y-0.5">
            <p className="font-semibold">
              Estado de cuenta: {myRestriction.accountStatus.toUpperCase()}
              {myRestriction.expiresAtIso
                ? ` · Hasta ${new Date(myRestriction.expiresAtIso).toLocaleDateString('es-AR')}`
                : ''}
            </p>
            <p className="text-xs opacity-90">
              {myRestriction.reason || 'Se aplicó una medida de moderación en tu cuenta.'}
              {myRestriction.restrictions.length > 0 && (
                <>
                  {' · Restricciones: '}
                  {myRestriction.restrictions
                    .map((flag) => RESTRICTION_FLAGS_META[flag]?.label || flag)
                    .join(', ')}
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openParticipationModal('reports-appeals')}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-current/25 bg-white/80 px-3 text-xs font-semibold text-slate-900 hover:bg-white"
        >
          <Scale className="h-3.5 w-3.5" />
          Solicitar revisión / Apelar
        </button>
      </div>
    </div>
  );
};
