import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Award,
  Bell,
  BellOff,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Heart,
  Plus,
  Save,
  Search,
  User,
  Users,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { CULTURE_DISCIPLINES, getDisciplineMeta } from '../../../data/cultureCatalog';
import { parseVideoEmbedUrl } from '../../../services/videoEmbedUtils';
import type {
  CulturalProfileData,
  CultureCommunityItem,
  CultureCourseItem,
  CultureDisciplineId,
  CultureLibraryEntry,
  DigitalLibraryCategory,
} from '../../../types/culture';

interface CultureCommunityAcademyLibraryProps {
  section: 'perfil-cultural' | 'comunidades-culturales' | 'academia-cultural' | 'biblioteca-digital';
  communities: CultureCommunityItem[];
  courses: CultureCourseItem[];
  library: CultureLibraryEntry[];
  onSaveCommunities: (next: CultureCommunityItem[]) => void;
  onSaveCourses: (next: CultureCourseItem[]) => void;
  onSaveLibrary: (next: CultureLibraryEntry[]) => void;
}

const LIBRARY_CATEGORIES: DigitalLibraryCategory[] = [
  'Libros',
  'Documentos',
  'Fotografías',
  'Partituras',
  'Archivos históricos',
  'Recursos educativos',
  'Dominio público',
];

