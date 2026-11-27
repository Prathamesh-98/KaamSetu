import { useState, useEffect, useCallback, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateRoleQueries } from './queryKeys';

export interface MobileSyncState {
  isOnline: boolean;
  isForeground: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<void>;
}

/**
 * Computes an adaptive foreground polling interval with bounded exponential backoff
 * when offline, backgrounded, or experiencing transient network/API errors.
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

  useEffect(() => {
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

  return baseMs;
}

/**
 * Global mobile lifecycle synchronization hook mounted in WorkerMobileLayout / EmployerMobileLayout.
 * - Immediately invalidates stale role data when app returns from background or network reconnects.
 * - Exposes manual triggerSync & live online/foreground state.
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
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastAutoSyncRef = useRef<number>(0);

  const triggerSync = useCallback(async () => {
    if (!isAuthenticated || !user || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      invalidateRoleQueries(queryClient, user.role);
      await queryClient.refetchQueries({ type: 'active' });
      setLastSyncedAt(new Date());
      lastAutoSyncRef.current = Date.now();
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, user, queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const handleResumeSync = () => {
      const now = Date.now();
      // Debounce rapid consecutive focus/visibility triggers within 1.5s
      if (now - lastAutoSyncRef.current < 1500) return;
      lastAutoSyncRef.current = now;
      invalidateRoleQueries(queryClient, user.role);
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
  }, [isAuthenticated, user, queryClient]);

  return {
    isOnline,
    isForeground,
    isSyncing,
    lastSyncedAt,
    triggerSync,
  };
}
