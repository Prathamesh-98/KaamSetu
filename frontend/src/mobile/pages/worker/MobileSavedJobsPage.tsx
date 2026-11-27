import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, MapPin, Briefcase, Trash2, Zap, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { workerApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import type { SavedJob } from '../../../types';
import MobilePageHeader from '../../components/ui/MobilePageHeader';
import MobileStatusBadge from '../../components/ui/MobileStatusBadge';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';
import { useBackButton } from '../../hooks/useBackButton';

export const MobileSavedJobsPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useBackButton();

  const { data: savedJobs = [], isLoading, isError, refetch } = useQuery<SavedJob[]>({
    queryKey: MOBILE_QUERY_KEYS.savedJobs,
    queryFn: workerApi.getSavedJobs,
    staleTime: 10000,
    refetchOnMount: 'always',
  });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: string) => workerApi.unsaveJob(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedJobs });
      toast.success(t('jobs.removedFromSaved', 'Removed from saved jobs'));
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <div className="flex flex-col">
      <MobilePageHeader
        title={t('nav.savedJobs', 'Saved Jobs')}
        subtitle={t('jobs.savedJobsDesc', "Jobs you've bookmarked for later")}
      />

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl bg-white p-6 text-center border border-red-100 space-y-2">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-red-700">{t('jobs.errorTitle', 'Failed to load saved jobs')}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
            >
              {t('mobile:sync.retry', 'Retry')}
            </button>
          </div>
        ) : savedJobs.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-xs space-y-3 mt-4">
            <Bookmark className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-900 text-sm">{t('jobs.noSavedJobs', 'No saved jobs yet')}</h3>
            <p className="text-xs text-slate-500">
              {t('jobs.noSavedJobsDesc', 'Save jobs you like to quickly review and apply later.')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/worker/jobs')}
              className="rounded-xl bg-indigo-900 px-5 py-2.5 text-xs font-bold text-white"
            >
              {t('jobs.findJobs', 'Find Jobs')}
            </button>
          </div>
        ) : (
          savedJobs.map((item) => {
            const { job } = item;
            const isRemoving = unsaveMutation.isPending && unsaveMutation.variables === job.id;
            return (
              <div key={item.id} className="mobile-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {job.is_urgent && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <Zap className="h-3 w-3" /> {t('jobs.urgent', 'Urgent')}
                        </span>
                      )}
                      <MobileStatusBadge status={job.work_type} variant="workType" className="text-[10px]" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{job.title}</h3>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {job.employer?.organization_name || job.employer?.full_name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />
                    {job.city}, {job.state}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    {job.salary_min ? `₹${job.salary_min.toLocaleString()}` : t('jobs.salaryNegotiable', 'Negotiable')}
                    {job.salary_max ? ` - ₹${job.salary_max.toLocaleString()}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(item.saved_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {job.status !== 'ACTIVE' && (
                  <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {t('jobs.notAcceptingApplications', 'No longer accepting applications')}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => navigate(`/worker/jobs/${job.id}`)}
                    className="flex-1 rounded-xl bg-indigo-900 py-2.5 text-xs font-bold text-white min-h-[42px]"
                  >
                    {t('jobs.viewDetails', 'View Details')}
                  </button>
                  <button
                    type="button"
                    onClick={() => unsaveMutation.mutate(job.id)}
                    disabled={isRemoving}
                    className="mobile-touch-target rounded-xl border border-red-200 bg-red-50 px-3 text-red-600 min-h-[42px] disabled:opacity-50"
                    aria-label={t('jobs.unsave', 'Unsave')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MobileSavedJobsPage;
