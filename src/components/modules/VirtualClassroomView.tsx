import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eraser,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  MessageCircle,
  Monitor,
  Pause,
  PenTool,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import aulaHeroImg from '../../assets/images/fabro_aula_virtual_1794596246994.jpg';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import type { ClassroomQuizItem, GroupChatMessage, VirtualClassroom } from '../../types/fabro';

function extractYoutubeId(raw: string): string {
  const s = (raw || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const match = s.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

type ClassroomWorkspaceTab = 'vivo' | 'pizarra' | 'tareas' | 'chat';

export const VirtualClassroomView: React.FC = () => {
  const { user, profile, setActiveSection } = useFabro();
  const {
    classrooms,
    courses,
    groups,
    publicProfiles,
    wsConnected,
    classroomPeersCount,
    setActiveClassroomRoomId,
    lastClassroomSync,
    createClassroom,
    updateClassroomPlayback,
    updateClassroomMaterials,
    answerClassroomQuiz,
    deleteClassroom,
    createGroup,
    joinGroup,
    subscribeGroupMessages,
    sendGroupChatMessage,
  } = usePlatform();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [lobbyFilter, setLobbyFilter] = useState<'all' | 'gratuito' | 'arancelado'>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('');

  // Create form
  const [cTitle, setCTitle] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cCourseId, setCCourseId] = useState('');
  const [cScheduled, setCScheduled] = useState('');
  const [cVisibility, setCVisibility] = useState<VirtualClassroom['visibility']>('publico');
  const [cPricingTag, setCPricingTag] = useState<'Gratuito' | 'Pago institucional'>('Gratuito');
  const [cSpecialtyTag, setCSpecialtyTag] = useState('');
  const [cMeetUrl, setCMeetUrl] = useState('');
  const [cVideoUrl, setCVideoUrl] = useState('');
  const [cVideoTitle, setCVideoTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Live Classroom Controls
  const [roomTab, setRoomTab] = useState<ClassroomWorkspaceTab>('vivo');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [seekSecondsInput, setSeekSecondsInput] = useState(0);
  const [notesDraft, setNotesDraft] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOptionsRaw, setQuizOptionsRaw] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Screen share + authorized local recording
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);

  // Digital Whiteboard (<canvas>)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [penColor, setPenColor] = useState('#0284c7');
  const [penSize, setPenSize] = useState(3);
  const [eraserMode, setEraserMode] = useState(false);

  // Classroom Linked Chat + Tasks + Attendance
  const [roomMessages, setRoomMessages] = useState<GroupChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskSubmissionText, setTaskSubmissionText] = useState('');
  const [gradeStudentName, setGradeStudentName] = useState('');
  const [gradeTaskName, setGradeTaskName] = useState('');
  const [gradeScore, setGradeScore] = useState('10/10');
  const [classroomNotice, setClassroomNotice] = useState<string | null>(null);

  const selectedClassroom = useMemo(
    () => classrooms.find((c) => c.id === selectedId) || null,
    [classrooms, selectedId]
  );

  // Resolve linked group chat ID for this classroom
  const linkedChatGroupId = useMemo(() => {
    if (!selectedClassroom) return '';
    if (selectedClassroom.courseId) {
      const crs = courses.find((c) => c.id === selectedClassroom.courseId);
      if (crs?.linkedGroupId) return crs.linkedGroupId;
    }
    const chatLink = selectedClassroom.sharedLinks.find((l) => l.url.startsWith('fabro-group://'));
    if (chatLink) return chatLink.url.replace('fabro-group://', '');
    return '';
  }, [selectedClassroom, courses]);

  useEffect(() => {
    setActiveClassroomRoomId(selectedClassroom?.id || null);
    if (selectedClassroom) {
      setNotesDraft(selectedClassroom.presentationNotes || '');
      setSeekSecondsInput(selectedClassroom.playbackSeconds || 0);
    }
    return () => setActiveClassroomRoomId(null);
  }, [selectedClassroom?.id, setActiveClassroomRoomId]);

  useEffect(() => {
    if (!linkedChatGroupId) {
      setRoomMessages([]);
      return;
    }
    const unsub = subscribeGroupMessages(linkedChatGroupId, setRoomMessages);
    return () => unsub();
  }, [linkedChatGroupId, subscribeGroupMessages]);

  // Cleanup screen capture when leaving classroom
  useEffect(() => {
    return () => {
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
      if (recordedBlobUrl) {
        URL.revokeObjectURL(recordedBlobUrl);
      }
    };
  }, [screenStream, recordedBlobUrl]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Apply WebSocket / Firestore playback sync via YouTube IFrame postMessage API
  useEffect(() => {
    if (!selectedClassroom || !iframeRef.current?.contentWindow) return;
    const syncState =
      lastClassroomSync && lastClassroomSync.classroomId === selectedClassroom.id
        ? lastClassroomSync
        : {
            playbackState: selectedClassroom.playbackState,
            playbackSeconds: selectedClassroom.playbackSeconds,
          };

    const win = iframeRef.current.contentWindow;
    if (typeof syncState.playbackSeconds === 'number') {
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [syncState.playbackSeconds, true],
        }),
        '*'
      );
    }
    win.postMessage(
      JSON.stringify({
        event: 'command',
        func: syncState.playbackState === 'playing' ? 'playVideo' : 'pauseVideo',
        args: [],
      }),
      '*'
    );
  }, [
    selectedClassroom?.id,
    selectedClassroom?.playbackState,
    selectedClassroom?.playbackSeconds,
    lastClassroomSync,
  ]);

  // Whiteboard init
  useEffect(() => {
    if (roomTab !== 'pizarra' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx && canvas.dataset.initialized !== '1') {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.dataset.initialized = '1';
    }
  }, [roomTab]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = eraserMode ? penSize * 4 : penSize;
    ctx.strokeStyle = eraserMode ? '#0b1220' : penColor;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handleCanvasUp = () => {
    drawingRef.current = false;
  };

  const clearWhiteboard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const exportWhiteboardPng = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pizarra-${selectedClassroom?.title.slice(0, 24) || 'clase'}.png`;
    a.click();
  };

  const handleStartScreenShare = async () => {
    setScreenError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenError('Tu navegador o dispositivo móvil no admite compartir pantalla directamente; podés usar un enlace de Meet/Zoom/Jitsi.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setScreenStream(null);
        setIsRecording(false);
      });
    } catch {
      setScreenError('No se otorgó permiso para compartir la pantalla.');
    }
  };

  const handleStopScreenShare = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setIsRecording(false);
  };

  const handleToggleRecording = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    if (!screenStream || !recordingConsent) return;
    recordedChunksRef.current = [];
    const mr = new MediaRecorder(screenStream);
    mr.ondataavailable = (ev) => {
      if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
    };
    mr.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedBlobUrl(url);
      setClassroomNotice('Grabación de clase lista para descargar.');
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cTitle.trim()) return;
    setCreating(true);
    try {
      const ytId = extractYoutubeId(cVideoUrl);
      const headerNote = [
        `Modalidad: ${cPricingTag}`,
        cSpecialtyTag.trim() ? `Especialidad/Carrera: ${cSpecialtyTag.trim()}` : '',
        cMeetUrl.trim() ? `Videoconferencia: ${cMeetUrl.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      const id = await createClassroom({
        courseId: cCourseId,
        title: cTitle,
        description: cDesc,
        scheduledAt: cScheduled || new Date().toISOString().slice(0, 16),
        visibility: cVisibility,
        youtubeVideoId: ytId,
        videoTitle: cVideoTitle || cTitle,
        presentationNotes: headerNote,
      });

      if (cMeetUrl.trim()) {
        await updateClassroomMaterials(id, {
          sharedLinks: [{ title: 'Sala de Videoconferencia', url: cMeetUrl.trim() }],
        });
      }

      setShowCreate(false);
      setCTitle('');
      setCDesc('');
      setCVideoUrl('');
      setCMeetUrl('');
      setCSpecialtyTag('');
      setSelectedId(id);
    } finally {
      setCreating(false);
    }
  };

  const handleAskClassroomAI = async () => {
    if (!selectedClassroom || !aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const resp = await authFetch('/api/ai/explain-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: selectedClassroom.youtubeVideoId,
          title: selectedClassroom.videoTitle || selectedClassroom.title,
          area: 'Aula Virtual FABRO',
          userNotes: selectedClassroom.presentationNotes,
          qaQuestion: aiQuestion,
        }),
      });
      const json = (await resp.json()) as { text?: string; error?: string };
      setAiReply(json.text || json.error || 'Sin respuesta disponible.');
      setAiQuestion('');
    } finally {
      setAiLoading(false);
    }
  };

  const handleActivateClassroomChat = async () => {
    if (!selectedClassroom) return;
    const grpId = await createGroup({
      name: `Aula · ${selectedClassroom.title.slice(0, 100)}`,
      description: `Chat oficial y entregas del aula virtual "${selectedClassroom.title}".`,
      groupType: 'libre',
      visibility: 'publico',
      country: profile?.country || 'Argentina',
      province: profile?.province || '',
      city: profile?.city || '',
      institutionName: profile?.institution || '',
      career: profile?.career || '',
      courseName: selectedClassroom.title,
      subjectName: '',
      specialty: '',
      allowMinors: true,
    });
    const nextLinks = [
      ...selectedClassroom.sharedLinks,
      { title: 'Chat del Aula', url: `fabro-group://${grpId}` },
    ];
    await updateClassroomMaterials(selectedClassroom.id, { sharedLinks: nextLinks });
    setClassroomNotice('Chat del aula activado para todos los participantes.');
  };

  const handleSendRoomMessage = async (textOverride?: string) => {
    const content = (textOverride ?? chatDraft).trim();
    if (!content || !linkedChatGroupId) return;
    if (!textOverride) setChatDraft('');
    const targetGrp = groups.find((g) => g.id === linkedChatGroupId);
    if (targetGrp) {
      await joinGroup(targetGrp).catch(() => {});
    }
    await sendGroupChatMessage(linkedChatGroupId, content);
  };

  const teachersList = useMemo(
    () => publicProfiles.slice(0, 8),
    [publicProfiles]
  );

  const visibleClassrooms = useMemo(() => {
    const q = specialtyFilter.trim().toLowerCase();
    return classrooms.filter((r) => {
      const notesLower = (r.presentationNotes || '').toLowerCase();
      if (lobbyFilter === 'gratuito' && notesLower.includes('pago institucional')) return false;
      if (lobbyFilter === 'arancelado' && !notesLower.includes('pago institucional')) return false;
      if (!q) return true;
      return `${r.title} ${r.description} ${r.instructorName} ${r.presentationNotes}`.toLowerCase().includes(q);
    });
  }, [classrooms, lobbyFilter, specialtyFilter]);

  if (selectedClassroom) {
    const isInstructor = selectedClassroom.instructorId === user?.uid;
    const effectivePlayback =
      lastClassroomSync && lastClassroomSync.classroomId === selectedClassroom.id
        ? {
            playbackState: lastClassroomSync.playbackState || selectedClassroom.playbackState,
            playbackSeconds:
              typeof lastClassroomSync.playbackSeconds === 'number'
                ? lastClassroomSync.playbackSeconds
                : selectedClassroom.playbackSeconds,
          }
        : {
            playbackState: selectedClassroom.playbackState,
            playbackSeconds: selectedClassroom.playbackSeconds,
          };

    const assignedTasks = selectedClassroom.sharedDocTitles.filter((t) => t.startsWith('TAREA|'));
    const recordedGrades = selectedClassroom.sharedDocTitles.filter((t) => t.startsWith('NOTA|'));
    const regularDocs = selectedClassroom.sharedDocTitles.filter(
      (t) => !t.startsWith('TAREA|') && !t.startsWith('NOTA|')
    );
    const meetLinks = selectedClassroom.sharedLinks.filter((l) => !l.url.startsWith('fabro-group://'));
    const attendanceEntries = roomMessages.filter((m) => m.text.startsWith('[ASISTENCIA]'));
    const submissionEntries = roomMessages.filter((m) => m.text.startsWith('[ENTREGA]'));

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
          >
            ← Volver a Clases Virtuales
          </button>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
              {wsConnected ? 'Sincronización WebSocket activa' : 'Reconectando sala...'}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 tabular-nums">
              <Users className="w-3.5 h-3.5 text-sky-500" />
              {Math.max(1, classroomPeersCount)} conectados
            </span>
          </div>
        </div>

        {classroomNotice && (
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>{classroomNotice}</span>
            <button type="button" onClick={() => setClassroomNotice(null)} className="font-semibold cursor-pointer">
              OK
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                Aula Virtual Sincronizada · Docente: {selectedClassroom.instructorName}
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                {selectedClassroom.title}
              </h2>
              {selectedClassroom.description && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                  {selectedClassroom.description}
                </p>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 text-right space-y-1">
              <p>
                Estado del video:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {effectivePlayback.playbackState === 'playing' ? 'Reproduciendo' : 'En pausa'} ({effectivePlayback.playbackSeconds}s)
                </strong>
              </p>
              {selectedClassroom.scheduledAt && <p>Horario: {selectedClassroom.scheduledAt.replace('T', ' ')}</p>}
            </div>
          </div>

          {/* Classroom Tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            {[
              { id: 'vivo', label: 'Clase en Vivo y Pantalla', icon: Video },
              { id: 'pizarra', label: 'Pizarra Digital', icon: PenTool },
              { id: 'tareas', label: 'Tareas, Asistencia y Notas', icon: ClipboardCheck },
              { id: 'chat', label: 'Chat del Aula', icon: MessageCircle },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRoomTab(t.id as ClassroomWorkspaceTab)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                    roomTab === t.id
                      ? 'bg-sky-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {roomTab === 'vivo' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              {/* Synchronized Player & Screen Share */}
              <div className="xl:col-span-7 space-y-4">
                {selectedClassroom.youtubeVideoId ? (
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
                    <iframe
                      ref={iframeRef}
                      title={selectedClassroom.videoTitle || selectedClassroom.title}
                      src={`https://www.youtube.com/embed/${selectedClassroom.youtubeVideoId}?enablejsapi=1&start=${effectivePlayback.playbackSeconds || 0}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 px-6 text-center">
                    {isInstructor
                      ? 'Cargá un enlace de YouTube debajo o iniciá pantalla compartida / videoconferencia.'
                      : 'El docente todavía no proyectó un video en esta sesión. Revisá la Pizarra o enlaces de apoyo.'}
                  </div>
                )}

                {/* Screen Sharing & Authorized Recording */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <Monitor className="w-4 h-4 text-sky-500" />
                      <span>Compartir Pantalla y Grabación Autorizada</span>
                    </div>
                    {!screenStream ? (
                      <button
                        type="button"
                        onClick={() => void handleStartScreenShare()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        Compartir mi pantalla
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!recordingConsent}
                          onClick={handleToggleRecording}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold text-white cursor-pointer disabled:opacity-50 ${
                            isRecording ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                        >
                          {isRecording ? 'Detener grabación' : 'Grabar clase (con autorización)'}
                        </button>
                        <button
                          type="button"
                          onClick={handleStopScreenShare}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
                        >
                          <VideoOff className="w-3.5 h-3.5" />
                          Dejar de compartir
                        </button>
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordingConsent}
                      onChange={(e) => setRecordingConsent(e.target.checked)}
                    />
                    <span>Confirmo contar con autorización del docente y participantes antes de grabar.</span>
                  </label>

                  {screenError && <p className="text-[11px] text-amber-600 dark:text-amber-400">{screenError}</p>}

                  {screenStream && (
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-black max-h-64"
                    />
                  )}

                  {recordedBlobUrl && (
                    <a
                      href={recordedBlobUrl}
                      download={`clase-${selectedClassroom.title.slice(0, 20)}.webm`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar grabación WebM
                    </a>
                  )}
                </div>

                {isInstructor && (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 space-y-3 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">
                      Controles maestros del docente (sincronizan a todos los estudiantes)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        placeholder="Cambiar video de YouTube (URL o ID)..."
                        className="flex-1 min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-1.5 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = extractYoutubeId(videoUrlInput);
                          if (!nextId) return;
                          setVideoUrlInput('');
                          void updateClassroomPlayback(selectedClassroom.id, {
                            youtubeVideoId: nextId,
                            playbackState: 'paused',
                            playbackSeconds: 0,
                          });
                        }}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                      >
                        Proyectar video
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] text-slate-600 dark:text-slate-300">Segundo:</label>
                      <input
                        type="number"
                        min={0}
                        max={86400}
                        value={seekSecondsInput}
                        onChange={(e) => setSeekSecondsInput(Number(e.target.value) || 0)}
                        className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 py-1 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void updateClassroomPlayback(selectedClassroom.id, {
                            playbackState: 'playing',
                            playbackSeconds: seekSecondsInput,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Reproducir en todos
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void updateClassroomPlayback(selectedClassroom.id, {
                            playbackState: 'paused',
                            playbackSeconds: seekSecondsInput,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pausar en todos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSeekSecondsInput(0);
                          void updateClassroomPlayback(selectedClassroom.id, {
                            playbackState: 'paused',
                            playbackSeconds: 0,
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reiniciar
                      </button>
                    </div>
                  </div>
                )}

                {/* Shared Notes, Docs & Video Conference Links */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Notas, documentos y videoconferencias</p>
                  {isInstructor ? (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Escribí consignas, fórmulas o puntos clave visibles para toda la clase..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-2.5 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void updateClassroomMaterials(selectedClassroom.id, {
                            presentationNotes: notesDraft,
                          }).then(() => setClassroomNotice('Notas del aula actualizadas.'))
                        }
                        className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                      >
                        Guardar notas compartidas
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedClassroom.presentationNotes || 'El docente aún no publicó notas compartidas.'}
                    </p>
                  )}

                  {meetLinks.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">Enlaces de videoconferencia y material:</p>
                      {meetLinks.map((lk, idx) => (
                        <a
                          key={idx}
                          href={lk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline mr-4"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>{lk.title || lk.url}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}

                  {regularDocs.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">Documentos referenciados:</p>
                      {regularDocs.map((d, i) => (
                        <p key={i} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-sky-500" />
                          {d}
                        </p>
                      ))}
                    </div>
                  )}

                  {isInstructor && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <input
                        type="text"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="Título (ej: Meet en vivo / Guía PDF)"
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                      />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!linkUrl.trim()) return;
                          const next = [
                            ...selectedClassroom.sharedLinks,
                            { title: linkTitle.trim() || linkUrl.trim(), url: linkUrl.trim() },
                          ];
                          setLinkTitle('');
                          setLinkUrl('');
                          void updateClassroomMaterials(selectedClassroom.id, { sharedLinks: next });
                        }}
                        className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
                      >
                        + Enlace / Meet
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Quiz + FABRO IA Helper */}
              <div className="xl:col-span-5 space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Encuesta o pregunta en vivo</p>
                  {selectedClassroom.activeQuiz ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {selectedClassroom.activeQuiz.question}
                      </p>
                      {selectedClassroom.activeQuiz.options.map((opt, idx) => {
                        const votes = Object.values(selectedClassroom.activeQuiz?.responses || {}).filter(
                          (v) => v === idx
                        ).length;
                        const myVote = user ? selectedClassroom.activeQuiz?.responses?.[user.uid] === idx : false;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => void answerClassroomQuiz(selectedClassroom, idx)}
                            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer ${
                              myVote
                                ? 'border-sky-500 bg-sky-500/15 font-semibold text-sky-700 dark:text-sky-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>{opt}</span>
                            <span className="font-mono">{votes}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">
                      No hay ninguna pregunta en vivo activa en este momento.
                    </p>
                  )}

                  {isInstructor && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <input
                        type="text"
                        value={quizQuestion}
                        onChange={(e) => setQuizQuestion(e.target.value)}
                        placeholder="Lanzar pregunta en vivo..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={quizOptionsRaw}
                        onChange={(e) => setQuizOptionsRaw(e.target.value)}
                        placeholder="Opciones separadas por coma (ej.: Sí, Quedó claro, Repasar)"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const opts = quizOptionsRaw
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          if (!quizQuestion.trim() || opts.length < 2) return;
                          const quiz: ClassroomQuizItem = {
                            id: `qz_${Date.now()}`,
                            question: quizQuestion.trim(),
                            options: opts,
                            correctIndex: 0,
                            responses: {},
                          };
                          setQuizQuestion('');
                          setQuizOptionsRaw('');
                          void updateClassroomMaterials(selectedClassroom.id, { activeQuiz: quiz });
                        }}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                      >
                        Publicar pregunta en vivo
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    FABRO IA en el Aula Virtual
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      placeholder="Consultá una definición o resumen mientras ves la clase..."
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={aiLoading || !aiQuestion.trim()}
                      onClick={() => void handleAskClassroomAI()}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                    >
                      {aiLoading ? '...' : 'Explicar'}
                    </button>
                  </div>
                  {aiReply && (
                    <div className="max-h-56 overflow-y-auto rounded-lg bg-slate-50 dark:bg-[#090D16] p-3 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {aiReply}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {roomTab === 'pizarra' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {['#0284c7', '#10b981', '#f59e0b', '#f43f5e', '#ffffff'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setEraserMode(false);
                        setPenColor(col);
                      }}
                      aria-label={`Color ${col}`}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        !eraserMode && penColor === col ? 'border-sky-400 scale-110' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 ml-2">
                    <span>Grosor:</span>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      value={penSize}
                      onChange={(e) => setPenSize(Number(e.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setEraserMode((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold cursor-pointer ${
                      eraserMode ? 'border-amber-500 bg-amber-500/15 text-amber-600' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Borrador
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearWhiteboard}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-semibold cursor-pointer"
                  >
                    Limpiar pizarra
                  </button>
                  <button
                    type="button"
                    onClick={exportWhiteboardPng}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar PNG
                  </button>
                </div>
              </div>

              <canvas
                ref={canvasRef}
                width={960}
                height={460}
                onPointerDown={handleCanvasDown}
                onPointerMove={handleCanvasMove}
                onPointerUp={handleCanvasUp}
                onPointerLeave={handleCanvasUp}
                className="w-full rounded-xl border border-slate-700 bg-[#0b1220] touch-none cursor-crosshair"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dibujá esquemas, fórmulas o gráficos con el mouse, lápiz táctil o dedo y exportalos como imagen para tus apuntes.
              </p>
            </div>
          )}

          {roomTab === 'tareas' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              {/* Tasks & Submissions */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-sky-500" />
                  Tareas y Entregas ({assignedTasks.length})
                </h3>

                {assignedTasks.length === 0 ? (
                  <p className="text-slate-500">El docente aún no asignó tareas formales en esta clase.</p>
                ) : (
                  <div className="space-y-2">
                    {assignedTasks.map((raw, i) => {
                      const [, title, due] = raw.split('|');
                      return (
                        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                          <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
                          {due && <p className="text-[11px] text-slate-500">Entrega límite: {due}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isInstructor && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">Publicar nueva tarea:</p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Consigna de trabajo o práctica..."
                        className="flex-1 min-w-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5"
                      />
                      <input
                        type="date"
                        value={taskDue}
                        onChange={(e) => setTaskDue(e.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!taskTitle.trim()) return;
                          const item = `TAREA|${taskTitle.trim().slice(0, 120)}|${taskDue || 'Sin fecha'}`;
                          setTaskTitle('');
                          setTaskDue('');
                          void updateClassroomMaterials(selectedClassroom.id, {
                            sharedDocTitles: [...selectedClassroom.sharedDocTitles, item].slice(0, 30),
                          });
                        }}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                      >
                        Asignar tarea
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Enviar entrega o trabajo al docente:</p>
                  {!linkedChatGroupId ? (
                    <p className="text-[11px] text-slate-500">
                      El docente primero debe activar el Chat del Aula para recibir entregas.
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={taskSubmissionText}
                        onChange={(e) => setTaskSubmissionText(e.target.value)}
                        placeholder="Pegá enlace de Google Docs/Drive o resumen de tu entrega..."
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!taskSubmissionText.trim()) return;
                          const msg = `[ENTREGA] ${profile?.displayName || 'Estudiante'}: ${taskSubmissionText.trim()}`;
                          setTaskSubmissionText('');
                          void handleSendRoomMessage(msg).then(() => setClassroomNotice('Trabajo enviado al aula.'));
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                      >
                        Entregar
                      </button>
                    </div>
                  )}

                  {submissionEntries.length > 0 && (
                    <div className="space-y-1 max-h-36 overflow-y-auto pt-1">
                      <p className="text-[11px] font-semibold text-slate-500">Entregas recientes:</p>
                      {submissionEntries.map((s) => (
                        <p key={s.id} className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#090D16] rounded px-2 py-1">
                          {s.text.replace('[ENTREGA] ', '')}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance & Grades */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    Asistencia y Calificaciones
                  </h3>
                  {linkedChatGroupId && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleSendRoomMessage(
                          `[ASISTENCIA] ${profile?.displayName || 'Participante'} presente (${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })})`
                        ).then(() => setClassroomNotice('Asistencia registrada en la clase.'))
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Registrar mi asistencia
                    </button>
                  )}
                </div>

                {attendanceEntries.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {attendanceEntries.map((a) => (
                      <p key={a.id} className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        ✓ {a.text.replace('[ASISTENCIA] ', '')}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">
                    {linkedChatGroupId
                      ? 'Todavía no hay registros de asistencia en esta sesión.'
                      : 'Activá el Chat del Aula en la pestaña siguiente para habilitar asistencia en vivo.'}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    Correcciones y notas publicadas ({recordedGrades.length})
                  </p>
                  {recordedGrades.map((raw, i) => {
                    const [, st, tsk, sc] = raw.split('|');
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
                        <span className="font-medium">{st} · {tsk}</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{sc}</span>
                      </div>
                    );
                  })}

                  {isInstructor && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <input
                        type="text"
                        value={gradeStudentName}
                        onChange={(e) => setGradeStudentName(e.target.value)}
                        placeholder="Estudiante"
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1.5"
                      />
                      <input
                        type="text"
                        value={gradeTaskName}
                        onChange={(e) => setGradeTaskName(e.target.value)}
                        placeholder="Trabajo / Parcial"
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1.5"
                      />
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={gradeScore}
                          onChange={(e) => setGradeScore(e.target.value)}
                          placeholder="Nota"
                          className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1.5 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!gradeStudentName.trim()) return;
                            const entry = `NOTA|${gradeStudentName.trim().slice(0, 60)}|${(gradeTaskName || 'Evaluación').trim().slice(0, 60)}|${gradeScore.trim().slice(0, 30)}`;
                            setGradeStudentName('');
                            setGradeTaskName('');
                            void updateClassroomMaterials(selectedClassroom.id, {
                              sharedDocTitles: [...selectedClassroom.sharedDocTitles, entry].slice(0, 30),
                            });
                          }}
                          className="flex-1 rounded-lg bg-sky-600 px-2.5 py-1.5 font-semibold text-white cursor-pointer"
                        >
                          Calificar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {roomTab === 'chat' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
              {!linkedChatGroupId ? (
                <div className="py-8 text-center space-y-3">
                  <MessageCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Chat del Aula listo para activarse
                  </p>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Vinculá una sala de chat grupal para conversar en vivo, enviar trabajos y registrar asistencia.
                  </p>
                  {isInstructor && (
                    <button
                      type="button"
                      onClick={() => void handleActivateClassroomChat()}
                      className="rounded-xl bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 cursor-pointer"
                    >
                      Activar Chat del Aula ahora
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="max-h-72 overflow-y-auto space-y-2 p-2 rounded-lg bg-slate-50 dark:bg-[#090D16]">
                    {roomMessages.length === 0 ? (
                      <p className="text-slate-500 text-center py-6">Aún no hay mensajes en este aula.</p>
                    ) : (
                      roomMessages.map((m) => (
                        <div key={m.id} className="rounded-lg bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800 px-3 py-2">
                          <p className="font-bold text-sky-600 dark:text-sky-400">{m.senderName}</p>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{m.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendRoomMessage();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder="Escribí una consulta o aporte para la clase..."
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2"
                    />
                    <button
                      type="submit"
                      disabled={!chatDraft.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
              SECTOR 1 ESTUDIO · CLASES VIRTUALES INTEGRALES
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Aulas virtuales, pizarra digital, tareas y docentes
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Creá aulas gratuitas o aranceladas para cualquier carrera universitaria, terciaria o capacitación profesional. Incluí pizarra interactiva, compartir pantalla, asistencia, entregas, correcciones y chat del aula.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {showCreate ? 'Cerrar formulario' : 'Crear aula virtual'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('perfil')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-sky-500" />
              Ver Perfiles de Profesores
            </button>
          </div>
        </div>
        <div className="lg:col-span-5 min-h-[180px] bg-slate-900">
          <img
            src={aulaHeroImg}
            alt="Aula virtual sincronizada FABRO"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {showCreate && (
        <form
          onSubmit={(e) => void handleCreateSubmit(e)}
          className="rounded-2xl border border-sky-500/30 bg-white dark:bg-[#0F1623] p-5 space-y-4 text-xs"
        >
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Programar o abrir Aula Virtual
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              placeholder="Título de la clase *"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <select
              value={cCourseId}
              onChange={(e) => setCCourseId(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="">Clase abierta independiente</option>
              {courses
                .filter((c) => c.instructorId === user?.uid)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    Curso: {c.title}
                  </option>
                ))}
            </select>
            <select
              value={cPricingTag}
              onChange={(e) => setCPricingTag(e.target.value as 'Gratuito' | 'Pago institucional')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="Gratuito">Curso / Aula Gratuita</option>
              <option value="Pago institucional">Arancelado / Institucional</option>
            </select>
            <input
              type="text"
              value={cSpecialtyTag}
              onChange={(e) => setCSpecialtyTag(e.target.value)}
              placeholder="Carrera / Especialidad (ej: Medicina, Diseño)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="url"
              value={cMeetUrl}
              onChange={(e) => setCMeetUrl(e.target.value)}
              placeholder="Enlace videoconferencia (Meet / Zoom / Jitsi)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <select
              value={cVisibility}
              onChange={(e) => setCVisibility(e.target.value as VirtualClassroom['visibility'])}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="publico">Abierta a todos</option>
              <option value="institucional">Solo institución / grupo</option>
              <option value="privado">Privada</option>
            </select>
            <input
              type="text"
              value={cVideoUrl}
              onChange={(e) => setCVideoUrl(e.target.value)}
              placeholder="Enlace de YouTube inicial (opcional)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={cVideoTitle}
              onChange={(e) => setCVideoTitle(e.target.value)}
              placeholder="Título del video proyectado"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
            <input
              type="datetime-local"
              value={cScheduled}
              onChange={(e) => setCScheduled(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <textarea
            rows={2}
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            placeholder="Temario, bibliografía o instrucciones de la sesión..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              {creating ? 'Abriendo sala...' : 'Crear aula virtual'}
            </button>
          </div>
        </form>
      )}

      {/* Filter strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(
            [
              { id: 'all', label: 'Todas las clases' },
              { id: 'gratuito', label: 'Cursos Gratuitos' },
              { id: 'arancelado', label: 'Institucionales / Pagos' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setLobbyFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                lobbyFilter === f.id
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
          placeholder="Filtrar por materia, carrera o docente..."
          className="w-full sm:w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 text-xs"
        />
      </div>

      {visibleClassrooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2">
          <Video className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No hay aulas virtuales que coincidan con este filtro
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Creá una sala de aula virtual para dar una clase sincronizada con pizarra, tareas y chat en vivo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleClassrooms.map((room) => (
            <article
              key={room.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  {room.playbackState === 'playing' ? 'En reproducción' : 'Sala lista'} · {room.visibility}
                  {room.presentationNotes?.includes('Pago institucional') ? ' · Arancelado' : ' · Gratuito'}
                </p>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {room.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {room.description || 'Clase guiada sincronizada con pizarra, tareas y asistencia.'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Docente: {room.instructorName}
                  {room.scheduledAt ? ` · ${room.scheduledAt.replace('T', ' ')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedId(room.id)}
                  className="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Entrar al aula
                </button>
                {room.instructorId === user?.uid && (
                  <button
                    type="button"
                    onClick={() => void deleteClassroom(room.id)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                    aria-label="Cerrar aula"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Community Profiles Strip */}
      {teachersList.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Perfiles activos en la comunidad FABRO
            </h3>
            <button
              type="button"
              onClick={() => setActiveSection('perfil')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              Ver perfiles →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {teachersList.map((t) => (
              <div key={t.uid} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
                <p className="font-bold text-slate-900 dark:text-white truncate">{t.displayName}</p>
                <p className="text-[11px] text-sky-600 dark:text-sky-400 truncate">
                  {t.sharedPhrase || t.bio || 'Miembro de FABRO'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {t.username ? `@${t.username.replace(/^@/, '')}` : 'Comunidad'}
                  {t.city ? ` · ${t.city}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
