import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield, User, Mail, Phone, Building2, Lock, Eye, EyeOff,
  CheckCircle2, AlertCircle, AlertTriangle, ArrowRight, Loader2,
  Calendar, Clock, Check, X
} from 'lucide-react';
import { adminApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../../components/common/LoadingScreen';
import type { AdminProfileUpdatePayload, AdminChangePasswordPayload } from '../../types';

export default function AdminProfilePage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ─── Profile State ────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // ─── Password State ───────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // ─── Query Profile Data ───────────────────────────────────────────────────
  const { data: profile, isLoading, isError, error: fetchError, refetch } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: () => adminApi.getProfile(),
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setDepartment(profile.department || '');
    }
  }, [profile]);

  const isProfileDirty = Boolean(
    profile && (
      fullName.trim() !== (profile.full_name || '') ||
      phone.trim() !== (profile.phone || '') ||
      department.trim() !== (profile.department || '')
    )
  );

  // ─── Update Profile Mutation ──────────────────────────────────────────────
  const updateProfileMutation = useMutation({
    mutationFn: (payload: AdminProfileUpdatePayload) => adminApi.updateProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin-profile'], updated);
      setProfileSuccessMsg(t('admin.profileSavedSuccess', 'Admin profile updated successfully.'));
      setProfileErrorMsg('');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    },
    onError: (err: unknown) => {
      setProfileErrorMsg(extractErrorMessage(err));
      setProfileSuccessMsg('');
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg('');
    setProfileSuccessMsg('');

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setProfileErrorMsg(t('admin.fullNameRequired', 'Full name is required (minimum 2 characters).'));
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !/^[\+0-9\s\-\(\)]+$/.test(trimmedPhone)) {
      setProfileErrorMsg(t('admin.invalidPhone', 'Please enter a valid phone number format.'));
      return;
    }

    updateProfileMutation.mutate({
      full_name: trimmedName,
      phone: trimmedPhone || null,
      department: department.trim() || null,
    });
  };

  // ─── Password Rules Evaluation ────────────────────────────────────────────
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isDifferentFromCurrent = currentPassword.length > 0 && newPassword.length > 0 && currentPassword !== newPassword;
  const isPasswordFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasUppercase &&
    hasDigit &&
    passwordsMatch &&
    isDifferentFromCurrent;

  // ─── Change Password Mutation ─────────────────────────────────────────────
  const changePasswordMutation = useMutation({
    mutationFn: (payload: AdminChangePasswordPayload) => adminApi.changePassword(payload),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordErrorMsg('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCountdown(3);
    },
    onError: (err: unknown) => {
      setPasswordErrorMsg(extractErrorMessage(err));
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg('');

    if (!currentPassword) {
      setPasswordErrorMsg(t('admin.currentPasswordRequired', 'Current password is required.'));
      return;
    }
    if (!hasMinLength || !hasUppercase || !hasDigit) {
      setPasswordErrorMsg(t('admin.passwordComplexityNote', 'Password must be at least 8 characters with 1 uppercase letter and 1 digit.'));
      return;
    }
    if (!passwordsMatch) {
      setPasswordErrorMsg(t('admin.passwordsMustMatch', 'New password and confirmation do not match.'));
      return;
    }
    if (!isDifferentFromCurrent) {
      setPasswordErrorMsg(t('admin.passwordMustBeDifferent', 'New password must be different from current password.'));
      return;
    }

    changePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  // ─── Auto-Logout Countdown on Password Success ────────────────────────────
  useEffect(() => {
    if (!passwordSuccess) return;

    if (countdown <= 0) {
      logout();
      navigate('/login', { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [passwordSuccess, countdown, logout, navigate]);

  const handleImmediateLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Keyboard shortcut (Escape or Enter) to trigger immediate sign in again when modal is open
  useEffect(() => {
    if (!passwordSuccess) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleImmediateLogout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [passwordSuccess]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="alert-error flex items-start gap-3 p-6 rounded-2xl shadow-sm">
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-red-900">Failed to load admin profile</h3>
            <p className="text-red-700 text-sm mt-1">{extractErrorMessage(fetchError)}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 btn bg-white text-red-700 border border-red-300 hover:bg-red-50 text-xs px-4 py-2"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900">
                {t('admin.profileTitle', 'Admin Profile')}
              </h1>
              <p className="text-sm text-gray-500">
                {t('admin.profileSubtitle', 'Manage your administrator identity, contact information, and account security settings.')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 shadow-xs">
            <Shield className="w-3.5 h-3.5" />
            {t('admin.adminBadge', 'System Administrator')}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('admin.activeStatus', 'Active Account')}
          </span>
        </div>
      </div>

      {/* ── Main Content Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Profile Information Card (Left) ────────────────────────────────── */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 md:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              {t('admin.profileDetailsTitle', 'Administrator Profile')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('admin.profileDetailsDesc', 'Your primary administrator contact details and operational department.')}
            </p>
          </div>

          {profileSuccessMsg && (
            <div className="alert-success flex items-center gap-2" role="alert" aria-live="polite">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {profileErrorMsg && (
            <div className="alert-error flex items-center gap-2" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{profileErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-5" noValidate>
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('admin.fullName', 'Full Name')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="full_name"
                  type="text"
                  required
                  aria-required="true"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('admin.fullNamePlaceholder', 'Enter your full name')}
                  className="input pl-10"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                  {t('admin.email', 'Email Address')}
                </label>
                <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3" />
                  {t('admin.systemManaged', 'System Managed')}
                </span>
              </div>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  disabled
                  readOnly
                  value={profile?.email || ''}
                  className="input pl-10 bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Role (Read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="role" className="block text-sm font-semibold text-gray-700">
                  {t('admin.role', 'System Role')}
                </label>
                <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3" />
                  {t('admin.systemManaged', 'System Managed')}
                </span>
              </div>
              <div className="relative">
                <input
                  id="role"
                  type="text"
                  disabled
                  readOnly
                  value={profile?.role || 'ADMIN'}
                  className="input pl-10 bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200 font-mono font-medium"
                />
                <Shield className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('admin.phone', 'Phone Number')}
              </label>
              <div className="relative">
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('admin.phonePlaceholder', '+91 98765 43210')}
                  className="input pl-10"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Department */}
            <div>
              <label htmlFor="department" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('admin.department', 'Department / Unit')}
              </label>
              <div className="relative">
                <input
                  id="department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder={t('admin.departmentPlaceholder', 'e.g. Trust & Safety, Platform Operations')}
                  className="input pl-10"
                />
                <Building2 className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Account Metadata */}
            <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>
                  {t('admin.memberSince', 'Admin Since')}: <strong className="text-gray-700">{formatDate(profile?.created_at)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>
                  {t('admin.lastUpdated', 'Last Updated')}: <strong className="text-gray-700">{formatDate(profile?.updated_at)}</strong>
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!isProfileDirty || updateProfileMutation.isPending}
                className="btn-primary min-w-[140px]"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('admin.savingProfile', 'Saving Changes...')}
                  </>
                ) : (
                  t('admin.saveProfile', 'Save Changes')
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Security & Change Password Card (Right) ─────────────────────────── */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 md:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary-600" />
              {t('admin.securityTitle', 'Security & Password')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('admin.securitySubtitle', 'Change your admin password. Updating credentials invalidates all active sessions.')}
            </p>
          </div>

          {/* Token Revocation Notice */}
          <div className="alert-warning flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="block font-semibold mb-0.5">
                {t('admin.tokenRevocationWarningTitle', 'Important Security Notice')}
              </strong>
              {t('admin.tokenRevocationWarning', 'Changing your password will immediately invalidate all active access tokens. You will be logged out and must sign in again.')}
            </div>
          </div>

          {passwordErrorMsg && (
            <div className="alert-error flex items-center gap-2" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{passwordErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
            {/* Current Password */}
            <div>
              <label htmlFor="current_password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('admin.currentPassword', 'Current Password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="current_password"
                  type={showCurrent ? 'text' : 'password'}
                  required
                  aria-required="true"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('admin.currentPasswordPlaceholder', 'Enter current password')}
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="new_password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('admin.newPassword', 'New Password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="new_password"
                  type={showNew ? 'text' : 'password'}
                  required
                  aria-required="true"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('admin.newPasswordPlaceholder', 'Enter new password (min. 8 characters)')}
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('admin.confirmPassword', 'Confirm New Password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  aria-required="true"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('admin.confirmPasswordPlaceholder', 'Re-enter new password')}
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Password Strength Checklist */}
            <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-xs text-gray-600 border border-gray-100">
              <div className="font-semibold text-gray-700 mb-1">Password Requirements:</div>
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                <span>{t('admin.ruleMinLength', 'At least 8 characters')}</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                {hasUppercase ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                <span>{t('admin.ruleUppercase', 'At least one uppercase letter (A-Z)')}</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasDigit ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                {hasDigit ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                <span>{t('admin.ruleDigit', 'At least one number (0-9)')}</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                {passwordsMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                <span>{t('admin.ruleMatch', 'Passwords match')}</span>
              </div>
              <div className={`flex items-center gap-1.5 ${isDifferentFromCurrent ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                {isDifferentFromCurrent ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                <span>{t('admin.ruleDistinct', 'Different from current password')}</span>
              </div>
            </div>

            {/* Change Password Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isPasswordFormValid || changePasswordMutation.isPending}
                className="w-full btn-danger"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('admin.updatingPassword', 'Changing Password...')}
                  </>
                ) : (
                  t('admin.updatePassword', 'Change Password')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Post-Password Invalidation Success Modal ─────────────────────────── */}
      {passwordSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 md:p-8 text-center space-y-5 shadow-2xl border border-gray-100">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 id="success-modal-title" className="text-xl font-bold text-gray-900">
                {t('admin.passwordChangedTitle', 'Password Changed Successfully')}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {t('admin.passwordChangedNotice', 'Your password has been updated and all active sessions have been revoked. Please sign in again with your new credentials.')}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-medium">
              {t('admin.redirectingCountdown', {
                count: countdown,
                defaultValue: `Redirecting to login in ${countdown} seconds...`,
              })}
            </div>

            <button
              onClick={handleImmediateLogout}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              <span>{t('admin.signInAgain', 'Sign In Again')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
