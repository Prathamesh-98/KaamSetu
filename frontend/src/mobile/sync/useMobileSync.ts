import { useState, useEffect, useCallback, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { authStorage } from '../../authStorage';
import {
  MOBILE_QUERY_KEYS,
  invalidateRoleQueries,
  invalidateApplicationSync,
  invalidateShiftSync,
} from './queryKeys';

export interface MobileSyncState {
  isOnline: boolean;
  isForeground: boolean;
  isSyncing: boolean;
  wsConnected: boolean;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<void>;
}

interface WsEnvelope {
  event_id?: string;
  event?: string;
  data?: Record<string, unknown>;
}

const MAX_SEEN_EVENT_IDS = 250;
const WS_HEARTBEAT_INTERVAL_MS = 25000;
const WS_CONNECTED_FALLBACK_POLL_MS = 45000;
const EVENT_COALESCE_MS = 50;

let globalWsConnected = false;
const wsStatusListeners = new Set<(connected: boolean) => void>();

function setGlobalWsConnected(connected: boolean) {
  if (globalWsConnected === connected) return;
  globalWsConnected = connected;
  wsStatusListeners.forEach((listener) => listener(connected));
}

export function resolveMobileWebSocketUrl(): string | null {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null;
  const raw = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
  const wsBase = raw.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/api/ws`;
}

/**
 * Computes an adaptive foreground polling interval with bounded exponential backoff
 * when offline, backgrounded, or experiencing transient network/API errors.
 * When live WebSocket synchronization is active, relaxes polling to a low-frequency
 * background safety net; when WebSocket disconnects or is unsupported, falls back
 * transparently to the fast baseMs interval.
 */
export function useAdaptivePollInterval(
  baseMs: number,
  options: { enabled?: boolean; isError?: boolean; failureCount?: number } = {}
): number | false {
  const { enabled = true, isError = false, failureCount = 0 } = options;
  const [isForeground, setIsForeground] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wsConnected, setWsConnected] = useState(() => globalWsConnected);

  useEffect(() => {
    setWsConnected(globalWsConnected);
    wsStatusListeners.add(setWsConnected);

    const onVis = () => setIsForeground(document.visibilityState === 'visible');
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    let removeAppListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        setIsForeground(isActive);
      })
        .then((handle) => {
          removeAppListener = () => handle.remove();
        })
        .catch(() => {});
    }

    return () => {
      wsStatusListeners.delete(setWsConnected);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      removeAppListener?.();
    };
  }, []);

  if (!enabled || !isForeground || !isOnline) {
    return false;
  }

  if (isError || failureCount > 0) {
    const backoff = baseMs * Math.pow(2, Math.min(failureCount || 1, 3));
    return Math.min(backoff, 60000);
  }

  return wsConnected ? Math.max(baseMs, WS_CONNECTED_FALLBACK_POLL_MS) : baseMs;
}

function dispatchWsBatch(queryClient: QueryClient, events: WsEnvelope[]) {
  let invalidateNotifications = false;
  let invalidateChatList = false;
  let invalidateAllChatMessages = false;
  const chatConversationIds = new Set<string>();
  let invalidateApplications = false;
  const applicationJobIds = new Set<string>();
  let invalidateShifts = false;

  for (const evt of events) {
    const name = evt.event || '';
    const data = evt.data || {};
    if (name === 'notification:created') {
      invalidateNotifications = true;
    } else if (name === 'message:created') {
      invalidateChatList = true;
      const convId = typeof data.conversation_id === 'string' ? data.conversation_id : '';
      if (convId) {
        chatConversationIds.add(convId);
      } else {
        invalidateAllChatMessages = true;
      }
    } else if (
      name === 'application:created' ||
      name === 'application:updated' ||
      name === 'application:withdrawn'
    ) {
      invalidateApplications = true;
      if (typeof data.job_id === 'string' && data.job_id) {
        applicationJobIds.add(data.job_id);
      }
    } else if (name === 'shift:updated') {
      invalidateShifts = true;
    }
  }

  if (invalidateNotifications) {
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsList });
  }
  if (invalidateChatList) {
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatUnreadCount });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatConversations });
    if (invalidateAllChatMessages) {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    } else {
      chatConversationIds.forEach((convId) => {
        void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatMessages(convId) });
      });
    }
  }
  if (invalidateApplications) {
    if (applicationJobIds.size === 0) {
      invalidateApplicationSync(queryClient);
    } else {
      applicationJobIds.forEach((jobId) => invalidateApplicationSync(queryClient, jobId));
    }
  }
  if (invalidateShifts) {
    invalidateShiftSync(queryClient);
  }
}

/**
 * Global mobile lifecycle & real-time WebSocket synchronization hook mounted in
 * WorkerMobileLayout / EmployerMobileLayout.
 * - Connects to /api/ws and authenticates via first-frame JSON {"type":"auth","token":...}
 *   (no JWT exposed in URL query params).
 * - Deduplicates events by event_id, coalesces burst commits, and invalidates canonical React Query keys.
 * - Automatically falls back to fast adaptive polling when offline/disconnected/unsupported.
 */
export function useMobileSync(): MobileSyncState {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isForeground, setIsForeground] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const lastAutoSyncRef = useRef<number>(0);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const pendingEventsRef = useRef<WsEnvelope[]>([]);
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const everConnectedRef = useRef<boolean>(false);
  const needsCatchUpOnConnectRef = useRef<boolean>(false);

  const userId = user?.id;
  const userRole = user?.role;

  const triggerSync = useCallback(async () => {
    if (!isAuthenticated || !userRole || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      invalidateRoleQueries(queryClient, userRole);
      await queryClient.refetchQueries({ type: 'active' });
      setLastSyncedAt(new Date());
      lastAutoSyncRef.current = Date.now();
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, userRole, queryClient]);

  // Lifecycle listeners (visibility, online/offline, Capacitor App state)
  useEffect(() => {
    if (!isAuthenticated || !userRole) return;

    const handleResumeSync = () => {
      const now = Date.now();
      if (now - lastAutoSyncRef.current < 1500) return;
      lastAutoSyncRef.current = now;
      invalidateRoleQueries(queryClient, userRole);
      setLastSyncedAt(new Date());
    };

    const onVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsForeground(visible);
      if (visible) {
        handleResumeSync();
      }
    };

    const onOnline = () => {
      setIsOnline(true);
      handleResumeSync();
    };

    const onOffline = () => {
      setIsOnline(false);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    let removeNativeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        setIsForeground(isActive);
        if (isActive) {
          handleResumeSync();
        }
      })
        .then((handle) => {
          removeNativeListener = () => handle.remove();
        })
        .catch(() => {});
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      removeNativeListener?.();
    };
  }, [isAuthenticated, userRole, queryClient]);

  // Authenticated WebSocket subscription + reconnect recovery + event deduplication
  useEffect(() => {
    const updateWsStatus = (connected: boolean) => {
      setWsConnected(connected);
      setGlobalWsConnected(connected);
    };

    if (!isAuthenticated || !userId || !userRole || !isOnline || !isForeground) {
      updateWsStatus(false);
      return;
    }

    const wsUrl = resolveMobileWebSocketUrl();
    const token = authStorage.getItem('kaamsetu_token');
    if (!wsUrl || !token) {
      updateWsStatus(false);
      return;
    }

    let disposed = false;
    let activeSocket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (coalesceTimerRef.current) {
        clearTimeout(coalesceTimerRef.current);
        coalesceTimerRef.current = null;
      }
    };

    const flushPendingEvents = () => {
      coalesceTimerRef.current = null;
      if (pendingEventsRef.current.length === 0) return;
      const batch = pendingEventsRef.current.splice(0, pendingEventsRef.current.length);
      dispatchWsBatch(queryClient, batch);
      setLastSyncedAt(new Date());
    };

    const connect = () => {
      if (disposed) return;
      const currentToken = authStorage.getItem('kaamsetu_token');
      if (!currentToken) {
        updateWsStatus(false);
        return;
      }

      try {
        const ws = new WebSocket(wsUrl);
        activeSocket = ws;

        ws.onopen = () => {
          if (disposed) {
            ws.close(1000);
            return;
          }
          // First-frame JSON authentication avoids exposing JWTs in URLs/logs.
          ws.send(JSON.stringify({ type: 'auth', token: currentToken }));
        };

        ws.onmessage = (event) => {
          if (disposed) return;
          let msg: WsEnvelope;
          try {
            msg = JSON.parse(String(event.data)) as WsEnvelope;
          } catch {
            return;
          }

          if (msg.event_id) {
            if (seenEventIdsRef.current.has(msg.event_id)) {
              return;
            }
            seenEventIdsRef.current.add(msg.event_id);
            if (seenEventIdsRef.current.size > MAX_SEEN_EVENT_IDS) {
              const oldest = seenEventIdsRef.current.values().next().value;
              if (oldest !== undefined) {
                seenEventIdsRef.current.delete(oldest);
              }
            }
          }

          if (msg.event === 'connected') {
            updateWsStatus(true);
            reconnectAttemptRef.current = 0;
            everConnectedRef.current = true;

            if (needsCatchUpOnConnectRef.current) {
              needsCatchUpOnConnectRef.current = false;
              invalidateRoleQueries(queryClient, userRole);
            }
            setLastSyncedAt(new Date());

            if (pingTimer) clearInterval(pingTimer);
            pingTimer = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
              }
            }, WS_HEARTBEAT_INTERVAL_MS);
            return;
          }

          if (msg.event === 'pong' || !msg.event) {
            return;
          }

          pendingEventsRef.current.push(msg);
          if (!coalesceTimerRef.current) {
            coalesceTimerRef.current = setTimeout(flushPendingEvents, EVENT_COALESCE_MS);
          }
        };

        ws.onerror = () => {
          // Wait for onclose to manage state and schedule backoff retry.
        };

        ws.onclose = (closeEvt) => {
          if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
          }
          if (activeSocket === ws) {
            activeSocket = null;
          }
          updateWsStatus(false);

          if (disposed || closeEvt.code === 4401) {
            return;
          }

          needsCatchUpOnConnectRef.current = true;
          const attempt = reconnectAttemptRef.current;
          reconnectAttemptRef.current = Math.min(attempt + 1, 6);
          const maxCap = everConnectedRef.current ? 30000 : 60000;
          const delayMs = Math.min(1000 * Math.pow(2, attempt), maxCap);
          reconnectTimer = setTimeout(connect, delayMs);
        };
      } catch {
        updateWsStatus(false);
      }
    };

    connect();

    return () => {
      disposed = true;
      clearTimers();
      pendingEventsRef.current = [];
      updateWsStatus(false);
      if (activeSocket && (activeSocket.readyState === WebSocket.OPEN || activeSocket.readyState === WebSocket.CONNECTING)) {
        activeSocket.close(1000);
      }
      activeSocket = null;
    };
  }, [isAuthenticated, userId, userRole, isOnline, isForeground, queryClient]);

  return {
    isOnline,
    isForeground,
    isSyncing,
    wsConnected,
    lastSyncedAt,
    triggerSync,
  };
}
