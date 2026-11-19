import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  GraduationCap,
  Layers,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  CULTURE_DISCIPLINES,
  getDisciplineMeta,
  RECOMMENDED_ARTISTS,
} from '../../../data/cultureCatalog';
import {
  extractCultureDisciplineFromPost,
  isPostInCultureWall,
} from '../../../services/cultureVault';
import type {
  CultureCourseItem,
  CultureDisciplineId,
  CultureEventItem,
  CultureNavId,
} from '../../../types/culture';

interface CultureHomeViewProps {
  courses: CultureCourseItem[];
  events: CultureEventItem[];
  onNavigateCulture: (target: CultureNavId) => void;
  onToggleEventAttending: (eventId: string) => void;
}

const FEATURED_TOOLS: Array<{
  title: string;
  disciplineLabel: string;
  target: CultureDisciplineId;
  summary: string;
}> = [
  {
    title: 'Editor Gráfico, Dibujo y Carteles',
    disciplineLabel: 'Artes visuales',
    target: 'artes-visuales',
    summary: 'Lienzo HTML5 gratuito con pinceles, formas, paletas armónicas y exportación PNG.',
  },
  {
    title: 'Afinador, Metrónomo y Compositor',
    disciplineLabel: 'Música',
    target: 'musica',
    summary: 'Web Audio API de precisión, acordes, partitura visual y grabadora local.',
  },
  {
    title: 'Escritor de Novelas, Poesía y PDF',
    disciplineLabel: 'Literatura',
    target: 'literatura',
    summary: 'Capítulos, métrica poética, corrector local en español e índice exportable a PDF.',
  },
  {
    title: 'Guiones, Storyboards y Subtítulos SRT',
    disciplineLabel: 'Cine y audiovisual',
    target: 'cine-audiovisual',
    summary: 'Formato profesional de guion, tarjetas de planos y exportación directa .SRT.',
  },
  {
    title: 'Árbol Genealógico y Línea de Tiempo',
    disciplineLabel: 'Historia y patrimonio',
    target: 'historia-patrimonio',
    summary: 'Memoria familiar por generaciones, archivo histórico y cronología interactiva.',
  },
  {
    title: 'Recetario y Escalador de Porciones',
    disciplineLabel: 'Gastronomía',
    target: 'gastronomia',
    summary: 'Recalcula automáticamente ingredientes y convierte medidas culinarias al instante.',
  },
];

