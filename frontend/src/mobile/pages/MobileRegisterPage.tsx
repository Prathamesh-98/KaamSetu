import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Phone, User, CheckCircle2, AlertCircle, ArrowLeft, Briefcase, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import type { UserRole } from '../../types';
import BrandLogo from '../../components/common/BrandLogo';
import { useBackButton } from '../hooks/useBackButton';

export const MobileRegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  useBackButton();

  const urlRole = searchParams.get('role');
  const [role, setRole] = useState<UserRole>(
    urlRole === 'EMPLOYER' ? 'EMPLOYER' : 'WORKER'
  );

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent duplicate submission

    setError('');

    if (!passwordValid) {
      setError(t('auth.passwordRequirements', 'Password must be at least 8 characters with 1 uppercase letter and 1 digit.'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        email: email.trim(),
        password,
        role,
      };
      if (phone.trim()) {
        payload.phone_number = phone.trim();
      }

      const data = await authApi.register(payload);
      login(data);

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
    <div className="mobile-app-root">
      {/* Header */}
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

      <div className="mobile-content-area px-5 py-4 max-w-md mx-auto w-full">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('auth.createAccount', 'Create Account')}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('auth.selectRoleSub', 'Choose your profile type to get started')}
          </p>
        </div>

        {/* Distinct Role Selection Tabs */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            type="button"
            onClick={() => setRole('WORKER')}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
              role === 'WORKER'
                ? 'bg-indigo-900 text-white border-indigo-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Briefcase className={`h-6 w-6 mb-1.5 ${role === 'WORKER' ? 'text-amber-400' : 'text-slate-400'}`} />
            <div className="font-bold text-xs">
              {t('roles.WORKER', 'I am a Worker')}
            </div>
            <div className={`text-[10px] mt-0.5 ${role === 'WORKER' ? 'text-indigo-200' : 'text-slate-400'}`}>
              Find jobs & shifts
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRole('EMPLOYER')}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
              role === 'EMPLOYER'
                ? 'bg-indigo-900 text-white border-indigo-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Users className={`h-6 w-6 mb-1.5 ${role === 'EMPLOYER' ? 'text-amber-400' : 'text-slate-400'}`} />
            <div className="font-bold text-xs">
              {t('roles.EMPLOYER', 'I am an Employer')}
            </div>
            <div className={`text-[10px] mt-0.5 ${role === 'EMPLOYER' ? 'text-indigo-200' : 'text-slate-400'}`}>
              Hire verified talent
            </div>
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('auth.email', 'Email Address')} *
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
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium focus:border-indigo-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('auth.phone', 'Mobile Number')}
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                autoComplete="tel"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium focus:border-indigo-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('auth.password', 'Password')} *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm font-medium focus:border-indigo-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mobile-touch-target absolute right-0 top-0 p-2.5 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Validation checklist */}
            {password.length > 0 && (
              <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
                <span className={passwordChecks.length ? 'text-emerald-600 font-semibold' : ''}>
                  {passwordChecks.length ? '✓' : '•'} 8+ chars
                </span>
                <span className={passwordChecks.uppercase ? 'text-emerald-600 font-semibold' : ''}>
                  {passwordChecks.uppercase ? '✓' : '•'} 1 Uppercase
                </span>
                <span className={passwordChecks.digit ? 'text-emerald-600 font-semibold' : ''}>
                  {passwordChecks.digit ? '✓' : '•'} 1 Digit
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('auth.confirmPassword', 'Confirm Password')} *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium focus:border-indigo-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-indigo-900 py-3 text-center text-sm font-bold text-white shadow-md active:scale-[0.99] transition-transform disabled:opacity-60 flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>{t('auth.registering', 'Creating Account...')}</span>
              </>
            ) : (
              <span>{t('auth.register', 'Create Account')}</span>
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-500">
          <span>{t('auth.alreadyHaveAccount', 'Already have an account?')} </span>
          <Link to="/login" className="font-bold text-indigo-900 hover:underline">
            {t('auth.login', 'Sign In')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MobileRegisterPage;
