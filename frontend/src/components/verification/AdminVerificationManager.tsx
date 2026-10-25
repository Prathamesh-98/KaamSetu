// KaamSetu — Admin Verification Queue and Review Manager
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Check, X, Eye, AlertCircle, RefreshCw, Filter, ChevronLeft, ChevronRight,
  RotateCcw, Calendar, FileText, User, Building, Award, Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { adminApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import type { VerificationRecord } from '../../types';
import { VerificationStatusBadge } from './TrustBadges';
import { SecureDocumentViewerModal } from './SecureDocumentViewerModal';

export const AdminVerificationManager: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const perPage = 15;

  // Modals state
  const [viewingRecord, setViewingRecord] = useState<VerificationRecord | null>(null);
  const [actionRecord, setActionRecord] = useState<{
    record: VerificationRecord;
    action: 'APPROVE' | 'REJECT' | 'REVOKE';
  } | null>(null);

  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [reviewerNotes, setReviewerNotes] = useState<string>('');
  const [expiryDays, setExpiryDays] = useState<string>('365');
  const [formError, setFormError] = useState<string>('');

  // Fetch queue
  const {
    data: queue = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-verification-queue', statusFilter, typeFilter, page, perPage],
    queryFn: () =>
      adminApi.getVerificationQueue({
        status: statusFilter,
        type: typeFilter,
        page,
        per_page: perPage,
      }),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ recordId, expiresAt, notes }: { recordId: string; expiresAt?: string; notes?: string }) =>
      adminApi.approveVerification(recordId, {
        decision: 'APPROVE',
        expires_at: expiresAt,
        reviewer_notes: notes,
      }),
    onSuccess: (updated) => {
      toast.success(t('verification.approveSuccess', 'Verification approved successfully!'));
      setActionRecord(null);
      resetModalForm();
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ recordId, reason, notes }: { recordId: string; reason: string; notes?: string }) =>
      adminApi.rejectVerification(recordId, {
        decision: 'REJECT',
        rejection_reason: reason,
        reviewer_notes: notes,
      }),
    onSuccess: (updated) => {
      toast.success(t('verification.rejectSuccess', 'Verification rejected. Reason recorded.'));
      setActionRecord(null);
      resetModalForm();
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ recordId, reason, notes }: { recordId: string; reason: string; notes?: string }) =>
      adminApi.revokeVerification(recordId, {
        decision: 'REVOKE',
        rejection_reason: reason,
        reviewer_notes: notes,
      }),
    onSuccess: (updated) => {
      toast.success(t('verification.revokeSuccess', 'Verified status revoked successfully.'));
      setActionRecord(null);
      resetModalForm();
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-verification-queue'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const resetModalForm = () => {
    setRejectionReason('');
    setReviewerNotes('');
    setExpiryDays('365');
    setFormError('');
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionRecord) return;
    setFormError('');

    if (actionRecord.action === 'APPROVE') {
      let expiresAt: string | undefined = undefined;
      const days = parseInt(expiryDays, 10);
      if (!isNaN(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        expiresAt = d.toISOString();
      }
      approveMutation.mutate({
        recordId: actionRecord.record.id,
        expiresAt,
        notes: reviewerNotes.trim() || undefined,
      });
    } else if (actionRecord.action === 'REJECT') {
      if (!rejectionReason || !rejectionReason.trim()) {
        setFormError(t('verification.rejectionReasonMandatory', 'A mandatory rejection reason is required.'));
        return;
      }
      rejectMutation.mutate({
        recordId: actionRecord.record.id,
        reason: rejectionReason.trim(),
        notes: reviewerNotes.trim() || undefined,
      });
    } else if (actionRecord.action === 'REVOKE') {
      if (!rejectionReason || !rejectionReason.trim()) {
        setFormError(t('verification.revocationReasonMandatory', 'A mandatory revocation reason is required.'));
        return;
      }
      revokeMutation.mutate({
        recordId: actionRecord.record.id,
        reason: rejectionReason.trim(),
        notes: reviewerNotes.trim() || undefined,
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PHONE':
        return <Clock className="w-4 h-4 text-sky-600" />;
      case 'IDENTITY':
        return <User className="w-4 h-4 text-emerald-600" />;
      case 'SKILL':
        return <Award className="w-4 h-4 text-purple-600" />;
      case 'PROFILE':
        return <Building className="w-4 h-4 text-blue-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
      {/* Top Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#182849] text-lg flex items-center gap-2">
              <span>{t('admin.verificationQueue', 'Verification Review Queue')}</span>
              {statusFilter === 'PENDING' && queue.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                  {queue.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              {t('admin.verificationQueueDesc', 'Review and authenticate identity documents, skill certificates, and business filings.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn btn-outline text-xs px-3 py-1.5 rounded-xl border-gray-300 font-bold flex items-center gap-1.5 self-start sm:self-auto hover:bg-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>{t('admin.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 border-b border-gray-100 bg-white flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <Filter className="w-4 h-4" />
          <span>{t('admin.filterBy', 'Filter')}:</span>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input rounded-xl py-1.5 px-3 text-xs bg-gray-50 border-gray-200 font-semibold text-gray-700"
        >
          <option value="ALL">{t('admin.allStatuses', 'All Statuses')}</option>
          <option value="PENDING">{t('admin.pendingReviews', 'Pending Review')}</option>
          <option value="VERIFIED">{t('admin.verified', 'Verified')}</option>
          <option value="REJECTED">{t('admin.rejected', 'Rejected')}</option>
          <option value="EXPIRED">{t('admin.expired', 'Expired')}</option>
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="input rounded-xl py-1.5 px-3 text-xs bg-gray-50 border-gray-200 font-semibold text-gray-700"
        >
          <option value="ALL">{t('admin.allTypes', 'All Types')}</option>
          <option value="IDENTITY">{t('verification.tabs.identity', 'Government ID')}</option>
          <option value="SKILL">{t('verification.tabs.skills', 'Skill Certificate')}</option>
          <option value="PROFILE">{t('verification.employerTitle', 'Company Profile')}</option>
          <option value="PHONE">{t('verification.tabs.phone', 'Phone')}</option>
        </select>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="py-3 px-4">{t('admin.submission', 'Submission')}</th>
              <th className="py-3 px-4">{t('admin.user', 'User / Account')}</th>
              <th className="py-3 px-4">{t('admin.details', 'Details & Metadata')}</th>
              <th className="py-3 px-4">{t('admin.status', 'Status')}</th>
              <th className="py-3 px-4">{t('admin.date', 'Submitted Date')}</th>
              <th className="py-3 px-4 text-right">{t('admin.actions', 'Review Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                  <span>{t('admin.loadingQueue', 'Loading verification queue...')}</span>
                </td>
              </tr>
            ) : queue.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-400">
                  <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="font-bold text-gray-600">{t('admin.noSubmissions', 'Queue is clear!')}</p>
                  <p className="text-xs text-gray-400">{t('admin.noSubmissionsSub', 'No submissions match current filters.')}</p>
                </td>
              </tr>
            ) : (
              queue.map((record: VerificationRecord) => (
                <tr key={record.id} className="hover:bg-gray-50/70 transition-colors">
                  {/* Type */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(record.verification_type)}
                      <span className="font-bold text-[#182849]">
                        {record.document_type || record.verification_type}
                      </span>
                    </div>
                  </td>

                  {/* User */}
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                      {record.user_id.slice(0, 8)}...
                    </span>
                  </td>

                  {/* Metadata */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="space-y-0.5 truncate">
                      {record.metadata?.certificate_title && (
                        <p className="font-bold text-gray-800 truncate">📜 {record.metadata.certificate_title}</p>
                      )}
                      {record.metadata?.organization_name && (
                        <p className="font-bold text-gray-800 truncate">🏢 {record.metadata.organization_name}</p>
                      )}
                      {record.metadata?.tax_id && (
                        <p className="text-gray-500 text-[11px] font-mono">Tax ID: {record.metadata.tax_id}</p>
                      )}
                      {record.metadata?.user_notes && (
                        <p className="text-gray-400 text-[11px] truncate italic">"{record.metadata.user_notes}"</p>
                      )}
                      {record.rejection_reason && (
                        <p className="text-rose-600 text-[11px] font-semibold truncate">⚠️ {record.rejection_reason}</p>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <VerificationStatusBadge status={record.status} size="sm" />
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                    {new Date(record.created_at).toLocaleDateString()}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {record.has_document && (
                        <button
                          type="button"
                          onClick={() => setViewingRecord(record)}
                          className="btn btn-outline text-xs px-2.5 py-1 rounded-lg border-gray-300 font-bold gap-1 hover:bg-white"
                          title={t('verification.viewDocument', 'View Private Document')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('admin.view', 'View')}</span>
                        </button>
                      )}

                      {record.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setActionRecord({ record, action: 'APPROVE' });
                              resetModalForm();
                            }}
                            className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1 rounded-lg font-bold shadow-sm gap-1"
                            title={t('admin.approve', 'Approve Submission')}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t('admin.approve', 'Approve')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActionRecord({ record, action: 'REJECT' });
                              resetModalForm();
                            }}
                            className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-2.5 py-1 rounded-lg font-bold shadow-sm gap-1"
                            title={t('admin.reject', 'Reject Submission')}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{t('admin.reject', 'Reject')}</span>
                          </button>
                        </>
                      )}

                      {record.status === 'VERIFIED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionRecord({ record, action: 'REVOKE' });
                            resetModalForm();
                          }}
                          className="btn btn-outline text-rose-700 hover:bg-rose-50 border-rose-200 text-xs px-2.5 py-1 rounded-lg font-bold gap-1"
                          title={t('admin.revoke', 'Revoke Verified Status')}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t('admin.revoke', 'Revoke')}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500 font-semibold">
        <span>
          {t('admin.showingPage', 'Page {{page}} ({{count}} items)', { page, count: queue.length })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={queue.length < perPage}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Dialog (Approve, Reject, Revoke) */}
      {actionRecord && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className={`p-5 text-white flex items-center justify-between ${
              actionRecord.action === 'APPROVE' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              <h3 className="font-bold text-base flex items-center gap-2">
                {actionRecord.action === 'APPROVE' && <Check className="w-5 h-5" />}
                {actionRecord.action === 'REJECT' && <X className="w-5 h-5" />}
                {actionRecord.action === 'REVOKE' && <RotateCcw className="w-5 h-5" />}
                <span>
                  {actionRecord.action === 'APPROVE' && t('admin.modalApproveTitle', 'Approve Verification')}
                  {actionRecord.action === 'REJECT' && t('admin.modalRejectTitle', 'Reject Verification')}
                  {actionRecord.action === 'REVOKE' && t('admin.modalRevokeTitle', 'Revoke Verified Status')}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setActionRecord(null)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-bold">{t('admin.submissionType', 'Type')}: </span>
                  {actionRecord.record.verification_type} ({actionRecord.record.document_type || 'Evidence'})
                </p>
                <p>
                  <span className="font-bold">{t('admin.user', 'User ID')}: </span>
                  {actionRecord.record.user_id}
                </p>
              </div>

              {/* Mandatory Rejection / Revocation Reason */}
              {(actionRecord.action === 'REJECT' || actionRecord.action === 'REVOKE') && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    {t('admin.rejectionReasonLabel', 'Mandatory Reason *')}
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={
                      actionRecord.action === 'REJECT'
                        ? 'e.g. Document image is blurry or expired; name does not match user account.'
                        : 'e.g. Forged registration certificate identified during audit.'
                    }
                    className="input w-full rounded-xl bg-gray-50 border-gray-200 text-xs font-medium resize-none"
                    required
                  />
                  <p className="text-[11px] text-gray-400">
                    {t('admin.reasonNotice', 'This reason will be visible to the user on their profile.')}
                  </p>
                </div>
              )}

              {/* Expiry Selection for APPROVE */}
              {actionRecord.action === 'APPROVE' && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    {t('admin.validityPeriod', 'Validity Period')}
                  </label>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    className="input w-full rounded-xl bg-gray-50 border-gray-200 text-xs font-medium"
                  >
                    <option value="365">{t('admin.oneYear', '1 Year (Standard)')}</option>
                    <option value="730">{t('admin.twoYears', '2 Years')}</option>
                    <option value="180">{t('admin.sixMonths', '6 Months')}</option>
                    <option value="0">{t('admin.noExpiry', 'No Expiration (Permanent)')}</option>
                  </select>
                </div>
              )}

              {/* Reviewer Internal Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  {t('admin.internalNotes', 'Reviewer Notes (Internal Audit Log)')}
                </label>
                <input
                  type="text"
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="e.g. Verified with state transport department database"
                  className="input w-full rounded-xl bg-gray-50 border-gray-200 text-xs font-medium"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setActionRecord(null)}
                  className="btn btn-outline text-xs px-4 py-2 rounded-xl font-bold"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={
                    approveMutation.isPending || rejectMutation.isPending || revokeMutation.isPending
                  }
                  className={`btn text-xs px-6 py-2 rounded-xl font-bold text-white shadow-sm ${
                    actionRecord.action === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {approveMutation.isPending || rejectMutation.isPending || revokeMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : actionRecord.action === 'APPROVE' ? (
                    t('admin.confirmApprove', 'Confirm Approval')
                  ) : actionRecord.action === 'REJECT' ? (
                    t('admin.confirmReject', 'Confirm Rejection')
                  ) : (
                    t('admin.confirmRevoke', 'Confirm Revocation')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secure Document Viewer Modal */}
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
