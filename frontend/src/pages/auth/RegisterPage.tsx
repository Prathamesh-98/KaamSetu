// KaamSetu - Register Page
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, User, Phone, Briefcase, Users, AlertCircle, CheckCircle, ShieldCheck, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { authApi } from '../../api/services'
import { extractErrorMessage } from '../../api/client'
import type { UserRole } from '../../types'
import { motion } from 'framer-motion'

export default function RegisterPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const initialRole = (searchParams.get('role') as UserRole) || 'WORKER'

  const [role, setRole] = useState<UserRole>(initialRole)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  }
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!passwordValid) {
      setError('Password does not meet requirements')
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match'))
      return
    }

    setIsLoading(true)

    try {
      const payload: any = { email, password, role }
      if (phone.trim()) payload.phone_number = phone.trim()

      const data = await authApi.register(payload)
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
           <img src="/images/brick-workers.webp" alt="Workers" className="w-full h-full object-cover object-[60%_40%]" />
        </div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0B1735] via-[#0B1735]/80 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 lg:p-14 justify-between">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 mb-12 group">
              <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-md">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-white">
                Kaam<span className="text-primary-600">Setu</span>
              </span>
            </Link>

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
      <div className="w-full md:w-[55%] lg:w-[60%] flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="md:hidden text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
              <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-md">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-dark">
                Kaam<span className="text-primary-600">Setu</span>
              </span>
            </Link>
          </div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <h1 className="text-3xl font-bold text-dark mb-2">{t('auth.register', 'Register')}</h1>
            <p className="text-gray-500 mb-6">{t('auth.registerSubtitle', 'Join KaamSetu and connect with opportunities.')}</p>

            <div className="card p-6 sm:p-8 shadow-sm border border-gray-100 bg-white rounded-2xl">
              {/* Role Selector */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setRole('WORKER')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    role === 'WORKER'
                      ? 'border-primary-500 bg-primary-50/50 text-primary-700 shadow-sm'
                      : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Users className={`w-5 h-5 ${role === 'WORKER' ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-semibold">{t('auth.workerRole', "I'm a Worker")}</span>
                  <span className="text-xs opacity-70 font-medium">{t('auth.workerRoleDesc', 'Looking for work')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('EMPLOYER')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    role === 'EMPLOYER'
                      ? 'border-secondary-500 bg-secondary-50/50 text-secondary-700 shadow-sm'
                      : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Briefcase className={`w-5 h-5 ${role === 'EMPLOYER' ? 'text-secondary-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-semibold">{t('auth.employerRole', "I'm an Employer")}</span>
                  <span className="text-xs opacity-70 font-medium">{t('auth.employerRoleDesc', 'Looking to hire')}</span>
                </button>
              </div>

              {error && (
                <div className="alert-error mb-5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="label text-sm font-medium text-gray-700" htmlFor="email">{t('auth.email', 'Email Address')}</label>
                  <div className="relative mt-1">
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

                {/* Phone */}
                <div>
                  <label className="label text-sm font-medium text-gray-700" htmlFor="phone">{t('auth.phone', 'Phone Number (Optional)')}</label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="phone"
                      type="tel"
                      className="input pl-10 w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 transition-shadow"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="label text-sm font-medium text-gray-700" htmlFor="password">{t('auth.password', 'Password')}</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="password"
                      type={showPass ? "text" : "password"}
                      className="input pl-10 pr-10 w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 transition-shadow"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {/* Password requirements */}
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className={`text-xs flex items-center gap-1 ${passwordChecks.length ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordChecks.length ? <CheckCircle className="w-3 h-3" /> : <div className="w-1 h-1 rounded-full bg-gray-400 ml-1 mr-1" />}
                        At least 8 characters
                      </div>
                      <div className={`text-xs flex items-center gap-1 ${passwordChecks.uppercase ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordChecks.uppercase ? <CheckCircle className="w-3 h-3" /> : <div className="w-1 h-1 rounded-full bg-gray-400 ml-1 mr-1" />}
                        One uppercase letter
                      </div>
                      <div className={`text-xs flex items-center gap-1 ${passwordChecks.digit ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordChecks.digit ? <CheckCircle className="w-3 h-3" /> : <div className="w-1 h-1 rounded-full bg-gray-400 ml-1 mr-1" />}
                        One number
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="label text-sm font-medium text-gray-700" htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm Password')}</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="confirmPassword"
                      type={showPass ? "text" : "password"}
                      className="input pl-10 pr-10 w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 transition-shadow"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || !passwordValid}
                  className="btn btn-primary w-full justify-center h-12 text-base font-semibold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                  {isLoading ? t('common.submitting', 'Submitting...') : t('auth.register', 'Register')}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600">
                {t('auth.hasAccount', "Already have an account?")}{' '}
                <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                  {t('auth.login', 'Log In')}
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
