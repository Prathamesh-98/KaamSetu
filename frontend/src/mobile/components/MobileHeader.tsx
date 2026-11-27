import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, MapPin, User, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BrandLogo from '../../components/common/BrandLogo';
import MobileLanguageModal from './MobileLanguageModal';
import MobileLocationModal from './MobileLocationModal';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightElement,
}) => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [currentCity, setCurrentCity] = useState(localStorage.getItem('kaamsetu_mobile_city') || 'All India');

  const handleCitySelect = (city: string) => {
    setCurrentCity(city);
    localStorage.setItem('kaamsetu_mobile_city', city);
    setLocModalOpen(false);
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'WORKER') return '/worker/dashboard';
    if (user.role === 'EMPLOYER') return '/employer/dashboard';
    return '/admin/dashboard';
  };

  return (
    <>
      <header className="mobile-header-safe">
        <div className="flex h-14 items-center justify-between px-3">
          {/* Left section: Logo or Back + Title */}
          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                type="button"
                onClick={onBack || (() => navigate(-1))}
                className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Back"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <Link to="/" className="flex items-center gap-2">
                <BrandLogo variant="light" size="sm" linkTo={null} />
              </Link>
            )}

            {title && (
              <h1 className="text-base font-bold text-slate-900 line-clamp-1">{title}</h1>
            )}
          </div>

          {/* Right section: Location, Language, Profile/Login or custom element */}
          <div className="flex items-center gap-1">
            {rightElement ? (
              rightElement
            ) : (
              <>
                {/* Location selector button */}
                <button
                  type="button"
                  onClick={() => setLocModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  aria-label="Select location"
                >
                  <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                  <span className="max-w-[70px] truncate">{currentCity}</span>
                </button>

                {/* Language button */}
                <button
                  type="button"
                  onClick={() => setLangModalOpen(true)}
                  className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
                  aria-label="Change language"
                >
                  <Globe className="h-5 w-5 text-indigo-900" />
                </button>

                {/* Account / Login button */}
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => navigate(getDashboardPath())}
                    className="mobile-touch-target rounded-full p-1.5 text-indigo-900 hover:bg-slate-100"
                    aria-label="My Dashboard"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-900 text-xs font-bold text-white">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{t('auth.login', 'Login')}</span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <MobileLanguageModal
        isOpen={langModalOpen}
        onClose={() => setLangModalOpen(false)}
      />
      <MobileLocationModal
        isOpen={locModalOpen}
        currentCity={currentCity}
        onSelect={handleCitySelect}
        onClose={() => setLocModalOpen(false)}
      />
    </>
  );
};

export default MobileHeader;
