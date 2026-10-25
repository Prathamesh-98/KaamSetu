// KaamSetu — Employer Company Verification Center
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, ShieldCheck, Shield, Clock, AlertCircle, CheckCircle2,
  UploadCloud, RefreshCw, Eye, ArrowRight, FileCheck, HelpCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { verificationsApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import type { EmployerProfile, VerificationRecord } from '../../types';
import { VerificationStatusBadge } from './TrustBadges';
import { SecureDocumentViewerModal } from './SecureDocumentViewerModal';

interface EmployerVerificationCenterProps {
  profile: EmployerProfile;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const EmployerVerificationCenter: React.FC<EmployerVerificationCenterProps> = ({ profile }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: statusSummary } = useQuery({
    queryKey: ['employer-verification-status'],
    queryFn: verificationsApi.getMyStatus,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['employer-verification-history'],
    queryFn: verificationsApi.getMyHistory,
  });

  const [orgName, setOrgName] = useState(profile.organization_name || '');
  const [orgType, setOrgType] = useState(profile.organization_type || 'Private Limited');
  const [taxId, setTaxId] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<VerificationRecord | null>(null);

  const companyStatus = statusSummary?.company_status || (profile.is_verified ? 'VERIFIED' : 'NOT_SUBMITTED');
  const latestRecord = history.find((r) => r.verification_type === 'PROFILE');

  const submitCompanyMutation = useMutation({
    mutationFn: () => {
      if (!docFile) throw new Error(t('verification.fileRequired', 'Please select a verification document file.'));
      return verificationsApi.submitCompany(docFile, orgName, orgType, taxId, notes);
    },
    onSuccess: () => {
      setDocFile(null);
      setNotes('');
      setErrorMsg('');
      setIsResubmitting(false);
      void queryClient.invalidateQueries({ queryKey: ['employer-verification-status'] });
      void queryClient.invalidateQueries({ queryKey: ['employer-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['employer-verification-history'] });
      toast.success(t('verification.companySubmittedSuccess', 'Company verification documents submitted successfully!'));
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      toast.error(msg);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    submitCompanyMutation.mutate();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-[#1E293B] to-[#334155] text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                {t('verification.businessVerification', 'Business Verification')}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              {t('verification.employerTitle', 'Company & Business Verification')}
            </h2>
            <p className="text-sm text-gray-300 max-w-xl font-medium">
              {t(
                'verification.employerSubtitle',
                'Gain the Verified Employer Badge to attract skilled workers and publish premium shift bookings.'
              )}
            </p>
          </div>

          <div className="self-start sm:self-center">
            <VerificationStatusBadge status={companyStatus} size="lg" />
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-8">
        {/* State Banner: VERIFIED */}
        {companyStatus === 'VERIFIED' && (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-bold text-emerald-900 text-base">
                {t('verification.companyVerifiedTitle', 'Company Officially Verified')}
              </h4>
              <p className="text-xs text-emerald-700 font-medium">
                {t(
                  'verification.companyVerifiedDesc',
                  'Your organization is authenticated as a verified employer on KaamSetu. Verified badges are displayed on all your job postings.'
                )}
              </p>
              {latestRecord?.verified_at && (
                <p className="text-xs text-emerald-600 font-semibold pt-1">
                  {t('verification.verifiedOn', 'Verified on')}: {new Date(latestRecord.verified_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* State Banner: PENDING */}
        {companyStatus === 'PENDING' && (
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-4">
            <Clock className="w-8 h-8 text-amber-600 animate-pulse flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-bold text-amber-900 text-base">
                {t('verification.companyPendingTitle', 'Company Documents Under Review')}
              </h4>
              <p className="text-xs text-amber-700 font-medium">
                {t(
                  'verification.companyPendingDesc',
                  'Your business documents are being verified by our compliance team. Verification typically completes within 1 business day.'
                )}
              </p>
              {latestRecord?.created_at && (
                <p className="text-xs text-amber-600 font-semibold pt-1">
                  {t('verification.submittedOn', 'Submitted')}: {new Date(latestRecord.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* State Banner: REJECTED */}
        {companyStatus === 'REJECTED' && latestRecord && !isResubmitting && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-base text-rose-900">
                  {t('verification.companyRejectedTitle', 'Verification Submission Requires Action')}
                </h4>
                <p className="text-xs text-rose-800 mt-1 font-medium">
                  <span className="font-bold">{t('verification.reason', 'Rejection Reason')}: </span>
                  {latestRecord.rejection_reason || t('verification.blurryDocReason', 'Document illegible or tax details do not match.')}
                </p>
              </div>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsResubmitting(true)}
                className="btn bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold px-4 py-2 shadow-sm"
              >
                {t('verification.resubmitCompanyDocs', 'Upload Updated Company Evidence')}
              </button>
            </div>
          </div>
        )}

        {/* Verification Form (shown when NOT_SUBMITTED, or actively RESUBMITTING) */}
        {(companyStatus === 'NOT_SUBMITTED' || isResubmitting) && (
          <form onSubmit={handleSubmit} className="bg-gray-50/70 p-6 sm:p-8 rounded-2xl border border-gray-200 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <h3 className="font-bold text-[#182849] text-base flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#2455E8]" />
                <span>{t('verification.submitBusinessDocs', 'Submit Business Evidence')}</span>
              </h3>
              {isResubmitting && (
                <button
                  type="button"
                  onClick={() => setIsResubmitting(false)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Organization Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('employer.orgName', 'Registered Company Name *')}
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Apex Infrastructures Pvt Ltd"
                  className="input w-full rounded-xl bg-white border-gray-200 text-sm font-medium"
                  required
                />
              </div>

              {/* Organization Type */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('employer.orgType', 'Business Legal Entity Type *')}
                </label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  className="input w-full rounded-xl bg-white border-gray-200 text-sm font-medium"
                  required
                >
                  <option value="Private Limited">Private Limited (Pvt Ltd)</option>
                  <option value="Limited Liability Partnership">Limited Liability Partnership (LLP)</option>
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                  <option value="Partnership Firm">Partnership Firm</option>
                  <option value="Public Limited">Public Limited</option>
                  <option value="Society / Trust / NGO">Society / Trust / NGO</option>
                  <option value="Individual Contractor">Individual Contractor / Proprietor</option>
                </select>
              </div>

              {/* Tax / Registration ID */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.taxIdLabel', 'GSTIN / CIN / MSME Registration ID')}
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. 27AAAAA0000A1Z5 or U12345MH2020PTC..."
                  className="input w-full rounded-xl bg-white border-gray-200 text-sm font-medium uppercase"
                />
              </div>

              {/* Document File */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.uploadDocLabel', 'Upload Evidence (GST, Certificate, or Trade License) *')}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="input w-full rounded-xl bg-white border-gray-200 text-xs py-2"
                  required
                />
                <p className="text-xs text-gray-400">PDF, JPEG, PNG, or WebP. Max 5MB.</p>
              </div>

              {/* Notes */}
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('verification.additionalNotes', 'Notes for Verifier (Optional)')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('verification.companyNotesPlaceholder', 'Any additional registration context or links...')}
                  className="input w-full rounded-xl bg-white border-gray-200 text-sm resize-none"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitCompanyMutation.isPending || !docFile || !orgName.trim()}
                className="btn bg-[#2455E8] hover:bg-[#1e46c7] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
              >
                {submitCompanyMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('verification.submitting', 'Submitting for Review...')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('verification.submitCompanyVerification', 'Submit for Compliance Verification')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* History of Past Submissions */}
        {history.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-gray-100">
            <h4 className="font-bold text-sm text-[#182849]">
              {t('verification.submissionHistory', 'Company Verification Submission History')}
            </h4>
            <div className="space-y-2">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">
                        {record.metadata?.organization_name || record.document_type || 'Company Registration'}
                      </span>
                      <VerificationStatusBadge status={record.status} size="sm" />
                    </div>
                    <p className="text-gray-500">
                      {t('verification.submittedOn', 'Submitted')}: {new Date(record.created_at).toLocaleDateString()}
                      {record.metadata?.tax_id && ` • Tax ID: ${record.metadata.tax_id}`}
                      {record.verified_at && ` • Reviewed: ${new Date(record.verified_at).toLocaleDateString()}`}
                    </p>
                    {record.rejection_reason && (
                      <p className="text-rose-700 font-semibold bg-rose-50 px-2 py-1 rounded">
                        ⚠️ {record.rejection_reason}
                      </p>
                    )}
                  </div>

                  {record.has_document && (
                    <button
                      type="button"
                      onClick={() => setViewingRecord(record)}
                      className="btn btn-outline text-xs px-3 py-1.5 rounded-lg border-gray-300 font-semibold gap-1 self-start sm:self-auto hover:bg-white"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('verification.viewDocument', 'View Document')}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {viewingRecord && (
        <SecureDocumentViewerModal
          recordId={viewingRecord.id}
          documentType={viewingRecord.document_type || 'Company Registration'}
          fileName={viewingRecord.metadata?.submitted_filename}
          onClose={() => setViewingRecord(null)}
        />
      )}
    </div>
  );
};
