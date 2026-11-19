export type AdminRole =
  | 'superadministrador'
  | 'administrador_general'
  | 'moderador_general'
  | 'moderador_cultural'
  | 'administrador_academico'
  | 'organizador'
  | 'usuario';

export type StaffRole = Exclude<AdminRole, 'usuario'>;

export type AdminPermission =
  | 'consultar_usuarios'
  | 'editar_info_autorizada'
  | 'revisar_denuncias'
  | 'ocultar_publicaciones'
  | 'eliminar_publicaciones'
  | 'advertir_usuarios'
  | 'suspender_usuarios'
  | 'reactivar_usuarios'
  | 'crear_sectores'
  | 'editar_sectores'
  | 'desactivar_sectores'
  | 'gestionar_eventos'
  | 'gestionar_cursos'
  | 'nombrar_moderadores'
  | 'asignar_roles'
  | 'consultar_estadisticas'
  | 'consultar_auditorias'
  | 'modificar_configuraciones';

export type AdminNavSectionId =
  | 'dashboard'
  | 'usuarios'
  | 'denuncias'
  | 'roles_permisos'
  | 'administradores_moderadores'
  | 'solicitudes_sectores'
  | 'ideas_propuestas'
  | 'sectores_modulos'
  | 'publicaciones'
  | 'eventos_actividades'
  | 'estadisticas'
  | 'auditoria'
  | 'seguridad'
  | 'configuracion';

export type UserRestrictionFlag =
  | 'no_publicar'
  | 'no_comentar'
  | 'no_mensajes'
  | 'no_cultura'
  | 'no_eventos';

export type UserAccountStatus =
  | 'activo'
  | 'advertido'
  | 'restringido'
  | 'suspendido'
  | 'desactivado'
  | 'eliminado';

export type ReportTargetType =
  | 'usuario'
  | 'publicacion'
  | 'comentario'
  | 'contenido_cultural'
  | 'perfil'
  | 'mensaje'
  | 'curso'
  | 'grupo'
  | 'biblioteca';

export type ReportReasonId =
  | 'acoso'
  | 'amenazas'
  | 'insultos'
  | 'discriminacion'
  | 'suplantacion_identidad'
  | 'spam'
  | 'estafas'
  | 'contenido_inapropiado'
  | 'publicaciones_enganosas'
  | 'otros';

export type ReportStatus =
  | 'pendiente'
  | 'en_revision'
  | 'requiere_informacion'
  | 'resuelta'
  | 'desestimada'
  | 'derivada_admin';

export type SanctionType =
  | 'advertencia'
  | 'restriccion'
  | 'suspension_temporal'
  | 'suspension'
  | 'desactivacion'
  | 'eliminacion_datos'
  | 'revocacion_docente'
  | 'reactivacion';

export type SanctionStatus =
  | 'activa'
  | 'pendiente_apelacion'
  | 'apelacion_aceptada'
  | 'apelacion_rechazada'
  | 'levantada';

export type AppealStatus =
  | 'sin_apelacion'
  | 'pendiente'
  | 'en_revision'
  | 'aceptada'
  | 'rechazada';

export type SectorRequestStatus =
  | 'pendiente'
  | 'en_evaluacion'
  | 'requiere_modificaciones'
  | 'aprobada'
  | 'rechazada'
  | 'en_desarrollo'
  | 'publicada';

export type IdeaCategoryId =
  | 'nuevas_herramientas'
  | 'nuevos_sectores'
  | 'diseno'
  | 'rendimiento'
  | 'seguridad'
  | 'comunidad'
  | 'educacion'
  | 'cultura'
  | 'inteligencia_artificial'
  | 'comunicacion'
  | 'otras';

export type IdeaStatus =
  | 'recibida'
  | 'en_evaluacion'
  | 'aprobada'
  | 'rechazada'
  | 'en_desarrollo'
  | 'implementada';

export type PlatformEventStatus =
  | 'borrador'
  | 'publicado'
  | 'cancelado'
  | 'finalizado';

export interface AdminStaffRecord {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  customPermissions: AdminPermission[];
  allowedSectors: string[];
  active: boolean;
  assignedByUid: string;
  assignedByEmail: string;
  notes?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
}

