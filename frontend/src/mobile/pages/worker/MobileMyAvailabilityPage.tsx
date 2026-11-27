import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Trash2, Plus, Edit3, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { shiftsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import MobilePageHeader from '../../components/ui/MobilePageHeader';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';
import { useBackButton } from '../../hooks/useBackButton';

function toLocalDateTimeInput(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export const MobileMyAvailabilityPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const queryClient = useQueryClient();
  useBackButton();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState('');

  // Edit modal state
  const [editingSlot, setEditingSlot] = useState<any | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editError, setEditError] = useState('');

  const { data: availability = [], isLoading } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.myAvailability,
    queryFn: shiftsApi.getMyAvailability,
    staleTime: 10000,
    refetchOnMount: 'always',
  });

  const createMutation = useMutation({
    mutationFn: (data: { start_time: string; end_time: string }) => shiftsApi.createAvailability(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.myAvailability });
      toast.success(t('mobile:availability.added', 'Availability slot added'));
      setStartDate('');
      setEndDate('');
      setFormError('');
    },
    onError: (err) => {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { start_time: string; end_time: string } }) =>
      shiftsApi.updateAvailability(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.myAvailability });
      toast.success(t('mobile:availability.updated', 'Availability slot updated'));
      setEditingSlot(null);
    },
    onError: (err) => {
      const msg = extractErrorMessage(err);
      setEditError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shiftsApi.deleteAvailability(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.myAvailability });
      toast.success(t('mobile:availability.deleted', 'Availability slot removed'));
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      const msg = t('mobile:availability.invalidRange', 'End time must be after start time.');
      setFormError(msg);
      return;
    }
    createMutation.mutate({ start_time: start.toISOString(), end_time: end.toISOString() });
  };

  const openEditModal = (slot: any) => {
    setEditingSlot(slot);
    setEditStart(toLocalDateTimeInput(slot.start_time || slot.start_datetime));
    setEditEnd(toLocalDateTimeInput(slot.end_time || slot.end_datetime));
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !editStart || !editEnd) return;
    const start = new Date(editStart);
    const end = new Date(editEnd);
    if (start >= end) {
      setEditError(t('mobile:availability.invalidRange', 'End time must be after start time.'));
      return;
    }
    updateMutation.mutate({
      id: editingSlot.id,
      data: { start_time: start.toISOString(), end_time: end.toISOString() },
    });
  };

  const slotList = Array.isArray(availability) ? availability : [];

  return (
    <div className="flex flex-col">
      <MobilePageHeader
        title={t('mobile:availability.title', 'My Availability')}
        subtitle={t('mobile:availability.subtitle', 'Set your open work dates & times')}
      />

      <div className="p-4 space-y-4">
        {/* Add Availability Form Card */}
        <div className="mobile-card p-4 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">
            {t('mobile:availability.addSlot', 'Add Availability Slot')}
          </h2>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {t('mobile:availability.startTime', 'Start Date & Time')}
              </label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white min-h-[44px]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {t('mobile:availability.endTime', 'End Date & Time')}
              </label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white min-h-[44px]"
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white shadow-sm flex items-center justify-center gap-1.5 min-h-[48px] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              <span>
                {createMutation.isPending
                  ? t('mobile:common.saving', 'Saving...')
                  : t('mobile:availability.addBtn', 'Add Slot')}
              </span>
            </button>
          </form>
        </div>

        {/* Upcoming Slots List */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('mobile:availability.upcomingSlots', 'Your Upcoming Slots')} ({slotList.length})
          </h2>

          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2].map((n) => (
                <div key={n} className="h-20 rounded-2xl mobile-skeleton" />
              ))}
            </div>
          ) : slotList.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 space-y-2">
              <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">
                {t('mobile:availability.empty', 'No availability slots configured')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('mobile:availability.emptyDesc', 'Add your free dates and times so employers can book you.')}
              </p>
            </div>
          ) : (
            slotList.map((slot: any) => {
              const sTime = new Date(slot.start_time || slot.start_datetime);
              const eTime = new Date(slot.end_time || slot.end_datetime);
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === slot.id;
              return (
                <div key={slot.id} className="mobile-card p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-900 flex-shrink-0">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {sTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {sTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {eTime.toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(slot)}
                      className="mobile-touch-target rounded-xl p-2 text-indigo-900 hover:bg-indigo-50"
                      aria-label={t('mobile:availability.editSlot', 'Edit')}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('mobile:availability.deleteConfirm', 'Remove this availability slot?'))) {
                          deleteMutation.mutate(slot.id);
                        }
                      }}
                      disabled={isDeleting}
                      className="mobile-touch-target rounded-xl p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label={t('mobile:common.delete', 'Delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* Edit Slot Modal */}
      {editingSlot && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:availability.editSlot', 'Edit Availability Slot')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="mobile-touch-target rounded-full p-1.5 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="edit-avail-form" onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs">
              {editError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-red-700">{editError}</div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:availability.startTime', 'Start Date & Time')}
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs min-h-[44px]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:availability.endTime', 'End Date & Time')}
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs min-h-[44px]"
                />
              </div>
            </form>

            <div className="mobile-sticky-footer">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="mobile-touch-target flex-1 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 min-h-[48px]"
                >
                  {t('mobile:common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  form="edit-avail-form"
                  disabled={updateMutation.isPending}
                  className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white shadow-md min-h-[48px]"
                >
                  {updateMutation.isPending ? t('mobile:common.saving', 'Saving...') : t('mobile:common.save', 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileMyAvailabilityPage;
