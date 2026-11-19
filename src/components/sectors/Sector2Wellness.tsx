import React, { useState } from 'react';
import {
  CalendarCheck,
  CheckSquare,
  Dumbbell,
  Feather,
  Flame,
  Heart,
  Play,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { DEFAULT_MOBILITY_ROUTINE } from '../../services/localVault';
import { activateMediaSession, stopMediaSession } from '../../services/mediaSessionBridge';
import type { WellnessSubmenuId } from '../../types/ecosystem';
import { ShareResourceButton } from '../common/ShareResourceButton';
import { OrganizerHub } from '../organizer/OrganizerHub';
import { SectorLayout } from './SectorLayout';
import { BreathingTool } from './wellness/BreathingTool';
import { CalisthenicsTimerTool } from './wellness/CalisthenicsTimerTool';
import { GuidedStoicReflectionsTool } from './wellness/GuidedStoicReflectionsTool';
import { HydrationSleepTool } from './wellness/HydrationSleepTool';
import { StoicRouletteTool } from './wellness/StoicRouletteTool';
import { TimeCapsuleTool } from './wellness/TimeCapsuleTool';

export const Sector2Wellness: React.FC = () => {
  const {
    submenu,
    navigateTo,
    profile,
    updateProfile,
    moodLogs,
    addMoodLog,
    balancedPlanner,
    toggleBalancedPlanner,
    examplesCleared,
    clearSeedExamples,
  } = useEcosystem();
  const activeSub: WellnessSubmenuId =
    submenu === 'mi-vida' ||
    submenu === 'organizador-integral' ||
    submenu === 'organizacion-calorias' ||
    submenu === 'salud-ejercicios' ||
    submenu === 'bienestar-emocional' ||
    submenu === 'escritura-recuerdos'
      ? submenu
      : 'mi-vida';

  const [happinessScore, setHappinessScore] = useState(8);
  const [gratitudeNote, setGratitudeNote] = useState(
    'Agradezco tener salud, claridad para crear y tiempo compartido con las personas que quiero.'
  );
  const [caloriesIn, setCaloriesIn] = useState(1450);
  const [caloriesBurned, setCaloriesBurned] = useState(320);
  const [writingTitle, setWritingTitle] = useState('Carta para mi presente');
  const [writingText, setWritingText] = useState(
    'Si hoy fuera mi último día, elegiría escuchar con calma, agradecer sin prisa y dejar palabras honestas.'
  );
  const [speaking, setSpeaking] = useState(false);

  const handleReadAloud = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      stopMediaSession('speech');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(`${writingTitle}. ${writingText}`);
    utterance.lang = 'es-ES';
    utterance.onend = () => {
      setSpeaking(false);
      stopMediaSession('speech');
    };
    utterance.onerror = () => {
      setSpeaking(false);
      stopMediaSession('speech');
    };
    setSpeaking(true);
    activateMediaSession({
      title: writingTitle || 'Lectura personal FABRO',
      artist: 'Escritura y Legado · Sector 2',
      album: '🍀 FABRO · Lectura por Voz',
      mode: 'speech',
      playbackState: 'playing',
      handlers: {
        onPause: () => {
          window.speechSynthesis.cancel();
          setSpeaking(false);
          stopMediaSession('speech');
        },
        onStop: () => {
          window.speechSynthesis.cancel();
          setSpeaking(false);
          stopMediaSession('speech');
        },
      },
    });
    window.speechSynthesis.speak(utterance);
  };

  return (
    <SectorLayout
      sectorId="bienestar"
      activeSubmenu={activeSub}
      badgeText="El Último Día de Tu Vida"
    >
      {/* Stoic Identity Anchor */}
      <div className="rounded-2xl border-2 border-[#10B981]/35 bg-gradient-to-r from-[#10B981]/10 via-transparent to-[#F59E0B]/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#047857] dark:text-[#34D399]">
            Filosofía del Sector 2
          </p>
          <p className="font-display text-base sm:text-lg font-bold mt-0.5">
            «Si hoy fuera tu último día, ¿cómo elegirías vivirlo?»
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="rounded-full border-2 border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-1 text-xs font-semibold text-[#B45309] dark:text-[#FBBF24]">
            Privacidad local · IndexedDB Offline
          </span>
          {!examplesCleared && (
            <button
              type="button"
              onClick={() => void clearSeedExamples()}
              className="inline-flex items-center gap-1 text-[11px] fabro-muted hover:text-rose-600 cursor-pointer underline"
            >
              <Trash2 className="w-3 h-3" />
              Borrar ejemplos
            </button>
          )}
        </div>
      </div>

      {activeSub === 'organizador-integral' && <OrganizerHub />}

      {activeSub === 'mi-vida' && (
        <div className="space-y-5">
          <GuidedStoicReflectionsTool />

          <StoicRouletteTool />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border-2 border-[#10B981]/30 fabro-surface p-5 space-y-4">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                A. Mi Vida — Reflexión, deseos y recuerdos
              </h2>
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3.5">
                  <p className="font-semibold">Actividades que generan felicidad</p>
                  <p className="fabro-muted mt-1">
                    Caminar al aire libre al amanecer, conversar sin pantallas, leer filosofía estoica y aprender algo nuevo.
                  </p>
                </div>
                <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3.5">
                  <p className="font-semibold">Sueños pendientes y objetivos vitales</p>
                  <p className="fabro-muted mt-1">
                    Escribir un libro personal de recuerdos · Completar un viaje tranquilo en familia.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[#10B981]/30 fabro-surface p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold">Perfil de gustos personales</h2>
                <label className="min-h-[44px] inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.shareTastesPublicly}
                    onChange={(e) => updateProfile({ shareTastesPublicly: e.target.checked })}
                    className="w-4 h-4 rounded accent-[#10B981]"
                  />
                  <span>Compartir en perfil público</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {(
                  [
                    { key: 'music', label: 'Música favorita' },
                    { key: 'movies', label: 'Películas favoritas' },
                    { key: 'books', label: 'Libros favoritos' },
                    { key: 'food', label: 'Comidas favoritas' },
                    { key: 'drinks', label: 'Bebidas favoritas' },
                  ] as const
                ).map((field) => (
                  <label key={field.key} className="space-y-1 block">
                    <span className="fabro-muted font-medium">{field.label}</span>
                    <input
                      type="text"
                      value={profile.tastes[field.key]}
                      onChange={(e) =>
                        updateProfile({
                          tastes: { ...profile.tastes, [field.key]: e.target.value },
                        })
                      }
                      className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSub === 'organizacion-calorias' && (
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-[#0EA5E9]/40 bg-[#0EA5E9]/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-[#0284C7] dark:text-[#38BDF8]">
                ¿Querés organizar tu día por bloques horarios y prioridades?
              </p>
              <p className="fabro-muted">
                Usá el Organizador Integral con Bandeja Rápida, Matriz Eisenhower y Revisión Diaria.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('bienestar', 'organizador-integral')}
              className="min-h-[44px] rounded-xl border-2 border-[#0EA5E9] bg-[#0EA5E9] text-white px-4 py-2 font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Abrir Organizador Integral
            </button>
          </div>

          <HydrationSleepTool />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border-2 border-[#F59E0B]/35 fabro-surface p-5 space-y-4">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#F59E0B]" />
                Contador de calorías y balance diario
              </h2>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3">
                  <p className="text-[11px] fabro-muted">Consumidas</p>
                  <p className="text-lg font-bold mt-0.5">{caloriesIn} kcal</p>
                </div>
                <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3">
                  <p className="text-[11px] fabro-muted">Quemadas</p>
                  <p className="text-lg font-bold mt-0.5">{caloriesBurned} kcal</p>
                </div>
                <div className="rounded-xl border-2 border-[#F59E0B]/35 fabro-surface-elevated p-3">
                  <p className="text-[11px] fabro-muted">Balance neto</p>
                  <p className="text-lg font-bold text-[#B45309] dark:text-[#FBBF24] mt-0.5">
                    {caloriesIn - caloriesBurned} kcal
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCaloriesIn((v) => v + 250)}
                  className="min-h-[44px] rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(245,158,11,0.5)] cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                >
                  +250 kcal comida
                </button>
                <button
                  type="button"
                  onClick={() => setCaloriesBurned((v) => v + 120)}
                  className="min-h-[44px] rounded-xl border-2 border-[#10B981] bg-[#10B981]/15 text-[#047857] dark:text-[#34D399] px-4 py-2 text-xs font-bold cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                >
                  +120 kcal ejercicio
                </button>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[#10B981]/30 fabro-surface p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-[#10B981]" />
                  Planificador diario equilibrado (enfoque, descanso, hidratación)
                </h2>
              </div>
              <div className="space-y-2 text-xs">
                {balancedPlanner.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => toggleBalancedPlanner(row.id)}
                    className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {row.done ? (
                        <CheckSquare className="w-4 h-4 text-[#10B981] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 fabro-muted shrink-0" />
                      )}
                      <span className="font-mono font-bold text-[#047857] dark:text-[#34D399] shrink-0">
                        {row.time}
                      </span>
                      <span className={row.done ? 'line-through opacity-60' : ''}>
                        {row.activity}
                      </span>
                    </span>
                    <span className="rounded-lg border fabro-border px-2 py-0.5 text-[10px] font-bold shrink-0">
                      {row.block}
                    </span>
                  </button>
                ))}
              </div>
              <ShareResourceButton
                compact
                label="Compartir plantilla por WhatsApp"
                payload={{
                  v: 1,
                  kind: 'note',
                  title: 'Planificador Diario Equilibrado FABRO',
                  subject: 'Bienestar y Hábitos',
                  body: balancedPlanner
                    .map((p) => `• ${p.time} [${p.block}]: ${p.activity}`)
                    .join('\n'),
                  author: profile.displayName,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {activeSub === 'salud-ejercicios' && (
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-[#10B981]/40 bg-[#10B981]/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-[#047857] dark:text-[#34D399]">
                Rutina lista para iniciar y compartir
              </p>
              <h3 className="font-display text-base font-bold">{DEFAULT_MOBILITY_ROUTINE.title}</h3>
              <p className="text-xs fabro-muted">
                {DEFAULT_MOBILITY_ROUTINE.rounds} rondas ({DEFAULT_MOBILITY_ROUTINE.workSec}s activo /{' '}
                {DEFAULT_MOBILITY_ROUTINE.restSec}s descanso) · Ideal para activar cuerpo y mente.
              </p>
            </div>
            <ShareResourceButton
              label="Compartir rutina por WhatsApp"
              payload={{
                v: 1,
                kind: 'routine',
                title: DEFAULT_MOBILITY_ROUTINE.title,
                category: DEFAULT_MOBILITY_ROUTINE.category,
                workSec: DEFAULT_MOBILITY_ROUTINE.workSec,
                restSec: DEFAULT_MOBILITY_ROUTINE.restSec,
                rounds: DEFAULT_MOBILITY_ROUTINE.rounds,
                steps: DEFAULT_MOBILITY_ROUTINE.steps,
                author: profile.displayName,
              }}
            />
          </div>

          <CalisthenicsTimerTool />

          <div className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2 md:pb-0">
            {[
              {
                title: 'Movilidad y estiramiento cervical',
                category: 'Movilidad / Estiramientos',
                duration: '8 min',
                level: 'Nivel 1 · Principiante',
                steps: '1. Rotaciones lentas de hombros · 2. Inclinación lateral sin forzar · 3. Respiración diafragmática.',
                safety: 'Detener ante mareo o dolor agudo en articulaciones.',
              },
              {
                title: 'Calistenia funcional + respiración 4-4-6',
                category: 'Calistenia / Respiración / Meditación',
                duration: '15 min',
                level: 'Nivel 2 · Intermedio',
                steps: '1. Sentadillas controladas (3x10) · 2. Flexiones inclinadas · 3. Descanso y relajación guiada.',
                safety: 'Mantener columna neutra y calentar muñecas antes de apoyar peso.',
              },
            ].map((ex) => (
              <article
                key={ex.title}
                className="min-w-[85%] sm:min-w-[60%] md:min-w-0 snap-start rounded-2xl border-2 border-[#10B981]/30 fabro-surface p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#047857] dark:text-[#34D399] font-bold">{ex.category}</p>
                    <h3 className="font-display text-base font-bold mt-0.5">{ex.title}</h3>
                  </div>
                  <Dumbbell className="w-5 h-5 text-[#10B981] shrink-0" />
                </div>

                <div className="rounded-xl border-2 fabro-border fabro-surface-elevated h-32 flex flex-col items-center justify-center gap-2 text-xs fabro-muted">
                  <Play className="w-6 h-6 text-[#10B981]" />
                  <span>Espacio para guía demostrativa local / offline</span>
                </div>

                <p className="text-xs font-mono tabular-nums fabro-muted">
                  Duración: {ex.duration} · {ex.level}
                </p>
                <p className="text-xs leading-relaxed">{ex.steps}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>Seguridad: {ex.safety}</span>
                </p>

                <ShareResourceButton
                  compact
                  label="WhatsApp"
                  payload={{
                    v: 1,
                    kind: 'routine',
                    title: ex.title,
                    category: ex.category,
                    workSec: 30,
                    restSec: 15,
                    rounds: 6,
                    steps: ex.steps.split('·').map((s) => s.trim()),
                    author: profile.displayName,
                  }}
                />
              </article>
            ))}
          </div>
        </div>
      )}

      {activeSub === 'bienestar-emocional' && (
        <div className="space-y-5">
          <BreathingTool />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border-2 border-[#10B981]/30 fabro-surface p-6 space-y-4">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#10B981]" strokeWidth={1.75} />
                Registro diario de felicidad (Escala 1 al 10)
              </h2>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setHappinessScore(num)}
                    className={`min-h-[44px] min-w-[44px] rounded-xl border-2 text-xs font-mono font-bold tabular-nums cursor-pointer transition-all active:scale-95 ${
                      happinessScore === num
                        ? 'border-[#10B981] bg-[#10B981] text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.6)]'
                        : 'fabro-border fabro-surface-elevated hover:border-[#10B981]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs fabro-muted font-mono tabular-nums">
                  Nivel declarado hoy: {happinessScore}/10
                </p>
                <button
                  type="button"
                  onClick={() =>
                    addMoodLog(
                      happinessScore,
                      happinessScore >= 7 ? 'Serenidad y gratitud' : 'En observación',
                      'Registro Sector 2'
                    )
                  }
                  className="min-h-[44px] rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
                >
                  Guardar emoción ({moodLogs.length})
                </button>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[#F59E0B]/30 fabro-surface p-6 space-y-3">
              <h2 className="font-display text-base font-bold">
                Gratitud, esperanza y motivación
              </h2>
              <textarea
                rows={4}
                value={gratitudeNote}
                onChange={(e) => setGratitudeNote(e.target.value)}
                aria-label="Registro de gratitud y motivación"
                className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed fabro-input"
              />
            </div>
          </div>
        </div>
      )}

      {activeSub === 'escritura-recuerdos' && (
        <div className="space-y-5">
          <TimeCapsuleTool />

          <div className="rounded-2xl border-2 border-[#10B981]/30 fabro-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Feather className="w-4 h-4 text-[#F59E0B]" />
                E. Escritura, diarios, cartas, legado y lectura por voz
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReadAloud}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  {speaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  {speaking ? 'Detener voz' : 'Leer en voz (Web Speech)'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-4 py-2 text-xs font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  Exportar PDF
                </button>
              </div>
            </div>

            <input
              type="text"
              value={writingTitle}
              onChange={(e) => setWritingTitle(e.target.value)}
              aria-label="Título de escritura personal"
              className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-sm font-semibold fabro-input"
            />
            <textarea
              rows={5}
              value={writingText}
              onChange={(e) => setWritingText(e.target.value)}
              aria-label="Texto de diario o legado"
              className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed fabro-input"
            />
          </div>
        </div>
      )}
    </SectorLayout>
  );
};
