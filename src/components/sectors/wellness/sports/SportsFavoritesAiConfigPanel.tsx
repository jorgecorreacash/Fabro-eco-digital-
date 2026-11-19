import React, { useState } from 'react';
import {
  Bell,
  Bot,
  CloudOff,
  Globe,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import {
  COMMON_TIMEZONES,
  SPORTS_LEAGUES_FALLBACK,
} from '../../../../data/sportsCatalog';
import { sendByokChatCompletion } from '../../../../services/byokChatClient';
import { findByokKeyForWellnessEngine } from '../../../../services/wellnessAiService';
import {
  buildLocalSportAiReply,
  formatInTimeZone,
} from '../../../../services/sportsService';
import type {
  SportLeagueCatalogItem,
  SportMatchItem,
  SportNewsArticle,
  SportSourceStatus,
  SportsNavId,
  SportsUserState,
} from '../../../../types/sports';

interface SportsFavoritesAiConfigPanelProps {
  section: 'mis-favoritos' | 'fabro-sport-ai' | 'configuracion-deportes';
  sportsState: SportsUserState;
  leagues: SportLeagueCatalogItem[];
  matches: SportMatchItem[];
  news: SportNewsArticle[];
  sources: SportSourceStatus[];
  lastUpdatedAt: string | null;
  onRefreshAll: () => Promise<void>;
  onNavigateSports: (id: SportsNavId) => void;
  onUpdateSportsState: (updater: (prev: SportsUserState) => SportsUserState) => void;
}

export const SportsFavoritesAiConfigPanel: React.FC<SportsFavoritesAiConfigPanelProps> = ({
  section,
  sportsState,
  leagues,
  matches,
  news,
  sources,
  lastUpdatedAt,
  onRefreshAll,
  onNavigateSports,
  onUpdateSportsState,
}) => {
  const { byokKeys, getByokSecret, wellnessAiEngine, navigateTo } = useEcosystem();
  const tz = sportsState.timeZone || 'America/Argentina/Buenos_Aires';
  const activeLeagues = leagues.length > 0 ? leagues : SPORTS_LEAGUES_FALLBACK;

  const [newTeamFav, setNewTeamFav] = useState('');
  const [newAthFav, setNewAthFav] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // =========================================================================
  // 16. MIS FAVORITOS — MI DEPORTE
  // =========================================================================
  if (section === 'mis-favoritos') {
    const favMatches = matches.filter((m) => {
      const leagueMatch = sportsState.favoriteLeagues.includes(m.leagueId);
      const teamMatch = sportsState.favoriteTeams.some(
        (t) =>
          m.homeTeam.name.toLowerCase().includes(t.toLowerCase()) ||
          m.awayTeam.name.toLowerCase().includes(t.toLowerCase())
      );
      return leagueMatch || teamMatch;
    });

    const favNews = news.filter((n) => {
      const hay = `${n.title} ${n.summary} ${n.category}`.toLowerCase();
      const teamHit = sportsState.favoriteTeams.some((t) => hay.includes(t.toLowerCase()));
      const athHit = sportsState.favoriteAthletes.some((a) => hay.includes(a.toLowerCase()));
      return teamHit || athHit;
    });

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            16 · MI DEPORTE · Portada personalizada
          </p>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            Tus equipos, ligas, deportistas y noticias guardadas
          </h2>
          <p className="fabro-muted">
            Horarios mostrados automáticamente en {tz}. Todo se guarda localmente en IndexedDB.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Manage Favorites */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold">Equipos favoritos ({sportsState.favoriteTeams.length})</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTeamFav}
                onChange={(e) => setNewTeamFav(e.target.value)}
                placeholder="Ej. Boca Juniors, River Plate, Selección Argentina..."
                className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  const v = newTeamFav.trim();
                  if (!v || sportsState.favoriteTeams.includes(v)) return;
                  onUpdateSportsState((prev) => ({
                    ...prev,
                    favoriteTeams: [v, ...prev.favoriteTeams],
                  }));
                  setNewTeamFav('');
                }}
                className="min-h-[36px] rounded-xl bg-[#0284C7] text-white px-3.5 font-semibold cursor-pointer"
              >
                Seguir
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sportsState.favoriteTeams.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    onUpdateSportsState((prev) => ({
                      ...prev,
                      favoriteTeams: prev.favoriteTeams.filter((x) => x !== t),
                    }))
                  }
                  className="rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 hover:border-rose-500 cursor-pointer"
                >
                  {t} ×
                </button>
              ))}
            </div>

            <div className="pt-3 border-t fabro-border space-y-2">
              <h4 className="font-semibold">Deportistas favoritos ({sportsState.favoriteAthletes.length})</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAthFav}
                  onChange={(e) => setNewAthFav(e.target.value)}
                  placeholder="Ej. Lionel Messi, Franco Colapinto, Francisco Cerúndolo..."
                  className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = newAthFav.trim();
                    if (!v || sportsState.favoriteAthletes.includes(v)) return;
                    onUpdateSportsState((prev) => ({
                      ...prev,
                      favoriteAthletes: [v, ...prev.favoriteAthletes],
                    }));
                    setNewAthFav('');
                  }}
                  className="min-h-[36px] rounded-xl bg-[#059669] text-white px-3.5 font-semibold cursor-pointer"
                >
                  Seguir
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sportsState.favoriteAthletes.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() =>
                      onUpdateSportsState((prev) => ({
                        ...prev,
                        favoriteAthletes: prev.favoriteAthletes.filter((x) => x !== a),
                      }))
                    }
                    className="rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 hover:border-rose-500 cursor-pointer"
                  >
                    {a} ×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Personalized Fixtures */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Partidos de tus ligas y equipos ({favMatches.length})</h3>
              <button
                type="button"
                onClick={() => onNavigateSports('calendario')}
                className="font-semibold text-[#0284C7] hover:underline cursor-pointer"
              >
                Calendario →
              </button>
            </div>
            {favMatches.length === 0 ? (
              <p className="fabro-muted">
                No hay encuentros cargados para tus equipos/ligas favoritos en esta ventana.
              </p>
            ) : (
              <div className="divide-y fabro-border max-h-72 overflow-y-auto">
                {favMatches.slice(0, 12).map((m) => (
                  <div key={`${m.leagueId}-${m.id}`} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {m.homeTeam.name} vs {m.awayTeam.name}
                      </p>
                      <p className="text-[11px] fabro-muted">
                        {m.leagueName} · {m.statusLabel}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] shrink-0">
                      {m.statusCode === 'programado'
                        ? formatInTimeZone(m.startDateIso, tz, 'datetime')
                        : `${m.homeTeam.score ?? '-'}–${m.awayTeam.score ?? '-'}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Personalized & Saved News */}
        <section className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
          <h3 className="text-sm font-bold">
            Noticias de tus favoritos ({favNews.length}) y guardadas ({sportsState.savedNewsArticles.length})
          </h3>
          {favNews.length === 0 && sportsState.savedNewsArticles.length === 0 ? (
            <p className="fabro-muted">
              Cuando sigas equipos o guardes notas desde «11. Noticias», aparecerán reunidas acá.
            </p>
          ) : (
            <div className="divide-y fabro-border">
              {Array.from(
                new Map(
                  [...sportsState.savedNewsArticles, ...favNews].map((item) => [item.url, item])
                ).values()
              )
                .slice(0, 10)
                .map((n, idx) => (
                  <a
                    key={`${n.id}-${n.url}-${idx}`}
                    href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 flex items-center justify-between gap-2 hover:text-[#0284C7]"
                >
                  <span className="font-medium truncate">{n.title}</span>
                  <span className="font-mono text-[10px] fabro-muted shrink-0">
                    {n.sourceName} · {formatInTimeZone(n.publishedAt, tz, 'date')}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // =========================================================================
  // 17. FABRO SPORT AI
  // =========================================================================
  if (section === 'fabro-sport-ai') {
    const handleAskSportAi = async (customQ?: string) => {
      const q = (customQ ?? aiInput).trim();
      if (!q) return;
      const nowTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      onUpdateSportsState((prev) => ({
        ...prev,
        sportAiMessages: [
          ...prev.sportAiMessages,
          { id: `sai-u-${Date.now()}`, role: 'user', text: q, createdAt: nowTime },
        ],
      }));
      if (!customQ) setAiInput('');

      const foundByok = findByokKeyForWellnessEngine(byokKeys, getByokSecret, wellnessAiEngine);
      if (foundByok) {
        setAiLoading(true);
        const matchContext = matches
          .slice(0, 25)
          .map(
            (m) =>
              `[${m.leagueName}] ${m.homeTeam.name} vs ${m.awayTeam.name} | ${formatInTimeZone(
                m.startDateIso,
                tz,
                'datetime'
              )} (${tz}) | ${m.statusLabel} ${m.homeTeam.score ?? ''}-${m.awayTeam.score ?? ''}`
          )
          .join('\n');
        const newsContext = news
          .slice(0, 15)
          .map((n) => `- ${n.title} (${n.sourceName}, ${n.publishedAt})${n.isRumor ? ' [RUMOR]' : ''}`)
          .join('\n');

        const res = await sendByokChatCompletion({
          keyMeta: foundByok.keyMeta,
          rawApiKey: foundByok.secret,
          history: [],
          userText: `Consulta del usuario: "${q}"
Zona horaria del usuario: ${tz}

DATOS REALES CARGADOS DE FUENTE PÚBLICA (ESPN Public Sports JSON · actualización periódica):
${matchContext || 'Sin partidos cargados actualmente.'}

TITULARES REALES DE MEDIOS (RSS públicos):
${newsContext || 'Sin titulares cargados actualmente.'}

Reglas estrictas:
1. NO inventes horarios, resultados, lesiones ni goleadores que no figuren en los datos provistos.
2. Si el dato no figura, decilo honestamente e indicá en qué pestaña de FABRO DEPORTES consultarlo.
3. Diferenciá explícitamente: [Datos de fuente deportiva], [Medios periodísticos], [Análisis IA] y [Estimación].`,
          systemInstructionOverride:
            'Sos FABRO SPORT AI, asistente deportivo veraz y riguroso. Nunca inventás resultados ni horarios.',
        });
        setAiLoading(false);
        if (res.ok && res.content.trim()) {
          onUpdateSportsState((prev) => ({
            ...prev,
            sportAiMessages: [
              ...prev.sportAiMessages,
              {
                id: `sai-a-${Date.now()}`,
                role: 'ai',
                text: res.content.trim(),
                sourceLabel: `BYOK · ${foundByok.keyMeta.providerName} + fuentes reales`,
                createdAt: nowTime,
              },
            ],
          }));
          return;
        }
      }

      const reply = buildLocalSportAiReply({
        question: q,
        matches,
        news,
        timeZone: tz,
        lastSyncAt: lastUpdatedAt || undefined,
      });
      onUpdateSportsState((prev) => ({
        ...prev,
        sportAiMessages: [
          ...prev.sportAiMessages,
          {
            id: `sai-a-${Date.now()}`,
            role: 'ai',
            text: reply,
            sourceLabel: 'Motor deportivo local sobre datos reales ($0)',
            createdAt: nowTime,
          },
        ],
      }));
    };

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4338CA]">
              17 · FABRO SPORT AI
            </p>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#4338CA]" />
              Consultas deportivas sobre fuentes verificadas (sin inventar datos)
            </h2>
            <p className="fabro-muted mt-0.5">
              Distingue siempre datos de fuentes deportivas, medios RSS, estimaciones y análisis. Funciona gratis en modo local o con tu clave propia BYOK.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              '¿Qué partidos se juegan hoy?',
              '¿A qué hora juega Boca?',
              '¿Cuándo juega River?',
              '¿Cuándo juega la Selección Argentina?',
              '¿Qué partidos hay en Champions?',
              '¿Cómo calcular mi ritmo de carrera?',
              '¿Qué rutina usar para mejorar mi resistencia?',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void handleAskSportAi(q)}
                className="rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1.5 hover:border-[#4338CA] cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {sportsState.sportAiMessages.length === 0 ? (
              <div className="rounded-xl border border-dashed fabro-border p-6 text-center fabro-muted">
                Tocá una pregunta sugerida arriba o escribí tu consulta sobre partidos, equipos, noticias o entrenamiento.
              </div>
            ) : (
              sportsState.sportAiMessages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-3.5 space-y-1 ${
                    m.role === 'user'
                      ? 'border-[#4338CA]/35 bg-[#4338CA]/5 ml-6'
                      : 'fabro-border fabro-surface-elevated mr-6'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono fabro-muted">
                    <span className="font-semibold uppercase">
                      {m.role === 'user' ? 'Tu consulta' : 'FABRO SPORT AI'}
                    </span>
                    <span>
                      {m.sourceLabel ? `${m.sourceLabel} · ` : ''}
                      {m.createdAt}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAskSportAi();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Preguntá por partidos, horarios, noticias o entrenamientos..."
              className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#4338CA] text-white px-4 font-semibold cursor-pointer disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Consultar
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border fabro-muted">
            <button
              type="button"
              onClick={() => navigateTo('ia', 'claves-byok')}
              className="inline-flex items-center gap-1.5 font-semibold text-[#4338CA] hover:underline cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Conectar clave propia en IA BYOK (opcional)
            </button>
            {sportsState.sportAiMessages.length > 0 && (
              <button
                type="button"
                onClick={() => onUpdateSportsState((prev) => ({ ...prev, sportAiMessages: [] }))}
                className="inline-flex items-center gap-1 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpiar chat
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // 18. CONFIGURACIÓN, ZONA HORARIA, ALERTAS Y REGISTRO DE FUENTES ($0)
  // =========================================================================
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  return (
    <div className="space-y-5 text-xs">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#475569] dark:text-slate-300">
          18 · Configuración, zona horaria y fuentes verificables
        </p>
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Control de fuentes $0, alertas deduplicadas y modo sin conexión
        </h2>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Timezone & Alerts */}
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0284C7]" />
            Zona horaria de calendarios y resultados
          </h3>
          <select
            value={sportsState.timeZone}
            onChange={(e) =>
              onUpdateSportsState((prev) => ({ ...prev, timeZone: e.target.value }))
            }
            className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          >
            {COMMON_TIMEZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>

          <div className="pt-3 border-t fabro-border space-y-2">
            <h4 className="font-semibold flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[#059669]" />
              Preferencias de alertas (sin duplicados)
            </h4>
            {(
              [
                ['matchStart', 'Inicio de partidos recordados'],
                ['scheduleChanges', 'Cambios de horario detectados'],
                ['finalScores', 'Resultados finales de favoritos'],
                ['goalsAndKeyEvents', 'Goles / incidencias (solo si la fuente lo soporta)'],
                ['breakingNews', 'Noticias destacadas de equipos seguidos'],
                ['favoriteTournaments', 'Inicio de torneos favoritos'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sportsState.alertPrefs[k]}
                  onChange={() =>
                    onUpdateSportsState((prev) => ({
                      ...prev,
                      alertPrefs: { ...prev.alertPrefs, [k]: !prev.alertPrefs[k] },
                    }))
                  }
                  className="accent-[#0284C7]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Offline & $0 Audit */}
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-[#059669]" />
            ) : (
              <CloudOff className="w-4 h-4 text-amber-600" />
            )}
            Disponibilidad sin conexión y regla de $0 costo
          </h3>
          <p className="font-semibold text-[#059669]">Funciona 100% sin internet:</p>
          <p className="fabro-muted">
            FABRO SPORT TOOLS (cronómetro, vueltas, calculadoras de pace/velocidad/zonas FC/grasa/IMC/MET/descansos), programas de Running/Ciclismo/Natación/Equipo, marcas personales, espacio de Entrenadores, favoritos y último caché descargado de partidos y noticias.
          </p>
          <p className="font-semibold text-amber-700 dark:text-amber-400">Requiere internet:</p>
          <p className="fabro-muted">
            Refresco periódico de calendarios, resultados, tablas de posiciones, feeds RSS de noticias y fichas de TheSportsDB.
          </p>
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-3 flex items-start gap-2 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Verificación económica: 0 APIs deportivas comerciales pagas, 0 Firebase Blaze, 0 servicios con facturación. {activeLeagues.length} competiciones configurables en modo $0.
            </span>
          </div>
        </div>
      </div>

      {/* Live Configurable Source Registry */}
      <section className="rounded-2xl border fabro-border fabro-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b fabro-border flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Registro configurable de fuentes deportivas</h3>
            <p className="text-[11px] fabro-muted">
              Estado real de disponibilidad, frecuencia permitida, última consulta y condiciones de uso.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onRefreshAll()}
            className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border fabro-border px-3 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Probar fuentes
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b fabro-border fabro-muted font-mono">
                <th className="py-2.5 px-3">Fuente</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Acceso</th>
                <th className="py-2.5 px-3">Caché</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Última consulta</th>
              </tr>
            </thead>
            <tbody className="divide-y fabro-border">
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-[10px] fabro-muted">{s.termsNote}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono">{s.type}</td>
                  <td className="py-2.5 px-3">{s.accessMethod}</td>
                  <td className="py-2.5 px-3 font-mono">{s.refreshSeconds}s</td>
                  <td className="py-2.5 px-3 font-mono">
                    <span
                      className={
                        s.status === 'ok'
                          ? 'text-[#059669] font-bold'
                          : s.status === 'degradado'
                          ? 'text-amber-600 font-bold'
                          : 'fabro-muted'
                      }
                    >
                      {s.status}
                    </span>
                    {s.lastError && <p className="text-[10px] text-rose-600">{s.lastError}</p>}
                  </td>
                  <td className="py-2.5 px-3 font-mono fabro-muted">
                    {s.lastCheckedAt ? formatInTimeZone(s.lastCheckedAt, tz, 'datetime') : 'Sin consulta aún'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
