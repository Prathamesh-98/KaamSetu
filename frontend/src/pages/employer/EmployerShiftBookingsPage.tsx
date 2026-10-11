import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '../../api/services';
import { format } from 'date-fns';

export const EmployerShiftBookingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['employer-bookings'],
    queryFn: shiftsApi.getMyBookings
  });

  const cancelMutation = useMutation({
    mutationFn: shiftsApi.cancelShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
    }
  });

  if (isLoading) return <div className="p-4">Loading shifts...</div>;
  if (error) return <div className="p-4 text-red-500">Error loading shifts</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Shift Bookings</h1>
      
      {(!bookings || bookings.length === 0) ? (
        <p className="text-gray-500">No shift bookings found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bookings.map((booking: any) => (
            <div key={booking.id} className="bg-white p-4 rounded-lg shadow border">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-800">Worker ID: {booking.worker_id}</p>
                  <p className="text-sm text-gray-600">Job ID: {booking.job_id}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                  booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {booking.status}
                </span>
              </div>
              
              <div className="text-sm mb-4">
                <p><strong>Start:</strong> {format(new Date(booking.start_time), 'PPp')}</p>
                <p><strong>End:</strong> {format(new Date(booking.end_time), 'PPp')}</p>
              </div>

              {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to cancel this shift?')) {
                      cancelMutation.mutate(booking.id);
                    }
                  }}
                  disabled={cancelMutation.isPending}
                  className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded hover:bg-red-100 transition disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Shift'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
