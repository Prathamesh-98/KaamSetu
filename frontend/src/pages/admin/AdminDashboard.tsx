import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, Briefcase, FileText, CheckCircle, ArrowRight, Building2, HardHat, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '../../api/services'
import LoadingScreen from '../../components/common/LoadingScreen';
import { AdminVerificationManager } from '../../components/verification/AdminVerificationManager';

export default function AdminDashboard() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
  })

  if (isLoading) return <LoadingScreen />
  
  // Fallback defaults if stats fail
  const displayStats = stats || {
    total_users: 0,
    total_workers: 0,
    total_employers: 0,
    active_jobs: 0,
    total_jobs: 0,
    total_applications: 0,
    completed_jobs: 0
  }

  const statCards = [
    {
      label: 'Total Users',
      value: displayStats.total_users,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 group-hover:bg-blue-100',
      link: '/admin/users',
      sublabel: 'Manage all accounts'
    },
    {
      label: 'Total Workers',
      value: displayStats.total_workers,
      icon: HardHat,
      color: 'text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100',
      link: '/admin/workers',
      sublabel: 'Profiles & skills'
    },
    {
      label: 'Total Employers',
      value: displayStats.total_employers,
      icon: Building2,
      color: 'text-purple-600 bg-purple-50 group-hover:bg-purple-100',
      link: '/admin/employers',
      sublabel: 'Businesses & postings'
    },
    {
      label: 'Active Jobs',
      value: displayStats.active_jobs,
      icon: Briefcase,
      color: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100',
      link: '/admin/jobs',
      sublabel: 'Moderation & listings'
    },
    {
      label: 'Total Applications',
      value: displayStats.total_applications,
      icon: FileText,
      color: 'text-orange-600 bg-orange-50 group-hover:bg-orange-100',
      link: '/admin/applications',
      sublabel: 'Cross-platform log'
    },
    {
      label: 'Completed Jobs',
      value: displayStats.completed_jobs,
      icon: Receipt,
      color: 'text-teal-600 bg-teal-50 group-hover:bg-teal-100',
      link: '/admin/payments',
      sublabel: 'Offline settlement ledger'
    },
  ]

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-dark">{t('nav.admin', 'Admin Dashboard')}</h1>
          <p className="text-gray-500 mt-2">KaamSetu administration and platform operations</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl mb-6 text-sm">
          Could not load real-time stats from backend.
        </div>
      )}

      {/* 6 Clickable Management Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {statCards.map((stat, i) => (
          <Link
            key={i}
            to={stat.link}
            className="card p-6 flex items-center justify-between group hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-2xl font-bold text-dark mt-0.5">{stat.value.toLocaleString()}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{stat.sublabel}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </Link>
        ))}
      </div>
      
      {/* Verification Queue Section */}
      <div className="mt-8">
        <AdminVerificationManager />
      </div>
    </div>
  )
}