export interface UserRestrictionRecord {
  uid: string;
  displayName?: string;
  email?: string;
  accountStatus: UserAccountStatus;
  restrictions: UserRestrictionFlag[];
  reason: string;
  expiresAtIso?: string;
  warningsCount: number;
  sanctionsCount: number;
  updatedByUid: string;
  updatedByEmail: string;
  updatedAtIso?: string;
}

export interface ModerationReportRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  targetAuthorUid?: string;
  targetAuthorName?: string;
  targetSummary: string;
  sector?: string;
  reason: string;
  details: string;
  evidenceNote?: string;
  status: ReportStatus;
  assignedModeratorUid?: string;
  assignedModeratorEmail?: string;
  resolutionAction?: string;
  resolutionNote: string;
  reviewedBy: string;
  createdAtIso?: string;
  updatedAtIso?: string;
}

export interface UserSanctionRecord {
  id: string;
  userId: string;
  userName: string;
  sanctionType: SanctionType;
  sector?: string;
  restrictions?: UserRestrictionFlag[];
  expiresAtIso?: string;
  reason: string;
  status: SanctionStatus;
  appealText: string;
  appealStatus?: AppealStatus;
  appealResolution?: string;
  appealReviewedBy?: string;
  issuedByUid?: string;
  issuedBy: string;
  createdAtIso?: string;
  updatedAtIso?: string;
}

export interface AdminAuditLogRecord {
  id: string;
  adminId: string;
  adminEmail: string;
  adminRole?: AdminRole;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  reason?: string;
  result?: 'ok' | 'denegado' | 'error';
  permissionUsed?: AdminPermission | string;
  sector?: string;
  details: string;
  createdAtIso?: string;
}

export interface SectorRequestRecord {
  id: string;
  name: string;
  description: string;
  objective: string;
  targetAudience: string;
  proposedTools: string;
  justification: string;
  requesterUid: string;
  requesterName: string;
  status: SectorRequestStatus;
  adminComment?: string;
  reviewedBy?: string;
  createdAtIso: string;
  updatedAtIso?: string;
}

export interface IdeaCommentItem {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  createdAtIso: string;
}

export interface IdeaProposalRecord {
  id: string;
  title: string;
  category: IdeaCategoryId;
  explanation: string;
  authorUid: string;
  authorName: string;
  status: IdeaStatus;
  voterUids: string[];
  votesCount: number;
  comments: IdeaCommentItem[];
  adminResponse?: string;
  adminResponderEmail?: string;
  createdAtIso: string;
  updatedAtIso?: string;
}

export interface PlatformSectorRecord {
  id: string;
  name: string;
  description: string;
  categories: string[];
  subcategories: string[];
  active: boolean;
  isCore: boolean;
  adminUids: string[];
  moderatorUids: string[];
  permissionsNote?: string;
  updatedByEmail?: string;
  updatedAtIso?: string;
}

export interface PlatformEventRecord {
  id: string;
  title: string;
  sector: string;
  category?: string;
  dateIso: string;
  location: string;
  description: string;
  status: PlatformEventStatus;
  organizerUid: string;
  organizerName: string;
  createdAtIso?: string;
  updatedAtIso?: string;
}

export interface AdminSettingsRecord {
  id: string;
  allowSectorRequests: boolean;
  allowIdeaVoting: boolean;
  requireModerationReason: boolean;
  localSpamSensitivity: 'baja' | 'media' | 'alta';
  zeroCostPolicyLocked: true;
  updatedByEmail?: string;
  updatedAtIso?: string;
}

export interface DirectoryUserRecord {
  uid: string;
  displayName: string;
  username: string;
  customFabroId?: string;
  photoURL?: string;
  bio?: string;
  country?: string;
  city?: string;
  isStudent?: boolean;
  isInstructor?: boolean;
  isMinor?: boolean;
  presenceStatus?: string;
  verificationStatus?: string;
  updatedAtIso?: string;
}

export interface ReportModalPayload {
  targetType: ReportTargetType;
  targetId: string;
  targetAuthorUid?: string;
  targetAuthorName?: string;
  targetSummary: string;
  sector?: string;
}

