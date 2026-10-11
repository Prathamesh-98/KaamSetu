import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { 
  Heart, MapPin, Briefcase, Star, User, Clock, Shield, Search, 
  Trash2, Calendar, AlertCircle, Loader2, ArrowRight, X, Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { employerApi, jobsApi, shiftsApi } from '../../api/services';
import type { SavedWorker, JobListItem } from '../../types';

export default function SavedWorkersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Shift Request Modal state
  const [shiftModal, setShiftModal] = useState<{
    isOpen: boolean;
    worker: SavedWorker['worker'] | null;
  }>({ isOpen: false, worker: null });

  const [selectedJobId, setSelectedJobId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shiftRequesting, setShiftRequesting] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Note Edit Modal state
  const [noteModal, setNoteModal] = useState<{
    isOpen: boolean;
    workerId: string;
    workerName: string;
    note: string;
  }>({ isOpen: false, workerId: '', workerName: '', note: '' });

  // 1. Fetch saved workers
  const { data: savedWorkers, isLoading, isError, refetch } = useQuery({
    queryKey: ['employer-saved-workers'],
    queryFn: employerApi.getSavedWorkers,
  });

  // 2. Fetch employer's jobs for the shift request modal
  const { data: employerJobs } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: jobsApi.myJobs,
    enabled: shiftModal.isOpen,
  });

  // 3. Fetch availability slots for selected worker in modal
  const { data: availabilitySlots, isLoading: loadingAvailability } = useQuery({
    queryKey: ['worker-availability', shiftModal.worker?.id],
    queryFn: () => shiftsApi.getWorkerAvailability(shiftModal.worker!.id),
    enabled: shiftModal.isOpen && !!shiftModal.worker?.id,
  });

  // 4. Remove mutation
  const removeMutation = useMutation({
    mutationFn: (workerId: string) => employerApi.removeSavedWorker(workerId),
    onSuccess: (_, workerId) => {
      // Immediate cache updates
      queryClient.setQueryData(['employer-saved-workers'], (old: SavedWorker[] = []) => 
        old.filter(sw => sw.worker.id !== workerId)
      );
      queryClient.setQueryData(['saved-worker-ids'], (old: string[] = []) => 
        old.filter(id => id !== workerId)
      );
      void queryClient.invalidateQueries({ queryKey: ['employer-saved-workers'] });
      void queryClient.invalidateQueries({ queryKey: ['saved-worker-ids'] });
      toast.success(t('savedWorkers.removed', 'Worker removed from favourites'));
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || t('savedWorkers.removeError', 'Failed to remove worker');
      toast.error(msg);
    }
  });

  // 5. Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ workerId, notes }: { workerId: string; notes: string }) =>
      employerApi.saveWorker(workerId, notes),
    onSuccess: (updated) => {
      queryClient.setQueryData(['employer-saved-workers'], (old: SavedWorker[] = []) => 
        old.map(sw => sw.worker.id === updated.worker_id ? { ...sw, notes: updated.notes } : sw)
      );
      void queryClient.invalidateQueries({ queryKey: ['employer-saved-workers'] });
      toast.success(t('savedWorkers.noteSaved', 'Note saved successfully'));
      setNoteModal({ isOpen: false, workerId: '', workerName: '', note: '' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || t('savedWorkers.noteError', 'Failed to update note');
      toast.error(msg);
    }
  });

  const formatForInput = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const handleSelectSlot = (slot: any) => {
    setStartTime(formatForInput(slot.start_time));
    setEndTime(formatForInput(slot.end_time));
    setShiftError(null);
  };

  const handleRequestShift = async () => {
    if (shiftRequesting) return;
    if (!selectedJobId) {
      const msg = t('savedWorkers.selectJobRequired', 'Please select an active job for this shift booking.');
      setShiftError(msg);
      toast.error(msg);
      return;
    }
    if (!startTime || !endTime) {
      const msg = t('savedWorkers.selectTimesRequired', 'Please specify both start and end time.');
      setShiftError(msg);
      toast.error(msg);
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (startDate >= endDate) {
      const msg = t('savedWorkers.invalidTimeRange', 'Start time must precede end time.');
      setShiftError(msg);
      toast.error(msg);
      return;
    }

    setShiftRequesting(true);
    setShiftError(null);

    try {
      await shiftsApi.requestShift({
        worker_id: shiftModal.worker!.id,
        job_id: selectedJobId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });
      toast.success(t('savedWorkers.shiftSuccess', 'Shift booked and requested successfully!'));
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
      setShiftModal({ isOpen: false, worker: null });
      setSelectedJobId('');
      setStartTime('');
      setEndTime('');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : t('savedWorkers.shiftFailed', 'Error requesting shift.');
      setShiftError(msg);
      toast.error(msg);
    } finally {
      setShiftRequesting(false);
    }
  };

  // Filtered list
  const filteredWorkers = (savedWorkers || []).filter((sw) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const w = sw.worker;
    return (
      w.full_name?.toLowerCase().includes(q) ||
      w.city?.toLowerCase().includes(q) ||
      w.state?.toLowerCase().includes(q) ||
      sw.notes?.toLowerCase().includes(q) ||
      w.skills?.some((s) => s.skill?.name?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#182849]">
            {t('nav.savedWorkers', 'Saved Workers')}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            {t('savedWorkers.subtitle', 'Workers you have favorited for repeat hiring, shift booking, and quick access.')}
          </p>
        </div>
        <Link
          to="/employer/jobs"
          className="btn btn-outline bg-white border-gray-200 shadow-sm rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 self-start"
        >
          <Briefcase className="w-4 h-4 text-[#2455E8]" />
          {t('savedWorkers.browseJobs', 'My Jobs')}
        </Link>
      </div>

      {/* ── Search Bar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input w-full pl-11 pr-10 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-[#2455E8] focus:border-[#2455E8] font-medium"
            placeholder={t('savedWorkers.searchPlaceholder', 'Search saved workers by name, skill, location, or notes...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Content States ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl shadow-sm border border-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-[#2455E8] mb-3" />
          <p className="text-gray-500 font-medium">{t('common.loading', 'Loading saved workers...')}</p>
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{t('common.error', 'Error')}</h3>
            <p className="mt-1">{t('savedWorkers.loadError', 'Could not load your saved workers. Please try again.')}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 fill-red-100 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-[#182849] mb-2">
            {search ? t('savedWorkers.noMatches', 'No matching workers found') : t('savedWorkers.emptyTitle', 'No saved workers yet')}
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            {search
              ? t('savedWorkers.noMatchesDesc', 'Try adjusting your search terms or filters.')
              : t('savedWorkers.emptyDesc', 'When reviewing job applicants or smart match candidates, click the Heart icon to bookmark workers for quick shift booking and repeat hiring.')}
          </p>
          <Link
            to="/employer/jobs"
            className="btn btn-primary rounded-xl px-6 py-2.5 font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <Briefcase className="w-4 h-4" />
            {t('savedWorkers.discoverCandidates', 'Find Candidates in My Jobs')}
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredWorkers.map((item) => {
            const worker = item.worker;
            const isRemoving = removeMutation.isPending && removeMutation.variables === worker.id;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-gray-300 transition-all"
              >
                <div>
                  {/* Top card row: Avatar, Name, Unsave button */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {worker.profile_image_url ? (
                        <img
                          src={worker.profile_image_url}
                          alt={worker.full_name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-100 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[#2455E8]/10 text-[#2455E8] flex items-center justify-center font-bold text-xl">
                          {worker.full_name?.[0]?.toUpperCase() || <User className="w-8 h-8" />}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-[#182849]">{worker.full_name}</h3>
                          {worker.is_identity_verified && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5" title="Verified Worker">
                              <Shield className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
                          {(worker.city || worker.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              {[worker.city, worker.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                            {worker.years_experience} {t('worker.years', 'yrs exp')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Unfavourite button */}
                    <button
                      onClick={() => removeMutation.mutate(worker.id)}
                      disabled={isRemoving}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title={t('savedWorkers.removeFromSaved', 'Remove from Saved')}
                    >
                      {isRemoving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                      )}
                    </button>
                  </div>

                  {/* Rating & Availability */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 text-sm">
                    {worker.average_rating > 0 ? (
                      <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span>{worker.average_rating.toFixed(1)}</span>
                        <span className="text-amber-600/70 font-normal">({worker.total_ratings})</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        {t('savedWorkers.noRatings', 'New worker')}
                      </span>
                    )}

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                        worker.availability_status === 'AVAILABLE'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : worker.availability_status === 'BUSY'
                          ? 'text-amber-700 bg-amber-50 border-amber-200'
                          : 'text-red-700 bg-red-50 border-red-200'
                      }`}
                    >
                      {t(`matching.availability.${worker.availability_status.toLowerCase()}`, worker.availability_status)}
                    </span>

                    {worker.expected_salary && (
                      <span className="text-xs font-semibold text-gray-600 ml-auto">
                        ₹{worker.expected_salary.toLocaleString()}
                        {worker.salary_type && ` / ${worker.salary_type.toLowerCase()}`}
                      </span>
                    )}
                  </div>

                  {/* Skills tags */}
                  {worker.skills && worker.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {worker.skills.slice(0, 5).map((ws) => (
                        <span
                          key={ws.id}
                          className="text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 rounded-md px-2 py-0.5"
                        >
                          {t(`skills.${ws.skill.name}`, ws.skill.name)}
                        </span>
                      ))}
                      {worker.skills.length > 5 && (
                        <span className="text-xs font-semibold text-gray-400 px-1 py-0.5">
                          +{worker.skills.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Employer Private Note */}
                  <div className="mt-4 p-3 bg-gray-50/70 rounded-xl border border-dashed border-gray-200 text-xs flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        {t('savedWorkers.privateNote', 'Private Note')}
                      </span>
                      <p className="text-gray-700 font-medium">
                        {item.notes || <span className="italic text-gray-400">{t('savedWorkers.noNotesYet', 'No note added yet.')}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => setNoteModal({
                        isOpen: true,
                        workerId: worker.id,
                        workerName: worker.full_name,
                        note: item.notes || '',
                      })}
                      className="text-[#2455E8] hover:underline font-semibold flex-shrink-0"
                    >
                      {item.notes ? t('common.edit', 'Edit') : t('common.add', 'Add note')}
                    </button>
                  </div>
                </div>

                {/* Card footer buttons: Request Shift & Profile Link */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-400 font-medium">
                    {t('savedWorkers.savedOn', 'Saved on')} {new Date(item.saved_at).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => {
                      setShiftModal({ isOpen: true, worker });
                      setSelectedJobId('');
                      setStartTime('');
                      setEndTime('');
                      setShiftError(null);
                    }}
                    className="btn btn-primary rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm ml-auto"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {t('savedWorkers.requestShift', 'Request Shift')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Request Shift Modal ──────────────────────────────────── */}
      {shiftModal.isOpen && shiftModal.worker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-[#182849]">
                  {t('savedWorkers.bookShiftFor', 'Request Shift Booking')}
                </h3>
                <p className="text-sm text-gray-500 font-medium">
                  {t('savedWorkers.bookingWith', 'For')} <span className="font-bold text-[#182849]">{shiftModal.worker.full_name}</span>
                </p>
              </div>
              <button
                onClick={() => setShiftModal({ isOpen: false, worker: null })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{shiftError}</span>
              </div>
            )}

            {/* Select Job */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-[#182849] mb-1">
                {t('savedWorkers.selectJobLabel', 'Select Job *')}
              </label>
              <select
                className="input w-full rounded-xl bg-gray-50 border-gray-200 font-medium text-sm"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                <option value="">{t('savedWorkers.chooseJob', '-- Choose one of your active jobs --')}</option>
                {(employerJobs || []).map((j: JobListItem) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.city || j.work_type})
                  </option>
                ))}
              </select>
              {(!employerJobs || employerJobs.length === 0) && (
                <p className="text-xs text-amber-600 mt-1">
                  {t('savedWorkers.noJobsNotice', 'You need at least one posted job to request a shift.')}{' '}
                  <Link to="/employer/post-job" className="underline font-bold">
                    {t('savedWorkers.postJobLink', 'Post a job now')}
                  </Link>
                </p>
              )}
            </div>

            {/* Published Availability Slots recommendation */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-[#182849] mb-2 flex items-center justify-between">
                <span>{t('savedWorkers.workerAvailabilitySlots', 'Worker Availability Slots')}</span>
                {loadingAvailability && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2455E8]" />}
              </label>
              {availabilitySlots && availabilitySlots.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-100 p-2 rounded-xl bg-gray-50">
                  {availabilitySlots.map((slot: any) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      className="w-full text-left p-2 rounded-lg bg-white border border-gray-200 hover:border-[#2455E8] hover:bg-blue-50/50 text-xs flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-gray-700">
                        {new Date(slot.start_time).toLocaleString()} - {new Date(slot.end_time).toLocaleTimeString()}
                      </span>
                      <span className="text-[#2455E8] font-bold text-[11px]">{t('savedWorkers.useSlot', 'Use Slot')}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  {t('savedWorkers.noSlotsWorker', 'Worker has no specific saved calendar slots; you can propose custom times below.')}
                </p>
              )}
            </div>

            {/* Start and End Times */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-[#182849] mb-1">
                  {t('savedWorkers.startTime', 'Start Time *')}
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#182849] mb-1">
                  {t('savedWorkers.endTime', 'End Time *')}
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 text-sm font-medium"
                />
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShiftModal({ isOpen: false, worker: null })}
                className="btn btn-outline rounded-xl px-4 py-2 text-sm font-semibold"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={shiftRequesting || !selectedJobId || !startTime || !endTime}
                onClick={handleRequestShift}
                className="btn btn-primary rounded-xl px-5 py-2 text-sm font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {shiftRequesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.requesting', 'Requesting...')}
                  </>
                ) : (
                  t('savedWorkers.submitShiftRequest', 'Send Shift Request')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Note Modal ──────────────────────────────────────── */}
      {noteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#182849]">
                {t('savedWorkers.editNoteTitle', 'Private Employer Note')}
              </h3>
              <button
                onClick={() => setNoteModal({ isOpen: false, workerId: '', workerName: '', note: '' })}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              {t('savedWorkers.noteHelp', 'Keep private remarks about this worker (e.g. reliable skills, preferred days, or past performance). Only you can see this.')}
            </p>

            <textarea
              rows={4}
              value={noteModal.note}
              onChange={(e) => setNoteModal(prev => ({ ...prev, note: e.target.value }))}
              placeholder={t('savedWorkers.notePlaceholder', 'Write a note...')}
              className="input w-full rounded-xl bg-gray-50 border-gray-200 text-sm font-medium p-3 resize-none mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setNoteModal({ isOpen: false, workerId: '', workerName: '', note: '' })}
                className="btn btn-outline rounded-xl px-4 py-2 text-sm font-semibold"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={updateNoteMutation.isPending}
                onClick={() => updateNoteMutation.mutate({
                  workerId: noteModal.workerId,
                  notes: noteModal.note
                })}
                className="btn btn-primary rounded-xl px-5 py-2 text-sm font-bold shadow-sm"
              >
                {updateNoteMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save Note')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
