import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import type { PaymentStatus } from '../../types';

interface PaymentStatusBadgeProps {
  status?: PaymentStatus | null;
  className?: string;
  showIcon?: boolean;
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  className = '',
  showIcon = true,
}) => {
  const { t } = useTranslation();

  if (!status) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 ${className}`}>
        {t('payments.status.unknown', 'Unknown')}
      </span>
    );
  }

  const config: Record<
    PaymentStatus,
    { bg: string; text: string; border: string; icon: React.ReactNode; labelKey: string; defaultLabel: string }
  > = {
    CONFIRMED: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
      labelKey: 'payments.status.confirmed',
      defaultLabel: 'Settled & Confirmed',
    },
    PARTIALLY_PAID: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
      labelKey: 'payments.status.partially_paid',
      defaultLabel: 'Partially Paid',
    },
    PENDING_CONFIRMATION: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: <Clock className="w-3.5 h-3.5 text-blue-600" />,
      labelKey: 'payments.status.pending_confirmation',
      defaultLabel: 'Awaiting Worker Confirmation',
    },
    DISPUTED: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
      labelKey: 'payments.status.disputed',
      defaultLabel: 'Disputed',
    },
  };

  const item = config[status] || {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
    icon: <AlertCircle className="w-3.5 h-3.5 text-gray-500" />,
    labelKey: 'payments.status.unknown',
    defaultLabel: status,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${item.bg} ${item.text} ${item.border} ${className}`}
      role="status"
    >
      {showIcon && item.icon}
      <span>{t(item.labelKey, item.defaultLabel)}</span>
    </span>
  );
};