export const PRIMARY_SUPERADMIN_EMAIL = 'jorgecorreasp@gmail.com';

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'consultar_usuarios',
  'editar_info_autorizada',
  'revisar_denuncias',
  'ocultar_publicaciones',
  'eliminar_publicaciones',
  'advertir_usuarios',
  'suspender_usuarios',
  'reactivar_usuarios',
  'crear_sectores',
  'editar_sectores',
  'desactivar_sectores',
  'gestionar_eventos',
  'gestionar_cursos',
  'nombrar_moderadores',
  'asignar_roles',
  'consultar_estadisticas',
  'consultar_auditorias',
  'modificar_configuraciones',
];

export const SUPERADMIN_ONLY_PERMISSIONS: AdminPermission[] = [
  'asignar_roles',
  'modificar_configuraciones',
  'crear_sectores',
  'desactivar_sectores',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  superadministrador: [...ALL_ADMIN_PERMISSIONS],
  administrador_general: [
    'consultar_usuarios',
    'editar_info_autorizada',
    'revisar_denuncias',
    'ocultar_publicaciones',
    'eliminar_publicaciones',
    'advertir_usuarios',
    'suspender_usuarios',
    'reactivar_usuarios',
    'editar_sectores',
    'gestionar_eventos',
    'gestionar_cursos',
    'nombrar_moderadores',
    'consultar_estadisticas',
    'consultar_auditorias',
  ],
  moderador_general: [
    'consultar_usuarios',
    'revisar_denuncias',
    'ocultar_publicaciones',
    'eliminar_publicaciones',
    'advertir_usuarios',
    'consultar_estadisticas',
  ],
  moderador_cultural: [
    'revisar_denuncias',
    'ocultar_publicaciones',
    'eliminar_publicaciones',
    'advertir_usuarios',
    'gestionar_eventos',
  ],
  administrador_academico: [
    'consultar_usuarios',
    'gestionar_cursos',
    'gestionar_eventos',
    'editar_sectores',
    'consultar_estadisticas',
  ],
  organizador: [
    'gestionar_eventos',
    'consultar_estadisticas',
  ],
  usuario: [],
};

export const ROLE_META: Record<
  AdminRole,
  { label: string; shortLabel: string; rank: number; description: string; scopeNote: string }
> = {
  superadministrador: {
    label: 'Superadministrador',
    shortLabel: 'Superadmin',
    rank: 100,
    description: 'Control total de la plataforma, configuración general, seguridad, auditoría y gestión de roles.',
    scopeNote: 'Global (todos los sectores y permisos reservados)',
  },
  administrador_general: {
    label: 'Administrador general',
    shortLabel: 'Admin general',
    rank: 80,
    description: 'Supervisa usuarios, denuncias, sanciones, sectores, ideas y puede designar moderadores.',
    scopeNote: 'Global (sin modificar permisos exclusivos de Superadmin)',
  },
  moderador_general: {
    label: 'Moderador general',
    shortLabel: 'Mod. general',
    rank: 60,
    description: 'Revisa denuncias de la red social, oculta o elimina publicaciones y emite advertencias.',
    scopeNote: 'Moderación general (sin suspensión permanente ni gestión de roles)',
  },
  moderador_cultural: {
    label: 'Moderador cultural',
    shortLabel: 'Mod. cultural',
    rank: 50,
    description: 'Modera exclusivamente el sector FABRO Cultura, sus denuncias, publicaciones y actividades.',
    scopeNote: 'Restringido estrictamente al sector Cultura',
  },
  administrador_academico: {
    label: 'Administrador académico',
    shortLabel: 'Admin académico',
    rank: 55,
    description: 'Gestiona cursos, actividades formativas, eventos académicos y revisión sectorial educativa.',
    scopeNote: 'Sector Estudio y actividades académicas',
  },
  organizador: {
    label: 'Organizador',
    shortLabel: 'Organizador',
    rank: 40,
    description: 'Crea y administra eventos, encuentros y actividades comunitarias en la plataforma.',
    scopeNote: 'Eventos y actividades programadas',
  },
  usuario: {
    label: 'Usuario',
    shortLabel: 'Usuario',
    rank: 0,
    description: 'Cuenta estándar de FABRO sin acceso al panel administrativo.',
    scopeNote: 'Sin privilegios administrativos',
  },
};

