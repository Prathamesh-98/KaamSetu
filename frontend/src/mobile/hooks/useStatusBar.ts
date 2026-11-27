import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

/**
 * Controls Android Status Bar styling and edge-to-edge colors.
 * - isDark: true sets light icons on dark charcoal background (#191919) - for splash / dark screens
 * - isDark: false sets dark icons on light background (#FFFFFF) - for all main application screens
 */
export function useStatusBar(isDark = false) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      if (isDark) {
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#191919' }).catch(() => {});
      } else {
        StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});
      }
    } catch {
      // Ignore if status bar plugin is unsupported
    }
  }, [isDark]);
}

export async function setStatusBarLight() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
  } catch {}
}

export async function setStatusBarDark() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#191919' });
  } catch {}
}
