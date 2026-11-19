import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Volume2 } from 'lucide-react';
import { vaultGet, vaultSet } from '../../../services/localVault';
import { activateMediaSession, stopMediaSession } from '../../../services/mediaSessionBridge';
import type { ClassVoiceNote } from '../../../types/ecosystem';

const SUBJECTS = [
  'Derecho Constitucional',
  'Anatomía Funcional',
  'Arquitectura de Software',
  'General',
];

export const VoiceNotesTool: React.FC = () => {
  const [notes, setNotes] = useState<ClassVoiceNote[]>([]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [title, setTitle] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef(0);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    void vaultGet<ClassVoiceNote[]>('class_voice_notes', []).then(setNotes);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  const startRecording = async () => {
    setErrorMsg(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setErrorMsg('Este navegador no soporta grabación de audio local.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          if (!dataUrl) return;
          const entry: ClassVoiceNote = {
            id: `vnote-${Date.now()}`,
            subject,
            title: title.trim() || `Nota de clase (${subject})`,
            durationSec: Math.max(1, elapsedRef.current),
            audioDataUrl: dataUrl,
            createdAt: new Date().toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setNotes((prev) => {
            const next = [entry, ...prev].slice(0, 20);
            void vaultSet('class_voice_notes', next);
            return next;
          });
          setTitle('');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      elapsedRef.current = 0;
      setElapsedSec(0);
      recorder.start();
      setRecording(true);
    } catch {
      setErrorMsg(
        'No se pudo acceder al micrófono. Verificá los permisos de audio en tu teléfono o navegador.'
      );
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      void vaultSet('class_voice_notes', next);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border-2 border-[#06B6D4]/40 fabro-surface p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#06B6D4]" />
            Grabador de Notas de Voz para Clases
          </h2>
          <p className="text-xs fabro-muted mt-0.5">
            Grabá explicaciones del profesor o notas propias y adjuntalas a cada materia offline.
          </p>
        </div>
        <span className="font-mono text-xs fabro-muted tabular-nums">
          {notes.length} grabaciones locales
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="Materia de la grabación"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (ej. Unidad 3 — Resumen oral)"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />

        {!recording ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="fabro-btn border-[#2563EB] bg-[#2563EB] text-white"
            style={{ boxShadow: '0 6px 14px rgba(37, 99, 235, 0.25)' }}
          >
            <Mic className="w-4 h-4" />
            Grabar nota de voz
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="fabro-btn border-red-600 bg-red-600 text-white"
            style={{ boxShadow: '0 6px 14px rgba(220, 38, 38, 0.28)' }}
          >
            <Square className="w-4 h-4" />
            Detener ({elapsedSec}s)
          </button>
        )}
      </div>

      {errorMsg && (
        <p className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
          {errorMsg}
        </p>
      )}

      {notes.length === 0 ? (
        <p className="text-xs fabro-muted">
          Todavía no grabaste notas de voz en esta materia. Presioná «Grabar nota de voz» para comenzar.
        </p>
      ) : (
        <div className="space-y-2.5">
          {notes.map((n, idx) => (
            <div
              key={n.id}
              className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold truncate">{n.title}</p>
                  <p className="text-[11px] fabro-muted font-mono tabular-nums">
                    {n.subject} · {n.durationSec}s · {n.createdAt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteNote(n.id)}
                  aria-label={`Eliminar ${n.title}`}
                  className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center text-red-600 dark:text-red-400 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <audio
                ref={(el) => {
                  if (el) audioRefs.current.set(n.id, el);
                  else audioRefs.current.delete(n.id);
                }}
                controls
                src={n.audioDataUrl}
                className="w-full h-9"
                onPlay={(e) => {
                  const audioEl = e.currentTarget;
                  activateMediaSession({
                    title: n.title,
                    artist: `${n.subject} · Nota de voz`,
                    album: '🍀 FABRO · Grabaciones de Clase',
                    mode: 'audio',
                    playbackState: 'playing',
                    keepSilentAudioAlive: false,
                    handlers: {
                      onPlay: () => void audioEl.play(),
                      onPause: () => audioEl.pause(),
                      onNext:
                        idx + 1 < notes.length
                          ? () => {
                              audioEl.pause();
                              void audioRefs.current.get(notes[idx + 1].id)?.play();
                            }
                          : undefined,
                      onPrev:
                        idx > 0
                          ? () => {
                              audioEl.pause();
                              void audioRefs.current.get(notes[idx - 1].id)?.play();
                            }
                          : undefined,
                      onStop: () => {
                        audioEl.pause();
                        audioEl.currentTime = 0;
                        stopMediaSession('audio');
                      },
                    },
                  });
                }}
                onPause={() => stopMediaSession('audio')}
                onEnded={() => stopMediaSession('audio')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
