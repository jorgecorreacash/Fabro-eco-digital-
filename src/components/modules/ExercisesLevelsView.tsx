import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { useHabitTimer } from '../../context/HabitTimerContext';
import { playHabitAlertSound, stopHabitAlertSound } from '../../lib/habitSound';
import { cacheSnapshotCollection, getCachedCollection } from '../../lib/offlineStore';
import type {
  ExerciseDemoAnimationId,
  ExerciseFocusCategory,
  ExerciseLevelId,
  ExerciseLogEntry,
  ExerciseRoutine,
} from '../../types/fabro';

const LEVEL_META: Array<{
  id: ExerciseLevelId;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'inicial',
    label: 'Nivel 1 · Inicial',
    subtitle: 'Movilidad suave, respiración consciente y pausas activas',
  },
  {
    id: 'intermedio',
    label: 'Nivel 2 · Intermedio',
    subtitle: 'Fuerza funcional en casa, estiramientos y resistencia',
  },
  {
    id: 'avanzado',
    label: 'Nivel 3 · Avanzado',
    subtitle: 'Circuitos de cuerpo completo e intervalos de energía',
  },
  {
    id: 'maestro',
    label: 'Nivel 4 · Maestro',
    subtitle: 'Alta exigencia neuromuscular, balance y control profundo',
  },
];

const FOCUS_LABELS: Record<ExerciseFocusCategory, string> = {
  respiracion: 'Respiración',
  relajacion: 'Relajación',
  estiramientos: 'Estiramientos',
  movilidad: 'Movilidad',
  fuerza: 'Fuerza física',
  cardio: 'Cardio',
  meditacion: 'Meditación',
  descanso: 'Descanso',
  bienestar_emocional: 'Bienestar emocional',
  postura: 'Postura',
};

