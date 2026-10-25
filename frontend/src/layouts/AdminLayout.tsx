// KaamSetu — Admin Layout
import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, HardHat, Building2, Briefcase, FileText,
  ShieldCheck, Receipt, User, LogOut, Menu, X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from '../components/layout/LanguageSelector'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  const navItems = [
    {
      path: '/admin/dashboard',
      label: t('nav.dashboard', { defaultValue: 'Dashboard' }),
      icon: LayoutDashboard,
      exact: true,
    },
    {
      path: '/admin/users',
      label: t('nav.adminUsers', { defaultValue: 'Users' }),
      icon: Users,
    },
    {
      path: '/admin/workers',
      label: t('nav.adminWorkers', { defaultValue: 'Workers' }),
      icon: HardHat,
    },
    {
      path: '/admin/employers',
      label: t('nav.adminEmployers', { defaultValue: 'Employers' }),
      icon: Building2,
    },
    {
      path: '/admin/jobs',
      label: t('nav.adminJobs', { defaultValue: 'Jobs' }),
      icon: Briefcase,
    },
    {
      path: '/admin/applications',
      label: t('nav.adminApplications', { defaultValue: 'Applications' }),
      icon: FileText,
    },
    {
      path: '/admin/verifications',
      label: t('nav.adminVerifications', { defaultValue: 'Verifications' }),
      icon: ShieldCheck,
    },
    {
      path: '/admin/payments',
      label: t('nav.adminPayments', { defaultValue: 'Ledger & Payments' }),
      icon: Receipt,
    },
    {
      path: '/admin/profile',
      label: t('admin.profileTitle', { defaultValue: 'Admin Profile' }),
      icon: User,
    },
  ]

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark text-white flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:shadow-none`}
        aria-label="Admin navigation"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-lg">KaamSetu Admin</span>
            </div>
            <div className="text-[11px] text-white/50 tracking-wider uppercase font-semibold mt-1">
              Platform Management
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('common.close', { defaultValue: 'Close navigation' })}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary-400' : 'text-white/60'}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <Link
            to="/admin/profile"
            onClick={() => setSidebarOpen(false)}
            className="block text-xs text-white/70 hover:text-white mb-2 truncate transition-colors"
            title={t('admin.profileTitle', { defaultValue: 'Admin Profile' })}
          >
            <span className="font-semibold block text-white/90 truncate">{user?.email}</span>
            <span className="text-[10px] text-white/50 uppercase tracking-wider">System Administrator</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors w-full pt-1"
          >
            <LogOut className="w-4 h-4" /> {t('nav.signOut', { defaultValue: 'Sign Out' })}
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-1.5 -ml-1 text-gray-600 hover:text-dark hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label={t('common.open', { defaultValue: 'Open navigation' })}
              aria-expanded={sidebarOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 truncate">
              KaamSetu Operational Console
            </div>
          </div>
          <LanguageSelector />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in"><Outlet /></main>
      </div>
    </div>
  )
}