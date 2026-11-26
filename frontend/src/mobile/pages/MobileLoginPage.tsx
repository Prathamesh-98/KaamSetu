import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import BrandLogo from '../../components/common/BrandLogo';
import { useBackButton } from '../hooks/useBackButton';

export const MobileLoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  useBackButton();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent duplicate submission

    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('auth.emailRequired', 'Email is required'));
      return;
    }
    if (!password) {
      setError(t('auth.passwordRequired', 'Password is required'));
      return;
    }

    setIsLoading(true);

    try {
      const data = await authApi.login({ email: trimmedEmail, password });
      login(data);

      // Immediately navigate to role dashboard
      if (data.user.role === 'WORKER') {
        navigate('/worker/dashboard', { replace: true });
      } else if (data.user.role === 'EMPLOYER') {
        navigate('/employer/dashboard', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="mobile-app-root justify-between">
      {/* Top Bar with Back Button */}
      <div className="mobile-header-safe">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <BrandLogo variant="light" size="sm" linkTo={null} />
          <div className="w-10" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-5 py-6 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('auth.welcomeBack', 'Welcome Back')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('auth.loginSub', 'Sign in to access your KaamSetu account')}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email / Username field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('auth.email', 'Email Address')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium focus:border-indigo-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('auth.password', 'Password')}
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-indigo-900 hover:underline"
              >
                {t('auth.forgotPassword', 'Forgot password?')}
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm font-medium focus:border-indigo-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mobile-touch-target absolute right-0 top-0 p-3 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-indigo-900 py-3.5 text-center text-sm font-bold text-white shadow-md active:scale-[0.99] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>{t('auth.loggingIn', 'Signing In...')}</span>
              </>
            ) : (
              <span>{t('auth.login', 'Sign In')}</span>
            )}
          </button>
        </form>

        {/* Create account link */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <span>{t('auth.dontHaveAccount', "Don't have an account?")} </span>
          <Link to="/register" className="font-bold text-indigo-900 hover:underline">
            {t('auth.registerNow', 'Register Now')}
          </Link>
        </div>
      </div>

      {/* Subtle Bottom Safety Pad */}
      <div className="h-6" />
    </div>
  );
};

export default MobileLoginPage;
