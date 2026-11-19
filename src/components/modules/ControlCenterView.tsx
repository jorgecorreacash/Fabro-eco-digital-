import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  Clover,
  Compass,
  Copy,
  Dumbbell,
  Edit3,
  Feather,
  FileSpreadsheet,
  FileText,
  Film,
  Flame,
  FolderKanban,
  Globe,
  GraduationCap,
  HeartPulse,
  ImagePlus,
  KeyRound,
  Layers,
  Leaf,
  Library,
  MessageSquare,
  Microscope,
  Music,
  Palette,
  Quote,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Sun,
  Timer,
  Trash2,
  UserCheck,
  Users,
  WifiOff,
  Wrench,
  X,
  Youtube,
} from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { useHabitTimer } from '../../context/HabitTimerContext';
import { getLocalDateKey, useLastDay } from '../../context/LastDayContext';
import { usePlatform } from '../../context/PlatformContext';
import { computeFabroId } from '../../lib/fabroId';
import { getDriveConnectionStatus } from '../../lib/googleDriveBackup';
import type { NavSectionId } from '../../types/fabro';

interface ControlCenterViewProps {
  favoriteIds?: NavSectionId[];
  recentIds?: NavSectionId[];
  onNavigate?: (id: NavSectionId) => void;
}

type ToolSectorFilter =
  | 'Todas'
  | 'Estudio'
  | 'Bienestar y Salud'
  | 'Red Social'
  | 'Inteligencia Artificial'
  | 'Productividad'
  | 'Configuración';

interface ToolCatalogItem {
  id: NavSectionId;
  label: string;
  sector: Exclude<ToolSectorFilter, 'Todas'>;
  description: string;
  keywords: string;
  icon: React.FC<{ className?: string }>;
}

