import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ChevronDown, ChevronUp, AlertTriangle, ShieldAlert,
  Calendar, CreditCard, Hash, FileText, CheckCircle2, Clock
} from 'lucide-react';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import type { PaymentRecord } from '../../types';

interface PaymentHistoryCardProps {
  paymentRecord?: PaymentRecord | null;
  className?: string;
  defaultExpanded?: boolean;
}

export const PaymentHistoryCard: React.FC<PaymentHistoryCardProps> = ({
  paymentRecord,
  className = '',
  defaultExpanded = false,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!paymentRecord) {
    return (
      <div className={`p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center ${className}`}>
        <p className="text-sm text-gray-500">
          {t('payments.noRecord', 'No payment record has been created for this shift yet.')}
        </p>
      </div>
    );
  }

  const formatCurrency = (amt: number | string | undefined | null) => {
    const num = Number(amt) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const installments = paymentRecord.installments || [];
  const disputeHistory = paymentRecord.dispute_history || [];

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all ${className}`}>
      {/* ── Summary Header ── */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 text-base">
              {t('payments.summaryTitle', 'Payment & Settlement')}
            </h4>
            <PaymentStatusBadge status={paymentRecord.payment_status} />
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#2455E8] hover:text-blue-700 transition-colors"
            aria-expanded={isExpanded}
          >
            <span>
              {isExpanded
                ? t('payments.hideDetails', 'Hide Ledger')
                : t('payments.viewDetails', 'View Ledger')}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* ── Financial Metrics ── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block">
              {t('payments.agreedAmount', 'Agreed Amount')}
            </span>
            <span className="text-base sm:text-lg font-bold text-gray-900 block mt-0.5">
              {formatCurrency(paymentRecord.agreed_amount)}
            </span>
          </div>
          <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
            <span className="text-xs text-blue-700 font-medium block">
              {t('payments.amountPaid', 'Amount Paid')}
            </span>
            <span className="text-base sm:text-lg font-bold text-blue-900 block mt-0.5">
              {formatCurrency(paymentRecord.amount_paid)}
            </span>
          </div>
          <div className={`p-3 rounded-lg border ${Number(paymentRecord.outstanding_balance) > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/60 border-emerald-100'}`}>
            <span className={`text-xs font-medium block ${Number(paymentRecord.outstanding_balance) > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
              {t('payments.outstandingBalance', 'Outstanding')}
            </span>
            <span className={`text-base sm:text-lg font-bold block mt-0.5 ${Number(paymentRecord.outstanding_balance) > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
              {formatCurrency(paymentRecord.outstanding_balance)}
            </span>
          </div>
        </div>

        {/* ── Active Dispute Callout ── */}
        {paymentRecord.payment_status === 'DISPUTED' && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-rose-900 block">
                {t('payments.activeDisputeTitle', 'Payment Disputed by Worker')}
              </span>
              <p className="text-rose-800 mt-1 italic">
                "{paymentRecord.dispute_reason}"
              </p>
              {paymentRecord.disputed_at && (
                <span className="text-xs text-rose-600 mt-1 block">
                  {t('payments.disputedOn', 'Reported on')}: {formatDate(paymentRecord.disputed_at)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Expandable Details & Installment Ledger ── */}
      {isExpanded && (
        <div className="bg-gray-50/60 border-t border-gray-100 p-4 sm:p-5 space-y-5">
          {/* Installment History Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-gray-500" />
                {t('payments.installmentLedger', 'Installment Settlement History')}
                <span className="text-xs text-gray-500 font-normal">
                  ({installments.length} {t('payments.installmentsCount', 'records')})
                </span>
              </h5>
            </div>

            {installments.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white p-4 rounded-lg border border-gray-200 text-center">
                {t('payments.noInstallments', 'No installments have been logged yet.')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {installments.map((inst) => (
                  <div
                    key={inst.id}
                    className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2455E8] flex items-center justify-center font-bold text-xs flex-shrink-0">
                        #{inst.installment_number}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">
                            {formatCurrency(inst.amount)}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {t(`payments.method.${inst.payment_method.toLowerCase()}`, inst.payment_method)}
                          </span>
                          {inst.payment_reference && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-mono">
                              <Hash className="w-3 h-3 text-gray-400" />
                              {inst.payment_reference}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {formatDate(inst.payment_date)}
                          </span>
                          {inst.notes && (
                            <span className="flex items-center gap-1 text-gray-600 truncate max-w-xs">
                              <FileText className="w-3 h-3 text-gray-400" />
                              {inst.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Confirmation Badge */}
                    <div className="flex items-center self-end sm:self-center">
                      {inst.is_confirmed || inst.worker_confirmed_at ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('payments.workerConfirmed', 'Worker Confirmed')}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t('payments.pendingConfirmation', 'Pending Confirmation')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Dispute Resolution History */}
          {disputeHistory.length > 0 && (
            <div className="pt-3 border-t border-gray-200">
              <h5 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-gray-500" />
                {t('payments.disputeAuditHistory', 'Dispute Resolution Audit History')}
              </h5>
              <div className="space-y-2">
                {disputeHistory.map((entry, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-700 space-y-1">
                    <div className="flex justify-between items-center text-gray-500 font-medium">
                      <span>{t('payments.correctionOn', 'Resolved on')}: {formatDate(entry.corrected_at)}</span>
                      <span>{t('payments.priorAmount', 'Prior amount')}: {formatCurrency(entry.previous_amount_paid)} ({entry.previous_payment_method})</span>
                    </div>
                    {entry.dispute_reason && (
                      <p className="text-rose-700 italic">
                        <strong>{t('payments.disputeReason', 'Dispute reason')}:</strong> {entry.dispute_reason}
                      </p>
                    )}
                    {entry.correction_note && (
                      <p className="text-emerald-700 font-medium">
                        <strong>{t('payments.correctionNote', 'Correction note')}:</strong> {entry.correction_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KaamSetu Disclaimer */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 flex items-start gap-2">
              <span className="font-semibold text-blue-900 flex-shrink-0">
                {t('payments.disclaimerLabel', 'Notice')}:
              </span>
              <span>
                {t('payments.disclaimerText', 'KaamSetu is an informational record of offline settlement agreed between worker and employer. KaamSetu does not hold, process, or escrow funds.')}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
