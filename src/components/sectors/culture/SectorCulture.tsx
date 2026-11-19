import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Landmark,
  Layers,
  Menu,
  User,
  Users,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  CULTURE_SIDEBAR_ORDER,
  DEFAULT_CULTURE_STATE,
  getDisciplineMeta,
} from '../../../data/cultureCatalog';
import { loadCultureState, saveCultureState } from '../../../services/cultureVault';
import type {
  CultureDisciplineId,
  CultureNavId,
  CultureStateSnapshot,
} from '../../../types/culture';
import { CultureCommunityAcademyLibrary } from './CultureCommunityAcademyLibrary';
import { CultureDisciplinesStudio } from './CultureDisciplinesStudio';
import { CultureHomeView } from './CultureHomeView';
import { CultureWallPanel } from './CultureWallPanel';
import { HeritageCraftsGastroStudio } from './HeritageCraftsGastroStudio';
import { LiteratureStudio } from './LiteratureStudio';
import { MusicAudioStudio } from './MusicAudioStudio';
import { StageScreenStudio } from './StageScreenStudio';
import { VisualArtsStudio } from './VisualArtsStudio';

export const SectorCulture: React.FC = () => {
  const { addWallPost, authUser, profile } = useEcosystem();
  const [activeNav, setActiveNav] = useState<CultureNavId>('inicio');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState('');
  const [state, setState] = useState<CultureStateSnapshot>(DEFAULT_CULTURE_STATE);

  useEffect(() => {
    let mounted = true;
    void loadCultureState().then((loaded) => {
      if (mounted) setState(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updateCultureState = (updater: (prev: CultureStateSnapshot) => CultureStateSnapshot) => {
    setState((prev) => {
      const next = updater(prev);
      void saveCultureState(next);
      return next;
    });
  };

  const activeDisciplineMeta = useMemo(() => getDisciplineMeta(activeNav), [activeNav]);

  const filteredSidebarItems = useMemo(() => {
    const q = sidebarFilter.trim().toLowerCase();
    if (!q) return CULTURE_SIDEBAR_ORDER;
    return CULTURE_SIDEBAR_ORDER.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || String(item.number).includes(q)
    );
  }, [sidebarFilter]);

  const handlePublishArtworkToWall = (
    title: string,
    imageDataUrl: string,
    disciplineId: CultureDisciplineId
  ) => {
    const discMeta = getDisciplineMeta(disciplineId);
    const authorName =
      profile.culturalProfile?.artisticName?.trim() ||
      authUser?.displayName ||
      profile.displayName ||
      'Invitado FABRO';
    addWallPost({
      author: authorName,
      fabroId: authUser?.fabroId || profile.fabroId || 'FBR-INVITADO',
      authorAvatar: profile.photoURL || authUser?.photoURL,
      text: `Nueva obra compartida desde ${discMeta?.label || 'FABRO Cultura'}: «${title}» #fabrocultura`,
      origin: 'general',
      communityId: 'cultura-both',
      communityName: `FABRO Cultura · ${discMeta?.label || 'Cultura'}`,
      categoryTag: `cultura:${disciplineId}`,
      spaces: ['cultura', 'general'],
      cultureDiscipline: disciplineId,
      hashtags: ['#fabrocultura'],
      media: [
        {
          id: `art-media-${Date.now()}`,
          kind: 'image',
          dataUrl: imageDataUrl,
          caption: title,
        },
      ],
    });
  };

  const selectNav = (id: CultureNavId) => {
    setActiveNav(id);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b fabro-border space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-[#9A3412] dark:text-[#FDBA74]">
            <Landmark className="w-4 h-4 shrink-0" />
            FABRO Cultura
          </span>
          <span className="text-[11px] font-mono tabular-nums fabro-muted">26 áreas</span>
        </div>
        <input
          type="search"
          value={sidebarFilter}
          onChange={(e) => setSidebarFilter(e.target.value)}
          placeholder="Filtrar 26 secciones..."
          className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
        />
      </div>

      {/* Main 26 Required Entries */}
      <nav
        aria-label="Menú lateral de FABRO Cultura"
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
      >
        {filteredSidebarItems.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNav(item.id)}
              className={`w-full min-h-[38px] rounded-xl px-2.5 py-1.5 text-left text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                active
                  ? 'bg-[#9A3412] text-white font-semibold'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <span
                className={`font-mono text-[10px] w-5 text-right shrink-0 tabular-nums ${
                  active ? 'text-white/80' : 'opacity-65'
                }`}
              >
                {String(item.number).padStart(2, '0')}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Dedicated Cultural Hubs */}
        <div className="pt-3 mt-2 border-t fabro-border space-y-0.5">
          <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider fabro-muted">
            Espacios transversales
          </p>
          {(
            [
              { id: 'perfil-cultural', label: 'Perfil cultural', icon: User },
              { id: 'comunidades-culturales', label: 'Comunidades culturales', icon: Users },
              { id: 'academia-cultural', label: 'Academia cultural', icon: GraduationCap },
              { id: 'biblioteca-digital', label: 'Biblioteca digital', icon: BookOpen },
            ] as const
          ).map((hub) => {
            const Icon = hub.icon;
            const active = activeNav === hub.id;
            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => selectNav(hub.id)}
                className={`w-full min-h-[38px] rounded-xl px-2.5 py-1.5 text-left text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#1E3A8A] text-white font-semibold'
                    : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{hub.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );

  const renderActiveStudio = () => {
    if (activeNav === 'inicio') {
      return (
        <CultureHomeView
          courses={state.courses}
          events={state.events}
          onNavigateCulture={selectNav}
          onToggleEventAttending={(eventId) =>
            updateCultureState((prev) => ({
              ...prev,
              events: prev.events.map((ev) =>
                ev.id === eventId ? { ...ev, attending: !ev.attending } : ev
              ),
            }))
          }
        />
      );
    }

    if (activeNav === 'muro-cultural') {
      return <CultureWallPanel onSelectDiscipline={(discId) => selectNav(discId)} />;
    }

    if (
      activeNav === 'perfil-cultural' ||
      activeNav === 'comunidades-culturales' ||
      activeNav === 'academia-cultural' ||
      activeNav === 'biblioteca-digital'
    ) {
      return (
        <CultureCommunityAcademyLibrary
          section={activeNav}
          communities={state.communities}
          courses={state.courses}
          library={state.library}
          onSaveCommunities={(communities) =>
            updateCultureState((prev) => ({ ...prev, communities }))
          }
          onSaveCourses={(courses) => updateCultureState((prev) => ({ ...prev, courses }))}
          onSaveLibrary={(library) => updateCultureState((prev) => ({ ...prev, library }))}
        />
      );
    }

    if (!activeDisciplineMeta) return null;

    return (
      <div className="space-y-5">
        {/* Discipline Editorial Header */}
        <section className="rounded-2xl border fabro-border fabro-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: activeDisciplineMeta.accentColor }}
            >
              {String(activeDisciplineMeta.order).padStart(2, '0')} · {activeDisciplineMeta.category}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {activeDisciplineMeta.label}
            </h1>
            <p className="text-xs sm:text-sm fabro-muted">{activeDisciplineMeta.tagline}</p>
          </div>
          <button
            type="button"
            onClick={() => selectNav('muro-cultural')}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 text-xs font-semibold cursor-pointer self-start sm:self-center whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-[#9A3412]" />
            <span>Compartir en Muro Cultural</span>
          </button>
        </section>

        {/* Render Discipline Studio */}
        {(activeDisciplineMeta.studioKind === 'visual-arts' ||
          activeDisciplineMeta.studioKind === 'photography') && (
          <VisualArtsStudio
            mode={activeDisciplineMeta.studioKind}
            disciplineId={activeDisciplineMeta.id}
            gallery={state.gallery}
            exhibitions={state.exhibitions}
            onSaveArtwork={(art) =>
              updateCultureState((prev) => ({ ...prev, gallery: [art, ...prev.gallery] }))
            }
            onDeleteArtwork={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                gallery: prev.gallery.filter((g) => g.id !== id),
              }))
            }
            onSaveExhibition={(exh) =>
              updateCultureState((prev) => ({
                ...prev,
                exhibitions: [exh, ...prev.exhibitions],
              }))
            }
            onPublishToWall={handlePublishArtworkToWall}
          />
        )}

        {activeDisciplineMeta.studioKind === 'music' && (
          <MusicAudioStudio
            songs={state.songs}
            onSaveSong={(song) =>
              updateCultureState((prev) => ({ ...prev, songs: [song, ...prev.songs] }))
            }
            onDeleteSong={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                songs: prev.songs.filter((s) => s.id !== id),
              }))
            }
          />
        )}

        {activeDisciplineMeta.studioKind === 'literature' && (
          <LiteratureStudio
            manuscripts={state.manuscripts}
            readingList={state.readingList}
            onSaveManuscript={(book) =>
              updateCultureState((prev) => {
                const exists = prev.manuscripts.some((b) => b.id === book.id);
                return {
                  ...prev,
                  manuscripts: exists
                    ? prev.manuscripts.map((b) => (b.id === book.id ? book : b))
                    : [book, ...prev.manuscripts],
                };
              })
            }
            onDeleteManuscript={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                manuscripts: prev.manuscripts.filter((b) => b.id !== id),
              }))
            }
            onSaveReading={(item) =>
              updateCultureState((prev) => ({
                ...prev,
                readingList: [item, ...prev.readingList],
              }))
            }
            onDeleteReading={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                readingList: prev.readingList.filter((r) => r.id !== id),
              }))
            }
          />
        )}

        {(activeDisciplineMeta.studioKind === 'cinema' ||
          activeDisciplineMeta.studioKind === 'theater' ||
          activeDisciplineMeta.studioKind === 'dance') && (
          <StageScreenStudio
            mode={activeDisciplineMeta.studioKind}
            disciplineId={activeDisciplineMeta.id}
            records={state.records}
            onSaveRecord={(rec) =>
              updateCultureState((prev) => ({ ...prev, records: [rec, ...prev.records] }))
            }
            onDeleteRecord={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                records: prev.records.filter((r) => r.id !== id),
              }))
            }
          />
        )}

        {(activeDisciplineMeta.studioKind === 'history' ||
          activeDisciplineMeta.studioKind === 'genealogy' ||
          activeDisciplineMeta.studioKind === 'crafts' ||
          activeDisciplineMeta.studioKind === 'gastronomy' ||
          activeDisciplineMeta.studioKind === 'philosophy-science') && (
          <HeritageCraftsGastroStudio
            mode={activeDisciplineMeta.studioKind}
            disciplineId={activeDisciplineMeta.id}
            timeline={state.timeline}
            familyTree={state.familyTree}
            recipes={state.recipes}
            records={state.records}
            onSaveTimeline={(item) =>
              updateCultureState((prev) => ({ ...prev, timeline: [item, ...prev.timeline] }))
            }
            onDeleteTimeline={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                timeline: prev.timeline.filter((t) => t.id !== id),
              }))
            }
            onSaveFamily={(member) =>
              updateCultureState((prev) => ({
                ...prev,
                familyTree: [...prev.familyTree, member],
              }))
            }
            onDeleteFamily={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                familyTree: prev.familyTree.filter((f) => f.id !== id),
              }))
            }
            onSaveRecipe={(recipe) =>
              updateCultureState((prev) => ({ ...prev, recipes: [recipe, ...prev.recipes] }))
            }
            onDeleteRecipe={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                recipes: prev.recipes.filter((r) => r.id !== id),
              }))
            }
            onSaveRecord={(rec) =>
              updateCultureState((prev) => ({ ...prev, records: [rec, ...prev.records] }))
            }
            onDeleteRecord={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                records: prev.records.filter((r) => r.id !== id),
              }))
            }
          />
        )}

        {[
          'museums',
          'archives',
          'folklore',
          'tourism',
          'indigenous',
          'urban',
          'videogames',
          'environment',
          'citizenship',
          'collecting',
          'festivals',
        ].includes(activeDisciplineMeta.studioKind) && (
          <CultureDisciplinesStudio
            meta={activeDisciplineMeta}
            records={state.records}
            onSaveRecord={(rec) =>
              updateCultureState((prev) => ({ ...prev, records: [rec, ...prev.records] }))
            }
            onDeleteRecord={(id) =>
              updateCultureState((prev) => ({
                ...prev,
                records: prev.records.filter((r) => r.id !== id),
              }))
            }
            onOpenDigitalLibrary={() => selectNav('biblioteca-digital')}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Mobile Cultural Sector Navigation Trigger Bar */}
      <div className="xl:hidden flex items-center justify-between gap-2 rounded-2xl border fabro-border fabro-surface px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#9A3412] text-white px-3.5 text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          <Menu className="w-4 h-4" />
          <span>Disciplinas Cultura (26)</span>
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => selectNav('inicio')}
            className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              activeNav === 'inicio'
                ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            Inicio
          </button>
          <button
            type="button"
            onClick={() => selectNav('muro-cultural')}
            className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              activeNav === 'muro-cultural'
                ? 'border-[#9A3412] bg-[#9A3412]/12 text-[#9A3412] dark:text-[#FDBA74]'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            Muro
          </button>
          <button
            type="button"
            onClick={() => selectNav('academia-cultural')}
            className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              activeNav === 'academia-cultural'
                ? 'border-[#1E3A8A] bg-[#1E3A8A]/12 text-[#1E3A8A] dark:text-[#93C5FD]'
                : 'fabro-border fabro-surface-elevated'
            }`}
          >
            Academia
          </button>
        </div>
      </div>

      {/* Desktop 2-Column Layout: Own Cultural Sidebar (26 items) + Active Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <aside className="hidden xl:block xl:col-span-3 rounded-2xl border fabro-border fabro-surface sticky top-[72px] max-h-[calc(100dvh-96px)] overflow-hidden">
          {renderSidebarContent()}
        </aside>

        <div className="xl:col-span-9 min-w-0">{renderActiveStudio()}</div>
      </div>

      {/* Mobile Slide-Over Sidebar for all 26 Cultural Entries */}
      {mobileSidebarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú lateral de FABRO Cultura"
          className="xl:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-start"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="w-[85vw] max-w-xs h-full fabro-surface border-r fabro-border flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 border-b fabro-border flex items-center justify-between">
              <span className="text-sm font-bold">Menú FABRO Cultura</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Cerrar menú cultural"
                className="w-9 h-9 rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{renderSidebarContent()}</div>
          </div>
        </div>
      )}
    </div>
  );
};
