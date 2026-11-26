// KaamSetu — Mobile Employer Company Verification Center
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, ShieldCheck, Shield, Clock, AlertCircle, CheckCircle2,
  UploadCloud, RefreshCw, Eye, ArrowLeft, X, Info, FileCheck, AlertTriangle, ChevronRight
} from 'lucide-react';
import { verificationsApi, employerApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import type { EmployerProfile, VerificationRecord } from '../../types';

interface MobileEmployerVerificationCenterProps {
  profile?: EmployerProfile;
  onClose?: () => void;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const MobileEmployerVerificationCenter: React.FC<MobileEmployerVerificationCenterProps> = ({ profile: initialProfile, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'company' | 'history'>('overview');

  const { data: profileData } = useQuery({
    queryKey: ['employer-profile'],
    queryFn: employerApi.getMyProfile,
    initialData: initialProfile,
  });

  const profile = profileData || initialProfile;

  const { data: statusSummary } = useQuery({
    queryKey: ['employer-verification-status'],
    queryFn: verificationsApi.getMyStatus,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['employer-verification-history'],
    queryFn: verificationsApi.getMyHistory,
  });

  const [orgName, setOrgName] = useState(profile?.organization_name || '');
  const [orgType, setOrgType] = useState(profile?.organization_type || 'Private Limited');
  const [taxId, setTaxId] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (profile?.organization_name && !orgName) {
      setOrgName(profile.organization_name);
    }
    if (profile?.organization_type && !orgType) {
      setOrgType(profile.organization_type);
    }
  }, [profile]);

  const isVerified = statusSummary?.company_status === 'VERIFIED' || profile?.is_verified || false;
  const companyStatus = statusSummary?.company_status || (isVerified ? 'VERIFIED' : 'NOT_SUBMITTED');
  const latestRecord = history.find((r: VerificationRecord) => (r.verification_type as string) === 'PROFILE' || (r.verification_type as string) === 'DOCUMENT' || (r.verification_type as string) === 'IDENTITY');

  const submitCompanyMutation = useMutation({
    mutationFn: () => {
      if (!docFile) throw new Error(t('verification.fileRequired', 'Please select a verification document file.'));
      if (!orgName.trim()) throw new Error(t('employer.orgNameRequired', 'Organization name is required.'));
      return verificationsApi.submitCompany(docFile, orgName.trim(), orgType, taxId.trim(), notes.trim());
    },
    onSuccess: () => {
      setDocFile(null);
      setNotes('');
      setErrorMsg('');
      void queryClient.invalidateQueries({ queryKey: ['employer-verification-status'] });
      void queryClient.invalidateQueries({ queryKey: ['employer-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['employer-verification-history'] });
      setActiveTab('overview');
    },
    onError: (err: unknown) => {
      setErrorMsg(extractErrorMessage(err));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(t('verification.fileTooLarge', 'File size exceeds 5MB limit.'));
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrorMsg(t('verification.unsupportedFormat', 'Please upload a PDF, JPEG, PNG, or WebP document.'));
      return;
    }
    setErrorMsg('');
    setDocFile(file);
  };

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
            <Building2 className="h-5 w-5 text-amber-400" />
            <h1 className="text-base font-bold text-white tracking-tight">
              {t('verification.companyCenterTitle', 'Business Verification Center')}
            </h1>
          </div>
          <div className="w-10" />
        </div>

        {/* 2. Scrollable Navigation Tabs */}
        <div className="flex px-3 pb-2.5 gap-2 text-xs font-semibold">
          {[
            { id: 'overview', label: t('verification.tabs.overview', 'Overview'), icon: Shield },
            { id: 'company', label: t('verification.businessVerification', 'Business KYC'), icon: FileCheck, badge: isVerified ? '✓' : undefined },
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
                  <span className="h-4 min-w-[16px] px-1 rounded-full text-[10px] bg-emerald-600 text-white flex items-center justify-center font-extrabold">
                    {tab.badge}
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
            {/* Status Card */}
            <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t('verification.overallStatus', 'Company Status')}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                  companyStatus === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : companyStatus === 'PENDING'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : companyStatus === 'REJECTED'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {companyStatus}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                {profile?.organization_name || t('employer.yourCompany', 'Your Company')}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {companyStatus === 'VERIFIED'
                  ? t('verification.companyVerifiedDesc', 'Your company registration is verified. Your job postings display the verified employer badge.')
                  : t('verification.companyPendingDesc', 'Submit business documentation (GSTIN, Certificate of Incorporation, or MSME) to earn verified employer status.')}
              </p>
            </div>

            {/* Action Cards */}
            <div className="space-y-2.5">
              <div
                onClick={() => setActiveTab('company')}
                className="rounded-2xl bg-white p-3.5 border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    companyStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-900'
                  }`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t('verification.businessVerification', 'Business Verification')}</h3>
                    <p className="text-[11px] text-slate-500">
                      {companyStatus === 'VERIFIED'
                        ? t('verification.verifiedGovtDocs', 'Documents approved')
                        : companyStatus === 'PENDING'
                        ? t('verification.underAdminReview', 'Under administrative review')
                        : companyStatus === 'REJECTED'
                        ? t('verification.rejectedNeedsResubmit', 'Rejected — Tap to resubmit')
                        : t('verification.gstinIncorporation', 'GSTIN, Incorporation, MSME')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    companyStatus === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : companyStatus === 'PENDING'
                      ? 'bg-amber-100 text-amber-800'
                      : companyStatus === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {companyStatus}
                  </span>
                </div>
              </div>

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
                      {history.length > 0 ? `${history.length} ${t('verification.eventsRecorded', 'history events')}` : t('verification.viewAuditEvents', 'View timestamps & reviewer notes')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Verified Employer Benefits */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 p-4 border border-indigo-100 space-y-2">
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                {t('verification.employerBenefitsTitle', 'Verified Employer Benefits')}
              </h3>
              <ul className="text-xs text-indigo-950 space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{t('verification.benefitVerifiedBadge', 'Verified Company shield displayed on all your job postings')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{t('verification.benefit3xApplications', 'Receive up to 3x more applications from top skilled workers')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{t('verification.benefitPriorityMatching', 'Direct access to verified workers and rapid shift dispatching')}</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ── TAB 2: COMPANY FORM ─────────────────────────────────────────── */}
        {activeTab === 'company' && (
          <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">{t('verification.businessVerification', 'Business Documentation')}</h2>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                  companyStatus === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : companyStatus === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : companyStatus === 'REJECTED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {companyStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {t('verification.companyDocDesc', 'Upload your official Certificate of Incorporation, GST registration, or MSME certificate.')}
              </p>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {companyStatus === 'REJECTED' && latestRecord?.rejection_reason && (
              <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span>{t('verification.rejectionReasonTitle', 'Previous Submission Rejected')}</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed pl-5">
                  {latestRecord.rejection_reason}
                </p>
              </div>
            )}

            {companyStatus === 'VERIFIED' ? (
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                <div className="text-xs text-emerald-900 leading-relaxed font-medium">
                  {t('verification.companyVerifiedActiveMsg', 'Your company verification is approved and active. Your profile possesses top verified employer trust.')}
                </div>
              </div>
            ) : companyStatus === 'PENDING' ? (
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 flex items-center gap-3">
                <Clock className="h-6 w-6 text-amber-600 flex-shrink-0 animate-pulse" />
                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                  {t('verification.companyPendingReviewMsg', 'Your business documents are currently under manual review by the KaamSetu operational team.')}
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCompanyMutation.mutate();
                }}
                className="space-y-3.5"
              >
                {/* Organization Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('employer.companyName', 'Company / Organization Name')} *
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Construction Services"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold focus:border-indigo-900 focus:outline-none"
                  />
                </div>

                {/* Organization Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('employer.orgType', 'Organization Type')} *
                  </label>
                  <select
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold focus:border-indigo-900 focus:outline-none"
                  >
                    <option value="Private Limited">Private Limited</option>
                    <option value="Public Limited">Public Limited</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                    <option value="LLP">LLP</option>
                    <option value="Trust / Society / NGO">Trust / Society / NGO</option>
                    <option value="Government Entity">Government Entity</option>
                  </select>
                </div>

                {/* GSTIN / Reg Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.gstinOrRegNumber', 'GSTIN / Registration Number')}
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.toUpperCase())}
                    placeholder="e.g. 27AADCB2230M1ZT"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold uppercase tracking-wider focus:border-indigo-900 focus:outline-none"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.companyDocFile', 'Upload Registration Document (PDF, JPEG, PNG)')} *
                  </label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <UploadCloud className="h-8 w-8 text-indigo-900 mb-1.5" />
                    <span className="text-xs font-bold text-indigo-900">
                      {docFile ? docFile.name : t('verification.chooseFileTap', 'Tap to select document')}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {docFile ? `${(docFile.size / 1024).toFixed(1)} KB` : t('verification.fileLimits', 'Max 5MB · PDF, JPG, PNG, WebP')}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('verification.additionalNotesOptional', 'Additional Notes (Optional)')}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('verification.additionalNotesPlaceholder', 'Additional registration or verification notes...')}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs focus:border-indigo-900 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitCompanyMutation.isPending || !docFile || !orgName.trim()}
                  className="mobile-touch-target w-full rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white shadow-sm active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitCompanyMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('verification.submittingForReview', 'Submitting for review...')}</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4" />
                      <span>{companyStatus === 'REJECTED' ? t('verification.resubmitCompanyDocs', 'Resubmit Business Documents') : t('verification.submitForReview', 'Submit for Verification')}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── TAB 3: AUDIT HISTORY ────────────────────────────────────────── */}
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
                        <span className="text-xs font-bold text-slate-900">{rec.document_type || 'Business Record'}</span>
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

export default MobileEmployerVerificationCenter;
