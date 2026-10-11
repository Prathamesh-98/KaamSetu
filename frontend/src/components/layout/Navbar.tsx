// KaamSetu - Navbar
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, Briefcase, LogOut, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import LanguageSelector from './LanguageSelector'
import NotificationDropdown from './NotificationDropdown'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  
  const isHome = location.pathname === '/'
  const isTransparent = isHome && !isScrolled

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    
    // Set initial state
    handleScroll()
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const dashboardPath = user
    ? user.role === 'WORKER' ? '/worker/dashboard'
    : user.role === 'EMPLOYER' ? '/employer/dashboard'
    : '/admin/dashboard'
    : '/login'

  const navClasses = isHome 
    ? `fixed w-full top-0 z-50 transition-all duration-300 ${isTransparent ? 'bg-transparent border-b border-white/10' : 'bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm'}`
    : "sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300"

  return (
    <nav className={navClasses}>
      <div className="w-full max-w-[96rem] mx-auto px-4 sm:px-6 lg:pl-[4rem] lg:pr-[2.5rem]">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className={`font-display font-bold text-lg transition-colors duration-300 ${isTransparent ? 'text-white' : 'text-dark'}`}>
              Kaam<span className="text-primary-600">Setu</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/how-it-works" className={`text-sm font-medium transition-colors duration-300 ${isTransparent ? 'text-white/90 hover:text-white' : 'text-gray-600 hover:text-primary-600'}`}>
              {t('nav.howItWorks')}
            </Link>
            <Link to="/about" className={`text-sm font-medium transition-colors duration-300 ${isTransparent ? 'text-white/90 hover:text-white' : 'text-gray-600 hover:text-primary-600'}`}>
              {t('nav.about')}
            </Link>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link to={dashboardPath} className={`btn btn-ghost text-sm gap-1.5 transition-colors duration-300 ${isTransparent ? 'text-white hover:bg-white/10' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'}`}>
                  <LayoutDashboard className="w-4 h-4" />
                  {t('nav.dashboard')}
                </Link>
                <LanguageSelector isTransparent={isTransparent} />
                <NotificationDropdown isTransparent={isTransparent} />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{user.email[0].toUpperCase()}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className={`btn btn-ghost text-sm transition-colors duration-300 ${isTransparent ? 'text-red-300 hover:bg-white/10 hover:text-red-200' : 'text-red-500 hover:bg-red-50 hover:text-red-600'}`}
                  >
                    <LogOut className="w-4 h-4" />
                    {t('nav.logout')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <LanguageSelector isTransparent={isTransparent} />
                <Link to="/login" className={`btn btn-ghost text-sm transition-colors duration-300 ${isTransparent ? 'text-white hover:bg-white/10' : ''}`}>
                  {t('nav.login')}
                </Link>
                <Link to="/register?role=WORKER" className={`btn text-sm transition-colors duration-300 ${isTransparent ? 'border border-white/30 text-white hover:bg-white/10' : 'btn-outline'}`}>
                  {t('nav.findWork')}
                </Link>
                <Link to="/register?role=EMPLOYER" className="btn bg-[#FF8A24] hover:bg-[#E67A1F] text-white border-none shadow-md text-sm transition-colors duration-300">
                  {t('nav.hireWorkers')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors duration-300 ${isTransparent ? 'text-white hover:bg-white/10' : 'hover:bg-gray-100 text-dark'}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white animate-slide-up shadow-lg">
          <div className="container-page py-4 flex flex-col gap-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-500">{t('nav.language', 'Language')}</span>
              <LanguageSelector isTransparent={false} />
            </div>
            <Link to="/how-it-works" className="text-sm font-medium text-gray-600 py-2" onClick={() => setIsOpen(false)}>
              {t('nav.howItWorks')}
            </Link>
            <Link to="/about" className="text-sm font-medium text-gray-600 py-2" onClick={() => setIsOpen(false)}>
              {t('nav.about')}
            </Link>
            {user ? (
              <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                <Link to={dashboardPath} className="btn btn-primary w-full justify-center" onClick={() => setIsOpen(false)}>
                  {t('nav.dashboard')}
                </Link>
                <button onClick={() => { handleLogout(); setIsOpen(false); }} className="btn btn-ghost text-red-500 w-full justify-center">
                  <LogOut className="w-4 h-4" /> {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                <Link to="/login" className="btn btn-ghost w-full justify-center" onClick={() => setIsOpen(false)}>
                  {t('nav.login')}
                </Link>
                <Link to="/register?role=WORKER" className="btn btn-outline w-full justify-center" onClick={() => setIsOpen(false)}>
                  {t('nav.findWork')}
                </Link>
                <Link to="/register?role=EMPLOYER" className="btn btn-primary w-full justify-center" onClick={() => setIsOpen(false)}>
                  {t('nav.hireWorkers')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