export const CultureCommunityAcademyLibrary: React.FC<CultureCommunityAcademyLibraryProps> = ({
  section,
  communities,
  courses,
  library,
  onSaveCommunities,
  onSaveCourses,
  onSaveLibrary,
}) => {
  const {
    profile,
    authUser,
    saveFullSocialProfile,
    notificationPrefs,
    updateNotificationPrefs,
    notificationPermission,
    requestNotificationPermission,
    notifyCommunityUpdate,
  } = useEcosystem();
  const cp = profile.culturalProfile || {};

  // 1. Cultural Profile optional fields (extends existing profile without requiring completion)
  const [artisticName, setArtisticName] = useState(cp.artisticName || '');
  const [culturalBio, setCulturalBio] = useState(cp.culturalBio || '');
  const [portfolioUrl, setPortfolioUrl] = useState(cp.portfolioUrl || '');
  const [specialtiesText, setSpecialtiesText] = useState((cp.specialties || []).join(', '));
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    cp.culturalDisciplines || []
  );
  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkDisc, setNewWorkDisc] = useState('Artes visuales');
  const [newWorkYear, setNewWorkYear] = useState(String(new Date().getFullYear()));
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // 2. Communities state
  const [selectedCommId, setSelectedCommId] = useState<string>(communities[0]?.id || '');
  const [newCommName, setNewCommName] = useState('');
  const [newCommRole, setNewCommRole] = useState('Escritores');
  const [newCommDisc, setNewCommDisc] = useState<CultureDisciplineId>('literatura');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [commPostDraft, setCommPostDraft] = useState('');

  // 3. Academy state
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDisc, setCourseDisc] = useState<CultureDisciplineId>('artes-visuales');
  const [courseLevel, setCourseLevel] = useState<CultureCourseItem['level']>('Inicial');
  const [courseDesc, setCourseDesc] = useState('');
  const [modTitle, setModTitle] = useState('');
  const [modVideo, setModVideo] = useState('');
  const [modMaterial, setModMaterial] = useState('');
  const [modActivity, setModActivity] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [academyMsg, setAcademyMsg] = useState<string | null>(null);

  // 4. Digital Library state
  const [libSearch, setLibSearch] = useState('');
  const [libCatFilter, setLibCatFilter] = useState<'Todas' | DigitalLibraryCategory>('Todas');
  const [libOnlyFavs, setLibOnlyFavs] = useState(false);
  const [newLibTitle, setNewLibTitle] = useState('');
  const [newLibAuthor, setNewLibAuthor] = useState('');
  const [newLibYear, setNewLibYear] = useState('');
  const [newLibCat, setNewLibCat] = useState<DigitalLibraryCategory>('Dominio público');
  const [newLibUrl, setNewLibUrl] = useState('');
  const [newLibCollection, setNewLibCollection] = useState('Mi Colección');

  const currentAuthor =
    cp.artisticName?.trim() || authUser?.displayName || profile.displayName || 'Invitado FABRO';

  const handleSaveCulturalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextCultural: CulturalProfileData = {
      ...cp,
      artisticName: artisticName.trim(),
      culturalBio: culturalBio.trim(),
      portfolioUrl: portfolioUrl.trim(),
      culturalDisciplines: selectedDisciplines,
      specialties: specialtiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    await saveFullSocialProfile({ culturalProfile: nextCultural });
    setProfileNotice('Perfil cultural actualizado sobre tu perfil FABRO existente.');
  };

  const handleIssueCertificatePdf = (course: CultureCourseItem) => {
    const code = course.certificateCode || `FABRO-CULT-${course.id.slice(-4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const dateStr = new Date().toLocaleDateString('es-AR');
    onSaveCourses(
      courses.map((c) =>
        c.id === course.id ? { ...c, certificateIssuedAt: dateStr, certificateCode: code } : c
      )
    );

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdf.setFillColor(251, 249, 245);
    pdf.rect(0, 0, 842, 595, 'F');
    pdf.setDrawColor(154, 52, 18);
    pdf.setLineWidth(3);
    pdf.rect(34, 34, 774, 527);
    pdf.setDrawColor(214, 206, 190);
    pdf.setLineWidth(1);
    pdf.rect(46, 46, 750, 503);

    pdf.setTextColor(154, 52, 18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('ACADEMIA CULTURAL FABRO · CONSTANCIA INTERNA DE PARTICIPACIÓN', 421, 120, {
      align: 'center',
    });

    pdf.setTextColor(28, 25, 23);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(34);
    pdf.text(currentAuthor, 421, 230, { align: 'center' });

    pdf.setFont('times', 'normal');
    pdf.setFontSize(16);
    pdf.text('ha completado satisfactoriamente el taller gratuito', 421, 278, { align: 'center' });

    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    pdf.text(`«${course.title}»`, 421, 326, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(
      `Docente / Guía: ${course.instructor} · Nivel ${course.level} · Fecha: ${dateStr}`,
      421,
      392,
      { align: 'center' }
    );
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Código interno de constancia: ${code} · Emitida localmente sin costo`, 421, 470, {
      align: 'center',
    });
    pdf.save(`constancia_${course.title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    setAcademyMsg(`Constancia interna ${code} generada y descargada en PDF.`);
  };

  const filteredLibrary = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return library.filter((item) => {
      if (libCatFilter !== 'Todas' && item.category !== libCatFilter) return false;
      if (libOnlyFavs && !item.favorite) return false;
      if (q) {
        return `${item.title} ${item.author} ${item.summary} ${item.collectionName} ${item.license}`
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
  }, [libCatFilter, libOnlyFavs, libSearch, library]);

  // SECTION 1: CULTURAL PROFILE
  if (section === 'perfil-cultural') {
    const works = cp.works || [];
    const projects = cp.projects || [];
    return (
      <div className="space-y-6">
        <form
          onSubmit={handleSaveCulturalProfile}
          className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b fabro-border">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-[#9A3412]" />
                Perfil Cultural (Opcional sobre tu cuenta FABRO)
              </h2>
              <p className="text-xs fabro-muted">
                Estos campos amplían tu perfil existente con identidad artística y portafolio. No son obligatorios para usar la red social.
              </p>
            </div>
            <button
              type="submit"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#9A3412] text-white px-4 text-xs font-bold cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar perfil cultural</span>
            </button>
          </div>

          {profileNotice && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {profileNotice}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-semibold fabro-muted">Nombre artístico (opcional)</span>
              <input
                type="text"
                value={artisticName}
                onChange={(e) => setArtisticName(e.target.value)}
                placeholder="Ej: Taller del Sur / Tu seudónimo"
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold fabro-muted">Portafolio / Enlace externo</span>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://..."
                className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold fabro-muted">Biografía cultural</span>
            <textarea
              value={culturalBio}
              onChange={(e) => setCulturalBio(e.target.value)}
              rows={3}
              placeholder="Contá tu recorrido creativo, búsquedas artísticas, investigaciones o proyectos culturales..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold fabro-muted">Especialidades (separadas por coma)</span>
            <input
              type="text"
              value={specialtiesText}
              onChange={(e) => setSpecialtiesText(e.target.value)}
              placeholder="Ej: Acuarela, Guitarra criolla, Guion documental, Cerámica"
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
          </label>

          <div className="space-y-2 text-xs">
            <span className="font-semibold fabro-muted">Disciplinas de interés</span>
            <div className="flex flex-wrap gap-1.5">
              {CULTURE_DISCIPLINES.map((d) => {
                const active = selectedDisciplines.includes(d.label);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setSelectedDisciplines((prev) =>
                        active ? prev.filter((x) => x !== d.label) : [...prev, d.label]
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                      active
                        ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74] font-semibold'
                        : 'fabro-border fabro-surface-elevated fabro-muted'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Works & Projects Portfolio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold">Obras destacadas ({works.length})</h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newWorkTitle}
                onChange={(e) => setNewWorkTitle(e.target.value)}
                placeholder="Título de la obra"
                className="flex-1 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="text"
                value={newWorkYear}
                onChange={(e) => setNewWorkYear(e.target.value)}
                className="w-20 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!newWorkTitle.trim()) return;
                  const nextWorks = [
                    {
                      id: `wrk-${Date.now()}`,
                      title: newWorkTitle.trim(),
                      discipline: newWorkDisc,
                      year: newWorkYear,
                      medium: newWorkDisc,
                      description: '',
                    },
                    ...works,
                  ];
                  await saveFullSocialProfile({
                    culturalProfile: { ...cp, works: nextWorks },
                  });
                  setNewWorkTitle('');
                }}
                className="min-h-[38px] rounded-xl bg-[#1E3A8A] text-white px-3 font-bold cursor-pointer"
              >
                Agregar
              </button>
            </div>
            <select
              value={newWorkDisc}
              onChange={(e) => setNewWorkDisc(e.target.value)}
              className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            >
              {CULTURE_DISCIPLINES.map((d) => (
                <option key={d.id} value={d.label}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="space-y-1.5">
              {works.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 flex justify-between"
                >
                  <span className="font-semibold">{w.title}</span>
                  <span className="fabro-muted">
                    {w.discipline} · {w.year}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold">Proyectos culturales ({projects.length})</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Nombre del proyecto en curso..."
                className="flex-1 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!newProjectTitle.trim()) return;
                  const nextProjects = [
                    {
                      id: `prj-${Date.now()}`,
                      title: newProjectTitle.trim(),
                      discipline: selectedDisciplines[0] || 'Cultura General',
                      status: 'En curso' as const,
                      summary: 'Proyecto cultural personal',
                      updatedAt: 'Hoy',
                    },
                    ...projects,
                  ];
                  await saveFullSocialProfile({
                    culturalProfile: { ...cp, projects: nextProjects },
                  });
                  setNewProjectTitle('');
                }}
                className="min-h-[38px] rounded-xl bg-[#9A3412] text-white px-3 font-bold cursor-pointer"
              >
                Sumar
              </button>
            </div>
            <div className="space-y-1.5">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 flex justify-between"
                >
                  <span className="font-semibold">{p.title}</span>
                  <span className="fabro-muted">{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SECTION 2: CULTURAL COMMUNITIES
  if (section === 'comunidades-culturales') {
    const activeComm = communities.find((c) => c.id === selectedCommId) || communities[0];
    const joinedCommunitiesCount = communities.filter((c) => c.joined).length;
    const communityPushActive = notificationPrefs.enabled && notificationPrefs.communityUpdates;

    const handleToggleCommunityPush = async () => {
      if (!communityPushActive) {
        updateNotificationPrefs({ enabled: true, communityUpdates: true });
        if (notificationPermission === 'default') {
          await requestNotificationPermission();
        }
      } else {
        updateNotificationPrefs({ communityUpdates: false });
      }
    };

    return (
      <div className="space-y-4">
        {/* Community Push Alerts Control Strip */}
        <div className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#9A3412] dark:text-[#FDBA74]" />
              Alertas push de tus comunidades culturales
            </p>
            <p className="fabro-muted">
              Participás en{' '}
              <span className="font-mono tabular-nums font-semibold text-[var(--fabro-text)]">
                {joinedCommunitiesCount}
              </span>{' '}
              comunidad{joinedCommunitiesCount === 1 ? '' : 'es'}. Recibí avisos inmediatos ante nuevas publicaciones e intercambios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleToggleCommunityPush()}
            className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
              communityPushActive
                ? 'border-[#9A3412]/40 bg-[#9A3412]/10 text-[#9A3412] dark:text-[#FDBA74]'
                : 'fabro-border fabro-surface-elevated fabro-muted'
            }`}
          >
            {communityPushActive ? (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span>Alertas push activas</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5" />
                <span>Activar alertas push</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCommName.trim()) return;
              const created: CultureCommunityItem = {
                id: `cc-${Date.now()}`,
                name: newCommName.trim(),
                roleGroup: newCommRole,
                disciplineId: newCommDisc,
                description:
                  newCommDesc.trim() || 'Espacio colaborativo cultural abierto en FABRO.',
                membersCount: 1,
                joined: true,
                posts: [],
              };
              onSaveCommunities([created, ...communities]);
              setSelectedCommId(created.id);
              setNewCommName('');
              setNewCommDesc('');
            }}
            className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5 text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9A3412]" />
              Crear comunidad cultural
            </h3>
            <input
              type="text"
              value={newCommName}
              onChange={(e) => setNewCommName(e.target.value)}
              placeholder="Nombre de la comunidad"
              className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCommRole}
                onChange={(e) => setNewCommRole(e.target.value)}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                {[
                  'Escritores',
                  'Músicos',
                  'Fotógrafos',
                  'Pintores',
                  'Cineastas',
                  'Actores',
                  'Artesanos',
                  'Historiadores',
                  'Lectores',
                  'Investigadores',
                ].map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                value={newCommDisc}
                onChange={(e) => setNewCommDisc(e.target.value as CultureDisciplineId)}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                {CULTURE_DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.shortLabel}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={newCommDesc}
              onChange={(e) => setNewCommDesc(e.target.value)}
              placeholder="Propósito o actividad principal..."
              className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="submit"
              className="w-full min-h-[38px] rounded-xl bg-[#9A3412] text-white font-bold cursor-pointer"
            >
              Crear comunidad gratuita
            </button>
          </form>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {communities.map((comm) => (
              <button
                key={comm.id}
                type="button"
                onClick={() => setSelectedCommId(comm.id)}
                className={`w-full text-left rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                  activeComm?.id === comm.id
                    ? 'border-[#9A3412] bg-[#9A3412]/10'
                    : 'fabro-border fabro-surface'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{comm.name}</span>
                  <span className="font-mono tabular-nums fabro-muted">{comm.membersCount}</span>
                </div>
                <p className="fabro-muted mt-0.5 truncate">
                  {comm.roleGroup} · {comm.joined ? 'Miembro' : 'Abierta'}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          {activeComm && (
            <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b fabro-border">
                <div>
                  <p className="text-xs font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                    {activeComm.roleGroup} · {getDisciplineMeta(activeComm.disciplineId)?.label}
                  </p>
                  <h3 className="font-display text-xl font-bold mt-0.5">{activeComm.name}</h3>
                  <p className="text-xs fabro-muted mt-1 leading-relaxed">
                    {activeComm.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const willJoin = !activeComm.joined;
                    onSaveCommunities(
                      communities.map((c) =>
                        c.id === activeComm.id
                          ? {
                              ...c,
                              joined: willJoin,
                              membersCount: willJoin ? c.membersCount + 1 : Math.max(1, c.membersCount - 1),
                            }
                          : c
                      )
                    );
                    if (willJoin) {
                      void notifyCommunityUpdate({
                        communityName: activeComm.name,
                        summary: 'Te uniste a esta comunidad cultural. Te avisaremos ante nuevas publicaciones.',
                        target: { sector: 'cultura', submenu: 'cultura-inicio' },
                        cultureNav: 'comunidades-culturales',
                        broadcast: false,
                        triggerLocalPush: true,
                      });
                    }
                  }}
                  className={`min-h-[40px] rounded-xl px-4 text-xs font-bold cursor-pointer ${
                    activeComm.joined
                      ? 'border fabro-border fabro-surface-elevated'
                      : 'bg-[#1E3A8A] text-white'
                  }`}
                >
                  {activeComm.joined ? 'Salir de la comunidad' : 'Unirme a la comunidad'}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const cleanText = commPostDraft.trim();
                  if (!cleanText) return;
                  onSaveCommunities(
                    communities.map((c) =>
                      c.id === activeComm.id
                        ? {
                            ...c,
                            posts: [
                              {
                                id: `ccp-${Date.now()}`,
                                author: currentAuthor,
                                text: cleanText,
                                createdAt: 'Recién',
                              },
                              ...c.posts,
                            ],
                          }
                        : c
                    )
                  );
                  void notifyCommunityUpdate({
                    communityName: activeComm.name,
                    summary: `${currentAuthor}: ${cleanText}`,
                    target: { sector: 'cultura', submenu: 'cultura-inicio' },
                    cultureNav: 'comunidades-culturales',
                    broadcast: true,
                    triggerLocalPush: false,
                  });
                  setCommPostDraft('');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={commPostDraft}
                  onChange={(e) => setCommPostDraft(e.target.value)}
                  placeholder={`Compartí una idea o consigna en ${activeComm.name}...`}
                  className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
                />
                <button
                  type="submit"
                  className="min-h-[40px] rounded-xl bg-[#9A3412] text-white px-4 text-xs font-bold cursor-pointer"
                >
                  Publicar
                </button>
              </form>

              <div className="space-y-2.5">
                {activeComm.posts.length === 0 ? (
                  <p className="text-xs fabro-muted py-4">
                    Iniciá el primer intercambio en esta comunidad cultural.
                  </p>
                ) : (
                  activeComm.posts.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 text-xs space-y-1"
                    >
                      <div className="flex justify-between">
                        <span className="font-bold">{p.author}</span>
                        <span className="fabro-muted">{p.createdAt}</span>
                      </div>
                      <p className="leading-relaxed">{p.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    );
  }

  // SECTION 3: CULTURAL ACADEMY
  if (section === 'academia-cultural') {
    const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];
    const progressPct = activeCourse
      ? Math.round(
          (activeCourse.completedModuleIds.length / Math.max(1, activeCourse.modules.length)) * 100
        )
      : 0;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border fabro-border fabro-surface p-4">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#1E3A8A]" />
              Academia Cultural Gratuita
            </h2>
            <p className="text-xs fabro-muted">
              Cursos y talleres abiertos con módulos, videos mediante enlaces externos, progreso, cuestionarios y constancia interna descargable en PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateCourse((v) => !v)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] text-white px-4 text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreateCourse ? 'Cerrar formulario' : 'Publicar curso / taller'}</span>
          </button>
        </div>

        {academyMsg && (
          <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            {academyMsg}
          </div>
        )}

        {showCreateCourse && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!courseTitle.trim()) return;
              const created: CultureCourseItem = {
                id: `course-${Date.now()}`,
                title: courseTitle.trim(),
                disciplineId: courseDisc,
                instructor: currentAuthor,
                level: courseLevel,
                description: courseDesc.trim() || 'Taller comunitario abierto en FABRO Cultura.',
                enrolled: true,
                enrolledStudents: [currentAuthor],
                completedModuleIds: [],
                modules: [
                  {
                    id: `m-${Date.now()}`,
                    title: modTitle.trim() || 'Módulo 1 · Introducción práctica',
                    durationLabel: '20 min',
                    summary: modMaterial.trim() || 'Presentación de objetivos y materiales libres.',
                    videoUrl: modVideo.trim() || undefined,
                    materialText: modMaterial.trim() || undefined,
                    activityPrompt: modActivity.trim() || undefined,
                  },
                ],
                quiz: [
                  {
                    id: `q-${Date.now()}`,
                    question: `¿Completaste la actividad práctica inicial de "${courseTitle.trim()}"?`,
                    options: ['Sí, actividad realizada', 'Aún en proceso'],
                    correctIndex: 0,
                  },
                ],
              };
              onSaveCourses([created, ...courses]);
              setSelectedCourseId(created.id);
              setCourseTitle('');
              setCourseDesc('');
              setModTitle('');
              setModVideo('');
              setModMaterial('');
              setModActivity('');
              setShowCreateCourse(false);
              setAcademyMsg('Curso publicado gratuitamente en la Academia Cultural.');
            }}
            className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">Publicar nuevo curso o taller gratuito</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="Título del curso o taller"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <select
                value={courseDisc}
                onChange={(e) => setCourseDisc(e.target.value as CultureDisciplineId)}
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                {CULTURE_DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <select
                value={courseLevel}
                onChange={(e) => setCourseLevel(e.target.value as CultureCourseItem['level'])}
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                <option value="Inicial">Inicial</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </div>
            <textarea
              value={courseDesc}
              onChange={(e) => setCourseDesc(e.target.value)}
              rows={2}
              placeholder="Descripción general del curso..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={modTitle}
                onChange={(e) => setModTitle(e.target.value)}
                placeholder="Título del primer módulo"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="url"
                value={modVideo}
                onChange={(e) => setModVideo(e.target.value)}
                placeholder="Enlace externo opcional de video (YouTube/Vimeo)"
                className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </div>
            <textarea
              value={modMaterial}
              onChange={(e) => setModMaterial(e.target.value)}
              rows={2}
              placeholder="Material de lectura o apuntes del módulo..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            />
            <input
              type="text"
              value={modActivity}
              onChange={(e) => setModActivity(e.target.value)}
              placeholder="Actividad práctica propuesta para alumnos..."
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="submit"
              className="min-h-[40px] rounded-xl bg-[#9A3412] text-white px-5 font-bold cursor-pointer"
            >
              Publicar curso
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-2.5">
            {courses.map((c) => {
              const pct = Math.round(
                (c.completedModuleIds.length / Math.max(1, c.modules.length)) * 100
              );
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCourseId(c.id);
                    setAcademyMsg(null);
                  }}
                  className={`w-full text-left rounded-2xl border p-4 text-xs cursor-pointer space-y-1.5 ${
                    activeCourse?.id === c.id
                      ? 'border-[#1E3A8A] bg-[#1E3A8A]/10'
                      : 'fabro-border fabro-surface'
                  }`}
                >
                  <p className="font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                    {getDisciplineMeta(c.disciplineId)?.shortLabel} · {c.level}
                  </p>
                  <p className="text-sm font-bold">{c.title}</p>
                  <p className="fabro-muted">
                    {c.instructor} · {c.modules.length} módulos · Progreso {pct}%
                  </p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8">
            {activeCourse && (
              <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b fabro-border">
                  <div>
                    <p className="text-xs fabro-muted">
                      {activeCourse.instructor} · Nivel {activeCourse.level} ·{' '}
                      {activeCourse.enrolledStudents.length} alumnos inscriptos
                    </p>
                    <h3 className="font-display text-xl font-bold mt-0.5">{activeCourse.title}</h3>
                    <p className="text-xs fabro-muted mt-1 leading-relaxed">
                      {activeCourse.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveCourses(
                        courses.map((c) =>
                          c.id === activeCourse.id
                            ? {
                                ...c,
                                enrolled: !c.enrolled,
                                enrolledStudents: c.enrolled
                                  ? c.enrolledStudents.filter((s) => s !== currentAuthor)
                                  : Array.from(new Set([...c.enrolledStudents, currentAuthor])),
                              }
                            : c
                        )
                      )
                    }
                    className={`min-h-[40px] rounded-xl px-4 text-xs font-bold cursor-pointer ${
                      activeCourse.enrolled
                        ? 'border border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-[#1E3A8A] text-white'
                    }`}
                  >
                    {activeCourse.enrolled ? 'Inscripto' : 'Inscribirme gratis'}
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>Progreso del curso</span>
                    <span className="font-mono tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#1E3A8A] transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Modules */}
                <div className="space-y-3">
                  {activeCourse.modules.map((mod) => {
                    const done = activeCourse.completedModuleIds.includes(mod.id);
                    const videoParsed = mod.videoUrl ? parseVideoEmbedUrl(mod.videoUrl) : null;
                    return (
                      <div
                        key={mod.id}
                        className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold">{mod.title}</h4>
                            <p className="fabro-muted">{mod.durationLabel} · {mod.summary}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onSaveCourses(
                                courses.map((c) => {
                                  if (c.id !== activeCourse.id) return c;
                                  const nextIds = done
                                    ? c.completedModuleIds.filter((x) => x !== mod.id)
                                    : [...c.completedModuleIds, mod.id];
                                  return { ...c, completedModuleIds: nextIds };
                                })
                              )
                            }
                            className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg border px-2.5 font-semibold cursor-pointer shrink-0 ${
                              done
                                ? 'border-emerald-600/40 bg-emerald-600/12 text-emerald-700 dark:text-emerald-300'
                                : 'fabro-border fabro-surface'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{done ? 'Completado' : 'Marcar visto'}</span>
                          </button>
                        </div>
                        {mod.materialText && (
                          <p className="leading-relaxed pt-1">{mod.materialText}</p>
                        )}
                        {mod.activityPrompt && (
                          <p className="font-medium text-[#9A3412] dark:text-[#FDBA74]">
                            Actividad: {mod.activityPrompt}
                          </p>
                        )}
                        {videoParsed && (
                          <div className="aspect-video rounded-lg overflow-hidden border fabro-border mt-2">
                            <iframe
                              src={videoParsed.embedUrl}
                              title={mod.title}
                              className="w-full h-full"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quiz & Internal Certificate */}
                {activeCourse.quiz.length > 0 && (
                  <div className="pt-4 border-t fabro-border space-y-3 text-xs">
                    <h4 className="text-sm font-bold">Cuestionario de cierre y constancia interna</h4>
                    {activeCourse.quiz.map((q) => (
                      <div key={q.id} className="space-y-1.5">
                        <p className="font-semibold">{q.question}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {q.options.map((opt, idx) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                              className={`min-h-[38px] text-left rounded-xl border px-3 py-1.5 cursor-pointer ${
                                quizAnswers[q.id] === idx
                                  ? 'border-[#1E3A8A] bg-[#1E3A8A]/12 font-semibold'
                                  : 'fabro-border fabro-surface-elevated'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allRight = activeCourse.quiz.every(
                            (q) => quizAnswers[q.id] === q.correctIndex
                          );
                          if (allRight) {
                            onSaveCourses(
                              courses.map((c) =>
                                c.id === activeCourse.id ? { ...c, quizPassed: true } : c
                              )
                            );
                            setAcademyMsg('¡Cuestionario aprobado! Ya podés emitir tu constancia interna en PDF.');
                          } else {
                            setAcademyMsg('Revisá las respuestas seleccionadas e intentá nuevamente.');
                          }
                        }}
                        className="min-h-[40px] rounded-xl bg-[#1E3A8A] text-white px-4 font-bold cursor-pointer"
                      >
                        Evaluar cuestionario
                      </button>

                      {(activeCourse.quizPassed || progressPct === 100) && (
                        <button
                          type="button"
                          onClick={() => handleIssueCertificatePdf(activeCourse)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#9A3412] text-white px-4 font-bold cursor-pointer"
                        >
                          <Award className="w-4 h-4" />
                          <span>Emitir constancia interna (PDF)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // SECTION 4: DIGITAL LIBRARY
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#14532D]" />
            Biblioteca Digital de Dominio Público y Recursos Abiertos
          </h2>
          <p className="text-xs fabro-muted">
            Catálogo de libros, documentos, fotografías, partituras y archivos históricos libres de derechos. No se alojan copias de obras protegidas sin autorización.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              placeholder="Buscar por título, autor, colección o licencia..."
              className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 text-xs fabro-input"
            />
          </div>
          <select
            value={libCatFilter}
            onChange={(e) => setLibCatFilter(e.target.value as typeof libCatFilter)}
            className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
          >
            <option value="Todas">Todas las categorías</option>
            {LIBRARY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setLibOnlyFavs((v) => !v)}
            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold cursor-pointer ${
              libOnlyFavs
                ? 'border-rose-500/50 bg-rose-500/12 text-rose-600 dark:text-rose-400'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Favoritos</span>
          </button>
        </div>
      </div>

      {/* Add to Catalog */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newLibTitle.trim()) return;
          const entry: CultureLibraryEntry = {
            id: `lib-${Date.now()}`,
            title: newLibTitle.trim(),
            author: newLibAuthor.trim() || 'Dominio Público / Autoría propia',
            year: newLibYear.trim() || String(new Date().getFullYear()),
            category: newLibCat,
            disciplineId: 'bibliotecas-archivos',
            license: 'Dominio público / Licencia abierta',
            summary: 'Recurso referenciado por el usuario en su colección personal.',
            externalUrl: newLibUrl.trim() || undefined,
            collectionName: newLibCollection.trim() || 'Mi Colección',
            favorite: false,
          };
          onSaveLibrary([entry, ...library]);
          setNewLibTitle('');
          setNewLibAuthor('');
          setNewLibYear('');
          setNewLibUrl('');
        }}
        className="rounded-2xl border fabro-border fabro-surface p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs"
      >
        <input
          type="text"
          value={newLibTitle}
          onChange={(e) => setNewLibTitle(e.target.value)}
          placeholder="Título de la obra o archivo libre"
          className="sm:col-span-3 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
        />
        <input
          type="text"
          value={newLibAuthor}
          onChange={(e) => setNewLibAuthor(e.target.value)}
          placeholder="Autor / Fondo"
          className="sm:col-span-2 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
        />
        <select
          value={newLibCat}
          onChange={(e) => setNewLibCat(e.target.value as DigitalLibraryCategory)}
          className="sm:col-span-2 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
        >
          {LIBRARY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="url"
          value={newLibUrl}
          onChange={(e) => setNewLibUrl(e.target.value)}
          placeholder="Enlace legal (Gutenberg, Wikisource, IMSLP...)"
          className="sm:col-span-3 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
        />
        <button
          type="submit"
          className="sm:col-span-2 min-h-[38px] rounded-xl bg-[#14532D] text-white font-bold cursor-pointer"
        >
          Catalogar
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLibrary.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border fabro-border fabro-surface p-4 flex flex-col justify-between gap-3 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[#14532D] dark:text-emerald-400">
                  {item.category} · {item.collectionName}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onSaveLibrary(
                      library.map((l) => (l.id === item.id ? { ...l, favorite: !l.favorite } : l))
                    )
                  }
                  aria-label="Marcar favorito"
                  className={`cursor-pointer ${
                    item.favorite ? 'text-rose-600' : 'fabro-muted hover:text-rose-500'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${item.favorite ? 'fill-current' : ''}`} />
                </button>
              </div>
              <h3 className="text-sm font-bold">{item.title}</h3>
              <p className="fabro-muted">
                {item.author} ({item.year}) · {item.license}
              </p>
              <p className="leading-relaxed pt-1">{item.summary}</p>
            </div>
            {item.externalUrl && (
              <a
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline self-start"
              >
                <span>Abrir fuente pública</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};
