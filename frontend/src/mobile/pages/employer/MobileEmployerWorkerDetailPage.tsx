import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, MapPin, Star, ShieldCheck, Heart, Award,
  Calendar, User, Briefcase, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workerApi, employerApi, jobsApi, shiftsApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import type { WorkerProfile, JobListItem } from '../../../types';
import { MOBILE_QUERY_KEYS, invalidateShiftSync } from '../../sync/queryKeys';

export const MobileEmployerWorkerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(['translation', 'mobile']);
  const queryClient = useQueryClient();

  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const { data: worker, isLoading, isError } = useQuery<WorkerProfile>({
    queryKey: MOBILE_QUERY_KEYS.workerProfileDetail(id || ''),
    queryFn: () => workerApi.getById(id!),
    enabled: Boolean(id),
  });

  const { data: savedWorkerIds = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.savedWorkerIds,
    queryFn: employerApi.getSavedWorkerIds,
  });

  const { data: myJobs = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.employerJobs,
    queryFn: () => jobsApi.myJobs(),
  });

  const activeJobs = useMemo(
    () => (Array.isArray(myJobs) ? myJobs.filter((j: JobListItem) => j.status === 'ACTIVE') : []),
    [myJobs]
  );

  const isSaved = id ? savedWorkerIds.includes(id) : false;

  const toggleSaveMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      if (isSaved) await employerApi.removeSavedWorker(id);
      else await employerApi.saveWorker(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkerIds });
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkers });
      toast.success(isSaved ? t('savedWorkers.removed', 'Removed') : t('savedWorkers.saved', 'Saved!'));
    },
  });

  const handleBookShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker || !selectedJobId || isBooking) return;
    const sDt = new Date(startTime);
    const eDt = new Date(endTime);
    if (!startTime || !endTime || sDt >= eDt) {
      toast.error(t('start_time_must_be_before_end_time', 'End time must be after start time.'));
      return;
    }
    setIsBooking(true);
    try {
      await shiftsApi.requestShift({
        worker_id: worker.id,
        job_id: selectedJobId,
        start_time: sDt.toISOString(),
        end_time: eDt.toISOString(),
      });
      toast.success(t('shift_requested_successfully', 'Shift requested successfully!'));
      await invalidateShiftSync(queryClient);
      setShowBookModal(false);
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Failed to request shift');
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-12 rounded-2xl mobile-skeleton" />
        <div className="h-44 rounded-3xl mobile-skeleton" />
      </div>
    );
  }

  if (isError || !worker) {
    return (
      <div className="p-4 space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mobile-touch-target rounded-full p-2 bg-white border border-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="mobile-card p-6 text-center text-sm text-red-600">
          {t('worker.notFoundTitle', 'Worker Profile Not Found')}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mobile-touch-target rounded-full p-2 bg-white border border-slate-200 text-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-extrabold text-slate-900">
          {t('mobile:employerFlow.workerDetailTitle', 'Worker Profile')}
        </h1>
        <button
          type="button"
          onClick={() => toggleSaveMutation.mutate()}
          className="mobile-touch-target rounded-full p-2 bg-white border border-slate-200"
          aria-label="Save Worker"
        >
          <Heart className={`h-5 w-5 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}`} />
        </button>
      </div>

      {/* Hero Profile Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#172154] to-[#2E3C8A] p-5 text-white shadow-md space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center overflow-hidden flex-shrink-0">
            {worker.profile_image_url ? (
              <img src={worker.profile_image_url} alt={worker.full_name} className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-extrabold truncate">{worker.full_name}</h2>
              {worker.is_identity_verified && <ShieldCheck className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0" />}
            </div>
            <p className="text-xs text-indigo-100 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              {[worker.city, worker.state].filter(Boolean).join(', ') || 'India'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-0.5 rounded-full font-bold">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {worker.average_rating.toFixed(1)} ({worker.total_ratings})
              </span>
              <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                {worker.availability_status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Facts */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="mobile-card p-3.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            {t('worker.expectedWage', 'Expected Wage')}
          </span>
          <span className="text-base font-extrabold text-indigo-900">
            {worker.expected_salary ? `₹${worker.expected_salary}/${worker.salary_type}` : 'Negotiable'}
          </span>
        </div>
        <div className="mobile-card p-3.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            {t('worker.yearsExp', 'Experience')}
          </span>
          <span className="text-base font-extrabold text-slate-900">
            {worker.years_experience || 0} {t('worker.years', 'years')}
          </span>
        </div>
      </div>

      {worker.bio && (
        <div className="mobile-card p-4 space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">About</h3>
          <p className="text-xs text-slate-700 leading-relaxed">{worker.bio}</p>
        </div>
      )}

      {/* Preferred Work Types */}
      {worker.preferred_work_types && worker.preferred_work_types.length > 0 && (
        <div className="mobile-card p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            {t('worker.preferredWorkTypes', 'Preferred Work Types')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {worker.preferred_work_types.map((wt) => (
              <span key={wt} className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-900">
                {wt.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      <div className="mobile-card p-4 space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5" />
          {t('skills.title', 'Skills')}
        </h3>
        {worker.skills && worker.skills.length > 0 ? (
          <div className="space-y-2">
            {worker.skills.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">{ws.skill?.name}</span>
                  <span className="text-[11px] text-slate-500">{ws.years_experience} yrs</span>
                </div>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                  {ws.proficiency_level}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">{t('skills.noSkillsListed', 'No skills listed yet.')}</p>
        )}
      </div>

      {/* Book Shift Sticky CTA */}
      <button
        type="button"
        onClick={() => {
          if (activeJobs.length === 0) {
            toast.error(t('mobile:employerFlow.noJobsToMatch', 'Post an active job first.'));
            return;
          }
          setSelectedJobId(activeJobs[0].id);
          setShowBookModal(true);
        }}
        className="w-full rounded-2xl bg-indigo-900 py-3.5 text-xs font-extrabold text-white shadow-md flex items-center justify-center gap-2"
      >
        <Calendar className="h-4 w-4" />
        <span>{t('mobile:employerFlow.bookShift', 'Book Shift')}</span>
      </button>

      {showBookModal && (
        <div className="mobile-modal-overlay" role="dialog" aria-modal="true">
          <div className="mobile-modal-sheet p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {t('mobile:employerFlow.bookShift', 'Book Shift')}
              </h3>
              <button type="button" onClick={() => setShowBookModal(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleBookShift} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('mobile:employerFlow.selectJob', 'Select Job')}
                </label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
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
                  {t('mobile:availability.startTime', 'Start Date & Time')}
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
                  {t('mobile:availability.endTime', 'End Date & Time')}
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

export default MobileEmployerWorkerDetailPage;
