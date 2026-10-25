import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Receipt, Search, Filter, RefreshCw, AlertTriangle, Loader2,
  X, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  CreditCard, Info, ShieldAlert
} from 'lucide-react';
import { adminApi } from '../../api/services';
import type { AdminCompletedWorkItem, PaymentStatus, PaymentMethod } from '../../types';

export default function AdminPaymentsPage() {
  const { t } = useTranslation();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [disputedOnly, setDisputedOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const perPage = 15;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-completed-work', { paymentStatusFilter, disputedOnly, page }],
    queryFn: () =>
      adminApi.listCompletedWork({
        payment_status: paymentStatusFilter !== 'ALL' ? paymentStatusFilter : undefined,
        disputed_only: disputedOnly ? true : undefined,
        page,
        per_page: perPage,
      }),
  });

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmed (Settled)</span>;
      case 'PARTIALLY_PAID':
        return <span className="badge bg-amber-50 text-amber-700 border border-amber-200">Partially Paid</span>;
      case 'PENDING_CONFIRMATION':
        return <span className="badge bg-blue-50 text-blue-700 border border-blue-200">Pending Confirmation</span>;
      case 'DISPUTED':
        return <span className="badge bg-red-50 text-red-700 border border-red-200">Disputed</span>;
      default:
        return <span className="badge bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH':
        return <span className="badge bg-gray-100 text-gray-700">Cash</span>;
      case 'UPI':
        return <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200">UPI</span>;
      case 'BANK_TRANSFER':
        return <span className="badge bg-blue-50 text-blue-700 border border-blue-200">Bank Transfer</span>;
      default:
        return <span className="badge bg-gray-100 text-gray-700">{method}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark">{t('admin.paymentsTitle', 'Completed Work & Offline Settlement Ledger')}</h1>
            <p className="text-gray-500 text-sm">
              {t('admin.paymentsSubtitle', 'Audit log of completed shifts, agreed wages, recorded offline cash/UPI settlements, and dispute flags.')}
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

      {/* Ledger Architecture Banner */}
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-teal-900 leading-relaxed">
          <strong>Offline Settlement Audit:</strong> {t('admin.offlineLedgerNotice', 'KaamSetu operates an offline settlement recording ledger. Payments are exchanged directly in person between employer and worker. No payment gateway or escrow is involved.')}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8">
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input text-sm"
            >
              <option value="ALL">{t('admin.allStatuses', 'All Payment Statuses')}</option>
              <option value="PENDING_CONFIRMATION">Pending Confirmation</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="CONFIRMED">Confirmed (Settled)</option>
              <option value="DISPUTED">Disputed</option>
            </select>
          </div>
          <div className="md:col-span-4 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 select-none">
              <input
                type="checkbox"
                checked={disputedOnly}
                onChange={(e) => {
                  setDisputedOnly(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
              {t('admin.disputedOnlyFilter', 'Disputed Work Only')}
            </label>
          </div>
        </div>
      </div>

      {/* Completed Work Ledger Table */}
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
            <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-semibold text-gray-700">{t('admin.noResultsFound', 'No records found matching criteria.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Shift / Parties</th>
                  <th className="px-5 py-3.5 font-semibold">Hours Worked</th>
                  <th className="px-5 py-3.5 font-semibold">Agreed Wage</th>
                  <th className="px-5 py-3.5 font-semibold">Settled / Balance</th>
                  <th className="px-5 py-3.5 font-semibold">Status & Disputes</th>
                  <th className="px-5 py-3.5 font-semibold">Completed</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Installments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.items.map((item) => {
                  const isExpanded = expandedId === item.completion_id;
                  const isDisputed = Boolean(item.dispute_reason);
                  return (
                    <React.Fragment key={item.completion_id}>
                      <tr className={`hover:bg-gray-50/80 transition-colors ${isDisputed ? 'bg-red-50/20' : ''}`}>
                        {/* Parties & Job */}
                        <td className="px-5 py-4">
                          <div className="font-semibold text-dark">{item.job_title || 'Shift Work'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Worker: <span className="text-dark font-medium">{item.worker_name}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Employer: <span className="text-dark font-medium">{item.employer_name}</span>
                          </div>
                        </td>

                        {/* Hours */}
                        <td className="px-5 py-4 text-xs font-medium text-dark">
                          {item.hours_worked} hrs
                        </td>

                        {/* Agreed Amount */}
                        <td className="px-5 py-4 text-xs font-semibold text-dark">
                          ₹{item.agreed_amount.toLocaleString()}
                        </td>

                        {/* Settled & Balance */}
                        <td className="px-5 py-4 text-xs">
                          <div className="text-emerald-700 font-medium">
                            ₹{item.amount_paid.toLocaleString()} paid
                          </div>
                          <div className={`text-[11px] mt-0.5 ${item.outstanding_balance > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                            ₹{item.outstanding_balance.toLocaleString()} balance
                          </div>
                        </td>

                        {/* Status & Dispute */}
                        <td className="px-5 py-4">
                          <div>{getPaymentStatusBadge(item.payment_status)}</div>
                          {isDisputed && (
                            <div className="mt-1">
                              <span className="badge bg-red-100 text-red-800 border border-red-200 text-[10px] flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-red-600" />
                                {t('admin.disputeFlag', 'Dispute Reported')}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Completed Date */}
                        <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(item.completed_at).toLocaleDateString()}
                        </td>

                        {/* Toggle Installments */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.completion_id)}
                            className="btn-ghost btn-sm text-xs flex items-center gap-1 ml-auto"
                          >
                            <span>{item.installments.length} records</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Installments & Dispute Details */}
                      {isExpanded && (
                        <tr className="bg-gray-50/70 border-b border-gray-100">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-3">
                              {/* Dispute detail banner if disputed */}
                              {isDisputed && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
                                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-red-800">
                                    <ShieldAlert className="w-4 h-4 text-red-600" />
                                    <span>{t('admin.disputeReason', 'Dispute Reason')}:</span>
                                  </div>
                                  <p className="leading-relaxed bg-white/70 p-2 rounded-lg border border-red-100">
                                    {item.dispute_reason}
                                  </p>
                                  {item.disputed_at && (
                                    <div className="text-[11px] text-red-600 mt-1">
                                      {t('admin.disputeDate', 'Reported Date')}: {new Date(item.disputed_at).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Installments Table */}
                              <div>
                                <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">
                                  {t('admin.installmentsTitle', 'Recorded Settlement Installments')}
                                </h4>
                                {item.installments.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">
                                    {t('admin.noInstallments', 'No settlement installments recorded yet.')}
                                  </p>
                                ) : (
                                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-100/70 text-gray-600">
                                        <tr>
                                          <th className="px-3 py-2 font-medium">#</th>
                                          <th className="px-3 py-2 font-medium">Amount</th>
                                          <th className="px-3 py-2 font-medium">Method</th>
                                          <th className="px-3 py-2 font-medium">Reference</th>
                                          <th className="px-3 py-2 font-medium">Date</th>
                                          <th className="px-3 py-2 font-medium">Worker Confirmation</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {item.installments.map((inst) => (
                                          <tr key={inst.id}>
                                            <td className="px-3 py-2 font-semibold text-gray-700">{inst.installment_number}</td>
                                            <td className="px-3 py-2 font-bold text-dark">₹{inst.amount.toLocaleString()}</td>
                                            <td className="px-3 py-2">{getMethodBadge(inst.payment_method)}</td>
                                            <td className="px-3 py-2 text-gray-500 font-mono">{inst.payment_reference || '-'}</td>
                                            <td className="px-3 py-2 text-gray-500">{new Date(inst.payment_date).toLocaleDateString()}</td>
                                            <td className="px-3 py-2">
                                              {inst.is_confirmed ? (
                                                <span className="text-emerald-700 flex items-center gap-1 font-medium">
                                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                                  {t('admin.installmentConfirmed', 'Confirmed by Worker')}
                                                </span>
                                              ) : (
                                                <span className="text-amber-700 flex items-center gap-1">
                                                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                  {t('admin.installmentPendingConfirm', 'Pending Worker Confirmation')}
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
    </div>
  );
}