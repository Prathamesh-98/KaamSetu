import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  Briefcase, Users, User, Plus, FileText, TrendingUp, Eye,
  ChevronRight, AlertCircle, Clock, CheckCircle, XCircle
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { employerApi, jobsApi, applicationsApi } from '../../api/services'
import type { JobListItem, ApplicationStatus, Application } from '../../types'

export default function EmployerDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['employer-profile', user?.id],
    queryFn: employerApi.getMyProfile,
  })

  const { data: jobs, isLoading: isJobsLoading } = useQuery({
    queryKey: ['employer-jobs'],
    queryFn: () => jobsApi.myJobs(),
  })

  const { data: applications, isLoading: isAppsLoading } = useQuery({
    queryKey: ['employer-applications'],
    queryFn: applicationsApi.list,
  })

  // ─── Calculations ──────────────────────────────────────────────────────────

  // 1. Profile Completeness
  const completeness = useMemo(() => {
    if (!profile) return 0
    const fields = [
      profile.full_name,
      profile.organization_name,
      profile.organization_type,
      profile.bio,
      profile.city,
      profile.state,
      profile.website
    ]
    const filled = fields.filter(Boolean).length
    return Math.round((filled / fields.length) * 100)
  }, [profile])

  // 2. Stats
  const activeJobs = useMemo(() => jobs?.filter((j) => j.status === 'ACTIVE') || [], [jobs])
  const urgentJobs = useMemo(() => jobs?.filter((j) => j.is_urgent) || [], [jobs])
  const totalApplicants = useMemo(() => applications?.length || 0, [applications])
  const pendingApplicants = useMemo(() => applications?.filter(a => a.status === 'PENDING') || [], [applications])
  const acceptedApplicants = useMemo(() => applications?.filter(a => a.status === 'ACCEPTED') || [], [applications])
  const recentJobs = useMemo(() => {
    if (!jobs) return []
    return [...jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
  }, [jobs])

  const isLoading = isProfileLoading || isJobsLoading || isAppsLoading

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-8 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-xl w-1/3" />
        <div className="h-24 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-8 space-y-8 max-w-7xl mx-auto">
      
      {/* ── Welcome Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-8 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('worker.welcome', 'Welcome')}, {profile?.organization_name || profile?.full_name || t('employer.defaultName', 'Employer')} 👋
          </h1>
          <p className="text-gray-500 text-base">
            {user?.email} · {t('employer.manageWorkforce', 'Manage your workforce and hiring process effectively.')}
          </p>
        </div>
        <div className="flex gap-4 relative z-10 flex-wrap">
          <Link to="/employer/post-job" className="inline-flex items-center justify-center px-5 py-2.5 bg-[#2455E8] hover:bg-[#1e46c7] text-white font-medium rounded-xl transition-colors shadow-sm">
            <Plus className="w-5 h-5 mr-2" /> {t('employer.postNew', 'Post a Job')}
          </Link>
          <Link to="/employer/shifts" className="inline-flex items-center justify-center px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors shadow-sm">
            <Clock className="w-5 h-5 mr-2 text-primary-600" /> {t('employer.shifts', 'Shifts & Settlement')}
          </Link>
          <Link to="/employer/jobs" className="inline-flex items-center justify-center px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors shadow-sm">
            <Briefcase className="w-5 h-5 mr-2" /> {t('nav.myJobs', 'My Jobs')}
          </Link>
        </div>
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-blue-50 rounded-full opacity-60 blur-3xl pointer-events-none"></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Profile Completion */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-end mb-3">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                  {t('employer.companyProfile', 'Company Profile')}
                  {completeness === 100 && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {completeness === 100 
                    ? t('employer.profileComplete', 'Your profile is fully complete. Great job!') 
                    : t('employer.profileIncomplete', 'Complete your profile to build trust with potential workers.')}
                </p>
              </div>
              <span className="font-bold text-[#2455E8] text-2xl">{completeness}%</span>
            </div>
            
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${completeness === 100 ? 'bg-emerald-500' : 'bg-[#2455E8]'}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
            
            {completeness < 100 && (
              <Link to="/employer/profile" className="inline-flex items-center justify-center px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors text-sm shadow-sm">
                {t('employer.completeProfileBtn', 'Complete Profile')}
              </Link>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: t('employer.totalJobs', 'Total Jobs'), value: jobs?.length || 0, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: t('employer.activeJobs', 'Active Jobs'), value: activeJobs.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: t('employer.totalApplicants', 'Total Applicants'), value: totalApplicants, color: 'text-[#2455E8]', bg: 'bg-blue-50' },
              { label: t('enums.status.PENDING', 'Pending'), value: pendingApplicants.length, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: t('enums.status.ACCEPTED', 'Accepted'), value: acceptedApplicants.length, color: 'text-green-600', bg: 'bg-green-50' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
                <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">{stat.label}</div>
                <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Applications Needing Attention */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                {t('employer.needsAttention', 'Needs Attention')}
              </h2>
            </div>
            
            {pendingApplicants.length > 0 ? (
              <div className="space-y-4">
                {pendingApplicants.slice(0, 5).map(app => (
                  <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-gray-900 text-base">{app.worker.full_name}</span>
                        <span className="text-gray-400 text-sm">{t('employer.appliedFor', 'applied for')}</span>
                        <span className="text-[#2455E8] font-medium text-sm">{app.job.title}</span>
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {new Date(app.applied_at).toLocaleDateString()}
                        {app.worker.years_experience !== null && ` · ${app.worker.years_experience} ${t('employer.yrsExp', 'yrs exp')}`}
                      </div>
                    </div>
                    <Link to={`/employer/jobs/${app.job.id}/applicants`} className="inline-flex items-center justify-center px-4 py-2 bg-[#2455E8] hover:bg-[#1e46c7] text-white font-medium rounded-xl transition-colors text-sm shadow-sm shrink-0">
                      {t('employer.reviewBtn', 'Review')}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <CheckCircle className="w-12 h-12 text-emerald-400 mb-3" />
                <p className="text-gray-500 text-base font-medium">{t('employer.allCaughtUp', 'You\'re all caught up! No pending applications.')}</p>
              </div>
            )}
          </div>

          {/* Job Performance */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-[#2455E8]" />
                {t('employer.jobPerformance', 'Job Performance')}
              </h2>
              <Link to="/employer/jobs" className="text-sm font-semibold text-[#2455E8] hover:text-[#1e46c7] flex items-center">
                {t('employer.manageJobs', 'Manage Jobs')} <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
            
            {recentJobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-4 font-semibold text-gray-600 rounded-tl-lg">{t('employer.jobTitle', 'Job Title')}</th>
                      <th className="px-5 py-4 font-semibold text-gray-600 text-center">{t('employer.statusCol', 'Status')}</th>
                      <th className="px-5 py-4 font-semibold text-gray-600 text-center">{t('employer.viewsCol', 'Views')}</th>
                      <th className="px-5 py-4 font-semibold text-gray-600 text-center">{t('employer.appsCol', 'Applications')}</th>
                      <th className="px-5 py-4 font-semibold text-gray-600 text-right rounded-tr-lg">{t('employer.actionCol', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentJobs.map(job => (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-gray-900 text-base">{job.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{new Date(job.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            job.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {t(`enums.status.${job.status}`, { defaultValue: job.status })}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center text-gray-600 font-medium">
                          <div className="flex items-center justify-center gap-1">
                            <Eye className="w-4 h-4 text-gray-400" />
                            {job.views_count || 0}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-gray-900">{job.applications_count}</td>
                        <td className="px-5 py-4 text-right">
                          <Link to={`/employer/jobs/${job.id}/applicants`} className="text-[#2455E8] hover:text-[#1e46c7] font-semibold flex items-center justify-end gap-1">
                            {t('employer.viewAction', 'View')} <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10 text-center flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Briefcase className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-base font-medium mb-4">{t('employer.noJobsPosted', 'No jobs posted yet.')}</p>
                <Link to="/employer/post-job" className="inline-flex items-center justify-center px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors shadow-sm">
                  {t('employer.postNew', 'Post a Job')}
                </Link>
              </div>
            )}
          </div>
          
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          
          {/* Recent Accepted Workers */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-emerald-500" />
                {t('employer.recentlyAccepted', 'Recently Accepted')}
              </h3>
            </div>
            
            {acceptedApplicants.length > 0 ? (
              <div className="space-y-4">
                {acceptedApplicants.slice(0, 5).map(app => (
                  <div key={app.id} className="flex gap-4 items-center p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700 font-bold text-lg">
                      {app.worker.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-base truncate">{app.worker.full_name}</h4>
                      <p className="text-sm text-gray-500 truncate">{app.job.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500 text-sm font-medium">{t('employer.noWorkersAccepted', 'No workers accepted yet.')}</p>
              </div>
            )}
          </div>

          {/* Quick Actions (Sidebar) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-5 text-lg">{t('employer.quickActions', 'Quick Actions')}</h3>
            <div className="space-y-3">
              <Link to="/employer/post-job" className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-gray-200 group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2455E8] group-hover:bg-[#2455E8] group-hover:text-white transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="font-bold text-gray-900 text-base">{t('employer.postNew', 'Post a Job')}</div>
              </Link>
              <Link to="/employer/shifts" className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-gray-200 group">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="font-bold text-gray-900 text-base">{t('employer.shifts', 'Shifts & Settlement')}</div>
              </Link>
              <Link to="/employer/jobs" className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-gray-200 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="font-bold text-gray-900 text-base">{t('nav.myJobs', 'My Jobs')}</div>
              </Link>
              <Link to="/employer/profile" className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-gray-200 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <div className="font-bold text-gray-900 text-base">{t('nav.profile', 'Profile')}</div>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
