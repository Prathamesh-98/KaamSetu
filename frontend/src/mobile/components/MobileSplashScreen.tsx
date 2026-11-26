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
 * - Charcoal background (#191919)
 * - Centered KaamSetu wordmark with White "Kaam" and Saffron "Setu" (#FF9933)
 * - Lightweight non-blocking backend warm-up ping to /health
 * - Fast, smooth transition into the app (no artificial multi-second delay)
 */
export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({ onFinish }) => {
  useStatusBar(true); // Dark status bar during splash
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 1. Hide native Capacitor splash screen immediately so our React animation takes over seamlessly
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
    }

    // 2. Lightweight backend warm-up ping in background (non-blocking)
    api.get('/health', { timeout: 3000 }).catch(() => {
      // Warm-up failure is non-fatal
    });

    // 3. Crisp, responsive startup duration (~750ms)
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 750);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {isVisible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: '#191919' }}
        >
          {/* Centered Wordmark */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="flex flex-col items-center"
          >
            {/* Logo Image */}
            <img
              src="/logo-dark.png"
              alt="KaamSetu"
              className="h-16 w-auto object-contain"
              loading="eager"
            />

            {/* Wordmark Typographic Fallback / Complement */}
            <div className="mt-4 flex items-center font-display tracking-tight text-3xl font-extrabold">
              <span className="text-white">Kaam</span>
              <span style={{ color: '#FF9933' }}>Setu</span>
            </div>

            <p className="mt-2 text-xs font-medium tracking-widest uppercase text-slate-400">
              Workforce Marketplace
            </p>
          </motion.div>

          {/* Bottom subtle indicator */}
          <div className="absolute bottom-8 flex flex-col items-center">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-neutral-800">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                className="h-full w-8 rounded-full"
                style={{ backgroundColor: '#FF9933' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileSplashScreen;