export const CultureHomeView: React.FC<CultureHomeViewProps> = ({
  courses,
  events,
  onNavigateCulture,
  onToggleEventAttending,
}) => {
  const { wallPosts, profile, toggleFollowProfile } = useEcosystem();
  const [activitySearch, setActivitySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');

  const recentCulturePosts = useMemo(
    () => wallPosts.filter(isPostInCultureWall).slice(0, 3),
    [wallPosts]
  );

  const categories = ['Todas', ...Array.from(new Set(CULTURE_DISCIPLINES.map((d) => d.category)))];

  const filteredDisciplines = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return CULTURE_DISCIPLINES.filter((d) => {
      if (categoryFilter !== 'Todas' && d.category !== categoryFilter) return false;
      if (!q) return true;
      return `${d.label} ${d.tagline} ${d.category} ${d.tools.join(' ')}`
        .toLowerCase()
        .includes(q);
    });
  }, [activitySearch, categoryFilter]);

  return (
    <div className="space-y-8">
      {/* 1. Editorial Cultural Header + Operational Strip */}
      <section className="rounded-2xl border fabro-border fabro-surface p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#9A3412] dark:text-[#FDBA74]">
              FABRO Cultura · Ecosistema Creativo y Patrimonial
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              Un espacio abierto para crear, archivar y compartir cultura en comunidad
            </h1>
            <p className="text-sm fabro-muted leading-relaxed">
              26 espacios culturales con herramientas digitales 100% gratuitas en tu navegador, academia abierta, biblioteca de dominio público y un muro cultural sincronizado con la red social de FABRO.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateCulture('muro-cultural')}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#9A3412] text-white px-4 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Layers className="w-4 h-4" />
              <span>Ir al Muro Cultural</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateCulture('academia-cultural')}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4 text-[#1E3A8A] dark:text-[#93C5FD]" />
              <span>Academia</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateCulture('biblioteca-digital')}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
              <span>Biblioteca Digital</span>
            </button>
          </div>
        </div>

        {/* Activity Search Bar */}
        <div className="pt-4 border-t fabro-border flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 fabro-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              placeholder="Buscar disciplinas o herramientas (ej: afinador, guion, acuarela, recetario, árbol genealógico, pixel art)..."
              className="w-full min-h-[44px] rounded-xl border fabro-border fabro-surface-elevated pl-10 pr-4 text-xs sm:text-sm fabro-input"
            />
          </div>
          <div className="flex items-center gap-2 text-xs fabro-muted shrink-0">
            <span className="font-mono tabular-nums">{CULTURE_DISCIPLINES.length} disciplinas</span>
            <span aria-hidden="true">·</span>
            <span>Sin costos adicionales</span>
          </div>
        </div>
      </section>

      {/* 2. Featured Free Creative Tools */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Herramientas destacadas</h2>
          <span className="text-xs fabro-muted">Acceso directo en tu navegador</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {FEATURED_TOOLS.map((tool) => (
            <button
              key={tool.title}
              type="button"
              onClick={() => onNavigateCulture(tool.target)}
              className="text-left rounded-2xl border fabro-border fabro-surface p-4 hover:border-[#9A3412] transition-colors cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                  {tool.disciplineLabel}
                </p>
                <h3 className="text-sm font-bold">{tool.title}</h3>
                <p className="text-xs fabro-muted leading-relaxed">{tool.summary}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-[#93C5FD]">
                Abrir estudio <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. All 24 Cultural Disciplines Directory */}
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Disciplinas culturales</h2>
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl border fabro-border fabro-surface">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-[#1E3A8A] text-white'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredDisciplines.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onNavigateCulture(d.id)}
              className="text-left rounded-2xl border fabro-border fabro-surface p-4 hover:border-[#9A3412] transition-colors cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold" style={{ color: d.accentColor }}>
                  {d.category}
                </span>
                <span className="font-mono tabular-nums fabro-muted">
                  {d.tools.length} herramientas
                </span>
              </div>
              <h3 className="text-sm font-bold">{d.label}</h3>
              <p className="text-xs fabro-muted leading-relaxed line-clamp-2">{d.tagline}</p>
              <p className="text-[11px] fabro-muted truncate pt-1 border-t fabro-border">
                {d.tools.slice(0, 3).join(' · ')}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Recent Cultural Posts + Recommended Artists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b fabro-border">
            <h2 className="font-display text-base font-bold">Publicaciones recientes en Cultura</h2>
            <button
              type="button"
              onClick={() => onNavigateCulture('muro-cultural')}
              className="text-xs font-semibold text-[#9A3412] dark:text-[#FDBA74] hover:underline cursor-pointer"
            >
              Ver muro completo →
            </button>
          </div>
          {recentCulturePosts.length === 0 ? (
            <div className="py-6 text-center space-y-2 text-xs fabro-muted">
              <p>Todavía no hay publicaciones culturales recientes.</p>
              <button
                type="button"
                onClick={() => onNavigateCulture('muro-cultural')}
                className="min-h-[38px] rounded-xl bg-[#9A3412] text-white px-4 font-bold cursor-pointer"
              >
                Publicar primera obra en el Muro Cultural
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCulturePosts.map((p) => {
                const dm = getDisciplineMeta(extractCultureDisciplineFromPost(p) || '');
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{p.author}</span>
                      <span className="fabro-muted">
                        {dm?.shortLabel || 'Cultura'} · {p.createdAt}
                      </span>
                    </div>
                    <p className="line-clamp-2 leading-relaxed">{p.text}</p>
                    <p className="fabro-muted tabular-nums">
                      {p.likes} reacciones · {(p.comments || []).length} comentarios
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b fabro-border">
            <h2 className="font-display text-base font-bold">Artistas y creadores recomendados</h2>
            <button
              type="button"
              onClick={() => onNavigateCulture('comunidades-culturales')}
              className="text-xs font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline cursor-pointer"
            >
              Comunidades →
            </button>
          </div>
          <div className="space-y-3">
            {RECOMMENDED_ARTISTS.map((art) => {
              const isFollowing = (profile.followingIds || []).includes(art.fabroId);
              return (
                <div
                  key={art.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="w-9 h-9 rounded-xl text-white font-bold text-xs flex items-center justify-center shrink-0"
                      style={{ backgroundColor: art.accent }}
                    >
                      {art.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{art.displayName}</p>
                      <p className="fabro-muted truncate">
                        {art.discipline} · {art.worksCount} obras
                      </p>
                      <p className="fabro-muted mt-0.5 line-clamp-2">{art.bio}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollowProfile(art.fabroId)}
                    className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg border px-2.5 font-semibold cursor-pointer shrink-0 ${
                      isFollowing
                        ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                        : 'fabro-border fabro-surface'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Siguiendo</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Seguir</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 5. Courses & Workshops + Cultural Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b fabro-border">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#1E3A8A]" />
              Cursos y talleres abiertos
            </h2>
            <button
              type="button"
              onClick={() => onNavigateCulture('academia-cultural')}
              className="text-xs font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline cursor-pointer"
            >
              Ver academia →
            </button>
          </div>
          <div className="space-y-2.5">
            {courses.slice(0, 3).map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => onNavigateCulture('academia-cultural')}
                className="w-full text-left rounded-xl border fabro-border fabro-surface-elevated p-3.5 text-xs hover:border-[#1E3A8A] cursor-pointer space-y-1"
              >
                <p className="font-semibold text-[#9A3412] dark:text-[#FDBA74]">
                  {getDisciplineMeta(course.disciplineId)?.shortLabel} · Nivel {course.level}
                </p>
                <h3 className="text-sm font-bold">{course.title}</h3>
                <p className="fabro-muted">
                  {course.instructor} · {course.modules.length} módulos · Gratuito
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b fabro-border">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#9A3412]" />
              Eventos culturales
            </h2>
            <button
              type="button"
              onClick={() => onNavigateCulture('festivales-celebraciones')}
              className="text-xs font-semibold text-[#9A3412] dark:text-[#FDBA74] hover:underline cursor-pointer"
            >
              Agenda completa →
            </button>
          </div>
          <div className="space-y-2.5">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 text-xs flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-[#1E3A8A] dark:text-[#93C5FD]">
                    {ev.dateLabel} · {ev.modality}
                  </p>
                  <h3 className="text-sm font-bold">{ev.title}</h3>
                  <p className="fabro-muted">{ev.location}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleEventAttending(ev.id)}
                  className={`min-h-[34px] rounded-lg border px-3 font-semibold cursor-pointer shrink-0 ${
                    ev.attending
                      ? 'border-emerald-600/40 bg-emerald-600/12 text-emerald-700 dark:text-emerald-300'
                      : 'fabro-border fabro-surface'
                  }`}
                >
                  {ev.attending ? 'Agendado' : 'Asistiré'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Quick Bottom Access to Cultural Profile & Communities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigateCulture('perfil-cultural')}
          className="rounded-2xl border fabro-border fabro-surface p-4 text-left hover:border-[#9A3412] cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="text-xs space-y-0.5">
            <p className="text-sm font-bold">Tu Perfil Cultural (Opcional)</p>
            <p className="fabro-muted">
              Sumá nombre artístico, biografía cultural, obras y portafolio sobre tu cuenta FABRO.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 fabro-muted shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateCulture('comunidades-culturales')}
          className="rounded-2xl border fabro-border fabro-surface p-4 text-left hover:border-[#1E3A8A] cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="text-xs space-y-0.5">
            <p className="text-sm font-bold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#1E3A8A]" /> Comunidades Culturales
            </p>
            <p className="fabro-muted">
              Escritores, músicos, fotógrafos, pintores, cineastas, actores, artesanos, historiadores, lectores e investigadores.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 fabro-muted shrink-0" />
        </button>
      </div>
    </div>
  );
};
