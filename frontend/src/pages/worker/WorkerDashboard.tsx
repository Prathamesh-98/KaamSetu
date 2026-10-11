import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Search, FileText, User, TrendingUp, Clock, CheckCircle, 
  AlertCircle, Bookmark, Briefcase, ChevronRight, Zap
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { workerApi, applicationsApi, jobsApi } from '../../api/services'
import { JobCard } from './FindJobs'
import type { WorkerProfile, ApplicationStatus } from '../../types'

export default function WorkerDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['worker-profile', user?.id],
    queryFn: workerApi.getMyProfile,
  })

  const { data: applications, isLoading: isAppsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationsApi.list,
  })

  const { data: savedJobs, isLoading: isSavedLoading } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: workerApi.getSavedJobs,
  })

  const { data: latestJobsData, isLoading: isJobsLoading } = useQuery({
    queryKey: ['jobs', { sort_by: 'newest', per_page: 5 }],
    queryFn: () => jobsApi.list({ sort_by: 'newest', per_page: 5 }),
  })

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (id: string) => workerApi.saveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  })

  const unsaveMutation = useMutation({
    mutationFn: (id: string) => workerApi.unsaveJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }),
  })

  const savedJobIds = useMemo(() => {
    if (!savedJobs) return new Set<string>()
    return new Set(savedJobs.map(sj => sj.job.id))
  }, [savedJobs])

  const handleToggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (savedJobIds.has(id)) unsaveMutation.mutate(id)
    else saveMutation.mutate(id)
  }

  // ─── Calculations ──────────────────────────────────────────────────────────

  // 1. Profile Completeness
  const completeness = useMemo(() => {
    if (!profile) return 0
    let score = 0
    const fields = [
      profile.full_name,
      profile.bio,
      profile.city,
      profile.state,
      profile.years_experience !== null,
      profile.expected_salary !== null,
      profile.availability_status,
      profile.preferred_work_types && profile.preferred_work_types.length > 0,
      profile.skills && profile.skills.length > 0
    ]
    const filled = fields.filter(Boolean).length
    score = Math.round((filled / fields.length) * 100)
    return score
  }, [profile])

  // 2. Application Stats
  const appStats = useMemo(() => {
    const stats = { total: 0, pending: 0, shortlisted: 0, accepted: 0 }
    if (!applications) return stats
    
    stats.total = applications.length
    applications.forEach(app => {
      if (app.status === 'PENDING') stats.pending++
      else if (app.status === 'SHORTLISTED') stats.shortlisted++
      else if (app.status === 'ACCEPTED') stats.accepted++
    })
    return stats
  }, [applications])

  // 3. Recent Applications (Top 3)
  const recentApplications = useMemo(() => {
    if (!applications) return []
    return [...applications]
      .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
      .slice(0, 3)
  }, [applications])

  // 4. Saved Jobs Preview (Top 3)
  const savedJobsPreview = useMemo(() => {
    if (!savedJobs) return []
    return savedJobs.slice(0, 3)
  }, [savedJobs])

  const isLoading = isProfileLoading || isAppsLoading || isSavedLoading || isJobsLoading

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-8 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-xl w-1/3" />
        <div className="h-24 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl shadow-sm" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-8 space-y-8">
      
      {/* ── Welcome Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-[#182849] mb-1">
            {t('worker.welcome', 'Welcome')}, {profile?.full_name || 'Worker'} 👋
          </h1>
          <p className="text-gray-500 font-medium">
            {t('worker.welcomeSubtitle', 'Find your next opportunity on KaamSetu.')}
          </p>
        </div>
        <div className="flex gap-3 relative z-10">
          <Link to="/worker/jobs" className="btn btn-primary rounded-xl shadow-sm font-semibold">
            <Search className="w-4 h-4 mr-1.5" /> {t('nav.findJobs')}
          </Link>
          <Link to="/worker/profile" className="btn btn-outline bg-white rounded-xl shadow-sm font-semibold">
            <User className="w-4 h-4 mr-1.5" /> {t('nav.profile')}
          </Link>
        </div>
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-primary-50 rounded-full opacity-50 blur-2xl"></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Profile Completion */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="font-bold text-[#182849] flex items-center gap-2 text-lg">
                  {t('worker.profileCompletion', 'Profile Completion')}
                  {completeness === 100 && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                </h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                  {completeness === 100 
                    ? t('worker.profileCompleteMsg', 'Your profile is looking great!') 
                    : t('worker.profileIncompleteMsg', 'Complete your profile to improve your job opportunities.')}
                </p>
              </div>
              <span className="font-bold text-primary-700 text-xl">{completeness}%</span>
            </div>
            
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${completeness === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
            
            {completeness < 100 && (
              <Link to="/worker/profile" className="btn btn-sm btn-outline rounded-xl font-semibold">
                {t('worker.completeProfileBtn', 'Complete Profile')}
              </Link>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-t-4 border-t-blue-500">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t('worker.statsApplications', 'Applications')}</div>
              <div className="text-3xl font-black text-[#182849]">{appStats.total}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-t-4 border-t-amber-500">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t('worker.statsShortlisted', 'Shortlisted')}</div>
              <div className="text-3xl font-black text-[#182849]">{appStats.shortlisted}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-t-4 border-t-emerald-500">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t('worker.statsAccepted', 'Accepted')}</div>
              <div className="text-3xl font-black text-[#182849]">{appStats.accepted}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-t-4 border-t-primary-500">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t('worker.savedJobs', 'Saved Jobs')}</div>
              <div className="text-3xl font-black text-[#182849]">{savedJobs?.length || 0}</div>
            </div>
          </div>

          {/* Latest Opportunities */}
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-[#182849] flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                {t('worker.recommendedJobs', 'Recommended Jobs')}
              </h2>
              <Link to="/worker/jobs" className="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center bg-primary-50 px-3 py-1.5 rounded-lg transition-colors">
                {t('worker.viewAll', 'View All')} <ChevronRight className="w-4 h-4 ml-0.5" />
              </Link>
            </div>
            
            {latestJobsData?.items && latestJobsData.items.length > 0 ? (
              <div className="space-y-4">
                {latestJobsData.items.map(job => (
                  <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                    <JobCard 
                      job={job} 
                      isSaved={savedJobIds.has(job.id)}
                      onToggleSave={handleToggleSave}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-10 text-center">
                <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">{t('worker.noNewJobs', 'No new jobs available right now.')}</p>
              </div>
            )}
          </div>
          
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          
          {/* Availability & Skills (Mini Profile) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-[#182849] mb-5 text-lg">{t('worker.atAGlance', 'At a Glance')}</h3>
            
            <div className="mb-6">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">{t('jobs.availability', 'Availability')}</div>
              {profile?.availability_status === 'AVAILABLE' ? (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> {t('worker.statusAvailable', 'Available for work')}
                </span>
              ) : profile?.availability_status === 'BUSY' ? (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" /> {t('worker.statusBusy', 'Currently Busy')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold border border-gray-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shadow-sm" /> {t('worker.statusNotAvailable', 'Not Available')}
                </span>
              )}
            </div>

            <div>
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">{t('jobs.skills', 'Skills')}</div>
              {profile?.skills && profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.slice(0, 5).map(ws => (
                    <span key={ws.skill.id} className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 shadow-sm">
                      {t(`skills.${ws.skill.name}`, { defaultValue: ws.skill.name })}
                    </span>
                  ))}
                  {profile.skills.length > 5 && (
                    <span className="px-2.5 py-1 text-xs font-semibold text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                      +{profile.skills.length - 5} {t('worker.moreSkills', 'more')}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic font-medium">{t('worker.noSkillsAdded', 'No skills added yet.')}</p>
              )}
            </div>
          </div>

          {/* Recent Applications */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-[#182849] flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-gray-400" />
                {t('worker.recentApplications', 'Recent Applications')}
              </h3>
              <Link to="/worker/applications" className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg transition-colors">
                {t('worker.viewAll', 'View All')}
              </Link>
            </div>
            
            {recentApplications.length > 0 ? (
              <div className="space-y-3">
                {recentApplications.map(app => (
                  <Link key={app.id} to={`/worker/jobs/${app.job.id}`} className="block p-4 border border-gray-100 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all group bg-gray-50/50 hover:bg-white">
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className="font-bold text-[#182849] text-sm truncate pr-2 group-hover:text-primary-600 transition-colors">{app.job.title}</h4>
                      <StatusBadge status={app.status} t={t} />
                    </div>
                    <p className="text-xs font-medium text-gray-500 mb-2">{app.job.employer.organization_name || app.job.employer.full_name}</p>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t('worker.appliedOn', 'Applied')} {new Date(app.applied_at).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-500 text-sm font-medium">{t('worker.noApplications', 'No applications yet.')}</p>
                <Link to="/worker/jobs" className="btn btn-sm btn-outline mt-4 rounded-xl font-semibold shadow-sm">{t('nav.findJobs')}</Link>
              </div>
            )}
          </div>

          {/* Saved Jobs Preview */}
          {savedJobsPreview.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-[#182849] flex items-center gap-2 text-lg">
                  <Bookmark className="w-5 h-5 text-primary-500 fill-primary-100" />
                  {t('worker.savedJobs', 'Saved Jobs')}
                </h3>
                <Link to="/worker/saved-jobs" className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg transition-colors">
                  {t('worker.viewAll', 'View All')}
                </Link>
              </div>
              <div className="space-y-3">
                {savedJobsPreview.map(sj => (
                  <Link key={sj.id} to={`/worker/jobs/${sj.job.id}`} className="block p-3 border border-gray-100 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all group bg-gray-50/50 hover:bg-white">
                    <h4 className="font-bold text-[#182849] text-sm truncate group-hover:text-primary-600 mb-1 transition-colors">{sj.job.title}</h4>
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {sj.job.city}, {sj.job.state}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status, t }: { status: ApplicationStatus, t: any }) {
  const styles: Record<ApplicationStatus, string> = {
    PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
    SHORTLISTED: 'bg-amber-50 text-amber-700 border-amber-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    WITHDRAWN: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider shadow-sm ${styles[status]}`}>
      {t(`enums.status.${status}`, { defaultValue: status })}
    </span>
  )
}
