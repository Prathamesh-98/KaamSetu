import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Star, ShieldCheck, Heart, User, Calendar, X, Briefcase,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sparkles, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsApi, employerApi, shiftsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import type { CandidateMatch, JobListItem } from '../../../types';
import { MOBILE_QUERY_KEYS, invalidateShiftSync } from '../../sync/queryKeys';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';

export const MobileHireWorkersPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: paramJobId } = useParams<{ id?: string }>();

  const [selectedJobId, setSelectedJobId] = useState<string>(paramJobId || '');
  const [page, setPage] = useState(1);
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  // Shift booking sheet state
  const [bookingMatch, setBookingMatch] = useState<CandidateMatch | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [proposedRate, setProposedRate] = useState('');
  const [notes, setNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const poll = useAdaptivePollInterval(25000);

  useEffect(() => {
    if (paramJobId) setSelectedJobId(paramJobId);
  }, [paramJobId]);

  // Employer jobs for selector
  const { data: myJobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.employerJobs,
    queryFn: () => jobsApi.myJobs(),
  });

  const activeJobs = useMemo(
    () => (Array.isArray(myJobs) ? myJobs.filter((j: JobListItem) => j.status === 'ACTIVE') : []),
    [myJobs]
  );

  useEffect(() => {
    if (!selectedJobId && activeJobs.length > 0) {
      setSelectedJobId(activeJobs[0].id);
    }
  }, [activeJobs, selectedJobId]);

  // Ranked candidate matches via backend matching engine
  const { data: candidatesData, isLoading: isCandidatesLoading, isError, error } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.jobCandidates(selectedJobId, page),
    queryFn: () => jobsApi.getCandidates(selectedJobId, page),
    enabled: Boolean(selectedJobId),
    refetchInterval: poll,
  });

  // Saved worker IDs
  const { data: savedWorkerIds = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.savedWorkerIds,
    queryFn: employerApi.getSavedWorkerIds,
  });

  // Availability slots when booking sheet opens
  const bookingWorkerId = bookingMatch?.worker.id;
  const { data: availabilitySlots = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.workerAvailability(bookingWorkerId || ''),
    queryFn: () => shiftsApi.getWorkerAvailability(bookingWorkerId!),
    enabled: Boolean(bookingWorkerId),
  });

  const savedSet = new Set(Array.isArray(savedWorkerIds) ? savedWorkerIds : []);

  const toggleSaveMutation = useMutation({
    mutationFn: async (workerId: string) => {
      if (savedSet.has(workerId)) {
        await employerApi.removeSavedWorker(workerId);
        return false;
      } else {
        await employerApi.saveWorker(workerId);
        return true;
      }
    },
    onSuccess: (saved) => {
      toast.success(
        saved
          ? t('savedWorkers.saved', 'Worker saved to favourites')
          : t('savedWorkers.removed', 'Removed from favourites')
      );
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkerIds });
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkers });
    },
    onError: (err) => toast.error(extractErrorMessage(err) || 'Action failed'),
  });

  const formatForInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleOpenBooking = (match: CandidateMatch) => {
    setBookingMatch(match);
    setStartTime('');
    setEndTime('');
    setProposedRate(match.worker.expected_salary ? String(match.worker.expected_salary) : '');
    setNotes('');
  };

  const handleRequestShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingMatch || !selectedJobId || isBooking) return;
    if (!startTime || !endTime) {
      toast.error(t('please_select_times', 'Please specify both start and end time.'));
      return;
    }
    const startDt = new Date(startTime);
    const endDt = new Date(endTime);
    if (startDt >= endDt) {
      toast.error(t('start_time_must_be_before_end_time', 'Start time must precede end time.'));
      return;
    }
    setIsBooking(true);
    try {
      await shiftsApi.requestShift({
        worker_id: bookingMatch.worker.id,
        job_id: selectedJobId,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        proposed_rate: proposedRate ? Number(proposedRate) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(t('shift_requested_successfully', 'Shift requested successfully!'));
      await invalidateShiftSync(queryClient);
      setBookingMatch(null);
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to request shift');
    } finally {
      setIsBooking(false);
    }
  };

  const candidates = candidatesData?.items || [];
  const totalPages = candidatesData?.pages || 1;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">
            {t('mobile:employerFlow.candidatesTitle', 'Candidate Matching')}
          </h1>
          <p className="text-xs text-slate-500">
            {t('mobile:employerFlow.candidatesSubtitle', 'Ranked workers matched to your job requirements')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/employer/saved-workers')}
          className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 flex items-center gap-1"
        >
          <Heart className="h-3.5 w-3.5 fill-rose-600 text-rose-600" />
          <span>{t('employer.saved', 'Saved')}</span>
        </button>
      </div>

      {/* Active Job Selector */}
      {isJobsLoading ? (
        <div className="h-12 rounded-2xl mobile-skeleton" />
      ) : activeJobs.length > 0 ? (
        <div className="mobile-card p-3 space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t('mobile:employerFlow.selectJob', 'Select Active Job')}
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-indigo-900 focus:outline-none"
          >
            {activeJobs.map((j: JobListItem) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.city || 'India'})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mobile-card p-6 text-center space-y-3">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-600">
            {t('mobile:employerFlow.noJobsToMatch', 'Post an active job to unlock smart candidate matching.')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/employer/post-job')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2.5 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            <span>{t('employer.postNew', 'Post a New Job')}</span>
          </button>
        </div>
      )}

      {/* Candidates List */}
      {selectedJobId && (
        isCandidatesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-40 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : isError ? (
          <div className="mobile-card p-6 text-center text-xs text-red-600 border border-red-200">
            {extractErrorMessage(error) || t('error_loading_candidates', 'Could not load matched candidates.')}
          </div>
        ) : candidates.length > 0 ? (
          <div className="space-y-3">
            {candidates.map((match) => {
              const w = match.worker;
              const isSaved = savedSet.has(w.id);
              const isExpanded = expandedWorkerId === w.id;
              const score = Math.round(match.match_score || 0);
              const scoreStyle =
                score >= 80
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : score >= 50
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <div key={w.id} className="mobile-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => navigate(`/employer/workers/${w.id}`)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {w.profile_image_url ? (
                          <img src={w.profile_image_url} alt={w.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-indigo-700" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-slate-900 truncate">{w.full_name}</h3>
                          {w.is_identity_verified && <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="h-3 w-3 text-amber-600 flex-shrink-0" />
                          <span>{[w.city, w.state].filter(Boolean).join(', ') || 'India'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold border ${scoreStyle}`}>
                        {t('mobile:employerFlow.matchScore', { score, defaultValue: `${score}% Match` })}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSaveMutation.mutate(w.id)}
                        className="mobile-touch-target rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                        aria-label="Save worker"
                      >
                        <Heart className={`h-4.5 w-4.5 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {(w.average_rating || 0).toFixed(1)} ({w.total_ratings || 0})
                    </span>
                    <span>· {w.years_experience || 0} yrs exp</span>
                    {w.expected_salary && (
                      <span className="font-bold text-indigo-900">
                        · ₹{w.expected_salary}/{w.salary_type || 'DAY'}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {w.availability_status}
                    </span>
                  </div>

                  {/* Skills chips */}
                  {w.skills && w.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {w.skills.slice(0, 4).map((ws: any) => (
                        <span
                          key={ws.id}
                          className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                        >
                          {ws.skill?.name || 'Skill'}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Match Breakdown Toggle */}
                  {match.match_explanations && match.match_explanations.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedWorkerId(isExpanded ? null : w.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{t('mobile:employerFlow.whyMatch', 'Match Breakdown')}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 rounded-xl bg-indigo-50/70 p-2.5 space-y-1 text-[11px] text-slate-700 border border-indigo-100">
                          {match.match_explanations.map((ex, idx) => (
                            <div key={idx}>• {String(t(ex.key, ex.args || {}))}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/employer/workers/${w.id}`)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 active:scale-95"
                    >
                      {t('mobile:employerFlow.workerDetailTitle', 'Worker Profile')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBooking(match)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-900 py-2.5 text-xs font-bold text-white shadow-sm active:scale-95"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>{t('mobile:employerFlow.bookShift', 'Book Shift')}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
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
          <div className="mobile-card p-8 text-center text-xs text-slate-500">
            {t('no_candidates_desc', 'No active workers matched your criteria yet.')}
          </div>
        )
      )}

      {/* Request Shift Bottom Sheet */}
      {bookingMatch && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:employerFlow.bookShift', 'Book Shift')} — {bookingMatch.worker.full_name}
              </h3>
              <button
                type="button"
                onClick={() => setBookingMatch(null)}
                className="mobile-touch-target rounded-full text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Availability slots hint */}
            <div>
              <span className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                {t('mobile:employerFlow.availableSlotsTitle', 'Worker Availability Slots')}
              </span>
              {Array.isArray(availabilitySlots) && availabilitySlots.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {availabilitySlots.map((slot: any) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setStartTime(formatForInput(slot.start_time));
                        setEndTime(formatForInput(slot.end_time));
                      }}
                      className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-800"
                    >
                      {new Date(slot.start_time).toLocaleDateString()} ·{' '}
                      {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {t('mobile:employerFlow.noSlotsHint', 'No pre-listed slots; you can propose a custom time.')}
                </p>
              )}
            </div>

            <form onSubmit={handleRequestShift} className="space-y-3 text-xs">
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:shifts.agreedRate', 'Proposed Rate (₹)')}
                </label>
                <input
                  type="number"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  placeholder="800"
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('shifts.notes', 'Shift Notes (Optional)')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Site address or reporting details..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBookingMatch(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-700"
                >
                  {t('mobile:common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isBooking}
                  className="flex-1 rounded-xl bg-indigo-900 py-3 font-bold text-white disabled:opacity-50"
                >
                  {isBooking ? t('mobile:common.saving', 'Sending...') : t('mobile:employerFlow.bookShift', 'Request Shift')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileHireWorkersPage;
