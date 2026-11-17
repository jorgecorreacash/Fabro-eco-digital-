import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  DollarSign,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { authFetch } from '../../lib/apiClient';
import type { FreemiumAdminDashboard, FreemiumSystemLimits } from '../../types/fabro';

export const FreemiumAdminControlPanel: React.FC = () => {
  const [dashboard, setDashboard] = useState<FreemiumAdminDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const [chartMode, setChartMode] = useState<'queries' | 'cost'>('queries');
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'free' | 'premium' | 'at_limit'>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [customCreditsByUid, setCustomCreditsByUid] = useState<Record<string, string>>({});
  const [limitsDraft, setLimitsDraft] = useState<FreemiumSystemLimits | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await authFetch('/api/freemium/admin/dashboard');
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo cargar el panel de control de IA y costos.');
      }
      setDashboard(data as FreemiumAdminDashboard);
      setLimitsDraft((data as FreemiumAdminDashboard).systemLimits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar métricas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const handleSetUserPlan = async (uid: string, nextPlan: 'free' | 'premium') => {
    setBusyUid(uid);
    setError('');
    try {
      const resp = await authFetch(`/api/freemium/admin/users/${encodeURIComponent(uid)}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: nextPlan,
          reason: nextPlan === 'premium' ? 'Activado desde FABRO Admin' : 'Reasignado a Plan Gratuito desde Admin',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo actualizar el plan.');
      showTempNotice(
        `Plan actualizado a ${nextPlan === 'premium' ? 'PREMIUM' : 'GRATIS'} correctamente.`
      );
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar plan.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleGrantCredits = async (uid: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    setBusyUid(uid);
    setError('');
    try {
      const resp = await authFetch(`/api/freemium/admin/users/${encodeURIComponent(uid)}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditsDelta: delta,
          reason: `Asignación administrativa (${delta > 0 ? `+${delta}` : delta} consultas extra)`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudieron asignar créditos.');
      setCustomCreditsByUid((prev) => ({ ...prev, [uid]: '' }));
      showTempNotice(`Créditos extra actualizados (${delta > 0 ? `+${delta}` : delta}).`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar créditos.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleAckAlert = async (alertId: string) => {
    setError('');
    try {
      const resp = await authFetch(`/api/freemium/admin/alerts/${encodeURIComponent(alertId)}/ack`, {
        method: 'POST',
      });
      if (resp.ok) {
        await loadDashboard();
      }
    } catch {
      // ignore
    }
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitsDraft) return;
    setSavingLimits(true);
    setError('');
    try {
      const resp = await authFetch('/api/freemium/admin/limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limitsDraft),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudieron guardar los límites globales.');
      showTempNotice('Límites globales y presupuesto mensual guardados en el servidor.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando límites.');
    } finally {
      setSavingLimits(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!dashboard) return [];
    const q = userSearch.trim().toLowerCase();
    return dashboard.users.filter((u) => {
      if (userFilter === 'free' && u.planTier !== 'free') return false;
      if (userFilter === 'premium' && u.planTier !== 'premium') return false;
      if (userFilter === 'at_limit' && !u.atLimit) return false;
      if (q) {
        const hay = `${u.email} ${u.displayName} ${u.uid}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dashboard, userSearch, userFilter]);

  if (loading && !dashboard) {
    return (
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-8 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
        Cargando control centralizado de IA, planes Freemium y costos USD...
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-xs text-rose-700 dark:text-rose-200 flex items-center justify-between gap-3">
        <span>{error || 'No se pudieron obtener las métricas de IA.'}</span>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
        >
          Reintentar
        </button>
      </section>
    );
  }

  const { summary, budgetStatus, dailySeries, monthlySeries, byProvider, byModel, alerts, recentRequests } =
    dashboard;

  const dailyMax = Math.max(
    1,
    ...dailySeries.map((d) => (chartMode === 'queries' ? d.queries : d.costUsd))
  );
  const monthlyMax = Math.max(
    1,
    ...monthlySeries.map((m) => (chartMode === 'queries' ? m.queries : m.costUsd))
  );

  const budgetBarColor =
    budgetStatus.percentUsed >= 100
      ? 'bg-rose-600'
      : budgetStatus.percentUsed >= 90
        ? 'bg-amber-600'
        : budgetStatus.percentUsed >= 75
          ? 'bg-amber-500'
          : 'bg-sky-600';

  return (
    <div className="space-y-6 text-xs">
      {/* Header Banner */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            FABRO ADMIN — CONTROL DE IA Y COSTOS
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            Administración Freemium, enrutador multi-proveedor, cuotas diarias y protección presupuestaria (${budgetStatus.monthlyBudgetUsd.toFixed(2)} USD/mes). Reinicio diario: <span className="font-mono tabular-nums">{dashboard.nextResetFormatted}</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar métricas
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-emerald-700 dark:text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
          <p className="text-slate-500 dark:text-slate-400">Usuarios registrados</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.totalRegisteredUsers}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {summary.freeUsersCount} Gratis · {summary.premiumUsersCount} Premium
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
          <p className="text-slate-500 dark:text-slate-400">Consultas hoy</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.queriesToday}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            Costo hoy: ${summary.costTodayUsd.toFixed(4)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
          <p className="text-slate-500 dark:text-slate-400">Consultas del mes</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.queriesThisMonth}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {summary.freeQueriesThisMonth} gratis · {summary.paidQueriesThisMonth} pagas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
          <p className="text-slate-500 dark:text-slate-400">Gasto mensual USD</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${summary.monthCostUsd.toFixed(4)}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            Tope: ${budgetStatus.monthlyBudgetUsd.toFixed(2)} USD
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
          <p className="text-slate-500 dark:text-slate-400">Usuarios en límite</p>
          <p
            className={`font-mono tabular-nums text-2xl font-bold mt-1 ${
              summary.usersAtLimitCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {summary.usersAtLimitCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Cupo diario agotado</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4">
          <p className="text-slate-500 dark:text-slate-400">Alertas pendientes</p>
          <p
            className={`font-mono tabular-nums text-2xl font-bold mt-1 ${
              summary.unacknowledgedAlerts > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {summary.unacknowledgedAlerts}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{budgetStatus.statusLabel}</p>
        </div>
      </section>

      {/* Graduated Budget Bar (50/75/90/100%) */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <DollarSign className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Protección Económica Mensual ({budgetStatus.percentUsed.toFixed(1)}% consumido)</span>
          </div>
          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
            ${budgetStatus.monthCostUsd.toFixed(4)} / ${budgetStatus.monthlyBudgetUsd.toFixed(2)} USD · {budgetStatus.statusLabel}
          </span>
        </div>

        <div className="relative h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all ${budgetBarColor}`}
            style={{ width: `${Math.min(100, budgetStatus.percentUsed)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
          <span>{dashboard.systemLimits.warn50Percent}% · Aviso al administrador</span>
          <span>{dashboard.systemLimits.alert75Percent}% · Alerta preventiva</span>
          <span>{dashboard.systemLimits.restrictPaid90Percent}% · Restringe modelos pagos</span>
          <span>{dashboard.systemLimits.blockPaid100Percent}% · Bloqueo total pagos (sigue gratis)</span>
        </div>
      </section>

      {/* Charts: Daily & Monthly Usage */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Gráficos de Consumo Diario y Mensual</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setChartMode('queries')}
              className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                chartMode === 'queries'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Consultas
            </button>
            <button
              type="button"
              onClick={() => setChartMode('cost')}
              className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                chartMode === 'cost'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Costo USD
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Chart */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Últimos 14 días ({chartMode === 'queries' ? 'Consultas/día' : 'USD/día'})
            </p>
            <div className="h-44 flex items-end gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 pt-4">
              {dailySeries.map((day) => {
                const rawVal = chartMode === 'queries' ? day.queries : day.costUsd;
                const heightPct = rawVal > 0 ? Math.max(8, Math.round((rawVal / dailyMax) * 100)) : 2;
                return (
                  <div
                    key={day.dateKey}
                    className="flex-1 flex flex-col items-center justify-end gap-1 h-full group"
                    title={`${day.dateKey}: ${day.queries} consultas · $${day.costUsd.toFixed(4)} USD`}
                  >
                    <span className="text-[9px] font-mono tabular-nums text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {chartMode === 'queries' ? day.queries : `$${day.costUsd.toFixed(2)}`}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        rawVal > 0 ? 'bg-sky-600 dark:bg-sky-500' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] font-mono tabular-nums text-slate-400">
                      {day.dateKey.slice(8)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Evolución mensual ({chartMode === 'queries' ? 'Consultas/mes' : 'USD/mes'})
            </p>
            <div className="h-44 flex items-end gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 pt-4">
              {monthlySeries.map((m) => {
                const rawVal = chartMode === 'queries' ? m.queries : m.costUsd;
                const heightPct = rawVal > 0 ? Math.max(8, Math.round((rawVal / monthlyMax) * 100)) : 2;
                return (
                  <div
                    key={m.monthKey}
                    className="flex-1 flex flex-col items-center justify-end gap-1 h-full group"
                    title={`${m.monthKey}: ${m.queries} consultas · $${m.costUsd.toFixed(4)} USD`}
                  >
                    <span className="text-[10px] font-mono tabular-nums text-slate-500">
                      {chartMode === 'queries' ? m.queries : `$${m.costUsd.toFixed(3)}`}
                    </span>
                    <div
                      className={`w-full max-w-[44px] rounded-t transition-all ${
                        rawVal > 0 ? 'bg-cyan-600 dark:bg-cyan-500' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">{m.monthKey}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Provider & Model Consumption Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
            Consumo por Proveedor (Tokens y Costo USD)
          </h4>
          {Object.keys(byProvider).length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 py-4">
              Aún no se registraron llamadas en el historial persistido.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-2">Proveedor</th>
                    <th className="py-2 px-2 text-right">Consultas</th>
                    <th className="py-2 px-2 text-right">Tokens In</th>
                    <th className="py-2 px-2 text-right">Tokens Out</th>
                    <th className="py-2 px-2 text-right">Errores</th>
                    <th className="py-2 pl-2 text-right">USD Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                  {Object.entries(byProvider).map(([prov, st]) => (
                    <tr key={prov} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2 pr-2 font-sans font-semibold text-slate-900 dark:text-white">{prov}</td>
                      <td className="py-2 px-2 text-right">{st.queries}</td>
                      <td className="py-2 px-2 text-right">{st.tokensIn.toLocaleString('es-AR')}</td>
                      <td className="py-2 px-2 text-right">{st.tokensOut.toLocaleString('es-AR')}</td>
                      <td className="py-2 px-2 text-right text-rose-600 dark:text-rose-400">{st.errors}</td>
                      <td className="py-2 pl-2 text-right font-semibold">${st.costUsd.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
            Consumo por Modelo
          </h4>
          {Object.keys(byModel).length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 py-4">
              Sin modelos ejecutados todavía.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-2">Modelo</th>
                    <th className="py-2 px-2 text-right">Consultas</th>
                    <th className="py-2 px-2 text-right">Tokens Tot.</th>
                    <th className="py-2 pl-2 text-right">USD Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                  {Object.entries(byModel).map(([mod, st]) => (
                    <tr key={mod} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2 pr-2 font-sans font-medium text-slate-900 dark:text-white truncate max-w-[180px]">
                        {mod}
                      </td>
                      <td className="py-2 px-2 text-right">{st.queries}</td>
                      <td className="py-2 px-2 text-right">
                        {(st.tokensIn + st.tokensOut).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2 pl-2 text-right font-semibold">${st.costUsd.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* User Plans & Credits Management */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Gestión de Usuarios, Planes (GRATIS / PREMIUM) y Créditos Extra</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por email o nombre..."
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'free', label: 'Gratis' },
                { id: 'premium', label: 'Premium' },
                { id: 'at_limit', label: 'En límite' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setUserFilter(f.id as typeof userFilter)}
                  className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                    userFilter === f.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 py-4">
            No se encontraron usuarios con ese criterio.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 px-2">Plan</th>
                  <th className="py-2 px-2 text-right">Hoy / Límite</th>
                  <th className="py-2 px-2 text-right">Créditos Extra</th>
                  <th className="py-2 px-2 text-right">USD Hoy</th>
                  <th className="py-2 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isBusy = busyUid === u.uid;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{u.displayName || 'Usuario FABRO'}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </td>
                      <td className="py-2.5 px-2 font-semibold">
                        {u.planTier === 'premium' ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Crown className="w-3.5 h-3.5" />
                            PREMIUM
                          </span>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300">GRATIS</span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                          u.atLimit ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {u.usedToday} / {u.dailyLimit}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-sky-600 dark:text-sky-400">
                        {u.extraCredits}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                        ${u.costTodayUsd.toFixed(4)}
                      </td>
                      <td className="py-2.5 pl-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleSetUserPlan(u.uid, u.planTier === 'premium' ? 'free' : 'premium')
                            }
                            className={`rounded-lg px-2.5 py-1 font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                              u.planTier === 'premium'
                                ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                          >
                            {u.planTier === 'premium' ? 'Pasar a GRATIS' : 'Asignar PREMIUM'}
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleGrantCredits(u.uid, 10)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-1 font-mono font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer disabled:opacity-50"
                          >
                            <Coins className="w-3 h-3" />
                            +10
                          </button>

                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={500}
                              placeholder="+"
                              value={customCreditsByUid[u.uid] || ''}
                              onChange={(e) =>
                                setCustomCreditsByUid((prev) => ({ ...prev, [u.uid]: e.target.value }))
                              }
                              className="w-12 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-1.5 py-1 text-[11px] font-mono tabular-nums"
                            />
                            <button
                              type="button"
                              disabled={isBusy || !Number(customCreditsByUid[u.uid])}
                              onClick={() =>
                                void handleGrantCredits(u.uid, Number(customCreditsByUid[u.uid] || 0))
                              }
                              className="rounded bg-sky-600 px-2 py-1 font-semibold text-white disabled:opacity-40 cursor-pointer"
                            >
                              Dar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Global System Limits Editor */}
      {limitsDraft && (
        <form
          onSubmit={(e) => void handleSaveLimits(e)}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4"
        >
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <SlidersHorizontal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Configuración Global de Límites y Umbrales (`system_limits`)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Consultas/día Plan GRATIS</span>
              <input
                type="number"
                min={1}
                value={limitsDraft.freeDailyLimit}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, freeDailyLimit: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Consultas/día Plan PREMIUM</span>
              <input
                type="number"
                min={1}
                value={limitsDraft.premiumDailyLimit}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, premiumDailyLimit: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Presupuesto mensual (USD)</span>
              <input
                type="number"
                step="1"
                min={1}
                value={limitsDraft.monthlyBudgetUsd}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, monthlyBudgetUsd: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Zona horaria de reinicio</span>
              <select
                value={limitsDraft.resetTimezone}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, resetTimezone: e.target.value } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 text-slate-900 dark:text-white"
              >
                <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                <option value="America/Mexico_City">America/Mexico_City</option>
                <option value="America/Bogota">America/Bogota</option>
                <option value="America/Santiago">America/Santiago</option>
                <option value="Europe/Madrid">Europe/Madrid</option>
                <option value="UTC">UTC</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Umbral aviso (%)</span>
              <input
                type="number"
                min={10}
                max={99}
                value={limitsDraft.warn50Percent}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, warn50Percent: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Umbral alerta (%)</span>
              <input
                type="number"
                min={20}
                max={99}
                value={limitsDraft.alert75Percent}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, alert75Percent: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Umbral restricción pagos (%)</span>
              <input
                type="number"
                min={50}
                max={100}
                value={limitsDraft.restrictPaid90Percent}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, restrictPaid90Percent: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Umbral bloqueo pagos (%)</span>
              <input
                type="number"
                min={70}
                max={100}
                value={limitsDraft.blockPaid100Percent}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, blockPaid100Percent: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>

            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Máx. caracteres entrada GRATIS</span>
              <input
                type="number"
                min={500}
                step={1000}
                value={limitsDraft.freeMaxInputChars}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, freeMaxInputChars: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Máx. tokens salida GRATIS</span>
              <input
                type="number"
                min={512}
                step={512}
                value={limitsDraft.freeMaxOutputTokens}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, freeMaxOutputTokens: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Máx. tokens salida PREMIUM</span>
              <input
                type="number"
                min={1024}
                step={512}
                value={limitsDraft.premiumMaxOutputTokens}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, premiumMaxOutputTokens: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400">Anti-spam (solicitudes/min)</span>
              <input
                type="number"
                min={3}
                max={120}
                value={limitsDraft.antiSpamPerMinute}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, antiSpamPerMinute: Number(e.target.value) } : p))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-1.5 font-mono tabular-nums"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(limitsDraft.allowPaidModelsOnFree)}
                onChange={(e) =>
                  setLimitsDraft((p) => (p ? { ...p, allowPaidModelsOnFree: e.target.checked } : p))
                }
              />
              <span>Permitir modelos comerciales en Plan Gratuito (no recomendado)</span>
            </label>

            <button
              type="submit"
              disabled={savingLimits}
              className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              {savingLimits ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      )}

      {/* Alerts & Recent Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Alertas Económicas y Errores de Proveedores ({alerts.length})</span>
          </div>

          {alerts.length === 0 ? (
            <div className="py-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sin alertas ni errores críticos registrados.</span>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.map((al) => (
                <div key={al.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p
                      className={`font-semibold flex items-center gap-1.5 ${
                        al.severity === 'critical'
                          ? 'text-rose-600 dark:text-rose-400'
                          : al.severity === 'warning'
                            ? 'text-amber-600 dark:text-amber-300'
                            : 'text-sky-600 dark:text-sky-400'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{al.title}</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">{al.message}</p>
                    <p className="text-[10px] font-mono tabular-nums text-slate-400">
                      {al.createdAt.slice(0, 19).replace('T', ' ')}
                    </p>
                  </div>
                  {!al.acknowledged ? (
                    <button
                      type="button"
                      onClick={() => void handleAckAlert(al.id)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                    >
                      Confirmar
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 shrink-0">Leída</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
          <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
            Historial Reciente de Operaciones ({recentRequests.length})
          </h4>
          {recentRequests.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 py-4">
              Aún no hay operaciones registradas en el servidor.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {recentRequests.slice(0, 30).map((req) => (
                <div key={req.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {req.providerId} · {req.modelId}{' '}
                      <span
                        className={
                          req.status === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        ({req.status})
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {req.userEmail} · {req.planTier.toUpperCase()} · {req.operationType}
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300 shrink-0">
                    <p>
                      {(req.inputTokens + req.outputTokens).toLocaleString('es-AR')} tok · {req.latencyMs}ms
                    </p>
                    <p className="font-semibold">${req.costUsd.toFixed(5)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
