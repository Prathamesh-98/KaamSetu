import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

interface MobileLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
];

export const MobileLanguageModal: React.FC<MobileLanguageModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();

  if (!isOpen) return null;

  const currentLang = i18n.language?.slice(0, 2) || 'en';

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('kaamsetu_language', code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-slate-900">
            {t('nav.selectLanguage', 'Select Language')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target rounded-full p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => selectLanguage(lang.code)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 font-semibold text-indigo-900 border border-indigo-200'
                    : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{lang.native}</div>
                  <div className="text-xs text-slate-500">{lang.label}</div>
                </div>
                {isSelected && <Check className="h-5 w-5 text-indigo-900" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileLanguageModal;
