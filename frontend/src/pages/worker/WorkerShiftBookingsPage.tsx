import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '../../api/services';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, MapPin, CheckCircle, XCircle } from 'lucide-react';
import LoadingScreen from '../../components/common/LoadingScreen';

export default function WorkerShiftBookingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery<any[]>({
    queryKey: ['my-bookings'],
    queryFn: shiftsApi.getMyBookings,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.acceptShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.declineShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.cancelShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-[#182849]">{t('worker.shifts', 'My Shifts')}</h1>
          <p className="text-gray-500 mt-1">{t('worker.shiftsSubtitle', 'Manage your upcoming shift bookings')}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bookings?.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-[#E7ECF3]">
            <p className="text-gray-500">{t('worker.noShifts', 'No shift bookings found.')}</p>
          </div>
        ) : (
          bookings?.map((booking: any) => (
            <div key={booking.id} className="bg-white rounded-xl border border-[#E7ECF3] p-5 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="font-semibold text-lg text-[#182849]">
                  {booking.shift?.title || t('worker.shiftLabel', 'Shift')}
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                  booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {booking.status}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{new Date(booking.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {booking.shift?.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{booking.shift?.location}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#E7ECF3] flex gap-2">
                {booking.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => acceptMutation.mutate(booking.id)}
                      disabled={acceptMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1 bg-[#2455E8] hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t('worker.accept', 'Accept')}
                    </button>
                    <button
                      onClick={() => declineMutation.mutate(booking.id)}
                      disabled={declineMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      {t('worker.decline', 'Decline')}
                    </button>
                  </>
                )}
                {booking.status === 'CONFIRMED' && (
                  <button
                    onClick={() => cancelMutation.mutate(booking.id)}
                    disabled={cancelMutation.isPending}
                    className="w-full flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    {t('worker.cancel', 'Cancel')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
