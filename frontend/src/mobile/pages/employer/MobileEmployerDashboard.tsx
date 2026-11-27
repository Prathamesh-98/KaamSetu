import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Plus, Users, Briefcase, Clock, CheckCircle2, ChevronRight,
  Building2, Globe, RefreshCw, Bookmark, ShieldCheck, MessageSquare, Eye, Sparkles
} from 'lucide-react';
import { employerApi, jobsApi, applicationsApi, notificationsApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { JobListItem, Application, EmployerProfile } from '../../../types';
import { useStatusBar } from '../../hooks/useStatusBar';
import MobileLanguageModal from '../../components/MobileLanguageModal';
import { MobileStatusBadge } from '../../components/ui/MobileStatusBadge';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';
import { useMobileSyncState } from '../../sync/MobileSyncContext';

export const MobileEmployerDashboard: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isSyncing, triggerSync } = useMobileSyncState();
  const [langModalOpen, setLangModalOpen] = useState(false);
  useStatusBar(false);

  const poll = useAdaptivePollInterval(20000);

  const { data: profile } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.employerProfile(user?.id),
    queryFn: employerApi.getMyProfile,
  });

  const { data: jobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.employerJobs,
    queryFn: () => jobsApi.myJobs(),
    refetchInterval: poll,
  });

  const { data: applications = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.employerApplications,
    queryFn: applicationsApi.list,
    refetchInterval: poll,
  });

  const { data: notifData } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount,
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: poll,
  });

  const employerProfile = profile as EmployerProfile | null | undefined;
  const jobList = Array.isArray(jobs) ? jobs : [];
  const appList = Array.isArray(applications) ? applications : [];

  const activeJobs = useMemo(() => jobList.filter((j: JobListItem) => j.status === 'ACTIVE'), [jobList]);
  const pendingApplicants = useMemo(() => appList.filter((a: Application) => a.status === 'PENDING'), [appList]);
  const acceptedApplicants = useMemo(() => appList.filter((a: Application) => a.status === 'ACCEPTED'), [appList]);

  const recentJobs = useMemo(
    () =>
      [...jobList]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [jobList]
  );

  // 7-field company profile completion matching EmployerDashboard.tsx
  const completionPct = useMemo(() => {
    if (!employerProfile) return 0;
    const fields = [
      employerProfile.organization_name,
      employerProfile.full_name,
      employerProfile.organization_type,
      employerProfile.city,
      employerProfile.state,
      employerProfile.bio,
      employerProfile.profile_image_url,
    ];
    const filled = fields.filter((f) => Boolean(f && String(f).trim())).length;
    return Math.round((filled / fields.length) * 100);
  }, [employerProfile]);

  const unreadNotifs =
    notifData && typeof notifData === 'object' && 'count' in notifData
      ? (notifData as { count: number }).count
      : 0;

  const firstName =
    employerProfile?.organization_name?.split(' ')[0] ||
    employerProfile?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Partner';

  return (
    <div className="p-4 space-y-4">
      {/* 1. Header Greeting & Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Building2 className="h-3.5 w-3.5 text-indigo-900 flex-shrink-0" />
            <span className="truncate">
              {employerProfile?.organization_name || t('mobile:greetings.employerPortal', 'Employer Portal')}
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5 truncate">
            {t('mobile:greetings.employerWelcome', {
              name: firstName,
              defaultValue: `Welcome, ${firstName}`,
            })}
          </h1>
          <p className="text-[11px] text-slate-500 truncate">
            {t('mobile:greetings.employerSubtitle', 'Manage jobs, candidates & shifts')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => triggerSync()}
            className="mobile-touch-target rounded-full bg-white p-2 text-slate-700 shadow-sm border border-slate-100"
            aria-label={t('mobile:sync.refresh', 'Refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-indigo-700' : 'text-slate-600'}`} />
          </button>

          <button
            type="button"
            onClick={() => setLangModalOpen(true)}
            className="mobile-touch-target rounded-full bg-white p-2 text-slate-700 shadow-sm border border-slate-100"
            aria-label={t('nav.selectLanguage', 'Language')}
          >
            <Globe className="h-4 w-4 text-indigo-900" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="mobile-touch-target relative rounded-full bg-white p-2 text-slate-700 shadow-sm border border-slate-100"
            aria-label={t('nav.notifications', 'Notifications')}
          >
            <Bell className="h-5 w-5 text-indigo-900" />
            {unreadNotifs > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] px-0.5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Company Profile Completion CTA */}
      {completionPct < 100 && (
        <div
          onClick={() => navigate('/employer/profile')}
          className="mobile-card p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-600" />
              {t('mobile:dashboard.companyStrength', 'Company Profile Strength')}
            </span>
            <span className="text-xs font-black text-amber-900">{completionPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-amber-200/70 overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-amber-600 transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800">
            <span>{t('mobile:dashboard.completeCompanyCta', 'Complete company details to build worker trust')}</span>
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          </div>
        </div>
      )}

      {/* 3. Prominent Post Job Banner */}
      <div
        onClick={() => navigate('/employer/post-job')}
        className="rounded-3xl p-4 bg-gradient-to-r from-indigo-900 to-[#2E3C8A] text-white shadow-md flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF9933] text-white shadow">
            <Plus className="h-6 w-6 stroke-[3]" />
          </div>
          <div>
            <h2 className="font-extrabold text-base leading-tight">
              {t('employer.postNew', 'Post a New Job')}
            </h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              {t('employer.hireSubtitle', 'Hire verified workers in hours')}
            </p>
          </div>
        </div>
        <div className="rounded-full bg-white/15 p-2 backdrop-blur-sm">
          <ChevronRight className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* 4. 5-KPI Hiring Overview */}
      <section className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div
            onClick={() => navigate('/employer/jobs')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95"
          >
            <div className="text-lg font-extrabold text-slate-900">{jobList.length}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {t('mobile:dashboard.totalJobs', 'Total Jobs')}
            </div>
          </div>
          <div
            onClick={() => navigate('/employer/jobs')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95"
          >
            <div className="text-lg font-extrabold text-indigo-900">{activeJobs.length}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {t('mobile:dashboard.activeJobs', 'Active Jobs')}
            </div>
          </div>
          <div
            onClick={() => navigate('/employer/jobs')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm text-center cursor-pointer active:scale-95"
          >
            <div className="text-lg font-extrabold text-blue-700">{appList.length}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {t('mobile:dashboard.totalApplicants', 'Applicants')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            onClick={() => navigate('/employer/jobs')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer active:scale-95"
          >
            <span className="text-xs font-semibold text-slate-600">{t('mobile:dashboard.pending', 'Pending')}</span>
            <span className="text-base font-extrabold text-amber-600">{pendingApplicants.length}</span>
          </div>
          <div
            onClick={() => navigate('/employer/shifts')}
            className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer active:scale-95"
          >
            <span className="text-xs font-semibold text-slate-600">{t('mobile:dashboard.hired', 'Hired')}</span>
            <span className="text-base font-extrabold text-emerald-600">{acceptedApplicants.length}</span>
          </div>
        </div>
      </section>

      {/* 5. Quick Actions Grid */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          {t('mobile:dashboard.quickActions', 'Quick Actions')}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('employer.findWorkers', 'Candidates'), icon: Users, color: 'bg-amber-50 text-amber-700', path: '/employer/candidates' },
            { label: t('employer.manageJobs', 'My Jobs'), icon: Briefcase, color: 'bg-indigo-50 text-indigo-800', path: '/employer/jobs' },
            { label: t('mobile:employerFlow.savedWorkersTitle', 'Saved Workers'), icon: Bookmark, color: 'bg-rose-50 text-rose-700', path: '/employer/saved-workers' },
            { label: t('mobile:shifts.employerTitle', 'Shifts'), icon: Clock, color: 'bg-emerald-50 text-emerald-700', path: '/employer/shifts' },
            { label: t('nav.messages', 'Messages'), icon: MessageSquare, color: 'bg-cyan-50 text-cyan-700', path: '/employer/messages' },
            { label: t('verification.verifyCompany', 'Verification'), icon: ShieldCheck, color: 'bg-purple-50 text-purple-700', path: '/employer/verification' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="mobile-card p-3 flex flex-col items-center justify-center gap-1.5 text-center active:scale-95"
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${item.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800 line-clamp-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6. Needs Attention (Pending Applications) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('mobile:dashboard.needsAttention', 'Needs Attention')}
          </h2>
          {pendingApplicants.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
              {pendingApplicants.length}
            </span>
          )}
        </div>

        {pendingApplicants.length > 0 ? (
          <div className="space-y-2">
            {pendingApplicants.slice(0, 4).map((app: any) => (
              <div
                key={app.id}
                onClick={() => {
                  const targetJobId = app.job?.id || app.job_id;
                  if (targetJobId) navigate(`/employer/jobs/${targetJobId}/applicants`);
                }}
                className="mobile-card p-3 flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {app.worker?.full_name || t('common.worker', 'Applicant')}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {t('mobile:dashboard.appliedFor', 'applied for')}{' '}
                    <span className="font-semibold text-slate-700">{app.job?.title || 'Job'}</span>
                  </div>
                </div>
                <span className="rounded-xl bg-indigo-900 px-3 py-1.5 text-[11px] font-bold text-white flex-shrink-0">
                  {t('mobile:dashboard.review', 'Review')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mobile-card p-4 text-center text-xs text-slate-500">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            {t('mobile:dashboard.allCaughtUp', "You're all caught up! No pending applications.")}
          </div>
        )}
      </section>

      {/* 7. Job Performance */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('mobile:dashboard.jobPerformance', 'Job Performance')}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/employer/jobs')}
            className="text-xs font-semibold text-indigo-900"
          >
            {t('mobile:dashboard.viewAll', 'View All')}
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{job.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {job.city || 'India'} · {job.work_type ? job.work_type.replace('_', ' ') : 'Full Time'}
                    </p>
                  </div>
                  <MobileStatusBadge status={job.status} />
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                  <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                      {job.views_count || 0} {t('mobile:dashboard.views', 'Views')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-indigo-900">
                      <Users className="h-3.5 w-3.5 text-amber-600" />
                      {job.applications_count || 0} {t('mobile:employerFlow.viewApplicants', 'Applicants')}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mobile-card p-6 text-center space-y-2">
            <Briefcase className="h-9 w-9 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">
              {t('mobile:dashboard.noJobsYet', 'No jobs posted yet')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('mobile:dashboard.postFirstJob', 'Post a job to start hiring verified workers')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/employer/post-job')}
              className="mt-2 inline-flex items-center rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white gap-1.5 shadow"
            >
              <Plus className="h-4 w-4" />
              <span>{t('employer.postNew', 'Post a New Job')}</span>
            </button>
          </div>
        )}
      </section>

      {/* 8. Recently Hired Workers */}
      {acceptedApplicants.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            {t('mobile:dashboard.recentlyAccepted', 'Recently Hired Workers')}
          </h2>
          <div className="space-y-2">
            {acceptedApplicants.slice(0, 3).map((app: any) => (
              <div
                key={app.id}
                onClick={() =>
                  app.worker?.id && navigate(`/employer/workers/${app.worker.id}`)
                }
                className="mobile-card p-3 flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {app.worker?.full_name || 'Hired Worker'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{app.job?.title}</div>
                </div>
                <MobileStatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      <MobileLanguageModal
        isOpen={langModalOpen}
        onClose={() => {
          setLangModalOpen(false);
          queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerJobs });
        }}
      />
    </div>
  );
};

export default MobileEmployerDashboard;