export const PERMISSION_META: Record<AdminPermission, { label: string; group: string }> = {
  consultar_usuarios: { label: 'Consultar usuarios', group: 'Usuarios' },
  editar_info_autorizada: { label: 'Editar info autorizada', group: 'Usuarios' },
  revisar_denuncias: { label: 'Revisar denuncias', group: 'Moderación' },
  ocultar_publicaciones: { label: 'Ocultar publicaciones', group: 'Moderación' },
  eliminar_publicaciones: { label: 'Eliminar publicaciones', group: 'Moderación' },
  advertir_usuarios: { label: 'Advertir usuarios', group: 'Sanciones' },
  suspender_usuarios: { label: 'Suspender usuarios', group: 'Sanciones' },
  reactivar_usuarios: { label: 'Reactivar usuarios', group: 'Sanciones' },
  crear_sectores: { label: 'Crear sectores', group: 'Sectores' },
  editar_sectores: { label: 'Editar sectores y solicitudes', group: 'Sectores' },
  desactivar_sectores: { label: 'Activar / desactivar sectores', group: 'Sectores' },
  gestionar_eventos: { label: 'Gestionar eventos', group: 'Actividades' },
  gestionar_cursos: { label: 'Gestionar cursos', group: 'Actividades' },
  nombrar_moderadores: { label: 'Nombrar moderadores', group: 'Gobernanza' },
  asignar_roles: { label: 'Asignar roles y permisos', group: 'Gobernanza' },
  consultar_estadisticas: { label: 'Consultar estadísticas', group: 'Supervisión' },
  consultar_auditorias: { label: 'Consultar auditorías', group: 'Supervisión' },
  modificar_configuraciones: { label: 'Modificar configuraciones', group: 'Sistema' },
};

export const RESTRICTION_FLAGS_META: Record<UserRestrictionFlag, { label: string; description: string }> = {
  no_publicar: {
    label: 'Sin publicar en muros',
    description: 'Impide crear nuevas publicaciones en el Muro General y en FABRO Cultura.',
  },
  no_comentar: {
    label: 'Sin comentar',
    description: 'Bloquea la publicación de nuevos comentarios en los muros comunitarios.',
  },
  no_mensajes: {
    label: 'Sin enviar mensajes',
    description: 'Deshabilita el envío de mensajes en el chat comunitario.',
  },
  no_cultura: {
    label: 'Sin publicar en Cultura',
    description: 'Restringe publicaciones e interacciones públicas en FABRO Cultura.',
  },
  no_eventos: {
    label: 'Sin participar en eventos',
    description: 'Restringe la inscripción o gestión de actividades y eventos.',
  },
};

export const REPORT_REASONS: Array<{ id: ReportReasonId; label: string }> = [
  { id: 'acoso', label: 'Acoso' },
  { id: 'amenazas', label: 'Amenazas' },
  { id: 'insultos', label: 'Insultos' },
  { id: 'discriminacion', label: 'Discriminación' },
  { id: 'suplantacion_identidad', label: 'Suplantación de identidad' },
  { id: 'spam', label: 'Spam' },
  { id: 'estafas', label: 'Estafas' },
  { id: 'contenido_inapropiado', label: 'Contenido inapropiado' },
  { id: 'publicaciones_enganosas', label: 'Publicaciones engañosas' },
  { id: 'otros', label: 'Otros' },
];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  requiere_informacion: 'Requiere información',
  resuelta: 'Resuelta',
  desestimada: 'Desestimada',
  derivada_admin: 'Derivada a un administrador',
};

export const SECTOR_REQUEST_STATUS_LABELS: Record<SectorRequestStatus, string> = {
  pendiente: 'Pendiente',
  en_evaluacion: 'En evaluación',
  requiere_modificaciones: 'Requiere modificaciones',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  en_desarrollo: 'En desarrollo',
  publicada: 'Publicada',
};

