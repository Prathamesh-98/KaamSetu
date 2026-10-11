// KaamSetu — Employer Layout
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Briefcase, Users, Bell, LogOut, Menu, X, MessageSquare, Calendar, Heart } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from '../components/layout/LanguageSelector'
import NotificationDropdown from '../components/layout/NotificationDropdown'
import { useQuery } from '@tanstack/react-query'
import { chatApi } from '../api/services'

const NAV_ITEMS = [
  { icon: LayoutDashboard, labelKey: 'nav.dashboard', defaultLabel: 'Dashboard', href: '/employer/dashboard' },
  { icon: PlusCircle, labelKey: 'nav.postJob', defaultLabel: 'Post a Job', href: '/employer/post-job' },
  { icon: Briefcase, labelKey: 'nav.myJobs', defaultLabel: 'My Jobs', href: '/employer/jobs' },
  { icon: Heart, labelKey: 'nav.savedWorkers', defaultLabel: 'Saved Workers', href: '/employer/saved-workers' },
  { icon: Calendar, labelKey: 'nav.shifts', defaultLabel: 'Shifts', href: '/employer/shifts' },
  { icon: MessageSquare, labelKey: 'nav.messages', defaultLabel: 'Messages', href: '/employer/messages' },
  { icon: Users, labelKey: 'nav.myProfile', defaultLabel: 'My Profile', href: '/employer/profile' },
]

export default function EmployerLayout() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const { data: unreadData } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: chatApi.getUnreadCount,
    refetchInterval: 10000,
    enabled: !!user
  })
  const unreadCount = unreadData?.unread_count || 0

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex font-sans text-[#182849]">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#E7ECF3] shadow-sm flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:shadow-none
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#E7ECF3] flex items-center justify-between">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#2455E8] rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-[#182849] text-xl">
                Kaam<span className="text-[#2455E8]">Setu</span>
              </span>
            </Link>
            <div className="mt-1 text-[11px] text-gray-500 font-medium uppercase tracking-wider">{t('nav.employerPortal', 'Employer Portal')}</div>
          </div>
          <button className="lg:hidden p-1 text-gray-500 hover:bg-gray-100 rounded-md" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, labelKey, defaultLabel, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                to={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex justify-between items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#2455E8]/10 text-[#2455E8]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-[#182849]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-[#2455E8]' : 'text-gray-400'}`} />
                  {t(labelKey, defaultLabel)}
                </div>
                {href.includes('/messages') && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-[#E7ECF3] bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#2455E8] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">{user?.email?.[0]?.toUpperCase() || 'E'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#182849] truncate">{user?.email || 'employer@example.com'}</div>
              <div className="text-xs text-gray-500 font-medium">{t('auth.employerRole', 'Employer')}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-[#E7ECF3] rounded-lg hover:bg-gray-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.signOut', 'Sign Out')}
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b border-[#E7ECF3] px-4 sm:px-6 py-3 flex items-center gap-4 shadow-sm relative z-30">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <NotificationDropdown isTransparent={false} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
