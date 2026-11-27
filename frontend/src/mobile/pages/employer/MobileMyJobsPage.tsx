import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, Users, Plus, AlertCircle, RefreshCw,
  Edit3, Trash2, Eye, MapPin, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import type { JobListItem } from '../../../types';
import { useStatusBar } from '../../hooks/useStatusBar';
import { MobileStatusBadge } from '../../components/ui/MobileStatusBadge';
import { MOBILE_QUERY_KEYS, invalidateJobSync } from '../../sync/queryKeys';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';

export const MobileMyJobsPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useStatusBar(false);

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');
  const poll = useAdaptivePollInterval(20000);

  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.employerJobs,
    queryFn: () => jobsApi.myJobs(),
    refetchInterval: poll,
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.delete(jobId),
    onSuccess: () => {
      toast.success(t('jobs.deletedSuccess', 'Job posting closed/removed.'));
      invalidateJobSync(queryClient);
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to delete job'),
  });

  const jobList = Array.isArray(jobs) ? jobs : [];
  const activeJobs = useMemo(() => jobList.filter((j: JobListItem) => j.status === 'ACTIVE'), [jobList]);
  const closedJobs = useMemo(() => jobList.filter((j: JobListItem) => j.status !== 'ACTIVE'), [jobList]);
  const totalApplicants = useMemo(
    () => jobList.reduce((acc, j: JobListItem) => acc + (j.applications_count || 0), 0),
    [jobList]
  );

  const filteredJobs = activeTab === 'ACTIVE' ? activeJobs : closedJobs;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex-1 min-w-0 truncate text-lg font-extrabold text-slate-900 tracking-tight">
          {t('employer.manageJobs', 'Manage Job Postings')}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/employer/post-job')}
          className="flex-shrink-0 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>{t('employer.postNew', 'New Job')}</span>
        </button>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="mobile-card p-2.5 text-center">
          <div className="text-base font-extrabold text-indigo-900">{activeJobs.length}</div>
          <div className="text-[10px] font-semibold text-slate-500">{t('mobile:dashboard.activeJobs', 'Active Jobs')}</div>
        </div>
        <div className="mobile-card p-2.5 text-center">
          <div className="text-base font-extrabold text-slate-700">{closedJobs.length}</div>
          <div className="text-[10px] font-semibold text-slate-500">{t('employer.closedDrafts', 'Closed / Drafts')}</div>
        </div>
        <div className="mobile-card p-2.5 text-center">
          <div className="text-base font-extrabold text-emerald-700">{totalApplicants}</div>
          <div className="text-[10px] font-semibold text-slate-500">{t('mobile:dashboard.totalApplicants', 'Applicants')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'ACTIVE'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('employer.activeListings', 'Active Listings')} ({activeJobs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CLOSED')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'CLOSED'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('employer.closedDrafts', 'Closed / Drafts')} ({closedJobs.length})
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-36 rounded-2xl mobile-skeleton" />
          ))}
        </div>
      ) : isError ? (
        <div className="mobile-card p-6 text-center space-y-2 border border-red-100">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">{t('common.failedLoad', 'Failed to load jobs')}</h3>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('mobile:sync.retry', 'Retry')}</span>
          </button>
        </div>
      ) : filteredJobs.length > 0 ? (
        <div className="space-y-3">
          {filteredJobs.map((job: JobListItem) => (
            <div key={job.id} className="mobile-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{job.title}</h3>
                    {job.is_urgent && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800">
                        URGENT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-amber-600 flex-shrink-0" />
                    <span className="truncate">
                      {[job.city, job.state].filter(Boolean).join(', ') || 'India'} ·{' '}
                      {job.work_type?.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                <MobileStatusBadge status={job.status} />
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-2">
                <span className="font-extrabold text-indigo-900">
                  ₹{job.salary_min || 0} - ₹{job.salary_max || 0}{' '}
                  <span className="font-medium text-slate-500">/ {job.salary_type}</span>
                </span>
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    {job.views_count || 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-indigo-700" />
                    {job.applications_count || 0}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
                  className="flex flex-col items-center justify-center rounded-xl bg-indigo-50 py-2 px-1 text-[10px] font-bold text-indigo-900 active:scale-95"
                >
                  <Users className="h-3.5 w-3.5 mb-0.5" />
                  <span className="truncate w-full text-center">
                    {t('mobile:employerFlow.viewApplicants', 'Applicants')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/employer/jobs/${job.id}/candidates`)}
                  className="flex flex-col items-center justify-center rounded-xl bg-amber-50 py-2 px-1 text-[10px] font-bold text-amber-800 active:scale-95"
                >
                  <UserCheck className="h-3.5 w-3.5 mb-0.5" />
                  <span className="truncate w-full text-center">
                    {t('mobile:employerFlow.findCandidates', 'Candidates')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/employer/jobs/${job.id}/edit`)}
                  className="flex flex-col items-center justify-center rounded-xl bg-slate-100 py-2 px-1 text-[10px] font-bold text-slate-700 active:scale-95"
                >
                  <Edit3 className="h-3.5 w-3.5 mb-0.5" />
                  <span>{t('mobile:common.edit', 'Edit')}</span>
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        t('mobile:employerFlow.deleteConfirm', {
                          title: job.title,
                          defaultValue: `Close/cancel "${job.title}"?`,
                        })
                      )
                    ) {
                      deleteMutation.mutate(job.id);
                    }
                  }}
                  className="flex flex-col items-center justify-center rounded-xl bg-red-50 py-2 px-1 text-[10px] font-bold text-red-700 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5 mb-0.5" />
                  <span>{t('mobile:common.delete', 'Delete')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mobile-card p-8 text-center space-y-3">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">
            {activeTab === 'ACTIVE'
              ? t('mobile:dashboard.noJobsYet', 'No active jobs')
              : t('employer.noClosedJobs', 'No closed or cancelled jobs')}
          </h3>
          {activeTab === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => navigate('/employer/post-job')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2.5 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              <span>{t('employer.postNew', 'Post a New Job')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MobileMyJobsPage;
