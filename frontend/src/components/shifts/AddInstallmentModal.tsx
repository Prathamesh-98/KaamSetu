import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, PlusCircle, AlertCircle, Info, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftsApi } from '../../api/services';
import type { ShiftBooking, PaymentRecord, PaymentMethod, PaymentUpdatePayload } from '../../types';

interface AddInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ShiftBooking | null;
  paymentRecord: PaymentRecord | null;
  onSuccess?: () => void;
}

export const AddInstallmentModal: React.FC<AddInstallmentModalProps> = ({
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

  const [installmentAmount, setInstallmentAmount] = useState<string>('0.00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentRecord && isOpen) {
      const balance = Number(paymentRecord.outstanding_balance) || 0;
      setInstallmentAmount(balance > 0 ? balance.toFixed(2) : '500.00');
      setPaymentMethod('UPI');
      setPaymentDate(toDateTimeLocal(new Date()));
      setPaymentReference('');
      setNotes('');
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

  const addInstallmentMutation = useMutation({
    mutationFn: (payload: PaymentUpdatePayload) => {
      if (!booking) throw new Error('No booking specified');
      return shiftsApi.updatePayment(booking.id, payload);
    },
    onSuccess: () => {
      toast.success(t('payments.installmentAddedSuccess', 'Payment installment added successfully!'));
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['work-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || t('payments.installmentAddedError', 'Failed to add payment installment');
      setValidationError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!booking || !paymentRecord) return;

    const amount = parseFloat(installmentAmount);
    if (isNaN(amount) || amount <= 0) {
      setValidationError(t('payments.errors.installmentMustBePositive', 'Installment amount must be greater than zero'));
      return;
    }

    const dateObj = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(dateObj.getTime())) {
      setValidationError(t('payments.errors.invalidPaymentDate', 'Please provide a valid payment date'));
      return;
    }

    // Prepare payload: use ONLY installment_amount as required by audited contract
    const payload: PaymentUpdatePayload = {
      installment_amount: amount,
      payment_method: paymentMethod,
      payment_date: dateObj.toISOString(),
      payment_reference: paymentReference.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    addInstallmentMutation.mutate(payload);
  };

  if (!isOpen || !booking || !paymentRecord) return null;

  const currentPaid = Number(paymentRecord.amount_paid) || 0;
  const agreed = Number(paymentRecord.agreed_amount) || 0;
  const balance = Number(paymentRecord.outstanding_balance) || 0;
  const nextNumber = (paymentRecord.installments?.length || 0) + 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-installment-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 id="add-installment-modal-title" className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#2455E8]" />
              {t('payments.addInstallmentTitle', 'Add Payment Installment')} #{nextNumber}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('payments.addInstallmentSubtitle', 'Log an additional offline payment tranche towards agreed shift fee')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Balance Summary Ribbon ── */}
        <div className="bg-blue-50/40 p-4 border-b border-blue-100/60 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-gray-500 block">{t('payments.agreedAmount', 'Agreed')}</span>
            <span className="font-bold text-gray-900 text-sm">₹{agreed.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-blue-700 block">{t('payments.amountPaid', 'Already Paid')}</span>
            <span className="font-bold text-blue-900 text-sm">₹{currentPaid.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-amber-800 block">{t('payments.outstandingBalance', 'Remaining')}</span>
            <span className="font-bold text-amber-900 text-sm">₹{balance.toFixed(2)}</span>
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

          <div>
            <label htmlFor="installment-amount" className="block text-xs font-medium text-gray-700 mb-1">
              {t('payments.installmentAmountLabel', 'Installment Amount (₹)')} *
            </label>
            <div className="relative">
              <input
                id="installment-amount"
                type="number"
                step="0.01"
                min="1"
                required
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                className="w-full text-base font-bold text-gray-900 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
              />
            </div>
            {balance > 0 && (
              <button
                type="button"
                onClick={() => setInstallmentAmount(balance.toFixed(2))}
                className="text-2xs text-[#2455E8] hover:underline mt-1 inline-block"
              >
                {t('payments.payFullRemaining', 'Pay full remaining balance (₹{{balance}})', { balance: balance.toFixed(2) })}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="installment-payment-method" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.paymentMethod', 'Payment Method')} *
              </label>
              <select
                id="installment-payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
              >
                <option value="UPI">{t('payments.method.upi', 'UPI (GPay / PhonePe / Paytm)')}</option>
                <option value="CASH">{t('payments.method.cash', 'Cash in Hand')}</option>
                <option value="BANK_TRANSFER">{t('payments.method.bank_transfer', 'Bank Transfer / NEFT')}</option>
                <option value="OTHER">{t('payments.method.other', 'Other')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="installment-payment-date" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.paymentDate', 'Payment Date')} *
              </label>
              <input
                id="installment-payment-date"
                type="datetime-local"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="installment-reference" className="block text-xs font-medium text-gray-700 mb-1">
              {t('payments.reference', 'Reference # (Optional)')}
            </label>
            <input
              id="installment-reference"
              type="text"
              maxLength={100}
              placeholder={t('payments.referencePlaceholder', 'e.g., UPI Transaction ID')}
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="installment-notes" className="block text-xs font-medium text-gray-700 mb-1">
              {t('payments.notes', 'Notes / Memo (Optional)')}
            </label>
            <input
              id="installment-notes"
              type="text"
              maxLength={500}
              placeholder={t('payments.notesPlaceholder', 'e.g., Second tranche paid via GooglePay')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
            />
          </div>

          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-2xs text-blue-800 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[#2455E8] flex-shrink-0 mt-0.5" />
            <span>
              {t('payments.installmentNotice', 'Prior installments will remain preserved and confirmed. The worker will be notified to confirm receipt of this new tranche.')}
            </span>
          </div>

          {/* ── Modal Footer ── */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={addInstallmentMutation.isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={addInstallmentMutation.isPending}
              className="px-5 py-2 bg-[#2455E8] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {addInstallmentMutation.isPending
                  ? t('common.saving', 'Adding...')
                  : t('payments.addInstallmentBtn', 'Add Installment')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
