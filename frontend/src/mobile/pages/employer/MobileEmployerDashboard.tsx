import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Bell, Plus, Users, Briefcase, Clock, FileText, CheckCircle2, 
  ChevronRight, ArrowUpRight, TrendingUp, AlertCircle, Building2 
} from 'lucide-react';
import { employerApi, jobsApi, applicationsApi, notificationsApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { JobListItem, Application, EmployerProfile } from '../../../types';
import { useStatusBar } from '../../hooks/useStatusBar';

export const MobileEmployerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  useStatusBar(false);

  // Parallel data loading
  const { data: profile } = useQuery({
    queryKey: ['employer-profile', user?.id],
    queryFn: employerApi.getMyProfile,
  });

  const { data: jobs, isLoading: isJobsLoading } = useQuery({
    queryKey: ['employer-jobs'],
    queryFn: () => jobsApi.myJobs(),
  });

  const { data: applications } = useQuery({
    queryKey: ['employer-applications'],
    queryFn: applicationsApi.list,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationsApi.getUnreadCount,
  });

  const activeJobs = useMemo(() => Array.isArray(jobs) ? jobs.filter((j: JobListItem) => j.status === 'ACTIVE') : [], [jobs]);
  const appList = Array.isArray(applications) ? applications : [];
  const pendingApplicants = useMemo(() => appList.filter((a: Application) => a.status === 'PENDING'), [appList]);
  const acceptedApplicants = useMemo(() => appList.filter((a: Application) => a.status === 'ACCEPTED'), [appList]);

  const recentJobs = useMemo(() => {
    if (!Array.isArray(jobs)) return [];
    return [...jobs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  }, [jobs]);

  const unreadNotifs = notifData && typeof notifData === 'object' && 'count' in notifData ? (notifData as { count: number }).count : 0;
  const employerProfile = profile as EmployerProfile | null | undefined;

  return (
    <div className="p-4 space-y-4">
      {/* 1. Header Greeting & Post Job Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Building2 className="h-3.5 w-3.5 text-indigo-900 flex-shrink-0" />
            <span className="truncate">{employerProfile?.organization_name || 'Employer Portal'}</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5 truncate">
            Welcome, {employerProfile?.organization_name?.split(' ')[0] || user?.email?.split('@')[0]} 👋
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

      {/* 2. Prominent Post Job Banner */}
      <div
        onClick={() => navigate('/employer/post-job')}
        className="rounded-3xl p-4 bg-gradient-to-r from-indigo-900 to-[#2E3C8A] text-white shadow-md flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF9933] text-white shadow">
            <Plus className="h-6 w-6 stroke-[3]" />
          </div>
          <div>
            <h2 className="font-extrabold text-base leading-tight">Post a New Job</h2>
            <p className="text-xs text-indigo-200 mt-0.5">Hire verified workers in hours</p>
          </div>
        </div>
        <div className="rounded-full bg-white/15 p-2 backdrop-blur-sm">
          <ChevronRight className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* 3. Key Metrics Cards */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Hiring Overview
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          <div
            onClick={() => navigate('/employer/jobs')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="text-lg font-extrabold text-indigo-900">{activeJobs.length}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">Active Jobs</div>
          </div>

          <div
            onClick={() => navigate('/employer/jobs')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="text-lg font-extrabold text-amber-600">{pendingApplicants.length}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">Pending</div>
          </div>

          <div
            onClick={() => navigate('/employer/jobs')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="text-lg font-extrabold text-emerald-600">{acceptedApplicants.length}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">Hired</div>
          </div>
        </div>
      </section>

      {/* 4. Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/employer/candidates')}
          className="flex items-center gap-3 rounded-2xl bg-white p-3.5 border border-slate-100 shadow-sm active:bg-slate-50 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 flex-shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Find Workers</div>
            <div className="text-[10px] text-slate-500">Discover local talent</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/employer/shifts')}
          className="flex items-center gap-3 rounded-2xl bg-white p-3.5 border border-slate-100 shadow-sm active:bg-slate-50 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 flex-shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Shifts & Settlement</div>
            <div className="text-[10px] text-slate-500">Track completions</div>
          </div>
        </button>
      </div>

      {/* 5. Active Job Listings */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Your Active Postings
          </h2>
          <button
            type="button"
            onClick={() => navigate('/employer/jobs')}
            className="text-xs font-semibold text-indigo-900"
          >
            {t('common.viewAll', 'View all')}
          </button>
        </div>

        {isJobsLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : recentJobs.length > 0 ? (
          <div className="space-y-2.5">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
                className="mobile-card p-3.5 active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{job.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {job.city || 'India'} · {job.work_type ? job.work_type.replace('_', ' ') : 'Full Time'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    job.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {job.status}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                  <span className="font-extrabold text-indigo-900">
                    ₹{job.salary_min || 0} - ₹{job.salary_max || 0}
                  </span>
                  <div className="flex items-center gap-1 text-slate-600 font-semibold text-xs">
                    <Users className="h-3.5 w-3.5 text-amber-600" />
                    <span>View Applicants</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm">
            <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">No Jobs Posted Yet</h3>
            <p className="text-xs text-slate-500 mt-1">Post your first job opening to start hiring skilled workers.</p>
            <button
              type="button"
              onClick={() => navigate('/employer/post-job')}
              className="mt-3 inline-flex items-center rounded-xl bg-indigo-900 px-4 py-2 text-xs font-semibold text-white gap-1.5 shadow"
            >
              <Plus className="h-4 w-4" />
              <span>Post a Job</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default MobileEmployerDashboard;
