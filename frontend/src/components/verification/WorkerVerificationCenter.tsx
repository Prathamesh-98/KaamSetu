// KaamSetu — Worker Trust and Verification Center
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, ShieldCheck, Phone, FileText, Award, Clock, AlertCircle, CheckCircle2,
  UploadCloud, RefreshCw, Eye, ArrowRight, X, Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { verificationsApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import type { WorkerProfile, VerificationRecord } from '../../types';
import { VerificationStatusBadge } from './TrustBadges';
import { SecureDocumentViewerModal } from './SecureDocumentViewerModal';

interface WorkerVerificationCenterProps {
  profile: WorkerProfile;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const WorkerVerificationCenter: React.FC<WorkerVerificationCenterProps> = ({ profile }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Queries
  const { data: statusSummary, isLoading: isStatusLoading } = useQuery({
    queryKey: ['worker-verification-status'],
    queryFn: verificationsApi.getMyStatus,
  });

  const { data: history = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['worker-verification-history'],
    queryFn: verificationsApi.getMyHistory,
  });

  // Active section tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'phone' | 'identity' | 'skills' | 'history'>('overview');

  // Document modal viewer state
  const [viewingRecord, setViewingRecord] = useState<VerificationRecord | null>(null);

  // ── Phone OTP State ──────────────────────────────────────────────────────────
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');

  // ── Identity Form State ──────────────────────────────────────────────────────
  const [idDocType, setIdDocType] = useState('DRIVING_LICENSE');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idNotes, setIdNotes] = useState('');
  const [idError, setIdError] = useState('');

  // ── Skill Form State ────────────────────────────────────────────────────────
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [certTitle, setCertTitle] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [skillFile, setSkillFile] = useState<File | null>(null);
  const [skillNotes, setSkillNotes] = useState('');
  const [skillError, setSkillError] = useState('');

  // Initialize phone number from verified status or profile
  useEffect(() => {
    if (!phoneNumber) {
      const existing = statusSummary?.phone || (profile as any)?.phone || (profile as any)?.user?.phone || '';
      if (existing) {
        setPhoneNumber(existing.replace(/^\+91/, ''));
      }
    }
  }, [statusSummary?.phone, profile]);

  // OTP Countdown Timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Mutations
  const requestOtpMutation = useMutation({
    mutationFn: (phone: string) => verificationsApi.requestPhoneOtp(phone),
    onSuccess: (data) => {
      setOtpSent(true);
      setCountdown(60);
      setPhoneError('');
      setPhoneSuccess(data.message || t('verification.otpSentSuccess', 'OTP sent to your phone!'));
      toast.success(t('verification.otpSentSuccess', 'OTP sent successfully!'));
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setPhoneError(msg);
      toast.error(msg);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      verificationsApi.verifyPhoneOtp(phone, code),
    onSuccess: (data) => {
      setPhoneSuccess(data.message || t('verification.phoneVerifiedSuccess', 'Phone verified!'));
      setPhoneError('');
      setOtpCode('');
      setOtpSent(false);
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-status'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-history'] });
      toast.success(t('verification.phoneVerifiedSuccess', 'Phone number verified!'));
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setPhoneError(msg);
      toast.error(msg);
    },
  });

  const submitIdentityMutation = useMutation({
    mutationFn: ({ file, type, notes }: { file: File; type: string; notes?: string }) =>
      verificationsApi.submitIdentity(file, type, notes),
    onSuccess: () => {
      setIdFile(null);
      setIdNotes('');
      setIdError('');
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-status'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-history'] });
      toast.success(t('verification.idSubmittedSuccess', 'Identity document submitted for review!'));
      setActiveTab('overview');
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setIdError(msg);
      toast.error(msg);
    },
  });

  const submitSkillMutation = useMutation({
    mutationFn: ({
      file,
      skillId,
      title,
      authority,
      notes,
    }: {
      file: File;
      skillId: string;
      title: string;
      authority?: string;
      notes?: string;
    }) => verificationsApi.submitSkillCertificate(file, skillId, title, authority, notes),
    onSuccess: () => {
      setIsSkillModalOpen(false);
      setSelectedSkillId('');
      setCertTitle('');
      setIssuingAuthority('');
      setSkillFile(null);
      setSkillNotes('');
      setSkillError('');
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-status'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-history'] });
      toast.success(t('verification.skillSubmittedSuccess', 'Skill certificate submitted for review!'));
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setSkillError(msg);
      toast.error(msg);
    },
  });

  // Handlers
  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');
    let cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (!cleaned.startsWith('+91') && cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    }
    if (!/^\+?[0-9]{10,14}$/.test(cleaned)) {
      setPhoneError(t('verification.invalidPhoneFormat', 'Enter a valid 10-digit mobile number.'));
      return;
    }
    requestOtpMutation.mutate(cleaned);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    if (!otpCode || otpCode.trim().length !== 6) {
      setPhoneError(t('verification.invalidOtpLength', 'Please enter a valid 6-digit verification code.'));
      return;
    }
    let cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (!cleaned.startsWith('+91') && cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    }
    verifyOtpMutation.mutate({ phone: cleaned, code: otpCode.trim() });
  };

  const handleIdFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setIdError(t('verification.fileTooLarge', 'File size exceeds 5MB limit.'));
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setIdError(t('verification.unsupportedFormat', 'Please upload a PDF, JPEG, PNG, or WebP document.'));
      return;
    }
    setIdError('');
    setIdFile(file);
  };

  const handleSubmitIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idFile) {
      setIdError(t('verification.selectFileRequired', 'Please choose a document file to upload.'));
      return;
    }
    submitIdentityMutation.mutate({
      file: idFile,
      type: idDocType,
      notes: idNotes,
    });
  };

  const handleSkillFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSkillError(t('verification.fileTooLarge', 'File size exceeds 5MB limit.'));
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setSkillError(t('verification.unsupportedFormat', 'Please upload a PDF, JPEG, PNG, or WebP document.'));
      return;
    }
    setSkillError('');
    setSkillFile(file);
  };

  const handleSubmitSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkillId) {
      setSkillError(t('verification.selectSkillRequired', 'Please select a skill from your profile.'));
      return;
    }
    if (!certTitle.trim()) {
      setSkillError(t('verification.certTitleRequired', 'Please enter the certificate title.'));
      return;
    }
    if (!skillFile) {
      setSkillError(t('verification.selectFileRequired', 'Please choose a certificate document to upload.'));
      return;
    }
    submitSkillMutation.mutate({
      file: skillFile,
      skillId: selectedSkillId,
      title: certTitle.trim(),
      authority: issuingAuthority.trim(),
      notes: skillNotes.trim(),
    });
  };

  // Status values
  const phoneStatus = statusSummary?.phone_status || (profile.is_phone_verified ? 'VERIFIED' : 'NOT_SUBMITTED');
  const identityStatus = statusSummary?.identity_status || (profile.is_identity_verified ? 'VERIFIED' : 'NOT_SUBMITTED');
  const workerSkills = profile.skills || [];
  const latestIdentityRecord = history.find((r) => r.verification_type === 'IDENTITY');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-[#182849] to-[#243B6B] text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-300" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                {t('verification.badgeVerifiedProfile', 'Trust & Verification Center')}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              {t('verification.workerCenterTitle', 'Verify Your Profile & Build Employer Trust')}
            </h2>
            <p className="text-sm text-gray-200 max-w-xl font-medium">
              {t(
                'verification.workerCenterSubtitle',
                'Verified workers receive 3x more job invitations and rank higher in employer candidate searches.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-300 font-medium">{t('verification.overallStatus', 'Profile Status')}</p>
                <p className="text-sm font-bold text-white">
                  {statusSummary?.is_verified
                    ? t('verification.status.verified', 'Verified')
                    : identityStatus === 'PENDING'
                    ? t('verification.status.pending', 'Under Review')
                    : t('verification.status.actionRequired', 'Pending Actions')}
                </p>
              </div>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  statusSummary?.is_verified ? 'bg-emerald-500 text-white' : 'bg-white/20 text-gray-200'
                }`}
              >
                {statusSummary?.is_verified ? <ShieldCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-8 pt-6 border-t border-white/10 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: t('verification.tabs.overview', 'Overview'), icon: Shield },
            { id: 'phone', label: t('verification.tabs.phone', 'Phone OTP'), icon: Phone },
            { id: 'identity', label: t('verification.tabs.identity', 'Government ID'), icon: FileText },
            { id: 'skills', label: t('verification.tabs.skills', 'Skill Certificates'), icon: Award },
            { id: 'history', label: t('verification.tabs.history', 'Audit History'), icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-[#182849] shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="p-6 sm:p-8">
        {/* ── 1. Overview Tab ───────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-6">
              {/* Phone Status Card */}
              <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white transition-all shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                    <Phone className="w-6 h-6" />
                  </div>
                  <VerificationStatusBadge status={phoneStatus} />
                </div>
                <h4 className="font-bold text-[#182849] text-base mb-1">{t('verification.phoneVerification', 'Phone Number')}</h4>
                <p className="text-xs text-gray-500 font-medium mb-4">
                  {phoneStatus === 'VERIFIED'
                    ? t('verification.phoneVerifiedDesc', 'Your mobile number is verified for shift notifications.')
                    : t('verification.phoneUnverifiedDesc', 'Verify your mobile via instant 6-digit OTP code.')}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('phone')}
                  className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 group"
                >
                  <span>{phoneStatus === 'VERIFIED' ? t('verification.viewStatus', 'View Status') : t('verification.verifyNow', 'Verify Phone')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Identity Status Card */}
              <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white transition-all shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <VerificationStatusBadge status={identityStatus} />
                </div>
                <h4 className="font-bold text-[#182849] text-base mb-1">{t('verification.identityVerification', 'Government ID')}</h4>
                <p className="text-xs text-gray-500 font-medium mb-4">
                  {identityStatus === 'VERIFIED'
                    ? t('verification.idVerifiedDesc', 'Official government ID authenticated by administrators.')
                    : identityStatus === 'PENDING'
                    ? t('verification.idPendingDesc', 'Document submitted and currently under review.')
                    : t('verification.idUnverifiedDesc', 'Submit Driving License, Voter ID, Passport, or Trade License.')}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('identity')}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group"
                >
                  <span>
                    {identityStatus === 'REJECTED'
                      ? t('verification.resubmit', 'Resubmit Document')
                      : identityStatus === 'VERIFIED'
                      ? t('verification.viewStatus', 'View Status')
                      : t('verification.submitEvidence', 'Submit ID Document')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Skills Status Card */}
              <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white transition-all shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                    <Award className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                    {workerSkills.length} {t('verification.skillsAdded', 'Skills')}
                  </span>
                </div>
                <h4 className="font-bold text-[#182849] text-base mb-1">{t('verification.skillCertificates', 'Skill Certificates')}</h4>
                <p className="text-xs text-gray-500 font-medium mb-4">
                  {t('verification.skillsDesc', 'Upload ITI, trade, or vocational diplomas to earn verified skill badges.')}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('skills')}
                  className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 group"
                >
                  <span>{t('verification.manageCertificates', 'Manage Certificates')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Rejection Alert Banner if applicable */}
            {identityStatus === 'REJECTED' && latestIdentityRecord && (
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <h4 className="font-bold text-sm text-rose-900">{t('verification.idRejectedTitle', 'Government ID Action Required')}</h4>
                  <p className="text-xs text-rose-800">
                    <span className="font-semibold">{t('verification.reason', 'Reason')}: </span>
                    {latestIdentityRecord.rejection_reason || t('verification.blurryDocReason', 'Document unreadable or invalid.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('identity')}
                    className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>{t('verification.resubmitNow', 'Upload Clear Document')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. Phone OTP Tab ──────────────────────────────────────────────── */}
        {activeTab === 'phone' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-[#182849]">{t('verification.phoneHeader', 'Phone Number Verification')}</h3>
              <p className="text-xs text-gray-500 font-medium">
                {t('verification.phoneSubtext', 'We verify mobile numbers via SMS OTP to safeguard shifts and payments.')}
              </p>
            </div>

            {phoneStatus === 'VERIFIED' ? (
              <div className="p-8 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-emerald-900">{t('verification.phoneAlreadyVerified', 'Phone Number Verified')}</h4>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100/80 text-emerald-800 text-sm font-mono font-bold">
                  <span>{statusSummary?.phone || (profile as any)?.phone || (profile as any)?.user?.phone || phoneNumber}</span>
                </div>
                <p className="text-xs text-emerald-700 font-medium">
                  {t('verification.phoneSecuredNote', 'Your account is linked and verified for shift notifications.')}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50/60 p-6 sm:p-8 rounded-2xl border border-gray-200 space-y-6">
                {phoneError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{phoneError}</span>
                  </div>
                )}

                {phoneSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{phoneSuccess}</span>
                  </div>
                )}

                {/* Step 1: Request OTP */}
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t('verification.enterMobile', 'Mobile Number (10 Digits)')}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-xl text-sm font-bold text-gray-600">
                      +91
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={14}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="9876543210"
                      disabled={requestOtpMutation.isPending || countdown > 0}
                      className="input flex-1 rounded-xl bg-white border-gray-200 focus:ring-primary-500 font-medium text-sm"
                      required
                    />
                    <button
                      type="submit"
                      disabled={requestOtpMutation.isPending || countdown > 0 || !phoneNumber.trim()}
                      className="btn btn-primary rounded-xl px-5 text-xs font-bold shadow-sm whitespace-nowrap"
                    >
                      {requestOtpMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : countdown > 0 ? (
                        `${countdown}s`
                      ) : otpSent ? (
                        t('verification.resendOtp', 'Resend OTP')
                      ) : (
                        t('verification.sendOtp', 'Send OTP')
                      )}
                    </button>
                  </div>
                </form>

                {/* Step 2: Verify OTP */}
                {otpSent && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4 pt-4 border-t border-gray-200">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('verification.enterOtpCode', 'Enter 6-Digit OTP')}
                      </label>
                      <p className="text-xs text-gray-500">
                        {t('verification.otpSentInstructions', 'Enter the 6-digit verification code sent to your mobile.')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="input flex-1 rounded-xl bg-white border-gray-200 focus:ring-primary-500 font-mono tracking-widest text-center text-lg font-bold"
                        required
                      />
                      <button
                        type="submit"
                        disabled={verifyOtpMutation.isPending || otpCode.length < 4}
                        className="btn bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 text-xs font-bold shadow-sm"
                      >
                        {verifyOtpMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          t('verification.confirmCode', 'Verify Code')
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 3. Government Identity Tab ────────────────────────────────────── */}
        {activeTab === 'identity' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-[#182849]">{t('verification.idSectionTitle', 'Government Identity Verification')}</h3>
                <p className="text-xs text-gray-500 font-medium">
                  {t('verification.idSectionDesc', 'Secure, private verification. Documents are accessible solely to authorized reviewers.')}
                </p>
              </div>
              <VerificationStatusBadge status={identityStatus} size="lg" />
            </div>

            {identityStatus === 'VERIFIED' && (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-4">
                <ShieldCheck className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-900">{t('verification.idFullyVerifiedTitle', 'Identity Officially Verified')}</h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    {t('verification.idFullyVerifiedDesc', 'Your government document was reviewed and approved. A verified trust badge appears on your profile.')}
                  </p>
                </div>
              </div>
            )}

            {identityStatus === 'PENDING' && (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-4">
                <Clock className="w-8 h-8 text-amber-600 animate-pulse flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-900">{t('verification.idPendingTitle', 'Under Review by KaamSetu Team')}</h4>
                  <p className="text-xs text-amber-700 font-medium">
                    {t('verification.idPendingWaitDesc', 'Your document has been submitted securely and is being reviewed. Reviews typically take 2-6 hours.')}
                  </p>
                </div>
              </div>
            )}

            {/* Submission Form (shown if NOT_SUBMITTED, REJECTED, or EXPIRED) */}
            {(identityStatus === 'NOT_SUBMITTED' || identityStatus === 'REJECTED' || identityStatus === 'EXPIRED') && (
              <form onSubmit={handleSubmitIdentity} className="space-y-6 bg-gray-50/70 p-6 sm:p-8 rounded-2xl border border-gray-200">
                {idError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{idError}</span>
                  </div>
                )}

                {identityStatus === 'REJECTED' && latestIdentityRecord?.rejection_reason && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                    <span className="font-bold">{t('verification.previousRejectionReason', 'Previous Review Feedback')}:</span>
                    <p>{latestIdentityRecord.rejection_reason}</p>
                  </div>
                )}

                {/* Document Type Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t('verification.selectDocType', 'Select Document Type *')}
                  </label>
                  <select
                    value={idDocType}
                    onChange={(e) => setIdDocType(e.target.value)}
                    className="input w-full rounded-xl bg-white border-gray-200 font-medium text-sm"
                    required
                  >
                    <option value="DRIVING_LICENSE">{t('verification.docDrivingLicense', 'Driving License')}</option>
                    <option value="VOTER_ID">{t('verification.docVoterId', 'Voter ID Card')}</option>
                    <option value="PASSPORT">{t('verification.docPassport', 'Indian Passport')}</option>
                    <option value="TRADE_LICENSE">{t('verification.docTradeLicense', 'Trade / Labor Registration Card')}</option>
                  </select>
                </div>

                {/* File Upload Zone */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t('verification.uploadDocFile', 'Upload Document File (PDF, JPEG, PNG, WebP — Max 5MB) *')}
                  </label>
                  <div className="border-2 border-dashed border-gray-300 hover:border-primary-400 transition-colors rounded-2xl p-6 text-center bg-white cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleIdFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        {idFile ? idFile.name : t('verification.dragOrBrowse', 'Click to choose or drag document here')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {idFile ? `${(idFile.size / 1024 / 1024).toFixed(2)} MB` : t('verification.formatHelp', 'Clear, unblurred photo or scan with name and date of birth visible.')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t('verification.additionalNotes', 'Additional Notes (Optional)')}
                  </label>
                  <textarea
                    rows={2}
                    value={idNotes}
                    onChange={(e) => setIdNotes(e.target.value)}
                    placeholder={t('verification.notesPlaceholder', 'e.g. Renewed card issued in Maharashtra...')}
                    className="input w-full rounded-xl bg-white border-gray-200 text-sm resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitIdentityMutation.isPending || !idFile}
                  className="btn btn-primary w-full rounded-xl py-3 text-sm font-bold shadow-md flex items-center justify-center gap-2"
                >
                  {submitIdentityMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('verification.submittingDoc', 'Encrypting & Submitting...')}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t('verification.submitForReview', 'Submit for Admin Review')}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── 4. Skill Certificates Tab ────────────────────────────────────── */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-[#182849]">{t('verification.skillCertTitle', 'Skill Trade Certificates')}</h3>
                <p className="text-xs text-gray-500 font-medium">
                  {t('verification.skillCertSubtext', 'Submit certificates for skills already added to your worker profile.')}
                </p>
              </div>
              {workerSkills.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSkillModalOpen(true)}
                  className="btn btn-primary rounded-xl text-xs font-bold px-4 py-2 shadow-sm flex items-center gap-2 self-start"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{t('verification.submitNewCertificate', 'Submit Skill Certificate')}</span>
                </button>
              )}
            </div>

            {workerSkills.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <Award className="w-12 h-12 text-gray-300 mx-auto" />
                <h4 className="font-bold text-gray-700">{t('verification.noSkillsYet', 'No Skills on Profile Yet')}</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  {t('verification.addSkillsFirstPrompt', 'Add your trade skills (e.g. Electrician, Mason, Plumber) to your profile above first before submitting certificates.')}
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workerSkills.map((ws) => {
                  const skillItem = ws.skill;
                  const skillStat = statusSummary?.skills_status?.find((s) => s.skill_id === skillItem.id);
                  const st = skillStat?.status || 'NOT_SUBMITTED';

                  return (
                    <div
                      key={ws.id}
                      className="p-5 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 transition-all shadow-sm flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-[#182849] text-base">{skillItem.name}</h4>
                          <VerificationStatusBadge status={st} size="sm" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                          {ws.proficiency_level} • {ws.years_experience} {t('worker.years', 'years')}
                        </p>
                        {skillStat?.certificate_title && (
                          <p className="text-xs text-purple-700 font-semibold bg-purple-50 px-2.5 py-1 rounded-lg">
                            📜 {skillStat.certificate_title}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-end">
                        {st !== 'VERIFIED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSkillId(skillItem.id);
                              setCertTitle(`${skillItem.name} Certificate`);
                              setIsSkillModalOpen(true);
                            }}
                            className="text-xs font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                          >
                            <span>{st === 'REJECTED' ? t('verification.resubmit', 'Resubmit') : t('verification.uploadCertificate', 'Upload Certificate')}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 5. Audit History Tab ─────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-[#182849]">{t('verification.auditHistoryTitle', 'Complete Verification Audit Log')}</h3>
              <span className="text-xs font-semibold text-gray-500">
                {history.length} {t('verification.records', 'records found')}
              </span>
            </div>

            {history.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-2xl text-gray-400 text-sm font-medium">
                {t('verification.noHistoryYet', 'No verification submissions yet.')}
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 sm:p-5 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50/50 transition-colors shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          {record.verification_type}
                        </span>
                        <span>•</span>
                        <span className="text-sm font-bold text-[#182849]">
                          {record.document_type || record.metadata?.certificate_title || record.verification_type}
                        </span>
                        <VerificationStatusBadge status={record.status} size="sm" />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t('verification.submittedOn', 'Submitted')}: {new Date(record.created_at).toLocaleDateString()}
                        {record.verified_at && ` • ${t('verification.reviewedOn', 'Reviewed')}: ${new Date(record.verified_at).toLocaleDateString()}`}
                        {record.expires_at && ` • ${t('verification.expiresOn', 'Expires')}: ${new Date(record.expires_at).toLocaleDateString()}`}
                      </p>
                      {record.rejection_reason && (
                        <p className="text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 mt-1 font-medium">
                          ⚠️ {record.rejection_reason}
                        </p>
                      )}
                    </div>

                    {record.has_document && (
                      <button
                        type="button"
                        onClick={() => setViewingRecord(record)}
                        className="btn btn-outline text-xs px-3.5 py-1.5 rounded-xl border-gray-200 font-bold flex items-center gap-1.5 self-start sm:self-auto hover:bg-white"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('verification.viewDocument', 'View Document')}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Skill Certificate Upload Modal ──────────────────────────────────── */}
      {isSkillModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-base font-bold text-[#182849] flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" />
                <span>{t('verification.uploadSkillCertModal', 'Upload Skill Certificate')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSkillModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSkill} className="p-6 space-y-4">
              {skillError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {skillError}
                </div>
              )}

              {/* Skill Selection (Strictly filtered to Profile Skills) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.selectSkillLabel', 'Select Skill on Your Profile *')}
                </label>
                <select
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 font-medium text-sm"
                  required
                >
                  <option value="">{t('verification.chooseSkillPlaceholder', '-- Select from your skills --')}</option>
                  {workerSkills.map((ws) => (
                    <option key={ws.skill.id} value={ws.skill.id}>
                      {ws.skill.name} ({ws.proficiency_level})
                    </option>
                  ))}
                </select>
              </div>

              {/* Certificate Title */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.certTitleLabel', 'Certificate / Diploma Title *')}
                </label>
                <input
                  type="text"
                  value={certTitle}
                  onChange={(e) => setCertTitle(e.target.value)}
                  placeholder="e.g. National Trade Certificate - Electrician"
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 text-sm font-medium"
                  required
                />
              </div>

              {/* Issuing Authority */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.issuingAuthorityLabel', 'Issuing Authority / Institution')}
                </label>
                <input
                  type="text"
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  placeholder="e.g. ITI Pune / NSDC / Govt of Maharashtra"
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 text-sm font-medium"
                />
              </div>

              {/* File Attachment */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.certFileLabel', 'Certificate File (PDF or Image, max 5MB) *')}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleSkillFileSelect}
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 text-xs py-2"
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.notesLabel', 'Notes (Optional)')}
                </label>
                <textarea
                  rows={2}
                  value={skillNotes}
                  onChange={(e) => setSkillNotes(e.target.value)}
                  placeholder={t('verification.skillNotesPlaceholder', 'Any extra details for the reviewer...')}
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 text-sm resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsSkillModalOpen(false)}
                  className="btn btn-outline text-xs px-4 py-2 rounded-xl font-bold"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitSkillMutation.isPending || !skillFile || !selectedSkillId}
                  className="btn btn-primary text-xs px-6 py-2 rounded-xl font-bold shadow-sm"
                >
                  {submitSkillMutation.isPending ? t('verification.submitting', 'Submitting...') : t('verification.submitCertificate', 'Submit Certificate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Secure Document Viewer Modal ────────────────────────────────────── */}
      {viewingRecord && (
        <SecureDocumentViewerModal
          recordId={viewingRecord.id}
          documentType={viewingRecord.document_type || viewingRecord.verification_type}
          fileName={viewingRecord.metadata?.submitted_filename}
          onClose={() => setViewingRecord(null)}
        />
      )}
    </div>
  );
};
