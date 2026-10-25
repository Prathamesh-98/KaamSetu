import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle, AlertCircle, Info, Calendar, DollarSign, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftsApi } from '../../api/services';
import type { ShiftBooking, PaymentMethod, WorkCompletionCreatePayload } from '../../types';

interface CompleteShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ShiftBooking | null;
  onSuccess?: () => void;
}

export const CompleteShiftModal: React.FC<CompleteShiftModalProps> = ({
  isOpen,
  onClose,
  booking,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Helper to format ISO to datetime-local input string YYYY-MM-DDTHH:mm
  const toDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [actualStartTime, setActualStartTime] = useState('');
  const [actualEndTime, setActualEndTime] = useState('');
  const [hoursWorked, setHoursWorked] = useState<string>('8.00');
  const [completionNotes, setCompletionNotes] = useState('');
  const [agreedAmount, setAgreedAmount] = useState<string>('0.00');
  const [amountPaid, setAmountPaid] = useState<string>('0.00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize values when booking changes
  useEffect(() => {
    if (booking && isOpen) {
      const now = new Date();
      const schedStart = booking.start_time ? new Date(booking.start_time) : new Date(now.getTime() - 8 * 3600 * 1000);
      const schedEnd = booking.end_time ? new Date(booking.end_time) : now;

      // Cap at now if in future
      const safeStart = schedStart.getTime() > now.getTime() ? new Date(now.getTime() - 4 * 3600 * 1000) : schedStart;
      const safeEnd = schedEnd.getTime() > now.getTime() ? now : schedEnd;

      setActualStartTime(toDateTimeLocal(safeStart));
      setActualEndTime(toDateTimeLocal(safeEnd));

      // Calculate initial hours
      const diffHours = Math.max(0.5, (safeEnd.getTime() - safeStart.getTime()) / (1000 * 3600));
      setHoursWorked(diffHours.toFixed(2));

      const rate = booking.proposed_rate ? String(booking.proposed_rate) : '1000.00';
      setAgreedAmount(rate);
      setAmountPaid(rate); // Default initial settlement to full agreed
      setPaymentMethod('CASH');
      setPaymentDate(toDateTimeLocal(now));
      setPaymentReference('');
      setPaymentNotes('');
      setCompletionNotes('');
      setValidationError(null);
    }
  }, [booking, isOpen]);

  // Recalculate default hours when start/end times change
  const handleStartTimeChange = (val: string) => {
    setActualStartTime(val);
    if (val && actualEndTime) {
      const start = new Date(val).getTime();
      const end = new Date(actualEndTime).getTime();
      if (end > start) {
        const diff = (end - start) / (1000 * 3600);
        setHoursWorked(diff.toFixed(2));
      }
    }
  };

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

  const handleEndTimeChange = (val: string) => {
    setActualEndTime(val);
    if (actualStartTime && val) {
      const start = new Date(actualStartTime).getTime();
      const end = new Date(val).getTime();
      if (end > start) {
        const diff = (end - start) / (1000 * 3600);
        setHoursWorked(diff.toFixed(2));
      }
    }
  };

  const completeMutation = useMutation({
    mutationFn: (payload: WorkCompletionCreatePayload) => {
      if (!booking) throw new Error('No booking specified');
      return shiftsApi.completeShift(booking.id, payload);
    },
    onSuccess: () => {
      toast.success(t('payments.completeSuccess', 'Shift completed and payment record saved!'));
      queryClient.invalidateQueries({ queryKey: ['employer-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['work-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || t('payments.completeError', 'Failed to complete shift and record payment');
      setValidationError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!booking) return;

    const start = new Date(actualStartTime);
    const end = new Date(actualEndTime);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setValidationError(t('payments.errors.invalidDates', 'Please specify valid start and end dates'));
      return;
    }

    if (end.getTime() <= start.getTime()) {
      setValidationError(t('payments.errors.endAfterStart', 'Actual end time must be after actual start time'));
      return;
    }

    if (start.getTime() > now.getTime()) {
      setValidationError(t('payments.errors.startFuture', 'Actual start time cannot be in the future'));
      return;
    }

    if (end.getTime() > now.getTime()) {
      setValidationError(t('payments.errors.endFuture', 'Actual end time cannot be in the future'));
      return;
    }

    const elapsedHours = (end.getTime() - start.getTime()) / (1000 * 3600);
    const numHours = parseFloat(hoursWorked);

    if (isNaN(numHours) || numHours <= 0 || numHours > 24) {
      setValidationError(t('payments.errors.hoursRange', 'Hours worked must be between 0 and 24'));
      return;
    }

    if (numHours > elapsedHours + 0.25) {
      setValidationError(
        t(
          'payments.errors.hoursExceedDuration',
          `Hours worked (${numHours}) exceeds the elapsed duration (${elapsedHours.toFixed(2)}h + 15 min buffer)`
        )
      );
      return;
    }

    const numAgreed = parseFloat(agreedAmount);
    const numPaid = parseFloat(amountPaid);

    if (isNaN(numAgreed) || numAgreed < 0) {
      setValidationError(t('payments.errors.invalidAgreed', 'Agreed amount must be zero or positive'));
      return;
    }

    if (isNaN(numPaid) || numPaid < 0) {
      setValidationError(t('payments.errors.invalidPaid', 'Amount paid must be zero or positive'));
      return;
    }

    const payDate = paymentDate ? new Date(paymentDate) : now;
    if (isNaN(payDate.getTime())) {
      setValidationError(t('payments.errors.invalidPaymentDate', 'Please provide a valid payment date'));
      return;
    }

    const payload: WorkCompletionCreatePayload = {
      actual_start_time: start.toISOString(),
      actual_end_time: end.toISOString(),
      hours_worked: numHours,
      completion_notes: completionNotes.trim() || undefined,
      agreed_amount: numAgreed,
      amount_paid: numPaid,
      payment_method: paymentMethod,
      payment_date: payDate.toISOString(),
      payment_reference: paymentReference.trim() || undefined,
      payment_notes: paymentNotes.trim() || undefined,
    };

    completeMutation.mutate(payload);
  };

  if (!isOpen || !booking) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-shift-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden my-8">
        {/* ── Modal Header ── */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 id="complete-shift-modal-title" className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              {t('payments.completeModalTitle', 'Complete Shift & Record Payment')}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('payments.completeModalSubtitle', 'Log actual shift hours and record offline settlement details')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Form ── */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. Actual Work Completion Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {t('payments.workDetailsSection', '1. Actual Shift Execution')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="actual-start-time" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.actualStartTime', 'Actual Start Time')} *
                </label>
                <input
                  id="actual-start-time"
                  type="datetime-local"
                  required
                  value={actualStartTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="actual-end-time" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.actualEndTime', 'Actual End Time')} *
                </label>
                <input
                  id="actual-end-time"
                  type="datetime-local"
                  required
                  value={actualEndTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="hours-worked" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.hoursWorked', 'Hours Worked')} *
                </label>
                <input
                  id="hours-worked"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  required
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent font-medium"
                />
                <span className="text-2xs text-gray-400 mt-0.5 block">
                  {t('payments.hoursHelp', '15 min buffer permitted over duration')}
                </span>
              </div>
              <div>
                <label htmlFor="completion-notes" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.completionNotes', 'Completion Notes (Optional)')}
                </label>
                <input
                  id="completion-notes"
                  type="text"
                  maxLength={500}
                  placeholder={t('payments.notesPlaceholder', 'e.g., Completed painting 2 rooms smoothly')}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 2. Payment Settlement Section */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
              {t('payments.paymentDetailsSection', '2. Offline Payment Settlement')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="agreed-amount" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.agreedAmount', 'Agreed Total (₹)')} *
                </label>
                <input
                  id="agreed-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={agreedAmount}
                  onChange={(e) => setAgreedAmount(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent font-semibold"
                />
              </div>
              <div>
                <label htmlFor="amount-paid" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.initialAmountPaid', 'Initial Amount Paid (₹)')} *
                </label>
                <input
                  id="amount-paid"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent font-semibold text-emerald-800"
                />
                <span className="text-2xs text-gray-400 mt-0.5 block">
                  {parseFloat(amountPaid) < parseFloat(agreedAmount)
                    ? t('payments.partialNotice', 'Will be saved as partial payment')
                    : t('payments.fullNotice', 'Full payment recorded')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="payment-method" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.paymentMethod', 'Method')} *
                </label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
                >
                  <option value="CASH">{t('payments.method.cash', 'Cash in Hand')}</option>
                  <option value="UPI">{t('payments.method.upi', 'UPI (GPay / PhonePe / Paytm)')}</option>
                  <option value="BANK_TRANSFER">{t('payments.method.bank_transfer', 'Bank Transfer / NEFT')}</option>
                  <option value="OTHER">{t('payments.method.other', 'Other')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="payment-date" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.paymentDate', 'Payment Date')} *
                </label>
                <input
                  id="payment-date"
                  type="datetime-local"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="payment-reference" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('payments.reference', 'Reference # (Optional)')}
                </label>
                <input
                  id="payment-reference"
                  type="text"
                  maxLength={100}
                  placeholder={t('payments.referencePlaceholder', 'e.g., UPI Ref / Slip')}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="payment-notes" className="block text-xs font-medium text-gray-700 mb-1">
                {t('payments.paymentNotes', 'Payment Notes (Optional)')}
              </label>
              <input
                id="payment-notes"
                type="text"
                maxLength={500}
                placeholder={t('payments.paymentNotesPlaceholder', 'e.g., Handed cash after shift completion')}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2455E8] focus:border-transparent"
              />
            </div>
          </div>

          {/* 3. Disclaimer Notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-[#2455E8] flex-shrink-0 mt-0.5" />
            <span>
              {t(
                'payments.disclaimerModal',
                'KaamSetu records offline payments settled between worker and employer. The worker will be notified to confirm receipt.'
              )}
            </span>
          </div>

          {/* ── Modal Footer ── */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={completeMutation.isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={completeMutation.isPending}
              className="px-5 py-2 bg-[#2455E8] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {completeMutation.isPending
                  ? t('common.saving', 'Recording...')
                  : t('payments.confirmCompleteBtn', 'Complete & Save')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
