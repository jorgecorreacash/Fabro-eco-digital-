import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Ban,
  Check,
  CheckCheck,
  Copy,
  FileText,
  Flag,
  Forward,
  LayoutGrid,
  Link2,
  MapPin,
  MessageCircle,
  Mic,
  Paperclip,
  Plus,
  QrCode,
  Radio,
  Search,
  Send,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { useLastDay } from '../../context/LastDayContext';
import { usePlatform } from '../../context/PlatformContext';
import { computeFabroId } from '../../lib/fabroId';
import {
  localGetDownloadURL as getDownloadURL,
  localStorageRef as storageRef,
  localUploadBytes as uploadBytes,
  storage,
} from '../../lib/firebase';
import {
  playPttCancelBeep,
  playPttEndChirp,
  playPttIncomingChirp,
  playPttStartBeep,
} from '../../lib/pttSound';
import type {
  CommunityGroup,
  DirectMessage,
  DirectThread,
  GroupChatMessage,
  PresenceMode,
  PublicUserProfile,
} from '../../types/fabro';
import { CommunityView } from './CommunityView';

type InboxFilter = 'todos' | 'chats' | 'grupos' | 'solicitudes' | 'directorio';

const PRESENCE_OPTIONS: Array<{ value: PresenceMode; label: string; dotClass: string }> = [
  { value: 'online', label: 'En línea', dotClass: 'bg-emerald-500' },
  { value: 'away', label: 'Ausente', dotClass: 'bg-amber-500' },
  { value: 'dnd', label: 'No molestar', dotClass: 'bg-rose-500' },
  { value: 'invisible', label: 'Invisible', dotClass: 'bg-slate-400' },
];

type ActiveRoom =
  | { kind: 'dm'; thread: DirectThread }
  | { kind: 'group'; group: CommunityGroup }
  | null;

type AnyChatMessage = DirectMessage | GroupChatMessage;

function getSoundPref(): boolean {
  try {
    return localStorage.getItem('fabro_sounds_enabled') !== 'false';
  } catch {
    return true;
  }
}

