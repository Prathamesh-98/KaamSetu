import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Users, Search, Filter, Shield, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Check, AlertCircle, Loader2, UserCheck, UserX
} from 'lucide-react';
import { adminApi } from '../../api/services';
import { extractErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole, AdminUserItem } from '../../types';

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const perPage = 15;

  // Selected user for status confirmation modal
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch users
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-users', { search, roleFilter, statusFilter, page }],
    queryFn: () => {
      const is_active = statusFilter === 'active' ? true : statusFilter === 'suspended' ? false : undefined;
      return adminApi.listUsers({
        search: search.trim() || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        is_active,
        page,
        per_page: perPage,
      });
    },
  });

  // Toggle user status mutation
  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.toggleUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setStatusFeedback({
        type: 'success',
        message: t('admin.userStatusSuccess', 'User account status updated successfully.'),
      });
      setSelectedUser(null);
      setActionType(null);
      setTimeout(() => setStatusFeedback(null), 4000);
    },
    onError: (err: unknown) => {
      setStatusFeedback({
        type: 'error',
        message: extractErrorMessage(err),
      });
      setSelectedUser(null);
      setActionType(null);
      setTimeout(() => setStatusFeedback(null), 6000);
    },
  });

  const handleOpenActionModal = (userItem: AdminUserItem, action: 'suspend' | 'activate') => {
    if (userItem.id === currentAdmin?.id && action === 'suspend') {
      setStatusFeedback({
        type: 'error',
        message: t('admin.selfSuspendForbidden', 'You cannot suspend your own admin account.'),
      });
      setTimeout(() => setStatusFeedback(null), 4000);
      return;
    }
    setSelectedUser(userItem);
    setActionType(action);
  };

  const handleConfirmAction = () => {
    if (!selectedUser || !actionType) return;
    toggleMutation.mutate({
      userId: selectedUser.id,
      isActive: actionType === 'activate',
    });
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return <span className="badge bg-purple-100 text-purple-800 border border-purple-200">Admin</span>;
      case 'EMPLOYER':
        return <span className="badge bg-blue-100 text-blue-800 border border-blue-200">Employer</span>;
      case 'WORKER':
        return <span className="badge bg-amber-100 text-amber-800 border border-amber-200">Worker</span>;
      default:
        return <span className="badge bg-gray-100 text-gray-800">{role}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-dark">{t('admin.usersTitle', 'User Management')}</h1>
              <p className="text-gray-500 text-sm">{t('admin.usersSubtitle', 'Search, filter, and manage platform user accounts, roles, and status.')}</p>
            </div>
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

      {/* Status Feedback banner */}
      {statusFeedback && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusFeedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span>{statusFeedback.message}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search box */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('admin.searchUsersPlaceholder', 'Search by name, email, or phone...')}
              className="input pl-9 text-sm"
            />
          </div>

          {/* Role Filter */}
          <div className="md:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="input text-sm"
            >
              <option value="ALL">{t('admin.allRoles', 'All Roles')}</option>
              <option value="WORKER">{t('admin.roleWorker', 'Worker')}</option>
              <option value="EMPLOYER">{t('admin.roleEmployer', 'Employer')}</option>
              <option value="ADMIN">{t('admin.roleAdmin', 'Admin')}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input text-sm"
            >
              <option value="all">{t('admin.allStatuses', 'All Statuses')}</option>
              <option value="active">{t('admin.activeOnly', 'Active Only')}</option>
              <option value="suspended">{t('admin.suspendedOnly', 'Suspended Only')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table / List */}
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
            <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-semibold text-gray-700">{t('admin.noResultsFound', 'No records found matching criteria.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">User / Profile</th>
                  <th className="px-5 py-3.5 font-semibold">Role</th>
                  <th className="px-5 py-3.5 font-semibold">Account Status</th>
                  <th className="px-5 py-3.5 font-semibold">Verification</th>
                  <th className="px-5 py-3.5 font-semibold">Registered</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map((u) => {
                  const isCurrentAdmin = u.id === currentAdmin?.id;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Name & Email */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-dark">
                          {u.full_name || <span className="text-gray-400 italic">No Name</span>}
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{u.email}</div>
                        {u.phone && <div className="text-xs text-gray-500 mt-0.5">{u.phone}</div>}
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        {getRoleBadge(u.role)}
                      </td>

                      {/* Active Status */}
                      <td className="px-5 py-4">
                        {u.is_active ? (
                          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1"></span>
                            {t('admin.accountActive', 'Active')}
                          </span>
                        ) : (
                          <span className="badge bg-red-50 text-red-700 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1"></span>
                            {t('admin.accountSuspended', 'Suspended')}
                          </span>
                        )}
                      </td>

                      {/* Verification Status */}
                      <td className="px-5 py-4">
                        {u.is_verified ? (
                          <span className="badge bg-blue-50 text-blue-700 border border-blue-200">
                            <Check className="w-3 h-3 mr-1 inline" />
                            {t('admin.verifiedBadge', 'Verified')}
                          </span>
                        ) : (
                          <span className="badge bg-gray-100 text-gray-500">
                            {t('admin.unverifiedBadge', 'Unverified')}
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isCurrentAdmin ? (
                          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md">
                            Current Admin
                          </span>
                        ) : u.is_active ? (
                          <button
                            onClick={() => handleOpenActionModal(u, 'suspend')}
                            className="btn-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5 inline mr-1" />
                            {t('admin.actionSuspend', 'Suspend')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenActionModal(u, 'activate')}
                            className="btn-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                            {t('admin.actionActivate', 'Activate')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      {/* Confirmation Modal */}
      {selectedUser && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  actionType === 'suspend' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {actionType === 'suspend' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-dark text-lg">
                  {actionType === 'suspend'
                    ? t('admin.confirmSuspendTitle', 'Confirm User Suspension')
                    : t('admin.confirmActivateTitle', 'Confirm User Activation')}
                </h3>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {actionType === 'suspend'
                ? t(
                    'admin.confirmSuspendMsg',
                    'Are you sure you want to suspend this user? Their active sessions will be terminated immediately.'
                  )
                : t(
                    'admin.confirmActivateMsg',
                    'Are you sure you want to activate this user account?'
                  )}
            </p>

            <div className="p-3 bg-gray-50 rounded-xl mb-6 text-xs text-gray-700 space-y-1">
              <div><span className="font-semibold">User:</span> {selectedUser.full_name || 'N/A'}</div>
              <div><span className="font-semibold">Email:</span> {selectedUser.email}</div>
              <div><span className="font-semibold">Role:</span> {selectedUser.role}</div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setActionType(null);
                }}
                disabled={toggleMutation.isPending}
                className="btn-ghost btn-sm"
              >
                {t('admin.closeModal', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={toggleMutation.isPending}
                className={`btn-sm ${actionType === 'suspend' ? 'btn-danger' : 'btn-primary'} flex items-center gap-2`}
              >
                {toggleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {actionType === 'suspend'
                  ? t('admin.actionSuspend', 'Suspend User')
                  : t('admin.actionActivate', 'Activate User')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}