import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { isAndroidApp } from '../utils/platform';

/**
 * Ensures Android window insets (status bar, display cutouts, navigation bar)
 * are accurately calculated and propagated to CSS custom properties:
 * - --app-safe-top
 * - --app-safe-bottom
 * - --app-safe-left
 * - --app-safe-right
 */
export function useWindowInsets() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateInsets = () => {
      const docEl = document.documentElement;

      // 1. Measure computed safe-area-inset-top via test element
      let measuredTop = 0;
      let measuredBottom = 0;
      try {
        const testEl = document.createElement('div');
        testEl.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);visibility:hidden;height:0;';
        document.body.appendChild(testEl);
        const comp = window.getComputedStyle(testEl);
        measuredTop = parseFloat(comp.top) || 0;
        measuredBottom = parseFloat(comp.bottom) || 0;
        document.body.removeChild(testEl);
      } catch {
        // fallback
      }

      const isAndroid = isAndroidApp() || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android');

      // If Android WebView reports 0px for safe-area-inset-top, apply a sensible minimum status bar height
      // (modern Android devices have a status bar / cutout between 28dp and 48dp, default 36dp)
      if (isAndroid && measuredTop < 24) {
        // If native OnApplyWindowInsetsListener hasn't injected a custom --app-safe-top yet
        const currentStyleTop = docEl.style.getPropertyValue('--app-safe-top');
        if (!currentStyleTop || currentStyleTop === '0px' || currentStyleTop.includes('env(')) {
          docEl.style.setProperty('--app-safe-top', '38px');
        }
      } else if (measuredTop >= 24) {
        docEl.style.setProperty('--app-safe-top', `${measuredTop}px`);
      }

      if (isAndroid && measuredBottom < 12) {
        const currentStyleBottom = docEl.style.getPropertyValue('--app-safe-bottom');
        if (!currentStyleBottom || currentStyleBottom === '0px' || currentStyleBottom.includes('env(')) {
          docEl.style.setProperty('--app-safe-bottom', '16px');
        }
      } else if (measuredBottom >= 12) {
        docEl.style.setProperty('--app-safe-bottom', `${measuredBottom}px`);
      }
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, []);
}
