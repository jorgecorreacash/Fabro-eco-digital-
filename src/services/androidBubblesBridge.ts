export interface FabroBubbleSnapshot {
  fabroId: string;
  displayName: string;
  privacyMode: 'todos' | 'grupo' | 'invisible';
  timerLabel: string;
  timerRunning: boolean;
  unreadCount: number;
  lastMessage: string;
}

export type FabroBubbleActionType =
  | 'bubble-open'
  | 'bubble-close'
  | 'bubble-ptt-start'
  | 'bubble-ptt-end'
  | 'bubble-chat-send'
  | 'bubble-timer-toggle'
  | 'bubble-state-sync';

export interface NativeAndroidBubblesPlugin {
  openBubble?: (payload: FabroBubbleSnapshot) => void;
  updateBubble?: (payload: FabroBubbleSnapshot) => void;
  closeBubble?: () => void;
}

declare global {
  interface Window {
    AndroidBubbles?: NativeAndroidBubblesPlugin;
    __FABRO_BUBBLE_BRIDGE__?: {
      version: string;
      getSnapshot: () => FabroBubbleSnapshot | null;
      dispatchAction: (type: FabroBubbleActionType, detail?: Record<string, unknown>) => void;
    };
  }
}

let latestSnapshot: FabroBubbleSnapshot | null = null;

export function hasNativeAndroidBubbles(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AndroidBubbles?.openBubble);
}

export function isDocumentPiPSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'documentPictureInPicture' in window &&
    typeof (window as unknown as { documentPictureInPicture?: { requestWindow?: unknown } })
      .documentPictureInPicture?.requestWindow === 'function'
  );
}

export function emitAndroidBubbleEvent(
  type: FabroBubbleActionType,
  snapshot: FabroBubbleSnapshot,
  extra?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  latestSnapshot = snapshot;

  window.dispatchEvent(
    new CustomEvent(`fabro:${type}`, {
      detail: {
        ...snapshot,
        ...(extra || {}),
        timestamp: Date.now(),
      },
    })
  );

  try {
    if (type === 'bubble-open') {
      window.AndroidBubbles?.openBubble?.(snapshot);
    } else if (type === 'bubble-close') {
      window.AndroidBubbles?.closeBubble?.();
    } else if (type === 'bubble-state-sync') {
      window.AndroidBubbles?.updateBubble?.(snapshot);
    }
  } catch {
    // ignore native plugin errors when running as standard web PWA
  }
}

export function registerAndroidBubbleBridge(
  onIncomingAction: (type: FabroBubbleActionType, detail?: Record<string, unknown>) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  window.__FABRO_BUBBLE_BRIDGE__ = {
    version: '1.0.0',
    getSnapshot: () => latestSnapshot,
    dispatchAction: (type, detail) => onIncomingAction(type, detail),
  };

  return () => {
    delete window.__FABRO_BUBBLE_BRIDGE__;
  };
}
