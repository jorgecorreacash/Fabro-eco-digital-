import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flag, Lock, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useEcosystem } from '../../context/EcosystemContext';
import { submitModerationReport } from '../../services/adminService';
import { REPORT_REASONS, type ReportReasonId } from '../../types/admin';

const TARGET_LABELS: Record<string, string> = {
  usuario: 'Usuario',
  publicacion: 'Publicación',
  comentario: 'Comentario',
  contenido_cultural: 'Contenido cultural',
  perfil: 'Perfil',
  mensaje: 'Mensaje específico',
  curso: 'Curso',
  grupo: 'Grupo',
  biblioteca: 'Biblioteca',
};

export const ReportContentModal: React.FC = () => {
  const { authUser, openAuthModal } = useEcosystem();
  const { reportModalPayload, closeReportModal } = useAdmin();

  const [reason, setReason] = useState<ReportReasonId>('acoso');
  const [details, setDetails] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!reportModalPayload) return null;

  const handleClose = () => {
    setSubmittedId(null);
    setError(null);
    setDetails('');
    setEvidenceNote('');
    setReason('acoso');
    closeReportModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      openAuthModal('login');
      return;
    }
    if (details.trim().length < 6) {
      setError('Describí brevemente lo ocurrido (mínimo 6 caracteres) para ayudar a moderación.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const selectedReason = REPORT_REASONS.find((r) => r.id === reason)?.label || reason;
      const id = await submitModerationReport({
        reporterUid: authUser.uid,
        reporterName: authUser.displayName || authUser.username || 'Usuario FABRO',
        targetType: reportModalPayload.targetType,
        targetId: reportModalPayload.targetId,
        targetAuthorUid: reportModalPayload.targetAuthorUid,
        targetAuthorName: reportModalPayload.targetAuthorName,
        targetSummary: reportModalPayload.targetSummary,
        sector: reportModalPayload.sector || 'general',
        reason: selectedReason,
        details: details.trim(),
        evidenceNote: evidenceNote.trim() || undefined,
      });
      setSubmittedId(id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos registrar la denuncia en este momento. Verificá tu conexión.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Denunciar contenido o conducta"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Flag className="h-4 w-4 text-rose-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Denunciar {TARGET_LABELS[reportModalPayload.targetType] || 'contenido'}
              </h2>
              <p className="text-xs text-slate-500">
                Revisión humana confidencial · Sin sanciones automáticas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submittedId ? (
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-emerald-900">Denuncia enviada correctamente</p>
                <p className="text-emerald-800">
                  El equipo de moderación revisará el caso de forma humana y confidencial. Tu
                  identidad no será compartida con la persona denunciada.
                </p>
                <p className="font-mono text-xs text-emerald-700">Referencia: {submittedId}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            {!authUser && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  Necesitás iniciar sesión con tu cuenta FABRO para enviar una denuncia verificable.
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Elemento reportado · Sector {reportModalPayload.sector || 'general'}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-800">
                {reportModalPayload.targetSummary || 'Elemento seleccionado'}
              </p>
              {reportModalPayload.targetAuthorName && (
                <p className="mt-1 text-xs text-slate-500">
                  Autor: {reportModalPayload.targetAuthorName}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Motivo principal
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReasonId)}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {REPORT_REASONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Descripción detallada *
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Explicá qué sucedió y por qué considerás que infringe las normas de convivencia..."
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Contexto o referencia adicional (opcional)
              </label>
              <input
                type="text"
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
                placeholder="Ej. fecha/hora aproximada, contexto del intercambio o cita puntual"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>
                Privacidad protegida: la persona reportada nunca verá quién envió la denuncia. En
                mensajes, solo se envía el mensaje puntual que seleccionaste.
              </span>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-lg bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar denuncia'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
