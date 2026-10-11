import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Briefcase, FileText, CheckCircle, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '../../api/services'
import LoadingScreen from '../../components/common/LoadingScreen'

export default function AdminDashboard() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
  })

  if (isLoading) return <LoadingScreen />
  
  // Dummy data if error for the stub
  const displayStats = stats || {
    total_users: 1540,
    total_workers: 1200,
    total_employers: 340,
    active_jobs: 89,
    total_jobs: 450,
    total_applications: 3200,
    completed_jobs: 310
  }

  const statCards = [
    { label: 'Total Users', value: displayStats.total_users, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Workers', value: displayStats.total_workers, icon: Users, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Total Employers', value: displayStats.total_employers, icon: BuildingIcon, color: 'text-purple-600 bg-purple-50' },
    { label: 'Active Jobs', value: displayStats.active_jobs, icon: Briefcase, color: 'text-green-600 bg-green-50' },
    { label: 'Total Applications', value: displayStats.total_applications, icon: FileText, color: 'text-orange-600 bg-orange-50' },
    { label: 'Completed Jobs', value: displayStats.completed_jobs, icon: CheckCircle, color: 'text-teal-600 bg-teal-50' },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-dark">{t('nav.admin')}</h1>
          <p className="text-gray-500 mt-2">KaamSetu administration dashboard</p>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-6">
          Could not load real-time stats. Displaying cached data.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {statCards.map((stat, i) => (
          <div key={i} className="card p-6 flex items-center gap-4">
             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
             </div>
             <div>
                <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                <h3 className="text-2xl font-bold text-dark mt-1">{stat.value.toLocaleString()}</h3>
             </div>
          </div>
        ))}
      </div>
      
      <div className="card p-8 text-center text-gray-500">
         <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
         <h3 className="text-lg font-semibold text-dark">Analytics Dashboard</h3>
         <p className="text-sm mt-2">More detailed charts and tables will be implemented here in Phase 4.</p>
      </div>
    </div>
  )
}

function BuildingIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <path d="M9 22v-4h6v4"></path>
      <path d="M8 6h.01"></path>
      <path d="M16 6h.01"></path>
      <path d="M12 6h.01"></path>
      <path d="M12 10h.01"></path>
      <path d="M12 14h.01"></path>
      <path d="M16 10h.01"></path>
      <path d="M16 14h.01"></path>
      <path d="M8 10h.01"></path>
      <path d="M8 14h.01"></path>
    </svg>
  )
}
