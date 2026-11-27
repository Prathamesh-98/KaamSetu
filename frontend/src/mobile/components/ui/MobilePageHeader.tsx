import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MobilePageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
  className?: string;
  dark?: boolean;
}

/**
 * Unified sticky top header handling Android status bar / cutout insets cleanly.
 */
export const MobilePageHeader: React.FC<MobilePageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightSlot,
  className = '',
  dark = false,
}) => {
  const { t } = useTranslation(['translation', 'mobile']);
  const navigate = useNavigate();

  return (
    <header
      className={`mobile-header-safe ${
        dark
          ? 'bg-gradient-to-r from-[#172154] to-[#1F2A6B] text-white border-b-0 shadow-md'
          : 'bg-white text-slate-900'
      } ${className}`}
    >
      <div className="flex min-h-[56px] items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {showBack && (
            <button
              type="button"
              onClick={onBack || (() => navigate(-1))}
              className={`mobile-touch-target rounded-full p-2 flex-shrink-0 active:scale-95 ${
                dark ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
              }`}
              aria-label={t('mobile:common.back', 'Back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1 px-1">
            <h1 className={`text-base font-extrabold tracking-tight truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h1>
            {subtitle && (
              <p className={`text-[11px] truncate ${dark ? 'text-indigo-200' : 'text-slate-500'}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {rightSlot && <div className="flex items-center gap-1 flex-shrink-0">{rightSlot}</div>}
      </div>
    </header>
  );
};

export default MobilePageHeader;
