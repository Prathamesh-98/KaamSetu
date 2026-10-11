import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { shiftsApi } from '../../api/services';
import { Calendar, Clock, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function MyAvailabilityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: availability, isLoading } = useQuery({
    queryKey: ['my-availability'],
    queryFn: shiftsApi.getMyAvailability,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => shiftsApi.createAvailability(data),
    onSuccess: (newSlot) => {
      queryClient.setQueryData(['my-availability'], (old: any[] = []) => {
        return [...(old || []), newSlot].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
      });
      void queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      toast.success(t('availability.created', 'Availability slot added'));
      setStartDate('');
      setEndDate('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || t('availability.error', 'Failed to add availability');
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.deleteAvailability(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(['my-availability'], (old: any[] = []) => {
        return (old || []).filter((s: any) => s.id !== deletedId);
      });
      void queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      toast.success(t('availability.deleted', 'Availability slot removed'));
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || t('availability.error', 'Failed to remove availability');
      toast.error(msg);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      toast.error(t('availability.invalidRange', 'End time must be after start time'));
      return;
    }
    createMutation.mutate({ start_time: start.toISOString(), end_time: end.toISOString() });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#2455E8]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#182849]">
          {t('worker.availability', 'My Availability')}
        </h1>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E7ECF3]">
        <h2 className="text-lg font-semibold mb-4">{t('availability.add', 'Add Availability')}</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('availability.start', 'Start Time')}</label>
            <input
              type="datetime-local"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#2455E8] focus:border-[#2455E8]"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('availability.end', 'End Time')}</label>
            <input
              type="datetime-local"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#2455E8] focus:border-[#2455E8]"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-[#2455E8] text-white rounded-lg hover:bg-[#1a44c9] disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {createMutation.isPending ? t('common.saving', 'Saving...') : t('common.add', 'Add')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E7ECF3] overflow-hidden">
        <div className="p-6 border-b border-[#E7ECF3]">
          <h2 className="text-lg font-semibold">{t('availability.upcoming', 'Upcoming Availability')}</h2>
        </div>
        <div className="divide-y divide-[#E7ECF3]">
          {(!availability || availability.length === 0) ? (
            <div className="p-8 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>{t('availability.empty', 'No availability slots added yet.')}</p>
            </div>
          ) : (
            availability.map((slot: any) => (
              <div key={slot.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2455E8]/10 rounded-lg flex items-center justify-center text-[#2455E8]">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-medium text-[#182849]">
                      {new Date(slot.start_time || slot.start_datetime).toLocaleString()} - {new Date(slot.end_time || slot.end_datetime).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(slot.id)}
                  disabled={deleteMutation.isPending && deleteMutation.variables === slot.id}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title={t('common.remove', 'Remove')}
                >
                  {deleteMutation.isPending && deleteMutation.variables === slot.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
