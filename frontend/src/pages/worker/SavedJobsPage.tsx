import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bookmark, MapPin, Briefcase, IndianRupee, Clock, Zap, ArrowRight, Trash2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { workerApi } from '../../api/services'
import type { SavedJob } from '../../types'

export default function SavedJobsPage() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const { data: savedJobs, isLoading, isError } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: workerApi.getSavedJobs,
  })

  const unsaveMutation = useMutation({
    mutationFn: (jobId: string) => workerApi.unsaveJob(jobId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  })

  if (isLoading) {
    return (
      <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 h-48 bg-white rounded-xl border border-gray-100 shadow-sm animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">
        <div className="card p-8 text-center bg-white rounded-xl border border-red-100 shadow-sm max-w-lg mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-red-700">{t('jobs.errorTitle', 'Failed to load saved jobs')}</h3>
          <p className="text-sm text-red-600 mt-1">{t('jobs.errorDesc', 'Please try refreshing the page.')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-primary-600 fill-primary-600" />
          {t('nav.savedJobs', 'Saved Jobs')}
        </h1>
        <p className="text-gray-500 mt-1">{t('jobs.savedJobsDesc', "Jobs you've bookmarked for later")}</p>
      </div>

      {!savedJobs || savedJobs.length === 0 ? (
        <div className="card p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-xl font-bold text-dark mb-2">{t('jobs.noSavedJobs', 'No saved jobs yet')}</h3>
          <p className="text-gray-500 mb-8">
            {t('jobs.noSavedJobsDesc', "Save jobs you're interested in and find them here later when you're ready to apply.")}
          </p>
          <Link to="/worker/jobs" className="btn btn-primary inline-flex px-8 py-3">
            {t('jobs.findJobs', 'Find Jobs')}
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedJobs.map((savedJob: SavedJob) => {
            const { job } = savedJob
            const isProcessing = unsaveMutation.isPending && unsaveMutation.variables === job.id

            return (
              <div key={savedJob.id} className="card p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <Link to={`/worker/jobs/${job.id}`} className="text-lg font-bold text-dark hover:text-primary-600 transition-colors line-clamp-2">
                      {job.title}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">{job.employer?.organization_name || job.employer?.full_name}</p>
                  </div>
                  {job.is_urgent && (
                    <span className="flex items-center flex-shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500 mr-1" /> {t('jobs.urgent', 'Urgent')}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 mb-4 text-sm text-gray-500 flex-grow">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span className="capitalize">{t(`enums.workType.${job.work_type}`, { defaultValue: job.work_type.replace('_', ' ').toLowerCase() })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {job.city}, {job.state}
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-gray-400" />
                    {job.salary_min ? `₹${job.salary_min.toLocaleString()}` : t('jobs.notSpecified', 'Not specified')}
                    {job.salary_max ? ` - ₹${job.salary_max.toLocaleString()}` : ''}
                    {job.salary_min && <span className="text-xs text-gray-400 lowercase ml-1">{t(`enums.salaryType.${job.salary_type}`, { defaultValue: job.salary_type.replace('HOURLY', '/hr').replace('DAILY', '/day').replace('MONTHLY', '/month').replace('FIXED', ' fixed').replace('PROJECT', '/project') })}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {t('jobs.savedOn', 'Saved')} {new Date(savedJob.saved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>

                {job.status !== 'ACTIVE' && (
                  <div className="mb-4 inline-block bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded border border-gray-100 w-fit">
                    {t('jobs.notAcceptingApplications', 'No longer accepting applications')}
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-50">
                  <Link 
                    to={`/worker/jobs/${job.id}`}
                    className="btn btn-primary flex-1 justify-center text-sm shadow-sm"
                  >
                    {t('jobs.viewDetails', 'View Details')}
                  </Link>
                  <button
                    onClick={() => unsaveMutation.mutate(job.id)}
                    disabled={isProcessing}
                    className="btn btn-outline border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-sm flex-shrink-0 px-3 transition-colors disabled:opacity-50"
                    title={t('jobs.unsave', 'Unsave')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