export const SocialHubView: React.FC = () => {
  const { user, profile, setActiveSection } = useFabro();
  const {
    groups,
    publicProfiles,
    directThreads,
    selectedDirectThreadId,
    setSelectedDirectThreadId,
    onlinePeers,
    updatePresenceMode,
    startOrGetDirectThread,
    subscribeDirectMessages,
    sendDirectMessage,
    toggleBlockDirectThread,
    markThreadRead,
    subscribeGroupMessages,
    sendGroupChatMessage,
    joinGroup,
    createGroup,
    submitModerationReport,
    classrooms,
  } = usePlatform();

  const {
    receivedContactRequests,
    sentContactRequests,
    sendContactRequest,
    respondContactRequest,
    deleteContactRequest,
  } = useLastDay();

  const isMinor = Boolean(profile?.isMinor);
  const currentPresence = profile?.presenceMode || 'online';
  const myFabroId = useMemo(
    () => computeFabroId(user?.uid, profile?.customFabroId),
    [user?.uid, profile?.customFabroId]
  );

  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('todos');
  const [searchQ, setSearchQ] = useState('');
  const [activeRoom, setActiveRoom] = useState<ActiveRoom>(null);
  const [showFullCommunity, setShowFullCommunity] = useState(false);

  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [replyQuote, setReplyQuote] = useState<{ author: string; text: string } | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, string[]>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // FABRO ID + QR Modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedId, setCopiedId] = useState(false);

  // In-chat Search & Forward
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQ, setChatSearchQ] = useState('');
  const [forwardMsg, setForwardMsg] = useState<AnyChatMessage | null>(null);

  // Quick Link Share & Media Upload
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Push-to-Talk (Nextel-style Radio Voice)
  const [pttRecording, setPttRecording] = useState(false);
  const [pttSeconds, setPttSeconds] = useState(0);
  const [pttUploading, setPttUploading] = useState(false);
  const [autoPlayPtt, setAutoPlayPtt] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fabro_social_autoplay_ptt') === 'true';
    } catch {
      return false;
    }
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pttChunksRef = useRef<BlobPart[]>([]);
  const pttTimerRef = useRef<number | null>(null);
  const pttCancelledRef = useRef(false);
  const pttStartTimeRef = useRef(0);
  const playedPttIdsRef = useRef<Set<string>>(new Set());
  const pttBaselineLoadedRef = useRef(false);

  // Quick New Group Form
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('fabro_social_autoplay_ptt', String(autoPlayPtt));
    } catch {
      // ignore
    }
  }, [autoPlayPtt]);

  // Generate QR code whenever modal opens
  useEffect(() => {
    if (!qrModalOpen) return;
    let active = true;
    const payload = `FABRO-ID:${myFabroId}|UID:${user?.uid || ''}|NOMBRE:${profile?.displayName || 'Estudiante FABRO'}`;
    void QRCode.toDataURL(payload, {
      width: 220,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [qrModalOpen, myFabroId, user?.uid, profile?.displayName]);

  // Sync externally selected direct thread (e.g. from ProfileDirectory)
  useEffect(() => {
    if (!selectedDirectThreadId || isMinor) return;
    const found = directThreads.find((t) => t.id === selectedDirectThreadId);
    if (found) {
      setActiveRoom({ kind: 'dm', thread: found });
    }
  }, [selectedDirectThreadId, directThreads, isMinor]);

  // Default to first DM or first Group if none selected
  useEffect(() => {
    if (activeRoom) return;
    if (!isMinor && directThreads.length > 0) {
      setActiveRoom({ kind: 'dm', thread: directThreads[0] });
    } else if (groups.length > 0) {
      setActiveRoom({ kind: 'group', group: groups[0] });
    }
  }, [activeRoom, directThreads, groups, isMinor]);

  // Subscribe messages for active room
  useEffect(() => {
    setReplyQuote(null);
    setChatSearchQ('');
    pttBaselineLoadedRef.current = false;
    if (!activeRoom) {
      setDmMessages([]);
      setGroupMessages([]);
      return;
    }
    if (activeRoom.kind === 'dm') {
      void markThreadRead(activeRoom.thread);
      const unsub = subscribeDirectMessages(activeRoom.thread.id, setDmMessages);
      return () => unsub();
    } else {
      const unsub = subscribeGroupMessages(activeRoom.group.id, setGroupMessages);
      return () => unsub();
    }
  }, [activeRoom, subscribeDirectMessages, subscribeGroupMessages, markThreadRead]);

  const activeMessages = useMemo<AnyChatMessage[]>(() => {
    const raw = activeRoom?.kind === 'dm' ? dmMessages : groupMessages;
    const getMs = (val: unknown): number => {
      if (!val) return Date.now();
      if (typeof val === 'string') return Date.parse(val) || 0;
      const maybeTs = val as { toMillis?: () => number };
      if (typeof maybeTs.toMillis === 'function') return maybeTs.toMillis();
      return 0;
    };
    return [...raw].sort((a, b) => getMs(a.createdAt) - getMs(b.createdAt));
  }, [activeRoom?.kind, dmMessages, groupMessages]);

  // Auto-play incoming Push-to-Talk clips when enabled
  useEffect(() => {
    if (!activeRoom || activeMessages.length === 0) return;
    if (!pttBaselineLoadedRef.current) {
      for (const m of activeMessages) playedPttIdsRef.current.add(m.id);
      pttBaselineLoadedRef.current = true;
      return;
    }
    if (!autoPlayPtt) return;
    const latest = activeMessages[activeMessages.length - 1];
    if (
      latest &&
      latest.senderId !== user?.uid &&
      latest.attachmentUrl &&
      latest.attachmentName?.startsWith('ptt-audio:') &&
      !playedPttIdsRef.current.has(latest.id)
    ) {
      playedPttIdsRef.current.add(latest.id);
      playPttIncomingChirp(getSoundPref());
      const audio = new Audio(latest.attachmentUrl);
      void audio.play().catch(() => {
        // Autoplay policy blocked without gesture — user still sees inline player
      });
    }
  }, [activeMessages, activeRoom, autoPlayPtt, user?.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeMessages.length]);

  const onlineUidSet = useMemo(() => new Set(onlinePeers.map((p) => p.uid)), [onlinePeers]);

  const filteredThreads = useMemo(() => {
    if (isMinor) return [];
    const q = searchQ.trim().toLowerCase();
    return directThreads.filter((t) => {
      if (!q) return true;
      const peerIds = t.participantIds
        .map((id) => {
          const prof = publicProfiles.find((p) => p.uid === id);
          return computeFabroId(id, prof?.customFabroId).toLowerCase();
        })
        .join(' ');
      return `${t.participantNames.join(' ')} ${t.lastMessagePreview || ''} ${peerIds}`
        .toLowerCase()
        .includes(q);
    });
  }, [directThreads, isMinor, searchQ, publicProfiles]);

  const filteredGroups = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return groups.filter((g) => {
      if (!q) return true;
      return `${g.name} ${g.description} ${g.specialty} ${g.institutionName}`.toLowerCase().includes(q);
    });
  }, [groups, searchQ]);

  const adultContacts = useMemo(() => {
    if (isMinor) return [];
    const q = searchQ.trim().toLowerCase();
    return publicProfiles.filter((p) => {
      if (p.uid === user?.uid || p.isMinor || !p.searchableInDirectory) return false;
      if ((profile?.blockedUserIds || []).includes(p.uid)) return false;
      if (!q) return true;
      const fabroId = computeFabroId(p.uid, p.customFabroId).toLowerCase();
      return `${p.displayName} ${p.username} ${p.specialty} ${p.city} ${fabroId}`
        .toLowerCase()
        .includes(q);
    });
  }, [publicProfiles, user?.uid, profile?.blockedUserIds, isMinor, searchQ]);

  const displayedMessages = useMemo(() => {
    const q = chatSearchQ.trim().toLowerCase();
    if (!q) return activeMessages;
    return activeMessages.filter(
      (m) =>
        m.text.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        (m.attachmentName || '').toLowerCase().includes(q)
    );
  }, [activeMessages, chatSearchQ]);

  const pendingReqCount = receivedContactRequests.filter((r) => r.status === 'pendiente').length;
  const unreadDmCount = useMemo(
    () => (user && !isMinor ? directThreads.filter((t) => t.unreadBy.includes(user.uid)).length : 0),
    [directThreads, user, isMinor]
  );

  const isActiveRoomBlocked = activeRoom?.kind === 'dm' && activeRoom.thread.status === 'bloqueado';

  const sendToActiveRoom = useCallback(
    async (text: string, attachment?: { url: string; name: string }) => {
      if (!activeRoom || !text.trim()) return;
      if (activeRoom.kind === 'dm') {
        await sendDirectMessage(activeRoom.thread, text, attachment);
      } else {
        await sendGroupChatMessage(activeRoom.group.id, text, attachment);
      }
    },
    [activeRoom, sendDirectMessage, sendGroupChatMessage]
  );

  const handleOpenDm = async (target: PublicUserProfile) => {
    setErrorMsg(null);
    try {
      const id = await startOrGetDirectThread(target);
      setSelectedDirectThreadId(id);
      const created = directThreads.find((t) => t.id === id);
      if (created) setActiveRoom({ kind: 'dm', thread: created });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo iniciar el chat.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !draft.trim() || isActiveRoomBlocked) return;
    setErrorMsg(null);
    const composedText = replyQuote
      ? `↩ ${replyQuote.author}: "${replyQuote.text.slice(0, 70)}"\n${draft.trim()}`
      : draft.trim();
    setDraft('');
    setReplyQuote(null);
    try {
      await sendToActiveRoom(composedText);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    }
  };

  // Nextel-Style Push-to-Talk Lifecycle
  const cleanupPttStream = () => {
    if (pttTimerRef.current !== null) {
      window.clearInterval(pttTimerRef.current);
      pttTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupPttStream();
    };
  }, []);

  const handlePttStart = async () => {
    if (!activeRoom || !user || isActiveRoomBlocked || pttRecording || pttUploading) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg('Tu navegador no admite grabación de audio Push-to-Talk.');
      return;
    }
    setErrorMsg(null);
    pttCancelledRef.current = false;
    pttChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) pttChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const cancelled = pttCancelledRef.current;
        const durationSec = Math.max(1, Math.round((Date.now() - pttStartTimeRef.current) / 1000));
        const blob = new Blob(pttChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanupPttStream();
        setPttRecording(false);
        setPttSeconds(0);

        if (cancelled) {
          playPttCancelBeep(getSoundPref());
          return;
        }
        if (blob.size < 300) {
          setNotice('Mantené presionado al menos 1 segundo para grabar tu voz.');
          return;
        }

        playPttEndChirp(getSoundPref());
        setPttUploading(true);
        try {
          const filePath = `social_ptt/${user.uid}/ptt_${Date.now()}.webm`;
          const sRef = storageRef(storage, filePath);
          await uploadBytes(sRef, blob, { contentType: blob.type || 'audio/webm' });
          const downloadUrl = await getDownloadURL(sRef);
          await sendToActiveRoom(`🎙 Mensaje de voz Push-to-Talk (${durationSec}s)`, {
            url: downloadUrl,
            name: `ptt-audio:${durationSec}s.webm`,
          });
        } catch (err) {
          setErrorMsg(
            err instanceof Error
              ? `No se pudo enviar el audio PTT (${err.message}). Verificá tu conexión o permisos de Storage.`
              : 'No se pudo subir el mensaje de voz.'
          );
        } finally {
          setPttUploading(false);
        }
      };

      pttStartTimeRef.current = Date.now();
      recorder.start(200);
      setPttRecording(true);
      setPttSeconds(0);
      playPttStartBeep(getSoundPref());
      pttTimerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - pttStartTimeRef.current) / 1000);
        setPttSeconds(secs);
        if (secs >= 60 && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 250);
    } catch (err) {
      cleanupPttStream();
      setPttRecording(false);
      setErrorMsg(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Habilitalo en el navegador para usar Push-to-Talk.'
          : 'No se pudo acceder al micrófono.'
      );
    }
  };

  const handlePttStopAndSend = () => {
    if (!pttRecording || !mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePttCancel = () => {
    if (!pttRecording || !mediaRecorderRef.current) return;
    pttCancelledRef.current = true;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Media / File Attachment Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeRoom || !user || isActiveRoomBlocked) return;
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('El archivo supera el límite de 15 MB por mensaje.');
      return;
    }
    setUploadingMedia(true);
    setErrorMsg(null);
    try {
      const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      const path = `social_media/${user.uid}/${Date.now()}_${safeName}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file, { contentType: file.type || 'application/octet-stream' });
      const url = await getDownloadURL(sRef);

      const prefix = file.type.startsWith('image/')
        ? 'img:'
        : file.type.startsWith('video/')
          ? 'vid:'
          : 'doc:';
      const label =
        prefix === 'img:'
          ? `Imagen compartida: ${safeName}`
          : prefix === 'vid:'
            ? `Video compartido: ${safeName}`
            : `Archivo adjunto: ${safeName}`;

      await sendToActiveRoom(label, {
        url,
        name: `${prefix}${safeName}`.slice(0, 250),
      });
      setNotice('Archivo enviado en la conversación.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `No se pudo subir el archivo (${err.message}).`
          : 'Error al subir archivo adjunto.'
      );
    } finally {
      setUploadingMedia(false);
    }
  };

  // Share Web Link
  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrlInput.trim() || !activeRoom || isActiveRoomBlocked) return;
    const raw = linkUrlInput.trim();
    const validUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const title = linkTitleInput.trim() || validUrl;
    try {
      await sendToActiveRoom(`🔗 ${title}\n${validUrl}`, {
        url: validUrl.slice(0, 1950),
        name: `link:${title.slice(0, 200)}`,
      });
      setLinkUrlInput('');
      setLinkTitleInput('');
      setLinkModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo compartir el enlace.');
    }
  };

  // Share GPS Location
  const handleShareLocation = () => {
    if (!activeRoom || isActiveRoomBlocked) return;
    if (!navigator.geolocation) {
      setErrorMsg('Tu dispositivo no admite geolocalización desde el navegador.');
      return;
    }
    setLocatingGps(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
          await sendToActiveRoom(`📍 Ubicación compartida: ${lat}, ${lng}\n${mapsUrl}`, {
            url: mapsUrl,
            name: `link:Mapa (${lat}, ${lng})`,
          });
          setNotice('Ubicación compartida en el chat.');
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Error al enviar ubicación.');
        } finally {
          setLocatingGps(false);
        }
      },
      () => {
        setLocatingGps(false);
        setErrorMsg('No se pudo obtener la ubicación (verificá permisos de GPS).');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  // Forward Message
  const handleForwardToTarget = async (target: { kind: 'dm'; thread: DirectThread } | { kind: 'group'; group: CommunityGroup }) => {
    if (!forwardMsg) return;
    setErrorMsg(null);
    const forwardedText = `↪ Reenviado de ${forwardMsg.senderName}:\n${forwardMsg.text}`;
    const att = forwardMsg.attachmentUrl
      ? { url: forwardMsg.attachmentUrl, name: forwardMsg.attachmentName || 'Adjunto' }
      : undefined;
    try {
      if (target.kind === 'dm') {
        await sendDirectMessage(target.thread, forwardedText, att);
      } else {
        await sendGroupChatMessage(target.group.id, forwardedText, att);
      }
      setForwardMsg(null);
      setNotice('Mensaje reenviado correctamente.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo reenviar el mensaje.');
    }
  };

  const handleCreateQuickGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const id = await createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || 'Grupo social y de estudio en FABRO',
        groupType: 'libre',
        visibility: 'publico',
        country: profile?.country || 'Argentina',
        province: profile?.province || '',
        city: profile?.city || '',
        institutionName: profile?.institution || '',
        career: profile?.career || '',
        courseName: '',
        subjectName: '',
        specialty: '',
        allowMinors: true,
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowNewGroup(false);
      const found = groups.find((g) => g.id === id);
      if (found) setActiveRoom({ kind: 'group', group: found });
      setNotice('Grupo creado y listo para conversar estilo globo.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo crear el grupo.');
    }
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    setReactionsByMsg((prev) => {
      const curr = prev[msgId] || [];
      const next = curr.includes(emoji) ? curr.filter((x) => x !== emoji) : [...curr, emoji].slice(-4);
      return { ...prev, [msgId]: next };
    });
  };

  const formatTime = (val: unknown) => {
    if (!val) return 'Ahora';
    try {
      if (typeof val === 'string') return new Date(val).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const maybeTs = val as { toDate?: () => Date };
      if (typeof maybeTs.toDate === 'function') {
        return maybeTs.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      // fallback
    }
    return 'Hoy';
  };

  const copyMyId = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(myFabroId).then(() => {
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1800);
    });
  };

  if (showFullCommunity) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 fabro-shell-surface px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Muro, Encuestas y Recursos completos de Comunidad
          </p>
          <button
            type="button"
            onClick={() => setShowFullCommunity(false)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Volver al Chat Estilo Globo
          </button>
        </div>
        <CommunityView />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unified Private Social Header */}
      <section className="rounded-2xl border border-sky-500/25 fabro-shell-surface p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-400">
              Sector 03 · Red Social FABRO
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('inicio')}
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-300 cursor-pointer whitespace-nowrap"
            >
              ← Volver a Inicio
            </button>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#FAF6EE]">
            Red Social FABRO · Chat, Grupos y Globo Flotante
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
            Mensajería 1:1 verificada para adultos, grupos de estudio y comunidades, notas Push-to-Talk, muro con reacciones, código QR FABRO ID y globo persistente desde cualquier sector.
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {onlinePeers.length} en línea · {groups.length} grupos · {directThreads.length} chats · ID:{' '}
            <span className="font-mono font-semibold text-slate-700 dark:text-[#FAF6EE]">{myFabroId}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {PRESENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => void updatePresenceMode(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer ${
                  currentPresence === opt.value
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5" />
            Mi FABRO ID y QR
          </button>

          <button
            type="button"
            onClick={() => setShowFullCommunity(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Muro / Encuestas
          </button>
        </div>
      </section>

      {isMinor && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            <strong>Protección para menores activa (-18):</strong> Los chats privados 1:1 y el directorio abierto de adultos están deshabilitados por seguridad. Podés comunicarte normalmente en Grupos educativos moderados.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="font-semibold cursor-pointer">
            Cerrar
          </button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-semibold cursor-pointer">
            OK
          </button>
        </div>
      )}

      {/* Split Messenger Canvas */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 fabro-shell-surface overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
        {/* Left Rail */}
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col max-h-[680px]">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Buscar nombre, grupo o FABRO ID (FBR-...)"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowNewGroup((v) => !v)}
                className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shrink-0"
                title="Crear nuevo grupo"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showNewGroup && (
              <form onSubmit={(e) => void handleCreateQuickGroup(e)} className="space-y-2 rounded-xl border border-emerald-500/30 p-2.5 bg-emerald-500/5">
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Nombre del grupo o canal..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Descripción breve..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowNewGroup(false)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white cursor-pointer"
                  >
                    Crear grupo
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  ...(!isMinor ? [{ id: 'chats', label: `Chats (${unreadDmCount || directThreads.length})` }] : []),
                  { id: 'grupos', label: `Grupos (${groups.length})` },
                  ...(!isMinor ? [{ id: 'solicitudes', label: `Solicitudes (${pendingReqCount})` }] : []),
                  ...(!isMinor ? [{ id: 'directorio', label: 'Personas +18' }] : []),
                ] as Array<{ id: InboxFilter; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setInboxFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                    inboxFilter === f.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
            {!isMinor && (inboxFilter === 'todos' || inboxFilter === 'chats') &&
              filteredThreads.map((t) => {
                const otherIdx = t.participantIds[0] === user?.uid ? 1 : 0;
                const otherName = t.participantNames[otherIdx] || 'Usuario FABRO';
                const otherUid = t.participantIds[otherIdx];
                const otherProfile = publicProfiles.find((p) => p.uid === otherUid);
                const otherFabroId = computeFabroId(otherUid, otherProfile?.customFabroId);
                const isSelected = activeRoom?.kind === 'dm' && activeRoom.thread.id === t.id;
                const isUnread = Boolean(user && t.unreadBy.includes(user.uid));
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedDirectThreadId(t.id);
                      setActiveRoom({ kind: 'dm', thread: t });
                    }}
                    className={`w-full px-3.5 py-3 text-left flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-sky-600 text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                      {otherName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {otherName}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {t.status === 'bloqueado' ? 'Chat bloqueado' : t.lastMessagePreview || otherFabroId}
                      </p>
                    </div>
                  </button>
                );
              })}

            {(inboxFilter === 'todos' || inboxFilter === 'grupos') &&
              filteredGroups.map((g) => {
                const isSelected = activeRoom?.kind === 'group' && activeRoom.group.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveRoom({ kind: 'group', group: g })}
                    className={`w-full px-3.5 py-3 text-left flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {g.name}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                          {g.memberCount}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Grupo · {g.specialty || g.groupType}
                      </p>
                    </div>
                  </button>
                );
              })}

            {!isMinor && inboxFilter === 'solicitudes' && (
              <div className="p-3 space-y-2.5">
                {receivedContactRequests.length === 0 && sentContactRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No tenés solicitudes de contacto pendientes.
                  </p>
                ) : (
                  <>
                    {receivedContactRequests.map((req) => (
                      <div key={req.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-2">
                        <p className="font-bold text-slate-900 dark:text-white">{req.fromName}</p>
                        {req.message && <p className="text-[11px] text-slate-500">{req.message}</p>}
                        <div className="flex gap-1.5">
                          {req.status === 'pendiente' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void respondContactRequest(req, 'aceptada')}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                Aceptar
                              </button>
                              <button
                                type="button"
                                onClick={() => void respondContactRequest(req, 'rechazada')}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] cursor-pointer"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {req.status === 'aceptada' && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleOpenDm({
                                  uid: req.fromUserId,
                                  displayName: req.fromName,
                                  username: '',
                                  photoURL: '',
                                  bio: '',
                                  interests: [],
                                  institutions: [],
                                  isStudent: false,
                                  isInstructor: false,
                                  instructorCategory: 'docente_institucional',
                                  verificationStatus: 'no_solicitado',
                                  specialty: '',
                                  experienceSummary: '',
                                  reputationPoints: 0,
                                  followersCount: 0,
                                  presenceStatus: 'offline',
                                  searchableInDirectory: true,
                                  isMinor: false,
                                  province: '',
                                  city: '',
                                  country: '',
                                })
                              }
                              className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              Abrir chat
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {sentContactRequests.map((req) => (
                      <div key={req.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-between text-xs">
                        <span className="truncate">Para {req.toName} ({req.status})</span>
                        <button
                          type="button"
                          onClick={() => void deleteContactRequest(req.id)}
                          className="text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {!isMinor && inboxFilter === 'directorio' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {adultContacts.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No se encontraron perfiles adultos con ese filtro.
                  </p>
                ) : (
                  adultContacts.map((p) => {
                    const isOnlineNow = onlineUidSet.has(p.uid) || p.presenceStatus === 'online';
                    const peerFabroId = computeFabroId(p.uid, p.customFabroId);
                    return (
                      <div key={p.uid} className="px-3.5 py-3 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isOnlineNow ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{p.displayName}</p>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {peerFabroId} · {p.sharedPhrase || (p.username ? `@${p.username}` : 'Perfil FABRO')}
                            {p.city ? ` · ${p.city}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void sendContactRequest(p, '¡Hola! Me gustaría conectar en FABRO.')}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] cursor-pointer"
                          >
                            Conectar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleOpenDm(p)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            Chat
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right Canvas */}
        <section className="lg:col-span-8 flex flex-col max-h-[680px]">
          {activeRoom ? (
            <>
              {/* Active Chat Top Bar */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 fabro-shell-surface-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                      {activeRoom.kind === 'dm'
                        ? (activeRoom.thread.participantNames[activeRoom.thread.participantIds[0] === user?.uid ? 1 : 0] || 'U').slice(0, 2).toUpperCase()
                        : <Users className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                        {activeRoom.kind === 'dm'
                          ? activeRoom.thread.participantNames[activeRoom.thread.participantIds[0] === user?.uid ? 1 : 0] || 'Chat Directo'
                          : activeRoom.group.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                        {activeRoom.kind === 'dm'
                          ? isActiveRoomBlocked
                            ? 'Conversación bloqueada'
                            : `Chat directo 1:1 · ID ${computeFabroId(
                                activeRoom.thread.participantIds[activeRoom.thread.participantIds[0] === user?.uid ? 1 : 0],
                                publicProfiles.find(
                                  (p) =>
                                    p.uid ===
                                    activeRoom.thread.participantIds[activeRoom.thread.participantIds[0] === user?.uid ? 1 : 0]
                                )?.customFabroId
                              )}`
                          : `${activeRoom.group.memberCount} miembros · Estilo globo + Radio PTT`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setAutoPlayPtt((v) => !v)}
                      title="Reproducir automáticamente mensajes de voz PTT entrantes"
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        autoPlayPtt
                          ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {autoPlayPtt ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Auto-voz PTT</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setChatSearchOpen((v) => !v);
                        if (chatSearchOpen) setChatSearchQ('');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Buscar</span>
                    </button>

                    {activeRoom.kind === 'group' && (
                      <button
                        type="button"
                        onClick={() => void joinGroup(activeRoom.group)}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer"
                      >
                        Unirme
                      </button>
                    )}
                    {activeRoom.kind === 'dm' && (
                      <button
                        type="button"
                        onClick={() => void toggleBlockDirectThread(activeRoom.thread)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        {isActiveRoomBlocked ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void submitModerationReport({
                          targetType: activeRoom.kind === 'dm' ? 'mensaje' : 'grupo',
                          targetId: activeRoom.kind === 'dm' ? activeRoom.thread.id : activeRoom.group.id,
                          targetSummary:
                            activeRoom.kind === 'dm'
                              ? `Chat ${activeRoom.thread.participantNames.join(' / ')}`
                              : `Grupo ${activeRoom.group.name}`,
                          reason: 'Reporte desde Social Unificado',
                          details: 'Solicitud de revisión desde el chat estilo globo.',
                        }).then(() => setNotice('Reporte enviado a moderación.'))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1 text-rose-600 dark:text-rose-400 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Reportar
                    </button>
                  </div>
                </div>

                {chatSearchOpen && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatSearchQ}
                      onChange={(e) => setChatSearchQ(e.target.value)}
                      placeholder="Filtrar mensajes dentro de esta conversación..."
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-1.5 text-xs"
                    />
                    {chatSearchQ && (
                      <button
                        type="button"
                        onClick={() => setChatSearchQ('')}
                        className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bubble Stream ("Estilo Globo") */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 fabro-chat-canvas">
                {displayedMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-12">
                    <div className="rounded-2xl fabro-shell-surface border px-5 py-4 text-center max-w-sm shadow-sm">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {chatSearchQ ? 'Sin coincidencias en este chat' : 'Espacio listo para conversar estilo globo'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {chatSearchQ
                          ? 'Probá con otra palabra clave o limpiá el filtro.'
                          : 'Escribí un mensaje, adjuntá archivos o mantené presionado el botón de radio Push-to-Talk.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  displayedMessages.map((msg) => {
                    const senderId = msg.senderId;
                    const senderName = msg.senderName;
                    const mine = senderId === user?.uid;
                    const msgReactions = reactionsByMsg[msg.id] || [];
                    const attName = msg.attachmentName || '';
                    const attUrl = msg.attachmentUrl || '';
                    const isPttAudio = Boolean(attUrl && attName.startsWith('ptt-audio:'));
                    const isImageAtt = Boolean(attUrl && attName.startsWith('img:'));
                    const isVideoAtt = Boolean(attUrl && attName.startsWith('vid:'));
                    const isDocAtt = Boolean(attUrl && !isPttAudio && !isImageAtt && !isVideoAtt && !attName.startsWith('link:'));

                    return (
                      <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className="group max-w-[84%] sm:max-w-[72%] space-y-1">
                          <div
                            className={`px-3.5 py-2.5 shadow-sm text-xs leading-relaxed ${
                              mine ? 'fabro-bubble-out' : 'fabro-bubble-in'
                            }`}
                          >
                            {!mine && (
                              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                                {senderName}
                              </p>
                            )}

                            {isPttAudio ? (
                              <div className="space-y-1.5 py-0.5">
                                <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                                  <Radio className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span>{msg.text}</span>
                                </div>
                                <audio controls preload="metadata" src={attUrl} className="w-full min-w-[210px] h-8" />
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            )}

                            {isImageAtt && (
                              <a href={attUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                <img
                                  src={attUrl}
                                  alt={attName.slice(4) || 'Imagen compartida'}
                                  referrerPolicy="no-referrer"
                                  className="rounded-lg max-h-60 w-auto object-cover border border-black/10"
                                />
                              </a>
                            )}

                            {isVideoAtt && (
                              <video
                                controls
                                preload="metadata"
                                src={attUrl}
                                className="rounded-lg max-h-60 w-full mt-2 bg-black"
                              />
                            )}

                            {isDocAtt && (
                              <a
                                href={attUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-current/20 px-2.5 py-1.5 text-[11px] font-semibold underline"
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[200px]">{attName.replace(/^doc:/, '') || 'Abrir archivo'}</span>
                              </a>
                            )}

                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70 tabular-nums">
                              <span>{formatTime(msg.createdAt)}</span>
                              {mine && (
                                activeRoom.kind === 'dm'
                                  ? <CheckCheck className="w-3 h-3 text-sky-500" />
                                  : <Check className="w-3 h-3" />
                              )}
                            </div>
                          </div>

                          {/* Reactions, Reply & Forward */}
                          <div className={`flex items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                            {msgReactions.map((em) => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => toggleReaction(msg.id, em)}
                                className="rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[11px] shadow-xs cursor-pointer"
                              >
                                {em}
                              </button>
                            ))}
                            <div className="opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 shadow-xs">
                              {['👍', '❤️', '🍀', '🔥'].map((em) => (
                                <button
                                  key={em}
                                  type="button"
                                  onClick={() => toggleReaction(msg.id, em)}
                                  className="text-[11px] hover:scale-110 transition-transform cursor-pointer px-0.5"
                                >
                                  {em}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setReplyQuote({ author: senderName, text: msg.text })}
                                className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 pl-1 cursor-pointer"
                              >
                                Responder
                              </button>
                              <button
                                type="button"
                                onClick={() => setForwardMsg(msg)}
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 pl-1 cursor-pointer"
                              >
                                <Forward className="w-3 h-3" />
                                Reenviar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer + Push-to-Talk Radio Bar */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 fabro-shell-surface space-y-2">
                {replyQuote && (
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate">
                      Respondiendo a <strong>{replyQuote.author}</strong>: {replyQuote.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyQuote(null)}
                      className="font-bold text-slate-500 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}

                {linkModalOpen && (
                  <form onSubmit={(e) => void handleSendLink(e)} className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-2.5 flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={linkTitleInput}
                      onChange={(e) => setLinkTitleInput(e.target.value)}
                      placeholder="Título opcional"
                      className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      required
                      value={linkUrlInput}
                      onChange={(e) => setLinkUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 min-w-[160px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                    />
                    <button type="submit" className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">
                      Enviar enlace
                    </button>
                    <button type="button" onClick={() => setLinkModalOpen(false)} className="text-slate-500 px-1.5 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {pttRecording && (
                  <div className="rounded-xl border border-amber-500 bg-amber-500/15 px-3.5 py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200 tabular-nums">
                      <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span>Transmitiendo radio PTT · {String(Math.floor(pttSeconds / 60)).padStart(2, '0')}:{String(pttSeconds % 60).padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePttCancel}
                        className="rounded-lg border border-rose-500/40 bg-white/80 dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-rose-600 cursor-pointer"
                      >
                        Cancelar envío
                      </button>
                      <button
                        type="button"
                        onClick={handlePttStopAndSend}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                      >
                        Enviar voz
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={(e) => void handleSendMessage(e)} className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                    onChange={(e) => void handleFileUpload(e)}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isActiveRoomBlocked || uploadingMedia}
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar imagen, video o documento"
                    className="p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={isActiveRoomBlocked}
                    onClick={() => setLinkModalOpen((v) => !v)}
                    title="Compartir enlace web"
                    className="p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={isActiveRoomBlocked || locatingGps}
                    onClick={handleShareLocation}
                    title="Compartir ubicación GPS actual"
                    className="p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    disabled={isActiveRoomBlocked}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      isActiveRoomBlocked
                        ? 'Conversación bloqueada'
                        : uploadingMedia
                          ? 'Subiendo archivo...'
                          : pttUploading
                            ? 'Enviando mensaje de voz PTT...'
                            : 'Escribí un mensaje estilo globo...'
                    }
                    className="flex-1 min-w-[140px] rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-4 py-2 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  />

                  <button
                    type="button"
                    disabled={isActiveRoomBlocked || pttUploading}
                    onPointerDown={() => void handlePttStart()}
                    onPointerUp={handlePttStopAndSend}
                    onPointerCancel={handlePttCancel}
                    onContextMenu={(e) => e.preventDefault()}
                    title="Mantener presionado para transmitir radio Push-to-Talk"
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold select-none touch-none cursor-pointer shrink-0 transition-colors ${
                      pttRecording
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                        : 'border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25'
                    } disabled:opacity-40`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span className="hidden md:inline whitespace-nowrap">
                      {pttRecording ? 'SOLTAR' : 'PRESIONAR PARA HABLAR'}
                    </span>
                  </button>

                  <button
                    type="submit"
                    disabled={isActiveRoomBlocked || !draft.trim()}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 p-2.5 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shrink-0"
                    aria-label="Enviar mensaje"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
              <MessageCircle className="w-10 h-10 opacity-50 mb-2" />
              <p className="font-display text-base font-bold text-slate-800 dark:text-slate-100">
                Elegí un chat o grupo a la izquierda
              </p>
              <p className="text-xs max-w-sm mt-1">
                Todo tu ecosistema social (grupos, comunidad, radio Push-to-Talk y mensajes 1:1) reunido en burbujas estilo WhatsApp y Telegram.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Modal: Mi FABRO ID y Código QR */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 space-y-4 text-center shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Identidad y QR de FABRO
              </h3>
              <button type="button" onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrDataUrl && (
              <div className="inline-flex rounded-2xl bg-white p-3 border border-slate-200 mx-auto">
                <img src={qrDataUrl} alt={`QR ${myFabroId}`} className="w-48 h-48" />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile?.displayName || user?.email}
              </p>
              <p className="font-mono text-lg font-bold tracking-wider text-sky-600 dark:text-sky-400 tabular-nums">
                {myFabroId}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Compartí tu código FABRO ID permanente o este QR para que otros usuarios adultos verifiquen tu perfil y te encuentren en Red Social.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={copyMyId}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId ? 'Copiado' : 'Copiar FABRO ID'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reenviar Mensaje */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Reenviar mensaje a...
              </h3>
              <button type="button" onClick={() => setForwardMsg(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-2.5 text-slate-600 dark:text-slate-300 line-clamp-2">
              {forwardMsg.text}
            </p>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {!isMinor &&
                directThreads
                  .filter((t) => t.status === 'activo')
                  .map((t) => {
                    const otherIdx = t.participantIds[0] === user?.uid ? 1 : 0;
                    const name = t.participantNames[otherIdx] || 'Usuario';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void handleForwardToTarget({ kind: 'dm', thread: t })}
                        className="w-full py-2.5 px-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                      >
                        <span>Chat directo · {name}</span>
                        <Send className="w-3.5 h-3.5 text-emerald-500" />
                      </button>
                    );
                  })}

              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => void handleForwardToTarget({ kind: 'group', group: g })}
                  className="w-full py-2.5 px-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>Grupo · {g.name}</span>
                  <Send className="w-3.5 h-3.5 text-emerald-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
