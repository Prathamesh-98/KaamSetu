import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Heart, MapPin, Star, User, ShieldCheck, Calendar, Edit3, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { employerApi, jobsApi, shiftsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import type { JobListItem } from '../../../types';
import { MOBILE_QUERY_KEYS, invalidateShiftSync } from '../../sync/queryKeys';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';

export const MobileSavedWorkersPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [noteTarget, setNoteTarget] = useState<{ workerId: string; name: string; notes: string } | null>(null);

  // Shift booking sheet
  const [bookingWorker, setBookingWorker] = useState<any | null>(null);
  const [jobId, setJobId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const poll = useAdaptivePollInterval(25000);

  const { data: savedWorkers = [], isLoading } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.savedWorkers,
    queryFn: employerApi.getSavedWorkers,
    refetchInterval: poll,
  });

  const { data: myJobs = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.employerJobs,
    queryFn: () => jobsApi.myJobs(),
  });

  const activeJobs = useMemo(
    () => (Array.isArray(myJobs) ? myJobs.filter((j: JobListItem) => j.status === 'ACTIVE') : []),
    [myJobs]
  );

  const removeMutation = useMutation({
    mutationFn: (workerId: string) => employerApi.removeSavedWorker(workerId),
    onSuccess: () => {
      toast.success(t('savedWorkers.removed', 'Worker removed from saved list'));
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkers });
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkerIds });
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to remove worker'),
  });

  const saveNoteMutation = useMutation({
    mutationFn: ({ workerId, notes }: { workerId: string; notes: string }) =>
      employerApi.saveWorker(workerId, notes),
    onSuccess: () => {
      toast.success(t('mobile:common.save', 'Saved note'));
      setNoteTarget(null);
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkers });
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Failed to save note'),
  });

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingWorker || !jobId || isBooking) return;
    const sDt = new Date(startTime);
    const eDt = new Date(endTime);
    if (!startTime || !endTime || sDt >= eDt) {
      toast.error(t('start_time_must_be_before_end_time', 'End time must be after start time.'));
      return;
    }
    setIsBooking(true);
    try {
      await shiftsApi.requestShift({
        worker_id: bookingWorker.id,
        job_id: jobId,
        start_time: sDt.toISOString(),
        end_time: eDt.toISOString(),
      });
      toast.success(t('shift_requested_successfully', 'Shift requested successfully!'));
      await invalidateShiftSync(queryClient);
      setBookingWorker(null);
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to book shift');
    } finally {
      setIsBooking(false);
    }
  };

  const filtered = useMemo(() => {
    const list = Array.isArray(savedWorkers) ? savedWorkers : [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item: any) => {
      const w = item.worker || item;
      const skillText = (w.skills || []).map((s: any) => s.skill?.name || '').join(' ');
      return (
        (w.full_name || '').toLowerCase().includes(q) ||
        (w.city || '').toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q) ||
        skillText.toLowerCase().includes(q)
      );
    });
  }, [savedWorkers, search]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">
          {t('mobile:employerFlow.savedWorkersTitle', 'Saved Workers')}
        </h1>
        <p className="text-xs text-slate-500">
          {filtered.length} {t('common.saved', 'saved')}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('mobile:employerFlow.searchSaved', 'Search by name, skill, city, or notes...')}
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-2xl mobile-skeleton" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((item: any) => {
            const w = item.worker || item;
            return (
              <div key={w.id} className="mobile-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => navigate(`/employer/workers/${w.id}`)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {w.profile_image_url ? (
                        <img src={w.profile_image_url} alt={w.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-6 w-6 text-indigo-700" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-bold text-sm text-slate-900 truncate">{w.full_name}</h3>
                        {w.is_verified && <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-amber-600" />
                        {[w.city, w.state].filter(Boolean).join(', ') || 'India'}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 mt-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {(w.average_rating || 0).toFixed(1)} · ₹{w.expected_salary || '—'}/{w.salary_type || 'DAY'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(w.id)}
                    className="mobile-touch-target rounded-full p-1.5"
                    aria-label="Remove saved worker"
                  >
                    <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
                  </button>
                </div>

                {item.notes && (
                  <div className="rounded-xl bg-amber-50/70 px-3 py-2 text-xs text-amber-900 border border-amber-100">
                    <strong>{t('mobile:employerFlow.privateNote', 'Private Note')}:</strong> {item.notes}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteTarget({ workerId: w.id, name: w.full_name, notes: item.notes || '' })}
                    className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {t('mobile:employerFlow.editNote', 'Edit Note')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeJobs.length === 0) {
                        toast.error(t('mobile:employerFlow.noJobsToMatch', 'Post an active job first.'));
                        return;
                      }
                      setJobId(activeJobs[0].id);
                      setBookingWorker(w);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-900 py-2 text-xs font-bold text-white"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {t('mobile:employerFlow.bookShift', 'Book Shift')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mobile-card p-8 text-center space-y-2">
          <Heart className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-sm text-slate-900">
            {t('mobile:employerFlow.savedWorkersTitle', 'No saved workers')}
          </h3>
          <button
            type="button"
            onClick={() => navigate('/employer/candidates')}
            className="mt-2 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
          >
            {t('employer.findWorkers', 'Find Candidates')}
          </button>
        </div>
      )}

      {/* Edit Note Sheet */}
      {noteTarget && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:employerFlow.editNote', 'Private Note')} — {noteTarget.name}
              </h3>
              <button type="button" onClick={() => setNoteTarget(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <textarea
              rows={3}
              value={noteTarget.notes}
              onChange={(e) => setNoteTarget({ ...noteTarget, notes: e.target.value })}
              placeholder={t('mobile:employerFlow.notePlaceholder', 'Add hiring notes for this worker...')}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNoteTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700"
              >
                {t('mobile:common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={saveNoteMutation.isPending}
                onClick={() => saveNoteMutation.mutate({ workerId: noteTarget.workerId, notes: noteTarget.notes })}
                className="flex-1 rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white"
              >
                {t('mobile:common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Shift Sheet */}
      {bookingWorker && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:employerFlow.bookShift', 'Book Shift')} — {bookingWorker.full_name}
              </h3>
              <button type="button" onClick={() => setBookingWorker(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleBookSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:employerFlow.selectJob', 'Select Job')} *
                </label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                >
                  {activeJobs.map((j: JobListItem) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
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
    </div>
  );
};

export default MobileSavedWorkersPage;
