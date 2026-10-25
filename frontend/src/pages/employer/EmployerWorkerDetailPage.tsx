import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, MapPin, Briefcase, Star, ShieldCheck, Phone,
  Clock, Award, Loader2, AlertCircle, Heart
} from 'lucide-react';
import { workerApi, employerApi } from '../../api/services';
import type { WorkerProfile, AvailabilityStatus } from '../../types';
import { toast } from 'react-hot-toast';

export default function EmployerWorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: worker, isLoading, isError, error } = useQuery<WorkerProfile>({
    queryKey: ['worker-profile-detail', id],
    queryFn: () => workerApi.getById(id!),
    enabled: !!id,
  });

  const { data: savedWorkerIds = [] } = useQuery({
    queryKey: ['saved-worker-ids'],
    queryFn: employerApi.getSavedWorkerIds,
    staleTime: 30_000,
  });

  const isSaved = id ? savedWorkerIds.includes(id) : false;

  const availabilityColorMap: Record<AvailabilityStatus, { text: string; bg: string; border: string }> = {
    AVAILABLE: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    BUSY: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    UNAVAILABLE: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (isError || !worker) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-2 mb-6"
        >
          <ArrowLeft size={20} />
          <span>{t('common.back', 'Back')}</span>
        </button>

        <div className="card p-8 bg-red-50 border-red-200 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-800 mb-2">
            {t('worker.notFoundTitle', 'Worker Profile Not Found')}
          </h2>
          <p className="text-sm text-red-600 mb-6">
            {(error as any)?.response?.data?.detail || t('worker.notFoundDesc', 'The requested worker profile could not be loaded.')}
          </p>
          <Link to="/employer/jobs" className="btn btn-primary">
            {t('back_to_jobs', 'Back to Jobs')}
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = availabilityColorMap[worker.availability_status as AvailabilityStatus] || availabilityColorMap.AVAILABLE;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Back navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-2 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={18} />
          <span>{t('common.back', 'Back')}</span>
        </button>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Banner header */}
        <div className="bg-gradient-to-r from-[#182849] to-[#2455E8] p-8 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0 overflow-hidden shadow-inner">
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold">{worker.full_name}</h1>
                {worker.is_identity_verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    {t('verification.verified', 'Verified Worker')}
                  </span>
                )}
                {worker.is_phone_verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
                    <Phone className="w-3 h-3 text-blue-300" />
                    {t('verification.phoneVerified', 'Phone Verified')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2.5 text-sm text-blue-100 font-medium">
                {(worker.city || worker.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-blue-200" />
                    {[worker.city, worker.state].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4 text-blue-200" />
                  {worker.years_experience} {t('worker.years', 'years experience')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content details */}
        <div className="p-8 space-y-8">
          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {t('worker.ratingAndTrust', 'Rating')}
              </span>
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                <span className="font-bold text-gray-900 text-lg">
                  {worker.average_rating > 0 ? worker.average_rating.toFixed(1) : t('savedWorkers.newWorker', 'New')}
                </span>
                <span className="text-xs text-gray-400">
                  ({worker.total_ratings})
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {t('worker.availability', 'Availability')}
              </span>
              <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-md border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                {t(`matching.availability.${worker.availability_status.toLowerCase()}`, worker.availability_status)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 col-span-2 sm:col-span-1">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {t('worker.expectedSalary', 'Expected Rate')}
              </span>
              <span className="font-bold text-gray-900 text-lg">
                {worker.expected_salary
                  ? `₹${worker.expected_salary.toLocaleString()} ${worker.salary_type ? `/ ${worker.salary_type.toLowerCase()}` : ''}`
                  : t('worker.negotiable', 'Negotiable')}
              </span>
            </div>
          </div>

          {/* Bio */}
          {worker.bio && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">
                {t('worker.about', 'About Worker')}
              </h2>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
                {worker.bio}
              </p>
            </div>
          )}

          {/* Preferred Work Types */}
          {worker.preferred_work_types && worker.preferred_work_types.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                {t('worker.workTypes', 'Preferred Work Types')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {worker.preferred_work_types.map((wt: string) => (
                  <span
                    key={wt}
                    className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-semibold"
                  >
                    {String(t(`jobs.workType.${wt}`, wt))}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skills Breakdown */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-gray-400" />
              {t('skills.title', 'Skills & Experience')}
            </h2>

            {worker.skills && worker.skills.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {worker.skills.map((ws) => (
                  <div
                    key={ws.id}
                    className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <span className="font-semibold text-gray-900 block text-sm">
                        {String(t(`skills.${ws.skill.name}`, ws.skill.name))}
                      </span>
                      <span className="text-xs text-gray-500">
                        {ws.years_experience} {t('worker.years', 'years experience')}
                      </span>
                    </div>

                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                      {ws.proficiency_level}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm">
                {t('skills.noSkillsListed', 'No skills listed yet.')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
