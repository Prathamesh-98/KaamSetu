import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  HardHat, Search, CheckCircle, ShieldCheck, Phone, Mail,
  MapPin, Briefcase, Award, RefreshCw, AlertTriangle, Loader2,
  ExternalLink, X, Calendar
} from 'lucide-react';
import { adminApi } from '../../api/services';
import type { AdminWorkerListItem } from '../../types';

export default function AdminWorkersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 15;

  const [selectedWorker, setSelectedWorker] = useState<AdminWorkerListItem | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-workers', { search, verifiedOnly, page }],
    queryFn: () =>
      adminApi.listWorkers({
        search: search.trim() || undefined,
        verified_only: verifiedOnly ? true : undefined,
        page,
        per_page: perPage,
      }),
  });

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark">{t('admin.workersTitle', 'Worker Management')}</h1>
            <p className="text-gray-500 text-sm">
              {t('admin.workersSubtitle', 'Directory of registered workers, profiles, skills, and verification status.')}
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
              placeholder={t('admin.searchWorkersPlaceholder', 'Search workers by name, city, or skill...')}
              className="input pl-9 text-sm"
            />
          </div>
          <div className="md:col-span-4 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 select-none">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => {
                  setVerifiedOnly(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
              {t('admin.verifiedWorkersOnly', 'Verified Workers Only')}
            </label>
          </div>
        </div>
      </div>

      {/* Workers Table */}
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
            <HardHat className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-semibold text-gray-700">{t('admin.noResultsFound', 'No records found matching criteria.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Worker</th>
                  <th className="px-5 py-3.5 font-semibold">Skills</th>
                  <th className="px-5 py-3.5 font-semibold">Location</th>
                  <th className="px-5 py-3.5 font-semibold">Experience / Rates</th>
                  <th className="px-5 py-3.5 font-semibold">Verification</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Worker Name & Contact */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-dark">{w.full_name}</div>
                      {w.phone && <div className="text-xs text-gray-500 mt-0.5">{w.phone}</div>}
                      {w.email && <div className="text-xs text-gray-400 font-mono mt-0.5">{w.email}</div>}
                    </td>

                    {/* Skills list */}
                    <td className="px-5 py-4 max-w-xs">
                      {w.skills && w.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {w.skills.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="badge bg-gray-100 text-gray-700 text-[11px]">
                              {skill}
                            </span>
                          ))}
                          {w.skills.length > 3 && (
                            <span className="badge bg-gray-200 text-gray-600 text-[11px]">
                              +{w.skills.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">{t('admin.noSkillsListed', 'No skills listed')}</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {w.city || w.state ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {[w.city, w.state].filter(Boolean).join(', ')}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Not specified</span>
                      )}
                    </td>

                    {/* Rates & Experience */}
                    <td className="px-5 py-4 text-xs text-gray-600">
                      <div>
                        {w.experience_years ? (
                          <span className="font-medium text-dark">{w.experience_years} yrs exp</span>
                        ) : (
                          <span className="text-gray-400">0 yrs</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-gray-500">
                        {w.daily_rate ? `₹${w.daily_rate}/day` : w.hourly_rate ? `₹${w.hourly_rate}/hr` : 'Rate: N/A'}
                      </div>
                    </td>

                    {/* Verification */}
                    <td className="px-5 py-4">
                      {w.is_verified || w.is_identity_verified ? (
                        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 mr-1 inline" />
                          {t('admin.verifiedBadge', 'Verified')}
                        </span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-500">
                          {t('admin.unverifiedBadge', 'Unverified')}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedWorker(w)}
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

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-dark text-lg">{selectedWorker.full_name}</h3>
                  <p className="text-xs text-gray-500">Worker Profile ID: {selectedWorker.id.slice(0, 8)}...</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWorker(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-dark hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500 font-medium block">{t('admin.contactPhone', 'Phone')}</span>
                  <span className="text-dark font-medium">{selectedWorker.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">{t('admin.contactEmail', 'Email')}</span>
                  <span className="text-dark font-medium">{selectedWorker.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">{t('admin.workerLocation', 'Location')}</span>
                  <span className="text-dark font-medium">
                    {[selectedWorker.city, selectedWorker.state].filter(Boolean).join(', ') || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Experience</span>
                  <span className="text-dark font-medium">{selectedWorker.experience_years ?? 0} years</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Daily Rate</span>
                  <span className="text-dark font-medium">
                    {selectedWorker.daily_rate ? `₹${selectedWorker.daily_rate}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Hourly Rate</span>
                  <span className="text-dark font-medium">
                    {selectedWorker.hourly_rate ? `₹${selectedWorker.hourly_rate}` : 'N/A'}
                  </span>
                </div>
              </div>

              {selectedWorker.bio && (
                <div>
                  <span className="text-xs text-gray-500 font-medium block mb-1">Bio</span>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-xl text-xs leading-relaxed">
                    {selectedWorker.bio}
                  </p>
                </div>
              )}

              <div>
                <span className="text-xs text-gray-500 font-medium block mb-1">Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedWorker.skills.map((s, i) => (
                    <span key={i} className="badge bg-amber-50 text-amber-800 border border-amber-200">
                      {s}
                    </span>
                  ))}
                  {selectedWorker.skills.length === 0 && (
                    <span className="text-xs text-gray-400 italic">No skills added</span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Registered: {new Date(selectedWorker.created_at).toLocaleDateString()}</span>
                <span>
                  Status:{' '}
                  <strong className={selectedWorker.is_active ? 'text-emerald-600' : 'text-red-500'}>
                    {selectedWorker.is_active ? 'Active' : 'Suspended'}
                  </strong>
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
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