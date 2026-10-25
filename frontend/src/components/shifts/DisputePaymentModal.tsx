import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, AlertCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftsApi } from '../../api/services';
import type { ShiftBooking, PaymentRecord } from '../../types';

interface DisputePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ShiftBooking | null;
  paymentRecord: PaymentRecord | null;
  onSuccess?: () => void;
}

export const DisputePaymentModal: React.FC<DisputePaymentModalProps> = ({
  isOpen,
  onClose,
  booking,
  paymentRecord,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [disputeReason, setDisputeReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const disputeMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!booking) throw new Error('No booking specified');
      return shiftsApi.disputePayment(booking.id, { dispute_reason: reason });
    },
    onSuccess: () => {
      toast.success(t('payments.disputeSubmittedSuccess', 'Dispute reported. Employer has been notified to review and correct the record.'));
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['work-history'] });
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || t('payments.disputeError', 'Failed to submit payment dispute');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = disputeReason.trim();
    if (trimmed.length < 5) {
      setError(t('payments.errors.disputeReasonMin', 'Dispute reason must be at least 5 characters long'));
      return;
    }

    disputeMutation.mutate(trimmed);
  };

  if (!isOpen || !booking || !paymentRecord) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-payment-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-rose-50/40">
          <div>
            <h3 id="dispute-payment-modal-title" className="font-bold text-lg text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              {t('payments.disputeModalTitle', 'Dispute Payment Record')}
            </h3>
            <p className="text-xs text-rose-700 mt-0.5">
              {t('payments.disputeModalSubtitle', 'Notify employer of a discrepancy in recorded amount or payment status')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Current Record Summary ── */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 text-xs flex justify-between items-center">
          <div>
            <span className="text-gray-500 block">{t('payments.recordedAmount', 'Recorded as paid')}:</span>
            <span className="font-bold text-gray-900 text-sm">₹{Number(paymentRecord.amount_paid).toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500 block">{t('payments.agreedAmount', 'Agreed')}:</span>
            <span className="font-bold text-gray-900 text-sm">₹{Number(paymentRecord.agreed_amount).toFixed(2)}</span>
          </div>
        </div>

        {/* ── Modal Form ── */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="dispute-reason" className="block text-xs font-medium text-gray-700 mb-1">
              {t('payments.disputeReasonLabel', 'Reason for Dispute')} *
            </label>
            <textarea
              id="dispute-reason"
              rows={4}
              required
              minLength={5}
              maxLength={1000}
              placeholder={t(
                'payments.disputePlaceholder',
                'Explain clearly what amount was received or why this payment record is incorrect (e.g. Received only ₹500 in cash, ₹500 is still unpaid).'
              )}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-between items-center text-2xs text-gray-400 mt-1">
              <span>{t('payments.disputeMinChars', 'Minimum 5 characters required')}</span>
              <span>{disputeReason.length} / 1000</span>
            </div>
          </div>

          <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100 text-2xs text-rose-800">
            {t(
              'payments.disputeNotice',
              'Submitting a dispute will put the payment record in DISPUTED status. The employer must review and update the record before it can be confirmed.'
            )}
          </div>

          {/* ── Modal Footer ── */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={disputeMutation.isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={disputeMutation.isPending || disputeReason.trim().length < 5}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {disputeMutation.isPending
                  ? t('payments.submittingDispute', 'Submitting...')
                  : t('payments.submitDisputeBtn', 'Submit Dispute')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
