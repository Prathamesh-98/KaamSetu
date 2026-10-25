import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FileText, Search, RefreshCw, AlertTriangle, Loader2,
  X, Briefcase, User, Building2, Calendar, DollarSign
} from 'lucide-react';
import { adminApi } from '../../api/services';
import type { AdminApplicationListItem, ApplicationStatus } from '../../types';

export default function AdminApplicationsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const [selectedApp, setSelectedApp] = useState<AdminApplicationListItem | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-applications', { search, statusFilter, page }],
    queryFn: () =>
      adminApi.listApplications({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        per_page: perPage,
      }),
  });

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
      case 'ACCEPTED':
        return <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">Accepted</span>;
      case 'REJECTED':
        return <span className="badge bg-red-50 text-red-700 border border-red-200">Rejected</span>;
      case 'WITHDRAWN':
        return <span className="badge bg-gray-100 text-gray-600 border border-gray-200">Withdrawn</span>;
      default:
        return <span className="badge bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark">{t('admin.applicationsTitle', 'Job Applications Management')}</h1>
            <p className="text-gray-500 text-sm">
              {t('admin.applicationsSubtitle', 'Platform-wide log of job applications submitted by workers to employers.')}
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
              placeholder={t('admin.searchApplicationsPlaceholder', 'Search by applicant name, job title, or employer...')}
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
              <option value="PENDING">{t('admin.appStatusPending', 'Pending')}</option>
              <option value="ACCEPTED">{t('admin.appStatusAccepted', 'Accepted')}</option>
              <option value="REJECTED">{t('admin.appStatusRejected', 'Rejected')}</option>
              <option value="WITHDRAWN">{t('admin.appStatusWithdrawn', 'Withdrawn')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications Table */}
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
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-semibold text-gray-700">{t('admin.noResultsFound', 'No records found matching criteria.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Applicant Worker</th>
                  <th className="px-5 py-3.5 font-semibold">Job Title</th>
                  <th className="px-5 py-3.5 font-semibold">Employer</th>
                  <th className="px-5 py-3.5 font-semibold">Proposed Rate</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Applied Date</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Worker */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-dark flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {app.worker_name}
                      </div>
                      {app.worker_phone && <div className="text-xs text-gray-500 mt-0.5">{app.worker_phone}</div>}
                    </td>

                    {/* Job Title */}
                    <td className="px-5 py-4 font-medium text-dark max-w-xs truncate">
                      {app.job_title}
                    </td>

                    {/* Employer */}
                    <td className="px-5 py-4 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        {app.employer_name || 'Employer'}
                      </span>
                    </td>

                    {/* Proposed Rate */}
                    <td className="px-5 py-4 text-xs font-medium text-dark">
                      {app.proposed_rate ? `₹${app.proposed_rate}` : <span className="text-gray-400">Standard</span>}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {getStatusBadge(app.status)}
                    </td>

                    {/* Applied Date */}
                    <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(app.applied_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="btn-ghost btn-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                      >
                        {t('admin.view', 'View')}
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

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-dark text-lg">Application Details</h3>
                  <p className="text-xs text-gray-500">Application ID: {selectedApp.id.slice(0, 8)}...</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-dark hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500 font-medium block">{t('admin.targetJob', 'Target Job')}</span>
                  <span className="text-dark font-semibold">{selectedApp.job_title}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">{t('admin.hiringEmployer', 'Hiring Employer')}</span>
                  <span className="text-dark font-medium">{selectedApp.employer_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">{t('admin.applicantWorker', 'Applicant Worker')}</span>
                  <span className="text-dark font-medium">{selectedApp.worker_name}</span>
                  {selectedApp.worker_phone && (
                    <span className="text-xs text-gray-500 block">{selectedApp.worker_phone}</span>
                  )}
                  {selectedApp.worker_email && (
                    <span className="text-xs text-gray-400 block font-mono">{selectedApp.worker_email}</span>
                  )}
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">{t('admin.proposedCompensation', 'Proposed Compensation')}</span>
                  <span className="text-dark font-medium">
                    {selectedApp.proposed_rate ? `₹${selectedApp.proposed_rate}` : 'Standard posted wage'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-500 font-medium block mb-1">
                  {t('admin.coverLetterTitle', 'Cover Letter / Notes')}
                </span>
                <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedApp.cover_letter || <span className="italic text-gray-400">No cover letter submitted.</span>}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Applied: {new Date(selectedApp.applied_at).toLocaleString()}</span>
                <span>Status: {getStatusBadge(selectedApp.status)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="btn-primary btn-sm"
              >
                {t('admin.closeModal', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}