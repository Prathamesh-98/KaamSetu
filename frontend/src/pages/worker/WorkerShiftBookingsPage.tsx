import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Calendar, Clock, MapPin, CheckCircle, XCircle, Briefcase, 
  AlertTriangle, Star, CheckCheck, ChevronLeft, ChevronRight,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftsApi } from '../../api/services';
import LoadingScreen from '../../components/common/LoadingScreen';
import { PaymentHistoryCard } from '../../components/shifts/PaymentHistoryCard';
import { DisputePaymentModal } from '../../components/shifts/DisputePaymentModal';
import { RateUserModal } from '../../components/RateUserModal';
import type { ShiftBooking, WorkHistoryItem } from '../../types';

export default function WorkerShiftBookingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab state: 'upcoming' | 'completed'
  const initialTab = searchParams.get('tab') === 'completed' ? 'completed' : 'upcoming';
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'completed' && activeTab !== 'completed') {
      setActiveTab('completed');
    } else if (!tabParam && activeTab !== 'upcoming') {
      setActiveTab('upcoming');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'upcoming' | 'completed') => {
    setActiveTab(tab);
    setSearchParams(tab === 'completed' ? { tab: 'completed' } : {});
  };

  // Pagination for Completed Work History
  const [page, setPage] = useState(1);
  const perPage = 10;

  // ── Queries ──
  const { data: upcomingBookings, isLoading: isUpcomingLoading } = useQuery<ShiftBooking[]>({
    queryKey: ['my-bookings'],
    queryFn: shiftsApi.getMyBookings,
    enabled: activeTab === 'upcoming',
  });

  const { data: workHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['work-history', page, perPage],
    queryFn: () => shiftsApi.getMyWorkHistory(page, perPage),
    enabled: activeTab === 'completed',
  });

  // ── Mutations for Upcoming Shifts ──
  const acceptMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.acceptShift(id),
    onSuccess: () => {
      toast.success(t('worker.shiftAccepted', 'Shift booking accepted!'));
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('common.error', 'Action failed'));
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.declineShift(id),
    onSuccess: () => {
      toast.success(t('worker.shiftDeclined', 'Shift booking declined'));
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('common.error', 'Action failed'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.cancelShift(id),
    onSuccess: () => {
      toast.success(t('worker.shiftCancelled', 'Shift booking cancelled'));
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('common.error', 'Action failed'));
    },
  });

  // ── Confirm Payment Mutation ──
  const confirmPaymentMutation = useMutation({
    mutationFn: (bookingId: string) => shiftsApi.confirmPayment(bookingId),
    onSuccess: () => {
      toast.success(t('payments.confirmSuccess', 'Payment receipt acknowledged and confirmed!'));
      queryClient.invalidateQueries({ queryKey: ['work-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('payments.confirmError', 'Failed to confirm payment'));
    },
  });

  // ── Modal States ──
  const [selectedDisputeItem, setSelectedDisputeItem] = useState<{
    booking: ShiftBooking;
    paymentRecord: any;
  } | null>(null);

  const [rateItem, setRateItem] = useState<{
    applicationId: string;
    userName: string;
  } | null>(null);

  const isLoading = activeTab === 'upcoming' ? isUpcomingLoading : isHistoryLoading;
  if (isLoading) return <LoadingScreen />;

  // Filter upcoming to exclude COMPLETED and CANCELLED (which belong in history)
  const activeBookings = (upcomingBookings || []).filter(
    (b) => b.status === 'PENDING' || b.status === 'CONFIRMED'
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#182849]">
            {t('worker.shifts', 'My Shifts & Work History')}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t('worker.shiftsSubtitle', 'Manage upcoming bookings and verify completed work & offline payments')}
          </p>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex bg-gray-100 p-1 rounded-xl self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => handleTabChange('upcoming')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'upcoming'
                ? 'bg-white text-[#2455E8] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('worker.upcomingShiftsTab', 'Upcoming Shifts')}
            {activeBookings.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-[#2455E8] rounded-full">
                {activeBookings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('completed')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'completed'
                ? 'bg-white text-[#2455E8] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('worker.completedWorkTab', 'Completed Work & Payments')}
            {(workHistoryData?.total || 0) > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-bold">
                {workHistoryData?.total}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── TAB 1: UPCOMING SHIFTS ── */}
      {activeTab === 'upcoming' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeBookings.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-[#E7ECF3] shadow-2xs">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800">
                {t('worker.noUpcomingShifts', 'No upcoming shifts scheduled')}
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {t('worker.noUpcomingShiftsDesc', 'Browse available jobs and apply to get booked for shifts.')}
              </p>
            </div>
          ) : (
            activeBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-xl border border-[#E7ECF3] p-5 shadow-xs flex flex-col gap-4 hover:border-gray-300 transition-all"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-semibold text-base text-[#182849]">
                      {booking.job?.title || t('worker.shiftLabel', 'Shift Booking')}
                    </div>
                    {booking.employer?.organization_name && (
                      <span className="text-xs text-gray-500 block">
                        {booking.employer.organization_name}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                      booking.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : booking.status === 'CONFIRMED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>
                      {new Date(booking.start_time).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>
                      {new Date(booking.start_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {new Date(booking.end_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {booking.proposed_rate && (
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <span className="text-xs text-gray-500">{t('worker.agreedRate', 'Agreed Rate')}:</span>
                      <span>₹{Number(booking.proposed_rate).toFixed(2)}</span>
                    </div>
                  )}
                  {booking.notes && (
                    <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg">
                      "{booking.notes}"
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E7ECF3] flex gap-2">
                  {booking.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => acceptMutation.mutate(booking.id)}
                        disabled={acceptMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#2455E8] hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {t('worker.accept', 'Accept')}
                      </button>
                      <button
                        onClick={() => declineMutation.mutate(booking.id)}
                        disabled={declineMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        {t('worker.decline', 'Decline')}
                      </button>
                    </>
                  )}
                  {booking.status === 'CONFIRMED' && (
                    <button
                      onClick={() => {
                        if (window.confirm(t('worker.confirmCancelShift', 'Are you sure you want to cancel this confirmed shift?'))) {
                          cancelMutation.mutate(booking.id);
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      className="w-full flex items-center justify-center gap-1 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {t('worker.cancel', 'Cancel Booking')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 2: COMPLETED WORK & PAYMENTS ── */}
      {activeTab === 'completed' && (
        <div className="space-y-6">
          {(!workHistoryData?.items || workHistoryData.items.length === 0) ? (
            <div className="py-16 text-center bg-white rounded-xl border border-[#E7ECF3] shadow-2xs">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800">
                {t('payments.noCompletedWork', 'No completed work records found')}
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {t(
                  'payments.noCompletedWorkDesc',
                  'When you complete shifts, employers record work hours and offline settlements here.'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {workHistoryData.items.map((item: WorkHistoryItem) => {
                const booking = item.shift_booking;
                const completion = item.work_completion;
                const payment = item.payment_record;

                const isDisputed = payment?.payment_status === 'DISPUTED';
                const isConfirmed = payment?.payment_status === 'CONFIRMED';
                const hasUnconfirmedInstallments = (payment?.installments || []).some(
                  (inst) => !inst.is_confirmed && !inst.worker_confirmed_at
                );
                const canConfirm =
                  payment &&
                  !isDisputed &&
                  !isConfirmed &&
                  (payment.payment_status === 'PENDING_CONFIRMATION' ||
                    payment.payment_status === 'PARTIALLY_PAID');

                const canDispute = payment && !isConfirmed && !isDisputed;

                return (
                  <div
                    key={booking.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden"
                  >
                    {/* ── Shift Summary Row ── */}
                    <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-gray-900">
                            {item.job_title || t('worker.completedShift', 'Completed Shift')}
                          </h3>
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {t('payments.shiftCompleted', 'Work Completed')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span>
                            <strong>{t('payments.employer', 'Employer')}:</strong>{' '}
                            {item.counterpart_name || t('employer.defaultName', 'Employer')}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(booking.start_time).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          {completion && (
                            <>
                              <span>•</span>
                              <span>
                                <strong>{t('payments.actualHours', 'Actual Hours')}:</strong>{' '}
                                {Number(completion.hours_worked).toFixed(2)}h
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Action Buttons for Worker */}
                      <div className="flex items-center gap-2.5 flex-wrap self-end md:self-center">
                        {/* Confirm Payment Action */}
                        {canConfirm && (
                          <button
                            type="button"
                            onClick={() => confirmPaymentMutation.mutate(booking.id)}
                            disabled={confirmPaymentMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                          >
                            <CheckCheck className="w-4 h-4" />
                            <span>
                              {confirmPaymentMutation.isPending
                                ? t('payments.confirming', 'Confirming...')
                                : t('payments.confirmReceiptBtn', 'Confirm Receipt')}
                            </span>
                          </button>
                        )}

                        {/* Dispute Payment Action */}
                        {canDispute && (
                          <button
                            type="button"
                            onClick={() => setSelectedDisputeItem({ booking, paymentRecord: payment })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{t('payments.disputePaymentBtn', 'Dispute Payment')}</span>
                          </button>
                        )}

                        {/* Rate Employer Action */}
                        {item.can_rate && item.application_id && (
                          <button
                            type="button"
                            onClick={() =>
                              setRateItem({
                                applicationId: item.application_id!,
                                userName: item.counterpart_name || t('employer.defaultName', 'Employer'),
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            <span>{t('rate_employer', 'Rate Employer')}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Payment Ledger Card ── */}
                    <div className="p-4 sm:p-5">
                      <PaymentHistoryCard paymentRecord={payment} defaultExpanded={isDisputed} />
                    </div>
                  </div>
                );
              })}

              {/* ── Pagination ── */}
              {workHistoryData && workHistoryData.total_pages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {t('pagination.showing', 'Showing page {{page}} of {{total}}', {
                      page: workHistoryData.page,
                      total: workHistoryData.total_pages,
                    })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-medium rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      {t('pagination.prev', 'Previous')}
                    </button>
                    <button
                      disabled={page >= workHistoryData.total_pages}
                      onClick={() => setPage(page + 1)}
                      className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-medium rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                    >
                      {t('pagination.next', 'Next')}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {selectedDisputeItem && (
        <DisputePaymentModal
          isOpen={Boolean(selectedDisputeItem)}
          onClose={() => setSelectedDisputeItem(null)}
          booking={selectedDisputeItem.booking}
          paymentRecord={selectedDisputeItem.paymentRecord}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['work-history'] });
            setSelectedDisputeItem(null);
          }}
        />
      )}

      {rateItem && (
        <RateUserModal
          isOpen={Boolean(rateItem)}
          onClose={() => setRateItem(null)}
          applicationId={rateItem.applicationId}
          userName={rateItem.userName}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['work-history'] });
            setRateItem(null);
          }}
        />
      )}
    </div>
  );
}
