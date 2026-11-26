// KaamSetu — Mobile Worker Trust & Verification Center
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, ShieldCheck, Phone, FileText, Award, Clock, AlertCircle, CheckCircle2,
  UploadCloud, RefreshCw, Eye, ArrowLeft, X, Info, ChevronRight, Check, AlertTriangle, FileCheck
} from 'lucide-react';
import { verificationsApi, workerApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import type { WorkerProfile, VerificationRecord } from '../../types';

interface MobileWorkerVerificationCenterProps {
  profile?: WorkerProfile;
  onClose?: () => void;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const MobileWorkerVerificationCenter: React.FC<MobileWorkerVerificationCenterProps> = ({ profile: initialProfile, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Active section tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'phone' | 'identity' | 'skills' | 'history'>('overview');

  // Queries
  const { data: profileData } = useQuery({
    queryKey: ['worker-profile'],
    queryFn: workerApi.getMyProfile,
    initialData: initialProfile,
  });

  const profile = profileData || initialProfile;

  const { data: statusSummary, isLoading: isStatusLoading } = useQuery({
    queryKey: ['worker-verification-status'],
    queryFn: verificationsApi.getMyStatus,
  });

  const { data: history = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['worker-verification-history'],
    queryFn: verificationsApi.getMyHistory,
  });

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
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [certTitle, setCertTitle] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [skillFile, setSkillFile] = useState<File | null>(null);
  const [skillNotes, setSkillNotes] = useState('');
  const [skillError, setSkillError] = useState('');
  const [skillSuccess, setSkillSuccess] = useState('');

  // Initialize phone from verified status or profile
  useEffect(() => {
    if (!phoneNumber) {
      const existing = statusSummary?.phone || (profile as any)?.phone || (profile as any)?.user?.phone || '';
      if (existing) {
        setPhoneNumber(existing.replace(/^\+91/, ''));
      }
    }
  }, [statusSummary?.phone, profile]);

  // Countdown timer
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
    },
    onError: (err: unknown) => {
      setPhoneError(extractErrorMessage(err));
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      verificationsApi.verifyPhoneOtp(phone, code),
    onSuccess: (data) => {
      setPhoneSuccess(data.message || t('verification.phoneVerifiedSuccess', 'Phone verified successfully!'));
      setPhoneError('');
      setOtpCode('');
      setOtpSent(false);
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-status'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-history'] });
    },
    onError: (err: unknown) => {
      setPhoneError(extractErrorMessage(err));
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
      setActiveTab('overview');
    },
    onError: (err: unknown) => {
      setIdError(extractErrorMessage(err));
    },
  });

  const submitSkillMutation = useMutation({
    mutationFn: ({
      file, skillId, title, authority, notes
    }: {
      file: File; skillId: string; title: string; authority?: string; notes?: string;
    }) => verificationsApi.submitSkillCertificate(file, skillId, title, authority, notes),
    onSuccess: () => {
      setSelectedSkillId('');
      setCertTitle('');
      setIssuingAuthority('');
      setSkillFile(null);
      setSkillNotes('');
      setSkillError('');
      setSkillSuccess(t('verification.skillSubmittedSuccess', 'Skill certificate submitted for review!'));
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-status'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-verification-history'] });
    },
    onError: (err: unknown) => {
      setSkillError(extractErrorMessage(err));
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

  const handleIdentityFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSkillFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const isPhoneVerified = statusSummary?.is_phone_verified || false;
  const identityStatus = statusSummary?.identity_status || ((profile as any)?.is_verified ? 'VERIFIED' : 'NOT_SUBMITTED');
  const latestIdRecord = history.find((r) => r.verification_type === 'IDENTITY');
  const skillRecords = history.filter((r) => r.verification_type === 'SKILL');
  const workerSkills = profile?.skills || [];

  return (
    <div className="mobile-fullscreen-editor">
      {/* 1. Compact Navy Gradient Header */}
      <div className="mobile-header-safe bg-gradient-to-r from-[#172154] to-[#1F2A6B] text-white border-none shadow-md">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <h1 className="text-base font-bold text-white tracking-tight">
              {t('verification.workerCenterTitle', 'Trust & Verification Center')}
            </h1>
          </div>
          <div className="w-10" />
        </div>

        {/* 2. Scrollable Navigation Tabs */}
        <div className="flex overflow-x-auto no-scrollbar px-3 pb-2.5 gap-2 text-xs font-semibold">
          {[
            { id: 'overview', label: t('verification.tabs.overview', 'Overview'), icon: Shield },
            { id: 'phone', label: t('verification.tabs.phone', 'Phone OTP'), icon: Phone, badge: isPhoneVerified ? '✓' : '!' },
            { id: 'identity', label: t('verification.tabs.identity', 'Government ID'), icon: FileText, badge: identityStatus === 'VERIFIED' ? '✓' : undefined },
            { id: 'skills', label: t('verification.tabs.skills', 'Certificates'), icon: Award, count: skillRecords.length },
            { id: 'history', label: t('verification.tabs.history', 'Audit History'), icon: Clock },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`h-4 min-w-[16px] px-1 rounded-full text-[10px] flex items-center justify-center font-extrabold ${
                    tab.badge === '✓' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full text-[10px] bg-white/20 text-white flex items-center justify-center font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-md mx-auto w-full pb-20">
        {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Status Highlight Banner */}
            <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t('verification.overallStatus', 'Verification Status')}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                  identityStatus === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : identityStatus === 'PENDING'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : identityStatus === 'REJECTED'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {identityStatus}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                {identityStatus === 'VERIFIED'
                  ? t('verification.fullyVerifiedTitle', 'Verified KaamSetu Worker')
                  : t('verification.completeProfileTrust', 'Build Trust & Get Hired Faster')}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {identityStatus === 'VERIFIED'
                  ? t('verification.verifiedBadgeActive', 'Your identity is verified. You receive priority matching for verified employer jobs.')
                  : t('verification.workerCenterSubtitle', 'Complete phone, government ID, and skill verification to unlock top shift opportunities.')}
              </p>
            </div>

            {/* Checklist Cards */}
            <div className="space-y-2.5">
              {/* 1. Phone Card */}
              <div
                onClick={() => setActiveTab('phone')}
                className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    isPhoneVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t('verification.phoneVerification', 'Phone OTP Verification')}</h3>
                    <p className="text-[11px] text-slate-500">
                      {isPhoneVerified
                        ? (statusSummary?.phone || phoneNumber || t('verification.phoneVerified', 'Verified'))
                        : t('verification.actionVerifyNow', 'Verify with OTP')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isPhoneVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isPhoneVerified ? t('verification.status.VERIFIED', 'Verified') : t('verification.pending', 'Pending')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* 2. Government ID Card */}
              <div
                onClick={() => setActiveTab('identity')}
                className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    identityStatus === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-600'
                      : identityStatus === 'PENDING'
                      ? 'bg-amber-50 text-amber-600'
                      : identityStatus === 'REJECTED'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-indigo-50 text-indigo-900'
                  }`}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t('verification.governmentId', 'Government Photo ID')}</h3>
                    <p className="text-[11px] text-slate-500">
                      {identityStatus === 'VERIFIED'
                        ? t('verification.idVerifiedDesc', 'ID verified by admin')
                        : identityStatus === 'PENDING'
                        ? t('verification.idUnderReviewDesc', 'Under review (24 hrs)')
                        : identityStatus === 'REJECTED'
                        ? t('verification.rejectedNeedsResubmit', 'Rejected — Tap to resubmit')
                        : t('verification.aadhaarVoterLicense', 'Aadhaar, Voter ID, Driving License')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    identityStatus === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : identityStatus === 'PENDING'
                      ? 'bg-amber-100 text-amber-800'
                      : identityStatus === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {identityStatus}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* 3. Skill Certificates Card */}
              <div
                onClick={() => setActiveTab('skills')}
                className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t('verification.skillCertificates', 'Skill Certificates')}</h3>
                    <p className="text-[11px] text-slate-500">
                      {skillRecords.length > 0
                        ? `${skillRecords.length} ${t('verification.certSubmittedCount', 'certificates recorded')}`
                        : t('verification.uploadSkillDiploma', 'Upload trade diplomas & certificates')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {skillRecords.length} {t('verification.certs', 'Certs')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* 4. Audit History Card */}
              <div
                onClick={() => setActiveTab('history')}
                className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t('verification.auditHistory', 'Verification Audit Trail')}</h3>
                    <p className="text-[11px] text-slate-500">
                      {history.length > 0
                        ? `${history.length} ${t('verification.eventsRecorded', 'history events')}`
                        : t('verification.noEventsYet', 'View timestamps & review notes')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PHONE OTP ────────────────────────────────────────────── */}
        {activeTab === 'phone' && (
          <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">{t('verification.phoneVerification', 'Phone OTP Verification')}</h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {t('verification.phoneOtpDesc', 'Verify your 10-digit mobile number to receive shift bookings and notifications via SMS.')}
              </p>
            </div>

            {phoneSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>{phoneSuccess}</span>
              </div>
            )}

            {phoneError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span>{phoneError}</span>
              </div>
            )}

            {isPhoneVerified ? (
              <div className="rounded-xl bg-emerald-50/70 p-4 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    {t('verification.verifiedPhone', 'Verified Mobile Number')}
                  </span>
                  <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                    +91 {phoneNumber || statusSummary?.phone}
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Phone Request Form */}
                <form onSubmit={handleRequestOtp} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('verification.mobileNumber', 'Mobile Number')} *
                    </label>
                    <div className="flex rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden focus-within:border-indigo-900">
                      <span className="flex items-center px-3 bg-slate-100 text-xs font-bold text-slate-600 border-r border-slate-300">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="flex-1 px-3 py-2.5 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={requestOtpMutation.isPending || countdown > 0}
                    className="mobile-touch-target w-full rounded-xl bg-indigo-900 py-2.5 text-xs font-bold text-white shadow-sm active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {requestOtpMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{t('verification.sendingOtp', 'Sending OTP...')}</span>
                      </>
                    ) : countdown > 0 ? (
                      <span>{t('verification.resendIn', 'Resend in')} {countdown}s</span>
                    ) : (
                      <span>{otpSent ? t('verification.resendOtp', 'Resend OTP') : t('verification.sendOtpCode', 'Send OTP Code')}</span>
                    )}
                  </button>
                </form>

                {/* OTP Verification Form */}
                {otpSent && (
                  <form onSubmit={handleVerifyOtp} className="space-y-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {t('verification.enter6DigitOtp', 'Enter 6-Digit OTP Code')} *
                      </label>
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full text-center tracking-[0.4em] text-lg font-black rounded-xl border border-slate-300 bg-white py-2.5 shadow-xs focus:border-indigo-900 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={verifyOtpMutation.isPending || otpCode.length !== 6}
                      className="mobile-touch-target w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-sm active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {verifyOtpMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>{t('verification.verifying', 'Verifying...')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{t('verification.confirmOtpButton', 'Confirm & Verify Phone')}</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: GOVERNMENT ID ────────────────────────────────────────── */}
        {activeTab === 'identity' && (
          <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">{t('verification.governmentId', 'Government Photo ID')}</h2>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                  identityStatus === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : identityStatus === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : identityStatus === 'REJECTED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {identityStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {t('verification.govIdDesc', 'Upload an official government document. Reviewed and verified by KaamSetu administrators.')}
              </p>
            </div>

            {idError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span>{idError}</span>
              </div>
            )}

            {identityStatus === 'REJECTED' && latestIdRecord?.rejection_reason && (
              <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span>{t('verification.rejectionReasonTitle', 'Previous Submission Rejected')}</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed pl-5">
                  {latestIdRecord.rejection_reason}
                </p>
              </div>
            )}

            {identityStatus === 'VERIFIED' ? (
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                <div className="text-xs text-emerald-900 leading-relaxed font-medium">
                  {t('verification.idVerifiedSuccessMsg', 'Your government ID is approved and active. You possess top verified status.')}
                </div>
              </div>
            ) : identityStatus === 'PENDING' ? (
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 flex items-center gap-3">
                <Clock className="h-6 w-6 text-amber-600 flex-shrink-0 animate-pulse" />
                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                  {t('verification.idPendingReviewMsg', 'Your document is currently under manual review by the verification team.')}
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!idFile) {
                    setIdError(t('verification.fileRequired', 'Please select a document file.'));
                    return;
                  }
                  submitIdentityMutation.mutate({ file: idFile, type: idDocType, notes: idNotes });
                }}
                className="space-y-3.5"
              >
                {/* Document Type Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.selectDocType', 'Document Type')} *
                  </label>
                  <select
                    value={idDocType}
                    onChange={(e) => setIdDocType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold focus:border-indigo-900 focus:outline-none"
                  >
                    <option value="DRIVING_LICENSE">{t('verification.docs.DRIVING_LICENSE', 'Driving License')}</option>
                    <option value="AADHAAR">{t('verification.docs.AADHAAR', 'Aadhaar Card')}</option>
                    <option value="VOTER_ID">{t('verification.docs.VOTER_ID', 'Voter ID')}</option>
                    <option value="PAN">{t('verification.docs.PAN', 'PAN Card')}</option>
                    <option value="PASSPORT">{t('verification.docs.PASSPORT', 'Passport')}</option>
                    <option value="TRADE_LICENSE">{t('verification.docs.TRADE_LICENSE', 'Trade / Labour License')}</option>
                  </select>
                </div>

                {/* File Upload Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.uploadDocumentFile', 'Upload Document (PDF, JPEG, PNG)')} *
                  </label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <UploadCloud className="h-8 w-8 text-indigo-900 mb-1.5" />
                    <span className="text-xs font-bold text-indigo-900">
                      {idFile ? idFile.name : t('verification.chooseFileTap', 'Tap to select document')}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {idFile ? `${(idFile.size / 1024).toFixed(1)} KB` : t('verification.fileLimits', 'Max 5MB · PDF, JPG, PNG, WebP')}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={handleIdentityFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.additionalNotesOptional', 'Additional Notes (Optional)')}
                  </label>
                  <textarea
                    rows={2}
                    value={idNotes}
                    onChange={(e) => setIdNotes(e.target.value)}
                    placeholder={t('verification.docNotesPlaceholder', 'Document number or extra notes...')}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitIdentityMutation.isPending || !idFile}
                  className="mobile-touch-target w-full rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white shadow-sm active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitIdentityMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('verification.submittingForReview', 'Submitting for review...')}</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4" />
                      <span>{identityStatus === 'REJECTED' ? t('verification.resubmitId', 'Resubmit Government ID') : t('verification.submitForReview', 'Submit for Verification')}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── TAB 4: SKILL CERTIFICATES ───────────────────────────────────── */}
        {activeTab === 'skills' && (
          <div className="space-y-4">
            {/* Existing Certificates List */}
            <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">
                {t('verification.mySkillCertificates', 'My Skill Certificates')}
              </h2>

              {skillSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>{skillSuccess}</span>
                </div>
              )}

              {skillRecords.length > 0 ? (
                <div className="space-y-2">
                  {skillRecords.map((rec) => (
                    <div key={rec.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{rec.document_type || 'Certificate'}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(rec.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        rec.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rec.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {rec.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('verification.noCertificatesUploaded', 'No skill certificates uploaded yet. Add trade diplomas below to earn verified skill badges.')}
                </p>
              )}
            </div>

            {/* Upload Certificate Form */}
            <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-3.5">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                {t('verification.uploadNewCert', '+ Upload Skill Certificate')}
              </h3>

              {skillError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span>{skillError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!skillFile) {
                    setSkillError(t('verification.fileRequired', 'Please select a certificate file.'));
                    return;
                  }
                  if (!certTitle.trim()) {
                    setSkillError(t('verification.titleRequired', 'Please enter a certificate title.'));
                    return;
                  }
                  const resolvedSkillId = selectedSkillId || (workerSkills.length > 0 ? workerSkills[0].id : 'skill-general');
                  submitSkillMutation.mutate({
                    file: skillFile,
                    skillId: resolvedSkillId,
                    title: certTitle.trim(),
                    authority: issuingAuthority.trim(),
                    notes: skillNotes.trim(),
                  });
                }}
                className="space-y-3"
              >
                {/* Associated Skill */}
                {workerSkills.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('verification.associateSkill', 'Associate with Skill')} *
                    </label>
                    <select
                      value={selectedSkillId}
                      onChange={(e) => setSelectedSkillId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold focus:border-indigo-900 focus:outline-none"
                    >
                      {workerSkills.map((ws: any) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.skill?.name || ws.skill_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Certificate Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.certTitle', 'Certificate Title')} *
                  </label>
                  <input
                    type="text"
                    value={certTitle}
                    onChange={(e) => setCertTitle(e.target.value)}
                    placeholder="e.g. ITI Industrial Electrician Certificate"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium focus:border-indigo-900 focus:outline-none"
                  />
                </div>

                {/* Issuing Authority */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.issuingAuthority', 'Issuing Authority / Institute')}
                  </label>
                  <input
                    type="text"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    placeholder="e.g. National Skill Development Corp (NSDC)"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium focus:border-indigo-900 focus:outline-none"
                  />
                </div>

                {/* Certificate File */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.certDocument', 'Certificate Document (PDF, JPEG, PNG)')} *
                  </label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <UploadCloud className="h-6 w-6 text-purple-700 mb-1" />
                    <span className="text-xs font-bold text-purple-900">
                      {skillFile ? skillFile.name : t('verification.chooseFileTap', 'Tap to select document')}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {skillFile ? `${(skillFile.size / 1024).toFixed(1)} KB` : t('verification.fileLimits', 'Max 5MB · PDF, JPG, PNG')}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={handleSkillFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitSkillMutation.isPending || !skillFile || !certTitle.trim()}
                  className="mobile-touch-target w-full rounded-xl bg-purple-700 py-2.5 text-xs font-bold text-white shadow-sm active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitSkillMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('verification.uploadingCert', 'Uploading certificate...')}</span>
                    </>
                  ) : (
                    <>
                      <Award className="h-4 w-4" />
                      <span>{t('verification.submitCertificate', 'Submit Skill Certificate')}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 5: AUDIT HISTORY ────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900">{t('verification.auditHistory', 'Verification Audit Trail')}</h2>

            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((rec) => (
                  <div key={rec.id} className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          {rec.verification_type}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{rec.document_type || 'Record'}</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        rec.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rec.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {rec.status}
                      </span>
                    </div>

                    {rec.rejection_reason && (
                      <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                        <strong>{t('verification.rejectionNote', 'Rejection Note:')}</strong> {rec.rejection_reason}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400">
                      {new Date(rec.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>{t('verification.noHistoryRecords', 'No verification history records found.')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileWorkerVerificationCenter;
