import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, MapPin, Clock, Briefcase, Trash2, MessageSquare, Star,
  AlertCircle, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { applicationsApi, chatApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import type { Application, ApplicationStatus } from '../../../types';
import MobilePageHeader from '../../components/ui/MobilePageHeader';
import MobileStatusBadge from '../../components/ui/MobileStatusBadge';
import MobileRateModal from '../../components/ui/MobileRateModal';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';
import { MOBILE_QUERY_KEYS, invalidateApplicationSync } from '../../sync/queryKeys';
import { useBackButton } from '../../hooks/useBackButton';

const FILTER_STATUSES: Array<'ALL' | ApplicationStatus> = [
  'ALL',
  'PENDING',
  'SHORTLISTED',
  'ACCEPTED',
  'COMPLETED',
  'REJECTED',
  'WITHDRAWN',
];

export const MobileMyApplicationsPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useBackButton();

  const [statusFilter, setStatusFilter] = useState<'ALL' | ApplicationStatus>('ALL');
  const [ratingTarget, setRatingTarget] = useState<{ appId: string; userName: string } | null>(null);

  const pollMs = useAdaptivePollInterval(10000);

  const { data: applications = [], isLoading, isError, refetch } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.workerApplications,
    queryFn: applicationsApi.list,
    refetchInterval: pollMs,
    staleTime: 6000,
    refetchOnMount: 'always',
  });

  const withdrawMutation = useMutation({
    mutationFn: (appId: string) => applicationsApi.withdraw(appId),
    onSuccess: (_res, appId) => {
      toast.success(t('applications.withdrawnSuccess', 'Application withdrawn'));
      const app = applications.find((a) => a.id === appId);
      invalidateApplicationSync(queryClient, app?.job.id);
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const startChatMutation = useMutation({
    mutationFn: (appId: string) => chatApi.getOrCreateConversation(appId),
    onSuccess: (conv) => navigate(`/worker/messages?conversation=${conv.id}`),
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: applications.length };
    applications.forEach((a) => {
      map[a.status] = (map[a.status] || 0) + 1;
    });
    return map;
  }, [applications]);

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  return (
    <div className="flex flex-col">
      <MobilePageHeader
        title={t('mobile:applications.title', 'My Applications')}
        subtitle={t('mobile:applications.subtitle', 'Track application updates & message employers')}
        rightSlot={
          <button
            type="button"
            onClick={() => void refetch()}
            className="mobile-touch-target rounded-full p-2 text-slate-600 hover:bg-slate-100"
            aria-label={t('mobile:sync.refresh', 'Refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      {/* Status Filter Pills */}
      <div className="flex gap-2 overflow-x-auto bg-white px-4 py-2.5 border-b border-slate-100 no-scrollbar">
        {FILTER_STATUSES.map((st) => {
          const count = counts[st] || 0;
          if (st !== 'ALL' && count === 0) return null;
          const active = statusFilter === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                active
                  ? 'bg-indigo-900 text-white border-indigo-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {st === 'ALL'
                ? t('mobile:applications.all', 'All')
                : t(`statuses.${st}`, { defaultValue: st })}{' '}
              ({count})
            </button>
          );
        })}
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-36 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl bg-white p-6 text-center border border-red-100 space-y-2.5">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-red-700">
              {t('applications.errorTitle', 'Failed to load applications')}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
            >
              {t('mobile:sync.retry', 'Retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-xs space-y-3 mt-4">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-900 text-sm">{t('mobile:applications.emptyTitle', 'No applications yet')}</h3>
            <p className="text-xs text-slate-500">
              {t('mobile:applications.emptyDesc', 'Browse jobs and apply to start tracking your opportunities here.')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/worker/jobs')}
              className="rounded-xl bg-indigo-900 px-5 py-2.5 text-xs font-bold text-white"
            >
              {t('mobile:applications.browseJobs', 'Browse Jobs')}
            </button>
          </div>
        ) : (
          filtered.map((app: Application) => {
            const employerName =
              app.job?.employer?.organization_name || app.job?.employer?.full_name || t('roles.EMPLOYER', 'Employer');
            const isWithdrawing = withdrawMutation.isPending && withdrawMutation.variables === app.id;
            const canChat = app.status === 'SHORTLISTED' || app.status === 'ACCEPTED';
            const canRate = app.status === 'ACCEPTED' || app.status === 'COMPLETED';

            return (
              <div key={app.id} className="mobile-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/worker/jobs/${app.job.id}`)}
                      className="text-left font-bold text-sm text-slate-900 hover:text-indigo-900 line-clamp-1"
                    >
                      {app.job.title}
                    </button>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{employerName}</p>
                  </div>
                  <MobileStatusBadge status={app.status} variant="application" />
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />
                    {app.job.city}, {app.job.state}
                  </span>
                  {app.job.category?.name && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      {t(`categories.${app.job.category.name}`, { defaultValue: app.job.category.name })}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {t('mobile:applications.appliedOn', {
                      date: new Date(app.applied_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }),
                      defaultValue: `Applied ${new Date(app.applied_at).toLocaleDateString()}`,
                    })}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => navigate(`/worker/jobs/${app.job.id}`)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 min-h-[42px]"
                  >
                    {t('mobile:applications.viewJob', 'View Job')}
                  </button>

                  {canChat && (
                    <button
                      type="button"
                      onClick={() => startChatMutation.mutate(app.id)}
                      disabled={startChatMutation.isPending}
                      className="flex-1 rounded-xl bg-indigo-900 py-2.5 px-3 text-xs font-bold text-white flex items-center justify-center gap-1.5 min-h-[42px]"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>{t('mobile:applications.message', 'Message')}</span>
                    </button>
                  )}

                  {canRate && (
                    <button
                      type="button"
                      onClick={() => setRatingTarget({ appId: app.id, userName: employerName })}
                      className="flex-1 rounded-xl bg-amber-50 border border-amber-200 py-2.5 px-3 text-xs font-bold text-amber-800 flex items-center justify-center gap-1.5 min-h-[42px]"
                    >
                      <Star className="h-3.5 w-3.5" />
                      <span>{t('mobile:applications.rate', 'Rate')}</span>
                    </button>
                  )}

                  {app.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('mobile:jobs.withdrawConfirm', 'Withdraw this pending application?'))) {
                          withdrawMutation.mutate(app.id);
                        }
                      }}
                      disabled={isWithdrawing}
                      className="rounded-xl bg-red-50 border border-red-200 py-2.5 px-3 text-xs font-bold text-red-700 flex items-center justify-center gap-1 min-h-[42px] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>
                        {isWithdrawing
                          ? t('mobile:applications.withdrawing', 'Wait...')
                          : t('mobile:applications.withdraw', 'Withdraw')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {ratingTarget && (
        <MobileRateModal
          isOpen={!!ratingTarget}
          onClose={() => setRatingTarget(null)}
          applicationId={ratingTarget.appId}
          userName={ratingTarget.userName}
        />
      )}
    </div>
  );
};

export default MobileMyApplicationsPage;
