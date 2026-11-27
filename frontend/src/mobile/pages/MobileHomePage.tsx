import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, Briefcase, Users, ShieldCheck, ChevronRight, 
  MapPin, Award, CheckCircle2, Star, ArrowRight, Zap 
} from 'lucide-react';
import { jobsApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import MobileHeader from '../components/MobileHeader';
import MobileJobCard from '../components/MobileJobCard';

const POPULAR_CATEGORIES = [
  { id: 'Construction', nameKey: 'categories.Construction', defaultName: 'Construction', icon: '🏗️', img: '/images/brick-workers.webp' },
  { id: 'Electrical', nameKey: 'categories.Electrical', defaultName: 'Electrical', icon: '⚡', img: '/images/electrician.webp' },
  { id: 'Plumbing', nameKey: 'categories.Plumbing', defaultName: 'Plumbing', icon: '🔧', img: '/images/plumber.webp' },
  { id: 'Driving', nameKey: 'categories.Driving', defaultName: 'Driving', icon: '🚗', img: '/images/mechanic.webp' },
  { id: 'Domestic Help', nameKey: 'categories.Domestic Help', defaultName: 'Domestic Help', icon: '🧹', img: '/images/textile-worker.webp' },
  { id: 'Farming', nameKey: 'categories.Farming', defaultName: 'Farming', icon: '🌾', img: '/images/agricultural-workers.webp' },
  { id: 'IT & Tech', nameKey: 'categories.IT & Tech', defaultName: 'IT & Tech', icon: '💻', img: '/images/electrical-team.webp' },
  { id: 'Painting', nameKey: 'categories.Painting', defaultName: 'Painting', icon: '🎨', img: '/images/carpenter.webp' },
];

export const MobileHomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real latest job openings
  const { data: latestJobsData, isLoading: isJobsLoading } = useQuery({
    queryKey: ['mobile-homepage-jobs'],
    queryFn: () => jobsApi.list({ sort_by: 'newest', per_page: 6 }),
  });

  const jobs = latestJobsData?.items || [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/worker/jobs?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/worker/jobs');
    }
  };

  return (
    <div className="mobile-app-root">
      {/* 1. Header with Logo, Language, Location, and Auth status */}
      <MobileHeader />

      {/* Main scrollable body */}
      <main className="mobile-content-area px-4 py-3 space-y-4">
        {/* 2. Compact Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('landing.searchPlaceholder', 'Search jobs, trades, or skills...')}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium shadow-sm focus:border-indigo-900 focus:outline-none"
          />
        </form>

        {/* 3. Primary Dual Action Cards: Find Work vs Hire Workers */}
        <div className="grid grid-cols-2 gap-3">
          {/* Find Work */}
          <div
            onClick={() => navigate('/worker/jobs')}
            className="rounded-2xl p-4 bg-gradient-to-br from-[#1F2A6B] to-[#2E3C8A] text-white shadow-sm flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm mb-2.5">
                <Briefcase className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="font-bold text-base leading-tight">
                {t('landing.findWork', 'Find Work')}
              </h2>
              <p className="mt-1 text-[11px] text-slate-200 line-clamp-2">
                {t('landing.workerSub', 'Daily wages & verified shifts')}
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-amber-300 gap-1">
              <span>{t('common.browse', 'Browse Jobs')}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>

          {/* Hire Workers */}
          <div
            onClick={() => {
              if (isAuthenticated && user?.role === 'EMPLOYER') {
                navigate('/employer/candidates');
              } else {
                navigate('/register?role=EMPLOYER');
              }
            }}
            className="rounded-2xl p-4 bg-gradient-to-br from-[#FFF5EB] to-[#FFE8D1] border border-amber-200/80 text-slate-900 shadow-sm flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF9933] text-white mb-2.5 shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-base leading-tight">
                {t('landing.hireWorkers', 'Hire Workers')}
              </h2>
              <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">
                {t('landing.employerSub', 'Skilled & verified local talent')}
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-indigo-900 gap-1">
              <span>{t('employer.postNew', 'Post / Hire')}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* 4. Popular Job Categories */}
        <section className="pt-2">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-slate-900">
              {t('landing.categoriesTitle', 'Popular Categories')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/worker/jobs')}
              className="text-xs font-semibold text-indigo-900 hover:underline"
            >
              {t('common.viewAll', 'View all')}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {POPULAR_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(`/worker/jobs?category=${encodeURIComponent(cat.id)}`)}
                className="flex flex-col items-center justify-center rounded-xl bg-white p-2.5 border border-slate-100 shadow-sm active:bg-slate-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center mb-1.5 shadow-inner">
                  <img
                    src={cat.img}
                    alt={cat.defaultName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="text-[11px] font-medium text-slate-700 text-center leading-tight line-clamp-1">
                  {t(cat.nameKey, cat.defaultName)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 5. Real Nearby / Recent Opportunities */}
        <section className="pt-2">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900">
                {t('landing.recentJobs', 'Recent Opportunities')}
              </h2>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <button
              type="button"
              onClick={() => navigate('/worker/jobs')}
              className="text-xs font-semibold text-indigo-900 hover:underline"
            >
              {t('common.viewAll', 'View all')}
            </button>
          </div>

          {isJobsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-28 rounded-2xl mobile-skeleton" />
              ))}
            </div>
          ) : jobs.length > 0 ? (
            <div className="space-y-2.5">
              {jobs.map((job) => (
                <MobileJobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/worker/jobs/${job.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-6 text-center border border-slate-100">
              <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">
                {t('jobs.noJobsFound', 'No jobs currently listed in this area')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/worker/jobs')}
                className="mt-3 inline-flex items-center rounded-xl bg-indigo-900 px-4 py-2 text-xs font-semibold text-white"
              >
                {t('jobs.browseAllJobs', 'Browse All Jobs')}
              </button>
            </div>
          )}
        </section>

        {/* 6. Trust & Verification Indicators */}
        <section className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm mt-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            {t('landing.trustTitle', 'Why Trust KaamSetu')}
          </h2>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {t('landing.trust.t1', 'Aadhaar & ID Verified')}
                </div>
                <div className="text-[10px] text-slate-500">
                  Trusted workforce & employers
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Award className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {t('landing.trust.t2', 'Fair Daily Wages')}
                </div>
                <div className="text-[10px] text-slate-500">
                  Transparent compensation
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Zap className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {t('landing.trust.t3', 'Instant Matching')}
                </div>
                <div className="text-[10px] text-slate-500">
                  Connect without middlemen
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Star className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {t('landing.trust.t4', 'Community Reviews')}
                </div>
                <div className="text-[10px] text-slate-500">
                  Genuine ratings from work
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Guest sign-up banner if not authenticated */}
        {!isAuthenticated && (
          <div className="rounded-2xl bg-indigo-900 text-white p-4 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="font-bold text-sm">{t('landing.joinToday', 'Join KaamSetu Today')}</h3>
              <p className="text-xs text-indigo-200 mt-0.5">{t('landing.tagline', 'Find jobs or hire verified workers')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="rounded-xl bg-[#FF9933] px-3.5 py-2 text-xs font-bold text-white shadow active:scale-95 transition-transform"
            >
              {t('common.getStarted', 'Get Started')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MobileHomePage;
