import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Shield, Star, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HERO_IMAGES = [
  '/images/electrician.webp',
  '/images/brick-workers.webp',
  '/images/agricultural-workers.webp',
  '/images/carpenter.webp',
  '/images/mechanic.webp',
  '/images/plumber.webp',
  '/images/electrical-team.webp',
  '/images/textile-worker.webp'
];

export default function HeroCarousel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');

  // Preload first image
  useEffect(() => {
    const img = new Image();
    img.src = HERO_IMAGES[0];
  }, []);

  // Carousel timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!service && !location) return;
    const params = new URLSearchParams();
    if (service) params.set('q', service);
    if (location) params.set('location', location);
    navigate(`/worker/jobs?${params.toString()}`);
  };

  return (
    <section className="relative w-full min-h-[100svh] flex items-center overflow-hidden bg-[#0B1735] pt-16">
      
      {/* Background Carousel */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence initial={false}>
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.8, ease: 'easeInOut' }, scale: { duration: 4, ease: 'linear' } }}
            className="absolute inset-0"
          >
            <img 
              src={HERO_IMAGES[currentIndex]} 
              alt="Worker hero" 
              className="w-full h-full object-cover object-[70%_30%]"
              onError={(e) => {
                console.error(`Failed to load hero image: ${e.currentTarget.src}`);
                e.currentTarget.style.display = 'none';
              }}
              onLoad={(e) => {
                e.currentTarget.style.display = 'block';
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Gradients */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#0B1735] via-[#0B1735]/80 to-transparent" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0B1735] via-transparent to-transparent" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#FF8A24]/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-[96rem] mx-auto px-4 sm:px-6 lg:pl-[3.5rem] lg:pr-[3.5rem] relative z-10 py-12 lg:py-24">
        <div className="max-w-2xl">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display font-black text-white leading-[1.1] mb-6 break-words">
              {t('landing.hero.headlineLine1')} <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8A24] to-[#FFB067] relative">
                {t('landing.hero.headlineLine2')}
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-[#FF8A24]/60" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
              </span><br/>
              {t('landing.hero.headlineLine3')}
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-blue-100/90 leading-relaxed mb-8 sm:mb-10 max-w-xl">
              {t('landing.hero.description')}
            </p>

            {/* Search Panel */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 md:p-3 shadow-2xl flex flex-col md:flex-row gap-2 mb-10 max-w-2xl border border-gray-100">
              <div className="flex-1 flex items-center gap-3 px-4 py-2 border-b md:border-b-0 md:border-r border-gray-100">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input 
                  type="text" 
                  placeholder={t('landing.hero.searchServicePlaceholder')}
                  className="w-full bg-transparent border-none focus:ring-0 text-dark placeholder-gray-400 outline-none"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                />
              </div>
              <div className="flex-1 flex items-center gap-3 px-4 py-2">
                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input 
                  type="text" 
                  placeholder={t('landing.hero.searchLocationPlaceholder')}
                  className="w-full bg-transparent border-none focus:ring-0 text-dark placeholder-gray-400 outline-none"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <button type="submit" className="bg-[#FF8A24] hover:bg-[#E67A1F] transition-colors text-white font-semibold rounded-xl px-8 py-3 md:py-4 shadow-lg flex-shrink-0">
                {t('landing.hero.searchBtn')}
              </button>
            </form>

            {/* Trust and statistics row */}
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-[#FF8A24]" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{t('landing.hero.feature1Title')}</div>
                  <div className="text-blue-200/70 text-xs">{t('landing.hero.feature1Desc')}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#FF8A24]" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{t('landing.hero.feature2Title')}</div>
                  <div className="text-blue-200/70 text-xs">{t('landing.hero.feature2Desc')}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Star className="w-4 h-4 text-[#FF8A24]" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{t('landing.hero.feature3Title')}</div>
                  <div className="text-blue-200/70 text-xs">{t('landing.hero.feature3Desc')}</div>
                </div>
              </div>
            </div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}
