import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  MapPin, Star, Briefcase, CreditCard, ShieldAlert, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { PaymentHistoryCard } from '../../../components/shifts/PaymentHistoryCard';
import { MobileStatusBadge } from '../../components/ui/MobileStatusBadge';
import { MobileRateModal } from '../../components/ui/MobileRateModal';
import { MOBILE_QUERY_KEYS, invalidateShiftSync } from '../../sync/queryKeys';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';
import type { ShiftBooking, WorkHistoryItem } from '../../../types';

export const MobileWorkerShiftsPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'completed' || searchParams.get('tab') === 'history'
    ? 'completed'
    : 'upcoming';

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>(initialTab);
  const [page, setPage] = useState(1);

  const [disputeTarget, setDisputeTarget] = useState<WorkHistoryItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const [rateTarget, setRateTarget] = useState<{
    applicationId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab === 'completed' || qTab === 'history') {
      setActiveTab('completed');
    } else if (qTab === 'upcoming') {
      setActiveTab('upcoming');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'upcoming' | 'completed') => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const bookingsPoll = useAdaptivePollInterval(18000);
  const historyPoll = useAdaptivePollInterval(22000);

  const { data: bookings = [], isLoading: isBookingsLoading } = useQuery<ShiftBooking[]>({
    queryKey: MOBILE_QUERY_KEYS.workerBookings,
    queryFn: shiftsApi.getMyBookings,
    refetchInterval: bookingsPoll,
  });

  const { data: workHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.workHistory(page, 10),
    queryFn: () => shiftsApi.getMyWorkHistory(page, 10),
    refetchInterval: historyPoll,
  });

  const refreshShifts = async () => {
    await invalidateShiftSync(queryClient);
  };

  const acceptMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.acceptShift(id),
    onSuccess: () => {
      toast.success(t('shifts.accepted', 'Shift confirmed!'));
      refreshShifts();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to accept shift'),
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.declineShift(id),
    onSuccess: () => {
      toast.success(t('shifts.declined', 'Shift declined'));
      refreshShifts();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to decline shift'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.cancelShift(id),
    onSuccess: () => {
      toast.success(t('shifts.cancelled', 'Shift booking cancelled'));
      refreshShifts();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to cancel shift'),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: (bookingId: string) => shiftsApi.confirmPayment(bookingId),
    onSuccess: () => {
      toast.success(t('payments.confirmedToast', 'Payment receipt confirmed!'));
      refreshShifts();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to confirm payment'),
  });

  const disputePaymentMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      shiftsApi.disputePayment(bookingId, { dispute_reason: reason }),
    onSuccess: () => {
      toast.success(t('payments.disputedToast', 'Discrepancy reported to employer'));
      setDisputeTarget(null);
      setDisputeReason('');
      refreshShifts();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to submit discrepancy'),
  });

  const upcomingShifts = (Array.isArray(bookings) ? bookings : []).filter(
    (s) => s.status === 'PENDING' || s.status === 'CONFIRMED'
  );
  const historyList: WorkHistoryItem[] = workHistoryData?.items || [];
  const totalHistory = workHistoryData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalHistory / 10));

  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">
            {t('mobile:shifts.workerTitle', 'My Shifts & Earnings')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('mobile:shifts.offlineDisclaimer', 'Offline settlement record (Cash / UPI / Bank Transfer).')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/worker/availability')}
          className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900 active:scale-95 whitespace-nowrap"
        >
          {t('mobile:dashboard.manageAvailability', 'Manage Slots')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => handleTabChange('upcoming')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'upcoming'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('mobile:shifts.upcomingTab', 'Upcoming')} ({upcomingShifts.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('completed')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'completed'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('mobile:shifts.completedTab', 'Completed & Paid')} ({totalHistory})
        </button>
      </div>

      {/* UPCOMING TAB */}
      {activeTab === 'upcoming' ? (
        isBookingsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-36 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : upcomingShifts.length > 0 ? (
          <div className="space-y-3">
            {upcomingShifts.map((shift) => {
              const rateDisplay = shift.proposed_rate;
              return (
                <div key={shift.id} className="mobile-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        {shift.job?.title || t('shifts.shiftBooking', 'Shift Booking')}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {shift.employer?.organization_name || t('common.employer', 'Employer')}
                      </p>
                      {(shift.job?.city || shift.job?.state) && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {[shift.job?.city, shift.job?.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <MobileStatusBadge status={shift.status} />
                  </div>

                  {/* Schedule + Rate */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('shifts.schedule', 'Shift Window')}
                      </span>
                      <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-indigo-700 flex-shrink-0" />
                        <span className="truncate">{formatDateTime(shift.start_time)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 pl-4.5">
                        → {formatDateTime(shift.end_time)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('mobile:shifts.agreedRate', 'Agreed Rate')}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                        {rateDisplay ? `₹${rateDisplay}` : '—'}
                      </span>
                    </div>
                  </div>

                  {shift.notes && (
                    <p className="text-xs text-slate-600 bg-indigo-50/50 rounded-xl px-3 py-2 border border-indigo-100">
                      {shift.notes}
                    </p>
                  )}

                  {/* Actions */}
                  {shift.status === 'PENDING' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => declineMutation.mutate(shift.id)}
                        disabled={declineMutation.isPending || acceptMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-700 active:scale-95 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        {t('mobile:shifts.decline', 'Decline')}
                      </button>
                      <button
                        type="button"
                        onClick={() => acceptMutation.mutate(shift.id)}
                        disabled={acceptMutation.isPending || declineMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t('mobile:shifts.accept', 'Accept')}
                      </button>
                    </div>
                  )}

                  {shift.status === 'CONFIRMED' && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {shift.job_id && (
                        <button
                          type="button"
                          onClick={() => navigate(`/worker/jobs/${shift.job_id}`)}
                          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 active:scale-95"
                        >
                          {t('mobile:applications.viewJob', 'View Job')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('mobile:shifts.cancelConfirm', 'Cancel this shift booking?'))) {
                            cancelMutation.mutate(shift.id);
                          }
                        }}
                        disabled={cancelMutation.isPending}
                        className="ml-auto rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 active:scale-95 disabled:opacity-50"
                      >
                        {t('mobile:shifts.cancel', 'Cancel Booking')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mobile-card p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Briefcase className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {t('mobile:shifts.noUpcoming', 'No upcoming shifts')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('mobile:shifts.noUpcomingDesc', 'When an employer books you for a shift, it will appear here.')}
            </p>
          </div>
        )
      ) : (
        /* COMPLETED & WORK HISTORY TAB */
        isHistoryLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : historyList.length > 0 ? (
          <div className="space-y-4">
            {historyList.map((item) => {
              const b = item.shift_booking;
              const wc = item.work_completion;
              const pr = item.payment_record;
              const isDisputed = pr?.payment_status === 'DISPUTED';
              const isConfirmed = pr?.payment_status === 'CONFIRMED';
              const canConfirm =
                Boolean(pr) &&
                !isDisputed &&
                !isConfirmed &&
                (pr?.payment_status === 'PENDING_CONFIRMATION' || pr?.payment_status === 'PARTIALLY_PAID');
              const canDispute = Boolean(pr) && !isConfirmed && !isDisputed;
              const employerUserId = item.counterpart_id || b.employer_id;
              const jobTitleDisplay = item.job_title || b.job?.title || t('shifts.completedJob', 'Completed Shift');
              const employerNameDisplay = item.counterpart_name || b.employer?.organization_name || t('common.employer', 'Employer');

              return (
                <div key={b.id} className="mobile-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        {jobTitleDisplay}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {employerNameDisplay}
                      </p>
                    </div>
                    <MobileStatusBadge status={b.status} />
                  </div>

                  {/* Work Summary */}
                  {wc && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {t('mobile:shifts.hoursWorked', 'Hours Worked')}
                        </span>
                        <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-indigo-700" />
                          {wc.hours_worked ?? '—'} hrs
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {t('shifts.completedDate', 'Completed')}
                        </span>
                        <span className="font-semibold text-slate-700 mt-0.5 block">
                          {new Date(wc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {wc.completion_notes && (
                        <p className="col-span-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/70">
                          {wc.completion_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Full Payment Ledger */}
                  <PaymentHistoryCard paymentRecord={pr} />

                  {/* Worker Payment & Rating Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canConfirm && (
                      <button
                        type="button"
                        onClick={() => confirmPaymentMutation.mutate(b.id)}
                        disabled={confirmPaymentMutation.isPending}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-3 text-xs font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        <CreditCard className="h-4 w-4" />
                        {t('mobile:shifts.confirmReceipt', 'Confirm Payment Received')}
                      </button>
                    )}

                    {canDispute && (
                      <button
                        type="button"
                        onClick={() => {
                          setDisputeTarget(item);
                          setDisputeReason('');
                        }}
                        className="flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2.5 px-3 text-xs font-bold text-red-700 active:scale-95"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        {t('mobile:shifts.disputePayment', 'Report Discrepancy')}
                      </button>
                    )}

                    {item.can_rate && item.application_id && (
                      <button
                        type="button"
                        onClick={() =>
                          setRateTarget({
                            applicationId: item.application_id!,
                            name: employerNameDisplay,
                          })
                        }
                        className="flex items-center justify-center gap-1 rounded-xl bg-amber-50 border border-amber-200 py-2.5 px-3 text-xs font-bold text-amber-800 active:scale-95"
                      >
                        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                        {t('mobile:shifts.rateEmployer', 'Rate Employer')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('mobile:common.prev', 'Prev')}
                </button>
                <span className="text-xs font-semibold text-slate-600">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  {t('mobile:common.next', 'Next')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mobile-card p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {t('mobile:shifts.noHistory', 'No completed work history yet')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('mobile:shifts.noHistoryDesc', 'Completed shifts and offline payment settlement records appear here.')}
            </p>
          </div>
        )
      )}

      {/* Dispute Bottom Sheet */}
      {disputeTarget && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:shifts.disputePayment', 'Report Discrepancy')}
              </h3>
              <button
                type="button"
                onClick={() => setDisputeTarget(null)}
                className="mobile-touch-target rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {disputeTarget.job_title || disputeTarget.shift_booking.job?.title} •{' '}
              {disputeTarget.counterpart_name || disputeTarget.shift_booking.employer?.organization_name}
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('mobile:shifts.disputeReason', 'Discrepancy Reason (min 5 chars)')}
              </label>
              <textarea
                rows={3}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={t('mobile:shifts.disputePlaceholder', 'Explain the mismatch in hours or amount paid...')}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDisputeTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700"
              >
                {t('mobile:common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={disputeReason.trim().length < 5 || disputePaymentMutation.isPending}
                onClick={() =>
                  disputePaymentMutation.mutate({
                    bookingId: disputeTarget.shift_booking.id,
                    reason: disputeReason.trim(),
                  })
                }
                className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {disputePaymentMutation.isPending
                  ? t('mobile:common.saving', 'Saving...')
                  : t('mobile:shifts.disputePayment', 'Submit Report')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {rateTarget && (
        <MobileRateModal
          isOpen={!!rateTarget}
          onClose={() => setRateTarget(null)}
          applicationId={rateTarget.applicationId}
          userName={rateTarget.name}
          onSuccess={() => refreshShifts()}
        />
      )}
    </div>
  );
};

export default MobileWorkerShiftsPage;
