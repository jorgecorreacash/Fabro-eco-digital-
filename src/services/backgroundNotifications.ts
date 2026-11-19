import type { NotificationPreferences, SectorId, SubmenuId } from '../types/ecosystem';
import { playSoftBell } from './webAudioPtt';

export interface NotificationCapability {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  statusMessage: string;
}

export function getNotificationCapability(): NotificationCapability {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      supported: false,
      permission: 'unsupported',
      isIOS: false,
      isStandalone: false,
      statusMessage: 'Entorno sin soporte de navegador.',
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  if (!('Notification' in window)) {
    return {
      supported: false,
      permission: 'unsupported',
      isIOS,
      isStandalone,
      statusMessage: isIOS
        ? 'En iPhone/iPad debés instalar FABRO en tu pantalla de inicio (Compartir → Agregar a inicio) para habilitar avisos PWA (iOS 16.4+).'
        : 'Este navegador no soporta la Notifications API; los avisos seguirán apareciendo dentro de la app.',
    };
  }

  const permission = Notification.permission;
  const statusMessage =
    permission === 'granted'
      ? 'Permiso concedido: las alertas se enviarán incluso en segundo plano.'
      : permission === 'denied'
      ? 'Permiso bloqueado en el navegador. Habilitalo desde el icono de candado junto a la barra de direcciones.'
      : 'Pendiente de autorización. Tocá «Solicitar permiso» para activar avisos del sistema.';

  return {
    supported: true,
    permission,
    isIOS,
    isStandalone,
    statusMessage,
  };
}

export async function requestBrowserNotificationPermission(): Promise<{
  permission: NotificationPermission | 'unsupported';
  message: string;
}> {
  const cap = getNotificationCapability();
  if (!cap.supported) {
    return { permission: 'unsupported', message: cap.statusMessage };
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      return {
        permission: 'granted',
        message: 'Notificaciones del sistema activadas correctamente.',
      };
    }
    if (result === 'denied') {
      return {
        permission: 'denied',
        message:
          'El navegador bloqueó las notificaciones. Podés habilitarlas manualmente desde los ajustes del sitio.',
      };
    }
    return {
      permission: 'default',
      message: 'Solicitud pospuesta. Podés volver a activarla cuando quieras.',
    };
  } catch {
    return {
      permission: Notification.permission,
      message: 'No se pudo completar la solicitud de permisos en este contexto.',
    };
  }
}

export interface DispatchNotificationOptions {
  title: string;
  body: string;
  sector: SectorId;
  submenu: SubmenuId;
  cultureNav?: string;
  tag?: string;
  soundType?: 'focus-end' | 'break-end' | 'interval' | null;
  vibratePattern?: number[];
  prefs?: NotificationPreferences;
  onInAppFallback?: (sector: SectorId, submenu: SubmenuId, cultureNav?: string) => void;
}

export async function dispatchSystemNotification(
  options: DispatchNotificationOptions
): Promise<{ delivered: boolean; channel: 'sw' | 'notification-api' | 'in-app-only'; note: string }> {
  const {
    title,
    body,
    sector,
    submenu,
    cultureNav,
    tag = `fabro-${sector}-${submenu}`,
    soundType = 'interval',
    vibratePattern = [180, 90, 220],
    prefs,
  } = options;

  if (prefs && !prefs.enabled) {
    return {
      delivered: false,
      channel: 'in-app-only',
      note: 'Notificaciones desactivadas por preferencia del usuario.',
    };
  }

  if (soundType && (!prefs || prefs.sound)) {
    playSoftBell(soundType);
  }

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    (!prefs || prefs.vibrate)
  ) {
    try {
      navigator.vibrate(vibratePattern);
    } catch {
      // ignore if blocked
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      delivered: false,
      channel: 'in-app-only',
      note: 'Navegador sin Notifications API: aviso registrado en la app.',
    };
  }

  if (Notification.permission !== 'granted') {
    return {
      delivered: false,
      channel: 'in-app-only',
      note: 'Permiso del sistema no concedido aún.',
    };
  }

  // Prefer active Service Worker registration so Android shows native background notification + notificationclick works
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        const cultureParam = cultureNav ? `&cultureNav=${encodeURIComponent(cultureNav)}` : '';
        const swOptions: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag,
          renotify: true,
          vibrate: !prefs || prefs.vibrate ? vibratePattern : undefined,
          data: {
            sector,
            submenu,
            cultureNav,
            url: `/?sector=${encodeURIComponent(sector)}&submenu=${encodeURIComponent(submenu)}${cultureParam}`,
          },
        };
        await reg.showNotification(title, swOptions);
        return {
          delivered: true,
          channel: 'sw',
          note: 'Enviada vía Service Worker en segundo plano.',
        };
      }
    } catch {
      // Fallback below
    }
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
    });
    notif.onclick = () => {
      window.focus();
      options.onInAppFallback?.(sector, submenu, cultureNav);
      notif.close();
    };
    return {
      delivered: true,
      channel: 'notification-api',
      note: 'Enviada mediante Notifications API.',
    };
  } catch {
    return {
      delivered: false,
      channel: 'in-app-only',
      note: 'El entorno bloqueó la ventana de notificación externa.',
    };
  }
}
