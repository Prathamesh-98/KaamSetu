import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, Search, MapPin, Briefcase, Calendar, FileText, Bookmark, 
  CheckCircle2, Clock, ChevronRight, Zap, AlertCircle, ArrowUpRight 
} from 'lucide-react';
import { workerApi, applicationsApi, jobsApi, notificationsApi, shiftsApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { WorkerProfile, Application, JobListItem } from '../../../types';
import MobileJobCard from '../../components/MobileJobCard';
import { useStatusBar } from '../../hooks/useStatusBar';

export const MobileWorkerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useStatusBar(false);

  // Parallel data loading
  const { data: profile } = useQuery({
    queryKey: ['worker-profile', user?.id],
    queryFn: workerApi.getMyProfile,
  });

  const { data: applications } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationsApi.list,
  });

  const { data: savedJobs } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: workerApi.getSavedJobs,
  });

  const { data: shiftsData } = useQuery({
    queryKey: ['worker-shifts-me'],
    queryFn: shiftsApi.getMyBookings,
  });

  const { data: latestJobsData, isLoading: isJobsLoading } = useQuery({
    queryKey: ['jobs', { sort_by: 'newest', per_page: 5 }],
    queryFn: () => jobsApi.list({ sort_by: 'newest', per_page: 5 }),
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationsApi.getUnreadCount,
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (id: string) => workerApi.saveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (id: string) => workerApi.unsaveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  });

  const savedJobIds = useMemo(() => {
    if (!savedJobs || !Array.isArray(savedJobs)) return new Set<string>();
    return new Set(savedJobs.map((sj) => sj.job.id));
  }, [savedJobs]);

  const handleToggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (savedJobIds.has(id)) unsaveMutation.mutate(id);
    else saveMutation.mutate(id);
  };

  // Profile Completeness
  const completeness = useMemo(() => {
    if (!profile) return 0;
    const p = profile as WorkerProfile;
    const fields = [
      p.full_name,
      p.bio,
      p.city,
      p.state,
      p.years_experience !== null,
      p.expected_salary !== null,
      p.availability_status,
      p.preferred_work_types && p.preferred_work_types.length > 0,
      p.skills && p.skills.length > 0,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  // Application Stats
  const appStats = useMemo(() => {
    const stats = { total: 0, pending: 0, shortlisted: 0, accepted: 0 };
    if (!applications || !Array.isArray(applications)) return stats;
    stats.total = applications.length;
    (applications as Application[]).forEach((app) => {
      if (app.status === 'PENDING') stats.pending++;
      else if (app.status === 'SHORTLISTED') stats.shortlisted++;
      else if (app.status === 'ACCEPTED') stats.accepted++;
    });
    return stats;
  }, [applications]);

  const upcomingShifts = useMemo(() => {
    if (!shiftsData || !Array.isArray(shiftsData)) return [];
    return shiftsData.filter((s: any) => s.status === 'ACCEPTED' || s.status === 'PENDING');
  }, [shiftsData]);

  const jobs = latestJobsData?.items || [];
  const unreadNotifs = notifData && typeof notifData === 'object' && 'count' in notifData ? (notifData as { count: number }).count : 0;
  const workerProfile = profile as WorkerProfile | null | undefined;

  return (
    <div className="p-4 space-y-4">
      {/* 1. Compact Header Greeting & Location */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="truncate">{workerProfile?.city || 'India'}</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5 truncate">
            Namaste, {workerProfile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]} 👋
          </h1>
        </div>

        {/* Notification Icon */}
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="mobile-touch-target flex-shrink-0 min-h-[48px] min-w-[48px] relative rounded-full bg-white p-2.5 text-slate-700 shadow-sm border border-slate-100 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-indigo-900" />
          {unreadNotifs > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {unreadNotifs}
            </span>
          )}
        </button>
      </div>

      {/* 2. Compact Search Bar */}
      <div
        onClick={() => navigate('/worker/jobs')}
        className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-400 shadow-sm cursor-pointer"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span className="flex-1 text-xs font-medium text-slate-500">
          {t('landing.searchPlaceholder', 'Search jobs, daily wages, locations...')}
        </span>
      </div>

      {/* 3. Profile Completion Alert (if < 100%) */}
      {completeness < 100 && (
        <div
          onClick={() => navigate('/worker/profile')}
          className="rounded-2xl bg-gradient-to-r from-indigo-900 to-[#2E3C8A] p-3.5 text-white shadow-sm flex items-center justify-between cursor-pointer"
        >
          <div className="flex-1 mr-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold">{t('worker.profileComplete', 'Profile Strength')}</span>
              <span className="font-extrabold text-amber-400">{completeness}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="text-[11px] text-indigo-200 mt-1">
              Complete profile to receive 3x more shift requests
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-indigo-200" />
        </div>
      )}

      {/* 4. Quick Action Grid */}
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => navigate('/worker/jobs')}
          className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 border border-slate-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-900 mb-1">
            <Briefcase className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">{t('nav.jobs', 'Find Jobs')}</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/worker/shifts')}
          className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 border border-slate-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 mb-1">
            <Calendar className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">{t('worker.shifts', 'My Shifts')}</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/worker/applications')}
          className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 border border-slate-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-1">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">{t('nav.applications', 'Applied')}</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/worker/saved-jobs')}
          className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 border border-slate-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 mb-1">
            <Bookmark className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">{t('nav.savedJobs', 'Saved')}</span>
        </button>
      </div>

      {/* 5. Application Status Summary Cards */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          {t('worker.applicationSummary', 'Application Status')}
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          <div
            onClick={() => navigate('/worker/applications')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="text-lg font-extrabold text-amber-600">{appStats.pending}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {t('status.pending', 'Pending')}
            </div>
          </div>

          <div
            onClick={() => navigate('/worker/applications')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="text-lg font-extrabold text-indigo-900">{appStats.shortlisted}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {t('status.shortlisted', 'Shortlisted')}
            </div>
          </div>

          <div
            onClick={() => navigate('/worker/applications')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="text-lg font-extrabold text-emerald-600">{appStats.accepted}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {t('status.accepted', 'Accepted')}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Upcoming Shifts Card (if any) */}
      {upcomingShifts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t('worker.upcomingShifts', 'Upcoming Shifts')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/worker/shifts')}
              className="text-xs font-semibold text-indigo-900"
            >
              {t('common.viewAll', 'View all')}
            </button>
          </div>

          <div className="rounded-2xl bg-white p-3.5 border border-slate-100 shadow-sm space-y-2">
            {upcomingShifts.slice(0, 2).map((shift: any) => (
              <div
                key={shift.id}
                onClick={() => navigate('/worker/shifts')}
                className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">{shift.job?.title || 'Shift Booking'}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>{shift.shift_date || 'Upcoming'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-indigo-900">₹{shift.agreed_wage || shift.job?.salary_min || 0}</div>
                  <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {shift.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Recommended & Nearby Jobs */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('worker.recommendedJobs', 'Recommended Jobs')}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/worker/jobs')}
            className="text-xs font-semibold text-indigo-900"
          >
            {t('common.viewAll', 'View all')}
          </button>
        </div>

        {isJobsLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {jobs.map((job: JobListItem) => (
              <MobileJobCard
                key={job.id}
                job={job}
                isSaved={savedJobIds.has(job.id)}
                onToggleSave={handleToggleSave}
                onClick={() => navigate(`/worker/jobs/${job.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MobileWorkerDashboard;
