import { useTranslation } from 'react-i18next';

export default function LanguageSelector({ isTransparent = false }: { isTransparent?: boolean }) {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', label: 'English', icon: '🇬🇧' },
    { code: 'hi', label: 'हिन्दी', icon: '🇮🇳' },
    { code: 'mr', label: 'मराठी', icon: '🇮🇳' },
    { code: 'kn', label: 'ಕನ್ನಡ', icon: '🇮🇳' },
    { code: 'te', label: 'తెలుగు', icon: '🇮🇳' }
  ];

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  return (
    <div className="relative group">
      <button 
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isTransparent ? 'text-white/90 hover:text-white hover:bg-white/10' : 'text-gray-700 hover:text-dark hover:bg-gray-50'}`}
        aria-label="Select language"
      >
        <span className="text-base leading-none">{currentLang.icon}</span>
        <span>{currentLang.label}</span>
        <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform origin-top-right">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-primary-50 transition-colors ${
              i18n.language === lang.code ? 'text-primary-600 font-semibold bg-primary-50/50' : 'text-gray-700'
            }`}
          >
            <span className="text-base">{lang.icon}</span>
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
