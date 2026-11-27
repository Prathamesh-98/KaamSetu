import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mail, Phone, ArrowLeft, CheckCircle2, AlertCircle,
  Lock, Eye, EyeOff, RefreshCw, KeyRound, Check
} from 'lucide-react';
import { authApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import { useBackButton } from '../hooks/useBackButton';
import { useStatusBar } from '../hooks/useStatusBar';

type RecoveryMode = 'email' | 'phone';
type RecoveryStep = 'destination' | 'verify_otp' | 'new_password' | 'success';

export const MobileForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useBackButton();
  useStatusBar(false);

  const [mode, setMode] = useState<RecoveryMode>('email');
  const [step, setStep] = useState<RecoveryStep>('destination');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [redirectSeconds, setRedirectSeconds] = useState(4);

  useEffect(() => {
    if (cooldown <= 0) return;
    const tmr = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tmr);
  }, [cooldown]);

  useEffect(() => {
    if (step !== 'success') return;
    const tmr = setInterval(() => {
      setRedirectSeconds((s) => {
        if (s <= 1) {
          clearInterval(tmr);
          navigate('/login', { replace: true });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tmr);
  }, [step, navigate]);

  const passwordCriteria = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasDigit,
      hasSpecial,
      isMatching,
      allValid: hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial && isMatching,
    };
  }, [newPassword, confirmPassword]);

  const formatNormalizedPhone = (raw: string) => {
    let cleaned = raw.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (!cleaned.startsWith('+91') && cleaned.length === 10) cleaned = `+91${cleaned}`;
    return cleaned;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    setLoading(true);
    try {
      if (mode === 'email') {
        const cleanEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          setErrorMessage(t('auth.invalidEmail', 'Please enter a valid email address.'));
          setLoading(false);
          return;
        }
        const res = await authApi.forgotPasswordEmail(cleanEmail);
        setInfoMessage(res.message || t('auth.otpDispatchedGeneric', 'If an account exists, a 6-digit OTP code has been sent.'));
        setCooldown(res.cooldown_seconds || 60);
      } else {
        const cleanPhone = formatNormalizedPhone(phone);
        if (!/^\+91[0-9]{10}$/.test(cleanPhone)) {
          setErrorMessage(t('verification.invalidPhoneFormat', 'Enter a valid 10-digit mobile number.'));
          setLoading(false);
          return;
        }
        const res = await authApi.forgotPasswordPhone(cleanPhone);
        setInfoMessage(res.message || t('auth.otpDispatchedGeneric', 'If an account exists, a 6-digit OTP code has been sent.'));
        setCooldown(res.cooldown_seconds || 60);
      }
      setStep('verify_otp');
    } catch (err) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage(t('verification.invalidOtpLength', 'Please enter a valid 6-digit OTP code.'));
      return;
    }
    setLoading(true);
    try {
      const res =
        mode === 'email'
          ? await authApi.verifyRecoveryEmail(email.trim().toLowerCase(), cleanOtp)
          : await authApi.verifyRecoveryPhone(formatNormalizedPhone(phone), cleanOtp);
      setResetToken(res.reset_token);
      setInfoMessage(t('auth.otpVerifiedSuccess', 'Code verified! Create a strong new password.'));
      setStep('new_password');
    } catch (err) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!passwordCriteria.allValid) {
      setErrorMessage(t('auth.passwordCriteriaUnmet', 'Please satisfy all password rules.'));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setStep('success');
    } catch (err) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-fullscreen-editor">
      <div className="mobile-header-safe bg-gradient-to-r from-[#172154] to-[#1F2A6B] text-white">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mobile-touch-target rounded-full p-2 text-white/80 hover:text-white"
            aria-label={t('common.back', 'Back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-400" />
            <h1 className="text-base font-extrabold">{t('auth.forgotPasswordTitle', 'Reset Password')}</h1>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        {infoMessage && (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {step === 'destination' && (
          <form onSubmit={handleSendOtp} className="mobile-card p-5 space-y-4">
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('email')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${
                  mode === 'email' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                {t('auth.email', 'Email')}
              </button>
              <button
                type="button"
                onClick={() => setMode('phone')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${
                  mode === 'phone' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                {t('auth.phone', 'Phone')}
              </button>
            </div>

            {mode === 'email' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('auth.registeredEmail', 'Registered Email Address')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm bg-white min-h-[46px]"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('auth.registeredPhone', 'Registered 10-Digit Mobile')}
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm bg-white min-h-[46px]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-900 py-3.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
            >
              {loading ? t('verification.sendingOtp', 'Sending OTP...') : t('verification.sendOtpCode', 'Send OTP Code')}
            </button>
          </form>
        )}

        {step === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="mobile-card p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('verification.enter6DigitOtp', 'Enter 6-Digit OTP Code')}
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full text-center tracking-[0.4em] text-xl font-black rounded-xl border border-slate-300 py-3 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full rounded-xl bg-indigo-900 py-3.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
            >
              {loading ? t('common.verifying', 'Verifying...') : t('auth.verifyOtp', 'Verify Code')}
            </button>

            <button
              type="button"
              disabled={cooldown > 0 || loading}
              onClick={handleSendOtp}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-indigo-800 disabled:text-slate-400"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {cooldown > 0 ? `${t('verification.resendIn', 'Resend in')} ${cooldown}s` : t('verification.resendOtp', 'Resend OTP')}
            </button>
          </form>
        )}

        {step === 'new_password' && (
          <form onSubmit={handleResetPassword} className="mobile-card p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('auth.newPassword', 'New Password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-10 text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-3 text-slate-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('auth.confirmPassword', 'Confirm Password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-10 text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-3 text-slate-400"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-[11px]">
              {[
                [passwordCriteria.hasMinLength, 'Min 8 characters'],
                [passwordCriteria.hasUpper, 'One uppercase letter'],
                [passwordCriteria.hasLower, 'One lowercase letter'],
                [passwordCriteria.hasDigit, 'One number'],
                [passwordCriteria.hasSpecial, 'One special character'],
                [passwordCriteria.isMatching, 'Passwords match'],
              ].map(([ok, label]) => (
                <div key={String(label)} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                  <Check className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !passwordCriteria.allValid}
              className="w-full rounded-xl bg-indigo-900 py-3.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
            >
              {loading ? t('common.saving', 'Saving...') : t('auth.resetPasswordBtn', 'Update Password')}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="mobile-card p-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-extrabold text-slate-900">
              {t('auth.passwordResetSuccess', 'Password Reset Complete!')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('auth.redirectingLogin', `Redirecting to Sign In in ${redirectSeconds}s...`)}
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white"
            >
              {t('auth.backToLogin', 'Sign In Now')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileForgotPasswordPage;