export const IDEA_CATEGORIES: Array<{ id: IdeaCategoryId; label: string }> = [
  { id: 'nuevas_herramientas', label: 'Nuevas herramientas' },
  { id: 'nuevos_sectores', label: 'Nuevos sectores' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'rendimiento', label: 'Rendimiento' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'comunidad', label: 'Comunidad' },
  { id: 'educacion', label: 'Educación' },
  { id: 'cultura', label: 'Cultura' },
  { id: 'inteligencia_artificial', label: 'Inteligencia artificial' },
  { id: 'comunicacion', label: 'Comunicación' },
  { id: 'otras', label: 'Otras' },
];

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  recibida: 'Recibida',
  en_evaluacion: 'En evaluación',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  en_desarrollo: 'En desarrollo',
  implementada: 'Implementada',
};

export const ADMIN_NAV_SECTIONS: Array<{
  id: AdminNavSectionId;
  label: string;
  requiredPermissions: AdminPermission[];
}> = [
  { id: 'dashboard', label: 'Dashboard', requiredPermissions: [] },
  { id: 'usuarios', label: 'Usuarios', requiredPermissions: ['consultar_usuarios'] },
  { id: 'denuncias', label: 'Denuncias', requiredPermissions: ['revisar_denuncias'] },
  { id: 'roles_permisos', label: 'Roles y permisos', requiredPermissions: ['asignar_roles', 'nombrar_moderadores'] },
  { id: 'administradores_moderadores', label: 'Administradores y moderadores', requiredPermissions: ['nombrar_moderadores', 'asignar_roles'] },
  { id: 'solicitudes_sectores', label: 'Solicitudes de sectores', requiredPermissions: ['editar_sectores'] },
  { id: 'ideas_propuestas', label: 'Ideas y propuestas', requiredPermissions: ['editar_sectores', 'consultar_estadisticas'] },
  { id: 'sectores_modulos', label: 'Sectores y módulos', requiredPermissions: ['editar_sectores', 'crear_sectores', 'desactivar_sectores'] },
  { id: 'publicaciones', label: 'Publicaciones', requiredPermissions: ['ocultar_publicaciones', 'eliminar_publicaciones'] },
  { id: 'eventos_actividades', label: 'Eventos y actividades', requiredPermissions: ['gestionar_eventos', 'gestionar_cursos'] },
  { id: 'estadisticas', label: 'Estadísticas', requiredPermissions: ['consultar_estadisticas'] },
  { id: 'auditoria', label: 'Auditoría', requiredPermissions: ['consultar_auditorias'] },
  { id: 'seguridad', label: 'Seguridad', requiredPermissions: [] },
  { id: 'configuracion', label: 'Configuración', requiredPermissions: ['modificar_configuraciones'] },
];

