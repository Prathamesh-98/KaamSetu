import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, Briefcase, Clock, Zap, Users, Calendar,
  Star, CheckCircle, AlertCircle, Send, Bookmark
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { jobsApi, applicationsApi, workerApi } from '../../api/services'
import type { WorkType, SalaryType } from '../../types'

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  FULL_TIME: 'Full Time', PART_TIME: 'Part Time', DAILY: 'Daily',
  HOURLY: 'Hourly', PROJECT: 'Project', TEMPORARY: 'Temporary',
  REMOTE: 'Remote', LOCAL: 'Local',
}

const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  HOURLY: '/hr', DAILY: '/day', MONTHLY: '/month', PROJECT: '/project', FIXED: ' fixed',
}

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [coverNote, setCoverNote] = useState('')
  const [applied, setApplied] = useState(false)

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id!),
    enabled: !!id,
  })

  const { data: applications, isLoading: isAppsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationsApi.list,
  })

  const { data: savedJobs, isLoading: isSavedLoading } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: workerApi.getSavedJobs,
  })

  const { data: matchData, isLoading: isMatchLoading } = useQuery({
    queryKey: ['job-match', id],
    queryFn: () => jobsApi.getMatch(id!),
    enabled: !!id,
    retry: false,
  })

  const existingApplication = applications?.find(a => a.job.id === id)
  const isSaved = savedJobs?.some(sj => sj.job.id === id) || false

  const applyMutation = useMutation({
    mutationFn: () => applicationsApi.apply(id!, coverNote || undefined),
    onSuccess: () => {
      setApplied(true)
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: (appId: string) => applicationsApi.withdraw(appId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['applications'] }),
  })

  const saveMutation = useMutation({
    mutationFn: () => workerApi.saveJob(id!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  })

  const unsaveMutation = useMutation({
    mutationFn: () => workerApi.unsaveJob(id!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  })

  if (isLoading || isAppsLoading || isSavedLoading) {
    return (
      <div className="container-page py-8 animate-pulse bg-[#F5F7FB] min-h-screen">
        <div className="h-4 bg-gray-200 rounded w-24 mb-6" />
        <div className="card p-8 space-y-4">
          <div className="h-7 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">
        <div className="card p-10 text-center rounded-xl shadow-sm bg-white border border-gray-100">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="font-bold text-dark mb-2">{t('jobs.notFoundTitle', 'Job not found')}</h3>
          <p className="text-sm text-gray-500 mb-6">{t('jobs.notFoundDesc', 'This job may have been removed or is no longer available.')}</p>
          <Link to="/worker/jobs" className="btn btn-primary">{t('jobs.browseOther', 'Browse Other Jobs')}</Link>
        </div>
      </div>
    )
  }

  const salaryText = job.salary_min && job.salary_max
    ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}${t(`enums.salaryType.${job.salary_type}`, { defaultValue: SALARY_TYPE_LABELS[job.salary_type] })}`
    : job.salary_min
    ? `From ₹${job.salary_min.toLocaleString()}${t(`enums.salaryType.${job.salary_type}`, { defaultValue: SALARY_TYPE_LABELS[job.salary_type] })}`
    : t('jobs.salaryNegotiable', 'Salary Negotiable')

  return (
    <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">

      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-dark mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('jobs.backToJobs', 'Back to Jobs')}
      </button>

      {/* Hero Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {job.is_urgent && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-3 py-1">
                  <Zap className="w-3.5 h-3.5" /> {t('jobs.urgent', 'Urgent')}
                </span>
              )}
              <span className="badge badge-outline text-xs px-3 py-1 bg-gray-50">{t(`enums.workType.${job.work_type}`, { defaultValue: WORK_TYPE_LABELS[job.work_type] })}</span>
              <span className="badge badge-outline text-xs px-3 py-1 bg-gray-50">{t(`enums.status.${job.status}`, { defaultValue: job.status })}</span>
            </div>
            <h1 className="text-3xl font-bold text-dark mb-2">{job.title}</h1>
            <p className="text-gray-500 text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              {job.employer.organization_name || job.employer.full_name}
            </p>
            <div className="flex flex-wrap gap-4 mt-6 text-sm text-gray-600">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary-500" />{job.city}, {job.state}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary-500" />{t('jobs.posted', 'Posted')} {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 md:min-w-[200px]">
            {existingApplication || applied ? (
              <div className="text-center py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  {existingApplication ? t('applications.statusPrefix', 'Status:') + ' ' + existingApplication.status : t('applications.applied', 'Applied!')}
                </div>
              </div>
            ) : (
              <button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending || job.status !== 'ACTIVE'}
                className="btn btn-primary w-full py-3 text-base shadow-sm"
              >
                {applyMutation.isPending ? t('jobs.applying', 'Applying...') : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" /> {t('jobs.applyNow', 'Apply Now')}
                  </span>
                )}
              </button>
            )}
            
            <button
              onClick={() => isSaved ? unsaveMutation.mutate() : saveMutation.mutate()}
              disabled={saveMutation.isPending || unsaveMutation.isPending}
              className={`btn w-full transition-colors py-2 ${isSaved ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'btn-outline bg-white'}`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-primary-600 text-primary-600' : ''}`} /> 
              {saveMutation.isPending || unsaveMutation.isPending ? t('jobs.updating', 'Updating...') : (isSaved ? t('jobs.saved', 'Saved') : t('jobs.saveJob', 'Save Job'))}
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column (Description/Requirements) */}
        <div className="lg:col-span-2 space-y-6">
          {job.image_url && (
            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
              <img src={job.image_url} alt={job.title} className="w-full h-auto max-h-80 object-cover" />
            </div>
          )}

          <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-dark mb-4">{t('jobs.jobDescription', 'Job Description')}</h2>
            <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-line">
              {job.description}
            </div>
          </div>

          {job.additional_requirements && (
            <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-dark mb-4">{t('jobs.additionalReqs', 'Additional Requirements')}</h2>
              <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-line">
                {job.additional_requirements}
              </div>
            </div>
          )}

          {job.required_skills.length > 0 && (
            <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-dark mb-4">{t('jobs.requiredSkills', 'Required Skills')}</h2>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((js) => (
                  <span
                    key={js.skill.id}
                    className={`inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-full border ${
                      js.is_mandatory
                        ? 'bg-primary-50 text-primary-700 border-primary-200'
                        : 'bg-surface text-gray-600 border-gray-200'
                    }`}
                  >
                    {js.is_mandatory && <CheckCircle className="w-3.5 h-3.5" />}
                    {t(`skills.${js.skill.name}`, { defaultValue: js.skill.name })}
                    {js.is_mandatory && <span className="text-xs opacity-70 ml-1">({t('jobs.required', 'Required')})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Company Summary/Salary/Actions) */}
        <div className="space-y-6">
          <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-dark mb-4 text-lg">{t('jobs.compensation', 'Compensation')}</h3>
            <div className="text-3xl font-black text-primary-600 mb-2">{salaryText}</div>
            <p className="text-sm text-gray-500">{t('jobs.salaryTypeDesc', 'Base pay depending on experience and performance.')}</p>
          </div>

          <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-dark mb-4 text-lg">{t('jobs.jobOverview', 'Job Overview')}</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-2"><Briefcase className="w-4 h-4"/> {t('jobs.experience', 'Experience')}</span>
                <span className="font-medium text-dark">{job.experience_required}+ {t('jobs.years', 'years')}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-2"><Users className="w-4 h-4"/> {t('jobs.openings', 'Openings')}</span>
                <span className="font-medium text-dark">{job.workers_needed}</span>
              </div>
              {job.duration_days && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                  <span className="text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4"/> {t('jobs.duration', 'Duration')}</span>
                  <span className="font-medium text-dark">{job.duration_days} {t('jobs.days', 'days')}</span>
                </div>
              )}
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-2"><Users className="w-4 h-4"/> {t('jobs.applicants', 'Applicants')}</span>
                <span className="font-medium text-dark">{job.applications_count}</span>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-dark mb-4 text-lg">{t('jobs.aboutEmployer', 'About Employer')}</h3>
            <div className="mb-3">
              <h4 className="font-semibold text-dark">{job.employer.organization_name || job.employer.full_name}</h4>
              {job.employer.organization_name && <p className="text-sm text-gray-500">{job.employer.full_name}</p>}
            </div>
            {job.employer.average_rating > 0 && (
              <div className="flex items-center gap-1.5 text-amber-500 mb-4 bg-amber-50 inline-flex px-2.5 py-1 rounded-lg">
                <Star className="w-4 h-4 fill-amber-400" />
                <span className="text-sm font-semibold">{job.employer.average_rating.toFixed(1)}</span>
                <span className="text-xs text-gray-600">({job.employer.total_ratings} {t('jobs.reviews', 'reviews')})</span>
              </div>
            )}
          </div>

          {matchData && (
            <div className="card p-6 border border-primary-100 bg-gradient-to-br from-white to-primary-50 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-dark flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  {t('jobs.smartMatch', 'Smart Match')}
                </h3>
                <span className="text-2xl font-black text-primary-600">{matchData.score}%</span>
              </div>
              
              <div className="space-y-3 mb-4">
                {[
                  { label: t('jobs.skills', 'Skills'), value: matchData.factors.skills },
                  { label: t('jobs.location', 'Location'), value: matchData.factors.location },
                  { label: t('jobs.experience', 'Experience'), value: matchData.factors.experience },
                ].map(factor => (
                  <div key={factor.label} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">{factor.label}</span>
                      <span className="font-medium text-dark">{factor.value}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${factor.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
