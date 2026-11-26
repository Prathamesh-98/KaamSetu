import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Search, MapPin } from 'lucide-react';

interface MobileLocationModalProps {
  isOpen: boolean;
  currentCity: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}

const POPULAR_CITIES = [
  'All India',
  'Mumbai',
  'Pune',
  'Delhi NCR',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Nagpur',
  'Nashik',
  'Jaipur',
  'Lucknow',
];

export const MobileLocationModal: React.FC<MobileLocationModalProps> = ({
  isOpen,
  currentCity,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredCities = POPULAR_CITIES.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm max-h-[80vh] flex flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">
              {t('jobs.location', 'Select Location')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mobile-touch-target rounded-full p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search', 'Search city...')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-900 focus:bg-white focus:outline-none"
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
          {filteredCities.map((city) => {
            const isSelected = currentCity === city;
            return (
              <button
                key={city}
                type="button"
                onClick={() => onSelect(city)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-amber-50 font-semibold text-amber-900 border border-amber-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{city}</span>
                {isSelected && <Check className="h-4 w-4 text-amber-700" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileLocationModal;
