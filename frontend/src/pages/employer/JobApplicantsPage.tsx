import { useState } from 'react'
import { RateUserModal } from '../../components/RateUserModal'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, User, MapPin, CheckCircle, XCircle, Star, AlertCircle, Clock, MessageSquare, Heart, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { jobsApi, applicationsApi, chatApi, employerApi } from '../../api/services'
import type { Application, ApplicationStatus } from '../../types'

const STATUS_CONFIG: Record<ApplicationStatus, { className: string }> = {
  PENDING:     { className: 'bg-blue-50 text-blue-700 border-blue-200' },
  SHORTLISTED: { className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED:    { className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:    { className: 'bg-red-50 text-red-600 border-red-200' },
  WITHDRAWN:   { className: 'bg-gray-50 text-gray-600 border-gray-200' },
  COMPLETED:   { className: 'bg-purple-50 text-purple-700 border-purple-200' },
}

export default function JobApplicantsPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [ratingModal, setRatingModal] = useState({ isOpen: false, appId: '', workerName: '' })

  const { data: applicants, isLoading, isError } = useQuery({
    queryKey: ['job-applicants', id],
    queryFn: () => jobsApi.getApplicants(id!),
    enabled: !!id,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ appId, status }: { appId: string, status: ApplicationStatus }) => 
      applicationsApi.updateStatus(appId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['job-applicants', id] })
    },
  })

  const navigate = useNavigate()
  const startChatMutation = useMutation({
    mutationFn: (appId: string) => chatApi.getOrCreateConversation(appId),
    onSuccess: (data) => navigate(`/employer/messages?conversation=${data.id}`)
  })

  const { data: savedWorkerIds = [] } = useQuery({
    queryKey: ['saved-worker-ids'],
    queryFn: employerApi.getSavedWorkerIds,
    staleTime: 30_000,
  })

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ workerId, isSaved }: { workerId: string; isSaved: boolean }) => {
      if (isSaved) {
        await employerApi.removeSavedWorker(workerId);
        return { workerId, action: 'removed' };
      } else {
        await employerApi.saveWorker(workerId);
        return { workerId, action: 'saved' };
      }
    },
    onSuccess: ({ workerId, action }) => {
      queryClient.setQueryData(['saved-worker-ids'], (old: string[] = []) =>
        action === 'saved' ? [...old, workerId] : old.filter(id => id !== workerId)
      );
      void queryClient.invalidateQueries({ queryKey: ['saved-worker-ids'] });
      void queryClient.invalidateQueries({ queryKey: ['employer-saved-workers'] });
      toast.success(action === 'saved' ? t('savedWorkers.saved', 'Worker saved to favourites') : t('savedWorkers.removed', 'Worker removed from favourites'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'Action failed'));
    }
  })

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-8" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-6 h-32 bg-gray-100" />
        ))}
      </div>
    )
  }

  if (isError || !applicants) {
    return (
      <div className="container-page py-8">
        <div className="card p-8 text-center bg-red-50 border-red-200">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-red-700">{t('jobs.errorTitle', { defaultValue: 'Failed to load applicants' })}</h3>
          <p className="text-sm text-red-600 mt-1">{t('jobs.errorDesc', { defaultValue: 'Please try refreshing the page.' })}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-4">
        <Link to="/employer/jobs" className="btn btn-outline px-3">
          <ArrowLeft className="w-4 h-4" /> {t('common.back', { defaultValue: 'Back' })}
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#182849' }}>{t('jobs.jobApplicants', { defaultValue: 'Job Applicants' })}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('jobs.manageApplications', { defaultValue: 'Manage applications for this job' })}</p>
        </div>
      </div>

      {updateStatusMutation.isError && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{t('applications.actionFailed', { defaultValue: 'Action failed' })}</p>
            <p className="text-sm">
              {updateStatusMutation.error instanceof Error 
                ? updateStatusMutation.error.message 
                : t('applications.updateStatusError', { defaultValue: 'Unable to update applicant status. Please check job requirements or try again.' })}
            </p>
          </div>
        </div>
      )}

      {/* ── Applicant List ────────────────────────────────────────────────── */}
      {applicants.length === 0 ? (
        <div className="card p-12 text-center">
          <User className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark">{t('jobs.noApplicants', { defaultValue: 'No applicants yet' })}</h3>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            {t('jobs.noApplicantsDesc', { defaultValue: 'When workers apply for this job, they will appear here for you to review and shortlist.' })}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applicants.map((app: Application) => {
            const statusStyle = STATUS_CONFIG[app.status]
            const isProcessing = updateStatusMutation.isPending && updateStatusMutation.variables?.appId === app.id
            
            return (
              <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-start gap-6 hover:shadow-md transition-shadow">
                {/* Avatar */}
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200 overflow-hidden">
                   {app.worker?.profile_image_url ? (
                     <img src={app.worker.profile_image_url} alt="" className="w-full h-full object-cover" />
                   ) : (
                     <User className="w-8 h-8 text-gray-400" />
                   )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-dark truncate">
                          {app.worker?.full_name || t('auth.workerRole', { defaultValue: 'Worker' })}
                        </h3>
                        {app.worker && (
                          <button
                            type="button"
                            onClick={() => toggleFavoriteMutation.mutate({
                              workerId: app.worker.id,
                              isSaved: savedWorkerIds.includes(app.worker.id)
                            })}
                            disabled={toggleFavoriteMutation.isPending && toggleFavoriteMutation.variables?.workerId === app.worker.id}
                            className={`p-1 rounded-md transition-colors ${
                              savedWorkerIds.includes(app.worker.id)
                                ? 'text-red-500 hover:bg-red-50'
                                : 'text-gray-300 hover:text-red-500 hover:bg-gray-50'
                            }`}
                            title={savedWorkerIds.includes(app.worker.id) ? t('savedWorkers.removeFromSaved', 'Remove from Saved') : t('savedWorkers.saveWorker', 'Save to Favourites')}
                          >
                            {toggleFavoriteMutation.isPending && toggleFavoriteMutation.variables?.workerId === app.worker.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Heart className={`w-4 h-4 ${savedWorkerIds.includes(app.worker.id) ? 'fill-red-500 text-red-500' : ''}`} />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" /> 
                          {app.worker?.city || t('common.locationUnknown', { defaultValue: 'Location unknown' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" /> 
                          {t('jobs.applied', { defaultValue: 'Applied' })} {new Date(app.applied_at).toLocaleDateString('en-IN')}
                        </span>
                        {app.worker?.average_rating !== undefined && app.worker.average_rating > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> 
                            {app.worker.average_rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${statusStyle.className}`}>
                      {t(`statuses.${app.status}`, { defaultValue: app.status })}
                    </span>
                  </div>

                  {app.cover_note && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 border border-gray-100">
                      <span className="font-semibold text-gray-700 mr-2">{t('applications.coverNote', { defaultValue: 'Cover Note:' })}</span>
                      <span className="italic">"{app.cover_note}"</span>
                    </div>
                  )}

                  {app.worker?.skills && app.worker.skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {app.worker.skills.slice(0, 5).map(ws => (
                        <span key={ws.skill.id} className="text-xs bg-surface text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                          {ws.skill.name}
                        </span>
                      ))}
                      {app.worker.skills.length > 5 && (
                        <span className="text-xs text-gray-400">+{app.worker.skills.length - 5} {t('common.more', { defaultValue: 'more' })}</span>
                      )}
                    </div>
                  )}
                </div>

                 {/* Actions */}
                 <div className="flex flex-col gap-2 sm:min-w-[140px] flex-shrink-0 pt-2 sm:pt-0">
                    {app.status === 'PENDING' && (
                      <>
                        <button 
                          onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'SHORTLISTED' })}
                          disabled={isProcessing}
                          className="btn btn-primary w-full shadow-sm text-sm"
                        >
                          {isProcessing ? t('applications.processing', { defaultValue: 'Processing...' }) : t('applications.shortlist', { defaultValue: 'Shortlist' })}
                        </button>
                        <button 
                          onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'REJECTED' })}
                          disabled={isProcessing}
                          className="btn bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 w-full text-sm transition-colors"
                        >
                          {t('applications.reject', { defaultValue: 'Reject' })}
                        </button>
                      </>
                    )}
                    {app.status === 'SHORTLISTED' && (
                      <>
                        <button 
                          onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'ACCEPTED' })}
                          disabled={isProcessing}
                          className="btn bg-emerald-600 hover:bg-emerald-700 text-white w-full shadow-sm text-sm border-transparent transition-colors"
                        >
                          <CheckCircle className="w-4 h-4 mr-1.5" /> {t('applications.accept', { defaultValue: 'Accept' })}
                        </button>
                        <button 
                          onClick={() => updateStatusMutation.mutate({ appId: app.id, status: 'REJECTED' })}
                          disabled={isProcessing}
                          className="btn bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 w-full text-sm transition-colors"
                        >
                          <XCircle className="w-4 h-4 mr-1.5" /> {t('applications.reject', { defaultValue: 'Reject' })}
                        </button>
                      </>
                    )}
                    {(app.status === 'COMPLETED' || app.status === 'ACCEPTED') && (
                        <>
                          <button
                            onClick={() => setRatingModal({ isOpen: true, appId: app.id, workerName: app.worker?.full_name || 'Worker' })}
                            className="btn btn-secondary flex-1 shadow-sm text-sm"
                          >
                            <Star className="w-4 h-4 mr-1" />
                            {t('rate_worker', 'Rate Worker')}
                          </button>
                        </>
                      )}
                      {(app.status === 'SHORTLISTED' || app.status === 'ACCEPTED') && (
                      <>
                        <button
                          onClick={() => startChatMutation.mutate(app.id)}
                          disabled={startChatMutation.isPending}
                          className="btn btn-secondary text-sm w-full shadow-sm mt-1 flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare className="w-4 h-4" />
                          {startChatMutation.isPending && startChatMutation.variables === app.id ? t('messages.starting', { defaultValue: 'Starting...' }) : t('messages.messageWorker', { defaultValue: 'Message Worker' })}
                        </button>
                        {startChatMutation.isError && startChatMutation.variables === app.id && (
                          <div className="text-xs text-red-600 flex items-start gap-1 mt-1 text-left w-full">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>{startChatMutation.error instanceof Error ? startChatMutation.error.message : t('messages.startError', { defaultValue: 'Unable to start conversation.' })}</span>
                          </div>
                        )}
                      </>
                    )}
                    {(app.status === 'REJECTED' || app.status === 'WITHDRAWN' || app.status === 'COMPLETED') && (
                      <p className="text-xs text-gray-400 text-center italic mt-2">
                        {t('applications.noFurtherActions', { defaultValue: 'No further actions available' })}
                      </p>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {ratingModal.isOpen && (
        <RateUserModal
          isOpen={ratingModal.isOpen}
          onClose={() => setRatingModal({ isOpen: false, appId: '', workerName: '' })}
          applicationId={ratingModal.appId}
          userName={ratingModal.workerName}
        />
      )}
    </div>
  )
}
