import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, User, MapPin, Star, CheckCircle2, XCircle,
  MessageSquare, Calendar, Briefcase, ShieldCheck, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsApi, applicationsApi, chatApi, shiftsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import type { Application, ApplicationStatus } from '../../../types';
import { MobileStatusBadge } from '../../components/ui/MobileStatusBadge';
import { MobileRateModal } from '../../components/ui/MobileRateModal';
import { MOBILE_QUERY_KEYS, invalidateApplicationSync, invalidateShiftSync } from '../../sync/queryKeys';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';

export const MobileJobApplicantsPage: React.FC = () => {
  const { id: jobId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(['translation', 'mobile']);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<'ALL' | ApplicationStatus>('ALL');
  const [rateTarget, setRateTarget] = useState<{ appId: string; workerName: string } | null>(null);

  // Shift booking sheet
  const [bookingApp, setBookingApp] = useState<Application | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [proposedRate, setProposedRate] = useState('');
  const [notes, setNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const poll = useAdaptivePollInterval(18000);

  const { data: job } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.jobDetail(jobId || ''),
    queryFn: () => jobsApi.get(jobId!),
    enabled: Boolean(jobId),
  });

  const { data: applicants = [], isLoading } = useQuery<Application[]>({
    queryKey: MOBILE_QUERY_KEYS.jobApplicants(jobId || ''),
    queryFn: () => jobsApi.getApplicants(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: poll,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: ApplicationStatus }) =>
      applicationsApi.updateStatus(appId, status),
    onSuccess: () => {
      toast.success(t('applications.statusUpdated', 'Application updated'));
      void invalidateApplicationSync(queryClient, jobId);
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to update status'),
  });

  const chatMutation = useMutation({
    mutationFn: (appId: string) => chatApi.getOrCreateConversation(appId),
    onSuccess: (conv) => {
      navigate(`/employer/messages?conversation=${conv.id}`);
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Unable to start conversation'),
  });

  const filtered = useMemo(() => {
    const list = Array.isArray(applicants) ? applicants : [];
    if (statusFilter === 'ALL') return list;
    return list.filter((a) => a.status === statusFilter);
  }, [applicants, statusFilter]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingApp?.worker?.id || !jobId || isBooking) return;
    const sDt = new Date(startTime);
    const eDt = new Date(endTime);
    if (!startTime || !endTime || sDt >= eDt) {
      toast.error(t('start_time_must_be_before_end_time', 'End time must be after start time.'));
      return;
    }
    setIsBooking(true);
    try {
      await shiftsApi.requestShift({
        worker_id: bookingApp.worker.id,
        job_id: jobId,
        start_time: sDt.toISOString(),
        end_time: eDt.toISOString(),
        proposed_rate: proposedRate ? Number(proposedRate) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(t('shift_requested_successfully', 'Shift requested successfully!'));
      await invalidateShiftSync(queryClient);
      setBookingApp(null);
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to book shift');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mobile-touch-target rounded-full p-2 bg-white border border-slate-200 text-slate-700"
          aria-label={t('mobile:common.back', 'Back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-extrabold text-slate-900 truncate">
            {job?.title || t('mobile:employerFlow.applicantsTitle', 'Job Applicants')}
          </h1>
          <p className="text-[11px] text-slate-500">
            {t('mobile:employerFlow.applicantsSubtitle', 'Shortlist, accept, message, or book workers')}
          </p>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(['ALL', 'PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
              statusFilter === st
                ? 'bg-indigo-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 rounded-2xl mobile-skeleton" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((app) => {
            const w = app.worker;
            return (
              <div key={app.id} className="mobile-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => w?.id && navigate(`/employer/workers/${w.id}`)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="h-11 w-11 rounded-2xl bg-indigo-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {w?.profile_image_url ? (
                        <img src={w.profile_image_url} alt={w.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-indigo-700" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-bold text-sm text-slate-900 truncate">
                          {w?.full_name || 'Applicant'}
                        </h3>
                        {w?.is_identity_verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-amber-600" />
                        {[w?.city, w?.state].filter(Boolean).join(', ') || 'India'}
                        {w?.average_rating != null && (
                          <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-amber-700">
                            · <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {Number(w.average_rating).toFixed(1)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <MobileStatusBadge status={app.status} />
                </div>

                {app.cover_note && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 leading-relaxed">
                    "{app.cover_note}"
                  </p>
                )}

                {/* Workflow actions matching JobApplicantsPage */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {app.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'SHORTLISTED' })}
                        className="flex-1 rounded-xl bg-indigo-50 border border-indigo-200 py-2 text-xs font-bold text-indigo-900"
                      >
                        {t('mobile:employerFlow.shortlist', 'Shortlist')}
                      </button>
                      <button
                        type="button"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'ACCEPTED' })}
                        className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white"
                      >
                        {t('mobile:employerFlow.accept', 'Accept')}
                      </button>
                      <button
                        type="button"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'REJECTED' })}
                        className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {app.status === 'SHORTLISTED' && (
                    <>
                      <button
                        type="button"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'ACCEPTED' })}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t('mobile:employerFlow.accept', 'Accept')}
                      </button>
                      <button
                        type="button"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'REJECTED' })}
                        className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                      >
                        {t('mobile:employerFlow.reject', 'Reject')}
                      </button>
                    </>
                  )}

                  {(app.status === 'SHORTLISTED' || app.status === 'ACCEPTED') && (
                    <button
                      type="button"
                      disabled={chatMutation.isPending}
                      onClick={() => chatMutation.mutate(app.id)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-900 py-2 px-3 text-xs font-bold text-white"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t('mobile:employerFlow.messageWorker', 'Message')}
                    </button>
                  )}

                  {app.status === 'ACCEPTED' && w?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setBookingApp(app);
                        setProposedRate(job?.salary_min ? String(job.salary_min) : '');
                      }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-amber-50 border border-amber-200 py-2 px-3 text-xs font-bold text-amber-800"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {t('mobile:employerFlow.bookShift', 'Book Shift')}
                    </button>
                  )}

                  {(app.status === 'ACCEPTED' || app.status === 'COMPLETED') && (
                    <button
                      type="button"
                      onClick={() =>
                        setRateTarget({
                          appId: app.id,
                          workerName: w?.full_name || 'Worker',
                        })
                      }
                      className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 py-2 px-3 text-xs font-bold text-slate-800"
                    >
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {t('mobile:shifts.rateWorker', 'Rate')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mobile-card p-8 text-center space-y-2">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-sm text-slate-900">
            {t('mobile:employerFlow.noApplicants', 'No applicants yet')}
          </h3>
          <p className="text-xs text-slate-500">
            {t('mobile:employerFlow.noApplicantsDesc', 'Workers who apply will appear here in real time.')}
          </p>
        </div>
      )}

      {/* Book Shift Sheet */}
      {bookingApp && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:employerFlow.bookShift', 'Book Shift')} — {bookingApp.worker?.full_name}
              </h3>
              <button type="button" onClick={() => setBookingApp(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleBookSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:availability.startTime', 'Start Date & Time')} *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:availability.endTime', 'End Date & Time')} *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:shifts.agreedRate', 'Agreed Rate (₹)')}
                </label>
                <input
                  type="number"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={isBooking}
                className="w-full rounded-xl bg-indigo-900 py-3 font-bold text-white"
              >
                {isBooking ? t('mobile:common.saving', 'Saving...') : t('mobile:employerFlow.bookShift', 'Request Shift')}
              </button>
            </form>
          </div>
        </div>
      )}

      {rateTarget && (
        <MobileRateModal
          isOpen={!!rateTarget}
          onClose={() => setRateTarget(null)}
          applicationId={rateTarget.appId}
          userName={rateTarget.workerName}
          onSuccess={() => void invalidateApplicationSync(queryClient, jobId)}
        />
      )}
    </div>
  );
};

export default MobileJobApplicantsPage;
