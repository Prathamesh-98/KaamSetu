// KaamSetu — My Jobs Page (Employer)
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase, Users, Eye, MapPin, Plus, Zap, Pencil,
  Trash2, ChevronRight, Clock
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { jobsApi } from '../../api/services'
import type { JobListItem, JobStatus } from '../../types'

const STATUS_CONFIG: Record<JobStatus, { color: string }> = {
  DRAFT:     { color: 'bg-gray-100 text-gray-600' },
  ACTIVE:    { color: 'bg-emerald-50 text-emerald-700' },
  CLOSED:    { color: 'bg-red-50 text-red-600' },
  COMPLETED: { color: 'bg-blue-50 text-blue-700' },
  CANCELLED: { color: 'bg-gray-100 text-gray-500' },
}

function JobCard({ job }: { job: JobListItem }) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const status = STATUS_CONFIG[job.status]

  const deleteMutation = useMutation({
    mutationFn: () => jobsApi.delete(job.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['employer-jobs'] }),
  })

  const handleDelete = () => {
    if (window.confirm(t('jobs.confirmDelete', { defaultValue: 'Close/cancel "${title}"? This cannot be undone.', title: job.title }))) {
      deleteMutation.mutate()
    }
  }

  const salaryText = job.salary_min
    ? `₹${job.salary_min.toLocaleString()}${job.salary_max ? ` – ₹${job.salary_max.toLocaleString()}` : '+'}`
    : t('jobs.salaryNegotiable', { defaultValue: 'Negotiable' })

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {job.is_urgent && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                <Zap className="w-3 h-3" /> {t('jobs.urgent', { defaultValue: 'Urgent' })}
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
              {t(`statuses.${job.status}`, { defaultValue: job.status })}
            </span>
          </div>
          <h3 className="font-bold text-dark text-base">{job.title}</h3>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {job.city}, {job.state}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" /> {job.category.name ? t(`categories.${job.category.name}`, { defaultValue: job.category.name }) : ''}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold text-primary-600 text-sm">{salaryText}</div>
          <div className="text-xs text-gray-400 lowercase">
             {job.salary_min ? t(`enums.salaryType.${job.salary_type}`, { defaultValue: job.salary_type.replace('HOURLY', '/hr').replace('DAILY', '/day').replace('MONTHLY', '/month').replace('FIXED', ' fixed').replace('PROJECT', '/project') }) : ''}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary-400" />
          <strong className="text-dark">{job.applications_count}</strong> {t('jobs.applicants', { defaultValue: 'applicants' })}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <Eye className="w-3 h-3" /> {t(`enums.workType.${job.work_type}`, { defaultValue: job.work_type.replace('_', ' ').toLowerCase() })}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <Link
          to={`/employer/jobs/${job.id}/applicants`}
          className="btn btn-sm btn-primary gap-1.5"
        >
          <Users className="w-3 h-3" /> {t('jobs.viewApplicants', { defaultValue: 'View Applicants' })} <ChevronRight className="w-3 h-3" />
        </Link>
          <Link to={`/employer/jobs/${job.id}/candidates`} className="btn btn-sm bg-blue-50 text-blue-600 hover:bg-blue-100 gap-1.5">
            <Zap className="w-3 h-3" /> {t('jobs.findCandidates', { defaultValue: 'Find Candidates' })}
          </Link>
          <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/employer/jobs/${job.id}/edit`)}
            className="p-2 text-gray-400 hover:text-primary-600 transition-colors rounded-lg hover:bg-primary-50"
            title={t('jobs.editJob', { defaultValue: 'Edit job' })}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50"
            title={t('jobs.deleteJob', { defaultValue: 'Delete job' })}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MyJobsPage() {
  const { t } = useTranslation()
  const { data: jobs, isLoading, isError } = useQuery({
    queryKey: ['employer-jobs'],
    queryFn: () => jobsApi.myJobs(),
  })

  const activeCount = jobs?.filter((j) => j.status === 'ACTIVE').length ?? 0
  const totalApplicants = jobs?.reduce((s, j) => s + j.applications_count, 0) ?? 0

  return (
    <div className="container-page py-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#182849' }}>{t('nav.myJobs', { defaultValue: 'My Jobs' })}</h1>
          <p className="text-gray-500 mt-1">{t('jobs.myJobsDesc', { defaultValue: 'Manage and track your job postings' })}</p>
        </div>
        <Link to="/employer/post-job" className="btn btn-primary self-start">
          <Plus className="w-4 h-4" /> {t('nav.postJob', { defaultValue: 'Post New Job' })}
        </Link>
      </div>

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      {jobs && jobs.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="card px-5 py-3 flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-primary-500" />
            <div>
              <div className="font-bold text-dark text-lg">{jobs.length}</div>
              <div className="text-xs text-gray-500">{t('jobs.totalPostings', { defaultValue: 'Total Postings' })}</div>
            </div>
          </div>
          <div className="card px-5 py-3 flex items-center gap-3">
            <Eye className="w-5 h-5 text-emerald-500" />
            <div>
              <div className="font-bold text-dark text-lg">{activeCount}</div>
              <div className="text-xs text-gray-500">{t('statuses.ACTIVE', { defaultValue: 'Active' })}</div>
            </div>
          </div>
          <div className="card px-5 py-3 flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-500" />
            <div>
              <div className="font-bold text-dark text-lg">{totalApplicants}</div>
              <div className="text-xs text-gray-500">{t('jobs.totalApplicants', { defaultValue: 'Total Applicants' })}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-48" />
                  <div className="flex gap-2">
                    {[...Array(3)].map((_, j) => <div key={j} className="h-3 bg-gray-200 rounded w-20" />)}
                  </div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
              <div className="flex gap-6 pt-2">
                <div className="h-4 bg-gray-200 rounded w-20" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {isError && (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="font-bold text-dark mb-2">{t('jobs.errorTitle', { defaultValue: 'Failed to load jobs' })}</h3>
          <p className="text-sm text-gray-500">{t('jobs.errorDesc', { defaultValue: 'Please refresh the page and try again.' })}</p>
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!isLoading && !isError && jobs?.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-primary-300" />
          </div>
          <h3 className="font-bold text-dark mb-2">{t('jobs.noJobsPosted', { defaultValue: 'No jobs posted yet' })}</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            {t('jobs.noJobsPostedDesc', { defaultValue: 'Post your first job to start receiving applications from skilled workers.' })}
          </p>
          <Link to="/employer/post-job" className="btn btn-primary">
            <Plus className="w-4 h-4" /> {t('jobs.postFirstJob', { defaultValue: 'Post Your First Job' })}
          </Link>
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {!isLoading && !isError && jobs && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

    </div>
  )
}


