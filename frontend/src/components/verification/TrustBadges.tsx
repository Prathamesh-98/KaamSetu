// KaamSetu — Verification & Trust Status Badges
import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VerificationStatus } from '../../types';

interface VerificationStatusBadgeProps {
  status: VerificationStatus | string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  className = '',
  showIcon = true,
  size = 'md',
}) => {
  const { t } = useTranslation();

  const normalized = (status || 'NOT_SUBMITTED').toUpperCase();

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 rounded-lg gap-1',
    md: 'text-xs px-2.5 py-1 rounded-xl gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 rounded-xl gap-2 font-semibold',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  switch (normalized) {
    case 'VERIFIED':
      return (
        <span
          className={`inline-flex items-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-sm ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <ShieldCheck className={`${iconSizes[size]} text-emerald-600 flex-shrink-0`} />}
          <span>{t('verification.status.verified', 'Verified')}</span>
        </span>
      );

    case 'PENDING':
      return (
        <span
          className={`inline-flex items-center font-bold text-amber-700 bg-amber-50 border border-amber-200 shadow-sm ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <Clock className={`${iconSizes[size]} text-amber-500 animate-pulse flex-shrink-0`} />}
          <span>{t('verification.status.pending', 'Under Review')}</span>
        </span>
      );

    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center font-bold text-rose-700 bg-rose-50 border border-rose-200 shadow-sm ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <XCircle className={`${iconSizes[size]} text-rose-500 flex-shrink-0`} />}
          <span>{t('verification.status.rejected', 'Action Required')}</span>
        </span>
      );

    case 'EXPIRED':
      return (
        <span
          className={`inline-flex items-center font-bold text-gray-700 bg-gray-100 border border-gray-300 shadow-sm ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <AlertTriangle className={`${iconSizes[size]} text-gray-500 flex-shrink-0`} />}
          <span>{t('verification.status.expired', 'Expired')}</span>
        </span>
      );

    case 'NOT_SUBMITTED':
    default:
      return (
        <span
          className={`inline-flex items-center font-medium text-gray-500 bg-gray-50 border border-gray-200 ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <Shield className={`${iconSizes[size]} text-gray-400 flex-shrink-0`} />}
          <span>{t('verification.status.notSubmitted', 'Not Verified')}</span>
        </span>
      );
  }
};

export const PhoneVerifiedBadge: React.FC<{ isVerified: boolean; className?: string }> = ({
  isVerified,
  className = '',
}) => {
  const { t } = useTranslation();
  if (!isVerified) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-2.5 py-1 font-bold shadow-sm ${className}`}
      title={t('verification.phoneVerifiedTitle', 'Phone number verified via OTP')}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
      <span>{t('verification.phoneVerified', 'Phone Verified')}</span>
    </span>
  );
};

export const IdentityVerifiedBadge: React.FC<{ isVerified: boolean; className?: string }> = ({
  isVerified,
  className = '',
}) => {
  const { t } = useTranslation();
  if (!isVerified) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1 font-bold shadow-sm ${className}`}
      title={t('verification.identityVerifiedTitle', 'Government ID verified by KaamSetu')}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
      <span>{t('verification.idVerified', 'ID Verified')}</span>
    </span>
  );
};

export const CompanyVerifiedBadge: React.FC<{ isVerified: boolean; className?: string }> = ({
  isVerified,
  className = '',
}) => {
  const { t } = useTranslation();
  if (!isVerified) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-[#2455E8] bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1 font-bold shadow-sm ${className}`}
      title={t('verification.companyVerifiedTitle', 'Registered business verified')}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-[#2455E8]" />
      <span>{t('verification.businessVerified', 'Verified Business')}</span>
    </span>
  );
};
