import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  PlusCircle, ShieldAlert, Star, ChevronLeft, ChevronRight, X, Briefcase
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
import type {
  ShiftBooking, WorkHistoryItem, PaymentRecord, PaymentMethod
} from '../../../types';

const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'CASH', 'BANK_TRANSFER', 'OTHER'];

export const MobileEmployerShiftBookingsPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') === 'completed' ? 'completed' : 'active';
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>(initialTab);
  const [page, setPage] = useState(1);

  // Modal targets
  const [completeTarget, setCompleteTarget] = useState<ShiftBooking | null>(null);
  const [installmentTarget, setInstallmentTarget] = useState<{ booking: ShiftBooking; payment: PaymentRecord } | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<{ booking: ShiftBooking; payment: PaymentRecord } | null>(null);
  const [rateTarget, setRateTarget] = useState<{ applicationId: string; userName: string } | null>(null);

  // Complete Shift form state
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');
  const [completionNotes, setCompletionNotes] = useState('');
  const [agreedAmount, setAgreedAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Installment / Resolve Dispute form state
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [correctedAmountPaid, setCorrectedAmountPaid] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');

  useEffect(() => {
    const q = searchParams.get('tab');
    if (q === 'completed' || q === 'active') setActiveTab(q);
  }, [searchParams]);

  const handleTabChange = (tab: 'active' | 'completed') => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const bookingsPoll = useAdaptivePollInterval(18000);
  const historyPoll = useAdaptivePollInterval(22000);

  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<ShiftBooking[]>({
    queryKey: MOBILE_QUERY_KEYS.employerBookings,
    queryFn: shiftsApi.getMyBookings,
    refetchInterval: bookingsPoll,
  });

  const { data: workHistoryData, isLoading: isLoadingHistory } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.workHistory(page, 10),
    queryFn: () => shiftsApi.getMyWorkHistory(page, 10),
    refetchInterval: historyPoll,
  });

  const refreshAll = async () => {
    await invalidateShiftSync(queryClient);
  };

  const cancelMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.cancelShift(id),
    onSuccess: () => {
      toast.success(t('employer.shiftCancelled', 'Shift booking cancelled'));
      void refreshAll();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to cancel shift'),
  });

  const completeMutation = useMutation({
    mutationFn: (bookingId: string) =>
      shiftsApi.completeShift(bookingId, {
        actual_start_time: new Date(actualStart).toISOString(),
        actual_end_time: new Date(actualEnd).toISOString(),
        hours_worked: Number(hoursWorked) || 8,
        completion_notes: completionNotes.trim() || undefined,
        agreed_amount: agreedAmount ? Number(agreedAmount) : undefined,
        amount_paid: Number(amountPaid) || 0,
        payment_method: paymentMethod,
        payment_date: new Date(paymentDate).toISOString(),
        payment_reference: paymentReference.trim() || undefined,
        payment_notes: paymentNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('payments.shiftCompletedSuccess', 'Shift completed & payment recorded!'));
      setCompleteTarget(null);
      void refreshAll();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to record completion'),
  });

  const installmentMutation = useMutation({
    mutationFn: (bookingId: string) =>
      shiftsApi.updatePayment(bookingId, {
        installment_amount: Number(installmentAmount),
        payment_method: paymentMethod,
        payment_date: new Date(paymentDate).toISOString(),
        payment_reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('payments.installmentAdded', 'Installment recorded!'));
      setInstallmentTarget(null);
      void refreshAll();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to record installment'),
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: (bookingId: string) =>
      shiftsApi.updatePayment(bookingId, {
        amount_paid: Number(correctedAmountPaid),
        payment_method: paymentMethod,
        payment_date: new Date(paymentDate).toISOString(),
        payment_reference: paymentReference.trim() || undefined,
        correction_note: correctionNote.trim(),
      }),
    onSuccess: () => {
      toast.success(t('payments.disputeResolved', 'Dispute adjusted & updated!'));
      setDisputeTarget(null);
      void refreshAll();
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to resolve dispute'),
  });

  const toLocalInput = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openCompleteModal = (b: ShiftBooking) => {
    setCompleteTarget(b);
    setActualStart(toLocalInput(b.start_time));
    setActualEnd(toLocalInput(b.end_time));
    const hrs = Math.max(
      0.5,
      (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000
    );
    setHoursWorked(hrs.toFixed(1));
    setCompletionNotes('');
    setAgreedAmount(b.proposed_rate ? String(b.proposed_rate) : '');
    setAmountPaid(b.proposed_rate ? String(b.proposed_rate) : '');
    setPaymentMethod('UPI');
    setPaymentDate(toLocalInput());
    setPaymentReference('');
    setPaymentNotes('');
  };

  const openInstallmentModal = (booking: ShiftBooking, payment: PaymentRecord) => {
    setInstallmentTarget({ booking, payment });
    setInstallmentAmount(String(payment.outstanding_balance || ''));
    setPaymentMethod('UPI');
    setPaymentDate(toLocalInput());
    setPaymentReference('');
    setPaymentNotes('');
  };

  const openResolveModal = (booking: ShiftBooking, payment: PaymentRecord) => {
    setDisputeTarget({ booking, payment });
    setCorrectedAmountPaid(String(payment.amount_paid || ''));
    setCorrectionNote('');
    setPaymentMethod(payment.payment_method || 'UPI');
    setPaymentDate(toLocalInput());
    setPaymentReference(payment.payment_reference || '');
  };

  const activeBookings = (Array.isArray(bookings) ? bookings : []).filter(
    (b) => b.status === 'PENDING' || b.status === 'CONFIRMED'
  );
  const historyList: WorkHistoryItem[] = workHistoryData?.items || [];
  const totalPages = workHistoryData?.total_pages || 1;
  const nowMs = Date.now();

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">
          {t('mobile:shifts.employerTitle', 'Shifts & Settlement')}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {t('mobile:shifts.offlineDisclaimer', 'Offline settlement record (Cash / UPI / Bank Transfer).')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => handleTabChange('active')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${
            activeTab === 'active' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          {t('mobile:shifts.activeTab', 'Active')} ({activeBookings.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('completed')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${
            activeTab === 'completed' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          {t('mobile:shifts.completedTab', 'Completed & Paid')} ({workHistoryData?.total || 0})
        </button>
      </div>

      {/* TAB 1: ACTIVE */}
      {activeTab === 'active' ? (
        isLoadingBookings ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-36 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : activeBookings.length > 0 ? (
          <div className="space-y-3">
            {activeBookings.map((booking) => {
              const isStartInFuture = new Date(booking.start_time).getTime() > nowMs;
              return (
                <div key={booking.id} className="mobile-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate">
                        {booking.job?.title || t('shifts.shiftBooking', 'Shift Booking')}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('payments.worker', 'Worker')}: {booking.worker?.full_name || booking.worker_id}
                      </p>
                    </div>
                    <MobileStatusBadge status={booking.status} />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-indigo-700" />
                        <span>{new Date(booking.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 pl-4.5">
                        → {new Date(booking.end_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {booking.proposed_rate && (
                      <span className="font-extrabold text-indigo-900">₹{booking.proposed_rate}</span>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {booking.status === 'CONFIRMED' && (
                      <>
                        <button
                          type="button"
                          disabled={isStartInFuture}
                          onClick={() => openCompleteModal(booking)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{t('mobile:shifts.completeAndPay', 'Complete & Record Payment')}</span>
                        </button>
                        {isStartInFuture && (
                          <p className="text-[10px] text-amber-700 text-center">
                            {t('mobile:shifts.futureShiftNotice', 'Completion opens after scheduled start time')}
                          </p>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        if (window.confirm(t('mobile:shifts.cancelConfirm', 'Cancel this shift booking?'))) {
                          cancelMutation.mutate(booking.id);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{t('mobile:shifts.cancel', 'Cancel Booking')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mobile-card p-8 text-center space-y-2">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-sm text-slate-900">
              {t('mobile:shifts.noActiveEmployer', 'No active shift bookings')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('mobile:shifts.noActiveEmployerDesc', 'Confirm candidate shifts from Candidates or Saved Workers.')}
            </p>
          </div>
        )
      ) : (
        /* TAB 2: COMPLETED */
        isLoadingHistory ? (
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
              const balance = Number(pr?.outstanding_balance) || 0;
              const canAddInstallment = pr && !isConfirmed && balance > 0;

              return (
                <div key={b.id} className="mobile-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate">
                        {item.job_title || t('employer.completedShiftTitle', 'Completed Shift')}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('payments.worker', 'Worker')}: {item.counterpart_name || 'Worker'}
                        {wc && ` · ${Number(wc.hours_worked).toFixed(1)}h`}
                      </p>
                    </div>
                    <MobileStatusBadge status={b.status} />
                  </div>

                  <PaymentHistoryCard paymentRecord={pr} defaultExpanded={isDisputed} />

                  <div className="flex flex-wrap gap-2">
                    {isDisputed && pr && (
                      <button
                        type="button"
                        onClick={() => openResolveModal(b, pr)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-rose-600 py-2.5 px-3 text-xs font-bold text-white"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        <span>{t('mobile:shifts.resolveDispute', 'Resolve Dispute')}</span>
                      </button>
                    )}

                    {canAddInstallment && pr && (
                      <button
                        type="button"
                        onClick={() => openInstallmentModal(b, pr)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-900 py-2.5 px-3 text-xs font-bold text-white"
                      >
                        <PlusCircle className="h-4 w-4" />
                        <span>{t('mobile:shifts.addInstallment', 'Add Installment')}</span>
                      </button>
                    )}

                    {item.can_rate && item.application_id && (
                      <button
                        type="button"
                        onClick={() =>
                          setRateTarget({
                            applicationId: item.application_id!,
                            userName: item.counterpart_name || 'Worker',
                          })
                        }
                        className="flex items-center justify-center gap-1 rounded-xl bg-amber-50 border border-amber-200 py-2.5 px-3 text-xs font-bold text-amber-800"
                      >
                        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                        <span>{t('mobile:shifts.rateWorker', 'Rate Worker')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

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
          <div className="mobile-card p-8 text-center space-y-2">
            <Briefcase className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-sm text-slate-900">
              {t('mobile:shifts.noHistory', 'No completed work history yet')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('mobile:shifts.noHistoryDesc', 'Completed shifts and offline payment records appear here.')}
            </p>
          </div>
        )
      )}

      {/* Complete Shift & Record Payment Modal */}
      {completeTarget && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:shifts.completeAndPay', 'Complete & Record Payment')}
              </h3>
              <button type="button" onClick={() => setCompleteTarget(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                completeMutation.mutate(completeTarget.id);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.actualStart', 'Actual Start')} *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={actualStart}
                    onChange={(e) => setActualStart(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.actualEnd', 'Actual End')} *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={actualEnd}
                    onChange={(e) => setActualEnd(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.hoursWorked', 'Hours')} *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.agreedAmount', 'Agreed (₹)')}
                  </label>
                  <input
                    type="number"
                    value={agreedAmount}
                    onChange={(e) => setAgreedAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.amountPaid', 'Paid (₹)')} *
                  </label>
                  <input
                    type="number"
                    required
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.paymentMethod', 'Payment Mode')}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.paymentDate', 'Payment Date')}
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:shifts.paymentRef', 'UPI / Reference ID')}
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:shifts.completionNotes', 'Notes')}
                </label>
                <input
                  type="text"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={completeMutation.isPending}
                className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white"
              >
                {completeMutation.isPending ? t('mobile:common.saving', 'Saving...') : t('mobile:shifts.completeAndPay', 'Save Completion & Payment')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Installment Modal */}
      {installmentTarget && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:shifts.addInstallment', 'Add Installment')}
              </h3>
              <button type="button" onClick={() => setInstallmentTarget(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                installmentMutation.mutate(installmentTarget.booking.id);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:shifts.installmentAmount', 'Installment Amount (₹)')} *
                </label>
                <input
                  type="number"
                  required
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.paymentMethod', 'Payment Mode')}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('mobile:shifts.paymentRef', 'UPI / Ref ID')}
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={installmentMutation.isPending}
                className="w-full rounded-xl bg-indigo-900 py-3 font-bold text-white"
              >
                {installmentMutation.isPending ? t('mobile:common.saving', 'Saving...') : t('mobile:shifts.addInstallment', 'Save Installment')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {disputeTarget && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:shifts.resolveDispute', 'Correct & Resolve Dispute')}
              </h3>
              <button type="button" onClick={() => setDisputeTarget(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            {disputeTarget.payment.dispute_reason && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                {disputeTarget.payment.dispute_reason}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resolveDisputeMutation.mutate(disputeTarget.booking.id);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:shifts.amountPaid', 'Corrected Amount Paid (₹)')} *
                </label>
                <input
                  type="number"
                  required
                  value={correctedAmountPaid}
                  onChange={(e) => setCorrectedAmountPaid(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:shifts.correctionNote', 'Correction Note')} *
                </label>
                <textarea
                  rows={2}
                  required
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder={t('mobile:shifts.correctionPlaceholder', 'Describe adjustment made...')}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={resolveDisputeMutation.isPending}
                className="w-full rounded-xl bg-rose-600 py-3 font-bold text-white"
              >
                {resolveDisputeMutation.isPending ? t('mobile:common.saving', 'Saving...') : t('mobile:shifts.resolveDispute', 'Submit Adjustment')}
              </button>
            </form>
          </div>
        </div>
      )}

      {rateTarget && (
        <MobileRateModal
          isOpen={!!rateTarget}
          onClose={() => setRateTarget(null)}
          applicationId={rateTarget.applicationId}
          userName={rateTarget.userName}
          onSuccess={() => void refreshAll()}
        />
      )}
    </div>
  );
};

export default MobileEmployerShiftBookingsPage;
