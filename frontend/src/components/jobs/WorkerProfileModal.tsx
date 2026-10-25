import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, MapPin, Briefcase, Star, ShieldCheck, Phone, CheckCircle,
  Calendar, Heart, Loader2, Award, Clock
} from 'lucide-react';
import type { WorkerProfile, AvailabilityStatus } from '../../types';

interface WorkerProfileModalProps {
  worker: WorkerProfile;
  isOpen: boolean;
  onClose: () => void;
  onRequestShift?: () => void;
  isSaved?: boolean;
  onToggleSaved?: () => void;
  isSavingFavorite?: boolean;
  jobId?: string;
}

export const WorkerProfileModal: React.FC<WorkerProfileModalProps> = ({
  worker,
  isOpen,
  onClose,
  onRequestShift,
  isSaved = false,
  onToggleSaved,
  isSavingFavorite = false,
  jobId,
}) => {
  const { t } = useTranslation();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const availabilityColorMap: Record<AvailabilityStatus, { text: string; bg: string; border: string }> = {
    AVAILABLE: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    BUSY: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    UNAVAILABLE: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  };

  const statusStyle = availabilityColorMap[worker.availability_status] || availabilityColorMap.AVAILABLE;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="worker-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header banner */}
        <div className="relative bg-gradient-to-r from-[#182849] to-[#2455E8] p-6 text-white flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label={t('common.close', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 overflow-hidden shadow-inner">
              {worker.profile_image_url ? (
                <img
                  src={worker.profile_image_url}
                  alt={worker.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{(worker.full_name || 'W').charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="worker-modal-title" className="text-xl sm:text-2xl font-bold truncate">
                  {worker.full_name}
                </h2>
                {worker.is_identity_verified && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full"
                    title={t('verification.verifiedBadge', 'Identity Verified')}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    {t('verification.verified', 'Verified')}
                  </span>
                )}
                {worker.is_phone_verified && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full"
                    title={t('verification.phoneVerified', 'Phone Verified')}
                  >
                    <Phone className="w-3 h-3 text-blue-300" />
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-blue-100 font-medium">
                {(worker.city || worker.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-200" />
                    {[worker.city, worker.state].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-200" />
                  {worker.years_experience} {t('worker.years', 'years experience')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable details body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-700 text-sm">
          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Rating */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {t('worker.ratingAndTrust', 'Rating & Trust')}
              </span>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span className="font-bold text-gray-900 text-base">
                  {worker.average_rating > 0 ? worker.average_rating.toFixed(1) : t('savedWorkers.newWorker', 'New')}
                </span>
                <span className="text-xs text-gray-400">
                  ({worker.total_ratings} {t('worker.reviews', 'reviews')})
                </span>
              </div>
            </div>

            {/* Availability */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {t('worker.availability', 'Availability')}
              </span>
              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                {t(`matching.availability.${worker.availability_status.toLowerCase()}`, worker.availability_status)}
              </span>
            </div>

            {/* Expected Salary */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 col-span-2 sm:col-span-1">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {t('worker.expectedSalary', 'Expected Rate')}
              </span>
              <span className="font-bold text-gray-900 text-base">
                {worker.expected_salary
                  ? `₹${worker.expected_salary.toLocaleString()} ${worker.salary_type ? `/ ${worker.salary_type.toLowerCase()}` : ''}`
                  : t('worker.negotiable', 'Negotiable')}
              </span>
            </div>
          </div>

          {/* Bio / About */}
          {worker.bio && (
            <div>
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500">
                {t('worker.about', 'About Worker')}
              </h3>
              <p className="text-gray-600 leading-relaxed bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-sm">
                {worker.bio}
              </p>
            </div>
          )}

          {/* Preferred Work Types */}
          {worker.preferred_work_types && worker.preferred_work_types.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {t('worker.workTypes', 'Preferred Work Types')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {worker.preferred_work_types.map((wt) => (
                  <span
                    key={wt}
                    className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-medium"
                  >
                    {t(`jobs.workType.${wt}`, wt)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verified Skills List */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500">
              <Award className="w-3.5 h-3.5 text-gray-400" />
              {t('skills.title', 'Skills & Qualifications')}
            </h3>

            {worker.skills && worker.skills.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {worker.skills.map((ws) => (
                  <div
                    key={ws.id}
                    className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900 block truncate text-xs sm:text-sm">
                        {t(`skills.${ws.skill.name}`, ws.skill.name)}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {ws.years_experience} {t('worker.years', 'yrs exp')}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 uppercase flex-shrink-0">
                      {ws.proficiency_level}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic text-xs">
                {t('skills.noSkillsListed', 'No skills listed yet.')}
              </p>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          {onToggleSaved && (
            <button
              type="button"
              onClick={onToggleSaved}
              disabled={isSavingFavorite}
              className={`btn py-2 px-3.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 ${
                isSaved
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSavingFavorite ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              ) : (
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              )}
              {isSaved ? t('savedWorkers.saved', 'Saved') : t('savedWorkers.saveWorker', 'Save to Favourites')}
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary py-2 px-4 text-xs font-semibold rounded-xl"
            >
              {t('common.close', 'Close')}
            </button>

            {onRequestShift && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestShift();
                }}
                className="btn btn-primary py-2 px-4 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Calendar className="w-3.5 h-3.5" />
                {t('savedWorkers.requestShift', 'Request Shift')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
