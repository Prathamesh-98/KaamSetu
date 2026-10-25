import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Briefcase, Search, Filter, RefreshCw, AlertTriangle, CheckCircle,
  AlertCircle, Loader2, Edit3, X, MapPin, Building2, Users, Info
} from 'lucide-react';
import { adminApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import type { AdminJobListItem, JobStatus } from '../../types';

export default function AdminJobsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const perPage = 15;

  // Selected job for status modification
  const [selectedJob, setSelectedJob] = useState<AdminJobListItem | null>(null);
  const [newStatus, setNewStatus] = useState<JobStatus>('ACTIVE');
  const [moderationReason, setModerationReason] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-jobs', { search, statusFilter, page }],
    queryFn: () =>
      adminApi.listJobs({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        per_page: perPage,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ jobId, status, reason }: { jobId: string; status: string; reason?: string }) =>
      adminApi.updateJobStatus(jobId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setFeedback({
        type: 'success',
        message: t('admin.jobStatusSuccess', 'Job status updated successfully.'),
      });
      setSelectedJob(null);
      setModerationReason('');
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: unknown) => {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(err),
      });
      setTimeout(() => setFeedback(null), 6000);
    },
  });

  const handleOpenModeration = (job: AdminJobListItem) => {
    setSelectedJob(job);
    setNewStatus(job.status);
    setModerationReason('');
  };

  const handleConfirmStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    updateStatusMutation.mutate({
      jobId: selectedJob.id,
      status: newStatus,
      reason: moderationReason.trim() || undefined,
    });
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
      case 'CLOSED':
        return <span className="badge bg-gray-100 text-gray-700 border border-gray-200">Closed</span>;
      case 'CANCELLED':
        return <span className="badge bg-red-50 text-red-700 border border-red-200">Cancelled</span>;
      case 'DRAFT':
        return <span className="badge bg-amber-50 text-amber-700 border border-amber-200">Draft</span>;
      default:
        return <span className="badge bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark">{t('admin.jobsTitle', 'Job Postings Management')}</h1>
            <p className="text-gray-500 text-sm">
              {t('admin.jobsSubtitle', 'Moderate platform job listings, inspect details, and update publishing status.')}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-outline btn-sm self-start md:self-auto flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {t('admin.refresh', 'Refresh')}
        </button>
      </div>

      {/* Audit Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-relaxed">
          <strong>Notice:</strong> {t('admin.jobDeletionProhibited', 'Jobs cannot be permanently deleted. They are archived via Closed or Cancelled status for dispute auditability.')}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('admin.searchJobsPlaceholder', 'Search jobs by title, employer, or city...')}
              className="input pl-9 text-sm"
            />
          </div>
          <div className="md:col-span-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input text-sm"
            >
              <option value="ALL">{t('admin.allStatuses', 'All Statuses')}</option>
              <option value="ACTIVE">{t('admin.statusActive', 'Active (Open)')}</option>
              <option value="CLOSED">{t('admin.statusClosed', 'Closed')}</option>
              <option value="CANCELLED">{t('admin.statusCancelled', 'Cancelled')}</option>
              <option value="DRAFT">{t('admin.statusDraft', 'Draft')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary-600" />
            <p className="text-sm">{t('admin.loadingRecords', 'Loading records...')}</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">{t('admin.errorLoading', 'Failed to load records from server.')}</p>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Briefcase className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-semibold text-gray-700">{t('admin.noResultsFound', 'No records found matching criteria.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Job Title & Employer</th>
                  <th className="px-5 py-3.5 font-semibold">Location</th>
                  <th className="px-5 py-3.5 font-semibold">Type & Wage</th>
                  <th className="px-5 py-3.5 font-semibold">Applications</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Posted</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Title & Employer */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-dark">{job.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        <span>{job.organization_name || job.employer_name || 'Employer'}</span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {job.city || job.state ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {[job.city, job.state].filter(Boolean).join(', ')}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Not specified</span>
                      )}
                    </td>

                    {/* Work Type & Salary */}
                    <td className="px-5 py-4 text-xs">
                      <span className="badge bg-gray-100 text-gray-700 font-medium">
                        {job.work_type}
                      </span>
                      <div className="text-gray-500 mt-1">
                        {job.salary_min || job.salary_max ? (
                          `₹${job.salary_min || 0} - ₹${job.salary_max || 0} / ${job.salary_type.toLowerCase()}`
                        ) : (
                          'Rate: Flexible'
                        )}
                      </div>
                    </td>

                    {/* Applications */}
                    <td className="px-5 py-4 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-dark bg-gray-100 px-2 py-0.5 rounded-md">
                        <Users className="w-3 h-3 text-gray-500" />
                        {job.applications_count}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {getStatusBadge(job.status)}
                    </td>

                    {/* Posted Date */}
                    <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>

                    {/* Moderation Action */}
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenModeration(job)}
                        className="btn-ghost btn-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                      >
                        <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                        {t('admin.changeStatus', 'Update Status')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.total_pages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {t('admin.paginationInfo', {
                page: data.page,
                totalPages: data.total_pages,
                total: data.total,
                defaultValue: `Page ${data.page} of ${data.total_pages} (${data.total} total)`,
              })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="btn-ghost btn-sm disabled:opacity-40"
              >
                {t('admin.paginationPrev', 'Previous')}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={data.page >= data.total_pages}
                className="btn-ghost btn-sm disabled:opacity-40"
              >
                {t('admin.paginationNext', 'Next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Moderation Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-dark text-lg">{t('admin.modalUpdateJobStatusTitle', 'Moderate Job Status')}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[240px]">{selectedJob.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-dark hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="py-4 space-y-4">
              <div>
                <label className="label">{t('admin.filterJobStatus', 'Job Status')}</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as JobStatus)}
                  className="input"
                >
                  <option value="ACTIVE">{t('admin.statusActive', 'Active (Open)')}</option>
                  <option value="CLOSED">{t('admin.statusClosed', 'Closed')}</option>
                  <option value="CANCELLED">{t('admin.statusCancelled', 'Cancelled')}</option>
                  <option value="DRAFT">{t('admin.statusDraft', 'Draft')}</option>
                </select>
              </div>

              <div>
                <label className="label">{t('admin.moderationReason', 'Moderation Reason (Optional)')}</label>
                <textarea
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  placeholder={t('admin.moderationReasonPlaceholder', 'Reason for status update...')}
                  rows={3}
                  className="input py-2"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
                Current status: <strong>{selectedJob.status}</strong> &bull; Total applications: <strong>{selectedJob.applications_count}</strong>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  disabled={updateStatusMutation.isPending}
                  className="btn-ghost btn-sm"
                >
                  {t('admin.closeModal', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="btn-primary btn-sm flex items-center gap-2"
                >
                  {updateStatusMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('admin.confirmStatusChange', 'Apply Status Change')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}