export const CORE_FABRO_SECTORS_CATALOG: Omit<PlatformSectorRecord, 'updatedAtIso'>[] = [
  {
    id: 'estudio',
    name: 'FABRO Estudio',
    description: 'Hoja académica tipo Word, videoteca educativa, calendario pintable, apuntes, biblioteca y exámenes.',
    categories: ['Materias', 'Apuntes', 'Videoteca', 'Exámenes'],
    subcategories: ['Resúmenes', 'Mapas conceptuales', 'Flashcards', 'Investigación'],
    active: true,
    isCore: true,
    adminUids: [],
    moderatorUids: [],
    permissionsNote: 'Gestionado por Superadmin y Administrador académico.',
  },
  {
    id: 'bienestar',
    name: 'FABRO Bienestar',
    description: 'Organizador integral, nutrición, rutinas de ejercicio, videoteca saludable y reflexión emocional.',
    categories: ['Organizador', 'Salud Física', 'Bienestar Emocional', 'Muro Bienestar'],
    subcategories: ['Hábitos', 'Hidratación', 'Sueño', 'Estoicismo'],
    active: true,
    isCore: true,
    adminUids: [],
    moderatorUids: [],
    permissionsNote: 'Contenido comunitario moderado por Moderador general.',
  },
  {
    id: 'social',
    name: 'Red Social FABRO',
    description: 'Muro general, perfil social FABRO ID, mensajería, amistades, comunidades y descubrimiento.',
    categories: ['Muro General', 'Perfiles', 'Comunidades', 'Mensajería'],
    subcategories: ['Encuestas', 'Multimedia', 'Recursos compartidos'],
    active: true,
    isCore: true,
    adminUids: [],
    moderatorUids: [],
    permissionsNote: 'Moderación activa con reportes y control de spam.',
  },
  {
    id: 'cultura',
    name: 'FABRO Cultura',
    description: 'Espacio cultural con disciplinas artísticas, laboratorio literario, visual, musical y muro cultural.',
    categories: ['Literatura', 'Música', 'Artes Visuales', 'Cine y Teatro'],
    subcategories: ['Poesía', 'Narrativa', 'Crítica', 'Agenda cultural'],
    active: true,
    isCore: true,
    adminUids: [],
    moderatorUids: [],
    permissionsNote: 'Ámbito exclusivo de Moderador cultural y Administradores.',
  },
  {
    id: 'ia',
    name: 'FABRO AI (BYOK)',
    description: 'Asistente multi-proveedor Bring Your Own Key 100% gratuito sin APIs pagas precargadas.',
    categories: ['Claves BYOK', 'Asistente', 'Comparador', 'Análisis documental'],
    subcategories: ['Gemini', 'OpenAI', 'Anthropic', 'Local'],
    active: true,
    isCore: true,
    adminUids: [],
    moderatorUids: [],
    permissionsNote: 'Claves almacenadas únicamente en el dispositivo del usuario.',
  },
  {
    id: 'herramientas',
    name: 'Herramientas y Hoy',
    description: 'Centro de utilidades offline, calculadora, clima, agenda rápida y espacio Hoy y Cosmos.',
    categories: ['Utilidades', 'Hoy y Cosmos', 'Respaldos'],
    subcategories: ['Calculadora', 'Clima', 'Frases'],
    active: true,
    isCore: true,
    adminUids: [],
    moderatorUids: [],
    permissionsNote: 'Módulos locales gratuitos sin dependencia paga.',
  },
];

// ------------------------------------------------------------------
// Pure RBAC Helpers (mirrored server-side in firestore.rules)
// ------------------------------------------------------------------

