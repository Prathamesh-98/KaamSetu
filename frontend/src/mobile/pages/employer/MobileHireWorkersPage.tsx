import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, MapPin, Star, ShieldCheck, Heart, User, 
  Calendar, CheckCircle2, X, Clock, Briefcase, Plus 
} from 'lucide-react';
import { adminApi, employerApi, shiftsApi } from '../../../api/services';

export const MobileHireWorkersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingWage, setBookingWage] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Load workers
  const { data: workersData, isLoading } = useQuery({
    queryKey: ['hire-workers', query, selectedCategory],
    queryFn: () => adminApi.listWorkers({ search: query || undefined, per_page: 30 }),
  });

  // Saved workers
  const { data: savedWorkerIds } = useQuery({
    queryKey: ['saved-worker-ids'],
    queryFn: employerApi.getSavedWorkerIds,
  });

  const savedSet = new Set(Array.isArray(savedWorkerIds) ? savedWorkerIds : []);

  const saveMutation = useMutation({
    mutationFn: (id: string) => employerApi.saveWorker(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-worker-ids'] }),
  });

  const unsaveMutation = useMutation({
    mutationFn: (id: string) => employerApi.removeSavedWorker(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-worker-ids'] }),
  });

  const handleToggleSave = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (savedSet.has(id)) unsaveMutation.mutate(id);
    else saveMutation.mutate(id);
  };

  const handleRequestBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker || isBooking) return;
    setIsBooking(true);
    try {
      await shiftsApi.requestShift({
        worker_id: selectedWorker.user_id || selectedWorker.id,
        shift_date: bookingDate,
        agreed_wage: Number(bookingWage) || 800,
      });
      setBookingSuccess(true);
    } catch {
      // ignore
    } finally {
      setIsBooking(false);
    }
  };

  const workers = workersData?.items || [];

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-900">Discover Skilled Workers</h1>
        <p className="text-xs text-slate-500">Hire verified tradespeople for shifts or projects</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, skill (e.g. Mason, Electrician)..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium shadow-sm focus:border-indigo-900 focus:outline-none"
        />
      </div>

      {/* Workers List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-2xl mobile-skeleton" />
          ))}
        </div>
      ) : workers.length > 0 ? (
        <div className="space-y-3">
          {workers.map((w: any) => (
            <div
              key={w.id}
              onClick={() => { setSelectedWorker(w); setBookingSuccess(false); }}
              className="mobile-card p-4 active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-900 text-white font-bold text-sm shadow">
                    {w.profile_image_url ? (
                      <img src={w.profile_image_url} alt="" className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      w.full_name?.charAt(0) || 'W'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-slate-900">{w.full_name}</h3>
                      {w.is_verified && (
                        <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-amber-600" />
                      <span>{w.city || 'India'}</span>
                      {w.years_experience && <span>· {w.years_experience} yrs exp</span>}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleToggleSave(e, w.id)}
                  className="mobile-touch-target -mr-2 -mt-2 p-2 text-slate-400 hover:text-red-500"
                  aria-label="Save worker"
                >
                  <Heart className={`h-5 w-5 ${savedSet.has(w.id) ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </div>

              {/* Skills and wage */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {w.skills && w.skills.slice(0, 2).map((s: any, idx: number) => (
                    <span key={idx} className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 text-[10px]">
                      {typeof s === 'string' ? s : s.name}
                    </span>
                  ))}
                </div>

                <div className="font-bold text-indigo-900 text-xs">
                  ₹{w.expected_salary || 800}<span className="text-[10px] font-normal text-slate-500">/day</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm mt-4">
          <User className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No Workers Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try searching for other trade categories or locations.</p>
        </div>
      )}

      {/* Booking / Profile Modal */}
      {selectedWorker && (
        <div className="mobile-modal-overlay">
          <div className="mobile-modal-sheet max-h-[88vh] max-h-[88dvh]">
            <div className="flex items-start justify-between border-b p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-900 text-white font-bold text-base shadow">
                  {selectedWorker.full_name?.charAt(0) || 'W'}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">{selectedWorker.full_name}</h3>
                  <p className="text-xs text-slate-500">{selectedWorker.city || 'India'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="mobile-touch-target rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {bookingSuccess ? (
                <div className="rounded-2xl bg-emerald-50 p-6 text-center border border-emerald-200 my-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                  <h4 className="font-bold text-emerald-900 text-base">Shift Booking Requested!</h4>
                  <p className="text-xs text-emerald-700 mt-1">The worker will receive your shift request notification.</p>
                </div>
              ) : (
                <form id="hire-worker-form" onSubmit={handleRequestBooking} className="space-y-3.5 py-1">
                  <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
                    <div className="font-semibold text-slate-700">Worker Bio</div>
                    <p className="text-slate-600">{selectedWorker.bio || 'Verified tradesperson registered on KaamSetu.'}</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Shift Date *</label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Agreed Daily Wage (₹) *</label>
                    <input
                      type="number"
                      value={bookingWage}
                      onChange={(e) => setBookingWage(e.target.value)}
                      placeholder={selectedWorker.expected_salary ? String(selectedWorker.expected_salary) : '800'}
                      required
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
                    />
                  </div>
                </form>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="mobile-sticky-footer">
              {bookingSuccess ? (
                <button
                  type="button"
                  onClick={() => setSelectedWorker(null)}
                  className="w-full rounded-xl bg-emerald-700 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 min-h-[48px]"
                >
                  Done
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedWorker(null)}
                    className="mobile-touch-target flex-1 rounded-xl border border-slate-300 py-3 text-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition-transform min-h-[48px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="hire-worker-form"
                    disabled={isBooking}
                    className="mobile-touch-target flex-[2] rounded-xl bg-indigo-900 py-3 text-center text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 min-h-[48px]"
                  >
                    {isBooking ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending Request...</span>
                      </>
                    ) : (
                      <span>Send Shift Request</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileHireWorkersPage;
