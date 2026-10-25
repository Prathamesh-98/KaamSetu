import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Calendar, Clock, CheckCircle, XCircle, Briefcase, 
  AlertTriangle, Star, PlusCircle, ChevronLeft, ChevronRight,
  ShieldAlert, DollarSign, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftsApi } from '../../api/services';
import LoadingScreen from '../../components/common/LoadingScreen';
import { PaymentHistoryCard } from '../../components/shifts/PaymentHistoryCard';
import { CompleteShiftModal } from '../../components/shifts/CompleteShiftModal';
import { AddInstallmentModal } from '../../components/shifts/AddInstallmentModal';
import { DisputeCorrectionModal } from '../../components/shifts/DisputeCorrectionModal';
import { RateUserModal } from '../../components/RateUserModal';
import type { ShiftBooking, WorkHistoryItem, PaymentRecord } from '../../types';

export const EmployerShiftBookingsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') === 'completed' ? 'completed' : 'active';
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'completed' && activeTab !== 'completed') {
      setActiveTab('completed');
    } else if (!tabParam && activeTab !== 'active') {
      setActiveTab('active');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'active' | 'completed') => {
    setActiveTab(tab);
    setSearchParams(tab === 'completed' ? { tab: 'completed' } : {});
  };

  const [page, setPage] = useState(1);
  const perPage = 10;

  // ── Queries ──
  const { data: activeBookings, isLoading: isActiveLoading } = useQuery<ShiftBooking[]>({
    queryKey: ['employer-bookings'],
    queryFn: shiftsApi.getMyBookings,
    enabled: activeTab === 'active',
  });

  const { data: workHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['work-history', page, perPage],
    queryFn: () => shiftsApi.getMyWorkHistory(page, perPage),
    enabled: activeTab === 'completed',
  });

  // ── Cancel Shift Mutation ──
  const cancelMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.cancelShift(id),
    onSuccess: () => {
      toast.success(t('employer.shiftCancelled', 'Shift booking cancelled'));
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('common.error', 'Action failed'));
    },
  });

  // ── Modal States ──
  const [completeBooking, setCompleteBooking] = useState<ShiftBooking | null>(null);
  const [addInstallmentTarget, setAddInstallmentTarget] = useState<{
    booking: ShiftBooking;
    paymentRecord: PaymentRecord;
  } | null>(null);
  const [resolveDisputeTarget, setResolveDisputeTarget] = useState<{
    booking: ShiftBooking;
    paymentRecord: PaymentRecord;
  } | null>(null);
  const [rateItem, setRateItem] = useState<{
    applicationId: string;
    userName: string;
  } | null>(null);

  const isLoading = activeTab === 'active' ? isActiveLoading : isHistoryLoading;
  if (isLoading) return <LoadingScreen />;

  // Filter active to pending & confirmed
  const filteredActive = (activeBookings || []).filter(
    (b) => b.status === 'PENDING' || b.status === 'CONFIRMED'
  );

  const now = new Date();

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t('employer.shifts', 'Shift Management & Settlement')}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t('employer.shiftsSubtitle', 'Track active shift bookings, record work completions, and manage offline installment settlements')}
          </p>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex bg-gray-100 p-1 rounded-xl self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => handleTabChange('active')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'active'
                ? 'bg-white text-[#2455E8] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('employer.activeShiftsTab', 'Active Shifts')}
            {filteredActive.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-[#2455E8] rounded-full font-bold">
                {filteredActive.length}
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
            {t('employer.completedSettlementTab', 'Completed & Settlement')}
            {(workHistoryData?.total || 0) > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-bold">
                {workHistoryData?.total}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── TAB 1: ACTIVE SHIFTS ── */}
      {activeTab === 'active' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredActive.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-gray-200 shadow-2xs">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800">
                {t('employer.noActiveShifts', 'No active shift bookings found')}
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {t('employer.noActiveShiftsDesc', 'Post jobs and confirm candidate shifts to manage attendance and offline payments.')}
              </p>
            </div>
          ) : (
            filteredActive.map((booking) => {
              const isStartInFuture = new Date(booking.start_time).getTime() > now.getTime();

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col gap-4 hover:border-gray-300 transition-all"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-base text-gray-900">
                        {booking.job?.title || t('employer.shiftBooking', 'Shift Booking')}
                      </div>
                      <span className="text-xs text-gray-500 block">
                        {t('employer.worker', 'Worker')}: {booking.worker?.full_name || booking.worker_id}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        booking.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : booking.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
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
                        <span className="text-xs text-gray-500">{t('employer.agreedRate', 'Agreed Rate')}:</span>
                        <span>₹{Number(booking.proposed_rate).toFixed(2)}</span>
                      </div>
                    )}
                    {booking.notes && (
                      <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg">
                        "{booking.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions for Confirmed Shift */}
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    {booking.status === 'CONFIRMED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCompleteBooking(booking)}
                          disabled={isStartInFuture}
                          title={isStartInFuture ? t('payments.cannotCompleteFutureShift', 'Cannot complete shift before scheduled start time') : ''}
                          className="w-full flex items-center justify-center gap-2 bg-[#2455E8] hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{t('payments.completeShiftBtn', 'Complete Shift & Record Payment')}</span>
                        </button>
                        {isStartInFuture && (
                          <span className="text-2xs text-amber-700 block text-center">
                            {t('payments.scheduledInFutureNotice', 'Scheduled for future — completion opens when shift starts')}
                          </span>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('employer.confirmCancelShift', 'Are you sure you want to cancel this shift?'))) {
                          cancelMutation.mutate(booking.id);
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      className="w-full flex items-center justify-center gap-1 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{t('employer.cancelShiftBtn', 'Cancel Booking')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB 2: COMPLETED SHIFTS & SETTLEMENT ── */}
      {activeTab === 'completed' && (
        <div className="space-y-6">
          {(!workHistoryData?.items || workHistoryData.items.length === 0) ? (
            <div className="py-16 text-center bg-white rounded-xl border border-gray-200 shadow-2xs">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800">
                {t('payments.noCompletedShiftsEmployer', 'No completed shifts found')}
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {t('payments.noCompletedShiftsEmployerDesc', 'When shifts finish, record completion and settlements to maintain your verified employer record.')}
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
                const balance = Number(payment?.outstanding_balance) || 0;
                const canAddInstallment = payment && !isConfirmed && balance > 0;

                return (
                  <div
                    key={booking.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden"
                  >
                    {/* ── Completed Shift Header ── */}
                    <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-gray-900">
                            {item.job_title || t('employer.completedShiftTitle', 'Completed Shift')}
                          </h3>
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {t('payments.shiftCompleted', 'Shift Completed')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span>
                            <strong>{t('payments.worker', 'Worker')}:</strong>{' '}
                            {item.counterpart_name || t('worker.defaultName', 'Worker')}
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
                                <strong>{t('payments.actualHours', 'Hours Worked')}:</strong>{' '}
                                {Number(completion.hours_worked).toFixed(2)}h
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* ── Actions for Employer ── */}
                      <div className="flex items-center gap-2.5 flex-wrap self-end md:self-center">
                        {/* Resolve Dispute Button */}
                        {isDisputed && payment && (
                          <button
                            type="button"
                            onClick={() => setResolveDisputeTarget({ booking, paymentRecord: payment })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            <span>{t('payments.resolveDisputeActionBtn', 'Resolve Dispute')}</span>
                          </button>
                        )}

                        {/* Add Installment Button */}
                        {canAddInstallment && (
                          <button
                            type="button"
                            onClick={() => setAddInstallmentTarget({ booking, paymentRecord: payment })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2455E8] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <PlusCircle className="w-4 h-4" />
                            <span>{t('payments.addInstallmentActionBtn', 'Add Installment')}</span>
                          </button>
                        )}

                        {/* Rate Worker Button */}
                        {item.can_rate && item.application_id && (
                          <button
                            type="button"
                            onClick={() =>
                              setRateItem({
                                applicationId: item.application_id!,
                                userName: item.counterpart_name || t('worker.defaultName', 'Worker'),
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            <span>{t('rate_worker', 'Rate Worker')}</span>
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
      {completeBooking && (
        <CompleteShiftModal
          isOpen={Boolean(completeBooking)}
          onClose={() => setCompleteBooking(null)}
          booking={completeBooking}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['work-history'] });
            setCompleteBooking(null);
            setActiveTab('completed');
          }}
        />
      )}

      {addInstallmentTarget && (
        <AddInstallmentModal
          isOpen={Boolean(addInstallmentTarget)}
          onClose={() => setAddInstallmentTarget(null)}
          booking={addInstallmentTarget.booking}
          paymentRecord={addInstallmentTarget.paymentRecord}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['work-history'] });
            setAddInstallmentTarget(null);
          }}
        />
      )}

      {resolveDisputeTarget && (
        <DisputeCorrectionModal
          isOpen={Boolean(resolveDisputeTarget)}
          onClose={() => setResolveDisputeTarget(null)}
          booking={resolveDisputeTarget.booking}
          paymentRecord={resolveDisputeTarget.paymentRecord}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['work-history'] });
            setResolveDisputeTarget(null);
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
};