const ALL_TOOLS_CATALOG: ToolCatalogItem[] = [
  // Sector 1 · Estudio e Investigación
  {
    id: 'estudio-panel',
    label: 'Panel General de Estudio',
    sector: 'Estudio',
    description: 'Centro organizador con acceso unificado a materias, cuadernos, investigación, exámenes y clases virtuales.',
    keywords: 'estudio panel educacion aprendizaje',
    icon: GraduationCap,
  },
  {
    id: 'materias',
    label: 'Mis Materias y Programas',
    sector: 'Estudio',
    description: 'Gestioná cátedras, programas en PDF, bibliografías, unidades temáticas y avance porcentual.',
    keywords: 'materias programas catedras bibliografia unidades',
    icon: BookOpen,
  },
  {
    id: 'apuntes',
    label: 'Cuadernos y Apuntes Digitales',
    sector: 'Estudio',
    description: 'Editor de textos enriquecido con resúmenes automáticos, líneas de tiempo y exportación profesional a PDF/Word.',
    keywords: 'notas apuntes cuadernos pdf word resumenes linea tiempo',
    icon: FileText,
  },
  {
    id: 'biblioteca',
    label: 'Biblioteca Personal y Documental',
    sector: 'Estudio',
    description: 'Subí libros, apuntes, PDFs e imágenes con disponibilidad sin conexión gracias a la bóveda IndexedDB.',
    keywords: 'biblioteca libros archivos pdf lectura offline',
    icon: FolderKanban,
  },
  {
    id: 'libros',
    label: 'Escribir Libros',
    sector: 'Estudio',
    description: 'Organizá proyectos editoriales por capítulos, métricas de palabras y manuscritos estructurados.',
    keywords: 'libros capitulos manuscrito escritura editorial',
    icon: Feather,
  },
  {
    id: 'fuentes',
    label: 'Buscador Web y Fuentes Reales',
    sector: 'Estudio',
    description: 'Explorá fuentes verificadas de internet, leé artículos y consultá la enciclopedia visual integrada.',
    keywords: 'fuentes internet web enciclopedia lectura',
    icon: Globe,
  },
  {
    id: 'research',
    label: 'FABRO Research',
    sector: 'Estudio',
    description: 'Investigación académica con extracción de citas bibliográficas en formato APA, MLA y Chicago.',
    keywords: 'investigacion tesis citas apa mla chicago referencias',
    icon: Microscope,
  },
  {
    id: 'knowledge',
    label: 'FABRO Knowledge',
    sector: 'Estudio',
    description: 'Acceso directo a repositorios científicos abiertos como PubMed, SciELO, ERIC, Zenodo y Project Gutenberg.',
    keywords: 'pubmed scielo eric zenodo repositorios cientificos',
    icon: Library,
  },
  {
    id: 'diccionario',
    label: 'Diccionario y Glosario',
    sector: 'Estudio',
    description: 'Creá definiciones técnicas, glosarios por área y tarjetas rápidas de terminología clave.',
    keywords: 'diccionario glosario terminologia definiciones',
    icon: BookMarked,
  },
  {
    id: 'academy',
    label: 'FABRO Academy',
    sector: 'Estudio',
    description: 'Cursos organizados por áreas y especialidades con lecciones, seguimiento y certificados.',
    keywords: 'cursos academy especialidades certificados',
    icon: Award,
  },
  {
    id: 'video',
    label: 'Videoteca IA',
    sector: 'Estudio',
    description: 'Guardá clases y charlas de YouTube con notas sincronizadas, transcripción y resúmenes asistidos.',
    keywords: 'videos youtube clases transcripcion',
    icon: Youtube,
  },
  {
    id: 'examenes',
    label: 'Exámenes y Simulacros',
    sector: 'Estudio',
    description: 'Generá cuestionarios interactivos y preparate para evaluaciones escritas u orales con corrección inmediata.',
    keywords: 'examenes simulacros preguntas respuestas oral escrito',
    icon: GraduationCap,
  },
  {
    id: 'memorizacion',
    label: 'Fichas de Memoria',
    sector: 'Estudio',
    description: 'Mazos de tarjetas de memoria con repaso espaciado para consolidar conceptos a largo plazo.',
    keywords: 'flashcards fichas repaso espaciado memorizacion',
    icon: Layers,
  },
  {
    id: 'study',
    label: 'FABRO Study',
    sector: 'Estudio',
    description: 'Temporizador Pomodoro, traductor multilingüe y dictado por voz para sesiones enfocadas.',
    keywords: 'pomodoro traductor voz dictado estudio',
    icon: Clock,
  },
  {
    id: 'progreso',
    label: 'Mi Progreso',
    sector: 'Estudio',
    description: 'Visualizá estadísticas reales de horas dedicadas, rachas de actividad y cumplimiento semanal.',
    keywords: 'progreso estadisticas horas metricas',
    icon: BarChart3,
  },

  // Sector 2 · Bienestar y Salud
  {
    id: 'bienestar-panel',
    label: 'Panel General de Bienestar y Salud',
    sector: 'Bienestar y Salud',
    description: 'Ecosistema integral de autocuidado que reúne reflexión personal, hábitos, nutrición, ejercicios y horóscopos.',
    keywords: 'bienestar salud natural panel',
    icon: Leaf,
  },
  {
    id: 'ultimo-dia',
    label: 'El Último Día de Tu Vida',
    sector: 'Bienestar y Salud',
    description: 'Espacio íntimo para reflexión diaria, registro emocional, sueños, escritos personales, recuerdos y legado privado.',
    keywords: 'ultimo dia vida reflexion diario emociones suenos legado',
    icon: Sun,
  },
  {
    id: 'calorias',
    label: 'Contador de Calorías',
    sector: 'Bienestar y Salud',
    description: 'Registrá comidas diarias, calculá tu meta calórica y controlá calorías quemadas con macronutrientes.',
    keywords: 'calorias kcal comida dieta macros balance quemadas',
    icon: Flame,
  },
  {
    id: 'habitos',
    label: 'Organización y Hábitos IA',
    sector: 'Bienestar y Salud',
    description: 'Temporizador de rutinas con alertas sonoras, seguimiento diario de hábitos, hidratación y sugerencias diarias.',
    keywords: 'habitos rutinas temporizador dieta nutricion hidratacion',
    icon: Timer,
  },
  {
    id: 'ejercicios',
    label: 'Salud y Ejercicios por Niveles',
    sector: 'Bienestar y Salud',
    description: 'Rutinas guiadas por niveles con videos, estiramientos, movilidad, respiración consciente y meditación.',
    keywords: 'ejercicios niveles videos estiramientos respiracion meditacion',
    icon: Dumbbell,
  },
  {
    id: 'horoscopo',
    label: 'Horóscopos',
    sector: 'Bienestar y Salud',
    description: 'Lecturas diarias por signo zodiacal, compatibilidad y orientación reflexiva para tu jornada.',
    keywords: 'horoscopo signos zodiaco afinidad',
    icon: Star,
  },
  {
    id: 'suerte',
    label: 'Números de la Suerte 🍀',
    sector: 'Bienestar y Salud',
    description: 'Generador numerológico personalizado con el trébol de cuatro hojas y combinaciones del día.',
    keywords: 'numeros suerte trebol numerologia',
    icon: Clover,
  },

  // Sector 3 · Red Social FABRO
  {
    id: 'social-panel',
    label: 'Panel Red Social FABRO',
    sector: 'Red Social',
    description: 'Hub social estilo globo con tu FABRO ID, código QR, estados, chats rápidos y acceso a comunidades.',
    keywords: 'social panel fabro id globo qr chat',
    icon: MessageSquare,
  },
  {
    id: 'comunidad',
    label: 'Muro, Grupos y Comunidades',
    sector: 'Red Social',
    description: 'Publicá ideas, compartí archivos, creá grupos temáticos, encuestas y participá en conversaciones abiertas.',
    keywords: 'muro grupos comunidades publicaciones reacciones',
    icon: Users,
  },
  {
    id: 'mensajes',
    label: 'Mensajería Privada 1:1',
    sector: 'Red Social',
    description: 'Conversaciones directas con audios Push-to-Talk, adjuntos y resguardo estricto de cuentas menores de edad.',
    keywords: 'mensajes chat privado ptt audio contactos',
    icon: MessageSquare,
  },
  {
    id: 'perfil',
    label: 'Mi Perfil, Fotos y Comunidad',
    sector: 'Red Social',
    description: 'Personalizá tu foto principal, subí hasta 6 fotos, compartí tu frase y explorá perfiles de toda la comunidad.',
    keywords: 'perfil fotos galeria frase comunidad compartir',
    icon: UserCheck,
  },

  // Sector 4 · Inteligencia Artificial
  {
    id: 'ia-panel',
    label: 'Centro Multi-IA',
    sector: 'Inteligencia Artificial',
    description: 'Orquestador central que integra servicios gratuitos y tus propias claves API (BYOK) en un solo lugar.',
    keywords: 'ia panel multi ia byok modelos',
    icon: Sparkles,
  },
  {
    id: 'fabro-ai',
    label: 'Chat FABRO IA Multimodelo',
    sector: 'Inteligencia Artificial',
    description: 'Asistente conversacional compatible con Gemini, OpenAI, Claude, DeepSeek y Qwen para análisis y síntesis.',
    keywords: 'chat ia gemini chatgpt claude deepseek qwen',
    icon: Sparkles,
  },
  {
    id: 'hub',
    label: 'FABRO HUB (Comparador IA)',
    sector: 'Inteligencia Artificial',
    description: 'Compará respuestas entre múltiples plataformas y organizá accesos directos a tus herramientas de IA favoritas.',
    keywords: 'hub comparador directorio herramientas ia',
    icon: Compass,
  },
  {
    id: 'ai-browser',
    label: 'AI Browser Paralelo',
    sector: 'Inteligencia Artificial',
    description: 'Navegación paralela de portales de inteligencia artificial para contrastar enfoques en tiempo real.',
    keywords: 'browser navegador paralelo portales ia',
    icon: Globe,
  },

  // Productividad
  {
    id: 'herramientas-panel',
    label: 'Panel de Herramientas Personales',
    sector: 'Productividad',
    description: 'Vista concentrada de utilidades diarias para cálculos, documentos PDF, diseño visual y agenda.',
    keywords: 'herramientas productividad panel utilidades',
    icon: Wrench,
  },
  {
    id: 'tools',
    label: 'FABRO Tools',
    sector: 'Productividad',
    description: 'Calculadora científica y estadística, conversor de unidades y monedas, generador QR y corrector de textos.',
    keywords: 'calculadora estadistica unidades monedas qr corrector',
    icon: Wrench,
  },
  {
    id: 'documents',
    label: 'FABRO Documents',
    sector: 'Productividad',
    description: 'Uní, dividí o comprimí archivos PDF, aplicá OCR sobre imágenes y convertí documentos fácilmente.',
    keywords: 'pdf unir dividir comprimir ocr documentos',
    icon: FileSpreadsheet,
  },
  {
    id: 'design',
    label: 'FABRO Design',
    sector: 'Productividad',
    description: 'Diseñá afiches, portadas, infografías, diagramas y mapas conceptuales visuales exportables.',
    keywords: 'diseno mapas conceptuales infografias diagramas portadas',
    icon: Palette,
  },
  {
    id: 'calendario',
    label: 'Calendario y Agenda',
    sector: 'Productividad',
    description: 'Planificá fechas importantes, entregas, rutinas y recordatorios sincronizados con tu cuenta.',
    keywords: 'calendario agenda eventos recordatorios',
    icon: Calendar,
  },

  // Sector 5 · Configuración y Connect
  {
    id: 'connect',
    label: 'FABRO Connect (Drive y BYOK)',
    sector: 'Configuración',
    description: 'Vinculá Google Drive para respaldos en la nube, configurá tus API keys personales y asigná modelos por sector.',
    keywords: 'google drive onedrive dropbox respaldos api keys byok',
    icon: KeyRound,
  },
  {
    id: 'configuracion',
    label: 'Configuración General y Plantillas',
    sector: 'Configuración',
    description: 'Cambiá entre las 7 plantillas visuales, modo claro/oscuro, accesibilidad, idioma y sincronización offline.',
    keywords: 'configuracion ajustes plantillas colores tema offline accesibilidad',
    icon: Settings,
  },
];

