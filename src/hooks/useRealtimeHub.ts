import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClassroomQuizItem, PresenceMode } from '../types/fabro';

export interface ClassroomSyncPayload {
  classroomId: string;
  youtubeVideoId?: string;
  playbackState?: 'playing' | 'paused';
  playbackSeconds?: number;
  presentationNotes?: string;
  activeQuiz?: ClassroomQuizItem | null;
  updatedAt?: string;
}

export interface OnlinePeerInfo {
  uid: string;
  displayName: string;
  presenceMode: Exclude<PresenceMode, 'invisible'>;
}

interface UseRealtimeHubOptions {
  uid: string | null;
  displayName: string;
  presenceMode: PresenceMode;
  activeClassroomId?: string | null;
  onClassroomSync?: (payload: ClassroomSyncPayload) => void;
}

export function useRealtimeHub(options: UseRealtimeHubOptions) {
  const { uid, displayName, presenceMode, activeClassroomId, onClassroomSync } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const onSyncRef = useRef(onClassroomSync);
  onSyncRef.current = onClassroomSync;

  const [wsConnected, setWsConnected] = useState(false);
  const [onlinePeers, setOnlinePeers] = useState<OnlinePeerInfo[]>([]);
  const [classroomPeersCount, setClassroomPeersCount] = useState(0);

  useEffect(() => {
    if (!uid || typeof window === 'undefined') return;
    let closed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        if (closed) {
          socket.close();
          return;
        }
        setWsConnected(true);
        socket.send(
          JSON.stringify({
            type: 'presence:hello',
            uid,
            displayName,
            presenceMode,
          })
        );
        if (activeClassroomId) {
          socket.send(
            JSON.stringify({
              type: 'classroom:join',
              classroomId: activeClassroomId,
              uid,
              displayName,
            })
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data || '{}')) as {
            type?: string;
            peers?: OnlinePeerInfo[];
            count?: number;
            payload?: ClassroomSyncPayload;
          };
          if (msg.type === 'presence:roster' && Array.isArray(msg.peers)) {
            setOnlinePeers(msg.peers);
          } else if (msg.type === 'classroom:roster' && typeof msg.count === 'number') {
            setClassroomPeersCount(msg.count);
          } else if (msg.type === 'classroom:sync' && msg.payload && onSyncRef.current) {
            onSyncRef.current(msg.payload);
          }
        } catch {
          // ignore malformed ws frames
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 3500);
        }
      };

      socket.onerror = () => {
        setWsConnected(false);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
      wsRef.current = null;
    };
  }, [uid]);

  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !uid) return;
    socket.send(
      JSON.stringify({
        type: 'presence:hello',
        uid,
        displayName,
        presenceMode,
      })
    );
  }, [uid, displayName, presenceMode]);

  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !uid || !activeClassroomId) return;
    socket.send(
      JSON.stringify({
        type: 'classroom:join',
        classroomId: activeClassroomId,
        uid,
        displayName,
      })
    );
  }, [uid, displayName, activeClassroomId]);

  const sendClassroomSync = useCallback((payload: ClassroomSyncPayload) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: 'classroom:sync',
        payload,
      })
    );
  }, []);

  return {
    wsConnected,
    onlinePeers,
    classroomPeersCount,
    sendClassroomSync,
  };
}
