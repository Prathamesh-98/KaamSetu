import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { isAndroidApp } from '../utils/platform';

/**
 * Ensures Android window insets (status bar, display cutouts, navigation bar, and soft keyboard)
 * are accurately measured and propagated to CSS custom properties:
 * - --app-safe-top
 * - --app-safe-bottom
 * - --keyboard-height
 */
export function useWindowInsets() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const docEl = document.documentElement;

    const updateInsets = () => {
      let measuredTop = 0;
      let measuredBottom = 0;
      try {
        const testEl = document.createElement('div');
        testEl.style.cssText =
          'position:fixed;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);visibility:hidden;height:0;pointer-events:none;';
        document.body.appendChild(testEl);
        const comp = window.getComputedStyle(testEl);
        measuredTop = parseFloat(comp.top) || 0;
        measuredBottom = parseFloat(comp.bottom) || 0;
        document.body.removeChild(testEl);
      } catch {
        // fallback
      }

      const isAndroid = isAndroidApp() || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android');

      if (isAndroid && measuredTop < 24) {
        const currentStyleTop = docEl.style.getPropertyValue('--app-safe-top');
        if (!currentStyleTop || currentStyleTop === '0px' || currentStyleTop.includes('env(')) {
          docEl.style.setProperty('--app-safe-top', '36px');
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

    const handleVisualViewport = () => {
      if (!window.visualViewport) return;
      const diff = window.innerHeight - window.visualViewport.height;
      const kbHeight = diff > 100 ? Math.round(diff) : 0;
      docEl.style.setProperty('--keyboard-height', `${kbHeight}px`);
    };

    updateInsets();
    handleVisualViewport();

    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);
    window.visualViewport?.addEventListener('resize', handleVisualViewport);

    const kbCleanups: Array<() => void> = [];
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillShow', (info) => {
        if (info?.keyboardHeight) {
          docEl.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        }
      })
        .then((h) => kbCleanups.push(() => h.remove()))
        .catch(() => {});

      Keyboard.addListener('keyboardWillHide', () => {
        docEl.style.setProperty('--keyboard-height', '0px');
      })
        .then((h) => kbCleanups.push(() => h.remove()))
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
      window.visualViewport?.removeEventListener('resize', handleVisualViewport);
      kbCleanups.forEach((fn) => fn());
    };
  }, []);
}
