import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, MapPin, Clock, Briefcase, ChevronRight, Trash2, AlertCircle, MessageSquare, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { applicationsApi, chatApi } from '../../api/services'
import type { Application, ApplicationStatus } from '../../types'
import { RateUserModal } from '../../components/RateUserModal'

const STATUS_CONFIG: Record<ApplicationStatus, { className: string }> = {
  PENDING:     { className: 'bg-blue-50 text-blue-700 border-blue-200' },
  SHORTLISTED: { className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED:    { className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:    { className: 'bg-red-50 text-red-600 border-red-200' },
  WITHDRAWN:   { className: 'bg-gray-50 text-gray-600 border-gray-200' },
  COMPLETED:   { className: 'bg-purple-50 text-purple-700 border-purple-200' },
}

function ApplicationCard({ app, onRate }: { app: Application, onRate: () => void }) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const status = STATUS_CONFIG[app.status]

  const withdrawMutation = useMutation({
    mutationFn: () => applicationsApi.withdraw(app.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['applications'] }),
  })

  const navigate = useNavigate()
  const startChatMutation = useMutation({
    mutationFn: () => chatApi.getOrCreateConversation(app.id),
    onSuccess: (data) => navigate(`/worker/messages?conversation=${data.id}`)
  })

  return (
    <div className="card p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex-1 min-w-0">
          <Link
            to={`/worker/jobs/${app.job.id}`}
            className="font-bold text-lg text-dark hover:text-primary-600 transition-colors line-clamp-1"
          >
            {app.job.title}
          </Link>
          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
            {app.job.employer.organization_name || app.job.employer.full_name}
          </p>
        </div>
        <span className={`inline-flex text-xs font-semibold px-3 py-1 rounded-full border flex-shrink-0 ${status.className}`}>
          {t(`statuses.${app.status}`, { defaultValue: app.status })}
        </span>
      </div>

      <div className="flex flex-col gap-2 text-sm text-gray-600 mb-4 flex-grow">
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" /> {app.job.city}, {app.job.state}
        </span>
        <span className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-gray-400" /> {app.job.category.name ? t(`categories.${app.job.category.name}`, { defaultValue: app.job.category.name }) : t('jobs.category', 'Category')}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          {t('jobs.appliedOn', 'Applied on')} {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        {startChatMutation.isError && (
          <div className="text-xs text-red-600 flex items-center gap-1 mb-2">
            <AlertCircle className="w-3 h-3" />
            {startChatMutation.error instanceof Error ? startChatMutation.error.message : t('messages.startError', 'Unable to start conversation.')}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/worker/jobs/${app.job.id}`}
            className="btn btn-outline text-sm py-2 flex-1 justify-center bg-white"
          >
            {t('applications.viewJob', 'View Job')}
          </Link>
          
          {(app.status === 'SHORTLISTED' || app.status === 'ACCEPTED') && (
            <button
              onClick={() => startChatMutation.mutate()}
              disabled={startChatMutation.isPending}
              className="btn btn-primary text-sm py-2 flex-1 justify-center flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              {startChatMutation.isPending ? t('messages.starting', 'Starting...') : t('messages.messageEmployer', 'Message')}
            </button>
          )}
          
          {(app.status === 'COMPLETED' || app.status === 'ACCEPTED') && (
            <button
              onClick={onRate}
              className="btn btn-secondary text-sm py-2 flex-1 justify-center flex items-center gap-1.5"
            >
              <Star className="w-4 h-4" />
              {t('rate_employer', 'Rate')}
            </button>
          )}
          
          {app.status === 'PENDING' && (
            <button
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending}
              className="btn bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200 text-sm py-2 flex-1 justify-center flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {withdrawMutation.isPending ? t('applications.withdrawing', 'Wait...') : t('applications.withdraw', 'Withdraw')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyApplications() {
  const { t } = useTranslation()
  const [ratingModal, setRatingModal] = useState({ isOpen: false, appId: '', employerName: '' })
  const { data: applications, isLoading, isError } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationsApi.list,
  })

  const statusCounts = applications?.reduce<Partial<Record<ApplicationStatus, number>>>((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1
    return acc
  }, {}) ?? {}

  return (
    <div className="container-page py-8 bg-[#F5F7FB] min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark">{t('nav.myApplications', 'My Applications')}</h1>
        <p className="text-gray-500 mt-1">{t('applications.subtitle', 'Track and manage all your job applications')}</p>
      </div>

      {applications && applications.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-8">
          <span className="bg-white border border-gray-200 text-gray-700 px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
            {applications.length} {t('applications.total', 'Total')}
          </span>
          {(Object.entries(statusCounts) as [ApplicationStatus, number][]).map(([status, count]) => (
            <span key={status} className={`px-4 py-1.5 rounded-full border text-sm font-medium shadow-sm ${STATUS_CONFIG[status].className}`}>
              {t(`statuses.${status}`, { defaultValue: status })}: {count}
            </span>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 h-48 animate-pulse bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-auto" />
              <div className="flex gap-2 mt-4">
                <div className="h-10 bg-gray-200 rounded flex-1" />
                <div className="h-10 bg-gray-200 rounded flex-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="card p-8 text-center bg-white rounded-xl border border-red-100 shadow-sm max-w-lg mx-auto">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="font-bold text-dark mb-2">{t('applications.errorTitle', 'Failed to load applications')}</h3>
          <p className="text-sm text-gray-500">{t('applications.errorDesc', 'Please refresh the page and try again.')}</p>
        </div>
      )}

      {!isLoading && !isError && applications?.length === 0 && (
        <div className="card p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary-300" />
          </div>
          <h3 className="font-bold text-dark text-xl mb-2">{t('applications.emptyTitle', 'No applications yet')}</h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">
            {t('applications.emptyDesc', 'Browse available jobs and apply to start building your application history.')}
          </p>
          <Link to="/worker/jobs" className="btn btn-primary px-8 py-3">
            {t('applications.browseJobs', 'Browse Jobs')}
          </Link>
        </div>
      )}

      {!isLoading && !isError && applications && applications.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map((app) => (
            <ApplicationCard key={app.id} app={app} onRate={() => setRatingModal({ isOpen: true, appId: app.id, employerName: app.job?.employer?.organization_name || 'Employer' })} />
          ))}
        </div>
      )}

      {ratingModal.isOpen && (
        <RateUserModal
          isOpen={ratingModal.isOpen}
          onClose={() => setRatingModal({ isOpen: false, appId: '', employerName: '' })}
          applicationId={ratingModal.appId}
          userName={ratingModal.employerName}
        />
      )}
    </div>
  )
}
