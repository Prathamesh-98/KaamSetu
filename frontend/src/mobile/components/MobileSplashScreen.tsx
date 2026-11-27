import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import api from '../../api/client';
import { useStatusBar } from '../hooks/useStatusBar';

interface MobileSplashScreenProps {
  onFinish: () => void;
}

/**
 * Branded Native Android Startup Experience.
 * - Navy-dark background (#111827) with pure white "Kaam" + saffron "Setu" (#FF9933)
 * - ~1.6s smooth startup visibility with reduced-motion support
 * - Session flag prevents repeated splash on internal resume
 * - Non-blocking /health warmup ping
 */
export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({ onFinish }) => {
  useStatusBar(true);

  const alreadyShown = typeof window !== 'undefined' && sessionStorage.getItem('kaamsetu_splash_presented') === '1';
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [isVisible, setIsVisible] = useState(!alreadyShown);

  useEffect(() => {
    if (alreadyShown) {
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide().catch(() => {});
      }
      onFinish();
      return;
    }

    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
    }

    api.get('/health', { timeout: 3500 }).catch(() => {});

    const timer = setTimeout(() => {
      sessionStorage.setItem('kaamsetu_splash_presented', '1');
      setIsVisible(false);
    }, prefersReducedMotion ? 800 : 1650);

    return () => clearTimeout(timer);
  }, [alreadyShown, prefersReducedMotion, onFinish]);

  if (alreadyShown) return null;

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {isVisible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.98 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 0.3, ease: 'easeInOut' }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: '#111827' }}
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center px-6 text-center"
          >
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#1F2A6B] to-[#312E81] p-3 shadow-xl border border-white/10">
              <img
                src="/logo-dark.png"
                alt="KaamSetu"
                className="h-full w-full object-contain"
                loading="eager"
              />
            </div>

            <div className="flex items-center font-display tracking-tight text-3xl font-extrabold">
              <span className="text-white">Kaam</span>
              <span style={{ color: '#FF9933' }}>Setu</span>
            </div>

            <p className="mt-2 text-xs font-semibold tracking-widest uppercase text-slate-400">
              Bharat&apos;s Skilled Workforce Marketplace
            </p>
          </motion.div>

          {!prefersReducedMotion && (
            <div className="absolute bottom-10 flex flex-col items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
                  className="h-full w-12 rounded-full"
                  style={{ backgroundColor: '#FF9933' }}
                />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileSplashScreen;