const BASE_ROUTINES: ExerciseRoutine[] = [
  {
    id: 'ex_ini_resp',
    title: 'Respiración Cuadrada 4-4-4-4 y Calma',
    level: 'inicial',
    category: 'respiracion',
    totalMinutes: 5,
    caloriesApprox: 12,
    description: 'Regula el sistema nervioso antes de estudiar, rendir un examen o descansar.',
    objective: 'Reducir tensión inmediata, equilibrar ritmo respiratorio y despejar la mente.',
    musclesWorked: ['Diafragma', 'Intercostales', 'Cuello relajado'],
    beginnerAlternative: 'Si retener 4s te resulta incómodo, hacé 3s inhalar - 2s sostener - 4s exhalar.',
    safetyWarning: 'Detenete si sentís mareo o hiperventilación; volvé a tu respiración nasal natural.',
    demoAnim: 'box_breath',
    steps: [
      { name: 'Postura sentada con columna erguida', durationSec: 60, repsHint: '1 minuto', cue: 'Aflojá hombros y apoyá ambos pies en el piso.' },
      { name: 'Ciclo cuadrado: inhalar 4s, retener 4s, exhalar 4s, pausa 4s', durationSec: 180, repsHint: '10 ciclos suaves', cue: 'Seguí el anillo visual de expansión y descenso.' },
      { name: 'Respiración nasal libre de cierre', durationSec: 60, repsHint: '5 respiraciones amplias', cue: 'Registrá la calma en el pecho y la mandíbula.' },
    ],
  },
  {
    id: 'ex_ini_pausa',
    title: 'Despertar Articular y Pausa Postural',
    level: 'inicial',
    category: 'postura',
    totalMinutes: 6,
    caloriesApprox: 25,
    description: 'Libera cuello, hombros y espalda baja luego de leer o usar la computadora.',
    objective: 'Prevenir rigidez cervical y mejorar alineación torácica.',
    musclesWorked: ['Trapecio superior', 'Romboides', 'Espalda media'],
    beginnerAlternative: 'Realizá todo sentado en silla con movimientos más cortos y sin forzar el cuello.',
    safetyWarning: 'Evitá llevar la cabeza hacia atrás si tenés vértigo o dolor cervical agudo.',
    demoAnim: 'neck_shoulder',
    steps: [
      { name: 'Círculos lentos de hombros y cuello', durationSec: 60, repsHint: '8 por lado', cue: 'Mové hombros hacia arriba, atrás y abajo suavemente.' },
      { name: 'Gato-vaca de pie o sentado', durationSec: 90, repsHint: '12 ciclos', cue: 'Inhalá al abrir el pecho, exhalá al redondear la columna.' },
      { name: 'Apertura pectoral en W', durationSec: 90, repsHint: '3 series x 10', cue: 'Juntá omóplatos sin encoger hombros hacia las orejas.' },
      { name: 'Respiración diafragmática 4-6', durationSec: 120, repsHint: '6 ciclos', cue: 'Exhalá más lento de lo que inhalás.' },
    ],
  },
  {
    id: 'ex_ini_estir',
    title: 'Estiramientos Suaves y Descanso Activo',
    level: 'inicial',
    category: 'estiramientos',
    totalMinutes: 7,
    caloriesApprox: 20,
    description: 'Secuencia restaurativa ideal para el final del día o antes de dormir.',
    objective: 'Alargar cadena posterior sin rebotes y favorecer el descanso nocturno.',
    musclesWorked: ['Isquiotibiales', 'Lumbares', 'Gemelos', 'Caderas'],
    beginnerAlternative: 'Flexioná suavemente las rodillas en los estiramientos de piernas.',
    safetyWarning: 'No estires hasta sentir dolor punzante; buscá una tensión amable (6/10).',
    demoAnim: 'stretch_hamstring',
    steps: [
      { name: 'Inclinación suave con rodillas semidobladas', durationSec: 120, repsHint: 'Respirando lento', cue: 'Soltá el peso de los brazos hacia las pantorrillas.' },
      { name: 'Estiramiento gato-vaca en colchoneta o silla', durationSec: 120, repsHint: '10 ciclos amplios', cue: 'Sincronizá vértebra por vértebra.' },
      { name: 'Descarga lumbar y relajación guiada', durationSec: 180, repsHint: '3 minutos', cue: 'Dejá que la exhalación suelte la tensión del abdomen.' },
    ],
  },
  {
    id: 'ex_ini_med',
    title: 'Meditación y Escaneo de Bienestar Emocional',
    level: 'inicial',
    category: 'meditacion',
    totalMinutes: 8,
    caloriesApprox: 10,
    description: 'Práctica guiada de atención plena para ordenar pensamientos y reducir estrés.',
    objective: 'Aumentar claridad mental, serenidad y regulación emocional diaria.',
    musclesWorked: ['Relajación facial', 'Diafragma', 'Cuerpo completo en reposo'],
    beginnerAlternative: 'Si te cuesta cerrar los ojos, fijá la mirada suavemente en un punto del piso.',
    safetyWarning: 'Orientación de bienestar; si experimentás angustia intensa, pedí acompañamiento profesional.',
    demoAnim: 'calm_scan',
    steps: [
      { name: 'Anclaje al cuerpo y contacto con el asiento', durationSec: 120, repsHint: '2 minutos', cue: 'Sentí el peso estable en pies y caderas.' },
      { name: 'Escaneo de frente, mandíbula, hombros y manos', durationSec: 180, repsHint: '3 minutos', cue: 'Soltá cada zona al exhalar sin juzgar.' },
      { name: 'Afirmación amable y gratitud', durationSec: 180, repsHint: '3 minutos', cue: 'Agradecé un momento valioso del día de hoy.' },
    ],
  },
  {
    id: 'ex_ini_descanso',
    title: 'Pausa Nocturna para Mejorar el Descanso',
    level: 'inicial',
    category: 'descanso',
    totalMinutes: 6,
    caloriesApprox: 14,
    description: 'Ritual de descompresión física y mental antes de acostarse.',
    objective: 'Bajar activación del día y preparar el cuerpo para el sueño reparador.',
    musclesWorked: ['Cuello', 'Espalda alta', 'Respiración abdominal'],
    beginnerAlternative: 'Podés hacerlo recostado directamente sobre la cama.',
    safetyWarning: 'Evitá pantallas brillantes durante la última etapa del descanso.',
    demoAnim: 'box_breath',
    steps: [
      { name: 'Afloje de mandíbula y hombros', durationSec: 90, repsHint: 'Suave', cue: 'Bajá los hombros lejos de las orejas.' },
      { name: 'Respiración prolongada 4-7', durationSec: 150, repsHint: '8 ciclos', cue: 'Exhalá largo como soplando una vela sin apagarla.' },
      { name: 'Quietud silenciosa', durationSec: 120, repsHint: '2 minutos', cue: 'Dejá pasar los pensamientos pendientes hasta mañana.' },
    ],
  },
  {
    id: 'ex_ini_emo',
    title: 'Relajación y Liberación Emocional',
    level: 'inicial',
    category: 'bienestar_emocional',
    totalMinutes: 7,
    caloriesApprox: 18,
    description: 'Combina descarga corporal suave con respiración reconfortante.',
    objective: 'Transformar tensión acumulada en sensación de alivio y presencia.',
    musclesWorked: ['Pecho', 'Brazos', 'Abdomen relajado'],
    beginnerAlternative: 'Hacé solo la parte sentada y repetí el ritmo que te resulte cómodo.',
    safetyWarning: 'No forces emociones; acompañá el ritmo natural de tu respiración.',
    demoAnim: 'calm_scan',
    steps: [
      { name: 'Sacudida suave de manos y muñecas', durationSec: 90, repsHint: '90 segundos', cue: 'Soltá la energía acumulada con naturalidad.' },
      { name: 'Mano al pecho y respiración cálida', durationSec: 180, repsHint: '3 minutos', cue: 'Observá el movimiento suave al inhalar.' },
      { name: 'Cierre de relajación progresiva', durationSec: 150, repsHint: '2m 30s', cue: 'Tensión 3s y suelta completa en brazos y piernas.' },
    ],
  },
  {
    id: 'ex_ini_movilidad',
    title: 'Movilidad Natural Matutina',
    level: 'inicial',
    category: 'movilidad',
    totalMinutes: 8,
    caloriesApprox: 38,
    description: 'Activación progresiva sin impacto para lubricar caderas, tobillos y columna.',
    objective: 'Despertar articulaciones con rango seguro al comenzar el día.',
    musclesWorked: ['Cuádriceps', 'Glúteos', 'Caderas', 'Tobillos'],
    beginnerAlternative: 'Apoyate en el respaldo de una silla para sentadillas y rotaciones.',
    safetyWarning: 'Si sentís pinchazo en rodillas, reducí la profundidad de la sentadilla.',
    demoAnim: 'squat_chair',
    steps: [
      { name: 'Marcha suave elevando rodillas', durationSec: 120, repsHint: 'Ritmo cómodo', cue: 'Balanceá brazos de manera natural.' },
      { name: 'Rotaciones de cadera y tobillos', durationSec: 120, repsHint: '10 círculos por lado', cue: 'Apoyate si necesitás estabilidad.' },
      { name: 'Sentadilla asistida a silla', durationSec: 120, repsHint: '3 x 8 repeticiones', cue: 'Bajá controlado llevando caderas hacia atrás.' },
      { name: 'Estiramiento posterior de piernas', durationSec: 120, repsHint: '60s por pierna', cue: 'Mantené la columna larga sin forzar.' },
    ],
  },
  {
    id: 'ex_int_funcional',
    title: 'Fuerza Funcional Sin Pesas',
    level: 'intermedio',
    category: 'fuerza',
    totalMinutes: 14,
    caloriesApprox: 95,
    description: 'Rutina equilibrada para fortalecer piernas, zona media y tren superior en casa.',
    objective: 'Desarrollar fuerza funcional y estabilidad del core sin equipamiento.',
    musclesWorked: ['Cuádriceps', 'Glúteos', 'Pectorales', 'Tríceps', 'Core'],
    beginnerAlternative: 'Hacé flexiones apoyando manos en mesa o rodillas en el piso.',
    safetyWarning: 'Mantené abdomen firme para proteger zona lumbar en flexiones y planchas.',
    demoAnim: 'squat_chair',
    steps: [
      { name: 'Movilidad dinámica de calentamiento', durationSec: 120, repsHint: 'Continuo', cue: 'Prepará muñecas, hombros y caderas.' },
      { name: 'Sentadillas clásicas controladas', durationSec: 180, repsHint: '3 x 15 reps', cue: 'Rodillas alineadas con la punta de los pies.' },
      { name: 'Flexiones de brazos inclinadas o estándar', durationSec: 180, repsHint: '3 x 10-12 reps', cue: 'Activá el abdomen evitando que la cadera caiga.' },
      { name: 'Estocadas alternadas hacia atrás', durationSec: 180, repsHint: '3 x 10 por pierna', cue: 'Torso erguido y bajada controlada.' },
      { name: 'Plancha abdominal sostenida', durationSec: 180, repsHint: '3 x 35s / 25s pausa', cue: 'Empujá el suelo con los antebrazos.' },
    ],
  },
  {
    id: 'ex_int_relax',
    title: 'Relajación Muscular Progresiva + Estiramiento',
    level: 'intermedio',
    category: 'relajacion',
    totalMinutes: 10,
    caloriesApprox: 28,
    description: 'Libera rigidez neuromuscular alternando micro-tensión y suelta consciente.',
    objective: 'Disminuir tensión muscular crónica por estrés o largas jornadas sentado.',
    musclesWorked: ['Espalda', 'Hombros', 'Antebrazos', 'Piernas'],
    beginnerAlternative: 'Solo aflojá sin contraer fuerte si tenés calambres frecuentes.',
    safetyWarning: 'Nunca hagas fuerza máxima en zona cervical durante la fase de contracción.',
    demoAnim: 'cat_cow',
    steps: [
      { name: 'Movilidad fluida de columna (gato-vaca)', durationSec: 180, repsHint: '15 ciclos', cue: 'Respiración nasal coordinada.' },
      { name: 'Relajación progresiva brazos y hombros', durationSec: 210, repsHint: '4 bloques', cue: 'Apretá puños 4s y soltá 12s sintiendo el calor.' },
      { name: 'Estiramiento global y calma', durationSec: 210, repsHint: 'Suave', cue: 'Soltá cualquier resto de prisa.' },
    ],
  },
  {
    id: 'ex_int_cardio',
    title: 'Cardio Saludable Oxigenante',
    level: 'intermedio',
    category: 'cardio',
    totalMinutes: 12,
    caloriesApprox: 115,
    description: 'Eleva tu frecuencia cardíaca de forma segura para mejorar energía y enfoque.',
    objective: 'Mejorar capacidad aeróbica y vitalidad diaria sin saltos agresivos.',
    musclesWorked: ['Sistema cardiovascular', 'Gemelos', 'Hombros', 'Core'],
    beginnerAlternative: 'Cambiá jumping jacks por paso lateral sin impacto.',
    safetyWarning: 'Si sentís falta de aire severa o palpitaciones inusuales, bajá el ritmo caminando.',
    demoAnim: 'jumping_pulse',
    steps: [
      { name: 'Trote en el lugar suave', durationSec: 120, repsHint: '2 minutos', cue: 'Aterrizá suave sobre la parte media del pie.' },
      { name: 'Jumping jacks / Paso lateral dinámico', durationSec: 180, repsHint: '4 x 30s / 15s pausa', cue: 'Mantené ritmo constante y brazos sueltos.' },
      { name: 'Escaladores controlados', durationSec: 180, repsHint: '3 x 35s', cue: 'Llevá rodillas al pecho con control del core.' },
      { name: 'Vuelta a la calma y respiración', durationSec: 240, repsHint: 'Continuo', cue: 'Bajá pulsaciones caminando despacio.' },
    ],
  },
  {
    id: 'ex_adv_hiit',
    title: 'Circuito Metabólico de Cuerpo Completo',
    level: 'avanzado',
    category: 'cardio',
    totalMinutes: 18,
    caloriesApprox: 185,
    description: 'Entrenamiento por intervalos para desarrollar potencia y resistencia.',
    objective: 'Potenciar resistencia muscular y capacidad aeróbica de alta densidad.',
    musclesWorked: ['Piernas completas', 'Core', 'Pecho', 'Hombros'],
    beginnerAlternative: 'Reemplazá burpees por sentadilla + paso atrás sin salto.',
    safetyWarning: 'Solo para personas sin lesiones agudas articulares ni contraindicación cardiológica.',
    demoAnim: 'jumping_pulse',
    steps: [
      { name: 'Calentamiento articular + skipping', durationSec: 180, repsHint: '3 minutos', cue: 'Subí temperatura gradualmente.' },
      { name: 'Sentadilla con pulso o salto controlado', durationSec: 240, repsHint: '4 x 40s / 20s pausa', cue: 'Amortiguá al caer flexionando rodillas.' },
      { name: 'Plancha con toque de hombro alterno', durationSec: 240, repsHint: '4 x 12-16 reps', cue: 'Evitá rotar la cadera al levantar cada mano.' },
      { name: 'Burpees adaptados o completos', durationSec: 240, repsHint: '4 x 35s / 25s pausa', cue: 'Buscá fluidez técnica.' },
      { name: 'Descarga y elongación profunda', durationSec: 180, repsHint: '3 minutos', cue: 'Normalizá el pulso gradualmente.' },
    ],
  },
  {
    id: 'ex_mae_atleta',
    title: 'Maestría Corporal & Control Isométrico',
    level: 'maestro',
    category: 'fuerza',
    totalMinutes: 22,
    caloriesApprox: 230,
    description: 'Desafío integral avanzado con control de tempo, equilibrio y potencia.',
    objective: 'Dominar estabilidad unilateral, fuerza isométrica y control respiratorio bajo fatiga.',
    musclesWorked: ['Glúteo medio', 'Cuádriceps', 'Core profundo', 'Escápulas'],
    beginnerAlternative: 'Hacé estocada estática en lugar de búlgara y plancha clásica en antebrazos.',
    safetyWarning: 'Interrumpí inmediatamente ante dolor articular punzante en rodilla o lumbar.',
    demoAnim: 'plank_hold',
    steps: [
      { name: 'Activación escapular y core profundo', durationSec: 180, repsHint: '3 minutos', cue: 'Control total de la respiración costal.' },
      { name: 'Sentadilla búlgara con tempo 3-1-1', durationSec: 300, repsHint: '4 x 10 por pierna', cue: '3 segundos de descenso controlado en cada repetición.' },
      { name: 'Flexiones declinadas o en pike', durationSec: 300, repsHint: '4 x 10-14 reps', cue: 'Pausa de 1 segundo cerca del suelo.' },
      { name: 'Plancha lateral + hollow hold', durationSec: 300, repsHint: '4 x 40s', cue: 'Lumbar pegada al suelo en todo momento.' },
      { name: 'Movilidad profunda y descarga', durationSec: 240, repsHint: '4 minutos', cue: 'Restaurá la amplitud respiratoria.' },
    ],
  },
];

