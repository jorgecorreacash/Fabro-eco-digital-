import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Mic,
  MicOff,
  Plus,
  SlidersHorizontal,
  Trash2,
  Volume2,
} from 'lucide-react';
import { vaultGet, vaultSet } from '../../services/localVault';
import {
  detectPitchYin,
  findClosestTargetString,
  frequencyToNoteInfo,
  makeStrings,
  medianFrequency,
  midiToFrequency,
  playReferenceTone,
  TUNING_PRESETS,
  type DetectedNoteInfo,
  type TuningPreset,
  type TuningStringDef,
} from '../../services/musicEngine';

type TuningZone = 'idle' | 'tuned' | 'close' | 'out';

const STABILITY_HOLD_MS = 380;

export const DigitalTunerPro: React.FC = () => {
  // Settings persisted locally
  const [referenceA4, setReferenceA4] = useState<number>(440);
  const [toleranceCents, setToleranceCents] = useState<number>(2);
  const [sensitivityLevel, setSensitivityLevel] = useState<'baja' | 'media' | 'alta'>('media');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('guitar-standard');
  const [lockedStringNumber, setLockedStringNumber] = useState<number | null>(null);
  const [customTunings, setCustomTunings] = useState<TuningPreset[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Custom tuning form
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customInstrument, setCustomInstrument] = useState<'guitar' | 'bass'>('guitar');
  const [customNotesRaw, setCustomNotesRaw] = useState('C2 G2 C3 F3 A3 D4');

  // Real microphone state
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [detected, setDetected] = useState<{
    note: DetectedNoteInfo;
    targetString: TuningStringDef | null;
    centsFromTarget: number;
    targetFreq: number;
    clarity: number;
    rms: number;
  } | null>(null);
  const [isLockedTuned, setIsLockedTuned] = useState(false);
  const [inputLevelPct, setInputLevelPct] = useState(0);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqHistoryRef = useRef<number[]>([]);
  const inTuneSinceRef = useRef<number | null>(null);
  const lastHeardAtRef = useRef<number>(0);

  // Refs for latest settings inside RAF loop
  const settingsRef = useRef({
    referenceA4,
    toleranceCents,
    sensitivityLevel,
    lockedStringNumber,
    activePreset: TUNING_PRESETS[0] as TuningPreset,
  });

  // Load saved tuner settings & custom tunings
  useEffect(() => {
    let active = true;
    void Promise.all([
      vaultGet<number>('music_tuner_a4', 440),
      vaultGet<number>('music_tuner_tolerance', 2),
      vaultGet<TuningPreset[]>('music_custom_tunings', []),
    ]).then(([a4, tol, customs]) => {
      if (!active) return;
      if (a4 >= 430 && a4 <= 450) setReferenceA4(a4);
      if (tol >= 1 && tol <= 5) setToleranceCents(tol);
      if (Array.isArray(customs)) setCustomTunings(customs);
    });
    return () => {
      active = false;
    };
  }, []);

  const allPresets = useMemo(
    () => [...TUNING_PRESETS, ...customTunings],
    [customTunings]
  );

  const activePreset = useMemo(
    () => allPresets.find((p) => p.id === selectedPresetId) || TUNING_PRESETS[0],
    [allPresets, selectedPresetId]
  );

  useEffect(() => {
    settingsRef.current = {
      referenceA4,
      toleranceCents,
      sensitivityLevel,
      lockedStringNumber,
      activePreset,
    };
  }, [referenceA4, toleranceCents, sensitivityLevel, lockedStringNumber, activePreset]);

  const stopMicrophone = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    freqHistoryRef.current = [];
    inTuneSinceRef.current = null;
    setMicActive(false);
    setDetected(null);
    setIsLockedTuned(false);
    setInputLevelPct(0);
  }, []);

  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, [stopMicrophone]);

  const startMicrophone = useCallback(async () => {
    setMicError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setMicError(
        'Tu navegador o entorno actual no expone captura de micrófono (getUserMedia). Abrí FABRO en HTTPS o en un navegador moderno para usar el afinador real.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) {
        stream.getTracks().forEach((t) => t.stop());
        setMicError('Web Audio API no está disponible en este navegador.');
        return;
      }

      const ctx = new AudioCtxCtor();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.0;
      source.connect(analyser);

      streamRef.current = stream;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      freqHistoryRef.current = [];
      inTuneSinceRef.current = null;
      setMicActive(true);

      const timeBuffer = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;
        analyserRef.current.getFloatTimeDomainData(timeBuffer);

        const cfg = settingsRef.current;
        const rmsThreshold =
          cfg.sensitivityLevel === 'alta'
            ? 0.005
            : cfg.sensitivityLevel === 'baja'
            ? 0.025
            : 0.012;

        // Instant RMS meter for visual mic feedback
        let sq = 0;
        for (let i = 0; i < timeBuffer.length; i++) sq += timeBuffer[i] * timeBuffer[i];
        const instantRms = Math.sqrt(sq / timeBuffer.length);
        setInputLevelPct(Math.min(100, Math.round(instantRms * 520)));

        const pitch = detectPitchYin(timeBuffer, audioCtxRef.current.sampleRate, rmsThreshold);
        const now = performance.now();

        if (pitch) {
          lastHeardAtRef.current = now;
          const hist = freqHistoryRef.current;
          // Discard single-frame octave jumps before averaging
          if (hist.length > 0) {
            const lastMed = medianFrequency(hist);
            const ratio = pitch.frequency / lastMed;
            if (ratio > 1.75 || ratio < 0.57) {
              hist.length = 0;
            }
          }
          hist.push(pitch.frequency);
          if (hist.length > 6) hist.shift();

          const smoothFreq = medianFrequency(hist);
          const noteInfo = frequencyToNoteInfo(smoothFreq, cfg.referenceA4);

          let targetString: TuningStringDef | null = null;
          let centsFromTarget = noteInfo.cents;
          let targetFreq = noteInfo.targetFreq;

          if (cfg.activePreset.strings.length > 0) {
            if (cfg.lockedStringNumber !== null) {
              const found = cfg.activePreset.strings.find(
                (s) => s.stringNumber === cfg.lockedStringNumber
              );
              if (found) {
                targetString = found;
                targetFreq = Math.round(midiToFrequency(found.midi, cfg.referenceA4) * 100) / 100;
                centsFromTarget =
                  Math.round(1200 * Math.log2(smoothFreq / targetFreq) * 10) / 10;
              }
            } else {
              const closest = findClosestTargetString(
                smoothFreq,
                cfg.activePreset.strings,
                cfg.referenceA4
              );
              if (closest) {
                targetString = closest.stringDef;
                targetFreq = closest.targetFreq;
                centsFromTarget = closest.cents;
              }
            }
          }

          setDetected({
            note: noteInfo,
            targetString,
            centsFromTarget,
            targetFreq,
            clarity: pitch.clarity,
            rms: pitch.rms,
          });

          // Stability hold before locking "¡CUERDA AFINADA!"
          if (Math.abs(centsFromTarget) <= cfg.toleranceCents) {
            if (inTuneSinceRef.current === null) {
              inTuneSinceRef.current = now;
            } else if (now - inTuneSinceRef.current >= STABILITY_HOLD_MS) {
              setIsLockedTuned(true);
            }
          } else {
            inTuneSinceRef.current = null;
            setIsLockedTuned(false);
          }
        } else if (now - lastHeardAtRef.current > 900) {
          freqHistoryRef.current = [];
          inTuneSinceRef.current = null;
          setIsLockedTuned(false);
          setDetected(null);
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission')) {
        setMicError(
          'Permiso de micrófono denegado. Habilitá el acceso al micrófono en la barra del navegador y volvé a intentarlo.'
        );
      } else if (msg.toLowerCase().includes('found') || msg.toLowerCase().includes('device')) {
        setMicError(
          'No se detectó ningún micrófono conectado en este dispositivo.'
        );
      } else {
        setMicError(
          'No pudimos iniciar el micrófono real. Verificá los permisos de audio del dispositivo.'
        );
      }
      stopMicrophone();
    }
  }, [stopMicrophone]);

  const handleSaveA4 = (val: number) => {
    const clamped = Math.max(430, Math.min(450, Math.round(val)));
    setReferenceA4(clamped);
    void vaultSet('music_tuner_a4', clamped);
  };

  const handleSaveTolerance = (val: number) => {
    const clamped = Math.max(1, Math.min(5, Math.round(val)));
    setToleranceCents(clamped);
    void vaultSet('music_tuner_tolerance', clamped);
  };

  const handleCreateCustomTuning = (e: React.FormEvent) => {
    e.preventDefault();
    const tokens = customNotesRaw
      .trim()
      .split(/[\s,;-]+/)
      .filter((t) => /^[A-Ga-g][#b]?-?\d$/.test(t));
    if (!customName.trim() || tokens.length < 3) return;

    const newPreset: TuningPreset = {
      id: `custom-${Date.now()}`,
      name: `${customName.trim()} (${tokens.map((t) => t.toUpperCase()).join(' ')})`,
      instrument: customInstrument,
      category: 'Personalizada',
      description: 'Afinación personalizada guardada en tu dispositivo.',
      strings: makeStrings(tokens),
      isCustom: true,
    };

    const next = [...customTunings, newPreset];
    setCustomTunings(next);
    setSelectedPresetId(newPreset.id);
    setLockedStringNumber(null);
    setCustomName('');
    setCustomOpen(false);
    void vaultSet('music_custom_tunings', next);
  };

  const handleDeleteCustomTuning = (id: string) => {
    const next = customTunings.filter((t) => t.id !== id);
    setCustomTunings(next);
    if (selectedPresetId === id) setSelectedPresetId('guitar-standard');
    void vaultSet('music_custom_tunings', next);
  };

  // Visual state derivation (RED / YELLOW / GREEN)
  const clampedCents = detected
    ? Math.max(-50, Math.min(50, detected.centsFromTarget))
    : 0;

  const zone: TuningZone = useMemo(() => {
    if (!detected) return 'idle';
    const abs = Math.abs(detected.centsFromTarget);
    if (abs <= toleranceCents) return 'tuned';
    if (abs <= 12) return 'close';
    return 'out';
  }, [detected, toleranceCents]);

  const needleAngleDeg = (clampedCents / 50) * 52; // -52deg to +52deg

  const zoneColor =
    zone === 'tuned'
      ? '#10B981'
      : zone === 'close'
      ? '#F59E0B'
      : zone === 'out'
      ? '#EF4444'
      : 'var(--fabro-accent)';

  const directionHint = !micActive
    ? 'Activá el micrófono real para detectar tu instrumento'
    : !detected
    ? 'Tocá una cuerda clara y sostenida...'
    : isLockedTuned
    ? '¡CUERDA AFINADA!'
    : zone === 'tuned'
    ? 'Manteniendo estabilidad...'
    : detected.centsFromTarget < 0
    ? 'Baja (subí tensión / apretá clavija)'
    : 'Alta (bajá tensión / aflojá clavija)';

  return (
    <div className="space-y-5">
      {/* Top Instrument Header */}
      <div className="rounded-2xl border fabro-futuristic-panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
              Afinador Digital Profesional
            </h2>
            <p className="text-xs fabro-muted">
              Detección real por micrófono (YIN) · Calibración A4 = {referenceA4} Hz · Tolerancia ±{toleranceCents} cents
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="fabro-btn-secondary"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Calibración</span>
            </button>
            <button
              type="button"
              onClick={() => (micActive ? stopMicrophone() : void startMicrophone())}
              className={
                micActive
                  ? 'min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-rose-500/60 bg-rose-600 text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95'
                  : 'fabro-btn-primary'
              }
            >
              {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{micActive ? 'Detener micrófono' : 'Activar micrófono'}</span>
            </button>
          </div>
        </div>

        {/* Honest Microphone Error Banner */}
        {micError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/50 bg-rose-500/12 px-4 py-3 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{micError}</p>
          </div>
        )}

        {/* Calibration & Sensitivity Drawer */}
        {settingsOpen && (
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">Calibración A4 (Hz)</span>
                <span className="font-mono font-extrabold tabular-nums fabro-accent-text">
                  {referenceA4} Hz
                </span>
              </div>
              <input
                type="range"
                min={430}
                max={450}
                step={1}
                value={referenceA4}
                onChange={(e) => handleSaveA4(Number(e.target.value))}
                className="w-full accent-[var(--fabro-accent)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] fabro-muted font-mono">
                <button type="button" onClick={() => handleSaveA4(432)} className="hover:underline cursor-pointer">432 Hz</button>
                <button type="button" onClick={() => handleSaveA4(440)} className="hover:underline cursor-pointer">440 Hz (Estándar)</button>
                <button type="button" onClick={() => handleSaveA4(444)} className="hover:underline cursor-pointer">444 Hz</button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">Tolerancia de afinación</span>
                <span className="font-mono font-extrabold tabular-nums text-emerald-500">
                  ±{toleranceCents} cents
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={toleranceCents}
                onChange={(e) => handleSaveTolerance(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[10px] fabro-muted">
                ±2 cents recomendado para precisión profesional de estudio.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold block">Sensibilidad / Puerta de ruido</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['baja', 'media', 'alta'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSensitivityLevel(lvl)}
                    className={`min-h-[34px] rounded-lg border text-xs font-bold capitalize cursor-pointer ${
                      sensitivityLevel === lvl
                        ? 'fabro-accent-border fabro-accent-bg'
                        : 'fabro-border fabro-surface'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="text-[10px] fabro-muted">
                Usá «Baja» en lugares ruidosos o «Alta» para guitarras acústicas suaves.
              </p>
            </div>
          </div>
        )}

        {/* Tuning Preset Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <label className="flex-1 min-w-0">
            <span className="sr-only">Seleccionar modo de afinación</span>
            <select
              value={selectedPresetId}
              onChange={(e) => {
                setSelectedPresetId(e.target.value);
                setLockedStringNumber(null);
              }}
              className="w-full min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3.5 text-xs font-bold fabro-input cursor-pointer"
            >
              {allPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  [{preset.category}] {preset.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className="fabro-btn-secondary shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Afinación personalizada</span>
          </button>

          {activePreset.isCustom && (
            <button
              type="button"
              onClick={() => handleDeleteCustomTuning(activePreset.id)}
              aria-label="Eliminar afinación personalizada"
              className="min-h-[40px] px-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Custom Tuning Form */}
        {customOpen && (
          <form
            onSubmit={handleCreateCustomTuning}
            className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-3 text-xs"
          >
            <p className="font-bold">Crear afinación personalizada</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ej: Drop C"
                className="min-h-[40px] rounded-lg border fabro-border fabro-surface px-3 fabro-input"
              />
              <select
                value={customInstrument}
                onChange={(e) => setCustomInstrument(e.target.value as 'guitar' | 'bass')}
                className="min-h-[40px] rounded-lg border fabro-border fabro-surface px-3 fabro-input"
              >
                <option value="guitar">Guitarra</option>
                <option value="bass">Bajo</option>
              </select>
              <input
                type="text"
                required
                value={customNotesRaw}
                onChange={(e) => setCustomNotesRaw(e.target.value)}
                placeholder="Notas grave a agudo: C2 G2 C3 F3 A3 D4"
                className="min-h-[40px] rounded-lg border fabro-border fabro-surface px-3 font-mono fabro-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                className="fabro-btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="fabro-btn-primary">
                Guardar afinación
              </button>
            </div>
          </form>
        )}

        {/* Main Electronic Tuner Instrument Display */}
        <div
          className="rounded-2xl border-2 p-5 sm:p-7 transition-all duration-200 relative overflow-hidden"
          style={{
            borderColor: isLockedTuned ? '#10B981' : zoneColor,
            background: isLockedTuned
              ? 'radial-gradient(circle at 50% 35%, rgba(16, 185, 129, 0.22), var(--fabro-surface-2) 72%)'
              : 'var(--fabro-surface-2)',
            boxShadow: isLockedTuned
              ? '0 0 38px -6px rgba(16, 185, 129, 0.52), inset 0 0 24px -8px rgba(16, 185, 129, 0.35)'
              : undefined,
          }}
        >
          {/* Status Banner inside Instrument */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide uppercase"
              style={{ color: zoneColor }}
            >
              {isLockedTuned ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  ¡CUERDA AFINADA!
                </>
              ) : (
                <span>{directionHint}</span>
              )}
            </span>

            {/* Live Mic Signal Bar */}
            <div className="flex items-center gap-2 text-[11px] font-mono fabro-muted">
              <span>Señal</span>
              <div className="w-20 h-2 rounded-full bg-black/25 overflow-hidden border fabro-border">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${micActive ? inputLevelPct : 0}%`,
                    backgroundColor: zoneColor,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Precision Arc Gauge SVG */}
          <div className="flex flex-col items-center">
            <svg
              viewBox="0 0 320 145"
              className="w-full max-w-[360px] h-auto overflow-visible"
              aria-label="Medidor de desviación en cents"
            >
              {/* Background Arc */}
              <path
                d="M 30 130 A 130 130 0 0 1 290 130"
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.16}
                strokeWidth={10}
                strokeLinecap="round"
              />

              {/* Red / Yellow / Green Zones */}
              <path
                d="M 30 130 A 130 130 0 0 1 112 20"
                fill="none"
                stroke="#EF4444"
                strokeOpacity={zone === 'out' && clampedCents < 0 ? 0.9 : 0.25}
                strokeWidth={8}
                strokeLinecap="round"
              />
              <path
                d="M 118 17 A 130 130 0 0 1 148 11"
                fill="none"
                stroke="#F59E0B"
                strokeOpacity={zone === 'close' && clampedCents < 0 ? 0.95 : 0.3}
                strokeWidth={8}
              />
              <path
                d="M 151 10.5 A 130 130 0 0 1 169 10.5"
                fill="none"
                stroke="#10B981"
                strokeOpacity={zone === 'tuned' ? 1 : 0.45}
                strokeWidth={11}
                strokeLinecap="round"
              />
              <path
                d="M 172 11 A 130 130 0 0 1 202 17"
                fill="none"
                stroke="#F59E0B"
                strokeOpacity={zone === 'close' && clampedCents > 0 ? 0.95 : 0.3}
                strokeWidth={8}
              />
              <path
                d="M 208 20 A 130 130 0 0 1 290 130"
                fill="none"
                stroke="#EF4444"
                strokeOpacity={zone === 'out' && clampedCents > 0 ? 0.9 : 0.25}
                strokeWidth={8}
                strokeLinecap="round"
              />

              {/* Scale Ticks (-50, -25, 0, +25, +50) */}
              {[-50, -25, 0, 25, 50].map((val) => {
                const rad = (((val / 50) * 52 - 90) * Math.PI) / 180;
                const x1 = 160 + Math.cos(rad) * 116;
                const y1 = 136 + Math.sin(rad) * 116;
                const x2 = 160 + Math.cos(rad) * 104;
                const y2 = 136 + Math.sin(rad) * 104;
                const tx = 160 + Math.cos(rad) * 92;
                const ty = 136 + Math.sin(rad) * 92;
                return (
                  <g key={val}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={val === 0 ? '#10B981' : 'currentColor'}
                      strokeOpacity={val === 0 ? 1 : 0.45}
                      strokeWidth={val === 0 ? 2.5 : 1.5}
                    />
                    <text
                      x={tx}
                      y={ty + 3}
                      textAnchor="middle"
                      fontSize={9}
                      fill="currentColor"
                      opacity={0.65}
                      className="font-mono font-bold"
                    >
                      {val > 0 ? `+${val}` : val}
                    </text>
                  </g>
                );
              })}

              {/* Animated Precision Needle */}
              <g
                transform={`rotate(${detected ? needleAngleDeg : 0} 160 136)`}
                style={{ transition: 'transform 90ms cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                <line
                  x1={160}
                  y1={136}
                  x2={160}
                  y2={24}
                  stroke={detected ? zoneColor : 'currentColor'}
                  strokeOpacity={detected ? 1 : 0.25}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
                <circle
                  cx={160}
                  cy={136}
                  r={7}
                  fill={detected ? zoneColor : 'var(--fabro-border)'}
                />
              </g>
            </svg>

            {/* Central Digital Readout (Note + Octave + Hz + Cents) */}
            <div className="mt-1 text-center space-y-1.5">
              <div className="flex items-baseline justify-center gap-1.5">
                <span
                  className="font-display text-6xl sm:text-7xl font-black tracking-tight tabular-nums leading-none transition-colors"
                  style={{ color: detected ? zoneColor : 'var(--fabro-text-muted)' }}
                >
                  {detected ? detected.note.noteName : '--'}
                </span>
                {detected && (
                  <span className="font-mono text-2xl font-bold fabro-muted tabular-nums">
                    {detected.note.octave}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm font-mono tabular-nums">
                <span className="font-bold">
                  {detected ? `${detected.note.exactFreq.toFixed(1)} Hz` : '0.0 Hz'}
                </span>
                <span
                  className="font-extrabold"
                  style={{ color: detected ? zoneColor : 'var(--fabro-text-muted)' }}
                >
                  {detected
                    ? `${detected.centsFromTarget > 0 ? '+' : ''}${detected.centsFromTarget.toFixed(1)} cents`
                    : '0.0 cents'}
                </span>
                {detected?.targetString && (
                  <span className="fabro-muted">
                    Objetivo: Cuerda {detected.targetString.stringNumber} ({detected.targetString.label} · {detected.targetFreq.toFixed(1)} Hz)
                  </span>
                )}
              </div>
            </div>

            {/* Linear Precision Cents Bar */}
            <div className="w-full max-w-md mt-4 space-y-1">
              <div className="relative h-3 rounded-full bg-black/25 border fabro-border overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-emerald-400 z-10 -translate-x-1/2" />
                {detected && (
                  <div
                    className="absolute top-0.5 bottom-0.5 w-4 rounded-full transition-all duration-75"
                    style={{
                      left: `calc(${((clampedCents + 50) / 100) * 100}% - 8px)`,
                      backgroundColor: zoneColor,
                      boxShadow: `0 0 12px ${zoneColor}`,
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] font-mono fabro-muted">
                <span>♭ Grave (-50c)</span>
                <span className="text-emerald-500 font-bold">0c Exacto</span>
                <span>Aguda (+50c) ♯</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Target Strings + Playable Reference Tones */}
        {activePreset.strings.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold">
                Cuerdas de {activePreset.name}
              </span>
              <div className="flex items-center gap-2">
                {lockedStringNumber !== null ? (
                  <button
                    type="button"
                    onClick={() => setLockedStringNumber(null)}
                    className="text-[11px] font-bold fabro-accent-text hover:underline cursor-pointer"
                  >
                    Volver a detección automática
                  </button>
                ) : (
                  <span className="text-[11px] fabro-muted">
                    Tocá una cuerda para fijarla o escuchar su tono de referencia
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {activePreset.strings.map((str) => {
                const freq = midiToFrequency(str.midi, referenceA4);
                const isTarget =
                  lockedStringNumber === str.stringNumber ||
                  (lockedStringNumber === null &&
                    detected?.targetString?.stringNumber === str.stringNumber);
                const isThisTuned = isTarget && isLockedTuned;

                return (
                  <div
                    key={`${activePreset.id}-${str.stringNumber}-${str.label}`}
                    className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 transition-all ${
                      isThisTuned
                        ? 'border-emerald-500 bg-emerald-500/15'
                        : isTarget
                        ? 'fabro-accent-border fabro-accent-soft'
                        : 'fabro-border fabro-surface-elevated'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setLockedStringNumber((cur) =>
                          cur === str.stringNumber ? null : str.stringNumber
                        );
                        playReferenceTone(freq, 1.1);
                      }}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-lg font-black leading-none">
                          {str.noteName}
                        </span>
                        <span className="font-mono text-[11px] fabro-muted">{str.octave}</span>
                      </div>
                      <p className="text-[10px] font-mono fabro-muted tabular-nums mt-0.5">
                        C{str.stringNumber} · {freq.toFixed(1)}Hz
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => playReferenceTone(freq, 1.35)}
                      title={`Escuchar tono ${str.label}`}
                      aria-label={`Escuchar tono de referencia ${str.label}`}
                      className="h-8 w-8 rounded-lg border fabro-border fabro-surface flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
                    >
                      <Volume2 className="w-3.5 h-3.5 fabro-accent-text" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
