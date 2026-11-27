import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Search, MapPin, Briefcase, Calendar, FileText, Bookmark,
  ChevronRight, Zap, Clock, ShieldCheck, Globe, RefreshCw, Award
} from 'lucide-react';
import { workerApi, applicationsApi, jobsApi, notificationsApi, shiftsApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { WorkerProfile, Application, ShiftBooking } from '../../../types';
import MobileJobCard from '../../components/MobileJobCard';
import MobileLanguageModal from '../../components/MobileLanguageModal';
import MobileStatusBadge from '../../components/ui/MobileStatusBadge';
import { useStatusBar } from '../../hooks/useStatusBar';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';
import { useMobileSyncState } from '../../sync/MobileSyncContext';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';

export const MobileWorkerDashboard: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isSyncing, triggerSync } = useMobileSyncState();
  const [langModalOpen, setLangModalOpen] = useState(false);

  useStatusBar(false);

  const pollMs = useAdaptivePollInterval(10000, { enabled: !!user });

  const { data: profile } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.workerProfile(user?.id),
    queryFn: workerApi.getMyProfile,
    staleTime: 15000,
    refetchOnMount: 'always',
  });

  const { data: applications } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.workerApplications,
    queryFn: applicationsApi.list,
    refetchInterval: pollMs,
    staleTime: 8000,
    refetchOnMount: 'always',
  });

  const { data: savedJobs } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.savedJobs,
    queryFn: workerApi.getSavedJobs,
    staleTime: 15000,
    refetchOnMount: 'always',
  });

  const { data: shiftsData } = useQuery<ShiftBooking[]>({
    queryKey: MOBILE_QUERY_KEYS.workerBookings,
    queryFn: shiftsApi.getMyBookings,
    refetchInterval: pollMs,
    staleTime: 8000,
    refetchOnMount: 'always',
  });

  const { data: latestJobsData, isLoading: isJobsLoading } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.jobsList({ sort_by: 'newest', per_page: 5 }),
    queryFn: () => jobsApi.list({ sort_by: 'newest', per_page: 5 }),
    refetchInterval: pollMs ? pollMs * 2 : false,
    staleTime: 15000,
    refetchOnMount: 'always',
  });

  const { data: notifData } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount,
    queryFn: notificationsApi.getUnreadCount,
    staleTime: 5000,
  });

  const saveMutation = useMutation({
    mutationFn: (id: string) => workerApi.saveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedJobs }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (id: string) => workerApi.unsaveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedJobs }),
  });

  const savedJobIds = useMemo(() => {
    if (!Array.isArray(savedJobs)) return new Set<string>();
    return new Set(savedJobs.map((sj) => sj.job.id));
  }, [savedJobs]);

  const handleToggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (savedJobIds.has(id)) unsaveMutation.mutate(id);
    else saveMutation.mutate(id);
  };

  const completeness = useMemo(() => {
    if (!profile) return 0;
    const p = profile as WorkerProfile;
    const fields = [
      p.full_name,
      p.bio,
      p.city,
      p.state,
      p.years_experience !== null && p.years_experience !== undefined,
      p.expected_salary !== null && p.expected_salary !== undefined,
      p.availability_status,
      p.preferred_work_types && p.preferred_work_types.length > 0,
      p.skills && p.skills.length > 0,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  const appStats = useMemo(() => {
    const stats = { total: 0, pending: 0, shortlisted: 0, accepted: 0 };
    if (!Array.isArray(applications)) return stats;
    stats.total = applications.length;
    applications.forEach((app: Application) => {
      if (app.status === 'PENDING') stats.pending++;
      else if (app.status === 'SHORTLISTED') stats.shortlisted++;
      else if (app.status === 'ACCEPTED') stats.accepted++;
    });
    return stats;
  }, [applications]);

  const recentApps = useMemo(() => {
    if (!Array.isArray(applications)) return [];
    return [...applications]
      .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
      .slice(0, 3);
  }, [applications]);

  const upcomingShifts = useMemo(() => {
    if (!Array.isArray(shiftsData)) return [];
    return shiftsData.filter((s) => s.status === 'CONFIRMED' || s.status === 'PENDING');
  }, [shiftsData]);

  const jobs = latestJobsData?.items || [];
  const savedPreview = Array.isArray(savedJobs) ? savedJobs.slice(0, 3) : [];
  const unreadNotifs = notifData?.count || 0;
  const workerProfile = profile as WorkerProfile | null | undefined;
  const displayName = workerProfile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || t('roles.WORKER', 'Worker');

  return (
    <div className="flex flex-col">
      {/* Top Safe Header */}
      <header className="mobile-header-safe bg-white">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <MapPin className="h-3 w-3 text-amber-600 flex-shrink-0" />
              <span className="truncate">
                {workerProfile?.city
                  ? `${workerProfile.city}${workerProfile.state ? `, ${workerProfile.state}` : ''}`
                  : t('common.india', 'India')}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight truncate">
              {t('mobile:greetings.workerWelcome', { name: displayName, defaultValue: `Namaste, ${displayName}` })} 👋
            </h1>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => void triggerSync()}
              disabled={isSyncing}
              className="mobile-touch-target rounded-full p-2 text-slate-600 hover:bg-slate-100 active:scale-95"
              aria-label={t('mobile:sync.refresh', 'Refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-indigo-900' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setLangModalOpen(true)}
              className="mobile-touch-target rounded-full p-2 text-indigo-900 hover:bg-slate-100 active:scale-95"
              aria-label={t('nav.selectLanguage', 'Language')}
            >
              <Globe className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="mobile-touch-target relative rounded-full p-2 text-slate-700 hover:bg-slate-100 active:scale-95"
              aria-label={t('nav.notifications', 'Notifications')}
            >
              <Bell className="h-5 w-5 text-indigo-900" />
              {unreadNotifs > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadNotifs > 99 ? '99+' : unreadNotifs}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Search Bar Shortcut */}
        <button
          type="button"
          onClick={() => navigate('/worker/jobs')}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-xs active:bg-slate-50"
        >
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="flex-1 text-xs font-medium text-slate-500 truncate">
            {t('landing.searchPlaceholder', 'Search jobs, daily wages, locations...')}
          </span>
        </button>

        {/* Profile Completion Alert */}
        {completeness < 100 && (
          <button
            type="button"
            onClick={() => navigate('/worker/profile')}
            className="w-full rounded-2xl bg-gradient-to-r from-[#172154] to-[#1F2A6B] p-3.5 text-left text-white shadow-sm flex items-center justify-between active:scale-[0.99]"
          >
            <div className="flex-1 mr-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold">{t('worker.profileCompletion', 'Profile Strength')}</span>
                <span className="font-extrabold text-amber-400">{completeness}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <p className="text-[11px] text-indigo-100 mt-1.5">
                {t('mobile:dashboard.completeProfileCta', 'Complete your profile to unlock 3x more matches')}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-indigo-200 flex-shrink-0" />
          </button>
        )}

        {/* 4 KPI Stat Cards (Full parity with website) */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => navigate('/worker/applications')}
            className="rounded-2xl bg-white p-2.5 border border-slate-100 shadow-xs text-center active:scale-95"
          >
            <div className="text-lg font-extrabold text-indigo-900">{appStats.total}</div>
            <div className="text-[10px] font-semibold text-slate-500 truncate">
              {t('mobile:dashboard.totalApps', 'Applied')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/worker/applications')}
            className="rounded-2xl bg-white p-2.5 border border-slate-100 shadow-xs text-center active:scale-95"
          >
            <div className="text-lg font-extrabold text-amber-600">{appStats.shortlisted}</div>
            <div className="text-[10px] font-semibold text-slate-500 truncate">
              {t('mobile:dashboard.shortlisted', 'Shortlisted')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/worker/applications')}
            className="rounded-2xl bg-white p-2.5 border border-slate-100 shadow-xs text-center active:scale-95"
          >
            <div className="text-lg font-extrabold text-emerald-600">{appStats.accepted}</div>
            <div className="text-[10px] font-semibold text-slate-500 truncate">
              {t('mobile:dashboard.accepted', 'Accepted')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/worker/saved-jobs')}
            className="rounded-2xl bg-white p-2.5 border border-slate-100 shadow-xs text-center active:scale-95"
          >
            <div className="text-lg font-extrabold text-purple-700">{savedJobs?.length || 0}</div>
            <div className="text-[10px] font-semibold text-slate-500 truncate">
              {t('mobile:dashboard.saved', 'Saved')}
            </div>
          </button>
        </div>

        {/* Quick Actions Grid (All Sidebar Destinations Accessible) */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            {t('mobile:dashboard.quickActions', 'Quick Actions')}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { path: '/worker/jobs', icon: Briefcase, bg: 'bg-indigo-50 text-indigo-900', label: t('nav.findJobs', 'Find Jobs') },
              { path: '/worker/applications', icon: FileText, bg: 'bg-emerald-50 text-emerald-700', label: t('nav.myApplications', 'Applications') },
              { path: '/worker/shifts', icon: Calendar, bg: 'bg-amber-50 text-amber-700', label: t('worker.shiftsShort', 'My Shifts') },
              { path: '/worker/availability', icon: Clock, bg: 'bg-sky-50 text-sky-700', label: t('worker.availability', 'Availability') },
              { path: '/worker/saved-jobs', icon: Bookmark, bg: 'bg-purple-50 text-purple-700', label: t('nav.savedJobs', 'Saved Jobs') },
              { path: '/worker/verification', icon: ShieldCheck, bg: 'bg-teal-50 text-teal-700', label: t('worker.trustVerification', 'Verify ID') },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 border border-slate-100 shadow-xs active:bg-slate-50 min-h-[76px]"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg} mb-1.5`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 text-center line-clamp-1">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Profile At a Glance (Availability & Skills Summary) */}
        {workerProfile && (
          <section className="rounded-2xl bg-white p-4 border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('mobile:dashboard.atAGlance', 'Profile At a Glance')}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/worker/availability')}
                className="text-xs font-bold text-indigo-900"
              >
                {t('mobile:dashboard.manageAvailability', 'Manage Slots')}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                {t('mobile:dashboard.availabilityStatus', 'Availability')}
              </span>
              <MobileStatusBadge status={workerProfile.availability_status} variant="availability" />
            </div>

            {workerProfile.skills && workerProfile.skills.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-amber-600" />
                  <span>{t('mobile:dashboard.mySkills', 'My Skills')}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {workerProfile.skills.slice(0, 5).map((ws) => (
                    <span
                      key={ws.id}
                      className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-900 border border-indigo-100"
                    >
                      {t(`skills.${ws.skill.name}`, { defaultValue: ws.skill.name })}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Upcoming Shifts */}
        <section className="rounded-2xl bg-white p-4 border border-slate-100 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('mobile:dashboard.upcomingShiftsSection', 'Upcoming Shifts')} ({upcomingShifts.length})
            </h2>
            <button
              type="button"
              onClick={() => navigate('/worker/shifts?tab=completed')}
              className="text-xs font-bold text-indigo-900"
            >
              {t('mobile:shifts.completedTab', 'Completed & Paid')}
            </button>
          </div>

          {upcomingShifts.length > 0 ? (
            <div className="space-y-2">
              {upcomingShifts.slice(0, 2).map((shift) => (
                <button
                  type="button"
                  key={shift.id}
                  onClick={() => navigate('/worker/shifts')}
                  className="w-full rounded-xl bg-slate-50 p-3 flex items-center justify-between text-left border border-slate-100"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {shift.job?.title || t('shifts.shiftBooking', 'Shift Booking')}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(shift.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
                        {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {shift.proposed_rate && (
                      <div className="text-xs font-extrabold text-indigo-900 mb-1">
                        ₹{Number(shift.proposed_rate).toLocaleString()}
                      </div>
                    )}
                    <MobileStatusBadge status={shift.status} variant="booking" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t('mobile:shifts.noUpcoming', 'No upcoming shifts')}</p>
          )}
        </section>

        {/* Recent Applications Preview */}
        {recentApps.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('mobile:dashboard.recentApplications', 'Recent Applications')}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/worker/applications')}
                className="text-xs font-bold text-indigo-900"
              >
                {t('mobile:dashboard.viewAll', 'View All')}
              </button>
            </div>
            <div className="space-y-2">
              {recentApps.map((app) => (
                <button
                  type="button"
                  key={app.id}
                  onClick={() => navigate(`/worker/jobs/${app.job.id}`)}
                  className="mobile-card w-full p-3 flex items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">{app.job.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {app.job.employer?.organization_name || app.job.city}
                    </div>
                  </div>
                  <MobileStatusBadge status={app.status} variant="application" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Recommended / Latest Jobs */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>{t('mobile:dashboard.recommendedJobs', 'Recommended Jobs')}</span>
            </h2>
            <button
              type="button"
              onClick={() => navigate('/worker/jobs')}
              className="text-xs font-bold text-indigo-900"
            >
              {t('mobile:dashboard.viewAll', 'View All')}
            </button>
          </div>

          {isJobsLoading ? (
            <div className="space-y-2.5">
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
                  isSaved={savedJobIds.has(job.id)}
                  onToggleSave={handleToggleSave}
                  onClick={() => navigate(`/worker/jobs/${job.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-6 text-center border border-slate-100">
              <p className="text-xs text-slate-500">{t('worker.noNewJobs', 'No active jobs right now.')}</p>
            </div>
          )}
        </section>

        {/* Saved Jobs Preview */}
        {savedPreview.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('mobile:dashboard.savedJobsPreview', 'Saved Jobs')}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/worker/saved-jobs')}
                className="text-xs font-bold text-indigo-900"
              >
                {t('mobile:dashboard.viewAll', 'View All')}
              </button>
            </div>
            <div className="space-y-2">
              {savedPreview.map((sj) => (
                <button
                  type="button"
                  key={sj.id}
                  onClick={() => navigate(`/worker/jobs/${sj.job.id}`)}
                  className="mobile-card w-full p-3 flex items-center justify-between text-left"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-bold text-slate-900 truncate">{sj.job.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{sj.job.city}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <MobileLanguageModal isOpen={langModalOpen} onClose={() => setLangModalOpen(false)} />
    </div>
  );
};

export default MobileWorkerDashboard;
