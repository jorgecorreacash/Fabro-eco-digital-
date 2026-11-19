import React from 'react';
import { BellRing, Volume2, X } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { playCalendarAlarmTone } from '../../services/calendarAlarmAudio';

export const CalendarAlarmBanner: React.FC = () => {
  const { activeCalendarAlarm, dismissActiveCalendarAlarm, navigateTo } = useEcosystem();

  if (!activeCalendarAlarm) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-1.5rem)] max-w-lg rounded-2xl border-2 border-amber-500 fabro-surface shadow-2xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 animate-pulse">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              Alarma del Calendario FABRO · {activeCalendarAlarm.alarmTime} hs
            </p>
            <p className="font-display text-sm sm:text-base font-bold truncate">
              {activeCalendarAlarm.title}
            </p>
            <p className="text-xs fabro-muted truncate">
              {activeCalendarAlarm.subject} · {activeCalendarAlarm.dateKey}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissActiveCalendarAlarm}
          aria-label="Cerrar alarma"
          className="min-h-[34px] min-w-[34px] rounded-xl border fabro-border inline-flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => playCalendarAlarmTone(activeCalendarAlarm.tone)}
          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-1.5 text-xs font-bold cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5" />
          Repetir tono
        </button>
        <button
          type="button"
          onClick={() => {
            dismissActiveCalendarAlarm();
            navigateTo('estudio', 'calendario-pintable');
          }}
          className="min-h-[38px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB]/12 text-[#1D4ED8] dark:text-[#93C5FD] px-3 py-1.5 text-xs font-bold cursor-pointer"
        >
          Ver Calendario
        </button>
        <button
          type="button"
          onClick={dismissActiveCalendarAlarm}
          className="min-h-[38px] rounded-xl border-2 border-amber-500 bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};
