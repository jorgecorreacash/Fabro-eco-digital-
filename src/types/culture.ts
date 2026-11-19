export type CultureNavId =
  | 'inicio'
  | 'muro-cultural'
  | 'artes-visuales'
  | 'musica'
  | 'literatura'
  | 'cine-audiovisual'
  | 'teatro'
  | 'danza'
  | 'fotografia'
  | 'historia-patrimonio'
  | 'museos-exposiciones'
  | 'bibliotecas-archivos'
  | 'artesanias-oficios'
  | 'gastronomia'
  | 'folclore-tradiciones'
  | 'turismo-cultural'
  | 'filosofia-pensamiento'
  | 'ciencia-divulgacion'
  | 'cultura-indigena'
  | 'cultura-urbana'
  | 'videojuegos'
  | 'cultura-ambiental'
  | 'cultura-ciudadana'
  | 'genealogia-memoria'
  | 'coleccionismo'
  | 'festivales-celebraciones'
  | 'perfil-cultural'
  | 'comunidades-culturales'
  | 'academia-cultural'
  | 'biblioteca-digital';

export type CultureDisciplineId = Exclude<
  CultureNavId,
  | 'inicio'
  | 'muro-cultural'
  | 'perfil-cultural'
  | 'comunidades-culturales'
  | 'academia-cultural'
  | 'biblioteca-digital'
>;

export type CultureStudioKind =
  | 'visual-arts'
  | 'photography'
  | 'music'
  | 'literature'
  | 'cinema'
  | 'theater'
  | 'dance'
  | 'history'
  | 'genealogy'
  | 'crafts'
  | 'gastronomy'
  | 'philosophy-science'
  | 'museums'
  | 'archives'
  | 'folklore'
  | 'tourism'
  | 'indigenous'
  | 'urban'
  | 'videogames'
  | 'environment'
  | 'citizenship'
  | 'collecting'
  | 'festivals';

export interface CultureDisciplineMeta {
  id: CultureDisciplineId;
  order: number;
  label: string;
  shortLabel: string;
  category:
    | 'Artes y Expresión'
    | 'Escena y Audiovisual'
    | 'Memoria y Patrimonio'
    | 'Saberes y Sociedad'
    | 'Cultura Viva';
  tagline: string;
  accentColor: string;
  studioKind: CultureStudioKind;
  tools: string[];
}

export interface CulturalWorkItem {
  id: string;
  title: string;
  discipline: string;
  year: string;
  medium: string;
  description: string;
  imageDataUrl?: string;
}

export interface CulturalProjectItem {
  id: string;
  title: string;
  discipline: string;
  status: 'Idea' | 'En curso' | 'Finalizado';
  summary: string;
  updatedAt: string;
}

export interface CulturalExhibitionItem {
  id: string;
  title: string;
  venue: string;
  date: string;
  curatorialNote: string;
  workIds: string[];
}

export interface CulturalProfileData {
  artisticName?: string;
  culturalBio?: string;
  culturalDisciplines?: string[];
  specialties?: string[];
  portfolioUrl?: string;
  works?: CulturalWorkItem[];
  courses?: string[];
  projects?: CulturalProjectItem[];
  exhibitions?: CulturalExhibitionItem[];
}

export interface CultureCommunityItem {
  id: string;
  name: string;
  roleGroup: string;
  disciplineId: CultureDisciplineId;
  description: string;
  membersCount: number;
  joined: boolean;
  posts: Array<{
    id: string;
    author: string;
    text: string;
    createdAt: string;
  }>;
}

export interface CultureCourseModule {
  id: string;
  title: string;
  durationLabel: string;
  summary: string;
  videoUrl?: string;
  materialText?: string;
  activityPrompt?: string;
}

export interface CultureCourseQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface CultureCourseItem {
  id: string;
  title: string;
  disciplineId: CultureDisciplineId;
  instructor: string;
  level: 'Inicial' | 'Intermedio' | 'Avanzado';
  description: string;
  enrolled: boolean;
  enrolledStudents: string[];
  completedModuleIds: string[];
  modules: CultureCourseModule[];
  quiz: CultureCourseQuizQuestion[];
  quizPassed?: boolean;
  certificateIssuedAt?: string;
  certificateCode?: string;
}

export type DigitalLibraryCategory =
  | 'Libros'
  | 'Documentos'
  | 'Fotografías'
  | 'Partituras'
  | 'Archivos históricos'
  | 'Recursos educativos'
  | 'Dominio público';

export interface CultureLibraryEntry {
  id: string;
  title: string;
  author: string;
  year: string;
  category: DigitalLibraryCategory;
  disciplineId: CultureDisciplineId;
  license: string;
  summary: string;
  externalUrl?: string;
  collectionName: string;
  favorite: boolean;
}

export interface CultureEventItem {
  id: string;
  title: string;
  disciplineId: CultureDisciplineId;
  dateLabel: string;
  location: string;
  modality: 'Presencial' | 'Virtual' | 'Híbrido';
  description: string;
  attending: boolean;
}

export interface CultureGalleryArtwork {
  id: string;
  title: string;
  disciplineId: CultureDisciplineId;
  medium: string;
  album: string;
  year: string;
  notes: string;
  imageDataUrl: string;
  createdAt: string;
}

export interface CultureSongEntry {
  id: string;
  title: string;
  artist: string;
  keySignature: string;
  bpm: number;
  chordsAndLyrics: string;
  status: 'Idea' | 'Ensayando' | 'Lista';
}

export interface CultureBookManuscript {
  id: string;
  title: string;
  genre: string;
  synopsis: string;
  chapters: Array<{ id: string; title: string; content: string }>;
  updatedAt: string;
}

export interface CultureReadingLogItem {
  id: string;
  title: string;
  author: string;
  status: 'Por leer' | 'Leyendo' | 'Terminado';
  rating: number;
  notes: string;
}

export interface CultureTimelineItem {
  id: string;
  year: string;
  title: string;
  region: string;
  category: string;
  description: string;
}

export interface CultureFamilyMember {
  id: string;
  name: string;
  relation: string;
  generation: 1 | 2 | 3 | 4;
  birthYear: string;
  place: string;
  notes: string;
}

export interface CultureRecipeItem {
  id: string;
  title: string;
  region: string;
  baseServings: number;
  prepMinutes: number;
  ingredients: Array<{ name: string; amount: number; unit: string }>;
  steps: string;
}

export interface CultureDisciplineRecord {
  id: string;
  disciplineId: CultureDisciplineId;
  toolKey: string;
  title: string;
  subtitle?: string;
  meta?: string;
  body: string;
  date?: string;
  status?: string;
  createdAt: string;
}

export interface CultureStateSnapshot {
  gallery: CultureGalleryArtwork[];
  exhibitions: CulturalExhibitionItem[];
  songs: CultureSongEntry[];
  manuscripts: CultureBookManuscript[];
  readingList: CultureReadingLogItem[];
  timeline: CultureTimelineItem[];
  familyTree: CultureFamilyMember[];
  recipes: CultureRecipeItem[];
  communities: CultureCommunityItem[];
  courses: CultureCourseItem[];
  library: CultureLibraryEntry[];
  events: CultureEventItem[];
  records: CultureDisciplineRecord[];
}
