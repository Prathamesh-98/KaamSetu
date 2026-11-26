// KaamSetu - Login Page
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Briefcase, AlertCircle, ShieldCheck, Star, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { authApi } from '../../api/services'
import { extractErrorMessage } from '../../api/client'
import { motion } from 'framer-motion'
import BrandLogo from '../../components/common/BrandLogo'

export default function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const data = await authApi.login({ email, password })
      login(data)

      const dashMap = {
        WORKER: '/worker/dashboard',
        EMPLOYER: '/employer/dashboard',
        ADMIN: '/admin/dashboard',
      }
      navigate(dashMap[data.user.role])
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FC] flex flex-col md:flex-row">
      {/* Left Promotional Panel */}
      <div className="hidden md:flex md:w-[45%] lg:w-[40%] bg-[#0B1735] relative overflow-hidden text-white flex-col">
        {/* Navy gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-[#0B1735] z-0" />
        
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0 mix-blend-overlay opacity-30">
           <img src="/images/mechanic.webp" alt="Mechanic" className="w-full h-full object-cover object-[70%_30%]" />
        </div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0B1735] via-[#0B1735]/80 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 lg:p-14 justify-between">
          <div>
            <div className="mb-12">
              <BrandLogo variant="dark" size="lg" />
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h2 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight">
                {t('auth.promoHeadline', 'Connecting Talent with Opportunity')}
              </h2>
              <p className="text-blue-100/80 mb-8 text-lg">
                {t('auth.promoDesc', 'KaamSetu bridges the gap between skilled workers and businesses.')}
              </p>

              <div className="space-y-4">
                {[
                  { icon: ShieldCheck, text: t('auth.trustPoint1', 'Verified Profiles') },
                  { icon: Briefcase, text: t('auth.trustPoint2', 'Secure Hiring') },
                  { icon: Star, text: t('auth.trustPoint3', 'Community Rated') }
                ].map((point, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-blue-50/90">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                      <point.icon className="w-4 h-4 text-primary-400" />
                    </div>
                    <span className="font-medium">{point.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full md:w-[55%] lg:w-[60%] flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="md:hidden flex justify-center mb-8">
            <BrandLogo variant="light" size="lg" className="mb-2" />
          </div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <h1 className="text-3xl font-bold text-dark mb-2">{t('auth.login', 'Log In')}</h1>
            <p className="text-gray-500 mb-8">{t('auth.loginSubtitle', 'Welcome back! Please enter your details.')}</p>

            <div className="card p-6 sm:p-8 shadow-sm border border-gray-100 bg-white rounded-2xl">
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">{t('auth.loginFailedTitle', 'Unable to sign in')}</p>
                      <p className="mt-1 text-red-700 text-xs leading-relaxed">
                        {t('auth.loginGuidance', 'Check your credentials, or register if you are new to KaamSetu.')}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Link
                          to="/register"
                          className="inline-flex items-center text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                        >
                          {t('auth.registerNow', 'Register for KaamSetu')}
                        </Link>
                        <Link
                          to="/forgot-password"
                          className="text-xs font-medium text-red-800 hover:underline"
                        >
                          {t('auth.forgotPassword', 'Forgot password?')}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="label text-sm font-medium text-gray-700" htmlFor="email">{t('auth.email', 'Email Address')}</label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      className="input pl-10 w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 transition-shadow"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label text-sm font-medium text-gray-700" htmlFor="password">{t('auth.password', 'Password')}</label>
                    <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                      {t('auth.forgotPassword', 'Forgot password?')}
                    </Link>
                  </div>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="password"
                      type={showPass ? "text" : "password"}
                      className="input pl-10 pr-10 w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 transition-shadow"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="btn btn-primary w-full justify-center h-12 text-base font-semibold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading ? t('common.submitting', 'Loading...') : t('auth.login', 'Log In')}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-gray-600">
                {t('auth.noAccount', "Don't have an account?")}{' '}
                <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                  {t('auth.register', 'Register')}
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
