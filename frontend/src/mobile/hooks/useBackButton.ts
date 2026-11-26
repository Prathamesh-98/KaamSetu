import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Android hardware back button handler.
 * - Respects custom back overrides (e.g., closing open drawers/modals first).
 * - Navigates backward in history when inside nested sub-pages.
 * - Exits the app cleanly when at main root screens.
 */
export function useBackButton(onBackOverride?: () => boolean) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    App.addListener('backButton', ({ canGoBack }) => {
      if (onBackOverride && onBackOverride()) {
        return;
      }

      const rootPaths = ['/', '/worker/dashboard', '/employer/dashboard', '/login'];
      if (rootPaths.includes(location.pathname)) {
        App.exitApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }).then(sub => {
      cleanup = () => sub.remove();
    }).catch(() => {});

    return () => {
      if (cleanup) cleanup();
    };
  }, [navigate, location.pathname, onBackOverride]);
}
