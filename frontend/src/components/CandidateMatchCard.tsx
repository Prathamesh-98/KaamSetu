import React, { useState } from 'react';
import type { CandidateMatch } from '../types';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, MapPin, Briefcase, Star, User, Clock, AlertCircle, Heart, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { shiftsApi, employerApi } from '../api/services';
import { WorkerProfileModal } from './jobs/WorkerProfileModal';

interface Props {
  match: CandidateMatch;
  jobId?: string;
}

export function CandidateMatchCard({ match, jobId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { worker, match_score, match_explanations, application_status } = match;

  const { data: savedWorkerIds = [] } = useQuery({
    queryKey: ['saved-worker-ids'],
    queryFn: employerApi.getSavedWorkerIds,
    staleTime: 30_000,
  });
  const isSaved = savedWorkerIds.includes(worker.id);
  const [togglingFavorite, setTogglingFavorite] = useState(false);

  const handleToggleFavorite = async () => {
    if (togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      if (isSaved) {
        await employerApi.removeSavedWorker(worker.id);
        queryClient.setQueryData(['saved-worker-ids'], (old: string[] = []) => old.filter(id => id !== worker.id));
        queryClient.setQueryData(['employer-saved-workers'], (old: any[] = []) => old.filter(sw => sw.worker.id !== worker.id));
        toast.success(t('savedWorkers.removed', 'Worker removed from favourites'));
      } else {
        await employerApi.saveWorker(worker.id);
        queryClient.setQueryData(['saved-worker-ids'], (old: string[] = []) => [...old, worker.id]);
        toast.success(t('savedWorkers.saved', 'Worker saved to favourites'));
      }
      void queryClient.invalidateQueries({ queryKey: ['saved-worker-ids'] });
      void queryClient.invalidateQueries({ queryKey: ['employer-saved-workers'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || t('common.error', 'Action failed'));
    } finally {
      setTogglingFavorite(false);
    }
  };

  const { data: availabilitySlots, isLoading: loadingAvailability } = useQuery({
    queryKey: ['worker-availability', worker.id],
    queryFn: () => shiftsApi.getWorkerAvailability(worker.id),
    enabled: showModal && !!worker.id,
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
    setErrorMessage(null);
  };

  const handleRequestShift = async () => {
    if (requesting) return;
    if (!jobId) {
      toast.error(t('missing_job_id', 'Job ID is missing.'));
      return;
    }
    if (!startTime || !endTime) {
      const msg = t('please_select_times', 'Please specify both start and end time.');
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (startDate >= endDate) {
      const msg = t('start_time_must_be_before_end_time', 'Start time must precede end time.');
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setRequesting(true);
    setErrorMessage(null);

    try {
      await shiftsApi.requestShift({
        worker_id: worker.id,
        job_id: jobId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString()
      });
      toast.success(t('shift_requested_successfully', 'Shift requested successfully!'));
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['job-candidates'] });
      setShowModal(false);
      setStartTime('');
      setEndTime('');
      setErrorMessage(null);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : t('error_requesting_shift', 'Error requesting shift.');
      console.error('Failed to request shift:', e);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setRequesting(false);
    }
  };

  const scoreColor = match_score >= 80 ? 'text-emerald-600 bg-emerald-50' : 
                     match_score >= 50 ? 'text-amber-600 bg-amber-50' : 
                     'text-red-600 bg-red-50';

  return (
    <div className="card overflow-hidden">
      <div className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex items-center gap-4 flex-1">
          {worker.profile_image_url ? (
            <img src={worker.profile_image_url} alt={worker.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-gray-100" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-gray-900">{worker.full_name}</h3>
            <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500">
              {worker.city && worker.state && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {worker.city}, {worker.state}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {worker.years_experience} {t('experience', 'Years Exp.')}
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                {worker.average_rating.toFixed(1)} ({worker.total_ratings} {t('ratings', 'ratings')})
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={`px-4 py-2 rounded-lg font-bold text-lg flex items-center gap-2 ${scoreColor}`} title={t('match_score', 'Match Score')}>
            {match_score}% {t('match', 'Match')}
          </div>
          {application_status && (
            <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
              {t('application_status', 'Status')}: {application_status}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={togglingFavorite}
            className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
              isSaved
                ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                : 'bg-white text-gray-400 border-gray-200 hover:text-red-500 hover:border-red-200'
            }`}
            title={isSaved ? t('savedWorkers.removeFromSaved', 'Remove from Saved') : t('savedWorkers.saveWorker', 'Save to Favourites')}
          >
            {togglingFavorite ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
            ) : (
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="btn-secondary py-1.5 px-3 text-sm"
          >
            {t('view_profile', 'View Profile')}
          </button>
          {jobId && (
            <button 
              onClick={() => setShowModal(true)}
              className="btn-primary py-1.5 px-3 text-sm"
            >
              {t('request_shift', 'Request Shift')}
            </button>
          )}
        </div>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {expanded ? (
            <><ChevronUp className="w-4 h-4" /> {t('hide_match_details', 'Hide Details')}</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> {t('show_match_details', 'Why this score?')}</>
          )}
        </button>
      </div>

      {expanded && (
        <div className="p-5 border-t border-gray-100 bg-white">
          <h4 className="font-semibold text-gray-900 mb-3">{t('match_explanation', 'Match Explanation')}</h4>
          <ul className="space-y-2">
            {match_explanations.map((exp, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                <span>{t(exp.key, (exp.args as any) || {}) as string}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Worker Profile Detail Modal / Drawer */}
      <WorkerProfileModal
        worker={worker}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onRequestShift={jobId ? () => setShowModal(true) : undefined}
        isSaved={isSaved}
        onToggleSaved={handleToggleFavorite}
        isSavingFavorite={togglingFavorite}
        jobId={jobId}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">{t('request_shift', 'Request Shift')}</h3>

            {errorMessage && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {availabilitySlots && availabilitySlots.length > 0 && (
              <div className="mb-4 bg-blue-50/60 border border-blue-100 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 mb-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('worker_available_slots', "Worker's Available Slots (Click to select):")}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {availabilitySlots.map((slot: any) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      className="text-xs bg-white border border-blue-200 hover:border-blue-500 hover:bg-blue-50 text-blue-700 px-2 py-1 rounded transition-colors text-left"
                    >
                      {new Date(slot.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}: {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('start_time', 'Start Time')}</label>
                <input type="datetime-local" className="w-full border rounded p-2" value={startTime} onChange={(e) => { setStartTime(e.target.value); setErrorMessage(null); }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('end_time', 'End Time')}</label>
                <input type="datetime-local" className="w-full border rounded p-2" value={endTime} onChange={(e) => { setEndTime(e.target.value); setErrorMessage(null); }} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => { setShowModal(false); setErrorMessage(null); }}
                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button 
                onClick={handleRequestShift}
                disabled={requesting || !startTime || !endTime}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {requesting ? t('requesting', 'Requesting...') : t('send_request', 'Send Request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
