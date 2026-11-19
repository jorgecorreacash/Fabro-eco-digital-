import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Lock, Mic, Sparkles, Square, Trash2, Unlock } from 'lucide-react';
import { DEFAULT_TIME_CAPSULES, vaultGet, vaultSet } from '../../../services/localVault';
import type { TimeCapsuleEntry } from '../../../types/ecosystem';

export const TimeCapsuleTool: React.FC = () => {
  const [capsules, setCapsules] = useState<TimeCapsuleEntry[]>(DEFAULT_TIME_CAPSULES);
  const [hydrated, setHydrated] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [openDate, setOpenDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let active = true;
    void vaultGet<TimeCapsuleEntry[]>('time_capsules', DEFAULT_TIME_CAPSULES).then((stored) => {
      if (!active) return;
      setCapsules(stored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void vaultSet('time_capsules', capsules);
  }, [capsules, hydrated]);

  const startVoice = async () => {
    setMicNote(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicNote('Tu navegador no admite grabación de audio en este contexto.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setAudioDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setMicNote('Permiso de micrófono requerido para adjuntar voz.');
    }
  };

  const stopVoice = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleSealCapsule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const item: TimeCapsuleEntry = {
      id: `cap-${Date.now()}`,
      title: title.trim() || 'Carta al futuro',
      content: content.trim(),
      audioDataUrl,
      openDate,
      createdAt: new Date().toLocaleDateString('es-AR'),
      unlockedManually: false,
    };
    setCapsules((prev) => [item, ...prev]);
    setTitle('');
    setContent('');
    setAudioDataUrl(undefined);
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border-2 border-[#F59E0B]/40 fabro-surface p-5 space-y-5 shadow-[0_8px_24px_-12px_rgba(245,158,11,0.28)]">
      <div className="space-y-1">
        <h3 className="font-display text-base font-bold flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#F59E0B]" />
          Cápsula del Tiempo y Carta al Futuro
        </h3>
        <p className="text-xs italic text-[#B45309] dark:text-[#FBBF24] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          «Si hoy fuera tu último día, ¿qué te haría sentir en paz?»
        </p>
      </div>

      <form onSubmit={handleSealCapsule} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de tu carta..."
            className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
          />
          <label className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 flex items-center justify-between gap-2">
            <span className="fabro-muted inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Abrir el:
            </span>
            <input
              type="date"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              className="bg-transparent text-xs font-mono"
            />
          </label>
        </div>

        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escribí para tu yo del futuro: promesas, gratitud y aquello que hoy valorás..."
          className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed fabro-input"
        />

        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <button
              type="button"
              onClick={() => void startVoice()}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-semibold cursor-pointer active:scale-95"
            >
              <Mic className="w-3.5 h-3.5 text-[#10B981]" />
              {audioDataUrl ? 'Regrabar nota de voz' : 'Adjuntar voz (opcional)'}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoice}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-red-500 bg-red-600 text-white px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
            >
              <Square className="w-3.5 h-3.5" />
              Detener audio
            </button>
          )}

          <button
            type="submit"
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(245,158,11,0.55)] cursor-pointer transition-transform active:scale-95"
          >
            <Lock className="w-3.5 h-3.5" />
            Sellar cápsula en bóveda
          </button>
        </div>
        {micNote && <p className="text-[11px] text-amber-600">{micNote}</p>}
      </form>

      <div className="space-y-2.5">
        {capsules.map((cap) => {
          const isOpen = cap.unlockedManually || cap.openDate <= todayIso;
          return (
            <div
              key={cap.id}
              className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3.5 space-y-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{cap.title}</p>
                  <p className="text-[11px] fabro-muted font-mono">
                    Sellada: {cap.createdAt} · Apertura: {cap.openDate}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isOpen && (
                    <button
                      type="button"
                      onClick={() =>
                        setCapsules((prev) =>
                          prev.map((c) => (c.id === cap.id ? { ...c, unlockedManually: true } : c))
                        )
                      }
                      className="min-h-[44px] inline-flex items-center gap-1 rounded-xl border-2 border-[#10B981]/50 px-3 py-1.5 text-[11px] font-bold text-[#047857] dark:text-[#34D399] cursor-pointer active:scale-95"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Abrir ahora
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCapsules((prev) => prev.filter((c) => c.id !== cap.id))}
                    aria-label="Eliminar cápsula"
                    className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center fabro-muted hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="space-y-2 pt-1">
                  <p className="leading-relaxed">{cap.content}</p>
                  {cap.audioDataUrl && (
                    <audio controls src={cap.audioDataUrl} className="w-full h-9" />
                  )}
                </div>
              ) : (
                <p className="text-[11px] fabro-muted italic flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#F59E0B]" />
                  Cápsula cerrada hasta {cap.openDate}. Podés esperar o desbloquearla manualmente.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
