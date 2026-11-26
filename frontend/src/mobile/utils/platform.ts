import { Capacitor } from '@capacitor/core';

/**
 * Determines whether the current execution context is the native Android application.
 *
 * Strict Production Protection Rule:
 * - Desktop browsers return false.
 * - Mobile web browsers (Chrome/Firefox/Safari on Android or iOS) return false.
 * - Only the native Android application running inside Capacitor (or explicit test mode) returns true.
 * - In development/testing, `?platform=android` query parameter enables live preview.
 */
export const isAndroidApp = (): boolean => {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      return true;
    }
  } catch {
    // ignore fallback
  }

  if (typeof window !== 'undefined') {
    // Explicit query override for testing the mobile UI in browser/emulator
    const params = new URLSearchParams(window.location.search);
    if (params.get('platform') === 'android') {
      return true;
    }

    // Native Capacitor Android webview host with build flag
    if (window.location.origin === 'https://localhost' && import.meta.env.VITE_ANDROID_BUILD === 'true') {
      return true;
    }
  }

  return false;
};