const TOOL_SECTOR_FILTERS: ToolSectorFilter[] = [
  'Todas',
  'Estudio',
  'Bienestar y Salud',
  'Red Social',
  'Inteligencia Artificial',
  'Productividad',
  'Configuración',
];

export const ControlCenterView: React.FC<ControlCenterViewProps> = ({
  favoriteIds,
  recentIds,
  onNavigate,
}) => {
  const {
    user,
    profile,
    subjects,
    notes,
    libraryDocs,
    studySessions,
    calendarEvents,
    isOnline,
    precacheState,
    setActiveSection,
    setSelectedSubjectId,
    setAiDraftPrompt,
    updateStudentProfile,
    uploadProfilePhoto,
    removeGalleryPhoto,
  } = useFabro();

  const navigate = onNavigate || setActiveSection;

  const [storedFavs, setStoredFavs] = useState<NavSectionId[]>([
    'estudio-panel',
    'bienestar-panel',
    'social-panel',
    'ia-panel',
    'connect',
  ]);
  const [storedRecents, setStoredRecents] = useState<NavSectionId[]>([]);

  useEffect(() => {
    const syncLocal = () => {
      try {
        const favKey = user?.uid ? `fabro_nav_favorites_${user.uid}` : 'fabro_nav_favorites_anon';
        const recKey = user?.uid ? `fabro_nav_recents_${user.uid}` : 'fabro_nav_recents_anon';
        const rawFav = localStorage.getItem(favKey);
        const rawRec = localStorage.getItem(recKey);
        if (rawFav) setStoredFavs(JSON.parse(rawFav) as NavSectionId[]);
        if (rawRec) setStoredRecents(JSON.parse(rawRec) as NavSectionId[]);
      } catch {
        // ignore storage errors
      }
    };
    syncLocal();
    window.addEventListener('fabro:nav-prefs-updated', syncLocal);
    return () => window.removeEventListener('fabro:nav-prefs-updated', syncLocal);
  }, [user?.uid]);

  const effectiveFavoriteIds = favoriteIds ?? storedFavs;
  const effectiveRecentIds = recentIds ?? storedRecents;

  const toggleFavoritePanel = (id: NavSectionId) => {
    const current = effectiveFavoriteIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [id, ...current].slice(0, 12);
    setStoredFavs(next);
    try {
      const favKey = user?.uid ? `fabro_nav_favorites_${user.uid}` : 'fabro_nav_favorites_anon';
      localStorage.setItem(favKey, JSON.stringify(next));
      window.dispatchEvent(new Event('fabro:nav-prefs-updated'));
    } catch {
      // ignore storage errors
    }
  };

  const {
    groups,
    directThreads,
    onlinePeers,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
  } = usePlatform();

  const { freemiumStatus, personalConnections } = useAIGateway();
  const { habits } = useHabitTimer();
  const { dreams, writings, reflections } = useLastDay();

  // Global search & quick AI
  const [query, setQuery] = useState('');
  const [quickAiPrompt, setQuickAiPrompt] = useState('');
  const [toolsSectorFilter, setToolsSectorFilter] = useState<ToolSectorFilter>('Todas');
  const [editingFavorites, setEditingFavorites] = useState(false);

  // Unified Home Profile Creator & Quick Share State
  const profileNeedsOnboarding = Boolean(
    profile &&
      !profile.sharedPhrase?.trim() &&
      !profile.bio?.trim() &&
      (!profile.galleryPhotos || profile.galleryPhotos.length === 0)
  );
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [hasDismissedSetup, setHasDismissedSetup] = useState(false);

  const [pName, setPName] = useState(profile?.displayName || user?.displayName || '');
  const [pUsername, setPUsername] = useState(profile?.username || '');
  const [pFabroId, setPFabroId] = useState(profile?.customFabroId || '');
  const [pCity, setPCity] = useState(profile?.city || '');
  const [pCountry, setPCountry] = useState(profile?.country || '');
  const [pPhrase, setPPhrase] = useState(profile?.sharedPhrase || '');
  const [pFavBooks, setPFavBooks] = useState(profile?.favoriteBooks || '');
  const [pFavMovies, setPFavMovies] = useState(profile?.favoriteMovies || '');
  const [pFavMusic, setPFavMusic] = useState(profile?.favoriteMusic || '');
  const [pBio, setPBio] = useState(profile?.bio || '');
  const [pInterests, setPInterests] = useState((profile?.interests || []).join(', '));
  const [savingHomeProfile, setSavingHomeProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [copiedFabroId, setCopiedFabroId] = useState(false);
  const [homeProfileFeedback, setHomeProfileFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const homeAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const homeGalleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setPName(profile.displayName || user?.displayName || '');
    setPUsername(profile.username || '');
    setPFabroId(profile.customFabroId || '');
    setPCity(profile.city || '');
    setPCountry(profile.country || '');
    setPPhrase(profile.sharedPhrase || '');
    setPFavBooks(profile.favoriteBooks || '');
    setPFavMovies(profile.favoriteMovies || '');
    setPFavMusic(profile.favoriteMusic || '');
    setPBio(profile.bio || '');
    setPInterests((profile.interests || []).join(', '));
  }, [profile, user?.displayName]);

  const showProfileForm = profileEditorOpen || (profileNeedsOnboarding && !hasDismissedSetup);

  const displayName = profile?.displayName || user?.displayName || 'Usuario FABRO';
  const myFabroId = useMemo(
    () => computeFabroId(user?.uid, profile?.customFabroId),
    [user?.uid, profile?.customFabroId]
  );
  const autoFabroId = useMemo(() => computeFabroId(user?.uid), [user?.uid]);
  const driveStatus = useMemo(() => getDriveConnectionStatus(), []);
  const connectedPersonalAi = useMemo(
    () => personalConnections.filter((c) => c.status === 'connected').length,
    [personalConnections]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  }, []);

  const todayReflection = useMemo(() => {
    const today = getLocalDateKey();
    return reflections.find((r) => r.dateKey === today) || reflections[0];
  }, [reflections]);

  const totalStudyHours = useMemo(() => {
    const mins = studySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    return (mins / 60).toFixed(1);
  }, [studySessions]);

  const unreadDmCount = useMemo(
    () => (user && !profile?.isMinor ? directThreads.filter((t) => t.unreadBy.includes(user.uid)).length : 0),
    [directThreads, user, profile?.isMinor]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const tools = ALL_TOOLS_CATALOG.filter((item) =>
      `${item.label} ${item.sector} ${item.description} ${item.keywords}`.toLowerCase().includes(q)
    ).slice(0, 6);

    const matchedSubjects = subjects
      .filter((s) => `${s.name} ${s.career || ''} ${s.professor || ''}`.toLowerCase().includes(q))
      .slice(0, 4);

    const matchedNotes = notes
      .filter((n) => `${n.title} ${n.contentText || ''}`.toLowerCase().includes(q))
      .slice(0, 4);

    const matchedDocs = libraryDocs
      .filter((d) => `${d.title} ${(d.tags || []).join(' ')}`.toLowerCase().includes(q))
      .slice(0, 4);

    return { tools, matchedSubjects, matchedNotes, matchedDocs };
  }, [query, subjects, notes, libraryDocs]);

  const favoriteItems = useMemo(
    () =>
      effectiveFavoriteIds
        .map((id) => ALL_TOOLS_CATALOG.find((d) => d.id === id))
        .filter((d): d is ToolCatalogItem => Boolean(d)),
    [effectiveFavoriteIds]
  );

  const filteredToolsCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_TOOLS_CATALOG.filter((tool) => {
      if (toolsSectorFilter !== 'Todas' && tool.sector !== toolsSectorFilter) return false;
      if (q) {
        return `${tool.label} ${tool.sector} ${tool.description} ${tool.keywords}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [toolsSectorFilter, query]);

  const recentActivity = useMemo(() => {
    const rows: Array<{ id: string; title: string; meta: string; target: NavSectionId }> = [];
    for (const s of studySessions.slice(0, 3)) {
      rows.push({
        id: `ses_${s.id}`,
        title: s.topic || 'Sesión registrada',
        meta: `${s.durationMinutes} min · ${s.date}`,
        target: 'progreso',
      });
    }
    for (const n of notes.slice(0, 2)) {
      rows.push({
        id: `note_${n.id}`,
        title: n.title || 'Apunte sin título',
        meta: 'Cuaderno digital',
        target: 'apuntes',
      });
    }
    if (rows.length < 4 && writings[0]) {
      rows.push({
        id: `w_${writings[0].id}`,
        title: writings[0].title || 'Escrito personal',
        meta: 'El Último Día de Tu Vida',
        target: 'ultimo-dia',
      });
    }
    if (rows.length === 0) {
      for (const recId of effectiveRecentIds.filter((r) => r !== 'inicio').slice(0, 4)) {
        const found = ALL_TOOLS_CATALOG.find((d) => d.id === recId);
        if (found) {
          rows.push({ id: `rec_${recId}`, title: found.label, meta: found.sector, target: found.id });
        }
      }
    }
    return rows.slice(0, 4);
  }, [studySessions, notes, writings, effectiveRecentIds]);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return calendarEvents
      .filter((e) => !e.completed && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [calendarEvents]);

  const handleLaunchQuickAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAiPrompt.trim()) {
      navigate('ia-panel');
      return;
    }
    setAiDraftPrompt(quickAiPrompt.trim());
    setQuickAiPrompt('');
    setActiveSection('fabro-ai');
  };

  const handleHomeAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    setHomeProfileFeedback(null);
    try {
      await uploadProfilePhoto(file, 'avatar');
      setHomeProfileFeedback({ type: 'ok', text: 'Foto principal actualizada en toda la plataforma.' });
    } catch (err) {
      setHomeProfileFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo subir la foto.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleHomeGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploadingGallery(true);
    setHomeProfileFeedback(null);
    try {
      const currentLen = (profile?.galleryPhotos || []).length;
      const slots = Math.max(1, 6 - currentLen);
      for (const file of files.slice(0, slots)) {
        await uploadProfilePhoto(file, 'gallery');
      }
      setHomeProfileFeedback({ type: 'ok', text: 'Fotos agregadas a tu perfil.' });
    } catch (err) {
      setHomeProfileFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudieron subir las fotos.',
      });
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleSaveHomeProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHomeProfile(true);
    setHomeProfileFeedback(null);
    try {
      const interests = pInterests
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await updateStudentProfile({
        displayName: pName.trim() || displayName,
        username: pUsername.trim(),
        customFabroId: pFabroId.trim(),
        city: pCity.trim(),
        country: pCountry.trim(),
        sharedPhrase: pPhrase.trim(),
        favoriteBooks: pFavBooks.trim(),
        favoriteMovies: pFavMovies.trim(),
        favoriteMusic: pFavMusic.trim(),
        bio: pBio.trim(),
        interests,
        isStudent: false,
        isInstructor: false,
      });
      setProfileEditorOpen(false);
      setHasDismissedSetup(true);
      setHomeProfileFeedback({ type: 'ok', text: 'Perfil global guardado para toda la aplicación.' });
    } catch (err) {
      setHomeProfileFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar el perfil.',
      });
    } finally {
      setSavingHomeProfile(false);
    }
  };

  const handleSaveQuickPhrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHomeProfile(true);
    setHomeProfileFeedback(null);
    try {
      await updateStudentProfile({
        displayName: pName.trim() || displayName,
        sharedPhrase: pPhrase.trim(),
        isStudent: false,
        isInstructor: false,
      });
      setHomeProfileFeedback({ type: 'ok', text: 'Frase del día actualizada en tu perfil.' });
    } catch (err) {
      setHomeProfileFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo actualizar la frase.',
      });
    } finally {
      setSavingHomeProfile(false);
    }
  };

  const handleCopyMyFabroId = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(myFabroId).then(() => {
      setCopiedFabroId(true);
      window.setTimeout(() => setCopiedFabroId(false), 1800);
    });
  };

  const galleryPhotos = profile?.galleryPhotos || [];
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <input
        ref={homeAvatarInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleHomeAvatarUpload(e)}
        className="hidden"
      />
      <input
        ref={homeGalleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void handleHomeGalleryUpload(e)}
        className="hidden"
      />

      {/* 1. Executive Welcome + Global Command Bar */}
      <section className="rounded-2xl border fabro-shell-surface fabro-hero-ambient p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] fabro-gold-accent capitalize">
              {todayLabel} · FABRO 2.0
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#FAF6EE] [text-wrap:balance]">
              {greeting}, {displayName.split(' ')[0]}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Centro de control unificado. Creá tu perfil global con fotos y frases, fijá tus paneles favoritos y explorá todas las herramientas de FABRO.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('configuracion')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 fabro-shell-surface-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-amber-500/50 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isOnline ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span>
                {isOnline ? 'En línea' : 'Offline'} ·{' '}
                <span className="font-mono tabular-nums">{precacheState.cachedNotesCount}</span> notas en caché
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('connect')}
              className="inline-flex items-center gap-1.5 rounded-xl border fabro-gold-border bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-[#F7D97E] hover:bg-amber-500/15 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span>
                Connect {driveStatus.connected ? '· Drive OK' : `· ${connectedPersonalAi} IA`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('perfil')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 fabro-shell-surface-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-violet-500/50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Comunidad · {myFabroId}</span>
            </button>
          </div>
        </div>

        {/* Unified Global Search + Quick FABRO IA Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
          <div className="lg:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar herramienta, sector, materia, apunte o documento..."
              aria-label="Buscador general de FABRO"
              className="w-full rounded-xl border border-slate-200 dark:border-violet-500/25 bg-white/90 dark:bg-[#070B17]/80 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-[#FAF6EE] placeholder:text-slate-400 focus:outline-none focus:border-violet-500"
            />
          </div>

          <form onSubmit={handleLaunchQuickAI} className="lg:col-span-6 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={quickAiPrompt}
                onChange={(e) => setQuickAiPrompt(e.target.value)}
                placeholder="Preguntarle o pedir un resumen a FABRO IA..."
                aria-label="Acceso rápido a FABRO IA"
                className="w-full rounded-xl border border-slate-200 dark:border-amber-500/30 bg-white/90 dark:bg-[#070B17]/80 pl-10 pr-3 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-[#FAF6EE] placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Abrir IA
            </button>
          </form>
        </div>

        {/* Live Universal Search Results Drawer */}
        {searchResults && (
          <div className="rounded-xl border border-violet-500/30 bg-white/95 dark:bg-[#070B17]/95 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Resultados para «{query.trim()}»
              </span>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                Limpiar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {searchResults.tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(t.id)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-left text-xs hover:border-violet-500/50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{t.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.sector}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                </button>
              ))}
              {searchResults.matchedSubjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(s.id);
                    navigate('materias');
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-left text-xs hover:border-sky-500/50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-[11px] text-sky-600 dark:text-sky-400">Materia</p>
                  </div>
                  <BookOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                </button>
              ))}
              {searchResults.matchedNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => navigate('apuntes')}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-left text-xs hover:border-sky-500/50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Apunte</p>
                  </div>
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              ))}
              {searchResults.matchedDocs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => navigate('biblioteca')}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-left text-xs hover:border-sky-500/50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{d.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Biblioteca</p>
                  </div>
                  <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
            {searchResults.tools.length === 0 &&
              searchResults.matchedSubjects.length === 0 &&
              searchResults.matchedNotes.length === 0 &&
              searchResults.matchedDocs.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No se encontraron módulos ni registros personales con ese término.
                </p>
              )}
          </div>
        )}
      </section>

      {/* 2. Creación y Showcase de Perfil Global en Inicio */}
      <section
        className="rounded-2xl border fabro-gold-border fabro-shell-surface p-5 sm:p-6 space-y-5"
        aria-label="Tu perfil para toda la aplicación"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => homeAvatarInputRef.current?.click()}
              className="relative w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/15 shrink-0 cursor-pointer group"
              title="Subir o cambiar foto principal de perfil"
            >
              {profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-violet-600 text-white text-lg font-bold flex items-center justify-center">
                  {initials}
                </div>
              )}
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-5 h-5" />
              </span>
            </button>

            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] fabro-gold-accent">
                Perfil Global FABRO · {myFabroId}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-[#FAF6EE] truncate">
                  {displayName}
                </h3>
                <button
                  type="button"
                  onClick={handleCopyMyFabroId}
                  title="Copiar mi FABRO ID único"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-amber-500 cursor-pointer"
                >
                  {copiedFabroId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copiedFabroId ? 'ID copiado' : 'Copiar ID'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {[
                  profile?.username ? `@${profile.username.replace(/^@/, '')}` : null,
                  profile?.city || profile?.country ? [profile?.city, profile?.country].filter(Boolean).join(', ') : null,
                  `${galleryPhotos.length}/6 fotos`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {profile?.sharedPhrase && (
                <p className="text-xs italic text-amber-800 dark:text-[#F5D77F] pt-0.5 line-clamp-2">
                  «{profile.sharedPhrase}»
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => homeAvatarInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/15 fabro-shell-surface-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-violet-500/50 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingAvatar ? 'Subiendo...' : 'Subir foto principal'}
            </button>
            <button
              type="button"
              disabled={uploadingGallery || galleryPhotos.length >= 6}
              onClick={() => homeGalleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/15 fabro-shell-surface-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-amber-500/50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {uploadingGallery ? 'Subiendo...' : `+ Agregar fotos (${galleryPhotos.length}/6)`}
            </button>
            <button
              type="button"
              onClick={() => {
                if (showProfileForm) {
                  setProfileEditorOpen(false);
                  setHasDismissedSetup(true);
                } else {
                  setProfileEditorOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {showProfileForm ? 'Ocultar editor' : 'Editar perfil'}
            </button>
          </div>
        </div>

        {homeProfileFeedback && (
          <div
            className={`rounded-xl border px-3.5 py-2 text-xs ${
              homeProfileFeedback.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {homeProfileFeedback.text}
          </div>
        )}

        {/* Quick View / Inline Share when collapsed */}
        {!showProfileForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <form onSubmit={(e) => void handleSaveQuickPhrase(e)} className="lg:col-span-7 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  <Quote className="w-3.5 h-3.5 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={400}
                    value={pPhrase}
                    onChange={(e) => setPPhrase(e.target.value)}
                    placeholder="Compartí tu frase del día, pensamiento o lema personal..."
                    aria-label="Frase del día"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/25 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-[#FAF6EE]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingHomeProfile}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-800 dark:text-[#F5D77F] hover:bg-amber-500/20 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {savingHomeProfile ? 'Guardando...' : 'Publicar frase del día'}
                </button>
              </form>

              <div className="lg:col-span-5 flex items-center justify-between lg:justify-end gap-2">
                {galleryPhotos.length > 0 ? (
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {galleryPhotos.map((url, idx) => (
                      <div key={`home_thumb_${idx}`} className="relative group shrink-0">
                        <img
                          src={url}
                          alt={`Foto ${idx + 1}`}
                          onClick={() => setLightboxUrl(url)}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-white/15 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Subí hasta 6 fotos para mostrar en tu perfil
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate('perfil')}
                  className="text-xs font-semibold text-violet-600 dark:text-violet-300 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  Ver comunidad →
                </button>
              </div>
            </div>

            {/* Espacio Personal · Gustos (Libros, Películas, Música) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/70 dark:border-white/10 text-xs">
              <div className="rounded-xl border border-slate-200/80 dark:border-white/10 fabro-shell-surface-2 px-3.5 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  Libros favoritos
                </p>
                <p className="text-slate-700 dark:text-slate-200 mt-1 line-clamp-2">
                  {profile?.favoriteBooks || 'Sin libros cargados todavía.'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-white/10 fabro-shell-surface-2 px-3.5 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
                  <Film className="w-3.5 h-3.5" />
                  Películas / Series
                </p>
                <p className="text-slate-700 dark:text-slate-200 mt-1 line-clamp-2">
                  {profile?.favoriteMovies || 'Sin películas cargadas todavía.'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-white/10 fabro-shell-surface-2 px-3.5 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-[#E5B842]">
                  <Music className="w-3.5 h-3.5" />
                  Música favorita
                </p>
                <p className="text-slate-700 dark:text-slate-200 mt-1 line-clamp-2">
                  {profile?.favoriteMusic || 'Sin música cargada todavía.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Full Profile Creation / Editing Drawer right at Home */}
        {showProfileForm && (
          <form onSubmit={(e) => void handleSaveHomeProfile(e)} className="space-y-4 pt-2 border-t border-slate-200/70 dark:border-white/10 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Nombre visible *</span>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Nombre de usuario</span>
                <input
                  type="text"
                  value={pUsername}
                  onChange={(e) => setPUsername(e.target.value)}
                  placeholder="tu_usuario"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  FABRO ID único
                </span>
                <input
                  type="text"
                  maxLength={32}
                  value={pFabroId}
                  onChange={(e) => setPFabroId(e.target.value.toUpperCase())}
                  placeholder={autoFabroId}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 font-mono uppercase text-slate-900 dark:text-[#FAF6EE]"
                />
                <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                  Dejá vacío para automático ({autoFabroId}).
                </span>
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Ciudad</span>
                <input
                  type="text"
                  value={pCity}
                  onChange={(e) => setPCity(e.target.value)}
                  placeholder="Tu ciudad"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">País</span>
                <input
                  type="text"
                  value={pCountry}
                  onChange={(e) => setPCountry(e.target.value)}
                  placeholder="Tu país"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Frase del día
                </span>
                <input
                  type="text"
                  maxLength={400}
                  value={pPhrase}
                  onChange={(e) => setPPhrase(e.target.value)}
                  placeholder="Escribí una frase del día, lema o pensamiento para compartir..."
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Intereses generales (separados por coma)
                </span>
                <input
                  type="text"
                  value={pInterests}
                  onChange={(e) => setPInterests(e.target.value)}
                  placeholder="Fotografía, Deportes, Arte, Tecnología..."
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                Espacio personal · Tus gustos (Libros, Películas, Música)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                    Libros favoritos
                  </span>
                  <input
                    type="text"
                    maxLength={300}
                    value={pFavBooks}
                    onChange={(e) => setPFavBooks(e.target.value)}
                    placeholder="Ej: Rayuela, El Principito, Sapiens..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <Film className="w-3.5 h-3.5 text-violet-500" />
                    Películas / Series favoritas
                  </span>
                  <input
                    type="text"
                    maxLength={300}
                    value={pFavMovies}
                    onChange={(e) => setPFavMovies(e.target.value)}
                    placeholder="Ej: Interstellar, El Secreto de sus Ojos..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <Music className="w-3.5 h-3.5 text-amber-500" />
                    Música / Artistas favoritos
                  </span>
                  <input
                    type="text"
                    maxLength={300}
                    value={pFavMusic}
                    onChange={(e) => setPFavMusic(e.target.value)}
                    placeholder="Ej: Soda Stereo, Jazz, Lo-Fi, Mozart..."
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                  />
                </label>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Sobre vos / lo que quieras compartir libremente
              </span>
              <textarea
                rows={2}
                value={pBio}
                onChange={(e) => setPBio(e.target.value)}
                placeholder="Contá lo que quieras: tus gustos, ideas, proyectos o lo que deseás compartir en FABRO..."
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
              />
            </label>

            {galleryPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {galleryPhotos.map((url, idx) => (
                  <div key={`edit_thumb_${idx}`} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-white/15">
                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      onClick={() => setLightboxUrl(url)}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => void removeGalleryPhoto(url)}
                      aria-label={`Quitar foto ${idx + 1}`}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('perfil')}
                className="text-xs font-semibold text-violet-600 dark:text-violet-300 hover:underline cursor-pointer"
              >
                Configurar privacidad y ver perfiles de la comunidad →
              </button>
              <button
                type="submit"
                disabled={savingHomeProfile}
                className="rounded-xl bg-violet-600 px-5 py-2 font-semibold text-white hover:bg-violet-700 cursor-pointer whitespace-nowrap"
              >
                {savingHomeProfile ? 'Guardando...' : 'Guardar perfil en toda la app'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 3. Paneles Favoritos (Prominent Quick-Launch + Customizer) */}
      <section className="rounded-2xl border fabro-shell-surface p-5 sm:p-6 space-y-4" aria-label="Tus paneles favoritos">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-[#FAF6EE]">
                Paneles Favoritos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accesos directos fijados para entrar con un clic desde el inicio o el menú lateral.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingFavorites((v) => !v)}
            className="rounded-xl border border-slate-200 dark:border-white/15 fabro-shell-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-amber-500/50 cursor-pointer whitespace-nowrap"
          >
            {editingFavorites ? 'Listo' : 'Personalizar favoritos'}
          </button>
        </div>

        {favoriteItems.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            Todavía no fijaste paneles favoritos. Tocá «Personalizar favoritos» o la estrella de cualquier herramienta debajo.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {favoriteItems.map((fav) => {
              const Icon = fav.icon;
              return (
                <div
                  key={fav.id}
                  className="rounded-xl border border-slate-200/80 dark:border-white/10 fabro-shell-surface-2 p-3.5 flex flex-col justify-between gap-2.5 hover:border-amber-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(fav.id)}
                      className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-violet-500 dark:text-[#E5B842] shrink-0" />
                      <span className="text-xs font-bold text-slate-900 dark:text-[#FAF6EE] truncate">
                        {fav.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavoritePanel(fav.id)}
                      aria-label={`Quitar ${fav.label} de favoritos`}
                      className="text-amber-500 hover:opacity-75 cursor-pointer shrink-0"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {fav.description}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400">{fav.sector}</span>
                    <button
                      type="button"
                      onClick={() => navigate(fav.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-[#E5B842] hover:underline cursor-pointer"
                    >
                      Abrir <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {editingFavorites && (
          <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Seleccioná hasta 12 paneles o herramientas para tus favoritos:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TOOLS_CATALOG.map((tool) => {
                const isFav = effectiveFavoriteIds.includes(tool.id);
                return (
                  <button
                    key={`pick_${tool.id}`}
                    type="button"
                    onClick={() => toggleFavoritePanel(tool.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                      isFav
                        ? 'border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-[#F5D77F]'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-violet-500/40'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${isFav ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                    {tool.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 4. The Five Core Sectors */}
      <section className="space-y-3" aria-label="Los cinco sectores de FABRO">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Ecosistema FABRO · Cinco Sectores
          </h3>
          <button
            type="button"
            onClick={() => navigate('herramientas-panel')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-300 hover:underline cursor-pointer whitespace-nowrap"
          >
            <Wrench className="w-3.5 h-3.5" />
            Herramientas de productividad
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
          {/* Sector 1: Estudio */}
          <article className="xl:col-span-6 rounded-2xl border border-sky-500/25 fabro-shell-surface p-5 sm:p-6 flex flex-col justify-between gap-4 hover:border-sky-400/60 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Sector 01 · Estudio
                </span>
                <div className="w-9 h-9 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h4 className="font-display text-xl font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Estudio e Investigación
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Materias, apuntes exportables a PDF, biblioteca, investigación con fuentes reales y simulacros de examen.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 pt-1">
                <span>{subjects.length} materias</span>
                <span>{notes.length} apuntes</span>
                <span>{libraryDocs.length} docs</span>
                <span>{totalStudyHours}h registradas</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => navigate('estudio-panel')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Entrar a Estudio
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('apuntes')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                Apuntes
              </button>
              <button
                type="button"
                onClick={() => navigate('research')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                Investigación
              </button>
            </div>
          </article>

          {/* Sector 2: Bienestar y Salud */}
          <article className="xl:col-span-6 rounded-2xl border fabro-gold-border fabro-shell-surface p-5 sm:p-6 flex flex-col justify-between gap-4 hover:border-amber-400/70 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider fabro-gold-accent">
                  Sector 02 · Bienestar y Salud
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/12 text-amber-600 dark:text-[#E5B842] flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h4 className="font-display text-xl font-bold text-slate-900 dark:text-[#FAF6EE]">
                  El Último Día de Tu Vida y Salud Integral
                </h4>
                <p className="text-xs italic text-amber-700 dark:text-[#F5D77F] mt-0.5">
                  «Si hoy fuera tu último día, ¿cómo elegirías vivirlo?»
                </p>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Reflexión estoica, diario y legado privado, rutinas, contador de calorías, ejercicios con video, horóscopos y suerte.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 pt-1">
                <span>Felicidad {todayReflection?.happinessScore ?? '—'}/10</span>
                <span>{dreams.length} sueños</span>
                <span>{habits.length} rutinas</span>
                <span>{writings.length} escritos</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => navigate('bienestar-panel')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 dark:bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-white dark:text-[#070B17] hover:bg-amber-700 dark:hover:bg-[#E5B842] transition-colors cursor-pointer whitespace-nowrap"
              >
                Entrar a Bienestar
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('ultimo-dia')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                El Último Día
              </button>
              <button
                type="button"
                onClick={() => navigate('calorias')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                Calorías
              </button>
              <button
                type="button"
                onClick={() => navigate('ejercicios')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                Ejercicios
              </button>
            </div>
          </article>

          {/* Sector 3: Red Social */}
          <article className="xl:col-span-4 rounded-2xl border border-emerald-500/25 fabro-shell-surface p-5 flex flex-col justify-between gap-4 hover:border-emerald-400/60 transition-colors">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Sector 03 · Red Social
                </span>
                <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 dark:text-[#FAF6EE]">
                Red Social FABRO
              </h4>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Perfiles abiertos con fotos y frases compartidas, FABRO ID estilo globo, chats 1:1, grupos y audios Push-to-Talk.
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {onlinePeers.length} en línea · {groups.length} grupos · {unreadDmCount} chats sin leer
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => navigate('social-panel')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Abrir Red Social
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('perfil')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                Perfiles
              </button>
            </div>
          </article>

          {/* Sector 4: Inteligencia Artificial */}
          <article className="xl:col-span-4 rounded-2xl border border-violet-500/30 fabro-shell-surface p-5 flex flex-col justify-between gap-4 hover:border-violet-400/70 transition-colors">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                  Sector 04 · Inteligencia Artificial
                </span>
                <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 dark:text-[#FAF6EE]">
                Centro Multi-IA y BYOK
              </h4>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                OpenAI, Gemini, Claude, DeepSeek, Qwen y comparador paralelo con asignación de modelo por cada sector.
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Cuota hoy: {freemiumStatus ? `${freemiumStatus.usedToday}/${freemiumStatus.dailyLimit}` : '0/5'} · {connectedPersonalAi} API propias
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => navigate('ia-panel')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Centro Multi-IA
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('hub')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                Comparador
              </button>
            </div>
          </article>

          {/* Sector 5: Configuración */}
          <article className="xl:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 fabro-shell-surface p-5 flex flex-col justify-between gap-4 hover:border-amber-400/50 transition-colors">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Sector 05 · Configuración
                </span>
                <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 dark:text-[#FAF6EE]">
                Ajustes y FABRO Connect
              </h4>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Google Drive, respaldos, claves API, 7 plantillas de color, seguridad de cuenta y almacenamiento offline en IndexedDB.
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Drive: {driveStatus.connected ? 'Conectado' : 'Listo para vincular'} · {precacheState.cachedLibraryDocsCount} docs offline
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => navigate('connect')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-[#FAF6EE] px-3.5 py-2 text-xs font-semibold text-white dark:text-[#070B17] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
              >
                FABRO Connect
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('configuracion')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer whitespace-nowrap"
              >
                Configuración
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* 5. Guía y Descripción Completa de Todas las Herramientas */}
      <section className="rounded-2xl border fabro-shell-surface p-5 sm:p-6 space-y-4" aria-label="Descripción de todas las herramientas de FABRO">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-[#FAF6EE]">
              Descripción de Todas las Herramientas ({filteredToolsCatalog.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conocé qué hace cada herramienta del ecosistema, fijala en tus favoritos o abrila al instante.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOOL_SECTOR_FILTERS.map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => setToolsSectorFilter(sector)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  toolsSectorFilter === sector
                    ? 'fabro-accent-pill'
                    : 'border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-violet-500/40'
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredToolsCatalog.map((tool) => {
            const Icon = tool.icon;
            const isFav = effectiveFavoriteIds.includes(tool.id);
            return (
              <article
                key={`cat_${tool.id}`}
                className="rounded-xl border border-slate-200/80 dark:border-white/10 fabro-shell-surface-2 p-4 flex flex-col justify-between gap-3 hover:border-violet-500/40 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 text-violet-500 dark:text-[#E5B842] shrink-0" />
                      <h4 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE] truncate">
                        {tool.label}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFavoritePanel(tool.id)}
                      aria-label={isFav ? `Quitar ${tool.label} de favoritos` : `Agregar ${tool.label} a favoritos`}
                      className="text-slate-400 hover:text-amber-500 cursor-pointer shrink-0"
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {tool.sector}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(tool.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-[#E5B842] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Abrir herramienta <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 6. Recent Activity & Notifications / Schedule Strip */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Actividad reciente y agenda">
        <div className="rounded-2xl border fabro-shell-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-500" />
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                Actividad reciente
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('progreso')}
              className="text-[11px] font-medium text-violet-600 dark:text-violet-300 hover:underline cursor-pointer"
            >
              Ver progreso
            </button>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
              Tus últimas actividades, apuntes y reflexiones aparecerán aquí.
            </p>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
              {recentActivity.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.target)}
                  className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:text-violet-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {item.title}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                    {item.meta}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border fabro-shell-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                Notificaciones y agenda
              </h3>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-amber-600 dark:text-[#E5B842]">
              {unreadNotificationsCount} nuevas
            </span>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {notifications.slice(0, 2).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  void markNotificationRead(n.id);
                  navigate(n.linkSection || 'inicio');
                }}
                className="w-full py-2 text-left cursor-pointer hover:opacity-80"
              >
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{n.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{n.body}</p>
              </button>
            ))}
            {upcomingEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => navigate('calendario')}
                className="w-full py-2 flex items-center justify-between gap-2 text-left cursor-pointer hover:text-amber-500"
              >
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 truncate">
                  <Calendar className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span className="truncate">{ev.title}</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                  {ev.date}
                </span>
              </button>
            ))}
            {notifications.length === 0 && upcomingEvents.length === 0 && (
              <div className="py-3 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Sin alertas ni eventos pendientes hoy.</span>
                <button
                  type="button"
                  onClick={() => navigate('calendario')}
                  className="text-violet-600 dark:text-violet-300 font-medium hover:underline cursor-pointer whitespace-nowrap"
                >
                  Abrir agenda
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quiet Architecture Footer Note */}
      <section className="rounded-xl border border-slate-200/70 dark:border-slate-800/80 fabro-shell-surface-2 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            FABRO integra educación, bienestar personal, red social e inteligencia artificial en una arquitectura unificada.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums">
            <Users className="w-3.5 h-3.5 text-violet-400" />
            {onlinePeers.length} activos
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            Offline-First
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Zero-Trust
          </span>
        </div>
      </section>

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
