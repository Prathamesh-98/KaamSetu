import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MapPin, Briefcase, Clock, Zap, Users, Calendar, Star,
  CheckCircle2, AlertCircle, Send, Bookmark, Trash2, Building2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jobsApi, applicationsApi, workerApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import MobilePageHeader from '../../components/ui/MobilePageHeader';
import MobileStatusBadge from '../../components/ui/MobileStatusBadge';
import { MOBILE_QUERY_KEYS, invalidateApplicationSync } from '../../sync/queryKeys';
import { useBackButton } from '../../hooks/useBackButton';

export const MobileJobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['translation', 'mobile']);
  const queryClient = useQueryClient();

  useBackButton();

  const [coverNote, setCoverNote] = useState('');
  const [applyError, setApplyError] = useState('');

  const { data: job, isLoading, isError } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.jobDetail(id || ''),
    queryFn: () => jobsApi.get(id!),
    enabled: !!id,
    staleTime: 10000,
    refetchOnMount: 'always',
  });

  const { data: applications = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.workerApplications,
    queryFn: applicationsApi.list,
    staleTime: 8000,
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.savedJobs,
    queryFn: workerApi.getSavedJobs,
  });

  const { data: matchData } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.jobMatch(id || ''),
    queryFn: () => jobsApi.getMatch(id!),
    enabled: !!id,
    retry: false,
  });

  const existingApp = applications.find((a) => a.job.id === id);
  const isSaved = savedJobs.some((sj) => sj.job.id === id);

  const applyMutation = useMutation({
    mutationFn: () => applicationsApi.apply(id!, coverNote.trim() || undefined),
    onSuccess: () => {
      setApplyError('');
      setCoverNote('');
      toast.success(t('jobs.appSubmitted', 'Application Submitted!'));
      invalidateApplicationSync(queryClient, id);
    },
    onError: (err) => {
      const msg = extractErrorMessage(err);
      setApplyError(msg);
      toast.error(msg);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (appId: string) => applicationsApi.withdraw(appId),
    onSuccess: () => {
      toast.success(t('applications.withdrawnSuccess', 'Application withdrawn'));
      invalidateApplicationSync(queryClient, id);
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const saveMutation = useMutation({
    mutationFn: () => (isSaved ? workerApi.unsaveJob(id!) : workerApi.saveJob(id!)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedJobs }),
  });

  if (isLoading) {
    return (
      <div className="mobile-fullscreen-editor">
        <MobilePageHeader title={t('jobs.viewDetails', 'Job Details')} />
        <div className="p-4 space-y-3">
          <div className="h-32 rounded-2xl mobile-skeleton" />
          <div className="h-44 rounded-2xl mobile-skeleton" />
        </div>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="mobile-fullscreen-editor">
        <MobilePageHeader title={t('jobs.viewDetails', 'Job Details')} />
        <div className="p-6 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="font-bold text-slate-900">{t('mobile:jobs.jobNotFound', 'Job not found')}</h2>
          <button
            type="button"
            onClick={() => navigate('/worker/jobs')}
            className="rounded-xl bg-indigo-900 px-4 py-2.5 text-xs font-bold text-white"
          >
            {t('jobs.browseOther', 'Browse Jobs')}
          </button>
        </div>
      </div>
    );
  }

  const salaryText =
    job.salary_min && job.salary_max
      ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
      : job.salary_min
      ? `₹${job.salary_min.toLocaleString()}+`
      : t('jobs.salaryNegotiable', 'Salary Negotiable');

  const salaryPeriod = t(`enums.salaryType.${job.salary_type}`, {
    defaultValue: `/${job.salary_type.toLowerCase()}`,
  });

  return (
    <div className="mobile-fullscreen-editor">
      <MobilePageHeader
        title={job.title}
        subtitle={job.employer.organization_name || job.employer.full_name}
        rightSlot={
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
            aria-label={isSaved ? t('mobile:jobs.saved', 'Saved') : t('mobile:jobs.saveJob', 'Save Job')}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-indigo-900 text-indigo-900' : ''}`} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {job.image_url && (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
            <img src={job.image_url} alt={job.title} className="w-full max-h-52 object-cover" />
          </div>
        )}

        {/* Hero Summary */}
        <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {job.is_urgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                <Zap className="h-3 w-3" /> {t('jobs.urgent', 'Urgent')}
              </span>
            )}
            <MobileStatusBadge status={job.work_type} variant="workType" />
            <MobileStatusBadge status={job.status} variant="job" />
          </div>

          <div>
            <h1 className="text-lg font-extrabold text-slate-900 leading-snug">{job.title}</h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-900" />
              <span>{job.employer.organization_name || job.employer.full_name}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 bg-slate-50 rounded-xl p-3">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">
                {t('jobs.compensation', 'Compensation')}
              </div>
              <div className="text-sm font-extrabold text-indigo-900 mt-0.5">
                {salaryText} {job.salary_min && <span className="text-xs font-normal">{salaryPeriod}</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">{t('jobs.location', 'Location')}</div>
              <div className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                <span className="truncate">
                  {job.city}, {job.state}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div>
              <div className="text-[10px] text-slate-400 font-semibold">{t('mobile:jobs.experienceReq', 'Experience')}</div>
              <div className="text-xs font-bold text-slate-800 mt-0.5">
                {t('mobile:jobs.yearsPlus', { years: job.experience_required, defaultValue: `${job.experience_required}+ yrs` })}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-semibold">{t('mobile:jobs.openings', 'Openings')}</div>
              <div className="text-xs font-bold text-slate-800 mt-0.5">{job.workers_needed}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-semibold">{t('mobile:jobs.applicantsCount', 'Applicants')}</div>
              <div className="text-xs font-bold text-slate-800 mt-0.5">{job.applications_count}</div>
            </div>
          </div>

          {job.duration_days && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {t('mobile:jobs.duration', 'Duration')}:{' '}
                {t('mobile:jobs.daysCount', { days: job.duration_days, defaultValue: `${job.duration_days} days` })}
              </span>
            </div>
          )}
        </div>

        {/* Authoritative Smart Match Card */}
        {matchData && (
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/40 p-4 border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                  {t('mobile:jobs.smartMatch', 'Smart Match')}
                </h2>
              </div>
              <span className="text-xl font-black text-indigo-900">{matchData.score}%</span>
            </div>

            <div className="space-y-2">
              {[
                { label: t('mobile:jobs.factorSkills', 'Skills'), value: matchData.factors.skills },
                { label: t('mobile:jobs.factorLocation', 'Location'), value: matchData.factors.location },
                { label: t('mobile:jobs.factorExperience', 'Experience'), value: matchData.factors.experience },
                { label: t('mobile:jobs.factorSalary', 'Salary'), value: matchData.factors.salary },
                { label: t('mobile:jobs.factorWorkType', 'Work Type'), value: matchData.factors.work_type },
              ].map((factor) => (
                <div key={factor.label} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-600">{factor.label}</span>
                    <span className="font-bold text-slate-900">{factor.value}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-900" style={{ width: `${factor.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {matchData.explanations && matchData.explanations.length > 0 && (
              <div className="pt-2 border-t border-indigo-100 space-y-1">
                {matchData.explanations.map((exp, idx) => (
                  <p key={idx} className="text-[11px] text-indigo-900">
                    • {String(t(exp.key, exp.args || {}))}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Description & Requirements */}
        <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-xs space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {t('jobs.jobDescription', 'Job Description')}
            </h2>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{job.description}</p>
          </div>

          {job.additional_requirements && (
            <div className="pt-3 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {t('mobile:jobs.additionalReqs', 'Additional Requirements')}
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{job.additional_requirements}</p>
            </div>
          )}

          {job.required_skills && job.required_skills.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {t('jobs.requiredSkills', 'Required Skills')}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((js) => (
                  <span
                    key={js.skill.id}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${
                      js.is_mandatory
                        ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {js.is_mandatory && <CheckCircle2 className="h-3 w-3 text-indigo-700" />}
                    <span>{t(`skills.${js.skill.name}`, { defaultValue: js.skill.name })}</span>
                    {js.is_mandatory && (
                      <span className="text-[10px] opacity-75">({t('mobile:jobs.mandatory', 'Required')})</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Employer Rating Summary */}
        <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">{t('mobile:jobs.aboutEmployer', 'About Employer')}</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {job.employer.organization_name || job.employer.full_name}
            </div>
            {job.employer.organization_name && (
              <div className="text-xs text-slate-500">{job.employer.full_name}</div>
            )}
          </div>
          {job.employer.average_rating > 0 && (
            <div className="flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              <span className="text-xs font-extrabold text-amber-900">{job.employer.average_rating.toFixed(1)}</span>
              <span className="text-[11px] text-amber-700">({job.employer.total_ratings})</span>
            </div>
          )}
        </div>

        {/* Application Cover Note (when eligible) */}
        {!existingApp && job.status === 'ACTIVE' && (
          <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-xs space-y-2">
            {applyError && (
              <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{applyError}</span>
              </div>
            )}
            <label className="block text-xs font-bold text-slate-700">
              {t('jobs.coverNoteOptional', 'Cover Note (Optional)')}
            </label>
            <textarea
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder={t('jobs.coverNotePlaceholder', 'Add a brief note about your experience...')}
              rows={2}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-900 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Sticky Bottom Apply / Status Bar */}
      <div className="mobile-sticky-footer">
        {existingApp ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {t('mobile:jobs.alreadyApplied', {
                    status: t(`statuses.${existingApp.status}`, { defaultValue: existingApp.status }),
                    defaultValue: `Status: ${existingApp.status}`,
                  })}
                </div>
              </div>
            </div>
            {existingApp.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('mobile:jobs.withdrawConfirm', 'Withdraw this pending application?'))) {
                    withdrawMutation.mutate(existingApp.id);
                  }
                }}
                disabled={withdrawMutation.isPending}
                className="mobile-touch-target inline-flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-700 min-h-[44px]"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('mobile:jobs.withdraw', 'Withdraw')}</span>
              </button>
            )}
          </div>
        ) : job.status !== 'ACTIVE' ? (
          <div className="rounded-xl bg-slate-100 py-3 text-center text-xs font-bold text-slate-600">
            {t('mobile:jobs.jobInactive', 'This job is not accepting new applications.')}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="mobile-touch-target w-full rounded-xl bg-indigo-900 py-3.5 text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px] active:scale-98"
          >
            <Send className="h-4 w-4" />
            <span>
              {applyMutation.isPending
                ? t('mobile:jobs.applying', 'Submitting...')
                : t('mobile:jobs.applyNow', 'Apply Now')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MobileJobDetailsPage;
