import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Camera,
  Check,
  Copy,
  Film,
  ImagePlus,
  MapPin,
  Music,
  Quote,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { computeFabroId } from '../../lib/fabroId';
import { FreemiumStatusCard } from '../common/FreemiumStatusCard';

export const ProfileDirectoryView: React.FC = () => {
  const { user, profile, updateStudentProfile, uploadProfilePhoto, removeGalleryPhoto } = useFabro();
  const {
    publicProfiles,
    myPublicProfile,
    mySanctions,
    toggleFollowInstructor,
    submitSanctionAppeal,
  } = usePlatform();

  const [tab, setTab] = useState<'mi-perfil' | 'comunidad'>('mi-perfil');

  // Unified Profile State
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [customFabroId, setCustomFabroId] = useState(profile?.customFabroId || '');
  const [sharedPhrase, setSharedPhrase] = useState(profile?.sharedPhrase || '');
  const [favoriteBooks, setFavoriteBooks] = useState(profile?.favoriteBooks || '');
  const [favoriteMovies, setFavoriteMovies] = useState(profile?.favoriteMovies || '');
  const [favoriteMusic, setFavoriteMusic] = useState(profile?.favoriteMusic || '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate || '');
  const [isMinor, setIsMinor] = useState(Boolean(profile?.isMinor));
  const [parentalConsent, setParentalConsent] = useState(Boolean(profile?.parentalConsentApproved));
  const [searchableInDirectory, setSearchableInDirectory] = useState<boolean>(
    () => (profile?.isMinor ? false : myPublicProfile?.searchableInDirectory ?? true)
  );
  const [country, setCountry] = useState(profile?.country || 'Argentina');
  const [province, setProvince] = useState(profile?.province || '');
  const [city, setCity] = useState(profile?.city || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [interestsRaw, setInterestsRaw] = useState((profile?.interests || []).join(', '));
  const [career, setCareer] = useState(profile?.career || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Community Directory Search & Photo Preview Modal
  const [dirSearch, setDirSearch] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Sanctions Appeal
  const [appealDrafts, setAppealDrafts] = useState<Record<string, string>>({});

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setUsername(profile.username || '');
    setCustomFabroId(profile.customFabroId || '');
    setSharedPhrase(profile.sharedPhrase || '');
    setFavoriteBooks(profile.favoriteBooks || '');
    setFavoriteMovies(profile.favoriteMovies || '');
    setFavoriteMusic(profile.favoriteMusic || '');
    setBirthDate(profile.birthDate || '');
    setIsMinor(Boolean(profile.isMinor));
    setParentalConsent(Boolean(profile.parentalConsentApproved));
    setCountry(profile.country || 'Argentina');
    setProvince(profile.province || '');
    setCity(profile.city || '');
    setBio(profile.bio || '');
    setInterestsRaw((profile.interests || []).join(', '));
    setCareer(profile.career || '');
  }, [profile]);

  useEffect(() => {
    if (isMinor) {
      setSearchableInDirectory(false);
    } else if (myPublicProfile) {
      setSearchableInDirectory(Boolean(myPublicProfile.searchableInDirectory));
    }
  }, [isMinor, myPublicProfile]);

  const handleBirthDateChange = async (nextDate: string) => {
    setBirthDate(nextDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    try {
      const resp = await fetch('/api/platform/check-minor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate: nextDate }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { isMinor?: boolean };
        setIsMinor(Boolean(data.isMinor));
      }
    } catch {
      const year = Number(nextDate.slice(0, 4));
      setIsMinor(new Date().getFullYear() - year < 18);
    }
  };

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    setProfileMsg(null);
    try {
      await uploadProfilePhoto(file, 'avatar');
      setProfileMsg({ type: 'ok', text: 'Foto de perfil actualizada en toda la aplicación.' });
    } catch (err) {
      setProfileMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo subir la foto de perfil.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleGallerySelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploadingGallery(true);
    setProfileMsg(null);
    try {
      const currentCount = (profile?.galleryPhotos || []).length;
      const availableSlots = Math.max(1, 6 - currentCount);
      for (const file of files.slice(0, availableSlots)) {
        await uploadProfilePhoto(file, 'gallery');
      }
      setProfileMsg({ type: 'ok', text: 'Fotos agregadas a tu perfil y visibles en la comunidad.' });
    } catch (err) {
      setProfileMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudieron subir las fotos.',
      });
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const interests = interestsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await updateStudentProfile({
        displayName,
        username,
        customFabroId: customFabroId.trim(),
        sharedPhrase,
        favoriteBooks,
        favoriteMovies,
        favoriteMusic,
        birthDate,
        isMinor,
        parentalConsentApproved: parentalConsent,
        country,
        province,
        city,
        bio,
        interests,
        career,
        weeklyGoalHours: profile?.weeklyGoalHours || 15,
        themePreference: profile?.themePreference || 'dark',
        isStudent: false,
        isInstructor: false,
        searchableInDirectory: !isMinor && searchableInDirectory,
      });
      setProfileMsg({ type: 'ok', text: 'Perfil global guardado y sincronizado en toda la plataforma.' });
    } catch (err) {
      setProfileMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar el perfil.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const communityProfiles = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    return publicProfiles.filter((p) => {
      if (!q) return true;
      const peerId = computeFabroId(p.uid, p.customFabroId);
      const hay = `${p.displayName} ${p.username} ${peerId} ${p.sharedPhrase || ''} ${p.favoriteBooks || ''} ${p.favoriteMovies || ''} ${p.favoriteMusic || ''} ${p.bio} ${p.city} ${p.country} ${p.interests.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [publicProfiles, dirSearch]);

  const followedIds = new Set(profile?.followedInstructorIds || []);
  const galleryPhotos = profile?.galleryPhotos || [];
  const shownName = profile?.displayName || user?.displayName || 'Mi Perfil FABRO';
  const fabroId = useMemo(
    () => computeFabroId(user?.uid, profile?.customFabroId),
    [user?.uid, profile?.customFabroId]
  );
  const autoFabroId = useMemo(() => computeFabroId(user?.uid), [user?.uid]);
  const copyFabroId = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(fabroId).then(() => {
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1800);
    });
  };
  const initials = shownName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <section className="rounded-2xl border fabro-shell-surface p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/15 shrink-0 cursor-pointer group"
            title="Cambiar foto de perfil"
          >
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={shownName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-violet-600 text-white text-lg font-bold flex items-center justify-center">
                {initials}
              </div>
            )}
            <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Camera className="w-5 h-5" />
            </span>
          </button>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider fabro-gold-accent">
                PERFIL GLOBAL FABRO · {fabroId}
              </p>
              <button
                type="button"
                onClick={copyFabroId}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-amber-500 cursor-pointer"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedId ? 'Copiado' : 'Copiar ID'}
              </button>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-[#FAF6EE] truncate">
              {shownName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {[
                profile?.username ? `@${profile.username.replace(/^@/, '')}` : null,
                profile?.city || profile?.country ? [profile?.city, profile?.country].filter(Boolean).join(', ') : null,
                `${galleryPhotos.length}/6 fotos`,
                profile?.isMinor ? 'Cuenta protegida (-18 años)' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {profile?.sharedPhrase && (
              <p className="text-xs italic text-slate-700 dark:text-slate-200 pt-0.5 truncate">
                «{profile.sharedPhrase}»
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'mi-perfil', label: 'Mi Perfil, Fotos y Frase' },
            { id: 'comunidad', label: `Perfiles de la Comunidad (${communityProfiles.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'fabro-accent-pill'
                  : 'border border-slate-200 dark:border-white/10 fabro-shell-surface-2 text-slate-700 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleAvatarSelected(e)}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void handleGallerySelected(e)}
        className="hidden"
      />

      {/* Active Sanctions & Appeal Banner if any */}
      {mySanctions.length > 0 && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3 text-xs">
          <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Historial de moderación y apelaciones
          </p>
          {mySanctions.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-amber-500/30 fabro-shell-surface p-3 space-y-2"
            >
              <p className="font-semibold text-slate-900 dark:text-white">
                {s.sanctionType} · Estado: {s.status}
              </p>
              <p className="text-slate-600 dark:text-slate-300">{s.reason}</p>
              {s.status === 'activa' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={appealDrafts[s.id] || ''}
                    onChange={(e) =>
                      setAppealDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="Presentar descargo o solicitud de revisión..."
                    className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/25 px-2.5 py-1.5 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const txt = appealDrafts[s.id] || '';
                      if (!txt.trim()) return;
                      void submitSanctionAppeal(s.id, txt);
                    }}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
                  >
                    Apelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === 'mi-perfil' && (
        <div className="space-y-5">
          {/* Photos & Gallery Management */}
          <section className="rounded-2xl border fabro-shell-surface p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Tus fotos en FABRO
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Subí tu foto principal y hasta 6 fotos en tu galería personal para compartir con la comunidad.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/15 fabro-shell-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-violet-500/50 cursor-pointer whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {uploadingAvatar ? 'Subiendo foto...' : 'Cambiar foto principal'}
                </button>
                <button
                  type="button"
                  disabled={uploadingGallery || galleryPhotos.length >= 6}
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  {uploadingGallery ? 'Subiendo fotos...' : `Subir fotos (${galleryPhotos.length}/6)`}
                </button>
              </div>
            </div>

            {galleryPhotos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Todavía no subiste fotos adicionales. Tocá «Subir fotos» para mostrar lo que quieras en tu perfil.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {galleryPhotos.map((url, idx) => (
                  <div
                    key={`${url.slice(0, 32)}_${idx}`}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-white/10"
                  >
                    <img
                      src={url}
                      alt={`Foto ${idx + 1} de ${shownName}`}
                      onClick={() => setLightboxUrl(url)}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => void removeGalleryPhoto(url)}
                      aria-label={`Eliminar foto ${idx + 1}`}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Profile Editor Form */}
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="rounded-2xl border fabro-shell-surface p-5 sm:p-6 space-y-5 text-xs"
          >
            {profileMsg && (
              <div
                className={`rounded-xl border px-4 py-2.5 ${
                  profileMsg.type === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                }`}
              >
                {profileMsg.text}
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-[#FAF6EE]">
                <Quote className="w-3.5 h-3.5 text-amber-500" />
                Frase del día (visible en tu perfil global)
              </span>
              <input
                type="text"
                maxLength={400}
                value={sharedPhrase}
                onChange={(e) => setSharedPhrase(e.target.value)}
                placeholder="Escribí tu frase del día, un pensamiento o lo que quieras compartir hoy..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3.5 py-2.5 text-sm text-slate-900 dark:text-[#FAF6EE]"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Nombre visible *</span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Nombre de usuario</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="usuario"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Identificador único (FABRO ID)
                </span>
                <input
                  type="text"
                  maxLength={32}
                  value={customFabroId}
                  onChange={(e) => setCustomFabroId(e.target.value.toUpperCase())}
                  placeholder={autoFabroId}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 font-mono uppercase text-slate-900 dark:text-[#FAF6EE]"
                />
                <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                  Vacío usa automático: {autoFabroId}
                </span>
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Fecha de nacimiento (protección menores)
                </span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => void handleBirthDateChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">País</span>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Provincia / Estado</span>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Ciudad</span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Actividad, ocupación o proyecto
                </span>
                <input
                  type="text"
                  value={career}
                  onChange={(e) => setCareer(e.target.value)}
                  placeholder="Lo que hacés o te gusta explorar"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Temas e intereses que compartís (separados por coma)
                </span>
                <input
                  type="text"
                  value={interestsRaw}
                  onChange={(e) => setInterestsRaw(e.target.value)}
                  placeholder="Música, Lectura, Bienestar, Fotografía, Tecnología..."
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
            </div>

            {/* Espacio Personal · Gustos (Libros, Películas, Música) */}
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 fabro-shell-surface-2 p-4 space-y-3">
              <p className="font-semibold text-slate-800 dark:text-[#FAF6EE]">
                Espacio personal · Reflejá tus gustos
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                    <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                    Libros favoritos
                  </span>
                  <input
                    type="text"
                    maxLength={300}
                    value={favoriteBooks}
                    onChange={(e) => setFavoriteBooks(e.target.value)}
                    placeholder="Ej: El Aleph, Cien años de soledad..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                    <Film className="w-3.5 h-3.5 text-violet-500" />
                    Películas / Series favoritas
                  </span>
                  <input
                    type="text"
                    maxLength={300}
                    value={favoriteMovies}
                    onChange={(e) => setFavoriteMovies(e.target.value)}
                    placeholder="Ej: Interstellar, Cinema Paradiso..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                    <Music className="w-3.5 h-3.5 text-amber-500" />
                    Música / Artistas favoritos
                  </span>
                  <input
                    type="text"
                    maxLength={300}
                    value={favoriteMusic}
                    onChange={(e) => setFavoriteMusic(e.target.value)}
                    placeholder="Ej: Charly García, Jazz, Rock nacional..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                  />
                </label>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Sobre vos / lo que quieras contar libremente
              </span>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Compartí tu historia, ideas, gustos o lo que quieras que otros vean en tu perfil..."
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
              />
            </label>

            {!isMinor && (
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={searchableInDirectory}
                  onChange={(e) => setSearchableInDirectory(e.target.checked)}
                />
                <span>Visible en perfiles de la comunidad y disponible para conectar</span>
              </label>
            )}

            {isMinor && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                <p className="font-bold text-amber-800 dark:text-amber-200">
                  Salvaguardas automáticas de menor de edad (-18 años) activadas
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                  Tu perfil permanece oculto en directorios públicos abiertos y los chats privados 1:1 permanecen bloqueados.
                </p>
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={parentalConsent}
                    onChange={(e) => setParentalConsent(e.target.checked)}
                  />
                  <span>Cuento con autorización de madre/padre/tutor</span>
                </label>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-700 cursor-pointer"
              >
                {savingProfile ? 'Guardando...' : 'Guardar perfil completo'}
              </button>
            </div>
          </form>

          <FreemiumStatusCard />
        </div>
      )}

      {tab === 'comunidad' && (
        <div className="space-y-4">
          <div className="rounded-2xl border fabro-shell-surface p-4 flex flex-wrap items-center gap-3 text-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Buscar personas por nombre, frase, ciudad o intereses..."
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 pl-8 pr-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
              />
            </div>
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <Users className="w-3.5 h-3.5" />
              {communityProfiles.length} perfiles
            </span>
          </div>

          {communityProfiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No se encontraron perfiles que coincidan con tu búsqueda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {communityProfiles.map((member) => {
                const isFollowing = followedIds.has(member.uid);
                const memberInitials = member.displayName
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <article
                    key={member.uid}
                    className="rounded-2xl border fabro-shell-surface p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {member.photoURL ? (
                          <img
                            src={member.photoURL}
                            alt={member.displayName}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-white/15 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {memberInitials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold text-slate-900 dark:text-[#FAF6EE] truncate">
                            {member.displayName}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            {computeFabroId(member.uid, member.customFabroId)}
                            {member.username ? ` · @${member.username.replace(/^@/, '')}` : ''}
                            {(member.city || member.country) && (
                              <>
                                <span>·</span>
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {[member.city, member.country].filter(Boolean).join(', ')}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {member.sharedPhrase && (
                        <p className="text-xs italic text-amber-800 dark:text-[#F5D77F] leading-relaxed">
                          «{member.sharedPhrase}»
                        </p>
                      )}

                      {member.bio && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                          {member.bio}
                        </p>
                      )}

                      {(member.favoriteBooks || member.favoriteMovies || member.favoriteMusic) && (
                        <div className="space-y-1 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                          {member.favoriteBooks && (
                            <p className="flex items-center gap-1.5 truncate">
                              <BookOpen className="w-3 h-3 text-sky-500 shrink-0" />
                              <span className="truncate">{member.favoriteBooks}</span>
                            </p>
                          )}
                          {member.favoriteMovies && (
                            <p className="flex items-center gap-1.5 truncate">
                              <Film className="w-3 h-3 text-violet-500 shrink-0" />
                              <span className="truncate">{member.favoriteMovies}</span>
                            </p>
                          )}
                          {member.favoriteMusic && (
                            <p className="flex items-center gap-1.5 truncate">
                              <Music className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{member.favoriteMusic}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {member.galleryPhotos && member.galleryPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          {member.galleryPhotos.slice(0, 6).map((url, idx) => (
                            <img
                              key={`${member.uid}_g_${idx}`}
                              src={url}
                              alt={`Foto de ${member.displayName}`}
                              onClick={() => setLightboxUrl(url)}
                              className="w-full h-16 rounded-lg object-cover border border-slate-200 dark:border-white/10 cursor-pointer"
                            />
                          ))}
                        </div>
                      )}

                      {member.interests.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {member.interests.slice(0, 5).join(' · ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-white/10">
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {member.followersCount} seguidores
                      </span>
                      {member.uid !== user?.uid && (
                        <button
                          type="button"
                          onClick={() => void toggleFollowInstructor(member.uid)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                            isFollowing
                              ? 'border border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                              : 'bg-violet-600 text-white hover:bg-violet-700'
                          }`}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {isFollowing ? 'Siguiendo' : 'Seguir'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-label="Vista ampliada de foto"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="relative max-w-2xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              aria-label="Cerrar foto"
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center border border-white/20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={lightboxUrl}
              alt="Foto compartida"
              className="max-h-[82vh] rounded-2xl object-contain border border-white/15"
            />
          </div>
        </div>
      )}
    </div>
  );
};
