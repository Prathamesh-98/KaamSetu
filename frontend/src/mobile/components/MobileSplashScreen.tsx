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
 * - Deep Charcoal background (#121624)
 * - Clear KaamSetu wordmark: Pure White "Kaam" and Saffron "Setu" (#FF9933)
 * - Smooth fade-in & scale presentation of ~2.2 seconds on cold launch
 * - Session flag prevents repetitive splash screens on internal navigation/resume
 * - Parallel non-blocking backend warm-up ping to /health
 */
export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({ onFinish }) => {
  useStatusBar(true); // Dark status bar during splash
  
  // Check if splash was already presented in this session
  const alreadyShown = typeof window !== 'undefined' && sessionStorage.getItem('kaamsetu_splash_presented') === '1';
  const [isVisible, setIsVisible] = useState(!alreadyShown);

  useEffect(() => {
    // If already shown in this app session, skip immediately
    if (alreadyShown) {
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide().catch(() => {});
      }
      onFinish();
      return;
    }

    // 1. Hide native Capacitor splash screen smoothly so our React animation takes over seamlessly
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
    }

    // 2. Parallel backend warm-up ping in background (non-blocking)
    api.get('/health', { timeout: 3500 }).catch(() => {
      // Warm-up failure is non-fatal
    });

    // 3. Branded startup presentation duration (~2.2 seconds on cold launch)
    const timer = setTimeout(() => {
      sessionStorage.setItem('kaamsetu_splash_presented', '1');
      setIsVisible(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [alreadyShown, onFinish]);

  if (alreadyShown) return null;

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {isVisible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: '#111827' }}
        >
          {/* Centered Wordmark & Brand Artwork */}
          <motion.div
            initial={{ opacity: 0, scale: 0.90, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center px-6 text-center"
          >
            {/* Logo Image */}
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#1F2A6B] to-[#312E81] p-3 shadow-xl border border-white/10">
              <img
                src="/logo-dark.png"
                alt="KaamSetu"
                className="h-full w-full object-contain"
                loading="eager"
              />
            </div>

            {/* Wordmark: White Kaam + Saffron Setu */}
            <div className="flex items-center font-display tracking-tight text-3xl font-extrabold">
              <span className="text-white">Kaam</span>
              <span style={{ color: '#FF9933' }}>Setu</span>
            </div>

            <p className="mt-2 text-xs font-semibold tracking-widest uppercase text-slate-400">
              Bharat's Skilled Workforce Marketplace
            </p>
          </motion.div>

          {/* Bottom subtle progress pulse */}
          <div className="absolute bottom-10 flex flex-col items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                className="h-full w-12 rounded-full"
                style={{ backgroundColor: '#FF9933' }}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-500 tracking-wide">
              Loading KaamSetu...
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileSplashScreen;