// Interactive Biomechanical Canvas + Audio Cue Demo Stage
const ExerciseDemoStage: React.FC<{
  animId: ExerciseDemoAnimationId;
  stepTitle: string;
  isRunning: boolean;
  audioEnabled: boolean;
}> = ({ animId, stepTitle, isRunning, audioEnabled }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phaseLabel, setPhaseLabel] = useState('Listo para comenzar');
  const lastPhaseRef = useRef('');

  // Optional gentle Web Audio breath/tempo chime on phase change
  const playCadenceTone = (freq: number) => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      window.setTimeout(() => void ctx.close().catch(() => {}), 250);
    } catch {
      // AudioContext blocked until interaction
    }
  };

  useEffect(() => {
    let rafId = 0;
    const startMs = performance.now();

    const drawStick = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      hipY: number,
      torsoAngle: number,
      kneeBend: number,
      armRaise: number,
      plankMode = false
    ) => {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (plankMode) {
        // Horizontal plank silhouette
        const shoulderX = cx + 52;
        const shoulderY = hipY + 8;
        const footX = cx - 64;
        const footY = hipY + 26;
        const waistX = cx - 6;
        const waistY = hipY + 14 + kneeBend * 4;
        // Head
        ctx.beginPath();
        ctx.arc(shoulderX + 14, shoulderY - 8, 10, 0, Math.PI * 2);
        ctx.stroke();
        // Body line
        ctx.beginPath();
        ctx.moveTo(footX, footY);
        ctx.lineTo(waistX, waistY);
        ctx.lineTo(shoulderX, shoulderY);
        ctx.stroke();
        // Forearms to ground
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(shoulderX - 4, footY);
        ctx.lineTo(shoulderX + 12, footY);
        ctx.stroke();
        return;
      }

      const shoulderX = cx + Math.sin(torsoAngle) * 44;
      const shoulderY = hipY - Math.cos(torsoAngle) * 44;
      const headX = shoulderX + Math.sin(torsoAngle) * 18;
      const headY = shoulderY - Math.cos(torsoAngle) * 18;

      // Head
      ctx.beginPath();
      ctx.arc(headX, headY, 11, 0, Math.PI * 2);
      ctx.stroke();

      // Torso
      ctx.beginPath();
      ctx.moveTo(cx, hipY);
      ctx.lineTo(shoulderX, shoulderY);
      ctx.stroke();

      // Arms
      const armTargetX = shoulderX + Math.cos(armRaise) * 30;
      const armTargetY = shoulderY - Math.sin(armRaise) * 30;
      const armLeftX = shoulderX - Math.cos(armRaise) * 30;
      ctx.beginPath();
      ctx.moveTo(armLeftX, armTargetY);
      ctx.lineTo(shoulderX, shoulderY);
      ctx.lineTo(armTargetX, armTargetY);
      ctx.stroke();

      // Legs
      const kneeY = hipY + 26 - kneeBend * 10;
      const footY = hipY + 56 - kneeBend * 6;
      ctx.beginPath();
      ctx.moveTo(cx - 14, footY);
      ctx.lineTo(cx - 10 - kneeBend * 8, kneeY);
      ctx.lineTo(cx, hipY);
      ctx.lineTo(cx + 10 + kneeBend * 8, kneeY);
      ctx.lineTo(cx + 14, footY);
      ctx.stroke();
    };

    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const t = isRunning ? (now - startMs) / 1000 : (now - startMs) / 2200;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle atmospheric backdrop
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#091526');
      grad.addColorStop(1, '#071c1b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Floor reference grid line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(24, h - 28);
      ctx.lineTo(w - 24, h - 28);
      ctx.stroke();

      let nextPhase = 'Postura neutra';

      if (animId === 'box_breath' || animId === 'calm_scan') {
        const cycle = t % 8; // 8s guided breath cycle
        let radius = 34;
        if (cycle < 3) {
          radius = 28 + (cycle / 3) * 34;
          nextPhase = 'Inhalá lento por nariz';
        } else if (cycle < 4.5) {
          radius = 62;
          nextPhase = 'Sostené suavemente';
        } else if (cycle < 7.5) {
          radius = 62 - ((cycle - 4.5) / 3) * 34;
          nextPhase = 'Exhalá aflojando hombros';
        } else {
          radius = 28;
          nextPhase = 'Pausa en calma';
        }

        ctx.strokeStyle = animId === 'box_breath' ? 'rgba(56, 189, 248, 0.8)' : 'rgba(52, 211, 153, 0.8)';
        ctx.fillStyle = animId === 'box_breath' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(52, 211, 153, 0.14)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 4, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nextPhase, w / 2, h / 2 + 4);
      } else if (animId === 'neck_shoulder') {
        const osc = Math.sin(t * 2);
        nextPhase = osc > 0 ? 'Abrí pecho y bajá hombros' : 'Relajá brazos al centro';
        drawStick(ctx, w / 2, h - 84, osc * 0.12, 0.05, 0.2 + osc * 0.7);
      } else if (animId === 'cat_cow') {
        const osc = Math.sin(t * 1.8);
        nextPhase = osc > 0 ? 'Inhalá abriendo columna' : 'Exhalá redondeando suave';
        drawStick(ctx, w / 2, h - 84, 0.35 + osc * 0.22, 0.35, -0.5);
      } else if (animId === 'squat_chair') {
        const depth = (Math.sin(t * 2.2) + 1) / 2;
        nextPhase = depth > 0.55 ? 'Bajá con control en talones' : 'Subí activando piernas';
        drawStick(ctx, w / 2, h - 84 + depth * 18, depth * 0.28, depth * 1.1, depth * 0.8);
      } else if (animId === 'plank_hold') {
        const pulse = Math.sin(t * 2.5);
        nextPhase = 'Core firme · Alineación estable';
        drawStick(ctx, w / 2, h - 72, 0, pulse * 0.3, 0, true);
      } else if (animId === 'jumping_pulse') {
        const jump = (Math.sin(t * 5) + 1) / 2;
        nextPhase = jump > 0.5 ? 'Impulso con brazos arriba' : 'Aterrizaje suave en puntas';
        drawStick(ctx, w / 2, h - 84 - jump * 14, 0, (1 - jump) * 0.35, -0.8 + jump * 2.2);
      } else if (animId === 'stretch_hamstring') {
        const reach = (Math.sin(t * 1.4) + 1) / 2;
        nextPhase = reach > 0.5 ? 'Alargá espalda sin rebotes' : 'Volvé suave a vertical';
        drawStick(ctx, w / 2, h - 84, 0.25 + reach * 0.65, 0.15, -1.1);
      }

      if (nextPhase !== lastPhaseRef.current) {
        lastPhaseRef.current = nextPhase;
        setPhaseLabel(nextPhase);
        if (isRunning) {
          playCadenceTone(nextPhase.includes('Exhalá') || nextPhase.includes('Subí') ? 392 : 523);
        }
      }

      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [animId, isRunning, audioEnabled]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-[#091526]">
      <canvas ref={canvasRef} width={520} height={190} className="w-full h-44 sm:h-48 block" />
      <div className="px-3.5 py-2 bg-slate-950/90 text-xs text-slate-200 flex items-center justify-between gap-2">
        <span className="truncate font-medium">Demo visual: {stepTitle}</span>
        <span className="text-[11px] font-semibold text-emerald-400 shrink-0">{phaseLabel}</span>
      </div>
    </div>
  );
};

