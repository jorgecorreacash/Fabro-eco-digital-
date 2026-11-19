import React, { useEffect, useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import { DEFAULT_GRADE_SUBJECTS, vaultGet, vaultSet } from '../../../services/localVault';
import type { GradeAssessment, GradeSubject } from '../../../types/ecosystem';

export const GradeCalculatorTool: React.FC = () => {
  const [subjects, setSubjects] = useState<GradeSubject[]>(DEFAULT_GRADE_SUBJECTS);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_GRADE_SUBJECTS[0].id);

  const [newExamName, setNewExamName] = useState('');
  const [newExamType, setNewExamType] = useState<GradeAssessment['type']>('Parcial');
  const [newExamWeight, setNewExamWeight] = useState(25);
  const [newExamScore, setNewExamScore] = useState('');

  useEffect(() => {
    void vaultGet<GradeSubject[]>('grade_subjects', DEFAULT_GRADE_SUBJECTS).then((loaded) => {
      if (loaded.length > 0) {
        setSubjects(loaded);
        setSelectedId(loaded[0].id);
      }
    });
  }, []);

  const persist = (next: GradeSubject[]) => {
    setSubjects(next);
    void vaultSet('grade_subjects', next);
  };

  const currentSubject = subjects.find((s) => s.id === selectedId) || subjects[0];

  const handleScoreChange = (assessmentId: string, raw: string) => {
    const parsed = raw.trim() === '' ? null : Math.max(0, Math.min(10, Number(raw)));
    const next = subjects.map((sub) =>
      sub.id !== currentSubject.id
        ? sub
        : {
            ...sub,
            assessments: sub.assessments.map((a) =>
              a.id === assessmentId ? { ...a, score: Number.isNaN(parsed) ? null : parsed } : a
            ),
          }
    );
    persist(next);
  };

  const handleAddAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim()) return;
    const score = newExamScore.trim() === '' ? null : Math.max(0, Math.min(10, Number(newExamScore)));
    const entry: GradeAssessment = {
      id: `assess-${Date.now()}`,
      name: newExamName.trim(),
      type: newExamType,
      weight: Math.max(5, Math.min(100, newExamWeight)),
      score: score !== null && Number.isNaN(score) ? null : score,
    };
    const next = subjects.map((sub) =>
      sub.id === currentSubject.id
        ? { ...sub, assessments: [...sub.assessments, entry] }
        : sub
    );
    persist(next);
    setNewExamName('');
    setNewExamScore('');
  };

  // Calculate weighted progress & required remaining score
  const totalWeight = currentSubject.assessments.reduce((acc, a) => acc + a.weight, 0) || 100;
  const completed = currentSubject.assessments.filter((a) => a.score !== null);
  const completedWeight = completed.reduce((acc, a) => acc + a.weight, 0);
  const pendingWeight = Math.max(0, totalWeight - completedWeight);

  const accumulatedWeighted = completed.reduce(
    (acc, a) => acc + (a.score ?? 0) * (a.weight / totalWeight),
    0
  );
  const currentAvg =
    completedWeight > 0
      ? completed.reduce((acc, a) => acc + (a.score ?? 0) * a.weight, 0) / completedWeight
      : 0;

  const neededToPass =
    pendingWeight > 0
      ? ((currentSubject.passTarget - accumulatedWeighted) * totalWeight) / pendingWeight
      : null;
  const neededToPromote =
    pendingWeight > 0
      ? ((currentSubject.promoteTarget - accumulatedWeighted) * totalWeight) / pendingWeight
      : null;

  const formatNeeded = (val: number | null, target: number) => {
    if (val === null) {
      return accumulatedWeighted >= target ? 'Objetivo alcanzado' : 'Sin notas pendientes';
    }
    if (val <= 0) return 'Ya asegurado';
    if (val > 10) return `Requiere ${val.toFixed(2)} (supera 10)`;
    return `Necesitás ${val.toFixed(2)} pts`;
  };

  return (
    <div className="rounded-2xl border-2 border-[#2563EB]/40 fabro-surface p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#2563EB] dark:text-[#38BDF8]" />
            Calculadora de Promedios y Progreso de Materia
          </h2>
          <p className="text-xs fabro-muted mt-0.5">
            Cargá tus notas y calculá al instante cuánto necesitás sacar para aprobar o promocionar.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {subjects.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedId(sub.id)}
              className={`min-h-[44px] px-3.5 rounded-full border-2 text-xs font-bold cursor-pointer active:scale-95 ${
                currentSubject.id === sub.id
                  ? 'border-[#2563EB] bg-[#2563EB] text-white'
                  : 'fabro-border fabro-surface-elevated'
              }`}
            >
              {sub.subject}
            </button>
          ))}
        </div>
      </div>

      {/* Live Calculations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border-2 border-[#2563EB]/30 fabro-surface-elevated p-4">
          <p className="fabro-muted font-semibold">Promedio actual</p>
          <p className="font-mono text-2xl font-extrabold tabular-nums text-[#2563EB] dark:text-[#60A5FA] mt-1">
            {currentAvg.toFixed(2)}
          </p>
          <p className="text-[11px] fabro-muted mt-0.5 tabular-nums">
            {completedWeight}/{totalWeight}% evaluado
          </p>
        </div>

        <div className="rounded-xl border-2 border-[#10B981]/30 fabro-surface-elevated p-4">
          <p className="fabro-muted font-semibold">
            Para aprobar ({currentSubject.passTarget.toFixed(1)})
          </p>
          <p className="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
            {formatNeeded(neededToPass, currentSubject.passTarget)}
          </p>
        </div>

        <div className="rounded-xl border-2 border-[#F59E0B]/40 fabro-surface-elevated p-4">
          <p className="fabro-muted font-semibold">
            Para promocionar ({currentSubject.promoteTarget.toFixed(1)})
          </p>
          <p className="font-mono text-sm font-bold tabular-nums text-amber-800 dark:text-amber-300 mt-1.5">
            {formatNeeded(neededToPromote, currentSubject.promoteTarget)}
          </p>
        </div>
      </div>

      {/* Assessments Table / Cards */}
      <div className="space-y-2 text-xs">
        {currentSubject.assessments.map((a) => (
          <div
            key={a.id}
            className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-bold">{a.name}</p>
              <p className="text-[11px] fabro-muted font-mono tabular-nums">
                {a.type} · Peso {a.weight}%
              </p>
            </div>
            <label className="inline-flex items-center gap-2">
              <span className="fabro-muted">Nota (0–10):</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={a.score ?? ''}
                placeholder="Pend."
                onChange={(e) => handleScoreChange(a.id, e.target.value)}
                className="w-24 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-1.5 font-mono font-bold text-center tabular-nums fabro-input"
              />
            </label>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleAddAssessment}
        className="pt-3 border-t fabro-border grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs"
      >
        <input
          type="text"
          value={newExamName}
          onChange={(e) => setNewExamName(e.target.value)}
          placeholder="Nueva evaluación"
          className="sm:col-span-2 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <select
          value={newExamType}
          onChange={(e) => setNewExamType(e.target.value as GradeAssessment['type'])}
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        >
          <option value="Parcial">Parcial</option>
          <option value="TP">TP</option>
          <option value="Final">Final</option>
        </select>
        <input
          type="number"
          min="5"
          max="100"
          value={newExamWeight}
          onChange={(e) => setNewExamWeight(Number(e.target.value) || 20)}
          placeholder="Peso %"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 font-mono fabro-input"
        />
        <button type="submit" className="fabro-btn border-[#2563EB] bg-[#2563EB] text-white">
          <Plus className="w-4 h-4" />
          Sumar nota
        </button>
      </form>
    </div>
  );
};
