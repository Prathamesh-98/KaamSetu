// KaamSetu — Unified Real OTP Password Recovery Workflow
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mail, Phone, Shield, ArrowLeft, CheckCircle2, AlertCircle,
  Lock, Eye, EyeOff, RefreshCw, Copy, Check, ExternalLink,
  KeyRound, ShieldCheck, CheckSquare, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';

type RecoveryMode = 'email' | 'phone';
type RecoveryStep = 'destination' | 'verify_otp' | 'new_password' | 'success';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Mode and Step State
  const [mode, setMode] = useState<RecoveryMode>('email');
  const [step, setStep] = useState<RecoveryStep>('destination');

  // Input States
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Recovery Token
  const [resetToken, setResetToken] = useState('');

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [redirectSeconds, setRedirectSeconds] = useState(5);
  const [copiedSupport, setCopiedSupport] = useState(false);

  const supportEmail = 'support@kaamsetu.in';

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Success auto-redirect countdown
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (step === 'success') {
      timer = setInterval(() => {
        setRedirectSeconds((s) => {
          if (s <= 1) {
            clearInterval(timer);
            navigate('/login');
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, navigate]);

  // Password Strength Checklist
  const passwordCriteria = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
    const allValid = hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial && isMatching;

    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasDigit,
      hasSpecial,
      isMatching,
      allValid,
    };
  }, [newPassword, confirmPassword]);

  // Support Email Copy
  const handleCopySupport = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopiedSupport(true);
    setTimeout(() => setCopiedSupport(false), 2500);
  };

  const mailtoLink = `mailto:${supportEmail}?subject=${encodeURIComponent(
    'KaamSetu Account Access Recovery Assistance'
  )}&body=${encodeURIComponent(
    'Hello KaamSetu Support Team,\n\nI need manual assistance recovering my KaamSetu account.\n\nRegistered Email / Phone:\nAccount Role (Worker / Employer):\nDetails of issue:\n\nThank you.'
  )}`;

  // Normalization Helpers
  const formatNormalizedPhone = (raw: string) => {
    let cleaned = raw.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (!cleaned.startsWith('+91') && cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    }
    return cleaned;
  };

  // Mask destination for display
  const maskedDestination = useMemo(() => {
    if (mode === 'email') {
      if (!email.includes('@')) return email;
      const [local, domain] = email.split('@');
      if (local.length <= 2) return `${local[0]}***@${domain}`;
      return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
    } else {
      const p = formatNormalizedPhone(phone);
      if (p.length < 8) return p;
      return `${p.slice(0, 5)} **** ${p.slice(-2)}`;
    }
  }, [mode, email, phone]);

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (mode === 'email') {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setErrorMessage(t('auth.invalidEmail', 'Please enter a valid email address.'));
        return;
      }
      setLoading(true);
      try {
        const res = await authApi.forgotPasswordEmail(cleanEmail);
        setInfoMessage(res.message || t('auth.otpDispatchedGeneric', 'If an account exists, a 6-digit OTP code has been dispatched.'));
        setCooldown(res.cooldown_seconds || 60);
        setStep('verify_otp');
      } catch (err: unknown) {
        setErrorMessage(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    } else {
      const cleanPhone = formatNormalizedPhone(phone);
      if (!/^\+91[0-9]{10}$/.test(cleanPhone)) {
        setErrorMessage(t('verification.invalidPhoneFormat', 'Enter a valid 10-digit mobile number.'));
        return;
      }
      setLoading(true);
      try {
        const res = await authApi.forgotPasswordPhone(cleanPhone);
        setInfoMessage(res.message || t('auth.otpDispatchedGeneric', 'If an account exists, a 6-digit OTP code has been dispatched.'));
        setCooldown(res.cooldown_seconds || 60);
        setStep('verify_otp');
      } catch (err: unknown) {
        setErrorMessage(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setErrorMessage('');
    setLoading(true);
    try {
      if (mode === 'email') {
        const res = await authApi.forgotPasswordEmail(email.trim().toLowerCase());
        setCooldown(res.cooldown_seconds || 60);
        setInfoMessage(res.message);
      } else {
        const res = await authApi.forgotPasswordPhone(formatNormalizedPhone(phone));
        setCooldown(res.cooldown_seconds || 60);
        setInfoMessage(res.message);
      }
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage(t('verification.invalidOtpLength', 'Please enter a valid 6-digit verification code.'));
      return;
    }

    setLoading(true);
    try {
      let res;
      if (mode === 'email') {
        res = await authApi.verifyRecoveryEmail(email.trim().toLowerCase(), cleanOtp);
      } else {
        res = await authApi.verifyRecoveryPhone(formatNormalizedPhone(phone), cleanOtp);
      }
      setResetToken(res.reset_token);
      setInfoMessage(t('auth.otpVerifiedSuccess', 'Code verified! Please create a strong new password.'));
      setStep('new_password');
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!passwordCriteria.allValid) {
      setErrorMessage(t('auth.passwordCriteriaUnmet', 'Please ensure all password criteria are satisfied.'));
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
    } catch (err: unknown) {
      setErrorMessage(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FC] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
      >
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-[#182849] to-[#2455E8] p-7 sm:p-8 text-white relative">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth.backToLogin', 'Back to Sign In')}
          </Link>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {t('auth.resetPasswordTitle', 'Reset Your Password')}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                {t('auth.resetPasswordSubtitle', 'Secure, automated OTP verification for your KaamSetu account.')}
              </p>
            </div>
          </div>

          {/* Progress Indicator Dots */}
          <div className="flex items-center gap-2 mt-6">
            {(['destination', 'verify_otp', 'new_password', 'success'] as RecoveryStep[]).map((st, idx) => {
              const stepIndex = ['destination', 'verify_otp', 'new_password', 'success'].indexOf(step);
              const isPast = idx < stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div
                  key={st}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? 'w-8 bg-amber-400'
                      : isPast
                      ? 'w-4 bg-emerald-400'
                      : 'w-2 bg-white/20'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Info / Generic Feedback Alert */}
          {infoMessage && step !== 'success' && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs sm:text-sm font-medium flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{infoMessage}</div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ─── STEP 1: DESTINATION FORM ────────────────────────────────────────── */}
            {step === 'destination' && (
              <motion.div
                key="step-destination"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Mode Selector Tabs */}
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('email');
                      setErrorMessage('');
                      setInfoMessage('');
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      mode === 'email'
                        ? 'bg-white text-[#182849] shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>{t('auth.emailMethodTab', 'Email Verification')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('phone');
                      setErrorMessage('');
                      setInfoMessage('');
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      mode === 'phone'
                        ? 'bg-white text-[#182849] shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    <span>{t('auth.phoneMethodTab', 'Mobile OTP')}</span>
                  </button>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  {mode === 'email' ? (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        {t('auth.emailLabel', 'Registered Email Address')}
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your.email@example.com"
                          required
                          className="input w-full pl-10 rounded-xl border-gray-200 text-sm font-medium focus:ring-primary-500"
                        />
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {t('auth.emailHint', 'We will send a 6-digit OTP code to verify account ownership.')}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        {t('auth.phoneLabel', 'Registered Mobile Number')}
                      </label>
                      <div className="flex gap-2">
                        <div className="flex items-center px-3.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-700">
                          +91
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="9876543210"
                          required
                          className="input flex-1 rounded-xl border-gray-200 text-sm font-medium focus:ring-primary-500"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {t('auth.phoneHint', 'Enter your 10-digit Indian mobile number.')}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || (mode === 'email' ? !email.trim() : phone.length < 10)}
                    className="btn btn-primary w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t('auth.sendingOtp', 'Sending Verification Code...')}</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>{t('auth.sendOtpBtn', 'Send Verification Code')}</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ─── STEP 2: VERIFY OTP FORM ─────────────────────────────────────────── */}
            {step === 'verify_otp' && (
              <motion.div
                key="step-verify"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                      {mode === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        {t('auth.codeDispatchedTo', 'Verification code sent to')}
                      </p>
                      <p className="text-sm font-bold text-gray-900 font-mono">
                        {maskedDestination}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('destination');
                      setOtpCode('');
                      setErrorMessage('');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {t('auth.changeDestination', 'Change')}
                  </button>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      {t('auth.otpCodeLabel', 'Enter 6-Digit Verification Code')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      autoFocus
                      required
                      className="input w-full text-center tracking-[0.4em] font-mono font-bold text-2xl py-3 rounded-xl border-gray-200 focus:ring-primary-500"
                    />
                    <p className="text-[11px] text-gray-400 text-center mt-1.5">
                      {t('auth.otpExpiryNotice', 'Code is valid for 10 minutes. Max 5 verification attempts.')}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="btn bg-emerald-600 hover:bg-emerald-700 text-white w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t('auth.verifyingOtp', 'Verifying Code...')}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>{t('auth.verifyOtpBtn', 'Verify Code & Proceed')}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Resend Cooldown Action */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={cooldown > 0 || loading}
                    className={`text-xs font-bold inline-flex items-center gap-1.5 ${
                      cooldown > 0 || loading
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-[#2455E8] hover:underline'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>
                      {cooldown > 0
                        ? t('auth.resendIn', 'Resend code in {{seconds}}s', { seconds: cooldown })
                        : t('auth.resendOtp', 'Resend Verification Code')}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 3: NEW PASSWORD FORM ───────────────────────────────────────── */}
            {step === 'new_password' && (
              <motion.div
                key="step-password"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      {t('auth.newPasswordLabel', 'New Password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="input w-full pl-10 pr-10 rounded-xl border-gray-200 text-sm font-medium focus:ring-primary-500"
                      />
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      {t('auth.confirmPasswordLabel', 'Confirm New Password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="input w-full pl-10 pr-10 rounded-xl border-gray-200 text-sm font-medium focus:ring-primary-500"
                      />
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Strength Checklist */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
                    <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      {t('auth.passwordRequirementsTitle', 'Password Security Checklist')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {[
                        { label: t('auth.pwdRequirementMin', 'At least 8 characters'), valid: passwordCriteria.hasMinLength },
                        { label: t('auth.pwdRequirementUpper', 'At least 1 uppercase letter'), valid: passwordCriteria.hasUpper },
                        { label: t('auth.pwdRequirementLower', 'At least 1 lowercase letter'), valid: passwordCriteria.hasLower },
                        { label: t('auth.pwdRequirementDigit', 'At least 1 number'), valid: passwordCriteria.hasDigit },
                        { label: t('auth.pwdRequirementSpecial', 'At least 1 special character'), valid: passwordCriteria.hasSpecial },
                        { label: t('auth.pwdRequirementMatch', 'Passwords match exactly'), valid: passwordCriteria.isMatching },
                      ].map((crit, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 ${
                            crit.valid ? 'text-emerald-700 font-medium' : 'text-gray-400'
                          }`}
                        >
                          {crit.valid ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0" />
                          )}
                          <span>{crit.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !passwordCriteria.allValid}
                    className="btn btn-primary w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t('auth.updatingPassword', 'Updating Password...')}</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        <span>{t('auth.setNewPasswordBtn', 'Update Password & Sign In')}</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ─── STEP 4: SUCCESS CONFIRMATION ────────────────────────────────────── */}
            {step === 'success' && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4 text-center space-y-5"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {t('auth.resetSuccessTitle', 'Password Reset Successfully!')}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                    {t(
                      'auth.resetSuccessDesc',
                      'Your password has been securely updated. All previous active sessions have been signed out for security.'
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  {t('auth.autoRedirectIn', 'Redirecting to login in {{seconds}} seconds...', {
                    seconds: redirectSeconds,
                  })}
                </div>

                <Link
                  to="/login"
                  className="btn btn-primary w-full py-3.5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t('auth.signInNow', 'Sign In with New Password')}</span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── SUPPORT FALLBACK FOOTER ────────────────────────────────────────────── */}
          <div className="pt-4 border-t border-gray-100">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-blue-50/40 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                    {t('auth.needSupportTitle', 'Need manual recovery assistance?')}
                  </span>
                  <p className="text-xs text-gray-600">
                    {t('auth.needSupportDesc', 'Lost access to both registered email and phone? Our support team can help.')}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-mono text-xs font-semibold text-gray-900">{supportEmail}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleCopySupport}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 flex items-center gap-1.5 transition-colors shadow-2xs"
                    title={t('common.copy', 'Copy email')}
                  >
                    {copiedSupport ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">{t('common.copied', 'Copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-400" />
                        <span>{t('common.copy', 'Copy')}</span>
                      </>
                    )}
                  </button>

                  <a
                    href={mailtoLink}
                    className="btn btn-secondary py-1.5 px-3 text-xs font-bold rounded-xl flex items-center gap-1 shadow-2xs"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{t('auth.emailSupport', 'Email Support')}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
