import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Bell,
  Calendar,
  Check,
  CheckSquare,
  Download,
  FileText,
  HeartPulse,
  Leaf,
  MapPin,
  Pill,
  Plus,
  ShieldAlert,
  Square,
  Stethoscope,
  Syringe,
  Target,
  Timer,
  Trash2,
  Trees,
  Upload,
  Users,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { SUSTAINABLE_HABITS_LIST } from '../../../../data/wellnessCatalog';
import {
  calculateOrientativeBmi,
  downloadWellnessPdfReport,
  todayIsoDate,
} from '../../../../services/wellnessVault';
import type {
  DailyHabitItem,
  FamilySocialEvent,
  HealthMetricEntry,
  MedicalAppointment,
  MedicalFileAttachment,
  MedicationEntry,
  NatureOutingEntry,
  PersonalGoal,
  PersonalProjectItem,
  VaccineEntry,
  WellnessStateSnapshot,
} from '../../../../types/wellness';
import { WellnessLineChart } from './WellnessCharts';

interface WellnessHealthGrowthPanelProps {
  section:
    | 'salud-prevencion'
    | 'desarrollo-personal'
    | 'relaciones-social'
    | 'naturaleza-ambiente';
  state: WellnessStateSnapshot;
  onUpdateState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

export const WellnessHealthGrowthPanel: React.FC<WellnessHealthGrowthPanelProps> = ({
  section,
  state,
  onUpdateState,
}) => {
  const {
    profile,
    updateProfile,
    balancedPlanner,
    toggleBalancedPlanner,
    addScheduledReminder,
  } = useEcosystem();

  const [feedback, setFeedback] = useState<string | null>(null);
  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  // --- 6. Salud y prevención ---
  const [healthTab, setHealthTab] = useState<'indicadores' | 'turnos-meds' | 'archivos'>('indicadores');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sysBp, setSysBp] = useState('');
  const [diaBp, setDiaBp] = useState('');
  const [hrBpm, setHrBpm] = useState('');
  const [tempC, setTempC] = useState('');
  const [healthNote, setHealthNote] = useState('');

