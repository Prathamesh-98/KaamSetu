import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  MapPin, DollarSign, ChevronRight, Briefcase 
} from 'lucide-react';
import { shiftsApi } from '../../../api/services';

export const MobileWorkerShiftsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

  // Booked Shifts
  const { data: bookings, isLoading: isBookingsLoading } = useQuery({
    queryKey: ['worker-shifts-me'],
    queryFn: shiftsApi.getMyBookings,
  });

  // Work History
  const { data: workHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['worker-history-me'],
    queryFn: () => shiftsApi.getMyWorkHistory(1, 20),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.acceptShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker-shifts-me'] }),
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.declineShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker-shifts-me'] }),
  });

  const shiftList = Array.isArray(bookings) ? bookings : [];
  const historyList = workHistoryData?.items || [];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">{t('worker.shifts', 'Shifts & Earnings')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
            activeTab === 'upcoming'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('worker.upcomingShifts', 'Active Shifts')} ({shiftList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('worker.workHistory', 'Settled History')} ({historyList.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'upcoming' ? (
        isBookingsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : shiftList.length > 0 ? (
          <div className="space-y-3">
            {shiftList.map((shift: any) => (
              <div key={shift.id} className="mobile-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{shift.job?.title || 'Shift Booking'}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{shift.employer?.organization_name || 'Employer'}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    shift.status === 'ACCEPTED'
                      ? 'bg-emerald-50 text-emerald-700'
                      : shift.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {shift.status}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>{shift.shift_date || 'Date scheduled'}</span>
                  </div>
                  <div className="font-extrabold text-indigo-900 text-sm">
                    ₹{shift.agreed_wage || shift.job?.salary_min || 0}
                  </div>
                </div>

                {shift.status === 'PENDING' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => acceptMutation.mutate(shift.id)}
                      className="flex-1 rounded-xl bg-indigo-900 py-2 text-xs font-bold text-white shadow-sm"
                    >
                      Accept Shift
                    </button>
                    <button
                      type="button"
                      onClick={() => declineMutation.mutate(shift.id)}
                      className="flex-1 rounded-xl bg-white border border-slate-200 py-2 text-xs font-bold text-slate-700"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">{t('worker.noActiveShifts', 'No Active Shifts')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('worker.noActiveShiftsDesc', 'When an employer books you for a shift, it will appear here.')}</p>
          </div>
        )
      ) : (
        isHistoryLoading ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-28 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : historyList.length > 0 ? (
          <div className="space-y-3">
            {historyList.map((item: any) => (
              <div key={item.id} className="mobile-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{item.title || 'Completed Shift'}</span>
                  <span className="font-extrabold text-xs text-emerald-700">₹{item.amount || 0}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'Settled'}</span>
                  <span className="text-emerald-600 font-semibold">Payment Confirmed ✓</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm">
            <Clock className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">{t('worker.noCompletedShifts', 'No Completed Shifts Yet')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('worker.noCompletedShiftsDesc', 'Your verified earnings history will be tracked here.')}</p>
          </div>
        )
      )}
    </div>
  );
};

export default MobileWorkerShiftsPage;
