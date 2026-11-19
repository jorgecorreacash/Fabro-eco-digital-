import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { checkUsernameAvailability, normalizeHandle } from '../../../services/cloudSyncService';
import { processAvatarImage, processCoverImage } from '../../../services/mediaVault';
import type { LocalUserProfile } from '../../../types/ecosystem';

const INTEREST_PRESETS = [
  'Derecho',
  'Calistenia',
  'Estudio Nocturno',
  'Investigación',
  'Flashcards SRS',
  'Estoicismo',
  'Programación',
  'Lectura Profunda',
  'Bienestar',
  'Organización',
  'Idiomas',
  'Música',
];

const ACTIVITY_PRESETS = [
  'En modo enfoque · Pomodoro 25/5',
  'Preparando parciales esta semana',
  'Rutina de movilidad e hidratación',
  'Leyendo apuntes en modo offline',
  'Disponible para grupo de estudio',
];

export const EditSocialProfileModal: React.FC = () => {
  const {
    profile,
    authUser,
    network,
    editSocialProfileOpen,
    setEditSocialProfileOpen,
    saveFullSocialProfile,
    signInWithGoogle,
    needsProfileSetup,
  } = useEcosystem();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [currentActivity, setCurrentActivity] = useState(profile.currentActivity || '');
  const [dailyPhrase, setDailyPhrase] = useState(profile.dailyPhrase || '');
  const [interests, setInterests] = useState<string[]>(profile.interests || []);
  const [interestInput, setInterestInput] = useState('');
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');
  const [coverPhotoURL, setCoverPhotoURL] = useState(profile.coverPhotoURL || '');
  const [privacyMode, setPrivacyMode] = useState<LocalUserProfile['privacyMode']>(
    profile.privacyMode
  );
  const [shareTastesPublicly, setShareTastesPublicly] = useState<boolean>(
    profile.shareTastesPublicly
  );

  const [handleState, setHandleState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'offline'
  >('idle');
  const [processingMedia, setProcessingMedia] = useState<'avatar' | 'cover' | null>(null);
  const [saving, setSaving] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!editSocialProfileOpen) return;
    setDisplayName(profile.displayName || '');
    setUsername(profile.username || authUser?.username || '');
    setBio(profile.bio || '');
    setCurrentActivity(profile.currentActivity || '');
    setDailyPhrase(profile.dailyPhrase || '');
    setInterests(profile.interests || []);
    setPhotoURL(profile.photoURL || authUser?.photoURL || '');
    setCoverPhotoURL(profile.coverPhotoURL || '');
    setPrivacyMode(profile.privacyMode || 'grupo');
    setShareTastesPublicly(Boolean(profile.shareTastesPublicly));
    setFeedback(null);
    setHandleState('idle');
  }, [authUser?.photoURL, authUser?.username, editSocialProfileOpen, profile]);

  useEffect(() => {
    if (!editSocialProfileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditSocialProfileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editSocialProfileOpen, setEditSocialProfileOpen]);

  if (!editSocialProfileOpen) return null;

  const handleCheckUsername = async (raw: string) => {
    const clean = normalizeHandle(raw);
    setUsername(clean);
    if (!clean) {
      setHandleState('idle');
      return;
    }
    if (clean.length < 3) {
      setHandleState('invalid');
      return;
    }
    if (clean === (profile.username || authUser?.username)) {
      setHandleState('available');
      return;
    }
    if (!network.isOnline) {
      setHandleState('offline');
      return;
    }
    setHandleState('checking');
    const res = await checkUsernameAvailability(clean);
    setHandleState(res);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessingMedia('avatar');
    setFeedback(null);
    try {
      const optimized = await processAvatarImage(file);
      setPhotoURL(optimized);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No pudimos procesar la foto de perfil.',
      });
    } finally {
      setProcessingMedia(null);
    }
  };

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessingMedia('cover');
    setFeedback(null);
    try {
      const optimized = await processCoverImage(file);
      setCoverPhotoURL(optimized);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No pudimos procesar la foto de portada.',
      });
    } finally {
      setProcessingMedia(null);
    }
  };

  const toggleInterest = (tag: string) => {
    const clean = tag.trim().slice(0, 32);
    if (!clean) return;
    setInterests((prev) =>
      prev.includes(clean)
        ? prev.filter((item) => item !== clean)
        : prev.length < 12
        ? [...prev, clean]
        : prev
    );
  };

  const handleAddCustomInterest = () => {
    const clean = interestInput.trim().slice(0, 32);
    if (!clean) return;
    if (!interests.includes(clean) && interests.length < 12) {
      setInterests((prev) => [...prev, clean]);
    }
    setInterestInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      setFeedback({ type: 'err', text: 'Escribí tu nombre visible para guardar el perfil.' });
      return;
    }
    const cleanHandle = normalizeHandle(username);
    if (username.trim() && cleanHandle.length < 3) {
      setFeedback({
        type: 'err',
        text: 'El @usuario debe tener al menos 3 caracteres (letras, números o punto).',
      });
      return;
    }
    if (handleState === 'taken') {
      setFeedback({ type: 'err', text: 'Ese @usuario ya está ocupado. Elegí otro identificador.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    const res = await saveFullSocialProfile({
      displayName: cleanName.slice(0, 80),
      username: cleanHandle || profile.username,
      bio: bio.trim().slice(0, 480),
      currentActivity: currentActivity.trim().slice(0, 120),
      dailyPhrase: dailyPhrase.trim().slice(0, 260),
      interests,
      photoURL,
      coverPhotoURL,
      privacyMode,
      shareTastesPublicly,
    });
    setSaving(false);

    if (res.ok) {
      setFeedback({
        type: 'ok',
        text: authUser
          ? 'Perfil social guardado y sincronizado con tu FABRO ID.'
          : 'Perfil social guardado localmente en IndexedDB (Modo Invitado).',
      });
      window.setTimeout(() => {
        setEditSocialProfileOpen(false);
      }, 650);
    } else {
      setFeedback({ type: 'err', text: res.error || 'No pudimos guardar el perfil.' });
    }
  };

  if (!authUser) {
    return (
      <div
        className="no-print fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setEditSocialProfileOpen(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Iniciá sesión con Google para crear tu perfil en FABRO"
          className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border fabro-border fabro-surface p-6 shadow-2xl space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Creá tu perfil en FABRO</h2>
              <p className="text-xs fabro-muted leading-relaxed">
                Primero iniciá sesión con tu cuenta de Google. Una vez que entres, vas a poder crear y personalizar tu perfil en FABRO.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditSocialProfileOpen(false)}
              aria-label="Cerrar"
              className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {feedback && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {feedback.text}
            </p>
          )}

          <button
            type="button"
            disabled={googleSigningIn}
            onClick={async () => {
              setGoogleSigningIn(true);
              setFeedback(null);
              const res = await signInWithGoogle();
              setGoogleSigningIn(false);
              if (!res.ok && res.error) {
                setFeedback({ type: 'err', text: res.error });
              }
            }}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2.5 rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white font-bold text-xs px-4 cursor-pointer active:scale-95 disabled:opacity-60"
          >
            {googleSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{googleSigningIn ? 'Conectando con Google...' : 'Iniciar sesión con Google'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="no-print fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setEditSocialProfileOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={needsProfileSetup ? 'Crear mi perfil en FABRO' : 'Editar Mi Perfil Social FABRO'}
        className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border fabro-border fabro-surface shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b fabro-border px-5 py-3.5 shrink-0">
          <div>
            <h2 className="font-display text-base font-bold">
              {needsProfileSetup ? 'Creá tu perfil en FABRO' : 'Editar Mi Perfil en FABRO'}
            </h2>
            <p className="text-xs fabro-muted">
              Cuenta de Google conectada{authUser.email ? `: ${authUser.email}` : ''} · Sincronización gratuita en FABRO
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditSocialProfileOpen(false)}
            aria-label="Cerrar editor de perfil"
            className="min-h-[42px] min-w-[42px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Cover & Avatar Media Uploader */}
          <div className="space-y-3">
            <div className="relative h-36 sm:h-44 w-full overflow-hidden rounded-2xl border fabro-border bg-gradient-to-r from-[#1E3A8A] via-[#7C3AED] to-[#06B6D4]">
              {coverPhotoURL && (
                <img
                  src={coverPhotoURL}
                  alt="Portada de perfil"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-slate-900">
                  {processingMedia === 'cover' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  <span>{coverPhotoURL ? 'Cambiar portada' : 'Subir portada'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFile}
                    className="hidden"
                  />
                </label>
                {coverPhotoURL && (
                  <button
                    type="button"
                    onClick={() => setCoverPhotoURL('')}
                    title="Quitar portada"
                    className="min-h-[38px] min-w-[38px] rounded-xl border border-white/25 bg-slate-950/75 text-white flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 -mt-10 pl-3 relative z-10">
              <div className="relative">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 rounded-2xl border-4 border-[var(--fabro-surface)] object-cover shadow-lg"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl border-4 border-[var(--fabro-surface)] bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center shadow-lg">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <label
                  title="Subir foto de perfil"
                  className="absolute -bottom-1.5 -right-1.5 h-8 w-8 rounded-xl border border-white/40 bg-[#7C3AED] text-white flex items-center justify-center shadow-md cursor-pointer hover:brightness-110"
                >
                  {processingMedia === 'avatar' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="pt-8 flex flex-wrap items-center gap-2">
                <label className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 font-semibold cursor-pointer">
                  <Camera className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Elegir foto de perfil
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />
                </label>
                {photoURL && (
                  <button
                    type="button"
                    onClick={() => setPhotoURL('')}
                    className="min-h-[36px] rounded-xl border fabro-border px-2.5 py-1.5 fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    Quitar foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name & Unique @username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="space-y-1.5 block">
              <span className="font-semibold">Nombre visible</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                placeholder="Tu nombre o alias"
                className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
              />
            </label>

            <label className="space-y-1.5 block">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">@usuario único (FABRO ID)</span>
                {handleState === 'checking' && (
                  <span className="text-[11px] fabro-muted">Verificando...</span>
                )}
                {handleState === 'available' && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Disponible
                  </span>
                )}
                {handleState === 'taken' && (
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    Ocupado
                  </span>
                )}
                {handleState === 'invalid' && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Mín. 3 letras
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono fabro-muted">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => void handleCheckUsername(e.target.value)}
                  maxLength={30}
                  placeholder="tu.usuario"
                  className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated pl-7 pr-3 py-2 font-mono text-xs fabro-input"
                />
              </div>
            </label>
          </div>

          {/* Bio */}
          <label className="space-y-1.5 block">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Biografía personal</span>
              <span className="text-[11px] font-mono tabular-nums fabro-muted">
                {bio.length}/480
              </span>
            </div>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={480}
              placeholder="Contá qué estudiás, tus metas de bienestar o qué te gusta compartir en FABRO..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3 text-xs fabro-input"
            />
          </label>

          {/* Current Activity / Emotional State */}
          <div className="space-y-2">
            <label className="space-y-1.5 block">
              <span className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                Estado emocional o actividad actual
              </span>
              <input
                type="text"
                value={currentActivity}
                onChange={(e) => setCurrentActivity(e.target.value)}
                maxLength={120}
                placeholder="Ej: Estudiando Derecho Constitucional · Modo enfoque"
                className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCurrentActivity(preset)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] cursor-pointer transition-colors ${
                    currentActivity === preset
                      ? 'border-[#7C3AED] bg-[#7C3AED]/15 font-semibold text-[#6D28D9] dark:text-[#C4B5FD]'
                      : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Interests / Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Intereses y etiquetas ({interests.length}/12)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_PRESETS.map((tag) => {
                const active = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-all ${
                      active
                        ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#1D4ED8] dark:text-[#93C5FD] font-semibold'
                        : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomInterest();
                  }
                }}
                placeholder="Agregar otra etiqueta personalizada..."
                className="min-h-[40px] flex-1 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs fabro-input"
              />
              <button
                type="button"
                onClick={handleAddCustomInterest}
                className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {interests.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    title="Quitar etiqueta"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-2 py-0.5 text-[11px] font-semibold text-[#6D28D9] dark:text-[#C4B5FD] cursor-pointer"
                  >
                    #{tag}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Daily Phrase */}
          <label className="space-y-1.5 block">
            <span className="font-semibold">Frase visible en tu tarjeta FABRO</span>
            <input
              type="text"
              value={dailyPhrase}
              onChange={(e) => setDailyPhrase(e.target.value)}
              maxLength={260}
              placeholder="Una frase personal que te acompañe hoy..."
              className="min-h-[42px] w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
            />
          </label>

          {/* Privacy & Tastes Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-2xl border fabro-border fabro-surface-elevated p-3.5">
            <div className="space-y-1.5">
              <span className="font-semibold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
                Privacidad del perfil
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'todos', label: 'Público' },
                    { id: 'grupo', label: 'Contactos' },
                    { id: 'invisible', label: 'Privado' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPrivacyMode(opt.id)}
                    className={`min-h-[36px] rounded-xl border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                      privacyMode === opt.id
                        ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                        : 'fabro-border fabro-surface fabro-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Mostrar mis gustos (Sector 2)</p>
                <p className="text-[11px] fabro-muted">
                  Libros, música, películas y comidas en «Sobre mí».
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={shareTastesPublicly}
                onClick={() => setShareTastesPublicly((v) => !v)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors cursor-pointer ${
                  shareTastesPublicly
                    ? 'border-[#10B981] bg-[#10B981]'
                    : 'fabro-border bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    shareTastesPublicly ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                feedback.type === 'ok'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t fabro-border">
            <button
              type="button"
              onClick={() => setEditSocialProfileOpen(false)}
              className="min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || processingMedia !== null}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#7C3AED] bg-[#7C3AED] px-5 py-2 text-xs font-bold text-white cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {needsProfileSetup ? 'Crear mi perfil en FABRO' : 'Guardar Perfil FABRO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