export function computeEffectivePermissions(
  role: AdminRole,
  customPermissions?: AdminPermission[]
): AdminPermission[] {
  if (role === 'superadministrador') {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  if (role === 'usuario') {
    return [];
  }
  const base =
    Array.isArray(customPermissions) && customPermissions.length > 0
      ? customPermissions
      : DEFAULT_ROLE_PERMISSIONS[role] || [];
  // Enforce least privilege: non-superadmins never hold superadmin-only overrides unless explicitly allowed
  return Array.from(new Set(base)).filter((perm) => {
    if (role !== 'administrador_general' && perm === 'nombrar_moderadores') {
      return false;
    }
    return !SUPERADMIN_ONLY_PERMISSIONS.includes(perm);
  });
}

export function hasEffectivePermission(
  role: AdminRole,
  permissions: AdminPermission[],
  required: AdminPermission
): boolean {
  if (role === 'superadministrador') return true;
  if (role === 'usuario') return false;
  return permissions.includes(required);
}

export function canAccessAdminSection(
  role: AdminRole,
  permissions: AdminPermission[],
  sectionId: AdminNavSectionId
): boolean {
  if (role === 'usuario') return false;
  if (role === 'superadministrador') return true;
  const nav = ADMIN_NAV_SECTIONS.find((s) => s.id === sectionId);
  if (!nav) return false;
  if (nav.requiredPermissions.length === 0) return true;
  return nav.requiredPermissions.some((p) => permissions.includes(p));
}

export function canManageTargetRole(
  actorRole: AdminRole,
  actorUid: string,
  targetUid: string,
  currentTargetRole: AdminRole,
  nextTargetRole: StaffRole
): { allowed: boolean; reason?: string } {
  if (actorUid === targetUid) {
    return {
      allowed: false,
      reason: 'Ningún administrador o moderador puede modificar o elevar sus propios permisos.',
    };
  }
  if (actorRole === 'superadministrador') {
    return { allowed: true };
  }
  if (actorRole === 'administrador_general') {
    if (
      currentTargetRole === 'superadministrador' ||
      currentTargetRole === 'administrador_general'
    ) {
      return {
        allowed: false,
        reason: 'Solo un Superadministrador puede modificar cuentas de Superadministrador o Administrador general.',
      };
    }
    if (nextTargetRole === 'superadministrador' || nextTargetRole === 'administrador_general') {
      return {
        allowed: false,
        reason: 'El Administrador general solo puede designar moderadores, administradores académicos u organizadores.',
      };
    }
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Tu rol actual no tiene permisos para asignar ni modificar roles administrativos.',
  };
}

export function isCulturalPostLike(post: {
  communityId?: string;
  categoryTag?: string;
  spaces?: Array<'general' | 'cultura'>;
}): boolean {
  if (post.communityId === 'cultura-only' || post.communityId === 'cultura-both') return true;
  if (typeof post.categoryTag === 'string' && post.categoryTag.startsWith('cultura:')) return true;
  if (Array.isArray(post.spaces) && post.spaces.includes('cultura')) return true;
  return false;
}

export function canModeratePostInScope(
  role: AdminRole,
  permissions: AdminPermission[],
  post: { communityId?: string; categoryTag?: string; spaces?: Array<'general' | 'cultura'> },
  action: 'hide' | 'delete'
): boolean {
  const perm: AdminPermission = action === 'hide' ? 'ocultar_publicaciones' : 'eliminar_publicaciones';
  if (!hasEffectivePermission(role, permissions, perm)) return false;
  if (role === 'moderador_cultural') {
    return isCulturalPostLike(post);
  }
  return true;
}

// ------------------------------------------------------------------
// Zero-Cost Local Spam / Repetitive Content Detector
// ------------------------------------------------------------------
export interface LocalSpamAnalysis {
  score: number; // 0..100
  level: 'limpio' | 'sospechoso' | 'alto_riesgo';
  reasons: string[];
}

export function analyzeLocalSpamRisk(
  text: string,
  allRecentTexts: string[] = [],
  sensitivity: 'baja' | 'media' | 'alta' = 'media'
): LocalSpamAnalysis {
  const clean = (text || '').trim();
  if (!clean) return { score: 0, level: 'limpio', reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  const urls = clean.match(/https?:\/\/[^\s]+/gi) || [];
  if (urls.length >= 2) {
    score += 35;
    reasons.push(`Múltiples enlaces externos (${urls.length})`);
  } else if (urls.length === 1 && clean.length < 70) {
    score += 20;
    reasons.push('Mensaje breve centrado en enlace externo');
  }

  const letters = clean.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '');
  const upperLetters = clean.replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
  if (letters.length >= 20 && upperLetters.length / letters.length > 0.72) {
    score += 25;
    reasons.push('Uso excesivo de mayúsculas');
  }

  if (/(.)\1{6,}/.test(clean)) {
    score += 20;
    reasons.push('Repetición artificial de caracteres');
  }

  const spamKeywords = /\b(gana dinero|cripto gratis|transferencia inmediata|dobla tu dinero|click aqui|whatsapp \+\d|telegram @)\b/i;
  if (spamKeywords.test(clean)) {
    score += 40;
    reasons.push('Patrón compatible con estafa o promoción masiva');
  }

  const normalized = clean.toLowerCase().replace(/\s+/g, ' ');
  const duplicates = allRecentTexts.filter(
    (other) => other.trim().toLowerCase().replace(/\s+/g, ' ') === normalized
  ).length;
  if (duplicates >= 2) {
    score += 35;
    reasons.push(`Texto repetido ${duplicates} veces en el muro`);
  }

  const thresholdHigh = sensitivity === 'alta' ? 45 : sensitivity === 'baja' ? 75 : 60;
  const thresholdWarn = sensitivity === 'alta' ? 20 : sensitivity === 'baja' ? 40 : 30;

  const clamped = Math.min(100, score);
  const level: LocalSpamAnalysis['level'] =
    clamped >= thresholdHigh ? 'alto_riesgo' : clamped >= thresholdWarn ? 'sospechoso' : 'limpio';

  return { score: clamped, level, reasons };
}