  const [appDate, setAppDate] = useState(todayIsoDate());
  const [appTime, setAppTime] = useState('10:00');
  const [appSpec, setAppSpec] = useState('');
  const [appDoc, setAppDoc] = useState('');
  const [appLoc, setAppLoc] = useState('');

  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medTime, setMedTime] = useState('08:00');
  const [medFreq, setMedFreq] = useState('Diaria');

  const [vacName, setVacName] = useState('');
  const [vacDate, setVacDate] = useState(todayIsoDate());
  const [vacDose, setVacDose] = useState('Refuerzo');

  const [fileTitle, setFileTitle] = useState('');
  const [fileCat, setFileCat] = useState<MedicalFileAttachment['category']>('Laboratorio');

  // --- 7. Desarrollo personal ---
  const [goalTitle, setGoalTitle] = useState('');
  const [goalHorizon, setGoalHorizon] = useState<PersonalGoal['horizon']>('corto');
  const [goalTarget, setGoalTarget] = useState('10');
  const [goalUnit, setGoalUnit] = useState('sesiones');
  const [goalDue, setGoalDue] = useState(todayIsoDate());

  const [habitTitle, setHabitTitle] = useState('');
  const [habitCat, setHabitCat] = useState('Bienestar');

  const [projTitle, setProjTitle] = useState('');
  const [projNext, setProjNext] = useState('');

  const [achTitle, setAchTitle] = useState('');

  // --- 8. Relaciones y vida social ---
  const [famTitle, setFamTitle] = useState('');
  const [famDate, setFamDate] = useState(todayIsoDate());
  const [famKind, setFamKind] = useState<FamilySocialEvent['kind']>('familia');
  const [famParticipants, setFamParticipants] = useState('');
  const [famConsent, setFamConsent] = useState(false);

  // --- 9. Naturaleza y bienestar ambiental ---
  const [natActivity, setNatActivity] = useState<NatureOutingEntry['activity']>('caminata-verde');
  const [natPlace, setNatPlace] = useState('');
  const [natMin, setNatMin] = useState('30');
  const [natFeeling, setNatFeeling] = useState('Aire fresco y mente despejada');
  const [favPlaceName, setFavPlaceName] = useState('');
  const [favPlaceLoc, setFavPlaceLoc] = useState('');
  const [disconnectMin, setDisconnectMin] = useState(20);
  const [disconnectSecLeft, setDisconnectSecLeft] = useState(1200);
  const [disconnectRunning, setDisconnectRunning] = useState(false);

  useEffect(() => {
    if (!disconnectRunning) return;
    const id = window.setInterval(() => {
      setDisconnectSecLeft((prev) => {
        if (prev <= 1) {
          setDisconnectRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [disconnectRunning]);

  const weightPoints = useMemo(() => {
    return [...state.healthMetrics]
      .filter((h) => typeof h.weightKg === 'number' && h.weightKg > 0)
      .slice(0, 14)
      .reverse()
      .map((h) => ({ label: h.date.slice(5), value: h.weightKg as number }));
  }, [state.healthMetrics]);

  // =========================================================================
  // 6. SALUD Y PREVENCIÓN
  // =========================================================================
  if (section === 'salud-prevencion') {
    const latestMetric = state.healthMetrics[0];
    const latestBmi = latestMetric
      ? calculateOrientativeBmi(latestMetric.weightKg, latestMetric.heightCm)
      : null;

    const handleAddMetric = (e: React.FormEvent) => {
      e.preventDefault();
      if (!weightKg && !heightCm && !sysBp && !hrBpm && !tempC) return;
      const entry: HealthMetricEntry = {
        id: `hm-${Date.now()}`,
        date: todayIsoDate(),
        weightKg: weightKg ? Number(weightKg) : undefined,
        heightCm: heightCm ? Number(heightCm) : latestMetric?.heightCm,
        systolicBp: sysBp ? Number(sysBp) : undefined,
        diastolicBp: diaBp ? Number(diaBp) : undefined,
        heartRateBpm: hrBpm ? Number(hrBpm) : undefined,
        temperatureC: tempC ? Number(tempC) : undefined,
        notes: healthNote.trim() || undefined,
      };
      onUpdateState((prev) => ({ ...prev, healthMetrics: [entry, ...prev.healthMetrics] }));
      setWeightKg('');
      setSysBp('');
      setDiaBp('');
      setHrBpm('');
      setTempC('');
      setHealthNote('');
      notify('Indicadores personales guardados en tu historial privado.');
    };

    const handleUploadMedicalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        notify('Archivo superior a 4 MB. Comprimilo o elegí un PDF/imagen más liviano.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        const att: MedicalFileAttachment = {
          id: `mfile-${Date.now()}`,
          date: todayIsoDate(),
          title: fileTitle.trim() || file.name,
          category: fileCat,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataUrl: reader.result,
        };
        onUpdateState((prev) => ({ ...prev, medicalFiles: [att, ...prev.medicalFiles] }));
        setFileTitle('');
        notify(`Estudio «${att.title}» guardado localmente en IndexedDB.`);
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className="space-y-5">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#BE123C]">
                06 · Salud y prevención · Historial personal privado
              </p>
              <h2 className="font-display text-xl font-bold">
                Indicadores, controles médicos, vacunas, medicación y archivos
              </h2>
            </div>
            <button
              type="button"
              onClick={() => downloadWellnessPdfReport(state, profile.displayName || 'Usuario FABRO', false)}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#BE123C] text-white px-3.5 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar historial PDF
            </button>
          </div>

          <div className="rounded-xl border border-rose-500/35 bg-rose-500/5 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Aviso médico obligatorio: FABRO BIENESTAR es un organizador personal de registros declarados por vos. No realiza diagnósticos clínicos, no prescribe tratamientos y no sustituye consultas ni emergencias médicas.
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 border-t fabro-border pt-3 text-xs">
            {(
              [
                ['indicadores', 'Indicadores e IMC', HeartPulse],
                ['turnos-meds', 'Turnos, vacunas y medicación', Stethoscope],
                ['archivos', `Estudios y archivos (${state.medicalFiles.length})`, FileText],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHealthTab(id)}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 font-semibold cursor-pointer ${
                  healthTab === id
                    ? 'border-[#BE123C] bg-[#BE123C] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {feedback && (
            <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {feedback}
            </p>
          )}
        </section>

        {healthTab === 'indicadores' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
            <form
              onSubmit={handleAddMetric}
              className="lg:col-span-6 rounded-2xl border fabro-border fabro-surface p-5 space-y-3"
            >
              <h3 className="text-sm font-bold">Cargar medición personal</h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="Peso (kg)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  step="0.5"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="Altura (cm)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={sysBp}
                  onChange={(e) => setSysBp(e.target.value)}
                  placeholder="Presión sistólica (ej. 120)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={diaBp}
                  onChange={(e) => setDiaBp(e.target.value)}
                  placeholder="Presión diastólica (ej. 80)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={hrBpm}
                  onChange={(e) => setHrBpm(e.target.value)}
                  placeholder="Frec. cardíaca (lpm)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  step="0.1"
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value)}
                  placeholder="Temperatura (°C)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </div>
              <input
                type="text"
                value={healthNote}
                onChange={(e) => setHealthNote(e.target.value)}
                placeholder="Contexto (ej. en ayunas, reposo, control de rutina)"
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <button
                type="submit"
                className="min-h-[40px] w-full rounded-xl bg-[#BE123C] text-white font-semibold cursor-pointer"
              >
                Guardar indicadores
              </button>

              {latestBmi && (
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-0.5">
                  <p className="font-semibold">
                    IMC orientativo: <span className="font-mono text-[#BE123C]">{latestBmi.bmi}</span>
                  </p>
                  <p className="fabro-muted">{latestBmi.category} · Solo referencia general.</p>
                </div>
              )}
            </form>

            <div className="lg:col-span-6 space-y-4">
              <WellnessLineChart
                title="Evolución de peso registrado"
                points={weightPoints}
                accentColor="#BE123C"
                unit=" kg"
              />
              <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
                <h3 className="text-sm font-bold">Últimos registros ({state.healthMetrics.length})</h3>
                {state.healthMetrics.length === 0 ? (
                  <p className="fabro-muted">Aún no cargaste mediciones personales.</p>
                ) : (
                  <div className="divide-y fabro-border max-h-56 overflow-y-auto">
                    {state.healthMetrics.map((m) => (
                      <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="font-mono text-[11px] tabular-nums">
                          <span className="font-bold">{m.date}</span> ·{' '}
                          {[
                            m.weightKg ? `${m.weightKg} kg` : null,
                            m.systolicBp && m.diastolicBp ? `PA ${m.systolicBp}/${m.diastolicBp}` : null,
                            m.heartRateBpm ? `${m.heartRateBpm} lpm` : null,
                            m.temperatureC ? `${m.temperatureC}°C` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateState((prev) => ({
                              ...prev,
                              healthMetrics: prev.healthMetrics.filter((x) => x.id !== m.id),
                            }))
                          }
                          className="fabro-muted hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {healthTab === 'turnos-meds' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            {/* Appointments */}
            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#BE123C]" />
                Turnos y controles
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={appSpec}
                  onChange={(e) => setAppSpec(e.target.value)}
                  placeholder="Especialidad (ej. Clínica médica, Odontología)"
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                />
                <input
                  type="text"
                  value={appDoc}
                  onChange={(e) => setAppDoc(e.target.value)}
                  placeholder="Profesional / centro"
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={appDate}
                    onChange={(e) => setAppDate(e.target.value)}
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
                  />
                  <input
                    type="time"
                    value={appTime}
                    onChange={(e) => setAppTime(e.target.value)}
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
                  />
                </div>
                <input
                  type="text"
                  value={appLoc}
                  onChange={(e) => setAppLoc(e.target.value)}
                  placeholder="Dirección / consultorio"
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!appSpec.trim()) return;
                    const item: MedicalAppointment = {
                      id: `app-${Date.now()}`,
                      date: appDate,
                      time: appTime,
                      specialty: appSpec.trim(),
                      professional: appDoc.trim(),
                      location: appLoc.trim(),
                      notes: '',
                      completed: false,
                    };
                    onUpdateState((prev) => ({
                      ...prev,
                      medicalAppointments: [item, ...prev.medicalAppointments],
                    }));
                    const targetMs = new Date(`${item.date}T${item.time || '09:00'}`).getTime();
                    const mins = Math.max(1, Math.round((targetMs - Date.now()) / 60000));
                    addScheduledReminder(
                      `Turno médico: ${item.specialty}`,
                      'bienestar',
                      'organizador-integral',
                      mins
                    );
                    setAppSpec('');
                    setAppDoc('');
                    setAppLoc('');
                    notify('Turno guardado y sincronizado con recordatorios locales.');
                  }}
                  className="min-h-[36px] w-full rounded-xl bg-[#BE123C] text-white font-semibold cursor-pointer"
                >
                  Agendar turno
                </button>
              </div>
              <div className="divide-y fabro-border">
                {state.medicalAppointments.map((a) => (
                  <div key={a.id} className="py-2 flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-semibold ${a.completed ? 'line-through opacity-60' : ''}`}>
                        {a.specialty}
                      </p>
                      <p className="text-[11px] fabro-muted font-mono">
                        {a.date} {a.time} {a.professional ? `· ${a.professional}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            medicalAppointments: prev.medicalAppointments.map((x) =>
                              x.id === a.id ? { ...x, completed: !x.completed } : x
                            ),
                          }))
                        }
                        className="p-1 fabro-muted hover:text-[#059669] cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            medicalAppointments: prev.medicalAppointments.filter((x) => x.id !== a.id),
                          }))
                        }
                        className="p-1 fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Medications */}
            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-[#0284C7]" />
                Medicación habitual
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Medicamento o suplemento"
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={medDose}
                    onChange={(e) => setMedDose(e.target.value)}
                    placeholder="Dosis (ej. 1 comp.)"
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                  />
                  <input
                    type="time"
                    value={medTime}
                    onChange={(e) => setMedTime(e.target.value)}
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
                  />
                </div>
                <input
                  type="text"
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  placeholder="Frecuencia (ej. Diaria, cada 12 h)"
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!medName.trim()) return;
                    const item: MedicationEntry = {
                      id: `med-${Date.now()}`,
                      name: medName.trim(),
                      dosage: medDose.trim() || 'Según indicación médica',
                      scheduleTime: medTime,
                      frequency: medFreq.trim() || 'Diaria',
                      active: true,
                    };
                    onUpdateState((prev) => ({
                      ...prev,
                      medications: [item, ...prev.medications],
                    }));
                    setMedName('');
                    setMedDose('');
                    notify('Medicación registrada en tu historial.');
                  }}
                  className="min-h-[36px] w-full rounded-xl bg-[#0284C7] text-white font-semibold cursor-pointer"
                >
                  Agregar medicación
                </button>
              </div>
              <div className="divide-y fabro-border">
                {state.medications.map((m) => (
                  <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-[11px] fabro-muted font-mono">
                        {m.dosage} · {m.frequency} ({m.scheduleTime})
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Crear recordatorio local"
                        onClick={() => {
                          addScheduledReminder(
                            `Medicación: ${m.name} (${m.dosage})`,
                            'bienestar',
                            'organizador-integral',
                            30
                          );
                          notify('Recordatorio local de medicación creado.');
                        }}
                        className="p-1 fabro-muted hover:text-[#0284C7] cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            medications: prev.medications.filter((x) => x.id !== m.id),
                          }))
                        }
                        className="p-1 fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vaccines */}
            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Syringe className="w-4 h-4 text-[#059669]" />
                Carnet de vacunas
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={vacName}
                  onChange={(e) => setVacName(e.target.value)}
                  placeholder="Vacuna (ej. Antigripal, Antitetánica)"
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={vacDate}
                    onChange={(e) => setVacDate(e.target.value)}
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
                  />
                  <input
                    type="text"
                    value={vacDose}
                    onChange={(e) => setVacDose(e.target.value)}
                    placeholder="Dosis"
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!vacName.trim()) return;
                    const item: VaccineEntry = {
                      id: `vac-${Date.now()}`,
                      name: vacName.trim(),
                      date: vacDate,
                      dose: vacDose.trim() || 'Aplicada',
                    };
                    onUpdateState((prev) => ({ ...prev, vaccines: [item, ...prev.vaccines] }));
                    setVacName('');
                    notify('Vacuna registrada en tu carnet local.');
                  }}
                  className="min-h-[36px] w-full rounded-xl bg-[#059669] text-white font-semibold cursor-pointer"
                >
                  Guardar vacuna
                </button>
              </div>
              <div className="divide-y fabro-border">
                {state.vaccines.map((v) => (
                  <div key={v.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{v.name}</p>
                      <p className="text-[11px] fabro-muted font-mono">
                        {v.date} · {v.dose}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          vaccines: prev.vaccines.filter((x) => x.id !== v.id),
                        }))
                      }
                      className="fabro-muted hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {healthTab === 'archivos' && (
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="Nombre del estudio (ej. Laboratorio anual)"
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <select
                value={fileCat}
                onChange={(e) => setFileCat(e.target.value as MedicalFileAttachment['category'])}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                <option value="Laboratorio">Laboratorio</option>
                <option value="Imagen">Imagen / Ecografía</option>
                <option value="Receta">Receta / Indicación</option>
                <option value="Control">Control médico</option>
                <option value="Otro">Otro</option>
              </select>
              <label className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#BE123C] text-white font-semibold cursor-pointer px-4">
                <Upload className="w-3.5 h-3.5" />
                Adjuntar PDF o imagen
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleUploadMedicalFile}
                  className="hidden"
                />
              </label>
            </div>

            {state.medicalFiles.length === 0 ? (
              <p className="fabro-muted">
                No hay estudios adjuntos todavía. Los archivos se guardan únicamente en el IndexedDB local de tu navegador (hasta 4 MB por archivo).
              </p>
            ) : (
              <div className="divide-y fabro-border">
                {state.medicalFiles.map((f) => (
                  <div key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{f.title}</p>
                      <p className="text-[11px] fabro-muted font-mono">
                        {f.date} · {f.category} · {f.fileName} ({Math.round(f.sizeBytes / 1024)} KB)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={f.dataUrl}
                        download={f.fileName}
                        className="rounded-lg border fabro-border px-2.5 py-1 font-semibold hover:border-[#BE123C]"
                      >
                        Descargar
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            medicalFiles: prev.medicalFiles.filter((x) => x.id !== f.id),
                          }))
                        }
                        className="fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 7. DESARROLLO PERSONAL
  // =========================================================================
  if (section === 'desarrollo-personal') {
    const today = todayIsoDate();
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7C3AED]">
            07 · Desarrollo personal
          </p>
          <h2 className="font-display text-xl font-bold">
            Metas medibles, hábitos diarios, proyectos, logros y gustos de vida
          </h2>
          <p className="fabro-muted">
            Integra tu planificador equilibrado y tus intereses personales de «El Último Día de Tu Vida».
          </p>
          {feedback && (
            <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399] pt-1">{feedback}</p>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Goals */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Target className="w-4 h-4 text-[#7C3AED]" />
              Metas a corto, mediano y largo plazo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Ej. Leer 12 libros este año"
                className="sm:col-span-2 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <select
                value={goalHorizon}
                onChange={(e) => setGoalHorizon(e.target.value as PersonalGoal['horizon'])}
                className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                <option value="corto">Corto plazo</option>
                <option value="mediano">Mediano plazo</option>
                <option value="largo">Largo plazo</option>
              </select>
              <input
                type="date"
                value={goalDue}
                onChange={(e) => setGoalDue(e.target.value)}
                className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
              />
              <input
                type="number"
                min={1}
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="Meta numérica"
                className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
              />
              <input
                type="text"
                value={goalUnit}
                onChange={(e) => setGoalUnit(e.target.value)}
                placeholder="Unidad (libros, km, horas)"
                className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!goalTitle.trim()) return;
                const item: PersonalGoal = {
                  id: `goal-${Date.now()}`,
                  title: goalTitle.trim(),
                  horizon: goalHorizon,
                  targetValue: Math.max(1, Number(goalTarget) || 1),
                  currentValue: 0,
                  unit: goalUnit.trim() || 'pasos',
                  dueDate: goalDue,
                  completed: false,
                };
                onUpdateState((prev) => ({ ...prev, personalGoals: [item, ...prev.personalGoals] }));
                setGoalTitle('');
                notify('Meta personal agregada.');
              }}
              className="min-h-[38px] rounded-xl bg-[#7C3AED] text-white px-4 font-semibold cursor-pointer"
            >
              Crear meta
            </button>

            <div className="space-y-2">
              {state.personalGoals.map((g) => {
                const pct = Math.min(100, Math.round((g.currentValue / Math.max(1, g.targetValue)) * 100));
                return (
                  <div key={g.id} className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {g.title} <span className="fabro-muted font-normal">({g.horizon})</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateState((prev) => ({
                              ...prev,
                              personalGoals: prev.personalGoals.map((x) => {
                                if (x.id !== g.id) return x;
                                const nextVal = Math.min(x.targetValue, x.currentValue + 1);
                                return { ...x, currentValue: nextVal, completed: nextVal >= x.targetValue };
                              }),
                            }))
                          }
                          className="rounded-lg bg-[#7C3AED] text-white px-2 py-0.5 font-mono font-bold cursor-pointer"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateState((prev) => ({
                              ...prev,
                              personalGoals: prev.personalGoals.filter((x) => x.id !== g.id),
                            }))
                          }
                          className="fabro-muted hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                      <div className="h-full bg-[#7C3AED]" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] font-mono tabular-nums fabro-muted">
                      {g.currentValue}/{g.targetValue} {g.unit} ({pct}%) · Vence {g.dueDate}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Habits */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#059669]" />
              Hábitos diarios y constancia
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={habitTitle}
                onChange={(e) => setHabitTitle(e.target.value)}
                placeholder="Nuevo hábito diario (ej. Caminar 20 min, leer 15 min)"
                className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="text"
                value={habitCat}
                onChange={(e) => setHabitCat(e.target.value)}
                className="w-28 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (!habitTitle.trim()) return;
                  const item: DailyHabitItem = {
                    id: `hab-${Date.now()}`,
                    title: habitTitle.trim(),
                    category: habitCat.trim() || 'General',
                    targetDaysPerWeek: 5,
                    completedDates: [],
                  };
                  onUpdateState((prev) => ({ ...prev, dailyHabits: [item, ...prev.dailyHabits] }));
                  setHabitTitle('');
                }}
                className="min-h-[36px] rounded-xl bg-[#059669] text-white px-3.5 font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {state.dailyHabits.length === 0 ? (
              <p className="fabro-muted">Creá tus hábitos diarios y marcá cada día cumplido.</p>
            ) : (
              <div className="divide-y fabro-border">
                {state.dailyHabits.map((h) => {
                  const doneToday = h.completedDates.includes(today);
                  return (
                    <div key={h.id} className="py-2.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            dailyHabits: prev.dailyHabits.map((x) => {
                              if (x.id !== h.id) return x;
                              const exists = x.completedDates.includes(today);
                              return {
                                ...x,
                                completedDates: exists
                                  ? x.completedDates.filter((d) => d !== today)
                                  : [today, ...x.completedDates],
                              };
                            }),
                          }))
                        }
                        className="flex items-center gap-2 text-left cursor-pointer flex-1"
                      >
                        {doneToday ? (
                          <CheckSquare className="w-4 h-4 text-[#059669] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 fabro-muted shrink-0" />
                        )}
                        <span className={doneToday ? 'line-through opacity-70 font-medium' : 'font-medium'}>
                          {h.title}
                        </span>
                        <span className="text-[10px] font-mono fabro-muted">
                          ({h.completedDates.length} días)
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            dailyHabits: prev.dailyHabits.filter((x) => x.id !== h.id),
                          }))
                        }
                        className="fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Projects, Achievements & Preserved El Último Día de Tu Vida Personal Tastes + Balanced Planner */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Award className="w-4 h-4 text-[#D97706]" />
              Proyectos personales y logros
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={projTitle}
                onChange={(e) => setProjTitle(e.target.value)}
                placeholder="Proyecto personal"
                className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
              <input
                type="text"
                value={projNext}
                onChange={(e) => setProjNext(e.target.value)}
                placeholder="Próximo paso"
                className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (!projTitle.trim()) return;
                  const p: PersonalProjectItem = {
                    id: `prj-${Date.now()}`,
                    title: projTitle.trim(),
                    status: 'en-curso',
                    nextStep: projNext.trim() || 'Definir primer bloque de 25 min',
                    progressPct: 10,
                  };
                  onUpdateState((prev) => ({
                    ...prev,
                    personalProjects: [p, ...prev.personalProjects],
                  }));
                  setProjTitle('');
                  setProjNext('');
                }}
                className="min-h-[36px] rounded-xl bg-[#7C3AED] text-white px-3 font-semibold cursor-pointer"
              >
                +
              </button>
            </div>
            {state.personalProjects.map((p) => (
              <div key={p.id} className="rounded-xl border fabro-border fabro-surface-elevated p-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-[11px] fabro-muted">Siguiente paso: {p.nextStep}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateState((prev) => ({
                      ...prev,
                      personalProjects: prev.personalProjects.filter((x) => x.id !== p.id),
                    }))
                  }
                  className="fabro-muted hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <div className="pt-2 border-t fabro-border space-y-2">
              <p className="font-semibold">Registrar un logro personal</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={achTitle}
                  onChange={(e) => setAchTitle(e.target.value)}
                  placeholder="Ej. Completé mi primera semana constante"
                  className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!achTitle.trim()) return;
                    onUpdateState((prev) => ({
                      ...prev,
                      achievements: [
                        {
                          id: `ach-${Date.now()}`,
                          date: todayIsoDate(),
                          title: achTitle.trim(),
                          category: 'Personal',
                        },
                        ...prev.achievements,
                      ],
                    }));
                    setAchTitle('');
                  }}
                  className="min-h-[36px] rounded-xl bg-[#D97706] text-white px-3 font-semibold cursor-pointer"
                >
                  Guardar
                </button>
              </div>
              {state.achievements.slice(0, 5).map((a) => (
                <p key={a.id} className="text-[11px] fabro-muted">
                  • <span className="font-mono">{a.date}</span> — {a.title}
                </p>
              ))}
            </div>
          </div>

          {/* Preserved El Último Día de Tu Vida Balanced Planner & Personal Tastes */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold">
              Planificador diario equilibrado y gustos de vida (preservado)
            </h3>
            <div className="space-y-1.5">
              {balancedPlanner.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => toggleBalancedPlanner(row.id)}
                  className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {row.done ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 fabro-muted shrink-0" />
                    )}
                    <span className="font-mono font-semibold text-[#059669] shrink-0">
                      {row.time}
                    </span>
                    <span className={`truncate ${row.done ? 'line-through opacity-60' : ''}`}>
                      {row.activity}
                    </span>
                  </span>
                  <span className="text-[10px] fabro-muted shrink-0">{row.block}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t fabro-border space-y-2">
              <p className="font-semibold">Mis gustos e intereses de vida (El Último Día de Tu Vida)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    ['music', 'Música favorita'],
                    ['movies', 'Películas / series'],
                    ['books', 'Libros / autores'],
                    ['food', 'Comidas preferidas'],
                    ['drinks', 'Bebidas / infusiones'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="space-y-0.5">
                    <span className="text-[11px] fabro-muted">{label}</span>
                    <input
                      type="text"
                      value={profile.tastes[field] || ''}
                      onChange={(e) =>
                        updateProfile({
                          tastes: {
                            ...profile.tastes,
                            [field]: e.target.value,
                          },
                        })
                      }
                      className="w-full min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 text-xs fabro-input"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 8. RELACIONES Y VIDA SOCIAL
  // =========================================================================
  if (section === 'relaciones-social') {
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0D9488]">
            08 · Relaciones y vida social
          </p>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0D9488]" />
            Agenda familiar, fechas importantes y vínculos saludables
          </h2>
          <p className="fabro-muted">
            Organizá encuentros, proyectos familiares y actividades recreativas respetando el consentimiento de los participantes.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold">Agendar evento o fecha importante</h3>
            <input
              type="text"
              value={famTitle}
              onChange={(e) => setFamTitle(e.target.value)}
              placeholder="Ej. Almuerzo familiar, cumpleaños, caminata con amigos"
              className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={famDate}
                onChange={(e) => setFamDate(e.target.value)}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
              />
              <select
                value={famKind}
                onChange={(e) => setFamKind(e.target.value as FamilySocialEvent['kind'])}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                <option value="familia">Agenda familiar</option>
                <option value="fecha-importante">Fecha importante</option>
                <option value="reunion">Encuentro / reunión</option>
                <option value="actividad-compartida">Actividad compartida</option>
                <option value="proyecto-familiar">Proyecto familiar</option>
              </select>
            </div>
            <input
              type="text"
              value={famParticipants}
              onChange={(e) => setFamParticipants(e.target.value)}
              placeholder="Participantes (opcional)"
              className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={famConsent}
                onChange={(e) => setFamConsent(e.target.checked)}
                className="accent-[#0D9488]"
              />
              <span>Actividad acordada con consentimiento explícito del grupo</span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (!famTitle.trim()) return;
                const ev: FamilySocialEvent = {
                  id: `fam-${Date.now()}`,
                  date: famDate,
                  title: famTitle.trim(),
                  kind: famKind,
                  participants: famParticipants.trim(),
                  sharedConsent: famConsent,
                };
                onUpdateState((prev) => ({ ...prev, familyEvents: [ev, ...prev.familyEvents] }));
                setFamTitle('');
                setFamParticipants('');
                setFamConsent(false);
                notify('Evento agregado a tu agenda social y familiar.');
              }}
              className="min-h-[38px] rounded-xl bg-[#0D9488] text-white px-4 font-semibold cursor-pointer"
            >
              Guardar en agenda
            </button>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
              <h3 className="text-sm font-bold">Próximos momentos ({state.familyEvents.length})</h3>
              {state.familyEvents.length === 0 ? (
                <p className="fabro-muted">Aún no agendaste fechas familiares o encuentros.</p>
              ) : (
                <div className="divide-y fabro-border">
                  {state.familyEvents.map((ev) => (
                    <div key={ev.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{ev.title}</p>
                        <p className="text-[11px] fabro-muted font-mono">
                          {ev.date} · {ev.kind}
                          {ev.participants ? ` · ${ev.participants}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            familyEvents: prev.familyEvents.filter((x) => x.id !== ev.id),
                          }))
                        }
                        className="fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
              <h3 className="text-sm font-bold">Recursos de comunicación saludable</h3>
              <ul className="space-y-1.5 fabro-muted list-disc pl-4">
                <li>Hablar en primera persona («Me sentí… / Necesito…») reduce respuestas defensivas.</li>
                <li>Escuchar sin interrumpir ni preparar la réplica fortalece la confianza cotidiana.</li>
                <li>Acordar tiempos sin teléfonos durante comidas o caminatas mejora la calidad del vínculo.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 9. NATURALEZA Y BIENESTAR AMBIENTAL
  // =========================================================================
  const discM = String(Math.floor(disconnectSecLeft / 60)).padStart(2, '0');
  const discS = String(disconnectSecLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-5 text-xs">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
          09 · Naturaleza y bienestar ambiental
        </p>
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Trees className="w-5 h-5 text-[#15803D]" />
          Salidas al aire libre, lugares favoritos y desconexión digital
        </h2>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Leaf className="w-4 h-4 text-[#15803D]" />
            Registrar salida o pausa en la naturaleza
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={natActivity}
              onChange={(e) => setNatActivity(e.target.value as NatureOutingEntry['activity'])}
              className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
            >
              <option value="caminata-verde">Caminata en espacio verde</option>
              <option value="jardineria">Jardinería / plantas</option>
              <option value="aire-libre">Actividad al aire libre</option>
              <option value="desconexion-digital">Desconexión digital</option>
              <option value="habito-sostenible">Acción ambiental</option>
            </select>
            <input
              type="number"
              min={5}
              value={natMin}
              onChange={(e) => setNatMin(e.target.value)}
              placeholder="Duración (min)"
              className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
            />
          </div>
          <input
            type="text"
            value={natPlace}
            onChange={(e) => setNatPlace(e.target.value)}
            placeholder="Lugar (ej. Parque cercano, plaza, balcón con plantas)"
            className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          />
          <input
            type="text"
            value={natFeeling}
            onChange={(e) => setNatFeeling(e.target.value)}
            placeholder="¿Cómo te sentiste?"
            className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          />
          <button
            type="button"
            onClick={() => {
              const entry: NatureOutingEntry = {
                id: `nat-${Date.now()}`,
                date: todayIsoDate(),
                activity: natActivity,
                place: natPlace.trim() || 'Aire libre',
                durationMin: Math.max(1, Number(natMin) || 20),
                feeling: natFeeling.trim() || 'Renovado',
              };
              onUpdateState((prev) => ({ ...prev, natureOutings: [entry, ...prev.natureOutings] }));
              setNatPlace('');
              notify('Salida registrada en tu bitácora ambiental.');
            }}
            className="min-h-[38px] rounded-xl bg-[#15803D] text-white px-4 font-semibold cursor-pointer"
          >
            Guardar salida ({state.natureOutings.length})
          </button>

          {state.natureOutings.length > 0 && (
            <div className="divide-y fabro-border pt-2">
              {state.natureOutings.slice(0, 6).map((o) => (
                <div key={o.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {o.place} ({o.durationMin} min)
                    </p>
                    <p className="text-[11px] fabro-muted">
                      {o.date} · {o.feeling}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateState((prev) => ({
                        ...prev,
                        natureOutings: prev.natureOutings.filter((x) => x.id !== o.id),
                      }))
                    }
                    className="fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 space-y-4">
          {/* Digital Disconnection Timer */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Timer className="w-4 h-4 text-[#15803D]" />
              Bloque de desconexión digital
            </h3>
            <div className="flex items-center justify-between rounded-xl border fabro-border fabro-surface-elevated px-4 py-3">
              <span className="font-mono text-2xl font-bold tabular-nums">
                {discM}:{discS}
              </span>
              <div className="flex gap-1.5">
                {[15, 20, 30, 45].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setDisconnectRunning(false);
                      setDisconnectMin(m);
                      setDisconnectSecLeft(m * 60);
                    }}
                    className={`px-2 py-1 rounded-lg border font-mono cursor-pointer ${
                      disconnectMin === m ? 'bg-[#15803D] text-white border-[#15803D]' : 'fabro-border'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDisconnectRunning((v) => !v)}
              className="min-h-[38px] w-full rounded-xl bg-[#15803D] text-white font-semibold cursor-pointer"
            >
              {disconnectRunning ? 'Pausar desconexión' : 'Iniciar pausa sin pantallas'}
            </button>
          </div>

          {/* Favorite Green Places + Sustainable Habits */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#15803D]" />
              Lugares favoritos y hábitos sostenibles
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={favPlaceName}
                onChange={(e) => setFavPlaceName(e.target.value)}
                placeholder="Parque, sendero o rincón verde"
                className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
              <input
                type="text"
                value={favPlaceLoc}
                onChange={(e) => setFavPlaceLoc(e.target.value)}
                placeholder="Zona"
                className="w-28 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (!favPlaceName.trim()) return;
                  onUpdateState((prev) => ({
                    ...prev,
                    naturePlaces: [
                      {
                        id: `pl-${Date.now()}`,
                        name: favPlaceName.trim(),
                        location: favPlaceLoc.trim() || 'Cerca',
                        bestFor: 'Caminar / descansar',
                      },
                      ...prev.naturePlaces,
                    ],
                  }));
                  setFavPlaceName('');
                  setFavPlaceLoc('');
                }}
                className="min-h-[36px] rounded-xl bg-[#15803D] text-white px-3 font-semibold cursor-pointer"
              >
                +
              </button>
            </div>
            {state.naturePlaces.map((pl) => (
              <p key={pl.id} className="text-[11px] fabro-muted">
                • <strong>{pl.name}</strong> ({pl.location})
              </p>
            ))}

            <div className="pt-2 border-t fabro-border space-y-1.5">
              <p className="font-semibold">Hábitos sostenibles cotidianos</p>
              {SUSTAINABLE_HABITS_LIST.map((hab) => {
                const checked = state.sustainableHabitsChecked.includes(hab);
                return (
                  <label key={hab} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          sustainableHabitsChecked: checked
                            ? prev.sustainableHabitsChecked.filter((x) => x !== hab)
                            : [...prev.sustainableHabitsChecked, hab],
                        }))
                      }
                      className="accent-[#15803D]"
                    />
                    <span className={checked ? 'line-through opacity-70' : ''}>{hab}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
