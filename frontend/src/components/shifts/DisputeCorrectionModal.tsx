import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftsApi } from '../../api/services';
import type { ShiftBooking, PaymentRecord, PaymentMethod, PaymentUpdatePayload } from '../../types';

interface DisputeCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ShiftBooking | null;
  paymentRecord: PaymentRecord | null;
  onSuccess?: () => void;
}

export const DisputeCorrectionModal: React.FC<DisputeCorrectionModalProps> = ({
  isOpen,
  onClose,
  booking,
  paymentRecord,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const toDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [revisedAmountPaid, setRevisedAmountPaid] = useState<string>('0.00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentRecord && isOpen) {
      setRevisedAmountPaid(String(paymentRecord.amount_paid || '0.00'));
      setPaymentMethod(paymentRecord.payment_method || 'UPI');
      setPaymentDate(toDateTimeLocal(new Date()));
      setPaymentReference(paymentRecord.payment_reference || '');
      setCorrectionNote('');
      setNotes(paymentRecord.notes || '');
      setValidationError(null);
    }
  }, [paymentRecord, isOpen]);

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

  const correctMutation = useMutation({
    mutationFn: (payload: PaymentUpdatePayload) => {
      if (!booking) throw new Error('No booking specified');
      return shiftsApi.updatePayment(booking.id, payload);
    },
    onSuccess: () => {
      toast.success(t('payments.disputeResolvedSuccess', 'Payment record updated and dispute cleared. Worker notified.'));
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['work-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || t('payments.disputeResolveError', 'Failed to update payment record');
      setValidationError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!booking || !paymentRecord) return;

    const amount = parseFloat(revisedAmountPaid);
    if (isNaN(amount) || amount < 0) {
      setValidationError(t('payments.errors.invalidPaid', 'Amount paid must be zero or positive'));
      return;
    }

    if (!correctionNote.trim()) {
      setValidationError(t('payments.errors.correctionNoteRequired', 'A resolution note explaining the correction is required'));
      return;
    }

    const dateObj = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(dateObj.getTime())) {
      setValidationError(t('payments.errors.invalidPaymentDate', 'Please provide a valid payment date'));
      return;
    }

    // Prepare payload: use ONLY amount_paid (for disputed record correction)
    const payload: PaymentUpdatePayload = {
      amount_paid: amount,
      correction_note: correctionNote.trim(),
      payment_method: paymentMethod,
      payment_date: dateObj.toISOString(),
      payment_reference: paymentReference.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    correctMutation.mutate(payload);
  };

  if (!isOpen || !booking || !paymentRecord) return null;

  const agreed = Number(paymentRecord.agreed_amount) || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-correction-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-amber-50/50">
          <div>
            <h3 id="dispute-correction-modal-title" className="font-bold text-lg text-amber-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              {t('payments.resolveDisputeModalTitle', 'Resolve Payment Dispute')}
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">
              {t('payments.resolveDisputeModalSubtitle', 'Correct payment details or record supplementary settlement')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Worker's Dispute Reason Banner ── */}
        <div className="p-4 bg-rose-50/70 border-b border-rose-100 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-rose-900 block">
                {t('payments.workerDisputeReasonLabel', 'Worker Dispute Explanation')}:
              </span>
              <p className="text-rose-800 italic mt-0.5">
                "{paymentRecord.dispute_reason || t('payments.noReasonProvided', 'No explanation provided.')}"
              </p>
            </div>
          </div>
        </div>

        {/* ── Modal Form ── */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="corr-agreed-amount" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.agreedAmount', 'Agreed Total (₹)')}
              </label>
              <input
                id="corr-agreed-amount"
                type="text"
                disabled
                value={`₹${agreed.toFixed(2)}`}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="revised-amount-paid" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.revisedAmountPaid', 'Revised Total Paid (₹)')} *
              </label>
              <input
                id="revised-amount-paid"
                type="number"
                step="0.01"
                min="0"
                required
                value={revisedAmountPaid}
                onChange={(e) => setRevisedAmountPaid(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent font-bold text-gray-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="correction-note" className="block text-xs font-medium text-gray-700 mb-1">
              {t('payments.correctionNoteLabel', 'Resolution / Correction Note')} *
            </label>
            <textarea
              id="correction-note"
              rows={2}
              required
              maxLength={500}
              placeholder={t('payments.correctionNotePlaceholder', 'e.g., Transferred remaining ₹500 via GPay, reference attached.')}
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent resize-none"
            />
            <span className="text-2xs text-gray-400 block mt-0.5">
              {t('payments.correctionNoteHelp', 'Archived into the audit dispute history for transparency')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="corr-payment-method" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.paymentMethod', 'Method')} *
              </label>
              <select
                id="corr-payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
              >
                <option value="UPI">{t('payments.method.upi', 'UPI')}</option>
                <option value="CASH">{t('payments.method.cash', 'Cash')}</option>
                <option value="BANK_TRANSFER">{t('payments.method.bank_transfer', 'Bank Transfer')}</option>
                <option value="OTHER">{t('payments.method.other', 'Other')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="corr-payment-date" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.paymentDate', 'Date')} *
              </label>
              <input
                id="corr-payment-date"
                type="datetime-local"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="corr-payment-reference" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.reference', 'Reference #')}
              </label>
              <input
                id="corr-payment-reference"
                type="text"
                maxLength={100}
                placeholder={t('payments.referencePlaceholder', 'Ref / UTR')}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="corr-notes" className="block text-xs font-medium text-gray-700 mb-1">
              {t('payments.notes', 'General Notes (Optional)')}
            </label>
            <input
              id="corr-notes"
              type="text"
              maxLength={500}
              placeholder={t('payments.notesPlaceholder', 'Optional general notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
            />
          </div>

          {/* ── Modal Footer ── */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={correctMutation.isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={correctMutation.isPending || !correctionNote.trim()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {correctMutation.isPending
                  ? t('common.saving', 'Updating...')
                  : t('payments.resolveDisputeBtn', 'Update & Clear Dispute')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