export const ExercisesLevelsView: React.FC = () => {
  const { user } = useFabro();
  const { addHabit, startHabit } = useHabitTimer();

  const [selectedLevel, setSelectedLevel] = useState<ExerciseLevelId>('inicial');
  const [focusFilter, setFocusFilter] = useState<'all' | ExerciseFocusCategory>('all');
  const [customRoutines, setCustomRoutines] = useState<ExerciseRoutine[]>([]);
  const [logs, setLogs] = useState<ExerciseLogEntry[]>([]);

  // Active player state
  const [activeRoutineId, setActiveRoutineId] = useState<string>(BASE_ROUTINES[0].id);
  const [stepIdx, setStepIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(BASE_ROUTINES[0].steps[0].durationSec);
  const [isRunning, setIsRunning] = useState(false);
  const [audioGuideEnabled, setAudioGuideEnabled] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Custom creator
  const [showCreator, setShowCreator] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ExerciseFocusCategory>('fuerza');
  const [newMinutes, setNewMinutes] = useState(10);
  const [newDesc, setNewDesc] = useState('');

  const uidKey = user?.uid || 'anon';

  useEffect(() => {
    try {
      const rawLogs = localStorage.getItem(`fabro_ex_logs_${uidKey}`);
      const rawCustom = localStorage.getItem(`fabro_ex_custom_${uidKey}`);
      setLogs(rawLogs ? (JSON.parse(rawLogs) as ExerciseLogEntry[]) : []);
      setCustomRoutines(rawCustom ? (JSON.parse(rawCustom) as ExerciseRoutine[]) : []);
    } catch {
      setLogs([]);
      setCustomRoutines([]);
    }
    // Hydrate from IndexedDB offline vault if localStorage was cleared
    void getCachedCollection('exerciseCache').then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        const cachedCustom = (items as unknown as Array<{ kind?: string; data?: unknown }>)
          .filter((r) => r.kind === 'custom_routine')
          .map((r) => r.data as ExerciseRoutine);
        if (cachedCustom.length > 0) {
          setCustomRoutines((prev) => (prev.length > 0 ? prev : cachedCustom));
        }
      }
    }).catch(() => {});
  }, [uidKey]);

  const saveLogs = (next: ExerciseLogEntry[]) => {
    setLogs(next);
    try {
      localStorage.setItem(`fabro_ex_logs_${uidKey}`, JSON.stringify(next.slice(0, 60)));
    } catch {
      // ignore quota error
    }
  };

  const saveCustomRoutines = (next: ExerciseRoutine[]) => {
    setCustomRoutines(next);
    try {
      localStorage.setItem(`fabro_ex_custom_${uidKey}`, JSON.stringify(next.slice(0, 25)));
    } catch {
      // ignore
    }
    void cacheSnapshotCollection(
      'exerciseCache',
      next.map((r) => ({ id: r.id, kind: 'custom_routine', data: r }))
    ).catch(() => {});
  };

  const allRoutines = useMemo(
    () => [...customRoutines, ...BASE_ROUTINES],
    [customRoutines]
  );

  const filteredRoutines = useMemo(
    () =>
      allRoutines.filter(
        (r) => r.level === selectedLevel && (focusFilter === 'all' || r.category === focusFilter)
      ),
    [allRoutines, selectedLevel, focusFilter]
  );

  const activeRoutine = useMemo(
    () => allRoutines.find((r) => r.id === activeRoutineId) || allRoutines[0],
    [allRoutines, activeRoutineId]
  );

  const currentStep = activeRoutine.steps[stepIdx] || activeRoutine.steps[0];

  const selectRoutine = (routine: ExerciseRoutine) => {
    stopHabitAlertSound();
    setIsRunning(false);
    setActiveRoutineId(routine.id);
    setStepIdx(0);
    setSecondsLeft(routine.steps[0]?.durationSec || 60);
  };

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (audioGuideEnabled) {
            playHabitAlertSound({ tone: 'campana', volume: 0.75, repeats: 1 });
          }
          if (stepIdx + 1 < activeRoutine.steps.length) {
            const nextStep = stepIdx + 1;
            setStepIdx(nextStep);
            return activeRoutine.steps[nextStep].durationSec;
          } else {
            setIsRunning(false);
            const entry: ExerciseLogEntry = {
              id: `exlog_${Date.now()}`,
              routineId: activeRoutine.id,
              routineTitle: activeRoutine.title,
              level: activeRoutine.level,
              durationMinutes: activeRoutine.totalMinutes,
              completedAt: new Date().toISOString(),
            };
            saveLogs([entry, ...logs]);
            setNotice(`¡Rutina "${activeRoutine.title}" completada! Se registró en tu historial.`);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, stepIdx, activeRoutine, logs, audioGuideEnabled]);

  const handleCompleteNow = () => {
    stopHabitAlertSound();
    setIsRunning(false);
    const entry: ExerciseLogEntry = {
      id: `exlog_${Date.now()}`,
      routineId: activeRoutine.id,
      routineTitle: activeRoutine.title,
      level: activeRoutine.level,
      durationMinutes: activeRoutine.totalMinutes,
      completedAt: new Date().toISOString(),
    };
    saveLogs([entry, ...logs]);
    setNotice(`Sesión "${activeRoutine.title}" registrada en tu progreso físico y bienestar.`);
  };

  const handleAddToHabitTimer = (routine: ExerciseRoutine) => {
    const createdHabit = addHabit({
      name: `Ejercicio (${routine.level}): ${routine.title}`,
      category: 'ejercicio',
      durationMinutes: routine.totalMinutes,
      tone: 'campana',
      volume: 0.8,
      repeats: 1,
      soundEnabled: true,
      voiceAlert: false,
      autoLogStudySession: false,
    });
    startHabit(createdHabit.id);
    setNotice(`"${routine.title}" iniciado en el Temporizador global de Hábitos.`);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const mins = Math.max(3, Math.min(90, newMinutes || 10));
    const perStep = Math.round((mins * 60) / 3);
    const created: ExerciseRoutine = {
      id: `ex_cust_${Date.now()}`,
      title: newTitle.trim().slice(0, 80),
      level: selectedLevel,
      category: newCategory,
      totalMinutes: mins,
      caloriesApprox: mins * 7,
      description: newDesc.trim() || 'Rutina personalizada creada en FABRO Bienestar Natural.',
      objective: 'Práctica adaptada a tu ritmo y disponibilidad diaria.',
      musclesWorked: ['Cuerpo completo', 'Respiración'],
      beginnerAlternative: 'Reducí repeticiones a la mitad y priorizá la técnica.',
      safetyWarning: 'Escuchá tu cuerpo; frená ante mareos o dolor agudo.',
      demoAnim: newCategory === 'respiracion' || newCategory === 'descanso' ? 'box_breath' : newCategory === 'meditacion' || newCategory === 'bienestar_emocional' ? 'calm_scan' : 'squat_chair',
      steps: [
        { name: 'Activación y movilidad previa', durationSec: perStep, repsHint: 'Bloque 1', cue: 'Ritmo progresivo y postura estable.' },
        { name: 'Bloque principal de ejecución', durationSec: perStep, repsHint: 'Bloque 2', cue: 'Cuidá la técnica en cada repetición.' },
        { name: 'Elongación y respiración final', durationSec: perStep, repsHint: 'Bloque 3', cue: 'Exhalá lento para bajar pulsaciones.' },
      ],
    };
    saveCustomRoutines([created, ...customRoutines]);
    selectRoutine(created);
    setNewTitle('');
    setNewDesc('');
    setShowCreator(false);
  };

  const formatMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalMinutesCompleted = useMemo(
    () => logs.reduce((acc, l) => acc + l.durationMinutes, 0),
    [logs]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <Dumbbell className="w-4 h-4" />
            <span>Sector 2 · Ejercicios con Demostraciones Audiovisuales</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Ejercicios, Respiración y Movilidad con Niveles
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Guía visual y sonora en vivo con respiración, relajación, estiramientos, movilidad, fuerza, meditación, descanso y bienestar emocional. Funciona también sin conexión.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Sesiones</p>
            <p className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {logs.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Minutos activos</p>
            <p className="font-display text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalMinutesCompleted}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreator((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nueva rutina
          </button>
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="font-semibold hover:underline cursor-pointer">
            Cerrar
          </button>
        </div>
      )}

      {showCreator && (
        <form
          onSubmit={handleCreateCustom}
          className="rounded-2xl border border-emerald-500/30 fabro-shell-surface p-5 space-y-4"
        >
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Crear rutina personalizada en nivel {selectedLevel}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej: Movilidad de espalda y respiración"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ExerciseFocusCategory)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            >
              {(Object.keys(FOCUS_LABELS) as ExerciseFocusCategory[]).map((k) => (
                <option key={k} value={k}>
                  Categoría: {FOCUS_LABELS[k]}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={3}
              max={90}
              value={newMinutes}
              onChange={(e) => setNewMinutes(Number(e.target.value))}
              placeholder="Duración (min)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
            />
          </div>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Objetivo breve o indicaciones personales..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreator(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              Guardar rutina
            </button>
          </div>
        </form>
      )}

      {/* Level Selector Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {LEVEL_META.map((lvl) => {
          const active = selectedLevel === lvl.id;
          return (
            <button
              key={lvl.id}
              type="button"
              onClick={() => setSelectedLevel(lvl.id)}
              className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                active
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10'
                  : 'border-slate-200 dark:border-slate-800 fabro-shell-surface hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {lvl.label}
                </p>
                <Award className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-500' : 'text-slate-400'}`} />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                {lvl.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Split: Routines List + Active Audiovisual Coach */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', ...(Object.keys(FOCUS_LABELS) as ExerciseFocusCategory[])] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFocusFilter(cat)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                  focusFilter === cat
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {cat === 'all' ? 'Todas' : FOCUS_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {filteredRoutines.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-6 text-center text-xs text-slate-500">
                No hay rutinas de esa categoría en este nivel. Probá cambiar a Nivel 1 o crear una rutina propia.
              </div>
            ) : (
              filteredRoutines.map((routine) => {
                const isSelected = activeRoutine.id === routine.id;
                const isCustom = routine.id.startsWith('ex_cust_');
                return (
                  <div
                    key={routine.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-800 fabro-shell-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => selectRoutine(routine)}
                        className="text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          {routine.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {FOCUS_LABELS[routine.category]} · {routine.totalMinutes} min · ~{routine.caloriesApprox} kcal · {routine.steps.length} bloques
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                          {routine.description}
                        </p>
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => saveCustomRoutines(customRoutines.filter((c) => c.id !== routine.id))}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                          title="Eliminar rutina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => selectRoutine(routine)}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        Abrir demostración guiada
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddToHabitTimer(routine)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Timer className="w-3 h-3" />
                        Llevar al Temporizador
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active Guided Audiovisual Coach */}
        <div className="lg:col-span-7 space-y-4">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Guía Audiovisual · {LEVEL_META.find((l) => l.id === activeRoutine.level)?.label}
                </p>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeRoutine.title}
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                ~{activeRoutine.caloriesApprox} kcal · {activeRoutine.totalMinutes} min
              </span>
            </div>

            {/* Live Biomechanical / Breath Visual Demonstration */}
            <ExerciseDemoStage
              animId={activeRoutine.demoAnim || 'box_breath'}
              stepTitle={currentStep.name}
              isRunning={isRunning}
              audioEnabled={audioGuideEnabled}
            />

            {/* Technical Details: Objective, Muscles, Alternative & Safety Warning */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-emerald-500" />
                  Objetivo y zonas trabajadas
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  {activeRoutine.objective || activeRoutine.description}
                </p>
                {activeRoutine.musclesWorked && (
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 pt-0.5">
                    Músculos / zonas: {activeRoutine.musclesWorked.join(' · ')}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                <p className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Alternativa y seguridad
                </p>
                <p className="text-[11px] text-slate-700 dark:text-slate-200">
                  <strong>Para principiantes:</strong>{' '}
                  {activeRoutine.beginnerAlternative || 'Reducí tiempo y amplitud según tu comodidad.'}
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  <strong>Precaución:</strong>{' '}
                  {activeRoutine.safetyWarning || 'Detenete ante dolor agudo o mareos.'}
                </p>
              </div>
            </div>

            {/* Active Interval Clock */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 tabular-nums">
                  Paso {stepIdx + 1} de {activeRoutine.steps.length} · {currentStep.repsHint}
                </p>
                <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {currentStep.name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {currentStep.cue}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <span className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatMmSs(secondsLeft)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopHabitAlertSound();
                      setIsRunning((v) => !v);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                  >
                    {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isRunning ? 'Pausar' : 'Iniciar guía'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopHabitAlertSound();
                      setIsRunning(false);
                      setSecondsLeft(currentStep.durationSec);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Reiniciar paso"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioGuideEnabled((v) => !v)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title={audioGuideEnabled ? 'Silenciar tonos de cadencia' : 'Activar tonos de cadencia'}
                  >
                    {audioGuideEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Steps Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Secuencia completa
                </p>
                <button
                  type="button"
                  onClick={handleCompleteNow}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Marcar rutina completada
                </button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {activeRoutine.steps.map((st, idx) => {
                  const active = idx === stepIdx;
                  return (
                    <button
                      key={`${st.name}_${idx}`}
                      type="button"
                      onClick={() => {
                        stopHabitAlertSound();
                        setIsRunning(false);
                        setStepIdx(idx);
                        setSecondsLeft(st.durationSec);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        active
                          ? 'bg-emerald-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {idx + 1}. {st.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {st.repsHint} · {st.cue}
                        </p>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300 shrink-0 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatMmSs(st.durationSec)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Orientación educativa y preventiva de bienestar físico y mental. No reemplaza evaluación médica ni fisioterapéutica ante lesiones o condiciones preexistentes.
              </span>
            </div>
          </section>

          {/* Recent Exercise History */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Historial de entrenamientos ({logs.length})
                </h3>
              </div>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => saveLogs([])}
                  className="text-[11px] text-slate-500 hover:text-rose-500 cursor-pointer"
                >
                  Limpiar historial
                </button>
              )}
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completá tu primer bloque de ejercicio o respiración para ver el seguimiento acumulado.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.slice(0, 6).map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {item.routineTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        Nivel {item.level} · {new Date(item.completedAt).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                      +{item.durationMinutes} min
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
