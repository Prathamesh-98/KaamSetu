// KaamSetu — Admin Layout
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Briefcase, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from '../components/layout/LanguageSelector'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="min-h-screen bg-surface flex">
      <aside className="w-64 bg-dark text-white flex flex-col fixed inset-y-0 left-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold">KaamSetu Admin</span>
          </div>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <Link to="/admin/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 transition-all">
            <LayoutDashboard className="w-4 h-4" /> {t('nav.dashboard', { defaultValue: 'Dashboard' })}
          </Link>
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/50 mb-2 truncate">{user?.email}</div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
            <LogOut className="w-4 h-4" /> {t('nav.signOut', { defaultValue: 'Sign Out' })}
          </button>
        </div>
      </aside>
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-end">
          <LanguageSelector />
        </header>
        <main className="flex-1 p-8 animate-fade-in"><Outlet /></main>
      </div>
    </div>
  )
}
