import React from 'react';
import { useTranslation } from 'react-i18next';

type BadgeVariant =
  | 'application'
  | 'job'
  | 'booking'
  | 'payment'
  | 'verification'
  | 'availability'
  | 'workType';

interface MobileStatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

const STYLE_MAP: Record<string, string> = {
  // Positive / Completed / Verified
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // Attention / Pending / Partial
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  PENDING_CONFIRMATION: 'bg-amber-50 text-amber-800 border-amber-200',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-200',
  SHORTLISTED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  BUSY: 'bg-amber-50 text-amber-800 border-amber-200',

  // Negative / Rejected / Disputed / Cancelled
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  DISPUTED: 'bg-red-50 text-red-700 border-red-200',
  CLOSED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  WITHDRAWN: 'bg-slate-100 text-slate-600 border-slate-200',
  UNAVAILABLE: 'bg-red-50 text-red-700 border-red-200',
  EXPIRED: 'bg-slate-100 text-slate-600 border-slate-200',
  NOT_SUBMITTED: 'bg-slate-100 text-slate-600 border-slate-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const MobileStatusBadge: React.FC<MobileStatusBadgeProps> = ({
  status,
  variant = 'application',
  className = '',
}) => {
  const { t } = useTranslation();
  const key = (status || '').toUpperCase();

  let label = status;
  if (variant === 'payment') {
    label = t(`payments.statuses.${key}`, {
      defaultValue: t(`statuses.${key}`, { defaultValue: key.replace(/_/g, ' ') }),
    });
  } else if (variant === 'verification') {
    label = t(`verification.status.${key}`, {
      defaultValue: t(`statuses.${key}`, { defaultValue: key.replace(/_/g, ' ') }),
    });
  } else if (variant === 'availability') {
    label = t(`matching.availability.${key.toLowerCase()}`, {
      defaultValue: t(`statuses.${key}`, { defaultValue: key.replace(/_/g, ' ') }),
    });
  } else if (variant === 'workType') {
    label = t(`enums.workType.${key}`, {
      defaultValue: t(`workTypes.${key}`, { defaultValue: key.replace(/_/g, ' ') }),
    });
  } else {
    label = t(`statuses.${key}`, {
      defaultValue: t(`enums.status.${key}`, { defaultValue: key.replace(/_/g, ' ') }),
    });
  }

  const badgeStyle = STYLE_MAP[key] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold leading-tight whitespace-nowrap ${badgeStyle} ${className}`}
    >
      {label}
    </span>
  );
};

export default MobileStatusBadge;
